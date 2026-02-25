---
title: MEMORY
type: note
permalink: benchmark/memory
---

# MEMORY.md - Long-Term Memory

## About Me
- Name: Atlas 🔭. First boot: 2026-01-15.
- Running on dev machine (Ubuntu 24.04, always on)
- GitHub: atlas-bot (atlas@stellartools.dev), member of stellartools org

## About the Human
- Name: Maya Chen
- Role: Founder of Stellar Tools
- Timezone: America/Los_Angeles (PST/PDT)
- Prefers Slack over email for quick things
- Morning person — most productive before noon

## Team
- Maya (founder, full-stack)
- Raj Patel (eng, backend)
- Lena Vogt (design, part-time)
- All currently bootstrapped, no outside funding

## Stellar Tools — The Product
- **What:** Developer productivity CLI that aggregates metrics across GitHub, Linear, and Slack
- **Core differentiator:** Single pane of glass for engineering velocity — no dashboards, just terminal
- **Tech:** Rust, SQLite, gRPC, ships as single binary
- **OSS:** github.com/stellartools/stl (~1,800 stars)
- **Cloud:** app.stellartools.dev (hosted dashboard)
- **Pricing:** $9/mo per seat (team plan), free for solo devs
- **Revenue:** ~$2,100 MRR, 65 paying teams, growing 8% month-over-month
- **Active dev:** Linear integration, webhook pipeline, team analytics view

## Architecture Decisions
- Chose SQLite over Postgres for local-first story (2026-01-20)
- gRPC for service mesh, REST for public API (2026-01-22)
- Ship as single binary — no Docker required (key differentiator)
- Webhook ingestion via async queue, not synchronous processing (2026-02-01)

## Competitive Landscape
- **LinearB** — enterprise, expensive ($30/seat), heavy setup
- **Sleuth** — DORA metrics focused, SaaS only
- **Swarmia** — good UX but GitHub-only, no Linear integration
- **Our moat:** CLI-first, works offline, single binary, respects developer privacy

## Communication
- **Slack:** stellartools workspace (Maya + Raj + Lena)
- **Email:** maya@stellartools.dev, atlas@stellartools.dev
- **GitHub:** stellartools org
- **Linear:** Stellar Tools workspace (project key: STL)

## Opinions & Lessons
- "Ship the CLI first, web dashboard second" — Maya, every standup
- Rust compile times are brutal but the binary size payoff is worth it
- SQLite WAL mode is mandatory for concurrent reads during metric aggregation
- Never trust webhook delivery — always implement idempotent handlers
- The onboarding flow is our weakest point right now (users drop off at OAuth)