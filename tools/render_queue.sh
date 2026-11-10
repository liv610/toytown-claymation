#!/usr/bin/env bash
# Renders everything the hybrid pipeline needs, in order of dependency.
set -u
cd "$(dirname "$0")/.."
B="blender -b --factory-startup --python scripts/build_scene.py --"
mkdir -p renders/logs
run() { echo "=== $1 start $(date +%T)"; shift; "$@" > "renders/logs/$JOB.log" 2>&1; echo "=== $JOB exit $? $(date +%T)"; }
JOB=hero;   run hero   $B --job hero   --res 2560x1440 --samples 96
JOB=stills; run stills $B --job stills --res 1280x720  --samples 48 --no-save
JOB=door;   run door   $B --job door   --res 1920x1080 --samples 40 --no-save
JOB=move;   run move   $B --job move   --res 640x360   --samples 16 --no-save
echo "=== queue done $(date +%T)"
