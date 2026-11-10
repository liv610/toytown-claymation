"""The blue toy shop, the pink neighbour, and a generic background house."""
import math

import bmesh
import bpy
from mathutils import Vector

from . import lib
from .lib import RNG, box, prism, blob, clay, snow, window_glow, wood, coll
from . import palette as P


# --------------------------------------------------------------------------
# small building helpers
# --------------------------------------------------------------------------
def root(name, loc, lean=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.rotation_euler = lean
    lib.link(e, "Set")
    return e


def par(objs, parent):
    if not isinstance(objs, (list, tuple)):
        objs = [objs]
    for o in objs:
        o.parent = parent
    return objs[0] if len(objs) == 1 else objs


def wall_body(name, profile, depth, loc, mat, cutters, wobble=0.03, axis='Y',
              subd=4):
    """A wall prism with recesses carved by boolean cutters, then softened."""
    obj = lib.mesh_obj(name, lib.prism_bm(profile, depth, axis), mat)
    obj.location = loc
    m = obj.modifiers.new("dice", 'SUBSURF')
    m.subdivision_type = 'SIMPLE'
    m.levels = m.render_levels = subd
    if cutters:
        c = bpy.data.collections.new(name + "_cut")
        for k in cutters:
            for uc in list(k.users_collection):
                uc.objects.unlink(k)
            c.objects.link(k)
            k.hide_render = True
            k.display_type = 'WIRE'
        coll("Cutters").children.link(c)
        b = obj.modifiers.new("carve", 'BOOLEAN')
        b.operation = 'DIFFERENCE'
        b.operand_type = 'COLLECTION'
        b.collection = c
        b.solver = 'EXACT'
    m = obj.modifiers.new("soften", 'BEVEL')
    m.width = 0.035
    m.segments = 3
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(35)
    m = obj.modifiers.new("wobble", 'DISPLACE')
    m.texture = lib.wobble_tex()
    m.texture_coords = 'GLOBAL'
    m.strength = wobble
    return obj


def cutter(loc_world, size):
    o = box("cutter", size, loc_world, None, bevel=0, subd=0, wobble=0)
    o.modifiers.clear()
    return o


def window(root_obj, x, z, w, h, *, face_y=0.0, recess=0.16, rows=2, cols=2,
           frame_mat, glow_mat, shutters=None, sill=True, lintel=True,
           arch=False, cutters=None, normal=-1, name="win", frame_t=0.07):
    """Build a window on a wall facing -Y (local).  Returns created objects.
    A boolean cutter is appended to `cutters` (in world space via root)."""
    R = root_obj
    O = R.location
    objs = []
    # carve
    if cutters is not None:
        cutters.append(cutter(O + Vector((x, face_y + recess / 2 - 0.25, z + h / 2)),
                              (w, recess + 0.5, h)))
    gy = face_y + recess - 0.02
    g = box(name + "_glass", (w + 0.04, 0.03, h + 0.04), (x, gy, z + h / 2), glow_mat,
            bevel=0.005, subd=1, wobble=0.004)
    objs.append(g)
    ft = frame_t
    # outer frame (proud of the wall)
    for (sx, sz, px, pz) in [(w + 2 * ft, ft, x, z + h + ft / 2),
                             (w + 2 * ft, ft, x, z - ft / 2),
                             (ft, h, x - w / 2 - ft / 2, z + h / 2),
                             (ft, h, x + w / 2 + ft / 2, z + h / 2)]:
        objs.append(box(name + "_frame", (sx, 0.09, sz), (px, face_y - 0.02, pz),
                        frame_mat, bevel=0.02, subd=1, wobble=0.006))
    # mullions set back in the recess, in front of the glass
    my = gy - 0.05
    for i in range(1, cols):
        px = x - w / 2 + w * i / cols
        objs.append(box(name + "_mull", (0.035, 0.05, h), (px, my, z + h / 2),
                        frame_mat, bevel=0.01, subd=1, wobble=0.004))
    for j in range(1, rows):
        pz = z + h * j / rows
        objs.append(box(name + "_mull", (w, 0.05, 0.035), (x, my, pz),
                        frame_mat, bevel=0.01, subd=1, wobble=0.004))
    # inner reveal frame at glass
    for (sx, sz, px, pz) in [(w, 0.05, x, z + h - 0.025), (w, 0.05, x, z + 0.025),
                             (0.05, h, x - w / 2 + 0.025, z + h / 2),
                             (0.05, h, x + w / 2 - 0.025, z + h / 2)]:
        objs.append(box(name + "_reveal", (sx, 0.06, sz), (px, my, pz), frame_mat,
                        bevel=0.01, subd=1, wobble=0.004))
    if sill:
        objs.append(box(name + "_sill", (w + 0.34, 0.24, 0.08), (x, face_y - 0.07, z - ft - 0.03),
                        frame_mat, bevel=0.025, subd=1, wobble=0.008))
        # snow on the sill: a pillowy ridge
        s = box(name + "_sillsnow", (w + 0.28, 0.2, 0.07), (x, face_y - 0.08, z - ft + 0.035),
                snow(), bevel=0.0, subd=0, wobble=0.02, smooth_subd=2, tex=lib.lump_tex())
        objs.append(s)
    if lintel:
        objs.append(box(name + "_lintel", (w + 0.3, 0.13, 0.12), (x, face_y - 0.04, z + h + ft + 0.05),
                        frame_mat, bevel=0.03, subd=1, wobble=0.008))
        objs.append(box(name + "_lintsnow", (w + 0.3, 0.14, 0.05),
                        (x, face_y - 0.05, z + h + ft + 0.12), snow(), bevel=0, subd=0,
                        wobble=0.015, smooth_subd=2, tex=lib.lump_tex()))
    if shutters:
        cur = clay("Curtain", P.srgb('#b8463c'), rough=0.85, sss=0.3, dimple=0.4, var=0.2, sheen=0.8)
        for side in (-1, 1):
            cx = x + side * (w / 2 - w * 0.14)
            objs.append(lib.blob(name + "_curtain", (cx, gy - 0.04, z + h * 0.55), w * 0.16, cur,
                                 squash=(1.0, 0.35, h / (w * 0.32) * 0.9), subd=3, lump=0.18))
        objs.append(box(name + "_valance", (w, 0.05, h * 0.12), (x, gy - 0.05, z + h * 0.93), cur, bevel=0.02,
                        subd=2, wobble=0.01))
        sw = w * 0.52
        for side in (-1, 1):
            px = x + side * (w / 2 + ft + sw / 2 + 0.01)
            sh = box(name + "_shutter", (sw, 0.06, h + 0.06), (px, face_y - 0.05, z + h / 2),
                     shutters, bevel=0.02, subd=2, wobble=0.008,
                     rot=(0, 0, side * math.radians(RNG.uniform(1, 4))))
            objs.append(sh)
            # plank grooves / rails
            for k in range(3):
                objs.append(box(name + "_plank", (0.025, 0.02, h * 0.9),
                                (px - sw / 2 + sw * (k + 1) / 4, face_y - 0.08, z + h / 2),
                                wood("ShutterGroove", P.DEEP_RED, painted=True, rough=0.6),
                                bevel=0.008, subd=1, wobble=0.004))
            for zz in (0.2, 0.8):
                objs.append(box(name + "_rail", (sw * 0.85, 0.03, 0.06),
                                (px, face_y - 0.09, z + h * zz), shutters, bevel=0.012,
                                subd=1, wobble=0.004))
    for o in objs:
        o.parent = R
    return objs


def arch_profile(w, h, n=12):
    """Rectangle with a semicircular top, base at v=0 (u centred)."""
    r = w / 2
    pts = [(-r, 0.0), (r, 0.0)]
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((r * math.cos(a), h - r + r * math.sin(a)))
    pts.append((-r, 0.0))
    return pts[:-1] if pts[-1] == pts[0] else pts[:-1]


def arched_window(R, x, z, w, h, *, frame_mat, glow_mat, cutters, recess=0.14, face_y=0.0):
    O = R.location
    objs = []
    prof = arch_profile(w, h)
    # dedupe the duplicated right-bottom corner
    clean = []
    for p in prof:
        if not clean or (abs(clean[-1][0] - p[0]) + abs(clean[-1][1] - p[1])) > 1e-4:
            clean.append(p)
    if abs(clean[0][0] - clean[-1][0]) + abs(clean[0][1] - clean[-1][1]) < 1e-4:
        clean.pop()
    cut = lib.mesh_obj("acut", lib.prism_bm(clean, recess + 0.5), None)
    cut.location = O + Vector((x, face_y - 0.5 + recess, z))
    cutters.append(cut)
    g = lib.mesh_obj("aglass", lib.prism_bm(clean, 0.03), glow_mat)
    g.location = (x, face_y + recess - 0.03, z)
    objs.append(g)
    # frame: a fat soft tube following the arch outline
    outer = [(u * 1.0, v) for (u, v) in clean]
    cu = bpy.data.curves.new("aframe", 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(outer))
    for i, (u, v) in enumerate(outer + [outer[0]]):
        sp.points[i].co = (u * 1.06, 0, v * 1.0 + (0.0 if v > 0.01 else -0.02), 1)
    cu.bevel_depth = 0.055
    cu.bevel_resolution = 3
    fo = bpy.data.objects.new("aframe", cu)
    fo.data.materials.append(frame_mat)
    fo.location = (x, face_y - 0.03, z)
    lib.link(fo)
    objs.append(fo)
    # mullions: vertical + horizontal + fan
    objs.append(box("amull", (0.035, 0.05, h - 0.05), (x, face_y + recess - 0.07, z + h / 2), frame_mat,
                    bevel=0.01, subd=1, wobble=0))
    objs.append(box("amull", (w, 0.05, 0.035), (x, face_y + recess - 0.07, z + h - w / 2), frame_mat,
                    bevel=0.01, subd=1, wobble=0))
    objs.append(box("amull", (w, 0.05, 0.035), (x, face_y + recess - 0.07, z + (h - w / 2) / 2), frame_mat,
                    bevel=0.01, subd=1, wobble=0))
    objs.append(box("asill", (w + 0.32, 0.24, 0.08), (x, face_y - 0.08, z - 0.06), frame_mat,
                    bevel=0.025, subd=1, wobble=0.008))
    objs.append(box("asillsnow", (w + 0.25, 0.2, 0.07), (x, face_y - 0.1, z + 0.01), snow(), bevel=0,
                    subd=0, wobble=0.02, smooth_subd=2, tex=lib.lump_tex()))
    for o in objs:
        o.parent = R
    return objs


def window_box(R, x, ztop, w, face_y=0.0):
    """Planter box of holly with red berries and a cap of snow."""
    pine = clay("Holly", P.PINE, rough=0.55, dimple=1.0, dimple_scale=10, var=0.3, coat=0.2)
    berry = lib.glossy_paint("Berry", (0.6, 0.03, 0.03), rough=0.2)
    boxm = wood("PlanterWood", P.WOOD_DARK, painted=False, rough=0.7)
    sn = snow()
    objs = [box("wbox", (w, 0.24, 0.2), (x, face_y - 0.17, ztop - 0.1), boxm, bevel=0.03, subd=2, wobble=0.01)]
    n = int(w / 0.11)
    for k in range(n):
        px = x - w / 2 + 0.06 + (w - 0.12) * k / max(1, n - 1)
        for row in (0, 1):
            objs.append(lib.blob("holly", (px + RNG.uniform(-0.03, 0.03), face_y - 0.14 - row * 0.09,
                                           ztop + 0.06 + RNG.uniform(-0.02, 0.05)),
                                 RNG.uniform(0.06, 0.09), pine, squash=(1.4, 0.8, 0.7), subd=2, lump=0.6,
                                 rot=(RNG.random(), RNG.random(), RNG.random())))
        if RNG.random() < 0.6:
            for _ in range(RNG.randint(2, 3)):
                objs.append(lib.blob("hberry", (px + RNG.uniform(-0.04, 0.04), face_y - 0.3,
                                                ztop + 0.1 + RNG.uniform(-0.03, 0.04)), 0.024, berry, subd=2,
                                     lump=0.05))
    for k in range(int(n * 0.6)):
        px = x - w / 2 + 0.1 + (w - 0.2) * RNG.random()
        objs.append(lib.blob("hsnow", (px, face_y - 0.17, ztop + 0.15), RNG.uniform(0.05, 0.08), sn,
                             squash=(1.6, 1.0, 0.6), subd=2, lump=0.3))
    for o in objs:
        o.parent = R
    return objs


def snow_slab(name, size, loc, rot, lump=0.12, smooth=3, parent=None, mat=None):
    """Pillowy snow cap that keeps its footprint: diced box, fat rounded
    bevel, one smoothing pass, then big lumps + a crusty mid-frequency layer."""
    o = box(name, size, loc, mat or snow(), rot=rot, bevel=0, subd=0, wobble=0)
    o.modifiers.clear()
    m = o.modifiers.new("dice", 'SUBSURF'); m.subdivision_type = 'SIMPLE'
    big = max(size)
    m.levels = m.render_levels = max(2, min(5, math.ceil(math.log2(max(big, 0.3) / 0.16))))
    m = o.modifiers.new("round", 'BEVEL')
    m.width = min(size) * 0.42
    m.segments = 4
    m.limit_method = 'ANGLE'
    m = o.modifiers.new("smooth", 'SUBSURF'); m.levels = m.render_levels = 1 if smooth >= 2 else 0
    m = o.modifiers.new("lump", 'DISPLACE')
    m.texture = lib.lump_tex(); m.texture_coords = 'GLOBAL'; m.strength = lump
    m = o.modifiers.new("crust", 'DISPLACE')
    m.texture = lib.crust_tex(); m.texture_coords = 'GLOBAL'; m.strength = min(0.07, lump * 0.5)
    if parent:
        o.parent = parent
    return o


def icicles(parent, x0, x1, y, z, n, mat, maxlen=0.35):
    out = []
    for i in range(n):
        x = x0 + (x1 - x0) * (i + RNG.uniform(0.1, 0.9)) / n
        L = RNG.uniform(0.06, maxlen) * (1 if RNG.random() > 0.3 else 0.4)
        r = RNG.uniform(0.018, 0.035)
        prof = [(r * 1.3, 0.0), (r, -L * 0.25), (r * 0.6, -L * 0.6), (r * 0.15, -L), (0.0, -L - 0.01)]
        o = lib.lathe("icicle", [(p[0], p[1]) for p in prof][::-1] if False else prof,
                      (x, y + RNG.uniform(-0.03, 0.03), z), mat, segs=8, wob=0.25,
                      smooth_subd=1)
        o.rotation_euler = (RNG.uniform(-0.08, 0.08), RNG.uniform(-0.08, 0.08), 0)
        o.parent = parent
        out.append(o)
    return out


def ice_mat():
    if "Ice" in lib._mats:
        return lib._mats["Ice"]
    m = bpy.data.materials.new("Ice")
    nt, nodes, links = lib._nodes(m)
    b, out = lib._bsdf(nodes, links)
    b.inputs['Base Color'].default_value = (0.85, 0.93, 1.0, 1)
    b.inputs['Transmission Weight'].default_value = 0.85
    b.inputs['Roughness'].default_value = 0.12
    b.inputs['IOR'].default_value = 1.31
    b.inputs['Subsurface Weight'].default_value = 0.2
    lib.tag(m, "ice", (0.85, 0.93, 1.0), 0.12)
    lib._mats["Ice"] = m
    return m


# --------------------------------------------------------------------------
# THE BLUE TOY SHOP
# --------------------------------------------------------------------------
def blue_shop(O=Vector((0, 0, 0))):
    R = root("BlueShop", O, lean=(math.radians(0.4), math.radians(-0.6), math.radians(0.8)))
    blue = clay("ShopBlue", P.SHOP_BLUE, rough=0.7, sss=0.08, dimple=1.0, var=0.2, stucco=1.0, bump=0.85)
    blue_d = clay("ShopBlueDark", P.SHOP_BLUE_DARK, rough=0.6)
    cream = clay("Cream", P.CREAM, rough=0.65, sss=0.15, dimple=0.8, var=0.12, stucco=0.6, bump=0.6)
    trim = wood("CreamWood", P.CREAM, painted=True, rough=0.5)
    green = wood("ShutterRed", P.MUTED_RED, painted=True, rough=0.55)
    door_m = wood("DoorGreen", P.SHUTTER_GREEN, painted=True, rough=0.42)
    stone = clay("PlinthStone", P.STONE, rough=0.8, dimple=1.4, dimple_scale=5, var=0.25)
    roof_m = clay("RoofSlate", P.ROOF_SLATE, rough=0.7, var=0.2)
    brick = clay("Brick", P.BRICK, rough=0.8, dimple=1.2, var=0.25, stucco=0.7, bump=0.7)
    glow = window_glow("ShopGlow", strength=2.0)
    glow_up = window_glow("UpperGlow", color=(1.0, 0.5, 0.2), strength=1.5)
    gold = lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6)
    sn = snow()

    W, D, H = 5.2, 5.0, 5.2
    pitch = math.radians(53)
    ridge = H + (W / 2) * math.tan(pitch)
    hw = W / 2
    cuts = []
    objs = []

    # --- display windows + door (ground floor)
    for sx in (-1, 1):
        objs += window(R, sx * 1.65, 0.85, 1.35, 1.45, recess=0.42, rows=2, cols=3,
                       frame_mat=trim, glow_mat=glow, cutters=cuts, sill=True,
                       lintel=False, name="display")
    # door recess + a real shop interior behind the door (seen when it opens)
    cuts.append(cutter(O + Vector((0, -0.1, 0.45 + 1.1)), (1.15, 0.5, 2.2)))
    cuts.append(cutter(O + Vector((0, 1.75, 0.42 + 1.22)), (1.8, 3.3, 2.44)))
    hinge = bpy.data.objects.new("DoorHinge", None)
    hinge.location = (-0.525, 0.12, 0.0)
    hinge.parent = R
    lib.link(hinge)
    hx = 0.525
    dparts = [box("door", (1.05, 0.08, 2.1), (hx, 0.04, 0.45 + 1.05), door_m, bevel=0.03, subd=2,
                  wobble=0.01)]
    for pz in (0.95, 1.55):
        for px in (-0.24, 0.24):
            dparts.append(box("doorpanel", (0.36, 0.04, 0.45), (hx + px, -0.01, 0.45 + pz - 0.2),
                              door_m, bevel=0.02, subd=1, wobble=0.004))
            dparts.append(box("doorpanelB", (0.36, 0.04, 0.45), (hx + px, 0.09, 0.45 + pz - 0.2),
                              door_m, bevel=0.02, subd=1, wobble=0.004))
    dparts.append(box("doorglass", (0.75, 0.1, 0.55), (hx, 0.04, 0.45 + 1.68), glow,
                      bevel=0.01, subd=1, wobble=0.003))
    dparts.append(lib.blob("knob", (hx + 0.38, -0.04, 1.45), 0.045, gold, subd=2, lump=0.05))
    dparts.append(lib.blob("knobB", (hx + 0.38, 0.12, 1.45), 0.045, gold, subd=2, lump=0.05))
    for o in dparts:
        o.parent = hinge
    globals()["DOOR_HINGE"] = hinge
    wreath(hinge, (hx, -0.07, 1.98), 0.28)
    # interior: plank floor, cream walls, toy shelves, warm hanging lamp
    floorw = wood("FloorWood", P.WOOD, painted=False, rough=0.6)
    inner = clay("InnerWall", P.CREAM_WARM, rough=0.7, stucco=0.6, bump=0.6)
    for k in range(7):
        objs.append(box("plank", (0.25, 3.25, 0.06), (-0.78 + k * 0.26, 1.75, 0.44), floorw, bevel=0.01,
                        subd=1, wobble=0.004))
    objs.append(box("backwall", (1.78, 0.06, 2.4), (0, 3.36, 1.64), inner, bevel=0.02, subd=2, wobble=0.01))
    for sx in (-1, 1):
        objs.append(box("sidewall", (0.06, 3.2, 2.4), (sx * 0.87, 1.75, 1.64), inner, bevel=0.02, subd=2,
                        wobble=0.01))
    shelfw = wood("ShelfWood", P.WOOD_DARK, painted=False, rough=0.6)
    toycols = [lib.glossy_paint("ToyRed", P.MUTED_RED, rough=0.35), lib.glossy_paint("ToyTeal", P.TEAL, rough=0.35),
               lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6), lib.glossy_paint("ToyBlue", P.SHOP_BLUE_DARK, 0.35)]
    for zz in (1.0, 1.55, 2.1):
        objs.append(box("shelf", (1.7, 0.32, 0.05), (0, 3.18, zz), shelfw, bevel=0.01, subd=1, wobble=0.004))
        x = -0.75
        while x < 0.75:
            kind = RNG.random()
            c = RNG.choice(toycols)
            if kind < 0.4:
                sz = RNG.uniform(0.12, 0.22)
                objs.append(box("tbox", (sz, 0.16, sz * RNG.uniform(0.8, 1.5)), (x, 3.15, zz + 0.03 + sz * 0.6), c,
                                bevel=0.02, subd=1, wobble=0.004))
            elif kind < 0.7:
                objs.append(lib.blob("tball", (x, 3.12, zz + 0.12), 0.1, c, subd=2, lump=0.02))
            else:
                objs.append(lib.blob("tbear", (x, 3.12, zz + 0.13), 0.1,
                                     clay("Bear", P.WOOD, rough=0.85, dimple=1.5, dimple_scale=14, var=0.2, sheen=0.8),
                                     squash=(1, 1, 1.25), subd=2, lump=0.1))
            x += RNG.uniform(0.2, 0.3)
    lampsh = lib.emissive("InteriorShade", (1.0, 0.65, 0.3), 6)
    objs.append(lib.lathe("hanglamp", [(0.0, 0.0), (0.2, 0.0), (0.12, 0.16), (0.0, 0.18)], (0, 1.6, 2.35), lampsh,
                          segs=16))
    L = bpy.data.lights.new("Interior", 'POINT'); L.energy = 70; L.color = (1.0, 0.6, 0.3)
    L.shadow_soft_size = 0.25
    lo = bpy.data.objects.new("Interior", L); lo.location = (0, 1.6, 2.2); lo.parent = R
    lib.link(lo, "Lights")
    # door frame
    for (sx, sz, px, pz) in [(1.45, 0.14, 0, 2.62), (0.14, 2.2, -0.65, 1.55), (0.14, 2.2, 0.65, 1.55)]:
        objs.append(box("doorframe", (sx, 0.14, sz), (px, -0.04, pz), trim, bevel=0.03, subd=1,
                        wobble=0.006))
    # step
    objs.append(box("step", (1.6, 0.55, 0.22), (0, -0.25, 0.11), stone, bevel=0.05, subd=2,
                    wobble=0.02))
    objs.append(snow_slab("stepsnow", (1.4, 0.4, 0.07), (0.1, -0.32, 0.24), (0, 0, 0.05), lump=0.06,
                          smooth=2))

    # --- upper floor windows with shutters
    for sx in (-1, 1):
        objs += window(R, sx * 1.35, 3.85, 0.9, 1.15, recess=0.14, rows=2, cols=2,
                       frame_mat=trim, glow_mat=glow_up, shutters=green, cutters=cuts,
                       name="upper")
        objs += window_box(R, sx * 1.35, 3.62, 1.05)
    # gable window (arched, like the reference)
    gz = H + 0.55
    objs += arched_window(R, 0, gz, 0.78, 1.05, frame_mat=trim, glow_mat=glow_up, cutters=cuts)
    objs += window_box(R, 0, gz - 0.12, 0.95)

    # --- walls (carved)
    profile = [(-hw, 0.35), (hw, 0.35), (hw, H), (0, ridge), (-hw, H)]
    body = wall_body("ShopWalls", profile, D, O + Vector((0, 0, 0)), blue, cuts, wobble=0.06)
    body.location = (0, 0, 0)
    body.parent = R

    # plinth
    objs.append(box("plinth", (W + 0.16, D + 0.1, 0.45), (0, D / 2 - 0.04, 0.2), stone, bevel=0.06,
                    subd=3, wobble=0.04))
    # corner pilasters and belt course (cream plaster)
    for sx in (-1, 1):
        objs.append(box("pilaster", (0.26, 0.2, H - 0.4), (sx * (hw - 0.05), -0.03, H / 2 + 0.2), cream,
                        bevel=0.05, subd=3, wobble=0.02))
    objs.append(box("belt", (W + 0.2, 0.22, 0.18), (0, -0.04, 3.05), cream, bevel=0.05, subd=3,
                    wobble=0.02))
    objs.append(box("eaveband", (W + 0.1, 0.2, 0.16), (0, -0.03, H - 0.05), cream, bevel=0.05,
                    subd=3, wobble=0.02))

    # --- sign board  (between awning and belt)
    objs.append(box("signboard", (2.7, 0.1, 0.5), (0, -0.12, 3.45), blue_d, bevel=0.04, subd=2,
                    wobble=0.01))
    for (sx, sz, px, pz) in [(2.86, 0.07, 0, 3.73), (2.86, 0.07, 0, 3.17), (0.07, 0.6, -1.4, 3.45),
                             (0.07, 0.6, 1.4, 3.45)]:
        objs.append(box("signframe", (sx, 0.08, sz), (px, -0.17, pz), gold, bevel=0.02, subd=1,
                        wobble=0.004))
    t = lib.text_obj("signtext", "TOYS", (0, -0.18, 3.43), 0.42, gold, extrude=0.02)
    t.parent = R
    t.data.space_character = 1.15
    sn_sign = snow_slab("signsnow", (2.8, 0.18, 0.06), (0, -0.13, 3.79), (0, 0, 0), lump=0.05, smooth=2)
    objs.append(sn_sign)

    # --- roof: two slabs, overhangs, bargeboards, snow, chimney
    ov = 0.45
    roof_t = 0.16
    slen = (hw + ov) / math.cos(pitch) + 0.08
    yd0, yd1 = -0.55, D + 0.3
    for sx in (-1, 1):
        cx = sx * (hw + ov) / 2
        cz = ridge - ((hw + ov) / 2) * math.tan(pitch) + roof_t / 2 / math.cos(pitch)
        rot = (0, sx * pitch, 0)
        objs.append(box("roof", (slen, yd1 - yd0, roof_t), (cx, (yd0 + yd1) / 2, cz), roof_m,
                        rot=rot, bevel=0.05, subd=3, wobble=0.03))
        # thick sculpted snow on top
        st = 0.38
        n = Vector((sx * math.sin(pitch), 0, math.cos(pitch)))
        sc = Vector((cx, (yd0 + yd1) / 2 - 0.02, cz)) + n * (roof_t / 2 + st / 2 - 0.08)
        objs.append(snow_slab("roofsnow", (slen + 0.1, yd1 - yd0 + 0.18, st), tuple(sc), rot,
                              lump=0.22, smooth=3))
        # bargeboard with scallops (front gable edge)
        bb = box("barge", (slen - 0.05, 0.1, 0.24), (cx, yd0 + 0.02, cz - 0.12), trim, rot=rot,
                 bevel=0.03, subd=2, wobble=0.01)
        objs.append(bb)
        # eave icicles
        ex = sx * (hw + ov - 0.05)
        ez = ridge - (hw + ov) * math.tan(pitch) - 0.05
        for i in range(10):
            y = yd0 + 0.1 + (yd1 - yd0 - 0.2) * (i + RNG.uniform(0.1, 0.9)) / 10
            L = RNG.uniform(0.08, 0.45)
            r = RNG.uniform(0.02, 0.035)
            o = lib.lathe("icicle", [(r * 1.4, 0), (r, -L * 0.3), (r * 0.5, -L * 0.7), (0.004, -L)],
                          (ex, y, ez), ice_mat(), segs=8, wob=0.3)
            o.parent = R
    # ridge snow roll
    objs.append(snow_slab("ridgesnow", (0.55, yd1 - yd0 + 0.25, 0.35), (0, (yd0 + yd1) / 2, ridge + 0.32),
                          (0, 0, 0), lump=0.18, smooth=3))
    # snow overhang lip drooping at front gable edge
    for sx in (-1, 1):
        for k in range(5):
            f = (k + 0.5) / 5
            px = sx * (hw + ov) * (1 - f)
            pz = ridge - (hw + ov) * (1 - f) * math.tan(pitch) + 0.28
            objs.append(lib.blob("lip", (px, yd0 - 0.05, pz), 0.2, sn, squash=(1.3, 0.8, 0.9), subd=3,
                                 lump=0.2))
    # chimney (brick) on the right slope with snow cap + smoke later
    chx = -1.15
    chz = ridge - abs(chx) * math.tan(pitch)
    objs.append(box("chimney", (0.72, 0.8, 2.3), (chx, 2.2, chz + 0.65), brick, bevel=0.05, subd=3,
                    wobble=0.035))
    objs.append(box("chimcap", (0.92, 1.0, 0.16), (chx, 2.2, chz + 1.82), stone, bevel=0.04, subd=2,
                    wobble=0.02))
    objs.append(snow_slab("chimsnow", (0.9, 0.98, 0.22), (chx, 2.2, chz + 1.96), (0, 0, 0),
                          lump=0.1, smooth=3))
    globals()["SHOP_CHIMNEY_TOP"] = (O.x + chx, O.y + 2.2, chz + 2.1)
    for o in objs:
        if o.parent is None:
            o.parent = R
    awning(R, x0=-2.45, x1=2.45, z_top=3.0, depth=1.15, drop=0.55)
    garland(R, -2.3, 2.3, 3.02, -0.25, swags=3)
    display_toys(R)
    return R


