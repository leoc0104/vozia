import { render, screen } from '@testing-library/react'
import { Badge, Button, Progress } from '../index'
import { toneForStatus } from '../../../lib/status-ui'

describe('ui primitives', () => {
  it('renders button variants and a loading state', () => {
    render(<Button variant="danger" loading>Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.className).toContain('bg-red-600')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('clamps progress and exposes it to assistive tech', () => {
    render(<Progress value={140} label="Dub progress" />)
    expect(screen.getByRole('progressbar', { name: 'Dub progress' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('maps dub statuses to badge tones', () => {
    expect(toneForStatus('completed')).toBe('success')
    expect(toneForStatus('failed')).toBe('danger')
    expect(toneForStatus('queued')).toBe('neutral')
    expect(toneForStatus('translating')).toBe('info')
    render(<Badge tone="success">Done</Badge>)
    expect(screen.getByText('Done').className).toContain('bg-emerald-100')
  })
})
