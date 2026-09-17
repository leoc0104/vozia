import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CANNED_SEGMENTS,
  FakeIngestor,
  FakeMedia,
  FakeObjectStorage,
  FakeSeparator,
  FakeSynthesizer,
  FakeTranscriber,
  FakeTranslator,
} from '../src/drivers/fake/index.js'
import { stageContext, tempDir } from './helpers/factories.js'

const exists = (p: string) => stat(p).then(() => true, () => false)

describe('fake drivers', () => {
  it('ingest writes media files and reports duration', async () => {
    const ctx = await stageContext()
    const result = await new FakeIngestor().ingest({ sourceType: 'youtube', sourceUrl: 'https://youtu.be/x', storagePath: null }, ctx)
    expect(await exists(result.videoPath)).toBe(true)
    expect(await exists(result.audioPath)).toBe(true)
    expect(result.durationSeconds).toBe(42)
    expect(result.downloaded).toBe(true)
    expect(result.title).toBe('Fake YouTube video')
    const upload = await new FakeIngestor({ durationSeconds: 7 }).ingest({ sourceType: 'upload', sourceUrl: null, storagePath: 'a/b/original.mp4' }, ctx)
    expect(upload.downloaded).toBe(false)
    expect(upload.durationSeconds).toBe(7)
  })

  it('separator, transcriber, translator and synthesizer honour their contracts', async () => {
    const ctx = await stageContext()
    const { audioPath } = await new FakeIngestor().ingest({ sourceType: 'upload', sourceUrl: null, storagePath: 'x' }, ctx)
    const { vocalsPath, backgroundPath } = await new FakeSeparator().separate(audioPath, ctx)
    expect(await readFile(vocalsPath, 'utf8')).toBe('fake audio\n')
    expect(path.basename(backgroundPath)).toBe('background.wav')

    const transcript = await new FakeTranscriber().transcribe(vocalsPath, { languageHint: null }, ctx)
    expect(transcript.language).toBe('en')
    expect(transcript.segments).toEqual(CANNED_SEGMENTS)
    expect((await new FakeTranscriber().transcribe(vocalsPath, { languageHint: 'es' }, ctx)).language).toBe('es')
    expect((await new FakeTranscriber({ segments: [] }).transcribe(vocalsPath, { languageHint: null }, ctx)).segments).toEqual([])

    const translated = await new FakeTranslator().translate(transcript.segments, { sourceLanguage: 'en', targetLanguage: 'pt' }, ctx)
    expect(translated[0]!.translatedText).toBe('[pt] Hello there.')

    const { dubbedVocalsPath } = await new FakeSynthesizer().synthesize(
      { segments: translated, vocalsPath, voiceMode: 'clone', stockVoiceId: null, targetLanguage: 'pt', totalDurationMs: 6000 },
      ctx,
    )
    expect(await exists(dubbedVocalsPath)).toBe(true)
    expect(ctx.progressValues.at(-1)).toBe(1)
  })

  it('media stubs every operation', async () => {
    const ctx = await stageContext()
    const media = new FakeMedia({ durationSeconds: 12 })
    const { videoPath } = await new FakeIngestor().ingest({ sourceType: 'upload', sourceUrl: null, storagePath: 'x' }, ctx)
    expect(await media.probeDurationSeconds()).toBe(12)
    expect(await exists(await media.extractAudio(videoPath, ctx))).toBe(true)
    expect(await exists(await media.thumbnail(videoPath, ctx))).toBe(true)
    expect(await exists(await media.clipAudio(videoPath, { startSec: 0, durationSec: 60 }, ctx))).toBe(true)
    expect(await exists(await media.duck(videoPath, -14, ctx))).toBe(true)
    expect(await exists(await media.assembleTimeline([], 1000, ctx))).toBe(true)
    const { outputPath } = await media.mux({ videoPath, backgroundPath: videoPath, dubbedVocalsPath: videoPath }, ctx)
    expect(path.basename(outputPath)).toBe('dubbed.mp4')
  })

  it('object storage stores, lists, downloads and removes files', async () => {
    const storage = new FakeObjectStorage(await tempDir())
    const ctx = await stageContext()
    await storage.put('sources', 'owner/video/original.mp4', 'video bytes')
    const dest = path.join(ctx.workdir, 'source.mp4')
    await storage.download('sources', 'owner/video/original.mp4', dest)
    expect(await readFile(dest, 'utf8')).toBe('video bytes')
    await storage.upload('outputs', 'owner/dub/dubbed.mp4', dest, 'video/mp4')
    expect(await storage.list('outputs')).toEqual(['owner/dub/dubbed.mp4'])
    await storage.remove('outputs', ['owner/dub/dubbed.mp4'])
    expect(await storage.list('outputs')).toEqual([])
    await expect(storage.download('sources', 'missing.mp4', dest)).rejects.toMatchObject({ name: 'ProviderError', provider: 'storage' })
  })
})