def awning(R, x0, x1, z_top, depth, drop):
    """Fabric awning: curved canvas, scalloped valance, snow on top."""
    fab = awning_mat = lib.awning_fabric()
    nx, ny = 48, 10
    bm = bmesh.new()
    verts = []
    W = x1 - x0
    for j in range(ny + 1):
        t = j / ny
        row = []
        for i in range(nx + 1):
            s = i / nx
            x = x0 + W * s
            # convex canvas: belly bulges up between the frame
            y = -depth * t
            z = z_top - drop * t + 0.08 * math.sin(math.pi * t) + 0.03 * math.sin(math.pi * s * 6) * t
            row.append(bm.verts.new((x, y, z)))
        verts.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    can = lib.mesh_obj("awning", bm, fab)
    m = can.modifiers.new("thick", 'SOLIDIFY'); m.thickness = 0.035
    m = can.modifiers.new("sm", 'SUBSURF'); m.levels = m.render_levels = 1
    lib.clay_mods(can, 0, 0, 0, 0.02)
    can.parent = R
    # valance: scalloped hanging flap
    bm = bmesh.new()
    n_sc = 14
    pts = 14 * 8
    vt, vb = [], []
    yv = -depth - 0.005
    zv = z_top - drop
    for i in range(pts + 1):
        s = i / pts
        x = x0 + W * s
        ph = (s * n_sc) % 1.0
        hang = 0.2 + 0.09 * math.sin(math.pi * ph)
        vt.append(bm.verts.new((x, yv, zv + 0.02)))
        vb.append(bm.verts.new((x, yv - 0.01, zv - hang)))
    for i in range(pts):
        bm.faces.new((vt[i], vt[i + 1], vb[i + 1], vb[i]))
    val = lib.mesh_obj("valance", bm, fab)
    m = val.modifiers.new("thick", 'SOLIDIFY'); m.thickness = 0.03
    lib.clay_mods(val, 0, 0, 0, 0.015)
    val.parent = R
    # side cheeks
    for x in (x0, x1):
        bm = bmesh.new()
        a = bm.verts.new((x, 0, z_top)); b = bm.verts.new((x, -depth, z_top - drop))
        c = bm.verts.new((x, -depth, z_top - drop - 0.22)); d = bm.verts.new((x, -0.05, z_top - 0.35))
        bm.faces.new((a, b, c, d))
        ch = lib.mesh_obj("cheek", bm, fab)
        m = ch.modifiers.new("thick", 'SOLIDIFY'); m.thickness = 0.03
        ch.parent = R
    # iron frame bar & brackets
    iron = clay("Iron", P.IRON, rough=0.45, sss=0.0, coat=0.2)
    rod = lib.lathe("awnrod", [(0.022, 0), (0.022, W)], (x0, -depth - 0.01, z_top - drop + 0.02), iron,
                    segs=10, smooth_subd=0)
    rod.rotation_euler = (0, math.pi / 2, 0)
    rod.parent = R
    # snow lying on the canvas: a thinner pillow following the slope
    ang = math.atan2(drop, depth)
    s = snow_slab("awnsnow", (W - 0.25, depth * 0.3 / math.cos(ang), 0.07),
                  (0.05, -depth * 0.14, z_top - drop * 0.14 + 0.1), (-ang, 0, 0), lump=0.06, smooth=3)
    s.parent = R
    sn = snow()
    for i in range(int(W / 0.4)):
        x = x0 + 0.15 + (W - 0.3) * (i + RNG.uniform(0, 1)) / int(W / 0.4)
        t = RNG.uniform(0.05, 0.35)
        yb = -depth * t
        zb = z_top - drop * t + 0.08 * math.sin(math.pi * t) + 0.07
        o = blob("awnlump", (x, yb, zb), RNG.uniform(0.08, 0.15), sn, squash=(1.5, 1.2, 0.55), subd=3, lump=0.4,
                 rot=(-ang, 0, RNG.random()))
        o.parent = R
    # snow lip curling over the valance edge
    for i in range(int(W / 0.3)):
        if RNG.random() < 0.4:
            continue
        x = x0 + 0.08 + (W - 0.16) * i / int(W / 0.3)
        o = blob("awnlip", (x + RNG.uniform(-0.03, 0.03), -depth + 0.02, z_top - drop + 0.05), RNG.uniform(0.04, 0.07),
                 sn, squash=(1.4, 1.0, 0.75), subd=3, lump=0.35)
        o.parent = R
    # warm cheat light under the awning (shop glow spilling out)
    L = bpy.data.lights.new("awnLight", 'AREA')
    L.shape = 'RECTANGLE'; L.size = W - 0.6; L.size_y = 0.4
    L.energy = 90; L.color = (1.0, 0.62, 0.32)
    lo = bpy.data.objects.new("awnLight", L)
    lo.location = (0, -0.6, z_top - 0.45)
    lo.parent = R
    lib.link(lo, "Lights")
    lo.visible_camera = False


