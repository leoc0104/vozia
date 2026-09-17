import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { buildComponents } from '../src/drivers/index.js'
import { FakeObjectStorage } from '../src/drivers/fake/index.js'
import { InMemoryQueue } from '../src/queue/memory-queue.js'
import { silentLogger } from '../src/logger.js'

describe('buildComponents', () => {
  it('builds an all-fake staged pipeline by default', () => {
    const components = buildComponents(loadConfig({}), { log: silentLogger() })
    expect(components.pipeline.name).toBe('staged')
    expect(components.storage).toBeInstanceOf(FakeObjectStorage)
    expect(components.queue).toBeInstanceOf(InMemoryQueue)
  })

  it('builds the elevenlabs pipeline when selected', () => {
    const config = loadConfig({ VOZIA_PIPELINE: 'elevenlabs', ELEVENLABS_API_KEY: 'k' })
    expect(buildComponents(config, { log: silentLogger() }).pipeline.name).toBe('elevenlabs')
  })

  it('refuses real ElevenLabs drivers without a key', () => {
    const config = loadConfig({ VOZIA_TRANSCRIBER_DRIVER: 'elevenlabs' })
    expect(() => buildComponents(config, { log: silentLogger() })).toThrow(/ELEVENLABS_API_KEY/)
  })

  it('wires every real driver without touching the network', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
      ELEVENLABS_API_KEY: 'e',
      ANTHROPIC_API_KEY: 'a',
      VOZIA_SEPARATOR_DRIVER: 'replicate-demucs',
      REPLICATE_API_TOKEN: 'r',
      REPLICATE_DEMUCS_VERSION: 'v',
    })
    const components = buildComponents(config, { log: silentLogger(), run: async () => ({ stdout: '', stderr: '' }) })
    expect(components.pipeline.name).toBe('staged')
    expect(components.storage).not.toBeInstanceOf(FakeObjectStorage)
  })
})
