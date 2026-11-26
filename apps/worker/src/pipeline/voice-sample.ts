import type { TranscriptSegment, VoiceAnalysis } from './contracts.js'
import type { AttachedSound } from './performance.js'
import { relativeDelivery } from './performance.js'
import type { TimeWindow } from './speech-windows.js'

export const SAMPLE = {
  /** As much calm speech as the clone gets; ElevenLabs recommends one to two minutes. */
  targetMs: 90_000,
  /** Below this, less calm lines are added: a short sample makes a poor clone. */
  minMs: 20_000,
  padBeforeMs: 50,
  padAfterMs: 120,
}

/**
 * The stretches of the voice track to clone the speaker from: their calmest, most typical lines first, leaving out
 * screams, laughs and noisy lines, so the clone learns how they usually sound. A clone made from a scared or
 * screaming voice speaks every line too high (it did: 2.4 semitones on the first test video).
 */
export function pickSampleSpans(
  lines: readonly TranscriptSegment[],
  analysis: VoiceAnalysis | null,
  sounds: ReadonlyMap<number, readonly AttachedSound[]>,
  totalMs: number,
  opts = SAMPLE,
): TimeWindow[] {
  const scored = lines.map((line) => {
    const first = line.words?.[0]?.startMs ?? line.startMs
    const last = line.words?.at(-1)?.endMs ?? line.endMs
    const span = { startMs: Math.max(0, first - opts.padBeforeMs), endMs: Math.min(totalMs, last + opts.padAfterMs) }
    const measure = analysis?.lines.get(line.idx)
    const delivery = measure && analysis ? relativeDelivery(measure, analysis.usual) : {}
    const screaming = (delivery.peakSt ?? 0) >= 12 || (delivery.pitchSt ?? 0) >= 6
    const noisy = measure?.voiced !== null && measure?.voiced !== undefined && measure.voiced < 0.5
    const laughing = (sounds.get(line.idx) ?? []).some((sound) => sound.position === 'within')
    const calm =
      Math.abs(delivery.pitchSt ?? 0) + Math.max(0, (delivery.pitchRangeSt ?? 6) - 8) / 2 + Math.abs(delivery.loudnessDb ?? 0) / 2
    return { span, calm, rank: screaming || laughing ? 2 : noisy ? 1 : 0 }
  })
  const ordered = [...scored].sort((a, b) => a.rank - b.rank || a.calm - b.calm)
  const picked: TimeWindow[] = []
  let total = 0
  for (const candidate of ordered) {
    const enough = candidate.rank === 0 ? total >= opts.targetMs : total >= opts.minMs
    if (enough) break
    picked.push(candidate.span)
    total += candidate.span.endMs - candidate.span.startMs
  }
  return picked.sort((a, b) => a.startMs - b.startMs)
}
