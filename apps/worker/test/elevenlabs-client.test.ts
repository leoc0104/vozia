import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ElevenLabsClient } from '../src/drivers/elevenlabs/client.js'
import { createFetchStub, jsonResponse } from './helpers/fetch-stub.js'
import { tempDir } from './helpers/factories.js'

async function sampleFile(name = 'audio.wav') {
  const file = path.join(await tempDir(), name)
  await writeFile(file, 'audio bytes')
  return file
}

describe('ElevenLabsClient', () => {
  it('transcribes with Scribe and maps words to milliseconds', async () => {
    const { fetchImpl, requests } = createFetchStub(() =>
      jsonResponse({
        language_code: 'eng',
        words: [
          { text: 'Hello', start: 0.1, end: 0.5, type: 'word', speaker_id: 'speaker_0' },
          { text: ' ', start: 0.5, end: 0.6, type: 'spacing' },
          { text: 'there.', start: 0.6, end: 1.0, type: 'word', speaker_id: 'speaker_0' },
          { text: '(laughs)', start: 1.0, end: 1.5, type: 'audio_event' },
        ],
      }),
    )
    const client = new ElevenLabsClient({ apiKey: 'key', fetchImpl })
    const result = await client.speechToText(await sampleFile(), { languageCode: 'en', diarize: true })
    expect(result.languageCode).toBe('eng')
    expect(result.words).toEqual([
      { text: 'Hello', startMs: 100, endMs: 500, speaker: 'speaker_0' },
      { text: 'there.', startMs: 600, endMs: 1000, speaker: 'speaker_0' },
    ])
    const req = requests[0]!
    expect(req.url).toBe('https://api.elevenlabs.io/v1/speech-to-text')
    expect(req.method).toBe('POST')
    expect(req.headers['xi-api-key']).toBe('key')
    const form = req.body as FormData
    expect(form.get('model_id')).toBe('scribe_v1')
    expect(form.get('timestamps_granularity')).toBe('word')
    expect(form.get('diarize')).toBe('true')
    expect(form.get('language_code')).toBe('en')
    expect((form.get('file') as File).name).toBe('audio.wav')
  })

  it('creates and deletes instant voice clones', async () => {
    const { fetchImpl, requests } = createFetchStub((req) =>
      req.method === 'DELETE' ? jsonResponse({ status: 'ok' }) : jsonResponse({ voice_id: 'v123' }),
    )
    const client = new ElevenLabsClient({ apiKey: 'key', fetchImpl })
    expect(await client.addVoice('vozia-x', await sampleFile('sample.mp3'))).toEqual({ voiceId: 'v123' })
    const form = requests[0]!.body as FormData
    expect(requests[0]!.url).toBe('https://api.elevenlabs.io/v1/voices/add')
    expect(form.get('name')).toBe('vozia-x')
    expect(form.get('remove_background_noise')).toBe('true')
    expect((form.get('files') as File).name).toBe('sample.mp3')
    await client.deleteVoice('v123')
    expect(requests[1]).toMatchObject({ url: 'https://api.elevenlabs.io/v1/voices/v123', method: 'DELETE' })
  })

  it('synthesizes speech to a file', async () => {
    const { fetchImpl, requests } = createFetchStub(() => new Response(Buffer.from('mp3 bytes')))
    const client = new ElevenLabsClient({ apiKey: 'key', fetchImpl, baseUrl: 'https://proxy.example/' })
    const dest = path.join(await tempDir(), 'clip.mp3')
    await client.textToSpeech('v123', 'Olá!', {}, dest)
    expect(await readFile(dest, 'utf8')).toBe('mp3 bytes')
    expect(requests[0]!.url).toBe('https://proxy.example/v1/text-to-speech/v123?output_format=mp3_44100_128')
    expect(requests[0]!.json).toEqual({
      text: 'Olá!',
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    })
  })

  it('drives the dubbing endpoints', async () => {
    const { fetchImpl, requests } = createFetchStub((req) => {
      if (req.url.endsWith('/v1/dubbing')) return jsonResponse({ dubbing_id: 'd1', expected_duration_sec: 120 })
      if (req.url.endsWith('/v1/dubbing/d1')) {
        return jsonResponse({ dubbing_id: 'd1', status: 'dubbed', target_languages: ['pt'], media_metadata: { duration: 61.4 } })
      }
      if (req.url.includes('/audio/')) return new Response(Buffer.from('dubbed mp4'))
      if (req.url.includes('/transcript/pt')) return new Response('1\n00:00:00,000 --> 00:00:01,000\nOlá\n')
      return jsonResponse({ detail: { status: 'not_found', message: 'nope' } }, 404)
    })
    const client = new ElevenLabsClient({ apiKey: 'key', fetchImpl })
    expect(await client.createDubbing({ sourceUrl: 'https://youtu.be/x', targetLang: 'pt', sourceLang: null, name: 'demo' })).toEqual({
      dubbingId: 'd1',
      expectedDurationSec: 120,
    })
    const form = requests[0]!.body as FormData
    expect(form.get('source_url')).toBe('https://youtu.be/x')
    expect(form.get('target_lang')).toBe('pt')
    expect(form.get('source_lang')).toBe('auto')
    expect(form.get('num_speakers')).toBe('0')
    expect(form.get('watermark')).toBe('false')

    await client.createDubbing({ filePath: await sampleFile('source.mp4'), targetLang: 'es', sourceLang: 'en', name: 'demo' })
    expect(((requests[1]!.body as FormData).get('file') as File).name).toBe('source.mp4')

    expect(await client.getDubbing('d1')).toEqual({ status: 'dubbed', error: null, durationSec: 61.4, sourceLang: null, targetLanguages: ['pt'] })
    const dest = path.join(await tempDir(), 'dubbed.mp4')
    await client.downloadDubbedFile('d1', 'pt', dest)
    expect(await readFile(dest, 'utf8')).toBe('dubbed mp4')
    expect(await client.getTranscript('d1', 'pt', 'srt')).toContain('Olá')
    expect(await client.getTranscript('d1', 'en', 'srt')).toBeNull()
  })

  it('maps http and network failures to provider errors', async () => {
    const auth = new ElevenLabsClient({ apiKey: 'bad', fetchImpl: createFetchStub(() => jsonResponse({ detail: 'invalid key' }, 401)).fetchImpl })
    await expect(auth.getDubbing('x')).rejects.toMatchObject({ provider: 'elevenlabs', status: 401, message: 'ElevenLabs rejected the API key.' })

    const quota = new ElevenLabsClient({ apiKey: 'k', fetchImpl: createFetchStub(() => jsonResponse({}, 429)).fetchImpl })
    await expect(quota.getDubbing('x')).rejects.toMatchObject({ message: 'ElevenLabs quota or rate limit reached; try again later.' })

    const server = new ElevenLabsClient({
      apiKey: 'k',
      fetchImpl: createFetchStub(() => jsonResponse({ detail: { status: 'bad_request', message: 'Unsupported language' } }, 400)).fetchImpl,
    })
    await expect(server.getDubbing('x')).rejects.toMatchObject({ message: 'Dubbing status failed (ElevenLabs HTTP 400): Unsupported language.' })

    const offline = new ElevenLabsClient({
      apiKey: 'k',
      fetchImpl: (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch,
    })
    await expect(offline.getDubbing('x')).rejects.toMatchObject({ message: 'Dubbing status failed: could not reach ElevenLabs.' })
  })
})
