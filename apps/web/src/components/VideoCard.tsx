import { Link } from '@tanstack/react-router'
import { Film } from 'lucide-react'
import { languageLabel } from '@vozia/shared'
import type { VideoWithDubs } from '../lib/api'
import { formatDate, formatDuration } from '../lib/format'
import { badgeVariantForStatus } from '../lib/status-ui'
import { cx, focusRing } from '../lib/utils'
import { Badge, Card } from './ui'

export function VideoCard({ video, thumbnailUrl }: { video: VideoWithDubs; thumbnailUrl?: string }) {
  return (
    <Link to="/app/videos/$videoId" params={{ videoId: video.id }} className={cx('block h-full min-w-0 rounded-lg', focusRing)}>
      <Card className="h-full overflow-hidden p-0 transition-shadow hover:shadow-md">
        <div className="aspect-video bg-gray-100 dark:bg-gray-900">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-gray-400 dark:text-gray-600">
              <Film className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50" title={video.title}>
            {video.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {formatDuration(video.duration_seconds)} · {formatDate(video.created_at)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {video.dubs.length === 0 ? <span className="text-xs text-gray-400 dark:text-gray-500">No dubs yet</span> : null}
            {video.dubs.map((dub) => (
              <Badge key={dub.id} variant={badgeVariantForStatus(dub.status)}>
                {languageLabel(dub.target_language)}
                {dub.status !== 'completed' && dub.status !== 'failed' ? ` ${dub.progress}%` : dub.status === 'failed' ? ' · failed' : ''}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  )
}
