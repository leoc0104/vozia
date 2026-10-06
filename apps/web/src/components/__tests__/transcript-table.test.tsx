import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DubSegmentRow } from '@vozia/db'
import { TranscriptTable } from '../TranscriptTable'

const longSentence = `${'This is a very long sentence that keeps going without a break '.repeat(5)}end.`

const segments: DubSegmentRow[] = [
  { id: 1, dub_id: 'd1', idx: 0, start_ms: 0, end_ms: 1500, speaker: null, text: 'Hello there.', translated_text: 'Olá.' },
  { id: 2, dub_id: 'd1', idx: 1, start_ms: 61_000, end_ms: 70_000, speaker: null, text: longSentence, translated_text: null },
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
})
