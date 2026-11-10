"""Bake the visual-quality area (blue shop, pink house, door, street patch) for the browser.

  blender -b --factory-startup --python scripts/bake_hq.py -- OUTDIR [--size 2048] [--samples 128] [--only shop,pink,door,street]

For each target: join its parts (modifiers applied), decimate to a sensible density,
smart-UV unwrap, bake Cycles COMBINED (diffuse direct+indirect + emission, no gloss)
into a float image, then store it as an 8-bit sRGB texture with a scale factor.
Everything else is exported merged-by-material as before (rest.glb), with the baked
area cut out of the big shared ground/cobble meshes so nothing is drawn twice.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
TT_IMPORT_ONLY = True
exec(open(os.path.join(HERE, "build_scene.py")).read())

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from tt import hq, world, lib, buildings as Bld  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
os.makedirs(OUT, exist_ok=True)
opt = {"size": 2048, "samples": 128, "only": "shop,pink,door,street,props", "budget": 420000}
for k in list(opt):
    if "--" + k in argv:
        v = argv[argv.index("--" + k) + 1]
        opt[k] = int(v) if isinstance(opt[k], int) else v
ONLY = opt["only"].split(",")
t0 = time.time()
build()
hq.enhance()
world.render_settings((640, 360), opt["samples"])
s = bpy.context.scene
s.cycles.use_denoising = False
print(f"scene ready {time.time() - t0:.0f}s", flush=True)

GLOW = {"ShopGlow", "UpperGlow", "PinkGlow", "LampGlass", "LampBulb", "FairyLight", "LampShade", "InteriorShade",
        "StarGlow", "Bulb", "BgGlow", "CoachGlow", "StationGlow"}
CROP = (-6.6, 11.6, -7.6, 0.9)   # street patch (x0, x1, y0, y1) in front of the two houses
BIG = ["Cobbles", "StreetBed", "SnowEdges", "SnowGround"]


def is_glow(o):
    return o.type in ('MESH', 'CURVE', 'FONT') and o.data and any(m and m.name in GLOW for m in o.data.materials)


def renderable(o):
    return o.type in ('MESH', 'CURVE', 'FONT') and not o.hide_render and \
        not any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection)


shop, pink = bpy.data.objects["BlueShop"], bpy.data.objects["PinkHouse"]
hinge = Bld.DOOR_HINGE
door_set = set(c.name for c in hinge.children_recursive)
shop_set = set(c.name for c in shop.children_recursive) - door_set
pink_set = set(c.name for c in pink.children_recursive)


def root_of(o):
    while o.parent:
        o = o.parent
    return o


bpy.context.view_layer.update()      # matrix_world of freshly built objects is stale (identity) until this
groups = {"shop": [], "pink": [], "door": [], "street": [], "props": []}
GROUND = ("bank", "walldrift", "edgelump", "fgdrift", "sqdrift")
for o in list(s.objects):
    if not renderable(o) or is_glow(o):
        continue
    if o.name in door_set:
        groups["door"].append(o)
    elif o.name in shop_set:
        groups["shop"].append(o)
    elif o.name in pink_set:
        groups["pink"].append(o)
    elif o.name in BIG:
        continue
    else:
        r = root_of(o)
        c = (r.matrix_world.translation if r is not o else
             o.matrix_world @ (sum((Vector(b) for b in o.bound_box), Vector()) / 8))
        if r.name in ("BlueShop", "PinkHouse"):
            continue
        w = [o.matrix_world @ Vector(b) for b in o.bound_box]
        inside = min(v.x for v in w) > CROP[0] - 1.5 and max(v.x for v in w) < CROP[1] + 1.5 and \
            min(v.y for v in w) > CROP[2] - 1.5 and max(v.y for v in w) < CROP[3] + 1.5
        if CROP[0] < c.x < CROP[1] and CROP[2] < c.y < CROP[3] and inside and r.name not in ("FirFG", "FirGap", "FirR1"):
            # heightfield-like snow goes with the ground (top-down projection); objects get their own atlas
            groups["street" if o.name.startswith(GROUND) else "props"].append(o)


def evaluated_bm(o):
    dg = bpy.context.evaluated_depsgraph_get()
    oe = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(oe)
    me.transform(o.matrix_world)
    return me


def crop_split(o):
    """Return (inside_mesh, outside_mesh) of a big shared object, by face centre."""
    me = evaluated_bm(o)
    out = []
    for keep_inside in (True, False):
        bm = bmesh.new(); bm.from_mesh(me)
        kill = []
        for f in bm.faces:
            c = f.calc_center_median()
            inside = CROP[0] < c.x < CROP[1] and CROP[2] < c.y < CROP[3]
            if inside != keep_inside:
                kill.append(f)
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        m2 = bpy.data.meshes.new(o.name + ("_in" if keep_inside else "_out"))
        bm.to_mesh(m2); bm.free()
        for mt in me.materials:
            m2.materials.append(mt)
        out.append(m2)
    bpy.data.meshes.remove(me)
    return out


def join_meshes(name, meshes):
    bm = bmesh.new()
    mats = []
    for me in meshes:
        offs = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            offs.append(mats.index(m))
        for p in me.polygons:
            if offs:
                p.material_index = offs[p.material_index]
        bm.from_mesh(me)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    s.collection.objects.link(ob)
    return ob


targets = {}
for key in ("shop", "pink", "door", "street", "props"):
    meshes = [evaluated_bm(o) for o in groups[key]]
    if key == "street":
        for name in BIG:
            o = bpy.data.objects.get(name)
            if o:
                inside, outside = crop_split(o)
                meshes.append(inside)
                # the remainder replaces the original for the rest-of-world export
                ro = bpy.data.objects.new(name + "_rest", outside); s.collection.objects.link(ro)
                o.hide_render = True
    ob = join_meshes("BAKE_" + key, meshes)
    for o in groups[key]:
        o.hide_render = True          # the joined copy stands in for them (in the bake and the export)
    targets[key] = ob
    print(f"{key}: {len(groups[key])} parts -> {len(ob.data.polygons)} faces", flush=True)

# decimate to a sensible density, unwrap
for key, ob in targets.items():
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    budget = {"shop": opt["budget"], "pink": opt["budget"], "street": 800000, "props": 450000}.get(key, 60000)
    if tris > budget:
        m = ob.modifiers.new("dec", 'DECIMATE'); m.ratio = budget / tris
        bpy.context.view_layer.objects.active = ob
        for o in s.objects:
            o.select_set(o == ob)
        bpy.ops.object.modifier_apply(modifier="dec")
    bpy.context.view_layer.objects.active = ob
    for o in s.objects:
        o.select_set(o == ob)
    if key == "street":
        # the street is a heightfield seen from above: a straight top-down projection uses the whole texture
        me = ob.data
        if not me.uv_layers:
            me.uv_layers.new(name="UVMap")
        uv = me.uv_layers.active.data
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        lv = np.empty(len(me.loops), np.int32); me.loops.foreach_get("vertex_index", lv)
        u = (co[lv, 0] - CROP[0]) / (CROP[1] - CROP[0]); v = (co[lv, 1] - CROP[2]) / (CROP[3] - CROP[2])
        uv.foreach_set("uv", np.stack([np.clip(u, 0, 1), np.clip(v, 0, 1)], 1).ravel().astype(np.float32))
    else:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0015, area_weight=0.0, scale_to_bounds=False)
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', margin=0.0012, shape_method='CONCAVE', margin_method='FRACTION')
        bpy.ops.object.mode_set(mode='OBJECT')
    print(f"{key}: {tris} -> {sum(len(p.vertices) - 2 for p in ob.data.polygons)} tris, unwrapped {time.time() - t0:.0f}s", flush=True)

meta = {"targets": {}}
for key in ONLY:
    ob = targets[key]
    size = opt["size"] if key != "door" else max(512, opt["size"] // 4)
    hgt = size // 2 if key == "street" else size          # street: 18 x 8.5 m -> 2:1 texture, ~0.9 cm texels
    img = bpy.data.images.new("bake_" + key, size, hgt, alpha=False, float_buffer=True)
    for m in ob.data.materials:
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        for n in [n for n in nt.nodes if n.name == "BakeTarget"]:
            nt.nodes.remove(n)
        n = nt.nodes.new("ShaderNodeTexImage"); n.name = "BakeTarget"; n.image = img
        nt.nodes.active = n
    for o in s.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    tb = time.time()
    bpy.ops.object.bake(type='COMBINED', pass_filter={'EMIT', 'DIRECT', 'INDIRECT', 'DIFFUSE'}, margin=8, use_clear=True)
    img.filepath_raw = os.path.join(OUT, f"bake_{key}_raw.exr"); img.file_format = 'OPEN_EXR'; img.save()
    meta["targets"][key] = {"size": size, "height": hgt, "seconds": round(time.time() - tb)}
    print(f"baked {key} {size}px in {time.time() - tb:.0f}s", flush=True)
    json.dump(meta, open(os.path.join(OUT, "bake_meta_%s.json" % key), "w"))

# ---- denoise every bake (OIDN via an empty compositor scene), then encode for the web
ds = bpy.data.scenes.new("Denoise")
ds.render.engine = 'CYCLES'; ds.cycles.samples = 1
cam = bpy.data.objects.new("dc", bpy.data.cameras.new("dc")); ds.collection.objects.link(cam); ds.camera = cam
ds.use_nodes = True
for key in ONLY:
    size, hgt = meta["targets"][key]["size"], meta["targets"][key]["height"]
    ds.render.resolution_x, ds.render.resolution_y = size, hgt; ds.render.resolution_percentage = 100
    nt = ds.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    im = bpy.data.images.load(os.path.join(OUT, f"bake_{key}_raw.exr")); im.colorspace_settings.name = 'Non-Color'
    a_ = nt.nodes.new("CompositorNodeImage"); a_.image = im
    dn = nt.nodes.new("CompositorNodeDenoise"); dn.prefilter = 'NONE'
    fo = nt.nodes.new("CompositorNodeOutputFile"); fo.base_path = OUT + os.sep
    fo.format.file_format = 'OPEN_EXR'; fo.format.color_depth = '32'; fo.file_slots[0].path = f"bake_{key}_dn_"
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(a_.outputs[0], dn.inputs['Image']); nt.links.new(dn.outputs[0], fo.inputs[0]); nt.links.new(dn.outputs[0], comp.inputs[0])
    bpy.context.window.scene = ds
    ds.frame_current = 1
    ds.render.filepath = os.path.join(OUT, f"_dn_{key}.png")
    bpy.ops.render.render(write_still=False)
    dpath = os.path.join(OUT, f"bake_{key}_dn_0001.exr")
    dim = bpy.data.images.load(dpath); dim.colorspace_settings.name = 'Non-Color'
    px = np.empty(size * hgt * 4, np.float32); dim.pixels.foreach_get(px)
    px = px.reshape(hgt, size, 4)[..., :3]
    scale = float(np.percentile(px, 99.6)) * 1.05 + 1e-4
    enc = np.clip(px / scale, 0, 1)
    enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
    out = bpy.data.images.new("enc_" + key, size, hgt, alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((hgt, size, 4), np.float32); rgba[..., :3] = enc
    out.pixels.foreach_set(rgba.ravel())
    out.filepath_raw = os.path.join(OUT, f"bake_{key}.png"); out.file_format = 'PNG'; out.save()
    meta["targets"][key]["scale"] = scale
    print(f"denoised + encoded {key} (scale {scale:.2f})", flush=True)
bpy.context.window.scene = s
json.dump(meta, open(os.path.join(OUT, "bake_meta.json"), "w"))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "hq_baked.blend"), compress=True)
print(f"done {time.time() - t0:.0f}s", flush=True)
