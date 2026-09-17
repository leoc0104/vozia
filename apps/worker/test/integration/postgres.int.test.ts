import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSql, type Sql } from '../../src/db.js'
import { PgmqQueue } from '../../src/queue/pgmq-queue.js'
import { PostgresDubRepository } from '../../src/repo/postgres-repo.js'

const url = process.env.VOZIA_TEST_DATABASE_URL
const owner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe.skipIf(!url)('postgres repository and pgmq queue', () => {
  let sql: Sql
  let videoId: string
  let dubId: string

  beforeAll(async () => {
    sql = createSql(url!)
    await sql`delete from auth.users where id = ${owner}`
    await sql`select public.test_user(${owner}::uuid, 'carol@example.com', '{"full_name":"Carol"}'::jsonb)`
    const [video] = await sql<{ id: string }[]>`
      insert into public.videos (owner_id, title, source_type, source_url)
      values (${owner}, 'Carol talk', 'youtube', 'https://youtu.be/dQw4w9WgXcQ') returning id`
    videoId = video!.id
    const [dub] = await sql<{ id: string }[]>`
      insert into public.dubs (video_id, owner_id, target_language) values (${videoId}, ${owner}, 'pt') returning id`
    dubId = dub!.id
  })

  afterAll(async () => {
    await sql`delete from auth.users where id = ${owner}`
    await sql`select pgmq.purge_queue('dub_jobs')`
    await sql.end({ timeout: 5 })
  })

  it('walks a dub through the queue and the repository', async () => {
    const queue = new PgmqQueue(sql)
    const repo = new PostgresDubRepository(sql)

    const message = await queue.read(60)
    expect(message).not.toBeNull()
    expect(message!.readCount).toBe(1)
    expect(message!.payload).toEqual({ dub_id: dubId })
    expect(await queue.read(60)).toBeNull()

    const job = await repo.loadJob(dubId)
    expect(job?.dub.status).toBe('queued')
    expect(job?.video.title).toBe('Carol talk')
    expect(job?.profile.display_name).toBe('Carol')
    expect(typeof job?.dub.created_at).toBe('string')
    expect(await repo.loadJob('99999999-9999-4999-8999-999999999999')).toBeNull()

    await repo.markStarted(dubId, 'staged')
    await repo.markStage(dubId, 'ingesting', 0)
    await repo.updateProgress(dubId, 7)
    await repo.patchDub(dubId, { detected_language: 'en', provider_ref: 'x' })
    await repo.patchDub(dubId, {})
    await repo.updateVideoAfterIngest(videoId, { storagePath: `${owner}/${videoId}/original.mp4`, durationSeconds: 61, title: 'Real title', thumbnailPath: null })
    await repo.replaceSegments(dubId, [
      { idx: 0, startMs: 0, endMs: 1000, text: 'hi', speaker: 's0' },
      { idx: 1, startMs: 1000, endMs: 2000, text: 'there' },
    ])
    await repo.replaceSegments(dubId, [{ idx: 0, startMs: 0, endMs: 1000, text: 'hi', translatedText: 'oi' }])
    await queue.extend(message!.msgId, 120)

    let row = (await repo.loadJob(dubId))!
    expect(row.dub).toMatchObject({ status: 'ingesting', progress: 7, attempts: 1, pipeline: 'staged', detected_language: 'en', provider_ref: 'x' })
    expect(row.video).toMatchObject({ storage_path: `${owner}/${videoId}/original.mp4`, duration_seconds: 61, title: 'Real title' })
    const segments = await sql`select idx, text, translated_text from public.dub_segments where dub_id = ${dubId} order by idx`
    expect(segments).toEqual([{ idx: 0, text: 'hi', translated_text: 'oi' }])

    await repo.markFailed(dubId, 'ingesting', 'boom')
    row = (await repo.loadJob(dubId))!
    expect(row.dub).toMatchObject({ status: 'failed', failed_stage: 'ingesting', error_message: 'boom' })
    await repo.prepareRerun(dubId)
    row = (await repo.loadJob(dubId))!
    expect(row.dub).toMatchObject({ status: 'failed', progress: 0, failed_stage: null, error_message: null })
    expect(Number((await sql`select count(*)::int as n from pgmq.q_dub_jobs`)[0]!.n)).toBe(1)

    await repo.markStage(dubId, 'muxing', 85)
    await repo.markCompleted(dubId, {
      outputPath: `${owner}/${dubId}/dubbed.mp4`,
      dubbedAudioPath: null,
      srtOriginalPath: `${owner}/${dubId}/original.srt`,
      srtTranslatedPath: null,
      minutes: 2,
      detectedLanguage: null,
    })
    row = (await repo.loadJob(dubId))!
    expect(row.dub).toMatchObject({ status: 'completed', progress: 100, output_path: `${owner}/${dubId}/dubbed.mp4`, detected_language: 'en' })
    expect(row.dub.completed_at).not.toBeNull()
    expect(row.profile.minutes_used).toBe(2)

    await queue.archive(message!.msgId)
    expect(Number((await sql`select count(*)::int as n from pgmq.q_dub_jobs`)[0]!.n)).toBe(0)
  })
})
