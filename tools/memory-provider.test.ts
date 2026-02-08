import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { registerMemoryProvider } from "./memory-provider.ts"

describe("memory provider tools", () => {
  let mockApi: OpenClawPluginApi
  let mockClient: BmClient

  beforeEach(() => {
    mockApi = {
      registerTool: jest.fn(),
    } as any

    mockClient = {
      search: jest.fn(),
      readNote: jest.fn(),
    } as any
  })

  describe("registerMemoryProvider", () => {
    it("should register both memory_search and memory_get tools", () => {
      registerMemoryProvider(mockApi, mockClient)

      expect(mockApi.registerTool).toHaveBeenCalledTimes(2)

      // Check memory_search registration
      expect(mockApi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "memory_search",
          label: "Memory Search",
          description: expect.stringContaining(
            "Semantically search the knowledge graph",
          ),
        }),
        { names: ["memory_search"] },
      )

      // Check memory_get registration
      expect(mockApi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "memory_get",
          label: "Memory Get",
          description: expect.stringContaining("Read a specific note"),
        }),
        { names: ["memory_get"] },
      )
    })
  })

  describe("memory_search tool", () => {
    let searchExecuteFunction: Function

    beforeEach(() => {
      registerMemoryProvider(mockApi, mockClient)
      // Get the first tool registration (memory_search)
      const searchCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
        .calls[0]
      searchExecuteFunction = searchCall[0].execute
    })

    it("should search with provided query", async () => {
      const mockResults = [
        {
          title: "Test Memory",
          permalink: "test-memory",
          content: "This is a test memory content",
          score: 0.95,
          file_path: "memory/test-memory.md",
        },
        {
          title: "Another Memory",
          permalink: "another-memory",
          content: "This is another memory with different content",
          score: 0.8,
          file_path: "memory/another-memory.md",
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test memory",
      })

      expect(mockClient.search).toHaveBeenCalledWith("test memory", 6)

      // Check OpenClaw memory_search format: score + source + content
      const text = result.content[0].text
      expect(text).toContain("0.950 memory/test-memory.md")
      expect(text).toContain("This is a test memory content")
      expect(text).toContain("0.800 memory/another-memory.md")
      expect(text).toContain("This is another memory with different content")
    })

    it("should use file_path as source when available", async () => {
      const mockResults = [
        {
          title: "Note with Path",
          permalink: "note-with-path",
          content: "Content",
          score: 0.9,
          file_path: "projects/important/note.md",
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      const text = result.content[0].text
      expect(text).toContain("0.900 projects/important/note.md")
    })

    it("should fallback to permalink as source when file_path missing", async () => {
      const mockResults = [
        {
          title: "Note without Path",
          permalink: "note-without-path",
          content: "Content",
          score: 0.85,
          // No file_path
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      const text = result.content[0].text
      expect(text).toContain("0.850 note-without-path")
    })

    it("should handle results without score", async () => {
      const mockResults = [
        {
          title: "No Score Note",
          permalink: "no-score-note",
          content: "Content without score",
          file_path: "notes/no-score.md",
          // No score
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      const text = result.content[0].text
      expect(text).toContain("— notes/no-score.md")
    })

    it("should truncate long content to 700 characters", async () => {
      const longContent = "a".repeat(800)
      const mockResults = [
        {
          title: "Long Content Note",
          permalink: "long-content",
          content: longContent,
          score: 0.9,
          file_path: "notes/long.md",
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      const text = result.content[0].text
      expect(text).toContain("a".repeat(700) + "…")
      expect(text).not.toContain("a".repeat(750))
    })

    it("should not truncate short content", async () => {
      const shortContent = "Short content that should not be truncated"
      const mockResults = [
        {
          title: "Short Content Note",
          permalink: "short-content",
          content: shortContent,
          score: 0.9,
          file_path: "notes/short.md",
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      const text = result.content[0].text
      expect(text).toContain(shortContent)
      expect(text).not.toContain("…")
    })

    it("should format scores with 3 decimal places", async () => {
      const mockResults = [
        {
          title: "Precise Score",
          permalink: "precise-score",
          content: "Content",
          score: 0.123456789,
          file_path: "notes/precise.md",
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      const text = result.content[0].text
      expect(text).toContain("0.123 notes/precise.md")
    })

    it("should return message when no results found", async () => {
      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue([])

      const result = await searchExecuteFunction("tool-call-id", {
        query: "nonexistent",
      })

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "No matches found in the knowledge graph.",
          },
        ],
      })
    })

    it("should handle search errors gracefully", async () => {
      const searchError = new Error("Search service unavailable")
      ;(mockClient.search as jest.MockedFunction<any>).mockRejectedValue(searchError)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "test",
      })

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Memory search failed. Is Basic Memory running?",
          },
        ],
      })
    })

    it("should use limit of 6 for memory search", async () => {
      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue([])

      await searchExecuteFunction("tool-call-id", { query: "test" })

      expect(mockClient.search).toHaveBeenCalledWith("test", 6)
    })

    it("should handle unicode in search results", async () => {
      const mockResults = [
        {
          title: "Unicode Note 🚀",
          permalink: "unicode-note",
          content: "Content with unicode: 中文 العربية עברית",
          score: 0.9,
          file_path: "notes/unicode.md",
        },
      ]

      ;(mockClient.search as jest.MockedFunction<any>).mockResolvedValue(mockResults)

      const result = await searchExecuteFunction("tool-call-id", {
        query: "unicode",
      })

      const text = result.content[0].text
      expect(text).toContain("Content with unicode: 中文 العربية עברית")
    })
  })

  describe("memory_get tool", () => {
    let getExecuteFunction: Function

    beforeEach(() => {
      registerMemoryProvider(mockApi, mockClient)
      // Get the second tool registration (memory_get)
      const getCall = (mockApi.registerTool as jest.MockedFunction<any>).mock.calls[1]
      getExecuteFunction = getCall[0].execute
    })

    it("should read note with provided path", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note",
        content: "This is the test note content",
        file_path: "notes/test-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await getExecuteFunction("tool-call-id", {
        path: "test-note",
      })

      expect(mockClient.readNote).toHaveBeenCalledWith("test-note")

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "# Test Note\n\nThis is the test note content",
          },
        ],
      })
    })

    it("should handle different path formats", async () => {
      const mockNote = {
        title: "Memory URL Note",
        permalink: "memory-url-note",
        content: "Content accessed via memory URL",
        file_path: "notes/memory-url-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const paths = [
        "memory://projects/my-project",
        "simple-note-title",
        "notes/file.md",
        "permalink-identifier",
      ]

      for (const path of paths) {
        await getExecuteFunction("tool-call-id", { path })
        expect(mockClient.readNote).toHaveBeenCalledWith(path)
      }

      expect(mockClient.readNote).toHaveBeenCalledTimes(paths.length)
    })

    it("should format output with title header", async () => {
      const mockNote = {
        title: "Formatted Note Title",
        permalink: "formatted-note",
        content: "Note content here",
        file_path: "notes/formatted.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await getExecuteFunction("tool-call-id", {
        path: "formatted-note",
      })

      expect(result.content[0].text).toBe(
        "# Formatted Note Title\n\nNote content here",
      )
    })

    it("should handle empty content", async () => {
      const mockNote = {
        title: "Empty Note",
        permalink: "empty-note",
        content: "",
        file_path: "notes/empty.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await getExecuteFunction("tool-call-id", {
        path: "empty-note",
      })

      expect(result.content[0].text).toBe("# Empty Note\n\n")
    })

    it("should preserve markdown formatting in content", async () => {
      const formattedContent = `## Subsection

This is **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const code = "example";
\`\`\`

> Blockquote text`

      const mockNote = {
        title: "Markdown Note",
        permalink: "markdown-note",
        content: formattedContent,
        file_path: "notes/markdown.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await getExecuteFunction("tool-call-id", {
        path: "markdown-note",
      })

      expect(result.content[0].text).toBe(
        `# Markdown Note\n\n${formattedContent}`,
      )
    })

    it("should handle readNote errors gracefully", async () => {
      const readError = new Error("Note not found")
      ;(mockClient.readNote as jest.MockedFunction<any>).mockRejectedValue(readError)

      const result = await getExecuteFunction("tool-call-id", {
        path: "nonexistent-note",
      })

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: 'Could not read "nonexistent-note". It may not exist in the knowledge graph.',
          },
        ],
      })
    })

    it("should ignore compatibility parameters (from, lines)", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note",
        content: "Content",
        file_path: "notes/test.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      // Test with optional compatibility parameters
      await getExecuteFunction("tool-call-id", {
        path: "test-note",
        from: 5,
        lines: 10,
      })

      // Should still call readNote with just the path
      expect(mockClient.readNote).toHaveBeenCalledWith("test-note")
    })

    it("should handle unicode in note content", async () => {
      const unicodeContent = "Unicode content: 🚀 中文 العربية עברית"
      const mockNote = {
        title: "Unicode Note",
        permalink: "unicode-note",
        content: unicodeContent,
        file_path: "notes/unicode.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await getExecuteFunction("tool-call-id", {
        path: "unicode-note",
      })

      expect(result.content[0].text).toBe(
        `# Unicode Note\n\n${unicodeContent}`,
      )
    })

    it("should handle very long content", async () => {
      const longContent = "Long content line.\n".repeat(500)
      const mockNote = {
        title: "Long Note",
        permalink: "long-note",
        content: longContent,
        file_path: "notes/long.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await getExecuteFunction("tool-call-id", {
        path: "long-note",
      })

      expect(result.content[0].text).toBe(`# Long Note\n\n${longContent}`)
    })

    it("should handle network errors", async () => {
      const networkError = new Error("Connection refused")
      networkError.code = "ECONNREFUSED"
      ;(mockClient.readNote as jest.MockedFunction<any>).mockRejectedValue(
        networkError,
      )

      const result = await getExecuteFunction("tool-call-id", {
        path: "network-error",
      })

      expect(result.content[0].text).toContain("Could not read")
    })
  })

  describe("tool parameter schemas", () => {
    it("should define correct parameter schema for memory_search", () => {
      registerMemoryProvider(mockApi, mockClient)

      const searchCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
        .calls[0]
      const parameters = searchCall[0].parameters

      expect(parameters).toMatchObject({
        type: "object",
        properties: {
          query: {
            type: "string",
            description: expect.stringContaining("Search query"),
          },
        },
      })
    })

    it("should define correct parameter schema for memory_get", () => {
      registerMemoryProvider(mockApi, mockClient)

      const getCall = (mockApi.registerTool as jest.MockedFunction<any>).mock.calls[1]
      const parameters = getCall[0].parameters

      expect(parameters).toMatchObject({
        type: "object",
        properties: {
          path: {
            type: "string",
            description: expect.stringContaining("Note identifier"),
          },
          from: expect.objectContaining({
            type: "number",
          }),
          lines: expect.objectContaining({
            type: "number",
          }),
        },
      })
    })
  })
})