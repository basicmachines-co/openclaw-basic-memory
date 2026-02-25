# SPEC: Basic Memory Benchmark Suite

## Summary

A standalone benchmark suite for evaluating retrieval quality across Basic Memory deployments (local, cloud, and competitors). Uses academic datasets (LoCoMo, LongMemEval) with standardized metrics. Designed to be publicly shareable, runnable by anyone, and integrated into CI.

## Motivation

1. **Internal quality tracking** — run benchmarks before/after every BM release to catch regressions and measure improvements
2. **Cloud vs Local comparison** — validate that BM Cloud's better embeddings (OpenAI ada-003, etc.) produce measurably better retrieval
3. **Public credibility** — publish reproducible numbers on academic benchmarks that anyone can verify
4. **Marketing content** — "we benchmark in the open" blog post, README stats, comparison tables
5. **Competitive positioning** — compare against Mem0, Supermemory, Zep on the same datasets they use

## Architecture

```
basic-memory-bench/
├── README.md                    # How to install, run, and interpret results
├── datasets/
│   ├── locomo/
│   │   ├── download.sh          # Fetches locomo10.json from snap-research/locomo
│   │   └── README.md            # Dataset description, citation, license
│   └── longmemeval/
│       ├── download.sh          # Fetches from HuggingFace
│       └── README.md
├── converters/
│   ├── locomo_to_bm.py          # LoCoMo JSON → BM markdown notes
│   ├── longmemeval_to_bm.py     # LongMemEval → BM markdown notes
│   └── base.py                  # Shared conversion utilities
├── harness/
│   ├── run.py                   # Main benchmark runner
│   ├── scoring.py               # Recall@K, MRR, Precision@K, content hit rate
│   ├── judge.py                 # LLM-as-Judge evaluation (for answer quality)
│   └── report.py                # Generate markdown/JSON reports
├── providers/
│   ├── bm_local.py              # Basic Memory local (via MCP stdio)
│   ├── bm_cloud.py              # Basic Memory Cloud (via API)
│   ├── mem0.py                  # Mem0 API (optional, needs API key)
│   └── base.py                  # Provider interface
├── results/                     # Saved benchmark runs (gitignored except baselines)
│   └── baselines/
│       └── bm-local-locomo-v0.18.5.json  # Published baseline results
├── pyproject.toml               # Python package (uv/pip installable)
└── justfile                     # Common commands
```

## Key Design Decisions

### Python, not TypeScript
The current harness is TypeScript (in the plugin repo) because it was built there first. The standalone suite should be Python because:
- BM is Python — same ecosystem, same contributors
- The BM importer framework (`basic_memory.importers`) is Python
- Academic researchers use Python
- Conversion scripts can use BM's `EntityMarkdown` types directly
- `uv run` makes it trivially installable

### Use BM's importer framework for conversion
Instead of raw string concatenation, converters should produce proper `EntityMarkdown` objects and write via `MarkdownProcessor`. This ensures:
- Canonical frontmatter format
- Proper permalink generation
- Identical output to what a real BM user would have
- Consistency with ChatGPT/Claude importers

### Provider abstraction
Each provider implements a simple interface:

```python
class BenchmarkProvider(ABC):
    @abstractmethod
    async def ingest(self, corpus_path: Path, project: str) -> None:
        """Index a corpus of markdown files."""
        
    @abstractmethod
    async def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        """Search and return ranked results."""
        
    @abstractmethod
    async def cleanup(self, project: str) -> None:
        """Remove indexed data."""
```

BM Local uses `bm mcp` over stdio (like current harness).
BM Cloud uses the cloud API directly.
Mem0/Supermemory use their respective APIs (optional, needs keys).

### Two evaluation modes

**Retrieval evaluation** (what we have now):
- Did we find the right note in top K results?
- Metrics: Recall@5, Recall@10, Precision@5, MRR, Content Hit Rate
- Fast, deterministic, no LLM cost

**Answer evaluation** (needed for Mem0 comparison):
- Given retrieved context, does the LLM produce the correct answer?
- Uses LLM-as-Judge (configurable: GPT-4o, Claude, Gemini)
- Metrics: accuracy, factual correctness, hallucination rate
- Slower, costs money, but directly comparable to Mem0's published numbers

### Corpus generation is reproducible
```bash
# Download dataset
just download-locomo

# Convert to BM format (deterministic, no randomness)
just convert-locomo

# Index into a BM project
just index-locomo

# Run benchmark
just bench-locomo

# Or all at once
just full-locomo
```

Anyone cloning the repo gets identical results (modulo embedding model differences).

## Datasets

### LoCoMo (primary)
- **Source:** snap-research/locomo (ACL 2024)
- **Size:** 10 conversations, ~300 turns each, 1,986 QA pairs
- **Categories:** single-hop (282), multi-hop (321), temporal (92), open-domain (841), adversarial (446)
- **Why:** Most cited memory benchmark. Mem0 publishes numbers on it. Direct comparison possible.
- **License:** Research use

