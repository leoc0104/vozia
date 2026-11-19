import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DemucsSeparator } from '../src/drivers/demucs-separator.js'
import { ProcessError, createRecordingRunner, type ProcessRunner } from '../src/drivers/process.js'
import { ProviderError } from '../src/pipeline/errors.js'
import { stageContext } from './helpers/factories.js'

/** Answers like the real CLI: writes `vocals.wav` and `no_vocals.wav` under `<out>/htdemucs/`. */
function writesStems(cmd: string, args: string[]) {
  if (cmd !== 'demucs') return undefined
  const dir = path.join(args[args.indexOf('-o') + 1]!, 'htdemucs')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'vocals.wav'), 'voice only')
  writeFileSync(path.join(dir, 'no_vocals.wav'), 'music, effects and room sound')
  return { stderr: 'Separated tracks will be stored in …' }
}

describe('DemucsSeparator', () => {
  it('splits the audio into the voice and everything else, on the CPU', async () => {
    const { runner, calls } = createRecordingRunner(writesStems)
    const ctx = await stageContext()
    const result = await new DemucsSeparator({ run: runner, demucsPath: 'demucs' }).separate('/work/audio.wav', ctx)

    expect(calls).toEqual([
      {
        cmd: 'demucs',
        args: [
          '--two-stems', 'vocals',
          '-n', 'htdemucs',
          '-d', 'cpu',
          '-o', path.join(ctx.workdir, 'stems'),
          '--filename', '{stem}.{ext}',
          '/work/audio.wav',
        ],
        cwd: undefined,
      },
    ])
    expect(await readFile(result.vocalsPath, 'utf8')).toBe('voice only')
    expect(await readFile(result.backgroundPath, 'utf8')).toBe('music, effects and room sound')
    expect(ctx.progressValues.at(-1)).toBe(1)
  })

  it('uses the configured command', async () => {
    const { runner, calls } = createRecordingRunner((_cmd, args) => writesStems('demucs', args))
    const ctx = await stageContext()
    await new DemucsSeparator({ run: runner, demucsPath: '/opt/demucs/bin/demucs' }).separate('/work/audio.wav', ctx)
    expect(calls[0]!.cmd).toBe('/opt/demucs/bin/demucs')
  })

  it('explains a failed separation with the last line Demucs printed', async () => {
    const { runner } = createRecordingRunner(() => ({ fail: 'Traceback (most recent call last):\nRuntimeError: not enough memory' }))
    const ctx = await stageContext()
    const separation = new DemucsSeparator({ run: runner, demucsPath: 'demucs' }).separate('/work/audio.wav', ctx)
    await expect(separation).rejects.toBeInstanceOf(ProviderError)
    await expect(separation).rejects.toThrow('Voice separation failed: RuntimeError: not enough memory')
  })

  it('says when Demucs is not installed on the worker', async () => {
    const runner: ProcessRunner = async (cmd, args) => {
      throw new ProcessError(cmd, args, 'ENOENT', '')
    }
    const ctx = await stageContext()
    await expect(new DemucsSeparator({ run: runner, demucsPath: 'demucs' }).separate('/work/audio.wav', ctx)).rejects.toThrow(
      'demucs is not installed on the worker.',
    )
  })

  it('fails clearly when Demucs exits without writing both tracks', async () => {
    const { runner } = createRecordingRunner(() => ({ stdout: '' }))
    const ctx = await stageContext()
    await expect(new DemucsSeparator({ run: runner, demucsPath: 'demucs' }).separate('/work/audio.wav', ctx)).rejects.toThrow(
      'Voice separation finished without writing the voice and background tracks.',
    )
  })
})
