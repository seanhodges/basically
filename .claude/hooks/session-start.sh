#!/usr/bin/env bash
# SessionStart hook: make sure a fresh cloud/web checkout is ready to run tests,
# typecheck, lint, and build. Idempotent and fast — installs only when something
# declared in package.json is actually missing.
set -euo pipefail

cd "$(dirname "$0")/../.."

install_deps() {
  echo "[session-start] Installing dependencies..."
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  echo "[session-start] Dependencies ready."
}

# A cloud/web container can ship a *partial* node_modules snapshot, so "the
# folder exists" isn't enough — list any declared dependency whose package
# folder is absent and reconcile if there are any. (This is what previously let
# @google/genai / openai / vite-plugin-pwa go missing despite node_modules being
# present.)
if [ ! -d node_modules ]; then
  install_deps
  exit 0
fi

missing=$(node -e '
  const fs = require("fs");
  const pkg = require("./package.json");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const missing = Object.keys(deps).filter((d) => !fs.existsSync("node_modules/" + d));
  if (missing.length) console.log(missing.join(" "));
')

if [ -n "$missing" ]; then
  echo "[session-start] Missing dependencies ($missing) — reconciling..."
  install_deps
else
  echo "[session-start] node_modules satisfies package.json — skipping install."
fi
