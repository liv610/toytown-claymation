"""Visual-quality pass for the blue toy shop, the pink house and their street.

Runs *after* the normal village build and only adds/adjusts; the regular build is
untouched, so the "before" scene stays exactly reproducible.

  * snow      frosting drips along every eave, gable and awning edge; thicker caps;
              crusty banks against the walls
  * surfaces  coarser trowelled stucco; frost dusting on every up-facing surface;
              real brickwork on the chimneys; terracotta tiles peeking under the snow
  * dressing  light strings on the awning and eaves, a garland and lantern at the
              pink door, snowy planters by the doors
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector, Matrix

from . import lib, trees, props
from .lib import blob, box, clay, snow, lathe
from . import palette as P

R = random.Random(4242)


def _shop_frame():
    o = bpy.data.objects["BlueShop"]
    return o.matrix_world.copy()


def _pink_frame():
    return bpy.data.objects["PinkHouse"].matrix_world.copy()


def drip_line(parent, a, b, step=0.09, size=(0.045, 0.095), hang=(1.0, 1.7), mat=None, out=Vector((0, -1, 0)), long_every=6):
    """Frosting drips hanging from an edge from local point a to b."""
    mat = mat or snow()
    a, b = Vector(a), Vector(b)
    L = (b - a).length
    n = max(2, int(L / step))
    objs = []
    for i in range(n + 1):
        t = min(1.0, max(0.0, (i + R.uniform(-0.35, 0.35)) / n))
        p = a.lerp(b, t) + out * R.uniform(0.0, 0.03)
        r = R.uniform(*size) * (1.35 if R.random() < 0.25 else 1.0)
        if R.random() < 0.18:      # gaps where the frosting broke away
            continue
        k = R.uniform(*hang) * (2.2 if R.random() < 1.0 / long_every else 1.0)
        o = blob("drip", tuple(p - Vector((0, 0, r * k * 0.45))), r, mat, squash=(1.0, 0.9, k), subd=2, lump=0.18,
                 rot=(R.uniform(-0.12, 0.12), R.uniform(-0.12, 0.12), R.random() * 6.28))
        o.parent = parent
        objs.append(o)
        # a rounded lip of snow riding the edge itself
        if i % 2 == 0:
            lp = blob("lip", tuple(p + Vector((0, 0, r * 0.4))), r * 1.5, mat, squash=(1.5, 1.1, 0.8), subd=2, lump=0.3)
            lp.parent = parent
            objs.append(lp)
    return objs


def bulbs(parent, a, b, n, sag=0.06, color=(1.0, 0.72, 0.38)):
    bulb = lib.emissive("FairyLight", color, 40)
    wire = clay("Wire", (0.02, 0.025, 0.02), rough=0.6, wear=0.0)
    a, b = Vector(a), Vector(b)
    pts = []
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t) - Vector((0, 0, sag * math.sin(math.pi * ((t * 4) % 1))))
        pts.append(p)
        o = blob("bulb", tuple(p - Vector((0, 0, 0.025))), 0.022, bulb, squash=(0.9, 0.9, 1.25), subd=2, lump=0.0)
        o.parent = parent
    cu = bpy.data.curves.new("wire", 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    cu.bevel_depth = 0.006
    w = bpy.data.objects.new("wire", cu); w.data.materials.append(wire); lib.link(w); w.parent = parent


def brickwork(name, base_hex='#a24a3a'):
    """Clay chimney bricks: brick pattern drives colour, mortar recess and bump."""
    if name in lib._mats:
        return lib._mats[name]
    m = lib.clay(name, P.srgb(base_hex), rough=0.8, dimple=1.0, var=0.25, stucco=0.5, bump=0.8)
    nt = m.node_tree
    bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = 0.2
    br.inputs['Row Height'].default_value = 0.075
    br.inputs['Mortar Size'].default_value = 0.012
    br.inputs['Mortar Smooth'].default_value = 0.4
    br.inputs['Color1'].default_value = (*P.srgb('#a8473a'), 1)
    br.inputs['Color2'].default_value = (*P.srgb('#8e3b31'), 1)
    br.inputs['Mortar'].default_value = (*P.srgb('#d8ccb8'), 1)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs['Rotation'].default_value = (math.pi / 2, 0, 0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs[0], br.inputs['Vector'])
    old = bsdf.inputs['Base Color'].links[0].from_socket
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    nt.links.new(old, mix.inputs[6]); nt.links.new(br.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs['Strength'].default_value = 0.7; bump.inputs['Distance'].default_value = 0.02
    nt.links.new(br.outputs['Fac'], bump.inputs['Height'])
    oldn = bsdf.inputs['Normal'].links[0].from_socket
    nt.links.new(oldn, bump.inputs['Normal'])
    nt.links.new(bump.outputs[0], bsdf.inputs['Normal'])
    return m


FROSTED = set()


def frost(mat, amount=0.55):
    """A dusting of sugar-fine frost on up-facing surfaces (the references' glitter)."""
    if mat is None or mat.name in FROSTED or not mat.use_nodes:
        return
    nt = mat.node_tree
    bs = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED']
    if not bs or not bs[0].inputs['Base Color'].links:
        return
    b = bs[0]
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    up = nt.nodes.new("ShaderNodeMapRange"); nt.links.new(sep.outputs[2], up.inputs['Value'])
    up.inputs['From Min'].default_value = 0.45; up.inputs['From Max'].default_value = 0.95
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.inputs['Scale'].default_value = 140.0
    nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
    no = nt.nodes.new("ShaderNodeTexNoise"); no.inputs['Scale'].default_value = 6.0; no.inputs['Detail'].default_value = 4
    nt.links.new(tc.outputs['Object'], no.inputs['Vector'])
    sp = nt.nodes.new("ShaderNodeMapRange"); nt.links.new(vo.outputs['Distance'], sp.inputs['Value'])
    sp.inputs['From Min'].default_value = 0.42; sp.inputs['From Max'].default_value = 0.15
    patch = nt.nodes.new("ShaderNodeMapRange"); nt.links.new(no.outputs['Fac'], patch.inputs['Value'])
    patch.inputs['From Min'].default_value = 0.4; patch.inputs['From Max'].default_value = 0.65
    m1 = nt.nodes.new("ShaderNodeMath"); m1.operation = 'MULTIPLY'
    nt.links.new(up.outputs[0], m1.inputs[0]); nt.links.new(sp.outputs[0], m1.inputs[1])
    m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = 'MULTIPLY_ADD'
    nt.links.new(m1.outputs[0], m2.inputs[0]); nt.links.new(patch.outputs[0], m2.inputs[1]); m2.inputs[2].default_value = 0.0
    m3 = nt.nodes.new("ShaderNodeMath"); m3.operation = 'MULTIPLY'; m3.use_clamp = True
    nt.links.new(m2.outputs[0], m3.inputs[0]); m3.inputs[1].default_value = amount
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'
    nt.links.new(m3.outputs[0], mix.inputs['Factor'])
    nt.links.new(b.inputs['Base Color'].links[0].from_socket, mix.inputs[6])
    mix.inputs[7].default_value = (0.93, 0.94, 0.97, 1)
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    FROSTED.add(mat.name)


def roughen(mat, k=1.5):
    """Coarser trowel marks: push the stucco bump harder."""
    if not mat or not mat.use_nodes:
        return
    for n in mat.node_tree.nodes:
        if n.type == 'BUMP':
            n.inputs['Strength'].default_value = min(1.0, n.inputs['Strength'].default_value * k)
            n.inputs['Distance'].default_value *= 1.35


def enhance():
    shop = bpy.data.objects["BlueShop"]
    pink = bpy.data.objects["PinkHouse"]
    sn = snow()
    # ---------------- surfaces
    for name in ("ShopBlue", "Pink", "Cream", "PlinthStone", "StoneWarm"):
        roughen(bpy.data.materials.get(name))
    br = brickwork("ChimneyBrick")
    for root in (shop, pink):
        for o in root.children_recursive:
            if o.type == 'MESH' and o.name.startswith(("chimney", "pchim")):
                o.data.materials.clear(); o.data.materials.append(br if o.name.startswith("chimney") else
                                                                 brickwork("ChimneyStone", '#9b8d80'))
    # ---------------- thicker snow caps
    for root in (shop, pink):
        for o in root.children_recursive:
            if o.type == 'MESH' and o.name.split('.')[0] in ("roofsnow", "proofsnow", "ridgesnow", "pridge", "baysnow", "dsnow",
                                                              "cansnow", "awnsnow", "chimsnow", "pchsnow"):
                o.scale = (1.0, 1.0, 1.45 if "ridge" not in o.name and "pridge" not in o.name else 1.25)
                for m in o.modifiers:
                    if m.type == 'DISPLACE':
                        m.strength *= 1.3
    # ---------------- frosting drips: blue shop (front gable edges, side eaves, awning, sign)
    W, H, D = 5.2, 5.2, 5.0
    hw, ov = W / 2, 0.45
    pitch = math.radians(53)
    ridge = H + hw * math.tan(pitch)
    ze = ridge - (hw + ov) * math.tan(pitch)
    y0, y1 = -0.55, D + 0.3
    for sx in (-1, 1):
        # gable edge, front face: from eave corner to ridge, just below the snow lip
        a = (sx * (hw + ov), y0 - 0.08, ze - 0.02)
        b = (0.0, y0 - 0.08, ridge + 0.05)
        drip_line(shop, a, b, step=0.1, size=(0.05, 0.1))
        # side eave
        drip_line(shop, (sx * (hw + ov + 0.08), y0 + 0.1, ze - 0.05), (sx * (hw + ov + 0.08), y1 - 0.1, ze - 0.05),
                  step=0.11, size=(0.05, 0.1), out=Vector((sx, 0, 0)))
    # awning valance and the sign board
    drip_line(shop, (-2.42, -1.17, 2.46), (2.42, -1.17, 2.46), step=0.085, size=(0.035, 0.07), hang=(1.3, 2.4), long_every=9)
    drip_line(shop, (-1.38, -0.21, 3.76), (1.38, -0.21, 3.76), step=0.1, size=(0.03, 0.055), hang=(1.2, 2.0), long_every=99)
    # light strings: along the awning frame and under the front eave band
    bulbs(shop, (-2.4, -1.2, 2.42), (2.4, -1.2, 2.42), 26, sag=0.04)
    bulbs(shop, (-2.55, -0.16, 5.02), (2.55, -0.16, 5.02), 28, sag=0.07)
    # ---------------- pink house: front + back eaves, dormer and canopy edges
    Wp, Dp, Hp = 4.1, 4.4, 3.9
    pp = math.radians(47)
    hd, ovp = Dp / 2, 0.4
    ridge_p = Hp + hd * math.tan(pp)
    zep = ridge_p - (hd + ovp) * math.tan(pp)
    drip_line(pink, (-Wp / 2 - 0.25, -ovp - 0.05, zep - 0.05), (Wp / 2 + 0.25, -ovp - 0.05, zep - 0.05), step=0.1,
              size=(0.05, 0.1))
    drip_line(pink, (-Wp / 2 - 0.25, Dp + ovp + 0.05, zep - 0.05), (Wp / 2 + 0.25, Dp + ovp + 0.05, zep - 0.05), step=0.14,
              out=Vector((0, 1, 0)))
    drip_line(pink, (1.25 - 0.62, -0.82, 2.55), (1.25 + 0.62, -0.82, 2.55), step=0.08, size=(0.03, 0.06), hang=(1.2, 2.2))
    drip_line(pink, (-0.85 - 1.1, -0.82, 2.0), (-0.85 + 1.1, -0.82, 2.0), step=0.09, size=(0.035, 0.07), hang=(1.2, 2.4))
    # terracotta tiles peeking out under the snow along the front eave
    tile = clay("RoofTile", P.srgb('#b4553f'), rough=0.7, var=0.3, dimple=1.0)
    x = -Wp / 2 - 0.25
    while x < Wp / 2 + 0.25:
        t = blob("tile", (x, -ovp + 0.02, zep + 0.03), 0.11, tile, squash=(1.0, 0.55, 0.45), subd=2, lump=0.08)
        t.parent = pink
        x += 0.17
    bulbs(pink, (-Wp / 2 - 0.2, -ovp - 0.02, zep - 0.02), (Wp / 2 + 0.2, -ovp - 0.02, zep - 0.02), 30, sag=0.08)
    # garland with bows around the pink door, and a wall lantern beside it
    pine = clay("Pine", P.PINE, rough=0.7, dimple=1.2, dimple_scale=8, var=0.25)
    red = lib.glossy_paint("RibbonRed", P.DEEP_RED, rough=0.35)
    berry = lib.glossy_paint("Berry", (0.6, 0.03, 0.03), rough=0.2)
    dc = Vector((1.25, -0.12, 0))
    n = 26
    for i in range(n + 1):
        t = i / n
        ang = math.pi * t
        p = dc + Vector((-0.66 * math.cos(ang), -0.08, 2.4 + 0.25 * math.sin(ang) - 0.55 * (1 - math.sin(ang)) * 0.6))
        g = blob("pgarl", tuple(p), 0.085, pine, squash=(1.3, 1.0, 1.0), subd=2, lump=0.5, rot=(R.random(), R.random(), R.random()))
        g.parent = pink
        if i % 4 == 2:
            blob("pgb", tuple(p + Vector((0, -0.07, -0.02))), 0.022, lib.emissive("FairyLight", (1.0, 0.72, 0.38), 40), subd=1,
                 lump=0).parent = pink
        if i % 5 == 0:
            blob("pgberry", tuple(p + Vector((0.03, -0.08, 0.02))), 0.024, berry, subd=1, lump=0).parent = pink
    for sxp in (-0.66, 0.66):
        props.red_bow(pink, tuple(dc + Vector((sxp, -0.16, 2.35))), 0.75)
    ir = clay("Iron", P.IRON, rough=0.42, sss=0.0, dimple=0.6, grain=0.5, coat=0.25, var=0.1)
    lx = dc.x + 0.95
    box("lbracket", (0.05, 0.25, 0.05), (lx, -0.16, 2.05), ir, bevel=0.015, subd=0, wobble=0).parent = pink
    lg = lathe("lantern", [(0.0, 0.0), (0.09, 0.0), (0.12, 0.28), (0.0, 0.28)], (lx, -0.3, 1.78), lib.window_glow("LampGlass", color=(1.0, 0.68, 0.32), strength=5.0, frost=False), segs=6, smooth_subd=0)
    lg.parent = pink
    lc = lathe("lcap", [(0.0, 0.0), (0.16, 0.0), (0.0, 0.16)], (lx, -0.3, 2.06), ir, segs=6, smooth_subd=0)
    lc.parent = pink
    blob("lsnow", (lx, -0.3, 2.16), 0.11, sn, squash=(1.4, 1.4, 0.5), subd=2, lump=0.25).parent = pink
    Lp = bpy.data.lights.new("PinkLantern", 'POINT'); Lp.energy = 22; Lp.color = (1.0, 0.64, 0.32); Lp.shadow_soft_size = 0.06
    lo = bpy.data.objects.new("PinkLantern", Lp); lo.location = (lx, -0.36, 1.92); lo.parent = pink; lib.link(lo, "Lights")
    # light strings make a little light of their own on the facades (soft, for the bake)
    for (par, loc, e) in ((shop, (0, -1.35, 2.3), 18), (shop, (0, -0.4, 4.9), 14), (pink, (0, -0.6, 3.6), 14)):
        Ls = bpy.data.lights.new("StringGlow", 'AREA'); Ls.shape = 'RECTANGLE'; Ls.size = 4.4; Ls.size_y = 0.1
        Ls.energy = e; Ls.color = (1.0, 0.68, 0.36)
        so = bpy.data.objects.new("StringGlow", Ls); so.location = loc; so.rotation_euler = (math.radians(70), 0, 0)
        so.parent = par; lib.link(so, "Lights"); so.visible_camera = False
    # ---------------- snowy planters by the doors
    pot = clay("PotTerracotta", P.srgb('#a85a3c'), rough=0.75, var=0.2, dimple=1.0)
    for (x, y, par) in ((-0.95, -0.85, shop), (0.85, -0.85, shop), (0.55, -0.75, pink)):
        w = par.matrix_world @ Vector((x, y, 0))
        lathe("planter", [(0.0, 0.0), (0.17, 0.0), (0.22, 0.34), (0.24, 0.36), (0.0, 0.36)], (w.x, w.y, 0.04), pot, segs=16, wob=0.05)
        trees.fir("PlanterFir%d" % int((x + 2) * 10), (w.x, w.y, 0.38), 0.85, 0.3, tiers=5, color=P.PINE, snow_amt=0.8, lights=False,
                  trunk=False, rings=4, rad_segs=36)
    # ---------------- crusty banks against the walls and at the corners
    for (x, y) in ((-2.75, -0.15), (2.75, -0.15), (3.85, 0.3), (8.1, 0.3), (-2.4, -0.25), (8.0, 0.25)):
        for k in range(5):
            blob("bank", (x + R.uniform(-0.35, 0.35), y + R.uniform(-0.25, 0.1), 0.05), R.uniform(0.18, 0.32), snow("GroundSnow"),
                 squash=(1.5, 1.1, 0.75), subd=3, lump=0.4)
    # ---------------- frost on the surfaces that face the sky
    for m in list(bpy.data.materials):
        if m.name.startswith(("ShopBlue", "Pink", "Cream", "Shutter", "RoofSlate", "RoofRed", "PlinthStone", "StoneWarm", "Holly", "Pine",
                              "PlanterWood", "Iron", "BenchWood", "WagonRed", "Cobble", "Paper_", "DoorGreen", "DoorPlum", "Gold",
                              "ChimneyBrick", "ChimneyStone", "PotTerracotta", "RoofTile", "Needles")):
            frost(m, 0.6 if m.name.startswith(("Cobble", "Paper_")) else 0.5)
    light_tune()
    print("hq: enhanced shop + pink house")


def light_tune():
    """Golden, high-key miniature-set lighting: warm key and bounce, brighter interiors,
    cool blue kept for the snow's shadows only."""
    for o in bpy.data.objects:
        if o.type != 'LIGHT':
            continue
        L = o.data
        if o.name == "Key":
            L.energy *= 1.55; L.color = (1.0, 0.6, 0.32)
        elif o.name == "Bounce":
            L.energy *= 3.5; L.color = (1.0, 0.62, 0.38); L.size = 12
        elif o.name == "Fill":
            L.energy *= 0.85
        elif o.name == "Rim":
            L.energy *= 1.25
        elif o.name.startswith(("Spill", "Inside", "Interior", "awnLight", "LampWest_light", "LampEast_light")):
            L.energy *= 1.5
    for m in ("ShopGlow", "UpperGlow", "PinkGlow", "BgGlow", "LampGlass"):
        mat = bpy.data.materials.get(m)
        if not mat:
            continue
        for n in mat.node_tree.nodes:
            if n.type == 'MATH' and n.operation == 'MULTIPLY' and n.inputs[1].default_value > 1.0:
                n.inputs[1].default_value *= 1.0
            if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Emission Strength'].links:
                n.inputs["Emission Strength"].default_value *= 1.0
    w = bpy.context.scene.world
    if w and w.use_nodes:
        for n in w.node_tree.nodes:
            if n.type == 'BACKGROUND':
                n.inputs['Strength'].default_value *= 1.5
