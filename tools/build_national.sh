#!/usr/bin/env bash
# Package the national map prototype as a self-contained artifact folder:  tools/build_national.sh OUTDIR
# On experiment/textile-toytown the Toy Town pin opens the felt journey (Felt Toy Town); TOYTOWN_URL overrides.
set -euo pipefail
jsonwrap() { printf "window.TT_DATA = window.TT_DATA || {}; window.TT_DATA[\"%s\"] = " "$(basename "$1")" > "$2.js"; cat "$1" >> "$2.js"; printf ";\n" >> "$2.js"; rm -f "$2"; }   # data as a script file (shareable pages)
b64wrap() { printf "window.TT_DATA = window.TT_DATA || {}; window.TT_DATA[\"%s\"] = \"" "$2" > "$3"; base64 -w0 "$1" >> "$3"; printf "\";\n" >> "$3"; }   # a model as a JS data file
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT/assets"
# national.js is the small page shell (app.js: ways to help, dialogs); the 3D map and three.js are a lazily loaded
# chunk (main-HASH.js) next to it. Publish every .js file in OUTDIR.
rm -f "$OUT"/*.js
npx esbuild national/src/app.js --bundle --splitting --format=esm --minify --target=es2022 --outdir="$OUT" --entry-names=national --chunk-names=[name]-[hash] 2>&1 | tail -1
# three.js' GLTFLoader carries a 1-px AVIF test image (EXT_texture_avif support check). AVIF is not a type a shareable
# page may carry, and no model here uses AVIF textures: blank it (the check then reports "not supported").
sed -i -E 's#data:image/avif;base64,[A-Za-z0-9+/=]+##g' "$OUT"/*.js
npm run --silent build:national 2>&1 | tail -1
rm -f "$OUT"/assets/*.json "$OUT"/assets/*.json.js
for f in states-albers-10m maple neighbours-albers campaigns.test; do jsonwrap national/assets/$f.json "$OUT/assets/$f.json"; done
GLBS="maple marine ch1_parent ch1_child ch1_volunteer ch1_props"
for f in $GLBS; do b64wrap national/assets/$f.glb $f.glb "$OUT/assets/$f.glb.js"; done
python3 - "$OUT" "${TOYTOWN_URL:-https://claude.ai/artifact/Ajk5aHEBWDgSDXdZ7j5RZG}" <<'PY'
import sys, re
s = open('national/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
names = ['maple', 'marine', 'ch1_parent', 'ch1_child', 'ch1_volunteer', 'ch1_props']
b64 = ', '.join(f'"{n}.glb": "./assets/{n}.glb.js"' for n in names)
boot = f'<script>window.TT_DATA_EXT = ".js"; window.NAT_TOYTOWN_URL = "{sys.argv[2]}"; window.NAT_B64 = {{ {b64} }};</script>\n<script type="module" src="./national.js"></script>\n'
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', boot, page, flags=re.S)
open(sys.argv[1] + '/national.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" | awk '{print $5, $9}'
