import { beforeEach, describe, expect, it, jest } from "bun:test"
import {
  BmClient,
  isProjectAlreadyExistsError,
  isMissingEditNoteCommandError,
  isNoteNotFoundError,
  isUnsupportedStripFrontmatterError,
  parseJsonOutput,
  stripFrontmatter,
} from "./bm-client.ts"

describe("BmClient utility functions", () => {
  describe("stripFrontmatter", () => {
    it("strips YAML frontmatter from content", () => {
      const content =
        "---\ntitle: Test Note\ndate: 2025-02-08\n---\n\nThis is the actual content"
      expect(stripFrontmatter(content)).toBe("This is the actual content")
    })

    it("handles content without frontmatter", () => {
      const content = "Just regular content without frontmatter"
      expect(stripFrontmatter(content)).toBe(content)
    })
  })

  describe("parseJsonOutput", () => {
    it("parses clean JSON", () => {
      const json = '{"results": [{"title": "test"}]}'
      expect(parseJsonOutput(json)).toEqual({ results: [{ title: "test" }] })
    })

    it("parses JSON with prefix lines", () => {
      const output = `
Warning: something happened
{"results": [{"title": "Test", "permalink": "test"}]}
`
      expect(parseJsonOutput(output)).toEqual({
        results: [{ title: "Test", permalink: "test" }],
      })
    })
  })

  describe("error classifiers", () => {
    it("detects unsupported --strip-frontmatter flag errors", () => {
      expect(
        isUnsupportedStripFrontmatterError(
          new Error("No such option: --strip-frontmatter"),
        ),
      ).toBe(true)
      expect(isUnsupportedStripFrontmatterError(new Error("different error"))).toBe(
        false,
      )
    })

    it("detects missing edit-note command errors", () => {
      expect(
        isMissingEditNoteCommandError(new Error("No such command 'edit-note'")),
      ).toBe(true)
      expect(isMissingEditNoteCommandError(new Error("validation failed"))).toBe(
        false,
      )
    })

    it("detects note-not-found errors and excludes missing command errors", () => {
      expect(isNoteNotFoundError(new Error("Entity not found"))).toBe(true)
      expect(
        isNoteNotFoundError(new Error("No such command 'edit-note'")),
      ).toBe(false)
    })

    it("detects project already exists errors", () => {
      expect(
        isProjectAlreadyExistsError(new Error("Project 'x' already exists")),
      ).toBe(true)
      expect(isProjectAlreadyExistsError(new Error("permission denied"))).toBe(
        false,
      )
    })
  })
})

