#!/bin/bash
# run-dev-local.sh — THE BUILDER, ON THE REPO'S OWN ENGINE (2026-10-10, owner's direction).
# Same as `npm run dev:local`, except node/npm/npx come from the repo's own
# copy at runtime/ instead of the machine's shared install. A copy lives in
# the repo; delete runtime/ to fall back to the machine's install.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
export PATH="$ROOT/runtime/node/bin:$PATH"
exec npm --prefix "$HERE" run dev:local
