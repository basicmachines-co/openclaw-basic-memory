import { homedir, hostname } from "node:os"

export type PluginMode = "archive" | "agent-memory" | "both"

export type BasicMemoryConfig = {
  mode: PluginMode
  project: string
  bmPath: string
  watchPaths: string[]
  indexInterval: number
  projectPath: string
  autoCapture: boolean
  debug: boolean
}

const ALLOWED_KEYS = [
  "mode",
  "project",
  "bmPath",
  "watchPaths",
  "indexInterval",
  "projectPath",
  "autoCapture",
  "debug",
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

export function parseConfig(raw: unknown): BasicMemoryConfig {
  const cfg =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  if (Object.keys(cfg).length > 0) {
    assertAllowedKeys(cfg, ALLOWED_KEYS, "basic-memory config")
  }

  const mode = cfg.mode as string | undefined
  if (
    mode &&
    mode !== "archive" &&
    mode !== "agent-memory" &&
    mode !== "both"
  ) {
    throw new Error(
      `basic-memory: invalid mode "${mode}" — must be "archive", "agent-memory", or "both"`,
    )
  }

  return {
    mode: (mode as PluginMode) ?? "archive",
    project:
      typeof cfg.project === "string" && cfg.project.length > 0
        ? cfg.project
        : defaultProject(),
    projectPath:
      typeof cfg.projectPath === "string" && cfg.projectPath.length > 0
        ? cfg.projectPath
        : `${homedir()}/.basic-memory/openclaw/`,
    bmPath:
      typeof cfg.bmPath === "string" && cfg.bmPath.length > 0
        ? cfg.bmPath
        : "bm",
    watchPaths: Array.isArray(cfg.watchPaths)
      ? (cfg.watchPaths as string[])
      : ["memory/", "MEMORY.md"],
    indexInterval: typeof cfg.indexInterval === "number" ? cfg.indexInterval : 300,
    autoCapture: typeof cfg.autoCapture === "boolean" ? cfg.autoCapture : true,
    debug: typeof cfg.debug === "boolean" ? cfg.debug : false,
  }
}

export const basicMemoryConfigSchema = {
  parse: parseConfig,
}
