"""Evergreens built from pinched, drooping clay 'skirts' rather than cones.

Each tier is a radial sheet whose rim is scalloped into branch tips that sag
downward; tiers are rotated, offset and sized irregularly so the silhouette
leans and steps like a hand-sculpted tree.  Snow is pressed on as lumps.
"""
import math

import bmesh
import bpy
from mathutils import Vector, noise

from . import lib
from .lib import RNG, clay, snow
from . import palette as P


def needle_mat(name, color):
    if name in lib._mats:
        return lib._mats[name]
    m = lib.clay(name, color, rough=0.72, sss=0.08, dimple=0.5, grain=1.6, dimple_scale=9,
                 var=0.3, sheen=0.4, bump=0.7)
    # add stretched needle strokes on top of the clay bump
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = [n for n in nodes if n.type == 'BSDF_PRINCIPLED'][0]
    old = bsdf.inputs['Normal'].links[0].from_node
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping"); mp.inputs['Scale'].default_value = (40, 40, 6)
    links.new(tc.outputs['Object'], mp.inputs['Vector'])
    wn = nodes.new("ShaderNodeTexNoise"); wn.inputs['Scale'].default_value = 3
    wn.inputs['Detail'].default_value = 4
    links.new(mp.outputs[0], wn.inputs['Vector'])
    b2 = nodes.new("ShaderNodeBump"); b2.inputs['Strength'].default_value = 0.5
    b2.inputs['Distance'].default_value = 0.01
    links.new(wn.outputs['Fac'], b2.inputs['Height'])
    links.new(old.outputs[0], b2.inputs['Normal'])
    links.new(b2.outputs[0], bsdf.inputs['Normal'])
    return m


def tier_bm(R, droop, lobes, phase, thick, seed, rad_segs=72, rings=7, lobe_amp=0.22):
    bm = bmesh.new()
    grid = []
    for k in range(rings + 1):
        t = k / rings
        row = []
        for i in range(rad_segs):
            a = 2 * math.pi * i / rad_segs
            lobe = 0.5 + 0.5 * math.cos(lobes * a + phase)
            irregular = noise.noise(Vector((math.cos(a) * 1.7 + seed, math.sin(a) * 1.7, seed)))
            r = R * t * (1 - lobe_amp + lobe_amp * lobe + 0.12 * irregular)
            # sag: rim drops, branch tips (lobe peaks) drop a bit more
            z = -droop * (t ** 1.6) * (0.85 + 0.3 * lobe) + 0.05 * irregular * t
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        grid.append(row)
    top = grid[0]
    for k in range(rings):
        for i in range(rad_segs):
            j = (i + 1) % rad_segs
            bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
    bmesh.ops.remove_doubles(bm, verts=top, dist=1e-5)
    return bm


