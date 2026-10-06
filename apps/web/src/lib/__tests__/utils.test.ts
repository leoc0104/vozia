import { cx, focusInput, focusRing, hasErrorInput } from '../utils'

describe('cx', () => {
  it('joins truthy classes and lets later Tailwind classes win', () => {
    expect(cx('px-2 py-1', false, null, 'px-4')).toBe('py-1 px-4')
    expect(cx('text-gray-500', { 'text-red-600': true })).toBe('text-red-600')
  })

  it('exposes brand-coloured focus helpers', () => {
    expect(focusRing.join(' ')).toContain('outline-brand-500')
    expect(focusInput.join(' ')).toContain('focus:border-brand-500')
    expect(hasErrorInput.join(' ')).toContain('border-red-500')
  })
})
