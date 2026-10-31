import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { Logo } from '../Logo'

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
