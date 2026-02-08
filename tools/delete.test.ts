import { beforeEach, describe, expect, it, jest } from "bun:test"

describe("delete tool", () => {
  let registeredTool: { name: string; execute: Function } | null = null
  let mockClient: Record<string, Function>
  let mockApi: Record<string, Function>

  beforeEach(() => {
    registeredTool = null
    mockClient = {
      deleteNote: jest.fn(),
    }
    mockApi = {
      registerTool: jest.fn((tool: any) => {
        registeredTool = tool
      }),
    }
  })

  async function loadAndRegister() {
    const { registerDeleteTool } = await import("./delete.ts")
    registerDeleteTool(mockApi as any, mockClient as any, {
      projectPath: "/tmp/test-project",
    } as any)
    return registeredTool!
  }

  it("should register bm_delete tool", async () => {
    await loadAndRegister()
    expect(registeredTool).not.toBeNull()
    expect(registeredTool!.name).toBe("bm_delete")
  })

  it("should delete a note successfully", async () => {
    const tool = await loadAndRegister()
    ;(mockClient.deleteNote as any).mockResolvedValue({
      title: "old-note",
      permalink: "notes/old-note",
      file_path: "notes/old-note.md",
    })

    const result = await tool.execute("call-1", { identifier: "notes/old-note" })
    expect(result.content[0].text).toContain("Deleted")
    expect(result.content[0].text).toContain("old-note")
  })

  it("should handle delete failure", async () => {
    const tool = await loadAndRegister()
    ;(mockClient.deleteNote as any).mockRejectedValue(new Error("not found"))

    const result = await tool.execute("call-1", { identifier: "nonexistent" })
    expect(result.content[0].text).toContain("Failed to delete")
  })
})
