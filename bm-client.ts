import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { log } from "./logger.ts"

const execFileAsync = promisify(execFile)

export interface SearchResult {
  title: string
  permalink: string
  content: string
  score?: number
  file_path: string
}

export interface NoteResult {
  title: string
  permalink: string
  content: string
  file_path: string
}

export interface ContextResult {
  results: Array<{
    primary_result: NoteResult
    observations: Array<{
      category: string
      content: string
    }>
    related_results: Array<{
      title: string
      permalink: string
      relation_type: string
    }>
  }>
}

export interface RecentResult {
  title: string
  permalink: string
  file_path: string
  created_at: string
}

export class BmClient {
  private bmPath: string
  private project: string

  constructor(bmPath: string, project: string) {
    this.bmPath = bmPath
    this.project = project
  }

  private async execRaw(args: string[]): Promise<string> {
    log.debug(`exec: ${this.bmPath} ${args.join(" ")}`)

    try {
      const { stdout } = await execFileAsync(this.bmPath, args, {
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      })
      return stdout.trim()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error(`bm command failed: ${this.bmPath} ${args.join(" ")}`, err)
      throw new Error(`bm command failed: ${msg}`)
    }
  }

  private async exec(args: string[]): Promise<string> {
    const fullArgs = [...args, "--project", this.project, "--format", "json"]
    return this.execRaw(fullArgs)
  }

  async ensureProject(projectPath: string): Promise<void> {
    try {
      await this.execRaw(["project", "add", this.project, projectPath])
    } catch (err) {
      log.error("ensureProject failed (non-fatal):", err)
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const out = await this.exec([
      "tool",
      "search-notes",
      query,
      "--page-size",
      String(limit),
    ])
    const parsed = JSON.parse(out)
    return parsed.results as SearchResult[]
  }

  async readNote(identifier: string): Promise<NoteResult> {
    const out = await this.exec(["tool", "read-note", identifier])
    return JSON.parse(out)
  }

  async writeNote(
    title: string,
    content: string,
    folder: string,
  ): Promise<NoteResult> {
    const out = await this.exec([
      "tool",
      "write-note",
      "--title",
      title,
      "--folder",
      folder,
      "--content",
      content,
    ])
    return JSON.parse(out)
  }

  async buildContext(url: string, depth = 1): Promise<ContextResult> {
    const out = await this.exec([
      "tool",
      "build-context",
      url,
      "--depth",
      String(depth),
    ])
    return JSON.parse(out)
  }

  async recentActivity(timeframe = "24h"): Promise<RecentResult[]> {
    const out = await this.execRaw([
      "tool",
      "recent-activity",
      "--timeframe",
      timeframe,
      "--format",
      "json",
    ])
    return JSON.parse(out)
  }

  getProject(): string {
    return this.project
  }
}
