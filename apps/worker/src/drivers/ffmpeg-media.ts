import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Caption,
  DubBackgroundInput,
  Frame,
  MediaProcessor,
  Piece,
  StageContext,
  VoiceAnalysis,
  VoiceAnalysisRequest,
  VoiceMatchReport,
  VoiceMeasure,
  VoiceSound,
} from '../pipeline/contracts.js'
import { ProviderError } from '../pipeline/errors.js'
import type { TimeWindow } from '../pipeline/speech-windows.js'
import { ProcessError, type ProcessRunner } from './process.js'

export interface FfmpegOptions {
  run: ProcessRunner
  ffmpegPath?: string
  ffprobePath?: string
  /** Python with numpy, for the noise floor under the dub and the voice analysis. Without it the dub skips both. */
  pythonPath?: string
  roomToneScript?: string
  noiseFillScript?: string
  voiceAnalysisScript?: string
  voiceMatchScript?: string
  /** The font captions are drawn with; without it, captions are left out. */
  captionFont?: string
}

/** apps/worker/scripts/*.py, from src/drivers or dist/drivers alike. */
const ROOM_TONE_SCRIPT = fileURLToPath(new URL('../../scripts/room_tone.py', import.meta.url))
const VOICE_ANALYSIS_SCRIPT = fileURLToPath(new URL('../../scripts/voice_analysis.py', import.meta.url))
const NOISE_FILL_SCRIPT = fileURLToPath(new URL('../../scripts/noise_fill.py', import.meta.url))
const VOICE_MATCH_SCRIPT = fileURLToPath(new URL('../../scripts/voice_match.py', import.meta.url))
/** Installed with ffmpeg in the worker images (fonts-dejavu-core). */
const CAPTION_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

/** How different two frames must be to count as a cut (ffmpeg's scene score, 0 to 1). */
const SCENE_CUT = 0.25
/** Cuts closer than this are one cut (a fade or a flash). */
const SAME_CUT_MS = 150
/** Wide enough for the translator to read captions in the picture, small enough to stay cheap. */
const FRAME_WIDTH = 512

interface RawVoiceAnalysis {
  usual: VoiceAnalysis['usual']
  lines: ({ idx: number } & VoiceMeasure)[]
  sounds: VoiceSound[]
  envelope: VoiceAnalysis['envelope']
}

