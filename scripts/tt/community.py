"""Maple Hollow (fictional): the first story community of the national map, built with Toy Town's own generators.

Same visual language as Toy Town (clay walls softened and wobbled, sculpted snow slabs, icicles, holly window
boxes, wreaths, garlands, raised lettering, domed cobbles, Toy Town firs, lampposts and gift piles), but its own
buildings: a community hall with the toy drop-off, a general store, a church and homes along one street.

Blender coordinates: x east, y north, z up. North-side buildings face -Y with their fronts at y = 0;
south-side buildings face +Y with their fronts at y = SOUTH. The street runs along x between the curbs.
"""
import math

import bpy
from mathutils import Vector, noise

from . import lib
from .lib import RNG, box, prism, blob, clay, snow, window_glow, wood
from . import palette as P
from . import buildings as B
from . import props, trees, street

SOUTH = -10.6                     # fronts of the south-side buildings
CURB_N, CURB_S = -3.0, -7.6       # the street between the curbs
META = {"lamps": [], "tree": None, "box": None, "hall_door": None}


def _w(R, v):
    """local → world point for metadata."""
    return tuple(R.matrix_world @ Vector(v)) if R.matrix_world else v


def story_building(name, O, W, D, H, color, *, rot_z=0.0, gable_front=False, pitch=34, roof=P.ROOF_SLATE,
                   door=(0.0, 1.0, 2.0, P.WOOD), windows=(), shutters=None, boxes=False, wreath=False,
                   sign=None, sign_z=None, awning=None, garland=None, chimney=True, steeple=False, lit=0.9):
    R = B.root(name, O, lean=(RNG.uniform(-0.008, 0.008), RNG.uniform(-0.008, 0.008), rot_z))
    wall = clay(name + "_wall", color, rough=0.7, sss=0.1, dimple=1.0, var=0.2, stucco=0.9, bump=0.8)
    trim = wood("CreamWood", P.CREAM, painted=True, rough=0.5)
    roof_m = clay("Roof_" + name, roof, rough=0.7, var=0.22)
    glow = window_glow("StoryGlow", color=(1.0, 0.58, 0.26), strength=4.0, frost=True)
    dark = clay("DarkPane", (0.03, 0.035, 0.06), rough=0.15, coat=0.6)
    ice = B.ice_mat()
    pr = math.radians(pitch)
    objs = []
    # ---- body, roof planks and sculpted snow (the same construction as Toy Town's houses)
    if gable_front:
        ridge = H + (W / 2) * math.tan(pr)
        body = prism(name + "_body", [(-W / 2, 0), (W / 2, 0), (W / 2, H), (0, ridge), (-W / 2, H)], D, (0, 0, 0), wall, bevel=0.04, subd=3, wobble=0.04)
        ov = 0.38; slen = (W / 2 + ov) / math.cos(pr) + 0.06
        for sx in (-1, 1):
            cx = sx * (W / 2 + ov) / 2; cz = ridge - ((W / 2 + ov) / 2) * math.tan(pr) + 0.07; rot = (0, sx * pr, 0)
            objs.append(box("r", (slen, D + 0.7, 0.14), (cx, D / 2 - 0.15, cz), roof_m, rot=rot, bevel=0.05, subd=2, wobble=0.03))
            n = Vector((sx * math.sin(pr), 0, math.cos(pr)))
            objs.append(B.snow_slab("rs", (slen + 0.12, D + 0.85, 0.36), tuple(Vector((cx, D / 2 - 0.15, cz)) + n * 0.19), rot, lump=0.24, smooth=2))
        objs.append(B.snow_slab("rr", (0.5, D + 0.9, 0.3), (0, D / 2 - 0.15, ridge + 0.27), (0, 0, 0), lump=0.16, smooth=2))
        # bargeboard trim along the front gable
        for sx in (-1, 1):
            objs.append(box("barge", (slen, 0.1, 0.16), (sx * (W / 2 + ov) / 2, -0.32, ridge - ((W / 2 + ov) / 2) * math.tan(pr) - 0.02), trim, rot=(0, sx * pr, 0), bevel=0.03, subd=1, wobble=0.01))
        eave_icicles = [(-W / 2 - 0.3, -W / 2 + 0.6, H + 0.05), (W / 2 - 0.6, W / 2 + 0.3, H + 0.05)]
    else:
        hd = D / 2; ridge = H + hd * math.tan(pr)
        body = prism(name + "_body", [(0, 0), (D, 0), (D, H), (hd, ridge), (0, H)], W, (-W / 2, 0, 0), wall, axis='X', bevel=0.04, subd=3, wobble=0.04)
        ov = 0.42; slen = (hd + ov) / math.cos(pr) + 0.06
        for sy in (-1, 1):
            cy = hd + sy * (hd + ov) / 2; cz = ridge - ((hd + ov) / 2) * math.tan(pr) + 0.07; rot = (-sy * pr, 0, 0)
            objs.append(box("r", (W + 0.55, slen, 0.14), (0, cy, cz), roof_m, rot=rot, bevel=0.05, subd=2, wobble=0.03))
            n = Vector((0, sy * math.sin(pr), math.cos(pr)))
            objs.append(B.snow_slab("rs", (W + 0.7, slen + 0.12, 0.36), tuple(Vector((0, cy, cz)) + n * 0.19), rot, lump=0.24, smooth=2))
        objs.append(B.snow_slab("rr", (W + 0.75, 0.5, 0.3), (0, hd, ridge + 0.27), (0, 0, 0), lump=0.16, smooth=2))
        objs.append(box("fascia", (W + 0.5, 0.1, 0.2), (0, -ov + 0.02, H - 0.05), trim, bevel=0.03, subd=1, wobble=0.01))
        eave_icicles = [(-W / 2 - 0.2, W / 2 + 0.2, H - 0.12)]
    objs.append(body)
    for x0, x1, z in eave_icicles:
        objs += B.icicles(R, x0, x1, -0.42 if not gable_front else -0.2, z, max(3, int((x1 - x0) * 3.2)), ice, maxlen=0.42)
    # ---- corner boards + a stone footing
    for sx in (-1, 1):
        objs.append(box("corner", (0.16, 0.16, H), (sx * (W / 2 - 0.02), -0.04, H / 2), trim, bevel=0.03, subd=1, wobble=0.01))
    objs.append(box("footing", (W + 0.12, D + 0.12, 0.3), (0, D / 2, 0.12), clay("Footing", P.STONE_WARM, rough=0.85, var=0.3), bevel=0.05, subd=2, wobble=0.02))
    # ---- windows: recessed lit panes, cream frames, muntins, sills with snow, shutters with slats, window boxes
    for (x, z, ww, wh) in windows:
        pane = glow if RNG.random() < lit else dark
        objs.append(box("pane", (ww, 0.05, wh), (x, -0.01, z), pane, bevel=0.01, subd=1, wobble=0.003))
        for (sx_, sz_, px, pz) in [(ww + 0.18, 0.09, x, z + wh / 2 + 0.03), (ww + 0.18, 0.09, x, z - wh / 2 - 0.02), (0.09, wh, x - ww / 2 - 0.04, z), (0.09, wh, x + ww / 2 + 0.04, z)]:
            objs.append(box("wf", (sx_, 0.08, sz_), (px, -0.05, pz), trim, bevel=0.025, subd=1, wobble=0.004))
        objs.append(box("mv", (0.045, 0.05, wh), (x, -0.06, z), trim, bevel=0.01, subd=1, wobble=0))
        objs.append(box("mh", (ww, 0.05, 0.045), (x, -0.06, z + wh * 0.08), trim, bevel=0.01, subd=1, wobble=0))
        objs.append(box("sill", (ww + 0.34, 0.2, 0.08), (x, -0.12, z - wh / 2 - 0.08), trim, bevel=0.02, subd=1, wobble=0.004))
        objs.append(B.snow_slab("sills", (ww + 0.3, 0.2, 0.1), (x, -0.13, z - wh / 2 - 0.0), (0, 0, 0), lump=0.05, smooth=2, dice=2))
        if shutters:
            sh = clay("Shutter_" + name, shutters, rough=0.55, var=0.15)
            for sx in (-1, 1):
                cx = x + sx * (ww / 2 + 0.26)
                objs.append(box("shut", (0.36, 0.06, wh + 0.1), (cx, -0.06, z), sh, bevel=0.02, subd=1, wobble=0.006))
                for k in range(4):
                    objs.append(box("slat", (0.28, 0.05, 0.03), (cx, -0.1, z - wh * 0.38 + k * wh * 0.25), sh, bevel=0.008, subd=0, wobble=0))
        if boxes:
            objs += B.window_box(R, x, z - wh / 2 - 0.12, ww + 0.2, face_y=-0.02)
    # ---- the door: frame, panelled door, brass knob, stone step with snow, optional wreath
    dx, dw, dh, dcol = door
    dm = lib.glossy_paint("Door_" + name, dcol, rough=0.45)
    objs.append(box("dframe", (dw + 0.26, 0.12, dh + 0.14), (dx, -0.04, dh / 2 + 0.05), trim, bevel=0.03, subd=1, wobble=0.004))
    objs.append(box("door", (dw, 0.08, dh), (dx, -0.09, dh / 2 + 0.02), dm, bevel=0.025, subd=1, wobble=0.004))
    for pz in (dh * 0.3, dh * 0.72):
        objs.append(box("panel", (dw * 0.62, 0.04, dh * 0.28), (dx, -0.14, pz), dm, bevel=0.015, subd=1, wobble=0))
    objs.append(blob("knob", (dx + dw * 0.36, -0.17, dh * 0.5), 0.045, lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6), subd=2, lump=0.05))
    objs.append(box("step", (dw + 0.8, 0.7, 0.2), (dx, -0.38, 0.08), clay("Footing", P.STONE_WARM), bevel=0.04, subd=2, wobble=0.015))
    objs.append(B.snow_slab("steps", (dw + 0.5, 0.35, 0.08), (dx - 0.1, -0.55, 0.2), (0, 0, 0), lump=0.04, smooth=2, dice=2))
    if wreath:
        B.wreath(R, (dx, -0.2, dh * 0.74), min(0.3, dw * 0.3))
    # ---- sign with raised lettering, sized to fit its board
    if sign:
        bw = min(W - 0.9, 0.36 * len(sign) + 0.6)
        sz = sign_z if sign_z is not None else H - 0.55
        objs.append(box("signboard", (bw, 0.1, 0.62), (0, -0.07, sz), wood("SignBoard", P.CREAM_WARM, painted=True, rough=0.5), bevel=0.04, subd=1, wobble=0.004))
        objs.append(box("signedge", (bw + 0.12, 0.08, 0.74), (0, -0.03, sz), lib.glossy_paint("SignEdge", P.DEEP_RED, rough=0.4), bevel=0.03, subd=1, wobble=0.004))
        size = min(0.42, (bw - 0.3) / (0.62 * len(sign)))
        t = lib.text_obj(name + "_sign", sign, (0, -0.14, sz), size, lib.glossy_paint("SignLetters", P.DEEP_RED, rough=0.35), extrude=0.03)
        t.parent = R
        objs.append(B.snow_slab("signsnow", (bw + 0.1, 0.16, 0.08), (0, -0.07, sz + 0.37), (0, 0, 0), lump=0.04, smooth=2, dice=2))
    if awning:
        B.awning(R, -awning / 2, awning / 2, 2.75, 1.1, 0.5)
    if garland:
        B.garland(R, garland[0], garland[1], garland[2], -0.16, swags=garland[3])
    if chimney:
        cx = W * 0.24
        cz = (H + (W / 2) * math.tan(pr) if gable_front else H + (D / 2) * math.tan(pr)) - 0.4
        objs.append(box("ch", (0.55, 0.55, 1.7), (cx, D * 0.62, cz), clay("Brick", P.BRICK), bevel=0.04, subd=2, wobble=0.03))
        objs.append(B.snow_slab("chs", (0.68, 0.68, 0.18), (cx, D * 0.62, cz + 0.9), (0, 0, 0), lump=0.08, smooth=2))
    if steeple:
        top = H + (W / 2) * math.tan(pr)
        objs.append(box("tower", (1.6, 1.6, 3.2), (0, 1.3, top + 0.9), wall, bevel=0.05, subd=2, wobble=0.02))
        objs.append(box("belfry", (1.0, 0.1, 1.1), (0, 0.46, top + 1.6), dark, bevel=0.03, subd=1, wobble=0))
        sp = lib.lathe("spire", [(1.15, 0), (0.95, 0.15), (0.0, 2.8)], (0, 1.3, top + 2.5), roof_m, segs=4, wob=0.0)
        sp.rotation_euler = (0, 0, math.pi / 4); sp.parent = R
        objs.append(B.snow_slab("ts", (1.75, 1.75, 0.2), (0, 1.3, top + 2.55), (0, 0, 0), lump=0.08, smooth=2))
        objs.append(blob("cross", (0, 1.3, top + 5.45), 0.12, lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6), squash=(0.6, 0.6, 1.6), subd=2, lump=0.0))
    # ---- a soft bank of snow along the front wall
    for k in range(int(W * 1.5)):
        x = -W / 2 + (k + 0.5) * W / int(W * 1.5)
        if abs(x - dx) < dw * 0.8:
            continue
        objs.append(blob("bank", (x, -0.25, 0.06), RNG.uniform(0.2, 0.32), snow(), squash=(1.5, 1.0, 0.55), subd=2, lump=0.3))
    for o in objs:
        if o.parent is None:
            o.parent = R
    return R


