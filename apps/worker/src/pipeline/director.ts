import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { VoiceMode } from '@vozia/shared'
import { ALIGN, alignTake, type Alignment, type LineTarget, type TakeTiming } from './alignment.js'
import type {
  Delivery,
  LineNotes,
  MediaProcessor,
  Piece,
  SpeechSynthesizer,
  StageContext,
  TranslatedSegment,
  TranslateOptions,
  Transcriber,
  Translator,
  VoiceAnalysis,
  VoiceMeasure,
  VoiceSession,
} from './contracts.js'
import { reviewTake, type TakeReview } from './critique.js'
import { performedTiming, relativeDelivery, type AttachedSound } from './performance.js'
import type { TimeWindow } from './speech-windows.js'
import { planTimeline } from './timeline.js'
import { pickSampleSpans } from './voice-sample.js'

export interface DirectorDeps {
  synthesizer: SpeechSynthesizer
  transcriber: Transcriber
  translator: Translator
  media: MediaProcessor
}

export interface DirectorInput {
  segments: TranslatedSegment[]
  notes: ReadonlyMap<number, LineNotes>
  sounds: ReadonlyMap<number, readonly AttachedSound[]>
  /** The original voice track's analysis: the speaker's usual delivery and each line's. */
  analysis: VoiceAnalysis | null
  cutsMs: number[]
  vocalsPath: string
  voiceMode: VoiceMode
  stockVoiceId: string | null
  totalDurationMs: number
  translateOptions: TranslateOptions
  /** How many rounds of re-takes a line may get; 0 keeps every first take. */
  retakeRounds: number
}

/** One line of the dub, as performed. */
export interface PerformedLine {
  /** The line as finally spoken: revised when a re-take with new words won. */
  segment: TranslatedSegment
  spoken: string
  pieces: Piece[]
  takes: number
  revised: boolean
  review: TakeReview | null
  alignment: Alignment | null
  /** How the original line was said against the speaker's usual, and the take against the new voice's usual. */
  delivery: { original?: Delivery; dub?: Delivery }
  /** Where the sounds the line re-performs play on the timeline. */
  soundSpans: TimeWindow[]
}

export interface Performance {
  dubbedVocalsPath: string
  lines: PerformedLine[]
  /** The new voice's usual pitch against the speaker's, in semitones; null when unknown. */
  pitchOffsetSt: number | null
  /** False when the takes could not be measured: then lines start where the originals did, as before. */
  measured: boolean
}

interface Take {
  segment: TranslatedSegment
  spoken: string
  path: string
  round: number
  /** How free the voice was for this take (see stabilityFor). */
  stability: number
  timing?: TakeTiming
  measure?: VoiceMeasure | null
  alignment?: Alignment
  review?: TakeReview
  delivery?: Delivery
}

/**
 * How free the voice is for a take, from 0 (very expressive) to 1 (steady): steady for a flat, deadpan original,
 * free for a scream or a very animated one. A re-take moves on from the last take: steadier when it over-acted,
 * freer when it fell flat.
 */
export function stabilityFor(original: Delivery | undefined, previous?: { stability: number; direction?: 'calmer' | 'livelier' }): number {
  const settle = (value: number) => Math.round(Math.min(0.9, Math.max(0.2, value)) * 100) / 100
  if (previous) return settle(previous.stability + (previous.direction === 'calmer' ? 0.2 : previous.direction === 'livelier' ? -0.2 : 0))
  const range = original?.pitchRangeSt
  if (range !== undefined && range < 4) return 0.75
  if ((range !== undefined && range >= 12) || (original?.peakSt ?? 0) >= 14) return 0.35
  return 0.5
}

/**
 * How much higher (+) or lower the new voice speaks than the speaker, in semitones: the median difference line by
 * line, over the lines the speaker said calmly when there are a few, because on those a difference is the voice and
 * not the acting (a screamed line comes out high in any voice).
 */
export function cloneOffset(lines: readonly { original?: VoiceMeasure | null; dub?: VoiceMeasure | null; delivery?: Delivery }[]): number | null {
  const differences = (pool: typeof lines) =>
    pool
      .map((line) => (line.original?.pitchSt != null && line.dub?.pitchSt != null ? line.dub.pitchSt - line.original.pitchSt : null))
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b)
  const calm = differences(lines.filter((line) => Math.abs(line.delivery?.pitchSt ?? 99) < 2.5 && (line.delivery?.pitchRangeSt ?? 99) < 9))
  const pool = calm.length >= 2 ? calm : differences(lines)
  if (pool.length === 0) return null
  const middle = pool.length >> 1
  const median = pool.length % 2 ? pool[middle]! : (pool[middle - 1]! + pool[middle]!) / 2
  return Math.round(median * 10) / 10
}

