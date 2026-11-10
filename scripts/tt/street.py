"""Ground, cobblestone street, snowbanks.

The street is described by two edge functions e_near(x) (building side) and
e_far(x) (camera side).  Everything — stones, ground height, snow masks —
derives from those so they stay consistent.
"""
import math

import bmesh
import bpy
from mathutils import Vector, noise

from . import lib
from .lib import RNG, snow, clay
from . import palette as P


def smooth01(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def e_near(x):
    """Building-side edge (y).  Pulled back around the tree and bench patches."""
    base = -0.62 + 0.06 * noise.noise(Vector((x * 0.7, 3.1, 0)))
    pull = 1.35 * (1 - smooth01(-3.6, -2.9, x)) + 1.25 * smooth01(8.3, 9.0, x)
    return base - pull


def e_far(x):
    return -6.1 + 0.65 * math.sin(0.17 * x + 0.4) + 0.12 * noise.noise(Vector((x * 0.5, 7.7, 0)))


def street_dist(x, y):
    """Signed distance-ish: <0 inside the street, >0 outside (metres)."""
    a, b = e_far(x), e_near(x)
    return max(a - y, y - b)


def ground_height(x, y):
    d = street_dist(x, y)
    n1 = noise.noise(Vector((x * 0.35, y * 0.35, 1.3)))
    n2 = noise.noise(Vector((x * 1.4, y * 1.4, 5.1)))
    if d < 0:
        return -0.03
    # bank rising from the street edge, cresting ~0.5 m out, then rolling snow
    bank = 0.26 * math.exp(-((d - 0.45) / 0.45) ** 2) * (0.75 + 0.5 * (n1 + 0.5))
    roll = smooth01(0.0, 2.5, d) * (0.1 + 0.18 * n1)
    lip = smooth01(0.0, 0.18, d) * 0.05
    far = smooth01(6, 30, -y) * 0.6 + smooth01(3.5, 24, y) ** 1.2 * 8.5  # land rises away
    return -0.03 + lip + bank + roll + 0.035 * n2 + far


def ground(xr=(-40, 45), yr=(-34, 40), step=0.22):
    bm = bmesh.new()
    nx = int((xr[1] - xr[0]) / step)
    ny = int((yr[1] - yr[0]) / step)
    grid = []
    for j in range(ny + 1):
        row = []
        y = yr[0] + j * step
        # coarser far away
        for i in range(nx + 1):
            x = xr[0] + i * step
            row.append(bm.verts.new((x, y, ground_height(x, y))))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    obj = lib.mesh_obj("SnowGround", bm, snow("GroundSnow"))
    return obj


def bed():
    """Dark grout bed with packed snow, sitting just under the stone tops."""
    m = bpy.data.materials.new("StreetBed")
    nt, nodes, links = lib._nodes(m)
    b, out = lib._bsdf(nodes, links)
    tc = nodes.new("ShaderNodeTexCoord")
    n = nodes.new("ShaderNodeTexNoise"); n.inputs['Scale'].default_value = 1.8
    n.inputs['Detail'].default_value = 6
    links.new(tc.outputs['Object'], n.inputs['Vector'])
    r = nodes.new("ShaderNodeMapRange")
    links.new(n.outputs['Fac'], r.inputs['Value'])
    r.inputs['From Min'].default_value = 0.42; r.inputs['From Max'].default_value = 0.6
    mix = nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'
    links.new(r.outputs[0], mix.inputs['Factor'])
    mix.inputs[6].default_value = (0.055, 0.045, 0.04, 1)
    mix.inputs[7].default_value = (0.75, 0.78, 0.85, 1)
    links.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.75
    b.inputs['Subsurface Weight'].default_value = 0.2
    lib.tag(m, "clay", (0.3, 0.3, 0.33), 0.75)
    lib._mats["StreetBed"] = m
    bm = bmesh.new()
    xs = [x * 0.25 for x in range(-56, 101)]
    rows = []
    for x in xs:
        a, b_ = e_far(x) - 0.2, e_near(x) + 0.15
        rows.append([bm.verts.new((x, a + (b_ - a) * k / 12, 0.005)) for k in range(13)])
    for i in range(len(xs) - 1):
        for k in range(12):
            bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]))
    return lib.mesh_obj("StreetBed", bm, m)


