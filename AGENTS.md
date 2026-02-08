# AGENTS.md - Basic Memory Plugin Instructions

**For AI agents using the openclaw-basic-memory plugin**

This plugin provides sophisticated knowledge management through Basic Memory's knowledge graph. Use these tools and guidelines to help users build and navigate their persistent knowledge base.

## Available Tools

### 🔍 `bm_search`
**Purpose**: Search the knowledge graph for relevant notes, concepts, and connections  
**When to use**: When the user asks about topics, seeks information, or you need context for a discussion  
**Returns**: Ranked results with titles, content previews, and relevance scores

**Examples**:
```typescript
// User asks "What did we decide about the API design?"
bm_search({ query: "API design decisions", limit: 5 })

// Looking for context on a project
bm_search({ query: "authentication implementation", limit: 3 })

// Exploring a broad topic
bm_search({ query: "meeting notes client feedback", limit: 10 })
```

### 📖 `bm_read`
**Purpose**: Read full content of specific notes  
**When to use**: When search results show relevant notes that need detailed reading, or when you have a specific note identifier  
**Returns**: Complete note content with metadata

**Examples**:
```typescript
// Read a note found in search results
bm_read({ identifier: "projects/api-redesign" })

// Navigate to a memory URL
bm_read({ identifier: "memory://agents/decisions/auth-strategy" })

// Read by exact title
bm_read({ identifier: "Weekly Review 2024-02-01" })
```

### ✍️ `bm_write`
**Purpose**: Create new notes in the knowledge graph  
**When to use**: When users share important information, make decisions, or want to save insights for later  
**Best practices**: Use clear titles, organize in appropriate folders, structure with headings

**Examples**:
```typescript
// Save a decision or insight
bm_write({
  title: "API Authentication Decision",
  content: `# API Authentication Decision

## Context
The team discussed authentication options for the new API.

## Decision
We chose JWT tokens with refresh token rotation.

## Reasoning
- Better security than simple JWTs
- Familiar to the team
- Good ecosystem support

## Next Steps
- [ ] Implement JWT middleware
- [ ] Set up token refresh logic
- [ ] Update API documentation
`,
  folder: "decisions"
})

// Document a meeting
bm_write({
  title: "Client Meeting - February 8, 2024",
  content: `# Client Meeting - February 8, 2024

## Attendees
- John (client)
- Sarah (product)
- Me (engineering)

## Key Points
- Client wants faster search functionality
- Budget approved for additional features
- Timeline moved up to March 15

## Action Items
- [ ] Prototype search improvements
- [ ] Prepare feature estimate
- [ ] Schedule follow-up meeting
`,
  folder: "meetings"
})
```

### ✏️ `bm_edit`
**Purpose**: Modify existing notes incrementally  
**When to use**: To add updates, fix information, or organize existing content  
**Operations**: append, prepend, find_replace, replace_section

**Examples**:
```typescript
// Add an update to an existing note
bm_edit({
  identifier: "projects/api-redesign",
  operation: "append",
  content: `

## Update - February 8, 2024
Authentication implementation is complete. All tests passing.
Next: Deploy to staging environment.`
})

// Update a specific section
bm_edit({
  identifier: "weekly-review",
  operation: "replace_section",
  sectionTitle: "This Week",
  content: `## This Week
- ✅ Completed API authentication
- ✅ Client meeting went well
- 🔄 Working on search improvements
- ❌ Delayed deployment due to testing issues`
})

// Fix a specific detail
bm_edit({
  identifier: "team-contacts",
  operation: "find_replace",
  findText: "sarah@oldcompany.com",
  content: "sarah@newcompany.com"
})
```

### 🗑️ `bm_delete`
**Purpose**: Remove notes from the knowledge graph  
**When to use**: When content is outdated, duplicated, or no longer needed  
**Returns**: Confirmation of deletion

**Examples**:
```typescript
// Remove an old draft
bm_delete({ identifier: "notes/old-draft" })

// Clean up test notes
bm_delete({ identifier: "tests/test-1.0" })
```

### 📦 `bm_move`
**Purpose**: Move notes between folders for organization  
**When to use**: When reorganizing knowledge, archiving old content, or correcting folder placement  
**Returns**: Updated note with new location

**Examples**:
```typescript
// Archive a completed project
bm_move({ identifier: "projects/api-redesign", newFolder: "archive/projects" })

// Reorganize into a better folder
bm_move({ identifier: "notes/meeting-notes", newFolder: "meetings" })
```

### 🧭 `bm_context`
**Purpose**: Navigate the knowledge graph through semantic connections  
**When to use**: To explore related concepts, find connected information, or build comprehensive understanding  
**Returns**: Target note plus related notes with relationship information

**Examples**:
```typescript
// Explore connections around a project
bm_context({ 
  url: "memory://projects/api-redesign", 
  depth: 1 
})

// Deep dive into related concepts
bm_context({ 
  url: "memory://concepts/authentication", 
  depth: 2 
})

// Discover decision context
bm_context({ 
  url: "memory://decisions/database-choice", 
  depth: 1 
})
```

## Knowledge Graph Structure

### Understanding the Graph
Basic Memory organizes information as a **semantic knowledge graph** where:
- **Notes** are documents with content, titles, and metadata
- **Observations** are structured insights extracted from notes
- **Relations** connect related concepts, topics, and decisions

### Memory URLs
Use `memory://` URLs to navigate semantically:
- `memory://projects/api-redesign` - Direct reference to a note
- `memory://agents/decisions` - Category of decision-related notes  
- `memory://concepts/authentication` - All content related to authentication

### Organizational Patterns

**Recommended folder structure**:
- `projects/` - Project-specific documentation
- `decisions/` - Important decisions and rationale
- `meetings/` - Meeting notes and action items
- `concepts/` - Technical concepts and explanations
- `agent/` - Agent-captured observations and insights
- `weekly/` - Regular review notes

