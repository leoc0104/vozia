import { describe, expect, it } from 'vitest'
import { captionTimes, frameTimes, framesFor } from '../src/pipeline/watching.js'

describe('frameTimes', () => {
  it('looks just after every cut, in the middle of each line and every two seconds, without looking twice', () => {
    const times = frameTimes([{ startMs: 1000, endMs: 3000 }], [2000, 2100, 5000], 6000)
    // 2250 is the same look as 2150; the line's middle (2000) and the look at 2500 are too close to it. The last look
    // stays inside the video.
    expect(times).toEqual([500, 2150, 4500, 5150, 5900])
  })

  it('keeps the cuts first when there are too many looks', () => {
    const times = frameTimes([], [1000, 3000, 5000, 7000], 20_000, 4)
    expect(times).toEqual([1150, 3150, 5150, 7150])
  })

  it('spreads its looks over the video when it must take fewer', () => {
    expect(frameTimes([], [], 60_000, 3)).toEqual([500, 30_500, 59_900])
  })
})

describe('framesFor', () => {
  it('gives each group of lines the frames around it', () => {
    const frames = [500, 4000, 9000, 15_000].map((timeMs) => ({ timeMs, path: `${timeMs}.jpg` }))
    const groups = [[{ startMs: 0, endMs: 3000 }], [{ startMs: 10_000, endMs: 12_000 }]]
    expect(framesFor(groups, frames).map((group) => group.map((frame) => frame.timeMs))).toEqual([[500, 4000], [9000, 15_000]])
  })
})

describe('captionTimes', () => {
  const frames = [9500, 10_380, 11_500, 41_800].map((timeMs) => ({ timeMs, path: `${timeMs}.jpg` }))

  it('snaps to the cuts around the frames the caption was seen in', () => {
    expect(captionTimes({ firstFrame: 2, lastFrame: 3 }, frames, [10_230, 12_276], 49_500)).toEqual({ startMs: 10_230, endMs: 12_276 })
  })

  it('goes half way to the neighbouring frames when no cut is there, and to the ends of the video', () => {
    expect(captionTimes({ firstFrame: 2, lastFrame: 2 }, frames, [], 49_500)).toEqual({ startMs: 9940, endMs: 10_940 })
    expect(captionTimes({ firstFrame: 1, lastFrame: 4 }, frames, [], 49_500)).toEqual({ startMs: 0, endMs: 49_500 })
  })

  it('ignores frame numbers that do not exist', () => {
    expect(captionTimes({ firstFrame: 3, lastFrame: 9 }, frames, [], 49_500)).toBeNull()
    expect(captionTimes({ firstFrame: 3, lastFrame: 2 }, frames, [], 49_500)).toBeNull()
  })
})
