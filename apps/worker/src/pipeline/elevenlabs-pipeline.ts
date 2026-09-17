import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { minutesToCharge } from '@vozia/shared'
import { BUCKETS, outputObjectPath } from '@vozia/db'
import type { ElevenLabsClient } from '../drivers/elevenlabs/client.js'
import type { DubRepository } from '../repo/contracts.js'
import type { DubJob, DubbingPipeline, JobContext, ObjectStorage } from './contracts.js'
import { PipelineError, ProviderError } from './errors.js'

export interface ElevenLabsPipelineDeps {
  client: Pick<ElevenLabsClient, 'createDubbing' | 'getDubbing' | 'downloadDubbedFile' | 'getTranscript'>
  storage: ObjectStorage
  repo: DubRepository
  pollMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/** One API call does the whole job: ElevenLabs separates, clones, translates and mixes; we upload the result. */
export class ElevenLabsDubbingPipeline implements DubbingPipeline {
  readonly name = 'elevenlabs' as const
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number

  constructor(private readonly d: ElevenLabsPipelineDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.now = d.now ?? (() => Date.now())
  }

  async run(job: DubJob, ctx: JobContext): Promise<void> {
    const { dub, video } = job
    const { client, storage, repo } = this.d

    await ctx.setStage('ingesting')
    let filePath: string | undefined
    let sourceUrl: string | undefined
    if (video.storage_path) {
      filePath = path.join(ctx.workdir, `source${path.extname(video.storage_path) || '.mp4'}`)
      await storage.download(BUCKETS.sources, video.storage_path, filePath)
    } else if (video.source_type === 'youtube' && video.source_url) {
      sourceUrl = video.source_url
    } else {
      throw new PipelineError('The video has no source to dub.')
    }
    if (dub.voice_mode === 'stock') {
      ctx.log.warn({ dubId: dub.id }, 'ElevenLabs dubbing always clones the original voice; the stock voice choice is ignored')
    }

    await ctx.setStage('dubbing')
    const created = await client.createDubbing(
      { filePath, sourceUrl, targetLang: dub.target_language, sourceLang: dub.source_language, name: `vozia-${dub.id}` },
      ctx.signal,
    )
    await repo.patchDub(dub.id, { provider_ref: created.dubbingId })

    const startedAt = this.now()
    const expectedMs = Math.max(30_000, (created.expectedDurationSec ?? 300) * 1000)
    let status = await client.getDubbing(created.dubbingId, ctx.signal)
    while (status.status === 'dubbing') {
      ctx.progress(Math.min(0.95, (this.now() - startedAt) / expectedMs))
      await this.sleep(this.d.pollMs ?? 10_000)
      status = await client.getDubbing(created.dubbingId, ctx.signal)
    }
    if (status.status === 'failed') {
      throw new ProviderError('elevenlabs', `ElevenLabs could not dub this video${status.error ? `: ${status.error}` : ''}.`, { stage: 'dubbing' })
    }

    const outputPath = path.join(ctx.workdir, 'dubbed.mp4')
    await client.downloadDubbedFile(created.dubbingId, dub.target_language, outputPath, ctx.signal)
    const sourceLang = status.sourceLang ?? dub.source_language
    const translatedSrt = await client.getTranscript(created.dubbingId, dub.target_language, 'srt', ctx.signal)
    const originalSrt = sourceLang ? await client.getTranscript(created.dubbingId, sourceLang, 'srt', ctx.signal) : null

    const owner = dub.owner_id
    const outputObject = outputObjectPath(owner, dub.id, 'dubbed.mp4')
    await storage.upload(BUCKETS.outputs, outputObject, outputPath, 'video/mp4')
    const srtTranslatedPath = await this.uploadSrt(translatedSrt, 'translated.srt', job, ctx)
    const srtOriginalPath = await this.uploadSrt(originalSrt, 'original.srt', job, ctx)

    const durationSec = status.durationSec ?? video.duration_seconds ?? 0
    if (status.durationSec !== null && video.duration_seconds === null) {
      await repo.updateVideoAfterIngest(video.id, { durationSeconds: Math.round(status.durationSec) })
    }
    await repo.markCompleted(dub.id, {
      outputPath: outputObject,
      dubbedAudioPath: null,
      srtOriginalPath,
      srtTranslatedPath,
      minutes: minutesToCharge(durationSec),
      detectedLanguage: sourceLang ?? null,
    })
  }

  private async uploadSrt(content: string | null, file: 'original.srt' | 'translated.srt', job: DubJob, ctx: JobContext): Promise<string | null> {
    if (!content) return null
    const local = path.join(ctx.workdir, file)
    await writeFile(local, content)
    const object = outputObjectPath(job.dub.owner_id, job.dub.id, file)
    await this.d.storage.upload(BUCKETS.outputs, object, local, 'application/x-subrip')
    return object
  }
}
