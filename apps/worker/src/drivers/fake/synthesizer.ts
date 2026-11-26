import { writeFile } from 'node:fs/promises'
import type { SpeechSynthesizer, SpokenLine, StageContext, VoiceRequest, VoiceSession } from '../../pipeline/contracts.js'

export class FakeSynthesizer implements SpeechSynthesizer {
  readonly performsDirections: boolean
  /** Every line spoken, in order, for tests. */
  readonly spoken: SpokenLine[] = []

  constructor(opts: { performsDirections?: boolean } = {}) {
    this.performsDirections = opts.performsDirections ?? false
  }

  async openVoice(req: VoiceRequest, _ctx: StageContext): Promise<VoiceSession> {
    const spoken = this.spoken
    return {
      async speak(line: SpokenLine, destPath: string) {
        spoken.push(line)
        await writeFile(destPath, `fake ${req.voiceMode} speech: ${line.text}\n`)
      },
      async close() {},
    }
  }
}
