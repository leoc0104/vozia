import type { Sql } from '../db.js'
import type { JobQueue, QueueMessage } from './contracts.js'

/** Supabase Queues (pgmq) over a direct Postgres connection. */
export class PgmqQueue implements JobQueue {
  constructor(
    private readonly sql: Sql,
    private readonly queueName = 'dub_jobs',
  ) {}

  async read(visibilityTimeoutS: number): Promise<QueueMessage | null> {
    const rows = await this.sql<{ msg_id: string; read_ct: number; message: unknown }[]>`
      select msg_id::text as msg_id, read_ct, message
      from pgmq.read(${this.queueName}, ${visibilityTimeoutS}, 1)`
    const row = rows[0]
    return row ? { msgId: row.msg_id, readCount: Number(row.read_ct), payload: row.message } : null
  }

  async extend(msgId: string, visibilityTimeoutS: number): Promise<void> {
    await this.sql`select pgmq.set_vt(${this.queueName}, ${msgId}::bigint, ${visibilityTimeoutS})`
  }

  async archive(msgId: string): Promise<void> {
    await this.sql`select pgmq.archive(${this.queueName}, ${msgId}::bigint)`
  }
}
