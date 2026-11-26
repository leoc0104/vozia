import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ElevenLabsTranscriber } from '../src/drivers/elevenlabs/transcriber.js'
import { ElevenLabsSynthesizer } from '../src/drivers/elevenlabs/synthesizer.js'
import { ProviderError } from '../src/pipeline/errors.js'
import { stageContext } from './helpers/factories.js'

describe('ElevenLabsTranscriber', () => {
  it('groups the provider words and normalizes the language', async () => {
    const speechToText = vi.fn(async () => ({
      languageCode: 'por',
      words: [
        { text: 'Olá', startMs: 0, endMs: 300, speaker: 's0' },
        { text: 'mundo.', startMs: 400, endMs: 800, speaker: 's0' },
      ],
      events: [],
    }))
    const ctx = await stageContext()
    const result = await new ElevenLabsTranscriber({ speechToText }).transcribe('/vocals.wav', { languageHint: null }, ctx)
    expect(result).toEqual({
      language: 'pt',
      segments: [
        {
          idx: 0,
          startMs: 0,
          endMs: 800,
          text: 'Olá mundo.',
          speaker: 's0',
          words: [
            { text: 'Olá', startMs: 0, endMs: 300, speaker: 's0' },
            { text: 'mundo.', startMs: 400, endMs: 800, speaker: 's0' },
          ],
        },
      ],
      events: [],
    })
    expect(speechToText).toHaveBeenCalledWith('/vocals.wav', { languageCode: null, diarize: true }, ctx.signal)
  })

  it('passes on the sounds it heard, like laughter', async () => {
    const speechToText = vi.fn(async () => ({
      languageCode: 'pt',
      words: [{ text: 'Socorro!', startMs: 0, endMs: 600, speaker: 's0' }],
      events: [{ label: 'laughter', startMs: 700, endMs: 1500 }],
    }))
    const result = await new ElevenLabsTranscriber({ speechToText }).transcribe('/vocals.wav', { languageHint: null }, await stageContext())
    expect(result.events).toEqual([{ label: 'laughter', startMs: 700, endMs: 1500 }])
  })
})

function stubClient() {
  return {
    addVoice: vi.fn(async (_name: string, _sampleFilePath: string, _signal?: AbortSignal) => ({ voiceId: 'clone-1' })),
    deleteVoice: vi.fn(async (_voiceId: string, _signal?: AbortSignal) => undefined),
    textToSpeech: vi.fn(async (_voice: string, _text: string, _opts: unknown, dest: string, _signal?: AbortSignal) => {
      await writeFile(dest, 'mp3')
    }),
  }
}

const clone = { voiceMode: 'clone' as const, stockVoiceId: null, samplePath: '/w/sample.mp3', targetLanguage: 'en' }

