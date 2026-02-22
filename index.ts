import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { BmClient } from "./bm-client.ts"
import { registerCli } from "./commands/cli.ts"
import { registerSkillCommands } from "./commands/skills.ts"
import { registerCommands } from "./commands/slash.ts"
import {
  basicMemoryConfigSchema,
  parseConfig,
  resolveProjectPath,
} from "./config.ts"
import { buildCaptureHandler } from "./hooks/capture.ts"
import { buildRecallHandler } from "./hooks/recall.ts"
import { initLogger, log } from "./logger.ts"
import { TASK_SCHEMA_CONTENT } from "./schema/task-schema.ts"
import { registerContextTool } from "./tools/context.ts"
import { registerDeleteTool } from "./tools/delete.ts"
import { registerEditTool } from "./tools/edit.ts"
import {
  registerMemoryProvider,
  setWorkspaceDir,
} from "./tools/memory-provider.ts"
import { registerMoveTool } from "./tools/move.ts"
import { registerProjectListTool } from "./tools/project-list.ts"
import { registerReadTool } from "./tools/read.ts"
import { registerSchemaDiffTool } from "./tools/schema-diff.ts"
import { registerSchemaInferTool } from "./tools/schema-infer.ts"
import { registerSchemaValidateTool } from "./tools/schema-validate.ts"
import { registerSearchTool } from "./tools/search.ts"
import { registerWorkspaceListTool } from "./tools/workspace-list.ts"
import { registerWriteTool } from "./tools/write.ts"

export default {
  id: "basic-memory",
  name: "Basic Memory",
  description:
    "Local-first knowledge graph for OpenClaw — persistent memory with graph search and composited memory_search",
  kind: "memory" as const,
  configSchema: basicMemoryConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig)

    initLogger(api.logger, cfg.debug)

    log.info(
      `project=${cfg.project} memoryDir=${cfg.memoryDir} memoryFile=${cfg.memoryFile}`,
    )

    const client = new BmClient(cfg.bmPath, cfg.project)

    // --- BM Tools (always registered) ---
    registerSearchTool(api, client)
    registerProjectListTool(api, client)
    registerWorkspaceListTool(api, client)
    registerReadTool(api, client)
    registerWriteTool(api, client)
    registerEditTool(api, client)
    registerContextTool(api, client)
    registerDeleteTool(api, client)
    registerMoveTool(api, client)
    registerSchemaValidateTool(api, client)
    registerSchemaInferTool(api, client)
    registerSchemaDiffTool(api, client)

    // --- Composited memory_search + memory_get (always registered) ---
    registerMemoryProvider(api, client, cfg)
    log.info("registered composited memory_search + memory_get")

    if (cfg.autoCapture) {
      api.on("agent_end", buildCaptureHandler(client, cfg))
    }

    if (cfg.autoRecall) {
      api.on("agent_start", buildRecallHandler(client, cfg))
    }

    // --- Commands ---
    registerCommands(api, client)
    registerSkillCommands(api)
    registerCli(api, client, cfg)

    // --- Service lifecycle ---
    api.registerService({
      id: "basic-memory",
      start: async (ctx: { config?: unknown; workspaceDir?: string }) => {
        log.info("starting...")

        const workspace = ctx.workspaceDir ?? process.cwd()
        const projectPath = resolveProjectPath(cfg.projectPath, workspace)
        cfg.projectPath = projectPath

        await client.start({ cwd: workspace })
        await client.ensureProject(projectPath)
        log.debug(`project "${cfg.project}" at ${projectPath}`)

        // Seed Task schema if not already present
        try {
          await client.readNote("schema/Task")
          log.debug("Task schema already exists, skipping seed")
        } catch {
          try {
            await client.writeNote("Task", TASK_SCHEMA_CONTENT, "schema")
            log.debug("seeded Task schema note")
          } catch (err) {
            log.debug("Task schema seed failed (non-fatal)", err)
          }
        }

        setWorkspaceDir(workspace)

        log.info("connected — BM MCP stdio session running")
      },
      stop: async () => {
        log.info("stopping BM MCP session...")
        await client.stop()
        log.info("stopped")
      },
    })
  },
}
