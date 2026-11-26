import type { Anchor, Piece } from './contracts.js'
import { normalizeWord, wordsOf } from './performance.js'
import type { TimeWindow } from './speech-windows.js'

export const ALIGN = {
  /** The slowest and fastest a stretch of a take may be played: beyond these, speech starts to sound processed. */
  minTempo: 0.8,
  maxTempo: 1.35,
  /** Silence kept before the first sound of a take and after its last. */
  leadMs: 60,
  tailMs: 120,
  /** Space kept between the end of one line and the start of the next. */
  gapMs: 40,
  /** A word said this close to a cut is tied to the picture. */
  cutMs: 150,
}

export interface TimedWord {
  text: string
  startMs: number
  endMs: number
}

/** What was heard in a take, relative to its start. */
export interface TakeTiming {
  durationMs: number
  words: TimedWord[]
  events: TimeWindow[]
}

/** Where a line belongs on the timeline. */
export interface LineTarget {
  startMs: number
  endMs: number
  /** The original's words with their timing. */
  words: TimedWord[]
  anchors: Anchor[]
  cutsMs: number[]
  /** Where the sounds the take re-performs sit in the original, before and after the words. */
  soundBefore?: TimeWindow
  soundAfter?: TimeWindow
  /** The neighbouring lines: the take may not start before `notBeforeMs` and should end by `notAfterMs`. */
  notBeforeMs: number
  notAfterMs: number
}

/** A moment of the take tied to a moment of the original. `pin` and `firm` ones are tied to the picture. */
export interface Knot {
  takeMs: number
  outMs: number
  weight: 'pin' | 'firm' | 'soft'
  label: string
}

