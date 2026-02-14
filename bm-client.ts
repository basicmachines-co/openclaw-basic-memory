import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { log } from "./logger.ts"

const execFileAsync = promisify(execFile)

/**
 * Strip YAML frontmatter from note content.
 * BM's read-note --format json includes frontmatter in the content field,
 * but consumers (agent tools, editNote) don't want it duplicated.
 */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim()
}

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
export function parseJsonOutput(raw: string): unknown {
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
      log.debug(`bm command failed: ${this.bmPath} ${args.join(" ")} — ${msg}`)
      throw new Error(
        `bm command failed: ${this.bmPath} ${args.join(" ")} — ${msg}`,
      )
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
    } catch {
      // Silently ignore — most likely the project already exists.
      // This is expected on every restart after first setup.
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    // search-notes outputs JSON natively (no --format flag needed)
    // Try hybrid search (FTS + vector) first, fall back to FTS if semantic is disabled
    let out: string
    try {
      out = await this.execToolNativeJson([
        "tool",
        "search-notes",
        query,
        "--hybrid",
        "--page-size",
        String(limit),
      ])
    } catch {
      // Hybrid search requires semantic_search_enabled; fall back to FTS
      out = await this.execToolNativeJson([
        "tool",
        "search-notes",
        query,
        "--page-size",
        String(limit),
      ])
    }
    const parsed = parseJsonOutput(out)
    return (parsed as { results: SearchResult[] }).results
  }

  async readNote(identifier: string): Promise<NoteResult> {
    // read-note requires --format json (PR #552)
    const out = await this.execTool(["tool", "read-note", identifier])
    const result = parseJsonOutput(out) as NoteResult
    // Strip frontmatter — BM includes it in content but we don't want it
    // leaking into agent-visible output or getting doubled on write-back
    result.content = stripFrontmatter(result.content)
    return result
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

  /**
   * Edit a note using read-modify-write since `bm tool edit-note` doesn't
   * exist in the CLI yet (only available as an MCP tool).
   */
  async editNote(
    identifier: string,
    operation: "append" | "prepend" | "find_replace" | "replace_section",
    content: string,
    findText?: string,
    sectionTitle?: string,
  ): Promise<NoteResult> {
    // Step 1: Read the existing note
    const existing = await this.readNote(identifier)

    // Content is already frontmatter-stripped by readNote()
    let updated = existing.content

    switch (operation) {
      case "append":
        updated = `${updated}\n${content}`
        break
      case "prepend":
        updated = `${content}\n${updated}`
        break
      case "find_replace":
        if (!findText) {
          throw new Error("find_replace requires findText parameter")
        }
        if (!updated.includes(findText)) {
          throw new Error(
            `findText not found in note: "${findText.slice(0, 80)}"`,
          )
        }
        updated = updated.replace(findText, content)
        break
      case "replace_section": {
        if (!sectionTitle) {
          throw new Error("replace_section requires sectionTitle parameter")
        }
        // Find the heading and replace everything until the next heading of same or higher level
        const headingPattern = new RegExp(
          `^(#{1,6})\\s+${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
          "m",
        )
        const match = headingPattern.exec(updated)
        if (!match) {
          throw new Error(`Section "${sectionTitle}" not found in note`)
        }
        const level = match[1].length
        const sectionStart = match.index
        // Find next heading at same or higher level
        const rest = updated.slice(sectionStart + match[0].length)
        const nextHeading = new RegExp(`^#{1,${level}}\\s`, "m")
        const nextMatch = nextHeading.exec(rest)
        const sectionEnd = nextMatch
          ? sectionStart + match[0].length + nextMatch.index
          : updated.length
        updated = `${updated.slice(0, sectionStart)}${match[0]}\n${content}${nextMatch ? `\n${updated.slice(sectionEnd)}` : ""}`
        break
      }
    }

    // Step 2: Extract folder from file_path (e.g., "notes/plugin-test.md" → "notes")
    const folder = existing.file_path.includes("/")
      ? existing.file_path.split("/").slice(0, -1).join("/")
      : ""

    // Step 3: Write back with the same title and folder
    return this.writeNote(existing.title, updated, folder)
  }

  /**
   * Delete a note from the knowledge graph.
   *
   * Since there's no `bm tool delete-note` CLI command, we resolve the
   * note's file path via readNote, then delete the file. BM's file watcher
   * will pick up the deletion and update the index.
   */
  async deleteNote(
    identifier: string,
    projectPath: string,
  ): Promise<{ title: string; permalink: string; file_path: string }> {
    const { unlink } = await import("node:fs/promises")
    const { resolve } = await import("node:path")

    // Read the note to get its file path and verify it exists
    const note = await this.readNote(identifier)
    const fullPath = resolve(projectPath, note.file_path)

    await unlink(fullPath)
    log.debug(`deleted file: ${fullPath}`)

    return {
      title: note.title,
      permalink: note.permalink,
      file_path: note.file_path,
    }
  }

  /**
   * Move a note to a new folder.
   *
   * Since there's no `bm tool move-note` CLI command, we read the note,
   * write it to the new folder, then delete the old file.
   */
  async moveNote(
    identifier: string,
    newFolder: string,
    projectPath: string,
  ): Promise<NoteResult> {
    const { unlink } = await import("node:fs/promises")
    const { resolve } = await import("node:path")

    // Read existing note
    const existing = await this.readNote(identifier)
    const oldPath = resolve(projectPath, existing.file_path)

    // Write to new folder (this creates the note at the new location)
    const result = await this.writeNote(existing.title, existing.content, newFolder)

    // Delete old file
    try {
      await unlink(oldPath)
      log.debug(`moved: ${existing.file_path} → ${result.file_path}`)
    } catch {
      log.debug(`old file already gone: ${oldPath}`)
    }

    return result
  }

  /**
   * Index a conversation turn into the knowledge graph.
   *
   * Uses daily batched notes instead of per-turn notes to avoid flooding
   * the knowledge graph. Each day gets one conversation note that is
   * appended to throughout the day.
   */
  async indexConversation(
    userMessage: string,
    assistantResponse: string,
  ): Promise<void> {
    const now = new Date()
    const dateStr = now.toISOString().split("T")[0]
    const timeStr = now.toTimeString().slice(0, 5)
    const title = `conversations-${dateStr}`

    const entry = [
      `### ${timeStr}`,
      "",
      "**User:**",
      userMessage,
      "",
      "**Assistant:**",
      assistantResponse,
      "",
      "---",
    ].join("\n")

    try {
      await this.editNote(title, "append", entry)
      log.debug(`appended conversation to: ${title}`)
    } catch {
      const content = [`# Conversations ${dateStr}`, "", entry].join("\n")
      try {
        await this.writeNote(title, content, "conversations")
        log.debug(`created conversation note: ${title}`)
      } catch (err) {
        log.error("conversation index failed", err)
      }
    }
  }

  getProject(): string {
    return this.project
  }
}