def lane_cobbles(x0, x1, a, b):
    """Toy Town's domed cobbles, laid in loose courses between two curbs (a < y < b)."""
    tv, tf = street._pebble_template()
    me = bpy.data.meshes.new("MapleCobbles")
    all_v, all_f, attr = [], [], []
    x, course = x0, 0
    while x < x1:
        L = RNG.uniform(0.27, 0.36)
        y = a + (RNG.uniform(0, 0.3) if course % 2 else 0)
        while y < b:
            w = RNG.uniform(0.24, 0.38)
            cx = x + L / 2 + RNG.uniform(-0.03, 0.03); cy = y + w / 2 + RNG.uniform(-0.02, 0.02)
            ed = min(cy - a, b - cy)
            if ed < 0.22 and RNG.random() < 0.4:
                y += w; continue
            sx, sy, sz = L * 0.46, w * 0.45, RNG.uniform(0.07, 0.11)
            rot = RNG.uniform(-0.18, 0.18); cz = RNG.uniform(-0.035, 0.0)
            seed = Vector((RNG.random() * 50, RNG.random() * 50, RNG.random() * 50))
            base = len(all_v); cr, sr = math.cos(rot), math.sin(rot); col = RNG.random(); edge_amt = 1.0 - min(1.0, ed / 1.2)
            for v in tv:
                lump = 1 + 0.18 * noise.noise(v * 1.3 + seed)
                px, py, pz = v.x * sx * lump, v.y * sy * lump, v.z
                pz = (pz * sz) if pz > 0 else pz * 0.04
                k = 1.0 + 0.25 * (1 - abs(v.z)); px *= k; py *= k
                all_v.append((cx + px * cr - py * sr, cy + px * sr + py * cr, cz + pz)); attr.append((col, edge_amt, 0))
            all_f += [[base + i for i in f] for f in tf]
            y += w + RNG.uniform(0.005, 0.03)
        x += L + RNG.uniform(0.005, 0.025); course += 1
    me.from_pydata(all_v, [], all_f)
    at = me.attributes.new("cobble", 'FLOAT_VECTOR', 'POINT')
    for i, val in enumerate(attr):
        at.data[i].vector = val
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new("MapleCobbles", me); obj.data.materials.append(street.stone_mat()); lib.link(obj)
    return obj


