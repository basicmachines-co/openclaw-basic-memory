import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { BmClient } from "../bm-client.ts"
import type { BasicMemoryConfig } from "../config.ts"
import { buildCaptureHandler } from "./capture.ts"

// Mock the archive module
jest.mock("../mode-b/archive.ts", () => ({
  indexConversation: jest.fn(),
}))

import { indexConversation } from "../mode-b/archive.ts"

const mockIndexConversation = indexConversation as jest.MockedFunction<
  typeof indexConversation
>

describe("capture hook", () => {
  let mockClient: BmClient
  let mockConfig: BasicMemoryConfig

  beforeEach(() => {
    mockClient = {} as BmClient
    mockConfig = {
      mode: "archive",
      project: "test-project",
      bmPath: "/usr/bin/bm",
      watchPaths: ["memory/"],
      indexInterval: 300,
      projectPath: "/tmp/test",
      autoCapture: true,
      debug: false,
    }

    mockIndexConversation.mockClear()
    mockIndexConversation.mockResolvedValue(undefined)
  })

  describe("buildCaptureHandler", () => {
    it("should return a function", () => {
      const handler = buildCaptureHandler(mockClient, mockConfig)
      expect(typeof handler).toBe("function")
    })
  })

  describe("capture handler execution", () => {
    let captureHandler: Function

    beforeEach(() => {
      captureHandler = buildCaptureHandler(mockClient, mockConfig)
    })

    it("should ignore events without success", async () => {
      const event = {
        success: false,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should ignore events without messages", async () => {
      const event = {
        success: true,
        // No messages property
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should ignore events with non-array messages", async () => {
      const event = {
        success: true,
        messages: "not an array",
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should ignore events with empty messages", async () => {
      const event = {
        success: true,
        messages: [],
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should extract and index user-assistant conversation", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          { role: "user", content: "What is the weather like?" },
          {
            role: "assistant",
            content: "I don't have access to real-time weather data.",
          },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "What is the weather like?",
        "I don't have access to real-time weather data.",
      )
    })

    it("should find last user message when multiple users exist", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          { role: "user", content: "First question" },
          { role: "assistant", content: "First answer" },
          { role: "user", content: "Second question" },
          { role: "assistant", content: "Second answer" },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "Second question",
        "Second answer",
      )
    })

    it("should handle structured content blocks", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Please explain" },
              { type: "text", text: " how this works" },
            ],
          },
          {
            role: "assistant",
            content: [
              { type: "text", text: "Here's how it works:" },
              { type: "text", text: " step by step explanation" },
            ],
          },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "Please explain\n how this works",
        "Here's how it works:\n step by step explanation",
      )
    })

    it("should handle mixed string and array content", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          { role: "user", content: "Simple string message" },
          {
            role: "assistant",
            content: [{ type: "text", text: "Array response" }],
          },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "Simple string message",
        "Array response",
      )
    })

    it("should ignore non-text content blocks", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Text content" },
              { type: "image", url: "image.jpg" },
              { type: "text", text: " more text" },
            ],
          },
          {
            role: "assistant",
            content: [
              { type: "text", text: "Response text" },
              { type: "file", path: "file.pdf" },
            ],
          },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "Text content\n more text",
        "Response text",
      )
    })

    it("should handle content blocks without text property", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Valid text" },
              { type: "text" }, // Missing text property
              { type: "text", text: "More valid text" },
            ],
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "Response" }],
          },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "Valid text\nMore valid text",
        "Response",
      )
    })

    it("should skip conversations that are too short", async () => {
      const event1 = {
        success: true,
        messages: [
          { role: "user", content: "Hi" }, // 2 chars
          { role: "assistant", content: "Hello" }, // 5 chars
        ],
      }

      const event2 = {
        success: true,
        messages: [
          { role: "user", content: "Ok" }, // 2 chars
          { role: "assistant", content: "Sure" }, // 4 chars
        ],
      }

      await captureHandler(event1)
      await captureHandler(event2)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should process conversation when at least one message is long enough", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          { role: "user", content: "This is a longer user message" },
          { role: "assistant", content: "Ok" }, // Short response
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "This is a longer user message",
        "Ok",
      )
    })

    it("should handle messages without role property", async () => {
      const event = {
        success: true,
        messages: [
          { content: "Message without role" },
          { role: "user", content: "User message" },
          { role: "assistant", content: "Assistant response" },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "User message",
        "Assistant response",
      )
    })

    it("should handle system messages between user and assistant", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          { role: "user", content: "User question" },
          { role: "system", content: "System message" },
          { role: "assistant", content: "Assistant answer" },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "User question",
        "Assistant answer",
      )
    })

    it("should handle indexConversation errors gracefully", async () => {
      const indexError = new Error("Failed to index conversation")
      mockIndexConversation.mockRejectedValue(indexError)

      const event = {
        success: true,
        messages: [
          { role: "user", content: "This should cause an error" },
          { role: "assistant", content: "This response will fail to index" },
        ],
      }

      // Should not throw - the function catches errors internally
      await captureHandler(event)
    })

    it("should handle empty content arrays", async () => {
      const event = {
        success: true,
        messages: [
          { role: "user", content: [] },
          { role: "assistant", content: [] },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should handle null/undefined content", async () => {
      const event = {
        success: true,
        messages: [
          { role: "user", content: null },
          { role: "assistant", content: undefined },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should extract text from complex nested structures", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "First part " },
              { type: "text", text: "second part " },
              { type: "text", text: "third part" },
            ],
          },
          {
            role: "assistant",
            content: [
              { type: "text", text: "Response part one " },
              { type: "text", text: "response part two" },
            ],
          },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "First part \nsecond part \nthird part",
        "Response part one \nresponse part two",
      )
    })

    it("should handle conversation with only user message", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [{ role: "user", content: "This is a long user message but no assistant response" }],
      }

      await captureHandler(event)

      // Current behavior: indexes even with empty assistant text 
      // (this might be a design decision to capture incomplete conversations)
      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "This is a long user message but no assistant response",
        "",
      )
    })

    it("should handle conversation with only assistant message", async () => {
      const event = {
        success: true,
        messages: [{ role: "assistant", content: "This is a long assistant message" }],
      }

      await captureHandler(event)

      expect(mockIndexConversation).not.toHaveBeenCalled()
    })

    it("should find user message even when not immediately before assistant", async () => {
      mockIndexConversation.mockResolvedValue(undefined)

      const event = {
        success: true,
        messages: [
          { role: "system", content: "System setup" },
          { role: "user", content: "Early user message" },
          { role: "user", content: "Latest user message" },
          { role: "system", content: "System note" },
          { role: "assistant", content: "Assistant response" },
        ],
      }

      await captureHandler(event)

      expect(mockIndexConversation).toHaveBeenCalledWith(
        mockClient,
        "Latest user message",
        "Assistant response",
      )
    })
  })
})