export interface Alignment {
  pieces: Omit<Piece, 'path'>[]
  /** Where each tied moment landed against the original, in ms: + late, − early. */
  errors: { label: string; weight: Knot['weight']; errorMs: number }[]
  /** How long the take's words last against the original's: 1 is the same. */
  lengthRatio: number
  /** How far the line runs into the next one, in ms. */
  overflowMs: number
  /** The audible span on the timeline. */
  outStartMs: number
  outEndMs: number
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

function firstAfter(words: readonly TimedWord[], from: number, word: string | undefined): number {
  if (!word) return -1
  for (let i = from; i < words.length; i++) if (normalizeWord(words[i]!.text) === word) return i
  return -1
}

/** The moments of a take that must land on moments of the original, in order. */
export function knotsFor(take: TakeTiming, target: LineTarget, opts = ALIGN): Knot[] {
  const said = take.words
  const original = target.words
  if (said.length === 0) return []
  const atCut = (ms: number) => target.cutsMs.some((cut) => Math.abs(cut - ms) <= opts.cutMs)
  const firstOriginal = original[0]?.startMs ?? target.startMs
  const knots: Knot[] = [{ takeMs: said[0]!.startMs, outMs: firstOriginal, weight: 'pin', label: said[0]!.text }]
  const soundBefore = target.soundBefore && take.events.find((e) => e.endMs <= said[0]!.startMs + 50)
  if (target.soundBefore && soundBefore) {
    knots.unshift({ takeMs: soundBefore.startMs, outMs: target.soundBefore.startMs, weight: 'soft', label: 'sound before' })
  }
  let fromSaid = 1
  let fromOriginal = 1
  for (const anchor of target.anchors) {
    const i = firstAfter(said, fromSaid, wordsOf(anchor.target)[0])
    const j = firstAfter(original, fromOriginal, wordsOf(anchor.source)[0])
    if (i < 0 || j < 0) continue
    knots.push({ takeMs: said[i]!.startMs, outMs: original[j]!.startMs, weight: atCut(original[j]!.startMs) ? 'pin' : 'firm', label: said[i]!.text })
    fromSaid = i + 1
    fromOriginal = j + 1
  }
  knots.push({ takeMs: said.at(-1)!.endMs, outMs: original.at(-1)?.endMs ?? target.endMs, weight: 'soft', label: 'end' })
  const soundAfter = target.soundAfter && [...take.events].reverse().find((e) => e.startMs >= said.at(-1)!.endMs - 50)
  if (target.soundAfter && soundAfter) {
    knots.push({ takeMs: soundAfter.endMs, outMs: target.soundAfter.endMs, weight: 'soft', label: 'sound after' })
  }
  // Keep the order on both sides: a knot that would run backwards is dropped.
  const ordered: Knot[] = []
  for (const knot of knots) {
    const last = ordered.at(-1)
    if (!last || (knot.takeMs > last.takeMs + 30 && knot.outMs > last.outMs + 30)) ordered.push(knot)
  }
  return ordered
}

/**
 * Lays a take on the timeline so that its words land where the original's did: the first word on the original's
 * first word, anchored words on theirs, the end near the original's end. Between those moments each stretch is sped
 * up or slowed down, within limits; what the limits leave over shows in `errors` and `overflowMs`. Leading silence
 * is dropped, and the take never starts before the previous line ends.
 */
export function alignTake(take: TakeTiming, target: LineTarget, opts = ALIGN): Alignment {
  const knots = knotsFor(take, target, opts)
  const said = take.words
  if (knots.length === 0 || said.length === 0) {
    // Nothing to tie: the take starts where the line does.
    const start = Math.max(target.startMs, target.notBeforeMs)
    return {
      pieces: [{ fromMs: 0, toMs: take.durationMs, outStartMs: start, tempo: 1 }],
      errors: [],
      lengthRatio: take.durationMs / Math.max(1, target.endMs - target.startMs),
      overflowMs: Math.max(0, start + take.durationMs - target.notAfterMs),
      outStartMs: start,
      outEndMs: start + take.durationMs,
    }
  }
  const pieces: Omit<Piece, 'path'>[] = []
  const errors: Alignment['errors'] = []

  // A sound before the words cannot land before the previous line ends: then the first word is what counts, and the
  // sound is squeezed, or its start cut, into the room that is left.
  while (knots.length > 1 && knots[0]!.weight === 'soft' && knots[0]!.outMs < target.notBeforeMs) knots.shift()
  const first = knots[0]!
  const soundStart = target.soundBefore ? take.events.find((e) => e.endMs <= said[0]!.startMs + 50)?.startMs : undefined
  const material = first.label === 'sound before' ? first.takeMs : (soundStart ?? first.takeMs)
  let headFrom = Math.max(0, material - opts.leadMs)
  const room = Math.max(0, first.outMs - target.notBeforeMs)
  const headTempo = clamp((first.takeMs - headFrom) / Math.max(1, room), 1, opts.maxTempo)
  if ((first.takeMs - headFrom) / headTempo > room) headFrom = first.takeMs - room * headTempo
  const headStart = first.outMs - (first.takeMs - headFrom) / headTempo
  if (first.takeMs - headFrom > 1) {
    pieces.push({ fromMs: Math.round(headFrom), toMs: first.takeMs, outStartMs: Math.round(headStart), tempo: round3(headTempo) })
  }

  // Between knots: each stretch aims for the next knot, as near as the tempo limits allow.
  let out = first.outMs
  for (let i = 1; i < knots.length; i++) {
    const from = knots[i - 1]!
    const to = knots[i]!
    const length = to.takeMs - from.takeMs
    const tempo = clamp(length / Math.max(1, to.outMs - out), opts.minTempo, opts.maxTempo)
    pieces.push({ fromMs: from.takeMs, toMs: to.takeMs, outStartMs: Math.round(out), tempo: round3(tempo) })
    out += length / tempo
    errors.push({ label: to.label, weight: to.weight, errorMs: Math.round(out - to.outMs) })
  }

  // The tail: what is left after the last knot, squeezed if it would run into the next line.
  const last = knots.at(-1)!
  const tailTo = Math.min(take.durationMs, last.takeMs + opts.tailMs)
  const tailLength = Math.max(0, tailTo - last.takeMs)
  let tailTempo = pieces.at(-1)?.tempo ?? 1
  if (out + tailLength / tailTempo > target.notAfterMs && tailLength > 0) {
    tailTempo = clamp(tailLength / Math.max(1, target.notAfterMs - out), tailTempo, opts.maxTempo)
  }
  if (tailLength > 1) {
    pieces.push({ fromMs: last.takeMs, toMs: Math.round(tailTo), outStartMs: Math.round(out), tempo: round3(tailTempo) })
    out += tailLength / tailTempo
  }

  const takeSpeech = said.at(-1)!.endMs - said[0]!.startMs
  const originalSpeech = (target.words.at(-1)?.endMs ?? target.endMs) - (target.words[0]?.startMs ?? target.startMs)
  return {
    pieces,
    errors,
    lengthRatio: round3(takeSpeech / Math.max(1, originalSpeech)),
    overflowMs: Math.max(0, Math.round(out - target.notAfterMs)),
    outStartMs: Math.round(pieces[0]!.outStartMs),
    outEndMs: Math.round(out),
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
