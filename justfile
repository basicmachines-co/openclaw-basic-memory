# OpenClaw Basic Memory Plugin

# Install dependencies
install:
    bun install
    uv tool install 'basic-memory[semantic]' --with 'onnxruntime<1.24; platform_system == "Darwin" and platform_machine == "x86_64"'

# Setup Basic Memory project
setup:
    bm project add openclaw ~/.basic-memory/openclaw/

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
