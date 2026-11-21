import { describe, expect, it, vi } from 'vitest'
import { AnthropicTranslator, SYSTEM_PROMPT, type TranslationClient, type TranslationParseParams } from '../src/drivers/anthropic-translator.js'
import type { TranscriptSegment } from '../src/pipeline/contracts.js'
import { stageContext } from './helpers/factories.js'

function segmentsOf(n: number): TranscriptSegment[] {
  return Array.from({ length: n }, (_, i) => ({ idx: i, startMs: i * 1000, endMs: i * 1000 + 900, text: `line ${i}` }))
}

function echoClient(
  transform: (idx: number, text: string) => string | null = (i, t) => `PT ${t}`,
  perform: (text: string) => string = (text) => `[excited] ${text}`,
  performedSounds: number[] = [],
) {
  const calls: TranslationParseParams[] = []
  const client: TranslationClient = {
    parse: vi.fn(async (params: TranslationParseParams) => {
      calls.push(params)
      const payload = params.messages[0]!.content.split('Segments:\n')[1]!
      const items = JSON.parse(payload) as { idx: number; text: string }[]
      const translations = items.flatMap(({ idx, text }) => {
        const out = transform(idx, text)
        return out === null ? [] : [{ idx, text: out, performance: perform(out), performedSounds }]
      })
      return { parsed_output: { translations }, stop_reason: 'end_turn' }
    }),
  }
  return { client, calls }
}

const sentSegments = (call: TranslationParseParams) => JSON.parse(call.messages[0]!.content.split('Segments:\n')[1]!)

