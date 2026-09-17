import { pino, type Logger } from 'pino'

export type { Logger }

export function createLogger(level = 'info', pretty = false): Logger {
  return pino({
    level,
    ...(pretty ? { transport: { target: 'pino-pretty' } } : {}),
  })
}

export function silentLogger(): Logger {
  return pino({ level: 'silent' })
}
