import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Levels } from '../Levels'
import { Spinner } from '../ui'

describe('Levels', () => {
  it('draws the requested number of bars and hides them from screen readers', () => {
    const { container } = render(<Levels bars={9} />)
    const levels = container.querySelector('[data-levels]')
    expect(levels).toHaveAttribute('aria-hidden', 'true')
    expect(levels?.children).toHaveLength(9)
  })

  it('only moves when animated', () => {
    const { container, rerender } = render(<Levels bars={3} />)
    expect(container.querySelector('[data-levels]')?.children[0]?.className).not.toContain('animate-level')
    rerender(<Levels bars={3} animated />)
    expect(container.querySelector('[data-levels]')?.children[0]?.className).toContain('animate-level')
  })
})

describe('Spinner', () => {
  it('announces loading while drawing voice levels', () => {
    const { container } = render(<Spinner />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(container.querySelector('[data-levels]')).toBeInTheDocument()
  })
})
