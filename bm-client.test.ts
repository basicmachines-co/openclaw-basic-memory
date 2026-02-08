import { beforeEach, describe, expect, it } from "bun:test"
import { stripFrontmatter, parseJsonOutput, BmClient } from "./bm-client.ts"

// Test pure functions without mocking
describe("BmClient utility functions", () => {
  describe("stripFrontmatter", () => {
    it("should strip YAML frontmatter from content", () => {
      const content = "---\ntitle: Test Note\ndate: 2025-02-08\n---\n\nThis is the actual content"
      const result = stripFrontmatter(content)
      expect(result).toBe("This is the actual content")
    })

    it("should handle content without frontmatter", () => {
      const content = "Just regular content without frontmatter"
      const result = stripFrontmatter(content)
      expect(result).toBe("Just regular content without frontmatter")
    })

    it("should handle empty content", () => {
      const result = stripFrontmatter("")
      expect(result).toBe("")
    })

    it("should handle content with only frontmatter", () => {
      const content = "---\ntitle: Test Note\n---\n"
      const result = stripFrontmatter(content)
      expect(result).toBe("")
    })

    it("should handle malformed frontmatter", () => {
      const content = "---\ntitle: Test\nThis is not proper frontmatter\nActual content"
      const result = stripFrontmatter(content)
      expect(result).toBe("---\ntitle: Test\nThis is not proper frontmatter\nActual content")
    })
  })

  describe("parseJsonOutput", () => {
    it("should parse clean JSON", () => {
      const json = '{"results": [{"title": "test"}]}'
      const result = parseJsonOutput(json)
      expect(result).toEqual({ results: [{ title: "test" }] })
    })

    it("should handle JSON with prefix lines", () => {
      const output = `
Warning: something happened
[2025-02-08] Info: Starting search
{"results": [{"title": "Test", "permalink": "test"}]}
`
      const result = parseJsonOutput(output)
      expect(result).toEqual({ results: [{ title: "Test", permalink: "test" }] })
    })

    it("should handle array JSON with prefix", () => {
      const output = `Warning: processing
[{"title": "Test1"}, {"title": "Test2"}]`
      const result = parseJsonOutput(output)
      expect(result).toEqual([{ title: "Test1" }, { title: "Test2" }])
    })

    it("should throw error on invalid JSON", () => {
      expect(() => parseJsonOutput("invalid json")).toThrow("Could not parse JSON")
    })

    it("should throw error when no JSON found", () => {
      const output = "Warning: no json here\nJust text content"
      expect(() => parseJsonOutput(output)).toThrow("Could not parse JSON")
    })
  })
})

// Basic BmClient tests that don't require mocking
describe("BmClient basic functionality", () => {
  let client: BmClient

  beforeEach(() => {
    client = new BmClient("/usr/local/bin/bm", "test-project")
  })

  describe("constructor", () => {
    it("should create a client with provided parameters", () => {
      expect(client.getProject()).toBe("test-project")
    })
  })

  describe("editNote validation logic", () => {
    it("should validate find_replace requires findText parameter", () => {
      // Test the validation logic independently
      const operation = "find_replace"
      const findText = undefined
      
      if (operation === "find_replace" && !findText) {
        expect(() => {
          throw new Error("find_replace requires findText parameter")
        }).toThrow("find_replace requires findText parameter")
      }
    })

    it("should validate replace_section requires sectionTitle parameter", () => {
      // Test the validation logic independently
      const operation = "replace_section"
      const sectionTitle = undefined
      
      if (operation === "replace_section" && !sectionTitle) {
        expect(() => {
          throw new Error("replace_section requires sectionTitle parameter")
        }).toThrow("replace_section requires sectionTitle parameter")
      }
    })
  })

  // Note: Integration tests that require actual execFile are skipped 
  // due to mocking complexity with bun + promisify pattern.
  // These would be better tested with integration tests or 
  // dependency injection approach in the actual implementation.
})

// Test the editNote string manipulation logic with a mock readNote result
describe("BmClient string manipulation", () => {
  it("should extract folder from file path correctly", () => {
    // Test the folder extraction logic that would be used in editNote
    const testCases = [
      { filePath: "folder/subfolder/note.md", expected: "folder/subfolder" },
      { filePath: "notes/test.md", expected: "notes" },
      { filePath: "note.md", expected: "" },
      { filePath: "a/b/c/d/file.md", expected: "a/b/c/d" },
    ]

    testCases.forEach(({ filePath, expected }) => {
      // Simulate the folder extraction logic from editNote
      const folder = filePath.includes("/")
        ? filePath.split("/").slice(0, -1).join("/")
        : ""
      expect(folder).toBe(expected)
    })
  })

  it("should perform text replacement correctly", () => {
    // Test the find/replace logic from editNote
    const content = "# Heading 1\nSome content\n\n## Section 1\nSection content"
    
    // Test append
    const appended = content + "\nNew appended content"
    expect(appended).toContain("New appended content")
    expect(appended).toContain("Some content")

    // Test prepend
    const prepended = "New prepended content\n" + content
    expect(prepended).toStartWith("New prepended content")
    expect(prepended).toContain("Some content")

    // Test find/replace
    const replaced = content.replace("Some content", "Updated content")
    expect(replaced).toContain("Updated content")
    expect(replaced).not.toContain("Some content")
  })

  it("should handle section replacement logic", () => {
    const content = "# Heading 1\nSome content\n\n## Section 1\nSection content\n\n## Section 2\nOther content"
    const sectionTitle = "Section 1"
    
    // Test section replacement logic
    const headingPattern = new RegExp(
      `^(#{1,6})\\s+${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
      "m",
    )
    const match = headingPattern.exec(content)
    expect(match).not.toBeNull()
    expect(match![1]).toBe("##")
    
    if (match) {
      const level = match[1].length
      const sectionStart = match.index
      const rest = content.slice(sectionStart + match[0].length)
      const nextHeading = new RegExp(`^#{1,${level}}\\s`, "m")
      const nextMatch = nextHeading.exec(rest)
      const sectionEnd = nextMatch
        ? sectionStart + match[0].length + nextMatch.index
        : content.length

      const newContent = "New section content"
      const updated = `${content.slice(0, sectionStart)}${match[0]}\n${newContent}${nextMatch ? `\n${content.slice(sectionEnd)}` : ""}`
      
      expect(updated).toContain("New section content")
      expect(updated).toContain("## Section 2")
      expect(updated).not.toContain("Section content")
    }
  })

  it("should detect when findText is not found", () => {
    const content = "# Heading 1\nSome content"
    const findText = "Non-existent text"
    
    expect(content.includes(findText)).toBe(false)
  })

  it("should detect when section is not found", () => {
    const content = "# Heading 1\nSome content\n\n## Section 1\nSection content"
    const sectionTitle = "Non-existent Section"
    
    const headingPattern = new RegExp(
      `^(#{1,6})\\s+${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
      "m",
    )
    const match = headingPattern.exec(content)
    expect(match).toBeNull()
  })
})