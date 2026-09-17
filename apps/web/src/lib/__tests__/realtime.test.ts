import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../../test/fake-supabase'

const { fake } = vi.hoisted(() => ({ fake: { current: null as FakeSupabase | null } }))
vi.mock('../supabase', () => ({
  get supabase() {
    return fake.current
  },
}))

import { applyRealtimeChange, subscribeOwnerChanges } from '../realtime'
import { qk } from '../queries'

describe('realtime sync', () => {
  beforeEach(() => {
    fake.current = createFakeSupabase()
  })

  it('subscribes to the owner\'s dubs and videos and tears down', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeOwnerChanges('user-1', onChange)
    expect(fake.current!.channel).toHaveBeenCalledWith('owner-user-1')
    const filters = fake.current!.realtime.on.mock.calls.map((c) => c[1] as { table: string; filter: string })
    expect(filters).toEqual([
      { event: '*', schema: 'public', table: 'dubs', filter: 'owner_id=eq.user-1' },
      { event: '*', schema: 'public', table: 'videos', filter: 'owner_id=eq.user-1' },
    ])
    fake.current!.realtime.handlers[0]!.cb({ eventType: 'UPDATE', new: { id: 'd1', video_id: 'v1', status: 'muxing' }, old: { id: 'd1' } })
    expect(onChange).toHaveBeenCalledWith({ table: 'dubs', eventType: 'UPDATE', row: { id: 'd1', video_id: 'v1', status: 'muxing' }, oldId: 'd1' })
    unsubscribe()
    expect(fake.current!.removeChannel).toHaveBeenCalledWith(fake.current!.realtime)
  })

  it('patches the dub in the cache and invalidates the lists it appears in', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const row = { id: 'd1', video_id: 'v1', status: 'translating', progress: 42 }
    applyRealtimeChange(queryClient, { table: 'dubs', eventType: 'UPDATE', row: row as never, oldId: 'd1' })
    expect(queryClient.getQueryData(qk.dub('d1'))).toEqual(row)
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([qk.video('v1'), qk.segments('d1'), qk.videos()])

    invalidate.mockClear()
    applyRealtimeChange(queryClient, { table: 'videos', eventType: 'DELETE', row: null, oldId: 'v9' })
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey)).toEqual([qk.videos(), qk.video('v9')])
  })
})
