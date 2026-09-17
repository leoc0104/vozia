import { STAGE_ORDER, type DubStatus, type Pipeline } from '@vozia/shared'
import type { Tone } from '../components/ui/Badge'

export function toneForStatus(status: DubStatus): Tone {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
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
