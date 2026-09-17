import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { VoziaClient } from '@vozia/db'
import { SupabaseObjectStorage } from '../src/drivers/supabase-storage.js'
import { tempDir } from './helpers/factories.js'

type BucketApi = {
  createSignedUrl: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function stubClient(overrides: Partial<BucketApi> = {}) {
  const bucketApi: BucketApi = {
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/x' }, error: null })),
    upload: vi.fn(async () => ({ data: { path: 'x' }, error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
    ...overrides,
  }
  const from = vi.fn(() => bucketApi)
  return { client: { storage: { from } } as unknown as VoziaClient, from, bucketApi }
}

describe('SupabaseObjectStorage', () => {
  it('downloads through a signed url into the destination file', async () => {
    const { client, from, bucketApi } = stubClient()
    const fetchImpl = vi.fn(async () => new Response('video bytes'))
    const storage = new SupabaseObjectStorage(client, fetchImpl as unknown as typeof fetch)
    const dest = path.join(await tempDir(), 'nested', 'source.mp4')
    await storage.download('sources', 'owner/v/original.mp4', dest)
    expect(from).toHaveBeenCalledWith('sources')
    expect(bucketApi.createSignedUrl).toHaveBeenCalledWith('owner/v/original.mp4', 600)
    expect(fetchImpl).toHaveBeenCalledWith('https://signed.example/x')
    expect(await readFile(dest, 'utf8')).toBe('video bytes')
  })

  it('surfaces missing objects and http failures as provider errors', async () => {
    const missing = stubClient({ createSignedUrl: vi.fn(async () => ({ data: null, error: { message: 'Object not found' } })) })
    await expect(new SupabaseObjectStorage(missing.client).download('sources', 'a/b', '/tmp/x')).rejects.toMatchObject({
      provider: 'storage',
      message: 'The source file sources/a/b is missing.',
    })
    const { client } = stubClient()
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403 }))
    await expect(new SupabaseObjectStorage(client, fetchImpl as unknown as typeof fetch).download('sources', 'a/b', '/tmp/x')).rejects.toMatchObject({
      message: 'Could not download sources/a/b (HTTP 403).',
      status: 403,
    })
  })

  it('uploads file contents with the content type and upsert, and removes objects', async () => {
    const { client, bucketApi } = stubClient()
    const storage = new SupabaseObjectStorage(client)
    const file = path.join(await tempDir(), 'dubbed.mp4')
    await writeFile(file, 'mp4 bytes')
    await storage.upload('outputs', 'owner/d/dubbed.mp4', file, 'video/mp4')
    expect(bucketApi.upload).toHaveBeenCalledWith('owner/d/dubbed.mp4', expect.any(Buffer), { contentType: 'video/mp4', upsert: true })
    expect((bucketApi.upload.mock.calls[0] as unknown[])[1]?.toString()).toBe('mp4 bytes')
    await storage.remove('outputs', ['a', 'b'])
    expect(bucketApi.remove).toHaveBeenCalledWith(['a', 'b'])
    await storage.remove('outputs', [])
    expect(bucketApi.remove).toHaveBeenCalledTimes(1)
  })

  it('maps upload errors', async () => {
    const failing = stubClient({ upload: vi.fn(async () => ({ data: null, error: { message: 'Payload too large' } })) })
    const file = path.join(await tempDir(), 'f')
    await writeFile(file, 'x')
    await expect(new SupabaseObjectStorage(failing.client).upload('outputs', 'p', file, 'text/plain')).rejects.toMatchObject({
      message: 'Could not upload outputs/p: Payload too large',
    })
  })
})