def collection_box(loc):
    """The toy drop-off: a painted crate with a lettered placeholder sign."""
    R = B.root("DropOff", loc)
    red = lib.glossy_paint("CrateRed", P.MUTED_RED, rough=0.45)
    trim = wood("CreamWood", P.CREAM, painted=True, rough=0.5)
    objs = [box("crate", (1.05, 0.75, 0.75), (0, 0, 0.38), red, bevel=0.04, subd=2, wobble=0.01),
            box("crateTop", (1.12, 0.82, 0.07), (0, 0, 0.76), trim, bevel=0.02, subd=1, wobble=0.005),
            box("slot", (0.7, 0.4, 0.04), (0, -0.02, 0.795), clay("DarkPane", (0.03, 0.035, 0.06)), bevel=0.01, subd=0, wobble=0),
            box("post", (0.06, 0.06, 1.05), (0, 0.32, 1.15), trim, bevel=0.02, subd=1, wobble=0.004),
            box("board", (0.95, 0.07, 0.5), (0, 0.29, 1.5), wood("SignBoard", P.CREAM_WARM, painted=True, rough=0.5), bevel=0.03, subd=1, wobble=0.004),
            B.snow_slab("bsnow", (0.95, 0.12, 0.08), (0, 0.29, 1.79), (0, 0, 0), lump=0.04, smooth=2, dice=2)]
    for txt, z, s in (("TOY", 1.6, 0.17), ("DROP-OFF", 1.4, 0.12)):
        t = lib.text_obj("dropsign", txt, (0, 0.24, z), s, lib.glossy_paint("SignLetters", P.DEEP_RED, rough=0.35), extrude=0.02); t.parent = R
    for o in objs:
        o.parent = R
    # (no wrapped presents here: toys are given new and unwrapped; Chapter 1 sets a carton of toys beside the box)
    META["box"] = tuple(loc)
    return R


