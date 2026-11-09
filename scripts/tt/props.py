"""Street furniture and set dressing: lampposts, bench, wagon, presents, bridge."""
import math

import bmesh
import bpy
from mathutils import Vector

from . import lib
from .lib import RNG, box, blob, clay, snow, wood
from . import palette as P
from .buildings import snow_slab, root


def iron():
    return clay("Iron", P.IRON, rough=0.42, sss=0.0, dimple=0.6, grain=0.5, coat=0.25, var=0.1)


def red_bow(parent, loc, s=1.0, rot_z=0.0):
    red = lib.glossy_paint("RibbonRed", P.DEEP_RED, rough=0.35)
    x, y, z = loc
    ca, sa = math.cos(rot_z), math.sin(rot_z)
    def P_(dx, dy, dz):
        return (x + dx * ca - dy * sa, y + dx * sa + dy * ca, z + dz)
    objs = []
    for side in (-1, 1):
        objs.append(blob("loop", P_(side * 0.11 * s, 0, 0.01 * s), 0.09 * s, red, squash=(1.4, 0.55, 0.85), subd=3,
                         lump=0.12, rot=(0, side * 0.45, rot_z)))
        objs.append(blob("tail", P_(side * 0.06 * s, -0.01, -0.17 * s), 0.05 * s, red, squash=(0.7, 0.35, 2.1),
                         subd=2, lump=0.1, rot=(0, side * 0.35, rot_z)))
    objs.append(blob("knot", P_(0, -0.02, 0), 0.05 * s, red, subd=2, lump=0.08))
    for o in objs:
        o.parent = parent
    return objs


def lamppost(name, loc, height=3.3, rot_z=0.0):
    R = root(name, loc, lean=(RNG.uniform(-0.02, 0.02), RNG.uniform(-0.02, 0.02), rot_z))
    ir = iron()
    glow = lib.window_glow("LampGlass", color=(1.0, 0.68, 0.32), strength=5.0, frost=False)
    h = height
    prof = [(0.0, 0), (0.2, 0), (0.2, 0.08), (0.14, 0.14), (0.13, 0.32), (0.09, 0.38), (0.07, 0.42),
            (0.055, 0.6), (0.05, h * 0.75), (0.07, h * 0.77), (0.05, h * 0.79), (0.045, h - 0.45),
            (0.08, h - 0.42), (0.12, h - 0.38), (0.0, h - 0.37)]
    post = lib.lathe(name + "_post", prof, (0, 0, 0), ir, segs=20, wob=0.08)
    lib.clay_mods(post, 0, 0, 0, 0.01)
    post.parent = R
    # lantern: tapered glass box with iron corner posts, peaked cap, finial
    lz = h - 0.37
    gl = lib.lathe(name + "_glass", [(0.13, 0.0), (0.19, 0.42), (0.0, 0.42)], (0, 0, lz), glow, segs=6, smooth_subd=0)
    gl.rotation_euler = (0, 0, math.pi / 6)
    gl.parent = R
    bulb = lib.emissive("LampBulb", (1.0, 0.8, 0.5), 40)
    b = blob(name + "_bulb", (0, 0, lz + 0.2), 0.06, bulb, subd=2, lump=0)
    b.parent = R
    for i in range(6):
        a = math.pi / 6 + i * math.pi / 3
        bar = box("lbar", (0.025, 0.025, 0.44), (0.16 * math.cos(a), 0.16 * math.sin(a), lz + 0.21), ir,
                  rot=(0, 0, 0), bevel=0.008, subd=0, wobble=0)
        bar.rotation_euler = (-math.sin(a) * 0.14, math.cos(a) * 0.14, 0)
        bar.parent = R
    cap = lib.lathe(name + "_cap", [(0.0, 0.0), (0.27, 0.0), (0.26, 0.05), (0.12, 0.2), (0.04, 0.26),
                                    (0.05, 0.3), (0.0, 0.36)], (0, 0, lz + 0.42), ir, segs=6, smooth_subd=1)
    cap.rotation_euler = (0, 0, math.pi / 6)
    cap.parent = R
    fin = blob(name + "_fin", (0, 0, lz + 0.82), 0.04, ir, subd=2, lump=0)
    fin.parent = R
    s = blob(name + "_snowcap", (0, 0, lz + 0.56), 0.2, snow(), squash=(1.45, 1.45, 0.55), subd=3, lump=0.3)
    s.parent = R
    # base snow mound
    s = blob(name + "_basesnow", (0, 0, 0.06), 0.3, snow("GroundSnow"), squash=(1.2, 1.2, 0.45), subd=3, lump=0.35)
    s.parent = R
    red_bow(R, (0, -0.07, h * 0.72), 1.15)
    L = bpy.data.lights.new(name + "_light", 'POINT')
    L.energy = 70
    L.color = (1.0, 0.66, 0.34)
    L.shadow_soft_size = 0.12
    lo = bpy.data.objects.new(name + "_light", L)
    lo.location = (0, 0, lz + 0.22)
    lib.link(lo, "Lights")
    lo.parent = R
    return R


