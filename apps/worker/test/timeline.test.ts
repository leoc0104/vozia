import { describe, expect, it } from 'vitest'
import { planTimeline } from '../src/pipeline/timeline.js'

const segments = [
  { idx: 0, startMs: 0, endMs: 1500 },
  { idx: 1, startMs: 1600, endMs: 4000 },
  { idx: 2, startMs: 4200, endMs: 6000 },
]

describe('planTimeline', () => {
  it('keeps clips that fit at natural speed', () => {
    expect(planTimeline(segments, [1400, 2000, 1000], 7000)).toEqual([
      { idx: 0, startMs: 0, tempo: 1 },
      { idx: 1, startMs: 1600, tempo: 1 },
      { idx: 2, startMs: 4200, tempo: 1 },
    ])
  })

  it('speeds up clips that overrun the gap to the next cue, capped at maxTempo', () => {
    const plan = planTimeline(segments, [2000, 2860, 5000], 7000)
    expect(plan[0]!.tempo).toBe(1.25)
    expect(plan[1]!.tempo).toBe(1.1)
    expect(plan[2]!.tempo).toBe(1.35)
  })

  it('uses the video end for the last cue and never assumes a slot under the minimum', () => {
    const plan = planTimeline([{ idx: 0, startMs: 5000, endMs: 5050 }], [300], 5100, { maxTempo: 2 })
    expect(plan[0]!.tempo).toBe(1.5)
  })

  it('orders by start time while keeping segment ids', () => {
    const plan = planTimeline([segments[2]!, segments[0]!], [1000, 1000], 7000)
    expect(plan.map((p) => p.idx)).toEqual([0, 2])
  })
})
