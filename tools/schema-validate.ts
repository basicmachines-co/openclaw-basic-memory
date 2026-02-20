import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { log } from "../logger.ts"

export function registerSchemaValidateTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_schema_validate",
      label: "Schema Validate",
      description:
        "Validate notes against their Picoschema definitions. " +
        "Validates a specific note by identifier, or all notes of a given type.",
      parameters: Type.Object({
        noteType: Type.Optional(
          Type.String({
            description:
              'Note type to batch-validate (e.g., "person", "meeting")',
          }),
        ),
        identifier: Type.Optional(
          Type.String({
            description:
              "Specific note to validate (permalink, title, or path)",
          }),
        ),
      }),
      async execute(
        _toolCallId: string,
        params: { noteType?: string; identifier?: string },
      ) {
        log.debug(
          `bm_schema_validate: noteType="${params.noteType ?? ""}" identifier="${params.identifier ?? ""}"`,
        )

        try {
          const result = await client.schemaValidate(
            params.noteType,
            params.identifier,
          )

          const lines: string[] = []
          if (result.entity_type) {
            lines.push(`**Type:** ${result.entity_type}`)
          }
          lines.push(
            `**Notes:** ${result.total_notes} | **Valid:** ${result.valid_count} | **Warnings:** ${result.warning_count} | **Errors:** ${result.error_count}`,
          )

          if (result.results.length > 0) {
            lines.push("")
            for (const r of result.results) {
              const status = r.valid ? "valid" : "invalid"
              lines.push(`- **${r.identifier}** — ${status}`)
              for (const w of r.warnings) {
                lines.push(`  - warning: ${w}`)
              }
              for (const e of r.errors) {
                lines.push(`  - error: ${e}`)
              }
            }
          }

          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            details: result,
          }
        } catch (err) {
          log.error("bm_schema_validate failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: "Schema validation failed. Check logs for details.",
              },
            ],
          }
        }
      },
    },
    { name: "bm_schema_validate" },
  )
}
