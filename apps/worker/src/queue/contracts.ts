export interface QueueMessage {
  msgId: string
  /** How many times this message has been read, including this read. */
  readCount: number
  payload: unknown
}

export interface JobQueue {
  read(visibilityTimeoutS: number): Promise<QueueMessage | null>
  extend(msgId: string, visibilityTimeoutS: number): Promise<void>
  archive(msgId: string): Promise<void>
}
