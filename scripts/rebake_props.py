"""Rebuild and re-bake only the 'props' target of hq_baked.blend.

  blender -b renders/hq/bake/hq_baked.blend --python scripts/rebake_props.py -- [--samples 48]

The first bake picked props by their root's position. Big shared objects (all the village's roof snow
is one object with its origin at 0,0,0) passed that test and were squeezed into the props atlas at a
useless density. Here only objects that lie (almost) entirely inside the street patch are baked;
anything spilling far outside goes back to the live 'rest' export.
"""
import json, math, os, sys, time
import bpy, bmesh
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tt.bakeutil import bake_to, denoise_encode  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 48
OUT = os.path.dirname(bpy.data.filepath)
CROP = (-6.6, 11.6, -7.6, 0.9); PAD = 1.5
BIG = ["Cobbles", "StreetBed", "SnowEdges", "SnowGround"]
GROUND = ("bank", "walldrift", "edgelump", "fgdrift", "sqdrift")
s = bpy.data.scenes["Scene"]; bpy.context.window.scene = s; s.cycles.samples = samples
t0 = time.time()
hinge = bpy.data.objects["DoorHinge"]
taken = set(c.name for c in hinge.children_recursive) | set(c.name for c in bpy.data.objects["BlueShop"].children_recursive) \
    | set(c.name for c in bpy.data.objects["PinkHouse"].children_recursive)


def root_of(o):
    while o.parent:
        o = o.parent
    return o


keep, spill = [], []
dg0 = bpy.context.evaluated_depsgraph_get()
for o in s.objects:
    if o.type not in ('MESH', 'CURVE', 'FONT') or not o.hide_render or o.name.startswith("BAKE_") or o.name in taken:
        continue
    if any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection) or o.name in BIG or o.name.startswith(GROUND):
        continue
    r = root_of(o)
    if r.name in ("BlueShop", "PinkHouse", "FirFG", "FirGap", "FirR1"):
        continue
    c = r.matrix_world.translation if r is not o else o.matrix_world @ (sum((Vector(b) for b in o.bound_box), Vector()) / 8)
    if not (CROP[0] < c.x < CROP[1] and CROP[2] < c.y < CROP[3]):
        continue
    w = [o.matrix_world @ Vector(b) for b in o.evaluated_get(dg0).bound_box]   # evaluated: modifiers/instancing can spread far
    inside = min(v.x for v in w) > CROP[0] - PAD and max(v.x for v in w) < CROP[1] + PAD and \
        min(v.y for v in w) > CROP[2] - PAD and max(v.y for v in w) < CROP[3] + PAD
    (keep if inside else spill).append(o)
print("props keep", len(keep), "spill back to live:", [o.name for o in spill], flush=True)
if "--dry" in argv:
    big = []
    for o in keep:
        e = o.evaluated_get(dg0); n = len(e.data.polygons) if o.type == 'MESH' else 0
        w = [o.matrix_world @ Vector(b) for b in e.bound_box]
        big.append((n, o.name, root_of(o).name, [round(min(v.x for v in w)), round(max(v.x for v in w)), round(min(v.y for v in w)), round(max(v.y for v in w))]))
    for b in sorted(big, reverse=True)[:8]:
        print("KEEP", b, flush=True)
    raise SystemExit(0)
for o in spill:
    o.hide_render = False

old = bpy.data.objects["BAKE_props"]; bpy.data.objects.remove(old)
dg = bpy.context.evaluated_depsgraph_get()
bm = bmesh.new(); mats = []
for o in keep:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); me.transform(o.matrix_world)
    offs = []
    for m in me.materials:
        if m not in mats:
            mats.append(m)
        offs.append(mats.index(m))
    for p in me.polygons:
        if offs:
            p.material_index = offs[p.material_index]
    bm.from_mesh(me); bpy.data.meshes.remove(me)
me = bpy.data.meshes.new("BAKE_props"); bm.to_mesh(me); bm.free()
for m in mats:
    me.materials.append(m)
for p in me.polygons:
    p.use_smooth = True
ob = bpy.data.objects.new("BAKE_props", me); s.collection.objects.link(ob)
tris = sum(len(p.vertices) - 2 for p in me.polygons)
for o in s.objects:
    o.select_set(o == ob)
bpy.context.view_layer.objects.active = ob
if tris > 300000:
    d = ob.modifiers.new("dec", 'DECIMATE'); d.ratio = 300000 / tris; bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0015, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', margin=0.0012, shape_method='CONCAVE', margin_method='FRACTION')
bpy.ops.object.mode_set(mode='OBJECT')
print(f"props: {tris} -> {sum(len(p.vertices) - 2 for p in me.polygons)} tris, unwrapped {time.time() - t0:.0f}s", flush=True)
tb = time.time()
bake_to(ob, "props", 2048, 2048, OUT)
print(f"baked props in {time.time() - tb:.0f}s", flush=True)
scale = denoise_encode("props", 2048, 2048, OUT)
mp = os.path.join(OUT, "bake_meta.json"); meta = json.load(open(mp))
meta["targets"]["props"].update({"scale": scale, "seconds": round(time.time() - tb)})
json.dump(meta, open(mp, "w"))
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
print(f"done {time.time() - t0:.0f}s scale {scale:.2f}", flush=True)
