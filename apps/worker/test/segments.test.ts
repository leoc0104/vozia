import { describe, expect, it } from 'vitest'
import { groupWordsIntoSegments } from '../src/pipeline/segments.js'
import { normalizeLanguageCode } from '../src/drivers/elevenlabs/transcriber.js'
import type { Word } from '../src/pipeline/contracts.js'

const w = (text: string, startMs: number, endMs: number, speaker = 's0'): Word => ({ text, startMs, endMs, speaker })

describe('groupWordsIntoSegments', () => {
  it('cuts at sentence ends and joins punctuation tightly', () => {
    const words = [w('Hello', 0, 300), w(',', 300, 300), w('there.', 400, 800), w('Welcome', 900, 1300), w('back!', 1400, 1800)]
    expect(groupWordsIntoSegments(words)).toEqual([
      { idx: 0, startMs: 0, endMs: 800, text: 'Hello, there.', speaker: 's0' },
      { idx: 1, startMs: 900, endMs: 1800, text: 'Welcome back!', speaker: 's0' },
    ])
  })

  it('cuts at long pauses and speaker changes', () => {
    const words = [w('one', 0, 200), w('two', 1200, 1400), w('three', 1500, 1700, 's1'), w('four', 1800, 2000, 's1')]
    expect(groupWordsIntoSegments(words).map((s) => s.text)).toEqual(['one', 'two', 'three four'])
  })

  it('cuts when a segment grows too long or has too many words', () => {
    const long: Word[] = []
    for (let i = 0; i < 12; i++) long.push(w(`w${i}`, i * 2000, i * 2000 + 500))
    const byDuration = groupWordsIntoSegments(long, { maxSegmentMs: 5000, pauseMs: 5000 })
    expect(byDuration.length).toBeGreaterThan(2)
    expect(byDuration.every((s) => s.endMs - s.startMs <= 5000 || s.text.split(' ').length === 1)).toBe(true)
    const byWords = groupWordsIntoSegments(long, { maxWords: 4, pauseMs: 5000 })
    expect(byWords.map((s) => s.text.split(' ').length)).toEqual([4, 4, 4])
  })

  it('returns nothing for no words', () => {
    expect(groupWordsIntoSegments([])).toEqual([])
  })
})

describe('normalizeLanguageCode', () => {
  it('maps ISO 639-3 to the codes the app uses', () => {
    expect(normalizeLanguageCode('eng')).toBe('en')
    expect(normalizeLanguageCode('por')).toBe('pt')
    expect(normalizeLanguageCode('pt-BR')).toBe('pt')
    expect(normalizeLanguageCode('fil')).toBe('fil')
    expect(normalizeLanguageCode('xyz')).toBe('xyz')
  })
})
