# openclaw-basic-memory

Local-first knowledge graph plugin for OpenClaw — persistent memory with graph search and semantic navigation.

## What this plugin does

The `openclaw-basic-memory` plugin integrates [Basic Memory](https://github.com/basicmachine/basic-memory) with OpenClaw to provide sophisticated knowledge management capabilities. It operates in two complementary modes:

### Archive Mode (default)
Runs alongside OpenClaw's built-in memory system:
- **File watching**: Automatically indexes markdown files in your workspace (`memory/`, `MEMORY.md`, etc.)
- **Auto-capture**: Records agent conversations as structured notes with observations and relations
- **Workspace integration**: Monitors file changes and re-indexes content automatically

### Agent-Memory Mode
Replaces OpenClaw's built-in memory tools with Basic Memory's knowledge graph:
- **Semantic search**: Uses embedding-based search across all notes and observations
- **Graph navigation**: Follow relations between concepts via `memory://` URLs
- **Rich context**: Retrieve notes with their connections and metadata

### Both Mode
Combines archive and agent-memory modes for maximum functionality.

## Requirements

1. **Basic Memory CLI**: Install the `bm` command-line tool
   ```bash
   # macOS (Homebrew)
   brew install basicmachine/tap/basic-memory
   
   # Or download from releases
   # https://github.com/basicmachine/basic-memory/releases
   ```

2. **OpenClaw**: This plugin requires OpenClaw with plugin support

## Installation

### From GitHub (Development)

1. Clone and build:
   ```bash
   git clone https://github.com/basicmachine/openclaw-basic-memory.git
   cd openclaw-basic-memory
   bun install
   bun run build
   ```

2. Install in OpenClaw:
   ```bash
   openclaw plugins install ./
   ```

3. Or for development (symlink):
   ```bash
   openclaw plugins install -l ./
   ```

### Development Setup

For development with live reloading, add to your OpenClaw config:

```json5
{
  plugins: {
    load: {
      paths: ["~/dev/openclaw-basic-memory"]
    },
    entries: {
      "basic-memory": {
        enabled: true,
        config: {
          mode: "both",
          debug: true
        }
      }
    }
  }
}
```

## Configuration

Add to your OpenClaw configuration file:

### Basic setup
```json5
{
  plugins: {
    entries: {
      "basic-memory": {
        enabled: true,
        config: {
          mode: "archive",              // "archive" | "agent-memory" | "both"
          project: "my-agent"          // Basic Memory project name
        }
      }
    }
  }
}
```

### Complete configuration
```json5
{
  plugins: {
    entries: {
      "basic-memory": {
        enabled: true,
        config: {
          mode: "both",                           // Operating mode
          project: "openclaw-my-machine",         // Project name (auto-generated)
          bmPath: "bm",                          // Path to BM CLI (default: "bm")
          projectPath: "~/.basic-memory/openclaw/", // Project storage location
          watchPaths: ["memory/", "MEMORY.md"],  // Files to monitor (archive mode)
          indexInterval: 300,                    // Re-index interval in seconds
          autoCapture: true,                     // Capture agent conversations
          debug: false                           // Enable debug logging
        }
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `"archive"` | Operating mode: `"archive"`, `"agent-memory"`, or `"both"` |
| `project` | string | `"openclaw-{hostname}"` | Basic Memory project name (created automatically) |
| `bmPath` | string | `"bm"` | Path to Basic Memory CLI binary |
| `projectPath` | string | `"~/.basic-memory/openclaw/"` | Filesystem path for project data |
| `watchPaths` | array | `["memory/", "MEMORY.md"]` | Paths to monitor for changes (archive mode) |
| `indexInterval` | number | `300` | Seconds between periodic re-indexing sweeps |
| `autoCapture` | boolean | `true` | Automatically index conversation content |
| `debug` | boolean | `false` | Enable verbose debug logs |

## Agent Tools

The plugin provides five agent tools for AI-driven knowledge management:

### `bm_search`
Search the Basic Memory knowledge graph for relevant notes and concepts.
```typescript
// Search for notes about "API design"
bm_search({ query: "API design", limit: 5 })
```

### `bm_read`
Read a specific note by title, permalink, or memory:// URL.
```typescript
// Read a specific note
bm_read({ identifier: "projects/api-redesign" })
bm_read({ identifier: "memory://agents/decisions/auth-strategy" })
```

### `bm_write`
Create new notes in the knowledge graph.
```typescript
// Create a note in the "projects" folder
bm_write({
  title: "API Authentication Strategy", 
  content: "## Overview\nWe decided to use JWT...", 
  folder: "projects"
})
```

### `bm_edit`
Edit existing notes with various operations:
- `append`: Add content to the end
- `prepend`: Add content to the beginning  
- `find_replace`: Replace specific text
- `replace_section`: Replace content under a heading

```typescript
// Add to end of note
bm_edit({
  identifier: "projects/api-redesign",
  operation: "append", 
  content: "\n## Update\nImplementation complete."
})

// Replace a section
bm_edit({
  identifier: "weekly-review",
  operation: "replace_section",
  sectionTitle: "This Week",
  content: "- Completed API design\n- Started implementation"
})
```

### `bm_context`
Navigate the knowledge graph using memory:// URLs to discover related concepts.
```typescript
// Get context around a concept with related notes
bm_context({ 
  url: "memory://projects/api-redesign", 
  depth: 2 
})
```

## Slash Commands

Quick commands for manual knowledge management:

### `/remember <text>`
Save a quick note to the knowledge graph.
```
/remember Met with the team about API changes. Need to update the auth flow.
```

### `/recall <query>`  
Search your knowledge graph.
```
/recall API authentication decisions
```

## CLI Commands

Direct command-line access via `openclaw basic-memory`:

### Search notes
```bash
openclaw basic-memory search "authentication patterns" --limit 5
```

### Read a specific note
```bash
openclaw basic-memory read "projects/api-redesign"
openclaw basic-memory read "memory://agents/decisions"
```

### Navigate with context
```bash
openclaw basic-memory context "memory://projects/api-redesign" --depth 2
```

### View recent activity
```bash
openclaw basic-memory recent --timeframe 24h
openclaw basic-memory recent --timeframe 7d
```

### Check plugin status
```bash
openclaw basic-memory status
```

## Modes Explained

### Archive Mode
Runs alongside OpenClaw's default memory system:
- Monitors workspace files for changes (`memory/`, `MEMORY.md`)
- Auto-captures agent conversations as structured notes
- Builds knowledge graph from existing markdown files
- OpenClaw's built-in memory tools remain available

**Use when**: You want persistent knowledge capture without disrupting existing workflows.

### Agent-Memory Mode  
Replaces OpenClaw's memory system entirely:
- Agent tools (`memory_search`, `memory_get`) are replaced with Basic Memory equivalents
- All agent memory operations use the knowledge graph
- Semantic search across all notes and observations
- Rich context with graph traversal

**Use when**: You want sophisticated knowledge graph capabilities as your primary memory system.

### Both Mode
Combines both modes:
- Archive mode captures and indexes content
- Agent-memory mode provides enhanced search and retrieval
- Maximum functionality with full knowledge graph features

**Use when**: You want the complete Basic Memory experience.

## Memory URLs

Basic Memory uses `memory://` URLs for semantic navigation:

```
memory://projects/api-redesign         # Direct note reference
memory://agents/decisions              # Category navigation
memory://concepts/authentication       # Concept exploration
```

These URLs work in:
- `bm_context` tool for graph traversal
- `bm_read` tool for direct access
- Basic Memory CLI for exploration

## Knowledge Graph Structure

The plugin organizes knowledge in a semantic graph:

### Notes
Markdown documents with:
- **Title**: Human-readable name
- **Content**: Full markdown content
- **Permalink**: Unique identifier
- **Folder**: Organizational category

### Observations
Structured insights extracted from content:
- **Category**: Type of observation (decision, insight, task, etc.)
- **Content**: The observation text
- **Relations**: Connections to other notes

### Relations
Semantic connections between notes:
- **References**: Direct mentions and links
- **Topics**: Shared concepts and themes  
- **Dependencies**: Logical relationships

## Archive Mode Details

### File Watching
Monitors these paths by default:
- `memory/` — General knowledge notes
- `MEMORY.md` — Long-term memory file (see AGENTS.md)

Configure additional paths:
```json5
{
  "watchPaths": ["memory/", "MEMORY.md", "projects/", "docs/"]
}
```

### Auto-Capture
After each agent conversation:
1. Extracts key information and decisions
2. Creates structured notes with observations
3. Links related concepts automatically
4. Indexes content for semantic search

Disable with `autoCapture: false`.

### Indexing
Periodic re-indexing (default: 5 minutes):
- Processes new and modified files
- Updates embedding vectors for search
- Rebuilds relation graph
- Maintains search performance

## Troubleshooting

### Basic Memory CLI not found
```
Error: bm command failed: bm tool search-notes
```

**Solutions**:
1. Install Basic Memory CLI: `brew install basicmachine/tap/basic-memory`
2. Verify installation: `which bm`
3. Set custom path: `"bmPath": "/usr/local/bin/bm"`

### Jiti cache issues
If you see TypeScript/import errors:

```bash
# Clear jiti cache
rm -rf ~/.cache/jiti
# Or set environment variable
export JITI_CACHE=false
```

### Project setup issues
```
Error: Project "openclaw-hostname" not found
```

The plugin creates projects automatically. If issues persist:
```bash
# Manually create project
bm project add openclaw-test ~/.basic-memory/openclaw/
```

### File watching not working
1. Check `watchPaths` configuration
2. Verify files exist in workspace
3. Check OpenClaw logs for indexing activity
4. Increase `indexInterval` if needed

### Search returns no results
1. Wait for initial indexing (check logs)
2. Verify content exists in watch paths
3. Try broader search terms
4. Check Basic Memory project status: `bm project list`

## Development

### Building
```bash
bun install
bun run build
bun run type-check
bun run lint
```

### Testing
```bash
bun test
```

### Plugin Development
When developing:
1. Use `debug: true` in config for verbose logging
2. Install with `-l` flag for live updates
3. Monitor OpenClaw logs for plugin activity
4. Test with `openclaw basic-memory status`

### Project Structure
```
openclaw-basic-memory/
├── index.ts              # Plugin entry point
├── config.ts             # Configuration schema
├── bm-client.ts          # Basic Memory CLI client
├── tools/                # Agent tools
│   ├── search.ts
│   ├── read.ts  
│   ├── write.ts
│   ├── edit.ts
│   └── context.ts
├── commands/             # User commands
│   ├── slash.ts          # /remember, /recall
│   └── cli.ts            # openclaw basic-memory
├── hooks/                # Event handlers
│   └── capture.ts        # Auto-capture logic
└── mode-b/               # Archive mode
    ├── archive.ts
    └── file-watcher.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- [Basic Memory Documentation](https://github.com/basicmachine/basic-memory)
- [OpenClaw Plugin Guide](https://docs.openclaw.com/plugins/)
- [GitHub Issues](https://github.com/basicmachine/openclaw-basic-memory/issues)