/** Silence between takes when they are joined for measuring: enough to keep their words apart. */
const JOIN_GAP_MS = 600

const overlaps = (a: TimeWindow, b: TimeWindow) => a.startMs < b.endMs && b.startMs < a.endMs

/** Where a moment of a take plays on the timeline. */
export function toTimeline(pieces: readonly Omit<Piece, 'path'>[], takeMs: number): number | null {
  const piece = pieces.find((p) => takeMs >= p.fromMs && takeMs <= p.toMs)
  return piece ? Math.round(piece.outStartMs + (takeMs - piece.fromMs) / piece.tempo) : null
}

/**
 * Performs every line like a dubbing director: clones the voice from the speaker's calm speech, records a take of
 * each line with its neighbours as context, measures every take (its words, sounds and melody), sends the ones that
 * do not fit their time or do not sound like the original back to the translator with what went wrong, records
 * those again and keeps the better take, then lays each take on the timeline word by word.
 */
export async function directPerformance(deps: DirectorDeps, input: DirectorInput, ctx: StageContext): Promise<Performance> {
  const { synthesizer, media } = deps
  const performs = synthesizer.performsDirections === true
  const spokenOf = (segment: TranslatedSegment) => (performs && segment.performanceText) || segment.translatedText
  const lines = input.segments.filter((s) => s.translatedText.trim() !== '')
  const clipsDir = path.join(ctx.workdir, 'clips')
  await mkdir(clipsDir, { recursive: true })

  let samplePath: string | null = null
  if (input.voiceMode === 'clone') {
    const spans = pickSampleSpans(input.segments, input.analysis, input.sounds, input.totalDurationMs)
    samplePath =
      spans.length > 0
        ? await media.joinSpans(input.vocalsPath, spans, ctx)
        : await media.clipAudio(input.vocalsPath, { startSec: 0, durationSec: 60 }, ctx)
  }
  const voice = await synthesizer.openVoice(
    { voiceMode: input.voiceMode, stockVoiceId: input.stockVoiceId, samplePath, targetLanguage: input.translateOptions.targetLanguage },
    ctx,
  )
  try {
    const firstStability = (segment: TranslatedSegment) => stabilityFor(input.notes.get(segment.idx)?.delivery)
    const firstTakes = await speak(voice, lines, lines, 1, spokenOf, firstStability, clipsDir, ctx, (done) => ctx.progress((done / lines.length) * 0.6))
    const usual = await measure(deps, firstTakes, input.translateOptions.targetLanguage, ctx)
    if (!usual) return await unmeasured(deps, input, firstTakes, ctx)
    const takes = new Map(firstTakes.map((take) => [take.segment.idx, [take]]))
    const review = (take: Take) => evaluate(take, input, lines, usual.dub)
    firstTakes.forEach(review)
    ctx.progress(0.7)

    for (let round = 2; round <= input.retakeRounds + 1; round++) {
      const flagged = lines.map((line) => best(takes.get(line.idx)!)).filter((take) => take.review && take.review.feedback.length > 0)
      if (flagged.length === 0) break
      ctx.log.info({ round, lines: flagged.map((t) => t.segment.idx) }, 're-taking lines that did not fit or did not sound right')
      const requests = flagged.map((take) => ({ segment: take.segment, notes: input.notes.get(take.segment.idx), feedback: take.review!.feedback }))
      const revised = deps.translator.revise ? await deps.translator.revise(requests, input.translateOptions, ctx) : []
      const byIdx = new Map(revised.map((segment) => [segment.idx, segment]))
      // A line the translator did not rewrite gets another take of the same words, which comes out differently.
      const again = flagged.map((take) => byIdx.get(take.segment.idx) ?? take.segment)
      const previous = new Map(flagged.map((take) => [take.segment.idx, take]))
      const nextStability = (segment: TranslatedSegment) => {
        const last = previous.get(segment.idx)!
        return stabilityFor(input.notes.get(segment.idx)?.delivery, { stability: last.stability, direction: last.review?.direction })
      }
      const retakes = await speak(voice, again, lines, round, spokenOf, nextStability, clipsDir, ctx)
      const measured = await measure(deps, retakes, input.translateOptions.targetLanguage, ctx)
      if (!measured) break
      for (const take of retakes) {
        review(take)
        takes.get(take.segment.idx)!.push(take)
      }
    }
    ctx.progress(0.9)

    // Lay the chosen takes out in order, so that no take starts before the previous one ends.
    const performed: PerformedLine[] = []
    const pitches: Parameters<typeof cloneOffset>[0][number][] = []
    let previousEnd = 0
    for (const [i, line] of lines.entries()) {
      const all = takes.get(line.idx)!
      const chosen = best(all)
      const target = lineTarget(chosen.segment, input, lines, i, previousEnd)
      const alignment = alignTake(chosen.timing!, target)
      previousEnd = alignment.outEndMs
      pitches.push({ original: input.analysis?.lines.get(line.idx), dub: chosen.measure, delivery: input.notes.get(line.idx)?.delivery })
      performed.push({
        segment: chosen.segment,
        spoken: chosen.spoken,
        pieces: alignment.pieces.map((piece) => ({ ...piece, path: chosen.path })),
        takes: all.length,
        revised: chosen.round > 1 && chosen.segment !== line,
        review: chosen.review ?? null,
        alignment,
        delivery: { original: input.notes.get(line.idx)?.delivery, dub: chosen.delivery },
        soundSpans: soundSpans(chosen, alignment),
      })
    }
    const dubbedVocalsPath = await media.assembleTimeline(performed.flatMap((line) => line.pieces), input.totalDurationMs, ctx)
    ctx.progress(1)
    return { dubbedVocalsPath, lines: performed, pitchOffsetSt: cloneOffset(pitches), measured: true }
  } finally {
    await voice.close(ctx)
  }
}

