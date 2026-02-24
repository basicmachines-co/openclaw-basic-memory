import { homedir, hostname } from "node:os"
import { isAbsolute, resolve } from "node:path"

export type CloudConfig = {
  url: string
  api_key: string
}

export type DashboardConfig = {
  enabled: boolean
  port: number
}

export type BasicMemoryConfig = {
  project: string
  bmPath: string
  memoryDir: string
  memoryFile: string
  projectPath: string
  autoCapture: boolean
  captureMinChars: number
  autoRecall: boolean
  recallPrompt: string
  debug: boolean
  cloud?: CloudConfig
  dashboard: DashboardConfig
}

const ALLOWED_KEYS = [
  "project",
  "bmPath",
  "memoryDir",
  "memory_dir",
  "memoryFile",
  "memory_file",
  "projectPath",
  "autoCapture",
  "captureMinChars",
  "capture_min_chars",
  "autoRecall",
  "auto_recall",
  "recallPrompt",
  "recall_prompt",
  "debug",
  "cloud",
  "dashboard",
]

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  const unknown = Object.keys(value).filter((k) => !allowed.includes(k))
  if (unknown.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`)
  }
}

function defaultProject(): string {
  return `openclaw-${hostname()
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase()}`
}

function expandUserPath(path: string): string {
  if (path === "~") return homedir()
  if (path.startsWith("~/")) return `${homedir()}/${path.slice(2)}`
  return path
}

export function resolveProjectPath(
  projectPath: string,
  workspaceDir: string,
): string {
  const expanded = expandUserPath(projectPath)
  if (isAbsolute(expanded)) return expanded
  return resolve(workspaceDir, expanded)
}

export function parseConfig(raw: unknown): BasicMemoryConfig {
  const cfg =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  if (Object.keys(cfg).length > 0) {
    assertAllowedKeys(cfg, ALLOWED_KEYS, "basic-memory config")
  }

  // Support both camelCase and snake_case for memory_dir / memory_file
  const memoryDir =
    typeof cfg.memoryDir === "string" && cfg.memoryDir.length > 0
      ? cfg.memoryDir
      : typeof cfg.memory_dir === "string" &&
          (cfg.memory_dir as string).length > 0
        ? (cfg.memory_dir as string)
        : "memory/"

  const memoryFile =
    typeof cfg.memoryFile === "string" && cfg.memoryFile.length > 0
      ? cfg.memoryFile
      : typeof cfg.memory_file === "string" &&
          (cfg.memory_file as string).length > 0
        ? (cfg.memory_file as string)
        : "MEMORY.md"

  let cloud: CloudConfig | undefined
  if (cfg.cloud && typeof cfg.cloud === "object" && !Array.isArray(cfg.cloud)) {
    const c = cfg.cloud as Record<string, unknown>
    if (typeof c.url === "string" && typeof c.api_key === "string") {
      cloud = { url: c.url, api_key: c.api_key }
    }
  }

  let dashboard: DashboardConfig = { enabled: false, port: 3838 }
  if (
    cfg.dashboard &&
    typeof cfg.dashboard === "object" &&
    !Array.isArray(cfg.dashboard)
  ) {
    const d = cfg.dashboard as Record<string, unknown>
    dashboard = {
      enabled: typeof d.enabled === "boolean" ? d.enabled : false,
      port:
        typeof d.port === "number" && d.port > 0 && d.port < 65536
          ? d.port
          : 3838,
    }
  }

  return {
    project:
      typeof cfg.project === "string" && cfg.project.length > 0
        ? cfg.project
        : defaultProject(),
    projectPath:
      typeof cfg.projectPath === "string" && cfg.projectPath.length > 0
        ? cfg.projectPath
        : memoryDir,
    bmPath:
      typeof cfg.bmPath === "string" && cfg.bmPath.length > 0
        ? cfg.bmPath
        : "bm",
    memoryDir,
    memoryFile,
    autoCapture: typeof cfg.autoCapture === "boolean" ? cfg.autoCapture : true,
    captureMinChars:
      typeof cfg.captureMinChars === "number" && cfg.captureMinChars >= 0
        ? cfg.captureMinChars
        : typeof cfg.capture_min_chars === "number" &&
            (cfg.capture_min_chars as number) >= 0
          ? (cfg.capture_min_chars as number)
          : 10,
    autoRecall:
      typeof cfg.autoRecall === "boolean"
        ? cfg.autoRecall
        : typeof cfg.auto_recall === "boolean"
          ? (cfg.auto_recall as boolean)
          : true,
    recallPrompt:
      typeof cfg.recallPrompt === "string" && cfg.recallPrompt.length > 0
        ? cfg.recallPrompt
        : typeof cfg.recall_prompt === "string" &&
            (cfg.recall_prompt as string).length > 0
          ? (cfg.recall_prompt as string)
          : "Check for active tasks and recent activity. Summarize anything relevant to the current session.",
    debug: typeof cfg.debug === "boolean" ? cfg.debug : false,
    cloud,
    dashboard,
  }
}

export const basicMemoryConfigSchema = {
  parse: parseConfig,
}
