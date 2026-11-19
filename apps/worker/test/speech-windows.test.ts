import { describe, expect, it } from 'vitest'
import { speechWindows } from '../src/pipeline/speech-windows.js'

const line = (startMs: number, endMs: number) => ({ startMs, endMs })

describe('speechWindows', () => {
  it('pads each line so word edges and breaths stay with the voice', () => {
    expect(speechWindows([line(2000, 3000)], 60_000)).toEqual([{ startMs: 1900, endMs: 3150 }])
  })

  it('merges lines separated by a short pause, so the sound does not flicker between them', () => {
    expect(speechWindows([line(1000, 2000), line(2350, 3000)], 60_000)).toEqual([{ startMs: 900, endMs: 3150 }])
  })

  it('keeps a real gap between lines, where the original audio returns', () => {
    expect(speechWindows([line(1000, 2000), line(4000, 5000)], 60_000)).toEqual([
      { startMs: 900, endMs: 2150 },
      { startMs: 3900, endMs: 5150 },
    ])
  })

  it('stays inside the video and ignores the order and empty lines', () => {
    expect(speechWindows([line(59_900, 60_000), line(50, 500), line(700, 700)], 60_000)).toEqual([
      { startMs: 0, endMs: 650 },
      { startMs: 59_800, endMs: 60_000 },
    ])
  })

  it('returns nothing when nobody speaks', () => {
    expect(speechWindows([], 60_000)).toEqual([])
  })
})
