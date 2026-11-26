import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DubSegmentRow } from '@vozia/db'
import { TranscriptTable } from '../TranscriptTable'

const longSentence = `${'This is a very long sentence that keeps going without a break '.repeat(5)}end.`

const segments: DubSegmentRow[] = [
  { id: 1, dub_id: 'd1', idx: 0, start_ms: 0, end_ms: 1500, speaker: null, text: 'Hello there.', translated_text: 'Olá.', performance: null },
  { id: 2, dub_id: 'd1', idx: 1, start_ms: 61_000, end_ms: 70_000, speaker: null, text: longSentence, translated_text: null, performance: null },
]

describe('TranscriptTable', () => {
  it('shows each segment with its timestamp, original and translation', () => {
    render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" />)
    expect(screen.getByRole('columnheader', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Portuguese' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Olá.' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1:01' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '…' })).toBeInTheDocument()
  })

  it('wraps long sentences instead of widening the page', () => {
    render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" />)
    expect(longSentence.length).toBeGreaterThan(300)
    const cell = screen.getByRole('cell', { name: longSentence })
    expect(cell.className).toContain('break-words')
    expect(cell.closest('table')?.parentElement?.className).toContain('whitespace-normal')
  })

  it('lets each line follow its own writing direction, so Arabic reads right to left', () => {
    const arabic: DubSegmentRow[] = [
      { id: 3, dub_id: 'd1', idx: 0, start_ms: 0, end_ms: 1500, speaker: null, text: 'مرحبا بكم', translated_text: 'Welcome', performance: null },
    ]
    render(<TranscriptTable segments={arabic} sourceLabel="Arabic" targetLabel="English" />)
    expect(screen.getByRole('cell', { name: 'مرحبا بكم' })).toHaveAttribute('dir', 'auto')
    expect(screen.getByRole('cell', { name: 'Welcome' })).toHaveAttribute('dir', 'auto')
  })

  it('tags each column with its language, so each script gets the right font', () => {
    render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" sourceLang="en" targetLang="pt" />)
    expect(screen.getByRole('cell', { name: 'Hello there.' })).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('cell', { name: 'Olá.' })).toHaveAttribute('lang', 'pt')
  })

  it('puts the marker on the line being heard in the dub', () => {
    const { container } = render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" currentMs={700} />)
    const row = container.querySelector<HTMLElement>('tr[aria-current="true"]')
    expect(row).not.toBeNull()
    expect(within(row!).getByText('Olá.').tagName).toBe('MARK')
    expect(within(row!).getByText('Hello there.').tagName).not.toBe('MARK')
  })

  it('moves the marker to the original text while the original voice plays', () => {
    render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" currentMs={700} markColumn="source" />)
    expect(screen.getByText('Hello there.').tagName).toBe('MARK')
    expect(screen.getByText('Olá.').tagName).not.toBe('MARK')
  })

  it('marks nothing while nobody is speaking', () => {
    const { container } = render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" currentMs={30_000} />)
    expect(container.querySelector('tr[aria-current]')).toBeNull()
    expect(container.querySelector('mark')).toBeNull()
  })

  it('plays from a line when its time is pressed', async () => {
    const onSeek = vi.fn()
    render(<TranscriptTable segments={segments} sourceLabel="English" targetLabel="Portuguese" onSeek={onSeek} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play from 1:01' }))
    expect(onSeek).toHaveBeenCalledWith(61_000)
  })

  it('offers to re-take each line, and labels the one being re-taken while no other can be', async () => {
    const onRetake = vi.fn()
    const { rerender } = render(<TranscriptTable segments={segments.slice(0, 1)} sourceLabel="English" targetLabel="Portuguese" onRetake={onRetake} />)
    await userEvent.click(screen.getByRole('button', { name: 'Re-take the line at 0:00' }))
    expect(onRetake).toHaveBeenCalledWith(segments[0])
    rerender(<TranscriptTable segments={segments.slice(0, 1)} sourceLabel="English" targetLabel="Portuguese" onRetake={onRetake} retakingIdx={0} />)
    expect(screen.getByText('Re-taking')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Re-take the line/ })).not.toBeInTheDocument()
    rerender(<TranscriptTable segments={segments.slice(0, 1)} sourceLabel="English" targetLabel="Portuguese" onRetake={onRetake} retakingIdx={5} />)
    expect(screen.getByRole('button', { name: 'Re-take the line at 0:00' })).toBeDisabled()
  })

  it('labels lines that were re-recorded, reworded or still land off the picture, and shows the directions on hover', () => {
    const performed = (performance: object): DubSegmentRow => ({ ...segments[0]!, performance: { spoken: '[panicked] Olá.', notes: [], sounds: [], ...performance } as never })
    const { rerender } = render(
      <TranscriptTable segments={[performed({ takes: 2, revised: true, worstWordMs: 420 })]} sourceLabel="English" targetLabel="Portuguese" />,
    )
    expect(screen.getByText('Reworded')).toBeInTheDocument()
    expect(screen.getByText('0.4 s late')).toBeInTheDocument()
    expect(screen.getByText('Olá.').closest('td')).toHaveAttribute('title', '[panicked] Olá.')
    rerender(<TranscriptTable segments={[performed({ takes: 2, revised: false, worstWordMs: 40 })]} sourceLabel="English" targetLabel="Portuguese" />)
    expect(screen.getByText('Re-taken')).toBeInTheDocument()
    expect(screen.queryByText(/late|early/)).not.toBeInTheDocument()
    rerender(<TranscriptTable segments={[performed({ takes: 1, revised: false, worstWordMs: 0 })]} sourceLabel="English" targetLabel="Portuguese" />)
    expect(screen.queryByText('Re-taken')).not.toBeInTheDocument()
  })
})
