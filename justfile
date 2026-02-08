# OpenClaw Basic Memory Plugin

# Install dependencies
install:
    bun install

# Type check
check-types:
    npx tsc --noEmit

# Lint
lint:
    npx @biomejs/biome check .

# Format and fix
fix:
    npx @biomejs/biome check --write --unsafe .

# Run all checks
check: check-types lint

# Clean build artifacts and node_modules
clean:
    rm -rf node_modules bun.lock
