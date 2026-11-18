import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { AuthLayout } from '../AuthLayout'
import { MarketingLayout } from '../MarketingLayout'

describe('layouts', () => {
  it('marketing pages offer the theme switcher and a signup link', async () => {
    await renderWithProviders(
      <MarketingLayout>
        <p>content</p>
      </MarketingLayout>,
    )
    expect(screen.getAllByRole('radiogroup', { name: 'Theme' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Start for free' })).toHaveAttribute('href', '/signup')
  })

  it('marketing pages fill the window, and only a filling page stretches its content', async () => {
    const { unmount } = await renderWithProviders(
      <MarketingLayout>
        <p>content</p>
      </MarketingLayout>,
    )
    const plain = screen.getByRole('main')
    expect(plain.parentElement).toHaveClass('min-h-dvh', 'flex-col')
    expect(plain).toHaveClass('flex-1')
    expect(plain).not.toHaveClass('flex-col')
    unmount()

    await renderWithProviders(
      <MarketingLayout fill>
        <p>content</p>
      </MarketingLayout>,
    )
    expect(screen.getByRole('main')).toHaveClass('flex-1', 'flex', 'flex-col')
  })

  it('auth pages offer the theme switcher', async () => {
    await renderWithProviders(
      <AuthLayout title="Welcome back">
        <p>form</p>
      </AuthLayout>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})
