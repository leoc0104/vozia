import { canTransition, progressAtStageStart, progressWithin, type DubStatus } from '@vozia/shared'
import type { Logger } from '../logger.js'
import type { DubRepository } from '../repo/contracts.js'
import type { DubJob, JobContext } from './contracts.js'
import { PipelineError } from './errors.js'

export interface JobContextOptions {
  job: DubJob
  repo: DubRepository
  workdir: string
  log: Logger
  stageTimeoutMs: number
}

export interface DisposableJobContext extends JobContext {
  dispose(): void
}

export function createJobContext(opts: JobContextOptions): DisposableJobContext {
  const dubId = opts.job.dub.id
  let currentStage: DubStatus = opts.job.dub.status
  let lastProgress = progressAtStageStart(currentStage)
  let controller = new AbortController()
  let timer: NodeJS.Timeout | null = null
  let pendingWrites: Promise<void> = Promise.resolve()

  const armStageTimeout = () => {
    if (timer) clearTimeout(timer)
    controller = new AbortController()
    timer = setTimeout(() => {
      const error = new Error(`Stage ${currentStage} exceeded ${opts.stageTimeoutMs} ms`)
      error.name = 'TimeoutError'
      controller.abort(error)
    }, opts.stageTimeoutMs)
    timer.unref()
  }

  return {
    workdir: opts.workdir,
    log: opts.log,
    get signal() {
      return controller.signal
    },
    get currentStage() {
      return currentStage
    },
    async setStage(next) {
      if (!canTransition(currentStage, next)) {
        throw new PipelineError(`Illegal stage transition ${currentStage} → ${next}`, { stage: currentStage })
      }
      currentStage = next
      lastProgress = progressAtStageStart(next)
      armStageTimeout()
      await pendingWrites
      await opts.repo.markStage(dubId, next, lastProgress)
    },
    progress(fraction) {
      const value = progressWithin(currentStage, fraction)
      if (value <= lastProgress) return
      lastProgress = value
      pendingWrites = pendingWrites
        .then(() => opts.repo.updateProgress(dubId, value))
        .catch((error: unknown) => opts.log.warn({ error, dubId }, 'progress update failed'))
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
      if (!controller.signal.aborted) controller.abort(new Error('job disposed'))
    },
  }
}
