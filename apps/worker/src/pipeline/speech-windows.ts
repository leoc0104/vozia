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
