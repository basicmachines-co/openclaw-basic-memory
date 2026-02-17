#!/usr/bin/env bun
/**
 * Basic Memory Benchmark — Eval Harness
 *
 * Runs retrieval quality benchmarks against real Basic Memory search.
 * No mocks. Real `bm` CLI, real indexing, real search.
 *
 * Usage:
 *   bun benchmark/run.ts                    # Run BM benchmark
 *   bun benchmark/run.ts --provider builtin # Run builtin comparison
 *   bun benchmark/run.ts --verbose          # Show per-query details
 *
 * Outputs:
 *   benchmark/results/bm-results.json       # Raw results
 *   benchmark/results/summary.txt           # Human-readable summary
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Query {
  id: string;
  query: string;
  category: string;
  ground_truth: string[];
  expected_content?: string;
  note?: string;
}

interface SearchResult {
  file_path: string;
  title: string;
  score: number;
  content: string;
}

interface QueryResult {
  id: string;
  query: string;
  category: string;
  latencyMs: number;
  results: SearchResult[];
  recall_at_5: number;
  recall_at_10: number;
  precision_at_5: number;
  mrr: number;
  content_hit: boolean | null; // null if no expected_content
}

interface BenchmarkSummary {
  provider: string;
  timestamp: string;
  corpus_files: number;
  total_queries: number;
  metrics: {
    recall_at_5: number;
    recall_at_10: number;
    precision_at_5: number;
    mrr: number;
    content_hit_rate: number;
    mean_latency_ms: number;
    p95_latency_ms: number;
  };
  by_category: Record<
    string,
    {
      count: number;
      recall_at_5: number;
      recall_at_10: number;
      mrr: number;
      mean_latency_ms: number;
    }
  >;
  query_results: QueryResult[];
}

// ---------------------------------------------------------------------------
// BM Search Provider
// ---------------------------------------------------------------------------

const BENCHMARK_DIR = dirname(new URL(import.meta.url).pathname);
const RESULTS_DIR = resolve(BENCHMARK_DIR, "results");

// Corpus size: small (~10 files), medium (~35 files), large (~100 files)
// Each tier is a superset of the previous
const CORPUS_SIZE = process.argv.find((a) => a.startsWith("--corpus="))?.split("=")[1] || "small";
const VALID_SIZES = ["small", "medium", "large"];
if (!VALID_SIZES.includes(CORPUS_SIZE)) {
  console.error(`Invalid corpus size: ${CORPUS_SIZE}. Use: ${VALID_SIZES.join(", ")}`);
  process.exit(1);
}

const CORPUS_DIR = resolve(BENCHMARK_DIR, `corpus-${CORPUS_SIZE}`);
const QUERIES_PATH = resolve(BENCHMARK_DIR, "queries.json");

// Project name includes corpus size for isolation
const BM_PROJECT = `benchmark-${CORPUS_SIZE}`;

function bmCommand(args: string): string {
  const cmd = `bm ${args}`;
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env },
    }).trim();
  } catch (err: any) {
    console.error(`  bm command failed: ${cmd}`);
    console.error(`  stderr: ${err.stderr?.toString()}`);
    return "";
  }
}

function bmSearch(query: string, limit = 10): SearchResult[] {
  // bm uses `bm tool search-notes` for search (MCP tool via CLI)
  // Try hybrid (FTS + vector) first, fall back to FTS-only
  const escapedQuery = query.replace(/"/g, '\\"');
  let raw = bmCommand(
    `tool search-notes "${escapedQuery}" --hybrid --page-size ${limit} --project ${BM_PROJECT}`
  );

  if (!raw) {
    // Fallback: FTS-only (no --hybrid)
    raw = bmCommand(
      `tool search-notes "${escapedQuery}" --page-size ${limit} --project ${BM_PROJECT}`
    );
  }

  if (!raw) return [];

  try {
    // bm tool outputs JSON with a wrapping structure; extract the content
    // The output may be wrapped in MCP tool response format
    let parsed: any;

    // Try parsing as direct JSON first
    try {
      parsed = JSON.parse(raw);
    } catch {
      // bm tool may output text with embedded JSON — find the JSON block
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        console.error(`  Failed to parse bm output for: "${query}"`);
        return [];
      }
    }

    // Handle different response formats
    const results = parsed.results || (Array.isArray(parsed) ? parsed : []);
    return results.map((r: any) => ({
      file_path: r.file_path || r.permalink || "",
      title: r.title || "",
      score: r.score || r.similarity || 0,
      content: r.content || r.snippet || "",
    }));
  } catch (err) {
    console.error(`  Failed to parse bm search output for: "${query}"`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function normalizeFilePath(path: string): string {
  // Strip leading ./ or corpus/ prefix, normalize
  return path
    .replace(/^\.\//, "")
    .replace(/^corpus\//, "")
    .replace(/^memory\//, "memory/");
}

function isMatch(resultPath: string, truthPath: string): boolean {
  const normResult = normalizeFilePath(resultPath);
  const normTruth = normalizeFilePath(truthPath);

  // Exact match
  if (normResult === normTruth) return true;

  // Result path contains the truth path (e.g., full path vs relative)
  if (normResult.includes(normTruth) || normTruth.includes(normResult)) {
    return true;
  }

  // Match on filename
  const resultFile = normResult.split("/").pop();
  const truthFile = normTruth.split("/").pop();
  if (resultFile && truthFile && resultFile === truthFile) return true;

  return false;
}

function computeRecall(
  results: SearchResult[],
  groundTruth: string[],
  k: number
): number {
  const topK = results.slice(0, k);
  const found = groundTruth.filter((gt) =>
    topK.some((r) => isMatch(r.file_path, gt))
  );
  return found.length / groundTruth.length;
}

function computePrecision(
  results: SearchResult[],
  groundTruth: string[],
  k: number
): number {
  const topK = results.slice(0, k);
  if (topK.length === 0) return 0;
  const relevant = topK.filter((r) =>
    groundTruth.some((gt) => isMatch(r.file_path, gt))
  );
  return relevant.length / topK.length;
}

function computeMRR(
  results: SearchResult[],
  groundTruth: string[]
): number {
  for (let i = 0; i < results.length; i++) {
    if (groundTruth.some((gt) => isMatch(results[i].file_path, gt))) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function checkContentHit(
  results: SearchResult[],
  expectedContent?: string
): boolean | null {
  if (!expectedContent) return null;
  const allContent = results.map((r) => r.content).join(" ");
  return allContent.toLowerCase().includes(expectedContent.toLowerCase());
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function setupBmProject(): Promise<boolean> {
  console.log("Setting up BM project for benchmark corpus...");

  // Check if bm is available
  try {
    const version = bmCommand("--version");
    console.log(`  bm version: ${version}`);
  } catch {
    console.error("  ERROR: bm CLI not found. Install with: uv tool install basic-memory");
    return false;
  }

  // Create/update the benchmark project pointing at corpus
  try {
    bmCommand(`project add ${BM_PROJECT} ${CORPUS_DIR}`);
    console.log(`  Project '${BM_PROJECT}' configured at ${CORPUS_DIR}`);
  } catch {
    console.log(`  Project '${BM_PROJECT}' may already exist, continuing...`);
  }

  // Index the corpus files — run watch briefly to process, or use doctor
  console.log("  Indexing corpus files (this may take a moment)...");
  // bm doctor triggers a sync check
  bmCommand(`doctor --project ${BM_PROJECT}`);
  console.log("  Index ready.");

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const provider = args.find((a) => a.startsWith("--provider="))?.split("=")[1] || "bm";

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Basic Memory Benchmark — Retrieval Quality Eval    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Corpus: ${CORPUS_SIZE} (${CORPUS_DIR})`);
  console.log();

  // Load queries
  const queriesRaw = await readFile(QUERIES_PATH, "utf-8");
  const queries: Query[] = JSON.parse(queriesRaw);
  console.log(`Loaded ${queries.length} queries across ${new Set(queries.map((q) => q.category)).size} categories`);
  console.log();

  // Setup
  if (provider === "bm") {
    const ok = await setupBmProject();
    if (!ok) process.exit(1);
  }

  console.log();
  console.log("Running queries...");
  console.log();

  // Run all queries
  const results: QueryResult[] = [];

  for (const q of queries) {
    const start = performance.now();
    const searchResults = bmSearch(q.query);
    const latencyMs = performance.now() - start;

    const recall5 = computeRecall(searchResults, q.ground_truth, 5);
    const recall10 = computeRecall(searchResults, q.ground_truth, 10);
    const precision5 = computePrecision(searchResults, q.ground_truth, 5);
    const mrr = computeMRR(searchResults, q.ground_truth);
    const contentHit = checkContentHit(searchResults, q.expected_content);

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
    };

    results.push(result);

    if (verbose) {
      const icon =
        recall5 > 0.5 ? "✅" : recall5 > 0 ? "⚠️" : "❌";
      console.log(
        `  ${icon} [${q.category}] "${q.query}" — R@5=${recall5.toFixed(2)} MRR=${mrr.toFixed(2)} ${latencyMs.toFixed(0)}ms`
      );
      if (contentHit === false) {
        console.log(`     ⚠ Expected content not found: "${q.expected_content}"`);
      }
    } else {
      process.stdout.write(".");
    }
  }

  if (!verbose) console.log();
  console.log();

  // Aggregate metrics
  const avgRecall5 = results.reduce((s, r) => s + r.recall_at_5, 0) / results.length;
  const avgRecall10 = results.reduce((s, r) => s + r.recall_at_10, 0) / results.length;
  const avgPrecision5 = results.reduce((s, r) => s + r.precision_at_5, 0) / results.length;
  const avgMrr = results.reduce((s, r) => s + r.mrr, 0) / results.length;
  const contentQueries = results.filter((r) => r.content_hit !== null);
  const contentHitRate =
    contentQueries.length > 0
      ? contentQueries.filter((r) => r.content_hit).length / contentQueries.length
      : 0;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const meanLatency = latencies.reduce((s, l) => s + l, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

  // By category
  const categories = [...new Set(results.map((r) => r.category))];
  const byCategory: Record<string, any> = {};
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    byCategory[cat] = {
      count: catResults.length,
      recall_at_5: catResults.reduce((s, r) => s + r.recall_at_5, 0) / catResults.length,
      recall_at_10: catResults.reduce((s, r) => s + r.recall_at_10, 0) / catResults.length,
      mrr: catResults.reduce((s, r) => s + r.mrr, 0) / catResults.length,
      mean_latency_ms: Math.round(
        catResults.reduce((s, r) => s + r.latencyMs, 0) / catResults.length
      ),
    };
  }

  // Build summary
  const summary: BenchmarkSummary = {
    provider,
    timestamp: new Date().toISOString(),
    corpus_files: 10, // TODO: count dynamically
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
  };

  // Print results
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Provider: ${provider}`);
  console.log(`  Queries:  ${queries.length}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log();
  console.log("  Overall Metrics:");
  console.log(`    Recall@5:          ${(avgRecall5 * 100).toFixed(1)}%`);
  console.log(`    Recall@10:         ${(avgRecall10 * 100).toFixed(1)}%`);
  console.log(`    Precision@5:       ${(avgPrecision5 * 100).toFixed(1)}%`);
  console.log(`    MRR:               ${avgMrr.toFixed(3)}`);
  console.log(`    Content Hit Rate:  ${(contentHitRate * 100).toFixed(1)}%`);
  console.log(`    Mean Latency:      ${meanLatency.toFixed(0)}ms`);
  console.log(`    P95 Latency:       ${p95Latency}ms`);
  console.log();
  console.log("  By Category:");
  console.log(
    "  " +
      "Category".padEnd(22) +
      "N".padStart(4) +
      "R@5".padStart(8) +
      "R@10".padStart(8) +
      "MRR".padStart(8) +
      "Latency".padStart(10)
  );
  console.log("  " + "─".repeat(60));
  for (const cat of categories) {
    const c = byCategory[cat];
    console.log(
      "  " +
        cat.padEnd(22) +
        String(c.count).padStart(4) +
        `${(c.recall_at_5 * 100).toFixed(1)}%`.padStart(8) +
        `${(c.recall_at_10 * 100).toFixed(1)}%`.padStart(8) +
        c.mrr.toFixed(3).padStart(8) +
        `${c.mean_latency_ms}ms`.padStart(10)
    );
  }
  console.log();

  // Failures
  const failures = results.filter((r) => r.recall_at_5 === 0);
  if (failures.length > 0) {
    console.log(`  ❌ Failures (${failures.length} queries with zero recall@5):`);
    for (const f of failures) {
      console.log(`    [${f.category}] "${f.query}"`);
    }
    console.log();
  }

  // Write results
  await mkdir(RESULTS_DIR, { recursive: true });
  const resultsFile = `${provider}-${CORPUS_SIZE}-results.json`;
  await writeFile(
    resolve(RESULTS_DIR, resultsFile),
    JSON.stringify(summary, null, 2)
  );
  console.log(`  Results saved to benchmark/results/${resultsFile}`);
  console.log();
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
