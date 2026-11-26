import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { minutesToCharge, toSrt } from '@vozia/shared'
import { BUCKETS, outputObjectPath, sourceObjectPath, thumbnailObjectPath } from '@vozia/db'
import type { DubRetakeRow } from '@vozia/db'
import type { DubRepository, VideoIngestPatch } from '../repo/contracts.js'
import type {
  AudioSeparator,
  DubJob,
  DubbingPipeline,
  IngestResult,
  JobContext,
  LineNotes,
  MediaProcessor,
  ObjectStorage,
  SoundEvent,
  SpeechSynthesizer,
  StageContext,
  Transcriber,
  TranslatedSegment,
  Translator,
  VideoBrief,
  VideoIngestor,
  VoiceAnalysis,
} from './contracts.js'
import { directPerformance, type Performance, type PerformedLine } from './director.js'
import { dubQuality, linePerformance } from './quality.js'
import { PipelineError } from './errors.js'
import { attachSounds, lineNotes, voiceAnalysisRequest, wordlessVoice, type AttachedSound } from './performance.js'
import { dubWindows } from './speech-windows.js'
import { MAX_FRAMES, frameTimes } from './watching.js'
import { briefFromWorkspace, briefToWorkspace, fromWorkspaceLine, toWorkspaceLine, workspacePaths, type DubWorkspace } from './workspace.js'

