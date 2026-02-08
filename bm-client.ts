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

/**
 * Extract JSON from CLI output that may contain non-JSON prefix lines
 * (warnings, log messages, etc). Finds the first line starting with
 * '{' or '[' and parses from there.
 */
function parseJsonOutput(raw: string): unknown {
  // Try direct parse first (fast path)
  try {
    return JSON.parse(raw)
  } catch {
    // Fall through to line-by-line extraction
  }

  // Strip non-JSON prefix lines (warnings, Rich markup, etc.)
  const lines = raw.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const jsonStr = lines.slice(i).join("\n")
      try {
        return JSON.parse(jsonStr)
      } catch {}
    }
  }

  throw new Error(`Could not parse JSON from bm output: ${raw.slice(0, 200)}`)
}

export class BmClient {
  private bmPath: string
  private project: string

  constructor(bmPath: string, project: string) {
    this.bmPath = bmPath
    this.project = project
  }

  /**
   * Run a raw bm command with no automatic flags.
   */
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

  /**
   * Run a bm tool command with --project, --local, and --format json flags.
   *
   * Arg ordering: bm tool <subcommand> [positional args] --project X --local --format json [options]
   * The --local flag ensures we always use local routing for low latency,
   * even if the user has cloud mode enabled.
   */
  private async execTool(args: string[]): Promise<string> {
    const fullArgs = [
      ...args,
      "--project",
      this.project,
      "--local",
      "--format",
      "json",
    ]
    return this.execRaw(fullArgs)
  }

  /**
   * Run a bm tool command that already outputs JSON natively (no --format flag needed).
   * Still adds --project and --local.
   */
  private async execToolNativeJson(args: string[]): Promise<string> {
    const fullArgs = [...args, "--project", this.project, "--local"]
    return this.execRaw(fullArgs)
  }

  async ensureProject(projectPath: string): Promise<void> {
    try {
      await this.execRaw(["project", "add", this.project, projectPath])
    } catch (err) {
      // Non-fatal: project may already exist
      log.debug("ensureProject failed (non-fatal):", err)
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    // search-notes outputs JSON natively (no --format flag needed)
    const out = await this.execToolNativeJson([
      "tool",
      "search-notes",
      query,
      "--page-size",
      String(limit),
    ])
    const parsed = parseJsonOutput(out)
    return (parsed as { results: SearchResult[] }).results
  }

  async readNote(identifier: string): Promise<NoteResult> {
    // read-note requires --format json (PR #552)
    const out = await this.execTool(["tool", "read-note", identifier])
    return parseJsonOutput(out) as NoteResult
  }

  async writeNote(
    title: string,
    content: string,
    folder: string,
  ): Promise<NoteResult> {
    // write-note requires --format json (PR #552)
    const out = await this.execTool([
      "tool",
      "write-note",
      "--title",
      title,
      "--folder",
      folder,
      "--content",
      content,
    ])
    return parseJsonOutput(out) as NoteResult
  }

  async buildContext(url: string, depth = 1): Promise<ContextResult> {
    // build-context always outputs JSON natively
    const out = await this.execToolNativeJson([
      "tool",
      "build-context",
      url,
      "--depth",
      String(depth),
    ])
    return parseJsonOutput(out) as ContextResult
  }

  async recentActivity(timeframe = "24h"): Promise<RecentResult[]> {
    // recent-activity requires --format json (PR #552)
    const out = await this.execTool([
      "tool",
      "recent-activity",
      "--timeframe",
      timeframe,
    ])
    return parseJsonOutput(out) as RecentResult[]
  }

  async editNote(
    identifier: string,
    operation: "append" | "prepend" | "find_replace" | "replace_section",
    content: string,
    findText?: string,
    sectionTitle?: string,
  ): Promise<NoteResult> {
    const args = [
      "tool",
      "edit-note",
      identifier,
      "--operation",
      operation,
      "--content",
      content,
    ]

    if (operation === "find_replace" && findText) {
      args.push("--find-text", findText)
    }
    if (operation === "replace_section" && sectionTitle) {
      args.push("--heading", sectionTitle)
    }

    const out = await this.execToolNativeJson(args)
    return parseJsonOutput(out) as NoteResult
  }

  getProject(): string {
    return this.project
  }
}
