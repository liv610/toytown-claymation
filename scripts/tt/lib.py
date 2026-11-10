"""Shared helpers: scene reset, collections, clay-style geometry, materials.

Design rule for everything in this project: nothing is perfectly straight.
Geometry gets soft bevels plus a low-frequency world-space wobble, and every
material carries hand-pressed variation (dimples, smudges, uneven paint).
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

RNG = random.Random(1225)  # deterministic: same scene every run


# --------------------------------------------------------------------------
# scene / collections
# --------------------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.unit_settings.system = 'METRIC'
    return scn


_colls = {}


def coll(name):
    if name not in _colls:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
        _colls[name] = c
    return _colls[name]


def link(obj, collection="Set"):
    coll(collection).objects.link(obj)
    return obj


def mesh_obj(name, bm, mat=None, collection="Set", smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    if mat is not None:
        if isinstance(mat, (list, tuple)):
            for m in mat:
                me.materials.append(m)
        else:
            me.materials.append(mat)
    return link(obj, collection)


# --------------------------------------------------------------------------
# "clay" modifier stack: subdivide flat faces, round edges, wobble everything
# --------------------------------------------------------------------------
_wobble_tex = None


def wobble_tex():
    global _wobble_tex
    if _wobble_tex is None:
        t = bpy.data.textures.new("ClayWobble", 'CLOUDS')
        t.noise_scale = 1.6
        t.noise_depth = 1
        t.noise_basis = 'ORIGINAL_PERLIN'
        _wobble_tex = t
    return _wobble_tex


_lump_tex = None


def lump_tex():
    global _lump_tex
    if _lump_tex is None:
        t = bpy.data.textures.new("SnowLump", 'CLOUDS')
        t.noise_scale = 0.55
        t.noise_depth = 2
        _lump_tex = t
    return _lump_tex


_crust_tex = None


def crust_tex():
    global _crust_tex
    if _crust_tex is None:
        t = bpy.data.textures.new("SnowCrust", 'VORONOI')
        t.noise_scale = 0.16
        t.distance_metric = 'DISTANCE'
        t.weight_1 = 1.0
        t.weight_2 = 0.0
        t.noise_intensity = 1.0
        _crust_tex = t
    return _crust_tex


def clay_mods(obj, bevel=0.04, segs=3, subd=2, wobble=0.025, smooth_subd=0,
              tex=None):
    """Simple-subdivide -> bevel -> catmull smoothing (opt) -> displace."""
    if subd:
        m = obj.modifiers.new("dice", 'SUBSURF')
        m.subdivision_type = 'SIMPLE'
        m.levels = m.render_levels = subd
    if bevel:
        m = obj.modifiers.new("soften", 'BEVEL')
        m.width = bevel
        m.segments = segs
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(40)
        m.harden_normals = False
    if smooth_subd:
        m = obj.modifiers.new("smooth", 'SUBSURF')
        m.levels = m.render_levels = smooth_subd
    if wobble:
        m = obj.modifiers.new("wobble", 'DISPLACE')
        m.texture = tex or wobble_tex()
        m.texture_coords = 'GLOBAL'
        m.strength = wobble
        m.mid_level = 0.5
    return obj


def box_bm(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return bm


def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.03, segs=3, subd=2,
        wobble=0.015, collection="Set", smooth_subd=0, tex=None):
    bm = box_bm(*size)
    obj = mesh_obj(name, bm, mat, collection)
    obj.location = loc
    obj.rotation_euler = rot
    bev = min(bevel, min(size) * 0.45)
    clay_mods(obj, bev, segs, subd, wobble, smooth_subd, tex)
    return obj


def prism_bm(profile, depth, axis='Y'):
    """Extrude a closed 2D profile (list of (u, v)) along an axis.
    For axis 'Y': u -> X, v -> Z, extruded from y=0 to y=depth."""
    bm = bmesh.new()
    def P(u, v, d):
        if axis == 'Y':
            return (u, d, v)
        if axis == 'X':
            return (d, u, v)
        return (u, v, d)
    front = [bm.verts.new(P(u, v, 0)) for u, v in profile]
    back = [bm.verts.new(P(u, v, depth)) for u, v in profile]
    n = len(profile)
    bm.faces.new(front[::-1] if axis != 'X' else front)
    bm.faces.new(back if axis != 'X' else back[::-1])
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((front[i], front[j], back[j], back[i]))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def prism(name, profile, depth, loc, mat, axis='Y', rot=(0, 0, 0), bevel=0.03,
          segs=3, subd=3, wobble=0.015, collection="Set"):
    obj = mesh_obj(name, prism_bm(profile, depth, axis), mat, collection)
    obj.location = loc
    obj.rotation_euler = rot
    clay_mods(obj, bevel, segs, subd, wobble)
    return obj


def lathe_bm(profile, segs=32, wob=0.0, seed=0):
    """Revolve (r, z) profile around Z. Optional organic radius wobble."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = r * (1 + wob * noise.noise(Vector((math.cos(a) * 1.3, math.sin(a) * 1.3, z * 2 + seed))))
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    # caps
    if profile[0][0] > 1e-4:
        bm.faces.new(rings[0][::-1])
    if profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def lathe(name, profile, loc, mat, segs=32, wob=0.0, collection="Set",
          smooth_subd=1, wobble=0.0):
    obj = mesh_obj(name, lathe_bm(profile, segs, wob, RNG.random() * 10), mat, collection)
    obj.location = loc
    if smooth_subd:
        m = obj.modifiers.new("smooth", 'SUBSURF')
        m.levels = m.render_levels = smooth_subd
    if wobble:
        clay_mods(obj, 0, 0, 0, wobble)
    return obj


