/** WCAG 2 contrast maths. The design system page uses it to report real numbers from the live theme. */

export type WcagLevel = 'AAA' | 'AA' | 'AA large' | 'Fail'

function channel(value: number): number {
  const s = value / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const digits = match[1]!
  const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits
  const red = channel(parseInt(full.slice(0, 2), 16))
  const green = channel(parseInt(full.slice(2, 4), 16))
  const blue = channel(parseInt(full.slice(4, 6), 16))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The contrast between two hex colors, from 1 to 21. Null when either color cannot be read. */
export function contrastRatio(a: string, b: string): number | null {
  const first = luminance(a)
  const second = luminance(b)
  if (first === null || second === null) return null
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA large'
  return 'Fail'
}