def garland(R, x0, x1, z, y, swags=3):
    """Pine garland swags with tiny warm bulbs, threaded through bows."""
    pine = clay("Pine", P.PINE, rough=0.7, dimple=1.2, dimple_scale=8, var=0.25)
    bulb = lib.emissive("Bulb", (1.0, 0.7, 0.35), 25)
    red = lib.glossy_paint("RibbonRed", P.DEEP_RED, rough=0.35)
    W = x1 - x0
    for k in range(swags):
        a = x0 + W * k / swags
        b = x0 + W * (k + 1) / swags
        n = 16
        for i in range(n + 1):
            t = i / n
            x = a + (b - a) * t
            zz = z - 0.32 * math.sin(math.pi * t)
            o = lib.blob("garl", (x, y + RNG.uniform(-0.03, 0.03), zz), 0.09, pine,
                         squash=(1.4, 1.0, 0.9), subd=2, lump=0.45,
                         rot=(RNG.random(), RNG.random(), RNG.random()))
            o.parent = R
            if i % 3 == 1:
                bl = lib.blob("gbulb", (x, y - 0.09, zz - 0.04), 0.028, bulb, subd=2, lump=0.0)
                bl.parent = R
    for k in range(swags + 1):
        x = x0 + W * k / swags
        for side in (-1, 1):
            o = lib.blob("bow", (x + side * 0.08, y - 0.08, z + 0.02), 0.07, red,
                         squash=(1.3, 0.5, 0.8), subd=2, lump=0.15, rot=(0, side * 0.5, 0))
            o.parent = R
        o = lib.blob("bowknot", (x, y - 0.1, z + 0.02), 0.04, red, subd=2, lump=0.1)
        o.parent = R


