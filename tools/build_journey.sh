#!/usr/bin/env bash
# Package the journey prototype as a self-contained artifact folder.
#   tools/build_journey.sh OUTDIR
#   TEXTILE=1 tools/build_journey.sh OUTDIR   the felt journey (experiment/textile-toytown): adds the split village,
#                                             the clay corner and corner.json, the felt stills; felt only (no look switch)
# The page loads the action layer first (small chunk); three.js and the world load lazily in their own chunk.
set -euo pipefail
jsonwrap() { printf "window.TT_DATA = window.TT_DATA || {}; window.TT_DATA[\"%s\"] = " "$(basename "$1")" > "$2.js"; cat "$1" >> "$2.js"; printf ";\n" >> "$2.js"; rm -f "$2"; }   # data as a script file (shareable pages)
b64wrap() { printf "window.TT_DATA = window.TT_DATA || {}; window.TT_DATA[\"%s\"] = \"" "$2" > "$3"; base64 -w0 "$1" >> "$3"; printf "\";\n" >> "$3"; }   # a model as a JS data file
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT/assets/stills"; rm -f "$OUT"/*.js "$OUT"/assets/*.glb.txt "$OUT"/assets/*.glb.js
npx esbuild journey/src/main.js --bundle --splitting --format=esm --minify --target=es2020 --outdir="$OUT" --entry-names=journey --chunk-names=world-[hash] 2>&1 | tail -2
BASE="static static_lo"; [ "${TEXTILE:-0}" = 1 ] && BASE=""   # the textile comparison loads the split village instead
for f in $BASE terrain protos protos_lo marine; do b64wrap region/assets/$f.glb $f.glb "$OUT/assets/$f.glb.js"; done
b64wrap sequence/assets/gift.glb gift.glb "$OUT/assets/gift.glb.js"
rm -f "$OUT"/assets/*.json "$OUT"/assets/*.json.js; jsonwrap region/assets/region.json "$OUT/assets/region.json"; cp journey/assets/stills/*.jpg "$OUT/assets/stills/"
if [ "${TEXTILE:-0}" = 1 ]; then
  for f in static_base static_base_lo corner_clay; do b64wrap textile/assets/$f.glb $f.glb "$OUT/assets/$f.glb.js"; done
  for f in corner houses; do jsonwrap textile/assets/$f.json "$OUT/assets/$f.json"; done
  cp journey/assets/stills_felt/*.jpg "$OUT/assets/stills/"   # felt stills (backdrop, fallback, toys, shop window)
fi
python3 - "$OUT" "${TEXTILE:-0}" <<'PY'
import sys, re
out, textile = sys.argv[1], sys.argv[2] == '1'
s = open('journey/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
names = (['terrain', 'protos', 'protos_lo', 'marine', 'gift', 'static_base', 'static_base_lo', 'corner_clay'] if textile
         else ['static', 'static_lo', 'terrain', 'protos', 'protos_lo', 'marine', 'gift'])
b64 = ', '.join(f"'{n}.glb': './assets/{n}.glb.js'" for n in names)
extra = " window.TT_TEXTILE_ASSETS = './assets/'; window.TT_LOOK = 'felt'; window.TT_ONLY_LOOK = true;" if textile else ''
boot = ("<script>window.TT_DATA_EXT = '.js'; window.TT_ASSETS = './assets/'; window.TT_GIFT = 'gift.glb'; window.TT_STILLS = './assets/stills/';" + extra + "\n"
        f"  window.TT_B64 = {{ {b64} }};</script>\n<script type=\"module\" src=\"./journey.js\"></script>\n")
if textile:
    page = page.replace('<title>Toy Town Journey Prototype</title>', '<title>Felt Toy Town</title>')
    page = page.replace('<span class="badge">Prototype · placeholder data</span>', '<span class="badge">Prototype · placeholder data · felt</span>')
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', boot, page, flags=re.S)
open(f'{out}/journey.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" "$OUT/assets" | awk '{print $5, $9}'