def present(parent, loc, size, color, ribbon, rot_z=0.0, snowcap=True):
    sx, sy, sz = size
    paper = clay("Paper_" + str(round(color[0], 2)) + str(round(color[1], 2)), color, rough=0.5, sss=0.05,
                 dimple=0.6, dimple_scale=10, var=0.12, coat=0.15)
    rib = lib.glossy_paint("Rib_" + str(round(ribbon[0], 2)), ribbon, rough=0.3)
    x, y, z = loc
    objs = [box("gift", size, (x, y, z + sz / 2), paper, rot=(0, 0, rot_z), bevel=0.02, subd=2, wobble=0.008)]
    objs.append(box("ribA", (sx + 0.012, 0.045, sz + 0.012), (x, y, z + sz / 2), rib, rot=(0, 0, rot_z), bevel=0.006,
                    subd=1, wobble=0))
    objs.append(box("ribB", (0.045, sy + 0.012, sz + 0.012), (x, y, z + sz / 2), rib, rot=(0, 0, rot_z), bevel=0.006,
                    subd=1, wobble=0))
    s = min(sx, sy) / 0.35
    for side in (-1, 1):
        objs.append(blob("gbow", (x + side * 0.045 * s * math.cos(rot_z), y + side * 0.045 * s * math.sin(rot_z),
                                  z + sz + 0.03 * s), 0.045 * s, rib, squash=(1.4, 0.6, 0.9), subd=2, lump=0.1,
                         rot=(0, side * 0.5, rot_z)))
    if snowcap and RNG.random() < 0.6:
        objs.append(blob("gsnow", (x + RNG.uniform(-0.05, 0.05), y, z + sz + 0.01), min(sx, sy) * 0.28, snow(),
                         squash=(1.5, 1.2, 0.35), subd=2, lump=0.3))
    for o in objs:
        o.parent = parent
    return objs


GIFT_COLORS = [
    (P.MUTED_RED, P.GOLD), (P.srgb('#2d5fae'), P.CREAM), (P.GOLD, P.DEEP_RED), (P.srgb('#c94c55'), P.CREAM),
    (P.SHUTTER_GREEN, P.DEEP_RED), (P.PINK_LIGHT, P.srgb('#c9a0d8')), (P.MUSTARD, P.SHUTTER_GREEN),
]


def gift_pile(name, loc, n=4, spread=0.6, scale=1.0):
    R = root(name, loc)
    placed = []
    for i in range(n):
        for _ in range(20):
            x = RNG.uniform(-spread, spread)
            y = RNG.uniform(-spread * 0.5, spread * 0.5)
            if all((x - px) ** 2 + (y - py) ** 2 > 0.12 * scale for px, py in placed):
                break
        placed.append((x, y))
        sx = RNG.uniform(0.22, 0.42) * scale
        sy = RNG.uniform(0.22, 0.38) * scale
        sz = RNG.uniform(0.18, 0.36) * scale
        c, r = GIFT_COLORS[(i + hash(name)) % len(GIFT_COLORS)]
        present(R, (x, y, 0.0), (sx, sy, sz), c, r, RNG.uniform(-0.4, 0.4))
    return R


