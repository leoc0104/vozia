import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ObjectStorage } from '../../pipeline/contracts.js'
import { ProviderError } from '../../pipeline/errors.js'

/** Stores objects as plain files under `<rootDir>/<bucket>/<objectPath>`. */
export class FakeObjectStorage implements ObjectStorage {
  constructor(readonly rootDir: string) {}

  private location(bucket: string, objectPath: string): string {
    return path.join(this.rootDir, bucket, objectPath)
  }

  async download(bucket: string, objectPath: string, destPath: string): Promise<void> {
    try {
      await mkdir(path.dirname(destPath), { recursive: true })
      await copyFile(this.location(bucket, objectPath), destPath)
    } catch (cause) {
      throw new ProviderError('storage', `The source file ${bucket}/${objectPath} is missing.`, { cause })
    }
  }

  async upload(bucket: string, objectPath: string, filePath: string, _contentType: string): Promise<void> {
    const target = this.location(bucket, objectPath)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(filePath, target)
  }

  async remove(bucket: string, objectPaths: string[]): Promise<void> {
    await Promise.all(objectPaths.map((p) => rm(this.location(bucket, p), { force: true })))
  }

  /** Test helper: seed an object with the given content. */
  async put(bucket: string, objectPath: string, content: string): Promise<void> {
    const target = this.location(bucket, objectPath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  /** Test helper: object paths currently stored in a bucket. */
  async list(bucket: string): Promise<string[]> {
    const base = path.join(this.rootDir, bucket)
    try {
      const entries = await readdir(base, { recursive: true, withFileTypes: true })
      return entries
        .filter((e) => e.isFile())
        .map((e) => path.relative(base, path.join(e.parentPath, e.name)))
        .sort()
    } catch {
      return []
    }
  }
}
