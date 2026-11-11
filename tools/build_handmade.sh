#!/usr/bin/env bash
# Package the handmade style test (paper / felt) as a self-contained artifact folder.
#   tools/build_handmade.sh OUTDIR
# Self-contained: the Marine's rig is plain data inside the bundle (src/marine_rig.js), so there is no model file to ship
# (a base64-encoded .glb was refused by the artifact's public-sharing review).
set -euo pipefail
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT"; rm -f "$OUT"/*.js; rm -rf "$OUT/assets"
npx esbuild handmade/src/main.js --bundle --format=esm --minify --target=es2022 --outfile="$OUT/handmade.js" 2>&1 | tail -1
python3 - "$OUT" <<'PY'
import sys, re
out = sys.argv[1]
s = open('handmade/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
boot = "<script type=\"module\" src=\"./handmade.js\"></script>\n"
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', boot, page, flags=re.S)
open(f'{out}/handmade.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" | awk '{print $5, $9}'