## Writing Best Practices

### Note Structure
Use consistent markdown structure for better organization:

```markdown
# Clear, Descriptive Title

## Context
Background information and current situation.

## Key Points
- Main insights or decisions
- Important details
- Relevant constraints

## Next Steps
- [ ] Specific action items
- [ ] Follow-up tasks
- [ ] Future considerations
```

### Observation Format
When capturing insights, use this structure:

```markdown
## Observations
- [Decision] We chose PostgreSQL over MongoDB for better ACID guarantees
- [Insight] User authentication patterns suggest social login preference
- [Risk] Current deployment process lacks proper rollback mechanism
- [Opportunity] Search performance could improve with better indexing
```

### Linking and Relations
Create connections between notes:
- Reference other notes by title: `As discussed in [[API Design Principles]]`
- Use consistent terminology for better semantic linking
- Tag important concepts with clear labels
- Cross-reference related decisions and implementations

## When to Use Each Tool

### Start with Search
**Always begin with `bm_search`** when:
- User asks about any topic
- You need context for a discussion
- Looking for relevant previous decisions
- Exploring what information already exists

### Read for Details
Use `bm_read` when:
- Search results show relevant notes that need full content
- Following up on specific references
- User asks for complete information on a known topic
- Exploring context relationships found in search

### Write for Capture
Use `bm_write` when:
- User shares important information to remember
- Decisions are made that should be documented
- Meeting notes or insights need to be preserved
- Creating structured documentation

### Edit for Updates
Use `bm_edit` when:
- Adding updates to existing notes
- Fixing or updating specific information
- Organizing existing content better
- Appending new insights to previous notes

### Context for Exploration
Use `bm_context` when:
- Exploring relationships between concepts
- Building comprehensive understanding
- Finding related information user might not know exists
- Navigating complex topic areas

## User Interaction Guidelines

### Be Proactive
- **Search first**: Before answering questions, search the knowledge graph
- **Suggest connections**: Point out related notes and concepts
- **Offer to save**: When users share important info, offer to document it
- **Recommend organization**: Help users structure their knowledge well

### Helpful Patterns
```
User: "What did we decide about the database?"
1. Search: bm_search({ query: "database decision", limit: 5 })
2. Read relevant: bm_read({ identifier: "decisions/database-choice" })
3. Provide answer with context
4. Ask: "Should I add any updates to this decision note?"

User: "I just had a great meeting with the client"
1. Ask for details
2. Offer: "Would you like me to create a meeting note to capture this?"
3. Write: bm_write({ title: "Client Meeting - [date]", ... })
4. Suggest: "I'll also add this to your weekly review notes"
```

### Memory URL Navigation
Help users discover their knowledge:
```typescript
// After finding a note about "API design"
"I found your API design notes. Let me explore related concepts..."
bm_context({ url: "memory://projects/api-design", depth: 2 })

// Show user what's connected to their decisions
bm_context({ url: "memory://decisions", depth: 1 })
```

## Working with User Memory Patterns

### Daily/Weekly Reviews
If users maintain review notes, help them:
```typescript
// Update weekly review
bm_edit({
  identifier: "weekly-review",
  operation: "replace_section", 
  sectionTitle: "This Week",
  content: "Updated accomplishments and next steps"
})
```

### Project Documentation
Keep project notes current:
```typescript
// Add project updates
bm_edit({
  identifier: "projects/current-sprint",
  operation: "append",
  content: "\n## Sprint Review\n- Completed authentication\n- Started search feature"
})
```

### Decision Tracking
Document important decisions:
```typescript
bm_write({
  title: "Technical Decision: Database Migration Approach",
  content: `# Database Migration Decision

## Problem
Current SQLite database can't handle increased load.

## Options Considered
1. Upgrade to PostgreSQL
2. Switch to MongoDB
3. Migrate to cloud database

## Decision
PostgreSQL with staged migration.

## Rationale
- Better performance characteristics
- Team expertise exists
- Strong ACID guarantees needed
- Migration path is well-understood
`,
  folder: "decisions"
})
```

## Error Handling

### Tool Failures
If Basic Memory tools fail:
1. Check if the Basic Memory service is running
2. Suggest user verify `bm` CLI installation
3. Recommend checking OpenClaw plugin configuration
4. Fall back to built-in memory tools if available

### Search No Results
When searches return empty:
- Try broader terms
- Suggest creating a new note for the topic
- Look for related concepts that might exist
- Offer to help organize information differently

### Note Not Found
When reading fails:
- Verify the identifier exists
- Suggest searching for similar titles
- Offer to create the note if it should exist
- Check for typos in memory URLs

## Integration Tips

### With Other Tools
The knowledge graph complements other tools:
- **Web search**: Save research findings as notes
- **File operations**: Reference files in knowledge notes  
- **Calendar**: Link meeting notes to calendar events
- **Task management**: Connect tasks to project notes

### With User Workflows
Support user patterns:
- **Morning review**: Search for yesterday's notes and updates
- **End of day**: Capture insights and plan next steps
- **Weekly planning**: Review project notes and decisions
- **Knowledge sharing**: Help organize information for others

## Privacy and Content Guidelines

### Sensitive Information
- Don't automatically save sensitive data (passwords, personal info)
- Ask before documenting confidential business information  
- Respect user preferences for what to capture
- Use appropriate folder organization for different privacy levels

### Content Quality
- Encourage clear, structured writing
- Help users create searchable content
- Suggest consistent terminology and naming
- Promote good information architecture

---

Remember: The knowledge graph becomes more valuable over time. Help users build it systematically and navigate it effectively. Focus on creating connections between ideas and making information easily discoverable.