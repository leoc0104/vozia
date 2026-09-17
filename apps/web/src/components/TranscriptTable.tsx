import type { DubSegmentRow } from '@vozia/db'
import { formatDuration } from '../lib/format'

export function TranscriptTable({ segments, sourceLabel, targetLabel }: { segments: DubSegmentRow[]; sourceLabel: string; targetLabel: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-4 py-2 font-medium">{sourceLabel}</th>
            <th className="px-4 py-2 font-medium">{targetLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {segments.map((segment) => (
            <tr key={segment.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-500">{formatDuration(segment.start_ms / 1000)}</td>
              <td className="px-4 py-2 text-slate-800">{segment.text}</td>
              <td className="px-4 py-2 text-slate-800">{segment.translated_text ?? <span className="text-slate-400">…</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
