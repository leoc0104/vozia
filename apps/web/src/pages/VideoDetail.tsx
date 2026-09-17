import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { BUCKETS } from '@vozia/db'
import { DubCard } from '../components/DubCard'
import { Alert, Button, EmptyState, Spinner } from '../components/ui'
import { deleteVideo } from '../lib/api'
import { formatDate, formatDuration } from '../lib/format'
import { qk, useSignedUrl, useVideo } from '../lib/queries'
import { useQueryClient } from '@tanstack/react-query'

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
    if (!video.data || !window.confirm('Delete this video and all of its dubs? This cannot be undone.')) return
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
    return <Alert tone="error">This video could not be found.</Alert>
  }

  const v = video.data
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app" className="text-sm text-slate-500 hover:underline">
            ← Library
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{v.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {v.source_type === 'youtube' ? 'YouTube' : 'Upload'} · {formatDuration(v.duration_seconds)} · added {formatDate(v.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/new" search={{ videoId: v.id }}>
            <Button>
              <Plus className="size-4" aria-hidden="true" /> Add language
            </Button>
          </Link>
          <Button variant="danger" onClick={() => void onDelete()} loading={deleting}>
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
        </div>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="overflow-hidden rounded-xl bg-black">
        {preview.data ? (
          <video controls src={preview.data} className="aspect-video w-full" />
        ) : (
          <div className="grid aspect-video place-items-center text-sm text-slate-400">
            {previewPath ? <Spinner /> : 'The original will be available once the first dub has fetched it.'}
          </div>
        )}
      </div>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Dubs</h2>
        {v.dubs.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No dubs for this video yet" />
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[...v.dubs].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((dub) => (
              <DubCard key={dub.id} dub={dub} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
