"""Build the village (region mode) + the diorama landscape and export it for the browser.

  blender -b --factory-startup --python scripts/export_region.py -- web/region/assets

With --split-corner (the textile test, experiment/textile-toytown) it writes instead:
  static_base_raw.glb   the village WITHOUT the test corner (shop, pink house, tree, lamps, ... see tt/corner.py)
  corner_clay_raw.glb   the test corner in clay (so the clay look can be shown side by side)
  corner.json           what the corner contains: roots with positions, background-house and fir parameters
and leaves static/terrain/protos/region outputs untouched.
With --split-corner --split-houses (the felt journey) every other background house (bg_house: the town, the square,
cottages, farmhouses) is also taken out of the base village, into:
  houses_clay_raw.glb   those houses in clay (for the local clay comparison)
  houses.json           each house's build parameters, so the browser can sew it in felt at the same footprint

Outputs:
  static.glb    village + station + square + bridges + farms, merged by material
  terrain.glb   the painted heightfield (vertex colours) and board edge
  protos.glb    one mesh per prototype (trees, bushes, rocks, posts, sleepers, trains)
  region.json   instances, railway routes, cameras, lights and layout
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

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from tt import street, region, layout as L, buildings as Bld  # noqa: E402
from tt import corner as CR, trees as TR  # noqa: E402

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
SPLIT = "--split-corner" in sys.argv
HOUSES = SPLIT and "--split-houses" in sys.argv
RECORD = {"bg_house": {}, "fir": {}}
if SPLIT:   # remember how the corner's background houses and firs were made, so the textile versions match
    _bh, _fir = Bld.bg_house, TR.fir
    def _rec_bh(name, O, W, D, H, pitch_deg, color, rot_z=0.0, gable_front=True, windows_lit=0.7, **kw):
        RECORD["bg_house"][name] = {"pos": [O[0], O[1], O[2]], "W": W, "D": D, "H": H, "pitch": pitch_deg, "color": list(color),
                                    "rot_z": rot_z, "gable_front": gable_front}
        return _bh(name, O, W, D, H, pitch_deg, color, rot_z=rot_z, gable_front=gable_front, windows_lit=windows_lit, **kw)
    def _rec_fir(name, loc, h, r, *a, **kw):
        RECORD["fir"][name] = {"pos": list(loc), "h": h, "r": r, "color": list(kw.get("color", (0.1, 0.3, 0.2)))}
        return _fir(name, loc, h, r, *a, **kw)
    Bld.bg_house, TR.fir = _rec_bh, _rec_fir
    region.bg_house = _rec_bh   # region.py imported the function under its own name (square houses, cottages, farmhouses)
os.makedirs(out, exist_ok=True)
t0 = time.time()
street.REGION = True
build()
print(f"village built {time.time() - t0:.0f}s", flush=True)
field = region.build()
print(f"region built {time.time() - t0:.0f}s", flush=True)
hinge = Bld.DOOR_HINGE
door_set = set(o.name for o in hinge.children_recursive)
protos = set(o.name for o in bpy.data.collections["Protos"].objects)


def yup(v):
    return [float(v[0]), float(v[2]), float(-v[1])]


def simple_mat(src, cache={}):
    key = src.name if src else "none"
    if key in cache:
        return cache[key]
    m = bpy.data.materials.new("rt_" + key)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    kind = src.get("rt_kind", "clay") if src else "clay"
    col = list(src.get("rt_color", (0.8, 0.8, 0.8))) if src else [0.8] * 3
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = src.get("rt_rough", 0.6) if src else 0.6
    b.inputs['Metallic'].default_value = src.get("rt_metal", 0.0) if src else 0.0
    if src and "rt_emit" in src:
        b.inputs['Emission Color'].default_value = (*src["rt_emit"], 1)
        b.inputs['Emission Strength'].default_value = min(src["rt_emit_strength"], 8.0)
    m["kind"] = kind
    if src and "rt_color2" in src:
        m["color2"] = list(src["rt_color2"])
    if kind == "terrain":
        # vertex colours carry the paint
        nt = m.node_tree
        at = nt.nodes.new("ShaderNodeVertexColor"); at.layer_name = "Col"
        nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    cache[key] = m
    return m


def is_house_object(o):
    t = CR.top(o)
    n = t.name.split(".")[0]
    return HOUSES and n in RECORD["bg_house"] and n not in CR.BUILDERS


def merge(objs, zone_split=False, corner=None, houses=None):
    """Bake modifiers, merge by material (numpy, low memory). Returns {(mat, is_door): (V, N, T)}.
    corner: a dict that receives the test corner's geometry instead (whole corner objects, and the triangles of
    split objects whose centre lies in the corner's street rectangle)."""
    dg = bpy.context.evaluated_depsgraph_get()
    groups = {}
    for o in objs:
        oe = o.evaluated_get(dg)
        try:
            me = oe.to_mesh()
        except RuntimeError:
            continue
        if me is None or not len(me.polygons):
            oe.to_mesh_clear()
            continue
        is_door = o.name in door_set
        M = o.matrix_world
        c = M.translation
        zone = "" if (zone_split and L.in_rect((c.x, c.y), L.VILLAGE_GROUND)) or not zone_split else "R_"
        me.calc_loop_triangles()
        nl = len(me.loops)
        lv = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", lv)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        ln = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get("vector", ln); ln = ln.reshape(-1, 3)
        nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tl); tl = tl.reshape(-1, 3)
        tm = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", tm)
        Mn = np.array(M, np.float32)
        R3 = np.array(M.to_3x3().inverted().transposed(), np.float32)
        Pp = co[lv] @ Mn[:3, :3].T + Mn[:3, 3]
        Nn = ln @ R3.T
        Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-9
        mats = list(me.materials) or [None]
        whole = corner is not None and CR.is_corner_object(o)
        house = houses is not None and not whole and is_house_object(o)
        split = corner is not None and not whole and not house and CR.is_split_object(o)
        if split:   # per triangle: centre inside the corner's street rectangle → corner
            cen = Pp[tl].mean(axis=1)
            x0, x1, y0, y1 = CR.STREET_RECT
            in_c = (cen[:, 0] >= x0) & (cen[:, 0] <= x1) & (cen[:, 1] >= y0) & (cen[:, 1] <= y1)
        for mi, m in enumerate(mats):
            for dest, mask in (((corner if whole else houses if house else groups), None),) if not split else ((groups, ~in_c), (corner, in_c)):
                sel = tl[(tm == mi) & (mask if mask is not None else True)]
                if not len(sel):
                    continue
                used, inv = np.unique(sel.ravel(), return_inverse=True)
                dz = "" if (dest is corner or dest is houses) else zone
                dest.setdefault(((dz + m.name) if m else "none", is_door), []).append((Pp[used], Nn[used], inv.reshape(-1, 3).astype(np.int32)))
        oe.to_mesh_clear()
    return groups


