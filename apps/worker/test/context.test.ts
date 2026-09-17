import { describe, expect, it } from 'vitest'
import { createJobContext } from '../src/pipeline/context.js'
import { InMemoryDubRepository } from '../src/repo/memory-repo.js'
import { silentLogger } from '../src/logger.js'
import { DUB_ID, makeJob, tempDir } from './helpers/factories.js'

async function setup(stageTimeoutMs = 60_000) {
  const repo = new InMemoryDubRepository()
  const job = makeJob()
  repo.seed(job)
  const ctx = createJobContext({ job, repo, workdir: await tempDir(), log: silentLogger(), stageTimeoutMs })
  return { repo, ctx }
}

describe('job context', () => {
  it('walks legal transitions and persists stage starts', async () => {
    const { repo, ctx } = await setup()
    expect(ctx.currentStage).toBe('queued')
    await ctx.setStage('ingesting')
    await ctx.setStage('separating')
    expect(ctx.currentStage).toBe('separating')
    expect(repo.history).toEqual([
      { dubId: DUB_ID, status: 'ingesting', progress: 0 },
      { dubId: DUB_ID, status: 'separating', progress: 10 },
    ])
    ctx.dispose()
  })

  it('rejects illegal transitions', async () => {
    const { ctx } = await setup()
    await expect(ctx.setStage('muxing')).rejects.toMatchObject({ name: 'PipelineError', stage: 'queued' })
    ctx.dispose()
  })

  it('only writes progress when it grows, within the stage range', async () => {
    const { repo, ctx } = await setup()
    await ctx.setStage('ingesting')
    await ctx.setStage('separating')
    await ctx.setStage('transcribing')
    await ctx.setStage('translating')
    await ctx.setStage('synthesizing')
    ctx.progress(0.5)
    ctx.progress(0.4)
    ctx.progress(0.5)
    ctx.progress(1)
    await ctx.setStage('muxing')
    expect(repo.dubs.get(DUB_ID)?.progress).toBe(85)
    ctx.dispose()
  })

  it('aborts the stage signal when the stage times out', async () => {
    const { ctx } = await setup(20)
    await ctx.setStage('ingesting')
    const signal = ctx.signal
    await new Promise((r) => setTimeout(r, 40))
    expect(signal.aborted).toBe(true)
    expect((signal.reason as Error).name).toBe('TimeoutError')
    ctx.dispose()
  })
})
