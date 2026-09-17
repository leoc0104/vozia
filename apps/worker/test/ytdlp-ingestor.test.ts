import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { YtdlpIngestor } from '../src/drivers/ytdlp-ingestor.js'
import { FakeMedia, FakeObjectStorage } from '../src/drivers/fake/index.js'
import { ProcessError, createRecordingRunner } from '../src/drivers/process.js'
import { stageContext, tempDir } from './helpers/factories.js'

async function setup(script?: Parameters<typeof createRecordingRunner>[0]) {
  const { runner, calls } = createRecordingRunner(script)
  const storage = new FakeObjectStorage(await tempDir())
  const media = new FakeMedia({ durationSeconds: 90 })
  const ingestor = new YtdlpIngestor({ run: runner, media, storage, ytdlpPath: '/usr/local/bin/yt-dlp' })
  return { ingestor, calls, storage }
}

describe('YtdlpIngestor', () => {
  it('downloads YouTube videos with yt-dlp and reads the title', async () => {
    const { ingestor, calls } = await setup(() => ({ stdout: '{"title":"My clip","id":"x"}\n' }))
    const ctx = await stageContext()
    const result = await ingestor.ingest({ sourceType: 'youtube', sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', storagePath: null }, ctx)
    expect(result).toMatchObject({ title: 'My clip', downloaded: true, durationSeconds: 90, videoPath: path.join(ctx.workdir, 'source.mp4') })
    expect(result.audioPath).toBe(path.join(ctx.workdir, 'audio.wav'))
    expect(result.thumbnailPath).toBe(path.join(ctx.workdir, 'thumb.jpg'))
    expect(calls[0]!.cmd).toBe('/usr/local/bin/yt-dlp')
    expect(calls[0]!.args).toEqual([
      '-f', 'bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4]/b', '--merge-output-format', 'mp4', '--no-playlist', '--no-progress',
      '--print-json', '-o', path.join(ctx.workdir, 'source.mp4'), 'https://youtu.be/dQw4w9WgXcQ',
    ])
    expect(ctx.progressValues).toEqual([0.5, 1])
  })

  it('fetches uploaded sources from storage, keeping the extension', async () => {
    const { ingestor, calls, storage } = await setup()
    await storage.put('sources', 'owner/video/original.mov', 'mov bytes')
    const ctx = await stageContext()
    const result = await ingestor.ingest({ sourceType: 'upload', sourceUrl: null, storagePath: 'owner/video/original.mov' }, ctx)
    expect(result.downloaded).toBe(false)
    expect(result.title).toBeNull()
    expect(result.videoPath).toBe(path.join(ctx.workdir, 'source.mov'))
    expect(await readFile(result.videoPath, 'utf8')).toBe('mov bytes')
    expect(calls).toEqual([])
  })

  it('maps yt-dlp failures to user-facing messages', async () => {
    const ctx = await stageContext()
    const blocked = await setup(() => ({ fail: 'WARNING: x\nERROR: Sign in to confirm you are not a bot' }))
    await expect(blocked.ingestor.ingest({ sourceType: 'youtube', sourceUrl: 'https://youtu.be/a', storagePath: null }, ctx)).rejects.toMatchObject({
      provider: 'youtube',
      message: 'Could not download the YouTube video: ERROR: Sign in to confirm you are not a bot',
    })
    const missing = new YtdlpIngestor({
      run: async (cmd, args) => {
        throw new ProcessError(cmd, args, 'ENOENT', '')
      },
      media: new FakeMedia(),
      storage: new FakeObjectStorage(await tempDir()),
    })
    await expect(missing.ingest({ sourceType: 'youtube', sourceUrl: 'https://youtu.be/a', storagePath: null }, ctx)).rejects.toMatchObject({
      message: 'yt-dlp is not installed on the worker.',
    })
    await expect(missing.ingest({ sourceType: 'upload', sourceUrl: null, storagePath: null }, ctx)).rejects.toMatchObject({
      message: 'The video has no source to ingest.',
    })
  })
})
