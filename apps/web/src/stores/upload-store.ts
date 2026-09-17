import { create } from 'zustand'

export interface UploadEntry {
  fraction: number
  status: 'uploading' | 'done' | 'error'
  error: string | null
}

interface UploadState {
  uploads: Record<string, UploadEntry>
  start(id: string): void
  progress(id: string, fraction: number): void
  finish(id: string): void
  fail(id: string, message: string): void
  clear(id: string): void
}

export const useUploadStore = create<UploadState>()((set) => ({
  uploads: {},
  start: (id) => set((s) => ({ uploads: { ...s.uploads, [id]: { fraction: 0, status: 'uploading', error: null } } })),
  progress: (id, fraction) =>
    set((s) => {
      const entry = s.uploads[id]
      if (!entry) return s
      return { uploads: { ...s.uploads, [id]: { ...entry, fraction: Math.min(1, Math.max(entry.fraction, fraction)) } } }
    }),
  finish: (id) => set((s) => ({ uploads: { ...s.uploads, [id]: { fraction: 1, status: 'done', error: null } } })),
  fail: (id, message) => set((s) => ({ uploads: { ...s.uploads, [id]: { ...(s.uploads[id] ?? { fraction: 0 }), status: 'error', error: message } } })),
  clear: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.uploads
      return { uploads: rest }
    }),
}))
