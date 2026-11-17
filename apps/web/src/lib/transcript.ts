interface Timed {
  start_ms: number
  end_ms: number
}

/**
 * The index of the line being spoken at `ms`, or -1 when nobody is speaking (before the first line, between two,
 * or after the last). Lines arrive sorted by start time, so this is a binary search.
 */
export function spokenIndex(lines: readonly Timed[], ms: number): number {
  let low = 0
  let high = lines.length - 1
  let latest = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (lines[middle]!.start_ms <= ms) {
      latest = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return latest >= 0 && ms < lines[latest]!.end_ms ? latest : -1
}
