import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { IngestInput, IngestResult, StageContext, VideoIngestor } from '../../pipeline/contracts.js'

export class FakeIngestor implements VideoIngestor {
  constructor(private readonly opts: { durationSeconds?: number } = {}) {}

  async ingest(input: IngestInput, ctx: StageContext): Promise<IngestResult> {
    const videoPath = path.join(ctx.workdir, 'video.mp4')
    const audioPath = path.join(ctx.workdir, 'audio.wav')
    const thumbnailPath = path.join(ctx.workdir, 'thumb.jpg')
    await writeFile(videoPath, `fake video from ${input.sourceType}:${input.sourceUrl ?? input.storagePath ?? ''}\n`)
    await writeFile(audioPath, 'fake audio\n')
    await writeFile(thumbnailPath, 'fake thumbnail\n')
    ctx.progress(1)
    return {
      videoPath,
      audioPath,
      durationSeconds: this.opts.durationSeconds ?? 42,
      title: input.sourceType === 'youtube' ? 'Fake YouTube video' : null,
      thumbnailPath,
      downloaded: input.sourceType === 'youtube',
    }
  }
}
