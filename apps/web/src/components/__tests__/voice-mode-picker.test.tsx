import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { STOCK_VOICES } from '@vozia/shared'
import { VoiceModePicker } from '../VoiceModePicker'

describe('VoiceModePicker', () => {
  it('offers both voice modes as radio cards with the current one checked', () => {
    render(<VoiceModePicker voiceMode="clone" stockVoiceId={null} onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Voice' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /keep my voice/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /stock voice/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByLabelText('Stock voice')).not.toBeInTheDocument()
  })

  it('switches to a stock voice, preselecting the first one', async () => {
    const onChange = vi.fn()
    render(<VoiceModePicker voiceMode="clone" stockVoiceId={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: /stock voice/i }))
    expect(onChange).toHaveBeenCalledWith({ voiceMode: 'stock', stockVoiceId: STOCK_VOICES[0]!.id })
  })

  it('lets the user pick another stock voice', async () => {
    const onChange = vi.fn()
    render(<VoiceModePicker voiceMode="stock" stockVoiceId={STOCK_VOICES[0]!.id} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Stock voice'), STOCK_VOICES[2]!.id)
    expect(onChange).toHaveBeenCalledWith({ voiceMode: 'stock', stockVoiceId: STOCK_VOICES[2]!.id })
  })
})