def bench(name, loc, rot_z=0.0):
    R = root(name, loc, lean=(0, 0, rot_z))
    w = wood("BenchWood", P.WOOD, painted=False, rough=0.65)
    ir = iron()
    L = 1.7
    for k in range(3):
        box("slat", (L, 0.12, 0.05), (0, -0.2 + k * 0.15, 0.48 + RNG.uniform(-0.01, 0.01)), w,
            rot=(0, 0, RNG.uniform(-0.01, 0.01)), bevel=0.02, subd=2, wobble=0.01).parent = R
    for k in range(3):
        box("bslat", (L, 0.05, 0.12), (0, 0.17 + k * 0.03, 0.66 + k * 0.17), w, rot=(-0.2, 0, 0), bevel=0.02, subd=2,
            wobble=0.01).parent = R
    for sx in (-1, 1):
        x = sx * (L / 2 - 0.15)
        box("leg", (0.06, 0.5, 0.06), (x, 0.0, 0.45), ir, bevel=0.02, subd=1, wobble=0).parent = R
        box("legf", (0.06, 0.06, 0.48), (x, -0.22, 0.22), ir, rot=(0.12, 0, 0), bevel=0.02, subd=1, wobble=0).parent = R
        box("legb", (0.06, 0.06, 1.05), (x, 0.2, 0.5), ir, rot=(-0.2, 0, 0), bevel=0.02, subd=1, wobble=0).parent = R
        box("arm", (0.07, 0.5, 0.06), (x, -0.02, 0.72), ir, bevel=0.025, subd=1, wobble=0).parent = R
    snow_slab("seatsnow", (L - 0.1, 0.42, 0.12), (0, -0.05, 0.56), (0, 0, 0), lump=0.12, smooth=3, parent=R)
    snow_slab("backsnow", (L - 0.05, 0.12, 0.09), (0.0, 0.25, 1.06), (-0.2, 0, 0), lump=0.06, smooth=2, parent=R)
    return R


def wagon(name, loc, rot_z=0.0, scale=1.35):
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (scale, scale, scale)
    red = wood("WagonRed", P.MUTED_RED, painted=True, rough=0.4)
    dark = wood("WagonDark", P.DEEP_RED, painted=True, rough=0.4)
    ir = iron()
    Lx, Ly, Hz = 1.0, 0.62, 0.26
    z0 = 0.26
    box("bed", (Lx, Ly, 0.05), (0, 0, z0), red, bevel=0.02, subd=1, wobble=0.006).parent = R
    for sy in (-1, 1):
        box("side", (Lx, 0.05, Hz), (0, sy * Ly / 2, z0 + Hz / 2), red, bevel=0.02, subd=2, wobble=0.008).parent = R
    for sx in (-1, 1):
        box("end", (0.05, Ly, Hz), (sx * Lx / 2, 0, z0 + Hz / 2), red, bevel=0.02, subd=2, wobble=0.008).parent = R
    for k in range(3):
        box("strip", (Lx + 0.02, 0.06, 0.025), (0, -Ly / 2 - 0.01, z0 + 0.05 + k * 0.09), dark, bevel=0.008, subd=1,
            wobble=0).parent = R
    for sx in (-1, 1):
        for sy in (-1, 1):
            wh = lib.lathe("wheel", [(0.0, -0.035), (0.13, -0.035), (0.145, -0.02), (0.145, 0.02), (0.13, 0.035),
                                     (0.0, 0.035)], (sx * 0.33, sy * (Ly / 2 + 0.05), 0.15),
                           clay("Tyre", (0.03, 0.03, 0.03), rough=0.6), segs=24)
            wh.rotation_euler = (math.pi / 2, 0, 0)
            wh.parent = R
            hub = blob("hub", (sx * 0.33, sy * (Ly / 2 + 0.09), 0.15), 0.05, red, squash=(1, 0.5, 1), subd=2, lump=0)
            hub.parent = R
    h = box("handle", (0.75, 0.035, 0.035), (-Lx / 2 - 0.34, 0, 0.3), ir, rot=(0, -0.45, 0), bevel=0.01, subd=0,
            wobble=0)
    h.parent = R
    box("grip", (0.04, 0.24, 0.04), (-Lx / 2 - 0.68, 0, 0.46), ir, bevel=0.015, subd=0, wobble=0).parent = R
    # presents riding in the wagon
    for i, (x, y, s) in enumerate([(-0.22, -0.05, (0.34, 0.34, 0.28)), (0.18, 0.06, (0.3, 0.38, 0.22)),
                                   (0.02, 0.0, (0.24, 0.24, 0.3))]):
        c, r = GIFT_COLORS[(i * 2 + 1) % len(GIFT_COLORS)]
        z = z0 + 0.03 + (0.22 if i == 2 else 0)
        present(R, (x, y, z), s, c, r, RNG.uniform(-0.3, 0.3))
    return R


