import { describe, expect, it } from 'vitest'
import { dubWindows, speechWindows } from '../src/pipeline/speech-windows.js'

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

describe('dubWindows', () => {
  const words = [{ startMs: 1000, endMs: 1400 }, { startMs: 1500, endMs: 2000 }, { startMs: 2600, endMs: 2900 }]

  it('covers every word, and lets the original back in during a long pause inside a line', () => {
    expect(dubWindows({ words, totalMs: 10_000 })).toEqual([
      { startMs: 900, endMs: 2150 },
      { startMs: 2500, endMs: 3050 },
    ])
  })

  it('mutes a re-performed laugh only while the dub laughs, and keeps one the dub did not perform', () => {
    const laugh = { startMs: 3200, endMs: 5000 }
    // The dub laughs from 3.3 to 3.8 s: the original is muted around that, and its own laugh comes back after.
    expect(dubWindows({ words: [], performed: [{ original: laugh, dub: [{ startMs: 3300, endMs: 3800 }] }], totalMs: 10_000 })).toEqual([
      { startMs: 3200, endMs: 3950 },
    ])
    expect(dubWindows({ words: [], performed: [{ original: laugh, dub: [] }], totalMs: 10_000 })).toEqual([])
    // Without measurements, the whole original sound gives way, as before.
    expect(dubWindows({ words: [], performed: [{ original: laugh, dub: null }], totalMs: 10_000 })).toEqual([{ startMs: 3100, endMs: 5150 }])
  })

  it('moves each edge to the quietest moment nearby, never onto a word', () => {
    // A loud sound right where the window would start (850-950 ms); quiet just before it.
    const db = Array.from({ length: 300 }, (_, i) => (i >= 85 && i < 96 ? -10 : i === 80 ? -60 : -40))
    const windows = dubWindows({ words: [{ startMs: 1000, endMs: 1400 }], totalMs: 3000, envelope: { stepMs: 10, db } })
    expect(windows[0]!.startMs).toBe(800)
    // The end has nothing quieter than its own spot nearby, so it stays put.
    expect(windows[0]!.endMs).toBe(1550)
  })
})
