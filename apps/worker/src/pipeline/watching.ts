import type { Frame } from './contracts.js'

/** The most frames shown to the translator at once: enough to follow a scene, cheap enough for long videos. */
export const MAX_FRAMES = 48
/** How long after a cut to look, so the frame shows the new shot rather than the transition. */
export const AFTER_CUT_MS = 150
/** How often to look when nothing cuts. */
export const LOOK_EVERY_MS = 2000
/** Two looks closer than this show the same thing. */
const SAME_LOOK_MS = 400

interface Span {
  startMs: number
  endMs: number
}

function thin(times: number[], max: number): number[] {
  if (times.length <= max) return times
  return Array.from({ length: max }, (_, i) => times[Math.round((i * (times.length - 1)) / Math.max(1, max - 1))]!)
}

/**
 * When to look at the video: just after every cut, in the middle of every line and every couple of seconds, at most
 * `max` times. Cuts come first, because the picture changes there.
 */
export function frameTimes(lines: readonly Span[], cutsMs: readonly number[], durationMs: number, max = MAX_FRAMES): number[] {
  const end = Math.max(0, durationMs - 100)
  const atCuts = cutsMs.map((cut) => Math.min(end, cut + AFTER_CUT_MS))
  const others = [
    ...lines.map((line) => Math.round((line.startMs + line.endMs) / 2)),
    ...Array.from({ length: Math.floor(durationMs / LOOK_EVERY_MS) + 1 }, (_, i) => Math.min(end, 500 + i * LOOK_EVERY_MS)),
  ]
  const keep = (from: number[], taken: number[]) =>
    [...from].sort((a, b) => a - b).filter((t) => {
      if (t < 0 || t > end || taken.some((k) => Math.abs(k - t) < SAME_LOOK_MS)) return false
      taken.push(t)
      return true
    })
  const cutsKept = thin(keep(atCuts, []), max)
  const othersKept = thin(keep(others, [...cutsKept]), Math.max(0, max - cutsKept.length))
  return [...cutsKept, ...othersKept].sort((a, b) => a - b)
}

/** Splits frames among consecutive groups of lines, so each group sees what is on screen around it. */
export function framesFor(groups: readonly Span[][], frames: readonly Frame[]): Frame[][] {
  return groups.map((group, i) => {
    const from = i === 0 ? -Infinity : (groups[i - 1]!.at(-1)!.endMs + group[0]!.startMs) / 2
    const to = i === groups.length - 1 ? Infinity : (group.at(-1)!.endMs + groups[i + 1]![0]!.startMs) / 2
    return frames.filter((frame) => frame.timeMs >= from && frame.timeMs < to)
  })
}

/**
 * When a caption is on screen, from the frames it was seen in: it starts at the cut before its first frame (or half
 * way to the frame before) and ends at the cut after its last frame (or half way to the next one). Null when the
 * frame numbers do not exist.
 */
export function captionTimes(
  seen: { firstFrame: number; lastFrame: number },
  frames: readonly Frame[],
  cutsMs: readonly number[],
  durationMs: number,
): Span | null {
  const first = frames[seen.firstFrame - 1]
  const last = frames[seen.lastFrame - 1]
  if (!first || !last || last.timeMs < first.timeMs) return null
  const before = frames[seen.firstFrame - 2]?.timeMs ?? 0
  const after = frames[seen.lastFrame]?.timeMs ?? durationMs
  const cutBefore = cutsMs.filter((cut) => cut > before && cut <= first.timeMs).at(-1)
  const cutAfter = cutsMs.find((cut) => cut > last.timeMs && cut <= after)
  return {
    startMs: Math.round(cutBefore ?? (seen.firstFrame === 1 ? 0 : (before + first.timeMs) / 2)),
    endMs: Math.round(cutAfter ?? (seen.lastFrame === frames.length ? durationMs : (last.timeMs + after) / 2)),
  }
}
