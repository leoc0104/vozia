import { describe, expect, it, vi } from 'vitest'
import { createJobContext } from '../src/pipeline/context.js'
import { StagedPipeline, matchVoiceLevel, type StagedPipelineDeps } from '../src/pipeline/staged-pipeline.js'
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
  it('mixes the dub over the original audio between lines and the separated background during them', async () => {
    const media = new FakeMedia()
    const separator = new FakeSeparator()
    const keep = vi.spyOn(media, 'buildDubBackground')
    const mux = vi.spyOn(media, 'mux')
    const separate = vi.spyOn(separator, 'separate')
    const { ctx, pipeline } = await setup(makeJob(), { media, separator })
    await pipeline.run(makeJob(), ctx)

    const [input] = keep.mock.calls[0]!
    expect(input.originalPath).toMatch(/audio\.wav$/)
    expect(input.backgroundPath).toBe((await separate.mock.results[0]!.value).backgroundPath)
    // The three canned lines (0–1.5 s, 1.6–4 s, 4.2–6 s) are close enough to read as one stretch of speech.
    expect(input.speech).toEqual([{ startMs: 0, endMs: 6150 }])
    expect(mux.mock.calls[0]![0].backgroundPath).toBe(await keep.mock.results[0]!.value)
  })

  describe("the speaker's own sounds", () => {
    const lines = [
      { idx: 0, startMs: 1000, endMs: 3000, text: 'Socorro!' },
      { idx: 1, startMs: 8000, endMs: 9000, text: 'Ufa.' },
    ]
    const events = [
      { label: 'laughter', startMs: 3200, endMs: 4500 }, // right after line 0: the new voice laughs there
      { label: 'applause', startMs: 5000, endMs: 6000 }, // not a voice: stays original
      { label: 'laughter', startMs: 12_000, endMs: 13_000 }, // far from every line: stays original
    ]

    async function dub(synthesizer: FakeSynthesizer) {
      const media = new FakeMedia()
      const translator = new FakeTranslator()
      const spies = {
        measure: vi.spyOn(media, 'measureDelivery').mockResolvedValue(new Map([[0, { loudnessDb: 7, pitchSt: 5 }]])),
        translate: vi.spyOn(translator, 'translate'),
        synthesize: vi.spyOn(synthesizer, 'synthesize'),
        background: vi.spyOn(media, 'buildDubBackground'),
      }
      const transcriber = new FakeTranscriber({ segments: lines, events })
      const { ctx, pipeline, repo } = await setup(makeJob(), { media, translator, synthesizer, transcriber })
      await pipeline.run(makeJob(), ctx)
      return { ...spies, repo }
    }

    it('are re-performed by a voice that performs directions, and the original laugh gives way', async () => {
      const { measure, translate, synthesize, background, repo } = await dub(new FakeSynthesizer({ performsDirections: true }))

      expect(measure.mock.calls[0]![0]).toMatch(/vocals/)
      expect(measure.mock.calls[0]![1].map((s) => s.idx)).toEqual([0, 1])
      const notes = translate.mock.calls[0]![1].notes!
      // "Socorro!" (7 letters in 2 s) is a little faster than this speaker's usual (3.25 letters per second).
      expect(notes.get(0)).toEqual({
        delivery: { loudnessDb: 7, pitchSt: 5, pace: 1.08 },
        sounds: [{ id: 0, label: 'laughter', position: 'after', atSec: 2.2, seconds: 1.3 }],
      })
      expect(notes.get(1)!.sounds).toBeUndefined()

      const performed = synthesize.mock.calls[0]![0].segments
      expect(performed[0]).toMatchObject({ startMs: 1000, endMs: 4500, performanceText: 'Socorro! [laughter]', performedSounds: [0] })
      expect(performed[1]).toMatchObject({ startMs: 8000, endMs: 9000 })
      expect(background.mock.calls[0]![0].speech).toEqual([
        { startMs: 900, endMs: 4650 },
        { startMs: 7900, endMs: 9150 },
      ])
      // Subtitles keep the timing of the words.
      expect(repo.segments.get(DUB_ID)!.map((s) => [s.startMs, s.endMs])).toEqual([[1000, 3000], [8000, 9000]])
    })

    it('stay original when the voice cannot perform them', async () => {
      const { synthesize, background } = await dub(new FakeSynthesizer())
      expect(synthesize.mock.calls[0]![0].segments[0]).toMatchObject({ startMs: 1000, endMs: 3000 })
      expect(background.mock.calls[0]![0].speech).toEqual([
        { startMs: 900, endMs: 3150 },
        { startMs: 7900, endMs: 9150 },
      ])
    })
  })

  it('makes the new voice as loud as the original voice', async () => {
    const media = new FakeMedia()
    vi.spyOn(media, 'loudness').mockImplementation(async (file) => (/dubbed/.test(file) ? -16.3 : -11.7))
    const mux = vi.spyOn(media, 'mux')
    const { ctx, pipeline } = await setup(makeJob(), { media })
    await pipeline.run(makeJob(), ctx)
    expect(mux.mock.calls[0]![0].voiceGainDb).toBe(4.6)
  })

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

describe('matchVoiceLevel', () => {
  it('brings the new voice to the original level, within limits, and leaves it alone when unknown', () => {
    expect(matchVoiceLevel(-11.7, -16.3)).toBe(4.6)
    expect(matchVoiceLevel(-20, -14)).toBe(-6)
    expect(matchVoiceLevel(-5, -40)).toBe(10)
    expect(matchVoiceLevel(null, -16)).toBe(0)
    expect(matchVoiceLevel(-12, null)).toBe(0)
  })
})
