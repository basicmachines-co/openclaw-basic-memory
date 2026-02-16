# openclaw-basic-memory 1.0 Roadmap

## ✅ Working
- [x] Plugin loads via `plugins.load.paths`
- [x] `bm_search` — search knowledge graph
- [x] `bm_read` — read notes (body-only by default, optional raw frontmatter mode)
- [x] `bm_write` — create/update notes
- [x] `bm_edit` — append/prepend/find_replace/replace_section (native `bm tool edit-note`)
- [x] `bm_context` — graph navigation via memory:// URLs
- [x] `bm_delete` — delete notes
- [x] `bm_move` — move notes between folders
- [x] File watcher — indexes workspace markdown files into BM on change
- [x] Initial scan — indexes existing files on startup
- [x] Service lifecycle — proper start/stop
- [x] Workspace path — uses ctx.workspaceDir (not process.cwd())
- [x] Package name — @openclaw/basic-memory (matches manifest ID)
- [x] Slash commands — /remember and /recall
- [x] CLI commands — openclaw basic-memory search/read/edit/context/recent/status
- [x] **v2: Single mode** — removed archive/agent-memory/both mode split
- [x] **v2: Simplified config** — project, memoryDir, memoryFile, optional cloud block
- [x] **v2: Composited memory_search** — queries MEMORY.md + BM graph + active tasks in parallel
- [x] **v2: Nesting bug fix** — file watcher excludes BM project directory to prevent recursive copies

## 🔧 Needs fixing before 1.0
- [ ] Auto-capture (conversations) — needs testing, may double-write frontmatter
- [ ] Type checking — run `bun check-types` and fix errors
- [ ] Lint — run `bun lint` and fix errors
- [ ] README — update with actual setup instructions
- [ ] Error handling — tool errors should be more informative
- [ ] Cloud backend — implement actual cloud API client (currently config-only)

## 🎯 Nice to have for 1.0
- [ ] `bm project list --format json` for reliable ensureProject check
- [x] CLI `edit-note` in basic-memory (native command available)
- [ ] Publish to npm as @openclaw/basic-memory
- [ ] OpenClaw `plugins install @openclaw/basic-memory` support

## 📋 Post-1.0
- [ ] Embedding search (BM has vector search, currently only FTS)
- [ ] Auto-recall (inject relevant context before agent starts, like memory-lancedb)
- [ ] Conversation summarization before indexing
- [ ] Bulk import/export
- [ ] Health check / status command showing BM connection state
- [ ] Metrics (notes indexed, searches, etc.)