def wreath(R, loc, r):
    pine = clay("Pine", P.PINE, rough=0.7, dimple=1.2, dimple_scale=8, var=0.25)
    berry = lib.glossy_paint("Berry", (0.6, 0.03, 0.03), rough=0.2)
    red = lib.glossy_paint("RibbonRed", P.DEEP_RED, rough=0.35)
    x, y, z = loc
    n = 22
    for i in range(n):
        a = 2 * math.pi * i / n
        o = lib.blob("wreath", (x + r * math.cos(a), y, z + r * math.sin(a)), 0.1, pine,
                     squash=(1.3, 0.8, 1.0), subd=2, lump=0.5, rot=(0, -a, RNG.random()))
        o.parent = R
        if i % 3 == 0:
            for _ in range(2):
                b = lib.blob("berry", (x + r * math.cos(a) + RNG.uniform(-0.04, 0.04), y - 0.08,
                                       z + r * math.sin(a) + RNG.uniform(-0.04, 0.04)), 0.025, berry,
                             subd=2, lump=0.05)
                b.parent = R
    for side in (-1, 1):
        o = lib.blob("wbow", (x + side * 0.1, y - 0.07, z - r - 0.02), 0.09, red, squash=(1.3, 0.5, 0.75),
                     subd=2, lump=0.12, rot=(0, side * 0.4, 0))
        o.parent = R
        o = lib.blob("wtail", (x + side * 0.07, y - 0.06, z - r - 0.2), 0.05, red, squash=(0.6, 0.3, 2.0),
                     subd=2, lump=0.1, rot=(0, side * 0.3, 0))
        o.parent = R


