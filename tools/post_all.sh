#!/usr/bin/env bash
# Turn the Cycles passes (tools/render_queue.sh) into the deliverables:
# hero still, snow loop, door-opening shot, camera stills, camera move, web assets.
set -euo pipefail
cd "$(dirname "$0")/.."
P="blender -b --factory-startup --python scripts/post/composite.py --"
R=renders/passes
O=renders/stage2
mkdir -p $O
enc() { # frames_dir fps out [extra vf]
  ffmpeg -y -loglevel error -framerate "$2" -i "$1/frame_%04d.png" ${4:+-vf "$4"} \
    -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart "$3"
}
step() { echo "--- $* ($(date +%T))"; }

if [ -d $R/hero/combined ]; then
  step "hero still 2560x1440 (snow + post)"
  $P --passes $R/hero --res 2560x1440 --frames 1 --out $O/hero_still >/dev/null
  cp $O/hero_still/frame_0000.png renders/stage1/toytown_stage1_hero.png
  step "snow + flicker loop 1080p (10 s, seamless)"
  $P --passes $R/hero --res 1920x1080 --frames 240 --loop 10 --out $O/loop_frames >/dev/null
  enc $O/loop_frames 24 $O/toytown_snow_loop_1080p.mp4
fi
if [ -d $R/door/combined ]; then
  step "door-opening shot 1080p (9 s)"
  $P --passes $R/hero --door $R/door --door_start 3.0 --res 1920x1080 --frames 216 --loop 10 --out $O/door_frames >/dev/null
  enc $O/door_frames 24 $O/toytown_door_open_1080p.mp4
fi
if [ -d $R/stills ]; then
  for c in Wide Lamp Entrance Reverse; do
    [ -d $R/stills/$c/combined ] || continue
    step "camera still $c"
    $P --mode camera --passes $R/stills/$c --out $O/stills_$c >/dev/null
    cp $O/stills_$c/frame_0000.png $O/still_$c.png
  done
fi
if [ -d $R/move/combined ]; then
  step "camera move (rendered at 12 fps, motion-interpolated to 24)"
  $P --mode camera --passes $R/move --fps 12 --out $O/move_frames >/dev/null
  enc $O/move_frames 12 $O/toytown_camera_move_12fps.mp4 "scale=1280:-2:flags=lanczos"
  enc $O/move_frames 12 $O/toytown_camera_move_24fps.mp4 "scale=1280:-2:flags=lanczos,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir"
fi
if [ -d $R/hero/combined ]; then
  step "web: hybrid assets"
  blender -b --factory-startup --python scripts/post/export_hybrid.py -- --passes $R/hero \
    $( [ -d $R/door/combined ] && echo "--door $R/door" ) --out web/hybrid/assets >/dev/null
fi
step "done"
