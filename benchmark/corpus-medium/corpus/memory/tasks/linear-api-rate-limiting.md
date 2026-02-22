---
title: Linear API Rate Limiting
type: Task
status: done
created: 2026-02-06
completed: 2026-02-13
permalink: tasks/linear-api-rate-limiting
---

# Linear API Rate Limiting

## Observations
- [description] Implement exponential backoff with jitter for Linear API 429 responses and batch issue fetches via GraphQL
- [status] done
- [assigned_to] Raj Patel
- [started] 2026-02-06
- [completed] 2026-02-13
- [priority] high
- [issue] STL-139

## Steps
1. [x] Research Linear API rate limit behavior (100 req/min, 429 + Retry-After header)
2. [x] Implement exponential backoff: base 1s, max 30s, jitter ±500ms
3. [x] Add GraphQL batching — fetch up to 50 issues per request
4. [x] Test against large workspace (12,000 issues) — stays within limits
5. [x] Code review and merge

## Context
- Maya hit the rate limit during testing on Feb 6 with a large Linear workspace
- Original retry logic was linear (1s, 2s, 3s) — too aggressive
- Chose Option B from architecture discussion: simple backoff over token bucket
- GraphQL batching reduced API calls by ~40x for initial sync
- Tested and confirmed stable on Feb 13

## Relations
- assigned_to [[Raj Patel]]
- relates_to [[Linear Integration]]
- relates_to [[Maya Chen]]
