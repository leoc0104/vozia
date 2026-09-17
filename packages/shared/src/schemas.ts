import { z } from 'zod'
import { isLanguageCode } from './languages.js'
import { isStockVoiceId } from './voices.js'

export const SOURCE_TYPES = ['upload', 'youtube'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const VOICE_MODES = ['clone', 'stock'] as const
export type VoiceMode = (typeof VOICE_MODES)[number]

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function extractYoutubeId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null
  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0] ?? ''
    return YOUTUBE_ID.test(id) ? id : null
  }
  if (parsed.pathname === '/watch') {
    const id = parsed.searchParams.get('v') ?? ''
    return YOUTUBE_ID.test(id) ? id : null
  }
  const match = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/)
  return match ? match[1]! : null
}

export const YoutubeUrlSchema = z
  .string()
  .trim()
  .refine((value) => extractYoutubeId(value) !== null, 'Enter a valid YouTube video URL')

export const LanguageCodeSchema = z.string().refine(isLanguageCode, 'Unsupported language')

export const CreateDubInputSchema = z
  .object({
    videoId: z.uuid(),
    targetLanguage: LanguageCodeSchema,
    sourceLanguage: LanguageCodeSchema.nullable(),
    voiceMode: z.enum(VOICE_MODES),
    stockVoiceId: z.string().nullable(),
  })
  .refine((v) => v.voiceMode !== 'stock' || (v.stockVoiceId !== null && isStockVoiceId(v.stockVoiceId)), {
    message: 'Choose a stock voice',
    path: ['stockVoiceId'],
  })
  .refine((v) => v.sourceLanguage === null || v.sourceLanguage !== v.targetLanguage, {
    message: 'Source and target language must differ',
    path: ['targetLanguage'],
  })

export type CreateDubInput = z.infer<typeof CreateDubInputSchema>

export const DubJobMessageSchema = z.object({ dub_id: z.uuid() })
export type DubJobMessage = z.infer<typeof DubJobMessageSchema>

export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'] as const
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3

export const UploadFileSchema = z.object({
  type: z.string().refine((t) => (ALLOWED_VIDEO_MIME as readonly string[]).includes(t), 'Unsupported video format'),
  size: z.number().max(MAX_UPLOAD_BYTES, 'File is larger than 2 GB'),
})
