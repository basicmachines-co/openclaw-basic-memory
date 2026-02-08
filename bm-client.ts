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

  private async exec(args: string[]): Promise<string> {
    const fullArgs = [...args, "--project", this.project]
    log.debug(`exec: ${this.bmPath} ${fullArgs.join(" ")}`)

    try {
      const { stdout } = await execFileAsync(this.bmPath, fullArgs, {
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      })
      return stdout.trim()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error(`bm command failed: ${this.bmPath} ${fullArgs.join(" ")}`, err)
      throw new Error(`bm command failed: ${msg}`)
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const out = await this.exec([
      "tools",
      "search_notes",
      "--query",
      query,
      "--limit",
      String(limit),
      "--format",
      "json",
    ])
    return JSON.parse(out)
  }

  async readNote(identifier: string): Promise<NoteResult> {
    const out = await this.exec([
      "tools",
      "read_note",
      "--identifier",
      identifier,
      "--format",
      "json",
    ])
    return JSON.parse(out)
  }

  async writeNote(
    title: string,
    content: string,
    folder?: string,
  ): Promise<NoteResult> {
    const args = [
      "tools",
      "write_note",
      "--title",
      title,
      "--content",
      content,
      "--format",
      "json",
    ]
    if (folder) args.push("--folder", folder)
    const out = await this.exec(args)
    return JSON.parse(out)
  }

  async buildContext(url: string, depth = 1): Promise<ContextResult> {
    const out = await this.exec([
      "tools",
      "build_context",
      "--url",
      url,
      "--depth",
      String(depth),
      "--format",
      "json",
    ])
    return JSON.parse(out)
  }

  async recentActivity(timeframe = "24h"): Promise<RecentResult[]> {
    const out = await this.exec([
      "tools",
      "recent_activity",
      "--timeframe",
      timeframe,
      "--format",
      "json",
    ])
    return JSON.parse(out)
  }

  async sync(): Promise<void> {
    await this.exec(["sync"])
  }

  getProject(): string {
    return this.project
  }
}
