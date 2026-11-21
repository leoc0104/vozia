import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SpeechSynthesizer, StageContext, SynthesisRequest } from '../../pipeline/contracts.js'

export class FakeSynthesizer implements SpeechSynthesizer {
  readonly performsDirections: boolean

  constructor(opts: { performsDirections?: boolean } = {}) {
    this.performsDirections = opts.performsDirections ?? false
  }

  async synthesize(req: SynthesisRequest, ctx: StageContext): Promise<{ dubbedVocalsPath: string }> {
    const dubbedVocalsPath = path.join(ctx.workdir, 'dubbed_vocals.wav')
    const spoken = req.segments.map((s) => (this.performsDirections && s.performanceText) || s.translatedText)
    await writeFile(dubbedVocalsPath, `fake ${req.voiceMode} speech: ${spoken.join(' ')}\n`)
    req.segments.forEach((_, i) => ctx.progress((i + 1) / req.segments.length))
    return { dubbedVocalsPath }
  }
}
