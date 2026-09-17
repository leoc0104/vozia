import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import type { AudioSeparator, StageContext } from '../../pipeline/contracts.js'

export class FakeSeparator implements AudioSeparator {
  async separate(audioPath: string, ctx: StageContext): Promise<{ vocalsPath: string; backgroundPath: string }> {
    const vocalsPath = path.join(ctx.workdir, 'vocals.wav')
    const backgroundPath = path.join(ctx.workdir, 'background.wav')
    await copyFile(audioPath, vocalsPath)
    await copyFile(audioPath, backgroundPath)
    return { vocalsPath, backgroundPath }
  }
}
