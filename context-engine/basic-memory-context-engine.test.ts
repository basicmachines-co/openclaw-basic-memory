import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { AgentMessage } from "@mariozechner/pi-agent-core"
import type { BmClient } from "../bm-client.ts"
import type { BasicMemoryConfig } from "../config.ts"
import { BasicMemoryContextEngine } from "./basic-memory-context-engine.ts"

function makeConfig(
  overrides?: Partial<BasicMemoryConfig>,
): BasicMemoryConfig {
  return {
    project: "test-project",
    bmPath: "bm",
    memoryDir: "memory/",
    memoryFile: "MEMORY.md",
    projectPath: "/tmp/test-project",
    autoCapture: true,
    captureMinChars: 10,
    autoRecall: true,
    recallPrompt:
      "Check for active tasks and recent activity. Summarize anything relevant to the current session.",
    debug: false,
    ...overrides,
  }
}

function makeMessages(messages: Array<Record<string, unknown>>): AgentMessage[] {
  return messages as AgentMessage[]
}

describe("BasicMemoryContextEngine", () => {
  let mockClient: {
    search: jest.Mock
    recentActivity: jest.Mock
    indexConversation: jest.Mock
  }

  beforeEach(() => {
    mockClient = {
      search: jest.fn().mockResolvedValue([
        {
          title: "Fix auth rollout",
          permalink: "fix-auth-rollout",
          content: "Continue staging verification for auth rollout.",
          file_path: "memory/tasks/fix-auth-rollout.md",
        },
      ]),
      recentActivity: jest.fn().mockResolvedValue([
        {
          title: "API review",
          permalink: "api-review",
          file_path: "memory/api-review.md",
          created_at: "2026-03-09T12:00:00Z",
        },
      ]),
      indexConversation: jest.fn().mockResolvedValue(undefined),
    }
  })

  it("bootstraps recall state from active tasks and recent activity", async () => {
    const engine = new BasicMemoryContextEngine(
      mockClient as unknown as BmClient,
      makeConfig(),
    )

    await expect(
      engine.bootstrap({
        sessionId: "session-1",
        sessionFile: "/tmp/session-1.jsonl",
      }),
    ).resolves.toEqual({ bootstrapped: true })
    expect(mockClient.search).toHaveBeenCalledWith(undefined, 5, undefined, {
      note_types: ["Task"],
      status: "active",
    })
    expect(mockClient.recentActivity).toHaveBeenCalledWith("1d")
  })

  it("skips bootstrap when recall is disabled", async () => {
    const engine = new BasicMemoryContextEngine(
      mockClient as unknown as BmClient,
      makeConfig({ autoRecall: false }),
    )

    await expect(
      engine.bootstrap({
        sessionId: "session-2",
        sessionFile: "/tmp/session-2.jsonl",
      }),
    ).resolves.toEqual({
      bootstrapped: false,
      reason: "autoRecall disabled",
    })

    const result = await engine.assemble({
      sessionId: "session-2",
      messages: makeMessages([{ role: "user", content: "hello" }]),
    })

    expect(result).toEqual({
      messages: makeMessages([{ role: "user", content: "hello" }]),
      estimatedTokens: 0,
    })
  })

  it("returns a no-op bootstrap result when there is no recall context", async () => {
    mockClient.search.mockResolvedValue([])
    mockClient.recentActivity.mockResolvedValue([])

    const engine = new BasicMemoryContextEngine(
      mockClient as unknown as BmClient,
      makeConfig(),
    )

    await expect(
      engine.bootstrap({
        sessionId: "session-3",
        sessionFile: "/tmp/session-3.jsonl",
      }),
    ).resolves.toEqual({
      bootstrapped: false,
      reason: "no recall context found",
    })
  })

  it("captures only the current turn after prePromptMessageCount", async () => {
    const engine = new BasicMemoryContextEngine(
      mockClient as unknown as BmClient,
      makeConfig(),
    )

    await engine.afterTurn({
      sessionId: "session-4",
      sessionFile: "/tmp/session-4.jsonl",
      prePromptMessageCount: 2,
      messages: makeMessages([
        { role: "user", content: "Old question" },
        { role: "assistant", content: "Old answer" },
        { role: "user", content: "Current question with enough detail" },
        { role: "assistant", content: "Current answer with enough detail" },
      ]),
    })

    expect(mockClient.indexConversation).toHaveBeenCalledWith(
      "Current question with enough detail",
      "Current answer with enough detail",
    )
  })

  it("respects captureMinChars for afterTurn capture", async () => {
    const engine = new BasicMemoryContextEngine(
      mockClient as unknown as BmClient,
      makeConfig({ captureMinChars: 50 }),
    )

    await engine.afterTurn({
      sessionId: "session-5",
      sessionFile: "/tmp/session-5.jsonl",
      prePromptMessageCount: 0,
      messages: makeMessages([
        { role: "user", content: "short" },
        { role: "assistant", content: "tiny" },
      ]),
    })

    expect(mockClient.indexConversation).not.toHaveBeenCalled()
  })

  it("swallows capture failures in afterTurn", async () => {
    mockClient.indexConversation.mockRejectedValue(new Error("BM down"))
    const engine = new BasicMemoryContextEngine(
      mockClient as unknown as BmClient,
      makeConfig(),
    )

    await expect(
      engine.afterTurn({
        sessionId: "session-6",
        sessionFile: "/tmp/session-6.jsonl",
        prePromptMessageCount: 0,
        messages: makeMessages([
          { role: "user", content: "Current question with enough detail" },
          { role: "assistant", content: "Current answer with enough detail" },
        ]),
      }),
    ).resolves.toBeUndefined()
  })
})
