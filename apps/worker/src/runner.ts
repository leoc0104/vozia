import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DubJobMessageSchema, isTerminal } from '@vozia/shared'
import type { Logger } from './logger.js'
import { createJobContext } from './pipeline/context.js'
import type { DubbingPipeline } from './pipeline/contracts.js'
import { userMessageFor } from './pipeline/errors.js'
import type { JobQueue, QueueMessage } from './queue/contracts.js'
import type { DubRepository } from './repo/contracts.js'

export interface RunnerConfig {
  concurrency: number
  pollMs: number
  visibilityTimeoutS: number
  heartbeatMs: number
  maxAttempts: number
  stageTimeoutMs: number
  workdirRoot: string
}

export interface RunnerDeps {
  queue: JobQueue
  repo: DubRepository
  pipeline: DubbingPipeline
  log: Logger
  config: RunnerConfig
  sleep?: (ms: number) => Promise<void>
}

export type HandleResult = 'completed' | 'failed' | 'skipped'

const CRASH_MESSAGE = 'The worker crashed repeatedly while processing this dub.'

export class WorkerRunner {
  private stopping = false
  private readonly loops: Promise<void>[] = []
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly d: RunnerDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  start(): void {
    for (let slot = 0; slot < this.d.config.concurrency; slot++) {
      this.loops.push(this.loop(slot))
    }
  }

  /** Stops polling and resolves once in-flight jobs have finished. */
  async stop(): Promise<void> {
    this.stopping = true
    await Promise.all(this.loops)
  }

  private async loop(slot: number): Promise<void> {
    const log = this.d.log.child({ slot })
    while (!this.stopping) {
      let message: QueueMessage | null = null
      try {
        message = await this.d.queue.read(this.d.config.visibilityTimeoutS)
      } catch (error) {
        log.error({ error }, 'queue read failed')
        await this.sleep(this.d.config.pollMs)
        continue
      }
      if (!message) {
        await this.sleep(this.d.config.pollMs)
        continue
      }
      await this.handleMessage(message)
    }
  }

  async handleMessage(message: QueueMessage): Promise<HandleResult> {
    const { queue, repo, pipeline, config } = this.d
    const parsed = DubJobMessageSchema.safeParse(message.payload)
    if (!parsed.success) {
      this.d.log.warn({ msgId: message.msgId, payload: message.payload }, 'discarding malformed queue message')
      await queue.archive(message.msgId)
      return 'skipped'
    }
    const dubId = parsed.data.dub_id
    const log = this.d.log.child({ dubId, msgId: message.msgId })

    const job = await repo.loadJob(dubId)
    if (!job) {
      log.warn('dub no longer exists; discarding message')
      await queue.archive(message.msgId)
      return 'skipped'
    }
    if (isTerminal(job.dub.status)) {
      log.info({ status: job.dub.status }, 'dub already finished; discarding stale message')
      await queue.archive(message.msgId)
      return 'skipped'
    }
    if (message.readCount > config.maxAttempts) {
      log.error({ readCount: message.readCount }, 'attempt limit exceeded')
      await repo.markFailed(dubId, job.dub.status, CRASH_MESSAGE)
      await queue.archive(message.msgId)
      return 'failed'
    }
    if (job.dub.status !== 'queued') {
      log.warn({ status: job.dub.status, readCount: message.readCount }, 're-running dub after an interrupted attempt')
      await repo.resetToQueued(dubId)
      job.dub.status = 'queued'
    }

    const workdir = path.join(config.workdirRoot || os.tmpdir(), 'vozia', dubId)
    await rm(workdir, { recursive: true, force: true })
    await mkdir(workdir, { recursive: true })
    const ctx = createJobContext({ job, repo, workdir, log, stageTimeoutMs: config.stageTimeoutMs })
    const heartbeat = setInterval(() => {
      queue.extend(message.msgId, config.visibilityTimeoutS).catch((error: unknown) => log.warn({ error }, 'heartbeat failed'))
    }, config.heartbeatMs)
    heartbeat.unref()

    let result: HandleResult
    try {
      await repo.markStarted(dubId, pipeline.name)
      await pipeline.run(job, ctx)
      log.info('dub completed')
      result = 'completed'
    } catch (error) {
      log.error({ error, stage: ctx.currentStage }, 'dub failed')
      await repo
        .markFailed(dubId, ctx.currentStage, userMessageFor(error))
        .catch((markError: unknown) => log.error({ error: markError }, 'could not record the failure'))
      result = 'failed'
    } finally {
      clearInterval(heartbeat)
      ctx.dispose()
      await queue.archive(message.msgId).catch((error: unknown) => log.error({ error }, 'could not archive message'))
      await rm(workdir, { recursive: true, force: true }).catch(() => undefined)
    }
    return result
  }
}
