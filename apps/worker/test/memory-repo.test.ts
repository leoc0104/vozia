import { describe, expect, it } from 'vitest'
import { InMemoryDubRepository } from '../src/repo/memory-repo.js'
import { DUB_ID, OWNER_ID, VIDEO_ID, makeJob } from './helpers/factories.js'

describe('InMemoryDubRepository', () => {
  it('loads seeded jobs as copies', async () => {
    const repo = new InMemoryDubRepository()
    repo.seed(makeJob())
    const job = await repo.loadJob(DUB_ID)
    expect(job?.dub.id).toBe(DUB_ID)
    expect(await repo.loadJob('nope')).toBeNull()
    job!.dub.status = 'failed'
    expect(repo.dubs.get(DUB_ID)?.status).toBe('queued')
  })

  it('records the lifecycle and charges minutes on completion', async () => {
    const repo = new InMemoryDubRepository()
    repo.seed(makeJob())
    await repo.markStarted(DUB_ID, 'staged')
    await repo.markStage(DUB_ID, 'ingesting', 0)
    await repo.updateProgress(DUB_ID, 5)
    await repo.patchDub(DUB_ID, { detected_language: 'en' })
    await repo.replaceSegments(DUB_ID, [{ idx: 0, startMs: 0, endMs: 10, text: 'hi', translatedText: 'oi' }])
    await repo.updateVideoAfterIngest(VIDEO_ID, { storagePath: `${OWNER_ID}/${VIDEO_ID}/original.mp4`, durationSeconds: 61, title: 'T' })
    await repo.markCompleted(DUB_ID, {
      outputPath: 'o.mp4',
      dubbedAudioPath: null,
      srtOriginalPath: 'o.srt',
      srtTranslatedPath: 't.srt',
      minutes: 2,
    })
    const dub = repo.dubs.get(DUB_ID)!
    expect(dub.attempts).toBe(1)
    expect(dub.pipeline).toBe('staged')
    expect(dub.detected_language).toBe('en')
    expect(dub.status).toBe('completed')
    expect(dub.progress).toBe(100)
    expect(dub.output_path).toBe('o.mp4')
    expect(repo.profiles.get(OWNER_ID)?.minutes_used).toBe(2)
    expect(repo.videos.get(VIDEO_ID)?.duration_seconds).toBe(61)
    expect(repo.segments.get(DUB_ID)?.[0]?.translatedText).toBe('oi')
    expect(repo.history.map((h) => h.status)).toEqual(['ingesting', 'completed'])
  })

  it('marks failures and clears them before a re-run', async () => {
    const repo = new InMemoryDubRepository()
    repo.seed(makeJob({ dub: { status: 'muxing', progress: 90 } }))
    await repo.markFailed(DUB_ID, 'muxing', 'boom')
    expect(repo.dubs.get(DUB_ID)).toMatchObject({ status: 'failed', failed_stage: 'muxing', error_message: 'boom' })
    await repo.prepareRerun(DUB_ID)
    expect(repo.dubs.get(DUB_ID)).toMatchObject({ status: 'failed', progress: 0, error_message: null, failed_stage: null })
  })
})
