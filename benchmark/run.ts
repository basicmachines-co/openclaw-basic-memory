#!/usr/bin/env bun
/* biome-ignore-all lint/suspicious/noExplicitAny: benchmark harness uses dynamic MCP responses */
/**
 * Basic Memory Benchmark — Eval Harness (MCP Client)
 *
 * Runs retrieval quality benchmarks against BM's MCP server directly.
 * No CLI shelling. Fast, accurate, tests what we actually ship.
 *
 * Usage:
 *   bun benchmark/run.ts                    # Run benchmark
 *   bun benchmark/run.ts --verbose          # Show per-query details
 *   bun benchmark/run.ts --corpus=medium    # Use medium corpus
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Query {
  id: string
  query: string
  category: string
  ground_truth: string[]
  expected_content?: string
  note?: string
}

interface SearchResult {
  file_path: string
  title: string
  score: number
  content: string
}

interface QueryResult {
  id: string
  query: string
  category: string
  latencyMs: number
  results: SearchResult[]
  recall_at_5: number
  recall_at_10: number
  precision_at_5: number
  mrr: number
  content_hit: boolean | null
}

interface BenchmarkSummary {
  provider: string
  timestamp: string
  corpus_files: number
  total_queries: number
  metrics: {
    recall_at_5: number
    recall_at_10: number
    precision_at_5: number
    mrr: number
    content_hit_rate: number
    mean_latency_ms: number
    p95_latency_ms: number
  }
  by_category: Record<
    string,
    {
      count: number
      recall_at_5: number
      recall_at_10: number
      mrr: number
      mean_latency_ms: number
    }
  >
  query_results: QueryResult[]
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BENCHMARK_DIR = dirname(new URL(import.meta.url).pathname)
const RESULTS_DIR = resolve(BENCHMARK_DIR, "results")

const CORPUS_SIZE =
  process.argv.find((a) => a.startsWith("--corpus="))?.split("=")[1] || "small"
const BM_PROJECT =
  process.argv.find((a) => a.startsWith("--project="))?.split("=")[1] ||
  "benchmark"
const QUERIES_PATH =
  process.argv.find((a) => a.startsWith("--queries="))?.split("=")[1] ||
  resolve(BENCHMARK_DIR, "queries.json")
const QUERY_LIMIT =
  Number.parseInt(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0",
  ) || 0

// ---------------------------------------------------------------------------
// MCP Client
// ---------------------------------------------------------------------------

let mcpClient: Client

async function startMcpClient(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "bm",
    args: ["mcp"],
    env: { ...process.env },
  })

  mcpClient = new Client({ name: "benchmark-harness", version: "1.0.0" }, {})
  await mcpClient.connect(transport)
  console.log("  MCP client connected to bm mcp server")
}

async function mcpSearch(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    const result = await mcpClient.callTool({
      name: "search_notes",
      arguments: {
        query,
        page_size: limit,
        project: BM_PROJECT,
      },
    })

    // MCP tool results come as content array
    const textContent = (result.content as any[])?.find(
      (c: any) => c.type === "text",
    )
    if (!textContent?.text) return []

    const parsed = JSON.parse(textContent.text)
    const results = parsed.results || (Array.isArray(parsed) ? parsed : [])

    return results.map((r: any) => ({
      file_path: r.file_path || r.permalink || "",
      title: r.title || "",
      score: r.score || r.similarity || 0,
      content: r.matched_chunk || r.content || r.snippet || "",
    }))
  } catch (err) {
    console.error(`  MCP search failed for: "${query}"`, err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function normalizeFilePath(path: string): string {
  return path
    .replace(/^\.\//, "")
    .replace(/^corpus\//, "")
    .replace(/^memory\//, "memory/")
}

function isMatch(resultPath: string, truthPath: string): boolean {
  const normResult = normalizeFilePath(resultPath)
  const normTruth = normalizeFilePath(truthPath)

  if (normResult === normTruth) return true
  if (normResult.includes(normTruth) || normTruth.includes(normResult))
    return true

  const resultFile = normResult.split("/").pop()
  const truthFile = normTruth.split("/").pop()
  if (resultFile && truthFile && resultFile === truthFile) return true

  return false
}

function computeRecall(
  results: SearchResult[],
  groundTruth: string[],
  k: number,
): number {
  const topK = results.slice(0, k)
  const found = groundTruth.filter((gt) =>
    topK.some((r) => isMatch(r.file_path, gt)),
  )
  return found.length / groundTruth.length
}

function computePrecision(
  results: SearchResult[],
  groundTruth: string[],
  k: number,
): number {
  const topK = results.slice(0, k)
  if (topK.length === 0) return 0
  const relevant = topK.filter((r) =>
    groundTruth.some((gt) => isMatch(r.file_path, gt)),
  )
  return relevant.length / topK.length
}

function computeMRR(results: SearchResult[], groundTruth: string[]): number {
  for (let i = 0; i < results.length; i++) {
    if (groundTruth.some((gt) => isMatch(results[i].file_path, gt))) {
      return 1 / (i + 1)
    }
  }
  return 0
}

function checkContentHit(
  results: SearchResult[],
  expectedContent?: string,
): boolean | null {
  if (!expectedContent) return null
  const allContent = results.map((r) => r.content).join(" ")
  return allContent.toLowerCase().includes(expectedContent.toLowerCase())
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes("--verbose")

  console.log("╔══════════════════════════════════════════════════════╗")
  console.log("║  Basic Memory Benchmark — Retrieval Quality Eval    ║")
  console.log("║  (MCP Client — no CLI overhead)                     ║")
  console.log("╚══════════════════════════════════════════════════════╝")
  console.log(`  Corpus: ${CORPUS_SIZE}`)
  console.log(`  Project: ${BM_PROJECT}`)
  console.log()

  // Load queries
  const queriesRaw = await readFile(resolve(QUERIES_PATH), "utf-8")
  let queries: Query[] = JSON.parse(queriesRaw)
  if (QUERY_LIMIT > 0) queries = queries.slice(0, QUERY_LIMIT)
  console.log(
    `Loaded ${queries.length} queries across ${new Set(queries.map((q) => q.category)).size} categories`,
  )
  console.log()

  // Start MCP client
  console.log("Connecting to BM MCP server...")
  await startMcpClient()
  console.log()

  console.log("Running queries...")
  console.log()

  // Run all queries
  const results: QueryResult[] = []

  for (const q of queries) {
    const start = performance.now()
    const searchResults = await mcpSearch(q.query)
    const latencyMs = performance.now() - start

    const recall5 = computeRecall(searchResults, q.ground_truth, 5)
    const recall10 = computeRecall(searchResults, q.ground_truth, 10)
    const precision5 = computePrecision(searchResults, q.ground_truth, 5)
    const mrr = computeMRR(searchResults, q.ground_truth)
    const contentHit = checkContentHit(searchResults, q.expected_content)

    const result: QueryResult = {
      id: q.id,
      query: q.query,
      category: q.category,
      latencyMs: Math.round(latencyMs),
      results: searchResults,
      recall_at_5: recall5,
      recall_at_10: recall10,
      precision_at_5: precision5,
      mrr,
      content_hit: contentHit,
    }

    results.push(result)

    if (verbose) {
      const icon = recall5 > 0.5 ? "✅" : recall5 > 0 ? "⚠️" : "❌"
      console.log(
        `  ${icon} [${q.category}] "${q.query}" — R@5=${recall5.toFixed(2)} MRR=${mrr.toFixed(2)} ${latencyMs.toFixed(0)}ms`,
      )
      if (contentHit === false) {
        console.log(
          `     ⚠ Expected content not found: "${q.expected_content}"`,
        )
      }
      if (verbose && recall5 === 0 && searchResults.length > 0) {
        console.log(
          `     Got: ${searchResults
            .slice(0, 3)
            .map((r) => r.file_path)
            .join(", ")}`,
        )
        console.log(`     Want: ${q.ground_truth.join(", ")}`)
      }
    } else {
      process.stdout.write(".")
    }
  }

  if (!verbose) console.log()
  console.log()

  // Aggregate metrics
  const avgRecall5 =
    results.reduce((s, r) => s + r.recall_at_5, 0) / results.length
  const avgRecall10 =
    results.reduce((s, r) => s + r.recall_at_10, 0) / results.length
  const avgPrecision5 =
    results.reduce((s, r) => s + r.precision_at_5, 0) / results.length
  const avgMrr = results.reduce((s, r) => s + r.mrr, 0) / results.length
  const contentQueries = results.filter((r) => r.content_hit !== null)
  const contentHitRate =
    contentQueries.length > 0
      ? contentQueries.filter((r) => r.content_hit).length /
        contentQueries.length
      : 0
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b)
  const meanLatency = latencies.reduce((s, l) => s + l, 0) / latencies.length
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)]

  // By category
  const categories = [...new Set(results.map((r) => r.category))]
  const byCategory: Record<string, any> = {}
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat)
    byCategory[cat] = {
      count: catResults.length,
      recall_at_5:
        catResults.reduce((s, r) => s + r.recall_at_5, 0) / catResults.length,
      recall_at_10:
        catResults.reduce((s, r) => s + r.recall_at_10, 0) / catResults.length,
      mrr: catResults.reduce((s, r) => s + r.mrr, 0) / catResults.length,
      mean_latency_ms: Math.round(
        catResults.reduce((s, r) => s + r.latencyMs, 0) / catResults.length,
      ),
    }
  }

  // Count corpus files
  const { execSync } = await import("node:child_process")
  const corpusFiles = Number.parseInt(
    execSync(`find benchmark/corpus -name "*.md" | wc -l`, {
      encoding: "utf-8",
    }).trim(),
  )

  // Build summary
  const summary: BenchmarkSummary = {
    provider: "basic-memory-mcp",
    timestamp: new Date().toISOString(),
    corpus_files: corpusFiles,
    total_queries: queries.length,
    metrics: {
      recall_at_5: avgRecall5,
      recall_at_10: avgRecall10,
      precision_at_5: avgPrecision5,
      mrr: avgMrr,
      content_hit_rate: contentHitRate,
      mean_latency_ms: Math.round(meanLatency),
      p95_latency_ms: p95Latency,
    },
    by_category: byCategory,
    query_results: results,
  }

  // Print results
  console.log("═══════════════════════════════════════════════════════")
  console.log("  Provider: basic-memory (MCP)")
  console.log(`  Corpus:   ${corpusFiles} files (${CORPUS_SIZE})`)
  console.log(`  Queries:  ${queries.length}`)
  console.log("═══════════════════════════════════════════════════════")
  console.log()
  console.log("  Overall Metrics:")
  console.log(`    Recall@5:          ${(avgRecall5 * 100).toFixed(1)}%`)
  console.log(`    Recall@10:         ${(avgRecall10 * 100).toFixed(1)}%`)
  console.log(`    Precision@5:       ${(avgPrecision5 * 100).toFixed(1)}%`)
  console.log(`    MRR:               ${avgMrr.toFixed(3)}`)
  console.log(`    Content Hit Rate:  ${(contentHitRate * 100).toFixed(1)}%`)
  console.log(`    Mean Latency:      ${meanLatency.toFixed(0)}ms`)
  console.log(`    P95 Latency:       ${p95Latency}ms`)
  console.log()
  console.log("  By Category:")
  console.log(
    "  " +
      "Category".padEnd(22) +
      "N".padStart(4) +
      "R@5".padStart(8) +
      "R@10".padStart(8) +
      "MRR".padStart(8) +
      "Latency".padStart(10),
  )
  console.log(`  ${"─".repeat(60)}`)
  for (const cat of categories) {
    const c = byCategory[cat]
    console.log(
      "  " +
        cat.padEnd(22) +
        String(c.count).padStart(4) +
        `${(c.recall_at_5 * 100).toFixed(1)}%`.padStart(8) +
        `${(c.recall_at_10 * 100).toFixed(1)}%`.padStart(8) +
        c.mrr.toFixed(3).padStart(8) +
        `${c.mean_latency_ms}ms`.padStart(10),
    )
  }
  console.log()

  // Failures
  const failures = results.filter((r) => r.recall_at_5 === 0)
  if (failures.length > 0) {
    console.log(
      `  ❌ Failures (${failures.length} queries with zero recall@5):`,
    )
    for (const f of failures) {
      console.log(`    [${f.category}] "${f.query}"`)
    }
    console.log()
  }

  // Write results
  await mkdir(RESULTS_DIR, { recursive: true })
  const resultsFile = `bm-mcp-${CORPUS_SIZE}-results.json`
  await writeFile(
    resolve(RESULTS_DIR, resultsFile),
    JSON.stringify(summary, null, 2),
  )
  console.log(`  Results saved to benchmark/results/${resultsFile}`)
  console.log()

  // Clean shutdown
  await mcpClient.close()
}

main().catch((err) => {
  console.error("Benchmark failed:", err)
  process.exit(1)
})
