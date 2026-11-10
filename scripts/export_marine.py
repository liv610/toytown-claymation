"""Export the Marine as a game-ready skinned glTF with a 'Walk' clip.

  blender -b --factory-startup --python scripts/export_marine.py -- web/realtime/assets/marine.glb
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
from tt import lib, marine

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
lib.reset_scene()
ao, mo = marine.build()
act = marine.make_walk(ao, "Walk")
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
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, marine.CYCLE + 1
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_extras=True, export_yup=True,
                          export_force_sampling=True, export_def_bones=False, export_frame_range=False)
print("exported", out, os.path.getsize(out))
