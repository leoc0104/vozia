import { describe, expect, it } from 'vitest'
import { createJobContext } from '../src/pipeline/context.js'
import { StagedPipeline, type StagedPipelineDeps } from '../src/pipeline/staged-pipeline.js'
import { InMemoryDubRepository } from '../src/repo/memory-repo.js'
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
import { DUB_ID, OWNER_ID, VIDEO_ID, makeJob, tempDir } from './helpers/factories.js'
import type { DubJob } from '../src/pipeline/contracts.js'

async function setup(job: DubJob, overrides: Partial<StagedPipelineDeps> = {}) {
  const repo = new InMemoryDubRepository()
  repo.seed(job)
  const storage = new FakeObjectStorage(await tempDir())
  const deps: StagedPipelineDeps = {
    ingestor: new FakeIngestor({ durationSeconds: 61 }),
    separator: new FakeSeparator(),
    transcriber: new FakeTranscriber(),
    translator: new FakeTranslator(),
    synthesizer: new FakeSynthesizer(),
    media: new FakeMedia(),
    storage,
    repo,
    ...overrides,
  }
  const ctx = createJobContext({ job, repo, workdir: await tempDir(), log: silentLogger(), stageTimeoutMs: 60_000 })
  return { repo, storage, ctx, pipeline: new StagedPipeline(deps) }
}

describe('StagedPipeline', () => {
  it('dubs a YouTube video end to end with the fakes', async () => {
    const { repo, storage, ctx, pipeline } = await setup(makeJob())
    await pipeline.run(makeJob(), ctx)

    expect(repo.history.map((h) => h.status)).toEqual([
      'ingesting', 'separating', 'transcribing', 'translating', 'synthesizing', 'muxing', 'completed',
    ])
    const dub = repo.dubs.get(DUB_ID)!
    expect(dub.status).toBe('completed')
    expect(dub.progress).toBe(100)
    expect(dub.detected_language).toBe('en')
    expect(dub.output_path).toBe(`${OWNER_ID}/${DUB_ID}/dubbed.mp4`)
    expect(dub.srt_translated_path).toBe(`${OWNER_ID}/${DUB_ID}/translated.srt`)
    expect(await storage.list('outputs')).toEqual([
      `${OWNER_ID}/${DUB_ID}/dubbed.mp4`,
      `${OWNER_ID}/${DUB_ID}/dubbed_vocals.wav`,
      `${OWNER_ID}/${DUB_ID}/original.srt`,
      `${OWNER_ID}/${DUB_ID}/translated.srt`,
    ])
    expect(await storage.list('sources')).toEqual([`${OWNER_ID}/${VIDEO_ID}/original.mp4`, `${OWNER_ID}/${VIDEO_ID}/thumb.jpg`])

    const video = repo.videos.get(VIDEO_ID)!
    expect(video.storage_path).toBe(`${OWNER_ID}/${VIDEO_ID}/original.mp4`)
    expect(video.thumbnail_path).toBe(`${OWNER_ID}/${VIDEO_ID}/thumb.jpg`)
    expect(video.duration_seconds).toBe(61)
    expect(video.title).toBe('Fake YouTube video')

    const segments = repo.segments.get(DUB_ID)!
    expect(segments).toHaveLength(3)
    expect(segments[0]!.translatedText).toBe('[pt] Hello there.')
    expect(repo.profiles.get(OWNER_ID)?.minutes_used).toBe(2)
  })

  it('does not re-upload an uploaded source or overwrite its title', async () => {
    const job = makeJob({ video: { source_type: 'upload', source_url: null, storage_path: `${OWNER_ID}/${VIDEO_ID}/original.mov`, title: 'My upload' } })
    const { repo, storage, ctx, pipeline } = await setup(job)
    await pipeline.run(job, ctx)
    expect(await storage.list('sources')).toEqual([`${OWNER_ID}/${VIDEO_ID}/thumb.jpg`])
    expect(repo.videos.get(VIDEO_ID)?.storage_path).toBe(`${OWNER_ID}/${VIDEO_ID}/original.mov`)
    expect(repo.videos.get(VIDEO_ID)?.title).toBe('My upload')
  })

  it('fails in the transcribing stage when no speech is found', async () => {
    const { ctx, pipeline, repo } = await setup(makeJob(), { transcriber: new FakeTranscriber({ segments: [] }) })
    await expect(pipeline.run(makeJob(), ctx)).rejects.toMatchObject({ name: 'PipelineError', message: 'No speech was detected in this video.' })
    expect(ctx.currentStage).toBe('transcribing')
    expect(repo.dubs.get(DUB_ID)?.status).toBe('transcribing')
  })
})
