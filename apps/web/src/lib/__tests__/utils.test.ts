import { cx, focusInput, focusRing, hasErrorInput, link } from '../utils'

describe('cx', () => {
  it('joins truthy classes and lets later Tailwind classes win', () => {
    expect(cx('px-2 py-1', false, null, 'px-4')).toBe('py-1 px-4')
    expect(cx('text-gray-500', { 'text-red-600': true })).toBe('text-red-600')
  })

  it('focus helpers use ink on light surfaces and yellow on dark ones', () => {
    expect(focusRing.join(' ')).toContain('outline-gray-950')
    expect(focusRing.join(' ')).toContain('dark:outline-brand-500')
    expect(focusInput.join(' ')).toContain('focus:border-gray-950')
    expect(focusInput.join(' ')).toContain('dark:focus:border-brand-500')
    expect(hasErrorInput.join(' ')).toContain('border-danger-500')
  })

  it('links are ink with a yellow marker line on light surfaces, and yellow on dark ones', () => {
    expect(link).toContain('text-gray-950')
    expect(link).toContain('decoration-brand-500')
    expect(link).toContain('dark:text-brand-400')
  })
})
