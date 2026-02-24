#!/usr/bin/env bash
# Install basic-memory CLI via uv from the latest main branch.
# Idempotent — safe to re-run. Fails gracefully when uv is absent.
set -euo pipefail

BM_REPO="https://github.com/basicmachines-co/basic-memory.git"
BM_REF="${BM_REF:-main}"

# ── check for uv ──────────────────────────────────────────────────
if ! command -v uv >/dev/null 2>&1; then
  echo "⚠  uv not found — skipping basic-memory install."
  echo "   Install uv:  brew install uv"
  echo "            or:  curl -LsSf https://astral.sh/uv/install.sh | sh"
  echo "   Then re-run:  bash scripts/setup-bm.sh"
  exit 0
fi

# ── install basic-memory[semantic] ────────────────────────────────
echo "Installing basic-memory from ${BM_REPO}@${BM_REF} ..."
uv tool install \
  "basic-memory[semantic] @ git+${BM_REPO}@${BM_REF}" \
  --with 'onnxruntime<1.24; platform_system == "Darwin" and platform_machine == "x86_64"' \
  --force

# ── verify ────────────────────────────────────────────────────────
if ! command -v bm >/dev/null 2>&1; then
  echo "❌  bm binary not found on PATH after install."
  echo "   You may need to add uv's bin directory to your PATH."
  exit 1
fi

echo "✅  $(bm --version)"
