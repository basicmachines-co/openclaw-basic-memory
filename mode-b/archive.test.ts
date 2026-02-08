import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { BmClient } from "../bm-client.ts"
import { indexConversation, indexFileIntoBm } from "./archive.ts"

describe("archive", () => {
  let mockClient: BmClient

  beforeEach(() => {
    mockClient = {
      writeNote: jest.fn(),
      editNote: jest.fn(),
    } as any
  })

  describe("indexFileIntoBm", () => {
    it("should index file with derived folder from file path", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/memory/my-note.md",
        "# My Note\n\nContent here",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "my-note",
        "# My Note\n\nContent here",
        "memory",
      )
    })

    it("should handle nested folder structure", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/projects/subfolder/project-note.md",
        "# Project Note\n\nProject details",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "project-note",
        "# Project Note\n\nProject details",
        "projects/subfolder",
      )
    })

    it("should handle root-level files", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/MEMORY.md",
        "# Root Memory\n\nRoot content",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "MEMORY",
        "# Root Memory\n\nRoot content",
        "memory",
      )
    })

    it("should handle file path without workspace path", async () => {
      await indexFileIntoBm(
        mockClient,
        "/some/path/memory/note.md",
        "# Note\n\nContent",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "note",
        "# Note\n\nContent",
        "memory",
      )
    })

    it("should derive folder name from parent directory when no workspace", async () => {
      await indexFileIntoBm(
        mockClient,
        "/different/docs/document.md",
        "# Document\n\nDoc content",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "document",
        "# Document\n\nDoc content",
        "docs",
      )
    })

    it("should use memory folder for files in root without clear parent", async () => {
      await indexFileIntoBm(mockClient, "/file.md", "# Root File\n\nContent")

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "file",
        "# Root File\n\nContent",
        "memory",
      )
    })

    it("should handle files with extensions other than .md", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/notes/document.txt",
        "Plain text content",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "document.txt",
        "Plain text content",
        "notes",
      )
    })

    it("should skip empty files", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/memory/empty.md",
        "",
        "/workspace",
      )

      expect(mockClient.writeNote).not.toHaveBeenCalled()
    })

    it("should skip files with only whitespace", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/memory/whitespace.md",
        "   \n\t   \n   ",
        "/workspace",
      )

      expect(mockClient.writeNote).not.toHaveBeenCalled()
    })

    it("should handle writeNote errors gracefully", async () => {
      const writeError = new Error("Failed to write note")
      ;(mockClient.writeNote as jest.MockedFunction<any>).mockRejectedValue(writeError)

      // Should not throw - the function catches errors internally
      await indexFileIntoBm(
        mockClient,
        "/workspace/memory/error.md", 
        "Content that will fail",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalled()
    })

    it("should handle unicode file names and content", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/memory/unicode-文档.md",
        "# Unicode Document 🚀\n\n中文内容",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "unicode-文档",
        "# Unicode Document 🚀\n\n中文内容",
        "memory",
      )
    })

    it("should preserve complex folder structures", async () => {
      await indexFileIntoBm(
        mockClient,
        "/workspace/projects/client-a/meetings/2025/february/notes.md",
        "Meeting notes",
        "/workspace",
      )

      expect(mockClient.writeNote).toHaveBeenCalledWith(
        "notes",
        "Meeting notes",
        "projects/client-a/meetings/2025/february",
      )
    })
  })

  describe("indexConversation", () => {
    it("should create new conversation note when none exists", async () => {
      const editError = new Error("Note doesn't exist")
      ;(mockClient.editNote as jest.MockedFunction<any>).mockRejectedValue(editError)
      ;(mockClient.writeNote as jest.MockedFunction<any>).mockResolvedValue({
        title: "conversations-2025-02-08",
        permalink: "conversations-2025-02-08",
        content: "",
        file_path: "conversations/conversations-2025-02-08.md",
      })

      await indexConversation(
        mockClient,
        "What is the weather today?",
        "I don't have access to real-time weather data.",
      )

      // Should try to append first
      expect(mockClient.editNote).toHaveBeenCalledWith(
        expect.stringMatching(/conversations-\d{4}-\d{2}-\d{2}/),
        "append",
        expect.stringContaining("**User:**"),
      )

      // Then create new note when append fails
      expect(mockClient.writeNote).toHaveBeenCalledWith(
        expect.stringMatching(/conversations-\d{4}-\d{2}-\d{2}/),
        expect.stringContaining("# Conversations"),
        "conversations",
      )
    })

    it("should append to existing conversation note", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({
        title: "conversations-2025-02-08",
        permalink: "conversations-2025-02-08",
        content: "existing content",
        file_path: "conversations/conversations-2025-02-08.md",
      })

      await indexConversation(
        mockClient,
        "How are you doing?",
        "I'm doing well, thank you for asking!",
      )

      expect(mockClient.editNote).toHaveBeenCalledWith(
        expect.stringMatching(/conversations-\d{4}-\d{2}-\d{2}/),
        "append",
        expect.stringContaining("**User:**"),
      )

      expect(mockClient.writeNote).not.toHaveBeenCalled()
    })

    it("should format conversation entry correctly", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({})

      await indexConversation(
        mockClient,
        "Tell me about TypeScript",
        "TypeScript is a typed superset of JavaScript.",
      )

      const call = (mockClient.editNote as jest.MockedFunction<any>).mock.calls[0]
      const entry = call[2]

      expect(entry).toContain("### ")  // Time heading
      expect(entry).toContain("**User:**")
      expect(entry).toContain("Tell me about TypeScript")
      expect(entry).toContain("**Assistant:**")
      expect(entry).toContain("TypeScript is a typed superset of JavaScript.")
      expect(entry).toContain("---")
    })

    it("should handle multiline messages", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({})

      const userMessage = `Can you help me with:
1. Setting up a project
2. Writing tests
3. Deploying the app`

      const assistantMessage = `I'd be happy to help with all three:

1. For project setup...
2. For testing...
3. For deployment...`

      await indexConversation(mockClient, userMessage, assistantMessage)

      const call = (mockClient.editNote as jest.MockedFunction<any>).mock.calls[0]
      const entry = call[2]

      expect(entry).toContain("**User:**")
      expect(entry).toContain(userMessage)
      expect(entry).toContain("**Assistant:**")
      expect(entry).toContain(assistantMessage)
    })

    it("should use date-based note titles", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({})

      await indexConversation(
        mockClient,
        "Test message",
        "Test response",
      )

      expect(mockClient.editNote).toHaveBeenCalledWith(
        expect.stringMatching(/conversations-\d{4}-\d{2}-\d{2}/),
        "append",
        expect.any(String),
      )
    })

    it("should handle edit and write errors gracefully", async () => {
      const editError = new Error("Edit failed")
      const writeError = new Error("Write failed")

      ;(mockClient.editNote as jest.MockedFunction<any>).mockRejectedValue(editError)
      ;(mockClient.writeNote as jest.MockedFunction<any>).mockRejectedValue(writeError)

      // Should not throw - the function catches errors internally
      await indexConversation(
        mockClient,
        "Error test message",
        "Error test response",
      )

      // Should have tried both operations despite errors
      expect(mockClient.editNote).toHaveBeenCalled()
      expect(mockClient.writeNote).toHaveBeenCalled()
    })

    it("should handle unicode content in conversations", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({})

      await indexConversation(
        mockClient,
        "Unicode question: 你好吗？🚀",
        "Unicode response: 我很好，谢谢！😊",
      )

      const call = (mockClient.editNote as jest.MockedFunction<any>).mock.calls[0]
      const entry = call[2]

      expect(entry).toContain("Unicode question: 你好吗？🚀")
      expect(entry).toContain("Unicode response: 我很好，谢谢！😊")
    })

    it("should handle very long messages", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({})

      const longUserMessage = "Long message: " + "a".repeat(1000)
      const longAssistantMessage = "Long response: " + "b".repeat(1500)

      await indexConversation(mockClient, longUserMessage, longAssistantMessage)

      const call = (mockClient.editNote as jest.MockedFunction<any>).mock.calls[0]
      const entry = call[2]

      expect(entry).toContain(longUserMessage)
      expect(entry).toContain(longAssistantMessage)
    })

    it("should create new note with proper format when append fails", async () => {
      const editError = new Error("Note not found")
      ;(mockClient.editNote as jest.MockedFunction<any>).mockRejectedValue(editError)
      ;(mockClient.writeNote as jest.MockedFunction<any>).mockResolvedValue({})

      await indexConversation(
        mockClient,
        "New conversation",
        "First response",
      )

      const writeCall = (mockClient.writeNote as jest.MockedFunction<any>).mock.calls[0]
      const [title, content, folder] = writeCall

      expect(title).toMatch(/conversations-\d{4}-\d{2}-\d{2}/)
      expect(folder).toBe("conversations")
      expect(content).toContain("# Conversations")
      expect(content).toContain("### ") // Time heading
      expect(content).toContain("**User:**")
      expect(content).toContain("New conversation")
      expect(content).toContain("**Assistant:**")
      expect(content).toContain("First response")
    })

    it("should preserve markdown formatting in conversation content", async () => {
      ;(mockClient.editNote as jest.MockedFunction<any>).mockResolvedValue({})

      const userMessage = `Can you help with:
- **Bold item**
- *Italic item*
- \`code item\`

And explain \`code snippets\`?`

      const assistantMessage = `Sure! Here's the explanation:

## Main Points

1. **Bold** text is for emphasis
2. *Italic* text is for mild emphasis  
3. \`Code\` is for technical terms

\`\`\`javascript
const example = "code block";
\`\`\``

      await indexConversation(mockClient, userMessage, assistantMessage)

      const call = (mockClient.editNote as jest.MockedFunction<any>).mock.calls[0]
      const entry = call[2]

      expect(entry).toContain(userMessage)
      expect(entry).toContain(assistantMessage)
    })
  })

  describe("folder derivation", () => {
    it("should correctly derive folder from file path and workspace", () => {
      const testCases = [
        {
          filePath: "/workspace/memory/note.md",
          workspacePath: "/workspace",
          expected: "memory"
        },
        {
          filePath: "/workspace/projects/subfolder/note.md", 
          workspacePath: "/workspace",
          expected: "projects/subfolder"
        },
        {
          filePath: "/workspace/MEMORY.md",
          workspacePath: "/workspace",
          expected: "memory"  // Root files go to memory folder
        },
        {
          filePath: "/some/path/docs/note.md",
          workspacePath: undefined,
          expected: "docs"  // Use parent directory name
        },
        {
          filePath: "/note.md",
          workspacePath: undefined,
          expected: "memory"  // Root without clear parent
        }
      ]

      testCases.forEach(({ filePath, workspacePath, expected }) => {
        // Test the derivation logic
        let result: string
        if (workspacePath) {
          const relative = require("path").relative(workspacePath, filePath)
          const dir = require("path").dirname(relative)
          result = dir === "." ? "memory" : dir
        } else {
          const dir = require("path").dirname(filePath)
          const dirName = require("path").basename(dir)
          result = (dirName === "." || dirName === "") ? "memory" : dirName
        }
        
        expect(result).toBe(expected)
      })
    })
  })
})