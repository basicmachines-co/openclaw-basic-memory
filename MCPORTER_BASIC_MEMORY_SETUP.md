# Basic Memory + MCPorter Setup

This guide shows how to connect MCPorter to Basic Memory in three common ways:

1. Local Basic Memory MCP over stdio
2. Remote Basic Memory Cloud MCP over HTTP/SSE
3. Self-hosted Basic Memory MCP over HTTP/SSE

It also covers daemon/keep-alive behavior and verification commands.

## Prerequisites

- Install Basic Memory CLI (`basic-memory` / `bm`)
- Install MCPorter (`mcporter`)
- Confirm both are on PATH:

```bash
basic-memory --version
mcporter --version
```

## How MCPorter Loads Config

By default MCPorter merges:

1. `~/.mcporter/mcporter.json` (home)
2. `./config/mcporter.json` (project, overrides home)

Use `--scope project` or `--scope home` with `mcporter config add` to control where entries are written.

## Option A: Local Basic Memory over stdio

### A1) One-off ad-hoc connection

Useful for quick testing without editing config:

```bash
mcporter list --stdio "basic-memory --project=personal mcp" --name basic-memory --schema
```

Then call tools:

```bash
mcporter call basic-memory.list_memory_projects
```

### A2) Persist local stdio server in MCPorter config

```bash
mcporter config add basic-memory \
  --transport stdio \
  --command "basic-memory --project=personal mcp" \
  --scope project
```

Verify:

```bash
mcporter config get basic-memory
mcporter list basic-memory --schema
```

### A3) Equivalent JSON config entry

Add this under `mcpServers` in `config/mcporter.json` (or `~/.mcporter/mcporter.json`):

```json
{
  "mcpServers": {
    "basic-memory": {
      "command": "basic-memory",
      "args": ["--project=personal", "mcp"]
    }
  }
}
```

## Option B: Remote Basic Memory Cloud

Cloud endpoint:

- `https://cloud.basicmemory.com/mcp`

### B1) Add remote server (project config)

```bash
mcporter config add basic-memory-cloud \
  --transport http \
  --url "https://cloud.basicmemory.com/mcp" \
  --scope project
```

### B2) Authenticate (OAuth flow)

```bash
mcporter auth basic-memory-cloud
```

Notes:

- If your deployment uses bearer tokens instead of OAuth, add headers:

```bash
mcporter config add basic-memory-cloud \
  --transport http \
  --url "https://cloud.basicmemory.com/mcp" \
  --header "Authorization: Bearer ${BASIC_MEMORY_API_KEY}" \
  --scope project
```

## Option C: Self-hosted Basic Memory (Docker/remote)

If you expose MCP at something like `http://localhost:8000/mcp`:

```bash
mcporter config add basic-memory-selfhosted \
  --transport sse \
  --url "http://localhost:8000/mcp" \
  --scope project
```

For ad-hoc cleartext HTTP (without saving), include `--allow-http`:

```bash
mcporter list --http-url "http://localhost:8000/mcp" --allow-http --name basic-memory-selfhosted
```

## Keep Servers Warm (Daemon / Keep-Alive)

By default, many servers are ephemeral. To keep Basic Memory server processes warm, set lifecycle:

```json
{
  "mcpServers": {
    "basic-memory": {
      "command": "basic-memory",
      "args": ["--project=personal", "mcp"],
      "lifecycle": "keep-alive"
    }
  }
}
```

Daemon controls:

```bash
mcporter daemon start
mcporter daemon status
mcporter daemon restart
mcporter daemon stop
```

## Basic Memory Project Mode Notes

Basic Memory MCP behavior depends on how the server is started:

- `--project=<name>` on server start: single-project mode (locked to one project)
- No `--project`: tools may require explicit `project` parameters (multi-project mode)

If you want deterministic behavior for agents/automation, prefer starting with `--project=<name>`.

## Verification Checklist

```bash
mcporter config list
mcporter config get basic-memory
mcporter list basic-memory --schema
mcporter call basic-memory.list_memory_projects
```

If calls fail:

1. Confirm the underlying server command runs directly: `basic-memory --project=personal mcp`
2. Re-run auth for remote servers: `mcporter auth <name>`
3. Check daemon status if using keep-alive: `mcporter daemon status`
4. Use `--verbose` on MCPorter commands to inspect connection setup details