def fir(name, loc, height, radius, *, tiers=7, color=P.PINE, snow_amt=0.8, lean=0.04,
        ornaments=False, lights=False, star=False, seed=None, collection="Set", rings=7,
        rad_segs=72, trunk=True):
    seed = RNG.random() * 100 if seed is None else seed
    root = bpy.data.objects.new(name, None)
    root.location = loc
    root.rotation_euler = (RNG.uniform(-lean, lean), RNG.uniform(-lean, lean), RNG.random() * 6.28)
    lib.link(root, collection)
    mat = needle_mat("Needles_" + str(round(color[1], 3)), color)
    sn = snow()
    tips = []
    base_z = height * 0.12
    for k in range(tiers):
        f = k / (tiers - 1)
        # irregular spacing and sizes: hand made
        z = base_z + (height - base_z) * (f ** 0.92) * 0.9 + RNG.uniform(-0.03, 0.03) * height
        R = radius * (1 - f) ** 0.95 * RNG.uniform(0.88, 1.08) + 0.08 * radius
        droop = R * RNG.uniform(0.55, 0.75)
        lobes = RNG.choice([5, 6, 7, 7, 8, 9]) if R > 0.4 else RNG.choice([4, 5, 6])
        phase = RNG.random() * 6.28
        bm = tier_bm(R, droop, lobes, phase, 0.06, seed + k * 3.7, rad_segs, rings)
        o = lib.mesh_obj(f"{name}_tier{k}", bm, mat, collection)
        o.location = (RNG.uniform(-0.04, 0.04) * radius, RNG.uniform(-0.04, 0.04) * radius, z + droop * 0.6)
        o.rotation_euler = (RNG.uniform(-0.06, 0.06), RNG.uniform(-0.06, 0.06), 0)
        m = o.modifiers.new("thick", 'SOLIDIFY'); m.thickness = 0.05 + 0.04 * R; m.offset = -1
        m = o.modifiers.new("sm", 'SUBSURF'); m.levels = m.render_levels = 1
        lib.clay_mods(o, 0, 0, 0, 0.05 * R + 0.02)
        o.parent = root
        # record branch-tip positions (lobe peaks) for snow / ornaments / lights
        for li in range(lobes):
            a = (2 * math.pi * li - phase) / lobes
            rr = R * 0.92
            tz = z + droop * 0.6 - droop * 0.95
            tips.append((Vector((rr * math.cos(a), rr * math.sin(a), tz)), R, a))
        # snow pressed onto upper surface of the tier: clumps riding the lobes
        if snow_amt > 0:
            for li in range(lobes):
                if RNG.random() > snow_amt:
                    continue
                a = (2 * math.pi * li - phase) / lobes + RNG.uniform(-0.15, 0.15)
                for s_t in (RNG.uniform(0.45, 0.62), RNG.uniform(0.7, 0.85)):
                    rr = R * s_t
                    tz = z + droop * 0.6 - droop * (s_t ** 1.6) * 1.05 + 0.03
                    sr = R * RNG.uniform(0.13, 0.2) + 0.03
                    b = lib.blob("tsnow", (rr * math.cos(a) + o.location.x, rr * math.sin(a) + o.location.y, tz + sr * 0.35),
                                 sr, sn, squash=(1.5, 1.1, 0.5), subd=3, lump=0.4,
                                 rot=(0, -0.5 * (s_t), a))
                    b.parent = root
            # cap on the top of each tier
            b = lib.blob("tcap", (o.location.x, o.location.y, z + droop * 0.6 + 0.02), R * 0.3 + 0.03, sn,
                         squash=(1.3, 1.3, 0.45), subd=3, lump=0.35)
            b.parent = root
    if trunk:
        t = lib.lathe(name + "_trunk", [(0.0, 0), (radius * 0.12, 0), (radius * 0.1, base_z + 0.3), (0, base_z + 0.35)],
                      (0, 0, 0), clay("Bark", P.WOOD_DARK, rough=0.85, dimple=1.6), segs=12, wob=0.2)
        t.parent = root
    if ornaments:
        cols = [lib.glossy_paint("OrnRed", (0.55, 0.02, 0.03), 0.2),
                lib.glossy_paint("Gold", P.GOLD, 0.3, 0.6),
                lib.glossy_paint("OrnBlue", P.srgb('#2d5fae'), 0.2),
                lib.glossy_paint("OrnSilver", (0.75, 0.75, 0.8), 0.18, 0.8)]
        for (p, R, a) in tips:
            if RNG.random() < 0.85 and p.z > 0.3:
                r = RNG.uniform(0.07, 0.1) * (radius / 0.9)
                o = lib.blob("orn", (p.x * 0.97, p.y * 0.97, p.z - r * 0.6), r, RNG.choice(cols), subd=3, lump=0.03)
                o.parent = root
                cap = lib.blob("orncap", (p.x * 0.97, p.y * 0.97, p.z + r * 0.3), r * 0.3,
                               lib.glossy_paint("Gold", P.GOLD, 0.3, 0.6), subd=1, lump=0)
                cap.parent = root
    if lights:
        bulb = lib.emissive("FairyLight", (1.0, 0.72, 0.38), 40)
        # spiral strand around the tree, sitting just outside the tiers
        n = int(160 * height / 2.5)
        for i in range(n):
            f = i / n
            z = base_z + 0.1 + (height * 0.92 - base_z) * f
            # tier radius approximation at this height
            R = radius * (1 - f) ** 0.95 * 0.85 + 0.06
            a = f * 2 * math.pi * 7.5 + RNG.uniform(-0.1, 0.1)
            o = lib.blob("fl", (R * math.cos(a), R * math.sin(a), z + RNG.uniform(-0.06, 0.06)), 0.02, bulb,
                         subd=1, lump=0)
            o.parent = root
    if star:
        gold = lib.emissive("StarGlow", (1.0, 0.78, 0.3), 6)
        prof = []
        for i in range(10):
            a = math.pi / 2 + i * math.pi / 5
            r = 0.2 if i % 2 == 0 else 0.085
            prof.append((r * math.cos(a), r * math.sin(a)))
        st = lib.mesh_obj("star", lib.prism_bm(prof, 0.07), gold)
        st.location = (0, 0.035, height + 0.12)
        st.rotation_euler = (0, 0, 0)
        m = st.modifiers.new("bev", 'BEVEL'); m.width = 0.025; m.segments = 3
        m = st.modifiers.new("sm", 'SUBSURF'); m.levels = m.render_levels = 1
        st.parent = root
        L = bpy.data.lights.new("starLight", 'POINT'); L.energy = 6; L.color = (1.0, 0.8, 0.45)
        L.shadow_soft_size = 0.1
        lo = bpy.data.objects.new("starLight", L); lo.location = (0, -0.25, height + 0.12)
        lib.link(lo, "Lights"); lo.parent = root
        lo.visible_camera = False
    if lights:
        L = bpy.data.lights.new("treeGlow", 'POINT'); L.energy = 25; L.color = (1.0, 0.65, 0.35)
        L.shadow_soft_size = 0.6
        lo = bpy.data.objects.new("treeGlow", L); lo.location = (0, -radius * 1.4, height * 0.45)
        lib.link(lo, "Lights"); lo.parent = root
    return root
