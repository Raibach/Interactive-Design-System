#!/usr/bin/env bash
# Appends one log line to $CANVAS_LOG (default /data/canvas.log).
# Phase scripts call this instead of scattering ad-hoc echo redirections,
# so an operator finds every step in one file after a fresh-container failure.
set -uo pipefail
LOG="${CANVAS_LOG:-/data/canvas.log}"
printf '%s  %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG" 2>/dev/null || true
