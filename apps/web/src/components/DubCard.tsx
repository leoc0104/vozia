import { Link } from '@tanstack/react-router'
import { isTerminal, languageLabel } from '@vozia/shared'
import type { DubSummary } from '../lib/api'
import { formatDate } from '../lib/format'
import { badgeVariantForStatus, statusLabel } from '../lib/status-ui'
import { cx, focusRing } from '../lib/utils'
import { Badge, Card, ProgressBar } from './ui'

export function DubCard({ dub }: { dub: DubSummary }) {
  return (
    <Link to="/app/dubs/$dubId" params={{ dubId: dub.id }} className={cx('block h-full min-w-0 rounded-lg', focusRing)}>
      <Card className="h-full p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">{languageLabel(dub.target_language)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500">{formatDate(dub.created_at)}</p>
          </div>
          <Badge variant={badgeVariantForStatus(dub.status)}>{statusLabel(dub.status)}</Badge>
        </div>
        {!isTerminal(dub.status) ? (
          <ProgressBar
            value={dub.progress}
            showAnimation
            className="mt-3"
            aria-label={`${languageLabel(dub.target_language)} progress`}
          />
        ) : null}
      </Card>
    </Link>
  )
}
