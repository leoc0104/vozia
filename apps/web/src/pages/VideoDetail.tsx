import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { BUCKETS } from '@vozia/db'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DubCard } from '../components/DubCard'
import { Button, Callout, EmptyState, Spinner } from '../components/ui'
import { deleteVideo } from '../lib/api'
import { formatDate, formatDuration } from '../lib/format'
import { qk, useSignedUrl, useVideo } from '../lib/queries'

export function VideoDetailPage() {
  const { videoId } = useParams({ from: '/app/videos/$videoId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const video = useVideo(videoId)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completedDub = video.data?.dubs.find((d) => d.status === 'completed' && d.output_path)
  const previewBucket = video.data?.storage_path ? BUCKETS.sources : BUCKETS.outputs
  const previewPath = video.data?.storage_path ?? completedDub?.output_path ?? null
  const preview = useSignedUrl(previewBucket, previewPath)

  async function onDelete() {
    if (!video.data) return
    setDeleting(true)
    try {
      await deleteVideo(video.data)
      await queryClient.invalidateQueries({ queryKey: qk.videos() })
      await navigate({ to: '/app' })
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false)
    }
  }

  if (video.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }
  if (video.isError || !video.data) {
    return <Callout variant="error">This video could not be found.</Callout>
  }

  const v = video.data
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/app" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300">
            ← Library
          </Link>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">{v.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            {v.source_type === 'youtube' ? 'YouTube' : 'Upload'} · {formatDuration(v.duration_seconds)} · added {formatDate(v.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/app/new" search={{ videoId: v.id }}>
              <Plus className="size-4" aria-hidden="true" /> Add language
            </Link>
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <Trash2 className="size-4" aria-hidden="true" /> Delete
              </Button>
            }
            title="Delete this video?"
            description="This deletes the original video and every dub made from it. It cannot be undone."
            confirmLabel="Delete"
            onConfirm={onDelete}
            busy={deleting}
          />
        </div>
      </div>
      {error ? <Callout variant="error">{error}</Callout> : null}
      <div className="overflow-hidden rounded-lg bg-black">
        {preview.data ? (
          <video controls src={preview.data} className="aspect-video w-full" />
        ) : (
          <div className="grid aspect-video place-items-center px-6 text-center text-sm text-gray-400">
            {previewPath ? <Spinner className="size-6 text-white dark:text-white" /> : 'The original will be available once the first dub has fetched it.'}
          </div>
        )}
      </div>
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Dubs</h2>
        {v.dubs.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No dubs for this video yet" />
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[...v.dubs]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((dub) => (
                <DubCard key={dub.id} dub={dub} />
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
