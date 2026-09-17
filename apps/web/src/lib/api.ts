import { BUCKETS, type DubRow, type DubSegmentRow, type VideoRow } from '@vozia/db'
import { isInsufficientMinutesError, type CreateDubInput, type SourceType } from '@vozia/shared'
import { supabase } from './supabase'

export type DubSummary = Pick<DubRow, 'id' | 'target_language' | 'status' | 'progress' | 'created_at'>

export interface VideoWithDubs extends VideoRow {
  dubs: DubSummary[]
}

export class ApiError extends Error {
  readonly code: string | undefined

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export class InsufficientMinutesError extends ApiError {
  constructor() {
    super('You have used all your dubbing minutes.', 'insufficient_minutes')
    this.name = 'InsufficientMinutesError'
  }
}

interface Result<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

function unwrap<T>({ data, error }: Result<T>): T {
  if (error) {
    if (isInsufficientMinutesError(error)) throw new InsufficientMinutesError()
    throw new ApiError(error.message, error.code)
  }
  return data as T
}

const DUB_SUMMARY = 'id, target_language, status, progress, created_at'
const SIGNED_URL_TTL = 60 * 60

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError('You are signed out.')
  return id
}

export async function listVideos(): Promise<VideoWithDubs[]> {
  const result = await supabase.from('videos').select(`*, dubs(${DUB_SUMMARY})`).order('created_at', { ascending: false })
  return unwrap(result as unknown as Result<VideoWithDubs[]>) ?? []
}

export async function getVideo(id: string): Promise<VideoWithDubs | null> {
  const result = await supabase.from('videos').select(`*, dubs(${DUB_SUMMARY})`).eq('id', id).maybeSingle()
  return unwrap(result as unknown as Result<VideoWithDubs | null>)
}

export async function getDub(id: string): Promise<DubRow | null> {
  return unwrap((await supabase.from('dubs').select('*').eq('id', id).maybeSingle()) as Result<DubRow | null>)
}

export async function listSegments(dubId: string): Promise<DubSegmentRow[]> {
  return unwrap((await supabase.from('dub_segments').select('*').eq('dub_id', dubId).order('idx')) as Result<DubSegmentRow[]>) ?? []
}

export interface CreateVideoInput {
  id?: string
  title: string
  sourceType: SourceType
  sourceUrl: string | null
  storagePath: string | null
}

export async function createVideo(input: CreateVideoInput): Promise<VideoRow> {
  const ownerId = await currentUserId()
  const result = await supabase
    .from('videos')
    .insert({
      ...(input.id ? { id: input.id } : {}),
      owner_id: ownerId,
      title: input.title,
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      storage_path: input.storagePath,
    })
    .select('*')
    .single()
  return unwrap(result as Result<VideoRow>)
}

export async function createDub(input: CreateDubInput): Promise<DubRow> {
  const ownerId = await currentUserId()
  const result = await supabase
    .from('dubs')
    .insert({
      video_id: input.videoId,
      owner_id: ownerId,
      target_language: input.targetLanguage,
      source_language: input.sourceLanguage,
      voice_mode: input.voiceMode,
      stock_voice_id: input.voiceMode === 'stock' ? input.stockVoiceId : null,
    })
    .select('*')
    .single()
  return unwrap(result as Result<DubRow>)
}

export async function retryDub(dubId: string): Promise<void> {
  const { error } = await supabase.rpc('retry_dub', { p_dub_id: dubId })
  if (error) throw new ApiError(error.message, error.code)
}

function outputPaths(dub: Pick<DubRow, 'output_path' | 'dubbed_audio_path' | 'srt_original_path' | 'srt_translated_path'>): string[] {
  return [dub.output_path, dub.dubbed_audio_path, dub.srt_original_path, dub.srt_translated_path].filter((p): p is string => Boolean(p))
}

/** Removes the dub's output files first so nothing is orphaned in Storage, then the row. */
export async function deleteDub(dub: DubRow): Promise<void> {
  const paths = outputPaths(dub)
  if (paths.length > 0) unwrap((await supabase.storage.from(BUCKETS.outputs).remove(paths)) as Result<unknown>)
  unwrap((await supabase.from('dubs').delete().eq('id', dub.id)) as Result<unknown>)
}

/** Removes every dub's outputs, the source objects and finally the video (dubs cascade). */
export async function deleteVideo(video: VideoRow): Promise<void> {
  const dubs = unwrap((await supabase.from('dubs').select('*').eq('video_id', video.id)) as Result<DubRow[]>) ?? []
  const outputs = dubs.flatMap(outputPaths)
  if (outputs.length > 0) unwrap((await supabase.storage.from(BUCKETS.outputs).remove(outputs)) as Result<unknown>)
  const sources = [video.storage_path, video.thumbnail_path].filter((p): p is string => Boolean(p))
  if (sources.length > 0) unwrap((await supabase.storage.from(BUCKETS.sources).remove(sources)) as Result<unknown>)
  unwrap((await supabase.from('videos').delete().eq('id', video.id)) as Result<unknown>)
}

export async function signedUrl(bucket: string, path: string, opts: { download?: string } = {}): Promise<string> {
  const result = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL, opts.download ? { download: opts.download } : undefined)
  return unwrap(result as Result<{ signedUrl: string }>).signedUrl
}

export async function signedUrls(bucket: string, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const rows = unwrap((await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL)) as Result<{ path: string | null; signedUrl: string }[]>)
  return Object.fromEntries(rows.filter((r) => r.path && r.signedUrl).map((r) => [r.path!, r.signedUrl]))
}

export async function updateProfile(patch: { display_name: string }): Promise<void> {
  const id = await currentUserId()
  unwrap((await supabase.from('profiles').update(patch).eq('id', id)) as Result<unknown>)
}
