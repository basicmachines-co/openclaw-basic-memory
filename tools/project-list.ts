import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient, ProjectListResult } from "../bm-client.ts"
import { log } from "../logger.ts"

function normalizeProject(project: ProjectListResult) {
  return {
    name: project.name,
    path: project.path,
    display_name: project.display_name ?? null,
    is_private: project.is_private === true,
    is_default: project.is_default === true || project.isDefault === true,
  }
}

export function registerProjectListTool(
  api: OpenClawPluginApi,
  client: BmClient,
): void {
  api.registerTool(
    {
      name: "bm_project_list",
      label: "List Projects",
      description: "List all Basic Memory projects accessible to this agent",
      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: Record<string, never>) {
        log.debug("bm_project_list")

        try {
          const projects = await client.listProjects()
          const normalized = projects.map(normalizeProject)

          if (normalized.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No Basic Memory projects found.",
                },
              ],
              details: {
                count: 0,
                projects: [],
              },
            }
          }

          const text = normalized
            .map((project, idx) => {
              const defaultSuffix = project.is_default ? " (default)" : ""
              const displayLine = project.display_name
                ? `\n   Display Name: ${project.display_name}`
                : ""
              return `${idx + 1}. **${project.name}**${defaultSuffix}\n   Path: ${project.path}\n   Private: ${project.is_private}${displayLine}`
            })
            .join("\n\n")

          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${normalized.length} project(s):\n\n${text}`,
              },
            ],
            details: {
              count: normalized.length,
              projects: normalized,
            },
          }
        } catch (err) {
          log.error("bm_project_list failed", err)
          return {
            content: [
              {
                type: "text" as const,
                text: "Failed to list Basic Memory projects. Is Basic Memory running? Check logs for details.",
              },
            ],
          }
        }
      },
    },
    { name: "bm_project_list" },
  )
}
