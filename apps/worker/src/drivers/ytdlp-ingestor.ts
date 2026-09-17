import path from 'node:path'
import { BUCKETS } from '@vozia/db'
import type { IngestInput, IngestResult, MediaProcessor, ObjectStorage, StageContext, VideoIngestor } from '../pipeline/contracts.js'
import { PipelineError, ProviderError } from '../pipeline/errors.js'
import { ProcessError, type ProcessRunner } from './process.js'

export interface YtdlpIngestorOptions {
  run: ProcessRunner
  media: MediaProcessor
  storage: ObjectStorage
  ytdlpPath?: string
}

/** Prefer a ready-made mp4 up to 1080p; fall back to the best single file. */
const FORMAT = 'bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4]/b'

function parseTitle(stdout: string): string | null {
  const lastLine = stdout.trim().split('\n').at(-1)
  if (!lastLine) return null
  try {
    const info = JSON.parse(lastLine) as { title?: unknown }
    return typeof info.title === 'string' && info.title.trim() ? info.title.trim() : null
  } catch {
    return null
  }
}

export class YtdlpIngestor implements VideoIngestor {
  constructor(private readonly opts: YtdlpIngestorOptions) {}

  async ingest(input: IngestInput, ctx: StageContext): Promise<IngestResult> {
    let videoPath: string
    let title: string | null = null
    let downloaded = false

    if (input.storagePath) {
      const extension = path.extname(input.storagePath) || '.mp4'
      videoPath = path.join(ctx.workdir, `source${extension}`)
      await this.opts.storage.download(BUCKETS.sources, input.storagePath, videoPath)
    } else if (input.sourceType === 'youtube' && input.sourceUrl) {
      videoPath = path.join(ctx.workdir, 'source.mp4')
      title = await this.downloadFromYoutube(input.sourceUrl, videoPath, ctx)
      downloaded = true
    } else {
      throw new PipelineError('The video has no source to ingest.')
    }
    ctx.progress(0.5)

    const { media } = this.opts
    const audioPath = await media.extractAudio(videoPath, ctx)
    const durationSeconds = await media.probeDurationSeconds(videoPath, ctx)
    const thumbnailPath = await media.thumbnail(videoPath, ctx).catch((error: unknown) => {
      ctx.log.warn({ error }, 'thumbnail generation failed; continuing without one')
      return null
    })
    ctx.progress(1)
    return { videoPath, audioPath, durationSeconds, title, thumbnailPath, downloaded }
  }

  private async downloadFromYoutube(url: string, videoPath: string, ctx: StageContext): Promise<string | null> {
    const args = [
      '-f', FORMAT,
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-progress',
      '--print-json',
      '-o', videoPath,
      url,
    ]
    try {
      const { stdout } = await this.opts.run(this.opts.ytdlpPath ?? 'yt-dlp', args, { cwd: ctx.workdir, signal: ctx.signal })
      return parseTitle(stdout)
    } catch (error) {
      if (error instanceof ProcessError) {
        if (error.code === 'ENOENT') throw new ProviderError('youtube', 'yt-dlp is not installed on the worker.', { cause: error })
        const reason = error.stderrTail.split('\n').at(-1) || 'unknown error'
        throw new ProviderError('youtube', `Could not download the YouTube video: ${reason}`, { cause: error })
      }
      throw error
    }
  }
}
