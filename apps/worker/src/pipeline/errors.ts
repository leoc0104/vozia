import type { DubStatus } from '@vozia/shared'

const MAX_MESSAGE = 500

function truncate(text: string): string {
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text
}

/** An error with a message safe to show to the dub's owner. */
export class PipelineError extends Error {
  readonly stage: DubStatus | null

  constructor(userMessage: string, options: { stage?: DubStatus | null; cause?: unknown } = {}) {
    super(userMessage, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'PipelineError'
    this.stage = options.stage ?? null
  }

  get userMessage(): string {
    return this.message
  }
}

export class ProviderError extends PipelineError {
  readonly provider: string
  readonly status: number | null

  constructor(
    provider: string,
    userMessage: string,
    options: { stage?: DubStatus | null; cause?: unknown; status?: number | null } = {},
  ) {
    super(userMessage, options)
    this.name = 'ProviderError'
    this.provider = provider
    this.status = options.status ?? null
  }
}

export function userMessageFor(error: unknown): string {
  if (error instanceof PipelineError) return error.userMessage
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'The stage timed out.'
    return truncate(`Unexpected error: ${error.message}`)
  }
  return truncate(`Unexpected error: ${String(error)}`)
}
