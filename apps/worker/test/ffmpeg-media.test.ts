import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
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
      '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95:level=false:latency=true[a]',
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

describe('FfmpegMediaProcessor.buildDubBackground', () => {
  const speaking =
    'min(1,clip((t-0.840)/0.060,0,1)*clip((2.210-t)/0.060,0,1)+clip((t-3.840)/0.060,0,1)*clip((5.210-t)/0.060,0,1))'

  it('plays the original outside speech and the separated background during it, with short fades', async () => {
    const { runner, calls } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner, ffmpegPath: '/opt/ffmpeg' })
    const ctx = await stageContext()
    const out = await media.buildDubBackground(
      {
        originalPath: '/a/original.wav',
        backgroundPath: '/a/background.wav',
        speech: [
          { startMs: 900, endMs: 2150 },
          { startMs: 3900, endMs: 5150 },
        ],
      },
      ctx,
    )
    expect(out).toBe(path.join(ctx.workdir, 'background_blended.wav'))
    const filterPath = path.join(ctx.workdir, 'blend.filter')
    expect(await readFile(filterPath, 'utf8')).toBe(
      `[0:a]asetnsamples=n=128:p=0,volume='1-${speaking}':eval=frame[original];\n` +
        `[1:a]asetnsamples=n=128:p=0,volume='${speaking}':eval=frame[background];\n` +
        '[original][background]amix=inputs=2:normalize=0:duration=first[out]\n',
    )
    expect(calls[0]!.args).toEqual([
      '-y', '-i', '/a/original.wav', '-i', '/a/background.wav',
      '-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out,
    ])
  })

  it('adds the original steady noise floor under the dub while someone speaks', async () => {
    const { runner, calls } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner, pythonPath: '/py', roomToneScript: '/s/room_tone.py' })
    const ctx = await stageContext()
    const speech = [{ startMs: 900, endMs: 2150 }]
    const out = await media.buildDubBackground({ originalPath: '/a/o.wav', backgroundPath: '/a/b.wav', speech }, ctx)

    const windowsPath = path.join(ctx.workdir, 'speech_windows.json')
    const roomTone = path.join(ctx.workdir, 'room_tone.wav')
    expect(calls[0]).toEqual({ cmd: '/py', args: ['/s/room_tone.py', '/a/o.wav', '/a/b.wav', windowsPath, roomTone], cwd: ctx.workdir })
    expect(JSON.parse(await readFile(windowsPath, 'utf8'))).toEqual(speech)
    expect(calls[1]!.args.slice(0, 7)).toEqual(['-y', '-i', '/a/o.wav', '-i', '/a/b.wav', '-i', roomTone])
    const filter = await readFile(path.join(ctx.workdir, 'blend.filter'), 'utf8')
    expect(filter).toContain('[1:a][2:a]amix=inputs=2:normalize=0:duration=first,asetnsamples=n=128:p=0,volume=')
    expect(out).toBe(path.join(ctx.workdir, 'background_blended.wav'))
  })

  it('goes on without the noise floor when the room tone script fails', async () => {
    const { runner, calls } = createRecordingRunner((cmd) => (cmd === '/py' ? { fail: 'ModuleNotFoundError: numpy' } : undefined))
    const media = new FfmpegMediaProcessor({ run: runner, pythonPath: '/py' })
    const ctx = await stageContext()
    const warn = vi.spyOn(ctx.log, 'warn')
    await media.buildDubBackground({ originalPath: '/a/o.wav', backgroundPath: '/a/b.wav', speech: [{ startMs: 0, endMs: 900 }] }, ctx)

    expect(warn).toHaveBeenCalledOnce()
    expect(calls[1]!.args).not.toContain(path.join(ctx.workdir, 'room_tone.wav'))
    expect(await readFile(path.join(ctx.workdir, 'blend.filter'), 'utf8')).toContain("[1:a]asetnsamples=n=128:p=0,volume='")
  })

  it('keeps the original everywhere when nobody speaks', async () => {
    const { runner } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner, ffmpegPath: 'ffmpeg' })
    const ctx = await stageContext()
    await media.buildDubBackground({ originalPath: '/a/o.wav', backgroundPath: '/a/b.wav', speech: [] }, ctx)
    const filter = await readFile(path.join(ctx.workdir, 'blend.filter'), 'utf8')
    expect(filter).toContain("volume='1-0':eval=frame[original]")
    expect(filter).toContain("volume='0':eval=frame[background]")
  })
})
