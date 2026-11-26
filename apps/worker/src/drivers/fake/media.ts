import { copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  Frame,
  MediaProcessor,
  Piece,
  StageContext,
  VoiceAnalysis,
  VoiceAnalysisRequest,
} from '../../pipeline/contracts.js'
import type { TimeWindow } from '../../pipeline/speech-windows.js'

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

  async analyzeVoice(_vocalsPath: string, _request: VoiceAnalysisRequest, _ctx: StageContext): Promise<VoiceAnalysis | null> {
    return null
  }

  async sceneCuts(_videoPath: string, _ctx: StageContext): Promise<number[]> {
    return []
  }

  async frames(_videoPath: string, _timesMs: number[], _ctx: StageContext): Promise<Frame[]> {
    return []
  }

  async buildDubBackground(
    input: { originalPath: string; backgroundPath: string; speech: TimeWindow[] },
    ctx: StageContext,
  ): Promise<string> {
    const out = path.join(ctx.workdir, 'background_blended.wav')
    await writeFile(out, `fake background, original audio outside ${input.speech.length} speech windows\n`)
    return out
  }

  async joinSpans(_inputPath: string, spans: TimeWindow[], ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'sample.mp3')
    await writeFile(out, `fake sample of ${spans.length} stretches\n`)
    return out
  }

  async joinClips(paths: string[], gapMs: number, ctx: StageContext): Promise<{ path: string; spans: TimeWindow[] }> {
    const out = path.join(ctx.workdir, 'takes.wav')
    await writeFile(out, `fake takes: ${paths.length}\n`)
    const length = (this.opts.durationSeconds ?? 42) * 1000
    return { path: out, spans: paths.map((_, k) => ({ startMs: k * (length + gapMs), endMs: k * (length + gapMs) + length })) }
  }

  async assembleTimeline(pieces: Piece[], _totalDurationMs: number, ctx: StageContext): Promise<string> {
    const out = path.join(ctx.workdir, 'dubbed_vocals.wav')
    await writeFile(out, `fake timeline of ${pieces.length} pieces\n`)
    return out
  }

  async loudness(_path: string, _ctx: StageContext): Promise<number | null> {
    return null
  }

  async mux(
    input: { videoPath: string; backgroundPath: string; dubbedVocalsPath: string; voiceGainDb?: number },
    ctx: StageContext,
  ): Promise<{ outputPath: string }> {
    const outputPath = path.join(ctx.workdir, 'dubbed.mp4')
    await copyFile(input.videoPath, outputPath)
    return { outputPath }
  }
}
