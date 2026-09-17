import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ReplicateDemucsSeparator } from '../src/drivers/replicate-demucs-separator.js'
import { createFetchStub, jsonResponse } from './helpers/fetch-stub.js'
import { stageContext } from './helpers/factories.js'

async function audioFile(ctx: { workdir: string }) {
  const file = path.join(ctx.workdir, 'audio.wav')
  await writeFile(file, 'mix bytes')
  return file
}

describe('ReplicateDemucsSeparator', () => {
  it('uploads, predicts, polls and downloads both stems', async () => {
    let polls = 0
    const { fetchImpl, requests } = createFetchStub((req) => {
      if (req.url === 'https://api.replicate.com/v1/files') return jsonResponse({ urls: { get: 'https://files.replicate/x' } })
      if (req.url === 'https://api.replicate.com/v1/predictions') return jsonResponse({ id: 'p1', status: 'starting' })
      if (req.url === 'https://api.replicate.com/v1/predictions/p1') {
        polls += 1
        return polls < 2
          ? jsonResponse({ id: 'p1', status: 'processing' })
          : jsonResponse({ id: 'p1', status: 'succeeded', output: { vocals: 'https://out/vocals.wav', no_vocals: 'https://out/no_vocals.wav' } })
      }
      if (req.url === 'https://out/vocals.wav') return new Response('vocal stem')
      if (req.url === 'https://out/no_vocals.wav') return new Response('background stem')
      return jsonResponse({}, 404)
    })
    const separator = new ReplicateDemucsSeparator({ apiToken: 'tok', version: 'abc123', fetchImpl, sleep: async () => undefined })
    const ctx = await stageContext()
    const result = await separator.separate(await audioFile(ctx), ctx)
    expect(await readFile(result.vocalsPath, 'utf8')).toBe('vocal stem')
    expect(await readFile(result.backgroundPath, 'utf8')).toBe('background stem')
    expect(requests[0]!.headers.authorization).toBe('Bearer tok')
    expect((requests[0]!.body as FormData).get('content')).toBeInstanceOf(Blob)
    expect(requests[1]!.json).toEqual({
      version: 'abc123',
      input: { audio: 'https://files.replicate/x', stem: 'vocals', model: 'htdemucs', output_format: 'wav' },
    })
    expect(polls).toBe(2)
    expect(ctx.progressValues.at(-1)).toBe(1)
  })

  it('reports failed predictions and unexpected outputs', async () => {
    const ctx = await stageContext()
    const failing = new ReplicateDemucsSeparator({
      apiToken: 't',
      version: 'v',
      sleep: async () => undefined,
      fetchImpl: createFetchStub((req) => {
        if (req.url.endsWith('/v1/files')) return jsonResponse({ urls: { get: 'u' } })
        return jsonResponse({ id: 'p', status: 'failed', error: 'CUDA out of memory' })
      }).fetchImpl,
    })
    await expect(failing.separate(await audioFile(ctx), ctx)).rejects.toMatchObject({
      provider: 'replicate',
      message: 'Source separation failed: CUDA out of memory.',
    })

    const wrongModel = new ReplicateDemucsSeparator({
      apiToken: 't',
      version: 'v',
      sleep: async () => undefined,
      fetchImpl: createFetchStub((req) => {
        if (req.url.endsWith('/v1/files')) return jsonResponse({ urls: { get: 'u' } })
        return jsonResponse({ id: 'p', status: 'succeeded', output: { vocals: 'a', drums: 'b', bass: 'c', other: 'd' } })
      }).fetchImpl,
    })
    await expect(wrongModel.separate(await audioFile(ctx), ctx)).rejects.toMatchObject({ message: expect.stringContaining('two-stem') })

    const unauthorized = new ReplicateDemucsSeparator({ apiToken: 'bad', version: 'v', fetchImpl: createFetchStub(() => jsonResponse({}, 401)).fetchImpl })
    await expect(unauthorized.separate(await audioFile(ctx), ctx)).rejects.toMatchObject({ message: 'Replicate rejected the API token.' })
  })
})
