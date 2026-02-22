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

## 🔧 before 1.0
- [x] Auto-capture (conversations)
- [x] Type checking — run `bun check-types` and fix errors
- [x] Lint — run `bun lint` and fix errors
- [x] README — update with actual setup instructions
- [x] Error handling — tool errors should be more informative
- [x] Cloud backend — plugin routes through BM MCP server; docs added in BASIC_MEMORY.md
- [x] `bm project list --format json` for reliable ensureProject check
- [x] CLI `edit-note` in basic-memory (native command available)
- [x] Publish to npm as @openclaw/basic-memory
- [x] OpenClaw `plugins install @openclaw/basic-memory` support
- [x] Auto-recall — configurable prompt injects active tasks + recent activity on agent_start
- [x] Health check / status command showing BM connection state
- [x] Slash commands for BM skills — /tasks, /reflect, /defrag, /schema
