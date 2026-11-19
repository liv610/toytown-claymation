#!/usr/bin/env bash
# FULL review: the whole regression suite, one suite at a time (SwiftShader already uses every core for one page, and
# several timing checks — a camera flight, a beat's fast-forward — get flaky when suites compete for the CPU).
# Takes the better part of an hour here. For a small change use tools/quick_review.sh and the targeted checks instead
# (docs/REVIEW_WORKFLOW.md).
#   tools/run_regression.sh [OUTDIR]          PORT=8765 (default)
set -uo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-8765}; OUT=${1:-dist/regression}; mkdir -p "$OUT"
(cd web && npm run -s build:national >/dev/null 2>&1)
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then (cd web && setsid nohup python3 -m http.server "$PORT" >/dev/null 2>&1 &); sleep 1; fi
export URL="http://localhost:$PORT/national/index.html" TT_URL="http://localhost:$PORT" PORT
fail=0
for t in scene_m2a dev_review toytown_spike visitor_flow national_shell finder_e2e finder_map finder_states; do
  start=$(date +%s)
  timeout 3600 node tools/tests/$t.js "$OUT/$t" > "$OUT/$t.log" 2>&1; code=$?
  printf '%-15s %3s ok %2s fail  %4ss  exit %s\n' "$t" "$(grep -c '^ok' "$OUT/$t.log")" "$(grep -c '^FAIL' "$OUT/$t.log")" "$(( $(date +%s) - start ))" "$code"
  grep '^FAIL' "$OUT/$t.log" | head -5; [ "$code" = 0 ] || fail=1
done
node tools/tests/finder_unit.mjs > "$OUT/finder_unit.log" 2>&1 && echo "finder_unit     passed" || { echo "finder_unit     FAILED"; fail=1; }
[ "$fail" = 0 ] && echo "ALL PASSED" || echo "SOME FAILED (logs in $OUT)"
exit $fail