def blob(name, loc, radius, mat, squash=(1, 1, 1), subd=3, lump=0.15,
         collection="Set", seed=None, rot=(0, 0, 0)):
    """Organic lump: icosphere, squashed, lumped with noise."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subd, radius=radius)
    s = RNG.random() * 100 if seed is None else seed
    for v in bm.verts:
        n = noise.noise(v.co * (1.6 / max(radius, 0.05)) + Vector((s, s, s)))
        v.co *= 1 + lump * n
        v.co.x *= squash[0]
        v.co.y *= squash[1]
        v.co.z *= squash[2]
    obj = mesh_obj(name, bm, mat, collection)
    obj.location = loc
    obj.rotation_euler = rot
    return obj


def join(objs, name):
    """Join a list of objects (modifiers applied) into one mesh object."""
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        offs = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            offs.append(mats.index(m))
        for p in me.polygons:
            if offs:
                p.material_index = offs[p.material_index]
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for o in objs:
        bpy.data.objects.remove(o)
    obj = mesh_obj(name, bm, None, "Set")
    for m in mats:
        obj.data.materials.append(m)
    return obj


def text_obj(name, body, loc, size, mat, extrude=0.015, rot=(math.pi / 2, 0, 0),
             collection="Set"):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = extrude * 0.6
    cu.bevel_resolution = 3
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, cu)
    obj.data.materials.append(mat)
    obj.location = loc
    obj.rotation_euler = rot
    return link(obj, collection)


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------
def tag(mat, kind, color, rough, metallic=0.0, emit=None, emit_strength=0.0, color2=None):
    """Real-time metadata: what a browser material should approximate."""
    mat["rt_kind"] = kind
    mat["rt_color"] = list(color)[:3]
    mat["rt_rough"] = float(rough)
    mat["rt_metal"] = float(metallic)
    if emit:
        mat["rt_emit"] = list(emit)[:3]
        mat["rt_emit_strength"] = float(emit_strength)
    if color2:
        mat["rt_color2"] = list(color2)[:3]


def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links


def _bsdf(nodes, links, out_loc=(600, 0)):
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = out_loc
    b = nodes.new("ShaderNodeBsdfPrincipled")
    b.location = (300, 0)
    links.new(b.outputs[0], out.inputs[0])
    return b, out


def _hsv_shift(nodes, links, color_socket, val_amt, fac_socket):
    """Return a socket: color with value shifted by (fac-0.5)*val_amt."""
    hsv = nodes.new("ShaderNodeHueSaturation")
    m = nodes.new("ShaderNodeMath")
    m.operation = 'MULTIPLY_ADD'
    links.new(fac_socket, m.inputs[0])
    m.inputs[1].default_value = val_amt
    m.inputs[2].default_value = 1 - val_amt * 0.5
    links.new(m.outputs[0], hsv.inputs['Value'])
    links.new(color_socket, hsv.inputs['Color'])
    return hsv.outputs[0]


_mats = {}


def clay(name, color, rough=0.62, sss=0.12, dimple=1.0, grain=0.4,
         dimple_scale=3.5, var=0.16, sheen=0.25, bump=0.35, coords='Object',
         hue_var=0.015, emission=None, metallic=0.0, coat=0.0, stucco=0.0, wear=0.35):
    """Painted / raw clay. Hand-pressed: large soft dimples (thumb presses),
    slow colour drift, faint smears and very fine grain. Not uniform noise."""
    key = name
    if key in _mats:
        return _mats[key]
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    b, out = _bsdf(nodes, links)
    tc = nodes.new("ShaderNodeTexCoord")
    tc.location = (-1200, 0)
    co = tc.outputs[coords]

    # slow colour drift (uneven paint / hand mixed clay)
    drift = nodes.new("ShaderNodeTexNoise")
    drift.inputs['Scale'].default_value = 0.9
    drift.inputs['Detail'].default_value = 2.0
    drift.inputs['Roughness'].default_value = 0.4
    links.new(co, drift.inputs['Vector'])

    rgb = nodes.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = (*color, 1)
    col = _hsv_shift(nodes, links, rgb.outputs[0], var, drift.outputs['Fac'])
    if hue_var:
        hs = nodes.new("ShaderNodeHueSaturation")
        mh = nodes.new("ShaderNodeMath")
        mh.operation = 'MULTIPLY_ADD'
        links.new(drift.outputs['Color'], mh.inputs[0])  # uses R channel via implicit conv
        mh.inputs[1].default_value = hue_var * 2
        mh.inputs[2].default_value = 0.5 - hue_var
        links.new(mh.outputs[0], hs.inputs['Hue'])
        links.new(col, hs.inputs['Color'])
        col = hs.outputs[0]

    # thumb-press dimples: smooth voronoi F1 distance gives shallow cups
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.feature = 'SMOOTH_F1'
    vor.inputs['Scale'].default_value = dimple_scale
    vor.inputs['Smoothness'].default_value = 1.0
    vor.inputs['Randomness'].default_value = 1.0
    # distort the coordinates so the dimples are not on a cell grid
    warp = nodes.new("ShaderNodeTexNoise")
    warp.inputs['Scale'].default_value = 1.2
    mix_v = nodes.new("ShaderNodeVectorMath")
    mix_v.operation = 'MULTIPLY_ADD'
    links.new(warp.outputs['Color'], mix_v.inputs[0])
    mix_v.inputs[1].default_value = (0.35, 0.35, 0.35)
    links.new(co, mix_v.inputs[2])
    links.new(co, warp.inputs['Vector'])
    links.new(mix_v.outputs[0], vor.inputs['Vector'])

    # smears: stretched noise (tool drag marks)
    smear_map = nodes.new("ShaderNodeMapping")
    smear_map.inputs['Scale'].default_value = (1.0, 7.0, 2.5)
    smear_map.inputs['Rotation'].default_value = (0.3, 0.0, 0.7)
    links.new(co, smear_map.inputs['Vector'])
    smear = nodes.new("ShaderNodeTexNoise")
    smear.inputs['Scale'].default_value = 5.0
    smear.inputs['Detail'].default_value = 3.0
    links.new(smear_map.outputs[0], smear.inputs['Vector'])

    # fine grain
    fine = nodes.new("ShaderNodeTexNoise")
    fine.inputs['Scale'].default_value = 90.0
    fine.inputs['Detail'].default_value = 4.0
    links.new(co, fine.inputs['Vector'])

    h = nodes.new("ShaderNodeMath"); h.operation = 'MULTIPLY_ADD'
    links.new(vor.outputs['Distance'], h.inputs[0]); h.inputs[1].default_value = dimple
    h2 = nodes.new("ShaderNodeMath"); h2.operation = 'MULTIPLY'
    links.new(smear.outputs['Fac'], h2.inputs[0]); h2.inputs[1].default_value = 0.45
    links.new(h2.outputs[0], h.inputs[2])
    h3 = nodes.new("ShaderNodeMath"); h3.operation = 'MULTIPLY_ADD'
    links.new(fine.outputs['Fac'], h3.inputs[0]); h3.inputs[1].default_value = grain * 0.25
    links.new(h.outputs[0], h3.inputs[2])

    hfinal = h3.outputs[0]
    if stucco:
        # crumbly troweled plaster: ridged high-detail noise + fine cracks
        stn = nodes.new("ShaderNodeTexNoise")
        stn.inputs['Scale'].default_value = 7.0
        stn.inputs['Detail'].default_value = 12.0
        stn.inputs['Roughness'].default_value = 0.72
        stn.inputs['Distortion'].default_value = 0.4
        links.new(co, stn.inputs['Vector'])
        crk = nodes.new("ShaderNodeTexVoronoi")
        crk.feature = 'DISTANCE_TO_EDGE'
        crk.inputs['Scale'].default_value = 3.0
        links.new(mix_v.outputs[0], crk.inputs['Vector'])
        crm = nodes.new("ShaderNodeMapRange")
        links.new(crk.outputs['Distance'], crm.inputs['Value'])
        crm.inputs['From Max'].default_value = 0.035
        sa = nodes.new("ShaderNodeMath"); sa.operation = 'MULTIPLY_ADD'
        links.new(stn.outputs['Fac'], sa.inputs[0]); sa.inputs[1].default_value = stucco * 1.6
        links.new(hfinal, sa.inputs[2])
        sb = nodes.new("ShaderNodeMath"); sb.operation = 'MULTIPLY_ADD'
        links.new(crm.outputs[0], sb.inputs[0]); sb.inputs[1].default_value = stucco * 0.35
        links.new(sa.outputs[0], sb.inputs[2])
        hfinal = sb.outputs[0]
    bn = nodes.new("ShaderNodeBump")
    bn.inputs['Strength'].default_value = min(1.0, bump * 1.2)
    bn.inputs['Distance'].default_value = 0.09 if stucco else 0.05
    links.new(hfinal, bn.inputs['Height'])
    links.new(bn.outputs[0], b.inputs['Normal'])

    # roughness varies a little (handled / polished spots)
    rr = nodes.new("ShaderNodeMapRange")
    links.new(smear.outputs['Fac'], rr.inputs['Value'])
    rr.inputs['To Min'].default_value = rough - 0.08
    rr.inputs['To Max'].default_value = rough + 0.08
    links.new(rr.outputs[0], b.inputs['Roughness'])

    # very slight darkening in dimples = finger-pressed shading
    dark = nodes.new("ShaderNodeMix"); dark.data_type = 'RGBA'; dark.blend_type = 'MULTIPLY'
    mr = nodes.new("ShaderNodeMapRange")
    links.new(vor.outputs['Distance'], mr.inputs['Value'])
    mr.inputs['From Max'].default_value = 0.5
    mr.inputs['To Min'].default_value = 0.12
    mr.inputs['To Max'].default_value = 0.0
    links.new(mr.outputs[0], dark.inputs['Factor'])
    links.new(col, dark.inputs[6])
    dark.inputs[7].default_value = (0.75, 0.72, 0.75, 1)
    # edge wear: convex edges catch a lighter, rubbed tone (handled clay / worn paint)
    geo = nodes.new("ShaderNodeNewGeometry")
    pe = nodes.new("ShaderNodeMapRange")
    links.new(geo.outputs['Pointiness'], pe.inputs['Value'])
    pe.inputs['From Min'].default_value = 0.52
    pe.inputs['From Max'].default_value = 0.62
    pe.inputs['To Max'].default_value = wear
    wear = nodes.new("ShaderNodeMix"); wear.data_type = 'RGBA'; wear.blend_type = 'SCREEN'
    links.new(pe.outputs[0], wear.inputs['Factor'])
    links.new(dark.outputs[2], wear.inputs[6])
    wear.inputs[7].default_value = (0.55, 0.5, 0.45, 1)
    # cavities collect darker grime (AO)
    ao = nodes.new("ShaderNodeAmbientOcclusion"); ao.samples = 6
    ao.inputs['Distance'].default_value = 0.25
    links.new(wear.outputs[2], ao.inputs['Color'])
    grime = nodes.new("ShaderNodeMix"); grime.data_type = 'RGBA'; grime.blend_type = 'MULTIPLY'
    aom = nodes.new("ShaderNodeMapRange")
    links.new(ao.outputs['AO'], aom.inputs['Value'])
    aom.inputs['To Min'].default_value = 0.55; aom.inputs['To Max'].default_value = 0.0
    links.new(aom.outputs[0], grime.inputs['Factor'])
    links.new(wear.outputs[2], grime.inputs[6])
    grime.inputs[7].default_value = (0.45, 0.32, 0.25, 1)
    links.new(grime.outputs[2], b.inputs['Base Color'])

    b.inputs['Subsurface Weight'].default_value = sss
    b.inputs['Subsurface Radius'].default_value = (1.0, 0.45, 0.25)
    b.inputs['Subsurface Scale'].default_value = 0.03
    b.inputs['Sheen Weight'].default_value = sheen
    b.inputs['Sheen Roughness'].default_value = 0.6
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = 0.25
    if emission:
        b.inputs['Emission Color'].default_value = (*emission[0], 1)
        b.inputs['Emission Strength'].default_value = emission[1]
    tag(mat, "clay", color, rough, metallic=metallic)
    _mats[key] = mat
    return mat


def snow(name="Snow", tint=(0.93, 0.91, 0.88), sss=0.55, packed=False):
    """Soft sculpted snow: strong subsurface, blue in crevices, sparkle."""
    if name in _mats:
        return _mats[name]
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    b, out = _bsdf(nodes, links)
    tc = nodes.new("ShaderNodeTexCoord")
    co = tc.outputs['Object']

    ao = nodes.new("ShaderNodeAmbientOcclusion")
    ao.inputs['Distance'].default_value = 0.6
    ao.samples = 8
    crev = nodes.new("ShaderNodeMix"); crev.data_type = 'RGBA'
    pw = nodes.new("ShaderNodeMath"); pw.operation = 'POWER'
    links.new(ao.outputs['AO'], pw.inputs[0]); pw.inputs[1].default_value = 1.6
    links.new(pw.outputs[0], crev.inputs['Factor'])
    crev.inputs[6].default_value = (0.42, 0.55, 0.85, 1)  # crevice blue
    crev.inputs[7].default_value = (*tint, 1)

    drift = nodes.new("ShaderNodeTexNoise")
    drift.inputs['Scale'].default_value = 1.4
    links.new(co, drift.inputs['Vector'])
    colv = _hsv_shift(nodes, links, crev.outputs[2], 0.08, drift.outputs['Fac'])
    if packed:
        dirty = nodes.new("ShaderNodeMix"); dirty.data_type = 'RGBA'
        n2 = nodes.new("ShaderNodeTexNoise"); n2.inputs['Scale'].default_value = 3.0
        n2.inputs['Detail'].default_value = 6
        links.new(co, n2.inputs['Vector'])
        r = nodes.new("ShaderNodeMapRange")
        links.new(n2.outputs['Fac'], r.inputs['Value'])
        r.inputs['From Min'].default_value = 0.45; r.inputs['From Max'].default_value = 0.7
        r.inputs['To Max'].default_value = 0.35
        links.new(r.outputs[0], dirty.inputs['Factor'])
        links.new(colv, dirty.inputs[6])
        dirty.inputs[7].default_value = (0.55, 0.55, 0.6, 1)
        colv = dirty.outputs[2]
    links.new(colv, b.inputs['Base Color'])

    # lumpy soft bump + tiny crystalline sparkle
    lump = nodes.new("ShaderNodeTexNoise")
    lump.inputs['Scale'].default_value = 6.0
    lump.inputs['Detail'].default_value = 3.0
    links.new(co, lump.inputs['Vector'])
    spark = nodes.new("ShaderNodeTexVoronoi")
    spark.inputs['Scale'].default_value = 260.0
    links.new(co, spark.inputs['Vector'])
    hm = nodes.new("ShaderNodeMath"); hm.operation = 'MULTIPLY_ADD'
    links.new(spark.outputs['Distance'], hm.inputs[0]); hm.inputs[1].default_value = 0.08
    links.new(lump.outputs['Fac'], hm.inputs[2])
    # crusty 'curds': inverted smooth voronoi = packed rounded granules
    curd = nodes.new("ShaderNodeTexVoronoi"); curd.feature = 'SMOOTH_F1'
    curd.inputs['Scale'].default_value = 11.0
    curd.inputs['Smoothness'].default_value = 0.6
    cw = nodes.new("ShaderNodeTexNoise"); cw.inputs['Scale'].default_value = 3.0
    links.new(co, cw.inputs['Vector'])
    cwv = nodes.new("ShaderNodeVectorMath"); cwv.operation = 'MULTIPLY_ADD'
    links.new(cw.outputs['Color'], cwv.inputs[0]); cwv.inputs[1].default_value = (0.25, 0.25, 0.25)
    links.new(co, cwv.inputs[2])
    links.new(cwv.outputs[0], curd.inputs['Vector'])
    curd2 = nodes.new("ShaderNodeTexVoronoi"); curd2.feature = 'SMOOTH_F1'
    curd2.inputs['Scale'].default_value = 34.0
    links.new(cwv.outputs[0], curd2.inputs['Vector'])
    ci = nodes.new("ShaderNodeMath"); ci.operation = 'MULTIPLY_ADD'
    links.new(curd.outputs['Distance'], ci.inputs[0]); ci.inputs[1].default_value = -1.2
    links.new(hm.outputs[0], ci.inputs[2])
    ci2 = nodes.new("ShaderNodeMath"); ci2.operation = 'MULTIPLY_ADD'
    links.new(curd2.outputs['Distance'], ci2.inputs[0]); ci2.inputs[1].default_value = -0.45
    links.new(ci.outputs[0], ci2.inputs[2])
    hm = ci2
    bn = nodes.new("ShaderNodeBump")
    bn.inputs['Strength'].default_value = 0.9
    bn.inputs['Distance'].default_value = 0.12
    links.new(hm.outputs[0], bn.inputs['Height'])
    links.new(bn.outputs[0], b.inputs['Normal'])

    # sparkle = rare cells get a glossy coat
    sp_mask = nodes.new("ShaderNodeMapRange")
    sp_r = nodes.new("ShaderNodeTexWhiteNoise")
    sp_r.noise_dimensions = '3D'
    sp_map = nodes.new("ShaderNodeMapping"); sp_map.inputs['Scale'].default_value = (180, 180, 180)
    links.new(co, sp_map.inputs['Vector']); links.new(sp_map.outputs[0], sp_r.inputs['Vector'])
    links.new(sp_r.outputs['Value'], sp_mask.inputs['Value'])
    sp_mask.inputs['From Min'].default_value = 0.985
    sp_mask.inputs['From Max'].default_value = 0.99
    links.new(sp_mask.outputs[0], b.inputs['Coat Weight'])
    b.inputs['Coat Roughness'].default_value = 0.02
    b.inputs['Coat IOR'].default_value = 1.8

    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Subsurface Weight'].default_value = sss
    b.inputs['Subsurface Radius'].default_value = (0.7, 0.85, 1.0)
    b.inputs['Subsurface Scale'].default_value = 0.06
    b.inputs['Sheen Weight'].default_value = 0.4
    b.inputs['Sheen Tint'].default_value = (0.8, 0.9, 1.0, 1)
    tag(mat, "snow", tint, 0.6)
    _mats[name] = mat
    return mat


def window_glow(name="WindowGlow", color=(1.0, 0.58, 0.24), strength=5.0,
                frost=True):
    """Warm lit window: uneven interior glow, frosted corners."""
    if name in _mats:
        return _mats[name]
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    b, out = _bsdf(nodes, links)
    tc = nodes.new("ShaderNodeTexCoord")
    gen = tc.outputs['Generated']
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(gen, sep.inputs[0])
    # interior gradient: brighter low-centre (lamp inside), warm->amber
    n = nodes.new("ShaderNodeTexNoise")
    n.inputs['Scale'].default_value = 2.5
    links.new(tc.outputs['Object'], n.inputs['Vector'])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.8, 0.22, 0.04, 1)
    ramp.color_ramp.elements[1].color = (1.0, 0.55, 0.16, 1)
    ramp.color_ramp.elements[1].position = 0.75
    m = nodes.new("ShaderNodeMath"); m.operation = 'MULTIPLY_ADD'
    links.new(n.outputs['Fac'], m.inputs[0]); m.inputs[1].default_value = 0.8
    m.inputs[2].default_value = 0.1
    links.new(m.outputs[0], ramp.inputs[0])
    em_col = ramp.outputs[0]

    if frost:
        # distance from pane centre in generated space -> frost at corners
        vm = nodes.new("ShaderNodeVectorMath"); vm.operation = 'SUBTRACT'
        links.new(gen, vm.inputs[0]); vm.inputs[1].default_value = (0.5, 0.5, 0.5)
        ab = nodes.new("ShaderNodeVectorMath"); ab.operation = 'ABSOLUTE'
        links.new(vm.outputs[0], ab.inputs[0])
        s2 = nodes.new("ShaderNodeSeparateXYZ"); links.new(ab.outputs[0], s2.inputs[0])
        mx = nodes.new("ShaderNodeMath"); mx.operation = 'ADD'
        links.new(s2.outputs[0], mx.inputs[0]); links.new(s2.outputs[2], mx.inputs[1])
        mx2 = nodes.new("ShaderNodeMath"); mx2.operation = 'ADD'
        links.new(mx.outputs[0], mx2.inputs[0]); mx2.inputs[1].default_value = 0.0
        fn = nodes.new("ShaderNodeTexNoise"); fn.inputs['Scale'].default_value = 14
        fn.inputs['Detail'].default_value = 8
        links.new(tc.outputs['Object'], fn.inputs['Vector'])
        fa = nodes.new("ShaderNodeMath"); fa.operation = 'MULTIPLY_ADD'
        links.new(fn.outputs['Fac'], fa.inputs[0]); fa.inputs[1].default_value = 0.35
        links.new(mx2.outputs[0], fa.inputs[2])
        fr = nodes.new("ShaderNodeMapRange")
        links.new(fa.outputs[0], fr.inputs['Value'])
        fr.inputs['From Min'].default_value = 0.74
        fr.inputs['From Max'].default_value = 0.98
        mixc = nodes.new("ShaderNodeMix"); mixc.data_type = 'RGBA'
        links.new(fr.outputs[0], mixc.inputs['Factor'])
        links.new(em_col, mixc.inputs[6])
        mixc.inputs[7].default_value = (0.9, 0.93, 1.0, 1)
        links.new(mixc.outputs[2], b.inputs['Base Color'])
        inv = nodes.new("ShaderNodeMath"); inv.operation = 'SUBTRACT'
        inv.inputs[0].default_value = 1.0
        links.new(fr.outputs[0], inv.inputs[1])
        es = nodes.new("ShaderNodeMath"); es.operation = 'MULTIPLY'
        links.new(inv.outputs[0], es.inputs[0]); es.inputs[1].default_value = strength
        links.new(es.outputs[0], b.inputs['Emission Strength'])
        rr = nodes.new("ShaderNodeMapRange")
        links.new(fr.outputs[0], rr.inputs['Value'])
        rr.inputs['To Min'].default_value = 0.08; rr.inputs['To Max'].default_value = 0.6
        links.new(rr.outputs[0], b.inputs['Roughness'])
    else:
        links.new(em_col, b.inputs['Base Color'])
        b.inputs['Emission Strength'].default_value = strength
        b.inputs['Roughness'].default_value = 0.1
    links.new(em_col, b.inputs['Emission Color'])
    b.inputs['Coat Weight'].default_value = 0.6
    b.inputs['Coat Roughness'].default_value = 0.05
    tag(mat, "glow", (1.0, 0.55, 0.16), 0.2, emit=(1.0, 0.55, 0.16), emit_strength=strength)
    _mats[name] = mat
    return mat


def emissive(name, color, strength):
    if name in _mats:
        return _mats[name]
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    b, out = _bsdf(nodes, links)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Coat Weight'].default_value = 0.5
    tag(mat, "emissive", color, 0.3, emit=color, emit_strength=strength)
    _mats[name] = mat
    return mat


def awning_fabric(name="Awning", c1=(0.07, 0.30, 0.16), c2=(0.92, 0.88, 0.78),
                  stripe=0.32):
    """Painted canvas: stripes along X with soft wavering edges, weave bump."""
    if name in _mats:
        return _mats[name]
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    b, out = _bsdf(nodes, links)
    tc = nodes.new("ShaderNodeTexCoord")
    co = tc.outputs['Object']
    sep = nodes.new("ShaderNodeSeparateXYZ"); links.new(co, sep.inputs[0])
    wv = nodes.new("ShaderNodeTexNoise"); wv.inputs['Scale'].default_value = 4
    links.new(co, wv.inputs['Vector'])
    add = nodes.new("ShaderNodeMath"); add.operation = 'MULTIPLY_ADD'
    links.new(wv.outputs['Fac'], add.inputs[0]); add.inputs[1].default_value = 0.025
    links.new(sep.outputs[0], add.inputs[2])
    div = nodes.new("ShaderNodeMath"); div.operation = 'DIVIDE'
    links.new(add.outputs[0], div.inputs[0]); div.inputs[1].default_value = stripe
    fr = nodes.new("ShaderNodeMath"); fr.operation = 'PINGPONG'
    links.new(div.outputs[0], fr.inputs[0]); fr.inputs[1].default_value = 1.0
    st = nodes.new("ShaderNodeMapRange")
    links.new(fr.outputs[0], st.inputs['Value'])
    st.inputs['From Min'].default_value = 0.46; st.inputs['From Max'].default_value = 0.54
    mix = nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'
    links.new(st.outputs[0], mix.inputs['Factor'])
    c1n = nodes.new("ShaderNodeRGB"); c1n.outputs[0].default_value = (*c1, 1)
    c2n = nodes.new("ShaderNodeRGB"); c2n.outputs[0].default_value = (*c2, 1)
    dr = nodes.new("ShaderNodeTexNoise"); dr.inputs['Scale'].default_value = 1.5
    links.new(co, dr.inputs['Vector'])
    links.new(_hsv_shift(nodes, links, c1n.outputs[0], 0.2, dr.outputs['Fac']), mix.inputs[6])
    links.new(_hsv_shift(nodes, links, c2n.outputs[0], 0.12, dr.outputs['Fac']), mix.inputs[7])
    links.new(mix.outputs[2], b.inputs['Base Color'])
    # weave
    w1 = nodes.new("ShaderNodeTexWave"); w1.inputs['Scale'].default_value = 120
    w1.bands_direction = 'X'
    w2 = nodes.new("ShaderNodeTexWave"); w2.inputs['Scale'].default_value = 120
    w2.bands_direction = 'Z'
    links.new(co, w1.inputs['Vector']); links.new(co, w2.inputs['Vector'])
    ad = nodes.new("ShaderNodeMath"); ad.operation = 'ADD'
    links.new(w1.outputs['Fac'], ad.inputs[0]); links.new(w2.outputs['Fac'], ad.inputs[1])
    # cloth folds: low freq
    fold = nodes.new("ShaderNodeTexNoise"); fold.inputs['Scale'].default_value = 3
    links.new(co, fold.inputs['Vector'])
    ad2 = nodes.new("ShaderNodeMath"); ad2.operation = 'MULTIPLY_ADD'
    links.new(fold.outputs['Fac'], ad2.inputs[0]); ad2.inputs[1].default_value = 6
    links.new(ad.outputs[0], ad2.inputs[2])
    bn = nodes.new("ShaderNodeBump"); bn.inputs['Strength'].default_value = 0.12
    links.new(ad2.outputs[0], bn.inputs['Height'])
    links.new(bn.outputs[0], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.85
    b.inputs['Sheen Weight'].default_value = 0.6
    b.inputs['Subsurface Weight'].default_value = 0.05
    tag(mat, "fabric", c1, 0.85, color2=c2)
    _mats[name] = mat
    return mat


def wood(name, color=(0.36, 0.2, 0.1), painted=False, rough=0.6):
    """Hand-carved wood: grain via distorted wave, knife-cut facets."""
    if name in _mats:
        return _mats[name]
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    b, out = _bsdf(nodes, links)
    tc = nodes.new("ShaderNodeTexCoord")
    co = tc.outputs['Object']
    mp = nodes.new("ShaderNodeMapping"); mp.inputs['Scale'].default_value = (1, 1, 6)
    links.new(co, mp.inputs['Vector'])
    wv = nodes.new("ShaderNodeTexWave"); wv.inputs['Scale'].default_value = 3
    wv.inputs['Distortion'].default_value = 6
    wv.inputs['Detail'].default_value = 3
    wv.wave_profile = 'SAW'
    links.new(mp.outputs[0], wv.inputs['Vector'])
    base = nodes.new("ShaderNodeRGB"); base.outputs[0].default_value = (*color, 1)
    amt = 0.12 if painted else 0.45
    colv = _hsv_shift(nodes, links, base.outputs[0], amt, wv.outputs['Fac'])
    links.new(colv, b.inputs['Base Color'])
    vor = nodes.new("ShaderNodeTexVoronoi"); vor.inputs['Scale'].default_value = 7
    links.new(co, vor.inputs['Vector'])
    h = nodes.new("ShaderNodeMath"); h.operation = 'MULTIPLY_ADD'
    links.new(vor.outputs['Distance'], h.inputs[0]); h.inputs[1].default_value = 0.6
    links.new(wv.outputs['Fac'], h.inputs[2])
    brush = nodes.new("ShaderNodeTexNoise"); brush.inputs['Scale'].default_value = 14
    brush.inputs['Detail'].default_value = 8
    bm_ = nodes.new("ShaderNodeMapping"); bm_.inputs['Scale'].default_value = (1, 1, 10)
    links.new(co, bm_.inputs['Vector']); links.new(bm_.outputs[0], brush.inputs['Vector'])
    h2 = nodes.new("ShaderNodeMath"); h2.operation = 'MULTIPLY_ADD'
    links.new(brush.outputs['Fac'], h2.inputs[0]); h2.inputs[1].default_value = 0.8
    links.new(h.outputs[0], h2.inputs[2])
    bn = nodes.new("ShaderNodeBump"); bn.inputs['Strength'].default_value = 0.6 if painted else 0.8
    bn.inputs['Distance'].default_value = 0.04
    links.new(h2.outputs[0], bn.inputs['Height'])
    links.new(bn.outputs[0], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Sheen Weight'].default_value = 0.15
    tag(mat, "wood", color, rough)
    _mats[name] = mat
    return mat


def glossy_paint(name, color, rough=0.25, metallic=0.0):
    """Little painted ornaments, ribbons: clay with a varnish coat."""
    return clay(name, color, rough=rough, sss=0.05, dimple=0.4, grain=0.2,
                dimple_scale=12, var=0.1, sheen=0.0, bump=0.15,
                metallic=metallic, coat=0.6)


