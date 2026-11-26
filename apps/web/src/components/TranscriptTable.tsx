import { useEffect, useRef, type ReactNode } from 'react'
import type { DubSegmentRow } from '@vozia/db'
import { readLinePerformance, type LinePerformance } from '@vozia/shared'
import { formatDuration } from '../lib/format'
import { spokenIndex } from '../lib/transcript'
import { cx, focusRing } from '../lib/utils'
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from './ui'

export interface TranscriptTableProps {
  segments: DubSegmentRow[]
  sourceLabel: ReactNode
  targetLabel: ReactNode
  /** Language codes for the two columns, so each script gets the right font and screen reader voice. */
  sourceLang?: string | null
  targetLang?: string
  /** The playback position: the line spoken at that moment gets the yellow marker. */
  currentMs?: number | null
  /** Which text the marker follows: the translation while the dub plays, the original while the original voice plays. */
  markColumn?: 'source' | 'target'
  /** When given, each line's time becomes a button that plays the video from that line. */
  onSeek?: (ms: number) => void
}

const MARKER = 'rounded-sm bg-brand-500 px-1 text-gray-950 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]'

/** A word tied to the picture this far off is worth pointing out. */
const OFF_MS = 250

/** What happened to a line on its way into the dub, as small labels: re-recorded, reworded, still off the picture. */
function LineNotes({ performance }: { performance: LinePerformance }) {
  const off = performance.worstWordMs
  const labels = [
    performance.revised ? { text: 'Reworded', variant: 'info' as const } : null,
    !performance.revised && performance.takes > 1 ? { text: 'Re-taken', variant: 'neutral' as const } : null,
    off !== null && Math.abs(off) > OFF_MS
      ? { text: `${(Math.abs(off) / 1000).toFixed(1)} s ${off > 0 ? 'late' : 'early'}`, variant: 'warning' as const }
      : null,
  ].filter((label) => label !== null)
  if (labels.length === 0) return null
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {labels.map((label) => (
        <Badge key={label.text} variant={label.variant}>
          {label.text}
        </Badge>
      ))}
    </span>
  )
}

/** The transcript, read like a script: timecode, original and translation, with a marker on the line being heard. */
export function TranscriptTable({
  segments,
  sourceLabel,
  targetLabel,
  sourceLang,
  targetLang,
  currentMs = null,
  markColumn = 'target',
  onSeek,
}: TranscriptTableProps) {
  const box = useRef<HTMLDivElement>(null)
  const spoken = currentMs === null ? -1 : spokenIndex(segments, currentMs)

  // Keep the spoken line in view by scrolling the transcript's own box, never the page under the video.
  useEffect(() => {
    const scroller = box.current
    const row = scroller?.querySelector<HTMLElement>('tr[aria-current="true"]')
    if (!scroller || !row) return
    const view = scroller.getBoundingClientRect()
    const line = row.getBoundingClientRect()
    if (line.top < view.top || line.bottom > view.bottom) scroller.scrollTop += line.top - view.top - view.height / 3
  }, [spoken])

  return (
    <Card className="overflow-hidden p-0">
      <TableRoot ref={box} className="max-h-[32rem] whitespace-normal">
        <Table className="border-b-0">
          <TableHead className="sticky top-0 z-10 bg-white dark:bg-gray-950">
            <TableRow>
              <TableHeaderCell className="w-20">Time</TableHeaderCell>
              <TableHeaderCell>{sourceLabel}</TableHeaderCell>
              <TableHeaderCell>{targetLabel}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {segments.map((segment, index) => {
              const isSpoken = index === spoken
              const time = formatDuration(segment.start_ms / 1000)
              const text = (content: string, column: 'source' | 'target') =>
                isSpoken && markColumn === column ? <mark className={MARKER}>{content}</mark> : content
              const performance = readLinePerformance(segment.performance)
              return (
                <TableRow key={segment.id} aria-current={isSpoken ? 'true' : undefined} className="align-top">
                  <TableCell className="whitespace-nowrap font-mono text-xs text-gray-500 dark:text-gray-400">
                    {onSeek ? (
                      <button
                        type="button"
                        onClick={() => onSeek(segment.start_ms)}
                        aria-label={`Play from ${time}`}
                        className={cx('rounded-xs hover:text-gray-950 dark:hover:text-gray-50', focusRing)}
                      >
                        {time}
                      </button>
                    ) : (
                      time
                    )}
                  </TableCell>
                  <TableCell dir="auto" lang={sourceLang ?? undefined} className="break-words text-base text-gray-600 dark:text-gray-400">
                    {text(segment.text, 'source')}
                  </TableCell>
                  <TableCell
                    dir="auto"
                    lang={targetLang}
                    title={performance?.spoken}
                    className="break-words text-base text-gray-900 dark:text-gray-50"
                  >
                    {segment.translated_text === null ? (
                      <span className="text-gray-400 dark:text-gray-400">…</span>
                    ) : (
                      text(segment.translated_text, 'target')
                    )}
                    {performance ? <LineNotes performance={performance} /> : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>
    </Card>
  )
}
