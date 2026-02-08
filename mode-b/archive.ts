import { basename, dirname, relative } from "node:path"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

/**
 * Index a file into Basic Memory's knowledge graph.
 *
 * Preserves the original file structure — folder path is derived from
 * the file's relative path within the workspace.
 */
export async function indexFileIntoBm(
  client: BmClient,
  filePath: string,
  content: string,
  workspacePath?: string,
): Promise<void> {
  if (!content.trim()) {
    log.debug(`skipping empty file: ${filePath}`)
    return
  }

  const name = basename(filePath, ".md")
  const folder = deriveFolder(filePath, workspacePath)

  log.debug(`indexing: ${name} → folder=${folder}`)

  try {
    await client.writeNote(name, content, folder)
    log.debug(`indexed: ${name}`)
  } catch (err) {
    log.error(`index failed for ${name}`, err)
  }
}

/**
 * Index a conversation turn into the knowledge graph.
 *
 * Uses daily batched notes instead of per-turn notes to avoid flooding
 * the knowledge graph. Each day gets one conversation note that is
 * appended to throughout the day.
 */
export async function indexConversation(
  client: BmClient,
  userMessage: string,
  assistantResponse: string,
): Promise<void> {
  const now = new Date()
  const dateStr = now.toISOString().split("T")[0]
  const timeStr = now.toTimeString().slice(0, 5)
  const title = `conversations-${dateStr}`

  // Format as a timestamped entry to append to the daily note
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
    // Try to append to existing daily note first
    await client.editNote(title, "append", entry)
    log.debug(`appended conversation to: ${title}`)
  } catch {
    // Note doesn't exist yet — create it
    const content = [`# Conversations ${dateStr}`, "", entry].join("\n")

    try {
      await client.writeNote(title, content, "conversations")
      log.debug(`created conversation note: ${title}`)
    } catch (err) {
      log.error("conversation index failed", err)
    }
  }
}

/**
 * Derive a BM folder path from a file path.
 *
 * If workspacePath is provided, uses the relative path to preserve
 * directory structure. Otherwise falls back to the parent directory name.
 *
 * Examples:
 *   memory/2026-02-07.md  →  "memory"
 *   memory/projects/foo.md  →  "memory/projects"
 *   MEMORY.md (at root)  →  "memory"
 */
function deriveFolder(filePath: string, workspacePath?: string): string {
  if (workspacePath) {
    const rel = relative(workspacePath, filePath)
    const dir = dirname(rel)
    // Root-level files go to "memory" folder
    if (dir === ".") return "memory"
    return dir
  }

  // Fallback: use parent directory name
  const dir = dirname(filePath)
  const dirName = basename(dir)

  if (dirName === "." || dirName === "") return "memory"
  return dirName
}
