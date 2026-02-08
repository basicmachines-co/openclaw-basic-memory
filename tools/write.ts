import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerWriteTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_write",
      label: "Write Note",
      description:
        "Create or update a note in the Basic Memory knowledge graph. " +
        "Notes are stored as Markdown files with semantic structure " +
        "(observations, relations) that build a connected knowledge graph.",
      parameters: Type.Object({
        title: Type.String({ description: "Note title" }),
        content: Type.String({
          description: "Note content in Markdown format",
        }),
        folder: Type.String({ description: "Folder to write the note in" }),
      }),
      async execute(
        _toolCallId: string,
        params: { title: string; content: string; folder: string },
      ) {
        log.debug(
          "bm_write: title=" + params.title + " folder=" + params.folder,
        )

        try {
          const note = await client.writeNote(
            params.title,
            params.content,
            params.folder,
          )

          const msg = `Note saved: ${note.title} (${note.permalink})`
          return {
            content: [
              {
                type: "text" as const,
                text: msg,
              },
            ],
            details: {
              title: note.title,
              permalink: note.permalink,
              file_path: note.file_path,
            },
          }
        } catch (err) {
          log.error("bm_write failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: "Failed to write note. Is Basic Memory running? Check logs for details.",
              },
            ],
          }
        }
      },
    },
    { name: "bm_write" },
  )
}
