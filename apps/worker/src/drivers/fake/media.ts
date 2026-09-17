import { copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MediaProcessor, Placement, StageContext } from '../../pipeline/contracts.js'

export class FakeMedia implements MediaProcessor {
  constructor(private readonly opts: { durationSeconds?: number } = {}) {}

  async extractAudio(_videoPath: string, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'audio.wav')
    await writeFile(out, 'fake audio\n')
    return out
  }

  async probeDurationSeconds(): Promise<number> {
    return this.opts.durationSeconds ?? 42
  }

  async thumbnail(_videoPath: string, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'thumb.jpg')
    await writeFile(out, 'fake thumbnail\n')
    return out
  }

  async clipAudio(_inputPath: string, _opts: { startSec: number; durationSec: number }, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'sample.mp3')
    await writeFile(out, 'fake sample\n')
    return out
  }

  async duck(_audioPath: string, _gainDb: number, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'background.wav')
    await writeFile(out, 'fake ducked background\n')
    return out
  }

  async assembleTimeline(
    clips: { placement: Placement; path: string }[],
    _totalDurationMs: number,
    ctx: StageContext,
  ): Promise<string> {
    const out = path.join(ctx.workdir, 'dubbed_vocals.wav')
    await writeFile(out, `fake timeline of ${clips.length} clips\n`)
    return out
  }

  async mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string },
    ctx: StageContext,
  ): Promise<{ outputPath: string }> {
    const outputPath = path.join(ctx.workdir, 'dubbed.mp4')
    await copyFile(input.videoPath, outputPath)
    return { outputPath }
  }
}
