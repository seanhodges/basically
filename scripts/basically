#!/usr/bin/env bash
# The Basically toolchain outside the browser: describe a machine, check a
# listing, build one into a file the machine loads, or run one and report its
# screen. `--help` names every operation. Rebuilds the bundle when it is stale,
# so there is one command to remember rather than a build step and a run step.
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE=scripts/headless/dist/cli.mjs
# Every part of the tool: the entry point and the build beside it, the
# operations under src/cli, and the runner core they share. A change to any of
# them has to reach the bundle.
SOURCES=(scripts/headless src/cli src/dialects/headless)

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
  echo "[basically] Building $BUNDLE..." >&2
  node scripts/headless/build.mjs >&2
fi

exec node "$BUNDLE" "$@"