def stone_bridge(name, loc, rot_z=0.0, span=5.0, arches=2):
    """Stone arch viaduct in the background — a nod to the railway."""
    R = root(name, loc, lean=(0, 0, rot_z))
    st = clay("BridgeStone", P.STONE_WARM, rough=0.85, dimple=1.6, dimple_scale=2.5, var=0.3, bump=0.6)
    sn = snow()
    H = 4.2
    D = 2.2
    total = span * arches
    # build each pier and arch ring from individual voussoir blocks
    for a in range(arches):
        cx = -total / 2 + span * (a + 0.5)
        r = span * 0.38
        n = 15
        for i in range(n + 1):
            ang = math.pi * i / n
            px = cx + (r + 0.18) * math.cos(ang)
            pz = H * 0.45 + (r + 0.18) * math.sin(ang)
            box("vous", (0.34, D + 0.05, 0.42), (px, 0, pz), st, rot=(0, -ang + math.pi / 2, 0), bevel=0.06,
                subd=1, wobble=0.04).parent = R
    for p in range(arches + 1):
        px = -total / 2 + span * p
        w = span * 0.24
        for k in range(5):
            box("pier", (w + RNG.uniform(-0.05, 0.05), D, 0.42), (px, 0, 0.21 + k * 0.42), st, bevel=0.07, subd=1,
                wobble=0.05).parent = R
    # spandrel wall + deck, from stacked blocks
    z = H * 0.45
    while z < H:
        x = -total / 2 - 0.3
        while x < total / 2 + 0.3:
            bw = RNG.uniform(0.45, 0.8)
            # skip where the arch opening is
            inside = False
            for a in range(arches):
                cx = -total / 2 + span * (a + 0.5)
                r = span * 0.38
                if abs(x + bw / 2 - cx) < r and z < H * 0.45 + math.sqrt(max(0, r * r - (x + bw / 2 - cx) ** 2)):
                    inside = True
            if not inside:
                box("blk", (bw, D, 0.36), (x + bw / 2, 0, z + 0.18), st, bevel=0.06, subd=1, wobble=0.04).parent = R
            x += bw + 0.02
        z += 0.38
    snow_slab("bridgesnow", (total + 0.9, D + 0.4, 0.35), (0, 0, H + 0.2), (0, 0, 0), lump=0.25, smooth=3, parent=R)
    return R


def hills():
    """Distant rolling snowy hills: huge soft lumps."""
    sn = snow("GroundSnow")
    out = []
    for (x, y, r, sq) in [(-30, 55, 22, (1.6, 0.8, 0.45)), (5, 62, 26, (1.8, 0.8, 0.5)), (38, 52, 20, (1.5, 0.8, 0.5)),
                          (-55, 40, 18, (1.5, 1, 0.5)), (60, 40, 18, (1.5, 1, 0.5))]:
        out.append(blob("hill", (x, y, -2), r, sn, squash=sq, subd=4, lump=0.12))
    return out