async function speak(
  voice: VoiceSession,
  segments: readonly TranslatedSegment[],
  all: readonly TranslatedSegment[],
  round: number,
  spokenOf: (segment: TranslatedSegment) => string,
  stabilityOf: (segment: TranslatedSegment) => number,
  dir: string,
  ctx: StageContext,
  progress?: (done: number) => void,
): Promise<Take[]> {
  const takes: Take[] = []
  for (const [n, segment] of segments.entries()) {
    const at = all.findIndex((line) => line.idx === segment.idx)
    const spoken = spokenOf(segment)
    const stability = stabilityOf(segment)
    const file = path.join(dir, `${segment.idx}-${round}.mp3`)
    await voice.speak(
      {
        text: spoken,
        previousText: all[at - 1]?.translatedText,
        nextText: all[at + 1]?.translatedText,
        stability,
        ...(round > 1 ? { seed: round * 7919 + segment.idx } : {}),
      },
      file,
      ctx,
    )
    takes.push({ segment, spoken, path: file, round, stability })
    progress?.(n + 1)
  }
  return takes
}

/**
 * Hears a set of takes in one pass: their words and sounds, and how each was said. Returns the new voice's usual
 * delivery, or null when the takes cannot be measured (no word timings), which is a help, never a requirement.
 */
async function measure(
  deps: DirectorDeps,
  takes: Take[],
  language: string,
  ctx: StageContext,
): Promise<{ dub: VoiceAnalysis['usual'] } | null> {
  if (!deps.transcriber.words || takes.length === 0) return null
  try {
    const joined = await deps.media.joinClips(takes.map((t) => t.path), JOIN_GAP_MS, ctx)
    const heard = await deps.transcriber.words(joined.path, { languageHint: language }, ctx)
    const wordsIn = (span: TimeWindow) => heard.words.filter((w) => w.startMs >= span.startMs - 20 && w.startMs < span.endMs)
    const analysis = await deps.media.analyzeVoice(
      joined.path,
      {
        lines: joined.spans.map((span, k) => {
          const words = wordsIn(span)
          return { idx: k, spans: words.length > 0 ? words.map((w) => ({ startMs: w.startMs, endMs: w.endMs })) : [span] }
        }),
      },
      ctx,
    )
    takes.forEach((take, k) => {
      const span = joined.spans[k]!
      const rel = (w: TimeWindow) => ({ startMs: w.startMs - span.startMs, endMs: Math.min(w.endMs, span.endMs) - span.startMs })
      take.timing = {
        durationMs: span.endMs - span.startMs,
        words: wordsIn(span).map((w) => ({ text: w.text, ...rel(w) })),
        events: heard.events.filter((e) => overlaps(e, span)).map(rel),
      }
      take.measure = analysis?.lines.get(k) ?? null
    })
    if (takes.every((take) => take.timing!.words.length === 0)) return null
    return { dub: analysis?.usual ?? { loudnessDb: null, pitchSt: null } }
  } catch (error) {
    if (ctx.signal.aborted) throw error
    ctx.log.warn({ error }, 'takes not measured: lines start where the originals did')
    return null
  }
}

function performedSounds(segment: TranslatedSegment, input: DirectorInput): AttachedSound[] {
  return (input.sounds.get(segment.idx) ?? []).filter((sound) => segment.performedSounds?.includes(sound.id))
}

