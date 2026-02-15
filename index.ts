import { spawn } from "node:child_process"
import type { ChildProcess } from "node:child_process"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { BmClient } from "./bm-client.ts"
import { registerCli } from "./commands/cli.ts"
import { registerCommands } from "./commands/slash.ts"
import { basicMemoryConfigSchema, parseConfig } from "./config.ts"
import { buildCaptureHandler } from "./hooks/capture.ts"
import { initLogger, log } from "./logger.ts"
import { registerContextTool } from "./tools/context.ts"
import { registerDeleteTool } from "./tools/delete.ts"
import { registerEditTool } from "./tools/edit.ts"
import { registerMemoryProvider, setWorkspaceDir } from "./tools/memory-provider.ts"
import { registerMoveTool } from "./tools/move.ts"
import { registerReadTool } from "./tools/read.ts"
import { registerSearchTool } from "./tools/search.ts"
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

    log.info(`project=${cfg.project} memoryDir=${cfg.memoryDir} memoryFile=${cfg.memoryFile}`)

    const client = new BmClient(cfg.bmPath, cfg.project)

    // --- BM Tools (always registered) ---
    registerSearchTool(api, client)
    registerReadTool(api, client)
    registerWriteTool(api, client)
    registerEditTool(api, client)
    registerContextTool(api, client)
    registerDeleteTool(api, client, cfg)
    registerMoveTool(api, client, cfg)

    // --- Composited memory_search + memory_get (always registered) ---
    registerMemoryProvider(api, client, cfg)
    log.info("registered composited memory_search + memory_get")

    if (cfg.autoCapture) {
      api.on("agent_end", buildCaptureHandler(client, cfg))
    }

    // --- Commands ---
    registerCommands(api, client)
    registerCli(api, client, cfg)

    // --- Service lifecycle ---
    let bmWatchProc: ChildProcess | null = null

    api.registerService({
      id: "basic-memory",
      start: async (ctx: { config?: unknown; workspaceDir?: string }) => {
        log.info("starting...")

        await client.ensureProject(cfg.projectPath)
        log.debug(`project "${cfg.project}" at ${cfg.projectPath}`)

        const workspace = ctx.workspaceDir ?? process.cwd()
        setWorkspaceDir(workspace)

        // Start `bm watch` as a long-running child process.
        // It does an initial sync then watches for file changes.
        const args = ["watch", "--project", cfg.project]
        log.info(`spawning: ${cfg.bmPath} ${args.join(" ")}`)

        bmWatchProc = spawn(cfg.bmPath, args, {
          stdio: ["ignore", "pipe", "pipe"],
          detached: false,
        })

        bmWatchProc.stdout?.on("data", (data: Buffer) => {
          const msg = data.toString().trim()
          if (msg) log.debug(`[bm watch] ${msg}`)
        })

        bmWatchProc.stderr?.on("data", (data: Buffer) => {
          const msg = data.toString().trim()
          if (msg) log.warn(`[bm watch] ${msg}`)
        })

        bmWatchProc.on("exit", (code, signal) => {
          log.warn(`bm watch exited (code=${code}, signal=${signal})`)
          bmWatchProc = null
        })

        log.info("connected — bm watch running")
      },
      stop: () => {
        if (bmWatchProc) {
          log.info("stopping bm watch...")
          bmWatchProc.kill("SIGTERM")
          bmWatchProc = null
        }
        log.info("stopped")
      },
    })
  },
}
