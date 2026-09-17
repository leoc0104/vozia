import type { DubStatus, Pipeline, SourceType, VoiceMode } from '@vozia/shared'
import type { DubRow, ProfileRow, VideoRow } from '@vozia/db'
import type { Logger } from '../logger.js'

export interface Word {
  text: string
  startMs: number
  endMs: number
  speaker?: string | null
}

export interface TranscriptSegment {
  idx: number
  startMs: number
  endMs: number
  text: string
  speaker?: string | null
}

export interface TranslatedSegment extends TranscriptSegment {
  translatedText: string
}

/** What every driver receives: a scratch directory, a logger, an abort signal and a progress sink. */
export interface StageContext {
  workdir: string
  log: Logger
  signal: AbortSignal
  progress(fraction: number): void
}

export interface IngestInput {
  sourceType: SourceType
  sourceUrl: string | null
  storagePath: string | null
}

export interface IngestResult {
  videoPath: string
  audioPath: string
  durationSeconds: number
  title: string | null
  thumbnailPath: string | null
  /** True when the video was fetched from the internet (YouTube) rather than from Storage. */
  downloaded: boolean
}

export interface VideoIngestor {
  ingest(input: IngestInput, ctx: StageContext): Promise<IngestResult>
}

export interface AudioSeparator {
  separate(audioPath: string, ctx: StageContext): Promise<{ vocalsPath: string; backgroundPath: string }>
}

export interface Transcriber {
  transcribe(
    audioPath: string,
    opts: { languageHint: string | null },
    ctx: StageContext,
  ): Promise<{ language: string; segments: TranscriptSegment[] }>
}

export interface Translator {
  translate(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string },
    ctx: StageContext,
  ): Promise<TranslatedSegment[]>
}

export interface SynthesisRequest {
  segments: TranslatedSegment[]
  vocalsPath: string
  voiceMode: VoiceMode
  stockVoiceId: string | null
  targetLanguage: string
  totalDurationMs: number
}

export interface SpeechSynthesizer {
  synthesize(req: SynthesisRequest, ctx: StageContext): Promise<{ dubbedVocalsPath: string }>
}

/** Where a synthesized clip lands on the original timeline and how much it must be sped up. */
export interface Placement {
  idx: number
  startMs: number
  tempo: number
}

export interface MediaProcessor {
  extractAudio(videoPath: string, ctx: StageContext): Promise<string>
  probeDurationSeconds(path: string, ctx: StageContext): Promise<number>
  thumbnail(videoPath: string, ctx: StageContext): Promise<string>
  clipAudio(inputPath: string, opts: { startSec: number; durationSec: number }, ctx: StageContext): Promise<string>
  duck(audioPath: string, gainDb: number, ctx: StageContext): Promise<string>
  assembleTimeline(
    clips: { placement: Placement; path: string }[],
    totalDurationMs: number,
    ctx: StageContext,
  ): Promise<string>
  mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string },
    ctx: StageContext,
  ): Promise<{ outputPath: string }>
}

export interface ObjectStorage {
  download(bucket: string, objectPath: string, destPath: string): Promise<void>
  upload(bucket: string, objectPath: string, filePath: string, contentType: string): Promise<void>
  remove(bucket: string, objectPaths: string[]): Promise<void>
}

export interface DubJob {
  dub: DubRow
  video: VideoRow
  profile: ProfileRow
}

export interface JobContext extends StageContext {
  readonly currentStage: DubStatus
  setStage(status: DubStatus): Promise<void>
}

export interface DubbingPipeline {
  readonly name: Pipeline
  run(job: DubJob, ctx: JobContext): Promise<void>
}
