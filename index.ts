import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { BmClient } from "./bm-client.ts"
import { registerCli } from "./commands/cli.ts"
import { registerCommands } from "./commands/slash.ts"
import { basicMemoryConfigSchema, parseConfig } from "./config.ts"
import { buildCaptureHandler } from "./hooks/capture.ts"
import { initLogger, log } from "./logger.ts"
import { FileWatcher } from "./mode-b/file-watcher.ts"
import { registerContextTool } from "./tools/context.ts"
import { registerDeleteTool } from "./tools/delete.ts"
import { registerEditTool } from "./tools/edit.ts"
import { registerMemoryProvider } from "./tools/memory-provider.ts"
import { registerMoveTool } from "./tools/move.ts"
import { registerReadTool } from "./tools/read.ts"
import { registerSearchTool } from "./tools/search.ts"
import { registerWriteTool } from "./tools/write.ts"

export default {
  id: "basic-memory",
  name: "Basic Memory",
  description:
    "Local-first knowledge graph for OpenClaw — persistent memory with graph search and MCP control plane",
  kind: "memory" as const,
  configSchema: basicMemoryConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig)

    initLogger(api.logger, cfg.debug)

    log.info(`mode=${cfg.mode} project=${cfg.project}`)

    const client = new BmClient(cfg.bmPath, cfg.project)
    let fileWatcher: FileWatcher | null = null

    // --- Tools (available in all modes) ---
    registerSearchTool(api, client)
    registerReadTool(api, client)
    registerWriteTool(api, client)
    registerEditTool(api, client)
    registerContextTool(api, client)
    registerDeleteTool(api, client, cfg)
    registerMoveTool(api, client, cfg)

    // --- Mode B: Archive ---
    if (cfg.mode === "archive" || cfg.mode === "both") {
      fileWatcher = new FileWatcher(client, cfg)

      if (cfg.autoCapture) {
        api.on("agent_end", buildCaptureHandler(client, cfg))
      }
    }

    // --- Mode A: Agent Memory ---
    // Replaces OpenClaw's built-in memory_search and memory_get tools
    // with Basic Memory's knowledge graph search and retrieval.
    if (cfg.mode === "agent-memory" || cfg.mode === "both") {
      registerMemoryProvider(api, client)
      log.info("agent-memory mode: registered memory_search + memory_get")
    }

    // --- Commands ---
    registerCommands(api, client)
    registerCli(api, client, cfg)

    // --- Service lifecycle ---
    api.registerService({
      id: "basic-memory",
      start: async (ctx: { config?: unknown; workspaceDir?: string }) => {
        log.info("starting...")

        await client.ensureProject(cfg.projectPath)
        log.debug(`project "${cfg.project}" at ${cfg.projectPath}`)

        if (fileWatcher) {
          // Use workspace dir from OpenClaw service context (not process.cwd()
          // which is "/" for LaunchAgent services)
          const workspace = ctx.workspaceDir ?? process.cwd()
          log.info(`workspace for file watcher: ${workspace}`)
          await fileWatcher.start(workspace)
        }

        log.info("connected")
      },
      stop: () => {
        if (fileWatcher) {
          fileWatcher.stop()
        }
        log.info("stopped")
      },
    })
  },
}
