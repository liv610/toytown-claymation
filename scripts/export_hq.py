"""Export the baked visual-quality area + the rest of the village for the browser.

  blender -b renders/hq/bake/hq_baked.blend --python scripts/export_hq.py -- web/hq/assets

Writes baked_<key>.glb (UV'd meshes for the baked texture), rest.glb (everything else,
merged by material, live materials), hq.json (cameras, lights, bake scales, door hinge).
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(OUT, exist_ok=True)
s = bpy.data.scenes["Scene"]
bpy.context.window.scene = s
bake_dir = os.path.dirname(bpy.data.filepath)
bmeta = json.load(open(os.path.join(bake_dir, "bake_meta.json")))


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
    b.inputs['Base Color'].default_value = (*list(src.get("rt_color", (0.8, 0.8, 0.8))), 1) if src else (0.8, 0.8, 0.8, 1)
    b.inputs['Roughness'].default_value = src.get("rt_rough", 0.6) if src else 0.6
    b.inputs['Metallic'].default_value = src.get("rt_metal", 0.0) if src else 0.0
    if src and "rt_emit" in src:
        b.inputs['Emission Color'].default_value = (*src["rt_emit"], 1)
        b.inputs['Emission Strength'].default_value = min(src["rt_emit_strength"], 8.0)
    m["kind"] = kind
    if src and "rt_color2" in src:
        m["color2"] = list(src["rt_color2"])
    cache[key] = m
    return m


def merge(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    groups = {}
    for o in objs:
        oe = o.evaluated_get(dg)
        try:
            me = oe.to_mesh()
        except RuntimeError:
            continue
        if me is None or not len(me.polygons):
            oe.to_mesh_clear(); continue
        M = o.matrix_world
        me.calc_loop_triangles()
        nl = len(me.loops)
        lv = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", lv)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        ln = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get("vector", ln); ln = ln.reshape(-1, 3)
        nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tl); tl = tl.reshape(-1, 3)
        tm = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", tm)
        Mn = np.array(M, np.float32); R3 = np.array(M.to_3x3().inverted().transposed(), np.float32)
        Pp = co[lv] @ Mn[:3, :3].T + Mn[:3, 3]
        Nn = ln @ R3.T; Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-9
        mats = list(me.materials) or [None]
        for mi, m in enumerate(mats):
            sel = tl[tm == mi]
            if not len(sel):
                continue
            used, inv = np.unique(sel.ravel(), return_inverse=True)
            groups.setdefault(m.name if m else "none", []).append((Pp[used], Nn[used], inv.reshape(-1, 3).astype(np.int32)))
        oe.to_mesh_clear()
    return groups


def write_groups(groups, scene):
    tri = 0
    for mname, parts in groups.items():
        if mname == "none":
            continue
        V = np.concatenate([p[0] for p in parts]); Nn = np.concatenate([p[1] for p in parts])
        off = np.cumsum([0] + [len(p[0]) for p in parts[:-1]])
        T = np.concatenate([p[2] + o_ for p, o_ in zip(parts, off)])
        me = bpy.data.meshes.new(mname)
        me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel())
        me.loops.add(len(T) * 3); me.loops.foreach_set("vertex_index", T.ravel())
        me.polygons.add(len(T))
        me.polygons.foreach_set("loop_start", np.arange(0, len(T) * 3, 3, dtype=np.int32))
        me.polygons.foreach_set("loop_total", np.full(len(T), 3, np.int32))
        me.update()
        me.normals_split_custom_set_from_vertices([tuple(n) for n in Nn])
        me.materials.append(simple_mat(bpy.data.materials.get(mname)))
        ob = bpy.data.objects.new(me.name, me); scene.collection.objects.link(ob)
        tri += len(T)
    return tri


def export(scene, path):
    bpy.context.window.scene = scene
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, export_apply=True,
                              export_extras=True, export_lights=False, export_cameras=False, export_yup=True,
                              export_texcoords=True, export_normals=True)
    print("wrote", path, os.path.getsize(path) // 1024, "KB", flush=True)


# ---- baked targets: one mesh each, one plain material (the browser swaps in the baked texture)
stats = {}
for key in bmeta["targets"]:
    ob = bpy.data.objects["BAKE_" + key]
    sc = bpy.data.scenes.new("X_" + key)
    me = ob.data.copy()
    me.materials.clear()
    pm = bpy.data.materials.new("baked_" + key); pm.use_nodes = True
    me.materials.append(pm)
    o2 = bpy.data.objects.new("baked_" + key, me); sc.collection.objects.link(o2)
    stats[key] = sum(len(p.vertices) - 2 for p in me.polygons)
    export(sc, os.path.join(OUT, f"baked_{key}_raw.glb"))
bpy.context.window.scene = s
hinge_ = bpy.data.objects["DoorHinge"]
door_names = set(c.name for c in hinge_.children_recursive)
# ---- the door's live parts (glass) must swing with it
dg_ = [o for o in s.objects if o.name in door_names and o.type in ('MESH', 'CURVE', 'FONT') and not o.hide_render]
sc = bpy.data.scenes.new("X_doorlive")
stats["door_live"] = write_groups(merge(dg_), sc)
export(sc, os.path.join(OUT, "door_live_raw.glb"))
bpy.context.window.scene = s
# ---- everything else, live materials
rest = [o for o in s.objects if o.type in ('MESH', 'CURVE', 'FONT') and not o.hide_render and not o.name.startswith("BAKE_")
        and o.name not in door_names
        and not any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection)]
g = merge(rest)
sc = bpy.data.scenes.new("X_rest")
stats["rest"] = write_groups(g, sc)
export(sc, os.path.join(OUT, "rest_raw.glb"))
bpy.context.window.scene = s

lights = []
for o in s.objects:
    if o.type != 'LIGHT':
        continue
    L = o.data
    d = o.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    lights.append({"name": o.name, "type": L.type, "pos": yup(o.matrix_world.translation), "dir": yup(d),
                   "color": list(L.color), "energy": L.energy})
hinge = bpy.data.objects["DoorHinge"]
CAMS = {
    "Hero": ((-7.6, -16.4, 5.2), (2.4, 0.0, 4.15), 36),
    "Wide": ((-12.5, -26.0, 10.5), (2.8, 2.0, 3.2), 30),
    "Lamp": ((-6.6, -7.6, 2.5), (0.6, -0.2, 2.1), 30),
    "Entrance": ((-1.9, -5.4, 1.65), (0.9, 0.0, 1.85), 30),
    "Reverse": ((13.6, -8.6, 3.0), (1.0, 0.2, 2.6), 32),
    # new: miniature eye-level views
    "StreetLevel": ((-4.3, -4.6, 0.72), (2.6, -0.6, 1.75), 30),
    "Facade": ((0.2, -4.6, 1.55), (0.1, 0.0, 3.0), 34),
    "SnowCobbles": ((1.0, -3.7, 0.55), (2.6, -1.3, 0.25), 40),
    "DownTheStreet": ((13.0, -3.9, 1.05), (-2.0, -1.6, 2.2), 32),
}
cams = {k: {"pos": yup(p), "target": yup(t), "fov_h": 2 * math.degrees(math.atan(18 / lens))} for k, (p, t, lens) in CAMS.items()}
from tt import buildings as Bld  # noqa: E402
chim = bpy.data.objects.get("BlueShop")
meta = {"bake": bmeta["targets"], "triangles": stats, "lights": lights, "cameras": cams,
        "door_hinge": yup(hinge.matrix_world.translation), "door_space": "world"}
json.dump(meta, open(os.path.join(OUT, "hq.json"), "w"), indent=1)
print("triangles:", stats)
