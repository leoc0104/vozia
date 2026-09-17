import { describe, expect, it, vi } from 'vitest'

const { created } = vi.hoisted(() => ({ created: [] as { file: File; options: Record<string, unknown> }[] }))
vi.mock('tus-js-client', () => ({
  Upload: class {
    file: File
    options: Record<string, unknown>
    constructor(file: File, options: Record<string, unknown>) {
      this.file = file
      this.options = options
      created.push({ file, options })
    }
    start() {
      const opts = this.options as { onProgress(sent: number, total: number): void; onSuccess(): void; onError(e: Error): void }
      if (this.file.name === 'broken.mp4') {
        opts.onError(new Error('tus: unexpected response'))
        return
      }
      opts.onProgress(3, 6)
      opts.onProgress(6, 6)
      opts.onSuccess()
    }
    abort() {}
  },
}))

import { uploadSource } from '../upload'

describe('uploadSource', () => {
  it('configures the resumable upload for Supabase Storage and reports progress', async () => {
    const file = new File(['abc'], 'clip.mp4', { type: 'video/mp4' })
    const progress: number[] = []
    await uploadSource({ file, objectPath: 'u/v/original.mp4', accessToken: 'tok', onProgress: (f) => progress.push(f) })
    expect(progress).toEqual([0.5, 1])
    const { options } = created.at(-1)!
    expect(options.endpoint).toBe('http://localhost:54321/storage/v1/upload/resumable')
    expect(options.headers).toEqual({ authorization: 'Bearer tok', 'x-upsert': 'true' })
    expect(options.metadata).toEqual({ bucketName: 'sources', objectName: 'u/v/original.mp4', contentType: 'video/mp4', cacheControl: '3600' })
    expect(options.chunkSize).toBe(6 * 1024 * 1024)
    expect(options.uploadDataDuringCreation).toBe(true)
  })

  it('rejects when tus reports an error', async () => {
    const file = new File(['abc'], 'broken.mp4', { type: 'video/mp4' })
    await expect(uploadSource({ file, objectPath: 'x', accessToken: 't' })).rejects.toThrow('tus: unexpected response')
  })
})
