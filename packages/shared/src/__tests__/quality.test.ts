import { describe, expect, it } from 'vitest'
import { readDubQuality, readLinePerformance } from '../quality.js'

describe('readDubQuality', () => {
  it('reads a stored report and fills what an older one lacks', () => {
    expect(readDubQuality({ version: 1, measured: true, lines: 14, inSync: 12, worstWordMs: 320, retaken: 4 })).toEqual({
      version: 1,
      measured: true,
      lines: 14,
      inSync: 12,
      worstWordMs: 320,
      retaken: 4,
      revised: 0,
      pitchOffsetSt: null,
      pitchCorrectedSt: 0,
      voiceMatched: false,
      bandwidthHz: null,
      room: false,
      captions: 0,
    })
  })

  it('refuses anything that is not a report', () => {
    for (const value of [null, 'x', [], { version: 2, lines: 1, inSync: 1 }, { version: 1, lines: '14' }]) {
      expect(readDubQuality(value)).toBeNull()
    }
  })
})

describe('readLinePerformance', () => {
  it('reads how a line was performed, keeping only the parts with the right shape', () => {
    expect(readLinePerformance({ spoken: '[panicked] Help!', takes: 2, revised: true, worstWordMs: 90, notes: ['x', 3], sounds: 'laugh' })).toEqual({
      spoken: '[panicked] Help!',
      takes: 2,
      revised: true,
      worstWordMs: 90,
      length: null,
      overflowMs: 0,
      notes: ['x'],
      sounds: [],
    })
    expect(readLinePerformance({ takes: 1 })).toBeNull()
  })
})