describe("BmClient behavior", () => {
  let client: BmClient

  beforeEach(() => {
    client = new BmClient("/usr/local/bin/bm", "test-project")
  })

  it("readNote strips by default using --strip-frontmatter", async () => {
    const execTool = jest
      .fn()
      .mockResolvedValue(
        '{"title":"t","permalink":"p","content":"body","file_path":"notes/t.md","frontmatter":{"title":"t"}}',
      )
    ;(client as any).execTool = execTool

    const note = await client.readNote("t")

    expect(execTool).toHaveBeenCalledWith([
      "tool",
      "read-note",
      "t",
      "--strip-frontmatter",
    ])
    expect(note.content).toBe("body")
    expect(note.frontmatter).toEqual({ title: "t" })
  })

  it("readNote returns raw markdown when includeFrontmatter is true", async () => {
    const raw = "---\ntitle: t\n---\n\nbody"
    const execTool = jest
      .fn()
      .mockResolvedValue(
        `{"title":"t","permalink":"p","content":${JSON.stringify(raw)},"file_path":"notes/t.md","frontmatter":{"title":"t"}}`,
      )
    ;(client as any).execTool = execTool

    const note = await client.readNote("t", { includeFrontmatter: true })

    expect(execTool).toHaveBeenCalledWith(["tool", "read-note", "t"])
    expect(note.content).toBe(raw)
  })

  it("readNote falls back to local strip when --strip-frontmatter is unsupported", async () => {
    const raw = "---\ntitle: t\nstatus: active\n---\n\nbody"
    const execTool = jest
      .fn()
      .mockRejectedValueOnce(new Error("No such option: --strip-frontmatter"))
      .mockResolvedValueOnce(
        `{"title":"t","permalink":"p","content":${JSON.stringify(raw)},"file_path":"notes/t.md"}`,
      )
    ;(client as any).execTool = execTool

    const note = await client.readNote("t")

    expect(execTool).toHaveBeenNthCalledWith(1, [
      "tool",
      "read-note",
      "t",
      "--strip-frontmatter",
    ])
    expect(execTool).toHaveBeenNthCalledWith(2, ["tool", "read-note", "t"])
    expect(note.content).toBe("body")
  })

  it("editNote sends native edit-note args including expected_replacements", async () => {
    const execTool = jest
      .fn()
      .mockResolvedValue(
        '{"title":"t","permalink":"p","file_path":"notes/t.md","operation":"find_replace","checksum":"abc"}',
      )
    ;(client as any).execTool = execTool

    const result = await client.editNote("t", "find_replace", "new", {
      find_text: "old",
      expected_replacements: 2,
    })

    expect(execTool).toHaveBeenCalledWith([
      "tool",
      "edit-note",
      "t",
      "--operation",
      "find_replace",
      "--content",
      "new",
      "--find-text",
      "old",
      "--expected-replacements",
      "2",
    ])
    expect(result.checksum).toBe("abc")
  })

  it("editNote throws actionable upgrade guidance when command is missing", async () => {
    ;(client as any).execTool = jest
      .fn()
      .mockRejectedValue(new Error("No such command 'edit-note'"))

    await expect(client.editNote("t", "append", "new")).rejects.toThrow(
      "bm tool edit-note is required for bm_edit",
    )
  })

  it("ensureProject ignores already-exists errors", async () => {
    const execRaw = jest
      .fn()
      .mockRejectedValue(new Error("Project 'test-project' already exists"))
    ;(client as any).execRaw = execRaw

    await expect(client.ensureProject("/tmp/memory")).resolves.toBeUndefined()
    expect(execRaw).toHaveBeenCalledWith([
      "project",
      "add",
      "test-project",
      "/tmp/memory",
      "--default",
    ])
  })

  it("ensureProject throws when project creation fails for other reasons", async () => {
    const execRaw = jest
      .fn()
      .mockRejectedValue(new Error("permission denied"))
    ;(client as any).execRaw = execRaw

    await expect(client.ensureProject("/tmp/memory")).rejects.toThrow(
      'failed to ensure project "test-project" at "/tmp/memory"',
    )
    expect(execRaw).toHaveBeenCalledWith([
      "project",
      "add",
      "test-project",
      "/tmp/memory",
      "--default",
    ])
  })

  it("ensureProject passes --default when project is created", async () => {
    const execRaw = jest.fn().mockResolvedValue("")
    ;(client as any).execRaw = execRaw

    await expect(client.ensureProject("/tmp/memory")).resolves.toBeUndefined()
    expect(execRaw).toHaveBeenCalledWith([
      "project",
      "add",
      "test-project",
      "/tmp/memory",
      "--default",
    ])
  })

  it("indexConversation does not create fallback note on non-not-found edit errors", async () => {
    ;(client as any).editNote = jest
      .fn()
      .mockRejectedValue(new Error("No such command 'edit-note'"))
    ;(client as any).writeNote = jest.fn()

    await client.indexConversation("user message long enough", "assistant reply long enough")

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

    await client.indexConversation("user message long enough", "assistant reply long enough")

    expect((client as any).writeNote).toHaveBeenCalledTimes(1)
    const [title, content, folder] = (client as any).writeNote.mock.calls[0]
    expect(typeof title).toBe("string")
    expect(title.startsWith("conversations-")).toBe(true)
    expect(typeof content).toBe("string")
    expect(folder).toBe("conversations")
  })
})
