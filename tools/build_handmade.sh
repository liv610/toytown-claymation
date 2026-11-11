#!/usr/bin/env bash
# Package the handmade style test (paper / felt) as a self-contained artifact folder.
#   tools/build_handmade.sh OUTDIR
# Artifacts can't serve .glb, so the Marine's rig ships base64-encoded and the page decodes it (window.HM_B64).
set -euo pipefail
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT/assets"; rm -f "$OUT"/*.js
npx esbuild handmade/src/main.js --bundle --format=esm --minify --target=es2022 --outfile="$OUT/handmade.js" 2>&1 | tail -1
base64 -w0 realtime/assets/marine.glb > "$OUT/assets/marine.glb.txt"
python3 - "$OUT" <<'PY'
import sys, re
out = sys.argv[1]
s = open('handmade/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
boot = ("<script>window.HM_ASSETS = './assets/'; window.HM_B64 = { 'marine.glb': './assets/marine.glb.txt' };</script>\n"
        "<script type=\"module\" src=\"./handmade.js\"></script>\n")
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', boot, page, flags=re.S)
open(f'{out}/handmade.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" "$OUT/assets" | awk '{print $5, $9}'
