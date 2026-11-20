import type { Placement } from './contracts.js'

export interface TimelineSegment {
  idx: number
  startMs: number
  endMs: number
}

export interface PlanOptions {
  /** Fastest playback allowed when a clip is longer than its slot (ffmpeg `atempo`). */
  maxTempo?: number
  /** Slowest playback allowed when a clip is shorter than the original line, so it keeps the original pace. */
  minTempo?: number
  /** Never assume a slot shorter than this, so tempo stays sane for back-to-back cues. */
  minAvailableMs?: number
}

/**
 * Places each synthesized clip at its segment's original start and sets its pace, so the dub keeps the rhythm of
 * the picture. A clip may run until the next segment starts (or the end of the video); anything longer is
 * compressed up to `maxTempo`, beyond which it simply overlaps the following cue. A clip shorter than the original
 * line is slowed toward that line's length, down to `minTempo`, instead of rushing through and leaving a silence.
 */
export function planTimeline(
  segments: readonly TimelineSegment[],
  clipDurationsMs: readonly number[],
  totalDurationMs: number,
  opts: PlanOptions = {},
): Placement[] {
  const maxTempo = opts.maxTempo ?? 1.35
  const minTempo = opts.minTempo ?? 0.85
  const minAvailable = opts.minAvailableMs ?? 200
  const ordered = segments
    .map((segment, i) => ({ segment, clipMs: clipDurationsMs[i] ?? 0 }))
    .sort((a, b) => a.segment.startMs - b.segment.startMs)

  return ordered.map(({ segment, clipMs }, i) => {
    const nextStart = ordered[i + 1]?.segment.startMs ?? Math.max(totalDurationMs, segment.endMs)
    const available = Math.max(minAvailable, nextStart - segment.startMs)
    const spoken = Math.max(minAvailable, segment.endMs - segment.startMs)
    const tempo =
      clipMs > available
        ? Math.min(maxTempo, clipMs / available)
        : clipMs > 0 && clipMs < spoken
          ? Math.max(minTempo, clipMs / spoken)
          : 1
    return { idx: segment.idx, startMs: segment.startMs, tempo: Math.round(tempo * 1000) / 1000 }
  })
}
