import type { JobQueue, QueueMessage } from './contracts.js'

interface Stored {
  payload: unknown
  readCount: number
  visibleAt: number
}

export class InMemoryQueue implements JobQueue {
  private seq = 0
  private readonly messages = new Map<string, Stored>()
  readonly archived: string[] = []
  readonly extended: { msgId: string; vt: number }[] = []

  constructor(private readonly now: () => number = () => Date.now()) {}

  enqueue(payload: unknown): string {
    const msgId = String(++this.seq)
    this.messages.set(msgId, { payload, readCount: 0, visibleAt: 0 })
    return msgId
  }

  async read(visibilityTimeoutS: number): Promise<QueueMessage | null> {
    const t = this.now()
    for (const [msgId, stored] of this.messages) {
      if (stored.visibleAt <= t) {
        stored.readCount += 1
        stored.visibleAt = t + visibilityTimeoutS * 1000
        return { msgId, readCount: stored.readCount, payload: stored.payload }
      }
    }
    return null
  }

  async extend(msgId: string, visibilityTimeoutS: number): Promise<void> {
    const stored = this.messages.get(msgId)
    if (stored) stored.visibleAt = this.now() + visibilityTimeoutS * 1000
    this.extended.push({ msgId, vt: visibilityTimeoutS })
  }

  async archive(msgId: string): Promise<void> {
    this.messages.delete(msgId)
    this.archived.push(msgId)
  }

  /** Simulates a visibility timeout expiring (e.g. after a worker crash). */
  makeVisible(msgId: string): void {
    const stored = this.messages.get(msgId)
    if (stored) stored.visibleAt = 0
  }

  get size(): number {
    return this.messages.size
  }
}
