# Basic Memory Benchmark

Open, reproducible retrieval quality benchmarks for the Basic Memory OpenClaw plugin.

## Why

Memory systems for AI agents make big claims with no reproducible evidence. We're building benchmarks in the open to:

1. **Improve Basic Memory** — evals are a feedback loop, not a marketing tool
2. **Compare honestly** — show where we're strong AND where we're weak
3. **Publish methodology** — anyone can reproduce our results or challenge them

## What We Measure

### Retrieval Quality (primary)
- **Recall@K** — does the correct memory appear in the top K results?
- **Precision@K** — of the top K results, how many are actually relevant?
- **MRR** — Mean Reciprocal Rank: where does the first correct answer appear?
- **Content Hit Rate** — for exact facts, did the expected value appear in results?

### Query Categories
| Category | What it tests |
|----------|---------------|
| `exact_fact` | Keyword precision — find specific values |
| `semantic` | Vector similarity — find conceptually related content |
| `temporal` | Date awareness — retrieve by when things happened |
| `relational` | Graph traversal — follow connections between entities |
| `cross_note` | Multi-document recall — stitch information across files |
| `task_recall` | Structured task queries — find active/assigned tasks |
| `needle_in_haystack` | Exact token retrieval — find specific IDs, URLs, numbers |
| `absence` | Knowing what ISN'T there — or is planned but not done |
| `evolving_fact` | Freshness — prefer newer data over stale entries |

### Providers Compared
1. **Basic Memory** (`bm search`) — semantic graph + observations + relations
2. **OpenClaw builtin** (`memory-core`) — SQLite + vector + BM25 hybrid
3. **QMD** (experimental) — BM25 + vectors + reranking sidecar

## Quick Start

```bash
# Prerequisites: bm CLI installed
# https://github.com/basicmachines-co/basic-memory

# Run the benchmark
just benchmark

# Verbose output (per-query details)
just benchmark-verbose
```

## Corpus

The test corpus (`benchmark/corpus/`) is a realistic anonymized agent memory workspace:

- `MEMORY.md` — curated long-term facts
- `memory/YYYY-MM-DD.md` — daily notes with events, decisions, standups
- `memory/tasks/*.md` — structured tasks with BM schema fields
- `memory/topics/*.md` — research and reference notes
- `memory/people/*.md` — person notes with typed observations and relations

~10 files, ~12KB total. Designed to exercise all query categories.

## Queries

`benchmark/queries.json` contains 38 annotated queries with:
- Ground truth file paths (which files contain the answer)
- Expected content strings (for exact fact verification)
- Category labels (for per-category scoring)
- Notes explaining edge cases

## Results

Results are written to `benchmark/results/` as JSON with full per-query breakdowns:
- Overall metrics (recall, precision, MRR, latency)
- Category breakdown
- Individual query scores
- Failure analysis

## Contributing

We welcome contributions:
- **Add queries** — especially edge cases you've encountered
- **Expand the corpus** — more realistic memory patterns
- **Add providers** — help us compare against other memory systems
- **Challenge methodology** — if our scoring is unfair, tell us

## License

MIT — same as the plugin.
