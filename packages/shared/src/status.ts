export const DUB_STATUSES = [
  'queued',
  'ingesting',
  'separating',
  'transcribing',
  'translating',
  'synthesizing',
  'muxing',
  'dubbing',
  'completed',
  'failed',
] as const

export type DubStatus = (typeof DUB_STATUSES)[number]

export const PIPELINES = ['staged', 'elevenlabs'] as const

export type Pipeline = (typeof PIPELINES)[number]

export const STAGE_ORDER: Record<Pipeline, readonly DubStatus[]> = {
  staged: ['queued', 'ingesting', 'separating', 'transcribing', 'translating', 'synthesizing', 'muxing', 'completed'],
  elevenlabs: ['queued', 'ingesting', 'dubbing', 'completed'],
}

export const TERMINAL_STATUSES: readonly DubStatus[] = ['completed', 'failed']

const SUCCESSORS: Record<DubStatus, readonly DubStatus[]> = {
  queued: ['ingesting', 'failed'],
  ingesting: ['separating', 'dubbing', 'failed'],
  separating: ['transcribing', 'failed'],
  transcribing: ['translating', 'failed'],
  translating: ['synthesizing', 'failed'],
  synthesizing: ['muxing', 'failed'],
  muxing: ['completed', 'failed'],
  dubbing: ['completed', 'failed'],
  completed: [],
  failed: ['queued'],
}

/** Progress range [start, end] a dub shows while in each status. `failed` keeps the last value. */
export const STAGE_PROGRESS: Record<DubStatus, readonly [number, number]> = {
  queued: [0, 0],
  ingesting: [0, 10],
  separating: [10, 25],
  transcribing: [25, 40],
  translating: [40, 55],
  synthesizing: [55, 85],
  muxing: [85, 98],
  dubbing: [10, 95],
  completed: [100, 100],
  failed: [0, 0],
}

export function isTerminal(status: DubStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function canTransition(from: DubStatus, to: DubStatus): boolean {
  return SUCCESSORS[from].includes(to)
}

export function nextStage(pipeline: Pipeline, current: DubStatus): DubStatus | null {
  const order = STAGE_ORDER[pipeline]
  const index = order.indexOf(current)
  if (index < 0 || index === order.length - 1) return null
  return order[index + 1] ?? null
}

export function progressAtStageStart(status: DubStatus): number {
  return STAGE_PROGRESS[status][0]
}

export function progressWithin(status: DubStatus, fraction: number): number {
  const [start, end] = STAGE_PROGRESS[status]
  const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
  return Math.round(start + (end - start) * clamped)
}
