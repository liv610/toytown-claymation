"""Export the Marine as a game-ready skinned glTF with a 'Walk' clip.

  blender -b --factory-startup --python scripts/export_marine.py -- web/realtime/assets/marine.glb
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
from tt import lib, marine

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
lib.reset_scene()
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
with_gift = "--with-gift" in sys.argv
ao, mo = marine.build(gift=with_gift)
if with_gift:
    marine.make_walk(ao, "Walk")
else:
    # clip library for the cinematic: arms-free walk, carrying walk, idles
    marine.make_clip(ao, "Walk", marine.walk_free_pose, marine.CYCLE)
    marine.make_clip(ao, "WalkCarry", marine.walk_pose, marine.CYCLE)
    marine.make_clip(ao, "Idle", lambda f: marine.idle_pose(f, False), marine.IDLE)
    marine.make_clip(ao, "IdleCarry", lambda f: marine.idle_pose(f, True), marine.IDLE)
# swap Cycles shaders for simple PBR from each material's rt_* tags
for slot in mo.material_slots:
    src = slot.material
    m = bpy.data.materials.new("rt_" + src.name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs['Base Color'].default_value = (*src["rt_color"], 1)
    b.inputs['Roughness'].default_value = src["rt_rough"]
    b.inputs['Metallic'].default_value = src.get("rt_metal", 0.0)
    m["kind"] = "felt" if src.name in ("MarineCoat", "MarineTrouser") else src.get("rt_kind", "clay")
    slot.material = m
tris = sum(len(p.vertices) - 2 for p in mo.data.polygons)
print("marine triangles:", tris, "verts:", len(mo.data.vertices))
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, marine.IDLE + 1
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_extras=True, export_yup=True,
                          export_force_sampling=True, export_def_bones=False, export_frame_range=False)
print("exported", out, os.path.getsize(out))
if not with_gift:
    # the present as its own prop (origin at its centre), so hands can hand it over
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    marine.PARTS.clear()
    marine.build_gift((0, 0, 0), yaw=0.0)
    M = marine.mats()
    bm = bmesh.new()
    keys = []
    for part, mk, _ in marine.PARTS:
        if mk not in keys:
            keys.append(mk)
        for f in part.faces:
            f.material_index = keys.index(mk)
        me = bpy.data.meshes.new("p"); part.to_mesh(me); part.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new("Gift"); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    for k in keys:
        src = M[k]
        m = bpy.data.materials.new("rt_" + src.name); m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs['Base Color'].default_value = (*src["rt_color"], 1)
        b.inputs['Roughness'].default_value = src["rt_rough"]
        b.inputs['Metallic'].default_value = src.get("rt_metal", 0.0)
        me.materials.append(m)
    g = bpy.data.objects.new("Gift", me)
    bpy.context.scene.collection.objects.link(g)
    gout = os.path.join(os.path.dirname(out), "gift.glb")
    bpy.ops.export_scene.gltf(filepath=gout, export_format='GLB', export_yup=True, export_animations=False)
    print("exported", gout, os.path.getsize(gout))
