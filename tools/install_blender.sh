#!/usr/bin/env bash
# Installs the exact Blender build used for this experiment (GPL, free).
set -euo pipefail
VER=4.5.3
DIR=/opt/blender-$VER-linux-x64
if [ ! -x "$DIR/blender" ]; then
  curl -L "https://download.blender.org/release/Blender4.5/blender-$VER-linux-x64.tar.xz" -o /tmp/blender.tar.xz
  tar -xf /tmp/blender.tar.xz -C /opt && rm /tmp/blender.tar.xz
fi
ln -sf "$DIR/blender" /usr/local/bin/blender
blender --version | head -1