describe('AnthropicTranslator', () => {
  it('translates in batches with a cached system prompt and structured output', async () => {
    const { client, calls } = echoClient()
    const translator = new AnthropicTranslator({ model: 'claude-opus-5', client, batchSize: 40 })
    const ctx = await stageContext()
    const result = await translator.translate(segmentsOf(95), { sourceLanguage: 'en', targetLanguage: 'pt' }, ctx)
    expect(result).toHaveLength(95)
    expect(result[7]).toMatchObject({ idx: 7, text: 'line 7', translatedText: 'PT line 7' })
    expect(calls).toHaveLength(3)
    expect(calls.map((c) => JSON.parse(c.messages[0]!.content.split('Segments:\n')[1]!).length)).toEqual([40, 40, 15])
    const first = calls[0]!
    expect(first.model).toBe('claude-opus-5')
    expect(first.max_tokens).toBe(16000)
    expect(first.system[0]).toEqual({ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } })
    expect(first.messages[0]!.content).toContain('Source language: English (en)')
    expect(first.messages[0]!.content).toContain('Target language: Portuguese (pt)')
    expect(first.output_config.format).toBeTruthy()
    expect(ctx.progressValues.at(-1)).toBe(1)
  })

  it('tells the model how long each original line takes to say, so the translation fits the same time', async () => {
    const { client, calls } = echoClient()
    const translator = new AnthropicTranslator({ model: 'm', client })
    const lines = [
      { idx: 0, startMs: 1740, endMs: 2940, text: 'Meu Deus, gente' },
      { idx: 1, startMs: 29_600, endMs: 33_900, text: 'eu quero vomitar' },
    ]
    await translator.translate(lines, { sourceLanguage: 'pt', targetLanguage: 'en' }, await stageContext())
    expect(JSON.parse(calls[0]!.messages[0]!.content.split('Segments:\n')[1]!)).toEqual([
      { idx: 0, text: 'Meu Deus, gente', seconds: 1.2 },
      { idx: 1, text: 'eu quero vomitar', seconds: 4.3 },
    ])
    expect(SYSTEM_PROMPT).toContain('`seconds`')
  })

  it('tells the model how each line was said and which sounds the speaker made around it', async () => {
    const { client, calls } = echoClient()
    const translator = new AnthropicTranslator({ model: 'm', client })
    const lines = [
      { idx: 0, startMs: 5080, endMs: 8580, text: 'entrou uma barata voadora no meu quarto' },
      { idx: 1, startMs: 9040, endMs: 12_140, text: 'me ajuda!' },
    ]
    const notes = new Map([
      [0, {
        delivery: { loudnessDb: 0.3, pitchSt: 4.9, pitchRangeSt: 6.1, pace: 1.2 },
        sounds: [{ id: 0, label: 'risos', position: 'after' as const, atSec: 3.6, seconds: 0.9 }],
      }],
      [1, { delivery: {} }],
    ])
    await translator.translate(lines, { sourceLanguage: 'pt', targetLanguage: 'en', notes }, await stageContext())
    expect(sentSegments(calls[0]!)).toEqual([
      {
        idx: 0,
        text: 'entrou uma barata voadora no meu quarto',
        seconds: 3.5,
        delivery: { loudnessDb: 0.3, pitchSt: 4.9, pitchRangeSt: 6.1, pace: 1.2 },
        sounds: [{ id: 0, label: 'risos', position: 'after', atSec: 3.6, seconds: 0.9 }],
      },
      { idx: 1, text: 'me ajuda!', seconds: 3.1 },
    ])
    for (const field of ['`performance`', '`delivery`', '`sounds`']) expect(SYSTEM_PROMPT).toContain(field)
  })

  it('returns plain words for the subtitles and a directed performance for the voice', async () => {
    const { client } = echoClient(() => 'A flying cockroach got into my room', (text) => `[panicked] ${text}... [laughs]`)
    const translator = new AnthropicTranslator({ model: 'm', client })
    const [line] = await translator.translate(segmentsOf(1), { sourceLanguage: 'pt', targetLanguage: 'en' }, await stageContext())
    expect(line).toMatchObject({
      translatedText: 'A flying cockroach got into my room',
      performanceText: '[panicked] A flying cockroach got into my room... [laughs]',
    })
  })

  it('reports the listed sounds the performance re-performs, and only those', async () => {
    const lines = segmentsOf(3)
    const sounds = [
      { id: 0, label: 'risos', position: 'after' as const, atSec: 1, seconds: 1.5 },
      { id: 1, label: 'aplausos', position: 'after' as const, atSec: 2.5, seconds: 2 },
    ]
    const notes = new Map([[0, { sounds }], [1, { sounds }], [2, { sounds }]])
    const translate = async (perform: (t: string) => string, performedSounds: number[]) =>
      new AnthropicTranslator({ model: 'm', client: echoClient(undefined, perform, performedSounds).client }).translate(
        lines,
        { sourceLanguage: 'pt', targetLanguage: 'en', notes },
        await stageContext(),
      )

    // The laugh is performed; the applause is not a voice, and 7 was never listed.
    const performed = await translate((t) => `${t} [laughs harder]`, [0, 7, 0])
    expect(performed[0]!.performedSounds).toEqual([0])
    // A performance without any direction performs nothing, whatever the model claims.
    const plain = await translate((t) => t, [0])
    expect(plain[0]!.performedSounds).toBeUndefined()
  })

  it('falls back to the plain words when a performance lost them', async () => {
    const { client } = echoClient((i, t) => `PT ${t}`, () => '[laughs]')
    const translator = new AnthropicTranslator({ model: 'm', client })
    const [line] = await translator.translate(segmentsOf(1), { sourceLanguage: 'en', targetLanguage: 'pt' }, await stageContext())
    expect(line!.translatedText).toBe('PT line 0')
    expect(line!.performanceText).toBeUndefined()
  })

  it('retries segments the model skipped, once', async () => {
    let attempt = 0
    const { client, calls } = echoClient((idx, text) => (idx === 2 && attempt++ === 0 ? null : `X ${text}`))
    const translator = new AnthropicTranslator({ model: 'm', client })
    const result = await translator.translate(segmentsOf(4), { sourceLanguage: 'en', targetLanguage: 'es' }, await stageContext())
    expect(result.map((s) => s.translatedText)).toEqual(['X line 0', 'X line 1', 'X line 2', 'X line 3'])
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[1]!.messages[0]!.content.split('Segments:\n')[1]!)).toEqual([{ idx: 2, text: 'line 2', seconds: 0.9 }])
  })

  it('fails clearly when segments stay missing, on refusals and on unparsable answers', async () => {
    const ctx = await stageContext()
    const skipping = new AnthropicTranslator({ model: 'm', client: echoClient((idx) => (idx === 1 ? null : 'ok')).client })
    await expect(skipping.translate(segmentsOf(3), { sourceLanguage: 'en', targetLanguage: 'de' }, ctx)).rejects.toMatchObject({
      message: 'The translation model skipped 1 segment(s).',
      stage: 'translating',
    })
    const refusing = new AnthropicTranslator({ model: 'm', client: { parse: async () => ({ parsed_output: null, stop_reason: 'refusal' }) } })
    await expect(refusing.translate(segmentsOf(1), { sourceLanguage: 'en', targetLanguage: 'de' }, ctx)).rejects.toMatchObject({
      message: 'The translation model declined this content.',
    })
    const garbage = new AnthropicTranslator({ model: 'm', client: { parse: async () => ({ parsed_output: null, stop_reason: 'end_turn' }) } })
    await expect(garbage.translate(segmentsOf(1), { sourceLanguage: 'en', targetLanguage: 'de' }, ctx)).rejects.toMatchObject({
      message: 'The translation model returned an unreadable answer.',
    })
  })
})
