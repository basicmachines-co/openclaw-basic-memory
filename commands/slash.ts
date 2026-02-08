import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerCommands(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerCommand({
    name: "remember",
    description: "Save something to the Basic Memory knowledge graph",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: { args?: string }) => {
      const text = ctx.args?.trim()
      if (!text) {
        return { text: "Usage: /remember <text to save as a note>" }
      }

      log.debug(`/remember: "${text.slice(0, 50)}"`)

      try {
        const title = text.length > 60 ? text.slice(0, 60) : text
        await client.writeNote(title, text, "agent/memories")

        const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text
        return { text: `Remembered: "${preview}"` }
      } catch (err) {
        log.error("/remember failed", err)
        return {
          text: "Failed to save memory. Is Basic Memory running?",
        }
      }
    },
  })

  api.registerCommand({
    name: "recall",
    description: "Search the Basic Memory knowledge graph",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx: { args?: string }) => {
      const query = ctx.args?.trim()
      if (!query) {
        return { text: "Usage: /recall <search query>" }
      }

      log.debug(`/recall: "${query}"`)

      try {
        const results = await client.search(query, 5)

        if (results.length === 0) {
          return { text: `No notes found for: "${query}"` }
        }

        const lines = results.map((r, i) => {
          const score = r.score ? ` (${(r.score * 100).toFixed(0)}%)` : ""
          return `${i + 1}. ${r.title}${score}`
        })

        return {
          text: `Found ${results.length} notes:\n\n${lines.join("\n")}`,
        }
      } catch (err) {
        log.error("/recall failed", err)
        return {
          text: "Failed to search. Is Basic Memory running?",
        }
      }
    },
  })
}
