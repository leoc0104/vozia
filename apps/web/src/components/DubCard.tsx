import { Link } from '@tanstack/react-router'
import { isTerminal, languageLabel } from '@vozia/shared'
import type { DubSummary } from '../lib/api'
import { formatDate } from '../lib/format'
import { statusLabel, toneForStatus } from '../lib/status-ui'
import { Badge, Card, Progress } from './ui'

export function DubCard({ dub }: { dub: DubSummary }) {
  return (
    <Link to="/app/dubs/$dubId" params={{ dubId: dub.id }} className="block">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{languageLabel(dub.target_language)}</h3>
            <p className="text-xs text-slate-500">{formatDate(dub.created_at)}</p>
          </div>
          <Badge tone={toneForStatus(dub.status)}>{statusLabel(dub.status)}</Badge>
        </div>
        {!isTerminal(dub.status) ? <Progress value={dub.progress} className="mt-3" label={`${languageLabel(dub.target_language)} progress`} /> : null}
      </Card>
    </Link>
  )
}
