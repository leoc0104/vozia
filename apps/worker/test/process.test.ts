import { describe, expect, it } from 'vitest'
import { ProcessError, createRecordingRunner, execFileRunner } from '../src/drivers/process.js'
import { PipelineError, ProviderError, userMessageFor } from '../src/pipeline/errors.js'

describe('execFileRunner', () => {
  it('captures stdout', async () => {
    const result = await execFileRunner('node', ['-e', 'process.stdout.write("hi")'])
    expect(result.stdout).toBe('hi')
  })

  it('rejects with a ProcessError carrying the stderr tail', async () => {
    await expect(
      execFileRunner('node', ['-e', 'process.stderr.write("boom\\nbang"); process.exit(3)']),
    ).rejects.toMatchObject({ name: 'ProcessError', code: 3, stderrTail: 'boom\nbang' })
  })

  it('reports a missing binary', async () => {
    await expect(execFileRunner('definitely-not-a-binary-xyz', [])).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('createRecordingRunner', () => {
  it('records calls and answers from the script', async () => {
    const { runner, calls } = createRecordingRunner((cmd) => (cmd === 'ffprobe' ? { stdout: '12.5\n' } : undefined))
    const probe = await runner('ffprobe', ['-i', 'x'], { cwd: '/tmp' })
    expect(probe.stdout).toBe('12.5\n')
    expect(calls).toEqual([{ cmd: 'ffprobe', args: ['-i', 'x'], cwd: '/tmp' }])
    await expect(
      createRecordingRunner(() => ({ fail: 'nope' })).runner('ffmpeg', []),
    ).rejects.toBeInstanceOf(ProcessError)
  })
})

describe('user messages', () => {
  it('prefers the pipeline message and hides internals', () => {
    expect(userMessageFor(new PipelineError('No speech detected.'))).toBe('No speech detected.')
    expect(userMessageFor(new ProviderError('elevenlabs', 'ElevenLabs rejected the API key', { status: 401 }))).toBe(
      'ElevenLabs rejected the API key',
    )
    const abort = new Error('x')
    abort.name = 'AbortError'
    expect(userMessageFor(abort)).toBe('The stage timed out.')
    expect(userMessageFor(new Error('ECONNRESET'))).toBe('Unexpected error: ECONNRESET')
    expect(userMessageFor('weird')).toBe('Unexpected error: weird')
    expect(userMessageFor(new Error('x'.repeat(2000))).length).toBeLessThanOrEqual(500)
  })
})
