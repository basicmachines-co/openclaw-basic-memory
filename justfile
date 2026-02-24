# OpenClaw Basic Memory Plugin

# Install dependencies (bun + basic-memory CLI)
install:
    bun install
    bash scripts/setup-bm.sh

# Setup Basic Memory project
setup:
    bm project add openclaw ~/.basic-memory/openclaw/

# Type check
check-types:
    npx tsc --noEmit

# Lint
lint:
    npx @biomejs/biome check .

# Lint fix (safe + unsafe)
lint-fix:
    npx @biomejs/biome check --write --unsafe .

# Format and fix
fix:
    npx @biomejs/biome check --write --unsafe .

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
