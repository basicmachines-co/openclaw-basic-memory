---
name: memory-notes
description: "How to write well-structured Basic Memory notes: frontmatter, observations with semantic categories, relations with wiki-links, and best practices for building a rich knowledge graph. Use when creating or improving notes."
---

# Memory Notes

Write well-structured notes that Basic Memory can parse into a searchable knowledge graph. Every note is a markdown file with three key sections: frontmatter, observations, and relations.

## Note Anatomy

```markdown
---
title: API Design Decisions
tags: [api, architecture, decisions]
---

# API Design Decisions

Background context explaining why this note exists and what it covers.

## Observations
- [decision] Use REST over GraphQL for simplicity #api
- [requirement] Must support versioning from day one
- [risk] Rate limiting needed for public endpoints

## Relations
- implements [[API Specification]]
- depends_on [[Authentication System]]
- relates_to [[Performance Requirements]]
```

### Frontmatter

Every note starts with YAML frontmatter:

```yaml
---
title: Note Title          # required — becomes the entity name in the knowledge graph
tags: [tag1, tag2]         # optional — for organization and filtering
type: note                 # optional — defaults to "note", use custom types with schemas
permalink: custom-path     # optional — auto-generated from title if omitted
---
```

- The `title` must match the `# Heading` in the body
- Tags are searchable and help with discovery
- Custom `type` values (Task, Meeting, Person, etc.) work with the schema system
- The `permalink` is auto-generated from the title (e.g., "API Design Decisions" → `api-design-decisions`). It stays stable across file moves and is the basis for `memory://` URLs. You rarely need to set it manually.

### Body / Context

Free-form markdown between the heading and the Observations section. Use this for:
- Background and motivation
- Summary of the topic
- Any prose that doesn't fit neatly into categorized observations

This content is indexed for full-text search but isn't parsed into structured entities.

## Observations

Observations are categorized facts — the atomic units of knowledge. Each one becomes a searchable entity in the knowledge graph.

### Syntax

```
- [category] Content of the observation #optional-tag
```

- **Square brackets** define the semantic category
- **Content** is the fact, decision, insight, or note
- **Hash tags** (optional) add extra metadata for filtering

### Categories Are Arbitrary

The category in brackets is free-form — use whatever label makes sense for the observation. There is no fixed list. The only rule is the `[category] content` syntax. Consistency within a project helps searchability, but invent categories freely.

A few examples to illustrate the range:

```
- [decision] Use PostgreSQL for primary data store
- [risk] Third-party API has no SLA guarantee
- [technique] Exponential backoff for retry logic #resilience
- [question] Should we support multi-tenancy at the DB level?
- [preference] Use Bun over Node for new projects
- [lesson] Always validate webhook signatures server-side
- [status] active
- [flavor] Ethiopian beans work best with lighter roasts
```

### Observation Tips

- **One fact per observation.** Don't pack multiple ideas into one line.
- **Be specific.** `[decision] Use JWT` is less useful than `[decision] Use JWT with 15-minute expiry for API auth`.
- **Use tags for cross-cutting concerns.** `[risk] Rate limiting needed #api #security` makes this findable under both topics.
- **Categories are queryable.** `search_notes("[decision]")` finds all decisions across your knowledge base.

## Relations

Relations create edges in the knowledge graph, linking notes to each other. They're how you build structure beyond individual notes.

### Syntax

```
- relation_type [[Target Note Title]]
```

- **relation_type** is a descriptive verb or phrase (snake_case by convention)
- **Double brackets** `[[...]]` identify the target note by title or permalink
- Relations are directional: this note → target note

### Relation Types

| Type | Purpose | Example |
|------|---------|---------|
| `implements` | One thing implements another | `- implements [[Auth Spec]]` |
| `requires` | Dependencies | `- requires [[Database Setup]]` |
| `relates_to` | General connection | `- relates_to [[Performance Notes]]` |
| `part_of` | Hierarchy/composition | `- part_of [[Backend Architecture]]` |
| `extends` | Enhancement or elaboration | `- extends [[Base Config]]` |
| `pairs_with` | Things that work together | `- pairs_with [[Frontend Client]]` |
| `inspired_by` | Source material | `- inspired_by [[CRDT Research Paper]]` |
| `replaces` | Supersedes another note | `- replaces [[Old Auth Design]]` |
| `depends_on` | Runtime/build dependency | `- depends_on [[MCP SDK]]` |
| `contrasts_with` | Alternative approaches | `- contrasts_with [[GraphQL Approach]]` |

### Inline Relations

Wiki-links anywhere in the note body — not just the Relations section — also create graph edges:

```markdown
We evaluated [[GraphQL Approach]] but decided against it because
the team has more experience with REST. See [[API Specification]]
for the full contract.
```

