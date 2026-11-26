import { readFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { languageLabel } from '@vozia/shared'
import type {
  Frame,
  LineNotes,
  RevisionRequest,
  StageContext,
  TranscriptSegment,
  TranslateOptions,
  TranslatedSegment,
  Translator,
  VideoBrief,
} from '../pipeline/contracts.js'
import { PipelineError, ProviderError } from '../pipeline/errors.js'
import { dropEdgeSounds, hasDirections, stripDirections, validAnchors } from '../pipeline/performance.js'
import { captionTimes, framesFor } from '../pipeline/watching.js'

export const TranslationSchema = z.object({
  translations: z.array(
    z.object({
      idx: z.number().int(),
      text: z.string(),
      performance: z.string(),
      performedSounds: z.array(z.number().int()),
      anchors: z.array(z.object({ source: z.string(), target: z.string() })),
    }),
  ),
})
export type TranslationOutput = z.infer<typeof TranslationSchema>

export const WatchSchema = z.object({
  summary: z.string(),
  glossary: z.array(z.object({ term: z.string(), translation: z.string() })),
  lines: z.array(z.object({ idx: z.number().int(), onScreen: z.string() })),
  captions: z.array(z.object({ text: z.string(), translation: z.string(), firstFrame: z.number().int(), lastFrame: z.number().int() })),
})
export type WatchOutput = z.infer<typeof WatchSchema>

type TextBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }
export type ContentBlock = TextBlock | ImageBlock

export interface ParseParams<S extends z.ZodType> {
  model: string
  max_tokens: number
  system: TextBlock[]
  messages: { role: 'user'; content: ContentBlock[] }[]
  output_config: { format: ReturnType<typeof zodOutputFormat<S>> }
}

/** The slice of the SDK the translator needs; tests substitute it. */
export interface TranslationClient {
  parse<S extends z.ZodType>(params: ParseParams<S>): Promise<{ parsed_output: z.infer<S> | null; stop_reason: string | null }>
}

