import type { DubSegmentRow } from '@vozia/db'
import { formatDuration } from '../lib/format'
import { Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from './ui-next'

export function TranscriptTable({ segments, sourceLabel, targetLabel }: { segments: DubSegmentRow[]; sourceLabel: string; targetLabel: string }) {
  return (
    <Card className="overflow-hidden p-0">
      <TableRoot className="whitespace-normal">
        <Table className="border-b-0">
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-20">Time</TableHeaderCell>
              <TableHeaderCell>{sourceLabel}</TableHeaderCell>
              <TableHeaderCell>{targetLabel}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {segments.map((segment) => (
              <TableRow key={segment.id} className="align-top">
                <TableCell className="whitespace-nowrap font-mono text-xs text-gray-500 dark:text-gray-500">
                  {formatDuration(segment.start_ms / 1000)}
                </TableCell>
                <TableCell className="break-words text-gray-800 dark:text-gray-200">{segment.text}</TableCell>
                <TableCell className="break-words text-gray-800 dark:text-gray-200">
                  {segment.translated_text ?? <span className="text-gray-400 dark:text-gray-500">…</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </Card>
  )
}
