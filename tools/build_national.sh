#!/usr/bin/env bash
# Package the national map prototype as a self-contained artifact folder:  tools/build_national.sh OUTDIR
set -euo pipefail
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT/assets"
npx esbuild national/src/main.js --bundle --format=esm --minify --target=es2022 --outfile="$OUT/national.js" 2>&1 | tail -1
npx esbuild national/src/main.js --bundle --format=esm --target=es2022 --outfile=national/dist/national.js 2>&1 | tail -1
cp national/assets/states-albers-10m.json national/assets/maple.json "$OUT/assets/"
GLBS="maple marine ch1_parent ch1_child ch1_volunteer ch1_props"
for f in $GLBS; do base64 -w0 national/assets/$f.glb > "$OUT/assets/$f.glb.txt"; done
python3 - "$OUT" "${TOYTOWN_URL:-https://claude.ai/artifact/68VGT1ZJfx3HdZF8vPkQNw}" <<'PY'
import sys, re
s = open('national/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
names = ['maple', 'marine', 'ch1_parent', 'ch1_child', 'ch1_volunteer', 'ch1_props']
b64 = ', '.join(f'"{n}.glb": "./assets/{n}.glb.txt"' for n in names)
boot = f'<script>window.NAT_TOYTOWN_URL = "{sys.argv[2]}"; window.NAT_B64 = {{ {b64} }};</script>\n<script type="module" src="./national.js"></script>\n'
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', boot, page, flags=re.S)
open(sys.argv[1] + '/national.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" | awk '{print $5, $9}'