const pairs = (spans: readonly TimeWindow[] = []) => spans.map((s) => [Math.round(s.startMs), Math.round(s.endMs)])

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

  async joinSpans(inputPath: string, spans: TimeWindow[], ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'sample.mp3')
    const filterPath = path.join(ctx.workdir, 'sample.filter')
    const labels = spans.map((_, k) => `[s${k}]`)
    const lines = [
      `[0:a]asplit=${Math.max(1, spans.length)}${spans.map((_, k) => `[a${k}]`).join('')}`,
      ...spans.map((span, k) => {
        const length = (span.endMs - span.startMs) / 1000
        // Short fades and a quarter second between stretches, so the clone hears clean, separate phrases.
        return `[a${k}]atrim=start=${seconds(span.startMs)}:end=${seconds(span.endMs)},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, length - 0.01).toFixed(3)}:d=0.01,apad=pad_dur=0.25${labels[k]}`
      }),
      `${labels.join('')}concat=n=${spans.length}:v=0:a=1[out]`,
    ]
    await writeFile(filterPath, `${lines.join(';\n')}\n`)
    await this.exec(
      this.ffmpeg,
      ['-y', '-i', inputPath, '-filter_complex_script', filterPath, '-map', '[out]', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', out],
      ctx,
      'Voice sample extraction',
    )
    return out
  }

  async joinClips(paths: string[], gapMs: number, ctx: StageContext): Promise<{ path: string; spans: TimeWindow[] }> {
    const dir = path.join(ctx.workdir, 'joined')
    await mkdir(dir, { recursive: true })
    const out = path.join(dir, `takes-${Date.now().toString(36)}.wav`)
    const spans: TimeWindow[] = []
    const wavs: string[] = []
    let at = 0
    for (const [k, clip] of paths.entries()) {
      // Decoded first, so the measured length is exactly what plays.
      const wav = path.join(dir, `${path.parse(clip).name}-${k}.wav`)
      await this.exec(this.ffmpeg, ['-y', '-i', clip, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav], ctx, 'Take decoding')
      const ms = Math.round((await this.probeDurationSeconds(wav, ctx)) * 1000)
      spans.push({ startMs: at, endMs: at + ms })
      at += ms + gapMs
      wavs.push(wav)
    }
    const filterPath = path.join(dir, 'join.filter')
    const parts = wavs.map((_, k) => `[${k}:a]apad=pad_dur=${(gapMs / 1000).toFixed(3)}[c${k}]`)
    await writeFile(filterPath, `${[...parts, `${wavs.map((_, k) => `[c${k}]`).join('')}concat=n=${wavs.length}:v=0:a=1[out]`].join(';\n')}\n`)
    await this.exec(
      this.ffmpeg,
      ['-y', ...wavs.flatMap((wav) => ['-i', wav]), '-filter_complex_script', filterPath, '-map', '[out]', '-c:a', 'pcm_s16le', out],
      ctx,
      'Joining takes',
    )
    return { path: out, spans }
  }

  async assembleTimeline(pieces: Piece[], totalDurationMs: number, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'dubbed_vocals.wav')
    const filterPath = path.join(ctx.workdir, 'timeline.filter')
    const totalSec = (totalDurationMs / 1000).toFixed(3)
    const args = ['-y', '-f', 'lavfi', '-t', totalSec, '-i', 'anullsrc=r=44100:cl=stereo']
    const lines: string[] = []
    const labels: string[] = []
    pieces.forEach((piece, i) => {
      args.push('-i', piece.path)
      const length = (piece.toMs - piece.fromMs) / piece.tempo / 1000
      // 5 ms fades: pieces of one take meet at word boundaries, and the fades keep the joins from clicking.
      const chain = [
        `atrim=start=${seconds(piece.fromMs)}:end=${seconds(piece.toMs)}`,
        'asetpts=PTS-STARTPTS',
        ...(piece.tempo !== 1 ? [`atempo=${piece.tempo}`] : []),
        'afade=t=in:d=0.005',
        `afade=t=out:st=${Math.max(0, length - 0.005).toFixed(3)}:d=0.005`,
        `adelay=${Math.max(0, Math.round(piece.outStartMs))}:all=1`,
      ]
      lines.push(`[${i + 1}:a]${chain.join(',')}[c${i}]`)
      labels.push(`[c${i}]`)
    })
    lines.push(
      pieces.length === 0
        ? '[0:a]anull[out]'
        : `[0:a]${labels.join('')}amix=inputs=${pieces.length + 1}:normalize=0:duration=first[out]`,
    )
    await writeFile(filterPath, `${lines.join(';\n')}\n`)
    args.push('-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out)
    await this.exec(this.ffmpeg, args, ctx, 'Timeline assembly')
    return out
  }

  /**
   * How each line of a voice track was performed (scripts/voice_analysis.py). Like the room tone it is an improvement,
   * not a requirement: without Python, or if the script fails, the dub goes on from the words and timing alone.
   */
  async analyzeVoice(vocalsPath: string, request: VoiceAnalysisRequest, ctx: StageContext): Promise<VoiceAnalysis | null> {
    if (!this.opts.pythonPath || request.lines.length === 0) return null
    const name = path.parse(vocalsPath).name
    const input = path.join(ctx.workdir, `${name}.analysis-request.json`)
    const out = path.join(ctx.workdir, `${name}.analysis.json`)
    await writeFile(
      input,
      JSON.stringify({
        lines: request.lines.map((line) => ({ idx: line.idx, spans: pairs(line.spans) })),
        words: pairs(request.words),
        events: pairs(request.events),
      }),
    )
    try {
      await this.opts.run(this.opts.pythonPath, [this.opts.voiceAnalysisScript ?? VOICE_ANALYSIS_SCRIPT, vocalsPath, input, out], {
        cwd: ctx.workdir,
        signal: ctx.signal,
      })
      const raw = JSON.parse(await readFile(out, 'utf8')) as RawVoiceAnalysis
      return {
        usual: raw.usual,
        lines: new Map(raw.lines.map(({ idx, ...measure }) => [idx, measure])),
        sounds: raw.sounds,
        envelope: raw.envelope,
      }
    } catch (error) {
      if (ctx.signal.aborted) throw error
      ctx.log.warn({ error }, 'voice not analysed: the dub goes on from the words and timing alone')
      return null
    }
  }

  /** Cuts are a help for timing, never a requirement: on failure there are none. */
  async sceneCuts(videoPath: string, ctx: StageContext): Promise<number[]> {
    let result: { stderr: string }
    try {
      // A small copy of each frame is plenty to see a cut, and much faster to compare.
      result = await this.opts.run(
        this.ffmpeg,
        ['-nostdin', '-hide_banner', '-i', videoPath, '-an', '-vf', `scale=160:-2,select='gt(scene,${SCENE_CUT})',showinfo`, '-f', 'null', '-'],
        { cwd: ctx.workdir, signal: ctx.signal },
      )
    } catch (error) {
      if (ctx.signal.aborted) throw error
      ctx.log.warn({ error }, 'scene cuts not found: timing goes by the words alone')
      return []
    }
    const cuts: number[] = []
    for (const match of result.stderr.matchAll(/pts_time:([\d.]+)/g)) {
      const ms = Math.round(Number(match[1]) * 1000)
      if (Number.isFinite(ms) && (cuts.length === 0 || ms - cuts.at(-1)! > SAME_CUT_MS)) cuts.push(ms)
    }
    return cuts
  }

  async frames(videoPath: string, timesMs: number[], ctx: StageContext): Promise<Frame[]> {
    const dir = path.join(ctx.workdir, 'frames')
    await mkdir(dir, { recursive: true })
    const frames: Frame[] = []
    for (const timeMs of timesMs) {
      const out = path.join(dir, `${Math.round(timeMs)}.jpg`)
      try {
        await this.opts.run(
          this.ffmpeg,
          [
            '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-ss', seconds(timeMs), '-i', videoPath,
            '-frames:v', '1', '-vf', `scale='min(${FRAME_WIDTH},iw)':-2`, '-q:v', '5', out,
          ],
          { cwd: ctx.workdir, signal: ctx.signal },
        )
        frames.push({ timeMs, path: out })
      } catch (error) {
        if (ctx.signal.aborted) throw error
      }
    }
    if (frames.length < timesMs.length) ctx.log.warn({ missing: timesMs.length - frames.length }, 'some video frames could not be read')
    return frames
  }

  async buildDubBackground(input: DubBackgroundInput, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'background_blended.wav')
    const filterPath = path.join(ctx.workdir, 'blend.filter')
    const roomTone = await this.roomLayer(input, ctx)
    const speaking = speakingExpression(input.speech, BLEND_FADE_MS)
    // While someone speaks: the separated background, plus the recreated noise floor when there is one.
    const underSpeech = roomTone ? '[1:a][2:a]amix=inputs=2:normalize=0:duration=first,' : '[1:a]'
    // Small frames make the per-frame gain steps of the fades inaudible (128 samples ≈ 3 ms).
    const lines = [
      `[0:a]asetnsamples=n=128:p=0,volume='1-${speaking}':eval=frame[original]`,
      `${underSpeech}asetnsamples=n=128:p=0,volume='${speaking}':eval=frame[background]`,
      '[original][background]amix=inputs=2:normalize=0:duration=first[out]',
    ]
    await writeFile(filterPath, `${lines.join(';\n')}\n`)
    await this.exec(
      this.ffmpeg,
      [
        '-y', '-i', input.originalPath, '-i', input.backgroundPath, ...(roomTone ? ['-i', roomTone] : []),
        '-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out,
      ],
      ctx,
      'Background blending',
    )
    return out
  }

  /**
   * The room under the dub while someone speaks, or null: the voice track's own noise carried into each window
   * (scripts/noise_fill.py) when the voice track is given, else steady noise matching the original's floor
   * (scripts/room_tone.py). It is an
   * improvement, not a requirement: without Python, or if the script fails, the dub goes on without it.
   */
  private async roomLayer(input: DubBackgroundInput, ctx: StageContext): Promise<string | null> {
    if (!this.opts.pythonPath || input.speech.length === 0) return null
    try {
      if (input.vocalsPath && input.busy) {
        const request = path.join(ctx.workdir, 'noise_fill.json')
        const out = path.join(ctx.workdir, 'room_fill.wav')
        await writeFile(request, JSON.stringify({ windows: pairs(input.speech), busy: pairs(input.busy) }))
        await this.opts.run(
          this.opts.pythonPath,
          [this.opts.noiseFillScript ?? NOISE_FILL_SCRIPT, input.originalPath, input.backgroundPath, input.vocalsPath, request, out],
          { cwd: ctx.workdir, signal: ctx.signal },
        )
        return out
      }
      const windowsPath = path.join(ctx.workdir, 'speech_windows.json')
      const out = path.join(ctx.workdir, 'room_tone.wav')
      await writeFile(windowsPath, JSON.stringify(input.speech))
      await this.opts.run(
        this.opts.pythonPath,
        [this.opts.roomToneScript ?? ROOM_TONE_SCRIPT, input.originalPath, input.backgroundPath, windowsPath, out],
        { cwd: ctx.workdir, signal: ctx.signal },
      )
      return out
    } catch (error) {
      if (ctx.signal.aborted) throw error
      ctx.log.warn({ error }, 'room tone skipped: the dub goes on without the recreated noise floor')
      return null
    }
  }

  /** Like the room tone, an improvement and not a requirement: on failure the dub keeps the voice at its own level. */
  async loudness(file: string, ctx: StageContext): Promise<number | null> {
    let measured: { stderr: string }
    try {
      // framelog=verbose keeps the per-frame lines out of the output; the summary is printed either way.
      measured = await this.opts.run(
        this.ffmpeg,
        ['-nostdin', '-hide_banner', '-i', file, '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'],
        { cwd: ctx.workdir, signal: ctx.signal },
      )
    } catch (error) {
      if (ctx.signal.aborted) throw error
      ctx.log.warn({ error, file }, 'loudness not measured: the new voice keeps its own level')
      return null
    }
    const lufs = Number(/Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/.exec(measured.stderr)?.[1])
    // Gated loudness bottoms out at -70 LUFS: there is nothing to match.
    return Number.isFinite(lufs) && lufs > -70 ? lufs : null
  }

  /** An improvement, never a requirement: when it fails, the dub keeps the voice as it is. */
  async matchVoice(
    input: { originalVocalsPath: string; originalSpeech: TimeWindow[]; dubVocalsPath: string; dubSpeech: TimeWindow[]; pitchShiftSt?: number },
    ctx: StageContext,
  ): Promise<{ path: string; report: VoiceMatchReport } | null> {
    let voice = input.dubVocalsPath
    let pitchShiftSt = 0
    if (input.pitchShiftSt && Math.abs(input.pitchShiftSt) >= 0.25) {
      const shifted = path.join(ctx.workdir, 'dubbed_vocals_pitched.wav')
      const ratio = (2 ** (input.pitchShiftSt / 12)).toFixed(4)
      try {
        // Formants preserved: the voice moves to the speaker's pitch without sounding like a different size of person.
        await this.opts.run(
          this.ffmpeg,
          ['-y', '-i', voice, '-af', `rubberband=pitch=${ratio}:formant=preserved:pitchq=quality`, '-c:a', 'pcm_s16le', shifted],
          { cwd: ctx.workdir, signal: ctx.signal },
        )
        voice = shifted
        pitchShiftSt = input.pitchShiftSt
      } catch (error) {
        if (ctx.signal.aborted) throw error
        ctx.log.warn({ error }, 'pitch not corrected: the new voice keeps its own pitch')
      }
    }
    const unmatched = pitchShiftSt !== 0 ? { path: voice, report: { eq: null, bandwidthHz: null, room: null, pitchShiftSt } } : null
    if (!this.opts.pythonPath || input.originalSpeech.length === 0 || input.dubSpeech.length === 0) return unmatched
    const spans = path.join(ctx.workdir, 'voice_match_spans.json')
    const out = path.join(ctx.workdir, 'dubbed_vocals_matched.wav')
    const reportPath = path.join(ctx.workdir, 'voice_match.json')
    await writeFile(spans, JSON.stringify({ original: pairs(input.originalSpeech), dub: pairs(input.dubSpeech) }))
    try {
      await this.opts.run(
        this.opts.pythonPath,
        [this.opts.voiceMatchScript ?? VOICE_MATCH_SCRIPT, input.originalVocalsPath, voice, spans, out, reportPath],
        { cwd: ctx.workdir, signal: ctx.signal },
      )
      const report = JSON.parse(await readFile(reportPath, 'utf8')) as Omit<VoiceMatchReport, 'pitchShiftSt'>
      return { path: out, report: { eq: report.eq, bandwidthHz: report.bandwidthHz, room: report.room, pitchShiftSt } }
    } catch (error) {
      if (ctx.signal.aborted) throw error
      ctx.log.warn({ error }, 'voice not matched to the original recording: the new voice keeps its own sound')
      return unmatched
    }
  }

  async mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string; voiceGainDb?: number; captions?: Caption[] },
    ctx: StageContext,
  ): Promise<{ outputPath: string }> {
    const outputPath = path.join(ctx.workdir, 'dubbed.mp4')
    const gain = input.voiceGainDb ?? 0
    const tracks = gain === 0 ? '[1:a][2:a]' : `[2:a]volume=${gain}dB[voice];[1:a][voice]`
    // Both tracks keep their own level; the limiter only catches peaks where the new voice lands on loud music,
    // without raising the overall level (level=false) or shifting the audio against the picture (latency=true).
    const audio = `${tracks}amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95:level=false:latency=true[a]`
    const picture = await this.captionFilter(input.captions ?? [], ctx)
    await this.exec(
      this.ffmpeg,
      [
        '-y', '-i', input.videoPath, '-i', input.backgroundPath, '-i', input.dubbedVocalsPath,
        '-filter_complex', picture ? `${picture};${audio}` : audio,
        '-map', picture ? '[v]' : '0:v:0', '-map', '[a]',
        ...(picture ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy']),
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
        outputPath,
      ],
      ctx,
      'Muxing',
    )
    return { outputPath }
  }

  /**
   * Draws translated captions near the top of the picture while the original text is on screen, as fansubs
   * translate signs. Null when there is nothing to draw, no font, or a script the font cannot show.
   */
  private async captionFilter(captions: Caption[], ctx: StageContext): Promise<string | null> {
    const font = this.opts.captionFont ?? CAPTION_FONT
    const shown = captions.filter((c) => c.endMs > c.startMs && c.translation.trim() !== '')
    if (shown.length === 0) return null
    if (!(await access(font).then(() => true, () => false))) {
      ctx.log.warn({ font }, 'captions left out: their font is missing')
      return null
    }
    const drawable = shown.filter((c) => DRAWABLE.test(c.translation))
    if (drawable.length < shown.length) ctx.log.warn({ skipped: shown.length - drawable.length }, 'captions in a script the font cannot show were left out')
    if (drawable.length === 0) return null
    const filters: string[] = []
    for (const [k, caption] of drawable.entries()) {
      const file = path.join(ctx.workdir, `caption-${k}.txt`)
      await writeFile(file, wrap(caption.translation.trim(), 28))
      filters.push(
        `drawtext=fontfile='${font}':textfile='${file}':expansion=none:fontsize=h/18:line_spacing=6:fontcolor=white` +
          `:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h*0.06` +
          `:enable='between(t,${seconds(caption.startMs)},${seconds(caption.endMs)})'`,
      )
    }
    return `[0:v]${filters.join(',')}[v]`
  }
}

/** Latin, Greek and Cyrillic, which the caption font covers, with digits, punctuation and symbols. */
const DRAWABLE = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}\p{P}\p{S}\s]*$/u

/** Breaks text into lines of about `width` characters, at spaces. */
function wrap(text: string, width: number): string {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines.join('\n')
}
