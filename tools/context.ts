import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerContextTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_context",
      label: "Build Context",
      description:
        "Navigate the Basic Memory knowledge graph via memory:// URLs. " +
        "Returns the target note plus related notes connected through the graph. " +
        "Use this to follow relations and discover connected concepts.",
      parameters: Type.Object({
        url: Type.String({
          description:
            'Memory URL to navigate, e.g. "memory://agents/decisions" or "projects/my-project"',
        }),
        depth: Type.Optional(
          Type.Number({
            description: "How many relation hops to follow (default: 1)",
          }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: { url: string; depth?: number },
      ) {
        const depth = params.depth ?? 1
        log.debug(`bm_context: url="${params.url}" depth=${depth}`)

        try {
          const ctx = await client.buildContext(params.url, depth)

          if (!ctx.results || ctx.results.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No context found for "${params.url}".`,
                },
              ],
            }
          }

          const sections: string[] = []

          for (const result of ctx.results) {
            const primary = result.primary_result
            sections.push(`## ${primary.title}\n${primary.content}`)

            if (result.observations?.length > 0) {
              const obs = result.observations
                .map((o) => `- [${o.category}] ${o.content}`)
                .join("\n")
              sections.push(`### Observations\n${obs}`)
            }

            if (result.related_results?.length > 0) {
              const rels = result.related_results
                .map(
                  (r) =>
                    `- ${r.relation_type} → **${r.title}** (${r.permalink})`,
                )
                .join("\n")
              sections.push(`### Related\n${rels}`)
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: sections.join("\n\n"),
              },
            ],
            details: {
              url: params.url,
              depth,
              resultCount: ctx.results.length,
            },
          }
        } catch (err) {
          log.error("bm_context failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to build context for "${params.url}". Check logs for details.`,
              },
            ],
          }
        }
      },
    },
    { name: "bm_context" },
  )
}
