"""Export the Stage-1 scene for a real-time (Three.js) test.

Bakes modifiers into plain meshes, merges objects by material (draw calls ~= number
of materials), keeps the door as its own hinged node, swaps the procedural Cycles
shaders for simple PBR materials from each material's rt_* tags, and writes the
lights to JSON (glTF cannot carry area lights).

  blender -b --factory-startup --python scripts/export_realtime.py -- web/realtime/assets
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
TT_IMPORT_ONLY = True
exec(open(os.path.join(HERE, "build_scene.py")).read())

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(out, exist_ok=True)
build()
from tt import buildings as B  # noqa: E402
hinge = B.DOOR_HINGE
door_set = set(o.name for o in hinge.children_recursive)

import numpy as np  # noqa: E402

dg = bpy.context.evaluated_depsgraph_get()
groups = {}        # (material name, is_door) -> list of (verts Nx3, normals Nx3, tris Mx3)
for o in list(bpy.context.scene.objects):
    if o.type not in ('MESH', 'FONT', 'CURVE') or o.hide_render:
        continue
    if any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection):
        continue
    oe = o.evaluated_get(dg)
    try:
        me = oe.to_mesh()
    except RuntimeError:
        continue
    if me is None or not len(me.polygons):
        oe.to_mesh_clear()
        continue
    is_door = o.name in door_set
    M = o.matrix_world   # door parts stay in world space; three.js re-pivots them on the hinge
    me.calc_loop_triangles()
    nl = len(me.loops)
    lv = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", lv)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    ln = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get("vector", ln)
    ln = ln.reshape(-1, 3)
    nt = len(me.loop_triangles)
    tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tl)
    tm = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", tm)
    tl = tl.reshape(-1, 3)
    Mn = np.array(M, np.float32)
    R3 = np.array(M.to_3x3().inverted().transposed(), np.float32)
    # per-corner vertices (keeps split normals; meshes are small enough)
    P = co[lv] @ Mn[:3, :3].T + Mn[:3, 3]
    N = ln @ R3.T
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    mats = list(me.materials) or [None]
    for mi, m in enumerate(mats):
        sel = tl[tm == mi]
        if not len(sel):
            continue
        used, inv = np.unique(sel.ravel(), return_inverse=True)
        key = (m.name if m else "none", is_door)
        groups.setdefault(key, []).append((P[used], N[used], inv.reshape(-1, 3).astype(np.int32)))
    oe.to_mesh_clear()
print("triangles total:", sum(len(t) for parts in groups.values() for (_, _, t) in parts))

# fresh export scene
exp = bpy.data.scenes.new("Export")
door_root = bpy.data.objects.new("Door", None)
door_root.matrix_world = hinge.matrix_world.copy()
exp.collection.objects.link(door_root)
simple = {}


def simple_mat(name):
    if name in simple:
        return simple[name]
    src = bpy.data.materials.get(name)
    m = bpy.data.materials.new("rt_" + name)
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
    simple[name] = m
    return m


stats = []
for (mname, is_door), parts in groups.items():
    if mname == "none":
        continue
    V = np.concatenate([p[0] for p in parts]); Nn = np.concatenate([p[1] for p in parts])
    off = np.cumsum([0] + [len(p[0]) for p in parts[:-1]])
    T = np.concatenate([p[2] + o_ for p, o_ in zip(parts, off)])
    me = bpy.data.meshes.new(("door_" if is_door else "") + mname)
    me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel())
    me.loops.add(len(T) * 3); me.loops.foreach_set("vertex_index", T.ravel())
    me.polygons.add(len(T))
    me.polygons.foreach_set("loop_start", np.arange(0, len(T) * 3, 3, dtype=np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(T), 3, np.int32))
    me.update()
    me.normals_split_custom_set_from_vertices([tuple(n) for n in Nn])
    me.materials.append(simple_mat(mname))
    ob = bpy.data.objects.new(me.name, me)
    exp.collection.objects.link(ob)
    stats.append((len(T), me.name))
    del parts[:]

bpy.context.window.scene = exp
bpy.ops.export_scene.gltf(filepath=os.path.join(out, "toytown.glb"), export_format='GLB', use_active_scene=True,
                          export_apply=False, export_extras=True, export_lights=False, export_cameras=False,
                          export_yup=True)

# lights + cameras for three.js (Blender Z-up -> glTF Y-up: (x, y, z) -> (x, z, -y))
def yup(v):
    return [v[0], v[2], -v[1]]


src = bpy.data.scenes["Scene"]
lights = []
for o in src.objects:
    if o.type != 'LIGHT':
        continue
    L = o.data
    d = o.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    lights.append({"name": o.name, "type": L.type, "pos": yup(o.matrix_world.translation), "dir": yup(d),
                   "color": list(L.color), "energy": L.energy,
                   "size": getattr(L, "size", 0.1), "lightgroup": o.lightgroup})
cams = {}
for name, (loc, tgt, lens, fs, foc) in CAMS.items():
    cams[name] = {"pos": yup(loc), "target": yup(tgt), "fov_h": 2 * math.degrees(math.atan(18 / lens)), "fstop": fs,
                  "focus": yup(foc)}
json.dump({"lights": lights, "cameras": cams, "door_hinge": yup(hinge.matrix_world.translation),
           "chimney": yup(B.SHOP_CHIMNEY_TOP),
           "triangles": sum(s_[0] for s_ in stats), "meshes": len(stats)},
          open(os.path.join(out, "scene.json"), "w"), indent=1)
stats.sort(reverse=True)
print("meshes:", len(stats), "triangles:", sum(s_[0] for s_ in stats))
for n, name in stats[:12]:
    print(f"  {n:>9,}  {name}")
