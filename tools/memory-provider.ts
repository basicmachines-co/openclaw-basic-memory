import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

/**
 * Register memory_search and memory_get tools that replace memory-core.
 *
 * When the plugin runs in agent-memory or both mode, these tools replace
 * OpenClaw's built-in memory tools with Basic Memory's knowledge graph
 * search and retrieval.
 *
 * memory_search → bm tool search-notes (knowledge graph search)
 * memory_get → bm tool read-note (read a specific note by identifier)
 */
export function registerMemoryProvider(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  // --- memory_search replacement ---
  // Uses Basic Memory's search which includes full-text + semantic search
  // across the knowledge graph (observations, relations, content)
  api.registerTool(
    {
      name: "memory_search",
      label: "Memory Search",
      description:
        "Semantically search the knowledge graph for relevant notes, facts, and connections. " +
        "Returns matching notes with titles, content previews, relevance scores, and source paths. " +
        "Use this to recall information from prior conversations, decisions, preferences, or any stored knowledge.",
      parameters: Type.Object({
        query: Type.String({
          description: "Search query — natural language or keywords",
        }),
      }),
      async execute(_toolCallId: string, params: { query: string }) {
        log.debug(`memory_search: query="${params.query}"`)

        try {
          const results = await client.search(params.query, 6)

          if (results.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No matches found in the knowledge graph.",
                },
              ],
            }
          }

          // Format results similar to OpenClaw's memory_search output:
          // score, source path, and content snippet
          const snippets = results.map((r) => {
            const score = r.score ? r.score.toFixed(3) : "—"
            const source = r.file_path || r.permalink
            const preview =
              r.content.length > 700 ? `${r.content.slice(0, 700)}…` : r.content
            return `${score} ${source}\n${preview}`
          })

          return {
            content: [
              {
                type: "text" as const,
                text: snippets.join("\n\n"),
              },
            ],
          }
        } catch (err) {
          log.error("memory_search failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: "Memory search failed. Is Basic Memory running?",
              },
            ],
          }
        }
      },
    },
    { names: ["memory_search"] },
  )

  // --- memory_get replacement ---
  // Uses Basic Memory's read-note which returns full note content
  // with knowledge graph context (observations, relations)
  api.registerTool(
    {
      name: "memory_get",
      label: "Memory Get",
      description:
        "Read a specific note from the knowledge graph by title, permalink, or path. " +
        "Returns the full note content. Use after memory_search to read a specific result in full.",
      parameters: Type.Object({
        path: Type.String({
          description:
            "Note identifier — title, permalink, memory:// URL, or file path",
        }),
        from: Type.Optional(
          Type.Number({
            description:
              "Starting line number (ignored — included for compatibility)",
          }),
        ),
        lines: Type.Optional(
          Type.Number({
            description:
              "Number of lines to read (ignored — included for compatibility)",
          }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: { path: string; from?: number; lines?: number },
      ) {
        log.debug(`memory_get: path="${params.path}"`)

        try {
          const note = await client.readNote(params.path)

          return {
            content: [
              {
                type: "text" as const,
                text: `# ${note.title}\n\n${note.content}`,
              },
            ],
          }
        } catch (err) {
          log.error("memory_get failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not read "${params.path}". It may not exist in the knowledge graph.`,
              },
            ],
          }
        }
      },
    },
    { names: ["memory_get"] },
  )
}
