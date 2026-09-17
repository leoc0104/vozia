import * as tus from 'tus-js-client'
import { BUCKETS } from '@vozia/db'
import { env } from './env'

export interface UploadSourceOptions {
  file: File
  objectPath: string
  accessToken: string
  bucket?: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

const CHUNK_SIZE = 6 * 1024 * 1024

/** Resumable upload straight from the browser to Supabase Storage (TUS protocol). */
export function uploadSource(opts: UploadSourceOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(opts.file, {
      endpoint: `${env.supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${opts.accessToken}`, 'x-upsert': 'true' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: opts.bucket ?? BUCKETS.sources,
        objectName: opts.objectPath,
        contentType: opts.file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: CHUNK_SIZE,
      onError: (error) => reject(error),
      onProgress: (sent, total) => opts.onProgress?.(total > 0 ? sent / total : 0),
      onSuccess: () => resolve(),
    })
    opts.signal?.addEventListener('abort', () => {
      void upload.abort()
      reject(new DOMException('Upload cancelled', 'AbortError'))
    })
    upload.start()
  })
}
