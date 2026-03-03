/**
 * Fetch all memory-* skills from basicmachines-co/basic-memory-skills.
 *
 * Auto-discovers skill directories via GitHub Contents API, downloads each
 * SKILL.md, writes to skills/<dir>/SKILL.md, and generates skills/manifest.json.
 *
 * Env vars:
 *   GITHUB_TOKEN   — optional, avoids 60 req/hr unauthenticated rate limit
 *   SKILLS_BRANCH  — branch to fetch from (default: "main")
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = resolve(__dirname, "..", "skills")

const REPO = "basicmachines-co/basic-memory-skills"
const BRANCH = process.env.SKILLS_BRANCH ?? "main"
const TOKEN = process.env.GITHUB_TOKEN

interface GitHubEntry {
  name: string
  type: "file" | "dir"
}

interface SkillManifestEntry {
  dir: string
  name: string
  description: string
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "openclaw-basic-memory/fetch-skills",
  }
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`
  return h
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  }
  return res.text()
}

function parseFrontmatter(md: string): { name: string; description: string } {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error("SKILL.md missing YAML frontmatter")

  const yaml = match[1]
  const name = yaml
    .match(/^name:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "")
  const description = yaml
    .match(/^description:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "")

  if (!name) throw new Error("Frontmatter missing 'name'")
  if (!description) throw new Error("Frontmatter missing 'description'")

  return { name, description }
}

async function main() {
  console.log(`Fetching skills from ${REPO}@${BRANCH}`)

  // 1. Discover all memory-* directories
  const contentsUrl = `https://api.github.com/repos/${REPO}/contents?ref=${BRANCH}`
  const entries = await fetchJSON<GitHubEntry[]>(contentsUrl)
  const skillDirs = entries
    .filter((e) => e.type === "dir" && e.name.startsWith("memory-"))
    .map((e) => e.name)
    .sort()

  if (skillDirs.length === 0) {
    throw new Error("No memory-* directories found in repo")
  }

  console.log(`Found ${skillDirs.length} skills: ${skillDirs.join(", ")}`)

  // 2. Download each SKILL.md and parse frontmatter
  const manifest: SkillManifestEntry[] = []

  const results = await Promise.all(
    skillDirs.map(async (dir) => {
      const rawUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${dir}/SKILL.md`
      const content = await fetchText(rawUrl)
      const meta = parseFrontmatter(content)
      return { dir, content, meta }
    }),
  )

  // 3. Write files and build manifest
  for (const { dir, content, meta } of results) {
    const outDir = resolve(SKILLS_DIR, dir)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, "SKILL.md"), content)
    manifest.push({ dir, name: meta.name, description: meta.description })
    console.log(`  ✓ ${dir}`)
  }

  // Sort manifest by dir name for deterministic output
  manifest.sort((a, b) => a.dir.localeCompare(b.dir))

  // 4. Write manifest
  mkdirSync(SKILLS_DIR, { recursive: true })
  writeFileSync(
    resolve(SKILLS_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  console.log(`\nWrote ${manifest.length} skills + manifest.json to skills/`)
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
