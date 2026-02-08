# openclaw-basic-memory 1.0 Roadmap

## ✅ Working (archive mode)
- [x] Plugin loads via `plugins.load.paths`
- [x] `bm_search` — search knowledge graph
- [x] `bm_read` — read notes (frontmatter stripped)
- [x] `bm_write` — create/update notes
- [x] `bm_edit` — append/prepend/find_replace/replace_section (read-modify-write)
- [x] `bm_context` — graph navigation via memory:// URLs
- [x] File watcher — indexes workspace markdown files into BM on change
- [x] Initial scan — indexes existing files on startup
- [x] Service lifecycle — proper start/stop
- [x] Workspace path — uses ctx.workspaceDir (not process.cwd())
- [x] Package name — @openclaw/basic-memory (matches manifest ID)
- [x] Slash commands — /remember and /recall
- [x] CLI commands — openclaw basic-memory search/read/context/recent/status

## 🔧 Needs fixing before 1.0
- [ ] Auto-capture (conversations) — needs testing, may double-write frontmatter
- [ ] Agent-memory mode — needs testing (replaces memory_search/memory_get)
- [ ] Type checking — run `bun check-types` and fix errors
- [ ] Lint — run `bun lint` and fix errors
- [ ] Test suite — zero tests currently
- [ ] README — update with actual setup instructions
- [ ] Error handling — tool errors should be more informative

## 🎯 Nice to have for 1.0
- [ ] `bm project list --format json` for reliable ensureProject check
- [ ] CLI `edit-note` in basic-memory (upstream PR) to replace read-modify-write
- [ ] Publish to npm as @openclaw/basic-memory
- [ ] OpenClaw `plugins install @openclaw/basic-memory` support

## 📋 Post-1.0
- [ ] Embedding search (BM has vector search, currently only FTS)
- [ ] Auto-recall (inject relevant context before agent starts, like memory-lancedb)
- [ ] Conversation summarization before indexing
- [ ] Bulk import/export
- [ ] Health check / status command showing BM connection state
- [ ] Metrics (notes indexed, searches, etc.)
