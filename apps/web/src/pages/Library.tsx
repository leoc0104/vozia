import { Link } from '@tanstack/react-router'
import { BUCKETS } from '@vozia/db'
import { VideoCard } from '../components/VideoCard'
import { Button, Callout, EmptyState, Spinner } from '../components/ui'
import { useSignedUrls, useVideos } from '../lib/queries'

export function LibraryPage() {
  const videos = useVideos()
  const thumbnailPaths = (videos.data ?? []).map((v) => v.thumbnail_path).filter((p): p is string => Boolean(p))
  const thumbnails = useSignedUrls(BUCKETS.sources, thumbnailPaths)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Library</h1>
      </div>
      {videos.isPending ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : videos.isError ? (
        <Callout variant="error" className="mt-6">
          Could not load your library: {(videos.error as Error).message}
        </Callout>
      ) : videos.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No videos yet"
            description="Upload a video or paste a YouTube link to create your first dub."
            action={
              <Button asChild>
                <Link to="/app/new">Create your first dub</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.data.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              thumbnailUrl={video.thumbnail_path ? thumbnails.data?.[video.thumbnail_path] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