def stone_mat():
    m = bpy.data.materials.new("Cobble")
    nt, nodes, links = lib._nodes(m)
    b, out = lib._bsdf(nodes, links)
    at = nodes.new("ShaderNodeAttribute"); at.attribute_name = "cobble"; at.attribute_type = 'GEOMETRY'
    sep = nodes.new("ShaderNodeSeparateXYZ"); links.new(at.outputs['Vector'], sep.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].color = (*P.srgb('#6d5d52'), 1)
    cr.elements[1].color = (*P.srgb('#a08a78'), 1)
    e = cr.elements.new(0.35); e.color = (*P.srgb('#857467'), 1)
    e = cr.elements.new(0.7); e.color = (*P.srgb('#7d7a80'), 1)
    links.new(sep.outputs[0], ramp.inputs[0])
    # clay texture on stones
    tc = nodes.new("ShaderNodeTexCoord")
    vor = nodes.new("ShaderNodeTexVoronoi"); vor.feature = 'SMOOTH_F1'
    vor.inputs['Scale'].default_value = 18
    links.new(tc.outputs['Object'], vor.inputs['Vector'])
    fine = nodes.new("ShaderNodeTexNoise"); fine.inputs['Scale'].default_value = 60
    fine.inputs['Detail'].default_value = 5
    links.new(tc.outputs['Object'], fine.inputs['Vector'])
    h = nodes.new("ShaderNodeMath"); h.operation = 'MULTIPLY_ADD'
    links.new(fine.outputs['Fac'], h.inputs[0]); h.inputs[1].default_value = 0.4
    links.new(vor.outputs['Distance'], h.inputs[2])
    bn = nodes.new("ShaderNodeBump"); bn.inputs['Strength'].default_value = 0.45
    bn.inputs['Distance'].default_value = 0.01
    links.new(h.outputs[0], bn.inputs['Height'])
    # snow on stone tops: more near edges (attribute y) and on up-facing parts
    geo = nodes.new("ShaderNodeNewGeometry")
    sn = nodes.new("ShaderNodeSeparateXYZ"); links.new(geo.outputs['Normal'], sn.inputs[0])
    sn_n = nodes.new("ShaderNodeTexNoise"); sn_n.inputs['Scale'].default_value = 3.5
    sn_n.inputs['Detail'].default_value = 6
    links.new(tc.outputs['Generated'] if False else geo.outputs['Position'], sn_n.inputs['Vector'])
    add = nodes.new("ShaderNodeMath"); add.operation = 'ADD'
    links.new(sep.outputs[1], add.inputs[0]); links.new(sn_n.outputs['Fac'], add.inputs[1])
    mr = nodes.new("ShaderNodeMapRange")
    links.new(add.outputs[0], mr.inputs['Value'])
    mr.inputs['From Min'].default_value = 1.05; mr.inputs['From Max'].default_value = 1.25
    up = nodes.new("ShaderNodeMapRange")
    links.new(sn.outputs[2], up.inputs['Value'])
    up.inputs['From Min'].default_value = 0.55; up.inputs['From Max'].default_value = 0.8
    mul = nodes.new("ShaderNodeMath"); mul.operation = 'MULTIPLY'
    links.new(mr.outputs[0], mul.inputs[0]); links.new(up.outputs[0], mul.inputs[1])
    cmix = nodes.new("ShaderNodeMix"); cmix.data_type = 'RGBA'
    links.new(mul.outputs[0], cmix.inputs['Factor'])
    links.new(ramp.outputs[0], cmix.inputs[6])
    cmix.inputs[7].default_value = (0.85, 0.88, 0.95, 1)
    links.new(cmix.outputs[2], b.inputs['Base Color'])
    links.new(bn.outputs[0], b.inputs['Normal'])
    rr = nodes.new("ShaderNodeMapRange")
    links.new(mul.outputs[0], rr.inputs['Value'])
    rr.inputs['To Min'].default_value = 0.5; rr.inputs['To Max'].default_value = 0.65
    links.new(rr.outputs[0], b.inputs['Roughness'])
    sss = nodes.new("ShaderNodeMath"); sss.operation = 'MULTIPLY_ADD'
    links.new(mul.outputs[0], sss.inputs[0]); sss.inputs[1].default_value = 0.4
    sss.inputs[2].default_value = 0.05
    links.new(sss.outputs[0], b.inputs['Subsurface Weight'])
    b.inputs['Subsurface Radius'].default_value = (0.7, 0.8, 1.0)
    b.inputs['Subsurface Scale'].default_value = 0.02
    b.inputs['Coat Weight'].default_value = 0.15  # faint wet sheen
    b.inputs['Coat Roughness'].default_value = 0.3
    lib.tag(m, "cobble", P.srgb('#857467'), 0.55)
    lib._mats["Cobble"] = m
    return m


