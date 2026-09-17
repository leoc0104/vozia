import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { DubRow, VideoRow } from '@vozia/db'
import { qk } from './queries'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/auth-store'

export type RealtimeChange =
  | { table: 'dubs'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; row: DubRow | null; oldId: string | null }
  | { table: 'videos'; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; row: VideoRow | null; oldId: string | null }

function eventType(type: string): 'INSERT' | 'UPDATE' | 'DELETE' {
  return type === 'INSERT' || type === 'DELETE' ? type : 'UPDATE'
}

/** One channel per signed-in user, filtered server-side to their own rows (RLS applies as well). */
export function subscribeOwnerChanges(ownerId: string, onChange: (change: RealtimeChange) => void): () => void {
  const filter = `owner_id=eq.${ownerId}`
  const channel = supabase
    .channel(`owner-${ownerId}`)
    .on<DubRow>('postgres_changes', { event: '*', schema: 'public', table: 'dubs', filter }, (payload: RealtimePostgresChangesPayload<DubRow>) => {
      const row = 'id' in payload.new ? payload.new : null
      onChange({ table: 'dubs', eventType: eventType(payload.eventType), row, oldId: 'id' in payload.old ? (payload.old.id ?? null) : null })
    })
    .on<VideoRow>('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter }, (payload: RealtimePostgresChangesPayload<VideoRow>) => {
      const row = 'id' in payload.new ? payload.new : null
      onChange({ table: 'videos', eventType: eventType(payload.eventType), row, oldId: 'id' in payload.old ? (payload.old.id ?? null) : null })
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** Patches the query cache so the UI reflects worker progress without refetching everything. */
export function applyRealtimeChange(queryClient: QueryClient, change: RealtimeChange): void {
  if (change.table === 'dubs') {
    const row = change.row
    if (row && change.eventType !== 'DELETE') {
      queryClient.setQueryData(qk.dub(row.id), row)
      void queryClient.invalidateQueries({ queryKey: qk.video(row.video_id) })
      if (change.eventType === 'UPDATE') void queryClient.invalidateQueries({ queryKey: qk.segments(row.id) })
    }
    void queryClient.invalidateQueries({ queryKey: qk.videos() })
    return
  }
  void queryClient.invalidateQueries({ queryKey: qk.videos() })
  const id = change.row?.id ?? change.oldId
  if (id) void queryClient.invalidateQueries({ queryKey: qk.video(id) })
}

export function useRealtimeSync(): void {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  useEffect(() => {
    if (!userId) return
    return subscribeOwnerChanges(userId, (change) => applyRealtimeChange(queryClient, change))
  }, [userId, queryClient])
}
