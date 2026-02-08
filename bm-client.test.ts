import { beforeEach, describe, expect, it, jest } from "bun:test"
import { execFile } from "node:child_process"
import { BmClient } from "./bm-client.ts"

// Mock execFile
jest.mock("node:child_process", () => ({
  execFile: jest.fn(),
}))

const mockExecFile = execFile as jest.MockedFunction<typeof execFile>

describe("BmClient", () => {
  let client: BmClient

  beforeEach(() => {
    client = new BmClient("/usr/local/bin/bm", "test-project")
    mockExecFile.mockClear()
  })

  describe("constructor", () => {
    it("should create a client with provided parameters", () => {
      expect(client.getProject()).toBe("test-project")
    })
  })

  describe("ensureProject", () => {
    it("should call bm project add with project path", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: "", stderr: "" })
      })

      await client.ensureProject("/path/to/project")

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        ["project", "add", "test-project", "/path/to/project"],
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should silently ignore errors (project already exists)", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(new Error("Project already exists"))
      })

      await expect(client.ensureProject("/path/to/project")).resolves.not.toThrow()
    })
  })

  describe("search", () => {
    it("should search for notes and return results", async () => {
      const mockResults = {
        results: [
          {
            title: "Test Note",
            permalink: "test-note",
            content: "This is a test note content",
            score: 0.95,
            file_path: "notes/test-note.md",
          },
        ],
      }

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockResults), stderr: "" })
      })

      const results = await client.search("test query", 5)

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        [
          "tool",
          "search-notes",
          "test query",
          "--page-size",
          "5",
          "--project",
          "test-project",
          "--local",
        ],
        expect.any(Object),
        expect.any(Function),
      )

      expect(results).toEqual(mockResults.results)
    })

    it("should use default limit when not provided", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify({ results: [] }), stderr: "" })
      })

      await client.search("test query")

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining(["--page-size", "10"]),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should handle JSON with prefix lines", async () => {
      const mockOutput = `
Warning: something happened
[2025-02-08] Info: Starting search
{"results": [{"title": "Test", "permalink": "test", "content": "content", "file_path": "test.md"}]}
`

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: mockOutput, stderr: "" })
      })

      const results = await client.search("test")
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe("Test")
    })

    it("should throw error on invalid JSON", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: "invalid json", stderr: "" })
      })

      await expect(client.search("test")).rejects.toThrow("Could not parse JSON")
    })

    it("should throw error on command failure", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(new Error("Command failed"))
      })

      await expect(client.search("test")).rejects.toThrow("bm command failed")
    })
  })

  describe("readNote", () => {
    it("should read a note and strip frontmatter", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note",
        content: "---\ntitle: Test Note\ndate: 2025-02-08\n---\n\nThis is the actual content",
        file_path: "notes/test-note.md",
      }

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockNote), stderr: "" })
      })

      const result = await client.readNote("test-note")

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        [
          "tool",
          "read-note",
          "test-note",
          "--project",
          "test-project",
          "--local",
          "--format",
          "json",
        ],
        expect.any(Object),
        expect.any(Function),
      )

      expect(result.content).toBe("This is the actual content")
      expect(result.title).toBe("Test Note")
    })

    it("should handle content without frontmatter", async () => {
      const mockNote = {
        title: "Test Note",
        permalink: "test-note",
        content: "Just regular content without frontmatter",
        file_path: "notes/test-note.md",
      }

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockNote), stderr: "" })
      })

      const result = await client.readNote("test-note")
      expect(result.content).toBe("Just regular content without frontmatter")
    })
  })

  describe("writeNote", () => {
    it("should write a note with title, content, and folder", async () => {
      const mockResult = {
        title: "New Note",
        permalink: "new-note",
        content: "New content",
        file_path: "folder/new-note.md",
      }

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockResult), stderr: "" })
      })

      const result = await client.writeNote("New Note", "New content", "folder")

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        [
          "tool",
          "write-note",
          "--title",
          "New Note",
          "--folder",
          "folder",
          "--content",
          "New content",
          "--project",
          "test-project",
          "--local",
          "--format",
          "json",
        ],
        expect.any(Object),
        expect.any(Function),
      )

      expect(result).toEqual(mockResult)
    })
  })

  describe("buildContext", () => {
    it("should build context for a memory URL", async () => {
      const mockContext = {
        results: [
          {
            primary_result: {
              title: "Test Note",
              permalink: "test-note",
              content: "Content",
              file_path: "notes/test-note.md",
            },
            observations: [
              { category: "decision", content: "Important decision made" },
            ],
            related_results: [
              {
                title: "Related Note",
                permalink: "related-note",
                relation_type: "references",
              },
            ],
          },
        ],
      }

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockContext), stderr: "" })
      })

      const result = await client.buildContext("memory://test/path", 2)

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        [
          "tool",
          "build-context",
          "memory://test/path",
          "--depth",
          "2",
          "--project",
          "test-project",
          "--local",
        ],
        expect.any(Object),
        expect.any(Function),
      )

      expect(result).toEqual(mockContext)
    })

    it("should use default depth when not provided", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify({ results: [] }), stderr: "" })
      })

      await client.buildContext("memory://test/path")

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining(["--depth", "1"]),
        expect.any(Object),
        expect.any(Function),
      )
    })
  })

  describe("recentActivity", () => {
    it("should get recent activity with timeframe", async () => {
      const mockActivity = [
        {
          title: "Recent Note",
          permalink: "recent-note",
          file_path: "notes/recent-note.md",
          created_at: "2025-02-08T12:00:00Z",
        },
      ]

      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockActivity), stderr: "" })
      })

      const result = await client.recentActivity("7d")

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        [
          "tool",
          "recent-activity",
          "--timeframe",
          "7d",
          "--project",
          "test-project",
          "--local",
          "--format",
          "json",
        ],
        expect.any(Object),
        expect.any(Function),
      )

      expect(result).toEqual(mockActivity)
    })

    it("should use default timeframe when not provided", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, { stdout: JSON.stringify([]), stderr: "" })
      })

      await client.recentActivity()

      expect(mockExecFile).toHaveBeenCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining(["--timeframe", "24h"]),
        expect.any(Object),
        expect.any(Function),
      )
    })
  })

  describe("editNote", () => {
    const mockExistingNote = {
      title: "Existing Note",
      permalink: "existing-note",
      content: "# Heading 1\nSome content\n\n## Section 1\nSection content\n\n## Section 2\nOther content",
      file_path: "notes/existing-note.md",
    }

    beforeEach(() => {
      // Mock readNote for editNote tests
      mockExecFile
        .mockImplementationOnce((cmd, args, opts, callback) => {
          // First call - readNote
          callback(null, { stdout: JSON.stringify(mockExistingNote), stderr: "" })
        })
        .mockImplementationOnce((cmd, args, opts, callback) => {
          // Second call - writeNote
          callback(null, { stdout: JSON.stringify(mockExistingNote), stderr: "" })
        })
    })

    it("should append content to note", async () => {
      await client.editNote("existing-note", "append", "\nNew appended content")

      expect(mockExecFile).toHaveBeenCalledTimes(2)
      // Check that writeNote was called with appended content
      expect(mockExecFile).toHaveBeenLastCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining([
          "--content",
          expect.stringContaining("New appended content"),
        ]),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should prepend content to note", async () => {
      await client.editNote("existing-note", "prepend", "New prepended content\n")

      expect(mockExecFile).toHaveBeenCalledTimes(2)
      expect(mockExecFile).toHaveBeenLastCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining([
          "--content",
          expect.stringMatching(/^New prepended content\n/),
        ]),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should replace text with find_replace", async () => {
      await client.editNote(
        "existing-note",
        "find_replace",
        "Updated content",
        "Some content",
      )

      expect(mockExecFile).toHaveBeenCalledTimes(2)
      expect(mockExecFile).toHaveBeenLastCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining([
          "--content",
          expect.stringContaining("Updated content"),
        ]),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should throw error if findText not found", async () => {
      await expect(
        client.editNote(
          "existing-note",
          "find_replace",
          "New content",
          "Non-existent text",
        ),
      ).rejects.toThrow("findText not found in note")
    })

    it("should throw error if findText not provided for find_replace", async () => {
      await expect(
        client.editNote("existing-note", "find_replace", "New content"),
      ).rejects.toThrow("find_replace requires findText parameter")
    })

    it("should replace section content", async () => {
      await client.editNote(
        "existing-note",
        "replace_section",
        "New section content",
        undefined,
        "Section 1",
      )

      expect(mockExecFile).toHaveBeenCalledTimes(2)
      expect(mockExecFile).toHaveBeenLastCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining([
          "--content",
          expect.stringContaining("New section content"),
        ]),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should throw error if section not found", async () => {
      await expect(
        client.editNote(
          "existing-note",
          "replace_section",
          "New content",
          undefined,
          "Non-existent Section",
        ),
      ).rejects.toThrow('Section "Non-existent Section" not found in note')
    })

    it("should throw error if sectionTitle not provided for replace_section", async () => {
      await expect(
        client.editNote("existing-note", "replace_section", "New content"),
      ).rejects.toThrow("replace_section requires sectionTitle parameter")
    })

    it("should extract folder from file path correctly", async () => {
      const noteWithNestedPath = {
        ...mockExistingNote,
        file_path: "folder/subfolder/note.md",
      }

      mockExecFile.mockClear()
      mockExecFile
        .mockImplementationOnce((cmd, args, opts, callback) => {
          callback(null, { stdout: JSON.stringify(noteWithNestedPath), stderr: "" })
        })
        .mockImplementationOnce((cmd, args, opts, callback) => {
          callback(null, { stdout: JSON.stringify(noteWithNestedPath), stderr: "" })
        })

      await client.editNote("existing-note", "append", "New content")

      // Check that writeNote was called with correct folder
      expect(mockExecFile).toHaveBeenLastCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining(["--folder", "folder/subfolder"]),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it("should handle root-level files", async () => {
      const rootNote = {
        ...mockExistingNote,
        file_path: "note.md",
      }

      mockExecFile.mockClear()
      mockExecFile
        .mockImplementationOnce((cmd, args, opts, callback) => {
          callback(null, { stdout: JSON.stringify(rootNote), stderr: "" })
        })
        .mockImplementationOnce((cmd, args, opts, callback) => {
          callback(null, { stdout: JSON.stringify(rootNote), stderr: "" })
        })

      await client.editNote("existing-note", "append", "New content")

      // Check that writeNote was called with empty folder
      expect(mockExecFile).toHaveBeenLastCalledWith(
        "/usr/local/bin/bm",
        expect.arrayContaining(["--folder", ""]),
        expect.any(Object),
        expect.any(Function),
      )
    })
  })

  describe("error handling", () => {
    it("should handle command timeout", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        const error = new Error("Command timeout")
        error.code = "TIMEOUT"
        callback(error)
      })

      await expect(client.search("test")).rejects.toThrow("bm command failed")
    })

    it("should handle large output buffer", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        expect(opts.maxBuffer).toBe(10 * 1024 * 1024) // 10MB
        callback(null, { stdout: "ok", stderr: "" })
      })

      await client.search("test")
    })

    it("should set appropriate timeout", async () => {
      mockExecFile.mockImplementation((cmd, args, opts, callback) => {
        expect(opts.timeout).toBe(30_000) // 30 seconds
        callback(null, { stdout: JSON.stringify({ results: [] }), stderr: "" })
      })

      await client.search("test")
    })
  })
})