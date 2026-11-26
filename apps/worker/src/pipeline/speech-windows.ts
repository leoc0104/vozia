export interface TimeWindow {
  startMs: number
  endMs: number
}

/**
 * How far around each spoken line the dub counts as "speaking". The padding keeps word edges and breaths with the
 * voice; the merge gap stops the background from flickering back to the original during short pauses.
 */
export const SPEECH_WINDOW = { beforeMs: 100, afterMs: 150, mergeGapMs: 300 }

/**
 * Where someone speaks, as padded and merged windows inside the video. Outside them the dub keeps the original audio
 * untouched, so sounds between lines survive even when the separator files them under the voice.
 */
export function speechWindows(
  lines: readonly { startMs: number; endMs: number }[],
  totalMs: number,
  opts: typeof SPEECH_WINDOW = SPEECH_WINDOW,
): TimeWindow[] {
  const end = totalMs > 0 ? totalMs : Number.POSITIVE_INFINITY
  const padded = lines
    .filter((l) => l.endMs > l.startMs)
    .map((l) => ({ startMs: Math.max(0, l.startMs - opts.beforeMs), endMs: Math.min(end, l.endMs + opts.afterMs) }))
    .filter((w) => w.endMs > w.startMs)
    .sort((a, b) => a.startMs - b.startMs)

  const merged: TimeWindow[] = []
  for (const window of padded) {
    const last = merged.at(-1)
    if (last && window.startMs - last.endMs <= opts.mergeGapMs) last.endMs = Math.max(last.endMs, window.endMs)
    else merged.push({ ...window })
  }
  return merged
}

/** A sound of the original that the dub re-performs, and where the dub's own version plays (null when unknown). */
export interface PerformedSound {
  original: TimeWindow
  dub: TimeWindow[] | null
}

/** How far a window edge may move to find a quiet moment of the original voice. */
export const QUIET_SEARCH_MS = 120
/** How close to a word an edge may come. */
const WORD_GUARD_MS = 30

/**
 * Where the original voice gives way to the dub: over every word of the original, so no word of the original
 * language is ever heard, and over each sound the dub re-performs only while the dub's version plays, so a laugh
 * that comes out shorter lets the original's end through instead of leaving a silence. Each edge then moves to the
 * quietest moment of the original voice nearby, so a fade never cuts through a loud sound.
 */
export function dubWindows(
  input: {
    words: readonly TimeWindow[]
    performed?: readonly PerformedSound[]
    totalMs: number
    envelope?: { stepMs: number; db: readonly number[] } | null
  },
  opts: typeof SPEECH_WINDOW = SPEECH_WINDOW,
): TimeWindow[] {
  const spans: TimeWindow[] = [...input.words]
  for (const sound of input.performed ?? []) {
    if (sound.dub === null) {
      spans.push(sound.original)
      continue
    }
    const near = sound.dub.filter((d) => d.endMs > sound.original.startMs - 1000 && d.startMs < sound.original.endMs + 1000)
    if (near.length === 0) continue
    const startMs = Math.max(sound.original.startMs, Math.min(...near.map((d) => d.startMs)))
    const endMs = Math.min(sound.original.endMs, Math.max(...near.map((d) => d.endMs)))
    if (endMs > startMs) spans.push({ startMs, endMs })
  }
  const windows = speechWindows(spans, input.totalMs, opts)
  if (!input.envelope || input.envelope.db.length === 0) return windows
  const quiet = quietEdges(windows, input.words, input.envelope, input.totalMs)
  return speechWindows(quiet, input.totalMs, { ...opts, beforeMs: 0, afterMs: 0 })
}

/** Moves each edge, within QUIET_SEARCH_MS and never onto a word, to where the original voice is quietest. */
export function quietEdges(
  windows: readonly TimeWindow[],
  words: readonly TimeWindow[],
  envelope: { stepMs: number; db: readonly number[] },
  totalMs: number,
): TimeWindow[] {
  const level = (ms: number) => envelope.db[Math.min(envelope.db.length - 1, Math.max(0, Math.round(ms / envelope.stepMs)))] ?? 0
  const quietest = (from: number, to: number, origin: number) => {
    let best = origin
    for (let t = Math.ceil(from / envelope.stepMs) * envelope.stepMs; t <= to; t += envelope.stepMs) {
      const better = level(t) < level(best) || (level(t) === level(best) && Math.abs(t - origin) < Math.abs(best - origin))
      if (better) best = t
    }
    return best
  }
  return windows.map((w) => {
    const inside = words.filter((word) => word.endMs > w.startMs && word.startMs < w.endMs)
    const firstWord = inside.length > 0 ? Math.min(...inside.map((word) => word.startMs)) : w.endMs
    const lastWord = inside.length > 0 ? Math.max(...inside.map((word) => word.endMs)) : w.startMs
    const startMs = quietest(Math.max(0, w.startMs - QUIET_SEARCH_MS), Math.min(w.startMs + QUIET_SEARCH_MS, firstWord - WORD_GUARD_MS), w.startMs)
    const endMs = quietest(Math.max(w.endMs - QUIET_SEARCH_MS, lastWord + WORD_GUARD_MS), Math.min(totalMs, w.endMs + QUIET_SEARCH_MS), w.endMs)
    return { startMs, endMs: Math.max(endMs, startMs + 1) }
  })
}
