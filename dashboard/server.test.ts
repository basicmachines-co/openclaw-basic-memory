import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "bun:test"
import type { Server } from "node:http"
import type { BmClient } from "../bm-client.ts"
import { createDashboardServer } from "./server.ts"

describe("dashboard server", () => {
  let server: Server
  let mockClient: BmClient
  let baseUrl: string

  beforeAll(async () => {
    mockClient = {
      search: jest.fn().mockResolvedValue([]),
      recentActivity: jest.fn().mockResolvedValue([]),
      readNote: jest.fn().mockResolvedValue({
        title: "Test",
        permalink: "test",
        content: "",
        file_path: "test.md",
        frontmatter: { status: "active", current_step: 1, total_steps: 3, assigned_to: "claw" },
      }),
    } as any

    server = createDashboardServer({ port: 0, client: mockClient })
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })
    const addr = server.address()
    const port = typeof addr === "object" && addr ? addr.port : 0
    baseUrl = `http://localhost:${port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  beforeEach(() => {
    ;(mockClient.search as any).mockClear()
    ;(mockClient.recentActivity as any).mockClear()
    ;(mockClient.readNote as any).mockClear()
  })

  it("serves index.html at /", async () => {
    const res = await fetch(`${baseUrl}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
    const body = await res.text()
    expect(body).toContain("Memory Dashboard")
  })

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/api/unknown`)
    expect(res.status).toBe(404)
  })

  it("GET /api/tasks calls search with type:Task", async () => {
    ;(mockClient.search as any).mockResolvedValue([
      { title: "My Task", permalink: "tasks/my-task", content: "do stuff", file_path: "tasks/my-task.md" },
    ])

    const res = await fetch(`${baseUrl}/api/tasks`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
    expect(data[0].title).toBe("My Task")
    expect(data[0].frontmatter).toBeDefined()

    expect(mockClient.search).toHaveBeenCalledWith("type:Task", 50, undefined, {
      filters: { type: "Task" },
    })
  })

  it("GET /api/activity calls recentActivity", async () => {
    ;(mockClient.recentActivity as any).mockResolvedValue([
      { title: "Daily Note", permalink: "2026-02-24", file_path: "memory/2026-02-24.md", created_at: "2026-02-24T12:00:00Z" },
    ])

    const res = await fetch(`${baseUrl}/api/activity`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.length).toBe(1)
    expect(data[0].title).toBe("Daily Note")
    expect(mockClient.recentActivity).toHaveBeenCalledWith("24h")
  })

  it("GET /api/explorations searches for type:Exploration", async () => {
    ;(mockClient.search as any).mockResolvedValue([])

    const res = await fetch(`${baseUrl}/api/explorations`)
    expect(res.status).toBe(200)
    expect(mockClient.search).toHaveBeenCalledWith("type:Exploration", 50, undefined, {
      filters: { type: "Exploration" },
    })
  })

  it("GET /api/notes/daily searches for today's date", async () => {
    const today = new Date().toISOString().split("T")[0]
    ;(mockClient.search as any).mockResolvedValue([
      { title: today, permalink: today, content: "daily stuff", file_path: `memory/${today}.md` },
    ])

    const res = await fetch(`${baseUrl}/api/notes/daily`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.length).toBe(1)
    expect(mockClient.search).toHaveBeenCalledWith(today, 5)
  })

  it("GET /api/stats returns counts", async () => {
    ;(mockClient.recentActivity as any).mockResolvedValue([{}, {}, {}])
    ;(mockClient.search as any).mockImplementation(async (query: string) => {
      if (query === "type:Task") return [
        { title: "T1", permalink: "t1", content: "", file_path: "t1.md" },
        { title: "T2", permalink: "t2", content: "", file_path: "t2.md" },
      ]
      return [{ title: "E1", permalink: "e1", content: "", file_path: "e1.md" }]
    })
    ;(mockClient.readNote as any)
      .mockResolvedValueOnce({ title: "T1", permalink: "t1", content: "", file_path: "t1.md", frontmatter: { status: "active" } })
      .mockResolvedValueOnce({ title: "T2", permalink: "t2", content: "", file_path: "t2.md", frontmatter: { status: "done" } })

    const res = await fetch(`${baseUrl}/api/stats`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totalNotes).toBe(3)
    expect(data.activeTasks).toBe(1)
    expect(data.completedTasks).toBe(1)
    expect(data.explorations).toBe(1)
  })

  it("returns 500 on client error", async () => {
    ;(mockClient.search as any).mockRejectedValue(new Error("MCP down"))

    const res = await fetch(`${baseUrl}/api/tasks`)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("MCP down")
  })
})
