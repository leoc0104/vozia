import { z } from 'zod'
import { PIPELINES } from '@vozia/shared'

const DriversSchema = z.object({
  ingestor: z.enum(['fake', 'ytdlp']),
  separator: z.enum(['fake', 'ffmpeg-duck', 'replicate-demucs']),
  transcriber: z.enum(['fake', 'elevenlabs']),
  translator: z.enum(['fake', 'anthropic']),
  synthesizer: z.enum(['fake', 'elevenlabs']),
  media: z.enum(['fake', 'ffmpeg']),
  storage: z.enum(['fake', 'supabase']),
})

export type DriverSelection = z.infer<typeof DriversSchema>

export const WorkerConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  logLevel: z.string(),
  databaseUrl: z.string().optional(),
  supabaseUrl: z.string().optional(),
  supabaseServiceRoleKey: z.string().optional(),
  pipeline: z.enum(PIPELINES),
  drivers: DriversSchema,
  concurrency: z.coerce.number().int().min(1),
  pollMs: z.coerce.number().int().min(100),
  visibilityTimeoutS: z.coerce.number().int().min(10),
  heartbeatMs: z.coerce.number().int().min(1000),
  maxAttempts: z.coerce.number().int().min(1),
  stageTimeoutMs: z.coerce.number().int().min(1000),
  workdirRoot: z.string(),
  fakeStorageDir: z.string(),
  elevenlabsApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  translationModel: z.string(),
  replicateApiToken: z.string().optional(),
  replicateDemucsVersion: z.string().optional(),
  ffmpegPath: z.string(),
  ffprobePath: z.string(),
  ytdlpPath: z.string(),
})

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>

const REAL_DRIVERS: DriverSelection = {
  ingestor: 'ytdlp',
  separator: 'ffmpeg-duck',
  transcriber: 'elevenlabs',
  translator: 'anthropic',
  synthesizer: 'elevenlabs',
  media: 'ffmpeg',
  storage: 'supabase',
}

function blank(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

/** Reads the worker configuration from the environment. Every driver defaults to `fake` outside production. */
export function loadConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  const nodeEnv = env.NODE_ENV === 'production' || env.NODE_ENV === 'test' ? env.NODE_ENV : 'development'
  const production = nodeEnv === 'production'
  const driver = <K extends keyof DriverSelection>(key: K, envName: string): string =>
    blank(env[envName]) ?? (production ? REAL_DRIVERS[key] : 'fake')

  return WorkerConfigSchema.parse({
    nodeEnv,
    logLevel: blank(env.LOG_LEVEL) ?? 'info',
    databaseUrl: blank(env.DATABASE_URL),
    supabaseUrl: blank(env.SUPABASE_URL),
    supabaseServiceRoleKey: blank(env.SUPABASE_SERVICE_ROLE_KEY),
    pipeline: blank(env.VOZIA_PIPELINE) ?? 'staged',
    drivers: {
      ingestor: driver('ingestor', 'VOZIA_INGESTOR_DRIVER'),
      separator: driver('separator', 'VOZIA_SEPARATOR_DRIVER'),
      transcriber: driver('transcriber', 'VOZIA_TRANSCRIBER_DRIVER'),
      translator: driver('translator', 'VOZIA_TRANSLATOR_DRIVER'),
      synthesizer: driver('synthesizer', 'VOZIA_SYNTHESIZER_DRIVER'),
      media: driver('media', 'VOZIA_MEDIA_DRIVER'),
      storage: driver('storage', 'VOZIA_STORAGE_DRIVER'),
    },
    concurrency: blank(env.VOZIA_WORKER_CONCURRENCY) ?? 1,
    pollMs: blank(env.VOZIA_POLL_MS) ?? 2000,
    visibilityTimeoutS: blank(env.VOZIA_VISIBILITY_TIMEOUT_S) ?? 120,
    heartbeatMs: blank(env.VOZIA_HEARTBEAT_MS) ?? 30_000,
    maxAttempts: blank(env.VOZIA_MAX_ATTEMPTS) ?? 2,
    stageTimeoutMs: blank(env.VOZIA_STAGE_TIMEOUT_MS) ?? 1_800_000,
    workdirRoot: blank(env.VOZIA_WORKDIR) ?? '',
    fakeStorageDir: blank(env.VOZIA_FAKE_STORAGE_DIR) ?? '',
    elevenlabsApiKey: blank(env.ELEVENLABS_API_KEY),
    anthropicApiKey: blank(env.ANTHROPIC_API_KEY),
    translationModel: blank(env.VOZIA_TRANSLATION_MODEL) ?? 'claude-opus-5',
    replicateApiToken: blank(env.REPLICATE_API_TOKEN),
    replicateDemucsVersion: blank(env.REPLICATE_DEMUCS_VERSION),
    ffmpegPath: blank(env.VOZIA_FFMPEG_PATH) ?? 'ffmpeg',
    ffprobePath: blank(env.VOZIA_FFPROBE_PATH) ?? 'ffprobe',
    ytdlpPath: blank(env.VOZIA_YTDLP_PATH) ?? 'yt-dlp',
  })
}

/** Names every setting the selected drivers need but the environment does not provide. */
export function missingSettings(config: WorkerConfig): string[] {
  const missing: string[] = []
  if (!config.databaseUrl) missing.push('DATABASE_URL')
  if (config.drivers.storage === 'supabase') {
    if (!config.supabaseUrl) missing.push('SUPABASE_URL')
    if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  }
  const needsElevenLabs =
    config.pipeline === 'elevenlabs' ||
    config.drivers.transcriber === 'elevenlabs' ||
    config.drivers.synthesizer === 'elevenlabs'
  if (needsElevenLabs && !config.elevenlabsApiKey) missing.push('ELEVENLABS_API_KEY')
  if (config.pipeline === 'staged' && config.drivers.translator === 'anthropic' && !config.anthropicApiKey) {
    missing.push('ANTHROPIC_API_KEY')
  }
  if (config.pipeline === 'staged' && config.drivers.separator === 'replicate-demucs') {
    if (!config.replicateApiToken) missing.push('REPLICATE_API_TOKEN')
    if (!config.replicateDemucsVersion) missing.push('REPLICATE_DEMUCS_VERSION')
  }
  return missing
}

export function assertConfig(config: WorkerConfig): void {
  const missing = missingSettings(config)
  if (missing.length > 0) {
    throw new Error(`Missing required settings for the selected drivers: ${missing.join(', ')}`)
  }
}
