import { screen } from '@testing-library/react'
import { PLANS } from '@vozia/shared'
import { renderWithProviders } from '../../test/render'
import { LandingPage } from '../Landing'
import { PricingPage } from '../Pricing'

describe('marketing pages', () => {
  it('lists every plan with its price', async () => {
    await renderWithProviders(<PricingPage />, { path: '/pricing', routePath: '/pricing' })
    for (const plan of PLANS) {
      expect(screen.getByRole('heading', { name: plan.name })).toBeInTheDocument()
    }
    expect(screen.getByText('$29')).toBeInTheDocument()
  })

  it('shows the hero with a signup call to action', async () => {
    await renderWithProviders(<LandingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/in your own voice/i)
    expect(screen.getAllByRole('link', { name: /dub your first video free/i })[0]).toHaveAttribute('href', '/signup')
  })
})
