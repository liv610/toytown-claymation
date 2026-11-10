"""Build the Toy Town Stage-1 scene and (optionally) render it.

Usage (from the project root):
  blender -b --factory-startup --python scripts/build_scene.py -- [--preview] [--render OUT.png]
        [--res 2560x1440] [--samples 384] [--no-save] [--cam NAME]
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from tt import lib, buildings, street, trees, props, world  # noqa: E402
from tt import palette as P  # noqa: E402


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {"strip": None, "job": None, "out": None, "cams": None, "border": None, "preview": "--preview" in a, "render": None, "res": None, "samples": None, "save": "--no-save" not in a,
         "cam": "Hero"}
    for k in ("--render", "--res", "--samples", "--cam", "--border", "--job", "--out", "--cams", "--strip"):
        if k in a:
            o[k[2:]] = a[a.index(k) + 1]
    return o


def build():
    t0 = time.time()
    lib.reset_scene()
    world.sky(strength=0.5)

    # --- hero buildings
    buildings.blue_shop(Vector((0, 0, 0)))
    buildings.pink_house(Vector((5.95, 0.45, 0)))

    # --- street
    street.ground()
    street.bed()
    street.cobbles()
    street.edge_lumps()

    # --- Christmas tree beside the shop
    trees.fir("XmasTree", (-3.7, -1.35, 0.0), 3.1, 1.15, tiers=7, color=P.srgb('#1f6b3a'), snow_amt=0.4,
              ornaments=True, lights=True, star=True, lean=0.03)
    props.gift_pile("TreeGifts", (-3.4, -2.25, 0.0), n=5, spread=0.75, scale=1.35)
    props.gift_pile("ShopGifts", (1.7, -1.0, 0.0), n=4, spread=0.7, scale=1.45)
    props.gift_pile("DoorGifts", (-1.35, -0.95, 0.0), n=2, spread=0.3, scale=1.2)

    # --- street furniture
    props.lamppost("LampWest", (-5.0, -2.35, 0.0))
    props.lamppost("LampEast", (9.0, -1.9, 0.0), height=3.2)
    props.bench("Bench", (10.2, -1.15, 0.12), rot_z=0.35)
    props.wagon("Wagon", (7.6, -2.6, 0.0), rot_z=-0.35)

    # --- framing evergreens (foreground left, between houses, right)
    trees.fir("FirFG", (-7.4, -6.8, 0.0), 6.5, 2.0, tiers=9, color=P.PINE_DARK, snow_amt=0.9, lean=0.03)
    # foreground crusty drifts (close to camera, they fall out of focus and frame the shot)
    sn = lib.snow("GroundSnow")
    for (x, y, r) in [(3.5, -9.6, 0.9), (4.6, -9.2, 0.7), (5.8, -9.5, 1.0), (7.2, -9.0, 0.8), (8.4, -8.7, 1.1),
                      (-3.5, -9.5, 0.7), (-2.3, -9.9, 0.8)]:
        lib.blob("fgdrift", (x, y, 0.0), r, sn, squash=(1.5, 1.0, 0.55), subd=4, lump=0.3)
    trees.fir("FirGap", (3.35, 2.2, 0.0), 1.6, 0.55, tiers=6, color=P.PINE, snow_amt=0.8)
    trees.fir("FirR1", (12.4, 1.0, 0.0), 4.6, 1.6, tiers=8, color=P.PINE_DARK, snow_amt=0.85)

    # --- middle-ground village climbing the hill behind (simplified houses,
    #     varied shapes/colours; they live in the defocused background)
    bh = buildings.bg_house
    cols = [P.CREAM_WARM, P.srgb('#b54a3f'), P.srgb('#d4a64a'), P.srgb('#5f8f95'), P.PINK_LIGHT,
            P.srgb('#6f8fc4'), P.CREAM, P.srgb('#c0614f'), P.srgb('#9a6fa8'), P.srgb('#e0b27a')]
    spots = [(-9.2, 3.2, 0.3), (-4.0, 8.5, -0.1), (1.5, 9.0, 0.12), (6.6, 7.8, -0.15), (11.0, 6.5, -0.3),
             (-12.5, 10.5, 0.3), (-7.5, 13.5, 0.1), (-2.0, 14.0, -0.2), (3.5, 14.5, 0.15), (8.5, 13.0, -0.1),
             (13.5, 12.0, -0.4), (-10.0, 18.5, 0.2), (-4.5, 19.5, 0.0), (1.0, 20.0, 0.1), (6.5, 19.0, -0.2),
             (11.5, 18.0, -0.3), (-14.0, 15.5, 0.4), (16.5, 16.0, -0.5), (19.0, 11.0, -0.6),
             (15.5, 22.0, -0.4), (21.0, 17.5, -0.7)]
    for i, (x, y, rz) in enumerate(spots):
        W = lib.RNG.uniform(3.2, 4.6); D = lib.RNG.uniform(3.2, 4.0); H = lib.RNG.uniform(3.6, 5.4)
        bh(f"Bg{i}", Vector((x, y, street.ground_height(x, y) - 0.15)), W, D, H, lib.RNG.uniform(45, 58),
           cols[i % len(cols)], rot_z=rz, gable_front=(i % 3 != 1), windows_lit=0.8)
    props.stone_bridge("Viaduct", (15.5, 4.5, 0.0), rot_z=-1.2, span=4.6, arches=2)
    fir_spots = [(-15, 7, 5.5), (-6.5, 11.5, 4.5), (4.5, 11.8, 5), (9.5, 10.2, 5.5), (-11, 14, 6),
                 (13, 15, 6.5), (-1, 17, 6), (8.8, 16.5, 5.5), (-8, 16.5, 6.5), (3.8, 17.5, 6),
                 (-13.5, 21, 7), (-2.5, 22.5, 7), (9, 22, 7.5), (17, 20, 7), (-17.5, 12, 7), (-0.7, 6.3, 3.2),
                 (19, 9, 6), (-6.5, 4.2, 3.5), (5.5, 23.5, 7), (-7.5, 24, 7)]
    for i, (x, y, h) in enumerate(fir_spots):
        trees.fir(f"FirBg{i}", (x, y, street.ground_height(x, y) - 0.1), h, h * 0.34, tiers=7 if h < 6 else 8,
                  color=P.PINE_DARK if i % 2 else P.PINE, snow_amt=0.9, rings=5, rad_segs=48, trunk=False)
    props.hills()

    # falling snow is now added per-frame in post (scripts/post/), so it can move
    world.lighting()
    print(f"build: {time.time() - t0:.1f}s, objects={len(bpy.data.objects)}")


CAMS = {
    # name: (location, target, lens, fstop, focus)
    "Hero": ((-7.6, -16.4, 5.2), (2.4, 0.0, 4.15), 36, 0.13, (0.3, -0.9, 2.4)),
    "Wide": ((-12.5, -26.0, 10.5), (2.8, 2.0, 3.2), 30, 0.12, (0.5, -0.8, 2.4)),
    "Lamp": ((-6.6, -7.6, 2.5), (0.6, -0.2, 2.1), 30, 0.22, (-4.95, -2.4, 2.7)),
    "Entrance": ((-1.9, -5.4, 1.65), (0.9, 0.0, 1.85), 30, 0.3, (0.0, -0.3, 1.6)),
    "Reverse": ((13.6, -8.6, 3.0), (1.0, 0.2, 2.6), 32, 0.2, (6.0, -0.4, 2.0)),
}

# camera move: wide village -> toward the shop -> past the lamppost -> entrance reveal
MOVE_KEYS = [  # (frame, location, target, fstop)
    (1, (-12.5, -26.0, 10.5), (2.8, 2.0, 3.2), 0.12),
    (26, (-8.6, -16.5, 5.6), (2.2, 0.5, 3.6), 0.13),
    (50, (-6.2, -8.6, 2.7), (0.8, 0.0, 2.3), 0.2),
    (72, (-1.9, -5.4, 1.65), (0.9, 0.0, 1.85), 0.3),
]


def make_cam(name):
    loc, tgt, lens, fs, foc = CAMS[name]
    return world.camera(name, loc, tgt, lens, fs, foc)


def animate_move(cam):
    """Keyframe a smooth eased dolly; target and focus are separate empties."""
    tgt = bpy.data.objects.new("MoveTarget", None)
    lib.link(tgt, "Cameras")
    cam.constraints.clear()
    c = cam.constraints.new('TRACK_TO')
    c.target = tgt
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    for f, loc, t, fs in MOVE_KEYS:
        cam.location = loc
        cam.keyframe_insert("location", frame=f)
        tgt.location = t
        tgt.keyframe_insert("location", frame=f)
        cam.data.dof.aperture_fstop = fs
        cam.data.dof.keyframe_insert("aperture_fstop", frame=f)
    # focus: keep the shop door sharp as we approach
    foc = cam.data.dof.focus_object
    foc.location = (0.1, -0.6, 1.9)
    for fc in list(cam.animation_data.action.fcurves) + list(tgt.animation_data.action.fcurves):
        for k in fc.keyframe_points:
            k.interpolation = 'BEZIER'
            k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'
    s = bpy.context.scene
    s.frame_start, s.frame_end = MOVE_KEYS[0][0], MOVE_KEYS[-1][0]


DOOR_FRAMES = 18          # rendered "on twos" -> 1.5 s at 24 fps
DOOR_ANGLE = 104.0


def door_angle(f):
    t = max(0.0, min(1.0, (f - 1) / (DOOR_FRAMES - 1)))
    e = t * t * (3 - 2 * t)                       # ease in/out
    settle = 0.035 * math.sin(t * math.pi * 2.0) * t   # tiny overshoot, like a hand-pushed door
    return math.radians(DOOR_ANGLE * (e + settle))


def main():
    o = args()
    build()
    from tt import passes
    from tt import buildings as B
    s = bpy.context.scene
    root = os.path.dirname(HERE)
    passes.assign_lightgroups()
    job = o.get("job")
    if job is None:
        cam = make_cam(o["cam"])
        res = tuple(int(v) for v in o["res"].split("x")) if o["res"] else ((800, 450) if o["preview"] else (2560, 1440))
        samples = int(o["samples"]) if o["samples"] else (32 if o["preview"] else 384)
        world.render_settings(res, samples, preview=o["preview"])
        world.compositor()
        if o["save"]:
            p = os.path.join(root, "blender", "toytown_stage1.blend")
            bpy.ops.wm.save_as_mainfile(filepath=p, compress=True)
            print("saved", p)
        if o["render"]:
            s.render.filepath = os.path.abspath(o["render"])
            if o["border"]:
                x0, x1, y0, y1 = (float(v) for v in o["border"].split(","))
                s.render.use_border = True
                s.render.use_crop_to_border = True
                s.render.border_min_x, s.render.border_max_x = x0, x1
                s.render.border_min_y, s.render.border_max_y = y0, y1
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print(f"render: {time.time() - t0:.1f}s -> {s.render.filepath}")
        return

    out = os.path.abspath(o["out"]) if o.get("out") else os.path.join(root, "renders", "passes", job)
    os.makedirs(out, exist_ok=True)
    res = tuple(int(v) for v in o["res"].split("x"))
    samples = int(o["samples"])
    world.render_settings(res, samples)
    s.render.use_persistent_data = True
    s.render.filepath = os.path.join(out, "beauty_")
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_depth = '8'
    t0 = time.time()
    hinge = B.DOOR_HINGE
    if job in ("hero", "door"):
        cam = make_cam("Hero")
        passes.setup_outputs(out, lightgroups=True)
        door_objs = [c for c in hinge.children_recursive if c.type == 'MESH']
        bb = passes.screen_bbox(door_objs, cam)
        passes.camera_meta(cam, os.path.join(out, "camera.json"), extra={"door_bbox": bb, "groups": passes.GROUPS})
        if job == "hero" and o.get("strip"):
            # resumable: render one horizontal strip, noisy, with denoiser guides
            i, n = (int(v) for v in o["strip"].split("/"))
            ov = 24 / res[1]
            y0 = max(0.0, 1 - (i + 1) / n - ov); y1 = min(1.0, 1 - i / n + ov)
            s.cycles.use_denoising = False
            sd = os.path.join(out, "strips", (f"s{i:02d}" if n == 14 else f"h{i:02d}"))
            passes.setup_outputs(sd, lightgroups=True, denoise_groups=False)
            s.render.filepath = os.path.join(sd, "beauty_")
            s.render.use_border = True
            s.render.use_crop_to_border = False
            s.render.border_min_x, s.render.border_max_x = 0.0, 1.0
            s.render.border_min_y, s.render.border_max_y = y0, y1
            s.frame_set(1)
            bpy.ops.render.render(write_still=True)
            open(os.path.join(sd, "DONE"), "w").write(f"{y0} {y1}")
        elif job == "hero":
            if o["save"]:
                bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root, "blender", "toytown_stage1.blend"), compress=True)
            s.frame_set(1)
            bpy.ops.render.render(write_still=True)
        else:
            # crop region: the doorway, its frame and the ground the light will spill onto
            W, H = res
            x0, y0, x1, y1 = bb
            pad = 0.06 * W
            bx0, bx1 = max(0, x0 - pad * 1.2), min(W, x1 + pad * 1.6)
            by0, by1 = max(0, y0 - pad), H            # down to the bottom of frame
            s.render.use_border = True
            s.render.use_crop_to_border = False
            s.render.border_min_x, s.render.border_max_x = bx0 / W, bx1 / W
            s.render.border_min_y, s.render.border_max_y = 1 - by1 / H, 1 - by0 / H
            with open(os.path.join(out, "crop.json"), "w") as fh:
                json.dump({"crop": [bx0, by0, bx1, by1], "frames": DOOR_FRAMES}, fh)
            for f in range(1, DOOR_FRAMES + 1):
                hinge.rotation_euler = (0, 0, door_angle(f))
                hinge.keyframe_insert("rotation_euler", frame=f)
            s.frame_start, s.frame_end = 1, DOOR_FRAMES
            bpy.ops.render.render(animation=True)
    elif job == "stills":
        for name in [n for n in ("Wide", "Lamp", "Entrance", "Reverse") if not o.get("cams") or n in o["cams"]]:
            cam = make_cam(name)
            d = os.path.join(out, name)
            os.makedirs(d, exist_ok=True)
            passes.setup_outputs(d, lightgroups=False)
            s.render.filepath = os.path.join(d, "beauty_")
            passes.camera_meta(cam, os.path.join(d, "camera.json"))
            s.frame_set(1)
            t1 = time.time()
            bpy.ops.render.render(write_still=True)
            print(f"still {name}: {time.time() - t1:.0f}s", flush=True)
    elif job == "move":
        cam = make_cam("Wide")
        animate_move(cam)
        passes.setup_outputs(out, lightgroups=False)
        passes.camera_meta(cam, os.path.join(out, "camera.json"), frames=list(range(s.frame_start, s.frame_end + 1)))
        bpy.ops.render.render(animation=True)
    print(f"job {job}: {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__" and not globals().get("TT_IMPORT_ONLY"):
    main()
