import type { DubSegmentRow } from '@vozia/db'
import type { DubSummary, VideoWithDubs } from '../../lib/api'

const DATE = '2026-10-31T12:00:00Z'

const dub = (id: string, target_language: string, status: DubSummary['status'], progress: number): DubSummary => ({
  id,
  target_language,
  status,
  progress,
  created_at: DATE,
  output_path: status === 'completed' ? 'sample/output.mp4' : null,
})

export const SAMPLE_DUBS: DubSummary[] = [dub('sample-1', 'pt', 'completed', 100), dub('sample-2', 'ja', 'translating', 45)]

const video = (id: string, title: string, duration_seconds: number, dubs: DubSummary[]): VideoWithDubs => ({
  id,
  owner_id: 'sample',
  title,
  source_type: 'upload',
  source_url: null,
  storage_path: null,
  duration_seconds,
  thumbnail_path: null,
  created_at: DATE,
  updated_at: DATE,
  dubs,
})

export const SAMPLE_VIDEO = video('sample-launch', 'Product launch', 125, SAMPLE_DUBS)

const segment = (idx: number, start_ms: number, text: string, translated_text: string | null): DubSegmentRow => ({
  id: idx,
  dub_id: 'sample-1',
  idx,
  start_ms,
  end_ms: start_ms + 2000,
  speaker: null,
  text,
  translated_text,
})

export const SAMPLE_SEGMENTS: DubSegmentRow[] = [
  segment(0, 0, 'Hello, and welcome to the product launch.', 'Olá, e boas-vindas ao lançamento do produto.'),
  segment(1, 3000, 'Today we are showing the new dashboard.', 'Hoje vamos mostrar o novo painel.'),
  segment(2, 6000, 'It takes less than a minute to set up.', null),
]
