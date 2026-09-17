import { describe, expect, it } from 'vitest'
import { LANGUAGES, isLanguageCode, languageLabel } from '../languages.js'
import { STOCK_VOICES, isStockVoiceId } from '../voices.js'
import { FREE_MINUTES, PLANS, minutesToCharge } from '../plans.js'

describe('languages', () => {
  it('has 29 unique ISO codes including Portuguese', () => {
    expect(LANGUAGES).toHaveLength(29)
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(29)
    expect(LANGUAGES.some((l) => l.code === 'pt')).toBe(true)
  })

  it('validates and labels codes', () => {
    expect(isLanguageCode('ja')).toBe(true)
    expect(isLanguageCode('xx')).toBe(false)
    expect(languageLabel('de')).toBe('German')
    expect(languageLabel('zz')).toBe('zz')
  })
})

describe('stock voices', () => {
  it('exposes curated voices with unique ids', () => {
    expect(STOCK_VOICES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(STOCK_VOICES.map((v) => v.id)).size).toBe(STOCK_VOICES.length)
    expect(isStockVoiceId(STOCK_VOICES[0]!.id)).toBe(true)
    expect(isStockVoiceId('nope')).toBe(false)
  })
})

describe('plans and credits', () => {
  it('has a free plan matching the default quota', () => {
    const free = PLANS.find((p) => p.id === 'free')
    expect(free?.minutesPerMonth).toBe(FREE_MINUTES)
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'creator', 'studio'])
  })

  it('charges whole minutes, at least one', () => {
    expect(minutesToCharge(0)).toBe(1)
    expect(minutesToCharge(60)).toBe(1)
    expect(minutesToCharge(61)).toBe(2)
    expect(minutesToCharge(599.2)).toBe(10)
  })
})
