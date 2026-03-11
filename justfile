# OpenClaw Basic Memory Plugin

# Fetch skills from GitHub
fetch-skills:
    bun scripts/fetch-skills.ts

# Install dependencies (bun + basic-memory CLI)
install:
    bun install
    bash scripts/setup-bm.sh
    bun scripts/fetch-skills.ts
    git config core.hooksPath .githooks

# Setup Basic Memory project
setup:
    bm project add openclaw ~/.basic-memory/openclaw/

# Type check
check-types:
    bun run check-types

# Lint
lint:
    bun run lint

# Lint fix (safe + unsafe)
lint-fix:
    bun run lint:fix

# Format and fix
fix:
    bun run lint:fix

# Run tests
test:
    bun test

# Run all checks
check: check-types lint

# Release readiness checks
release-check:
    bun run release:check

# Show exactly what would be published to npm
release-pack:
    npm pack --dry-run

# Publish current version to npm (requires npm auth)
release-publish:
    npm publish

# Bump version, publish, and push commit+tag
release version:
    npm version {{version}}
    npm publish
    git push origin main --follow-tags

# Clean build artifacts and node_modules
clean:
    rm -rf node_modules bun.lock