/** Where a line belongs, between its neighbours as they were in the original. */
function lineTarget(
  segment: TranslatedSegment,
  input: DirectorInput,
  lines: readonly TranslatedSegment[],
  i: number,
  previousEnd = 0,
): LineTarget {
  const sounds = performedSounds(segment, input)
  const before = sounds.filter((s) => s.position === 'before')[0]
  const after = sounds.filter((s) => s.position === 'after').at(-1)
  const previous = lines[i - 1]
  const next = lines[i + 1]
  const nextSounds = next ? performedSounds(next, input).filter((s) => s.position === 'before') : []
  const nextStart = next ? Math.min(next.words?.[0]?.startMs ?? next.startMs, ...nextSounds.map((s) => s.startMs)) : input.totalDurationMs
  const previousOriginalEnd = previous ? (previous.words?.at(-1)?.endMs ?? previous.endMs) : 0
  return {
    startMs: segment.startMs,
    endMs: segment.endMs,
    words: (segment.words ?? []).map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })),
    anchors: segment.anchors ?? [],
    cutsMs: input.cutsMs.filter((cut) => cut >= segment.startMs - 200 && cut <= segment.endMs + 200),
    ...(before ? { soundBefore: { startMs: before.startMs, endMs: before.endMs } } : {}),
    ...(after ? { soundAfter: { startMs: after.startMs, endMs: after.endMs } } : {}),
    notBeforeMs: Math.max(previousEnd, previousOriginalEnd) + (i > 0 ? ALIGN.gapMs : 0),
    notAfterMs: Math.max(segment.endMs, nextStart - ALIGN.gapMs),
  }
}

function evaluate(take: Take, input: DirectorInput, lines: readonly TranslatedSegment[], dubUsual: VoiceAnalysis['usual']): void {
  if (!take.timing) return
  const i = lines.findIndex((line) => line.idx === take.segment.idx)
  take.alignment = alignTake(take.timing, lineTarget(take.segment, input, lines, i))
  take.delivery = take.measure ? relativeDelivery(take.measure, dubUsual) : undefined
  const words = take.timing.words
  const sounds = performedSounds(take.segment, input).map((sound) => {
    const heard = take.timing!.events.filter((e) =>
      sound.position === 'before'
        ? e.endMs <= (words[0]?.startMs ?? 0) + 50
        : sound.position === 'after'
          ? e.startMs >= (words.at(-1)?.endMs ?? 0) - 50
          : true,
    )
    const seconds = heard.reduce((sum, e) => sum + (e.endMs - e.startMs), 0) / 1000
    return { label: sound.label, originalSec: sound.seconds, takeSec: heard.length > 0 ? seconds : null }
  })
  take.review = reviewTake({ original: input.notes.get(take.segment.idx)?.delivery, take: take.delivery, alignment: take.alignment, sounds })
}

function best(takes: readonly Take[]): Take {
  return takes.reduce((a, b) => ((b.review?.score ?? Infinity) < (a.review?.score ?? Infinity) ? b : a))
}

function soundSpans(take: Take, alignment: Alignment): TimeWindow[] {
  const spans: TimeWindow[] = []
  for (const event of take.timing?.events ?? []) {
    const start = toTimeline(alignment.pieces, event.startMs)
    const end = toTimeline(alignment.pieces, event.endMs)
    if (start !== null && end !== null && end > start) spans.push({ startMs: start, endMs: end })
  }
  return spans
}

/** Without word timings: each take starts where its line did, widened over the sounds it performs, as before. */
async function unmeasured(deps: DirectorDeps, input: DirectorInput, takes: Take[], ctx: StageContext): Promise<Performance> {
  const segments = deps.synthesizer.performsDirections ? performedTiming(input.segments, input.sounds) : input.segments
  const spoken = segments.filter((s) => takes.some((t) => t.segment.idx === s.idx))
  const durations = await Promise.all(takes.map(async (take) => Math.round((await deps.media.probeDurationSeconds(take.path, ctx)) * 1000)))
  const placements = new Map(planTimeline(spoken, durations, input.totalDurationMs).map((p) => [p.idx, p]))
  const lines: PerformedLine[] = takes.map((take, k) => {
    const placement = placements.get(take.segment.idx)!
    return {
      segment: take.segment,
      spoken: take.spoken,
      pieces: [{ path: take.path, fromMs: 0, toMs: durations[k]!, outStartMs: placement.startMs, tempo: placement.tempo }],
      takes: 1,
      revised: false,
      review: null,
      alignment: null,
      delivery: { original: input.notes.get(take.segment.idx)?.delivery },
      soundSpans: [],
    }
  })
  const dubbedVocalsPath = await deps.media.assembleTimeline(lines.flatMap((line) => line.pieces), input.totalDurationMs, ctx)
  ctx.progress(1)
  return { dubbedVocalsPath, lines, pitchOffsetSt: null, measured: false }
}
