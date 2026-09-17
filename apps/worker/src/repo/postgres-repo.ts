import type { DubStatus, Pipeline } from '@vozia/shared'
import type { DubRow, ProfileRow, VideoRow } from '@vozia/db'
import type { Sql } from '../db.js'
import type { DubJob, TranscriptSegment, TranslatedSegment } from '../pipeline/contracts.js'
import type { DubPatch, DubRepository, MarkCompletedInput, VideoIngestPatch } from './contracts.js'

export class PostgresDubRepository implements DubRepository {
  constructor(private readonly sql: Sql) {}

  async loadJob(dubId: string): Promise<DubJob | null> {
    const rows = await this.sql<{ dub: DubRow; video: VideoRow; profile: ProfileRow }[]>`
      select row_to_json(d)::jsonb as dub, row_to_json(v)::jsonb as video, row_to_json(p)::jsonb as profile
      from public.dubs d
      join public.videos v on v.id = d.video_id
      join public.profiles p on p.id = d.owner_id
      where d.id = ${dubId}`
    const row = rows[0]
    return row ? { dub: row.dub, video: row.video, profile: row.profile } : null
  }

  async markStarted(dubId: string, pipeline: Pipeline): Promise<void> {
    await this.sql`
      update public.dubs
      set started_at = now(), attempts = attempts + 1, pipeline = ${pipeline}, progress = 0
      where id = ${dubId}`
  }

  async markStage(dubId: string, status: DubStatus, progress: number): Promise<void> {
    await this.sql`update public.dubs set status = ${status}, progress = ${progress} where id = ${dubId}`
  }

  async updateProgress(dubId: string, progress: number): Promise<void> {
    await this.sql`update public.dubs set progress = ${progress} where id = ${dubId}`
  }

  async patchDub(dubId: string, patch: DubPatch): Promise<void> {
    const columns = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
    if (Object.keys(columns).length === 0) return
    await this.sql`update public.dubs set ${this.sql(columns)} where id = ${dubId}`
  }

  async markFailed(dubId: string, stage: DubStatus | null, message: string): Promise<void> {
    await this.sql`
      update public.dubs
      set status = 'failed', failed_stage = ${stage}, error_message = ${message}
      where id = ${dubId}`
  }

  async markCompleted(dubId: string, input: MarkCompletedInput): Promise<void> {
    await this.sql.begin(async (sql) => {
      const rows = await sql<{ owner_id: string }[]>`
        update public.dubs
        set status = 'completed',
            progress = 100,
            completed_at = now(),
            output_path = ${input.outputPath},
            dubbed_audio_path = ${input.dubbedAudioPath},
            srt_original_path = ${input.srtOriginalPath},
            srt_translated_path = ${input.srtTranslatedPath},
            detected_language = coalesce(${input.detectedLanguage ?? null}, detected_language)
        where id = ${dubId}
        returning owner_id`
      const dub = rows[0]
      if (!dub) throw new Error(`unknown dub ${dubId}`)
      await sql`update public.profiles set minutes_used = minutes_used + ${input.minutes} where id = ${dub.owner_id}`
    })
  }

  async prepareRerun(dubId: string): Promise<void> {
    await this.sql`update public.dubs set progress = 0, failed_stage = null, error_message = null where id = ${dubId}`
  }

  async replaceSegments(dubId: string, segments: (TranscriptSegment | TranslatedSegment)[]): Promise<void> {
    const rows = segments.map((s) => ({
      dub_id: dubId,
      idx: s.idx,
      start_ms: s.startMs,
      end_ms: s.endMs,
      speaker: s.speaker ?? null,
      text: s.text,
      translated_text: 'translatedText' in s ? s.translatedText : null,
    }))
    await this.sql.begin(async (sql) => {
      await sql`delete from public.dub_segments where dub_id = ${dubId}`
      if (rows.length > 0) {
        await sql`insert into public.dub_segments ${sql(rows, 'dub_id', 'idx', 'start_ms', 'end_ms', 'speaker', 'text', 'translated_text')}`
      }
    })
  }

  async updateVideoAfterIngest(videoId: string, patch: VideoIngestPatch): Promise<void> {
    const columns: Record<string, string | number | null> = {}
    if (patch.storagePath !== undefined) columns.storage_path = patch.storagePath
    if (patch.durationSeconds !== undefined) columns.duration_seconds = patch.durationSeconds
    if (patch.title !== undefined && patch.title !== null) columns.title = patch.title
    if (patch.thumbnailPath !== undefined) columns.thumbnail_path = patch.thumbnailPath
    if (Object.keys(columns).length === 0) return
    await this.sql`update public.videos set ${this.sql(columns)} where id = ${videoId}`
  }
}
