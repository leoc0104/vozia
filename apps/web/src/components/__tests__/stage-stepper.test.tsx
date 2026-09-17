import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StageStepper } from '../StageStepper'
import { stepStates } from '../../lib/status-ui'

describe('stepStates', () => {
  it('marks stages before the current one as done', () => {
    expect(stepStates('staged', 'translating', null).map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'pending', 'pending'])
  })

  it('marks the failed stage and everything after it', () => {
    expect(stepStates('staged', 'failed', 'muxing').map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'failed'])
    expect(stepStates('staged', 'completed', null).every((s) => s.state === 'done')).toBe(true)
  })
})

describe('StageStepper', () => {
  it('renders the staged pipeline with a progress bar on the current step', () => {
    render(<StageStepper pipeline="staged" status="synthesizing" progress={70} failedStage={null} />)
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.dataset.state)).toEqual(['done', 'done', 'done', 'done', 'current', 'pending'])
    expect(screen.getByRole('progressbar', { name: 'Generating voice progress' })).toHaveAttribute('aria-valuenow', '70')
  })

  it('renders a single progress bar for the end-to-end pipeline and a waiting note when queued', () => {
    render(<StageStepper pipeline="elevenlabs" status="dubbing" progress={40} failedStage={null} />)
    expect(screen.getByRole('progressbar', { name: 'Dub progress' })).toHaveAttribute('aria-valuenow', '40')
    render(<StageStepper pipeline={null} status="queued" progress={0} failedStage={null} />)
    expect(screen.getByText(/waiting for a worker/i)).toBeInTheDocument()
  })
})
