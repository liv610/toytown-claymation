"""Re-bake only the street patch of hq_baked.blend with a non-overlapping top-down layout.

  blender -b renders/hq/bake/hq_baked.blend --python scripts/fix_street_bake.py -- [--samples 48]

The street is layered (grout bed under cobble domes, ground snow under both, dome undersides).
A straight top-down projection maps all of those layers onto the same texels, so the bake
of whichever was hidden wins. Here every face that is not the topmost surface (seen straight
down) is deleted before projecting, so each texel belongs to exactly one visible face.
"""
import json, math, os, sys, time
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 48
OUT = os.path.dirname(bpy.data.filepath)
CROP = (-6.6, 11.6, -7.6, 0.9)
s = bpy.data.scenes["Scene"]; bpy.context.window.scene = s
s.cycles.samples = samples
t0 = time.time()
ob = bpy.data.objects["BAKE_street"]
if "--from" in argv:
    # start again from the untouched street mesh of an earlier save (no faces removed)
    with bpy.data.libraries.load(argv[argv.index("--from") + 1]) as (src, dst):
        dst.meshes = ["BAKE_street"]
    old = ob.data; ob.data = dst.meshes[0]; bpy.data.meshes.remove(old)
    print("street mesh reloaded:", len(ob.data.polygons), "faces", flush=True)
NODELETE = "--nodelete" in argv      # with per-face UV islands nothing overlaps, so hidden faces can stay
bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
tree = BVHTree.FromBMesh(bm)          # occluders: the street as it stands (built once)
up = Vector((0, 0, 1))


def covered(p, n):
    hit = tree.ray_cast(p + n * 0.0008 + up * 0.0004, up, 3.0)
    return hit[0] is not None


def samples(f):
    c = f.calc_center_median()
    return [c] + [c.lerp(v.co, 0.85) for v in f.verts]


# large flat faces (the grout bed) are only partly hidden: test several points, split the mixed ones
for rnd in range(0 if NODELETE else 6):
    mixed = []
    for f in bm.faces:
        if f.normal.z < -0.05 or f.calc_area() < 0.00025:
            continue
        r = [covered(p, f.normal) for p in samples(f)]
        if any(r) and not all(r):
            mixed.append(f)
    print(f"round {rnd}: {len(mixed)} partly hidden faces -> subdivide", flush=True)
    if not mixed:
        break
    edges = list({e for f in mixed for e in f.edges})
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
    bm.faces.ensure_lookup_table()
kill = [] if NODELETE else [f for f in bm.faces if f.normal.z < -0.05 or covered(f.calc_center_median(), f.normal)]
print(f"street: removing {len(kill)} of {len(bm.faces)} hidden faces", flush=True)
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(ob.data); bm.free()
me = ob.data
SMART = "--smart" in argv
if SMART:
    # every face its own island: steep stone sides get their own (lit) texels instead of the ground's
    for o in s.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.001, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', margin=0.001, shape_method='CONCAVE', margin_method='FRACTION')
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f"smart unwrap {time.time() - t0:.0f}s", flush=True)
else:
    uv = me.uv_layers.active.data
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    lv = np.empty(len(me.loops), np.int32); me.loops.foreach_get("vertex_index", lv)
    u = (co[lv, 0] - CROP[0]) / (CROP[1] - CROP[0]); v = (co[lv, 1] - CROP[2]) / (CROP[3] - CROP[2])
    uv.foreach_set("uv", np.stack([np.clip(u, 0, 1), np.clip(v, 0, 1)], 1).ravel().astype(np.float32))
me.update()

size, hgt = (2048, 2048) if SMART else (2048, 1024)
img = bpy.data.images.new("bake_street_fix", size, hgt, alpha=False, float_buffer=True)
for m in me.materials:
    if m and m.use_nodes:
        n = m.node_tree.nodes.get("BakeTarget")
        if n is None:
            n = m.node_tree.nodes.new("ShaderNodeTexImage"); n.name = "BakeTarget"
        n.image = img; m.node_tree.nodes.active = n
for o in s.objects:
    o.select_set(o == ob)
bpy.context.view_layer.objects.active = ob
tb = time.time()
bpy.ops.object.bake(type='COMBINED', pass_filter={'EMIT', 'DIRECT', 'INDIRECT', 'DIFFUSE'}, margin=8, use_clear=True)
raw = os.path.join(OUT, "bake_street_raw.exr")
img.filepath_raw = raw; img.file_format = 'OPEN_EXR'; img.save()
print(f"baked street in {time.time() - tb:.0f}s", flush=True)

ds = bpy.data.scenes.get("Denoise")
ds.render.resolution_x, ds.render.resolution_y = size, hgt
nt = ds.node_tree
im = bpy.data.images.load(raw, check_existing=False); im.colorspace_settings.name = 'Non-Color'
for n in list(nt.nodes):
    nt.nodes.remove(n)
a_ = nt.nodes.new("CompositorNodeImage"); a_.image = im
dn = nt.nodes.new("CompositorNodeDenoise"); dn.prefilter = 'NONE'
fo = nt.nodes.new("CompositorNodeOutputFile"); fo.base_path = OUT + os.sep
fo.format.file_format = 'OPEN_EXR'; fo.format.color_depth = '32'; fo.file_slots[0].path = "bake_street_dn_"
comp = nt.nodes.new("CompositorNodeComposite")
nt.links.new(a_.outputs[0], dn.inputs['Image']); nt.links.new(dn.outputs[0], fo.inputs[0]); nt.links.new(dn.outputs[0], comp.inputs[0])
bpy.context.window.scene = ds; ds.frame_current = 1
bpy.ops.render.render(write_still=False)
dim = bpy.data.images.load(os.path.join(OUT, "bake_street_dn_0001.exr"), check_existing=False); dim.colorspace_settings.name = 'Non-Color'
px = np.empty(size * hgt * 4, np.float32); dim.pixels.foreach_get(px); px = px.reshape(hgt, size, 4)[..., :3]
scale = float(np.percentile(px, 99.6)) * 1.05 + 1e-4
enc = np.clip(px / scale, 0, 1)
enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
out = bpy.data.images.new("enc_street_fix", size, hgt, alpha=False); out.colorspace_settings.name = 'Non-Color'
rgba = np.ones((hgt, size, 4), np.float32); rgba[..., :3] = enc
out.pixels.foreach_set(rgba.ravel()); out.filepath_raw = os.path.join(OUT, "bake_street.png"); out.file_format = 'PNG'; out.save()
bpy.context.window.scene = s
mp = os.path.join(OUT, "bake_meta.json"); meta = json.load(open(mp))
meta["targets"]["street"].update({"scale": scale, "seconds": round(time.time() - tb), "size": size, "height": hgt})
json.dump(meta, open(mp, "w"))
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
print(f"done {time.time() - t0:.0f}s scale {scale:.2f}", flush=True)
