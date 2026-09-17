import { writeFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { ElevenLabsDubbingPipeline } from '../src/pipeline/elevenlabs-pipeline.js'
import { createJobContext } from '../src/pipeline/context.js'
import { InMemoryDubRepository } from '../src/repo/memory-repo.js'
import { FakeObjectStorage } from '../src/drivers/fake/index.js'
import { silentLogger } from '../src/logger.js'
import { DUB_ID, OWNER_ID, VIDEO_ID, makeJob, tempDir } from './helpers/factories.js'
import type { DubJob } from '../src/pipeline/contracts.js'
import type { CreateDubbingInput } from '../src/drivers/elevenlabs/client.js'

function stubClient(statuses: Array<{ status: 'dubbing' | 'dubbed' | 'failed'; error?: string }>) {
  const queue = [...statuses]
  return {
    createDubbing: vi.fn(async (_input: CreateDubbingInput, _signal?: AbortSignal) => ({ dubbingId: 'd1', expectedDurationSec: 60 })),
    getDubbing: vi.fn(async () => {
      const next = queue.length > 1 ? queue.shift()! : queue[0]!
      return { status: next.status, error: next.error ?? null, durationSec: 61.4, sourceLang: 'en', targetLanguages: ['pt'] }
    }),
    downloadDubbedFile: vi.fn(async (_id: string, _lang: string, dest: string) => {
      await writeFile(dest, 'dubbed video')
    }),
    getTranscript: vi.fn(async (_id: string, lang: string) => (lang === 'pt' ? '1\n00:00:00,000 --> 00:00:01,000\nOlá\n' : null)),
  }
}

async function setup(job: DubJob, client = stubClient([{ status: 'dubbing' }, { status: 'dubbed' }])) {
  const repo = new InMemoryDubRepository()
  repo.seed(job)
  const storage = new FakeObjectStorage(await tempDir())
  let clock = 0
  const pipeline = new ElevenLabsDubbingPipeline({ client, storage, repo, pollMs: 10, sleep: async () => { clock += 30_000 }, now: () => clock })
  const ctx = createJobContext({ job, repo, workdir: await tempDir(), log: silentLogger(), stageTimeoutMs: 60_000 })
  return { repo, storage, client, pipeline, ctx }
}

describe('ElevenLabsDubbingPipeline', () => {
  it('dubs a YouTube video through the dubbing api', async () => {
    const job = makeJob()
    const { repo, storage, client, pipeline, ctx } = await setup(job)
    await pipeline.run(job, ctx)

    expect(repo.history.map((h) => h.status)).toEqual(['ingesting', 'dubbing', 'completed'])
    expect(client.createDubbing).toHaveBeenCalledWith(
      { filePath: undefined, sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', targetLang: 'pt', sourceLang: null, name: `vozia-${DUB_ID}` },
      expect.anything(),
    )
    expect(client.getDubbing).toHaveBeenCalledTimes(2)
    const dub = repo.dubs.get(DUB_ID)!
    expect(dub).toMatchObject({
      status: 'completed',
      provider_ref: 'd1',
      detected_language: 'en',
      output_path: `${OWNER_ID}/${DUB_ID}/dubbed.mp4`,
      srt_translated_path: `${OWNER_ID}/${DUB_ID}/translated.srt`,
      srt_original_path: null,
      dubbed_audio_path: null,
    })
    expect(await storage.list('outputs')).toEqual([`${OWNER_ID}/${DUB_ID}/dubbed.mp4`, `${OWNER_ID}/${DUB_ID}/translated.srt`])
    expect(repo.profiles.get(OWNER_ID)?.minutes_used).toBe(2)
    expect(repo.videos.get(VIDEO_ID)?.duration_seconds).toBe(61)
    expect(repo.dubs.get(DUB_ID)!.progress).toBe(100)
  })

  it('sends uploaded sources as files', async () => {
    const job = makeJob({ video: { source_type: 'upload', source_url: null, storage_path: `${OWNER_ID}/${VIDEO_ID}/original.webm`, duration_seconds: 120 } })
    const { storage, client, pipeline, ctx } = await setup(job)
    await storage.put('sources', `${OWNER_ID}/${VIDEO_ID}/original.webm`, 'webm bytes')
    await pipeline.run(job, ctx)
    const input = client.createDubbing.mock.calls[0]![0]
    expect(input.filePath).toMatch(/source\.webm$/)
    expect(input.sourceUrl).toBeUndefined()
  })

  it('fails in the dubbing stage when ElevenLabs reports an error', async () => {
    const job = makeJob()
    const { pipeline, ctx, repo } = await setup(job, stubClient([{ status: 'failed', error: 'no speech found' }]))
    await expect(pipeline.run(job, ctx)).rejects.toMatchObject({
      provider: 'elevenlabs',
      message: 'ElevenLabs could not dub this video: no speech found.',
    })
    expect(ctx.currentStage).toBe('dubbing')
    expect(repo.dubs.get(DUB_ID)?.provider_ref).toBe('d1')
  })
})
