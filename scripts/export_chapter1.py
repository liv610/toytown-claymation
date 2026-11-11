"""Export Chapter 1's cast and props for the national story (Maple Hollow).

  blender -b --factory-startup --python scripts/export_chapter1.py -- web/national/assets [--preview DIR]

Writes ch1_parent.glb, ch1_child.glb, ch1_volunteer.glb (skinned, on the Marine's rig, with clips) and ch1_props.glb
(the red toy truck, a carton of toys and a wagon of donated toys, each under a named root).
--preview renders quick Workbench stills of every clip (for checking poses, not for show).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
from tt import lib, marine, people, toys  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
out = os.path.abspath(argv[0])
preview = os.path.abspath(argv[argv.index("--preview") + 1]) if "--preview" in argv else None
os.makedirs(out, exist_ok=True)


def fresh():
    """Empty scene; forget lib's cached collections and materials (they belong to the old file)."""
    lib.reset_scene()
    lib._colls.clear()
    lib._mats.clear()


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


GIVE = 48


def give_pose(f):
    """Bend at the knees, lean in and reach both hands forward (placing something in a box), then straighten."""
    t = f / GIVE
    e = ease(t / 0.4) * (1 - ease((t - 0.62) / 0.38))
    P, bob, sway = marine.idle_pose(0)
    for s, x in (("L", 1), ("R", -1)):
        P[f"thigh.{s}"] = (-14 * e - 1.5, 0, 0)
        P[f"shin.{s}"] = (26 * e + 3, 0, 0)
        P[f"foot.{s}"] = (-12 * e - 1.5, 0, 0)
        P[f"upper_arm.{s}"] = (-62 * e - 3, 0, -3 * x)
        P[f"forearm.{s}"] = (-22 * e - 12, 0, 0)
    P["hand.L"] = (0, 0, 0)
    P["spine"] = (10 * e + 1, 0, 0)
    P["chest"] = (6 * e, 0, 0)
    P["head"] = (8 * e - 1, 0, 0)
    return P, -0.035 * e, 0.0


WAVE = 24


def wave_pose(f):
    """A friendly wave with the right hand."""
    p = 2 * math.pi * f / WAVE
    P, bob, sway = marine.idle_pose(f * 2)
    P["upper_arm.R"] = (-20, 0, 72)                    # out to the side, a little forward
    P["forearm.R"] = (-10, 0, 62 + 22 * math.sin(p))  # forearm up, hand waving side to side
    P["head"] = (-2, 0, 4 * math.sin(p))
    return P, bob, sway


LOOK = 48


def look_pose(f):
    """Holding hands height: arm reaching down-sideways (parent beside the child), otherwise idle."""
    P, bob, sway = marine.idle_pose(f)
    P["upper_arm.L"] = (-6, 0, 12)
    P["forearm.L"] = (-8, 0, 0)
    P["head"] = (12, 0, 8)   # looking down at the child
    return P, bob, sway


def swap_materials(mo):
    for slot in mo.material_slots:
        src = slot.material
        m = bpy.data.materials.new("rt_" + src.name)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs['Base Color'].default_value = (*src["rt_color"], 1)
        b.inputs['Roughness'].default_value = src["rt_rough"]
        b.inputs['Metallic'].default_value = src.get("rt_metal", 0.0)
        felt = any(k in src.name for k in ("Coat", "Trouser", "Vest", "Hat", "Pom", "Scarf", "Stripe", "Mitt"))
        m["kind"] = "felt" if felt else src.get("rt_kind", "clay")
        slot.material = m


def shoot(name, ao, clips):
    """Workbench stills of each clip, three-quarter front view."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = 360, 480
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    cam.location = (1.9, -3.6, 1.3)
    cam.rotation_euler = (math.radians(84), 0, math.radians(28))
    sc.camera = cam
    for clip, fn, frame in clips:
        P, bob, sway = fn(frame)
        for b in ao.pose.bones:
            b.rotation_euler = (0, 0, 0); b.location = (0, 0, 0)
        for bn, (x, y, z) in P.items():
            ao.pose.bones[bn].rotation_euler = tuple(math.radians(a) for a in (x, y, z))
        ao.pose.bones["hips"].location = (sway, bob, 0)
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(preview, f"{name}_{clip}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    for b in ao.pose.bones:
        b.rotation_euler = (0, 0, 0); b.location = (0, 0, 0)


for kind in ("parent", "child", "volunteer"):
    fresh()
    ao, mo = people.build(kind)
    clips = [("Walk", marine.walk_free_pose, marine.CYCLE), ("Idle", lambda f: marine.idle_pose(f, False), marine.IDLE)]
    if kind == "child":
        clips += [("WalkCarry", marine.walk_pose, marine.CYCLE), ("IdleCarry", lambda f: marine.idle_pose(f, True), marine.IDLE),
                  ("Give", give_pose, GIVE)]
    if kind == "volunteer":
        clips += [("Wave", wave_pose, WAVE)]
    if kind == "parent":
        clips += [("Look", look_pose, LOOK)]
    if preview:
        os.makedirs(preview, exist_ok=True)
        shoot(kind, ao, [(n, fn, {"Give": 19, "Walk": 6}.get(n, 0)) for n, fn, _ in clips])
    for n, fn, frames in clips:
        marine.make_clip(ao, n, fn, frames)
    swap_materials(mo)
    tris = sum(len(p.vertices) - 2 for p in mo.data.polygons)
    path = os.path.join(out, f"ch1_{kind}_raw.glb")
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 49
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_skins=True, export_animations=True,
                              export_animation_mode='ACTIONS', export_extras=True, export_yup=True,
                              export_force_sampling=True, export_def_bones=False, export_frame_range=False)
    print("exported", kind, tris, "triangles", os.path.getsize(path) // 1024, "KB", flush=True)

# ---- props
fresh()
roots = [toys.truck("Truck", (0, 0, 0)), toys.carton("Carton", (2, 0, 0)), toys.toy_wagon("Wagon", (5, 0, 0))]
for r in roots:
    r.location = (0, 0, 0)
cache = {}
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    for slot in o.material_slots:
        src = slot.material
        if src.name not in cache:
            m = bpy.data.materials.new("rt_" + src.name); m.use_nodes = True
            b = m.node_tree.nodes["Principled BSDF"]
            b.inputs['Base Color'].default_value = (*src.get("rt_color", (0.8, 0.8, 0.8)), 1)
            b.inputs['Roughness'].default_value = src.get("rt_rough", 0.6)
            m["kind"] = src.get("rt_kind", "clay")
            cache[src.name] = m
        slot.material = cache[src.name]
path = os.path.join(out, "ch1_props_raw.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_extras=True, export_yup=True,
                          export_animations=False)
print("exported props", os.path.getsize(path) // 1024, "KB", flush=True)
