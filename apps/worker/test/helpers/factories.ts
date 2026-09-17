import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { DubRow, ProfileRow, VideoRow } from '@vozia/db'
import type { DubJob, StageContext } from '../../src/pipeline/contracts.js'
import { silentLogger } from '../../src/logger.js'

export const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
export const DUB_ID = '22222222-2222-4222-8222-222222222222'

const now = '2026-09-17T12:00:00.000Z'

export function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: OWNER_ID,
    display_name: 'Alice',
    avatar_url: null,
    minutes_quota: 10,
    minutes_used: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function makeVideo(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    id: VIDEO_ID,
    owner_id: OWNER_ID,
    title: 'Alice talk',
    source_type: 'youtube',
    source_url: 'https://youtu.be/dQw4w9WgXcQ',
    storage_path: null,
    duration_seconds: null,
    thumbnail_path: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function makeDub(overrides: Partial<DubRow> = {}): DubRow {
  return {
    id: DUB_ID,
    video_id: VIDEO_ID,
    owner_id: OWNER_ID,
    source_language: null,
    target_language: 'pt',
    voice_mode: 'clone',
    stock_voice_id: null,
    pipeline: null,
    status: 'queued',
    progress: 0,
    failed_stage: null,
    error_message: null,
    attempts: 0,
    provider_ref: null,
    detected_language: null,
    output_path: null,
    dubbed_audio_path: null,
    srt_original_path: null,
    srt_translated_path: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function makeJob(overrides: { dub?: Partial<DubRow>; video?: Partial<VideoRow>; profile?: Partial<ProfileRow> } = {}): DubJob {
  return { dub: makeDub(overrides.dub), video: makeVideo(overrides.video), profile: makeProfile(overrides.profile) }
}

export async function tempDir(prefix = 'vozia-test-'): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix))
}

export async function stageContext(overrides: Partial<StageContext> = {}): Promise<StageContext & { progressValues: number[] }> {
  const progressValues: number[] = []
  return {
    workdir: overrides.workdir ?? (await tempDir()),
    log: silentLogger(),
    signal: new AbortController().signal,
    progress: (fraction) => progressValues.push(fraction),
    progressValues,
    ...overrides,
  }
}
