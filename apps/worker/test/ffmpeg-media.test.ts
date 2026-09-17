import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FfmpegMediaProcessor } from '../src/drivers/ffmpeg-media.js'
import { FfmpegDuckSeparator } from '../src/drivers/ffmpeg-duck-separator.js'
import { ProcessError, createRecordingRunner } from '../src/drivers/process.js'
import { stageContext } from './helpers/factories.js'

describe('FfmpegMediaProcessor', () => {
  it('extracts audio, probes, thumbnails, clips and ducks with the expected arguments', async () => {
    const { runner, calls } = createRecordingRunner((cmd) => (cmd === 'ffprobe' ? { stdout: '12.5\n' } : undefined))
    const media = new FfmpegMediaProcessor({ run: runner })
    const ctx = await stageContext()
    const w = ctx.workdir

    expect(await media.extractAudio('/in/v.mp4', ctx)).toBe(path.join(w, 'audio.wav'))
    expect(await media.probeDurationSeconds('/in/v.mp4', ctx)).toBe(12.5)
    expect(await media.thumbnail('/in/v.mp4', ctx)).toBe(path.join(w, 'thumb.jpg'))
    expect(await media.clipAudio('/in/vocals.wav', { startSec: 0, durationSec: 60 }, ctx)).toBe(path.join(w, 'sample.mp3'))
    expect(await media.duck('/in/audio.wav', -14, ctx)).toBe(path.join(w, 'background.wav'))

    expect(calls.map((c) => c.cmd)).toEqual(['ffmpeg', 'ffprobe', 'ffmpeg', 'ffmpeg', 'ffmpeg'])
    expect(calls[0]!.args).toEqual(['-y', '-i', '/in/v.mp4', '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', path.join(w, 'audio.wav')])
    expect(calls[1]!.args).toEqual(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '/in/v.mp4'])
    expect(calls[2]!.args).toEqual(['-y', '-ss', '1', '-i', '/in/v.mp4', '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', path.join(w, 'thumb.jpg')])
    expect(calls[3]!.args).toEqual(['-y', '-ss', '0', '-t', '60', '-i', '/in/vocals.wav', '-c:a', 'libmp3lame', '-b:a', '128k', path.join(w, 'sample.mp3')])
    expect(calls[4]!.args).toEqual(['-y', '-i', '/in/audio.wav', '-af', 'volume=-14dB', path.join(w, 'background.wav')])
    expect(calls.every((c) => c.cwd === w)).toBe(true)
  })

  it('assembles the timeline through a filter script', async () => {
    const { runner, calls } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner, ffmpegPath: '/opt/ffmpeg' })
    const ctx = await stageContext()
    const out = await media.assembleTimeline(
      [
        { placement: { idx: 0, startMs: 0, tempo: 1 }, path: '/c/0.mp3' },
        { placement: { idx: 1, startMs: 1600, tempo: 1.25 }, path: '/c/1.mp3' },
      ],
      6000,
      ctx,
    )
    expect(out).toBe(path.join(ctx.workdir, 'dubbed_vocals.wav'))
    const filterPath = path.join(ctx.workdir, 'timeline.filter')
    expect(await readFile(filterPath, 'utf8')).toBe(
      '[1:a]adelay=0:all=1[c0];\n[2:a]atempo=1.25,adelay=1600:all=1[c1];\n[0:a][c0][c1]amix=inputs=3:normalize=0:duration=first[out]\n',
    )
    expect(calls[0]!.cmd).toBe('/opt/ffmpeg')
    expect(calls[0]!.args).toEqual([
      '-y', '-f', 'lavfi', '-t', '6.000', '-i', 'anullsrc=r=44100:cl=stereo', '-i', '/c/0.mp3', '-i', '/c/1.mp3',
      '-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out,
    ])
  })

  it('muxes background and dubbed vocals onto the video without re-encoding it', async () => {
    const { runner, calls } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner })
    const ctx = await stageContext()
    const { outputPath } = await media.mux({ videoPath: '/v.mp4', backgroundPath: '/bg.wav', dubbedVocalsPath: '/dub.wav' }, ctx)
    expect(outputPath).toBe(path.join(ctx.workdir, 'dubbed.mp4'))
    expect(calls[0]!.args).toEqual([
      '-y', '-i', '/v.mp4', '-i', '/bg.wav', '-i', '/dub.wav',
      '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0:duration=first[a]',
      '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outputPath,
    ])
  })

  it('maps process failures to provider errors', async () => {
    const ctx = await stageContext()
    const missing = new FfmpegMediaProcessor({
      run: async (cmd, args) => {
        throw new ProcessError(cmd, args, 'ENOENT', '')
      },
    })
    await expect(missing.probeDurationSeconds('/x', ctx)).rejects.toMatchObject({ provider: 'ffmpeg', message: 'ffprobe is not installed on the worker.' })

    const broken = new FfmpegMediaProcessor({ run: createRecordingRunner(() => ({ fail: 'line1\nInvalid data found when processing input' })).runner })
    await expect(broken.extractAudio('/x', ctx)).rejects.toMatchObject({ message: 'Audio extraction failed: Invalid data found when processing input' })

    const garbage = new FfmpegMediaProcessor({ run: createRecordingRunner(() => ({ stdout: 'N/A\n' })).runner })
    await expect(garbage.probeDurationSeconds('/x', ctx)).rejects.toMatchObject({ message: 'Could not read the media duration.' })
  })
})

describe('FfmpegDuckSeparator', () => {
  it('copies the mix as vocals and ducks the background', async () => {
    const { runner, calls } = createRecordingRunner()
    const ctx = await stageContext()
    const audio = path.join(ctx.workdir, 'audio.wav')
    await writeFile(audio, 'mix')
    const separator = new FfmpegDuckSeparator(new FfmpegMediaProcessor({ run: runner }), -12)
    const result = await separator.separate(audio, ctx)
    expect(result.vocalsPath).toBe(path.join(ctx.workdir, 'vocals.wav'))
    expect(await readFile(result.vocalsPath, 'utf8')).toBe('mix')
    expect(result.backgroundPath).toBe(path.join(ctx.workdir, 'background.wav'))
    expect(calls[0]!.args).toContain('volume=-12dB')
  })
})