export const SYSTEM_PROMPT = `You translate video transcripts for AI dubbing, and you direct how each line is performed, so that the dub sounds the way the original was said, as funny, scared, angry or calm as the speaker was, and lands in time with the picture.

You receive numbered segments of spoken dialogue in a source language, with what is known about the video. For each segment, return:
- \`text\`: the translation into the target language, as plain words. It becomes the subtitles.
- \`performance\`: the same words marked up for an expressive voice model, which speaks this version in the speaker's own cloned voice.
- \`performedSounds\`: the \`id\` of every listed sound that \`performance\` performs; [] when there are none.
- \`anchors\`: words of your translation tied to the word of the original said at the same moment (see Timing).

Translating:
- Keep the meaning, tone and register; write natural spoken language, not literal word-for-word text. Exclamations, slang and jokes should land the way they do in the original: write what a native speaker would really say in that moment.
- Each segment has \`seconds\`: how long the original words take to say. Write a translation that a person would naturally take about that long to say: not much shorter, and not longer. Rephrase rather than pad; never add meaning.
- Keep names, brands, numbers and untranslatable terms as they are, and follow the glossary when there is one.
- \`onScreen\` says what the viewer sees while the line is said. Keep jokes and wordplay that depend on the picture: if the speaker says they exploded something while an explosion fills the screen, keep an explosion in the translation rather than an idiom that loses the picture.

Timing:
- The dub moves each anchored word of your translation to the moment its original word was said, so words tied to the picture land with it. In \`anchors\`, give 2 to 5 pairs per line, each a single word: \`source\` exactly as written in the original segment, \`target\` exactly as written in your \`text\`. Always anchor the first word, exclamations, names, the words for anything that happens on screen (a touch, a hit, something appearing) and any word said right at a cut.
- \`start\` is when the line starts in the video, in seconds; \`cuts\` lists the seconds from the start of the line where the picture cuts to a new shot. Keep the words said at a cut, and the words tied to what is on screen, in the same part of the line as in the original, so they can land at the same moment.

Directing:
- Keep the words of \`text\` in the same order, and add directions in square brackets right before the words they affect. Write directions in English whatever the target language: the voice model reads them as instructions, never aloud. They can name an emotion or attitude, like [excited], [panicked], [amused], [sarcastic], [annoyed], [scared], [sad] or [curious]; a way of speaking, like [shouting], [screaming], [whispering], [quietly], [rushed], [slowly], [flat] or [deadpan]; or a sound from the speaker's voice, like [laughs], [chuckles], [giggles], [sighs], [gasps], [screams], [groans], [sobbing] or [clears throat]. They can be combined, like [whispering, scared].
- A direction holds until the next one, so add another only where the delivery changes. One or two per line are usually enough; an ordinary line may need none.
- Punctuation shapes the delivery too: an ellipsis (...) for hesitation, a dash for a word cut off, an exclamation mark for force, one word in CAPITALS for emphasis, and [pause] or [short pause] for a beat, such as before a punchline.
- \`melody\` describes in words how the original line was said; \`delivery\` gives the measurements behind it, against this speaker's usual delivery:
  - \`loudnessDb\`: dB louder (+) or softer (-) than usual. Within ±3 is ordinary; +6 or more is shouting; -6 or less is quiet or whispered.
  - \`pitchSt\`: semitones higher (+) or lower (-) than usual. +4 or more is a raised voice: excitement, panic, surprise, delight. -3 or less is a lowered one: calm, serious, tired, sad.
  - \`pitchRangeSt\`: how much the pitch moves within the line, in semitones. Under 4 is flat: deadpan, bored, matter-of-fact. 8 to 12 is lively; over 12 is very animated.
  - \`peakSt\`: the highest pitch of the line against the usual: +14 or more is a scream or a shouted word.
  - \`endingSt\`: how the line ends: +3 or more rises (a question, alarm, excitement); -3 or less falls (a statement, resignation).
  - \`pace\`: speed against usual. 1.3 is 30% faster: rushed, excited, panicked. 0.75 is slower: hesitant, deliberate, sad.
  Match the intensity, no more and no less. A line that peaks in a scream needs [screaming] or [shouting], not just [scared]. A flat, almost monotone line must stay flat: use [flat] or [deadpan] or no direction at all, no CAPITALS and nothing theatrical; in comedy the deadpan line is often the joke. Noise or music can throw the numbers off; when they clearly contradict the words, follow the words.
- \`sounds\`, when present, lists sounds heard from this speaker during or right next to the line. \`label\` is the transcriber's name for the sound, in the language of the video (risos, riso, risas, rires and Lachen all mean laughter); \`position\` says whether it came before, within or after the words; \`atSec\` is when it started, in seconds from the start of the words; \`seconds\` is how long it lasted. Sounds labeled "voice without words" were found by measuring the voice track rather than by a transcriber: \`untagged\` says how loud (dB) and how high (semitones) they were against the usual line. Decide what they are from that, the words and what is on screen: a loud, very high one is likely a scream; one while the screen shows crying is likely sobbing.
- Perform every listed sound of the human voice, such as laughter, a scream, a sigh, a gasp, a cough or crying, with a direction at the same spot: at the start for before, at the end for after, at the matching word for within. The dub replaces the original voice there, so the new voice laughs instead of the original. Match the length: a short laugh is [chuckles] or [laughs]; a long one is [laughs harder] or [starts laughing]. Leave out anything that is not a human voice, like music, applause or a door, and anything you cannot tell: the original keeps those.
- Never start a performance with a sound such as a gasp, a laugh or a breath unless a listed sound comes before the words: a sound before the first word makes the line land late against the picture. Never end with one unless a listed sound comes after the words. Within the words, a voice sound that fits the delivery is welcome even when it is not listed.
- Never direct sound effects or music: the original background is kept.

Always:
- Never add notes, explanations or extra segments; never merge or split segments.
- Return one result for every idx you were given, in the same order.`

export const WATCH_PROMPT = `You watch a video before it is dubbed into another language, so that the translator knows what the viewer sees.

You get the whole transcript (numbered lines with their start and end in seconds) and frames of the video, each labeled with its number and time. Return:
- \`summary\`: two to four sentences: what kind of video this is, who speaks and to whom, the tone, and any running joke or twist the dub must keep.
- \`glossary\`: names, slang, jargon and recurring phrases the translation must handle consistently, each with the translation to use. Keep names, and game or brand terms, as they are when that is what viewers in the target language say.
- \`lines\`: for each line you are asked about, one short sentence on what is on screen while it is said, especially anything the words refer to or play on: something appearing, an action, a reaction, an explosion, text in the picture. Say "nothing specific" when the picture has nothing to do with the words.
- \`captions\`: text written in the picture that a viewer of the target language could not understand: not names, not text already in that language, not words that read the same in it. Give the text, its translation into the target language, and the first and last frame numbers where it is visible.

Describe only what the frames show; do not guess what happens between them.`

const REVISE_PREAMBLE = `These segments were translated and performed before, but the takes did not work. \`current\` is what was performed and \`feedback\` says what went wrong, measured from the take. Return a new translation and performance for every idx that fixes the feedback: shorten or lengthen the words when the timing is off, and change the directions when the delivery is off. Keep whatever worked.`

export interface AnthropicTranslatorOptions {
  apiKey?: string
  model: string
  batchSize?: number
  client?: TranslationClient
}

