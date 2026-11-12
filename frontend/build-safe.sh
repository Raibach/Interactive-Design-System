#!/bin/bash
# build-safe.sh — build the demo WITHOUT ever leaving the live folder broken.
#
# This is operational hardening, NOT application logic. Its one job is to make it
# impossible for AI work (a bad edit, a broken build) to destroy the folder the
# public demo serves. It builds into `dist-staging` — a scratch folder any work
# may destroy freely — verifies the result, and only then atomically swaps it
# into the live `dist`. A failed build leaves `dist` untouched, so the demo keeps
# serving the last good bundle.
set -euo pipefail
cd "$(dirname "$0")"

export PATH="$PWD/node_modules/.bin:$PATH"

STAGING="dist-staging"
LIVE="dist"

rm -rf "$STAGING"
export BUILD_OUTDIR="$STAGING"

echo "▶ typecheck"
tsc -b

echo "▶ vite build → $STAGING"
vite build --outDir "$STAGING"

echo "▶ build-lit-module → $STAGING"
node scripts/build-lit-module.mjs

echo "▶ preload-boot → $STAGING"
node scripts/preload-boot.mjs

# Verify the staging build is complete BEFORE touching the live folder.
if [ ! -f "$STAGING/index.html" ]; then
  echo "❌ BUILD FAILED: staging has no index.html — live dist is untouched." >&2
  exit 1
fi

# Swap. The live folder is only ever absent for the instant between the two renames;
# a failure anywhere above exits before this point and never touches it.
rm -rf "$LIVE.old"
if [ -d "$LIVE" ]; then mv "$LIVE" "$LIVE.old"; fi
mv "$STAGING" "$LIVE"
rm -rf "$LIVE.old"

echo "✅ BUILD SAFE: live dist swapped to the verified build."
