import type { DubStatus, Pipeline } from '@vozia/shared'
import type { DubRow } from '@vozia/db'
import type { DubJob, TranscriptSegment, TranslatedSegment } from '../pipeline/contracts.js'

export interface MarkCompletedInput {
  outputPath: string
  dubbedAudioPath: string | null
  srtOriginalPath: string | null
  srtTranslatedPath: string | null
  /** Dubbing minutes to charge to the owner's profile. */
  minutes: number
  detectedLanguage?: string | null
}

export interface VideoIngestPatch {
  storagePath?: string | null
  durationSeconds?: number | null
  title?: string | null
  thumbnailPath?: string | null
}

export type DubPatch = Partial<Pick<DubRow, 'detected_language' | 'provider_ref' | 'source_language'>>

export interface DubRepository {
  loadJob(dubId: string): Promise<DubJob | null>
  /** Records the attempt: started_at = now, attempts + 1, pipeline, progress 0. */
  markStarted(dubId: string, pipeline: Pipeline): Promise<void>
  markStage(dubId: string, status: DubStatus, progress: number): Promise<void>
  updateProgress(dubId: string, progress: number): Promise<void>
  patchDub(dubId: string, patch: DubPatch): Promise<void>
  markFailed(dubId: string, stage: DubStatus | null, message: string): Promise<void>
  /** Sets completed/100%, stores output paths and charges the minutes. */
  markCompleted(dubId: string, input: MarkCompletedInput): Promise<void>
  /** Clears a previous attempt's error fields before an interrupted dub is re-run (status is left alone). */
  prepareRerun(dubId: string): Promise<void>
  replaceSegments(dubId: string, segments: (TranscriptSegment | TranslatedSegment)[]): Promise<void>
  updateVideoAfterIngest(videoId: string, patch: VideoIngestPatch): Promise<void>
}
