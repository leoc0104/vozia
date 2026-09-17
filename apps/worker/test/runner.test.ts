import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerRunner, type RunnerConfig } from '../src/runner.js'
import { InMemoryQueue } from '../src/queue/memory-queue.js'
import { InMemoryDubRepository } from '../src/repo/memory-repo.js'
import type { DubbingPipeline, DubJob, JobContext } from '../src/pipeline/contracts.js'
import { PipelineError } from '../src/pipeline/errors.js'
import { silentLogger } from '../src/logger.js'
import { DUB_ID, makeJob, tempDir } from './helpers/factories.js'

const baseConfig: RunnerConfig = {
  concurrency: 1,
  pollMs: 5,
  visibilityTimeoutS: 60,
  heartbeatMs: 1000,
  maxAttempts: 2,
  stageTimeoutMs: 60_000,
  workdirRoot: '',
}

function stubPipeline(run: (job: DubJob, ctx: JobContext, repo: InMemoryDubRepository) => Promise<void>, repo: InMemoryDubRepository): DubbingPipeline {
  return { name: 'elevenlabs', run: (job, ctx) => run(job, ctx, repo) }
}

const happyRun = async (job: DubJob, ctx: JobContext, repo: InMemoryDubRepository) => {
  await ctx.setStage('ingesting')
  await ctx.setStage('dubbing')
  await repo.markCompleted(job.dub.id, { outputPath: 'o', dubbedAudioPath: null, srtOriginalPath: null, srtTranslatedPath: null, minutes: 1 })
}

async function setup(run = happyRun, config: Partial<RunnerConfig> = {}) {
  const repo = new InMemoryDubRepository()
  repo.seed(makeJob())
  const queue = new InMemoryQueue()
  const runner = new WorkerRunner({
    queue,
    repo,
    pipeline: stubPipeline(run, repo),
    log: silentLogger(),
    config: { ...baseConfig, workdirRoot: await tempDir(), ...config },
  })
  return { repo, queue, runner }
}

afterEach(() => vi.useRealTimers())

describe('WorkerRunner.handleMessage', () => {
  it('runs a queued dub to completion and archives the message', async () => {
    const { repo, queue, runner } = await setup()
    queue.enqueue({ dub_id: DUB_ID })
    const message = (await queue.read(60))!
    expect(await runner.handleMessage(message)).toBe('completed')
    expect(repo.dubs.get(DUB_ID)).toMatchObject({ status: 'completed', attempts: 1, pipeline: 'elevenlabs' })
    expect(queue.archived).toEqual([message.msgId])
  })

  it('records failures with the stage that was running', async () => {
    const { repo, queue, runner } = await setup(async (_job, ctx) => {
      await ctx.setStage('ingesting')
      throw new PipelineError('Could not download the video.')
    })
    queue.enqueue({ dub_id: DUB_ID })
    expect(await runner.handleMessage((await queue.read(60))!)).toBe('failed')
    expect(repo.dubs.get(DUB_ID)).toMatchObject({ status: 'failed', failed_stage: 'ingesting', error_message: 'Could not download the video.' })
    expect(queue.archived).toHaveLength(1)
  })

  it('hides internal errors behind a generic message', async () => {
    const { repo, queue, runner } = await setup(async () => {
      throw new TypeError('cannot read properties of undefined')
    })
    queue.enqueue({ dub_id: DUB_ID })
    await runner.handleMessage((await queue.read(60))!)
    expect(repo.dubs.get(DUB_ID)?.error_message).toBe('Unexpected error: cannot read properties of undefined')
    expect(repo.dubs.get(DUB_ID)?.failed_stage).toBe('queued')
  })

  it('discards malformed, unknown and stale messages', async () => {
    const { repo, queue, runner } = await setup()
    queue.enqueue({ nope: true })
    expect(await runner.handleMessage((await queue.read(60))!)).toBe('skipped')
    queue.enqueue({ dub_id: '99999999-9999-4999-8999-999999999999' })
    expect(await runner.handleMessage((await queue.read(60))!)).toBe('skipped')
    repo.dubs.get(DUB_ID)!.status = 'completed'
    queue.enqueue({ dub_id: DUB_ID })
    expect(await runner.handleMessage((await queue.read(60))!)).toBe('skipped')
    expect(queue.archived).toHaveLength(3)
    expect(repo.history).toEqual([])
  })

  it('re-runs an interrupted dub, then gives up after the attempt limit', async () => {
    const { repo, queue, runner } = await setup()
    repo.dubs.get(DUB_ID)!.status = 'dubbing'
    const id = queue.enqueue({ dub_id: DUB_ID })
    await queue.read(60)
    queue.makeVisible(id)
    const second = (await queue.read(60))!
    expect(second.readCount).toBe(2)
    expect(await runner.handleMessage(second)).toBe('completed')
    expect(repo.history.map((h) => h.status)).toEqual(['ingesting', 'dubbing', 'completed'])

    repo.dubs.get(DUB_ID)!.status = 'dubbing'
    const crashId = queue.enqueue({ dub_id: DUB_ID })
    for (let i = 0; i < 3; i++) {
      queue.makeVisible(crashId)
      await queue.read(60)
    }
    queue.makeVisible(crashId)
    const third = (await queue.read(60))!
    expect(third.readCount).toBeGreaterThan(2)
    expect(await runner.handleMessage(third)).toBe('failed')
    expect(repo.dubs.get(DUB_ID)?.error_message).toMatch(/crashed repeatedly/)
  })

  it('extends the visibility timeout while a job runs', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    const gate = new Promise<void>((resolve) => (finish = resolve))
    let started!: () => void
    const startedGate = new Promise<void>((resolve) => (started = resolve))
    const { queue, runner } = await setup(async (job, ctx, repo) => {
      await ctx.setStage('ingesting')
      started()
      await gate
      await ctx.setStage('dubbing')
      await repo.markCompleted(job.dub.id, { outputPath: 'o', dubbedAudioPath: null, srtOriginalPath: null, srtTranslatedPath: null, minutes: 1 })
    })
    queue.enqueue({ dub_id: DUB_ID })
    const message = (await queue.read(60))!
    const handling = runner.handleMessage(message)
    await startedGate
    await vi.advanceTimersByTimeAsync(2500)
    expect(queue.extended.length).toBeGreaterThanOrEqual(2)
    expect(queue.extended[0]).toEqual({ msgId: message.msgId, vt: 60 })
    finish()
    expect(await handling).toBe('completed')
  })
})

describe('WorkerRunner loop', () => {
  it('polls, processes and stops cleanly', async () => {
    const { repo, queue, runner } = await setup()
    runner.start()
    queue.enqueue({ dub_id: DUB_ID })
    await vi.waitFor(() => expect(queue.archived).toHaveLength(1))
    await runner.stop()
    expect(repo.dubs.get(DUB_ID)?.status).toBe('completed')
  })
})
