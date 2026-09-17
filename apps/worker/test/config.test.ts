import { describe, expect, it } from 'vitest'
import { assertConfig, loadConfig, missingSettings } from '../src/config.js'

describe('loadConfig', () => {
  it('defaults every driver to fake outside production', () => {
    const config = loadConfig({})
    expect(config.nodeEnv).toBe('development')
    expect(config.pipeline).toBe('staged')
    expect(Object.values(config.drivers).every((d) => d === 'fake')).toBe(true)
    expect(config.concurrency).toBe(1)
    expect(config.translationModel).toBe('claude-opus-5')
    expect(missingSettings(config)).toEqual(['DATABASE_URL'])
  })

  it('defaults to real drivers in production and honours overrides', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      VOZIA_SEPARATOR_DRIVER: 'replicate-demucs',
      VOZIA_WORKER_CONCURRENCY: '3',
      VOZIA_TRANSLATION_MODEL: 'claude-sonnet-5',
    })
    expect(config.drivers).toEqual({
      ingestor: 'ytdlp',
      separator: 'replicate-demucs',
      transcriber: 'elevenlabs',
      translator: 'anthropic',
      synthesizer: 'elevenlabs',
      media: 'ffmpeg',
      storage: 'supabase',
    })
    expect(config.concurrency).toBe(3)
    expect(config.translationModel).toBe('claude-sonnet-5')
  })

  it('rejects unknown drivers', () => {
    expect(() => loadConfig({ VOZIA_MEDIA_DRIVER: 'sox' })).toThrow()
  })

  it('lists every missing setting for the selected drivers', () => {
    const config = loadConfig({ NODE_ENV: 'production', VOZIA_SEPARATOR_DRIVER: 'replicate-demucs' })
    expect(missingSettings(config)).toEqual([
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ELEVENLABS_API_KEY',
      'ANTHROPIC_API_KEY',
      'REPLICATE_API_TOKEN',
      'REPLICATE_DEMUCS_VERSION',
    ])
    expect(() => assertConfig(config)).toThrow(/ELEVENLABS_API_KEY/)
  })

  it('needs only the ElevenLabs key for the end-to-end pipeline', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      VOZIA_PIPELINE: 'elevenlabs',
      DATABASE_URL: 'postgres://x',
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
      ELEVENLABS_API_KEY: 'e',
    })
    expect(missingSettings(config)).toEqual([])
  })
})
