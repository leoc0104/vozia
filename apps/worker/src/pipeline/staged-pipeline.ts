import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { minutesToCharge, toSrt } from '@vozia/shared'
import { BUCKETS, outputObjectPath, sourceObjectPath, thumbnailObjectPath } from '@vozia/db'
import type { DubRepository, VideoIngestPatch } from '../repo/contracts.js'
import type {
  AudioSeparator,
  DubJob,
  DubbingPipeline,
  IngestResult,
  JobContext,
  MediaProcessor,
  ObjectStorage,
  SpeechSynthesizer,
  Transcriber,
  Translator,
  VideoBrief,
  VideoIngestor,
} from './contracts.js'
import { directPerformance } from './director.js'
import { dubQuality, linePerformance } from './quality.js'
import { PipelineError } from './errors.js'
import { attachSounds, lineNotes, voiceAnalysisRequest, wordlessVoice } from './performance.js'
import { dubWindows } from './speech-windows.js'
import { MAX_FRAMES, frameTimes } from './watching.js'

/** How many lines the translator watches together, each group with up to MAX_FRAMES frames. */
const LINES_PER_LOOK = 40

/** The most the new voice is raised or lowered to match the original, so a bad measurement cannot ruin the mix. */
export const MAX_VOICE_GAIN_DB = 10

/** A clone this far from the speaker's usual pitch, or farther, is moved back to it; at most MAX_PITCH_FIX_ST. */
export const PITCH_FIX_FROM_ST = 1.5
export const MAX_PITCH_FIX_ST = 3

/** How far to move the new voice's pitch so it speaks at the speaker's usual pitch; 0 when close enough or unknown. */
export function pitchCorrection(offsetSt: number | null): number {
  if (offsetSt === null || Math.abs(offsetSt) < PITCH_FIX_FROM_ST) return 0
  return Math.round(-Math.max(-MAX_PITCH_FIX_ST, Math.min(MAX_PITCH_FIX_ST, offsetSt)) * 10) / 10
}

/** The gain that brings the new voice to the original voice's loudness (both in LUFS); 0 when either is unknown. */
export function matchVoiceLevel(originalLufs: number | null, dubbedLufs: number | null): number {
  if (originalLufs === null || dubbedLufs === null) return 0
  const gain = Math.max(-MAX_VOICE_GAIN_DB, Math.min(MAX_VOICE_GAIN_DB, originalLufs - dubbedLufs))
  return Math.round(gain * 10) / 10
}

export interface StagedPipelineDeps {
  ingestor: VideoIngestor
  separator: AudioSeparator
  transcriber: Transcriber
  translator: Translator
  synthesizer: SpeechSynthesizer
  media: MediaProcessor
  storage: ObjectStorage
  repo: DubRepository
  /** How many rounds of re-takes a line may get (VOZIA_RETAKE_ROUNDS); defaults to 1. */
  retakeRounds?: number
}

/** Ingest → separate → transcribe → translate → synthesize → mux, each stage behind a contract. */
export class StagedPipeline implements DubbingPipeline {
  readonly name = 'staged' as const

  constructor(private readonly d: StagedPipelineDeps) {}

