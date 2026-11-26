import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DubSegmentRow } from '@vozia/db'
import { RetakeDialog } from '../RetakeDialog'

const line: DubSegmentRow = {
  id: 7,
  dub_id: 'd1',
  idx: 6,
  start_ms: 21_100,
  end_ms: 22_240,
  speaker: null,
  text: 'um-- meu Deus!',
  translated_text: 'I should— oh my God!',
  performance: null,
}

function open(onSubmit = vi.fn(async (_text: string) => undefined), onClose = vi.fn()) {
  render(<RetakeDialog segment={line} sourceLang="pt" targetLang="en" onClose={onClose} onSubmit={onSubmit} />)
  return { onSubmit, onClose }
}

describe('RetakeDialog', () => {
  it('shows the original line and starts from the current words', async () => {
    open()
    const dialog = await screen.findByRole('dialog', { name: 'Re-take this line' })
    expect(dialog).toHaveTextContent('Original: um-- meu Deus!')
    expect(screen.getByLabelText('New words')).toHaveValue('I should— oh my God!')
  })

  it('sends the new words and closes', async () => {
    const { onSubmit, onClose } = open()
    const box = await screen.findByLabelText('New words')
    await userEvent.clear(box)
    await userEvent.type(box, '  I was gonna give it a— oh my God!  ')
    await userEvent.click(screen.getByRole('button', { name: 'Re-take line' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('I was gonna give it a— oh my God!'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('asks for words when the box is empty, and shows a refusal without closing', async () => {
    const refusing = vi.fn(async () => {
      throw new Error('Another line is being re-taken. Wait for it to finish, then try again.')
    })
    const { onClose } = open(refusing)
    const box = await screen.findByLabelText('New words')
    await userEvent.clear(box)
    await userEvent.click(screen.getByRole('button', { name: 'Re-take line' }))
    expect(await screen.findByText('Write the words of the line.')).toBeInTheDocument()
    expect(refusing).not.toHaveBeenCalled()

    await userEvent.type(box, 'Oh no!')
    await userEvent.click(screen.getByRole('button', { name: 'Re-take line' }))
    expect(await screen.findByText('Another line is being re-taken. Wait for it to finish, then try again.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
