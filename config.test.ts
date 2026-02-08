import { beforeEach, describe, expect, it } from "bun:test"
import { parseConfig } from "./config.ts"

describe("config", () => {
  describe("parseConfig", () => {
    it("should return default config for empty input", () => {
      const config = parseConfig(undefined)

      expect(config.mode).toBe("archive")
      expect(config.bmPath).toBe("bm")
      expect(config.watchPaths).toEqual(["memory/", "MEMORY.md"])
      expect(config.indexInterval).toBe(300)
      expect(config.autoCapture).toBe(true)
      expect(config.debug).toBe(false)
      expect(config.project).toMatch(/^openclaw-/) // hostname-based default
      expect(config.projectPath).toMatch(/\.basic-memory\/openclaw\//)
    })

    it("should return default config for null input", () => {
      const config = parseConfig(null)
      expect(config.mode).toBe("archive")
    })

    it("should return default config for non-object input", () => {
      const config = parseConfig("string")
      expect(config.mode).toBe("archive")

      const config2 = parseConfig(123)
      expect(config2.mode).toBe("archive")

      const config3 = parseConfig([])
      expect(config3.mode).toBe("archive")
    })

    it("should use provided mode values", () => {
      const config1 = parseConfig({ mode: "agent-memory" })
      expect(config1.mode).toBe("agent-memory")

      const config2 = parseConfig({ mode: "both" })
      expect(config2.mode).toBe("both")

      const config3 = parseConfig({ mode: "archive" })
      expect(config3.mode).toBe("archive")
    })

    it("should throw error for invalid mode", () => {
      expect(() => parseConfig({ mode: "invalid" })).toThrow(
        'invalid mode "invalid" — must be "archive", "agent-memory", or "both"',
      )
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

    it("should use default bmPath for empty string", () => {
      const config = parseConfig({ bmPath: "" })
      expect(config.bmPath).toBe("bm")
    })

    it("should use provided projectPath", () => {
      const config = parseConfig({ projectPath: "/custom/project/path" })
      expect(config.projectPath).toBe("/custom/project/path")
    })

    it("should use default projectPath for empty string", () => {
      const config = parseConfig({ projectPath: "" })
      expect(config.projectPath).toMatch(/\.basic-memory\/openclaw\//)
    })

    it("should use provided watchPaths array", () => {
      const watchPaths = ["custom/", "file.md", "other/"]
      const config = parseConfig({ watchPaths })
      expect(config.watchPaths).toEqual(watchPaths)
    })

    it("should use default watchPaths for non-array", () => {
      const config1 = parseConfig({ watchPaths: "not-array" })
      expect(config1.watchPaths).toEqual(["memory/", "MEMORY.md"])

      const config2 = parseConfig({ watchPaths: null })
      expect(config2.watchPaths).toEqual(["memory/", "MEMORY.md"])
    })

    it("should use provided indexInterval", () => {
      const config = parseConfig({ indexInterval: 600 })
      expect(config.indexInterval).toBe(600)
    })

    it("should use default indexInterval for non-number", () => {
      const config1 = parseConfig({ indexInterval: "not-number" })
      expect(config1.indexInterval).toBe(300)

      const config2 = parseConfig({ indexInterval: null })
      expect(config2.indexInterval).toBe(300)
    })

    it("should use provided autoCapture", () => {
      const config1 = parseConfig({ autoCapture: false })
      expect(config1.autoCapture).toBe(false)

      const config2 = parseConfig({ autoCapture: true })
      expect(config2.autoCapture).toBe(true)
    })

    it("should use default autoCapture for non-boolean", () => {
      const config1 = parseConfig({ autoCapture: "not-boolean" })
      expect(config1.autoCapture).toBe(true)

      const config2 = parseConfig({ autoCapture: null })
      expect(config2.autoCapture).toBe(true)
    })

    it("should use provided debug flag", () => {
      const config1 = parseConfig({ debug: true })
      expect(config1.debug).toBe(true)

      const config2 = parseConfig({ debug: false })
      expect(config2.debug).toBe(false)
    })

    it("should use default debug for non-boolean", () => {
      const config1 = parseConfig({ debug: "not-boolean" })
      expect(config1.debug).toBe(false)

      const config2 = parseConfig({ debug: null })
      expect(config2.debug).toBe(false)
    })

    it("should handle complete config object", () => {
      const inputConfig = {
        mode: "both" as const,
        project: "test-project",
        bmPath: "/usr/bin/bm",
        watchPaths: ["notes/", "docs/"],
        indexInterval: 120,
        projectPath: "/tmp/test-project",
        autoCapture: false,
        debug: true,
      }

      const config = parseConfig(inputConfig)

      expect(config).toEqual(inputConfig)
    })

    it("should throw error for unknown config keys", () => {
      expect(() =>
        parseConfig({
          mode: "archive",
          unknownKey: "value",
        }),
      ).toThrow("basic-memory config has unknown keys: unknownKey")
    })

    it("should throw error for multiple unknown config keys", () => {
      expect(() =>
        parseConfig({
          mode: "archive",
          unknownKey1: "value1",
          unknownKey2: "value2",
        }),
      ).toThrow("basic-memory config has unknown keys: unknownKey1, unknownKey2")
    })

    it("should not validate keys when config is empty", () => {
      // This should not throw even though we're calling assertAllowedKeys
      expect(() => parseConfig({})).not.toThrow()
    })

    it("should handle project name with special characters", () => {
      // Test that hostname sanitization works correctly
      const config = parseConfig({})
      expect(config.project).toMatch(/^openclaw-[a-z0-9-]+$/)
    })

    it("should handle edge cases for string validation", () => {
      // Test empty strings vs undefined
      const config = parseConfig({
        project: "",
        bmPath: "",
        projectPath: "",
      })

      expect(config.project).toMatch(/^openclaw-/) // Falls back to default
      expect(config.bmPath).toBe("bm") // Falls back to default
      expect(config.projectPath).toMatch(/\.basic-memory/) // Falls back to default
    })

    it("should preserve type safety for mode values", () => {
      // This tests that TypeScript types are preserved
      const config = parseConfig({ mode: "agent-memory" })
      const mode: "archive" | "agent-memory" | "both" = config.mode
      expect(mode).toBe("agent-memory")
    })
  })

  describe("basicMemoryConfigSchema", () => {
    it("should have a parse method", () => {
      expect(typeof parseConfig).toBe("function")
    })
  })
})