import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test"
import {
  _sendPayload,
  analyticsDisabled,
  EVENT_PLUGIN_INSTALLED,
  EVENT_PLUGIN_STARTED,
  EVENT_TOOL_CALL,
  resetTrackedTools,
  track,
  trackToolCall,
} from "./analytics.ts"

describe("analytics", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.BASIC_MEMORY_NO_PROMOS
    delete process.env.OPENCLAW_BASIC_MEMORY_TELEMETRY
    delete process.env.BASIC_MEMORY_UMAMI_HOST
    delete process.env.BASIC_MEMORY_UMAMI_SITE_ID
    resetTrackedTools()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe("analyticsDisabled", () => {
    it("returns false by default", () => {
      expect(analyticsDisabled()).toBe(false)
    })

    it('returns true when BASIC_MEMORY_NO_PROMOS is "1"', () => {
      process.env.BASIC_MEMORY_NO_PROMOS = "1"
      expect(analyticsDisabled()).toBe(true)
    })

    it('returns true when BASIC_MEMORY_NO_PROMOS is "true"', () => {
      process.env.BASIC_MEMORY_NO_PROMOS = "true"
      expect(analyticsDisabled()).toBe(true)
    })

    it('returns true when BASIC_MEMORY_NO_PROMOS is "yes"', () => {
      process.env.BASIC_MEMORY_NO_PROMOS = "yes"
      expect(analyticsDisabled()).toBe(true)
    })

    it("returns false for unrecognized values", () => {
      process.env.BASIC_MEMORY_NO_PROMOS = "0"
      expect(analyticsDisabled()).toBe(false)
    })

    it('returns true when OPENCLAW_BASIC_MEMORY_TELEMETRY is "0"', () => {
      process.env.OPENCLAW_BASIC_MEMORY_TELEMETRY = "0"
      expect(analyticsDisabled()).toBe(true)
    })

    it('returns true when OPENCLAW_BASIC_MEMORY_TELEMETRY is "false"', () => {
      process.env.OPENCLAW_BASIC_MEMORY_TELEMETRY = "false"
      expect(analyticsDisabled()).toBe(true)
    })

    it('returns true when OPENCLAW_BASIC_MEMORY_TELEMETRY is "no"', () => {
      process.env.OPENCLAW_BASIC_MEMORY_TELEMETRY = "no"
      expect(analyticsDisabled()).toBe(true)
    })

    it("plugin-specific var takes precedence over shared var", () => {
      process.env.OPENCLAW_BASIC_MEMORY_TELEMETRY = "0"
      process.env.BASIC_MEMORY_NO_PROMOS = "0"
      expect(analyticsDisabled()).toBe(true)
    })
  })

  describe("track", () => {
    it("does not send when disabled", () => {
      process.env.BASIC_MEMORY_NO_PROMOS = "1"
      const spy = jest.fn()
      // Replace global fetch temporarily
      const origFetch = globalThis.fetch
      globalThis.fetch = spy
      try {
        track("test-event")
        expect(spy).not.toHaveBeenCalled()
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("sends event when enabled", async () => {
      let capturedUrl: string | undefined
      let capturedBody: string | undefined

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
        capturedUrl = String(input)
        capturedBody = init?.body as string
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        track("test-event", { key: "value" })
        // Give the async send time to fire
        await new Promise((r) => setTimeout(r, 50))

        expect(capturedUrl).toBe("https://cloud.umami.is/api/send")
        const body = JSON.parse(capturedBody!)
        expect(body.payload.hostname).toBe("openclaw.basicmemory.com")
        expect(body.payload.url).toBe("/openclaw/test-event")
        expect(body.payload.name).toBe("test-event")
        expect(body.payload.website).toBe(
          "f6479898-ebaf-4e60-bce2-6dc60a3f6c5c",
        )
        expect(body.payload.data.key).toBe("value")
        expect(body.payload.data.version).toBeDefined()
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("uses custom host and site ID from env", async () => {
      process.env.BASIC_MEMORY_UMAMI_HOST = "https://custom.example.com"
      process.env.BASIC_MEMORY_UMAMI_SITE_ID = "custom-site-id"

      let capturedUrl: string | undefined
      let capturedBody: string | undefined

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
        capturedUrl = String(input)
        capturedBody = init?.body as string
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        track("test-event")
        await new Promise((r) => setTimeout(r, 50))

        expect(capturedUrl).toBe("https://custom.example.com/api/send")
        const body = JSON.parse(capturedBody!)
        expect(body.payload.website).toBe("custom-site-id")
      } finally {
        globalThis.fetch = origFetch
      }
    })
  })

  describe("trackToolCall", () => {
    it("sends event on first call for a tool", async () => {
      const calls: string[] = []

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        calls.push(JSON.parse(init?.body as string).payload.data.tool)
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        trackToolCall("search_notes")
        await new Promise((r) => setTimeout(r, 50))
        expect(calls).toEqual(["search_notes"])
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("deduplicates repeated calls for same tool", async () => {
      const calls: string[] = []

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        calls.push(JSON.parse(init?.body as string).payload.data.tool)
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        trackToolCall("search_notes")
        trackToolCall("search_notes")
        trackToolCall("search_notes")
        await new Promise((r) => setTimeout(r, 50))
        expect(calls).toEqual(["search_notes"])
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("tracks different tools separately", async () => {
      const calls: string[] = []

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        calls.push(JSON.parse(init?.body as string).payload.data.tool)
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        trackToolCall("search_notes")
        trackToolCall("read_note")
        await new Promise((r) => setTimeout(r, 50))
        expect(calls).toContain("search_notes")
        expect(calls).toContain("read_note")
        expect(calls).toHaveLength(2)
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("does not send when disabled", () => {
      process.env.BASIC_MEMORY_NO_PROMOS = "1"
      const spy = jest.fn()
      const origFetch = globalThis.fetch
      globalThis.fetch = spy
      try {
        trackToolCall("search_notes")
        expect(spy).not.toHaveBeenCalled()
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("resets after resetTrackedTools", async () => {
      const calls: string[] = []

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
        calls.push(JSON.parse(init?.body as string).payload.data.tool)
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        trackToolCall("search_notes")
        await new Promise((r) => setTimeout(r, 50))
        expect(calls).toHaveLength(1)

        resetTrackedTools()
        trackToolCall("search_notes")
        await new Promise((r) => setTimeout(r, 50))
        expect(calls).toHaveLength(2)
      } finally {
        globalThis.fetch = origFetch
      }
    })
  })

  describe("_sendPayload", () => {
    it("sends POST to host/api/send", async () => {
      let capturedUrl: string | undefined
      let capturedInit: RequestInit | undefined

      const origFetch = globalThis.fetch
      globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response("ok", { status: 200 })
      }) as typeof fetch

      try {
        await _sendPayload("https://test.example.com", {
          payload: { name: "test" },
        })

        expect(capturedUrl).toBe("https://test.example.com/api/send")
        expect(capturedInit?.method).toBe("POST")
        expect(capturedInit?.headers).toEqual(
          expect.objectContaining({ "Content-Type": "application/json" }),
        )
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it("does not throw on network failure", async () => {
      const origFetch = globalThis.fetch
      globalThis.fetch = (async () => {
        throw new Error("Network down")
      }) as typeof fetch

      try {
        // _sendPayload itself throws, but track() catches it
        await expect(_sendPayload("https://bad.host", {})).rejects.toThrow()
      } finally {
        globalThis.fetch = origFetch
      }
    })
  })

  describe("event constants", () => {
    it("are kebab-case strings starting with openclaw-", () => {
      for (const event of [
        EVENT_PLUGIN_INSTALLED,
        EVENT_PLUGIN_STARTED,
        EVENT_TOOL_CALL,
      ]) {
        expect(typeof event).toBe("string")
        expect(event).toBe(event.toLowerCase())
        expect(event).not.toContain(" ")
        expect(event.startsWith("openclaw-")).toBe(true)
      }
    })
  })
})
