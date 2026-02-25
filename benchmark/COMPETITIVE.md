# LoCoMo Benchmark — Competitive Comparison

## Important Context

There are two different evaluation approaches being used across the industry:

1. **Retrieval metrics** (what we currently measure): Did the system find the right document? Recall@K, MRR, Precision@K.
2. **LLM-as-Judge** (what Mem0, Zep, MemMachine measure): Given retrieved context, did the LLM produce the correct answer? Binary 0/1 scored by GPT-4o.

These are NOT directly comparable. A system with perfect retrieval but bad prompting would score high on (1) and low on (2). A system with mediocre retrieval but excellent prompting could score higher on (2) than on (1).

**Our next step should be adding LLM-as-Judge evaluation so we can compare apples-to-apples.**

## Published LoCoMo Results (LLM-as-Judge Score)

### Overall Scores
| System | Overall | single_hop | multi_hop | temporal | open_domain | Notes |
|--------|---------|------------|-----------|----------|-------------|-------|
| **MemMachine** | **84.9%** | **93.3%** | 80.5% | 72.6% | 64.6% | Best overall. MacBook Pro M3, uses OpenAI API |
| **Mem0ᵍ** (graph) | **68.5%** | 65.7% | 47.2% | **58.1%** | **75.7%** | Best temporal (graph edges help) |
| **Mem0** | **66.9%** | 67.1% | **51.1%** | 55.5% | 72.9% | Best accuracy/speed/cost balance |
| **Zep** (corrected) | **58.4%** | — | — | — | — | Originally claimed 84%, Mem0 caught calculation error |
| **LangMem** | **58.1%** | 62.2% | 47.9% | 23.4% | 71.1% | OSS, 60s latency (unusable) |
| **OpenAI Memory** | **52.9%** | 63.8% | 42.9% | 21.7% | 62.3% | Fastest, but shallow recall |

Sources:
- Mem0: arxiv.org/pdf/2504.19413, mem0.ai/blog
- MemMachine: memmachine.ai/blog (Sep 2025)
- Zep correction: github.com/getzep/zep-papers/issues/5 (Mem0 found Zep inflated scores by including adversarial category incorrectly)

### Category Mapping Note
LoCoMo categories are numbered 1-5. Different vendors map them differently:
- Categories 1-4 are scored. Category 5 (adversarial) is excluded from official scoring.
- MemMachine swapped category IDs vs Mem0 (their cat 1 = multi_hop, cat 4 = single_hop)
- We used the Snap Research original mapping in our benchmarks

## Our Results (Retrieval Metrics — NOT directly comparable)

### Basic Memory Local (v0.18.5) — 1,982 queries, all 10 conversations
| Metric | Value |
|--------|-------|
| Recall@5 | 76.4% |
| Recall@10 | 85.5% |
| MRR | 0.658 |
| Content Hit Rate | 25.4% |
| Mean Latency | 1,063ms |

### By Category (Retrieval — Recall@5)
| Category | N | BM Local R@5 |
|----------|---|-------------|
| open_domain | 841 | 86.6% |
| multi_hop | 321 | 84.1% |
| adversarial | 446 | 67.0% |
| temporal | 92 | 59.1% |
| single_hop | 282 | 57.7% |

## Gap Analysis

### Where we're strong (relative to competitors)
- **Multi-hop: 84.1% retrieval** — Our graph structure helps here. Mem0 scores 51.1% on multi-hop answer quality, suggesting their retrieval for multi-hop might be weaker than ours.
- **Open-domain: 86.6% retrieval** — Strong baseline. All competitors score 62-76% on answer quality.
- **Local-first, no API costs** — Every competitor except LangMem requires cloud APIs. We run on SQLite.
- **Transparent** — All our data is plain text. You can see exactly what the system retrieved and why.

### Where we need to improve
- **Single-hop: 57.7% retrieval** — MemMachine gets 93.3% answer quality on single-hop. This is our biggest gap. They likely have better chunk-level fact extraction.
- **Temporal: 59.1% retrieval** — Mem0ᵍ gets 58.1% answer quality (similar!), but Supermemory and MemMachine do better with explicit temporal metadata. We need date-aware scoring.
- **Content Hit Rate: 25.4%** — We find the right notes but don't always surface the exact answer text. Better chunk extraction needed.
- **No LLM-as-Judge yet** — Can't directly compare to published numbers without this step.

### Architectural observations
1. **Mem0's selective extraction is key to their single-hop performance** — they extract "important sentences" before storing, creating atomic memory units. We store full conversations and rely on chunk matching. This is a fundamental tradeoff: their approach loses context, ours preserves it.

2. **MemMachine's multi-search approach** — they allow the agent to perform multiple memory searches per question. We do a single search. Multi-round retrieval could help.

3. **Supermemory's dual timestamps** — `documentDate` (when stored) vs `eventDate` (when it happened). We only have document dates. Adding event date extraction could close the temporal gap.

4. **Zep's benchmark scandal** — They claimed 84% by including adversarial category answers in the numerator but excluding adversarial questions from the denominator. Mem0's CTO publicly called this out. Lesson: benchmark integrity matters. We should be scrupulously honest.

5. **Everyone uses GPT-4o for embeddings** — We use local sentence-transformers. Cloud BM with OpenAI embeddings should close the quality gap significantly.

## Supermemory's LongMemEval Results

Supermemory focuses on LongMemEval (ICLR 2025) instead of LoCoMo:

| Category | Supermemory |
|----------|------------|
| single-session-user | ~65% |
| single-session-assistant | ~55% |
| single-session-preference | ~45% |
| multi-session | 71.4% |
| knowledge-update | ~60% |
| temporal-reasoning | 76.7% |

Key architectural differences:
- Chunk-based ingestion with contextual memory generation (resolves ambiguous references)
- Relational versioning: `updates`, `extends`, `derives` between memories
- Dual timestamps: `documentDate` + `eventDate`
- Hybrid search on atomic memories, then inject source chunk for detail

## Recommendations for Basic Memory

### Short-term (improve current numbers)
1. **Fix RRF scoring (#577)** — Hybrid search flattening is destroying ranking quality
2. **Better observation extraction in converter** — More atomic facts per session
3. **Use matched_chunk in scoring** — Already helped content hit rate from 14% to 85% on synthetic

### Medium-term (close competitive gaps)
4. **Add LLM-as-Judge evaluation** — Required for direct comparison
5. **Cloud benchmark with OpenAI embeddings** — Should significantly improve vector quality
6. **Multi-round retrieval** — Allow follow-up searches per query (like MemMachine)
7. **Event date extraction** — Separate "when stored" from "when it happened"

### Long-term (differentiation)
8. **Transparent benchmarking** — Publish everything, reproducible, no games. "We benchmark in the open."
9. **User-editable memory as advantage** — Our memories are plain text files. Users can correct, augment, reorganize. No competitor offers this.
10. **Schema-validated memories** — Picoschema ensures consistency. No competitor has this.

## What to publish

For the README, I'd suggest something like:

> **Retrieval Quality on LoCoMo (academic benchmark)**
> - 76.4% Recall@5 across 1,982 questions
> - 85.5% Recall@10
> - Sub-second mean latency (1,063ms)
> - Runs entirely local on SQLite — no cloud API required
> - [Reproduce these results →](link-to-benchmark-repo)

We should NOT claim direct comparison with Mem0/MemMachine until we add LLM-as-Judge. But we CAN say we benchmark on the same datasets they use, which is more than most tools do.
