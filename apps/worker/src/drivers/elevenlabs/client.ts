import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Word } from '../../pipeline/contracts.js'
import { ProviderError } from '../../pipeline/errors.js'

export interface ElevenLabsClientOptions {
  apiKey: string
  fetchImpl?: typeof fetch
  baseUrl?: string
}

interface SttWord {
  text: string
  start: number
  end: number
  type: 'word' | 'spacing' | 'audio_event'
  speaker_id?: string | null
}

interface SttResponse {
  language_code: string
  words?: SttWord[]
}

export interface DubbingStatus {
  status: 'dubbing' | 'dubbed' | 'failed'
  error: string | null
  durationSec: number | null
  sourceLang: string | null
  targetLanguages: string[]
}

export interface CreateDubbingInput {
  filePath?: string
  sourceUrl?: string
  targetLang: string
  sourceLang: string | null
  name: string
}

const PROVIDER = 'elevenlabs'

/** Thin wrapper over the ElevenLabs REST API; every failure becomes a ProviderError with a user-safe message. */
export class ElevenLabsClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string

  constructor(private readonly opts: ElevenLabsClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.baseUrl = (opts.baseUrl ?? 'https://api.elevenlabs.io').replace(/\/$/, '')
  }

  private async request(pathname: string, init: RequestInit, what: string): Promise<Response> {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: { 'xi-api-key': this.opts.apiKey, ...(init.headers as Record<string, string> | undefined) },
      })
    } catch (cause) {
      if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) throw cause
      throw new ProviderError(PROVIDER, `${what} failed: could not reach ElevenLabs.`, { cause })
    }
    if (!response.ok) throw await this.errorFor(response, what)
    return response
  }

  private async errorFor(response: Response, what: string): Promise<ProviderError> {
    const status = response.status
    let detail = ''
    try {
      const body = (await response.json()) as { detail?: string | { message?: string; status?: string } }
      detail = typeof body.detail === 'string' ? body.detail : (body.detail?.message ?? body.detail?.status ?? '')
    } catch {
      detail = ''
    }
    if (status === 401) return new ProviderError(PROVIDER, 'ElevenLabs rejected the API key.', { status })
    if (status === 402 || status === 429) {
      return new ProviderError(PROVIDER, 'ElevenLabs quota or rate limit reached; try again later.', { status })
    }
    return new ProviderError(PROVIDER, `${what} failed (ElevenLabs HTTP ${status})${detail ? `: ${detail}` : ''}.`, { status })
  }

  private async fileBlob(filePath: string): Promise<Blob> {
    return new Blob([await readFile(filePath)])
  }

  async speechToText(
    filePath: string,
    opts: { languageCode?: string | null; diarize?: boolean },
    signal?: AbortSignal,
  ): Promise<{ languageCode: string; words: Word[] }> {
    const form = new FormData()
    form.append('model_id', 'scribe_v1')
    form.append('timestamps_granularity', 'word')
    form.append('diarize', opts.diarize === false ? 'false' : 'true')
    form.append('tag_audio_events', 'false')
    if (opts.languageCode) form.append('language_code', opts.languageCode)
    form.append('file', await this.fileBlob(filePath), path.basename(filePath))
    const response = await this.request('/v1/speech-to-text', { method: 'POST', body: form, signal }, 'Transcription')
    const body = (await response.json()) as SttResponse
    const words = (body.words ?? [])
      .filter((w) => w.type === 'word' && w.text.trim() !== '')
      .map((w) => ({
        text: w.text.trim(),
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        speaker: w.speaker_id ?? null,
      }))
    return { languageCode: body.language_code, words }
  }

  async addVoice(name: string, sampleFilePath: string, signal?: AbortSignal): Promise<{ voiceId: string }> {
    const form = new FormData()
    form.append('name', name)
    form.append('remove_background_noise', 'true')
    form.append('files', await this.fileBlob(sampleFilePath), path.basename(sampleFilePath))
    const response = await this.request('/v1/voices/add', { method: 'POST', body: form, signal }, 'Voice cloning')
    const body = (await response.json()) as { voice_id: string }
    return { voiceId: body.voice_id }
  }

  async deleteVoice(voiceId: string, signal?: AbortSignal): Promise<void> {
    await this.request(`/v1/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE', signal }, 'Voice cleanup')
  }

  async textToSpeech(
    voiceId: string,
    text: string,
    opts: { modelId?: string },
    destPath: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await this.request(
      `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: opts.modelId ?? 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
        signal,
      },
      'Speech synthesis',
    )
    await writeFile(destPath, Buffer.from(await response.arrayBuffer()))
  }

  async createDubbing(input: CreateDubbingInput, signal?: AbortSignal): Promise<{ dubbingId: string; expectedDurationSec: number | null }> {
    const form = new FormData()
    form.append('name', input.name)
    form.append('target_lang', input.targetLang)
    form.append('source_lang', input.sourceLang ?? 'auto')
    form.append('num_speakers', '0')
    form.append('watermark', 'false')
    form.append('mode', 'automatic')
    if (input.filePath) form.append('file', await this.fileBlob(input.filePath), path.basename(input.filePath))
    else if (input.sourceUrl) form.append('source_url', input.sourceUrl)
    else throw new ProviderError(PROVIDER, 'Dubbing needs a file or a source URL.')
    const response = await this.request('/v1/dubbing', { method: 'POST', body: form, signal }, 'Dubbing')
    const body = (await response.json()) as { dubbing_id: string; expected_duration_sec?: number | null }
    return { dubbingId: body.dubbing_id, expectedDurationSec: body.expected_duration_sec ?? null }
  }

  async getDubbing(dubbingId: string, signal?: AbortSignal): Promise<DubbingStatus> {
    const response = await this.request(`/v1/dubbing/${encodeURIComponent(dubbingId)}`, { method: 'GET', signal }, 'Dubbing status')
    const body = (await response.json()) as {
      status: string
      error?: string | null
      media_metadata?: { duration?: number | null } | null
      source_language?: string | null
      target_languages?: string[]
    }
    const status = body.status === 'dubbed' || body.status === 'failed' ? body.status : 'dubbing'
    return {
      status,
      error: body.error ?? null,
      durationSec: body.media_metadata?.duration ?? null,
      sourceLang: body.source_language ?? null,
      targetLanguages: body.target_languages ?? [],
    }
  }

  async downloadDubbedFile(dubbingId: string, languageCode: string, destPath: string, signal?: AbortSignal): Promise<void> {
    const response = await this.request(
      `/v1/dubbing/${encodeURIComponent(dubbingId)}/audio/${encodeURIComponent(languageCode)}`,
      { method: 'GET', signal },
      'Dubbed file download',
    )
    await writeFile(destPath, Buffer.from(await response.arrayBuffer()))
  }

  async getTranscript(dubbingId: string, languageCode: string, format: 'srt' | 'webvtt', signal?: AbortSignal): Promise<string | null> {
    try {
      const response = await this.request(
        `/v1/dubbing/${encodeURIComponent(dubbingId)}/transcript/${encodeURIComponent(languageCode)}?format_type=${format}`,
        { method: 'GET', signal },
        'Transcript download',
      )
      return await response.text()
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) return null
      throw error
    }
  }
}
