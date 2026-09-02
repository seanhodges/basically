#!/usr/bin/env bash
# Run a BASIC listing on any registered machine and report its screen, as text
# or as a PNG. The listing arrives on stdin; everything else is arguments, and
# `--help` spells them out. Rebuilds the bundle when it is stale, so there is
# one command to remember rather than a build step and a run step.
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE=scripts/headless/dist/cli.mjs
# Both halves of the tool: the CLI and the build beside it, and the runner core
# the bundle pulls in from src/. A change to either has to reach the bundle.
SOURCES=(scripts/headless src/dialects/headless)

# Node cannot run this source tree directly - imports are written without
# extensions and the dialects read Vite's `import.meta.env` - so the bundle is
# not a cache to skip, it is the only runnable form. Rebuilt when it is missing
# or when anything it was built from is newer, which keeps an edit-then-run loop
# honest without paying esbuild's ~300ms on every run.
needs_build() {
  [ ! -f "$BUNDLE" ] && return 0
  [ -n "$(find "${SOURCES[@]}" -type f -newer "$BUNDLE" -print -quit)" ]
}

if needs_build; then
  echo "[run-listing] Building $BUNDLE..." >&2
  node scripts/headless/build.mjs >&2
fi

exec node "$BUNDLE" "$@"
