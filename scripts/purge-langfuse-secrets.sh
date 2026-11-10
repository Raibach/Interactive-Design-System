#!/usr/bin/env bash
#
# purge-langfuse-secrets.sh — REWRITE PUBLISHED HISTORY SO THE BURNED LANGFUSE
# VALUES NO LONGER EXIST IN ANY COMMIT.
#
# The values are listed in governance/SECRET-ROTATION-2026-11-10.md and stored in
# governance/langfuse-hosted.env (gitignored). This script never prints them.
#
# It works on a throwaway mirror clone: the working tree you are sitting in is
# not touched, and nothing is pushed until the rewritten clone verifies clean.
#
#   scripts/purge-langfuse-secrets.sh           # show the plan, change nothing
#   scripts/purge-langfuse-secrets.sh --yes     # rewrite, verify, force-push
#
# Rotate the credentials FIRST. This only removes the values from the repository;
# it does not un-publish what was already served for two weeks.
#
# Afterwards every clone is stale. Re-clone, or run
#   git fetch --all --prune && git reset --hard origin/<branch>
# only after stashing any work you care about.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Raibach/Interactive-Design-System.git}"
ENV_FILE="${ENV_FILE:-governance/langfuse-hosted.env}"
MARKER="REDACTED"

# Every value that was published in the two service snapshots.
SECRET_KEYS=(
  DATABASE_URL
  SALT
  ENCRYPTION_KEY
  CLICKHOUSE_PASSWORD
  REDIS_AUTH
  NEXTAUTH_SECRET
  LANGFUSE_INIT_PROJECT_PUBLIC_KEY
  LANGFUSE_INIT_PROJECT_SECRET_KEY
  LANGFUSE_INIT_USER_PASSWORD
  LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY
  LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY
)

cd "$(git rev-parse --show-toplevel)"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "purge: $ENV_FILE is missing — it holds the values that must be redacted." >&2
  exit 1
fi

if [[ "${1:-}" != "--yes" ]]; then
  echo "purge: this would rewrite every ref of"
  echo "         $REPO_URL"
  echo "       and force-push the result. Re-run with --yes to proceed."
  exit 0
fi

value_of() {
  awk -v key="$1" 'index($0, key "=") == 1 { sub(/^[^=]*=/, ""); sub(/[[:space:]]+#.*$/, ""); print; exit }' "$ENV_FILE"
}

workdir="$(mktemp -d "${TMPDIR:-/tmp}/ids-purge.XXXXXX")"
chmod 700 "$workdir"
trap 'rm -rf "$workdir"' EXIT
umask 077

# git-filter-repo, from PATH or fetched once into the throwaway directory.
FILTER_REPO=()
if command -v git-filter-repo >/dev/null 2>&1; then
  FILTER_REPO=(git-filter-repo)
else
  echo "purge: git-filter-repo is not on PATH — fetching the pinned script"
  if ! curl -fsSL --max-time 60 -o "$workdir/git-filter-repo" \
      "https://raw.githubusercontent.com/newren/git-filter-repo/v2.47.0/git-filter-repo"; then
    echo "purge: could not fetch git-filter-repo; install it (brew install git-filter-repo) and retry." >&2
    exit 1
  fi
  chmod +x "$workdir/git-filter-repo"
  FILTER_REPO=(python3 "$workdir/git-filter-repo")
fi
expressions="$workdir/expressions.txt"
values="$workdir/values.txt"
: > "$expressions"
: > "$values"

for key in "${SECRET_KEYS[@]}"; do
  value="$(value_of "$key")"
  if [[ -z "$value" ]]; then
    echo "purge: $key is empty in $ENV_FILE — refusing to continue." >&2
    exit 1
  fi
  printf 'literal:%s==>%s\n' "$value" "$MARKER" >> "$expressions"
  printf '%s\n' "$value" >> "$values"
done

echo "purge: mirroring $REPO_URL"
git clone --quiet --mirror "$REPO_URL" "$workdir/repo.git"
cd "$workdir/repo.git"

echo "purge: rewriting $(git rev-list --all --count) commits across $(git for-each-ref --format='%(refname)' refs/heads refs/tags | wc -l | tr -d ' ') refs"
"${FILTER_REPO[@]}" --force --replace-text "$expressions" --replace-message "$expressions" >/dev/null

echo "purge: verifying no ref carries a burned value"
if git grep -I -F -f "$values" "$(git rev-list --all)" -- . >"$workdir/leftover.txt" 2>/dev/null; then
  echo "purge: FAILED — these blobs still contain a burned value:" >&2
  sed -E 's/:.*$/:[redacted]/' "$workdir/leftover.txt" | sort -u | head -20 >&2
  exit 1
fi
echo "purge: clean"

git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git reflog expire --expire=now --all
git gc --prune=now --quiet

echo "purge: force-pushing all branches and tags"
git push --force --all origin
git push --force --tags origin

cat <<EOF

purge: done. The rewritten history is published.

Still required, and not automatable from here:
  1. Rotate every value in governance/SECRET-ROTATION-2026-11-10.md, if not done yet.
  2. Ask GitHub to drop the old objects and cached views:
     https://support.github.com — "Repository > Remove data > cached views".
     Name the repository and the old blob ids 0315b397… and c3000be9….
  3. Mark the GitGuardian incident revoked, then resolved.
  4. Re-clone every other checkout; its refs still point at the old commits.
  5. Re-enable push protection under Settings → Code security.
EOF
