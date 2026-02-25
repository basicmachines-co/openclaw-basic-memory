/**
 * Lightweight analytics via Umami event collector.
 *
 * Sends anonymous, non-blocking usage events to help understand plugin adoption
 * and tool usage patterns. No PII, no fingerprinting, no cookies.
 *
 * Events are fire-and-forget — analytics never blocks or breaks the plugin.
 *
 * Defaults point to the Basic Memory Umami Cloud instance. Override via:
 *   BASIC_MEMORY_UMAMI_HOST     — Custom Umami instance URL
 *   BASIC_MEMORY_UMAMI_SITE_ID  — Custom Website ID
 * Opt out entirely with OPENCLAW_BASIC_MEMORY_TELEMETRY=0 or BASIC_MEMORY_NO_PROMOS=1.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_UMAMI_HOST = "https://cloud.umami.is"
const DEFAULT_UMAMI_SITE_ID = "f6479898-ebaf-4e60-bce2-6dc60a3f6c5c"
const SEND_TIMEOUT_MS = 3000

function umamiHost(): string {
  return process.env.BASIC_MEMORY_UMAMI_HOST?.trim() || DEFAULT_UMAMI_HOST
}

function umamiSiteId(): string {
  return process.env.BASIC_MEMORY_UMAMI_SITE_ID?.trim() || DEFAULT_UMAMI_SITE_ID
}

export function analyticsDisabled(): boolean {
  // Plugin-specific opt-out
  const telemetry = (process.env.OPENCLAW_BASIC_MEMORY_TELEMETRY ?? "")
    .trim()
    .toLowerCase()
  if (telemetry === "0" || telemetry === "false" || telemetry === "no") {
    return true
  }

  // Shared Basic Memory opt-out (also disables BM CLI analytics)
  const noPromos = (process.env.BASIC_MEMORY_NO_PROMOS ?? "")
    .trim()
    .toLowerCase()
  return noPromos === "1" || noPromos === "true" || noPromos === "yes"
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

let _cachedVersion: string | null = null

function getVersion(): string {
  if (_cachedVersion) return _cachedVersion
  try {
    const pkg = JSON.parse(
      readFileSync(
        join(import.meta.dirname ?? __dirname, "package.json"),
        "utf-8",
      ),
    )
    _cachedVersion = pkg.version ?? "unknown"
  } catch {
    _cachedVersion = "unknown"
  }
  return _cachedVersion ?? "unknown"
}

// ---------------------------------------------------------------------------
// Session-scoped dedup for tool calls
// ---------------------------------------------------------------------------

const _trackedTools = new Set<string>()

export function resetTrackedTools(): void {
  _trackedTools.clear()
}

// ---------------------------------------------------------------------------
// Event constants
// ---------------------------------------------------------------------------

export const EVENT_PLUGIN_INSTALLED = "openclaw-plugin-installed"
export const EVENT_PLUGIN_STARTED = "openclaw-plugin-started"
export const EVENT_TOOL_CALL = "openclaw-tool-call"

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an analytics event to Umami. Non-blocking, silent on failure.
 *
 * @param eventName - Short kebab-case name (e.g. "openclaw-plugin-started")
 * @param data - Optional dict of event properties (string/number values)
 */
export function track(
  eventName: string,
  data?: Record<string, string | number>,
): void {
  if (analyticsDisabled()) return

  const host = umamiHost()
  const siteId = umamiSiteId()

  const payload = {
    payload: {
      hostname: "openclaw.basicmemory.com",
      language: "en",
      url: `/openclaw/${eventName}`,
      website: siteId,
      name: eventName,
      data: {
        version: getVersion(),
        ...(data ?? {}),
      },
    },
  }

  // Fire-and-forget — never block the plugin
  _sendPayload(host, payload).catch(() => {})
}

/**
 * Track a tool call, deduped per tool name per session.
 * Only the first invocation of each tool sends an event.
 */
export function trackToolCall(toolName: string): void {
  if (analyticsDisabled()) return
  if (_trackedTools.has(toolName)) return
  _trackedTools.add(toolName)
  track(EVENT_TOOL_CALL, { tool: toolName })
}

// ---------------------------------------------------------------------------
// Internal send (exported for testing)
// ---------------------------------------------------------------------------

export async function _sendPayload(
  host: string,
  payload: unknown,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

  try {
    await fetch(`${host}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `openclaw-basic-memory/${getVersion()}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}
