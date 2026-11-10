"""Stitch resumable hero strips and denoise each full-frame pass once.

  blender -b --factory-startup --python scripts/post/stitch.py -- renders/passes/hero

Strips (renders/passes/hero/strips/sNN/<pass>/<pass>_0001.exr) are noisy and
overlap by a few rows; they are cross-faded, then every colour pass goes through
OpenImageDenoise with the stitched albedo/normal guides.  Output matches the
normal layout: <dir>/<pass>/<pass>_0001.exr.
"""
import glob
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exr  # noqa: E402

d = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
strips = sorted(glob.glob(os.path.join(d, "strips", "[sh]*")))
assert strips and all(os.path.exists(os.path.join(s, "DONE")) for s in strips), "missing strips"
names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(strips[0], "*")) if os.path.isdir(p))
first = exr.load_pass(strips[0], "combined")
H, W = first.shape[:2]
OV = 24
weights = []
for s in strips:
    y0, y1 = (float(v) for v in open(os.path.join(s, "DONE")).read().split())
    r0, r1 = (1 - y1) * H, (1 - y0) * H
    r = np.arange(H) + 0.5
    a = np.ones(H) if r0 <= 0.5 else np.clip((r - r0) / OV, 0, 1)
    b = np.ones(H) if r1 >= H - 0.5 else np.clip((r1 - r) / OV, 0, 1)
    weights.append((a * b).astype(np.float32))
wsum = np.maximum(sum(weights), 1e-6)

raw = os.path.join(d, "raw")
os.makedirs(raw, exist_ok=True)


def save_exr(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    a = np.ones((h, w, 4), np.float32)
    a[..., :3] = arr if arr.ndim == 3 else arr[..., None]
    img.pixels.foreach_set(np.flipud(a).ravel())
    img.filepath_raw = path
    img.file_format = 'OPEN_EXR'
    img.save()
    bpy.data.images.remove(img)


for n in names:
    acc = None
    for s, w in zip(strips, weights):
        a = exr.load_pass(s, n)
        acc = a * w[:, None, None] if acc is None else acc + a * w[:, None, None]
    save_exr(acc / wsum[:, None, None], os.path.join(raw, n + ".exr"))
    print("stitched", n, flush=True)

# denoise each colour pass at full frame, write the standard layout
s = bpy.context.scene
s.render.resolution_x, s.render.resolution_y = W, H
s.render.resolution_percentage = 100
s.render.engine = 'CYCLES'
s.cycles.samples = 1
s.frame_current = 1
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
s.collection.objects.link(cam)
s.camera = cam
s.use_nodes = True
nt = s.node_tree
for x in list(nt.nodes):
    nt.nodes.remove(x)


def img_node(n):
    im = bpy.data.images.load(os.path.join(raw, n + ".exr"))
    im.colorspace_settings.name = 'Non-Color'
    node = nt.nodes.new("CompositorNodeImage")
    node.image = im
    return node


nrm, alb = img_node("dn_normal"), img_node("dn_albedo")
comp = nt.nodes.new("CompositorNodeComposite")
for n in names:
    if n in ("dn_normal", "dn_albedo"):
        continue
    src = img_node(n)
    out = src.outputs['Image']
    if n not in ("depth", "mist"):
        dn = nt.nodes.new("CompositorNodeDenoise")
        dn.prefilter = 'ACCURATE'
        nt.links.new(src.outputs['Image'], dn.inputs['Image'])
        nt.links.new(nrm.outputs['Image'], dn.inputs['Normal'])
        nt.links.new(alb.outputs['Image'], dn.inputs['Albedo'])
        out = dn.outputs[0]
    f = nt.nodes.new("CompositorNodeOutputFile")
    f.base_path = os.path.join(d, n) + os.sep
    f.format.file_format = 'OPEN_EXR'
    f.format.color_depth = '32' if n in ("depth", "mist") else '16'
    f.format.exr_codec = 'ZIP'
    f.file_slots[0].path = n + "_"
    nt.links.new(out, f.inputs[0])
    if n == "combined":
        nt.links.new(out, comp.inputs['Image'])
s.render.filepath = os.path.join(d, "beauty_denoised.png")
bpy.ops.render.render(write_still=True)
print("denoised + written:", d)
