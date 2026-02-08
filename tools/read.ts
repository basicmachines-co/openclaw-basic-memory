import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerReadTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_read",
      label: "Read Note",
      description:
        "Read a specific note from the Basic Memory knowledge graph by title or permalink. " +
        "Returns the full note content including observations and relations.",
      parameters: Type.Object({
        identifier: Type.String({
          description: "Note title, permalink, or memory:// URL to read",
        }),
      }),
      async execute(_toolCallId: string, params: { identifier: string }) {
        log.debug(`bm_read: identifier="${params.identifier}"`)

        try {
          const note = await client.readNote(params.identifier)

          return {
            content: [
              {
                type: "text" as const,
                text: note.content,
              },
            ],
            details: {
              title: note.title,
              permalink: note.permalink,
              file_path: note.file_path,
            },
          }
        } catch (err) {
          log.error("bm_read failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not read note "${params.identifier}". It may not exist yet.`,
              },
            ],
          }
        }
      },
    },
    { name: "bm_read" },
  )
}
