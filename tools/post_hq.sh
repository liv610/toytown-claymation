#!/usr/bin/env bash
# After scripts/bake_hq.py: export, optimise and package the visual-quality experiment for the browser.
set -euo pipefail
cd "$(dirname "$0")/.."
B=renders/hq/bake; A=web/hq/assets
mkdir -p $A
blender -b $B/hq_baked.blend --python scripts/export_hq.py -- $A 2>&1 | grep -E "wrote|triangles|Error|Trace" || true
cd web; export NODE_OPTIONS=--max-old-space-size=6000
TT_OVERRIDE='{"Snow":[0.12,0.0005]}' node tools_optimize.mjs hq/assets/rest_raw.glb hq/assets/rest.glb 0.2 0.00035 | grep triangles
node tools_optimize.mjs hq/assets/door_live_raw.glb hq/assets/door_live.glb 1.0 0.0 | grep triangles
for k in shop pink door street props; do
  [ -f hq/assets/baked_${k}_raw.glb ] || continue
  r=0.45; [ $k = street ] && r=1.0          # the cobble domes facet visibly when simplified
  TT_LOCK=1 node tools_optimize.mjs hq/assets/baked_${k}_raw.glb hq/assets/baked_${k}.glb $r 0.0004 | sed "s/^/$k: /" | grep triangles
done
cd ..
for k in shop pink door street props; do
  [ -f $B/bake_$k.png ] || continue
  python3 tools/fill_gutters.py $B/bake_$k.png $B/bake_${k}_filled.png
  convert $B/bake_${k}_filled.png -quality 92 $A/bake_$k.webp
done
ls -la $A | awk '{print $5, $9}'
