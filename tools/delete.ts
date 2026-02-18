import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerDeleteTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_delete",
      label: "Delete Note",
      description:
        "Delete a note from the Basic Memory knowledge graph. " +
        "The note is permanently removed from the filesystem and the search index.",
      parameters: Type.Object({
        identifier: Type.String({
          description: "Note title, permalink, or memory:// URL to delete",
        }),
      }),
      async execute(_toolCallId: string, params: { identifier: string }) {
        log.debug(`bm_delete: identifier="${params.identifier}"`)

        try {
          const result = await client.deleteNote(params.identifier)

          return {
            content: [
              {
                type: "text" as const,
                text: `Deleted: ${result.title} (${result.permalink})`,
              },
            ],
            details: {
              title: result.title,
              permalink: result.permalink,
              file_path: result.file_path,
            },
          }
        } catch (err) {
          log.error("bm_delete failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to delete "${params.identifier}". It may not exist.`,
              },
            ],
          }
        }
      },
    },
    { name: "bm_delete" },
  )
}
