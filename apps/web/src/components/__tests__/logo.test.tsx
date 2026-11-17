import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { Logo, LogoMark, LogoMarkOnInk, StandaloneWordmark } from '../Logo'

describe('logo parts', () => {
  it('puts the ink mark on a yellow tile', () => {
    const { container } = render(<LogoMark />)
    expect(container.querySelector('rect')).toHaveAttribute('fill', 'var(--color-brand-500)')
    expect([...container.querySelectorAll('path')].map((path) => path.getAttribute('stroke'))).toEqual([
      'var(--color-gray-950)',
      'var(--color-gray-950)',
    ])
  })

  it('only gives the capsule its yellow when the mark sits on ink', () => {
    const { container } = render(<LogoMarkOnInk />)
    expect(container.querySelector('rect')).toBeNull()
    expect(container.querySelectorAll('path')[1]).toHaveAttribute('stroke', 'var(--color-brand-500)')
  })

  it('keeps a plain dot on light surfaces and the yellow capsule on dark ones when the wordmark stands alone', () => {
    const { container } = render(<StandaloneWordmark />)
    const [light, dark] = container.querySelectorAll('svg')
    expect(light).toHaveClass('dark:hidden')
    expect(light!.querySelector('circle')).not.toBeNull()
    expect(dark).toHaveClass('hidden', 'dark:block')
    expect(dark!.querySelector('rect')).toHaveAttribute('fill', 'var(--color-brand-500)')
  })
})

describe('Logo', () => {
  it('is a link named Vozia that goes home by default', async () => {
    await renderWithProviders(<Logo />)
    expect(screen.getByRole('link', { name: 'Vozia' })).toHaveAttribute('href', '/')
  })

  it('can point somewhere else', async () => {
    await renderWithProviders(<Logo to="/app" />)
    expect(screen.getByRole('link', { name: 'Vozia' })).toHaveAttribute('href', '/app')
  })
})