function createSdkClient(apiKey?: string): TranslationClient {
  const sdk = new Anthropic(apiKey ? { apiKey } : {})
  return {
    async parse<S extends z.ZodType>(params: ParseParams<S>) {
      const response = await sdk.messages.parse(params)
      return { parsed_output: response.parsed_output as z.infer<S> | null, stop_reason: response.stop_reason }
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

const sec = (ms: number) => Math.round(ms / 100) / 10
const text = (value: string): TextBlock => ({ type: 'text', text: value })

async function image(frame: Frame): Promise<ImageBlock> {
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: (await readFile(frame.path)).toString('base64') } }
}

type Item = TranslationOutput['translations'][number]

export class AnthropicTranslator implements Translator {
  private readonly client: TranslationClient
  private readonly batchSize: number

  constructor(private readonly opts: AnthropicTranslatorOptions) {
    this.client = opts.client ?? createSdkClient(opts.apiKey)
    this.batchSize = opts.batchSize ?? 40
  }

  private async call<S extends z.ZodType>(schema: S, system: string, content: ContentBlock[], ctx: StageContext, maxTokens = 16000) {
    let response: { parsed_output: z.infer<S> | null; stop_reason: string | null }
    try {
      response = await this.client.parse({
        model: this.opts.model,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
        output_config: { format: zodOutputFormat(schema) },
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
    return response.parsed_output
  }

  private languages(opts: { sourceLanguage: string; targetLanguage: string }): string {
    return [
      `Source language: ${languageLabel(opts.sourceLanguage)} (${opts.sourceLanguage})`,
      `Target language: ${languageLabel(opts.targetLanguage)} (${opts.targetLanguage})`,
    ].join('\n')
  }

  /**
   * Watching is a help, never a requirement: when a request fails for any reason but an abort, the translation goes
   * on without what that part of the video shows.
   */
  async watch(
    segments: TranscriptSegment[],
    opts: { sourceLanguage: string; targetLanguage: string; frames: Frame[]; cutsMs: number[]; durationMs: number },
    ctx: StageContext,
  ): Promise<VideoBrief | null> {
    if (opts.frames.length === 0 || segments.length === 0) return null
    const groups = chunk(segments, this.batchSize)
    const framesByGroup = framesFor(groups, opts.frames)
    const transcript = JSON.stringify(segments.map((s) => ({ idx: s.idx, start: sec(s.startMs), end: sec(s.endMs), text: s.text })))
    const cuts = opts.cutsMs.length > 0 ? opts.cutsMs.map((cut) => `${sec(cut)} s`).join(', ') : 'nowhere'
    const brief: VideoBrief = { summary: '', glossary: [], onScreen: new Map(), captions: [] }
    for (const [i, group] of groups.entries()) {
      const frames = framesByGroup[i]!
      if (frames.length === 0) continue
      const content: ContentBlock[] = [
        text(
          `${this.languages(opts)}\nVideo length: ${sec(opts.durationMs)} s. The picture cuts at: ${cuts}.\n\n` +
            `Transcript:\n${transcript}\n\nDescribe lines ${group[0]!.idx} to ${group.at(-1)!.idx}. The frames follow.`,
        ),
      ]
      for (const [n, frame] of frames.entries()) content.push(text(`Frame ${n + 1}, at ${sec(frame.timeMs)} s:`), await image(frame))
      let output: WatchOutput
      try {
        output = await this.call(WatchSchema, WATCH_PROMPT, content, ctx, 8000)
      } catch (error) {
        if (ctx.signal.aborted) throw error
        ctx.log.warn({ error }, 'could not watch part of the video: the translation goes on without it')
        continue
      }
      if (!brief.summary) brief.summary = output.summary.trim()
      for (const entry of output.glossary) {
        if (entry.term.trim() && !brief.glossary.some((g) => g.term === entry.term)) brief.glossary.push(entry)
      }
      const wanted = new Set(group.map((s) => s.idx))
      for (const line of output.lines) if (wanted.has(line.idx) && line.onScreen.trim()) brief.onScreen.set(line.idx, line.onScreen.trim())
      for (const caption of output.captions) {
        const times = captionTimes(caption, frames, opts.cutsMs, opts.durationMs)
        if (times && caption.text.trim() && caption.translation.trim()) {
          brief.captions.push({ ...times, text: caption.text.trim(), translation: caption.translation.trim() })
        }
      }
    }
    return brief.summary || brief.onScreen.size > 0 || brief.captions.length > 0 ? brief : null
  }

  async translate(segments: TranscriptSegment[], opts: TranslateOptions, ctx: StageContext): Promise<TranslatedSegment[]> {
    const results = new Map<number, Item>()
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
    return segments.map((s) => finish(s, results.get(s.idx)!, opts.notes?.get(s.idx)))
  }

  /** Lines the model leaves out keep their earlier translation: the caller only gets the lines it could revise. */
  async revise(requests: RevisionRequest[], opts: TranslateOptions, ctx: StageContext): Promise<TranslatedSegment[]> {
    const revised: TranslatedSegment[] = []
    for (const batch of chunk(requests, this.batchSize)) {
      const lines = batch.map(({ segment, notes, feedback }) => ({
        ...this.payload(segment, notes ?? opts.notes?.get(segment.idx), opts),
        current: { text: segment.translatedText, performance: segment.performanceText ?? segment.translatedText },
        feedback,
      }))
      const output = await this.call(TranslationSchema, SYSTEM_PROMPT, [
        text(`${this.context(opts)}\n\n${REVISE_PREAMBLE}\n\nSegments:\n${JSON.stringify(lines)}`),
      ], ctx)
      const byIdx = new Map(batch.map((request) => [request.segment.idx, request]))
      for (const item of output.translations) {
        const request = byIdx.get(item.idx)
        if (!request || item.text.trim() === '') continue
        revised.push(finish(request.segment, item, request.notes ?? opts.notes?.get(item.idx)))
        byIdx.delete(item.idx)
      }
    }
    return revised
  }

  private context(opts: TranslateOptions): string {
    const lines = [this.languages(opts)]
    if (opts.brief?.summary) lines.push('', `About this video: ${opts.brief.summary}`)
    if (opts.brief?.glossary.length) lines.push(`Glossary: ${opts.brief.glossary.map((g) => `${g.term} → ${g.translation}`).join('; ')}`)
    return lines.join('\n')
  }

  private payload(s: TranscriptSegment, notes: LineNotes | undefined, opts: TranslateOptions) {
    const { delivery, melody, sounds, cuts } = notes ?? {}
    const onScreen = notes?.onScreen ?? opts.brief?.onScreen.get(s.idx)
    return {
      idx: s.idx,
      start: sec(s.startMs),
      text: s.text,
      seconds: sec(s.endMs - s.startMs),
      ...(delivery && Object.keys(delivery).length > 0 ? { delivery } : {}),
      ...(melody ? { melody } : {}),
      ...(sounds && sounds.length > 0 ? { sounds } : {}),
      ...(cuts && cuts.length > 0 ? { cuts } : {}),
      ...(onScreen ? { onScreen } : {}),
    }
  }

  private async translateBatch(
    batch: TranscriptSegment[],
    opts: TranslateOptions,
    results: Map<number, Item>,
    ctx: StageContext,
  ): Promise<void> {
    const segments = batch.map((s) => this.payload(s, opts.notes?.get(s.idx), opts))
    const output = await this.call(TranslationSchema, SYSTEM_PROMPT, [
      text(`${this.context(opts)}\n\nSegments:\n${JSON.stringify(segments)}`),
    ], ctx)
    const wanted = new Set(batch.map((s) => s.idx))
    for (const item of output.translations) {
      if (wanted.has(item.idx) && item.text.trim() !== '') results.set(item.idx, item)
    }
  }
}

/** A model answer made safe to perform: valid sounds and anchors only, and no sound where the original has none. */
function finish(segment: TranscriptSegment, item: Item, notes: LineNotes | undefined): TranslatedSegment {
  const { translatedText: _text, performanceText: _performance, performedSounds: _sounds, anchors: _anchors, ...base } =
    segment as TranslatedSegment
  const translatedText = item.text.trim()
  const anchors = validAnchors(item.anchors, base.text, translatedText)
  const withAnchors = anchors.length > 0 ? { anchors } : {}
  // Only sounds that were listed, and only when the performance directs anything at all, so that a laugh the voice
  // will not perform stays in the original audio.
  const sounds = notes?.sounds ?? []
  const listed = new Set(sounds.map((sound) => sound.id))
  let performed = hasDirections(item.performance) ? [...new Set(item.performedSounds)].filter((id) => listed.has(id)) : []
  const at = (position: string) => performed.some((id) => sounds.find((sound) => sound.id === id)?.position === position)
  const performance = dropEdgeSounds(item.performance.trim(), { before: at('before'), after: at('after') })
  // A performance that lost its words would leave the line unsaid; the plain translation is the safe fallback.
  if (stripDirections(performance) === '') return { ...base, translatedText, ...withAnchors }
  if (!hasDirections(performance)) performed = []
  return {
    ...base,
    translatedText,
    performanceText: performance,
    ...(performed.length > 0 ? { performedSounds: performed } : {}),
    ...withAnchors,
  }
}
