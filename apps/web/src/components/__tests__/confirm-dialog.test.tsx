import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'
import { Button } from '../ui'

function renderDialog(onConfirm: () => Promise<void> | void = vi.fn()) {
  render(
    <ConfirmDialog
      trigger={<Button variant="destructive">Delete</Button>}
      title="Delete this dub?"
      description="This removes the dubbed video and its subtitles."
      confirmLabel="Delete"
      onConfirm={onConfirm}
    />,
  )
  return onConfirm
}

describe('ConfirmDialog', () => {
  it('opens from its trigger with the title and description', async () => {
    renderDialog()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this dub?' })
    expect(dialog).toHaveTextContent('This removes the dubbed video and its subtitles.')
  })

  it('closes on Cancel without running the action', async () => {
    const onConfirm = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes on Escape without running the action', async () => {
    const onConfirm = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('runs the action once when confirmed', async () => {
    const onConfirm = renderDialog(vi.fn(async () => undefined))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })
})
