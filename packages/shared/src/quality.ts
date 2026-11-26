/**
 * How close a dub came to the original, measured by the worker and shown on the dub page. Stored as JSON
 * (dubs.quality and dub_segments.performance), so readers check the shape before trusting it.
 */

/** A word lands "on the picture" when it is this close to the moment the original said its word. */
export const IN_SYNC_MS = 150

/** How one line was performed. */
export interface LinePerformance {
  /** What the new voice was asked to say, with its directions, like "[panicked] Help me! [screams]". */
  spoken: string
  /** How many takes were recorded. */
  takes: number
  /** True when a re-take with new words won. */
  revised: boolean
  /** The largest miss of a word tied to the picture, in ms (+ late, − early); null when not measured. */
  worstWordMs: number | null
  /** How long the dub's words last against the original's: 1 is the same. */
  length: number | null
  /** How far the line runs into the next one, in ms. */
  overflowMs: number
  /** What still differs from the original after the last take, in plain words. */
  notes: string[]
  /** The speaker's own sounds the line re-performs, as the transcriber named them. */
  sounds: string[]
}

/** How the whole dub came out. */
export interface DubQuality {
  version: 1
  /** False when takes could not be measured: the lines then start where the originals did, unchecked. */
  measured: boolean
  lines: number
  /** Lines whose words tied to the picture all land within IN_SYNC_MS. */
  inSync: number
  worstWordMs: number | null
  /** Lines that got a re-take, and how many of those kept new words. */
  retaken: number
  revised: number
  /** The new voice's usual pitch against the speaker's, in semitones, and the correction applied. */
  pitchOffsetSt: number | null
  pitchCorrectedSt: number
  /** Whether the voice was matched to the original recording's tone, its frequency range, and its room. */
  voiceMatched: boolean
  bandwidthHz: number | null
  room: boolean
  /** Captions in the picture that were translated. */
  captions: number
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** The quality report stored with a dub, or null when there is none or it has another shape. */
export function readDubQuality(value: unknown): DubQuality | null {
  if (!isObject(value) || value.version !== 1 || typeof value.lines !== 'number' || typeof value.inSync !== 'number') return null
  return {
    version: 1,
    measured: value.measured === true,
    lines: value.lines,
    inSync: value.inSync,
    worstWordMs: numberOrNull(value.worstWordMs),
    retaken: numberOrNull(value.retaken) ?? 0,
    revised: numberOrNull(value.revised) ?? 0,
    pitchOffsetSt: numberOrNull(value.pitchOffsetSt),
    pitchCorrectedSt: numberOrNull(value.pitchCorrectedSt) ?? 0,
    voiceMatched: value.voiceMatched === true,
    bandwidthHz: numberOrNull(value.bandwidthHz),
    room: value.room === true,
    captions: numberOrNull(value.captions) ?? 0,
  }
}

/** How a line was performed, or null when there is no record or it has another shape. */
export function readLinePerformance(value: unknown): LinePerformance | null {
  if (!isObject(value) || typeof value.spoken !== 'string' || typeof value.takes !== 'number') return null
  const strings = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [])
  return {
    spoken: value.spoken,
    takes: value.takes,
    revised: value.revised === true,
    worstWordMs: numberOrNull(value.worstWordMs),
    length: numberOrNull(value.length),
    overflowMs: numberOrNull(value.overflowMs) ?? 0,
    notes: strings(value.notes),
    sounds: strings(value.sounds),
  }
}
