import { createWriteStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { AudioSeparator, StageContext } from '../pipeline/contracts.js'
import { ProviderError } from '../pipeline/errors.js'

export interface ReplicateDemucsOptions {
  apiToken: string
  /** Version hash of a Demucs model that accepts `audio` + `stem: "vocals"` and returns `vocals` and `no_vocals`. */
  version: string
  fetchImpl?: typeof fetch
  baseUrl?: string
  pollMs?: number
  sleep?: (ms: number) => Promise<void>
}

interface Prediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: Record<string, string> | null
  error?: string | null
}

const PROVIDER = 'replicate'

/** Hosted Demucs source separation: upload the mix, run a prediction, download the vocal and no-vocal stems. */
export class ReplicateDemucsSeparator implements AudioSeparator {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly opts: ReplicateDemucsOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.baseUrl = (opts.baseUrl ?? 'https://api.replicate.com').replace(/\/$/, '')
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  private async request(url: string, init: RequestInit, what: string): Promise<Response> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: { authorization: `Bearer ${this.opts.apiToken}`, ...(init.headers as Record<string, string> | undefined) },
      })
    } catch (cause) {
      if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) throw cause
      throw new ProviderError(PROVIDER, `${what} failed: could not reach Replicate.`, { cause })
    }
    if (!response.ok) {
      if (response.status === 401) throw new ProviderError(PROVIDER, 'Replicate rejected the API token.', { status: 401 })
      throw new ProviderError(PROVIDER, `${what} failed (Replicate HTTP ${response.status}).`, { status: response.status })
    }
    return response
  }

  async separate(audioPath: string, ctx: StageContext): Promise<{ vocalsPath: string; backgroundPath: string }> {
    const form = new FormData()
    form.append('content', new Blob([await readFile(audioPath)]), path.basename(audioPath))
    const uploaded = (await (
      await this.request(`${this.baseUrl}/v1/files`, { method: 'POST', body: form, signal: ctx.signal }, 'Audio upload')
    ).json()) as { urls: { get: string } }

    let prediction = (await (
      await this.request(
        `${this.baseUrl}/v1/predictions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            version: this.opts.version,
            input: { audio: uploaded.urls.get, stem: 'vocals', model: 'htdemucs', output_format: 'wav' },
          }),
          signal: ctx.signal,
        },
        'Source separation',
      )
    ).json()) as Prediction

    let polls = 0
    while (prediction.status === 'starting' || prediction.status === 'processing') {
      polls += 1
      ctx.progress(Math.min(0.9, polls / 60))
      await this.sleep(this.opts.pollMs ?? 5000)
      prediction = (await (
        await this.request(`${this.baseUrl}/v1/predictions/${prediction.id}`, { method: 'GET', signal: ctx.signal }, 'Source separation')
      ).json()) as Prediction
    }
    if (prediction.status !== 'succeeded') {
      throw new ProviderError(PROVIDER, `Source separation ${prediction.status}${prediction.error ? `: ${prediction.error}` : ''}.`)
    }
    const output = prediction.output ?? {}
    if (!output.vocals || !output.no_vocals) {
      throw new ProviderError(
        PROVIDER,
        'The Demucs model did not return "vocals" and "no_vocals" stems; use a two-stem Demucs version (REPLICATE_DEMUCS_VERSION).',
      )
    }
    const vocalsPath = path.join(ctx.workdir, 'vocals.wav')
    const backgroundPath = path.join(ctx.workdir, 'background.wav')
    await this.downloadTo(output.vocals, vocalsPath, ctx)
    await this.downloadTo(output.no_vocals, backgroundPath, ctx)
    ctx.progress(1)
    return { vocalsPath, backgroundPath }
  }

  private async downloadTo(url: string, destPath: string, ctx: StageContext): Promise<void> {
    const response = await this.request(url, { method: 'GET', signal: ctx.signal }, 'Stem download')
    if (!response.body) throw new ProviderError(PROVIDER, 'Stem download returned no data.')
    await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream), createWriteStream(destPath))
  }
}
