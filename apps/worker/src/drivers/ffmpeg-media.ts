import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MediaProcessor, Placement, StageContext } from '../pipeline/contracts.js'
import { ProviderError } from '../pipeline/errors.js'
import type { TimeWindow } from '../pipeline/speech-windows.js'
import { ProcessError, type ProcessRunner } from './process.js'

export interface FfmpegOptions {
  run: ProcessRunner
  ffmpegPath?: string
  ffprobePath?: string
}

function mapProcessError(error: unknown, what: string): never {
  if (error instanceof ProcessError) {
    if (error.code === 'ENOENT') {
      throw new ProviderError('ffmpeg', `${error.cmd} is not installed on the worker.`, { cause: error })
    }
    if (error.code === 'ABORT_ERR' || error.code === 'SIGTERM') {
      throw new ProviderError('ffmpeg', `${what} was interrupted.`, { cause: error })
    }
    const lastLine = error.stderrTail.split('\n').at(-1) || 'unknown error'
    throw new ProviderError('ffmpeg', `${what} failed: ${lastLine}`, { cause: error })
  }
  throw error
}

/** How long the background takes to switch between the original audio and the separated background. */
const BLEND_FADE_MS = 60

const seconds = (ms: number) => (ms / 1000).toFixed(3)

/**
 * An ffmpeg expression of time `t` that is 1 while someone speaks and 0 elsewhere, ramping over `fadeMs` just
 * outside each window. Windows never overlap (speechWindows merges them), so a capped sum is enough.
 */
function speakingExpression(windows: TimeWindow[], fadeMs: number): string {
  if (windows.length === 0) return '0'
  const fade = seconds(fadeMs)
  const ramps = windows.map(
    (w) => `clip((t-${seconds(w.startMs - fadeMs)})/${fade},0,1)*clip((${seconds(w.endMs + fadeMs)}-t)/${fade},0,1)`,
  )
  return `min(1,${ramps.join('+')})`
}

export class FfmpegMediaProcessor implements MediaProcessor {
  private readonly ffmpeg: string
  private readonly ffprobe: string

  constructor(private readonly opts: FfmpegOptions) {
    this.ffmpeg = opts.ffmpegPath ?? 'ffmpeg'
    this.ffprobe = opts.ffprobePath ?? 'ffprobe'
  }

  private async exec(cmd: string, args: string[], ctx: StageContext, what: string) {
    try {
      return await this.opts.run(cmd, args, { cwd: ctx.workdir, signal: ctx.signal })
    } catch (error) {
      return mapProcessError(error, what)
    }
  }

  async extractAudio(videoPath: string, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'audio.wav')
    await this.exec(this.ffmpeg, ['-y', '-i', videoPath, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', out], ctx, 'Audio extraction')
    return out
  }

  async probeDurationSeconds(file: string, ctx: StageContext): Promise<number> {
    const { stdout } = await this.exec(
      this.ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
      ctx,
      'Probing duration',
    )
    const seconds = Number.parseFloat(stdout.trim())
    if (!Number.isFinite(seconds)) throw new ProviderError('ffmpeg', 'Could not read the media duration.')
    return seconds
  }

  async thumbnail(videoPath: string, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'thumb.jpg')
    await this.exec(this.ffmpeg, ['-y', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', out], ctx, 'Thumbnail')
    return out
  }

  async clipAudio(inputPath: string, opts: { startSec: number; durationSec: number }, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'sample.mp3')
    await this.exec(
      this.ffmpeg,
      ['-y', '-ss', String(opts.startSec), '-t', String(opts.durationSec), '-i', inputPath, '-c:a', 'libmp3lame', '-b:a', '128k', out],
      ctx,
      'Voice sample extraction',
    )
    return out
  }

  async duck(audioPath: string, gainDb: number, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'background.wav')
    await this.exec(this.ffmpeg, ['-y', '-i', audioPath, '-af', `volume=${gainDb}dB`, out], ctx, 'Background ducking')
    return out
  }

  async assembleTimeline(
    clips: { placement: Placement; path: string }[],
    totalDurationMs: number,
    ctx: StageContext,
  ): Promise<string> {
    const out = path.join(ctx.workdir, 'dubbed_vocals.wav')
    const filterPath = path.join(ctx.workdir, 'timeline.filter')
    const totalSec = (totalDurationMs / 1000).toFixed(3)
    const args = ['-y', '-f', 'lavfi', '-t', totalSec, '-i', 'anullsrc=r=44100:cl=stereo']
    const lines: string[] = []
    const labels: string[] = []
    clips.forEach((clip, i) => {
      args.push('-i', clip.path)
      const chain = [
        ...(clip.placement.tempo !== 1 ? [`atempo=${clip.placement.tempo}`] : []),
        `adelay=${clip.placement.startMs}:all=1`,
      ]
      lines.push(`[${i + 1}:a]${chain.join(',')}[c${i}]`)
      labels.push(`[c${i}]`)
    })
    lines.push(
      clips.length === 0
        ? '[0:a]anull[out]'
        : `[0:a]${labels.join('')}amix=inputs=${clips.length + 1}:normalize=0:duration=first[out]`,
    )
    await writeFile(filterPath, `${lines.join(';\n')}\n`)
    args.push('-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out)
    await this.exec(this.ffmpeg, args, ctx, 'Timeline assembly')
    return out
  }

  async keepOriginalBetweenSpeech(
    input: { originalPath: string; backgroundPath: string; speech: TimeWindow[] },
    ctx: StageContext,
  ): Promise<string> {
    const out = path.join(ctx.workdir, 'background_blended.wav')
    const filterPath = path.join(ctx.workdir, 'blend.filter')
    const speaking = speakingExpression(input.speech, BLEND_FADE_MS)
    // Small frames make the per-frame gain steps of the fades inaudible (128 samples ≈ 3 ms).
    const lines = [
      `[0:a]asetnsamples=n=128:p=0,volume='1-${speaking}':eval=frame[original]`,
      `[1:a]asetnsamples=n=128:p=0,volume='${speaking}':eval=frame[background]`,
      '[original][background]amix=inputs=2:normalize=0:duration=first[out]',
    ]
    await writeFile(filterPath, `${lines.join(';\n')}\n`)
    await this.exec(
      this.ffmpeg,
      [
        '-y', '-i', input.originalPath, '-i', input.backgroundPath,
        '-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out,
      ],
      ctx,
      'Background blending',
    )
    return out
  }

  async mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string },
    ctx: StageContext,
  ): Promise<{ outputPath: string }> {
    const outputPath = path.join(ctx.workdir, 'dubbed.mp4')
    await this.exec(
      this.ffmpeg,
      [
        '-y', '-i', input.videoPath, '-i', input.backgroundPath, '-i', input.dubbedVocalsPath,
        // Both tracks keep their own level; the limiter only catches peaks where the new voice lands on loud music,
        // without raising the overall level (level=false) or shifting the audio against the picture (latency=true).
        '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95:level=false:latency=true[a]',
        '-map', '0:v:0', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
        outputPath,
      ],
      ctx,
      'Muxing',
    )
    return { outputPath }
  }
}
