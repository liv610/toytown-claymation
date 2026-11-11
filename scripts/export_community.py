"""Build Maple Hollow (scripts/tt/community.py) and export it for the national map.

  blender -b --factory-startup --python scripts/export_community.py -- web/national/assets

Writes maple_raw.glb (merged by material, rt_* tags → material extras for the browser's clay shader) and
maple.json (lamp / tree / drop-off positions in three.js coordinates). Then run:
  node web/tools_optimize.mjs web/national/assets/maple_raw.glb web/national/assets/maple.glb 0.5 0.0006
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from tt import lib, community  # noqa: E402

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(out, exist_ok=True)
t0 = time.time()
lib.reset_scene()
meta = community.build()
print(f"built {time.time() - t0:.0f}s", flush=True)


def yup(v):
    return [float(v[0]), float(v[2]), float(-v[1])]


def simple_mat(src, cache={}):
    key = src.name if src else "none"
    if key in cache:
        return cache[key]
    m = bpy.data.materials.new("rt_" + key); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    m["kind"] = src.get("rt_kind", "clay") if src else "clay"
    b.inputs['Base Color'].default_value = (*list(src.get("rt_color", (0.8, 0.8, 0.8))), 1) if src else (0.8, 0.8, 0.8, 1)
    b.inputs['Roughness'].default_value = src.get("rt_rough", 0.6) if src else 0.6
    b.inputs['Metallic'].default_value = src.get("rt_metal", 0.0) if src else 0.0
    if src and "rt_emit" in src:
        b.inputs['Emission Color'].default_value = (*src["rt_emit"], 1)
        b.inputs['Emission Strength'].default_value = min(src["rt_emit_strength"], 8.0)
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
        me.calc_loop_triangles()
        nl = len(me.loops)
        lv = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", lv)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        ln = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get("vector", ln); ln = ln.reshape(-1, 3)
        nt = len(me.loop_triangles)
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tl); tl = tl.reshape(-1, 3)
        tm = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", tm)
        M = o.matrix_world; Mn = np.array(M, np.float32); R3 = np.array(M.to_3x3().inverted().transposed(), np.float32)
        Pp = co[lv] @ Mn[:3, :3].T + Mn[:3, 3]
        Nn = ln @ R3.T; Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-9
        for mi, m in enumerate(list(me.materials) or [None]):
            sel = tl[tm == mi]
            if not len(sel):
                continue
            used, inv = np.unique(sel.ravel(), return_inverse=True)
            groups.setdefault(m.name if m else "none", []).append((Pp[used], Nn[used], inv.reshape(-1, 3).astype(np.int32)))
        oe.to_mesh_clear()
    return groups


src = bpy.context.scene
objs = [o for o in src.objects if o.type in ('MESH', 'FONT', 'CURVE') and not o.hide_render
        and not any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection)]
groups = merge(objs)
exp = bpy.data.scenes.new("ExportMaple")
tris = 0
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
    me.update(); me.normals_split_custom_set_from_vertices([tuple(n) for n in Nn])
    me.materials.append(simple_mat(bpy.data.materials.get(mname)))
    ob = bpy.data.objects.new(mname, me); exp.collection.objects.link(ob)
    tris += len(T)
bpy.context.window.scene = exp
path = os.path.join(out, "maple_raw.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, export_apply=False,
                          export_extras=True, export_lights=False, export_cameras=False, export_yup=True)
print("wrote", path, os.path.getsize(path) // 1024, "KB,", tris, "triangles,", len(groups), "materials", flush=True)
json.dump({"lamps": [yup(l) for l in meta["lamps"]], "tree": yup(meta["tree"]), "box": yup(meta["box"]),
           "hall_door": yup(meta["hall_door"])}, open(os.path.join(out, "maple.json"), "w"), indent=1)
print(f"done {time.time() - t0:.0f}s", flush=True)
