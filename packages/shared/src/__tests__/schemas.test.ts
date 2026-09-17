import { describe, expect, it } from 'vitest'
import {
  CreateDubInputSchema,
  DubJobMessageSchema,
  UploadFileSchema,
  YoutubeUrlSchema,
  extractYoutubeId,
} from '../schemas.js'
import { INSUFFICIENT_MINUTES_CODE, isInsufficientMinutesError } from '../errors.js'
import { STOCK_VOICES } from '../voices.js'

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('youtube urls', () => {
  it('extracts ids from the common url shapes', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x')).toBe('dQw4w9WgXcQ')
  })

  it('rejects other hosts and malformed ids', () => {
    expect(extractYoutubeId('https://vimeo.com/12345')).toBeNull()
    expect(extractYoutubeId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(extractYoutubeId('not a url')).toBeNull()
    expect(YoutubeUrlSchema.safeParse('https://example.com').success).toBe(false)
    expect(YoutubeUrlSchema.safeParse(' https://youtu.be/dQw4w9WgXcQ ').success).toBe(true)
  })
})

describe('CreateDubInputSchema', () => {
  const base = { videoId: uuid, targetLanguage: 'pt', sourceLanguage: null, voiceMode: 'clone', stockVoiceId: null }

  it('accepts a clone request', () => {
    expect(CreateDubInputSchema.safeParse(base).success).toBe(true)
  })

  it('requires a known stock voice in stock mode', () => {
    expect(CreateDubInputSchema.safeParse({ ...base, voiceMode: 'stock' }).success).toBe(false)
    expect(CreateDubInputSchema.safeParse({ ...base, voiceMode: 'stock', stockVoiceId: 'bogus' }).success).toBe(false)
    expect(
      CreateDubInputSchema.safeParse({ ...base, voiceMode: 'stock', stockVoiceId: STOCK_VOICES[0]!.id }).success,
    ).toBe(true)
  })

  it('rejects unsupported languages and identical source/target', () => {
    expect(CreateDubInputSchema.safeParse({ ...base, targetLanguage: 'xx' }).success).toBe(false)
    expect(CreateDubInputSchema.safeParse({ ...base, sourceLanguage: 'pt' }).success).toBe(false)
  })
})

describe('other schemas', () => {
  it('validates queue payloads and upload files', () => {
    expect(DubJobMessageSchema.safeParse({ dub_id: uuid }).success).toBe(true)
    expect(DubJobMessageSchema.safeParse({ dub_id: 'x' }).success).toBe(false)
    expect(UploadFileSchema.safeParse({ type: 'video/mp4', size: 1024 }).success).toBe(true)
    expect(UploadFileSchema.safeParse({ type: 'audio/mp3', size: 1024 }).success).toBe(false)
    expect(UploadFileSchema.safeParse({ type: 'video/mp4', size: 3 * 1024 ** 3 }).success).toBe(false)
  })

  it('recognises the insufficient minutes database error', () => {
    expect(isInsufficientMinutesError(new Error(`P0001: ${INSUFFICIENT_MINUTES_CODE}`))).toBe(true)
    expect(isInsufficientMinutesError({ message: 'insufficient_minutes', code: 'P0001' })).toBe(true)
    expect(isInsufficientMinutesError(new Error('network'))).toBe(false)
    expect(isInsufficientMinutesError(null)).toBe(false)
  })
})
