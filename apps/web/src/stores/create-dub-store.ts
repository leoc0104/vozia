import { create } from 'zustand'
import { UploadFileSchema, YoutubeUrlSchema, isLanguageCode, isStockVoiceId, type VoiceMode } from '@vozia/shared'

export type SourceTab = 'upload' | 'youtube'

export interface CreateDubFields {
  sourceTab: SourceTab
  file: File | null
  youtubeUrl: string
  targetLanguage: string
  sourceLanguage: string | null
  voiceMode: VoiceMode
  stockVoiceId: string | null
  /** Set when adding a language to an existing video: no source is needed. */
  videoId: string | null
}

export type CreateDubErrors = Partial<Record<'source' | 'targetLanguage' | 'stockVoiceId', string>>

interface CreateDubState extends CreateDubFields {
  setField<K extends keyof CreateDubFields>(key: K, value: CreateDubFields[K]): void
  reset(videoId?: string | null): void
  validate(): { ok: boolean; errors: CreateDubErrors }
}

const initial: CreateDubFields = {
  sourceTab: 'upload',
  file: null,
  youtubeUrl: '',
  targetLanguage: 'es',
  sourceLanguage: null,
  voiceMode: 'clone',
  stockVoiceId: null,
  videoId: null,
}

export function validateCreateDub(fields: CreateDubFields): { ok: boolean; errors: CreateDubErrors } {
  const errors: CreateDubErrors = {}
  if (!fields.videoId) {
    if (fields.sourceTab === 'upload') {
      if (!fields.file) errors.source = 'Choose a video file to upload.'
      else {
        const check = UploadFileSchema.safeParse({ type: fields.file.type, size: fields.file.size })
        if (!check.success) errors.source = check.error.issues[0]?.message ?? 'Unsupported file.'
      }
    } else if (!YoutubeUrlSchema.safeParse(fields.youtubeUrl).success) {
      errors.source = 'Enter a valid YouTube video URL.'
    }
  }
  if (!isLanguageCode(fields.targetLanguage)) errors.targetLanguage = 'Choose a target language.'
  else if (fields.sourceLanguage && fields.sourceLanguage === fields.targetLanguage) {
    errors.targetLanguage = 'Source and target language must differ.'
  }
  if (fields.voiceMode === 'stock' && (!fields.stockVoiceId || !isStockVoiceId(fields.stockVoiceId))) {
    errors.stockVoiceId = 'Choose a stock voice.'
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export const useCreateDubStore = create<CreateDubState>()((set, get) => ({
  ...initial,
  setField: (key, value) => set({ [key]: value } as Partial<CreateDubFields>),
  reset: (videoId = null) => set({ ...initial, videoId }),
  validate: () => validateCreateDub(get()),
}))
