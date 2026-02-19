import { beforeEach, describe, expect, it, jest } from "bun:test"
import { BmClient } from "./bm-client.ts"

function mcpResult(payload: unknown) {
  return {
    structuredContent: { result: payload },
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  }
}

function setConnected(client: BmClient, callTool: jest.Mock) {
  ;(client as any).client = {
    callTool,
    close: jest.fn().mockResolvedValue(undefined),
  }
  ;(client as any).transport = {
    close: jest.fn().mockResolvedValue(undefined),
  }
}

describe("BmClient MCP behavior", () => {
  let client: BmClient

  beforeEach(() => {
    client = new BmClient("/usr/local/bin/bm", "test-project")
  })

  it("readNote calls read_note with JSON output and no frontmatter by default", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        title: "t",
        permalink: "p",
        content: "body",
        file_path: "notes/t.md",
        frontmatter: null,
      }),
    )
    setConnected(client, callTool)

    const note = await client.readNote("t")

    expect(callTool).toHaveBeenCalledWith({
      name: "read_note",
      arguments: {
        identifier: "t",
        include_frontmatter: false,
        output_format: "json",
      },
    })
    expect(note.content).toBe("body")
  })

  it("readNote includes frontmatter when requested", async () => {
    const raw = "---\ntitle: t\n---\n\nbody"
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        title: "t",
        permalink: "p",
        content: raw,
        file_path: "notes/t.md",
        frontmatter: { title: "t" },
      }),
    )
    setConnected(client, callTool)

    const note = await client.readNote("t", { includeFrontmatter: true })

    expect(callTool).toHaveBeenCalledWith({
      name: "read_note",
      arguments: {
        identifier: "t",
        include_frontmatter: true,
        output_format: "json",
      },
    })
    expect(note.content).toBe(raw)
    expect(note.frontmatter).toEqual({ title: "t" })
  })

  it("writeNote calls write_note with JSON output", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        title: "Note",
        permalink: "notes/note",
        file_path: "notes/note.md",
        checksum: "abc123",
        action: "created",
      }),
    )
    setConnected(client, callTool)

    const result = await client.writeNote("Note", "hello", "notes")

    expect(callTool).toHaveBeenCalledWith({
      name: "write_note",
      arguments: {
        title: "Note",
        content: "hello",
        directory: "notes",
        output_format: "json",
      },
    })
    expect(result.checksum).toBe("abc123")
    expect(result.action).toBe("created")
  })

  it("editNote calls edit_note with MCP argument names", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        title: "t",
        permalink: "p",
        file_path: "notes/t.md",
        operation: "find_replace",
        checksum: "abc",
      }),
    )
    setConnected(client, callTool)

    const result = await client.editNote("t", "find_replace", "new", {
      find_text: "old",
      expected_replacements: 2,
    })

    expect(callTool).toHaveBeenCalledWith({
      name: "edit_note",
      arguments: {
        identifier: "t",
        operation: "find_replace",
        content: "new",
        find_text: "old",
        section: undefined,
        expected_replacements: 2,
        output_format: "json",
      },
    })
    expect(result.checksum).toBe("abc")
  })

  it("search calls search_notes with paging params", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        results: [
          {
            title: "x",
            permalink: "x",
            content: "c",
            file_path: "notes/x.md",
            score: 0.9,
          },
        ],
      }),
    )
    setConnected(client, callTool)

    const results = await client.search("marketing strategy", 3)

    expect(callTool).toHaveBeenCalledWith({
      name: "search_notes",
      arguments: {
        query: "marketing strategy",
        page: 1,
        page_size: 3,
        output_format: "json",
      },
    })
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe("x")
  })

  it("buildContext calls build_context using output_format=json", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        results: [
          {
            primary_result: {
              title: "x",
              permalink: "x",
              content: "body",
              file_path: "notes/x.md",
            },
            observations: [],
            related_results: [],
          },
        ],
      }),
    )
    setConnected(client, callTool)

    const ctx = await client.buildContext("memory://notes/x", 2)

    expect(callTool).toHaveBeenCalledWith({
      name: "build_context",
      arguments: {
        url: "memory://notes/x",
        depth: 2,
        output_format: "json",
      },
    })
    expect(ctx.results).toHaveLength(1)
  })

  it("recentActivity calls recent_activity with JSON output", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult([
        {
          title: "x",
          permalink: "x",
          file_path: "notes/x.md",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
    )
    setConnected(client, callTool)

    const recent = await client.recentActivity("7d")

    expect(callTool).toHaveBeenCalledWith({
      name: "recent_activity",
      arguments: {
        timeframe: "7d",
        output_format: "json",
      },
    })
    expect(recent).toHaveLength(1)
  })

  it("listProjects calls list_memory_projects with JSON output", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        projects: [
          {
            name: "alpha",
            path: "/tmp/alpha",
            is_default: true,
          },
        ],
      }),
    )
    setConnected(client, callTool)

    const projects = await client.listProjects()

    expect(callTool).toHaveBeenCalledWith({
      name: "list_memory_projects",
      arguments: {
        output_format: "json",
      },
    })
    expect(projects[0].name).toBe("alpha")
  })

  it("ensureProject calls create_memory_project in idempotent JSON mode", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        name: "test-project",
        path: "/tmp/memory",
        created: false,
        already_exists: true,
      }),
    )
    setConnected(client, callTool)

    await client.ensureProject("/tmp/memory")

    expect(callTool).toHaveBeenCalledWith({
      name: "create_memory_project",
      arguments: {
        project_name: "test-project",
        project_path: "/tmp/memory",
        set_default: true,
        output_format: "json",
      },
    })
  })

  it("deleteNote calls delete_note with JSON output", async () => {
    const callTool = jest.fn().mockResolvedValue(
      mcpResult({
        deleted: true,
        title: "old-note",
        permalink: "notes/old-note",
        file_path: "notes/old-note.md",
      }),
    )
    setConnected(client, callTool)

    const result = await client.deleteNote("notes/old-note")

    expect(callTool).toHaveBeenCalledWith({
      name: "delete_note",
      arguments: {
        identifier: "notes/old-note",
        output_format: "json",
      },
    })
    expect(result.file_path).toBe("notes/old-note.md")
  })

  it("moveNote preserves source filename and calls move_note", async () => {
    const callTool = jest
      .fn()
      .mockResolvedValueOnce(
        mcpResult({
          title: "My Note",
          permalink: "notes/my-note",
          content: "body",
          file_path: "notes/my-note.md",
          frontmatter: null,
        }),
      )
      .mockResolvedValueOnce(
        mcpResult({
          moved: true,
          title: "My Note",
          permalink: "archive/my-note",
          file_path: "archive/my-note.md",
          source: "notes/my-note.md",
          destination: "archive/my-note.md",
        }),
      )
    setConnected(client, callTool)

    const result = await client.moveNote("notes/my-note", "archive")

    expect(callTool).toHaveBeenNthCalledWith(1, {
      name: "read_note",
      arguments: {
        identifier: "notes/my-note",
        include_frontmatter: true,
        output_format: "json",
      },
    })
    expect(callTool).toHaveBeenNthCalledWith(2, {
      name: "move_note",
      arguments: {
        identifier: "notes/my-note",
        destination_path: "archive/my-note.md",
        output_format: "json",
      },
    })
    expect(result.file_path).toBe("archive/my-note.md")
  })

  it("indexConversation does not create fallback note on non-not-found edit errors", async () => {
    ;(client as any).editNote = jest
      .fn()
      .mockRejectedValue(new Error("validation failed"))
    ;(client as any).writeNote = jest.fn()

    await client.indexConversation(
      "user message long enough",
      "assistant reply long enough",
    )

    expect((client as any).writeNote).not.toHaveBeenCalled()
  })

  it("indexConversation creates fallback note only on note-not-found errors", async () => {
    ;(client as any).editNote = jest
      .fn()
      .mockRejectedValue(new Error("Entity not found"))
    ;(client as any).writeNote = jest.fn().mockResolvedValue({
      title: "conversations",
      permalink: "conversations",
      content: "x",
      file_path: "conversations/x.md",
    })

    await client.indexConversation(
      "user message long enough",
      "assistant reply long enough",
    )

    expect((client as any).writeNote).toHaveBeenCalledTimes(1)
  })

  it("retries recoverable MCP failures with bounded attempts", async () => {
    ;(client as any).retryDelaysMs = [0, 0, 0]

    const callTool = jest
      .fn()
      .mockRejectedValue(new Error("connection closed by peer"))

    ;(client as any).ensureConnected = jest.fn().mockResolvedValue({ callTool })
    ;(client as any).disconnectCurrent = jest.fn().mockResolvedValue(undefined)
    ;(client as any).client = { close: jest.fn().mockResolvedValue(undefined) }
    ;(client as any).transport = {
      close: jest.fn().mockResolvedValue(undefined),
    }

    await expect(
      (client as any).callToolRaw("search_notes", { query: "x" }),
    ).rejects.toThrow("BM MCP unavailable")

    expect((client as any).ensureConnected).toHaveBeenCalledTimes(4)
    expect((client as any).disconnectCurrent).toHaveBeenCalledTimes(4)
  })

  it("does not retry non-recoverable tool failures", async () => {
    ;(client as any).retryDelaysMs = [0, 0, 0]

    const callTool = jest.fn().mockRejectedValue(new Error("invalid params"))

    ;(client as any).ensureConnected = jest.fn().mockResolvedValue({ callTool })
    ;(client as any).disconnectCurrent = jest.fn().mockResolvedValue(undefined)

    await expect(
      (client as any).callToolRaw("search_notes", { query: "x" }),
    ).rejects.toThrow("invalid params")

    expect((client as any).ensureConnected).toHaveBeenCalledTimes(1)
    expect((client as any).disconnectCurrent).toHaveBeenCalledTimes(0)
  })
})
