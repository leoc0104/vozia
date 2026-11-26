import type { SpeechSynthesizer, StageContext, VoiceRequest, VoiceSession } from '../../pipeline/contracts.js'
import { PipelineError, ProviderError } from '../../pipeline/errors.js'
import type { ElevenLabsClient } from './client.js'

export interface ElevenLabsSynthesizerOptions {
  client: Pick<ElevenLabsClient, 'addVoice' | 'deleteVoice' | 'textToSpeech'>
  /** The speech model; defaults to DEFAULT_SPEECH_MODEL. */
  modelId?: string
  /** Keep the instant voice clone after the job instead of deleting it (costs a voice slot). */
  keepClonedVoice?: boolean
}

/** ElevenLabs' most emotive model: it performs directions like [laughs] or [panicked] in the cloned voice. */
export const DEFAULT_SPEECH_MODEL = 'eleven_v4'

/** Eleven v3 and v4 perform bracketed directions; older models would read them aloud, so they get the plain words. */
export function modelPerformsDirections(modelId: string): boolean {
  return /^eleven_v[34](_|$)/.test(modelId)
}

/** Clones the speaker from a sample (or uses a stock voice) and speaks lines in that voice, one request per take. */
export class ElevenLabsSynthesizer implements SpeechSynthesizer {
  readonly performsDirections: boolean
  private readonly modelId: string

  constructor(private readonly opts: ElevenLabsSynthesizerOptions) {
    this.modelId = opts.modelId ?? DEFAULT_SPEECH_MODEL
    this.performsDirections = modelPerformsDirections(this.modelId)
  }

  async openVoice(req: VoiceRequest, ctx: StageContext): Promise<VoiceSession> {
    const { client } = this.opts
    let voiceId: string
    let cloned = false
    if (req.voiceMode === 'stock') {
      if (!req.stockVoiceId) throw new PipelineError('No stock voice was selected for this dub.')
      voiceId = req.stockVoiceId
    } else {
      if (!req.samplePath) throw new PipelineError('There is no voice sample to clone the speaker from.')
      voiceId = (await client.addVoice(`vozia-${Date.now().toString(36)}`, req.samplePath, ctx.signal)).voiceId
      cloned = true
    }
    // The expressive models take the target language, which helps them read numbers and names; older ones may not.
    const languageCode = this.performsDirections ? req.targetLanguage : undefined
    let withContext = true
    const modelId = this.modelId
    const keepClone = this.opts.keepClonedVoice === true
    return {
      async speak(line, destPath, ctx) {
        const base = { modelId, ...(languageCode ? { languageCode } : {}), ...(line.seed !== undefined ? { seed: line.seed } : {}) }
        const context = withContext && (line.previousText || line.nextText) ? { previousText: line.previousText, nextText: line.nextText } : null
        try {
          await client.textToSpeech(voiceId, line.text, { ...base, ...context }, destPath, ctx.signal)
        } catch (error) {
          // A model that refuses the neighbouring lines gets each line alone, for the rest of the dub.
          if (!context || !(error instanceof ProviderError) || (error.status !== 400 && error.status !== 422)) throw error
          ctx.log.warn({ error }, 'the speech model refused the neighbouring lines as context: speaking each line alone')
          withContext = false
          await client.textToSpeech(voiceId, line.text, base, destPath, ctx.signal)
        }
      },
      async close(ctx) {
        if (!cloned || keepClone) return
        await client.deleteVoice(voiceId, ctx.signal).catch((error: unknown) => {
          ctx.log.warn({ error, voiceId }, 'could not delete the cloned voice')
        })
      },
    }
  }
}
