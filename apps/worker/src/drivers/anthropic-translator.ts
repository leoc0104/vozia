import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { languageLabel } from '@vozia/shared'
import type { StageContext, TranscriptSegment, TranslatedSegment, Translator } from '../pipeline/contracts.js'
import { PipelineError, ProviderError } from '../pipeline/errors.js'

export const TranslationSchema = z.object({
  translations: z.array(z.object({ idx: z.number().int(), text: z.string() })),
})
export type TranslationOutput = z.infer<typeof TranslationSchema>

export interface TranslationParseParams {
  model: string
  max_tokens: number
  system: { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }[]
  messages: { role: 'user'; content: string }[]
  output_config: { format: ReturnType<typeof zodOutputFormat<typeof TranslationSchema>> }
}

/** The slice of the SDK the translator needs; tests substitute it. */
export interface TranslationClient {
  parse(params: TranslationParseParams): Promise<{ parsed_output: TranslationOutput | null; stop_reason: string | null }>
}

export const SYSTEM_PROMPT = `You translate video transcripts for AI dubbing.

You receive numbered segments of spoken dialogue in a source language. Return every segment translated into the target language so that it can be spoken over the original timing:
- Keep the meaning, tone and register; write natural spoken language, not literal word-for-word text.
- Aim for a similar spoken duration as the original (roughly the same syllable count); shorten wordy phrasing when needed.
- Keep names, brands, numbers and untranslatable terms as they are.
- Never add notes, explanations or extra segments; never merge or split segments.
- Return one translation for every idx you were given, in the same order.`

export interface AnthropicTranslatorOptions {
  apiKey?: string
  model: string
  batchSize?: number
  client?: TranslationClient
}

function createSdkClient(apiKey?: string): TranslationClient {
  const sdk = new Anthropic(apiKey ? { apiKey } : {})
  return {
    async parse(params) {
      const response = await sdk.messages.parse(params)
      return { parsed_output: response.parsed_output, stop_reason: response.stop_reason }
    },
  }
}

function mapSdkError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError('anthropic', 'Anthropic rejected the API key.', { status: error.status, cause: error })
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('anthropic', 'Anthropic rate limit reached; try again later.', { status: error.status, cause: error })
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError('anthropic', `Translation failed (Anthropic HTTP ${error.status ?? 'error'}).`, { status: error.status ?? null, cause: error })
  }
  return error
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export class AnthropicTranslator implements Translator {
  private readonly client: TranslationClient
  private readonly batchSize: number

  constructor(private readonly opts: AnthropicTranslatorOptions) {
    this.client = opts.client ?? createSdkClient(opts.apiKey)
    this.batchSize = opts.batchSize ?? 40
  }

  async translate(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string },
    ctx: StageContext,
  ): Promise<TranslatedSegment[]> {
    const results = new Map<number, string>()
    let done = 0
    for (const batch of chunk(segments, this.batchSize)) {
      await this.translateBatch(batch, opts, results, ctx)
      const missing = batch.filter((s) => !results.has(s.idx))
      if (missing.length > 0) await this.translateBatch(missing, opts, results, ctx)
      const stillMissing = batch.filter((s) => !results.has(s.idx))
      if (stillMissing.length > 0) {
        throw new PipelineError(`The translation model skipped ${stillMissing.length} segment(s).`, { stage: 'translating' })
      }
      done += batch.length
      ctx.progress(done / segments.length)
    }
    return segments.map((s) => ({ ...s, translatedText: results.get(s.idx)! }))
  }

  private async translateBatch(
    batch: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string },
    results: Map<number, string>,
    ctx: StageContext,
  ): Promise<void> {
    const userPrompt = [
      `Source language: ${languageLabel(opts.sourceLanguage)} (${opts.sourceLanguage})`,
      `Target language: ${languageLabel(opts.targetLanguage)} (${opts.targetLanguage})`,
      '',
      'Segments:',
      JSON.stringify(batch.map((s) => ({ idx: s.idx, text: s.text }))),
    ].join('\n')

    let response: Awaited<ReturnType<TranslationClient['parse']>>
    try {
      response = await this.client.parse({
        model: this.opts.model,
        max_tokens: 16000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
        output_config: { format: zodOutputFormat(TranslationSchema) },
      })
    } catch (error) {
      if (ctx.signal.aborted) throw error
      throw mapSdkError(error)
    }
    if (response.stop_reason === 'refusal') {
      throw new PipelineError('The translation model declined this content.', { stage: 'translating' })
    }
    if (!response.parsed_output) {
      throw new PipelineError('The translation model returned an unreadable answer.', { stage: 'translating' })
    }
    const wanted = new Set(batch.map((s) => s.idx))
    for (const item of response.parsed_output.translations) {
      if (wanted.has(item.idx) && item.text.trim() !== '') results.set(item.idx, item.text.trim())
    }
  }
}
