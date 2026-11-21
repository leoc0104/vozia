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
  VideoIngestor,
} from './contracts.js'
import { PipelineError } from './errors.js'
import { attachSounds, lineNotes, performedTiming } from './performance.js'
import { speechWindows } from './speech-windows.js'

/** The most the new voice is raised or lowered to match the original, so a bad measurement cannot ruin the mix. */
export const MAX_VOICE_GAIN_DB = 10

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
    // How each line was performed: the speaker's own laughs, screams or sighs next to it, and how loud, high and
    // lively it was against their usual delivery. The translator directs the dubbed performance from these.
    const sounds = attachSounds(transcript.segments, transcript.events ?? [])
    const delivery = await this.d.media.measureDelivery(vocalsPath, transcript.segments, ctx)
    const translated = await this.d.translator.translate(
      transcript.segments,
      {
        sourceLanguage: transcript.language,
        targetLanguage: dub.target_language,
        notes: lineNotes(transcript.segments, sounds, delivery),
      },
      ctx,
    )
    await this.d.repo.replaceSegments(dub.id, translated)

    await ctx.setStage('synthesizing')
    const totalDurationMs = Math.round(ingest.durationSeconds * 1000)
    // A voice that performs directions also laughs where the speaker laughed, so those lines span their sounds.
    const performed = this.d.synthesizer.performsDirections ? performedTiming(translated, sounds) : translated
    const { dubbedVocalsPath } = await this.d.synthesizer.synthesize(
      {
        segments: performed,
        vocalsPath,
        voiceMode: dub.voice_mode,
        stockVoiceId: dub.stock_voice_id,
        targetLanguage: dub.target_language,
        totalDurationMs,
      },
      ctx,
    )

    await ctx.setStage('muxing')
    // Between lines the original audio plays untouched, so sounds there survive even when the separator files them
    // under the voice; while someone speaks, the separated background and the recreated noise floor carry the room.
    // The windows follow the performed lines, so a laugh the new voice performs is not also heard from the original.
    const bedPath = await this.d.media.buildDubBackground(
      { originalPath: ingest.audioPath, backgroundPath, speech: speechWindows(performed, totalDurationMs) },
      ctx,
    )
    // The new voice speaks as loud as the speaker did. One gain for the whole track keeps the performance's own
    // rises and falls; the limiter in the mux catches any peak.
    const voiceGainDb = matchVoiceLevel(
      await this.d.media.loudness(vocalsPath, ctx),
      await this.d.media.loudness(dubbedVocalsPath, ctx),
    )
    const { outputPath } = await this.d.media.mux(
      { videoPath: ingest.videoPath, backgroundPath: bedPath, dubbedVocalsPath, voiceGainDb },
      ctx,
    )
    const originalSrt = path.join(ctx.workdir, 'original.srt')
    const translatedSrt = path.join(ctx.workdir, 'translated.srt')
    await writeFile(originalSrt, toSrt(translated, 'text'))
    await writeFile(translatedSrt, toSrt(translated, 'translatedText'))

    const owner = dub.owner_id
    const objects = {
      output: outputObjectPath(owner, dub.id, 'dubbed.mp4'),
      audio: outputObjectPath(owner, dub.id, 'dubbed_vocals.wav'),
      srtOriginal: outputObjectPath(owner, dub.id, 'original.srt'),
      srtTranslated: outputObjectPath(owner, dub.id, 'translated.srt'),
    }
    await this.d.storage.upload(BUCKETS.outputs, objects.output, outputPath, 'video/mp4')
    await this.d.storage.upload(BUCKETS.outputs, objects.audio, dubbedVocalsPath, 'audio/wav')
    await this.d.storage.upload(BUCKETS.outputs, objects.srtOriginal, originalSrt, 'application/x-subrip')
    await this.d.storage.upload(BUCKETS.outputs, objects.srtTranslated, translatedSrt, 'application/x-subrip')

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