### LongMemEval (secondary)
- **Source:** xiaowu0162/LongMemEval (ICLR 2025)
- **Size:** Longer conversations, more complex memory tasks
- **Categories:** knowledge update, knowledge retention, temporal reasoning, multi-session
- **Why:** Supermemory uses it. More challenging than LoCoMo. Tests different capabilities.
- **License:** Research use

### Synthetic (included, for fast iteration)
- **Source:** Our hand-crafted corpus (already in plugin repo)
- **Size:** 11 files, 38 queries, 9 categories
- **Why:** Fast to run (<30s), good for CI smoke tests, covers BM-specific patterns (task recall, wiki-link traversal)

## Conversion Strategy

LoCoMo conversations → BM notes that look like real agent memory:

1. **Session notes** — one markdown file per conversation session, dated, with frontmatter
2. **Observations** — extracted per-speaker observations become tagged `[speaker] fact` entries
3. **People notes** — one note per speaker with relations
4. **MEMORY.md** — accumulated summary of key facts (like a real agent's working memory)
5. **Relations** — wiki-links between sessions, people, and topics

This mirrors how a real BM-powered agent would accumulate knowledge over time.

## Metrics

| Metric | Description | Use |
|--------|-------------|-----|
| Recall@K | Fraction of relevant docs in top K | Primary retrieval quality |
| MRR | Reciprocal rank of first relevant result | Ranking quality |
| Precision@K | Fraction of top K that are relevant | Result quality |
| Content Hit Rate | Expected answer text found in results | Chunk quality |
| Mean Latency | Average query time | Performance |
| P95 Latency | 95th percentile query time | Tail performance |
| LLM-Judge Score | Answer correctness rated by LLM | Answer quality (comparable to Mem0) |

## Current Baseline (BM Local, v0.18.5)

From our full 10-conversation LoCoMo run (1,982 queries):

| Metric | Value |
|--------|-------|
| Recall@5 | 76.4% |
| Recall@10 | 85.5% |
| MRR | 0.658 |
| Content Hit Rate | 25.4% |
| Mean Latency | 1,063ms |

By category:
| Category | N | R@5 |
|----------|---|-----|
| open_domain | 841 | 86.6% |
| multi_hop | 321 | 84.1% |
| adversarial | 446 | 67.0% |
| temporal | 92 | 59.1% |
| single_hop | 282 | 57.7% |

### Known improvement opportunities
1. **RRF scoring is broken** — hybrid search flattens all scores to ~0.016, destroying ranking (issue #577)
2. **Single-hop weakness** — specific fact lookups need better chunk-level matching
3. **Temporal weakness** — date-aware scoring or temporal indexing needed
4. **FTS finds observations that vector misses** — tagged observations like `[speaker] fact` are better matched by FTS

## Cloud Comparison Plan

BM Cloud should outperform local because:
- Better embedding models (OpenAI ada-003 vs local sentence-transformers)
- PostgreSQL + pgvector vs SQLite + sqlite-vec
- Server-grade hardware vs laptop

Expected improvements:
- Higher vector similarity scores → better ranking
- Better semantic matching → improved single-hop and temporal
- Lower latency (dedicated infra)

To test: run same benchmark with `bm_cloud.py` provider pointing at cloud API. Same corpus, same queries, different backend.

## CI Integration

```yaml
# .github/workflows/benchmark.yml
name: Benchmark
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  bench:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync
      - run: just download-locomo
      - run: just convert-locomo  
      - run: just index-locomo
      - run: just bench-locomo --output results/ci-latest.json
      - run: just compare-baseline results/ci-latest.json results/baselines/latest.json
      # Fail if recall@5 drops more than 2% from baseline
```

## Blog Post Angle

"We Benchmark in the Open"
- Here are our numbers. Here's how to reproduce them.
- We use academic datasets, not synthetic benchmarks we designed to win.
- Clone the repo, run `just full-locomo`, get the same results.
- We publish baselines with every release so you can track improvement over time.
- This is what "build things worth keeping" looks like.

## Implementation Plan

### Phase 1: Repo setup + LoCoMo
- Create `basic-memory-bench` repo
- Port LoCoMo converter from TypeScript to Python (using BM importer framework)
- Port harness from TypeScript to Python
- Publish baseline results
- README with full instructions

### Phase 2: Cloud provider + LongMemEval
- Add BM Cloud provider
- Run cloud vs local comparison
- Add LongMemEval dataset + converter
- Publish comparison results

### Phase 3: LLM-Judge + competitors
- Add answer evaluation mode
- Compare directly to Mem0's published LoCoMo numbers
- Optional: add Mem0/Supermemory providers for head-to-head
- Blog post with results

### Phase 4: CI + public dashboard
- GitHub Actions workflow for automated benchmarking
- Results dashboard (could be a BM Cloud MDX dashboard note!)
- Community contributions: custom datasets, new providers
