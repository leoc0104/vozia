import { writeFileSync } from 'node:fs'
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

  it('lays the pieces of each take on the timeline, trimmed, sped up or slowed down, with tiny fades', async () => {
    const { runner, calls } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner, ffmpegPath: '/opt/ffmpeg' })
    const ctx = await stageContext()
    const out = await media.assembleTimeline(
      [
        { path: '/c/0-1.mp3', fromMs: 90, toMs: 470, outStartMs: 13_780, tempo: 1 },
        { path: '/c/0-1.mp3', fromMs: 470, toMs: 900, outStartMs: 14_240, tempo: 1.25 },
      ],
      6000,
      ctx,
    )
    expect(out).toBe(path.join(ctx.workdir, 'dubbed_vocals.wav'))
    const filterPath = path.join(ctx.workdir, 'timeline.filter')
    expect(await readFile(filterPath, 'utf8')).toBe(
      '[1:a]atrim=start=0.090:end=0.470,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=0.375:d=0.005,adelay=13780:all=1[c0];\n' +
        '[2:a]atrim=start=0.470:end=0.900,asetpts=PTS-STARTPTS,atempo=1.25,afade=t=in:d=0.005,afade=t=out:st=0.339:d=0.005,adelay=14240:all=1[c1];\n' +
        '[0:a][c0][c1]amix=inputs=3:normalize=0:duration=first[out]\n',
    )
    expect(calls[0]!.cmd).toBe('/opt/ffmpeg')
    expect(calls[0]!.args).toEqual([
      '-y', '-f', 'lavfi', '-t', '6.000', '-i', 'anullsrc=r=44100:cl=stereo', '-i', '/c/0-1.mp3', '-i', '/c/0-1.mp3',
      '-filter_complex_script', filterPath, '-map', '[out]', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', out,
    ])
  })

  it('joins calm stretches of the voice into a sample to clone from', async () => {
    const { runner, calls } = createRecordingRunner()
    const ctx = await stageContext()
    const out = await new FfmpegMediaProcessor({ run: runner }).joinSpans('/a/vocals.wav', [{ startMs: 1000, endMs: 2500 }, { startMs: 4000, endMs: 4500 }], ctx)
    expect(out).toBe(path.join(ctx.workdir, 'sample.mp3'))
    expect(await readFile(path.join(ctx.workdir, 'sample.filter'), 'utf8')).toBe(
      '[0:a]asplit=2[a0][a1];\n' +
        '[a0]atrim=start=1.000:end=2.500,asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=1.490:d=0.01,apad=pad_dur=0.25[s0];\n' +
        '[a1]atrim=start=4.000:end=4.500,asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=0.490:d=0.01,apad=pad_dur=0.25[s1];\n' +
        '[s0][s1]concat=n=2:v=0:a=1[out]\n',
    )
    expect(calls[0]!.args).toEqual([
      '-y', '-i', '/a/vocals.wav', '-filter_complex_script', path.join(ctx.workdir, 'sample.filter'),
      '-map', '[out]', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', out,
    ])
  })

  it('joins takes into one file for measuring and says where each landed', async () => {
    const { runner, calls } = createRecordingRunner((cmd) => (cmd === 'ffprobe' ? { stdout: '1.25\n' } : undefined))
    const ctx = await stageContext()
    const joined = await new FfmpegMediaProcessor({ run: runner }).joinClips(['/c/0-1.mp3', '/c/1-1.mp3'], 600, ctx)
    expect(joined.spans).toEqual([{ startMs: 0, endMs: 1250 }, { startMs: 1850, endMs: 3100 }])
    expect(calls[0]!.args).toEqual(['-y', '-i', '/c/0-1.mp3', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', path.join(ctx.workdir, 'joined', '0-1-0.wav')])
    expect(await readFile(path.join(ctx.workdir, 'joined', 'join.filter'), 'utf8')).toBe(
      '[0:a]apad=pad_dur=0.600[c0];\n[1:a]apad=pad_dur=0.600[c1];\n[c0][c1]concat=n=2:v=0:a=1[out]\n',
    )
    expect(calls.at(-1)!.args[0]).toBe('-y')
    expect(joined.path).toMatch(/joined\/takes-.+\.wav$/)
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

  it('raises or lowers the new voice in the mix by the given gain', async () => {
    const { runner, calls } = createRecordingRunner()
    const media = new FfmpegMediaProcessor({ run: runner })
    const ctx = await stageContext()
    await media.mux({ videoPath: '/v.mp4', backgroundPath: '/bg.wav', dubbedVocalsPath: '/dub.wav', voiceGainDb: 4.6 }, ctx)
    expect(calls[0]!.args).toContain(
      '[2:a]volume=4.6dB[voice];[1:a][voice]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95:level=false:latency=true[a]',
    )
  })

  it('measures integrated loudness, and gives up on silence or an unreadable answer', async () => {
    const summary = 'Summary:\n\n  Integrated loudness:\n    I:         -16.3 LUFS\n    Threshold: -26.5 LUFS\n'
    const { runner, calls } = createRecordingRunner(() => ({ stderr: summary }))
    const ctx = await stageContext()
    expect(await new FfmpegMediaProcessor({ run: runner }).loudness('/a/v.wav', ctx)).toBe(-16.3)
    expect(calls[0]!.args).toEqual(['-nostdin', '-hide_banner', '-i', '/a/v.wav', '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'])

    const silent = createRecordingRunner(() => ({ stderr: summary.replace('-16.3', '-70.0') })).runner
    expect(await new FfmpegMediaProcessor({ run: silent }).loudness('/a/v.wav', ctx)).toBeNull()
    const garbage = createRecordingRunner(() => ({ stderr: 'nothing useful' })).runner
    expect(await new FfmpegMediaProcessor({ run: garbage }).loudness('/a/v.wav', ctx)).toBeNull()
    const failing = createRecordingRunner(() => ({ fail: 'Invalid data found when processing input' })).runner
    const warn = vi.spyOn(ctx.log, 'warn')
    expect(await new FfmpegMediaProcessor({ run: failing }).loudness('/a/v.wav', ctx)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
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

describe('FfmpegMediaProcessor.analyzeVoice', () => {
  const request = {
    lines: [
      { idx: 0, spans: [{ startMs: 0, endMs: 500 }, { startMs: 600, endMs: 1200 }] },
      { idx: 1, spans: [{ startMs: 1500, endMs: 3000 }] },
    ],
    words: [{ startMs: 0, endMs: 500 }],
    events: [{ startMs: 3100.4, endMs: 3900 }],
  }
  const measure = (loudnessDb: number | null, pitchSt: number | null) => ({
    loudnessDb, pitchSt, rangeSt: 4, peakSt: 20, endingSt: -2, voiced: 0.8,
  })

  it('measures each line, the wordless voice and the level curve with the voice analysis script', async () => {
    const { runner, calls } = createRecordingRunner((cmd, args) => {
      if (cmd !== '/py') return undefined
      writeFileSync(args[3]!, JSON.stringify({
        usual: { loudnessDb: -13, pitchSt: 13 },
        lines: [{ idx: 0, ...measure(-12, 14) }, { idx: 1, ...measure(-14, null) }],
        sounds: [{ startMs: 3950, endMs: 4400, loudnessDb: -16, pitchSt: 31, voiced: 0.5 }],
        envelope: { stepMs: 10, db: [-40, -12] },
      }))
      return {}
    })
    const media = new FfmpegMediaProcessor({ run: runner, pythonPath: '/py', voiceAnalysisScript: '/s/voice_analysis.py' })
    const ctx = await stageContext()
    const analysis = await media.analyzeVoice('/a/vocals.wav', request, ctx)

    const input = path.join(ctx.workdir, 'vocals.analysis-request.json')
    expect(calls[0]).toEqual({
      cmd: '/py',
      args: ['/s/voice_analysis.py', '/a/vocals.wav', input, path.join(ctx.workdir, 'vocals.analysis.json')],
      cwd: ctx.workdir,
    })
    expect(JSON.parse(await readFile(input, 'utf8'))).toEqual({
      lines: [{ idx: 0, spans: [[0, 500], [600, 1200]] }, { idx: 1, spans: [[1500, 3000]] }],
      words: [[0, 500]],
      events: [[3100, 3900]],
    })
    expect(analysis).toEqual({
      usual: { loudnessDb: -13, pitchSt: 13 },
      lines: new Map([[0, measure(-12, 14)], [1, measure(-14, null)]]),
      sounds: [{ startMs: 3950, endMs: 4400, loudnessDb: -16, pitchSt: 31, voiced: 0.5 }],
      envelope: { stepMs: 10, db: [-40, -12] },
    })
  })

  it('goes on without measurements when the script fails or there is no Python', async () => {
    const { runner } = createRecordingRunner(() => ({ fail: 'ModuleNotFoundError: numpy' }))
    const ctx = await stageContext()
    const warn = vi.spyOn(ctx.log, 'warn')
    expect(await new FfmpegMediaProcessor({ run: runner, pythonPath: '/py' }).analyzeVoice('/a/v.wav', request, ctx)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    expect(await new FfmpegMediaProcessor({ run: runner }).analyzeVoice('/a/v.wav', request, ctx)).toBeNull()
  })
})

describe('FfmpegMediaProcessor.sceneCuts and frames', () => {
  it('finds the cuts on a small copy of the picture, as one cut when two come within 150 ms', async () => {
    const stderr = 'n:0 pts_time:10.23 x\nn:1 pts_time:22.407 x\nn:2 pts_time:22.473 x\nn:3 pts_time:25.311 x\n'
    const { runner, calls } = createRecordingRunner(() => ({ stderr }))
    const ctx = await stageContext()
    expect(await new FfmpegMediaProcessor({ run: runner }).sceneCuts('/v.mp4', ctx)).toEqual([10_230, 22_407, 25_311])
    expect(calls[0]!.args).toContain("scale=160:-2,select='gt(scene,0.25)',showinfo")
  })

  it('has no cuts when the video cannot be read', async () => {
    const { runner } = createRecordingRunner(() => ({ fail: 'Invalid data found when processing input' }))
    expect(await new FfmpegMediaProcessor({ run: runner }).sceneCuts('/v.mp4', await stageContext())).toEqual([])
  })

  it('grabs a small JPEG at each time and skips the ones it cannot read', async () => {
    const { runner, calls } = createRecordingRunner((_cmd, args) => (args.includes('99.000') ? { fail: 'end of file' } : undefined))
    const ctx = await stageContext()
    const frames = await new FfmpegMediaProcessor({ run: runner }).frames('/v.mp4', [1500, 99_000], ctx)
    expect(frames).toEqual([{ timeMs: 1500, path: path.join(ctx.workdir, 'frames', '1500.jpg') }])
    expect(calls[0]!.args).toEqual([
      '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.500', '-i', '/v.mp4',
      '-frames:v', '1', '-vf', "scale='min(512,iw)':-2", '-q:v', '5', path.join(ctx.workdir, 'frames', '1500.jpg'),
    ])
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
