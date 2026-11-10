#!/usr/bin/env bash
# Package the journey prototype as a self-contained artifact folder.
#   tools/build_journey.sh OUTDIR
# The page loads the action layer first (small chunk); three.js and the world load lazily in their own chunk.
set -euo pipefail
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT/assets/stills"; rm -f "$OUT"/*.js
npx esbuild journey/src/main.js --bundle --splitting --format=esm --minify --target=es2020 --outdir="$OUT" --entry-names=journey --chunk-names=world-[hash] 2>&1 | tail -2
for f in static static_lo terrain protos protos_lo marine; do base64 -w0 region/assets/$f.glb > "$OUT/assets/$f.glb.txt"; done
base64 -w0 sequence/assets/gift.glb > "$OUT/assets/gift.glb.txt"
cp region/assets/region.json "$OUT/assets/"; cp journey/assets/stills/*.jpg "$OUT/assets/stills/"
python3 - "$OUT" <<'PY'
import sys, re
out = sys.argv[1]
s = open('journey/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
names = ['static', 'static_lo', 'terrain', 'protos', 'protos_lo', 'marine', 'gift']
b64 = ', '.join(f"'{n}.glb': './assets/{n}.glb.txt'" for n in names)
boot = ("<script>window.TT_ASSETS = './assets/'; window.TT_GIFT = 'gift.glb'; window.TT_STILLS = './assets/stills/';\n"
        f"  window.TT_B64 = {{ {b64} }};</script>\n<script type=\"module\" src=\"./journey.js\"></script>\n")
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', boot, page, flags=re.S)
open(f'{out}/journey.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" "$OUT/assets" | awk '{print $5, $9}'
