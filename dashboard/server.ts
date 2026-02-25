import { readFileSync } from "node:fs"
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http"
import { join } from "node:path"
import type {
  BmClient,
  MetadataSearchResult,
  SearchResult,
} from "../bm-client.ts"

export interface DashboardServerOptions {
  port: number
  client: BmClient
}

export function createDashboardServer(options: DashboardServerOptions): Server {
  const { client, port } = options

  const indexHtml = readFileSync(
    join(import.meta.dirname ?? __dirname, "index.html"),
    "utf-8",
  )

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`)
      const path = url.pathname

      try {
        if (path === "/" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
          res.end(indexHtml)
          return
        }

        if (path === "/api/tasks" && req.method === "GET") {
          const metaResults = await client.searchByMetadata(
            { type: "Task" },
            50,
          )
          const tasks = await enrichMetadataResults(client, metaResults)
          json(res, tasks)
          return
        }

        if (path === "/api/activity" && req.method === "GET") {
          const results = await client.recentActivity("24h")
          json(res, results)
          return
        }

        if (path === "/api/explorations" && req.method === "GET") {
          const metaResults = await client.searchByMetadata(
            { type: "Exploration" },
            50,
          )
          json(res, metaResults.results)
          return
        }

        if (path === "/api/notes/daily" && req.method === "GET") {
          const today = new Date().toISOString().split("T")[0]
          const results = await client.search(today, 5)
          const daily = results.filter((r) => r.title.includes(today))
          json(res, daily)
          return
        }

        if (path === "/api/stats" && req.method === "GET") {
          const [allNotes, tasksMeta, explorationsMeta] = await Promise.all([
            client.recentActivity("720h").catch(() => []),
            client
              .searchByMetadata({ type: "Task" }, 100)
              .catch(() => ({ results: [] }) as MetadataSearchResult),
            client
              .searchByMetadata({ type: "Exploration" }, 100)
              .catch(() => ({ results: [] }) as MetadataSearchResult),
          ])

          const tasksWithFm = await enrichMetadataResults(client, tasksMeta)
          const active = tasksWithFm.filter(
            (t) => t.frontmatter?.status === "active",
          ).length
          const completed = tasksWithFm.filter(
            (t) =>
              t.frontmatter?.status === "done" ||
              t.frontmatter?.status === "completed",
          ).length

          json(res, {
            totalNotes: allNotes.length,
            activeTasks: active,
            completedTasks: completed,
            explorations: explorationsMeta.results.length,
          })
          return
        }

        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "not found" }))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: message }))
      }
    },
  )

  return server
}

function json(res: ServerResponse, data: unknown): void {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  })
  res.end(JSON.stringify(data))
}

async function enrichWithFrontmatter(
  client: BmClient,
  results: SearchResult[],
): Promise<
  Array<SearchResult & { frontmatter?: Record<string, unknown> | null }>
> {
  const enriched = await Promise.all(
    results.map(async (r) => {
      try {
        const note = await client.readNote(r.permalink, {
          includeFrontmatter: true,
        })
        return { ...r, frontmatter: note.frontmatter ?? null }
      } catch {
        return { ...r, frontmatter: null }
      }
    }),
  )
  return enriched
}

async function enrichMetadataResults(
  client: BmClient,
  metaResults: MetadataSearchResult,
): Promise<
  Array<
    Record<string, unknown> & {
      frontmatter?: Record<string, unknown> | null
    }
  >
> {
  const enriched = await Promise.all(
    metaResults.results.map(async (r: Record<string, unknown>) => {
      const permalink = (r.permalink ?? r.entity ?? "") as string
      try {
        const note = await client.readNote(permalink, {
          includeFrontmatter: true,
        })
        return { ...r, frontmatter: note.frontmatter ?? null }
      } catch {
        return { ...r, frontmatter: null }
      }
    }),
  )
  return enriched
}
