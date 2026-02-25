# Development

## Local Setup

Clone and link locally for plugin development:

```bash
git clone https://github.com/basicmachines-co/openclaw-basic-memory.git
cd openclaw-basic-memory
bun install
openclaw plugins install -l "$PWD"
openclaw plugins enable openclaw-basic-memory --slot memory
openclaw gateway restart
```

Or load directly from a path in your OpenClaw config:

```json5
{
  plugins: {
    load: {
      paths: ["~/dev/openclaw-basic-memory"]
    },
    entries: {
      "openclaw-basic-memory": {
        enabled: true
      }
    },
    slots: {
      memory: "openclaw-basic-memory"
    }
  }
}
```

## Commands

```bash
bun run check-types   # Type checking
bun run lint          # Linting
bun test              # Run tests (156 tests)
bun run test:int      # Real BM MCP integration tests
```

## Integration Tests

Real end-to-end tests for `BmClient` in `integration/bm-client.integration.test.ts`. These launch a real `bm mcp --transport stdio` process and assert actual filesystem/index results.

```bash
bun run test:int
```

By default this uses `./scripts/bm-local.sh`, which runs BM from a sibling `../basic-memory` checkout via `uv run --project ...` when present, and falls back to `bm` on `PATH` otherwise.

Optional overrides:

```bash
BM_BIN=/absolute/path/to/bm bun run test:int
BASIC_MEMORY_REPO=/absolute/path/to/basic-memory bun run test:int
```

## Publishing to npm

This package is published as `@basicmemory/openclaw-basic-memory`.

```bash
# Verify release readiness (types + tests + npm pack dry run)
just release-check

# Inspect publish payload
just release-pack

# Authenticate once (if needed)
npm login

# Publish current version from package.json
just release-publish
```

For a full release (version bump + publish + push tag):

```bash
just release patch   # or: minor, major, 0.2.0, etc.
```

### GitHub Actions CI/CD

- CI workflow: `.github/workflows/ci.yml` runs on PRs and `main` pushes
- Release workflow: `.github/workflows/release.yml` runs manually (`workflow_dispatch`)
  1. Runs release checks
  2. Bumps version and creates a git tag
  3. Pushes commit + tag
  4. Publishes to npm
  5. Creates a GitHub release

Publishing uses npm OIDC trusted publishing — no secrets required.

## Project Structure

```
openclaw-basic-memory/
├── index.ts              # Plugin entry — manages MCP lifecycle, registers tools
├── config.ts             # Configuration parsing
├── bm-client.ts          # Persistent Basic Memory MCP stdio client
├── tools/                       # Agent tools
│   ├── search-notes.ts          # search_notes
│   ├── read-note.ts             # read_note
│   ├── write-note.ts            # write_note
│   ├── edit-note.ts             # edit_note
│   ├── delete-note.ts           # delete_note
│   ├── move-note.ts             # move_note
│   ├── build-context.ts         # build_context
│   ├── list-memory-projects.ts  # list_memory_projects
│   ├── list-workspaces.ts       # list_workspaces
│   ├── schema-validate.ts       # schema_validate
│   ├── schema-infer.ts          # schema_infer
│   ├── schema-diff.ts           # schema_diff
│   └── memory-provider.ts       # Composited memory_search + memory_get
├── commands/
│   ├── slash.ts          # /remember, /recall
│   ├── skills.ts         # /tasks, /reflect, /defrag, /schema
│   └── cli.ts            # openclaw basic-memory CLI
└── hooks/
    ├── capture.ts        # Auto-capture conversations
    └── recall.ts         # Auto-recall (active tasks + recent activity)
```
