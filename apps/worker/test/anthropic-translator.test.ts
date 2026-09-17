import { describe, expect, it, vi } from 'vitest'
import { AnthropicTranslator, SYSTEM_PROMPT, type TranslationClient, type TranslationParseParams } from '../src/drivers/anthropic-translator.js'
import type { TranscriptSegment } from '../src/pipeline/contracts.js'
import { stageContext } from './helpers/factories.js'

function segmentsOf(n: number): TranscriptSegment[] {
  return Array.from({ length: n }, (_, i) => ({ idx: i, startMs: i * 1000, endMs: i * 1000 + 900, text: `line ${i}` }))
}

function echoClient(transform: (idx: number, text: string) => string | null = (i, t) => `PT ${t}`) {
  const calls: TranslationParseParams[] = []
  const client: TranslationClient = {
    parse: vi.fn(async (params: TranslationParseParams) => {
      calls.push(params)
      const payload = params.messages[0]!.content.split('Segments:\n')[1]!
      const items = JSON.parse(payload) as { idx: number; text: string }[]
      const translations = items.flatMap(({ idx, text }) => {
        const out = transform(idx, text)
        return out === null ? [] : [{ idx, text: out }]
      })
      return { parsed_output: { translations }, stop_reason: 'end_turn' }
    }),
  }
  return { client, calls }
}

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

  it('retries segments the model skipped, once', async () => {
    let attempt = 0
    const { client, calls } = echoClient((idx, text) => (idx === 2 && attempt++ === 0 ? null : `X ${text}`))
    const translator = new AnthropicTranslator({ model: 'm', client })
    const result = await translator.translate(segmentsOf(4), { sourceLanguage: 'en', targetLanguage: 'es' }, await stageContext())
    expect(result.map((s) => s.translatedText)).toEqual(['X line 0', 'X line 1', 'X line 2', 'X line 3'])
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[1]!.messages[0]!.content.split('Segments:\n')[1]!)).toEqual([{ idx: 2, text: 'line 2' }])
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
