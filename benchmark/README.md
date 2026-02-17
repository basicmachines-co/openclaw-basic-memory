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

# Run the benchmark (small corpus, default)
just benchmark

# Verbose output (per-query details)
just benchmark-verbose

# Run all corpus sizes to see scaling behavior
just benchmark-all

# Run a specific size
just benchmark-medium
just benchmark-large
```

## Corpus Tiers

Three nested corpus sizes test how retrieval scales with data growth. Each tier is a superset of the previous — medium contains all of small, large contains all of medium.

### Small (~10 files, ~12KB) — `corpus-small/`
A single day's work. Baseline: "does search work at all?"
- 1 MEMORY.md, 4 daily notes, 2 tasks, 2 people, 2 topics

### Medium (~35-40 files, ~50KB) — `corpus-medium/`
A working week. Tests noise resistance and temporal ranking.
- Everything in small + 7 more daily notes, 3 more tasks (incl. done), 3 more people, 3 more topics
- Done tasks that should NOT appear in active task queries
- More entities competing for relevance on each query
- 2-hop relation chains

### Large (~100-120 files, ~150-200KB) — `corpus-large/`
A month of accumulated knowledge. The real stress test.
- Everything in medium + 25 more daily notes, 10 more tasks, 10 more people/orgs, 15 more topics
- Deep needle-in-haystack: specific IDs buried in old notes
- 3+ hop relation chains
- Heavy cross-document synthesis requirements
- Stale vs fresh fact resolution at scale

### What scaling reveals

| Metric | Small → Medium | Medium → Large |
|--------|---------------|----------------|
| Recall@5 | Should hold steady | May degrade — more noise |
| MRR | Should hold steady | Ranking quality under pressure |
| Latency | Baseline | Index size impact |
| Content hit | High | Needle-in-haystack stress |

If recall drops significantly from small → large, that's the signal to improve chunking, ranking, or indexing.

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
