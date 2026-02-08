import { watch } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { BmClient } from "../bm-client.ts"
import type { BasicMemoryConfig } from "../config.ts"
import { log } from "../logger.ts"
import { indexFileIntoBm } from "./archive.ts"

export class FileWatcher {
  private client: BmClient
  private cfg: BasicMemoryConfig
  private watchers: ReturnType<typeof watch>[] = []
  private indexQueue: Set<string> = new Set()
  private indexTimer: ReturnType<typeof setInterval> | null = null
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor(client: BmClient, cfg: BasicMemoryConfig) {
    this.client = client
    this.cfg = cfg
  }

  async start(workspacePath: string): Promise<void> {
    log.info(`starting file watcher for: ${this.cfg.watchPaths.join(", ")}`)

    for (const watchPath of this.cfg.watchPaths) {
      const fullPath = resolve(workspacePath, watchPath)

      try {
        const stats = await stat(fullPath)
        const isDir = stats.isDirectory()

        const watcher = watch(
          fullPath,
          { recursive: isDir },
          (_event, filename) => {
            if (!filename) return
            const filePath = isDir ? resolve(fullPath, filename) : fullPath
            this.queueFile(filePath)
          },
        )

        this.watchers.push(watcher)
        log.debug(`watching: ${fullPath} (${isDir ? "directory" : "file"})`)
      } catch {
        log.warn(
          `watch path not found, will create on first write: ${fullPath}`,
        )
      }
    }

    // Periodic re-index sweep
    this.indexTimer = setInterval(
      () => this.flushQueue(),
      this.cfg.indexInterval * 1000,
    )

    // Initial scan
    await this.initialScan(workspacePath)
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []

    if (this.indexTimer) {
      clearInterval(this.indexTimer)
      this.indexTimer = null
    }

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    log.info("file watcher stopped")
  }

  private queueFile(filePath: string): void {
    if (!filePath.endsWith(".md")) return

    // Debounce: wait 2s after last change before indexing
    const existing = this.debounceTimers.get(filePath)
    if (existing) clearTimeout(existing)

    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.debounceTimers.delete(filePath)
        this.indexQueue.add(filePath)
        log.debug(`queued for indexing: ${filePath}`)
      }, 2000),
    )
  }

  private async flushQueue(): Promise<void> {
    if (this.indexQueue.size === 0) return

    const files = [...this.indexQueue]
    this.indexQueue.clear()

    log.debug(`flushing index queue: ${files.length} files`)

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, "utf-8")
        await indexFileIntoBm(this.client, filePath, content)
      } catch (err) {
        log.error(`failed to index: ${filePath}`, err)
      }
    }
  }

  private async initialScan(workspacePath: string): Promise<void> {
    const { readdir } = await import("node:fs/promises")
    const { join } = await import("node:path")

    for (const watchPath of this.cfg.watchPaths) {
      const fullPath = resolve(workspacePath, watchPath)

      try {
        const stats = await stat(fullPath)

        if (stats.isFile() && fullPath.endsWith(".md")) {
          this.indexQueue.add(fullPath)
        } else if (stats.isDirectory()) {
          const entries = await readdir(fullPath, {
            recursive: true,
            withFileTypes: true,
          })
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".md")) {
              this.indexQueue.add(
                join(entry.parentPath ?? fullPath, entry.name),
              )
            }
          }
        }
      } catch {
        log.debug(`initial scan: path not found: ${fullPath}`)
      }
    }

    if (this.indexQueue.size > 0) {
      log.info(`initial scan: ${this.indexQueue.size} files to index`)
      await this.flushQueue()
    }
  }
}
