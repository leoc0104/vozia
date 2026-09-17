import { Check, X } from 'lucide-react'
import type { DubStatus, Pipeline } from '@vozia/shared'
import { cn } from '../lib/cn'
import { statusLabel, stepStates } from '../lib/status-ui'
import { Progress } from './ui'

export function StageStepper({
  pipeline,
  status,
  progress,
  failedStage,
}: {
  pipeline: Pipeline | null
  status: DubStatus
  progress: number
  failedStage: string | null
}) {
  const resolved = pipeline ?? 'staged'
  if (status === 'queued') {
    return <p className="text-sm text-slate-500">Waiting for a worker to pick this up…</p>
  }
  if (resolved === 'elevenlabs') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">{statusLabel(status)}</p>
        <Progress value={progress} label="Dub progress" />
      </div>
    )
  }
  const steps = stepStates(resolved, status, failedStage)
  return (
    <ol className="space-y-3" aria-label="Dubbing stages">
      {steps.map(({ stage, state }) => (
        <li key={stage} data-state={state} className="flex items-center gap-3">
          <span
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
              state === 'done' && 'bg-emerald-100 text-emerald-700',
              state === 'current' && 'bg-brand-600 text-white',
              state === 'failed' && 'bg-red-100 text-red-700',
              state === 'pending' && 'bg-slate-100 text-slate-400',
            )}
            aria-hidden="true"
          >
            {state === 'done' ? <Check className="size-3.5" /> : state === 'failed' ? <X className="size-3.5" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm', state === 'pending' ? 'text-slate-400' : 'font-medium text-slate-800')}>{statusLabel(stage)}</p>
            {state === 'current' ? <Progress value={progress} className="mt-1.5" label={`${statusLabel(stage)} progress`} /> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
