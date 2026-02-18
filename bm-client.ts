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
  frontmatter?: Record<string, unknown> | null
}

export interface EditNoteResult {
  title: string
  permalink: string
  file_path: string
  operation: "append" | "prepend" | "find_replace" | "replace_section"
  checksum?: string | null
}

interface ReadNoteOptions {
  includeFrontmatter?: boolean
}

interface EditNoteOptions {
  find_text?: string
  section?: string
  expected_replacements?: number
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

export interface ProjectListResult {
  name: string
  path: string
  display_name?: string | null
  is_private?: boolean
  is_default?: boolean
  isDefault?: boolean
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

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function isUnsupportedStripFrontmatterError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase()
  return (
    msg.includes("strip-frontmatter") &&
    (msg.includes("no such option") ||
      msg.includes("unknown option") ||
      msg.includes("unrecognized arguments") ||
      msg.includes("unexpected option"))
  )
}

export function isMissingEditNoteCommandError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase()
  return (
    msg.includes("edit-note") &&
    (msg.includes("no such command") ||
      msg.includes("unknown command") ||
      msg.includes("invalid choice"))
  )
}

export function isProjectAlreadyExistsError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase()
  return msg.includes("project") && msg.includes("already exists")
}

export function isNoteNotFoundError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase()
  if (isMissingEditNoteCommandError(err)) return false
  return (
    msg.includes("entity not found") ||
    msg.includes("note not found") ||
    msg.includes("resource not found") ||
    msg.includes("could not find note matching") ||
    msg.includes("404")
  )
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
      await this.execRaw([
        "project",
        "add",
        this.project,
        projectPath,
        "--default",
      ])
    } catch (err) {
      if (isProjectAlreadyExistsError(err)) {
        // Expected after first startup.
        return
      }
      throw new Error(
        `failed to ensure project "${this.project}" at "${projectPath}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }

  async listProjects(): Promise<ProjectListResult[]> {
    const out = await this.execRaw(["project", "list", "--format", "json"])
    const parsed = parseJsonOutput(out)

    if (Array.isArray(parsed)) {
      return parsed as ProjectListResult[]
    }

    if (parsed && typeof parsed === "object") {
      const asRecord = parsed as Record<string, unknown>
      if (Array.isArray(asRecord.projects)) {
        return asRecord.projects as ProjectListResult[]
      }
      if (Array.isArray(asRecord.items)) {
        return asRecord.items as ProjectListResult[]
      }
    }

    throw new Error("invalid bm project list response")
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

  async readNote(
    identifier: string,
    options: ReadNoteOptions = {},
  ): Promise<NoteResult> {
    const includeFrontmatter = options.includeFrontmatter === true

    // Prefer native frontmatter stripping support in BM CLI.
    if (!includeFrontmatter) {
      try {
        const out = await this.execTool([
          "tool",
          "read-note",
          identifier,
          "--strip-frontmatter",
        ])
        return parseJsonOutput(out) as NoteResult
      } catch (err) {
        // Backward compatibility for older BM versions that do not support
        // --strip-frontmatter yet: read raw content and strip locally.
        if (!isUnsupportedStripFrontmatterError(err)) {
          throw err
        }
        const fallbackOut = await this.execTool([
          "tool",
          "read-note",
          identifier,
        ])
        const fallbackResult = parseJsonOutput(fallbackOut) as NoteResult
        fallbackResult.content = stripFrontmatter(fallbackResult.content)
        return fallbackResult
      }
    }

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

  /**
   * Edit a note using BM's native CLI edit-note command.
   */
  async editNote(
    identifier: string,
    operation: "append" | "prepend" | "find_replace" | "replace_section",
    content: string,
    options: EditNoteOptions = {},
  ): Promise<EditNoteResult> {
    const args = [
      "tool",
      "edit-note",
      identifier,
      "--operation",
      operation,
      "--content",
      content,
    ]

    if (options.find_text) {
      args.push("--find-text", options.find_text)
    }

    if (options.section) {
      args.push("--section", options.section)
    }

    if (options.expected_replacements !== undefined) {
      args.push(
        "--expected-replacements",
        String(options.expected_replacements),
      )
    }

    try {
      const out = await this.execTool(args)
      return parseJsonOutput(out) as EditNoteResult
    } catch (err) {
      if (isMissingEditNoteCommandError(err)) {
        throw new Error(
          "bm tool edit-note is required for bm_edit. " +
            "Please upgrade basic-memory to a version that supports edit-note.",
        )
      }
      throw err
    }
  }

  private isNoteNotFoundError(err: unknown): boolean {
    return isNoteNotFoundError(err)
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
    const existing = await this.readNote(identifier, {
      includeFrontmatter: true,
    })
    const oldPath = resolve(projectPath, existing.file_path)

    // Write to new folder (this creates the note at the new location)
    const result = await this.writeNote(
      existing.title,
      existing.content,
      newFolder,
    )

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
    } catch (err) {
      if (!this.isNoteNotFoundError(err)) {
        log.error("conversation append failed", err)
        return
      }

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
