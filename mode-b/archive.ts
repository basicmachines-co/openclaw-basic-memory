import { basename, dirname } from "node:path"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

/**
 * Index a file into Basic Memory's knowledge graph.
 *
 * Preserves the original file structure — BM notes mirror the workspace layout.
 * The file content is written as a BM note with the same title and folder path.
 */
export async function indexFileIntoBm(
  client: BmClient,
  filePath: string,
  content: string,
): Promise<void> {
  if (!content.trim()) {
    log.debug(`skipping empty file: ${filePath}`)
    return
  }

  const name = basename(filePath, ".md")
  const folder = deriveFolder(filePath)

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
 * Creates a timestamped note in the conversations/ folder with the
 * user message and assistant response.
 */
export async function indexConversation(
  client: BmClient,
  userMessage: string,
  assistantResponse: string,
): Promise<void> {
  const now = new Date()
  const dateStr = now.toISOString().split("T")[0]
  const timeStr = now.toISOString().split("T")[1]?.slice(0, 5).replace(":", "")
  const title = `conversation-${dateStr}-${timeStr}`

  const content = [
    `# Conversation ${dateStr}`,
    "",
    "## User",
    userMessage,
    "",
    "## Assistant",
    assistantResponse,
  ].join("\n")

  try {
    await client.writeNote(title, content, "conversations")
    log.debug(`indexed conversation: ${title}`)
  } catch (err) {
    log.error("conversation index failed", err)
  }
}

/**
 * Derive a BM folder path from a file path.
 * Uses the parent directory name relative to common workspace roots.
 */
function deriveFolder(filePath: string): string {
  const dir = dirname(filePath)
  const dirName = basename(dir)

  // Common OpenClaw memory directories map to BM folders
  if (dirName === "memory" || dirName === "memories") return "memory"
  if (dirName === ".") return "agent"

  return `memory/${dirName}`
}
