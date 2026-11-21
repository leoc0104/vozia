import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { MediaProcessor, SpeechSynthesizer, StageContext, SynthesisRequest } from '../../pipeline/contracts.js'
import { PipelineError } from '../../pipeline/errors.js'
import { planTimeline } from '../../pipeline/timeline.js'
import type { ElevenLabsClient } from './client.js'

export interface ElevenLabsSynthesizerOptions {
  client: Pick<ElevenLabsClient, 'addVoice' | 'deleteVoice' | 'textToSpeech'>
  media: MediaProcessor
  /** The speech model; defaults to DEFAULT_SPEECH_MODEL. */
  modelId?: string
  /** Keep the instant voice clone after the job instead of deleting it (costs a voice slot). */
  keepClonedVoice?: boolean
  sampleSeconds?: number
}

/** ElevenLabs' most emotive model: it performs directions like [laughs] or [panicked] in the cloned voice. */
export const DEFAULT_SPEECH_MODEL = 'eleven_v4'

/** Eleven v3 and v4 perform bracketed directions; older models would read them aloud, so they get the plain words. */
export function modelPerformsDirections(modelId: string): boolean {
  return /^eleven_v[34](_|$)/.test(modelId)
}

/** Clones the speaker (or uses a stock voice), synthesizes each translated cue and lays the clips on the original timeline. */
export class ElevenLabsSynthesizer implements SpeechSynthesizer {
  readonly performsDirections: boolean
  private readonly modelId: string

  constructor(private readonly opts: ElevenLabsSynthesizerOptions) {
    this.modelId = opts.modelId ?? DEFAULT_SPEECH_MODEL
    this.performsDirections = modelPerformsDirections(this.modelId)
  }

  async synthesize(req: SynthesisRequest, ctx: StageContext): Promise<{ dubbedVocalsPath: string }> {
    const { client, media } = this.opts
    let voiceId: string
    let cloned = false

    if (req.voiceMode === 'stock') {
      if (!req.stockVoiceId) throw new PipelineError('No stock voice was selected for this dub.')
      voiceId = req.stockVoiceId
    } else {
      const sample = await media.clipAudio(req.vocalsPath, { startSec: 0, durationSec: this.opts.sampleSeconds ?? 60 }, ctx)
      voiceId = (await client.addVoice(`vozia-${Date.now().toString(36)}`, sample, ctx.signal)).voiceId
      cloned = true
    }

    try {
      const spoken = req.segments.filter((s) => s.translatedText.trim() !== '')
      const clipsDir = path.join(ctx.workdir, 'clips')
      await mkdir(clipsDir, { recursive: true })
      const clipPaths: string[] = []
      const clipDurationsMs: number[] = []
      for (const [i, segment] of spoken.entries()) {
        const clipPath = path.join(clipsDir, `${segment.idx}.mp3`)
        const text = (this.performsDirections && segment.performanceText) || segment.translatedText
        await client.textToSpeech(voiceId, text, { modelId: this.modelId }, clipPath, ctx.signal)
        clipPaths.push(clipPath)
        clipDurationsMs.push(Math.round((await media.probeDurationSeconds(clipPath, ctx)) * 1000))
        ctx.progress((i + 1) / (spoken.length + 1))
      }
      const placements = new Map(planTimeline(spoken, clipDurationsMs, req.totalDurationMs).map((p) => [p.idx, p]))
      const clips = spoken.map((segment, i) => ({ placement: placements.get(segment.idx)!, path: clipPaths[i]! }))
      const dubbedVocalsPath = await media.assembleTimeline(clips, req.totalDurationMs, ctx)
      ctx.progress(1)
      return { dubbedVocalsPath }
    } finally {
      if (cloned && !this.opts.keepClonedVoice) {
        await client.deleteVoice(voiceId, ctx.signal).catch((error: unknown) => {
          ctx.log.warn({ error, voiceId }, 'could not delete the cloned voice')
        })
      }
    }
  }
}
