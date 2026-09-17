import { Link } from '@tanstack/react-router'
import { Film } from 'lucide-react'
import { languageLabel } from '@vozia/shared'
import type { VideoWithDubs } from '../lib/api'
import { formatDate, formatDuration } from '../lib/format'
import { toneForStatus } from '../lib/status-ui'
import { Badge, Card } from './ui'

export function VideoCard({ video, thumbnailUrl }: { video: VideoWithDubs; thumbnailUrl?: string }) {
  return (
    <Link to="/app/videos/$videoId" params={{ videoId: video.id }} className="block focus-visible:outline-2 focus-visible:outline-brand-600">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-video bg-slate-200">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-slate-400">
              <Film className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="truncate text-sm font-semibold text-slate-900">{video.title}</h3>
          <p className="text-xs text-slate-500">
            {formatDuration(video.duration_seconds)} · {formatDate(video.created_at)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {video.dubs.length === 0 ? <span className="text-xs text-slate-400">No dubs yet</span> : null}
            {video.dubs.map((dub) => (
              <Badge key={dub.id} tone={toneForStatus(dub.status)}>
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
