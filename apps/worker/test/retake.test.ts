import { describe, expect, it, vi } from 'vitest'
import type { DubRetakeRow } from '@vozia/db'
import {
  FakeIngestor,
  FakeMedia,
  FakeObjectStorage,
  FakeSeparator,
  FakeSynthesizer,
  FakeTranscriber,
  FakeTranslator,
} from '../src/drivers/fake/index.js'
import { silentLogger } from '../src/logger.js'
import { createJobContext } from '../src/pipeline/context.js'
import type { DubbingPipeline, DubJob, StageContext } from '../src/pipeline/contracts.js'
import { PipelineError } from '../src/pipeline/errors.js'
import { StagedPipeline } from '../src/pipeline/staged-pipeline.js'
import { InMemoryQueue } from '../src/queue/memory-queue.js'
import { InMemoryDubRepository } from '../src/repo/memory-repo.js'
import { WorkerRunner } from '../src/runner.js'
import { DUB_ID, OWNER_ID, makeJob, stageContext, tempDir } from './helpers/factories.js'

const RETAKE_ID = '99999999-9999-4999-8999-999999999999'
const retakeRow = (over: Partial<DubRetakeRow> = {}): DubRetakeRow => ({
  id: RETAKE_ID,
  dub_id: DUB_ID,
  owner_id: OWNER_ID,
  idx: 1,
  text: 'Welcome, everyone!',
  status: 'queued',
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
})

async function dubbed() {
  const repo = new InMemoryDubRepository()
  const job = makeJob()
  repo.seed(job)
  const storage = new FakeObjectStorage(await tempDir())
  const synthesizer = new FakeSynthesizer()
  const media = new FakeMedia()
  const pipeline = new StagedPipeline({
    ingestor: new FakeIngestor({ durationSeconds: 61 }),
    separator: new FakeSeparator(),
    transcriber: new FakeTranscriber(),
    translator: new FakeTranslator(),
    synthesizer,
    media,
    storage,
    repo,
  })
  const ctx = createJobContext({ job, repo, workdir: await tempDir(), log: silentLogger(), stageTimeoutMs: 60_000 })
  await pipeline.run(job, ctx)
  return { repo, storage, synthesizer, media, pipeline, job: (await repo.loadJob(DUB_ID))! }
}

describe('StagedPipeline.retake', () => {
  it('performs one line again in the words the person wrote, keeps every other line, and remixes the dub', async () => {
    const { repo, storage, synthesizer, media, pipeline, job } = await dubbed()
    const before = synthesizer.spoken.length
    const mux = vi.spyOn(media, 'mux')
    const assemble = vi.spyOn(media, 'assembleTimeline')
    await pipeline.retake(job, retakeRow(), await stageContext())

    // Only the re-taken line was recorded again, in the person's words.
    expect(synthesizer.spoken.slice(before).map((line) => line.text)).toEqual(['Welcome, everyone!'])
    // Every line is still in the dub: the kept ones from their saved takes.
    const pieces = assemble.mock.calls[0]![0]
    expect(pieces).toHaveLength(3)
    expect(pieces.filter((p) => p.path.includes('kept')).length).toBe(2)
    expect(mux).toHaveBeenCalledOnce()
    // The transcript, the subtitles and the saved state follow the new words.
    const segments = repo.segments.get(DUB_ID)!
    expect(segments[1]).toMatchObject({ translatedText: 'Welcome, everyone!', performance: { spoken: 'Welcome, everyone!' } })
    expect(segments[0]!.translatedText).toBe('[pt] Hello there.')
    expect(await storage.list('outputs')).toContain(`${OWNER_ID}/${DUB_ID}/work/takes/1.mp3`)
    expect(repo.dubs.get(DUB_ID)?.status).toBe('completed')
  })

  it('explains when a dub was made before lines could be re-taken', async () => {
    const { storage, pipeline, job } = await dubbed()
    await storage.remove('outputs', [`${OWNER_ID}/${DUB_ID}/work/state.json`])
    await expect(pipeline.retake(job, retakeRow(), await stageContext())).rejects.toMatchObject({
      message: 'This dub was made before lines could be re-taken: dub the video again to re-take its lines.',
    })
    await expect((await dubbed()).pipeline.retake(job, retakeRow({ idx: 9 }), await stageContext())).rejects.toMatchObject({
      message: 'That line is not part of this dub.',
    })
  })
})

describe('WorkerRunner and re-takes', () => {
  async function setup(retake: (job: DubJob, row: DubRetakeRow, ctx: StageContext) => Promise<void>, dubStatus: 'completed' | 'failed' = 'completed') {
    const repo = new InMemoryDubRepository()
    repo.seed(makeJob({ dub: { status: dubStatus } }))
    repo.retakes.set(RETAKE_ID, retakeRow())
    const queue = new InMemoryQueue()
    const pipeline: DubbingPipeline = { name: 'staged', run: async () => undefined, retake }
    const runner = new WorkerRunner({
      queue,
      repo,
      pipeline,
      log: silentLogger(),
      config: { concurrency: 1, pollMs: 5, visibilityTimeoutS: 60, heartbeatMs: 1000, maxAttempts: 2, stageTimeoutMs: 60_000, workdirRoot: await tempDir() },
    })
    queue.enqueue({ dub_id: DUB_ID, retake_id: RETAKE_ID })
    return { repo, queue, runner, message: (await queue.read(60))! }
  }

  it('re-takes the line without touching the dub, and marks the re-take done', async () => {
    const retake = vi.fn(async () => undefined)
    const { repo, queue, runner, message } = await setup(retake)
    expect(await runner.handleMessage(message)).toBe('completed')
    expect(retake).toHaveBeenCalledOnce()
    expect(repo.retakes.get(RETAKE_ID)?.status).toBe('done')
    expect(repo.dubs.get(DUB_ID)?.status).toBe('completed')
    expect(repo.history).toEqual([])
    expect(queue.archived).toEqual([message.msgId])
  })

  it('marks a failed re-take with a message the person can read', async () => {
    const { repo, runner, message } = await setup(async () => {
      throw new PipelineError('That line is not part of this dub.')
    })
    expect(await runner.handleMessage(message)).toBe('failed')
    expect(repo.retakes.get(RETAKE_ID)).toMatchObject({ status: 'failed', error_message: 'That line is not part of this dub.' })
    expect(repo.dubs.get(DUB_ID)?.status).toBe('completed')
  })

  it('refuses a re-take of a dub that is not finished, and skips one that is no longer wanted', async () => {
    const refused = await setup(async () => undefined, 'failed')
    expect(await refused.runner.handleMessage(refused.message)).toBe('failed')
    expect(refused.repo.retakes.get(RETAKE_ID)?.error_message).toBe('Only lines of a finished dub can be re-taken.')

    const done = await setup(async () => undefined)
    done.repo.retakes.set(RETAKE_ID, retakeRow({ status: 'done' }))
    expect(await done.runner.handleMessage(done.message)).toBe('skipped')
  })
})
