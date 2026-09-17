import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import type { AudioSeparator, MediaProcessor, StageContext } from '../pipeline/contracts.js'

/**
 * No-vendor separation: the "vocals" track is the original mix (good enough for transcription and
 * voice sampling) and the background bed is the original audio ducked by `gainDb`.
 */
export class FfmpegDuckSeparator implements AudioSeparator {
  constructor(
    private readonly media: MediaProcessor,
    private readonly gainDb = -14,
  ) {}

  async separate(audioPath: string, ctx: StageContext): Promise<{ vocalsPath: string; backgroundPath: string }> {
    const vocalsPath = path.join(ctx.workdir, 'vocals.wav')
    await copyFile(audioPath, vocalsPath)
    const backgroundPath = await this.media.duck(audioPath, this.gainDb, ctx)
    return { vocalsPath, backgroundPath }
  }
}