  async run(job: DubJob, ctx: JobContext): Promise<void> {
    const { dub, video } = job

    await ctx.setStage('ingesting')
    const ingest = await this.d.ingestor.ingest(
      { sourceType: video.source_type, sourceUrl: video.source_url, storagePath: video.storage_path },
      ctx,
    )
    await this.persistIngest(job, ingest)

    await ctx.setStage('separating')
    const { vocalsPath, backgroundPath } = await this.d.separator.separate(ingest.audioPath, ctx)

    await ctx.setStage('transcribing')
    const transcript = await this.d.transcriber.transcribe(vocalsPath, { languageHint: dub.source_language }, ctx)
    if (transcript.segments.length === 0) {
      throw new PipelineError('No speech was detected in this video.', { stage: 'transcribing' })
    }
    await this.d.repo.replaceSegments(dub.id, transcript.segments)
    await this.d.repo.patchDub(dub.id, { detected_language: transcript.language })

    await ctx.setStage('translating')
    // How each line was performed: how loud, high and lively it was against the speaker's usual line, the laughs,
    // screams or sighs next to it (tagged, or found as voice without words), and where the picture cuts. The
    // translator directs the dubbed performance from these.
    const tagged = transcript.events ?? []
    const analysis = await this.d.media.analyzeVoice(vocalsPath, voiceAnalysisRequest(transcript.segments, tagged), ctx)
    const sounds = attachSounds(transcript.segments, [...tagged, ...wordlessVoice(analysis)])
    const cuts = await this.d.media.sceneCuts(ingest.videoPath, ctx)
    const totalDurationMs = Math.round(ingest.durationSeconds * 1000)
    const languages = { sourceLanguage: transcript.language, targetLanguage: dub.target_language }
    // The translator watches the video first, so it keeps jokes tied to the picture and finds captions to translate.
    let brief: VideoBrief | null = null
    if (this.d.translator.watch) {
      const looks = MAX_FRAMES * Math.ceil(transcript.segments.length / LINES_PER_LOOK)
      const frames = await this.d.media.frames(ingest.videoPath, frameTimes(transcript.segments, cuts, totalDurationMs, looks), ctx)
      brief = await this.d.translator.watch(transcript.segments, { ...languages, frames, cutsMs: cuts, durationMs: totalDurationMs }, ctx)
    }
    const notes = lineNotes(transcript.segments, sounds, analysis, cuts)
    const translateOptions = { ...languages, notes, brief }
    const translated = await this.d.translator.translate(transcript.segments, translateOptions, ctx)
    await this.d.repo.replaceSegments(dub.id, translated)

    await ctx.setStage('synthesizing')
    // Takes are measured, sent back when they do not fit or do not sound like the original, and laid word by word.
    const performance = await directPerformance(
      this.d,
      {
        segments: translated,
        notes,
        sounds,
        analysis,
        cutsMs: cuts,
        vocalsPath,
        voiceMode: dub.voice_mode,
        stockVoiceId: dub.stock_voice_id,
        totalDurationMs,
        translateOptions,
        retakeRounds: this.d.retakeRounds ?? 1,
      },
      ctx,
    )
    const { dubbedVocalsPath } = performance
    // Re-takes may have reworded lines: the subtitles follow what is spoken.
    const final = translated.map((s) => performance.lines.find((line) => line.segment.idx === s.idx)?.segment ?? s)
    if (performance.lines.some((line) => line.revised)) await this.d.repo.replaceSegments(dub.id, final)

    await ctx.setStage('muxing')
    const originalWords = transcript.segments.flatMap((s) => (s.words?.length ? s.words : [s]).map(({ startMs, endMs }) => ({ startMs, endMs })))
    // The new voice made to sound recorded where the original was, at the speaker's own pitch.
    const matched = await this.d.media.matchVoice(
      {
        originalVocalsPath: vocalsPath,
        originalSpeech: originalWords,
        dubVocalsPath: dubbedVocalsPath,
        dubSpeech: performance.lines.flatMap((line) =>
          line.pieces.map((p) => ({ startMs: p.outStartMs, endMs: Math.round(p.outStartMs + (p.toMs - p.fromMs) / p.tempo) })),
        ),
        pitchShiftSt: pitchCorrection(performance.pitchOffsetSt),
      },
      ctx,
    )
    const voicePath = matched?.path ?? dubbedVocalsPath
    // Between lines the original audio plays untouched, so sounds there survive even when the separator files them
    // under the voice. The original voice gives way only over its words, and over the sounds the new voice
    // re-performs while it performs them; there, the separated background and the voice track's own noise carry the
    // room.
    const performedSounds = performance.lines.flatMap((line) =>
      (sounds.get(line.segment.idx) ?? [])
        .filter((sound) => this.d.synthesizer.performsDirections && line.segment.performedSounds?.includes(sound.id))
        .map((sound) => ({ original: { startMs: sound.startMs, endMs: sound.endMs }, dub: performance.measured ? line.soundSpans : null })),
    )
    const windows = dubWindows({ words: originalWords, performed: performedSounds, totalMs: totalDurationMs, envelope: analysis?.envelope })
    const busy = [...originalWords, ...[...tagged, ...wordlessVoice(analysis)].map(({ startMs, endMs }) => ({ startMs, endMs }))]
    const bedPath = await this.d.media.buildDubBackground(
      { originalPath: ingest.audioPath, backgroundPath, speech: windows, vocalsPath, busy },
      ctx,
    )
    // The new voice speaks as loud as the speaker did. One gain for the whole track keeps the performance's own
    // rises and falls; the limiter in the mux catches any peak.
    const voiceGainDb = matchVoiceLevel(await this.d.media.loudness(vocalsPath, ctx), await this.d.media.loudness(voicePath, ctx))
    const { outputPath } = await this.d.media.mux(
      { videoPath: ingest.videoPath, backgroundPath: bedPath, dubbedVocalsPath: voicePath, voiceGainDb, captions: brief?.captions ?? [] },
      ctx,
    )
    const originalSrt = path.join(ctx.workdir, 'original.srt')
    const translatedSrt = path.join(ctx.workdir, 'translated.srt')
    await writeFile(originalSrt, toSrt(final, 'text'))
    await writeFile(translatedSrt, toSrt(final, 'translatedText'))

    const owner = dub.owner_id
    const objects = {
      output: outputObjectPath(owner, dub.id, 'dubbed.mp4'),
      audio: outputObjectPath(owner, dub.id, 'dubbed_vocals.wav'),
      srtOriginal: outputObjectPath(owner, dub.id, 'original.srt'),
      srtTranslated: outputObjectPath(owner, dub.id, 'translated.srt'),
    }
    await this.d.storage.upload(BUCKETS.outputs, objects.output, outputPath, 'video/mp4')
    await this.d.storage.upload(BUCKETS.outputs, objects.audio, voicePath, 'audio/wav')
    await this.d.storage.upload(BUCKETS.outputs, objects.srtOriginal, originalSrt, 'application/x-subrip')
    await this.d.storage.upload(BUCKETS.outputs, objects.srtTranslated, translatedSrt, 'application/x-subrip')

    // What the dub page shows: how each line was performed and how close the dub came to the original.
    const lineRecords = performance.lines.map((line) => ({
      idx: line.segment.idx,
      performance: linePerformance(line, sounds.get(line.segment.idx) ?? []),
    }))
    const captions = brief?.captions.length ?? 0
    await this.d.repo.savePerformance(dub.id, lineRecords, dubQuality(performance, lineRecords.map((l) => l.performance), matched, captions))

    await this.d.repo.markCompleted(dub.id, {
      outputPath: objects.output,
      dubbedAudioPath: objects.audio,
      srtOriginalPath: objects.srtOriginal,
      srtTranslatedPath: objects.srtTranslated,
      minutes: minutesToCharge(ingest.durationSeconds),
      detectedLanguage: transcript.language,
    })
  }

  /** Stores what ingestion learned: duration, thumbnail, and for YouTube the original file itself. */
  private async persistIngest(job: DubJob, ingest: IngestResult): Promise<void> {
    const { dub, video } = job
    const patch: VideoIngestPatch = { durationSeconds: Math.round(ingest.durationSeconds) }
    if (ingest.downloaded && ingest.title) patch.title = ingest.title
    if (ingest.thumbnailPath) {
      const thumbnail = thumbnailObjectPath(dub.owner_id, video.id)
      await this.d.storage.upload(BUCKETS.sources, thumbnail, ingest.thumbnailPath, 'image/jpeg')
      patch.thumbnailPath = thumbnail
    }
    if (ingest.downloaded && !video.storage_path) {
      const source = sourceObjectPath(dub.owner_id, video.id, 'mp4')
      await this.d.storage.upload(BUCKETS.sources, source, ingest.videoPath, 'video/mp4')
      patch.storagePath = source
    }
    await this.d.repo.updateVideoAfterIngest(video.id, patch)
  }
}
