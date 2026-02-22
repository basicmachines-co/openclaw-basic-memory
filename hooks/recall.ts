import type {
  BmClient,
  MetadataSearchResult,
  RecentResult,
} from "../bm-client.ts"
import type { BasicMemoryConfig } from "../config.ts"
import { log } from "../logger.ts"

/**
 * Format recalled context from active tasks and recent activity.
 * Returns empty string if nothing was found.
 */
export function formatRecallContext(
  tasks: MetadataSearchResult,
  recent: RecentResult[],
  prompt: string,
): string {
  const sections: string[] = []

  if (tasks.results.length > 0) {
    const taskLines = tasks.results.map((t) => {
      const preview =
        t.content.length > 120 ? `${t.content.slice(0, 120)}...` : t.content
      return `- **${t.title}** — ${preview}`
    })
    sections.push(`## Active Tasks\n${taskLines.join("\n")}`)
  }

  if (recent.length > 0) {
    const recentLines = recent.map((r) => `- ${r.title} (${r.file_path})`)
    sections.push(`## Recent Activity\n${recentLines.join("\n")}`)
  }

  if (sections.length === 0) return ""

  return `${sections.join("\n\n")}\n\n---\n${prompt}`
}

/**
 * Build the pre-turn recall handler.
 *
 * On agent_start, queries active tasks and recent activity from Basic Memory,
 * then returns formatted context for injection into the conversation.
 */
export function buildRecallHandler(client: BmClient, cfg: BasicMemoryConfig) {
  return async (_event: Record<string, unknown>) => {
    try {
      const [tasks, recent] = await Promise.all([
        client.searchByMetadata({ entity_type: "Task", status: "active" }, 5),
        client.recentActivity("1d"),
      ])

      const context = formatRecallContext(tasks, recent, cfg.recallPrompt)
      if (!context) return {}

      log.debug(
        `recall: ${tasks.results.length} active tasks, ${recent.length} recent items`,
      )

      return { context }
    } catch (err) {
      log.error("recall failed", err)
      return {}
    }
  }
}
