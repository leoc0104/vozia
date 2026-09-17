import type { TranscriptSegment, Word } from './contracts.js'

export interface GroupOptions {
  /** Longest a segment may run before it is cut, in milliseconds. */
  maxSegmentMs?: number
  /** A silence longer than this starts a new segment. */
  pauseMs?: number
  maxWords?: number
}

const SENTENCE_END = /[.!?…]["')\]»]?$/

/** Groups timed words into subtitle-sized segments at sentence ends, pauses, speaker changes or length limits. */
export function groupWordsIntoSegments(words: readonly Word[], opts: GroupOptions = {}): TranscriptSegment[] {
  const maxSegmentMs = opts.maxSegmentMs ?? 15_000
  const pauseMs = opts.pauseMs ?? 700
  const maxWords = opts.maxWords ?? 40
  const segments: TranscriptSegment[] = []
  let current: Word[] = []

  const flush = () => {
    const first = current[0]
    const last = current.at(-1)
    if (!first || !last) return
    segments.push({
      idx: segments.length,
      startMs: first.startMs,
      endMs: Math.max(last.endMs, first.startMs),
      text: current.map((w) => w.text).join(' ').replace(/\s+([,.!?;:…])/g, '$1').trim(),
      speaker: first.speaker ?? null,
    })
    current = []
  }

  for (const word of words) {
    const previous = current.at(-1)
    const first = current[0]
    if (previous && first) {
      const speakerChanged = (word.speaker ?? null) !== (previous.speaker ?? null)
      const paused = word.startMs - previous.endMs > pauseMs
      const tooLong = word.endMs - first.startMs > maxSegmentMs || current.length >= maxWords
      if (speakerChanged || paused || tooLong) flush()
    }
    current.push(word)
    if (SENTENCE_END.test(word.text)) flush()
  }
  flush()
  return segments
}
