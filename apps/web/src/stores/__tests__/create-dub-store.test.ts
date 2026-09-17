import { STOCK_VOICES } from '@vozia/shared'
import { describe, expect, it } from 'vitest'
import { useCreateDubStore, validateCreateDub, type CreateDubFields } from '../create-dub-store'

const base: CreateDubFields = {
  sourceTab: 'youtube',
  file: null,
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
  targetLanguage: 'pt',
  sourceLanguage: null,
  voiceMode: 'clone',
  stockVoiceId: null,
  videoId: null,
}

describe('validateCreateDub', () => {
  it('accepts a valid YouTube request', () => {
    expect(validateCreateDub(base)).toEqual({ ok: true, errors: {} })
  })

  it('requires a source unless adding to an existing video', () => {
    expect(validateCreateDub({ ...base, youtubeUrl: 'nope' }).errors.source).toBe('Enter a valid YouTube video URL.')
    expect(validateCreateDub({ ...base, sourceTab: 'upload' }).errors.source).toBe('Choose a video file to upload.')
    const bad = new File(['x'], 'song.mp3', { type: 'audio/mpeg' })
    expect(validateCreateDub({ ...base, sourceTab: 'upload', file: bad }).errors.source).toBe('Unsupported video format')
    expect(validateCreateDub({ ...base, youtubeUrl: '', videoId: 'v1' }).ok).toBe(true)
  })

  it('checks languages and stock voices', () => {
    expect(validateCreateDub({ ...base, targetLanguage: 'xx' }).errors.targetLanguage).toBe('Choose a target language.')
    expect(validateCreateDub({ ...base, sourceLanguage: 'pt' }).errors.targetLanguage).toBe('Source and target language must differ.')
    expect(validateCreateDub({ ...base, voiceMode: 'stock' }).errors.stockVoiceId).toBe('Choose a stock voice.')
    expect(validateCreateDub({ ...base, voiceMode: 'stock', stockVoiceId: STOCK_VOICES[0]!.id }).ok).toBe(true)
  })
})

describe('useCreateDubStore', () => {
  it('sets fields and resets with an optional video id', () => {
    const store = useCreateDubStore.getState()
    store.setField('targetLanguage', 'ja')
    expect(useCreateDubStore.getState().targetLanguage).toBe('ja')
    store.reset('v1')
    expect(useCreateDubStore.getState()).toMatchObject({ targetLanguage: 'es', videoId: 'v1' })
    expect(useCreateDubStore.getState().validate().ok).toBe(true)
  })
})
