# OpenClaw Basic Memory Plugin

# Install dependencies
install:
    bun install
    uv tool install 'basic-memory[semantic] @ git+https://github.com/basicmachines-co/basic-memory.git@9259a7eb59be7aa8a72c3ec20d0740bd19ba9657' --with 'onnxruntime<1.24; platform_system == "Darwin" and platform_machine == "x86_64"'

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

# Run benchmark (Basic Memory, small corpus — default)
benchmark:
    bun benchmark/run.ts --corpus=small

# Run benchmark with per-query detail
benchmark-verbose:
    bun benchmark/run.ts --corpus=small --verbose

# Run all corpus sizes
benchmark-all:
    bun benchmark/run.ts --corpus=small
    bun benchmark/run.ts --corpus=medium
    bun benchmark/run.ts --corpus=large

# Run specific corpus size
benchmark-small:
    bun benchmark/run.ts --corpus=small --verbose

benchmark-medium:
    bun benchmark/run.ts --corpus=medium --verbose

benchmark-large:
    bun benchmark/run.ts --corpus=large --verbose

# Clean build artifacts and node_modules
clean:
    rm -rf node_modules bun.lock