def write_groups(groups, scene, prefix=""):
    stats = []
    for (mname, is_door), parts in groups.items():
        if mname == "none":
            continue
        V = np.concatenate([p[0] for p in parts]); Nn = np.concatenate([p[1] for p in parts])
        off = np.cumsum([0] + [len(p[0]) for p in parts[:-1]])
        T = np.concatenate([p[2] + o_ for p, o_ in zip(parts, off)])
        me = bpy.data.meshes.new(prefix + ("door_" if is_door else "") + mname)
        me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel())
        me.loops.add(len(T) * 3); me.loops.foreach_set("vertex_index", T.ravel())
        me.polygons.add(len(T))
        me.polygons.foreach_set("loop_start", np.arange(0, len(T) * 3, 3, dtype=np.int32))
        me.polygons.foreach_set("loop_total", np.full(len(T), 3, np.int32))
        me.update()
        me.normals_split_custom_set_from_vertices([tuple(n) for n in Nn])
        me.materials.append(simple_mat(bpy.data.materials.get(mname[2:] if mname.startswith("R_") else mname)))
        ob = bpy.data.objects.new(me.name, me)
        scene.collection.objects.link(ob)
        stats.append((len(T), me.name))
    return stats


def export_scene(scene, path, **kw):
    bpy.context.window.scene = scene
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, export_apply=False,
                              export_extras=True, export_lights=False, export_cameras=False, export_yup=True, **kw)
    print("wrote", path, os.path.getsize(path) // 1024, "KB", flush=True)


src_scene = bpy.context.scene
all_objs = [o for o in src_scene.objects if o.type in ('MESH', 'FONT', 'CURVE') and not o.hide_render
            and not any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection)]
terrain_objs = [o for o in all_objs if o.name in ("Terrain",)]
static_objs = [o for o in all_objs if o.name not in protos and o not in terrain_objs]

