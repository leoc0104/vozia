import { execFile } from 'node:child_process'

export interface ProcessResult {
  stdout: string
  stderr: string
}

export interface ProcessOptions {
  cwd?: string
  signal?: AbortSignal
  timeoutMs?: number
}

export type ProcessRunner = (cmd: string, args: string[], opts?: ProcessOptions) => Promise<ProcessResult>

export class ProcessError extends Error {
  constructor(
    readonly cmd: string,
    readonly args: string[],
    readonly code: number | string | null,
    readonly stderrTail: string,
  ) {
    super(`${cmd} failed (${code ?? 'unknown'}): ${stderrTail || 'no output'}`)
    this.name = 'ProcessError'
  }
}

function tail(text: string, lines = 12): string {
  return text.trim().split('\n').slice(-lines).join('\n')
}

export const execFileRunner: ProcessRunner = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      {
        cwd: opts.cwd,
        signal: opts.signal,
        timeout: opts.timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (error) {
          const errno = error as NodeJS.ErrnoException & { signal?: string }
          const code = errno.code ?? errno.signal ?? null
          reject(new ProcessError(cmd, args, code, tail(String(stderr))))
          return
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      },
    )
  })

export interface RecordedCall {
  cmd: string
  args: string[]
  cwd?: string
}

export type RecordingScript = (cmd: string, args: string[]) => (Partial<ProcessResult> & { fail?: string }) | undefined

/** Test double: records every invocation and answers from an optional script. */
export function createRecordingRunner(script?: RecordingScript): { runner: ProcessRunner; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const runner: ProcessRunner = async (cmd, args, opts) => {
    calls.push({ cmd, args, cwd: opts?.cwd })
    const answer = script?.(cmd, args) ?? {}
    if (answer.fail) throw new ProcessError(cmd, args, 1, answer.fail)
    return { stdout: answer.stdout ?? '', stderr: answer.stderr ?? '' }
  }
  return { runner, calls }
}
