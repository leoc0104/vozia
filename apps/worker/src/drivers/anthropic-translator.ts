import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { languageLabel } from '@vozia/shared'
import type { LineNotes, StageContext, TranscriptSegment, TranslatedSegment, Translator } from '../pipeline/contracts.js'
import { PipelineError, ProviderError } from '../pipeline/errors.js'
import { hasDirections, stripDirections } from '../pipeline/performance.js'

type TranslateOptions = { sourceLanguage: string; targetLanguage: string; notes?: ReadonlyMap<number, LineNotes> }
type Translation = { text: string; performance: string; performedSounds: number[] }

export const TranslationSchema = z.object({
  translations: z.array(
    z.object({ idx: z.number().int(), text: z.string(), performance: z.string(), performedSounds: z.array(z.number().int()) }),
  ),
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

export const SYSTEM_PROMPT = `You translate video transcripts for AI dubbing, and you direct how each line is performed, so that the dub sounds the way the original was said: as funny, scared, angry or calm as the speaker was.

You receive numbered segments of spoken dialogue in a source language. For each one, return:
- \`text\`: the translation into the target language, as plain words. It becomes the subtitles.
- \`performance\`: the same words marked up for an expressive voice model, which speaks this version in the speaker's own cloned voice.
- \`performedSounds\`: the \`id\` of every listed sound that \`performance\` performs; [] when there are none.

Translating:
- Keep the meaning, tone and register; write natural spoken language, not literal word-for-word text. Exclamations, slang and jokes should land the way they do in the original: write what a native speaker would really say in that moment.
- Each segment has \`seconds\`: how long the original words take to say. Write a translation that a person would naturally take about that long to say: not much shorter, and not longer. Rephrase rather than pad; never add meaning.
- Keep names, brands, numbers and untranslatable terms as they are.

Directing:
- Keep the words of \`text\` in the same order, and add directions in square brackets right before the words they affect. Write directions in English whatever the target language: the voice model reads them as instructions, never aloud. They can name an emotion or attitude, like [excited], [panicked], [amused], [sarcastic], [annoyed], [scared], [sad] or [curious]; a way of speaking, like [shouting], [whispering], [quietly], [rushed] or [slowly]; or a sound from the speaker's voice, like [laughs], [chuckles], [giggles], [sighs], [gasps], [screams], [groans], [sobbing] or [clears throat]. They can be combined, like [whispering, scared].
- A direction holds until the next one, so add another only where the delivery changes. One or two per line are usually enough; an ordinary line may need none.
- Punctuation shapes the delivery too: an ellipsis (...) for hesitation, a dash for a word cut off, an exclamation mark for force, one word in CAPITALS for emphasis, and [pause] or [short pause] for a beat, such as before a punchline.
- \`delivery\`, when present, is measured from the original audio against this speaker's usual delivery:
  - \`loudnessDb\`: dB louder (+) or softer (-) than usual. Within ±3 is ordinary; +6 or more is shouting; -6 or less is quiet or whispered.
  - \`pitchSt\`: semitones higher (+) or lower (-) than usual. +4 or more is a raised voice: excitement, panic, surprise, delight. -3 or less is a lowered one: calm, serious, tired, sad.
  - \`pitchRangeSt\`: how much the pitch moves within the line, in semitones. Under 5 is flat: deadpan, bored, matter-of-fact. 8 to 12 is lively; over 12 is very animated.
  - \`pace\`: speed against usual. 1.3 is 30% faster: rushed, excited, panicked. 0.75 is slower: hesitant, deliberate, sad.
  Choose directions that fit both the words and these numbers. Noise or music can throw the numbers off; when they clearly contradict the words, follow the words.
- \`sounds\`, when present, lists sounds heard from this speaker during or right next to the line. \`label\` is the transcriber's name for the sound, in the language of the video (risos, riso, risas, rires and Lachen all mean laughter); \`position\` says whether it came before, within or after the words; \`atSec\` is when it started, in seconds from the start of the words; \`seconds\` is how long it lasted. Perform every sound of the human voice, such as laughter, a scream, a sigh, a gasp, a cough or crying, with a direction at the same spot: at the start for before, at the end for after, at the matching word for within. The dub replaces the original voice there, so the new voice laughs instead of the original. Match the length: a short laugh is [chuckles] or [laughs]; a long one is [laughs harder] or [starts laughing]. Leave out anything that is not a human voice, like music, applause or a door: the original background keeps those.
- Within the words, a voice sound that fits the delivery is welcome even when it is not listed, like [gasps] before a frightened line. Never add one before or after the words that is not listed: the timing there belongs to the original video.
- Never direct sound effects or music: the original background is kept.

Always:
- Never add notes, explanations or extra segments; never merge or split segments.
- Return one result for every idx you were given, in the same order.`

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
    opts: TranslateOptions,
    ctx: StageContext,
  ): Promise<TranslatedSegment[]> {
    const results = new Map<number, Translation>()
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
    return segments.map((s) => {
      const { text, performance, performedSounds } = results.get(s.idx)!
      // A performance that lost its words would leave the line unsaid; the plain translation is the safe fallback.
      if (stripDirections(performance) === '') return { ...s, translatedText: text }
      // Only sounds that were listed, and only when the performance directs anything at all, so that a laugh the
      // voice will not perform stays in the original audio.
      const listed = new Set((opts.notes?.get(s.idx)?.sounds ?? []).map((sound) => sound.id))
      const performed = hasDirections(performance) ? [...new Set(performedSounds)].filter((id) => listed.has(id)) : []
      return { ...s, translatedText: text, performanceText: performance, ...(performed.length > 0 ? { performedSounds: performed } : {}) }
    })
  }

  private async translateBatch(
    batch: TranscriptSegment[],
    opts: TranslateOptions,
    results: Map<number, Translation>,
    ctx: StageContext,
  ): Promise<void> {
    const segments = batch.map((s) => {
      const { delivery, sounds } = opts.notes?.get(s.idx) ?? {}
      return {
        idx: s.idx,
        text: s.text,
        seconds: Math.round((s.endMs - s.startMs) / 100) / 10,
        ...(delivery && Object.keys(delivery).length > 0 ? { delivery } : {}),
        ...(sounds && sounds.length > 0 ? { sounds } : {}),
      }
    })
    const userPrompt = [
      `Source language: ${languageLabel(opts.sourceLanguage)} (${opts.sourceLanguage})`,
      `Target language: ${languageLabel(opts.targetLanguage)} (${opts.targetLanguage})`,
      '',
      'Segments:',
      JSON.stringify(segments),
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
      if (wanted.has(item.idx) && item.text.trim() !== '') {
        results.set(item.idx, { text: item.text.trim(), performance: item.performance.trim(), performedSounds: item.performedSounds })
      }
    }
  }
}
