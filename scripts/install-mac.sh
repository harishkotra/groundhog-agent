#!/usr/bin/env bash
# Groundhog Agent: one-shot setup on a fresh Mac.
#
#   ./scripts/install-mac.sh                 # set up and build
#   ./scripts/install-mac.sh --run           # set up, then serve on :8787
#   ./scripts/install-mac.sh --harness 3     # set up, then measure 3 runs per task
#
# Pins opencode to the version the shipped dataset was measured on. Pass
# --latest to take whatever npm ships today (your numbers will differ).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCODE_VERSION="1.15.13"
DO_RUN=0
HARNESS_RUNS=0
LATEST=0

while [ $# -gt 0 ]; do
  case "$1" in
    --run) DO_RUN=1 ;;
    --harness) HARNESS_RUNS="${2:-3}"; shift ;;
    --latest) LATEST=1 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf "\033[1;33m›\033[0m %s\n" "$1"; }
need() { command -v "$1" >/dev/null 2>&1; }

say "checking node"
if ! need node; then
  echo "node is missing. install it first:  brew install node" >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "node $NODE_MAJOR is too old, need 20 or newer" >&2
  exit 1
fi
echo "  node $(node -v) · npm $(npm -v)"

say "checking opencode"
if ! command -v opencode >/dev/null 2>&1 && [ ! -x "$HOME/.opencode/bin/opencode" ]; then
  if [ "$LATEST" = "1" ]; then
    echo "  installing opencode-ai@latest via npm"
    npm install -g opencode-ai@latest
  else
    echo "  installing opencode-ai@$OPENCODE_VERSION via npm (dataset version)"
    npm install -g "opencode-ai@$OPENCODE_VERSION"
  fi
else
  OC_BIN="$(command -v opencode || echo "$HOME/.opencode/bin/opencode")"
  echo "  found $("$OC_BIN" --version) at $OC_BIN"
fi

OC_BIN="$(command -v opencode || echo "$HOME/.opencode/bin/opencode")"
OC_VERSION="$("$OC_BIN" --version)"
if [ "$OPENCODE_VERSION" != "latest" ] && [ "$OC_VERSION" != "$OPENCODE_VERSION" ] && [ "$LATEST" != "1" ]; then
  echo "  note: dataset was measured on $OPENCODE_VERSION, this machine has $OC_VERSION"
fi

say "installing web dependencies"
npm --prefix "$ROOT/web" install --no-audit --no-fund

say "building the UI"
npm --prefix "$ROOT/web" run build
node "$ROOT/scripts/copy-data.mjs"

if [ ! -f "$HOME/.hermes/config.yaml" ] && [ -z "${PARTICLE_API_KEY:-}" ] && [ -z "${GROUNDHOG_API_KEY:-}" ]; then
  say "no API key found"
  echo "  export GROUNDHOG_API_KEY=... before measuring, or type one into the UI"
fi

if [ "$HARNESS_RUNS" -gt 0 ]; then
  say "measuring $HARNESS_RUNS real runs per task"
  node "$ROOT/harness/run-matrix.mjs" --runs "$HARNESS_RUNS" --tasks tight,loose --parallel 2
  node "$ROOT/scripts/copy-data.mjs"
  npm --prefix "$ROOT/web" run build
  node "$ROOT/scripts/copy-data.mjs"
fi

if [ "$DO_RUN" = "1" ]; then
  say "serving on http://127.0.0.1:8787 (HOST=0.0.0.0 for tailnet access)"
  exec node "$ROOT/server.mjs"
fi

say "done"
echo "  start it:            node $ROOT/server.mjs"
echo "  from another Mac:    HOST=0.0.0.0 node $ROOT/server.mjs"
echo "  run as a service:    ./scripts/install-service.sh"
