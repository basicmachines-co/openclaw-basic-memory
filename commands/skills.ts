import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = resolve(__dirname, "..", "skills")

function loadSkill(dir: string): string {
  return readFileSync(resolve(SKILLS_DIR, dir, "SKILL.md"), "utf-8")
}

const SKILLS = [
  { name: "tasks", dir: "memory-tasks", desc: "Task management workflow" },
  {
    name: "reflect",
    dir: "memory-reflect",
    desc: "Memory reflection workflow",
  },
  { name: "defrag", dir: "memory-defrag", desc: "Memory defrag workflow" },
  { name: "schema", dir: "memory-schema", desc: "Schema management workflow" },
  {
    name: "notes",
    dir: "memory-notes",
    desc: "How to write well-structured notes",
  },
  {
    name: "metadata-search",
    dir: "memory-metadata-search",
    desc: "Structured metadata search workflow",
  },
] as const

export function registerSkillCommands(api: OpenClawPluginApi): void {
  for (const skill of SKILLS) {
    const content = loadSkill(skill.dir)

    api.registerCommand({
      name: skill.name,
      description: skill.desc,
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
