import { describe, expect, it } from 'vitest'
import { spokenIndex } from '../transcript'

const lines = [
  { start_ms: 1000, end_ms: 2500 },
  { start_ms: 3000, end_ms: 5000 },
  { start_ms: 5000, end_ms: 6000 },
]

describe('spokenIndex', () => {
  it('finds the line being spoken at a moment', () => {
    expect(spokenIndex(lines, 1000)).toBe(0)
    expect(spokenIndex(lines, 2499)).toBe(0)
    expect(spokenIndex(lines, 4000)).toBe(1)
  })

  it('hands over at the exact moment the next line starts', () => {
    expect(spokenIndex(lines, 5000)).toBe(2)
  })

  it('marks nothing before the first line, between lines or after the last one', () => {
    expect(spokenIndex(lines, 0)).toBe(-1)
    expect(spokenIndex(lines, 2700)).toBe(-1)
    expect(spokenIndex(lines, 9000)).toBe(-1)
    expect(spokenIndex([], 1000)).toBe(-1)
  })
})
