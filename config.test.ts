import { describe, expect, it } from "bun:test"
import { homedir } from "node:os"
import { parseConfig, resolveProjectPath } from "./config.ts"

describe("config", () => {
  describe("parseConfig", () => {
    it("should return default config for empty input", () => {
      const config = parseConfig(undefined)

      expect(config.bmPath).toBe("bm")
      expect(config.memoryDir).toBe("memory/")
      expect(config.memoryFile).toBe("MEMORY.md")
      expect(config.autoCapture).toBe(true)
      expect(config.debug).toBe(false)
      expect(config.project).toMatch(/^openclaw-/)
      expect(config.projectPath).toBe("memory/")
      expect(config.cloud).toBeUndefined()
    })

    it("should return default config for null input", () => {
      const config = parseConfig(null)
      expect(config.memoryDir).toBe("memory/")
    })

    it("should return default config for non-object input", () => {
      expect(parseConfig("string").memoryDir).toBe("memory/")
      expect(parseConfig(123).memoryDir).toBe("memory/")
      expect(parseConfig([]).memoryDir).toBe("memory/")
    })

    it("should use provided project name", () => {
      const config = parseConfig({ project: "my-custom-project" })
      expect(config.project).toBe("my-custom-project")
    })

    it("should use default project for empty string", () => {
      const config = parseConfig({ project: "" })
      expect(config.project).toMatch(/^openclaw-/)
    })

    it("should use provided bmPath", () => {
      const config = parseConfig({ bmPath: "/custom/path/to/bm" })
      expect(config.bmPath).toBe("/custom/path/to/bm")
    })

    it("should use provided memoryDir", () => {
      const config = parseConfig({ memoryDir: "notes/" })
      expect(config.memoryDir).toBe("notes/")
    })

    it("should support snake_case memory_dir", () => {
      const config = parseConfig({ memory_dir: "notes/" })
      expect(config.memoryDir).toBe("notes/")
    })

    it("should use provided memoryFile", () => {
      const config = parseConfig({ memoryFile: "MY_MEMORY.md" })
      expect(config.memoryFile).toBe("MY_MEMORY.md")
    })

    it("should support snake_case memory_file", () => {
      const config = parseConfig({ memory_file: "MY_MEMORY.md" })
      expect(config.memoryFile).toBe("MY_MEMORY.md")
    })

    it("should use provided projectPath", () => {
      const config = parseConfig({ projectPath: "/custom/project/path" })
      expect(config.projectPath).toBe("/custom/project/path")
    })

    it("should default projectPath to memoryDir", () => {
      const config = parseConfig({ memoryDir: "notes/" })
      expect(config.projectPath).toBe("notes/")
    })

    it("should use provided autoCapture", () => {
      expect(parseConfig({ autoCapture: false }).autoCapture).toBe(false)
      expect(parseConfig({ autoCapture: true }).autoCapture).toBe(true)
    })

    it("should use provided debug flag", () => {
      expect(parseConfig({ debug: true }).debug).toBe(true)
      expect(parseConfig({ debug: false }).debug).toBe(false)
    })

    it("should parse cloud config", () => {
      const config = parseConfig({
        cloud: {
          url: "https://cloud.basicmemory.com",
          api_key: "test-key",
        },
      })
      expect(config.cloud).toEqual({
        url: "https://cloud.basicmemory.com",
        api_key: "test-key",
      })
    })

    it("should ignore invalid cloud config", () => {
      expect(parseConfig({ cloud: "not-object" }).cloud).toBeUndefined()
      expect(parseConfig({ cloud: { url: "x" } }).cloud).toBeUndefined()
      expect(parseConfig({ cloud: null }).cloud).toBeUndefined()
    })

    it("should throw error for unknown config keys", () => {
      expect(() => parseConfig({ unknownKey: "value" })).toThrow(
        "basic-memory config has unknown keys: unknownKey",
      )
    })

    it("should handle complete config object", () => {
      const config = parseConfig({
        project: "test-project",
        bmPath: "/usr/bin/bm",
        memoryDir: "notes/",
        memoryFile: "NOTES.md",
        projectPath: "/tmp/test-project",
        autoCapture: false,
        debug: true,
        cloud: { url: "https://example.com", api_key: "key" },
      })

      expect(config.project).toBe("test-project")
      expect(config.memoryDir).toBe("notes/")
      expect(config.memoryFile).toBe("NOTES.md")
      expect(config.cloud?.url).toBe("https://example.com")
    })

    it("should not throw for empty config", () => {
      expect(() => parseConfig({})).not.toThrow()
    })
  })

  describe("resolveProjectPath", () => {
    it("resolves relative projectPath against workspace", () => {
      expect(resolveProjectPath("memory/", "/tmp/workspace")).toBe(
        "/tmp/workspace/memory",
      )
    })

    it("expands tilde paths", () => {
      expect(resolveProjectPath("~/memory", "/tmp/workspace")).toBe(
        `${homedir()}/memory`,
      )
    })

    it("keeps absolute paths unchanged", () => {
      expect(resolveProjectPath("/var/data/memory", "/tmp/workspace")).toBe(
        "/var/data/memory",
      )
    })
  })
})
