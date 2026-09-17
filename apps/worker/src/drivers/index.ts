import os from 'node:os'
import path from 'node:path'
import { createServiceClient } from '@vozia/db'
import type { WorkerConfig } from '../config.js'
import type { Sql } from '../db.js'
import type { Logger } from '../logger.js'
import type { DubbingPipeline, MediaProcessor, ObjectStorage } from '../pipeline/contracts.js'
import { ElevenLabsDubbingPipeline } from '../pipeline/elevenlabs-pipeline.js'
import { StagedPipeline } from '../pipeline/staged-pipeline.js'
import type { JobQueue } from '../queue/contracts.js'
import { InMemoryQueue } from '../queue/memory-queue.js'
import { PgmqQueue } from '../queue/pgmq-queue.js'
import type { DubRepository } from '../repo/contracts.js'
import { InMemoryDubRepository } from '../repo/memory-repo.js'
import { PostgresDubRepository } from '../repo/postgres-repo.js'
import { AnthropicTranslator } from './anthropic-translator.js'
import { ElevenLabsClient, ElevenLabsSynthesizer, ElevenLabsTranscriber } from './elevenlabs/index.js'
import {
  FakeIngestor,
  FakeMedia,
  FakeObjectStorage,
  FakeSeparator,
  FakeSynthesizer,
  FakeTranscriber,
  FakeTranslator,
} from './fake/index.js'
import { FfmpegDuckSeparator } from './ffmpeg-duck-separator.js'
import { FfmpegMediaProcessor } from './ffmpeg-media.js'
import { execFileRunner, type ProcessRunner } from './process.js'
import { ReplicateDemucsSeparator } from './replicate-demucs-separator.js'
import { SupabaseObjectStorage } from './supabase-storage.js'
import { YtdlpIngestor } from './ytdlp-ingestor.js'

export interface ComponentDeps {
  sql?: Sql
  log: Logger
  run?: ProcessRunner
  fetchImpl?: typeof fetch
}

export interface Components {
  pipeline: DubbingPipeline
  queue: JobQueue
  repo: DubRepository
  storage: ObjectStorage
  media: MediaProcessor
}

/** Wires drivers according to the configuration; every selection has a fake counterpart. */
export function buildComponents(config: WorkerConfig, deps: ComponentDeps): Components {
  const run = deps.run ?? execFileRunner
  const storage: ObjectStorage =
    config.drivers.storage === 'supabase'
      ? new SupabaseObjectStorage(createServiceClient(config.supabaseUrl ?? '', config.supabaseServiceRoleKey ?? ''), deps.fetchImpl)
      : new FakeObjectStorage(config.fakeStorageDir || path.join(os.tmpdir(), 'vozia-fake-storage'))
  const repo: DubRepository = deps.sql ? new PostgresDubRepository(deps.sql) : new InMemoryDubRepository()
  const queue: JobQueue = deps.sql ? new PgmqQueue(deps.sql) : new InMemoryQueue()
  const media: MediaProcessor =
    config.drivers.media === 'ffmpeg'
      ? new FfmpegMediaProcessor({ run, ffmpegPath: config.ffmpegPath, ffprobePath: config.ffprobePath })
      : new FakeMedia()

  let elevenlabs: ElevenLabsClient | null = null
  const requireElevenLabs = (): ElevenLabsClient => {
    if (!config.elevenlabsApiKey) throw new Error('ELEVENLABS_API_KEY is required for the selected drivers')
    elevenlabs ??= new ElevenLabsClient({ apiKey: config.elevenlabsApiKey, fetchImpl: deps.fetchImpl })
    return elevenlabs
  }

  let pipeline: DubbingPipeline
  if (config.pipeline === 'elevenlabs') {
    pipeline = new ElevenLabsDubbingPipeline({ client: requireElevenLabs(), storage, repo })
  } else {
    const ingestor =
      config.drivers.ingestor === 'ytdlp' ? new YtdlpIngestor({ run, media, storage, ytdlpPath: config.ytdlpPath }) : new FakeIngestor()
    const separator =
      config.drivers.separator === 'replicate-demucs'
        ? new ReplicateDemucsSeparator({
            apiToken: config.replicateApiToken ?? '',
            version: config.replicateDemucsVersion ?? '',
            fetchImpl: deps.fetchImpl,
          })
        : config.drivers.separator === 'ffmpeg-duck'
          ? new FfmpegDuckSeparator(media)
          : new FakeSeparator()
    const transcriber = config.drivers.transcriber === 'elevenlabs' ? new ElevenLabsTranscriber(requireElevenLabs()) : new FakeTranscriber()
    const translator =
      config.drivers.translator === 'anthropic'
        ? new AnthropicTranslator({ apiKey: config.anthropicApiKey, model: config.translationModel })
        : new FakeTranslator()
    const synthesizer =
      config.drivers.synthesizer === 'elevenlabs' ? new ElevenLabsSynthesizer({ client: requireElevenLabs(), media }) : new FakeSynthesizer()
    pipeline = new StagedPipeline({ ingestor, separator, transcriber, translator, synthesizer, media, storage, repo })
  }

  return { pipeline, queue, repo, storage, media }
}