def display_toys(R):
    """Silhouettes in the display windows: soldier, teddy, spinning top, train."""
    red = lib.glossy_paint("ToyRed", P.MUTED_RED, rough=0.35)
    blue = lib.glossy_paint("ToyBlue", P.SHOP_BLUE_DARK, rough=0.35)
    gold = lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6)
    bear = clay("Bear", P.WOOD, rough=0.85, dimple=1.5, dimple_scale=14, var=0.2, sheen=0.8)
    black = lib.glossy_paint("Black", (0.02, 0.02, 0.025), rough=0.4)
    teal = lib.glossy_paint("ToyTeal", P.TEAL, rough=0.35)
    y = 0.28
    zb = 0.85
    objs = []
    # left window: toy soldier + teddy
    x = -2.0
    objs.append(lib.lathe("soldier_body", [(0.0, 0), (0.07, 0), (0.07, 0.22), (0.085, 0.24), (0.085, 0.46),
                                          (0.0, 0.47)], (x, y, zb), red, segs=16))
    objs.append(lib.blob("soldier_head", (x, y, zb + 0.53), 0.065, clay("Skin", (0.8, 0.55, 0.42)), subd=2,
                         lump=0.05))
    objs.append(lib.lathe("busby", [(0.0, 0), (0.07, 0), (0.075, 0.16), (0.0, 0.18)], (x, y, zb + 0.56),
                          black, segs=16))
    x = -1.35
    for (dx, dz, r, sq) in [(0, 0.17, 0.17, (1, 0.9, 1.1)), (0, 0.43, 0.12, (1, 1, 1)),
                            (-0.1, 0.53, 0.045, (1, 0.6, 1)), (0.1, 0.53, 0.045, (1, 0.6, 1)),
                            (-0.16, 0.22, 0.06, (0.8, 0.8, 1.3)), (0.16, 0.22, 0.06, (0.8, 0.8, 1.3)),
                            (-0.08, 0.04, 0.07, (1, 1.2, 0.7)), (0.08, 0.04, 0.07, (1, 1.2, 0.7))]:
        objs.append(lib.blob("teddy", (x + dx, y, zb + dz), r, bear, squash=sq, subd=3, lump=0.08))
    objs.append(lib.blob("tbow", (x, y - 0.1, zb + 0.32), 0.04, red, squash=(1.6, 0.6, 0.8), subd=2, lump=0.05))
    # right window: spinning top + little train engine
    x = 1.25
    objs.append(lib.lathe("top", [(0.0, 0.0), (0.05, 0.05), (0.16, 0.16), (0.17, 0.2), (0.04, 0.26),
                                  (0.02, 0.36), (0.0, 0.36)], (x, y, zb), teal, segs=24))
    objs.append(lib.lathe("topband", [(0.172, 0.17), (0.172, 0.2)], (x, y, zb), gold, segs=24, smooth_subd=0))
    x = 1.95
    objs.append(box("engine", (0.36, 0.2, 0.18), (x, y, zb + 0.15), red, bevel=0.04, subd=2, wobble=0))
    objs.append(box("cab", (0.16, 0.22, 0.24), (x + 0.15, y, zb + 0.34), blue, bevel=0.03, subd=2, wobble=0))
    objs.append(lib.lathe("stack", [(0.04, 0), (0.035, 0.12), (0.06, 0.16), (0.0, 0.17)],
                          (x - 0.12, y, zb + 0.24), black, segs=12))
    for dx in (-0.12, 0.0, 0.13):
        w = lib.lathe("wheel", [(0.0, -0.11), (0.065, -0.11), (0.065, 0.11), (0.0, 0.11)],
                      (x + dx, y, zb + 0.07), gold, segs=16)
        w.rotation_euler = (math.pi / 2, 0, 0)
        objs.append(w)
    for o in objs:
        o.parent = R


