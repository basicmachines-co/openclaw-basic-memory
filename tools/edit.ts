import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerEditTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_edit",
      label: "Edit Note",
      description:
        "Incrementally edit an existing note in the Basic Memory knowledge graph. " +
        "Supports append, prepend, find/replace, and section replacement " +
        "without rewriting the entire note.",
      parameters: Type.Object({
        identifier: Type.String({
          description: "Note title, permalink, or memory:// URL to edit",
        }),
        operation: Type.Union(
          [
            Type.Literal("append"),
            Type.Literal("prepend"),
            Type.Literal("find_replace"),
            Type.Literal("replace_section"),
          ],
          {
            description:
              "Edit operation: append (add to end), prepend (add to start), " +
              "find_replace (replace matching text), replace_section (replace a heading section)",
          },
        ),
        content: Type.String({
          description: "New content to add or replace with",
        }),
        findText: Type.Optional(
          Type.String({
            description: "Text to find (required for find_replace operation)",
          }),
        ),
        sectionTitle: Type.Optional(
          Type.String({
            description:
              "Section heading to replace (required for replace_section operation)",
          }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: {
          identifier: string
          operation: "append" | "prepend" | "find_replace" | "replace_section"
          content: string
          findText?: string
          sectionTitle?: string
        },
      ) {
        log.debug(`bm_edit: id="${params.identifier}" op=${params.operation}`)

        try {
          const note = await client.editNote(
            params.identifier,
            params.operation,
            params.content,
            params.findText,
            params.sectionTitle,
          )

          return {
            content: [
              {
                type: "text" as const,
                text: `Note updated: ${note.title} (${note.permalink})`,
              },
            ],
            details: {
              title: note.title,
              permalink: note.permalink,
              file_path: note.file_path,
              operation: params.operation,
            },
          }
        } catch (err) {
          log.error("bm_edit failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to edit note "${params.identifier}". It may not exist.`,
              },
            ],
          }
        }
      },
    },
    { name: "bm_edit" },
  )
}
