export interface Segment {
  idx: number
  startMs: number
  endMs: number
  text: string
  translatedText?: string | null
  speaker?: string | null
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

export function formatSrtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`
}

export function toSrt(segments: readonly Segment[], field: 'text' | 'translatedText'): string {
  const blocks: string[] = []
  const ordered = [...segments].sort((a, b) => a.idx - b.idx)
  for (const segment of ordered) {
    const raw = field === 'text' ? segment.text : (segment.translatedText ?? '')
    const text = raw.trim()
    if (!text) continue
    blocks.push(`${blocks.length + 1}\n${formatSrtTime(segment.startMs)} --> ${formatSrtTime(segment.endMs)}\n${text}`)
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : ''
}
