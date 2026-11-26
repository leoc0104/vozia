import type {
  Anchor,
  Delivery,
  LineNotes,
  LineSound,
  SoundEvent,
  VoiceAnalysis,
  VoiceAnalysisRequest,
  VoiceMeasure,
} from './contracts.js'
import type { TimeWindow } from './speech-windows.js'

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
      ...(event.untagged ? { untagged: event.untagged } : {}),
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

/**
 * The words of a direction that makes a sound of its own, in any form but the -ing one: [gasps], [quick gasp],
 * [soft breath] or [deep grunt] make a sound, while [laughing] or [sobbing] shape the words they come with.
 * Directions are always written in English, so this list works for every language.
 */
const SOUND_WORD =
  /^(?:gasp|laugh|laughter|chuckle|giggle|snicker|cackle|sigh|scream|shriek|sob|cry|cries|whimper|groan|moan|grunt|cough|sneeze|sniff|snort|breath|breathe|inhale|exhale|pant|yawn|gulp|swallow|wheeze|hum|squeal|yelp)s?$/

/** Whether one part of a direction, like "quick gasp" in [quick gasp, terrified], makes a sound of its own. */
function isSoundPart(part: string): boolean {
  const lower = part.toLowerCase()
  if (/^(?:starts?|bursts?(?: out)?)\s+\w+ing$/.test(lower) || /\bclears?\s+(?:\w+\s+)?throat\b/.test(lower)) return true
  return lower.split(/[\s-]+/).some((word) => SOUND_WORD.test(word))
}

function trimEdgeSounds(performance: string, edge: 'start' | 'end'): string {
  const tokens = performance.split(/(\[[^\]]+\])/)
  const order = edge === 'start' ? [...tokens.keys()] : [...tokens.keys()].reverse()
  for (const i of order) {
    const token = tokens[i]!
    if (/^\[[^\]]+\]$/.test(token)) {
      const parts = token
        .slice(1, -1)
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '' && !isSoundPart(part))
      tokens[i] = parts.length > 0 ? `[${parts.join(', ')}]` : ''
    } else if (/[\p{L}\p{N}]/u.test(token)) break
  }
  return tokens.join('').replace(/\s{2,}/g, ' ').trim()
}

/**
 * Takes sound directions off the start and the end of a performance unless the original has a sound there: a gasp
 * before the first word would make it land late against the picture, and a sound the original does not have would
 * play over it. Directions that shape the words stay.
 */
export function dropEdgeSounds(performance: string, keep: { before: boolean; after: boolean }): string {
  let text = performance
  if (!keep.before) text = trimEdgeSounds(text, 'start')
  if (!keep.after) text = trimEdgeSounds(text, 'end')
  return text
}

/** A word reduced to its letters and digits, without accents or case, to match words across transcripts. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** The words of a text, normalized. */
export function wordsOf(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter((word) => word !== '')
}

/** Anchors whose words really are in the original line and in the translation, at most six. */
export function validAnchors(anchors: readonly Anchor[], sourceText: string, targetText: string): Anchor[] {
  const source = new Set(wordsOf(sourceText))
  const target = new Set(wordsOf(targetText))
  const kept: Anchor[] = []
  for (const anchor of anchors) {
    const s = wordsOf(anchor.source)[0]
    const t = wordsOf(anchor.target)[0]
    if (!s || !t || !source.has(s) || !target.has(t) || kept.some((k) => wordsOf(k.target)[0] === t)) continue
    kept.push({ source: anchor.source.trim(), target: anchor.target.trim() })
    if (kept.length === 6) break
  }
  return kept
}

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

/** What to ask the voice analysis about a transcript: each line over its words, and where words and tags are. */
export function voiceAnalysisRequest(
  segments: readonly (Line & { words?: readonly TimeWindow[] })[],
  events: readonly SoundEvent[],
): VoiceAnalysisRequest {
  const span = (w: TimeWindow): TimeWindow => ({ startMs: w.startMs, endMs: w.endMs })
  return {
    lines: segments.map((s) => ({ idx: s.idx, spans: s.words?.length ? s.words.map(span) : [span(s)] })),
    words: segments.flatMap((s) => (s.words ?? [s]).map(span)),
    events: events.map(span),
  }
}

