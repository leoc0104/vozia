import type { DubStatus, Pipeline } from '@vozia/shared'
import type { DubRow, ProfileRow, VideoRow } from '@vozia/db'
import type { DubJob, TranscriptSegment, TranslatedSegment } from '../pipeline/contracts.js'
import type { DubPatch, DubRepository, MarkCompletedInput, VideoIngestPatch } from './contracts.js'

export interface StoredSegment extends TranscriptSegment {
  translatedText: string | null
}

export class InMemoryDubRepository implements DubRepository {
  readonly dubs = new Map<string, DubRow>()
  readonly videos = new Map<string, VideoRow>()
  readonly profiles = new Map<string, ProfileRow>()
  readonly segments = new Map<string, StoredSegment[]>()
  readonly history: { dubId: string; status: DubStatus; progress: number }[] = []

  seed(job: DubJob): void {
    this.dubs.set(job.dub.id, { ...job.dub })
    this.videos.set(job.video.id, { ...job.video })
    this.profiles.set(job.profile.id, { ...job.profile })
  }

  private dub(dubId: string): DubRow {
    const dub = this.dubs.get(dubId)
    if (!dub) throw new Error(`unknown dub ${dubId}`)
    return dub
  }

  async loadJob(dubId: string): Promise<DubJob | null> {
    const dub = this.dubs.get(dubId)
    if (!dub) return null
    const video = this.videos.get(dub.video_id)
    const profile = this.profiles.get(dub.owner_id)
    if (!video || !profile) return null
    return { dub: { ...dub }, video: { ...video }, profile: { ...profile } }
  }

  async markStarted(dubId: string, pipeline: Pipeline): Promise<void> {
    const dub = this.dub(dubId)
    dub.started_at = new Date().toISOString()
    dub.attempts += 1
    dub.pipeline = pipeline
    dub.progress = 0
  }

  async markStage(dubId: string, status: DubStatus, progress: number): Promise<void> {
    const dub = this.dub(dubId)
    dub.status = status
    dub.progress = progress
    this.history.push({ dubId, status, progress })
  }

  async updateProgress(dubId: string, progress: number): Promise<void> {
    this.dub(dubId).progress = progress
  }

  async patchDub(dubId: string, patch: DubPatch): Promise<void> {
    Object.assign(this.dub(dubId), patch)
  }

  async markFailed(dubId: string, stage: DubStatus | null, message: string): Promise<void> {
    const dub = this.dub(dubId)
    dub.status = 'failed'
    dub.failed_stage = stage
    dub.error_message = message
    this.history.push({ dubId, status: 'failed', progress: dub.progress })
  }

  async markCompleted(dubId: string, input: MarkCompletedInput): Promise<void> {
    const dub = this.dub(dubId)
    dub.status = 'completed'
    dub.progress = 100
    dub.completed_at = new Date().toISOString()
    dub.output_path = input.outputPath
    dub.dubbed_audio_path = input.dubbedAudioPath
    dub.srt_original_path = input.srtOriginalPath
    dub.srt_translated_path = input.srtTranslatedPath
    if (input.detectedLanguage !== undefined) dub.detected_language = input.detectedLanguage
    const profile = this.profiles.get(dub.owner_id)
    if (profile) profile.minutes_used += input.minutes
    this.history.push({ dubId, status: 'completed', progress: 100 })
  }

  async resetToQueued(dubId: string): Promise<void> {
    const dub = this.dub(dubId)
    dub.status = 'queued'
    dub.progress = 0
    dub.failed_stage = null
    dub.error_message = null
    this.history.push({ dubId, status: 'queued', progress: 0 })
  }

  async replaceSegments(dubId: string, segments: (TranscriptSegment | TranslatedSegment)[]): Promise<void> {
    this.segments.set(
      dubId,
      segments.map((s) => ({
        idx: s.idx,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        speaker: s.speaker ?? null,
        translatedText: 'translatedText' in s ? s.translatedText : null,
      })),
    )
  }

  async updateVideoAfterIngest(videoId: string, patch: VideoIngestPatch): Promise<void> {
    const video = this.videos.get(videoId)
    if (!video) throw new Error(`unknown video ${videoId}`)
    if (patch.storagePath !== undefined) video.storage_path = patch.storagePath
    if (patch.durationSeconds !== undefined) video.duration_seconds = patch.durationSeconds
    if (patch.title !== undefined && patch.title !== null) video.title = patch.title
    if (patch.thumbnailPath !== undefined) video.thumbnail_path = patch.thumbnailPath
  }
}
