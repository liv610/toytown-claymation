#!/usr/bin/env bash
# Package the storybook transition test as a self-contained artifact folder:  tools/build_storybook.sh OUTDIR
set -euo pipefail
cd "$(dirname "$0")/../web"
OUT=${1:?outdir}; mkdir -p "$OUT/assets"
npx esbuild storybook/src/main.js --bundle --format=esm --minify --target=es2022 --outfile="$OUT/storybook.js" 2>&1 | tail -1
npx esbuild storybook/src/main.js --bundle --format=esm --target=es2022 --outfile=storybook/dist/storybook.js 2>&1 | tail -1
cp storybook/assets/states-albers-10m.json "$OUT/assets/"
python3 - "$OUT" <<'PY'
import sys, re
s = open('storybook/index.html').read()
page = s[s.index('<!--PAGE-START-->') + 17:s.index('<!--PAGE-END-->')]
page = re.sub(r'<!--PAGE-SCRIPTS-->.*?<!--PAGE-SCRIPTS-END-->', '<script type="module" src="./storybook.js"></script>\n', page, flags=re.S)
open(sys.argv[1] + '/storybook.html', 'w').write(page.strip() + '\n')
PY
ls -la "$OUT" | awk '{print $5, $9}'
