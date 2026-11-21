import type { Delivery, LineNotes, LineSound, SoundEvent } from './contracts.js'

interface Line {
  idx: number
  startMs: number
  endMs: number
  text: string
  speaker?: string | null
}

/** A sound tied to a line: what the translator sees, and where the sound is on the timeline. */
export interface AttachedSound extends LineSound {
  startMs: number
  endMs: number
}

/** How close a laugh or a sigh must be to a line to count as part of its performance. */
export const ATTACH_GAP_MS = 1000

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Ties each sound to the nearest line by the same speaker when it happens during the line or within `gapMs` of it.
 * Sounds are not sorted by kind here: their labels come in the video's language ("risos", "Lachen", "applause"), so
 * the translator, which reads any language, decides which ones came from the speaker's voice and performs those.
 * Sounds far from every line, or made by someone else, stay in the original audio.
 */
export function attachSounds(lines: readonly Line[], events: readonly SoundEvent[], gapMs = ATTACH_GAP_MS): Map<number, AttachedSound[]> {
  const attached = new Map<number, Omit<AttachedSound, 'id'>[]>(lines.map((l) => [l.idx, []]))
  for (const event of events) {
    let nearest: { line: Line; gap: number } | null = null
    for (const line of lines) {
      if (event.speaker && line.speaker && event.speaker !== line.speaker) continue
      const gap =
        event.endMs <= line.startMs ? line.startMs - event.endMs : event.startMs >= line.endMs ? event.startMs - line.endMs : 0
      if (gap <= gapMs && (!nearest || gap < nearest.gap)) nearest = { line, gap }
    }
    if (!nearest) continue
    const { line } = nearest
    attached.get(line.idx)!.push({
      label: event.label,
      position: event.endMs <= line.startMs ? 'before' : event.startMs >= line.endMs ? 'after' : 'within',
      atSec: round1((event.startMs - line.startMs) / 1000),
      seconds: round1((event.endMs - event.startMs) / 1000),
      startMs: event.startMs,
      endMs: event.endMs,
    })
  }
  return new Map(
    [...attached].map(([idx, sounds]) => [idx, sounds.sort((a, b) => a.startMs - b.startMs).map((sound, id) => ({ id, ...sound }))]),
  )
}

/** Letters and digits only, so the count means the same in any script, with or without spaces between words. */
const spokenChars = (text: string) => text.replace(/[\s\p{P}\p{S}]/gu, '').length

/** Each line's speaking speed relative to the speaker's usual, as characters per second. */
export function paceByLine(lines: readonly Line[]): Map<number, number> {
  const rates = lines.map((l) => ({ idx: l.idx, rate: spokenChars(l.text) / Math.max(0.3, (l.endMs - l.startMs) / 1000) }))
  const sorted = rates.map((r) => r.rate).sort((a, b) => a - b)
  const middle = sorted.length >> 1
  const usual = sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
  return new Map(rates.map((r) => [r.idx, usual > 0 ? Math.round((r.rate / usual) * 100) / 100 : 1]))
}

const DIRECTION = /\[[^\]]+\]/g

/** Whether a performance script directs the voice anywhere, like "[laughs]" or "[whispering]". */
export function hasDirections(performance: string): boolean {
  return /\[[^\]]+\]/.test(performance)
}

/** The words of a performance script, without its directions. */
export function stripDirections(performance: string): string {
  return performance.replace(DIRECTION, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The segments timed for the dubbed voice. A line that re-performs the speaker's laughs or sighs next to its words
 * spans them too, so the new voice laughs where the original laughed and the original laugh gives way; every other
 * line keeps the timing of its words. Subtitles always keep the timing of the words.
 */
export function performedTiming<T extends { idx: number; startMs: number; endMs: number; performedSounds?: number[] }>(
  segments: readonly T[],
  sounds: ReadonlyMap<number, readonly AttachedSound[]>,
): T[] {
  return segments.map((segment) => {
    const performed = (sounds.get(segment.idx) ?? []).filter((sound) => segment.performedSounds?.includes(sound.id))
    if (performed.length === 0) return segment
    return {
      ...segment,
      startMs: Math.min(segment.startMs, ...performed.map((sound) => sound.startMs)),
      endMs: Math.max(segment.endMs, ...performed.map((sound) => sound.endMs)),
    }
  })
}

/** Everything the translator gets to direct each line: measured delivery, speed, and the sounds around it. */
export function lineNotes(
  lines: readonly Line[],
  sounds: ReadonlyMap<number, readonly AttachedSound[]>,
  delivery: ReadonlyMap<number, Delivery> | null,
): Map<number, LineNotes> {
  const pace = paceByLine(lines)
  return new Map(
    lines.map((line) => {
      const notes: LineNotes = { delivery: { ...delivery?.get(line.idx), pace: pace.get(line.idx) } }
      const near = sounds.get(line.idx) ?? []
      if (near.length > 0) notes.sounds = near.map(({ startMs: _start, endMs: _end, ...sound }) => sound)
      return [line.idx, notes]
    }),
  )
}