/** Everything the second half of a dub needs, whether every line was just performed or one line was re-taken. */
interface MixInput {
  job: DubJob
  videoPath: string
  audioPath: string
  vocalsPath: string
  backgroundPath: string
  totalDurationMs: number
  /** Every line, as finally spoken. */
  segments: TranslatedSegment[]
  analysis: VoiceAnalysis | null
  tagged: SoundEvent[]
  sounds: ReadonlyMap<number, readonly AttachedSound[]>
  notes: ReadonlyMap<number, LineNotes>
  cutsMs: number[]
  brief: VideoBrief | null
  sourceLanguage: string
  targetLanguage: string
  performance: Performance
  pitchShiftSt: number
  /** Whether the voice sample was made in this run and should be kept. */
  keepSample: boolean
}

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
    // Re-takes may have reworded lines: the subtitles follow what is spoken.
    const final = translated.map((s) => performance.lines.find((line) => line.segment.idx === s.idx)?.segment ?? s)
    if (performance.lines.some((line) => line.revised)) await this.d.repo.replaceSegments(dub.id, final)

    await ctx.setStage('muxing')
    const objects = await this.mixAndPublish(
      {
        job,
        videoPath: ingest.videoPath,
        audioPath: ingest.audioPath,
        vocalsPath,
        backgroundPath,
        totalDurationMs,
        segments: final,
        analysis,
        tagged,
        sounds,
        notes,
        cutsMs: cuts,
        brief,
        sourceLanguage: transcript.language,
        targetLanguage: dub.target_language,
        performance,
        pitchShiftSt: pitchCorrection(performance.pitchOffsetSt),
        keepSample: true,
      },
      ctx,
    )
    await this.d.repo.markCompleted(dub.id, {
      outputPath: objects.output,
      dubbedAudioPath: objects.audio,
      srtOriginalPath: objects.srtOriginal,
      srtTranslatedPath: objects.srtTranslated,
      minutes: minutesToCharge(ingest.durationSeconds),
      detectedLanguage: transcript.language,
    })
  }

  /**
   * Performs one line of a finished dub again, in the words the person wrote, and remixes the dub from what the first
   * run kept (see DubWorkspace): every other line stays exactly as it was laid. The dub stays playable meanwhile.
   */
  async retake(job: DubJob, retake: DubRetakeRow, ctx: StageContext): Promise<void> {
    const { dub, video } = job
    const paths = workspacePaths(dub.owner_id, dub.id)
    const stateFile = path.join(ctx.workdir, 'state.json')
    try {
      await this.d.storage.download(BUCKETS.outputs, paths.state, stateFile)
    } catch (error) {
      if (ctx.signal.aborted) throw error
      throw new PipelineError('This dub was made before lines could be re-taken: dub the video again to re-take its lines.', { cause: error })
    }
    const state = JSON.parse(await readFile(stateFile, 'utf8')) as DubWorkspace
    const segment = state.segments.find((s) => s.idx === retake.idx)
    if (!segment) throw new PipelineError('That line is not part of this dub.')
    if (!video.storage_path) throw new PipelineError('The original video is missing, so the dub cannot be remixed.')

    // The source and its separation, again: they are not kept, to save storage.
    const videoPath = path.join(ctx.workdir, `source${path.extname(video.storage_path) || '.mp4'}`)
    await this.d.storage.download(BUCKETS.sources, video.storage_path, videoPath)
    const audioPath = await this.d.media.extractAudio(videoPath, ctx)
    const { vocalsPath, backgroundPath } = await this.d.separator.separate(audioPath, ctx)
    const analysis = await this.d.media.analyzeVoice(vocalsPath, voiceAnalysisRequest(state.segments, state.tagged), ctx)

    // Every other line's take, and the sample the voice was cloned from, as the first run kept them.
    const keptDir = path.join(ctx.workdir, 'kept')
    await mkdir(keptDir, { recursive: true })
    const bySegment = new Map(state.segments.map((s) => [s.idx, s]))
    const kept: PerformedLine[] = []
    for (const line of state.lines) {
      const keptSegment = bySegment.get(line.idx)
      if (line.idx === retake.idx || !keptSegment) continue
      const file = path.join(keptDir, `${line.idx}.mp3`)
      await this.d.storage.download(BUCKETS.outputs, paths.take(line.idx), file)
      kept.push(fromWorkspaceLine(line, keptSegment, file))
    }
    let samplePath: string | undefined
    if (state.hasSample) {
      samplePath = path.join(ctx.workdir, 'sample.mp3')
      await this.d.storage.download(BUCKETS.outputs, paths.sample, samplePath)
    }

    // The person's words, directed like the rest of the dub, without changing a word.
    const notes = new Map(state.notes)
    const sounds = new Map(state.sounds)
    const brief = briefFromWorkspace(state.brief)
    const translateOptions = { sourceLanguage: state.sourceLanguage, targetLanguage: state.targetLanguage, notes, brief }
    const { performanceText: _performance, performedSounds: _sounds, anchors: _anchors, ...base } = segment
    const words: TranslatedSegment = { ...base, translatedText: retake.text }
    const [directed] = this.d.translator.revise
      ? await this.d.translator.revise(
          [
            {
              segment: words,
              notes: notes.get(retake.idx),
              feedback: ['The person who made this dub rewrote this line: keep their words exactly, and direct how they are said.'],
              keepWords: true,
            },
          ],
          translateOptions,
          ctx,
        )
      : []
    const segments = state.segments.map((s) => (s.idx === retake.idx ? (directed ?? words) : s))
    const performance = await directPerformance(
      this.d,
      {
        segments,
        notes,
        sounds,
        analysis,
        cutsMs: state.cutsMs,
        vocalsPath,
        voiceMode: dub.voice_mode,
        stockVoiceId: dub.stock_voice_id,
        totalDurationMs: state.totalDurationMs,
        translateOptions,
        retakeRounds: this.d.retakeRounds ?? 1,
        only: [retake.idx],
        kept,
        keepWords: true,
        ...(samplePath ? { samplePath } : {}),
      },
      ctx,
    )
    const final = segments.map((s) => performance.lines.find((line) => line.segment.idx === s.idx)?.segment ?? s)
    await this.mixAndPublish(
      {
        job,
        videoPath,
        audioPath,
        vocalsPath,
        backgroundPath,
        totalDurationMs: state.totalDurationMs,
        segments: final,
        analysis,
        tagged: state.tagged,
        sounds,
        notes,
        cutsMs: state.cutsMs,
        brief,
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
        performance,
        pitchShiftSt: state.pitchShiftSt,
        keepSample: !samplePath,
      },
      ctx,
    )
  }

  /**
   * Makes the new voice sound recorded where the original was, lays the room under it, mixes the video and publishes
   * the dub: the files, how each line was performed, how close the dub came, and what a later re-take needs.
   */
  private async mixAndPublish(m: MixInput, ctx: StageContext) {
    const { job, performance } = m
    const { dub } = job
    const originalWords = m.segments.flatMap((s) => (s.words?.length ? s.words : [s]).map(({ startMs, endMs }) => ({ startMs, endMs })))
    // The new voice made to sound recorded where the original was, at the speaker's own pitch.
    const matched = await this.d.media.matchVoice(
      {
        originalVocalsPath: m.vocalsPath,
        originalSpeech: originalWords,
        dubVocalsPath: performance.dubbedVocalsPath,
        dubSpeech: performance.lines.flatMap((line) =>
          line.pieces.map((p) => ({ startMs: p.outStartMs, endMs: Math.round(p.outStartMs + (p.toMs - p.fromMs) / p.tempo) })),
        ),
        pitchShiftSt: m.pitchShiftSt,
      },
      ctx,
    )
    const voicePath = matched?.path ?? performance.dubbedVocalsPath
    // Between lines the original audio plays untouched, so sounds there survive even when the separator files them
    // under the voice. The original voice gives way only over its words, and over the sounds the new voice
    // re-performs while it performs them; there, the separated background and the voice track's own noise carry the
    // room.
    const performedSounds = performance.lines.flatMap((line) =>
      (m.sounds.get(line.segment.idx) ?? [])
        .filter((sound) => this.d.synthesizer.performsDirections && line.segment.performedSounds?.includes(sound.id))
        .map((sound) => ({ original: { startMs: sound.startMs, endMs: sound.endMs }, dub: performance.measured ? line.soundSpans : null })),
    )
    const windows = dubWindows({ words: originalWords, performed: performedSounds, totalMs: m.totalDurationMs, envelope: m.analysis?.envelope })
    const busy = [...originalWords, ...[...m.tagged, ...wordlessVoice(m.analysis)].map(({ startMs, endMs }) => ({ startMs, endMs }))]
    const bedPath = await this.d.media.buildDubBackground(
      { originalPath: m.audioPath, backgroundPath: m.backgroundPath, speech: windows, vocalsPath: m.vocalsPath, busy },
      ctx,
    )
    // The new voice speaks as loud as the speaker did. One gain for the whole track keeps the performance's own
    // rises and falls; the limiter in the mux catches any peak.
    const voiceGainDb = matchVoiceLevel(await this.d.media.loudness(m.vocalsPath, ctx), await this.d.media.loudness(voicePath, ctx))
    const { outputPath } = await this.d.media.mux(
      { videoPath: m.videoPath, backgroundPath: bedPath, dubbedVocalsPath: voicePath, voiceGainDb, captions: m.brief?.captions ?? [] },
      ctx,
    )
    const originalSrt = path.join(ctx.workdir, 'original.srt')
    const translatedSrt = path.join(ctx.workdir, 'translated.srt')
    await writeFile(originalSrt, toSrt(m.segments, 'text'))
    await writeFile(translatedSrt, toSrt(m.segments, 'translatedText'))

    const objects = {
      output: outputObjectPath(dub.owner_id, dub.id, 'dubbed.mp4'),
      audio: outputObjectPath(dub.owner_id, dub.id, 'dubbed_vocals.wav'),
      srtOriginal: outputObjectPath(dub.owner_id, dub.id, 'original.srt'),
      srtTranslated: outputObjectPath(dub.owner_id, dub.id, 'translated.srt'),
    }
    await this.d.storage.upload(BUCKETS.outputs, objects.output, outputPath, 'video/mp4')
    await this.d.storage.upload(BUCKETS.outputs, objects.audio, voicePath, 'audio/wav')
    await this.d.storage.upload(BUCKETS.outputs, objects.srtOriginal, originalSrt, 'application/x-subrip')
    await this.d.storage.upload(BUCKETS.outputs, objects.srtTranslated, translatedSrt, 'application/x-subrip')

    // What the dub page shows: how each line was performed and how close the dub came to the original.
    const lineRecords = performance.lines.map((line) => ({
      idx: line.segment.idx,
      performance: linePerformance(line, m.sounds.get(line.segment.idx) ?? []),
      translatedText: line.segment.translatedText,
    }))
    const quality = dubQuality(performance, lineRecords.map((l) => l.performance), matched, m.brief?.captions.length ?? 0)
    await this.d.repo.savePerformance(dub.id, lineRecords, quality)
    await this.saveWorkspace(m, ctx)
    return objects
  }

  /** Keeps what a re-take needs. A dub never fails for it: without it, its lines just cannot be re-taken. */
  private async saveWorkspace(m: MixInput, ctx: StageContext): Promise<void> {
    const { dub } = m.job
    const paths = workspacePaths(dub.owner_id, dub.id)
    try {
      for (const line of m.performance.lines.filter((l) => m.performance.performedIdx.includes(l.segment.idx))) {
        const take = line.pieces[0]?.path
        if (take) await this.d.storage.upload(BUCKETS.outputs, paths.take(line.segment.idx), take, 'audio/mpeg')
      }
      if (m.keepSample && m.performance.samplePath) {
        await this.d.storage.upload(BUCKETS.outputs, paths.sample, m.performance.samplePath, 'audio/mpeg')
      }
      const state: DubWorkspace = {
        version: 1,
        sourceLanguage: m.sourceLanguage,
        targetLanguage: m.targetLanguage,
        totalDurationMs: m.totalDurationMs,
        segments: m.segments,
        notes: [...m.notes],
        sounds: [...m.sounds].map(([idx, list]) => [idx, [...list]]),
        tagged: m.tagged,
        cutsMs: m.cutsMs,
        brief: briefToWorkspace(m.brief),
        pitchShiftSt: m.pitchShiftSt,
        hasSample: m.keepSample ? Boolean(m.performance.samplePath) : true,
        lines: m.performance.lines.map(toWorkspaceLine),
      }
      const file = path.join(ctx.workdir, 'workspace.json')
      await writeFile(file, JSON.stringify(state))
      await this.d.storage.upload(BUCKETS.outputs, paths.state, file, 'application/json')
    } catch (error) {
      if (ctx.signal.aborted) throw error
      ctx.log.warn({ error }, "could not keep what re-takes need: this dub's lines cannot be re-taken")
    }
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
