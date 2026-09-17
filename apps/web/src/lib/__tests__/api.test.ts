import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, fakeSession, type FakeSupabase } from '../../test/fake-supabase'

const { fake } = vi.hoisted(() => ({ fake: { current: null as FakeSupabase | null } }))
vi.mock('../supabase', () => ({
  get supabase() {
    return fake.current
  },
}))

import { InsufficientMinutesError, createDub, createVideo, deleteDub, deleteVideo, listVideos, retryDub, signedUrls, updateProfile } from '../api'

const session = fakeSession()

describe('api', () => {
  beforeEach(() => {
    fake.current = createFakeSupabase({ session })
  })

  it('lists videos with their dub summaries, newest first', async () => {
    fake.current!.setResponder(() => ({ data: [{ id: 'v1', dubs: [{ id: 'd1', status: 'queued' }] }], error: null }))
    const videos = await listVideos()
    expect(videos[0]!.dubs[0]!.id).toBe('d1')
    expect(fake.current!.calls[0]).toMatchObject({ table: 'videos', op: 'select', columns: '*, dubs(id, target_language, status, progress, created_at, output_path)' })
  })

  it('creates videos and dubs for the signed-in user', async () => {
    fake.current!.setResponder((call) => ({ data: { id: 'new', ...(call.payload as object) }, error: null }))
    const video = await createVideo({ id: 'vid-1', title: 'Talk', sourceType: 'upload', sourceUrl: null, storagePath: `${session.user.id}/vid-1/original.mp4` })
    expect(video.owner_id).toBe(session.user.id)
    expect(fake.current!.calls[0]).toMatchObject({ table: 'videos', op: 'insert', single: true })
    expect(fake.current!.calls[0]!.payload).toEqual({ id: 'vid-1', owner_id: session.user.id, title: 'Talk', source_type: 'upload', source_url: null, storage_path: `${session.user.id}/vid-1/original.mp4` })

    await createDub({ videoId: 'vid-1', targetLanguage: 'pt', sourceLanguage: null, voiceMode: 'clone', stockVoiceId: 'ignored' })
    expect(fake.current!.calls[1]!.payload).toEqual({ video_id: 'vid-1', owner_id: session.user.id, target_language: 'pt', source_language: null, voice_mode: 'clone', stock_voice_id: null })
  })

  it('maps the exhausted-minutes database error', async () => {
    fake.current!.setResponder(() => ({ data: null, error: { message: 'insufficient_minutes', code: 'P0001' } }))
    await expect(createDub({ videoId: 'v', targetLanguage: 'pt', sourceLanguage: null, voiceMode: 'clone', stockVoiceId: null })).rejects.toBeInstanceOf(InsufficientMinutesError)
  })

  it('retries through the rpc and reports its errors', async () => {
    await retryDub('d1')
    expect(fake.current!.rpc).toHaveBeenCalledWith('retry_dub', { p_dub_id: 'd1' })
    fake.current!.rpc.mockResolvedValueOnce({ data: null, error: { message: 'dub_not_retryable' } } as never)
    await expect(retryDub('d1')).rejects.toThrow('dub_not_retryable')
  })

  it('deletes output objects before the dub row, and everything for a video', async () => {
    const dub = { id: 'd1', output_path: 'o/d1/dubbed.mp4', dubbed_audio_path: null, srt_original_path: 'o/d1/original.srt', srt_translated_path: null }
    await deleteDub(dub as never)
    expect(fake.current!.storage.from).toHaveBeenCalledWith('outputs')
    expect(fake.current!.storageBucket.remove).toHaveBeenCalledWith(['o/d1/dubbed.mp4', 'o/d1/original.srt'])
    expect(fake.current!.calls[0]).toMatchObject({ table: 'dubs', op: 'delete', filters: [{ kind: 'eq', column: 'id', value: 'd1' }] })

    fake.current!.setResponder((call) => (call.op === 'select' ? { data: [dub, { ...dub, id: 'd2', output_path: 'o/d2/dubbed.mp4', srt_original_path: null }], error: null } : { data: null, error: null }))
    await deleteVideo({ id: 'v1', storage_path: 'u/v1/original.mp4', thumbnail_path: 'u/v1/thumb.jpg' } as never)
    expect(fake.current!.storageBucket.remove).toHaveBeenLastCalledWith(['u/v1/original.mp4', 'u/v1/thumb.jpg'])
    expect(fake.current!.calls.at(-1)).toMatchObject({ table: 'videos', op: 'delete' })
  })

  it('builds signed url maps and updates the profile', async () => {
    expect(await signedUrls('sources', ['a', 'b'])).toEqual({ a: 'https://signed.test/a', b: 'https://signed.test/b' })
    expect(await signedUrls('sources', [])).toEqual({})
    await updateProfile({ display_name: 'Alice D.' })
    expect(fake.current!.calls.at(-1)).toMatchObject({ table: 'profiles', op: 'update', payload: { display_name: 'Alice D.' }, filters: [{ kind: 'eq', column: 'id', value: session.user.id }] })
  })
})