These create `references` relations automatically. Use the Relations section for explicit, typed relationships; use inline links for natural prose references.

### Relation Tips

- **Link liberally.** Relations are what turn isolated notes into a knowledge graph. When in doubt, add the link.
- **Create target notes if they don't exist yet.** `[[Future Topic]]` is valid — BM will resolve it when that note is created.
- **Use `build_context` to traverse.** `build_context(url="memory://note-title")` follows relations to gather connected knowledge.
- **Custom relation types are fine.** `taught_by`, `blocks`, `tested_in` — use whatever is descriptive.

## Memory URLs

Every note is addressable via a `memory://` URL, built from its permalink. These URLs are how you navigate the knowledge graph programmatically.

### URL Patterns

```
memory://api-design-decisions          # by permalink (title → kebab-case)
memory://docs/authentication           # by file path
memory://docs/authentication.md        # with extension (also works)
memory://auth*                         # wildcard prefix
memory://docs/*                        # wildcard suffix
memory://project/*/requirements        # path wildcards
```

### Project-Scoped URLs

In multi-project setups, prefix with the project name:

```
memory://main/specs/api-design         # "main" project, "specs/api-design" path
memory://research/papers/crdt          # "research" project
```

The first path segment is matched against known project names. If it matches, it's used as the project scope. Otherwise the URL resolves in the default project.

### Using Memory URLs

Memory URLs work with `build_context` to assemble related knowledge by traversing relations:

```
// Get a note and its connected context
build_context(url="memory://api-design-decisions")

// Wildcard — gather all docs
build_context(url="memory://docs/*")

// Direct read by permalink
read_note(identifier="memory://api-design-decisions")
```

## Writing Notes with Tools

### Creating a Note

```
write_note(
    title="API Design Decisions",
    folder="architecture",     // optional — organizes files on disk
    content="---
title: API Design Decisions
tags: [api, architecture]
---

# API Design Decisions

Context about the API design process.

## Observations
- [decision] Use REST for public API #api
- [requirement] Support API versioning from v1

## Relations
- implements [[API Specification]]
- relates_to [[Backend Architecture]]",
)
```

### Editing an Existing Note

Use `edit_note` to append, prepend, or find-and-replace within a note:

```
// Append new observations
edit_note(
    identifier="API Design Decisions",
    operation="append",
    heading="Observations",
    content="- [decision] Use OpenAPI 3.1 for spec generation #api",
)

// Add a new relation
edit_note(
    identifier="API Design Decisions",
    operation="append",
    heading="Relations",
    content="- depends_on [[Rate Limiter]]",
)
```

## Best Practices

1. **Start with context.** Before listing observations, explain *why* this note exists. Future-you (or your AI collaborator) will thank you.

2. **Observations over prose.** Categorized observations are searchable and structured. A paragraph of text is not. Prefer `[decision] X because Y` over burying the same fact in a paragraph.

3. **Build incrementally.** Add to existing notes rather than creating duplicates. Use `edit_note` to append new observations or relations as you learn more.

4. **Review AI-generated content.** When an AI writes notes for you, review them for accuracy. The AI captures structure well but may miss nuance.

5. **Use consistent titles.** Note titles are identifiers in the knowledge graph. `API Design Decisions` and `Api Design decisions` are different entities. Pick a convention and stick with it.

6. **Link related concepts.** The value of a knowledge graph compounds with connections. A note with zero relations is an island — useful, but not as powerful as a connected one.

7. **Let the graph grow naturally.** Don't try to design a perfect taxonomy upfront. Write notes as you work, add relations as connections emerge, and periodically use `/reflect` or `/defrag` to consolidate.

## ⚠️ write_note vs edit_note — Avoiding Data Loss

**`write_note` is destructive.** If a note with the same title already exists, `write_note` silently replaces it. This will destroy accumulated content in daily notes, logs, or any file that grows over time.

### Rules

- **New notes**: Use `write_note` — it creates the file and frontmatter correctly.
- **Existing notes**: Use `edit_note` — it modifies without replacing.
  - `operation: "append"` — add content to the end
  - `operation: "prepend"` — add content to the beginning
  - `operation: "find_replace"` — surgical text replacement
  - `operation: "replace_section"` — replace a specific heading section

### Common Mistake

```
# ❌ WRONG — destroys existing daily note content
write_note(title="2026-02-26", folder="memory", content="## New Section\n...")

# ✅ RIGHT — appends to existing daily note
edit_note(identifier="2026-02-26", operation="append", content="\n## New Section\n...")
```

**When in doubt, use `edit_note`.** It's always safe. `write_note` is only safe when you're certain the note doesn't exist yet or you intentionally want to replace it entirely.
