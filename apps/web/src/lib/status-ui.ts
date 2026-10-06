import { STAGE_ORDER, type DubStatus, type Pipeline } from '@vozia/shared'

export type StatusBadgeVariant = 'neutral' | 'info' | 'success' | 'error'

export function badgeVariantForStatus(status: DubStatus): StatusBadgeVariant {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'queued') return 'neutral'
  return 'info'
}

const LABELS: Record<DubStatus, string> = {
  queued: 'Queued',
  ingesting: 'Fetching video',
  separating: 'Separating audio',
  transcribing: 'Transcribing',
  translating: 'Translating',
  synthesizing: 'Generating voice',
  muxing: 'Rendering video',
  dubbing: 'Dubbing',
  completed: 'Completed',
  failed: 'Failed',
}

export function statusLabel(status: DubStatus): string {
  return LABELS[status]
}

/** The stages a stepper shows for a pipeline (queued and completed are implied). */
export function stepperStages(pipeline: Pipeline): DubStatus[] {
  return STAGE_ORDER[pipeline].filter((s) => s !== 'queued' && s !== 'completed')
}

export type StepState = 'done' | 'current' | 'pending' | 'failed'

/** Which stepper state each stage is in for a dub's current status. */
export function stepStates(pipeline: Pipeline, status: DubStatus, failedStage: string | null): { stage: DubStatus; state: StepState }[] {
  const stages = stepperStages(pipeline)
  if (status === 'completed') return stages.map((stage) => ({ stage, state: 'done' as const }))
  const anchor = status === 'failed' ? (failedStage as DubStatus | null) : status
  const index = anchor ? stages.indexOf(anchor) : -1
  return stages.map((stage, i) => ({
    stage,
    state: i < index ? 'done' : i === index ? (status === 'failed' ? 'failed' : 'current') : 'pending',
  }))
}
