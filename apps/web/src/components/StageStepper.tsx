import { Check, X } from 'lucide-react'
import type { DubStatus, Pipeline } from '@vozia/shared'
import { statusLabel, stepStates } from '../lib/status-ui'
import { cx } from '../lib/utils'
import { Levels } from './Levels'
import { ProgressBar } from './ui'

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
    return <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for a worker to pick this up…</p>
  }
  if (resolved === 'elevenlabs') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{statusLabel(status)}</p>
        <ProgressBar value={progress} showAnimation aria-label="Dub progress" />
      </div>
    )
  }
  const steps = stepStates(resolved, status, failedStage)
  return (
    <ol className="space-y-3" aria-label="Dubbing stages">
      {steps.map(({ stage, state }) => (
        <li key={stage} data-state={state} className="flex items-center gap-3">
          <span
            className={cx(
              'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
              state === 'done' && 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400',
              state === 'current' && 'bg-brand-500 text-gray-950',
              state === 'failed' && 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-400',
              state === 'pending' && 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-400',
            )}
            aria-hidden="true"
          >
            {state === 'done' ? <Check className="size-3.5" /> : null}
            {state === 'failed' ? <X className="size-3.5" /> : null}
            {state === 'current' ? <Levels bars={3} animated className="size-3" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cx(
                'text-sm',
                state === 'pending' ? 'text-gray-500 dark:text-gray-400' : 'font-medium text-gray-800 dark:text-gray-200',
              )}
            >
              {statusLabel(stage)}
            </p>
            {state === 'current' ? (
              <ProgressBar value={progress} showAnimation className="mt-1.5" aria-label={`${statusLabel(stage)} progress`} />
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