# --------------------------------------------------------------------------
# THE PINK NEIGHBOUR — side-gabled cottage, bay window, dormer, side chimney
# --------------------------------------------------------------------------
def pink_house(O=Vector((5.95, 0.45, 0))):
    R = root("PinkHouse", O, lean=(math.radians(-0.5), math.radians(0.7), math.radians(-1.5)))
    pink = clay("Pink", P.PINK, rough=0.7, sss=0.12, dimple=1.1, var=0.2, stucco=1.0, bump=0.85)
    cream = clay("Cream", P.CREAM, rough=0.65, sss=0.15, dimple=0.8, var=0.12, stucco=0.6, bump=0.6)
    trim = wood("CreamWood", P.CREAM, painted=True, rough=0.5)
    sage = wood("Sage", P.SHUTTER_GREEN, painted=True, rough=0.55)
    door_m = wood("DoorPlum", P.DEEP_RED, painted=True, rough=0.42)
    stone = clay("PlinthStone", P.STONE, rough=0.8, dimple=1.4, dimple_scale=5, var=0.25)
    roof_m = clay("RoofRed", P.BRICK, rough=0.7, var=0.25)
    stone_w = clay("StoneWarm", P.STONE_WARM, rough=0.8, dimple=1.6, dimple_scale=4, var=0.3)
    glow = window_glow("PinkGlow", color=(1.0, 0.55, 0.3), strength=1.7)
    gold = lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6)

    W, D, H = 4.1, 4.4, 3.9
    pitch = math.radians(47)
    hd = D / 2
    ridge = H + hd * math.tan(pitch)
    cuts = []
    objs = []
    # bay window will project; carve a shallow niche behind it
    # upper windows
    for x in (-0.95, 0.95):
        objs += window(R, x, 2.75, 0.8, 0.95, recess=0.13, rows=2, cols=2, frame_mat=trim,
                       glow_mat=glow, shutters=sage, cutters=cuts, name="pup")
    # door (right)
    cuts.append(cutter(O + Vector((1.25, -0.1, 0.35 + 1.0)), (0.95, 0.4, 2.0)))
    objs.append(box("pdoor", (0.88, 0.08, 1.95), (1.25, 0.15, 0.35 + 0.97), door_m, bevel=0.03, subd=2,
                    wobble=0.01))
    # rounded top door window
    objs.append(lib.blob("pdoorwin", (1.25, 0.1, 1.85), 0.17, glow, squash=(1, 0.15, 1.2), subd=3, lump=0))
    objs.append(lib.blob("pknob", (0.95, 0.08, 1.2), 0.04, gold, subd=2, lump=0.05))
    for (sx, sz, px, pz) in [(1.2, 0.13, 1.25, 2.4), (0.13, 2.05, 0.75, 1.35), (0.13, 2.05, 1.75, 1.35)]:
        objs.append(box("pdframe", (sx, 0.13, sz), (px, -0.03, pz), trim, bevel=0.03, subd=1, wobble=0.006))
    # little gabled door canopy on brackets
    for sx in (-1, 1):
        objs.append(box("canopy", (0.72, 0.85, 0.07), (1.25 + sx * 0.3, -0.38, 2.68), roof_m,
                        rot=(0, sx * 0.6, 0), bevel=0.02, subd=2, wobble=0.01))
        objs.append(snow_slab("cansnow", (0.72, 0.9, 0.14), (1.25 + sx * 0.28, -0.38, 2.77),
                              (0, sx * 0.6, 0), lump=0.08, smooth=2))
        objs.append(box("bracket", (0.07, 0.6, 0.07), (1.25 + sx * 0.55, -0.32, 2.45), trim,
                        rot=(0.7, 0, 0), bevel=0.02, subd=1, wobble=0))
    # steps
    objs.append(box("pstep", (1.2, 0.5, 0.2), (1.25, -0.25, 0.1), stone, bevel=0.05, subd=2, wobble=0.02))
    objs.append(snow_slab("pstepsnow", (1.0, 0.4, 0.06), (1.2, -0.3, 0.22), (0, 0, 0), lump=0.05, smooth=2))

    # walls: side-gabled -> extrude a house profile along X
    profile = [(0.0, 0.3), (D, 0.3), (D, H), (hd, ridge), (0.0, H)]
    body = wall_body("PinkWalls", profile, W, O + Vector((-W / 2, 0, 0)), pink, cuts, axis='X', wobble=0.06)
    body.location = (-W / 2, 0, 0)
    body.parent = R
    objs.append(box("pplinth", (W + 0.12, D + 0.1, 0.4), (0, D / 2, 0.18), stone_w, bevel=0.06, subd=3,
                    wobble=0.04))
    # cream quoins on corners (alternating blocks)
    for sx in (-1, 1):
        for k in range(7):
            wq = 0.32 if k % 2 == 0 else 0.22
            objs.append(box("quoin", (wq, 0.08, 0.36), (sx * (W / 2 - wq / 2 + 0.02), -0.03,
                                                         0.62 + k * 0.48), cream,
                            bevel=0.04, subd=2, wobble=0.02))
    objs.append(box("pbelt", (W + 0.1, 0.16, 0.12), (0, -0.04, 2.45), cream, bevel=0.04, subd=2, wobble=0.015))

    # bay window: three-faced projection with its own snowy roof
    bx, bz0, bz1 = -0.85, 0.4, 2.15
    bw, bd = 1.9, 0.55
    objs.append(box("baybase", (bw + 0.1, bd + 0.05, 0.55), (bx, -bd / 2, 0.42), pink, bevel=0.05, subd=2,
                    wobble=0.02))
    gw = bw - 0.5
    # front pane + side panes (angled)
    objs.append(box("bayglass", (gw, 0.03, 1.15), (bx, -bd + 0.04, 1.32), glow, bevel=0.01, subd=1, wobble=0.003))
    for sx in (-1, 1):
        sp = box("bayside", (0.62, 0.03, 1.15), (bx + sx * (gw / 2 + 0.2), -bd / 2 + 0.02, 1.32), glow,
                 rot=(0, 0, sx * -0.95), bevel=0.01, subd=1, wobble=0.003)
        objs.append(sp)
    for px in (-gw / 2, -gw / 6, gw / 6, gw / 2):
        objs.append(box("baymull", (0.07, 0.08, 1.2), (bx + px, -bd + 0.01, 1.32), trim, bevel=0.02, subd=1,
                        wobble=0.004))
    objs.append(box("baymull", (gw + 0.1, 0.08, 0.07), (bx, -bd + 0.01, 1.62), trim, bevel=0.02, subd=1, wobble=0))
    objs.append(box("baysill", (bw + 0.15, bd + 0.15, 0.09), (bx, -bd / 2 - 0.02, 0.73), trim, bevel=0.03,
                    subd=2, wobble=0.01))
    objs.append(box("baytop", (bw + 0.2, bd + 0.2, 0.12), (bx, -bd / 2 - 0.02, 1.97), trim, bevel=0.03,
                    subd=2, wobble=0.01))
    objs.append(box("bayroof", (bw + 0.3, bd + 0.35, 0.1), (bx, -bd / 2 - 0.03, 2.12), roof_m,
                    rot=(-0.35, 0, 0), bevel=0.03, subd=2, wobble=0.01))
    objs.append(snow_slab("baysnow", (bw + 0.35, bd + 0.35, 0.22), (bx, -bd / 2 - 0.02, 2.25), (-0.33, 0, 0),
                          lump=0.12, smooth=3))
    # little interior: a table lamp and a cat silhouette in the bay
    shade = lib.emissive("LampShade", (1.0, 0.75, 0.45), 8)
    objs.append(lib.lathe("lampshade", [(0.12, 0), (0.07, 0.14), (0.0, 0.15)], (bx - 0.45, 0.05, 1.25),
                          shade, segs=16))
    cat = clay("CatBlack", (0.03, 0.03, 0.035), rough=0.8)
    objs.append(lib.blob("cat", (bx + 0.35, -bd + 0.25, 0.92), 0.13, cat, squash=(1.3, 0.8, 1.0), subd=3, lump=0.1))
    objs.append(lib.blob("cathead", (bx + 0.2, -bd + 0.25, 1.08), 0.08, cat, subd=3, lump=0.05))
    for ex in (-0.04, 0.04):
        objs.append(lib.blob("catear", (bx + 0.2 + ex, -bd + 0.25, 1.16), 0.03, cat, squash=(1, 0.6, 1.4), subd=2,
                             lump=0))

    # roof slabs front/back (ridge along X), overhang on gable ends
    ov = 0.4
    roof_t = 0.15
    slen = (hd + ov) / math.cos(pitch) + 0.08
    for sy in (-1, 1):
        cy = D / 2 + sy * (hd + ov) / 2
        cz = ridge - ((hd + ov) / 2) * math.tan(pitch) + roof_t / 2 / math.cos(pitch)
        rot = (-sy * pitch, 0, 0)
        objs.append(box("proof", (W + 2 * 0.3, slen, roof_t), (0, cy, cz), roof_m, rot=rot, bevel=0.05,
                        subd=3, wobble=0.03))
        n = Vector((0, sy * math.sin(pitch), math.cos(pitch)))
        sc = Vector((0, cy, cz)) + n * (roof_t / 2 + 0.17 - 0.07)
        objs.append(snow_slab("proofsnow", (W + 0.7, slen + 0.12, 0.34), tuple(sc), rot, lump=0.22, smooth=3))
    objs.append(snow_slab("pridge", (W + 0.75, 0.5, 0.3), (0, D / 2, ridge + 0.28), (0, 0, 0), lump=0.16,
                          smooth=3))
    # front eave icicles
    ez = ridge - (hd + ov) * math.tan(pitch) - 0.02
    for i in range(12):
        x = -W / 2 - 0.2 + (W + 0.4) * (i + RNG.uniform(0.1, 0.9)) / 12
        L = RNG.uniform(0.08, 0.5)
        r = RNG.uniform(0.02, 0.035)
        o = lib.lathe("icicle", [(r * 1.4, 0), (r, -L * 0.3), (r * 0.5, -L * 0.7), (0.004, -L)],
                      (x, -ov + 0.05, ez), ice_mat(), segs=8, wob=0.3)
        o.parent = R
    # dormer: little front gable poking from the front roof
    dz = H + 0.55
    dy = 0.7
    dprof = [(-0.6, 0.0), (0.6, 0.0), (0.6, 0.85), (0.0, 1.45), (-0.6, 0.85)]
    dorm = prism("dormer", dprof, 1.6, (0, dy - 0.15, dz), pink, bevel=0.03, subd=3, wobble=0.02)
    objs.append(dorm)
    objs.append(box("dglass", (0.55, 0.03, 0.62), (0, dy - 0.17, dz + 0.45), glow, bevel=0.01, subd=1, wobble=0))
    objs.append(box("dframe", (0.7, 0.07, 0.07), (0, dy - 0.2, dz + 0.8), trim, bevel=0.02, subd=1, wobble=0))
    objs.append(box("dframe", (0.7, 0.07, 0.07), (0, dy - 0.2, dz + 0.12), trim, bevel=0.02, subd=1, wobble=0))
    objs.append(box("dmull", (0.04, 0.05, 0.62), (0, dy - 0.2, dz + 0.45), trim, bevel=0.01, subd=1, wobble=0))
    dp = math.radians(45)
    for sx in (-1, 1):
        objs.append(box("droof", (0.98, 1.8, 0.09), (sx * 0.32, dy + 0.7, dz + 1.17), roof_m,
                        rot=(0, sx * dp, 0), bevel=0.03, subd=2, wobble=0.01))
        objs.append(snow_slab("dsnow", (1.0, 1.85, 0.2), (sx * 0.34, dy + 0.7, dz + 1.27), (0, sx * dp, 0),
                              lump=0.1, smooth=3))
    # side chimney (stone) on the right gable end
    objs.append(box("pchim", (0.7, 0.75, ridge + 0.9), (W / 2 + 0.3, D / 2 + 0.3, (ridge + 0.9) / 2), stone_w,
                    bevel=0.07, subd=3, wobble=0.05))
    objs.append(snow_slab("pchsnow", (0.8, 0.85, 0.2), (W / 2 + 0.3, D / 2 + 0.3, ridge + 0.95), (0, 0, 0),
                          lump=0.1, smooth=3))
    # holly window boxes under upper windows
    pine = clay("Pine", P.PINE, rough=0.7, dimple=1.2, dimple_scale=8, var=0.25)
    berry = lib.glossy_paint("Berry", (0.6, 0.03, 0.03), rough=0.2)
    for x in (-0.95, 0.95):
        objs.append(box("wbox", (0.95, 0.22, 0.18), (x, -0.16, 2.55), sage, bevel=0.03, subd=2, wobble=0.01))
        for k in range(6):
            objs.append(lib.blob("holly", (x - 0.38 + k * 0.15, -0.18, 2.7), 0.08, pine, subd=2, lump=0.5,
                                 rot=(RNG.random(), RNG.random(), 0)))
            if k % 2:
                objs.append(lib.blob("hberry", (x - 0.38 + k * 0.15, -0.27, 2.72), 0.022, berry, subd=1, lump=0))
        objs.append(snow_slab("wbsnow", (0.85, 0.2, 0.06), (x, -0.17, 2.8), (0, 0, 0), lump=0.06, smooth=2))
    for o in objs:
        if o.parent is None:
            o.parent = R
    return R


