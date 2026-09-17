import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SpeechSynthesizer, StageContext, SynthesisRequest } from '../../pipeline/contracts.js'

export class FakeSynthesizer implements SpeechSynthesizer {
  async synthesize(req: SynthesisRequest, ctx: StageContext): Promise<{ dubbedVocalsPath: string }> {
    const dubbedVocalsPath = path.join(ctx.workdir, 'dubbed_vocals.wav')
    await writeFile(dubbedVocalsPath, `fake ${req.voiceMode} speech: ${req.segments.map((s) => s.translatedText).join(' ')}\n`)
    req.segments.forEach((_, i) => ctx.progress((i + 1) / req.segments.length))
    return { dubbedVocalsPath }
  }
}
