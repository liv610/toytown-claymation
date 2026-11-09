"""Build the Toy Town Stage-1 scene and (optionally) render it.

Usage (from the project root):
  blender -b --factory-startup --python scripts/build_scene.py -- [--preview] [--render OUT.png]
        [--res 2560x1440] [--samples 384] [--no-save] [--cam NAME]
"""
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
    o = {"border": None, "preview": "--preview" in a, "render": None, "res": None, "samples": None, "save": "--no-save" not in a,
         "cam": "Hero"}
    for k in ("--render", "--res", "--samples", "--cam", "--border"):
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

    world.falling_snow()
    world.lighting()
    print(f"build: {time.time() - t0:.1f}s, objects={len(bpy.data.objects)}")


CAMS = {
    # name: (location, target, lens, fstop, focus)
    "Hero": ((-7.6, -16.4, 5.2), (2.4, 0.0, 4.15), 36, 0.13, (0.3, -0.9, 2.4)),
}


def main():
    o = args()
    build()
    loc, tgt, lens, fs, foc = CAMS["Hero"]
    world.camera("Hero", loc, tgt, lens, fs, foc)
    res = tuple(int(v) for v in o["res"].split("x")) if o["res"] else ((800, 450) if o["preview"] else (2560, 1440))
    samples = int(o["samples"]) if o["samples"] else (32 if o["preview"] else 384)
    world.render_settings(res, samples, preview=o["preview"])
    world.compositor()
    root = os.path.dirname(HERE)
    if o["save"]:
        p = os.path.join(root, "blender", "toytown_stage1.blend")
        bpy.ops.wm.save_as_mainfile(filepath=p, compress=True)
        print("saved", p)
    if o["render"]:
        s = bpy.context.scene
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


main()
