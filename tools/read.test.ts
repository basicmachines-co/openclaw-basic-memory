import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { registerReadTool } from "./read.ts"

describe("read tool", () => {
  let mockApi: OpenClawPluginApi
  let mockClient: BmClient

  beforeEach(() => {
    mockApi = {
      registerTool: jest.fn(),
    } as any

    mockClient = {
      readNote: jest.fn(),
    } as any
  })

  describe("registerReadTool", () => {
    it("should register bm_read tool with correct configuration", () => {
      registerReadTool(mockApi, mockClient)

      expect(mockApi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "bm_read",
          label: "Read Note",
          description: expect.stringContaining(
            "Read a specific note from the Basic Memory knowledge graph",
          ),
          parameters: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              identifier: expect.objectContaining({
                type: "string",
                description: "Note title, permalink, or memory:// URL to read",
              }),
            }),
          }),
          execute: expect.any(Function),
        }),
        { name: "bm_read" },
      )
    })
  })

  describe("tool execution", () => {
    let executeFunction: Function

    beforeEach(() => {
      registerReadTool(mockApi, mockClient)
      const registerCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
        .calls[0]
      executeFunction = registerCall[0].execute
    })

    it("should read note and return content", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note",
        content: "This is the content of the test note.\n\nIt has multiple paragraphs.",
        file_path: "notes/test-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "test-note",
      })

      expect(mockClient.readNote).toHaveBeenCalledWith("test-note")
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "This is the content of the test note.\n\nIt has multiple paragraphs.",
          },
        ],
        details: {
          title: "Test Note",
          permalink: "test-note",
          file_path: "notes/test-note.md",
        },
      })
    })

    it("should handle reading by title", async () => {
      const mockNote = {
        title: "My Important Note",
        permalink: "my-important-note",
        content: "Important content here",
        file_path: "notes/my-important-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      await executeFunction("tool-call-id", {
        identifier: "My Important Note",
      })

      expect(mockClient.readNote).toHaveBeenCalledWith("My Important Note")
    })

    it("should handle reading by permalink", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note-permalink",
        content: "Content accessed via permalink",
        file_path: "notes/test-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      await executeFunction("tool-call-id", {
        identifier: "test-note-permalink",
      })

      expect(mockClient.readNote).toHaveBeenCalledWith("test-note-permalink")
    })

    it("should handle reading by memory:// URL", async () => {
      const mockNote = {
        title: "Memory URL Note",
        permalink: "memory-url-note",
        content: "Content accessed via memory URL",
        file_path: "notes/memory-url-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      await executeFunction("tool-call-id", {
        identifier: "memory://projects/my-project",
      })

      expect(mockClient.readNote).toHaveBeenCalledWith("memory://projects/my-project")
    })

    it("should handle empty content", async () => {
      const mockNote = {
        title: "Empty Note",
        permalink: "empty-note",
        content: "",
        file_path: "notes/empty-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "empty-note",
      })

      expect(result.content[0].text).toBe("")
    })

    it("should handle notes with special characters in content", async () => {
      const specialContent = "Content with **markdown**, `code`, and [links](http://example.com)"
      const mockNote = {
        title: "Special Content Note",
        permalink: "special-content",
        content: specialContent,
        file_path: "notes/special-content.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "special-content",
      })

      expect(result.content[0].text).toBe(specialContent)
    })

    it("should handle very long content", async () => {
      const longContent = "Long content.\n".repeat(1000)
      const mockNote = {
        title: "Long Note",
        permalink: "long-note",
        content: longContent,
        file_path: "notes/long-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "long-note",
      })

      expect(result.content[0].text).toBe(longContent)
      expect(result.content[0].text.length).toBeGreaterThan(10000)
    })

    it("should handle notes with unicode characters", async () => {
      const unicodeContent = "Unicode content: 🚀 中文 العربية עברית"
      const mockNote = {
        title: "Unicode Note",
        permalink: "unicode-note",
        content: unicodeContent,
        file_path: "notes/unicode-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "unicode-note",
      })

      expect(result.content[0].text).toBe(unicodeContent)
    })

    it("should handle reading errors gracefully", async () => {
      const readError = new Error("Note not found")
      ;(mockClient.readNote as jest.MockedFunction<any>).mockRejectedValue(readError)

      const result = await executeFunction("tool-call-id", {
        identifier: "nonexistent-note",
      })

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: 'Could not read note "nonexistent-note". It may not exist yet.',
          },
        ],
      })
    })

    it("should include all note details in response", async () => {
      const mockNote = {
        title: "Detailed Note",
        permalink: "detailed-note",
        content: "Note with all details",
        file_path: "folder/subfolder/detailed-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "detailed-note",
      })

      expect(result.details).toEqual({
        title: "Detailed Note",
        permalink: "detailed-note",
        file_path: "folder/subfolder/detailed-note.md",
      })
    })

    it("should handle different identifier formats", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note",
        content: "Content",
        file_path: "notes/test.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      // Test various identifier formats
      const identifiers = [
        "test-note", // permalink
        "Test Note", // title with spaces
        "memory://notes/test-note", // memory URL
        "notes/test.md", // file path
      ]

      for (const identifier of identifiers) {
        await executeFunction("tool-call-id", { identifier })
        expect(mockClient.readNote).toHaveBeenCalledWith(identifier)
      }

      expect(mockClient.readNote).toHaveBeenCalledTimes(identifiers.length)
    })

    it("should handle network timeouts gracefully", async () => {
      const timeoutError = new Error("Request timeout")
      timeoutError.code = "TIMEOUT"
      ;(mockClient.readNote as jest.MockedFunction<any>).mockRejectedValue(timeoutError)

      const result = await executeFunction("tool-call-id", {
        identifier: "timeout-note",
      })

      expect(result.content[0].text).toContain("Could not read note")
    })

    it("should preserve content formatting", async () => {
      const formattedContent = `# Heading 1

## Heading 2

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2
  - Nested item

\`\`\`javascript
const code = "example";
\`\`\`

> This is a blockquote

[Link](https://example.com)`

      const mockNote = {
        title: "Formatted Note",
        permalink: "formatted-note",
        content: formattedContent,
        file_path: "notes/formatted-note.md",
      }

      ;(mockClient.readNote as jest.MockedFunction<any>).mockResolvedValue(mockNote)

      const result = await executeFunction("tool-call-id", {
        identifier: "formatted-note",
      })

      expect(result.content[0].text).toBe(formattedContent)
    })
  })
})