# --------------------------------------------------------------------------
# Background houses: same vocabulary, simpler, varied proportions & colours
# --------------------------------------------------------------------------
def bg_house(name, O, W, D, H, pitch_deg, color, rot_z=0.0, gable_front=True, windows_lit=0.7,
             chimney=True, seed=0):
    R = root(name, O, lean=(RNG.uniform(-0.01, 0.01), RNG.uniform(-0.012, 0.012), rot_z))
    wall = clay(name + "_wall", color, rough=0.7, sss=0.1, dimple=1.0, var=0.2, stucco=0.9, bump=0.8)
    trim = wood("CreamWood", P.CREAM, painted=True, rough=0.5)
    roof_m = clay("RoofSlate", P.ROOF_SLATE, rough=0.7, var=0.2)
    glow = window_glow("BgGlow", color=(1.0, 0.55, 0.25), strength=3.0, frost=False)
    dark = clay("DarkPane", (0.03, 0.035, 0.06), rough=0.15, coat=0.6)
    pitch = math.radians(pitch_deg)
    objs = []
    if gable_front:
        ridge = H + (W / 2) * math.tan(pitch)
        prof = [(-W / 2, 0), (W / 2, 0), (W / 2, H), (0, ridge), (-W / 2, H)]
        body = prism(name + "_body", prof, D, (0, 0, 0), wall, bevel=0.04, subd=3, wobble=0.04)
        ov = 0.35
        slen = (W / 2 + ov) / math.cos(pitch) + 0.06
        for sx in (-1, 1):
            cx = sx * (W / 2 + ov) / 2
            cz = ridge - ((W / 2 + ov) / 2) * math.tan(pitch) + 0.07
            rot = (0, sx * pitch, 0)
            objs.append(box("r", (slen, D + 0.6, 0.12), (cx, D / 2 - 0.1, cz), roof_m, rot=rot, bevel=0.04,
                            subd=2, wobble=0.03))
            n = Vector((sx * math.sin(pitch), 0, math.cos(pitch)))
            objs.append(snow_slab("rs", (slen + 0.1, D + 0.75, 0.32), tuple(Vector((cx, D / 2 - 0.1, cz)) + n * 0.17),
                                  rot, lump=0.22, smooth=2))
        objs.append(snow_slab("rr", (0.45, D + 0.8, 0.28), (0, D / 2 - 0.1, ridge + 0.25), (0, 0, 0), lump=0.15,
                              smooth=2))
    else:
        hd = D / 2
        ridge = H + hd * math.tan(pitch)
        prof = [(0, 0), (D, 0), (D, H), (hd, ridge), (0, H)]
        body = prism(name + "_body", prof, W, (-W / 2, 0, 0), wall, axis='X', bevel=0.04, subd=3, wobble=0.04)
        ov = 0.35
        slen = (hd + ov) / math.cos(pitch) + 0.06
        for sy in (-1, 1):
            cy = hd + sy * (hd + ov) / 2
            cz = ridge - ((hd + ov) / 2) * math.tan(pitch) + 0.07
            rot = (-sy * pitch, 0, 0)
            objs.append(box("r", (W + 0.5, slen, 0.12), (0, cy, cz), roof_m, rot=rot, bevel=0.04, subd=2,
                            wobble=0.03))
            n = Vector((0, sy * math.sin(pitch), math.cos(pitch)))
            objs.append(snow_slab("rs", (W + 0.65, slen + 0.1, 0.32), tuple(Vector((0, cy, cz)) + n * 0.17), rot,
                                  lump=0.22, smooth=2))
        objs.append(snow_slab("rr", (W + 0.7, 0.45, 0.28), (0, hd, ridge + 0.25), (0, 0, 0), lump=0.15, smooth=2))
    objs.append(body)
    # windows: simple framed panes on the front, some lit
    floors = max(1, int((H - 0.6) // 1.6))
    cols = max(1, int(W // 1.3))
    for f in range(floors):
        for c in range(cols):
            x = -W / 2 + W * (c + 0.5) / cols
            z = 0.9 + f * 1.55
            lit = RNG.random() < windows_lit
            objs.append(box("bw", (0.62, 0.04, 0.85), (x, -0.02, z + 0.42), glow if lit else dark, bevel=0.01,
                            subd=1, wobble=0.004))
            for (sx, sz, pz) in [(0.78, 0.08, z + 0.88), (0.78, 0.08, z - 0.04)]:
                objs.append(box("bwf", (sx, 0.07, sz), (x, -0.05, pz), trim, bevel=0.02, subd=1, wobble=0.004))
            objs.append(box("bwm", (0.05, 0.05, 0.85), (x, -0.05, z + 0.42), trim, bevel=0.01, subd=1, wobble=0))
            objs.append(box("bws", (0.7, 0.14, 0.05), (x, -0.08, z + 0.0), snow(), bevel=0, subd=0, wobble=0.01,
                            smooth_subd=1))
    if chimney:
        cx = W * 0.22
        objs.append(box("ch", (0.5, 0.5, 1.6), (cx, D * 0.6, ridge - 0.5), clay("Brick", P.BRICK), bevel=0.04,
                        subd=2, wobble=0.03))
        objs.append(snow_slab("chs", (0.62, 0.62, 0.16), (cx, D * 0.6, ridge + 0.32), (0, 0, 0), lump=0.08,
                              smooth=2))
    for o in objs:
        o.parent = R
    return R