describe('ElevenLabsSynthesizer', () => {
  it('clones the voice from the sample, speaks each take with its neighbours as context, and deletes the clone', async () => {
    const client = stubClient()
    const ctx = await stageContext()
    const synth = new ElevenLabsSynthesizer({ client })
    expect(synth.performsDirections).toBe(true)
    const voice = await synth.openVoice(clone, ctx)
    expect(client.addVoice.mock.calls[0]![1]).toBe('/w/sample.mp3')

    const dest = path.join(ctx.workdir, '0-1.mp3')
    await voice.speak({ text: '[panicked] Help!', previousText: 'Oh my God.', nextText: 'It touched me.', seed: 7, stability: 0.35 }, dest, ctx)
    expect(client.textToSpeech.mock.calls[0]!.slice(0, 4)).toEqual([
      'clone-1',
      '[panicked] Help!',
      { modelId: 'eleven_v4', languageCode: 'en', seed: 7, stability: 0.35, previousText: 'Oh my God.', nextText: 'It touched me.' },
      dest,
    ])
    await voice.close(ctx)
    expect(client.deleteVoice).toHaveBeenCalledWith('clone-1', ctx.signal)
  })

  it('gives older models the plain request, and keeps a clone when asked to', async () => {
    const client = stubClient()
    const ctx = await stageContext()
    const v2 = new ElevenLabsSynthesizer({ client, modelId: 'eleven_multilingual_v2', keepClonedVoice: true })
    expect(v2.performsDirections).toBe(false)
    const voice = await v2.openVoice(clone, ctx)
    await voice.speak({ text: 'Help!' }, path.join(ctx.workdir, 'a.mp3'), ctx)
    expect(client.textToSpeech.mock.calls[0]![2]).toEqual({ modelId: 'eleven_multilingual_v2' })
    await voice.close(ctx)
    expect(client.deleteVoice).not.toHaveBeenCalled()
  })

  it('speaks each line alone for the rest of the dub when the model refuses the neighbouring lines', async () => {
    const client = stubClient()
    client.textToSpeech.mockRejectedValueOnce(new ProviderError('elevenlabs', 'Speech synthesis failed (ElevenLabs HTTP 400).', { status: 400 }))
    const ctx = await stageContext()
    const voice = await new ElevenLabsSynthesizer({ client }).openVoice(clone, ctx)
    await voice.speak({ text: 'one', nextText: 'two' }, path.join(ctx.workdir, 'a.mp3'), ctx)
    await voice.speak({ text: 'two', previousText: 'one' }, path.join(ctx.workdir, 'b.mp3'), ctx)
    expect(client.textToSpeech.mock.calls.map((c) => c[2])).toEqual([
      { modelId: 'eleven_v4', languageCode: 'en', previousText: undefined, nextText: 'two' },
      { modelId: 'eleven_v4', languageCode: 'en' },
      { modelId: 'eleven_v4', languageCode: 'en' },
    ])
  })

  it('passes other failures on, uses a stock voice without cloning, and needs a voice to speak with', async () => {
    const client = stubClient()
    client.textToSpeech.mockRejectedValueOnce(new Error('boom'))
    const ctx = await stageContext()
    const synth = new ElevenLabsSynthesizer({ client })
    const voice = await synth.openVoice(clone, ctx)
    await expect(voice.speak({ text: 'x', nextText: 'y' }, path.join(ctx.workdir, 'a.mp3'), ctx)).rejects.toThrow('boom')

    const stock = await synth.openVoice({ ...clone, voiceMode: 'stock', stockVoiceId: 'stock-9', samplePath: null }, ctx)
    await stock.speak({ text: 'x' }, path.join(ctx.workdir, 'b.mp3'), ctx)
    expect(client.textToSpeech.mock.calls.at(-1)![0]).toBe('stock-9')
    await stock.close(ctx)
    expect(client.addVoice).toHaveBeenCalledTimes(1)
    expect(client.deleteVoice).not.toHaveBeenCalled()

    await expect(synth.openVoice({ ...clone, voiceMode: 'stock', stockVoiceId: null }, ctx)).rejects.toMatchObject({
      message: 'No stock voice was selected for this dub.',
    })
    await expect(synth.openVoice({ ...clone, samplePath: null }, ctx)).rejects.toMatchObject({
      message: 'There is no voice sample to clone the speaker from.',
    })
  })
})

describe('ElevenLabsTranscriber.words', () => {
  it('hears a take as it is: its words and sounds, one voice, no grouping', async () => {
    const speechToText = vi.fn(async () => ({
      languageCode: 'en',
      words: [{ text: 'Help!', startMs: 120, endMs: 600, speaker: null }],
      events: [{ label: 'laughs', startMs: 700, endMs: 1500, speaker: null }],
    }))
    const ctx = await stageContext()
    expect(await new ElevenLabsTranscriber({ speechToText }).words('/takes.wav', { languageHint: 'en' }, ctx)).toEqual({
      words: [{ text: 'Help!', startMs: 120, endMs: 600, speaker: null }],
      events: [{ label: 'laughs', startMs: 700, endMs: 1500, speaker: null }],
    })
    expect(speechToText).toHaveBeenCalledWith('/takes.wav', { languageCode: 'en', diarize: false }, ctx.signal)
  })
})
