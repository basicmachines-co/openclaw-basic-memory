import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerSearchTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_search",
      label: "Knowledge Search",
      description:
        "Search the Basic Memory knowledge graph for relevant notes, concepts, and connections. " +
        "Returns matching notes with titles, content previews, and relevance scores.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(
          Type.Number({ description: "Max results (default: 10)" }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: { query: string; limit?: number },
      ) {
        const limit = params.limit ?? 10
        log.debug(`bm_search: query="${params.query}" limit=${limit}`)

        try {
          const results = await client.search(params.query, limit)

          if (results.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No matching notes found in the knowledge graph.",
                },
              ],
            }
          }

          const text = results
            .map((r, i) => {
              const score = r.score ? ` (${(r.score * 100).toFixed(0)}%)` : ""
              const preview =
                r.content.length > 200
                  ? `${r.content.slice(0, 200)}...`
                  : r.content
              return `${i + 1}. **${r.title}**${score}\n   ${preview}`
            })
            .join("\n\n")

          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${results.length} notes:\n\n${text}`,
              },
            ],
            details: {
              count: results.length,
              results: results.map((r) => ({
                title: r.title,
                permalink: r.permalink,
                score: r.score,
              })),
            },
          }
        } catch (err) {
          log.error("bm_search failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: "Search failed. Is Basic Memory running? Check logs for details.",
              },
            ],
          }
        }
      },
    },
    { name: "bm_search" },
  )
}
