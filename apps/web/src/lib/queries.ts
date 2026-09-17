import { useQuery } from '@tanstack/react-query'
import { isTerminal } from '@vozia/shared'
import { getDub, getVideo, listSegments, listVideos, signedUrl, signedUrls } from './api'

export const qk = {
  videos: () => ['videos'] as const,
  video: (id: string) => ['video', id] as const,
  dub: (id: string) => ['dub', id] as const,
  segments: (dubId: string) => ['segments', dubId] as const,
  signedUrl: (bucket: string, path: string) => ['signed-url', bucket, path] as const,
  signedUrls: (bucket: string, paths: string[]) => ['signed-urls', bucket, ...paths] as const,
}

const SIGNED_URL_STALE_MS = 50 * 60 * 1000

export function useVideos() {
  return useQuery({ queryKey: qk.videos(), queryFn: listVideos })
}

export function useVideo(id: string) {
  return useQuery({ queryKey: qk.video(id), queryFn: () => getVideo(id), enabled: id !== '' })
}

/** Realtime keeps this fresh; polling is only a safety net while the dub is in progress. */
export function useDub(id: string) {
  return useQuery({
    queryKey: qk.dub(id),
    queryFn: () => getDub(id),
    refetchInterval: (query) => (query.state.data && !isTerminal(query.state.data.status) ? 5000 : false),
  })
}

export function useSegments(dubId: string, enabled = true) {
  return useQuery({ queryKey: qk.segments(dubId), queryFn: () => listSegments(dubId), enabled })
}

export function useSignedUrl(bucket: string, path: string | null | undefined, download?: string) {
  return useQuery({
    queryKey: [...qk.signedUrl(bucket, path ?? ''), download ?? ''],
    queryFn: () => signedUrl(bucket, path!, download ? { download } : {}),
    enabled: Boolean(path),
    staleTime: SIGNED_URL_STALE_MS,
  })
}

export function useSignedUrls(bucket: string, paths: string[]) {
  return useQuery({
    queryKey: qk.signedUrls(bucket, paths),
    queryFn: () => signedUrls(bucket, paths),
    enabled: paths.length > 0,
    staleTime: SIGNED_URL_STALE_MS,
  })
}
