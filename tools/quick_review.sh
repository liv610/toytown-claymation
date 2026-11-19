#!/usr/bin/env bash
# QUICK review of a small visual change: rebuild the bundle (a couple of seconds), make sure the local server is up,
# and render only the named views (see web/national/src/review_views.json). No full shot library, stills or videos.
#   tools/quick_review.sh lid                    a group (lid, hall, door) or view names
#   SIZE=desktop,phone tools/quick_review.sh hall-front lid-story
#   PORT=8765 (default) · OUT=dist/review (default; git-ignored)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-8765}; OUT=${OUT:-dist/review}
(cd web && npm run -s build:national >/dev/null 2>&1)
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then (cd web && setsid nohup python3 -m http.server "$PORT" >/dev/null 2>&1 &); sleep 1; fi
rm -rf "$OUT"; URL="http://localhost:$PORT/national/index.html" node tools/tests/review_shots.js "$OUT" "$@"
