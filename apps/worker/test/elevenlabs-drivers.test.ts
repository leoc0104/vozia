import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ElevenLabsTranscriber } from '../src/drivers/elevenlabs/transcriber.js'
import { ElevenLabsSynthesizer } from '../src/drivers/elevenlabs/synthesizer.js'
import { FakeMedia } from '../src/drivers/fake/index.js'
import type { Placement, TranslatedSegment } from '../src/pipeline/contracts.js'
import { stageContext } from './helpers/factories.js'

describe('ElevenLabsTranscriber', () => {
  it('groups the provider words and normalizes the language', async () => {
    const speechToText = vi.fn(async () => ({
      languageCode: 'por',
      words: [
        { text: 'Olá', startMs: 0, endMs: 300, speaker: 's0' },
        { text: 'mundo.', startMs: 400, endMs: 800, speaker: 's0' },
      ],
    }))
    const ctx = await stageContext()
    const result = await new ElevenLabsTranscriber({ speechToText }).transcribe('/vocals.wav', { languageHint: null }, ctx)
    expect(result).toEqual({ language: 'pt', segments: [{ idx: 0, startMs: 0, endMs: 800, text: 'Olá mundo.', speaker: 's0' }] })
    expect(speechToText).toHaveBeenCalledWith('/vocals.wav', { languageCode: null, diarize: true }, ctx.signal)
  })
})

class RecordingMedia extends FakeMedia {
  timeline: { placements: Placement[]; totalDurationMs: number } | null = null
  override async assembleTimeline(clips: { placement: Placement; path: string }[], totalDurationMs: number, ctx: Parameters<FakeMedia['assembleTimeline']>[2]) {
    this.timeline = { placements: clips.map((c) => c.placement), totalDurationMs }
    return super.assembleTimeline(clips, totalDurationMs, ctx)
  }
}

const segments: TranslatedSegment[] = [
  { idx: 0, startMs: 0, endMs: 1500, text: 'Hello there.', translatedText: 'Olá.' },
  { idx: 1, startMs: 1600, endMs: 4000, text: 'Welcome.', translatedText: 'Bem-vindo à demonstração.' },
  { idx: 2, startMs: 4200, endMs: 6000, text: '...', translatedText: '   ' },
]

function stubClient() {
  return {
    addVoice: vi.fn(async (_name: string, _sampleFilePath: string, _signal?: AbortSignal) => ({ voiceId: 'clone-1' })),
    deleteVoice: vi.fn(async (_voiceId: string, _signal?: AbortSignal) => undefined),
    textToSpeech: vi.fn(async (_voice: string, _text: string, _opts: unknown, dest: string) => {
      await writeFile(dest, 'mp3')
    }),
  }
}

describe('ElevenLabsSynthesizer', () => {
  it('clones the voice, synthesizes each spoken cue, assembles the timeline and deletes the clone', async () => {
    const client = stubClient()
    const media = new RecordingMedia({ durationSeconds: 1.2 })
    const ctx = await stageContext()
    const synth = new ElevenLabsSynthesizer({ client, media })
    const result = await synth.synthesize(
      { segments, vocalsPath: '/vocals.wav', voiceMode: 'clone', stockVoiceId: null, targetLanguage: 'pt', totalDurationMs: 6000 },
      ctx,
    )
    expect(result.dubbedVocalsPath).toBe(path.join(ctx.workdir, 'dubbed_vocals.wav'))
    expect(client.addVoice).toHaveBeenCalledTimes(1)
    expect(client.addVoice.mock.calls[0]![1]).toBe(path.join(ctx.workdir, 'sample.mp3'))
    expect(client.textToSpeech).toHaveBeenCalledTimes(2)
    expect(client.textToSpeech.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['clone-1', 'Olá.'],
      ['clone-1', 'Bem-vindo à demonstração.'],
    ])
    expect(client.textToSpeech.mock.calls[0]![3]).toBe(path.join(ctx.workdir, 'clips', '0.mp3'))
    expect(media.timeline).toEqual({
      placements: [
        { idx: 0, startMs: 0, tempo: 1 },
        { idx: 1, startMs: 1600, tempo: 1 },
      ],
      totalDurationMs: 6000,
    })
    expect(client.deleteVoice).toHaveBeenCalledWith('clone-1', ctx.signal)
    expect(ctx.progressValues.at(-1)).toBe(1)
  })

  it('uses the stock voice without cloning and can keep a clone', async () => {
    const client = stubClient()
    const ctx = await stageContext()
    await new ElevenLabsSynthesizer({ client, media: new FakeMedia() }).synthesize(
      { segments, vocalsPath: '/v.wav', voiceMode: 'stock', stockVoiceId: 'stock-9', targetLanguage: 'pt', totalDurationMs: 6000 },
      ctx,
    )
    expect(client.addVoice).not.toHaveBeenCalled()
    expect(client.deleteVoice).not.toHaveBeenCalled()
    expect(client.textToSpeech.mock.calls[0]![0]).toBe('stock-9')

    const keep = stubClient()
    await new ElevenLabsSynthesizer({ client: keep, media: new FakeMedia(), keepClonedVoice: true }).synthesize(
      { segments, vocalsPath: '/v.wav', voiceMode: 'clone', stockVoiceId: null, targetLanguage: 'pt', totalDurationMs: 6000 },
      ctx,
    )
    expect(keep.deleteVoice).not.toHaveBeenCalled()
  })

  it('still deletes the clone when synthesis fails, and rejects stock mode without a voice', async () => {
    const client = stubClient()
    client.textToSpeech.mockRejectedValueOnce(new Error('boom'))
    const ctx = await stageContext()
    const synth = new ElevenLabsSynthesizer({ client, media: new FakeMedia() })
    await expect(
      synth.synthesize({ segments, vocalsPath: '/v.wav', voiceMode: 'clone', stockVoiceId: null, targetLanguage: 'pt', totalDurationMs: 6000 }, ctx),
    ).rejects.toThrow('boom')
    expect(client.deleteVoice).toHaveBeenCalledTimes(1)
    await expect(
      synth.synthesize({ segments, vocalsPath: '/v.wav', voiceMode: 'stock', stockVoiceId: null, targetLanguage: 'pt', totalDurationMs: 6000 }, ctx),
    ).rejects.toMatchObject({ message: 'No stock voice was selected for this dub.' })
  })
})
