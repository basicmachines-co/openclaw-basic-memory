# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@openclaw/basic-memory` is a TypeScript OpenClaw plugin that integrates [Basic Memory](https://github.com/basicmachines-co/basic-memory) (a Python local-first knowledge management system) with the OpenClaw agent framework. It manages a persistent MCP stdio session to a `bm mcp` process, exposes 13 agent tools (including workspace/project management and cross-project operations), composited memory search/get providers, slash commands, CLI commands, and optional auto-capture of conversations.

## Development Commands

```bash
# Install dependencies (uses Bun)
bun install

# Run all unit tests (~156 tests, Bun native test runner)
bun test

# Run a single test file
bun test tools/search.test.ts

# Integration tests (requires basic-memory CLI installed)
bun run test:int

# Type checking (no emit)
bun run check-types

# Lint (Biome)
bun run lint

# Lint + auto-fix
bun run lint:fix

# All quality checks (type-check + lint)
just check

# Release readiness (types + tests + npm pack dry-run)
just release-check
```

## Architecture

### Plugin Lifecycle (`index.ts`)

The default export is an OpenClaw plugin object (`id: "basic-memory"`, `kind: "memory"`). The `register(api)` function:

1. Parses config via `parseConfig()` from `config.ts`
2. Creates a `BmClient` instance (the MCP stdio client)
3. Registers all tools, providers, hooks, commands, and the service lifecycle
4. The service `start()` launches the MCP process (`bm mcp --transport stdio --project <name>`), ensures the project exists, and sets the workspace directory
5. The service `stop()` tears down the MCP connection

### MCP Client (`bm-client.ts` — largest file, ~675 lines)

Central orchestration layer that:
- Spawns and manages a **persistent** `bm mcp --transport stdio` child process via `@modelcontextprotocol/sdk`
- Validates 15 required MCP tools at connect time
- Implements reconnection with bounded retries (500ms, 1s, 2s exponential backoff)
- Distinguishes recoverable errors (broken pipe, transport closed) from fatal errors
- All tool calls require `output_format: "json"` and extract `structuredContent.result`
- Public methods: `search`, `readNote`, `writeNote`, `editNote`, `deleteNote`, `moveNote`, `buildContext`, `recentActivity`, `indexConversation`, `ensureProject`, `listProjects`, `listWorkspaces`, `schemaValidate`, `schemaInfer`, `schemaDiff`, `searchByMetadata`
- All content methods accept an optional `project` parameter for cross-project operations
- `listProjects` accepts an optional `workspace` parameter for workspace-scoped listing

### Tools (`tools/`)

Each tool file exports a function that calls `api.registerTool()` with a TypeBox schema and handler. Tools delegate to `BmClient` methods and return OpenClaw-standard responses (`{ content: [{type: "text", text}], details? }`).

- `search.ts`, `read.ts`, `write.ts`, `edit.ts`, `delete.ts`, `move.ts`, `context.ts`, `project-list.ts`, `workspace-list.ts`, `schema-validate.ts`, `schema-infer.ts`, `schema-diff.ts` — thin wrappers around `BmClient`; all content tools accept an optional `project` param for cross-project operations
- `memory-provider.ts` — composited `memory_search` + `memory_get` providers. `memory_search` queries 3 sources in parallel: MEMORY.md (grep), BM knowledge graph (FTS + vector), and active task notes (YAML frontmatter scan)

### Commands & Hooks

- `commands/slash.ts` — `/remember` and `/recall` slash commands
- `commands/cli.ts` — `openclaw basic-memory <subcommand>` CLI registration
- `hooks/capture.ts` — auto-capture hook on `agent_end` events, writes timestamped daily conversation notes

### Configuration (`config.ts`)

Flexible config with defaults, snake_case aliases (`memory_dir`/`memory_file`), tilde/relative/absolute path resolution, unknown-key validation, and optional `cloud` settings.

## Key Patterns

- **TypeBox schemas** (`@sinclair/typebox`) for all tool parameter validation
- **Bun-native test runner** with `describe`/`it`/`expect` and `jest.fn()` mocking
- **ES modules** (`"type": "module"` in package.json)
- **Biome** for linting and formatting (configured in `biome.json`)
- **No build step** — TypeScript source is published directly (Bun/OpenClaw loads `.ts` files)
- **Strict TypeScript** with `noEmit` (type-checking only)

## Testing

- Unit tests live alongside source files (`*.test.ts`) and mock `BmClient` / `OpenClawPluginApi`
- Integration tests in `integration/` launch a real `bm mcp` process against a temp project
- `scripts/bm-local.sh` runs BM from a sibling `../basic-memory` checkout (via `uv`) or falls back to `bm` on PATH

## CI/CD

- **CI** (`.github/workflows/ci.yml`): PRs + main — type-check, lint, unit tests (Bun 1.3.8)
- **Release** (`.github/workflows/release.yml`): manual dispatch — bumps version, tags, publishes to npm, creates GitHub release. Requires `NPM_TOKEN` secret.

## Dependencies

- **Runtime**: `@modelcontextprotocol/sdk` (MCP client/transport), `@sinclair/typebox` (schema validation)
- **Peer**: `openclaw` (>=2026.1.29)
- **Dev**: `typescript`, `@biomejs/biome`, `@types/node`
- **External**: Basic Memory CLI (`bm`) must be installed separately (Python, installed via `uv`)
