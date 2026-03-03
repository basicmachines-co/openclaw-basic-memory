import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = resolve(__dirname, "..", "skills")
const MANIFEST_PATH = resolve(SKILLS_DIR, "manifest.json")

interface ManifestEntry {
  dir: string
  name: string
  description: string
}

function loadManifest(): ManifestEntry[] {
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf-8")
    return JSON.parse(raw) as ManifestEntry[]
  } catch {
    throw new Error(
      "skills/manifest.json not found. Run `bun scripts/fetch-skills.ts` first.",
    )
  }
}

function loadSkill(dir: string): string {
  return readFileSync(resolve(SKILLS_DIR, dir, "SKILL.md"), "utf-8")
}

export function registerSkillCommands(api: OpenClawPluginApi): void {
  const manifest = loadManifest()

  for (const entry of manifest) {
    const commandName = entry.dir.replace(/^memory-/, "")
    const content = loadSkill(entry.dir)

    api.registerCommand({
      name: commandName,
      description: entry.description,
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx: { args?: string }) => {
        const args = ctx.args?.trim()
        const prefix = args
          ? `User request: ${args}\n\nFollow this workflow:\n\n`
          : "Follow this workflow:\n\n"
        return { text: prefix + content }
      },
    })
  }
}