def _pebble_template():
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    verts = [v.co.copy() for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


def cobbles():
    """Domed, loaf-shaped stones laid in loose courses across the street."""
    tv, tf = _pebble_template()
    me = bpy.data.meshes.new("Cobbles")
    all_v, all_f, attr = [], [], []
    x = -13.5
    course = 0
    while x < 24.5:
        L = RNG.uniform(0.27, 0.36)  # course depth along x
        a, b = e_far(x) - 0.05, e_near(x) + 0.08
        width = b - a
        y = a + (RNG.uniform(0, 0.3) if course % 2 else 0)
        while y < b:
            w = RNG.uniform(0.24, 0.38)
            cx = x + L / 2 + RNG.uniform(-0.03, 0.03)
            cy = y + w / 2 + RNG.uniform(-0.02, 0.02)
            ed = min(cy - a, b - cy)  # distance to edge
            # ragged edges: drop some stones near the boundary (snow covers)
            if ed < 0.25 and RNG.random() < 0.45:
                y += w
                continue
            sx, sy = L * 0.46, w * 0.45
            sz = RNG.uniform(0.07, 0.11)
            rot = RNG.uniform(-0.18, 0.18)
            cz = RNG.uniform(-0.035, 0.0) + 0.02 * noise.noise(Vector((cx * 0.5, cy * 0.5, 9)))
            seed = Vector((RNG.random() * 50, RNG.random() * 50, RNG.random() * 50))
            base = len(all_v)
            cr, sr = math.cos(rot), math.sin(rot)
            col = RNG.random()
            edge_amt = 1.0 - min(1.0, ed / 1.2)
            for v in tv:
                lump = 1 + 0.18 * noise.noise(v * 1.3 + seed)
                px, py, pz = v.x * sx * lump, v.y * sy * lump, v.z
                # flatten the underside, dome the top
                pz = (pz * sz) if pz > 0 else pz * 0.04
                # soft shoulders: squarer in plan than a sphere
                k = 1.0 + 0.25 * (1 - abs(v.z))
                px *= k; py *= k
                all_v.append((cx + px * cr - py * sr, cy + px * sr + py * cr, cz + pz))
                attr.append((col, edge_amt, 0))
            for f in tf:
                all_f.append([base + i for i in f])
            y += w + RNG.uniform(0.005, 0.03)
        x += L + RNG.uniform(0.005, 0.025)
        course += 1
    me.from_pydata(all_v, [], all_f)
    a = me.attributes.new("cobble", 'FLOAT_VECTOR', 'POINT')
    for i, val in enumerate(attr):
        a.data[i].vector = val
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new("Cobbles", me)
    obj.data.materials.append(stone_mat())
    lib.link(obj)
    print("cobbles:", len(all_v) // len(tv))
    return obj


def edge_lumps():
    """Crusty snow lumps along both street edges and building bases, so the
    boundary between stone and snow is soft and irregular."""
    sn = snow("GroundSnow")
    out = []
    x = -13.0
    while x < 24:
        for edge, side in ((e_near, 1), (e_far, -1)):
            y0 = edge(x)
            if RNG.random() < 0.75:
                r = RNG.uniform(0.12, 0.28)
                y = y0 + side * RNG.uniform(-0.05, 0.25)
                z = ground_height(x, y + side * 0.2) * 0.6
                out.append(lib.blob("edgelump", (x + RNG.uniform(-0.1, 0.1), y, z), r, sn,
                                    squash=(1.6, 1.1, 0.55), subd=3, lump=0.35))
        x += RNG.uniform(0.22, 0.45)
    # building bases: drifts against the walls
    for (x0, x1, y) in ((-2.75, 2.75, -0.05), (3.8, 8.1, 0.35)):
        x = x0
        while x < x1:
            if not (-0.8 < x < 0.8) and not (6.6 < x < 7.75):  # keep doorways clear
                r = RNG.uniform(0.14, 0.26)
                out.append(lib.blob("walldrift", (x, y - r * 0.4, 0.05), r, sn, squash=(1.5, 1.0, 0.8),
                                    subd=3, lump=0.35))
            x += RNG.uniform(0.2, 0.35)
    j = lib.join(out, "SnowEdges")
    return j
