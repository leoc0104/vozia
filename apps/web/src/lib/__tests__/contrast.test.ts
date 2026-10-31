import { describe, expect, it } from 'vitest'
import { contrastRatio, wcagLevel } from '../contrast'

describe('contrastRatio', () => {
  it('is 21:1 for black on white, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  it('matches the published ratio for a mid gray on white', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('weighs green more than red and red more than blue', () => {
    expect(contrastRatio('#ff0000', '#000000')).toBeCloseTo(5.25, 2)
    expect(contrastRatio('#00ff00', '#000000')).toBeCloseTo(15.3, 1)
    expect(contrastRatio('#0000ff', '#000000')).toBeCloseTo(2.44, 2)
  })

  it('accepts shorthand and uppercase hex', () => {
    expect(contrastRatio('#FFF', '#000')).toBeCloseTo(21, 5)
  })

  it('returns null when a color cannot be read', () => {
    expect(contrastRatio('', '#ffffff')).toBeNull()
    expect(contrastRatio('#ffffff', 'oklch(0.5 0.1 20)')).toBeNull()
  })
})

describe('wcagLevel', () => {
  it.each([
    [21, 'AAA'],
    [7, 'AAA'],
    [6.99, 'AA'],
    [4.5, 'AA'],
    [4.49, 'AA large'],
    [3, 'AA large'],
    [2.99, 'Fail'],
  ])('rates %s as %s', (ratio, level) => {
    expect(wcagLevel(ratio)).toBe(level)
  })
})
