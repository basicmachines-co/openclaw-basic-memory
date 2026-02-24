---
name: memory-metadata-search
description: "Structured metadata search for Basic Memory: query notes by custom frontmatter fields using equality, range, array, and nested filters. Use when finding notes by status, priority, confidence, or any custom YAML field rather than free-text content."
---

# Memory Metadata Search

Find notes by their structured frontmatter fields instead of (or in addition to) free-text content. Any custom YAML key in a note's frontmatter beyond the standard set (`title`, `type`, `tags`, `permalink`, `schema`) is automatically indexed as `entity_metadata` and becomes queryable.

## When to Use

- **Filtering by status or priority** — find all notes with `status: draft` or `priority: high`
- **Querying custom fields** — any frontmatter key you invent is searchable
- **Range queries** — find notes with `confidence > 0.7` or `score between 0.3 and 0.8`
- **Combining text + metadata** — narrow a text search with structured constraints
- **Tag-based filtering** — find notes tagged with specific frontmatter tags
- **Schema-aware queries** — filter by nested schema fields using dot notation

## Tool

Use the `search_notes` tool with the optional `metadata_filters`, `tags`, and `status` parameters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Text search query (can be empty for filter-only searches) |
| `metadata_filters` | object | Filter by frontmatter fields (see filter syntax below) |
| `tags` | string[] | Filter by frontmatter tags (all must match) |
| `status` | string | Filter by frontmatter status field |

## Filter Syntax

Filters are a JSON dictionary. Each key targets a frontmatter field; the value specifies the match condition. Multiple keys combine with **AND** logic.

### Equality

```json
{"status": "active"}
```

### Array Contains (all listed values must be present)

```json
{"tags": ["security", "oauth"]}
```

### `$in` (match any value in list)

```json
{"priority": {"$in": ["high", "critical"]}}
```

### Comparisons (`$gt`, `$gte`, `$lt`, `$lte`)

```json
{"confidence": {"$gt": 0.7}}
```

Numeric values use numeric comparison; strings use lexicographic comparison.

### `$between` (inclusive range)

```json
{"score": {"$between": [0.3, 0.8]}}
```

### Nested Access (dot notation)

```json
{"schema.version": "2"}
```

### Quick Reference

| Operator | Syntax | Example |
|----------|--------|---------|
| Equality | `{"field": "value"}` | `{"status": "active"}` |
| Array contains | `{"field": ["a", "b"]}` | `{"tags": ["security", "oauth"]}` |
| `$in` | `{"field": {"$in": [...]}}` | `{"priority": {"$in": ["high", "critical"]}}` |
| `$gt` / `$gte` | `{"field": {"$gt": N}}` | `{"confidence": {"$gt": 0.7}}` |
| `$lt` / `$lte` | `{"field": {"$lt": N}}` | `{"score": {"$lt": 0.5}}` |
| `$between` | `{"field": {"$between": [lo, hi]}}` | `{"score": {"$between": [0.3, 0.8]}}` |
| Nested | `{"a.b": "value"}` | `{"schema.version": "2"}` |

**Rules:**
- Keys must match `[A-Za-z0-9_-]+` (dots separate nesting levels)
- Operator dicts must contain exactly one operator
- `$in` and array-contains require non-empty lists
- `$between` requires exactly `[min, max]`

## Examples

### Metadata-only search (empty query)

```
search_notes(query="", metadata_filters={"status": "in-progress", "type": "spec"})
```

### Text search narrowed by metadata

```
search_notes(query="authentication", metadata_filters={"status": "draft"})
```

### Filter by tags

```
search_notes(query="", tags=["security", "oauth"])
```

### Filter by status shortcut

```
search_notes(query="planning", status="active")
```

### Combined text + metadata + tags

```
search_notes(
    query="oauth flow",
    metadata_filters={"confidence": {"$gt": 0.7}},
    tags=["security"],
    status="in-progress",
)
```

### High-priority notes in a specific project

```
search_notes(
    query="",
    metadata_filters={"priority": {"$in": ["high", "critical"]}},
    project="research",
    limit=10,
)
```

### Numeric range query

```
search_notes(query="", metadata_filters={"score": {"$between": [0.3, 0.8]}})
```

## Tag Search Shorthand

The `tag:` prefix in a query converts to a tag filter automatically:

```
# These are equivalent:
search_notes(query="tag:tier1")
search_notes(query="", tags=["tier1"])

# Multiple tags (comma or space separated) — all must match:
search_notes(query="tag:tier1,alpha")
```

## Example: Custom Frontmatter in Practice

A note with custom fields:

```markdown
---
title: Auth Design
type: spec
tags: [security, oauth]
status: in-progress
priority: high
confidence: 0.85
---

# Auth Design

## Observations
- [decision] Use OAuth 2.1 with PKCE for all client types #security
- [requirement] Token refresh must be transparent to the user

## Relations
- implements [[Security Requirements]]
```

Queries that find it:

```
# By status and type
search_notes(query="", metadata_filters={"status": "in-progress", "type": "spec"})

# By numeric threshold
search_notes(query="", metadata_filters={"confidence": {"$gt": 0.7}})

# By priority set
search_notes(query="", metadata_filters={"priority": {"$in": ["high", "critical"]}})

# By tag shorthand
search_notes(query="tag:security")

# Combined text + metadata
search_notes(query="OAuth", metadata_filters={"status": "in-progress"})
```

## Guidelines

- **Use metadata filters for structured queries.** If you're looking for notes by a known field value (status, priority, type), metadata filters are more precise than text search.
- **Use text search for content queries.** If you're looking for notes *about* something, text search is better. Combine both when you need precision.
- **Custom fields are free.** Any YAML key you put in frontmatter becomes queryable — no schema or configuration required.
- **Multiple filters are AND.** `{"status": "active", "priority": "high"}` requires both conditions.
- **Use empty query for filter-only searches.** Pass `query=""` with `metadata_filters` when you only need structured filtering.
- **Dot notation for nesting.** Access nested YAML structures with dots: `{"schema.version": "2"}` queries the `version` key inside a `schema` object.
- **Tags and status are convenient shortcuts.** Use the dedicated `tags` and `status` parameters for common fields, or `metadata_filters` for anything else.