def build():
    lib.coll("Set")
    # ---- the street: cobbles between stone curbs, snowbanks along both sides
    lane_cobbles(-24, 24, CURB_S + 0.05, CURB_N - 0.05)
    curb = clay("Curb", P.STONE, rough=0.85, var=0.3)
    for y in (CURB_N + 0.12, CURB_S - 0.12):
        x = -24.0
        while x < 24:
            L = RNG.uniform(0.9, 1.4)
            box("curb", (L - 0.04, 0.26, 0.22), (x + L / 2, y, 0.06), curb, bevel=0.05, subd=2, wobble=0.02)
            x += L
    for y in (CURB_N + 0.5, CURB_S - 0.5):
        for k in range(70):
            x = -24 + k * 0.7 + RNG.uniform(-0.2, 0.2)
            blob("streetbank", (x, y + RNG.uniform(-0.15, 0.15), 0.08), RNG.uniform(0.28, 0.45), snow(), squash=(1.6, 1.0, 0.5), subd=2, lump=0.35)
    # ---- north side: store, community hall (with the collection point), homes
    story_building("Store", (-11.0, 0.4, 0), 6.6, 5.0, 4.2, P.MUSTARD, gable_front=False, pitch=32, roof=P.srgb('#5a3b2e'),
                   door=(0.0, 1.0, 2.05, P.SHUTTER_GREEN), windows=[(-2.0, 1.4, 1.5, 1.3), (2.0, 1.4, 1.5, 1.3), (-1.7, 3.1, 0.75, 0.85), (1.7, 3.1, 0.75, 0.85)],
                   shutters=P.DEEP_RED, boxes=True, sign="GENERAL STORE", sign_z=3.15, awning=5.6, wreath=True)
    hall = story_building("Hall", (0.0, 0.0, 0), 8.0, 6.5, 4.6, P.CREAM_WARM, gable_front=True, pitch=33, roof=P.srgb('#7a3b2e'),
                          door=(0.0, 1.4, 2.4, P.SHUTTER_GREEN), windows=[(-2.6, 1.6, 1.1, 1.6), (2.6, 1.6, 1.1, 1.6), (-2.6, 3.65, 0.8, 0.8), (2.6, 3.65, 0.8, 0.8)],
                          shutters=P.SHUTTER_GREEN, boxes=True, wreath=True, sign="COMMUNITY HALL", sign_z=3.55, garland=(-1.2, 1.2, 2.85, 2))
    META["hall_door"] = (0.0, -0.4, 0.0)
    story_building("HomeA", (10.2, 0.6, 0), 5.0, 5.0, 3.8, P.PINK_LIGHT, gable_front=True, pitch=40, roof=P.ROOF_SLATE,
                   door=(-1.2, 0.9, 1.95, P.DEEP_RED), windows=[(1.0, 1.55, 0.95, 1.1), (-1.0, 3.0, 0.85, 0.9), (1.0, 3.0, 0.85, 0.9)], shutters=P.SHUTTER_GREEN, boxes=True, wreath=True)
    story_building("HomeB", (17.6, 0.8, 0), 5.2, 5.0, 3.5, P.srgb('#8fb59a'), gable_front=False, pitch=36, roof=P.srgb('#6b3326'),
                   door=(0.0, 0.9, 1.95, P.CREAM), windows=[(-1.6, 1.5, 0.95, 1.1), (1.6, 1.5, 0.95, 1.1)], shutters=P.CREAM)
    story_building("HomeC", (-19.0, 0.6, 0), 4.8, 4.8, 3.6, P.srgb('#c8513f'), gable_front=True, pitch=42, roof=P.ROOF_SLATE,
                   door=(1.1, 0.9, 1.95, P.CREAM), windows=[(-1.0, 1.55, 0.9, 1.1), (-1.0, 2.95, 0.8, 0.85), (1.0, 2.95, 0.8, 0.85)], shutters=P.CREAM, boxes=True)
    # ---- south side: homes and the church, facing the street
    story_building("HomeD", (-14.5, SOUTH, 0), 5.0, 5.0, 3.6, P.TEAL, rot_z=math.pi, gable_front=False, pitch=36, roof=P.srgb('#5a3b2e'),
                   door=(0.0, 0.9, 1.95, P.DEEP_RED), windows=[(-1.6, 1.5, 0.95, 1.1), (1.6, 1.5, 0.95, 1.1)], shutters=P.CREAM, wreath=True)
    story_building("HomeE", (-6.8, SOUTH, 0), 4.6, 4.8, 3.9, P.srgb('#a98bc4'), rot_z=math.pi, gable_front=True, pitch=40, roof=P.ROOF_SLATE,
                   door=(-1.0, 0.85, 1.95, P.CREAM), windows=[(1.0, 1.55, 0.9, 1.1), (-0.9, 3.05, 0.8, 0.85), (0.9, 3.05, 0.8, 0.85)], shutters=P.SHUTTER_GREEN, boxes=True)
    story_building("Church", (2.6, SOUTH - 1.0, 0), 4.8, 7.5, 5.0, P.CREAM, rot_z=math.pi, gable_front=True, pitch=48, roof=P.ROOF_SLATE,
                   door=(0.0, 1.2, 2.4, P.DEEP_RED), windows=[(-1.4, 2.4, 0.7, 1.9), (1.4, 2.4, 0.7, 1.9)], chimney=False, steeple=True, wreath=True)
    story_building("HomeF", (11.8, SOUTH, 0), 5.0, 5.0, 3.7, P.srgb('#e59a5a'), rot_z=math.pi, gable_front=False, pitch=34, roof=P.srgb('#46604a'),
                   door=(-1.4, 0.9, 1.95, P.SHUTTER_GREEN), windows=[(0.4, 1.5, 0.95, 1.1), (2.0, 1.5, 0.9, 1.1)], shutters=P.DEEP_RED, boxes=True)
    story_building("HomeG", (19.6, SOUTH, 0), 4.6, 4.6, 3.4, P.CREAM, rot_z=math.pi, gable_front=True, pitch=42, roof=P.srgb('#7a3b2e'),
                   door=(0.0, 0.85, 1.9, P.srgb('#2d5fae')), windows=[(-1.4, 1.5, 0.8, 1.0), (1.4, 1.5, 0.8, 1.0)], shutters=P.srgb('#2d5fae'))
    # ---- the collection point beside the hall door, the town tree, lamps, a bench
    collection_box((2.3, -1.25, 0.0))
    trees.fir("TownTree", (6.2, -1.6, 0), 6.2, 2.3, tiers=8, ornaments=True, lights=True, star=True, seed=5)
    META["tree"] = (6.2, -1.6, 0)
    for i, (x, y) in enumerate([(-6.2, CURB_N + 0.45), (5.2, CURB_S - 0.45), (13.8, CURB_N + 0.45), (-17.5, CURB_S - 0.45)]):
        props.lamppost(f"Lamp{i}", (x, y, 0), height=3.4, rot_z=RNG.uniform(-0.3, 0.3))
        META["lamps"].append((x, y, 3.4 - 0.17))
    props.bench("Bench", (-3.6, -1.7, 0), rot_z=0.0)
    props.gift_pile("BenchGifts", (-3.0, -1.2, 0.45), n=2, spread=0.3, scale=0.8)
    # ---- firs around the edges (Toy Town's needle-tier firs)
    spots = [(-26, 6), (-23, 11), (-14, 9), (-5, 11), (6, 12), (15, 10), (24, 8), (27, 1), (27, -9), (24, -16), (16, -17), (7, -19),
             (-2, -18), (-10, -17), (-20, -16), (-27, -8), (-28, 2), (-9, 7.5), (13.5, 7.0)]
    for i, (x, y) in enumerate(spots):
        trees.fir(f"Fir{i}", (x, y, 0), RNG.uniform(4.2, 6.6), RNG.uniform(1.5, 2.2), tiers=RNG.choice([6, 7, 8]), seed=i * 7.3)
    return META
