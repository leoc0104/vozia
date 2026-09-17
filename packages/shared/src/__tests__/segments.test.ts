import { describe, expect, it } from 'vitest'
import { formatSrtTime, toSrt, type Segment } from '../segments.js'

const segments: Segment[] = [
  { idx: 1, startMs: 1600, endMs: 4000, text: 'Welcome to Vozia.', translatedText: 'Bem-vindo ao Vozia.' },
  { idx: 0, startMs: 0, endMs: 1500, text: 'Hello there.', translatedText: 'Olá.' },
  { idx: 2, startMs: 4200, endMs: 6000, text: '   ', translatedText: null },
]

describe('srt', () => {
  it('formats timestamps as HH:MM:SS,mmm', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
    expect(formatSrtTime(3723004)).toBe('01:02:03,004')
    expect(formatSrtTime(-5)).toBe('00:00:00,000')
  })

  it('renders original text sorted by idx, skipping empty cues', () => {
    expect(toSrt(segments, 'text')).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nHello there.\n\n2\n00:00:01,600 --> 00:00:04,000\nWelcome to Vozia.\n',
    )
  })

  it('renders translations and returns empty string when nothing to render', () => {
    expect(toSrt(segments, 'translatedText')).toContain('Bem-vindo ao Vozia.')
    expect(toSrt([], 'text')).toBe('')
  })
})