/** A line's measures against the speaker's usual line, in the terms the translator reads. */
export function relativeDelivery(measure: VoiceMeasure, usual: VoiceAnalysis['usual']): Delivery {
  const delivery: Delivery = {}
  if (measure.loudnessDb !== null && usual.loudnessDb !== null) delivery.loudnessDb = round1(measure.loudnessDb - usual.loudnessDb)
  if (measure.pitchSt !== null && usual.pitchSt !== null) delivery.pitchSt = round1(measure.pitchSt - usual.pitchSt)
  if (measure.rangeSt !== null) delivery.pitchRangeSt = measure.rangeSt
  if (measure.peakSt !== null && usual.pitchSt !== null) delivery.peakSt = round1(measure.peakSt - usual.pitchSt)
  if (measure.endingSt !== null) delivery.endingSt = measure.endingSt
  return delivery
}

/** The delivery in plain words, so the translator hears the melody and not only numbers. */
export function describeMelody(delivery: Delivery): string {
  const { pitchSt, loudnessDb, pitchRangeSt, peakSt, endingSt, pace } = delivery
  const parts: string[] = []
  if (pitchSt !== undefined) {
    if (pitchSt >= 8) parts.push('very high voice')
    else if (pitchSt >= 4) parts.push('raised voice')
    else if (pitchSt <= -3) parts.push('low voice')
  }
  if (loudnessDb !== undefined) {
    if (loudnessDb >= 6) parts.push('loud')
    else if (loudnessDb <= -6) parts.push('quiet')
  }
  if (pitchRangeSt !== undefined) {
    if (pitchRangeSt < 4) parts.push('flat, almost monotone')
    else if (pitchRangeSt >= 12) parts.push('very animated')
    else if (pitchRangeSt >= 8) parts.push('lively')
  }
  if (peakSt !== undefined && peakSt >= 14) parts.push('peaks in a scream or a shout')
  if (endingSt !== undefined) {
    if (endingSt >= 3) parts.push('rises at the end')
    else if (endingSt <= -3) parts.push('falls at the end')
  }
  if (pace !== undefined) {
    if (pace >= 1.3) parts.push('fast')
    else if (pace <= 0.75) parts.push('slow')
  }
  return parts.length > 0 ? parts.join(', ') : 'ordinary, conversational'
}

/** The label of voice found by measurement: there is no tag to read, so the translator goes by context. */
export const WORDLESS_VOICE = 'voice without words'

/** The voice analysis' wordless voice, as sounds that can be tied to lines and performed like tagged ones. */
export function wordlessVoice(analysis: VoiceAnalysis | null): SoundEvent[] {
  if (!analysis) return []
  const { usual } = analysis
  return analysis.sounds.map((sound) => ({
    label: WORDLESS_VOICE,
    startMs: sound.startMs,
    endMs: sound.endMs,
    untagged: {
      ...(sound.loudnessDb !== null && usual.loudnessDb !== null ? { loudnessDb: round1(sound.loudnessDb - usual.loudnessDb) } : {}),
      ...(sound.pitchSt !== null && usual.pitchSt !== null ? { pitchSt: round1(sound.pitchSt - usual.pitchSt) } : {}),
    },
  }))
}

/** A cut this close before a line's first word still counts as the line starting on the cut. */
export const CUT_SLACK_MS = 120

/** Everything the translator gets to direct each line: measured delivery and melody, speed, sounds and cuts. */
export function lineNotes(
  lines: readonly Line[],
  sounds: ReadonlyMap<number, readonly AttachedSound[]>,
  analysis: VoiceAnalysis | null,
  cutsMs: readonly number[] = [],
): Map<number, LineNotes> {
  const pace = paceByLine(lines)
  return new Map(
    lines.map((line) => {
      const measure = analysis?.lines.get(line.idx)
      const delivery: Delivery = { ...(measure && analysis ? relativeDelivery(measure, analysis.usual) : {}), pace: pace.get(line.idx) }
      const notes: LineNotes = { delivery, melody: describeMelody(delivery) }
      const near = sounds.get(line.idx) ?? []
      if (near.length > 0) notes.sounds = near.map(({ startMs: _start, endMs: _end, ...sound }) => sound)
      const cuts = cutsMs
        .filter((cut) => cut >= line.startMs - CUT_SLACK_MS && cut <= line.endMs)
        .map((cut) => Math.max(0, round1((cut - line.startMs) / 1000)))
      if (cuts.length > 0) notes.cuts = cuts
      return [line.idx, notes]
    }),
  )
}
