#!/usr/bin/env bun
/**
 * Convert LoCoMo dataset into Basic Memory markdown corpus + queries.
 *
 * LoCoMo conversations → daily session notes (like an agent's memory)
 * LoCoMo QA annotations → benchmark queries with ground truth
 *
 * Usage:
 *   bun benchmark/convert-locomo.ts                  # Convert all 10 conversations
 *   bun benchmark/convert-locomo.ts --conv=0         # Convert conversation 0 only
 *   bun benchmark/convert-locomo.ts --conv=0 --conv=1  # Multiple conversations
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoCoMoTurn {
  speaker: string
  text: string
  dia_id: string
  img_url?: string
  blip_caption?: string
}

interface LoCoMoQA {
  question: string
  answer?: string
  adversarial_answer?: string
  category: number
  evidence: string[]
}

interface LoCoMoConversation {
  sample_id: string
  conversation: Record<string, any>
  qa: LoCoMoQA[]
  observation?: Record<string, string>
  session_summary?: Record<string, string>
  event_summary?: Record<string, any>
}

interface BenchmarkQuery {
  id: string
  query: string
  category: string
  ground_truth: string[]
  expected_content?: string
  note?: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BENCHMARK_DIR = resolve(import.meta.dirname!, ".")
const DATASET_PATH = resolve(BENCHMARK_DIR, "datasets/locomo10.json")

const CATEGORY_MAP: Record<number, string> = {
  1: "single_hop",
  2: "multi_hop",
  3: "temporal",
  4: "open_domain",
  5: "adversarial",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateTime(dateStr: string): { date: string; time: string } | null {
  // "8:56 pm on 20 July, 2023" → { date: "2023-07-20", time: "20:56" }
  const match = dateStr.match(
    /(\d{1,2}):(\d{2})\s*(am|pm)\s+on\s+(\d{1,2})\s+(\w+),?\s+(\d{4})/i,
  )
  if (!match) return null

  const [, hour, min, ampm, day, month, year] = match
  let h = Number.parseInt(hour)
  if (ampm.toLowerCase() === "pm" && h !== 12) h += 12
  if (ampm.toLowerCase() === "am" && h === 12) h = 0

  const months: Record<string, string> = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  }

  const m = months[month]
  if (!m) return null

  return {
    date: `${year}-${m}-${day.padStart(2, "0")}`,
    time: `${String(h).padStart(2, "0")}:${min}`,
  }
}

function dialogIdToSessionNum(diaId: string): number | null {
  // "D1:3" → session 1, "D15:7" → session 15
  const match = diaId.match(/^D(\d+):/)
  return match ? Number.parseInt(match[1]) : null
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

function convertConversation(
  conv: LoCoMoConversation,
  convIndex: number,
): { files: Map<string, string>; queries: BenchmarkQuery[] } {
  const c = conv.conversation
  const speakerA = c.speaker_a || "Speaker A"
  const speakerB = c.speaker_b || "Speaker B"
  const files = new Map<string, string>()

  // Find all sessions
  const sessionKeys = Object.keys(c)
    .filter((k) => k.match(/^session_\d+$/) && Array.isArray(c[k]))
    .sort((a, b) => {
      const na = Number.parseInt(a.split("_")[1])
      const nb = Number.parseInt(b.split("_")[1])
      return na - nb
    })

  // Create a people note for each speaker
  const speakerANote = `---
title: ${speakerA}
type: Person
---

# ${speakerA}

## Observations
- [role] Conversation participant
- [relationship] Regularly chats with ${speakerB}
`
  files.set(
    `people/${speakerA.toLowerCase().replace(/\s+/g, "-")}.md`,
    speakerANote,
  )

  const speakerBNote = `---
title: ${speakerB}
type: Person
---

# ${speakerB}

## Observations
- [role] Conversation participant
- [relationship] Regularly chats with ${speakerA}
`
  files.set(
    `people/${speakerB.toLowerCase().replace(/\s+/g, "-")}.md`,
    speakerBNote,
  )

  // Build a MEMORY.md with key facts that accumulate
  const memoryLines: string[] = [
    "# Long-Term Memory",
    "",
    "## People",
    `- ${speakerA} and ${speakerB} are close friends who chat regularly`,
    "",
    "## Key Events",
  ]

  // Convert each session to a dated note
  for (const sessionKey of sessionKeys) {
    const sessionNum = Number.parseInt(sessionKey.split("_")[1])
    const turns: LoCoMoTurn[] = c[sessionKey]
    const dateTimeStr = c[`${sessionKey}_date_time`]
    const parsed = dateTimeStr ? parseDateTime(dateTimeStr) : null

    const date =
      parsed?.date || `2023-01-${String(sessionNum).padStart(2, "0")}`
    const time = parsed?.time || "12:00"

    // Get session summary and observations if available
    const summary = conv.session_summary?.[`${sessionKey}_summary`] || ""
    const rawObs = conv.observation?.[`${sessionKey}_observation`]
    let observation = ""
    if (rawObs && typeof rawObs === "object") {
      // { "Speaker": [["observation text", "D1:3"], ...] }
      const lines: string[] = []
      for (const [speaker, obs] of Object.entries(rawObs)) {
        if (Array.isArray(obs)) {
          for (const item of obs) {
            const text = Array.isArray(item) ? item[0] : item
            if (typeof text === "string")
              lines.push(`- [${speaker.toLowerCase()}] ${text}`)
          }
        }
      }
      observation = lines.join("\n")
    } else if (typeof rawObs === "string") {
      observation = rawObs
    }

    let content = `---
title: ${date} Session ${sessionNum}
type: note
date: ${date}
---

# ${date} — Session ${sessionNum}

*${speakerA} and ${speakerB} — ${time}*

`

    // Add observation as a summary if available
    if (observation) {
      content += `## Summary\n${observation}\n\n`
    } else if (summary) {
      content += `## Summary\n${summary}\n\n`
    }

    // Add conversation
    content += "## Conversation\n"
    for (const turn of turns) {
      const text = turn.text.replace(/\n/g, "\n> ")
      content += `**${turn.speaker}:** ${text}\n\n`
    }

    // Add relations
    content += "## Relations\n"
    content += `- mentions [[${speakerA}]]\n`
    content += `- mentions [[${speakerB}]]\n`

    // Add to memory summary
    if (observation) {
      const firstObs =
        observation.split("\n")[0]?.replace(/^- \[\w+\] /, "") || ""
      if (firstObs) memoryLines.push(`- [${date}] ${firstObs}`)
    }

    files.set(`conversations/${date}-session-${sessionNum}.md`, content)
  }

  // Write MEMORY.md
  files.set("MEMORY.md", `${memoryLines.join("\n")}\n`)

  // Convert QA to benchmark queries
  const queries: BenchmarkQuery[] = []

  // Map evidence dialog IDs to file paths
  for (const [qIdx, qa] of conv.qa.entries()) {
    const category = CATEGORY_MAP[qa.category] || `cat_${qa.category}`
    const answer = qa.answer || qa.adversarial_answer || ""

    // Map evidence to ground truth file paths
    const groundTruth = new Set<string>()
    for (const ev of qa.evidence || []) {
      const sessionNum = dialogIdToSessionNum(ev)
      if (sessionNum === null) continue

      // Find the session's date
      const dateTimeStr = c[`session_${sessionNum}_date_time`]
      const parsed = dateTimeStr ? parseDateTime(dateTimeStr) : null
      const date =
        parsed?.date || `2023-01-${String(sessionNum).padStart(2, "0")}`
      groundTruth.add(`conversations/${date}-session-${sessionNum}.md`)
    }

    // For adversarial questions, ground truth is that the info doesn't exist
    // We still include the evidence files (where the premise is contradicted)
    const isAdversarial = qa.category === 5

    queries.push({
      id: `locomo_c${convIndex}_q${qIdx}`,
      query: qa.question,
      category,
      ground_truth: [...groundTruth],
      expected_content: isAdversarial
        ? undefined
        : answer.length < 100
          ? answer
          : undefined,
      note: isAdversarial
        ? `Adversarial: correct answer is "${answer}"`
        : undefined,
    })
  }

  return { files, queries }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const convIndices = args
    .filter((a) => a.startsWith("--conv="))
    .map((a) => Number.parseInt(a.split("=")[1]))

  console.log("Loading LoCoMo dataset...")
  const raw = await readFile(DATASET_PATH, "utf-8")
  const data: LoCoMoConversation[] = JSON.parse(raw)
  console.log(`  ${data.length} conversations loaded`)

  const indices = convIndices.length > 0 ? convIndices : data.map((_, i) => i)
  let totalFiles = 0
  let totalQueries = 0

  for (const idx of indices) {
    const conv = data[idx]
    if (!conv) {
      console.error(`  Conversation ${idx} not found, skipping`)
      continue
    }

    const convDir = `corpus-locomo/conv-${idx}`
    const outDir = resolve(BENCHMARK_DIR, convDir)

    console.log(
      `\nConverting conversation ${idx} (${conv.conversation.speaker_a} & ${conv.conversation.speaker_b})...`,
    )

    const { files, queries } = convertConversation(conv, idx)

    // Write files
    for (const [path, content] of files) {
      const fullPath = resolve(outDir, path)
      await mkdir(resolve(fullPath, ".."), { recursive: true })
      await writeFile(fullPath, content)
    }

    // Write queries
    const queriesPath = resolve(outDir, "queries.json")
    await writeFile(queriesPath, JSON.stringify(queries, null, 2))

    console.log(`  ${files.size} markdown files, ${queries.length} queries`)
    totalFiles += files.size
    totalQueries += queries.length

    // Category breakdown
    const cats: Record<string, number> = {}
    for (const q of queries) {
      cats[q.category] = (cats[q.category] || 0) + 1
    }
    for (const [cat, count] of Object.entries(cats).sort()) {
      console.log(`    ${cat}: ${count}`)
    }
  }

  console.log(
    `\n✅ Total: ${totalFiles} files, ${totalQueries} queries across ${indices.length} conversations`,
  )
  console.log("   Output: benchmark/corpus-locomo/")
}

main().catch((err) => {
  console.error("Conversion failed:", err)
  process.exit(1)
})
