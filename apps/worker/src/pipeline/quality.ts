import { IN_SYNC_MS, type DubQuality, type LinePerformance } from '@vozia/shared'
import type { VoiceMatchReport } from './contracts.js'
import type { Performance, PerformedLine } from './director.js'
import type { AttachedSound } from './performance.js'

const worstOf = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))

/** How one line was performed, as the dub page shows it. */
export function linePerformance(line: PerformedLine, sounds: readonly AttachedSound[]): LinePerformance {
  // The first word is placed on the original's by construction; the anchored words are what can still miss.
  const tied = (line.alignment?.errors ?? []).filter((error) => error.weight !== 'soft').map((error) => error.errorMs)
  return {
    spoken: line.spoken,
    takes: line.takes,
    revised: line.revised,
    worstWordMs: line.alignment ? (worstOf(tied) ?? 0) : null,
    length: line.alignment?.lengthRatio ?? null,
    overflowMs: line.alignment?.overflowMs ?? 0,
    notes: line.review?.feedback ?? [],
    sounds: sounds.filter((sound) => line.segment.performedSounds?.includes(sound.id)).map((sound) => sound.label),
  }
}

/** How close the whole dub came to the original. */
export function dubQuality(
  performance: Performance,
  lines: readonly LinePerformance[],
  matched: { report: VoiceMatchReport } | null,
  captions: number,
): DubQuality {
  const misses = lines.map((line) => line.worstWordMs).filter((ms): ms is number => ms !== null)
  return {
    version: 1,
    measured: performance.measured,
    lines: lines.length,
    inSync: lines.filter((line) => line.worstWordMs !== null && Math.abs(line.worstWordMs) <= IN_SYNC_MS).length,
    worstWordMs: worstOf(misses),
    retaken: lines.filter((line) => line.takes > 1).length,
    revised: lines.filter((line) => line.revised).length,
    pitchOffsetSt: performance.pitchOffsetSt,
    pitchCorrectedSt: matched?.report.pitchShiftSt ?? 0,
    voiceMatched: Boolean(matched?.report.eq),
    bandwidthHz: matched?.report.bandwidthHz ?? null,
    room: Boolean(matched?.report.room),
    captions,
  }
}
