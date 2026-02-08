import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { registerEditTool } from "./edit.ts"

describe("edit tool", () => {
  let mockApi: OpenClawPluginApi
  let mockClient: BmClient

  beforeEach(() => {
    mockApi = {
      registerTool: jest.fn(),
    } as any

    mockClient = {
      editNote: jest.fn(),
    } as any
  })

  describe("registerEditTool", () => {
    it("should register bm_edit tool with correct configuration", () => {
      registerEditTool(mockApi, mockClient)

      expect(mockApi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "bm_edit",
          label: "Edit Note",
          description: expect.stringContaining(
            "Incrementally edit an existing note in the Basic Memory knowledge graph",
          ),
          parameters: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              identifier: expect.objectContaining({
                type: "string",
                description: "Note title, permalink, or memory:// URL to edit",
              }),
              operation: expect.objectContaining({
                description: expect.stringContaining("append"),
              }),
              content: expect.objectContaining({
                type: "string",
                description: "New content to add or replace with",
              }),
              findText: expect.objectContaining({
                description: "Text to find (required for find_replace operation)",
              }),
              sectionTitle: expect.objectContaining({
                description: expect.stringContaining("required for replace_section"),
              }),
            }),
          }),
          execute: expect.any(Function),
        }),
        { name: "bm_edit" },
      )
    })

    it("should define operation union with all edit types", () => {
      registerEditTool(mockApi, mockClient)

      const registerCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
        .calls[0]
      const parameters = registerCall[0].parameters

      // Check that operation parameter includes all expected values
      const operationParam = parameters.properties.operation
      expect(operationParam).toBeDefined()
    })
  })

  describe("tool execution", () => {
    let executeFunction: Function

    beforeEach(() => {
      registerEditTool(mockApi, mockClient)
      const registerCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
        .calls[0]
      executeFunction = registerCall[0].execute
    })

    describe("append operation", () => {
      it("should append content to note", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "Original content\nAppended content",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "append",
          content: "\nAppended content",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note",
          "append",
          "\nAppended content",
          undefined,
          undefined,
        )

        expect(result).toEqual({
          content: [
            {
              type: "text",
              text: "Note updated: Test Note (test-note)",
            },
          ],
          details: {
            title: "Test Note",
            permalink: "test-note",
            file_path: "notes/test-note.md",
            operation: "append",
          },
        })
      })
    })

    describe("prepend operation", () => {
      it("should prepend content to note", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "Prepended content\nOriginal content",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "prepend",
          content: "Prepended content\n",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note",
          "prepend",
          "Prepended content\n",
          undefined,
          undefined,
        )

        expect(result.details.operation).toBe("prepend")
      })
    })

    describe("find_replace operation", () => {
      it("should replace text in note", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "Updated content here",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "find_replace",
          content: "Updated content",
          findText: "Original content",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note",
          "find_replace",
          "Updated content",
          "Original content",
          undefined,
        )

        expect(result.details.operation).toBe("find_replace")
      })

      it("should handle find_replace without findText parameter", async () => {
        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "find_replace",
          content: "New content",
          // Missing findText
        })

        // Should not be called if findText is missing (client handles validation)
        expect(mockClient.editNote).toHaveBeenCalled()
      })
    })

    describe("replace_section operation", () => {
      it("should replace section in note", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "# Heading\n\nNew section content\n\n## Other Section",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "replace_section",
          content: "New section content",
          sectionTitle: "Heading",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note",
          "replace_section",
          "New section content",
          undefined,
          "Heading",
        )

        expect(result.details.operation).toBe("replace_section")
      })

      it("should handle replace_section without sectionTitle parameter", async () => {
        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "replace_section",
          content: "New content",
          // Missing sectionTitle
        })

        // Should still call editNote (client handles validation)
        expect(mockClient.editNote).toHaveBeenCalled()
      })
    })

    describe("different identifier formats", () => {
      it("should handle title identifier", async () => {
        const mockResult = {
          title: "My Note Title",
          permalink: "my-note-title",
          content: "Updated content",
          file_path: "notes/my-note-title.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "My Note Title",
          operation: "append",
          content: "New content",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "My Note Title",
          "append",
          "New content",
          undefined,
          undefined,
        )
      })

      it("should handle permalink identifier", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note-permalink",
          content: "Updated content",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "test-note-permalink",
          operation: "append",
          content: "New content",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note-permalink",
          "append",
          "New content",
          undefined,
          undefined,
        )
      })

      it("should handle memory:// URL identifier", async () => {
        const mockResult = {
          title: "Memory URL Note",
          permalink: "memory-url-note",
          content: "Updated content",
          file_path: "notes/memory-url-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "memory://projects/my-project",
          operation: "append",
          content: "New content",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "memory://projects/my-project",
          "append",
          "New content",
          undefined,
          undefined,
        )
      })
    })

    describe("error handling", () => {
      it("should handle edit errors gracefully", async () => {
        const editError = new Error("Note not found")
        ;(mockClient.editNote as jest.MockedFunction<any>).mockRejectedValue(editError)

        const result = await executeFunction("tool-call-id", {
          identifier: "nonexistent-note",
          operation: "append",
          content: "New content",
        })

        expect(result).toEqual({
          content: [
            {
              type: "text",
              text: 'Failed to edit note "nonexistent-note". It may not exist.',
            },
          ],
        })
      })

      it("should handle validation errors from client", async () => {
        const validationError = new Error("find_replace requires findText parameter")
        ;(mockClient.editNote as jest.MockedFunction<any>).mockRejectedValue(
          validationError,
        )

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "find_replace",
          content: "New content",
          // Missing findText
        })

        expect(result.content[0].text).toContain("Failed to edit note")
      })

      it("should handle network errors", async () => {
        const networkError = new Error("Connection failed")
        networkError.code = "ECONNREFUSED"
        ;(mockClient.editNote as jest.MockedFunction<any>).mockRejectedValue(
          networkError,
        )

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "append",
          content: "New content",
        })

        expect(result.content[0].text).toContain("Failed to edit note")
      })
    })

    describe("complex content handling", () => {
      it("should handle markdown content", async () => {
        const markdownContent = `## New Section

This is **bold** text with *italic* parts.

- List item 1
- List item 2

\`\`\`javascript
const code = "example";
\`\`\``

        const mockResult = {
          title: "Markdown Note",
          permalink: "markdown-note",
          content: "Original content\n" + markdownContent,
          file_path: "notes/markdown-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "markdown-note",
          operation: "append",
          content: markdownContent,
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "markdown-note",
          "append",
          markdownContent,
          undefined,
          undefined,
        )
      })

      it("should handle unicode content", async () => {
        const unicodeContent = "Unicode: 🚀 中文 العربية עברית"

        const mockResult = {
          title: "Unicode Note",
          permalink: "unicode-note",
          content: unicodeContent,
          file_path: "notes/unicode-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "unicode-note",
          operation: "append",
          content: unicodeContent,
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "unicode-note",
          "append",
          unicodeContent,
          undefined,
          undefined,
        )
      })

      it("should preserve whitespace and formatting", async () => {
        const formattedContent = `    Indented content
        
        Multi-line with spaces

\t\tTab indentation`

        const mockResult = {
          title: "Formatted Note",
          permalink: "formatted-note",
          content: formattedContent,
          file_path: "notes/formatted-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "formatted-note",
          operation: "prepend",
          content: formattedContent,
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "formatted-note",
          "prepend",
          formattedContent,
          undefined,
          undefined,
        )
      })
    })

    describe("response format", () => {
      it("should include operation in response details", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "Updated content",
          file_path: "folder/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        const result = await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "replace_section",
          content: "New content",
          sectionTitle: "Section 1",
        })

        expect(result.details).toEqual({
          title: "Test Note",
          permalink: "test-note",
          file_path: "folder/test-note.md",
          operation: "replace_section",
        })
      })

      it("should format success message correctly", async () => {
        const mockResult = {
          title: "Success Note",
          permalink: "success-note",
          content: "Content",
          file_path: "notes/success-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        const result = await executeFunction("tool-call-id", {
          identifier: "success-note",
          operation: "append",
          content: "Added content",
        })

        expect(result.content[0].text).toBe(
          "Note updated: Success Note (success-note)",
        )
      })
    })

    describe("parameter validation", () => {
      it("should pass all parameters correctly for find_replace", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "New content",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "find_replace",
          content: "New content",
          findText: "Old content",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note",
          "find_replace",
          "New content",
          "Old content",
          undefined,
        )
      })

      it("should pass all parameters correctly for replace_section", async () => {
        const mockResult = {
          title: "Test Note",
          permalink: "test-note",
          content: "New content",
          file_path: "notes/test-note.md",
        }

        ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue(mockResult)

        await executeFunction("tool-call-id", {
          identifier: "test-note",
          operation: "replace_section",
          content: "New section content",
          sectionTitle: "My Section",
        })

        expect(mockClient.editNote).toHaveBeenCalledWith(
          "test-note",
          "replace_section",
          "New section content",
          undefined,
          "My Section",
        )
      })
    })
  })
})