import { access } from 'node:fs/promises'
import path from 'node:path'
import type { AudioSeparator, StageContext } from '../pipeline/contracts.js'
import { ProviderError } from '../pipeline/errors.js'
import { ProcessError, type ProcessRunner } from './process.js'

const PROVIDER = 'demucs'
/** The model baked into the worker images (Dockerfile.dev and apps/worker/Dockerfile). */
const MODEL = 'htdemucs'

export interface DemucsSeparatorOptions {
  run: ProcessRunner
  demucsPath: string
}

/**
 * Local, free source separation with Demucs: splits the audio into the voice and everything else (music, sound
 * effects, room sound). The dub then replaces only the speech, and the voice copy learns from a clean voice.
 * Runs on the CPU at roughly twice real time, with the model cached in the image, so it never touches the network.
 */
export class DemucsSeparator implements AudioSeparator {
  constructor(private readonly opts: DemucsSeparatorOptions) {}

  async separate(audioPath: string, ctx: StageContext): Promise<{ vocalsPath: string; backgroundPath: string }> {
    const outDir = path.join(ctx.workdir, 'stems')
    try {
      await this.opts.run(
        this.opts.demucsPath,
        ['--two-stems', 'vocals', '-n', MODEL, '-d', 'cpu', '-o', outDir, '--filename', '{stem}.{ext}', audioPath],
        { signal: ctx.signal },
      )
    } catch (error) {
      if (!(error instanceof ProcessError)) throw error
      if (error.code === 'ENOENT') throw new ProviderError(PROVIDER, `${error.cmd} is not installed on the worker.`, { cause: error })
      if (error.code === 'ABORT_ERR' || error.code === 'SIGTERM') {
        throw new ProviderError(PROVIDER, 'Voice separation was interrupted.', { cause: error })
      }
      const lastLine = error.stderrTail.split('\n').at(-1) || 'unknown error'
      throw new ProviderError(PROVIDER, `Voice separation failed: ${lastLine}`, { cause: error })
    }

    const vocalsPath = path.join(outDir, MODEL, 'vocals.wav')
    const backgroundPath = path.join(outDir, MODEL, 'no_vocals.wav')
    try {
      await Promise.all([access(vocalsPath), access(backgroundPath)])
    } catch (cause) {
      throw new ProviderError(PROVIDER, 'Voice separation finished without writing the voice and background tracks.', { cause })
    }
    ctx.progress(1)
    return { vocalsPath, backgroundPath }
  }
}
