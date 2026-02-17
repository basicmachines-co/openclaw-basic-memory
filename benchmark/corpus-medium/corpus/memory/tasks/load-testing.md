---
title: Load Testing
type: Task
status: active
created: 2026-02-14
permalink: tasks/load-testing
---

# Load Testing

## Observations
- [description] Load test webhook ingestion pipeline with simulated burst traffic — postmortem action item from Feb 12 incident
- [status] active
- [assigned_to] Raj Patel
- [started] 2026-02-16
- [current_step] 3
- [priority] high
- [target_date] 2026-02-21
- [issue] STL-152

## Steps
1. [x] Set up drill (Rust HTTP load testing tool) framework
2. [x] Write initial script: 100 concurrent producers at 50 events/sec
3. [ ] Profile SQLite write path bottleneck — stable at 2K evt/sec, drops at 3.5K
4. [ ] Optimize write batching — target 5,000 events/sec sustained
5. [ ] Run 1-hour soak test at target throughput
6. [ ] Document results and update capacity planning doc

## Context
- From Feb 14 postmortem action item #2: "Load test with simulated burst traffic"
- Feb 12 incident: Linear burst of 2,000 events backed up the queue for 20 min
- Current capacity: stable at 2,000 events/sec, degradation starts at 3,500
- Target: 5,000 events/sec without degradation
- SQLite write path is likely bottleneck — need to profile WAL checkpoint behavior
- Using drill because it's Rust-native and fits our toolchain

## Relations
- assigned_to [[Raj Patel]]
- relates_to [[Webhook Queue Architecture]]
- relates_to [[Linear Integration]]
