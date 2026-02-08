import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import type { BasicMemoryConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerCli(
  api: OpenClawPluginApi,
  client: BmClient,
  cfg: BasicMemoryConfig,
): void {
  api.registerCli(
    // biome-ignore lint/suspicious/noExplicitAny: openclaw SDK does not ship types
    ({ program }: { program: any }) => {
      const cmd = program
        .command("basic-memory")
        .description("Basic Memory knowledge graph commands")

      cmd
        .command("search")
        .argument("<query>", "Search query")
        .option("--limit <n>", "Max results", "10")
        .action(async (query: string, opts: { limit: string }) => {
          const limit = Number.parseInt(opts.limit, 10) || 10
          log.debug(`cli search: query="${query}" limit=${limit}`)

          const results = await client.search(query, limit)

          if (results.length === 0) {
            console.log("No notes found.")
            return
          }

          for (const r of results) {
            const score = r.score ? ` (${(r.score * 100).toFixed(0)}%)` : ""
            console.log(`- ${r.title}${score}`)
            if (r.content) {
              const preview =
                r.content.length > 100
                  ? `${r.content.slice(0, 100)}...`
                  : r.content
              console.log(`  ${preview}`)
            }
          }
        })

      cmd
        .command("read")
        .argument("<identifier>", "Note title, permalink, or memory:// URL")
        .action(async (identifier: string) => {
          log.debug(`cli read: identifier="${identifier}"`)

          const note = await client.readNote(identifier)
          console.log(`# ${note.title}`)
          console.log(`permalink: ${note.permalink}`)
          console.log(`file: ${note.file_path}`)
          console.log("")
          console.log(note.content)
        })

      cmd
        .command("context")
        .argument("<url>", "Memory URL to navigate")
        .option("--depth <n>", "Relation hops to follow", "1")
        .action(async (url: string, opts: { depth: string }) => {
          const depth = Number.parseInt(opts.depth, 10) || 1
          log.debug(`cli context: url="${url}" depth=${depth}`)

          const ctx = await client.buildContext(url, depth)

          if (!ctx.results || ctx.results.length === 0) {
            console.log(`No context found for "${url}".`)
            return
          }

          for (const result of ctx.results) {
            console.log(`## ${result.primary_result.title}`)
            console.log(result.primary_result.content)
            console.log("")
          }
        })

      cmd
        .command("recent")
        .option("--timeframe <t>", "Timeframe (e.g. 24h, 7d)", "24h")
        .action(async (opts: { timeframe: string }) => {
          log.debug(`cli recent: timeframe="${opts.timeframe}"`)

          const results = await client.recentActivity(opts.timeframe)

          if (results.length === 0) {
            console.log("No recent activity.")
            return
          }

          for (const r of results) {
            console.log(`- ${r.title} (${r.permalink})`)
          }
        })

      cmd
        .command("sync")
        .description("Trigger a Basic Memory sync")
        .action(async () => {
          log.debug("cli sync")
          await client.sync()
          console.log(`Synced project: ${cfg.project}`)
        })

      cmd
        .command("status")
        .description("Show plugin status")
        .action(() => {
          console.log(`Mode: ${cfg.mode}`)
          console.log(`Project: ${cfg.project}`)
          console.log(`BM CLI: ${cfg.bmPath}`)
          console.log(`Watch paths: ${cfg.watchPaths.join(", ")}`)
          console.log(`Index interval: ${cfg.indexInterval}s`)
          console.log(`Auto-capture: ${cfg.autoCapture}`)
          console.log(`Debug: ${cfg.debug}`)
        })
    },
    { commands: ["basic-memory"] },
  )
}
