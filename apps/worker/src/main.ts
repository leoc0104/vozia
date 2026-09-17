import { assertConfig, loadConfig, type WorkerConfig } from './config.js'
import { createSql } from './db.js'
import { buildComponents } from './drivers/index.js'
import { execFileRunner } from './drivers/process.js'
import { createLogger, type Logger } from './logger.js'
import { WorkerRunner } from './runner.js'

/** Fails fast when a selected real driver needs a binary that is not on this machine. */
async function preflightBinaries(config: WorkerConfig, log: Logger): Promise<void> {
  const checks: [string, string[]][] = []
  if (config.drivers.media === 'ffmpeg') checks.push([config.ffmpegPath, ['-version']], [config.ffprobePath, ['-version']])
  if (config.pipeline === 'staged' && config.drivers.ingestor === 'ytdlp') checks.push([config.ytdlpPath, ['--version']])
  for (const [cmd, args] of checks) {
    try {
      const { stdout } = await execFileRunner(cmd, args, { timeoutMs: 15_000 })
      log.info({ cmd, version: stdout.split('\n')[0] }, 'binary available')
    } catch (error) {
      throw new Error(`${cmd} is required by the selected drivers but could not be executed: ${(error as Error).message}`)
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const log = createLogger(config.logLevel, config.nodeEnv !== 'production' && Boolean(process.stdout.isTTY))
  assertConfig(config)
  await preflightBinaries(config, log)

  const sql = createSql(config.databaseUrl!)
  const { pipeline, queue, repo } = buildComponents(config, { sql, log })
  const runner = new WorkerRunner({ queue, repo, pipeline, log, config })
  log.info({ pipeline: pipeline.name, drivers: config.drivers, concurrency: config.concurrency }, 'vozia worker started')
  runner.start()

  let stopping = false
  const shutdown = async (signal: string) => {
    if (stopping) return
    stopping = true
    log.info({ signal }, 'shutting down; waiting for in-flight jobs')
    await runner.stop()
    await sql.end({ timeout: 5 })
    process.exit(0)
  }
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
