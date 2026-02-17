---
title: Linear Integration
type: note
permalink: topics/linear-integration
---

# Linear Integration

## Observations
- [status] MVP shipped in v0.9.0-beta.1
- [started] 2026-02-01
- [shipped] 2026-02-14
- [owner] Maya Chen
- [linear_workspace_id] ws_stl_prod_7x2k
- [api_rate_limit] 100 requests per minute

## Metrics Supported
- Cycle time (issue created → completed)
- Throughput (issues completed per sprint)
- Backlog age (time since issue created, still open)
- Planned: lead time, deployment frequency (DORA)

## Technical Details
- Webhook-based ingestion from Linear
- Events stored in SQLite with 7-day TTL
- Rate limited to 100 req/min on Linear's side
- Queue backed up on Feb 12 due to burst from large workspace migration
- Fix: backpressure mechanism with configurable max queue depth (default 5000)

## Open Issues
- Need to handle Linear workspace migrations gracefully
- Rate limit handling needs exponential backoff (currently linear retry)
- No support for Linear project-level metrics yet (only workspace-level)

## Relations
- built_by [[Maya Chen]]
- tested_by [[Raj Patel]]
- requested_by [[Cortex AI]]
- relates_to [[Webhook Queue Architecture]]
