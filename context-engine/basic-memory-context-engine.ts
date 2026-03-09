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
export const MAX_ASSEMBLE_RECALL_CHARS = 1200
const TRUNCATED_RECALL_SUFFIX = "\n\n[Basic Memory recall truncated]"
const SUBAGENT_HANDOFF_FOLDER = "agent/subagents"
const MAX_SUBAGENT_RECALL_CHARS = 800

interface SessionMemoryState {
  recallContext: string
}

interface SubagentHandoffState {
  noteIdentifier: string
  noteTitle: string
  parentSessionKey: string
}

function boundRecallContext(context: string): string {
  if (context.length <= MAX_ASSEMBLE_RECALL_CHARS) {
    return context
  }

  const trimmed = context
    .slice(
      0,
      Math.max(0, MAX_ASSEMBLE_RECALL_CHARS - TRUNCATED_RECALL_SUFFIX.length),
    )
    .trimEnd()

  return `${trimmed}${TRUNCATED_RECALL_SUFFIX}`
}

function slugifySessionKey(sessionKey: string): string {
  return sessionKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function buildSubagentNoteTitle(childSessionKey: string): string {
  return `subagent-handoff-${slugifySessionKey(childSessionKey)}`
}

function buildSubagentHandoffContent(params: {
  parentSessionKey: string
  childSessionKey: string
  recallContext?: string
}): string {
  const sections = [
    "# Subagent Handoff",
    "",
    "## Sessions",
    `- Parent: ${params.parentSessionKey}`,
    `- Child: ${params.childSessionKey}`,
    "",
    "## Lifecycle",
    `- Spawned: ${new Date().toISOString()}`,
  ]

  if (params.recallContext) {
    sections.push(
      "",
      "## Parent Basic Memory Context",
      params.recallContext.slice(0, MAX_SUBAGENT_RECALL_CHARS).trimEnd(),
    )
  }

  return sections.join("\n")
}

function buildSubagentCompletionUpdate(params: {
  childSessionKey: string
  reason: "deleted" | "completed" | "swept" | "released"
}): string {
  const statusLine =
    params.reason === "completed"
      ? "Child run completed. Durable conversation capture continues through the normal afterTurn path."
      : `Child run ended with reason: ${params.reason}.`

  return [
    "",
    "## Completion",
    `- Child: ${params.childSessionKey}`,
    `- Ended: ${new Date().toISOString()}`,
    `- Reason: ${params.reason}`,
    "",
    statusLine,
  ].join("\n")
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
  private readonly subagentState = new Map<string, SubagentHandoffState>()
  private legacyContextEnginePromise: Promise<
    InstanceType<LegacyContextEngineModule["LegacyContextEngine"]>
  > | null = null

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
        recallContext: boundRecallContext(recall.context),
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
    const state = this.sessionState.get(params.sessionId)

    return {
      messages: params.messages,
      estimatedTokens: 0,
      systemPromptAddition: state?.recallContext,
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

  async prepareSubagentSpawn(params: {
    parentSessionKey: string
    childSessionKey: string
    ttlMs?: number
  }): Promise<{ rollback: () => Promise<void> } | undefined> {
    const parentState = this.sessionState.get(params.parentSessionKey)
    const noteTitle = buildSubagentNoteTitle(params.childSessionKey)

    try {
      const note = await this.client.writeNote(
        noteTitle,
        buildSubagentHandoffContent({
          parentSessionKey: params.parentSessionKey,
          childSessionKey: params.childSessionKey,
          recallContext: parentState?.recallContext,
        }),
        SUBAGENT_HANDOFF_FOLDER,
      )

      this.subagentState.set(params.childSessionKey, {
        noteIdentifier: note.permalink,
        noteTitle: note.title,
        parentSessionKey: params.parentSessionKey,
      })

      return {
        rollback: async () => {
          const handoff = this.subagentState.get(params.childSessionKey)
          this.subagentState.delete(params.childSessionKey)
          if (!handoff) return

          try {
            await this.client.deleteNote(handoff.noteIdentifier)
          } catch (err) {
            log.error("context-engine subagent rollback failed", err)
          }
        },
      }
    } catch (err) {
      log.error("context-engine prepareSubagentSpawn failed", err)
      return undefined
    }
  }

  async onSubagentEnded(params: {
    childSessionKey: string
    reason: "deleted" | "completed" | "swept" | "released"
  }): Promise<void> {
    const handoff = this.subagentState.get(params.childSessionKey)
    if (!handoff) return

    this.subagentState.delete(params.childSessionKey)

    try {
      await this.client.editNote(
        handoff.noteIdentifier,
        "append",
        buildSubagentCompletionUpdate(params),
      )
    } catch (err) {
      log.error("context-engine onSubagentEnded failed", err)
    }
  }

  async dispose(): Promise<void> {
    this.sessionState.clear()
    this.subagentState.clear()
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