# ---- the textile test: base village + clay corner, then stop (nothing else is rewritten)
if SPLIT:
    cg = {}; hg = {} if HOUSES else None
    g = merge(static_objs, zone_split=True, corner=cg, houses=hg)
    doors_base = [k for k in g if k[1]]
    assert not doors_base, f"door geometry left in the base village: {doors_base}"
    exp = bpy.data.scenes.new("ExportBase"); stats = write_groups(g, exp)
    export_scene(exp, os.path.join(out, "static_base_raw.glb"))
    expc = bpy.data.scenes.new("ExportCorner"); cstats = write_groups(cg, expc)
    export_scene(expc, os.path.join(out, "corner_clay_raw.glb"))
    roots = {}
    for o in src_scene.objects:
        if o.parent is None and CR.is_corner_object(o):
            roots[o.name] = {"pos": yup(o.matrix_world.translation), "rot_z": o.matrix_world.to_euler().z}
    json.dump({"rect": CR.STREET_RECT, "roots": roots, "bg_house": {k: v for k, v in RECORD["bg_house"].items() if k in roots},
               "fir": {k: v for k, v in RECORD["fir"].items() if k in roots}, "builders": CR.BUILDERS,
               "triangles": {"base": int(sum(s_[0] for s_ in stats)), "corner": int(sum(s_[0] for s_ in cstats))},
               "door_meshes": sum(1 for k in cg if k[1])}, open(os.path.join(out, "corner.json"), "w"), indent=1)
    print("base triangles:", sum(s_[0] for s_ in stats), "corner triangles:", sum(s_[0] for s_ in cstats), flush=True)
    if HOUSES:
        assert not [k for k in hg if k[1]], "door geometry among the houses"
        exph = bpy.data.scenes.new("ExportHouses"); hstats = write_groups(hg, exph)
        export_scene(exph, os.path.join(out, "houses_clay_raw.glb"))
        hs = {k: v for k, v in RECORD["bg_house"].items() if k not in CR.BUILDERS}
        json.dump({"houses": hs, "triangles": int(sum(s_[0] for s_ in hstats))}, open(os.path.join(out, "houses.json"), "w"), indent=1)
        print("houses:", len(hs), "triangles:", sum(s_[0] for s_ in hstats), flush=True)
    print(f"done {time.time() - t0:.0f}s")
    sys.exit(0)

# ---- static scene
g = merge(static_objs, zone_split=True)
exp = bpy.data.scenes.new("ExportStatic")
stats = write_groups(g, exp)
export_scene(exp, os.path.join(out, "static_raw.glb"))
print("static triangles:", sum(s[0] for s in stats), "meshes:", len(stats))

# ---- terrain (keeps its vertex colours)
expt = bpy.data.scenes.new("ExportTerrain")
for o in terrain_objs:
    me = o.data.copy()
    me.materials.clear()
    me.materials.append(simple_mat(o.data.materials[0]))
    ob = bpy.data.objects.new("Terrain", me)
    expt.collection.objects.link(ob)
tri_terrain = sum(len(o.data.polygons) * 2 for o in terrain_objs)
try:
    export_scene(expt, os.path.join(out, "terrain_raw.glb"), export_vertex_color='ACTIVE')
except TypeError:
    export_scene(expt, os.path.join(out, "terrain_raw.glb"), export_colors=True)

# ---- prototypes: one merged mesh each, at the origin
expp = bpy.data.scenes.new("ExportProtos")
pstats = {}
for name in sorted(protos):
    o = bpy.data.objects[name]
    gg = merge([o])
    # one object per prototype, a primitive per material
    sub = write_groups(gg, expp, prefix=name + "__")
    pstats[name] = sum(s[0] for s in sub)
export_scene(expp, os.path.join(out, "protos_raw.glb"))

# ---- metadata
lights = []
for o in src_scene.objects:
    if o.type != 'LIGHT':
        continue
    Lt = o.data
    d = o.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    lights.append({"name": o.name, "type": Lt.type, "pos": yup(o.matrix_world.translation), "dir": yup(d),
                   "color": list(Lt.color), "energy": Lt.energy})
inst = {k: [[*yup((x, y, z)), rz, s, t] for (x, y, z, rz, s, t) in v] for k, v in region.INSTANCES.items()}
routes = {}
for name, pr in region.PROFILES.items():
    pts = [yup((p[0], p[1], z)) for p, z in zip(pr["pts"][::2], pr["z"][::2])]
    routes[name] = {"pts": pts, "color": L.ROUTE_COLORS.get(name)}
meta = {
    "board": L.BOARD, "square": L.SQUARE, "square_tree": L.SQUARE_TREE, "shed": L.SHED, "head": L.HEAD,
    "instances": inst, "proto_triangles": pstats, "routes": routes, "lights": lights,
    "door_hinge": yup(hinge.matrix_world.translation), "door_space": "world", "chimney": yup(Bld.SHOP_CHIMNEY_TOP),
    "triangles": {"static": int(sum(s[0] for s in stats)), "terrain": int(tri_terrain)},
    "cameras": {name: {"pos": yup(loc), "target": yup(tgt), "fov_h": 2 * math.degrees(math.atan(18 / lens))}
                for name, (loc, tgt, lens, fs, foc) in CAMS.items()},
}
json.dump(meta, open(os.path.join(out, "region.json"), "w"))
print("instances:", {k: len(v) for k, v in inst.items()})
print("proto triangles:", pstats)
print(f"done {time.time() - t0:.0f}s")
