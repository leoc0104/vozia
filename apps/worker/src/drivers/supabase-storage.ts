import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { VoziaClient } from '@vozia/db'
import type { ObjectStorage } from '../pipeline/contracts.js'
import { ProviderError } from '../pipeline/errors.js'

/** Service-role access to Supabase Storage; downloads stream through a short-lived signed URL. */
export class SupabaseObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: VoziaClient,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async download(bucket: string, objectPath: string, destPath: string): Promise<void> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(objectPath, 600)
    if (error || !data) {
      throw new ProviderError('storage', `The source file ${bucket}/${objectPath} is missing.`, { cause: error })
    }
    const response = await this.fetchImpl(data.signedUrl)
    if (!response.ok || !response.body) {
      throw new ProviderError('storage', `Could not download ${bucket}/${objectPath} (HTTP ${response.status}).`, {
        status: response.status,
      })
    }
    await mkdir(path.dirname(destPath), { recursive: true })
    await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream), createWriteStream(destPath))
  }

  async upload(bucket: string, objectPath: string, filePath: string, contentType: string): Promise<void> {
    const body = await readFile(filePath)
    const { error } = await this.client.storage.from(bucket).upload(objectPath, body, { contentType, upsert: true })
    if (error) {
      throw new ProviderError('storage', `Could not upload ${bucket}/${objectPath}: ${error.message}`, { cause: error })
    }
  }

  async remove(bucket: string, objectPaths: string[]): Promise<void> {
    if (objectPaths.length === 0) return
    const { error } = await this.client.storage.from(bucket).remove(objectPaths)
    if (error) {
      throw new ProviderError('storage', `Could not delete objects in ${bucket}: ${error.message}`, { cause: error })
    }
  }
}
