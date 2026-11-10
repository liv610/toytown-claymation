#!/usr/bin/env bash
# Render the next missing hero strip(s). Safe to re-run after an interruption.
# Bands done at 1/14 height are kept; the rest are rendered as 1/28 half-bands.
cd "$(dirname "$0")/.."
MAX=${1:-1}; done_now=0; S=renders/passes/hero/strips
for j in $(seq 0 27); do
  p=$S/s$(printf %02d $((j/2)))
  [ -f $p/DONE ] && continue
  d=$S/h$(printf %02d $j)
  [ -f $d/DONE ] && continue
  [ $done_now -ge $MAX ] && break
  t0=$(date +%s)
  blender -b --factory-startup --python scripts/build_scene.py -- --job hero --strip $j/28 --no-save \
    --res 2560x1440 --samples 96 > renders/logs/half_$j.log 2>&1
  echo "half $j: $(( $(date +%s) - t0 ))s"
  done_now=$((done_now+1))
done
