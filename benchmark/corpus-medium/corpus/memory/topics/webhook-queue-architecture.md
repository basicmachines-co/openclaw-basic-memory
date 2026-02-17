---
title: Webhook Queue Architecture
type: note
permalink: topics/webhook-queue-architecture
---

# Webhook Queue Architecture

## Observations
- [status] implemented
- [designed] 2026-02-04
- [implemented] 2026-02-11
- [owner] Maya Chen + Raj Patel

## Design
- Async ingestion queue built on tokio channels
- Events persisted to SQLite before processing (crash recovery + replay)
- Idempotent handlers keyed on Linear event ID — safe to replay
- Dead letter queue for events that fail processing after 3 retries
- Disk-backed overflow when in-memory queue exceeds configurable depth (default 5,000)
- 7-day TTL on stored events, configurable per team

## Performance
- Throughput: 500 events/sec on Raj's local benchmark (Feb 6)
- Production target: 5,000 events/sec sustained
- Current bottleneck: SQLite write path during WAL checkpoints
- Load testing in progress (STL-152) — stable at 2,000 evt/sec, degrades at 3,500

## Incident: Feb 12 Queue Backup
- Linear sent burst of 2,000 events from workspace migration
- Queue backed up for 20 minutes (14:22-14:42 PST)
- ~200 teams experienced delayed metric updates
- Fix: backpressure mechanism + disk-backed overflow
- No data loss — all events eventually processed
- Severity: P2

## Architecture Decisions
- SQLite over external queue (Redis/RabbitMQ): keeps single-binary deployment story
- Tokio channels over crossbeam: async-native, better backpressure semantics
- Event-sourced design: can replay any time window for debugging
- Compromise on TTL: Raj wanted shorter (3 days), Maya wanted longer (30 days), settled on 7

## Relations
- designed_by [[Maya Chen]]
- implemented_by [[Raj Patel]]
- relates_to [[Linear Integration]]
- relates_to [[Load Testing]]
