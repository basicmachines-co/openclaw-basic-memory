import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { AgentMessage } from "@mariozechner/pi-agent-core"
import type {
  AssembleResult,
  BootstrapResult,
  CompactResult,
  ContextEngine,
} from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import type { BasicMemoryConfig } from "../config.ts"
import { selectCaptureTurn } from "../hooks/capture.ts"
import { loadRecallState } from "../hooks/recall.ts"
import { log } from "../logger.ts"

const require = createRequire(import.meta.url)

interface SessionMemoryState {
  recallContext: string
}

type LegacyContextEngineModule = {
  LegacyContextEngine: new () => {
    compact(params: {
      sessionId: string
      sessionFile: string
      tokenBudget?: number
      force?: boolean
      currentTokenCount?: number
      compactionTarget?: "budget" | "threshold"
      customInstructions?: string
      runtimeContext?: Record<string, unknown>
    }): Promise<CompactResult>
  }
}

async function loadLegacyContextEngine(): Promise<
  LegacyContextEngineModule["LegacyContextEngine"]
> {
  const pluginSdkPath = require.resolve("openclaw/plugin-sdk")
  const legacyPath = resolve(
    dirname(pluginSdkPath),
    "context-engine",
    "legacy.js",
  )
  const module = (await import(
    pathToFileURL(legacyPath).href
  )) as LegacyContextEngineModule
  return module.LegacyContextEngine
}

export class BasicMemoryContextEngine implements ContextEngine {
  readonly info = {
    id: "openclaw-basic-memory",
    name: "Basic Memory Context Engine",
    version: "0.1.5",
    ownsCompaction: false,
  } as const

  private readonly sessionState = new Map<string, SessionMemoryState>()
  private legacyContextEnginePromise:
    | Promise<InstanceType<LegacyContextEngineModule["LegacyContextEngine"]>>
    | null = null

  constructor(
    private readonly client: BmClient,
    private readonly cfg: BasicMemoryConfig,
  ) {}

  async bootstrap(params: {
    sessionId: string
    sessionFile: string
  }): Promise<BootstrapResult> {
    if (!this.cfg.autoRecall) {
      this.sessionState.delete(params.sessionId)
      return { bootstrapped: false, reason: "autoRecall disabled" }
    }

    try {
      const recall = await loadRecallState(this.client, this.cfg)
      if (!recall) {
        this.sessionState.delete(params.sessionId)
        return { bootstrapped: false, reason: "no recall context found" }
      }

      this.sessionState.set(params.sessionId, {
        recallContext: recall.context,
      })

      log.debug(
        `context-engine bootstrap: session=${params.sessionId} tasks=${recall.tasks.length} recent=${recall.recent.length}`,
      )

      return { bootstrapped: true }
    } catch (err) {
      this.sessionState.delete(params.sessionId)
      log.error("context-engine bootstrap failed", err)
      return { bootstrapped: false, reason: "recall failed" }
    }
  }

  async ingest(): Promise<{ ingested: boolean }> {
    return { ingested: false }
  }

  async assemble(params: {
    sessionId: string
    messages: AgentMessage[]
    tokenBudget?: number
  }): Promise<AssembleResult> {
    return {
      messages: params.messages,
      estimatedTokens: 0,
    }
  }

  async afterTurn(params: {
    sessionId: string
    sessionFile: string
    messages: AgentMessage[]
    prePromptMessageCount: number
    autoCompactionSummary?: string
    isHeartbeat?: boolean
    tokenBudget?: number
    runtimeContext?: Record<string, unknown>
  }): Promise<void> {
    if (!this.cfg.autoCapture) return

    const newMessages = params.messages.slice(params.prePromptMessageCount)
    const turn =
      selectCaptureTurn(newMessages, this.cfg.captureMinChars) ??
      selectCaptureTurn(params.messages, this.cfg.captureMinChars)

    if (!turn) return

    log.debug(
      `context-engine afterTurn: session=${params.sessionId} user=${turn.userText.length} assistant=${turn.assistantText.length}`,
    )

    try {
      await this.client.indexConversation(turn.userText, turn.assistantText)
    } catch (err) {
      log.error("context-engine capture failed", err)
    }
  }

  async compact(params: {
    sessionId: string
    sessionFile: string
    tokenBudget?: number
    force?: boolean
    currentTokenCount?: number
    compactionTarget?: "budget" | "threshold"
    customInstructions?: string
    runtimeContext?: Record<string, unknown>
  }): Promise<CompactResult> {
    const legacy = await this.getLegacyContextEngine()
    return legacy.compact(params)
  }

  async dispose(): Promise<void> {
    this.sessionState.clear()
  }

  private async getLegacyContextEngine(): Promise<
    InstanceType<LegacyContextEngineModule["LegacyContextEngine"]>
  > {
    if (!this.legacyContextEnginePromise) {
      this.legacyContextEnginePromise = loadLegacyContextEngine().then(
        (LegacyContextEngine) => new LegacyContextEngine(),
      )
    }

    return this.legacyContextEnginePromise
  }
}
