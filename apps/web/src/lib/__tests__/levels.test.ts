import { describe, expect, it } from 'vitest'
import { levelHeights } from '../levels'

describe('levelHeights', () => {
  it('gives a video the same voiceprint every time', () => {
    expect(levelHeights('video-1', 24)).toEqual(levelHeights('video-1', 24))
  })

  it('gives different videos different voiceprints', () => {
    expect(levelHeights('video-1', 24)).not.toEqual(levelHeights('video-2', 24))
  })

  it('returns one height per bar', () => {
    expect(levelHeights('video-1', 7)).toHaveLength(7)
    expect(levelHeights('video-1', 0)).toEqual([])
  })

  it('keeps every bar visible and inside its box', () => {
    for (const seed of ['', 'a', 'video-1', 'a much longer seed with spaces', 'ção']) {
      for (const height of levelHeights(seed, 64)) {
        expect(height).toBeGreaterThanOrEqual(20)
        expect(height).toBeLessThanOrEqual(100)
      }
    }
  })

  it('varies the bars within one voiceprint', () => {
    expect(new Set(levelHeights('video-1', 24)).size).toBeGreaterThan(8)
  })
})
