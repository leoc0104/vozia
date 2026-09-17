import { describe, expect, it } from 'vitest'
import { InMemoryQueue } from '../src/queue/memory-queue.js'

describe('InMemoryQueue', () => {
  it('hides a read message until its visibility timeout expires', async () => {
    let clock = 1000
    const queue = new InMemoryQueue(() => clock)
    const id = queue.enqueue({ dub_id: 'a' })
    const first = await queue.read(30)
    expect(first).toEqual({ msgId: id, readCount: 1, payload: { dub_id: 'a' } })
    expect(await queue.read(30)).toBeNull()
    clock += 31_000
    expect((await queue.read(30))?.readCount).toBe(2)
  })

  it('extends visibility and archives', async () => {
    let clock = 0
    const queue = new InMemoryQueue(() => clock)
    const id = queue.enqueue({})
    await queue.read(10)
    await queue.extend(id, 100)
    clock = 50_000
    expect(await queue.read(10)).toBeNull()
    expect(queue.extended).toEqual([{ msgId: id, vt: 100 }])
    await queue.archive(id)
    expect(queue.size).toBe(0)
    expect(queue.archived).toEqual([id])
  })

  it('can force a message visible again', async () => {
    const queue = new InMemoryQueue()
    const id = queue.enqueue({})
    await queue.read(60)
    queue.makeVisible(id)
    expect((await queue.read(60))?.readCount).toBe(2)
  })
})
