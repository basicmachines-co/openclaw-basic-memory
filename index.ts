import { execSync } from "node:child_process"

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
import { registerContextTool } from "./tools/build-context.ts"
import { registerDeleteTool } from "./tools/delete-note.ts"
import { registerEditTool } from "./tools/edit-note.ts"
import { registerProjectListTool } from "./tools/list-memory-projects.ts"
import { registerWorkspaceListTool } from "./tools/list-workspaces.ts"
import {
  registerMemoryProvider,
  setWorkspaceDir,
} from "./tools/memory-provider.ts"
import { registerMoveTool } from "./tools/move-note.ts"
import { registerReadTool } from "./tools/read-note.ts"
import { registerSchemaDiffTool } from "./tools/schema-diff.ts"
import { registerSchemaInferTool } from "./tools/schema-infer.ts"
import { registerSchemaValidateTool } from "./tools/schema-validate.ts"
import { registerSearchTool } from "./tools/search-notes.ts"
import { registerWriteTool } from "./tools/write-note.ts"

export default {
  id: "openclaw-basic-memory",
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
      id: "openclaw-basic-memory",
      start: async (ctx: { config?: unknown; workspaceDir?: string }) => {
        log.info("starting...")

        // Auto-install bm CLI if not found
        const bmBin = cfg.bmPath || "bm"
        try {
          execSync(`command -v ${bmBin}`, { stdio: "ignore" })
        } catch {
          log.info("bm CLI not found on PATH — attempting auto-install...")
          try {
            execSync("command -v uv", { stdio: "ignore" })
            log.info(
              "installing basic-memory via uv (this may take a minute)...",
            )
            const result = execSync(
              'uv tool install "basic-memory @ git+https://github.com/basicmachines-co/basic-memory.git@main" --force',
              { encoding: "utf-8", timeout: 120_000, stdio: "pipe" },
            )
            log.info(`basic-memory installed: ${result.trim().split("\n").pop()}`)
            // Verify it worked
            try {
              execSync(`command -v ${bmBin}`, { stdio: "ignore" })
              log.info("bm CLI now available on PATH")
            } catch {
              log.error(
                "bm installed but not found on PATH. You may need to add uv's bin directory to your PATH (typically ~/.local/bin).",
              )
            }
          } catch (uvErr) {
            log.error(
              "Cannot auto-install basic-memory: uv not found. " +
                "Install uv first (brew install uv, or curl -LsSf https://astral.sh/uv/install.sh | sh), " +
                "then restart the gateway.",
            )
          }
        }

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
