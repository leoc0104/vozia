import { describe, expect, it } from 'vitest'
import type { VoiceAnalysis, VoiceMeasure } from '../src/pipeline/contracts.js'
import { pickSampleSpans } from '../src/pipeline/voice-sample.js'

const line = (idx: number, startMs: number, endMs: number) => ({
  idx,
  startMs,
  endMs,
  text: 'x',
  words: [{ text: 'x', startMs, endMs }],
})
const measure = (pitchSt: number, rangeSt = 5, peakSt = pitchSt + 3): VoiceMeasure => ({
  loudnessDb: -13, pitchSt, rangeSt, peakSt, endingSt: 0, voiced: 0.8,
})
const analysis = (lines: [number, VoiceMeasure][]): VoiceAnalysis => ({
  usual: { loudnessDb: -13, pitchSt: 13 },
  lines: new Map(lines),
  sounds: [],
  envelope: { stepMs: 10, db: [] },
})

describe('pickSampleSpans', () => {
  it('clones from the calmest, most typical lines and leaves screams out', () => {
    const lines = [line(0, 1000, 11_000), line(1, 12_000, 22_000), line(2, 23_000, 33_000)]
    // Line 0 screams (a peak 15 semitones over the usual); 1 is calm; 2 is a little excited.
    const spans = pickSampleSpans(lines, analysis([[0, measure(20, 9, 28)], [1, measure(13)], [2, measure(16)]]), new Map(), 60_000, {
      targetMs: 15_000,
      minMs: 5000,
      padBeforeMs: 50,
      padAfterMs: 120,
    })
    expect(spans).toEqual([
      { startMs: 11_950, endMs: 22_120 },
      { startMs: 22_950, endMs: 33_120 },
    ])
  })

  it('adds less calm lines only to reach the minimum, and leaves out lines with a laugh inside', () => {
    const lines = [line(0, 1000, 4000), line(1, 5000, 9000)]
    const sounds = new Map([[1, [{ id: 0, label: 'risos', position: 'within' as const, atSec: 1, seconds: 1, startMs: 6000, endMs: 7000 }]]])
    const spans = pickSampleSpans(lines, analysis([[0, measure(20, 9, 28)], [1, measure(13)]]), sounds, 10_000, {
      targetMs: 60_000,
      minMs: 2000,
      padBeforeMs: 0,
      padAfterMs: 0,
    })
    // Both lines are out of the calm set; the calmer one (the laugh) comes first, and it alone reaches the minimum.
    expect(spans).toHaveLength(1)
  })

  it('uses every line, in order, when nothing could be measured', () => {
    const spans = pickSampleSpans([line(0, 1000, 2000), line(1, 3000, 4000)], null, new Map(), 5000)
    expect(spans).toEqual([
      { startMs: 950, endMs: 2120 },
      { startMs: 2950, endMs: 4120 },
    ])
  })
})
