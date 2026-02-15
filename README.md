# openclaw-basic-memory

Local-first knowledge graph plugin for OpenClaw — persistent memory with graph search and composited memory search.

## What this plugin does

The `openclaw-basic-memory` plugin integrates [Basic Memory](https://github.com/basicmachines-co/basic-memory) with OpenClaw to provide:

- **Composited `memory_search`** — queries MEMORY.md, the BM knowledge graph, and active tasks in parallel
- **File watching via `bm watch`** — automatically syncs workspace markdown files into the knowledge graph
- **Auto-capture** — records agent conversations as structured daily notes
- **Graph tools** — search, read, write, edit, delete, move, and navigate notes via `memory://` URLs

For a practical runbook, see [Memory + Task Flow](./MEMORY_TASK_FLOW.md).

## Requirements

1. **Basic Memory CLI** (`bm`) with `watch` command support:
   ```bash
   pip install basic-memory
   # or with uv:
   uv pip install basic-memory
   ```

2. **OpenClaw** with plugin support

## Installation

Clone and install:
```bash
git clone https://github.com/basicmachines-co/openclaw-basic-memory.git
cd openclaw-basic-memory
bun install
```

Add to your OpenClaw config:
```json5
{
  plugins: {
    load: {
      paths: ["~/dev/openclaw-basic-memory"]
    },
    entries: {
      "basic-memory": {
        enabled: true
      }
    }
  }
}
```

## Configuration

### Minimal (zero-config)
```json5
{
  "basic-memory": {
    enabled: true
  }
}
```

This uses sensible defaults: auto-generated project name, watches `~/.openclaw/workspace/memory/`, captures conversations.

### Full configuration
```json5
{
  "basic-memory": {
    enabled: true,
    config: {
      project: "my-agent",                          // BM project name (default: "openclaw-{hostname}")
      bmPath: "bm",                                 // Path to BM CLI binary
      projectPath: "~/.openclaw/workspace/memory/",  // Directory BM watches and indexes
      memoryDir: "memory/",                          // Relative memory dir for task scanning
      memoryFile: "MEMORY.md",                       // Working memory file for grep search
      autoCapture: true,                             // Index conversations automatically
      debug: false,                                  // Verbose logging
      cloud: {                                       // Optional cloud sync
        url: "https://cloud.basicmemory.com",
        api_key: "your-key"
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `project` | string | `"openclaw-{hostname}"` | Basic Memory project name |
| `bmPath` | string | `"bm"` | Path to Basic Memory CLI binary |
| `projectPath` | string | `"~/.openclaw/workspace/memory/"` | Directory for BM project data |
| `memoryDir` | string | `"memory/"` | Relative path for task scanning |
| `memoryFile` | string | `"MEMORY.md"` | Working memory file (grep-searched) |
| `autoCapture` | boolean | `true` | Auto-index agent conversations |
| `debug` | boolean | `false` | Enable verbose debug logs |
| `cloud` | object | — | Optional cloud sync config (`url` + `api_key`) |

Snake_case aliases (`memory_dir`, `memory_file`) are also supported.

## How It Works

### File Watching
On startup, the plugin spawns `bm watch --project <name>` as a long-running child process. This:
1. Performs an initial sync of all files in the project directory
2. Watches for file changes and re-indexes automatically
3. Runs until the plugin stops (SIGTERM on shutdown)

No custom file watcher needed — Basic Memory handles everything.

### Composited `memory_search`
When the agent calls `memory_search`, three sources are queried in parallel:

1. **MEMORY.md** — grep/text search with ±1 line context
2. **BM Knowledge Graph** — hybrid FTS + vector search (top 5 results with scores)
3. **Active Tasks** — scans `memory/tasks/` for non-done tasks

Results are formatted into clear sections:
```
## MEMORY.md
- matching lines with context...

## Knowledge Graph (memory/)
- note-title (0.85)
  > preview of content...

## Active Tasks
- **Task Name** (status: active, step: 3)
  context snippet...
```

### Memory + Task Management Flow

This plugin works best if you treat memory as three lanes:

1. **Working memory (`MEMORY.md`)** — short-horizon context and current focus.
2. **Knowledge graph (`memory/**/*.md`)** — long-term notes indexed by Basic Memory.
3. **Task notes (`memory/tasks/*.md`)** — active execution state for in-flight work.

Typical loop:

1. Capture or update notes/tasks with `bm_write` / `bm_edit`.
2. `bm watch` syncs markdown updates into the BM project index.
3. `memory_search` queries:
   - `MEMORY.md` text snippets
   - BM search results (semantic + FTS)
   - active tasks
4. Drill into one result with `memory_get` or `bm_read`.
5. Advance tasks by updating `current_step`, checkboxes, and context.
6. Complete tasks by setting `status: done` (done tasks are excluded from active task results).

```mermaid
flowchart LR
    A["Write/Update notes"] --> B["bm watch indexes changes"]
    B --> C["memory_search(query)"]
    C --> D["MEMORY.md"]
    C --> E["Knowledge Graph"]
    C --> F["Active Tasks"]
    D --> G["Composited result"]
    E --> G
    F --> G
    G --> H["memory_get / bm_read"]
    H --> A
```

### Task Note Shape (Recommended)

`memory_search` task extraction is strongest when task notes include:

- file location: `memory/tasks/*.md`
- frontmatter fields: `status:` and `current_step:`
- a `## Context` section for preview snippets

Example:

```markdown
---
title: auth-middleware-rollout
type: Task
status: active
current_step: 2
---

## Context
Rolling JWT middleware to all API routes. Staging verification is in progress.

## Plan
- [x] Implement middleware
- [x] Add refresh-token validation
- [ ] Roll out to staging
- [ ] Verify logs and error rates
```

To mark complete, update:

```yaml
status: done
```

Done tasks are filtered out of the `Active Tasks` section in composited `memory_search`.

### Auto-Capture
After each agent turn (when `autoCapture: true`), the plugin:
1. Extracts the last user + assistant messages
2. Appends them as timestamped entries to a daily conversation note (`conversations-YYYY-MM-DD`)
3. Skips very short exchanges (< 10 chars each)

## Agent Tools

### `bm_search`
Search the knowledge graph.
```typescript
bm_search({ query: "API design", limit: 5 })
```

### `bm_read`
Read a note by title, permalink, or `memory://` URL.
```typescript
bm_read({ identifier: "memory://projects/api-redesign" })
```

### `bm_write`
Create a new note.
```typescript
bm_write({ title: "Auth Strategy", content: "## Overview\n...", folder: "decisions" })
```

### `bm_edit`
Edit an existing note (`append`, `prepend`, `find_replace`, `replace_section`).
```typescript
bm_edit({ identifier: "weekly-review", operation: "append", content: "\n## Update\nDone." })
```

### `bm_delete`
Delete a note.
```typescript
bm_delete({ identifier: "notes/old-draft" })
```

### `bm_move`
Move a note to a different folder.
```typescript
bm_move({ identifier: "notes/my-note", newFolder: "archive" })
```

### `bm_context`
Navigate the knowledge graph — get a note with its observations and relations.
```typescript
bm_context({ url: "memory://projects/api-redesign", depth: 2 })
```

## Slash Commands

- **`/remember <text>`** — Save a quick note
- **`/recall <query>`** — Search the knowledge graph

## CLI Commands

```bash
openclaw basic-memory search "auth patterns" --limit 5
openclaw basic-memory read "projects/api-redesign"
openclaw basic-memory context "memory://projects/api-redesign" --depth 2
openclaw basic-memory recent --timeframe 24h
openclaw basic-memory status
```

## Troubleshooting

### `bm` command not found
```bash
which bm              # Check if installed
bm --version          # Check version
bm watch --help       # Verify watch command exists
```
If `bm watch` doesn't exist, update Basic Memory to the latest version.

### Jiti cache issues
```bash
rm -rf /tmp/jiti/ "$TMPDIR/jiti/"
openclaw gateway stop && openclaw gateway start
```

### Search returns no results
1. Check that `bm watch` is running (look for `[bm watch]` in logs)
2. Verify files exist in the project directory
3. Try `bm tool search-notes "your query" --project <name>` directly
4. Check project status: `bm project list`

## Development

```bash
bun run check-types   # Type checking
bun run lint          # Linting
bun test              # Run tests (156 tests)
```

### Project Structure
```
openclaw-basic-memory/
├── index.ts              # Plugin entry — spawns bm watch, registers tools
├── config.ts             # Configuration parsing
├── bm-client.ts          # Basic Memory CLI wrapper
├── tools/                # Agent tools
│   ├── search.ts         # bm_search
│   ├── read.ts           # bm_read
│   ├── write.ts          # bm_write
│   ├── edit.ts           # bm_edit
│   ├── delete.ts         # bm_delete
│   ├── move.ts           # bm_move
│   ├── context.ts        # bm_context
│   └── memory-provider.ts # Composited memory_search + memory_get
├── commands/
│   ├── slash.ts          # /remember, /recall
│   └── cli.ts            # openclaw basic-memory CLI
└── hooks/
    └── capture.ts        # Auto-capture conversations
```

## License

MIT — see LICENSE file.

## Links

- [Basic Memory](https://github.com/basicmachines-co/basic-memory)
- [OpenClaw](https://docs.openclaw.ai)
- [Issues](https://github.com/basicmachines-co/openclaw-basic-memory/issues)
