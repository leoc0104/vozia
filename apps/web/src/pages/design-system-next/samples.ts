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

export const SAMPLE_VIDEOS: VideoWithDubs[] = [
  video('sample-short-film', 'A short film', 42, [dub('film-pt', 'pt', 'completed', 100), dub('film-es', 'es', 'completed', 100)]),
  video('sample-astronomy', 'Astronomy lecture', 3125, [dub('talk-pt', 'pt', 'translating', 45)]),
  video('sample-cooking', 'Cooking class', 610, [dub('food-pt', 'pt', 'completed', 100), dub('food-en', 'en', 'failed', 30)]),
]

const segment = (idx: number, start_ms: number, text: string, translated_text: string): DubSegmentRow => ({
  id: idx,
  dub_id: 'film-pt',
  idx,
  start_ms,
  end_ms: start_ms + 2000,
  speaker: null,
  text,
  translated_text,
})

export const SAMPLE_SEGMENTS: DubSegmentRow[] = [
  segment(0, 0, 'こんにちは、映画へようこそ。', 'Olá, e boas-vindas ao filme.'),
  segment(1, 3000, '今日は新しい物語をお見せします。', 'Hoje vamos mostrar uma nova história.'),
  segment(2, 6000, 'もうすぐ始まります。', 'Já vai começar.'),
]

/** Languages shown by their own name, in their own script. Never as flags: a language is not a country. */
export const LANGUAGE_NAMES: { code: string; name: string; rtl?: boolean }[] = [
  { code: 'ja', name: '日本語' },
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'ru', name: 'Русский' },
  { code: 'ta', name: 'தமிழ்' },
]

export function languageName(code: string): string {
  return LANGUAGE_NAMES.find((language) => language.code === code)?.name ?? code
}
