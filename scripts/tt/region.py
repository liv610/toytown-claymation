"""The map-scale diorama around Toy Town (opt-in: only built by export_region.py).

Everything derives from tt.layout so the terrain, river, roads and railways agree:
  * land()      sculpted hills on a board that falls away to a finished edge
  * profiles    railway / road heights graded from the land (gentle, bridge clearance)
  * terrain     heightfield shaped by those profiles, painted per vertex
                (hand-picked field colours, hedge lines, snow on high and north faces)
  * objects     station, square, bridges, portals, farms, cottages, chapel
  * prototypes  a handful of hand-varied trees/bushes/rocks/posts/sleepers + instance lists
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, noise

from . import lib, layout as L, street, buildings, trees, props
from .lib import box, blob, clay, snow, wood, prism, lathe
from .buildings import snow_slab as _slab, window_glow, bg_house, root


def snow_slab(*a, **k):
    """Region snow: density by size, but never the village's per-roof maximum."""
    size = a[1] if len(a) > 1 else k["size"]
    big = max(size)
    k.setdefault("dice", 2 if big < 3 else (3 if big < 12 else 4))
    return _slab(*a, **k)
from . import palette as P

R = random.Random(2026)
COLL = "Region"


def sm(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def link(o):
    lib.link(o, COLL)
    return o


# ------------------------------------------------------------------ land
def land(x, y):
    n1 = noise.noise(Vector((x / 55, y / 55, 0.3)))
    n2 = noise.noise(Vector((x / 18, y / 18, 4.1)))
    n3 = noise.noise(Vector((x / 5.5, y / 5.5, 9.7)))
    h = 1.0 + 3.0 * n1 + 1.1 * n2 + 0.2 * n3
    h += 8.5 * sm(-5, 40, y) * (1 - sm(-60, -110, x) * 0.3) + 9.0 * sm(45, 120, y) * (0.85 + 0.3 * n1)
    h += 9.0 * sm(-85, -140, x) + 8.0 * sm(100, 155, x) + 2.0 * sm(-70, -120, y)
    # the board edge: the sculpted land eases down to a finished lip
    x0, x1, y0, y1 = L.BOARD
    e = min(x - x0, x1 - x, y - y0, y1 - y)
    f = sm(0.0, 18.0, e)
    return 0.6 + (h - 0.6) * f


def water_level(y):
    return -1.6 + 0.012 * y


# ------------------------------------------------------------------ profiles
def _graded(pts, z_start, start_fixed_len, grade, fixed=None):
    """Smooth the land along a path, then limit the grade; `fixed` = [(s0, s1, z)] holds."""
    s = [0.0]
    for a, b in zip(pts, pts[1:]):
        s.append(s[-1] + math.dist(a, b))
    raw = np.array([land(*p) for p in pts])
    # moving average ~30 m
    k = 30
    pad = np.pad(raw, k, mode='edge')
    sm_ = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode='same')[k:-k]
    z = sm_.copy()
    for i, si in enumerate(s):
        if si <= start_fixed_len:
            z[i] = z_start
    fixed = fixed or []
    for (a0, a1, zf) in fixed:
        for i, si in enumerate(s):
            if a0 <= si <= a1:
                z[i] = max(z[i], zf)
    hold = np.zeros(len(z), bool)
    for i, si in enumerate(s):
        if si <= start_fixed_len or any(a0 <= si <= a1 for a0, a1, _ in fixed):
            hold[i] = True
    # grade limit, both ways, holds stay put
    for _ in range(3):
        for i in range(1, len(z)):
            if not hold[i]:
                ds = s[i] - s[i - 1]
                z[i] = min(max(z[i], z[i - 1] - grade * ds), z[i - 1] + grade * ds)
        for i in range(len(z) - 2, -1, -1):
            if not hold[i]:
                ds = s[i + 1] - s[i]
                z[i] = min(max(z[i], z[i + 1] - grade * ds), z[i + 1] + grade * ds)
    return np.array(s), z


RAIL_Z = 0.0   # roadbed base level in the station (rail top ~0.47)
PROFILES = {}


def build_profiles():
    PROFILES.clear()
    for name, ctrl in L.ROUTES.items():
        pts = L.catmull(ctrl, 0.5)
        shed_len = 0.0
        for a, b in zip(pts, pts[1:]):
            if L.in_rect(b, L.SHED, pad=8.0):
                shed_len += math.dist(a, b)
            else:
                break
        fixed = []
        c = L.river_crossing(ctrl)
        if c:
            s = [0.0]
            for a, b in zip(pts, pts[1:]):
                s.append(s[-1] + math.dist(a, b))
            i = min(range(len(pts)), key=lambda k: math.dist(pts[k], c))
            fixed.append((s[i] - 13, s[i] + 13, water_level(c[1]) + 3.6))
        s, z = _graded(pts, RAIL_Z, shed_len, 0.025, fixed)
        PROFILES[name] = {"pts": pts, "s": s, "z": z, "crossing": c}
    for name, ctrl in L.ROADS.items():
        pts = L.catmull(ctrl, 0.5)
        fixed = []
        c = L.river_crossing(ctrl)
        s_ = [0.0]
        for a, b in zip(pts, pts[1:]):
            s_.append(s_[-1] + math.dist(a, b))
        if c:
            i = min(range(len(pts)), key=lambda k: math.dist(pts[k], c))
            fixed.append((s_[i] - 8, s_[i] + 8, water_level(c[1]) + 3.4))
        s, z = _graded(pts, 0.0, 0.0, 0.07, fixed)
        # inside the village the road lies on the hand-made ground
        for i, p in enumerate(pts):
            if L.in_rect(p, L.VILLAGE_GROUND, pad=-0.5):
                z[i] = street.ground_height(*p) + 0.02
        PROFILES["road_" + name] = {"pts": pts, "s": s, "z": z, "crossing": c}


# ------------------------------------------------------------------ distance fields (numpy)
def seg_field(X, Y, pts, zs=None):
    """For grid points: distance to polyline, parameter index, interpolated z, and whether
    the projection falls inside the polyline (not beyond its ends)."""
    P = np.array(pts)
    A, Bp = P[:-1], P[1:]
    best = np.full(X.shape, np.inf)
    bz = np.zeros(X.shape)
    inside = np.zeros(X.shape, bool)
    for i in range(len(A)):
        ax, ay = A[i]
        dx, dy = Bp[i] - A[i]
        L2 = dx * dx + dy * dy + 1e-12
        t = ((X - ax) * dx + (Y - ay) * dy) / L2
        tc = np.clip(t, 0, 1)
        d = np.hypot(X - (ax + dx * tc), Y - (ay + dy * tc))
        m = d < best
        best = np.where(m, d, best)
        if zs is not None:
            bz = np.where(m, zs[i] + (zs[i + 1] - zs[i]) * tc, bz)
        ins = ~(((i == 0) & (t < 0)) | ((i == len(A) - 1) & (t > 1)))
        inside = np.where(m, ins, inside)
    return best, bz, inside


# ------------------------------------------------------------------ terrain
STEP = 1.6


def terrain_heights():
    x0, x1, y0, y1 = L.BOARD
    xs = np.arange(x0, x1 + 1e-6, STEP)
    ys = np.arange(y0, y1 + 1e-6, STEP)
    X, Y = np.meshgrid(xs, ys)
    Hl = np.vectorize(land)(X, Y)
    # tunnel hills: raise the land over each portal
    for name, pr in PROFILES.items():
        if name.startswith("road_"):
            continue
        p1, p0 = np.array(pr["pts"][-1]), np.array(pr["pts"][-8])
        d = (p1 - p0) / np.linalg.norm(p1 - p0)
        c = p1 + d * 14
        need = pr["z"][-1] + 9.5
        bump = max(0.0, need - land(*c))
        Hl += bump * np.exp(-(((X - c[0]) ** 2 + (Y - c[1]) ** 2) / (2 * 15.0 ** 2)))
        pr["portal"] = (tuple(p1), tuple(d))
    Hm = Hl.copy()
    # flat civic zone: square, forecourt, station
    fx0, fx1, fy0, fy1 = -36.0, 48.0, -68.0, -32.0
    ddx = np.maximum(np.maximum(fx0 - X, X - fx1), 0)
    ddy = np.maximum(np.maximum(fy0 - Y, Y - fy1), 0)
    w = 1 - np.clip(np.hypot(ddx, ddy) / 12.0, 0, 1)
    w = w * w * (3 - 2 * w)
    Hm = Hm * (1 - w) + (-0.03) * w
    # farm pads
    for (sx, sy, kind, rot) in L.SITES.values():
        r = L.SITE_RADIUS[kind]
        zc = land(sx, sy)
        d = np.hypot(X - sx, Y - sy)
        w = 1 - np.clip((d - r) / 10.0, 0, 1)
        w = w * w * (3 - 2 * w)
        Hm = Hm * (1 - w) + zc * w
    # river
    river = L.catmull(L.RIVER, 1.0)
    dr, _, _ = seg_field(X, Y, river)
    wl = water_level(Y)
    bed = wl - 0.75
    tgt = bed + (np.maximum(Hm, wl + 0.45) - bed) * np.clip((dr - 2.6) / 8.0, 0, 1) ** 1.5
    Hm = np.where(dr < 11.0, tgt, Hm)
    # railway + road corridors: cut and fill to the graded profile
    for name, pr in PROFILES.items():
        road = name.startswith("road_")
        d, zp, ins = seg_field(X, Y, pr["pts"], pr["z"])
        half, fall = (2.4, 7.0) if road else (2.6, 9.0)
        base = zp - (0.05 if road else 0.38)
        w = 1 - np.clip((d - half) / fall, 0, 1)
        w = w * w * (3 - 2 * w)
        if not road:
            # leave the hill whole beyond the tunnel mouth
            w = np.where(ins, w, 0.0)
        # bridges carry the line over the water: never fill the channel
        w = w * np.clip((dr - 6.0) / 5.0, 0, 1)
        Hm = Hm * (1 - w) + base * w
    # the village keeps its own hand-made ground: tuck the terrain just under it and blend out
    vx0, vx1, vy0, vy1 = L.VILLAGE_GROUND
    cx = np.clip(X, vx0, vx1)
    cy = np.clip(Y, vy0, vy1)
    dv = np.hypot(X - cx, Y - cy)
    near = dv < 10.0
    G = np.zeros(X.shape)
    idx = np.argwhere(near)
    for (j, i) in idx:
        G[j, i] = street.ground_height(cx[j, i], cy[j, i])
    w = 1 - np.clip(dv / 10.0, 0, 1)
    w = w * w * (3 - 2 * w)
    inside = dv <= 0
    Hm = np.where(near, Hm * (1 - w) + (G - np.where(inside, 0.06, 0.0)) * w, Hm)
    return xs, ys, X, Y, Hm, dr, Hl


FIELD = [P.srgb(h) for h in ('#7a9a58', '#8fa862', '#c2a457', '#b8924a', '#a3b27a', '#6c8a52', '#b4b46a', '#cbb46c', '#93a46c')]


def terrain_colors(X, Y, Hm, dr):
    """Painted plaster: an irregular hand-laid patchwork of fields (warped Voronoi), broken
    hedgerows, earth banks, and snow that settles on the heights, the north faces and the town."""
    gy, gx = np.gradient(Hm, STEP)
    north_facing = np.clip(gy / 0.35, 0, 1)
    slope = np.hypot(gx, gy)
    dvill = np.hypot(X - 5.0, (Y + 8.0) * 1.15)
    nz = np.vectorize(lambda x, y, s, o: noise.noise(Vector((x / s, y / s, o))))
    n_snow = nz(X, Y, 13.0, 2.2) * 0.65 + nz(X, Y, 4.5, 6.1) * 0.35
    wx = nz(X, Y, 34.0, 7.7) * 16.0 + nz(X, Y, 11.0, 3.3) * 4.0
    wy = nz(X, Y, 34.0, 1.9) * 16.0 + nz(X, Y, 11.0, 8.8) * 4.0
    CELL = 36.0
    FX, FY = X + wx, Y + wy
    ci, cj = np.floor(FX / CELL), np.floor(FY / CELL)
    best = np.full(X.shape, 1e9); second = np.full(X.shape, 1e9); bid = np.zeros(X.shape)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ii, jj = ci + di, cj + dj
            hx = (np.sin(ii * 127.1 + jj * 311.7) * 43758.5453) % 1.0
            hy = (np.sin(ii * 269.5 + jj * 183.3) * 43758.5453) % 1.0
            sx, sy = (ii + 0.15 + 0.7 * hx) * CELL, (jj + 0.15 + 0.7 * hy) * CELL
            d = np.hypot(FX - sx, FY - sy)
            nb = d < best
            second = np.where(nb, best, np.minimum(second, d))
            bid = np.where(nb, ii * 57.0 + jj * 113.0, bid)
            best = np.where(nb, d, best)
    edge = second - best
    pal = np.array(FIELD)
    h = (np.sin(bid * 12.9898) * 43758.5453) % 1.0
    C = pal[(h * len(FIELD)).astype(int) % len(FIELD)].copy()
    ang = h * 6.283
    stripe = 1 + 0.05 * np.sin((X * np.cos(ang) + Y * np.sin(ang)) * 1.4) * (h > 0.45)
    tone = 0.92 + 0.16 * nz(X, Y, 22.0, 4.4)
    C *= (stripe * tone)[..., None]
    keep = ((np.sin(bid * 7.31) * 9137.1) % 1.0) > 0.35
    hedge = np.clip(1 - edge / 1.6, 0, 1) * keep * (nz(X, Y, 6.0, 5.5) > -0.25)
    C = C * (1 - hedge[..., None] * 0.75) + np.array(P.srgb('#4f6a3e')) * hedge[..., None] * 0.75
    earth = np.array(P.srgb('#7a5a3e'))
    wb = np.clip(1 - (dr - 3.2) / 2.6, 0, 1)[..., None]
    C = C * (1 - wb) + earth * wb
    # the town's snow feathers out from the village ground and the civic zone (no hard edge)
    vx0, vx1, vy0, vy1 = L.VILLAGE_GROUND
    drect = np.hypot(np.maximum(np.maximum(vx0 - X, X - vx1), 0), np.maximum(np.maximum(-68.0 - Y, Y - vy1), 0))
    town = np.clip(1 - (drect - 4 + 10 * nz(X, Y, 9.0, 1.1)) / 38, 0, 1)
    snow_amt = (0.95 * town + 0.38 * np.clip((Hm - 4) / 10, 0, 1)
                + 0.3 * north_facing + 0.45 * n_snow + 0.06 - 0.25 * np.clip(slope - 0.6, 0, 1))
    sm_ = np.clip((snow_amt - 0.42) / 0.2, 0, 1)
    sm_ = sm_ * sm_ * (3 - 2 * sm_)
    white = np.array((0.92, 0.91, 0.88))
    C = C * (1 - sm_[..., None]) + white * sm_[..., None]
    ice = np.clip(1 - np.abs(dr - 3.3) / 0.7, 0, 1)[..., None] * 0.8
    C = C * (1 - ice) + np.array((0.85, 0.9, 0.97)) * ice
    return C


def terrain_material():
    if "Terrain" in lib._mats:
        return lib._mats["Terrain"]
    m = lib.clay("TerrainBase", (1, 1, 1), rough=0.82, sss=0.04, dimple=0.8, dimple_scale=0.6, var=0.06, bump=0.4)
    m = m.copy()
    m.name = "Terrain"
    nt = m.node_tree
    bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "Col"; at.attribute_type = 'GEOMETRY'
    src = bsdf.inputs['Base Color'].links[0].from_socket
    mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    nt.links.new(src, mul.inputs[6]); nt.links.new(at.outputs['Color'], mul.inputs[7])
    nt.links.new(mul.outputs[2], bsdf.inputs['Base Color'])
    lib.tag(m, "terrain", (1, 1, 1), 0.82)
    lib._mats["Terrain"] = m
    return m


def build_terrain():
    xs, ys, X, Y, Hm, dr, Hl = terrain_heights()
    C = terrain_colors(X, Y, Hm, dr)
    nx, ny = len(xs), len(ys)
    vx0, vx1, vy0, vy1 = L.VILLAGE_GROUND
    me = bpy.data.meshes.new("Terrain")
    verts = np.stack([X.ravel(), Y.ravel(), Hm.ravel()], 1)
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            x, y = xs[i] + STEP / 2, ys[j] + STEP / 2
            if vx0 + 2.0 < x < vx1 - 2.0 and vy0 + 2.0 < y < vy1 - 2.0:
                continue   # hidden under the village's own ground
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    me.from_pydata(verts.tolist(), [], faces)
    col = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([C.reshape(-1, 3), np.ones((nx * ny, 1))], 1).astype(np.float32)
    col.data.foreach_set("color", rgba.ravel())
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(terrain_material())
    o = link(bpy.data.objects.new("Terrain", me))
    o["region_kind"] = "terrain"
    build_skirt(xs, ys, Hm)
    return o, (xs, ys, Hm)


def terrain_z(x, y, field):
    xs, ys, Hm = field
    i = np.clip((x - xs[0]) / STEP, 0, len(xs) - 1.001)
    j = np.clip((y - ys[0]) / STEP, 0, len(ys) - 1.001)
    i0, j0 = int(i), int(j)
    fx, fy = i - i0, j - j0
    h = (Hm[j0, i0] * (1 - fx) + Hm[j0, i0 + 1] * fx) * (1 - fy) + (Hm[j0 + 1, i0] * (1 - fx) + Hm[j0 + 1, i0 + 1] * fx) * fy
    if L.in_rect((x, y), L.VILLAGE_GROUND, pad=-0.2):
        return street.ground_height(x, y)
    return float(h)


def build_skirt(xs, ys, Hm):
    """The diorama's cut edge (painted earth strata) and its wooden plinth."""
    bm = bmesh.new()
    zb = -2.6
    edges = [[(xs[i], ys[0], Hm[0, i]) for i in range(len(xs))],
             [(xs[-1], ys[j], Hm[j, -1]) for j in range(len(ys))],
             [(xs[i], ys[-1], Hm[-1, i]) for i in reversed(range(len(xs)))],
             [(xs[0], ys[j], Hm[j, 0]) for j in reversed(range(len(ys)))]]
    for e in edges:
        top = [bm.verts.new(p) for p in e]
        bot = [bm.verts.new((p[0], p[1], zb)) for p in e]
        for k in range(len(e) - 1):
            bm.faces.new((top[k], bot[k], bot[k + 1], top[k + 1]))
    strata = clay("BoardStrata", P.srgb('#6e4e36'), rough=0.9, dimple=1.4, dimple_scale=0.8, var=0.35, stucco=0.8, bump=0.8)
    o = lib.mesh_obj("BoardEdge", bm, strata, COLL)
    x0, x1, y0, y1 = L.BOARD
    frame = wood("PlinthWood", P.srgb('#3d2a20'), painted=True, rough=0.45)
    trim = lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6)
    t = 2.0
    for (sx, sy, cx, cy) in [((x1 - x0) + 2 * t, t, (x0 + x1) / 2, y0 - t / 2), ((x1 - x0) + 2 * t, t, (x0 + x1) / 2, y1 + t / 2),
                             (t, (y1 - y0), x0 - t / 2, (y0 + y1) / 2), (t, (y1 - y0), x1 + t / 2, (y0 + y1) / 2)]:
        link_o = box("plinth", (sx, sy, 3.2), (cx, cy, zb - 0.4), frame, bevel=0.25, segs=3, subd=0, wobble=0.0, collection=COLL)
        box("plinthtrim", (sx + 0.1 if sx > t else sx + 0.12, sy + 0.12 if sx > t else sy + 0.1, 0.18),
            (cx, cy, zb + 1.2), trim, bevel=0.05, subd=0, wobble=0.0, collection=COLL)
    box("table", (900, 700, 1.0), ((x0 + x1) / 2, (y0 + y1) / 2, zb - 2.5), wood("TableWood", P.srgb('#2a1c16'), rough=0.5),
        bevel=0, subd=0, wobble=0, collection=COLL)


# ------------------------------------------------------------------ ribbons along paths
def ribbon(name, pts, zs, width, thick, mat, zoff=0.0, profile=None, collection=COLL):
    """Sweep a rounded rectangular section along a polyline."""
    prof = profile or [(-width / 2, -thick), (-width / 2 - 0.05, -thick * 0.4), (-width / 2 + 0.08, 0.0),
                       (width / 2 - 0.08, 0.0), (width / 2 + 0.05, -thick * 0.4), (width / 2, -thick)]
    bm = bmesh.new()
    rings = []
    for k, (p, z) in enumerate(zip(pts, zs)):
        a = pts[max(0, k - 1)]; b = pts[min(len(pts) - 1, k + 1)]
        d = Vector((b[0] - a[0], b[1] - a[1], 0)).normalized()
        n = Vector((-d.y, d.x, 0))
        rings.append([bm.verts.new((p[0] + n.x * u, p[1] + n.y * u, z + zoff + v)) for u, v in prof])
    for k in range(len(rings) - 1):
        for i in range(len(prof) - 1):
            bm.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][i + 1], rings[k][i + 1]))
    o = lib.mesh_obj(name, bm, mat, collection)
    return o


def resample(pr, step):
    pts, s, z = pr["pts"], pr["s"], pr["z"]
    out_p, out_z = [], []
    t = 0.0
    k = 0
    while t <= s[-1]:
        while k < len(s) - 2 and s[k + 1] < t:
            k += 1
        f = (t - s[k]) / max(s[k + 1] - s[k], 1e-9)
        out_p.append((pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f))
        out_z.append(z[k] + (z[k + 1] - z[k]) * f)
        t += step
    return out_p, out_z


# ------------------------------------------------------------------ railways
INSTANCES = {}   # proto name -> list of (x, y, z, rotz, scale, tint)


def inst(proto, x, y, z, rz=0.0, s=1.0, tint=1.0):
    INSTANCES.setdefault(proto, []).append((x, y, z, rz, s, tint))


def build_railways():
    ballast = clay("Ballast", P.srgb('#8a8079'), rough=0.9, dimple=1.6, dimple_scale=6, var=0.3, grain=1.5, bump=0.7)
    iron = clay("RailIron", P.srgb('#4a4a52'), rough=0.35, metallic=0.7, var=0.1, wear=0.2)
    for name, pr in PROFILES.items():
        if name.startswith("road_"):
            continue
        col = P.srgb(L.ROUTE_COLORS[name])
        bed = clay("Roadbed_" + name, col, rough=0.5, dimple=0.8, dimple_scale=3, var=0.12, wear=0.15, bump=0.4)
        pts, zs = resample(pr, 0.5)
        ribbon("roadbed_" + name, pts, zs, 4.8, 0.4, bed)
        ribbon("ballast_" + name, pts, [z + 0.02 for z in zs], 2.5, 0.06, ballast,
               profile=[(-1.25, 0.0), (-0.95, 0.09), (0.95, 0.09), (1.25, 0.0)])
        for side in (-0.72, 0.72):
            sh = []
            for k, p in enumerate(pts):
                a = pts[max(0, k - 1)]; b = pts[min(len(pts) - 1, k + 1)]
                d = Vector((b[0] - a[0], b[1] - a[1])).normalized()
                sh.append((p[0] - d.y * side, p[1] + d.x * side))
            ribbon("rail_" + name, sh, [z + 0.2 for z in zs], 0.075, 0.1, iron,
                   profile=[(-0.04, -0.1), (-0.04, 0.0), (0.04, 0.0), (0.04, -0.1)])
        # sleepers (instanced) every ~0.62 m
        sp, sz = resample(pr, 0.62)
        for k, (p, z) in enumerate(zip(sp, sz)):
            a = sp[max(0, k - 1)]; b = sp[min(len(sp) - 1, k + 1)]
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            inst("sleeper%d" % (k % 2), p[0], p[1], z + 0.11, ang + R.uniform(-0.04, 0.04), 1.0, R.uniform(0.85, 1.1))
        # buffer stop at the station end
        b0 = pts[0]
        a1 = pts[3]
        ang = math.atan2(a1[1] - b0[1], a1[0] - b0[0])
        red = lib.glossy_paint("BufferRed", P.MUTED_RED, rough=0.35)
        bs = box("buffer_" + name, (0.9, 2.4, 1.1), (b0[0] - math.cos(ang) * 0.5, b0[1] - math.sin(ang) * 0.5, 0.75),
                 red, rot=(0, 0, ang), bevel=0.08, subd=1, wobble=0.01, collection=COLL)
        for sgn in (-1, 1):
            blob("bufpad", (b0[0] + math.cos(ang) * 0.05 - math.sin(ang) * 0.6 * sgn, b0[1] + math.sin(ang) * 0.05 + math.cos(ang) * 0.6 * sgn, 0.95),
                 0.16, iron, squash=(0.6, 1, 1), subd=2, lump=0.02)
        # tunnel portal at the far end
        build_portal(name, pr)
        # river crossing
        if pr["crossing"]:
            c = pr["crossing"]
            i = min(range(len(pr["pts"])), key=lambda k: math.dist(pr["pts"][k], c))
            a, b = pr["pts"][max(0, i - 6)], pr["pts"][min(len(pr["pts"]) - 1, i + 6)]
            arch_bridge("RailBridge", c, math.atan2(b[1] - a[1], b[0] - a[0]), 24.0, 4.4, pr["z"][i] - 0.38,
                        water_level(c[1]) - 0.8, 3)
    # roads: packed snow with edges
    road_m = snow("RoadSnow", tint=(0.86, 0.83, 0.8), packed=True)
    for name, pr in PROFILES.items():
        if not name.startswith("road_"):
            continue
        pts, zs = resample(pr, 0.6)
        ribbon(name, pts, zs, 4.0, 0.12, road_m, zoff=0.06)
        if pr["crossing"]:
            c = pr["crossing"]
            i = min(range(len(pr["pts"])), key=lambda k: math.dist(pr["pts"][k], c))
            a, b = pr["pts"][max(0, i - 6)], pr["pts"][min(len(pr["pts"]) - 1, i + 6)]
            arch_bridge("RoadBridge", c, math.atan2(b[1] - a[1], b[0] - a[0]), 17.0, 5.2, pr["z"][i] - 0.1,
                        water_level(c[1]) - 0.8, 3, parapet=True)


def arch_bridge(name, c, ang, length, width, deck_z, base_z, arches, parapet=False):
    """Hand-laid stone arch bridge: voussoir blocks, piers, spandrels, snow on the deck."""
    stone = clay("BridgeStone", P.STONE_WARM, rough=0.85, dimple=1.6, dimple_scale=2.5, var=0.3, bump=0.6)
    rt = root(name, Vector((c[0], c[1], base_z)), lean=(0, 0, ang))
    for o in list(rt.users_collection):
        o.objects.unlink(rt)
    link(rt)
    H = deck_z - base_z
    span = length / arches
    r = span * 0.4
    spring = H - r - 0.8
    for a in range(arches):
        cx = -length / 2 + span * (a + 0.5)
        n = 13
        for i in range(n + 1):
            t = math.pi * i / n
            box("vous", (0.4, width + 0.05, 0.5), (cx + (r + 0.2) * math.cos(t), 0, spring + (r + 0.2) * math.sin(t)),
                stone, rot=(0, -t + math.pi / 2, 0), bevel=0.07, subd=1, wobble=0.04, collection=COLL).parent = rt
    for p in range(arches + 1):
        px = -length / 2 + span * p
        w = span - 2 * r
        z = 0.0
        while z < spring + 0.2:
            box("pier", (max(w, 0.9) + R.uniform(-0.05, 0.05), width, 0.45), (px, 0, z + 0.22), stone, bevel=0.07, subd=1,
                wobble=0.05, collection=COLL).parent = rt
            z += 0.47
    # spandrel wall + deck from blocks
    z = spring
    while z < H - 0.05:
        x = -length / 2 - 0.4
        while x < length / 2 + 0.4:
            bw = R.uniform(0.55, 0.95)
            xc = x + bw / 2
            inside = False
            for a in range(arches):
                cx = -length / 2 + span * (a + 0.5)
                if abs(xc - cx) < r and z < spring + math.sqrt(max(0.0, r * r - (xc - cx) ** 2)):
                    inside = True
            if not inside:
                box("blk", (bw, width, 0.42), (xc, 0, z + 0.21), stone, bevel=0.07, subd=1, wobble=0.04, collection=COLL).parent = rt
            x += bw + 0.03
        z += 0.44
    if parapet:
        for sgn in (-1, 1):
            box("parapet", (length + 0.6, 0.35, 0.6), (0, sgn * (width / 2 - 0.1), H + 0.3), stone, bevel=0.08, subd=2,
                wobble=0.04, collection=COLL).parent = rt
            snow_slab("parsnow", (length + 0.5, 0.42, 0.12), (0, sgn * (width / 2 - 0.1), H + 0.65), (0, 0, 0), lump=0.06,
                      smooth=2, parent=rt)
    return rt


def build_portal(name, pr):
    """Tunnel mouth: a stone arch ring and headwall set into the hill."""
    stone = clay("PortalStone", P.STONE, rough=0.85, dimple=1.5, dimple_scale=3, var=0.3, bump=0.6)
    dark = clay("TunnelDark", (0.012, 0.01, 0.012), rough=1.0, var=0.0, wear=0.0)
    p, d = pr["portal"]
    z = float(pr["z"][-1])
    ang = math.atan2(d[1], d[0])
    rt = root("Portal_" + name, Vector((p[0], p[1], z - 0.4)), lean=(0, 0, ang))
    for o in list(rt.users_collection):
        o.objects.unlink(rt)
    link(rt)
    r = 2.6
    for i in range(15):
        t = math.pi * i / 14
        box("pvous", (1.0, 0.55, 0.6), (0, r * math.cos(t), 3.0 + r * math.sin(t)), stone, rot=(-(t - math.pi / 2), 0, 0),
            bevel=0.08, subd=1, wobble=0.05, collection=COLL).parent = rt
    for sgn in (-1, 1):
        for k in range(7):
            box("pjamb", (1.0, 0.7, 0.44), (0, sgn * (r + 0.1), 0.22 + k * 0.45), stone, bevel=0.08, subd=1, wobble=0.04,
                collection=COLL).parent = rt
    # headwall above, buried into the hill
    for k in range(6):
        y = -6.0
        while y < 6.0:
            bw = R.uniform(0.7, 1.2)
            if not (abs(y + bw / 2) < r + 0.4 and 0.4 + k * 0.5 < 3.0 + r):
                box("phead", (1.1, bw, 0.48), (0.2, y + bw / 2, 0.24 + k * 0.5 + (0 if abs(y + bw / 2) > r + 0.4 else 3.0 + r - 0.2)),
                    stone, bevel=0.08, subd=1, wobble=0.05, collection=COLL).parent = rt
            y += bw + 0.04
    box("pdark", (2.0, 2 * r - 0.2, 3.0), (0.6, 0, 1.5), dark, bevel=0, subd=0, wobble=0, collection=COLL).parent = rt
    blob("pdarkt", (0.6, 0, 3.0), r - 0.1, dark, squash=(0.5, 1, 1), subd=2, lump=0, rot=(0, 0, 0)).parent = rt
    snow_slab("psnow", (1.3, 12.5, 0.3), (0.3, 0, 0.24 + 6 * 0.5 + 0.2), (0, 0, 0), lump=0.15, smooth=2, parent=rt)


# ------------------------------------------------------------------ the station
def build_station():
    brick = clay("StationBrick", P.srgb('#b0503f'), rough=0.78, dimple=1.2, var=0.25, stucco=0.8, bump=0.75)
    cream = clay("Cream", P.CREAM, rough=0.65, sss=0.15, dimple=0.8, var=0.12, stucco=0.6, bump=0.6)
    slate = clay("StationSlate", P.srgb('#4b4a63'), rough=0.7, var=0.2, dimple=1.0)
    iron = clay("StationIron", P.srgb('#2e4a3e'), rough=0.45, metallic=0.3, var=0.1, wear=0.15)
    glow = window_glow("StationGlow", color=(1.0, 0.55, 0.2), strength=1.9)
    glass = lib.emissive("ShedGlass", P.srgb('#3a4654'), 1.1)
    glass.node_tree.nodes["Principled BSDF"].inputs['Emission Color'].default_value = (1.0, 0.62, 0.3, 1)
    glass["rt_emit"] = [1.0, 0.62, 0.3]
    gold = lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6)
    stone = clay("PlinthStone", P.STONE, rough=0.8, dimple=1.4, dimple_scale=5, var=0.25)
    hx0, hx1, hy0, hy1 = L.HEAD
    sx0, sx1, sy0, sy1 = L.SHED
    H = 9.0
    # --- head house: two storeys of brick with cream stone dressings
    box("headbody", (hx1 - hx0, hy1 - hy0, H), ((hx0 + hx1) / 2, (hy0 + hy1) / 2, H / 2), brick, bevel=0.12, subd=3,
        wobble=0.05, collection=COLL)
    box("headplinth", (hx1 - hx0 + 0.4, hy1 - hy0 + 0.4, 0.8), ((hx0 + hx1) / 2, (hy0 + hy1) / 2, 0.4), stone, bevel=0.1,
        subd=2, wobble=0.04, collection=COLL)
    for zc in (4.2, H - 0.2):
        box("cornice", (hx1 - hx0 + 0.5, hy1 - hy0 + 0.5, 0.35), ((hx0 + hx1) / 2, (hy0 + hy1) / 2, zc), cream, bevel=0.1,
            subd=2, wobble=0.03, collection=COLL)
    fy = hy1                     # north face (toward the square)
    xs = [x for x in np.arange(hx0 + 2.2, hx1 - 1.5, 2.6) if not (L.ENTRANCE[0] - 4.5 < x < L.ENTRANCE[0] + 4.5)]
    for x in xs:
        for (z0, h) in ((1.4, 2.2), (5.2, 2.4)):
            arch_window(x, fy, z0, 1.2, h, glow, cream)
    # central pavilion with the grand arched entrance
    ex = L.ENTRANCE[0]
    box("pavilion", (9.0, 2.6, 12.0), (ex, fy + 0.2, 6.0), cream, bevel=0.15, subd=3, wobble=0.05, collection=COLL)
    arch_window(ex, fy + 1.5, 0.6, 3.6, 5.2, glow, gold, depth=0.25)
    for dx in (-3.1, 3.1):
        arch_window(ex + dx, fy + 1.5, 1.2, 1.1, 2.6, glow, brick)
        arch_window(ex + dx, fy + 1.5, 6.6, 1.1, 2.4, glow, brick)
    prism("pavgable", [(-4.7, 0.0), (4.7, 0.0), (0.0, 3.2)], 2.8, (ex, fy - 1.2, 12.0), cream, bevel=0.1, subd=3,
          wobble=0.04, collection=COLL)
    t = lib.text_obj("stationsign", "TOYS FOR TOTS", (ex, fy + 1.55, 10.6), 0.95, gold, extrude=0.06,
                     rot=(math.pi / 2, 0, math.pi))
    for c in list(t.users_collection):
        c.objects.unlink(t)
    link(t)
    t.data.space_character = 1.08
    # clock tower behind the pavilion
    tx, ty = ex, hy0 + 1.6
    box("tower", (4.6, 4.6, 19.0), (tx, ty, 9.5), brick, bevel=0.12, subd=3, wobble=0.05, collection=COLL)
    box("towerbelt", (5.0, 5.0, 0.5), (tx, ty, 15.0), cream, bevel=0.1, subd=2, wobble=0.03, collection=COLL)
    face = clay("ClockFace", P.CREAM, rough=0.5, var=0.05)
    for (dx, dy, rz) in ((0, 2.36, 0), (0, -2.36, 0), (2.36, 0, math.pi / 2), (-2.36, 0, math.pi / 2)):
        for prof, mat_, nm in (([(0.0, 0.0), (1.45, 0.0), (1.45, 0.12), (0.0, 0.14)], face, "clock"),
                               ([(1.45, -0.05), (1.62, -0.05), (1.62, 0.2), (1.45, 0.2)], gold, "clockring")):
            c = lathe(nm, prof, (tx + dx, ty + dy, 17.0), mat_, segs=32, collection=COLL)
            c.rotation_euler = (math.pi / 2, 0, rz)
    for (L_, w_, a_) in ((0.85, 0.13, -1.05), (1.2, 0.08, 0.05)):       # ten past ten, roughly
        box("hand", (w_, 0.05, L_), (tx + math.sin(a_) * L_ / 2, ty + 2.42, 17.0 + math.cos(a_) * L_ / 2), iron,
            rot=(0, a_, 0), bevel=0.01, subd=0, wobble=0, collection=COLL)
    spire = lathe("spire", [(3.4, 0.0), (3.1, 0.3), (1.2, 4.6), (0.2, 7.2), (0.0, 7.6)], (tx, ty, 19.0), slate, segs=4)
    spire.rotation_euler = (0, 0, math.pi / 4)
    for o in list(spire.users_collection):
        o.objects.unlink(spire)
    link(spire)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        snow_slab("spiresnow", (0.8, 3.0, 0.25), (tx + 1.5 * math.cos(a), ty + 1.5 * math.sin(a), 21.2), (0.55 * math.sin(a), -0.55 * math.cos(a), a),
                  lump=0.1, smooth=2)
    blob("finial", (tx, ty, 26.8), 0.3, gold, subd=2, lump=0)
    # head house roof: shallow hipped slate with snow
    for sgn in (-1, 1):
        rot = (-sgn * 0.42, 0, 0)
        box("hroof", (hx1 - hx0 + 0.6, 3.0, 0.2), ((hx0 + hx1) / 2, (hy0 + hy1) / 2 + sgn * 1.1, H + 0.55), slate, rot=rot,
            bevel=0.06, subd=2, wobble=0.03, collection=COLL)
        snow_slab("hroofsnow", (hx1 - hx0 + 0.8, 3.1, 0.3), ((hx0 + hx1) / 2, (hy0 + hy1) / 2 + sgn * 1.05, H + 0.78), rot, lump=0.18,
                  smooth=3)
    # --- the train shed: brick side wall, glazed barrel vault on iron ribs, gable screens
    wallH = 5.6
    box("shedwall", (sx1 - sx0, 0.7, wallH), ((sx0 + sx1) / 2, sy0 + 0.35, wallH / 2), brick, bevel=0.1, subd=3, wobble=0.05,
        collection=COLL)
    for x in np.arange(sx0 + 3.5, sx1 - 2, 5.0):
        arch_window(x, sy0 - 0.02, 1.6, 1.4, 2.6, glow, cream, facing=-1)
    span = sy1 - sy0
    cy = (sy0 + sy1) / 2
    rise = 7.5
    segs = 22
    # vault surface (glass) and snow lying on its upper ridges
    bm = bmesh.new()
    rings = []
    for xi in range(36):
        x = sx0 + (sx1 - sx0) * xi / 35
        ring = []
        for k in range(segs + 1):
            t = math.pi * k / segs
            ring.append(bm.verts.new((x, cy - span / 2 * math.cos(t), wallH + rise * math.sin(t))))
        rings.append(ring)
    for xi in range(35):
        for k in range(segs):
            bm.faces.new((rings[xi][k], rings[xi + 1][k], rings[xi + 1][k + 1], rings[xi][k + 1]))
    v = lib.mesh_obj("vault", bm, glass, COLL)
    m = v.modifiers.new("t", 'SOLIDIFY'); m.thickness = 0.12
    for x in np.arange(sx0, sx1 + 0.1, 2.5):
        pts = [(x, cy - span / 2 * math.cos(math.pi * k / 30), wallH + rise * math.sin(math.pi * k / 30) + 0.1) for k in range(31)]
        cu = bpy.data.curves.new("rib", 'CURVE'); cu.dimensions = '3D'
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (*p, 1)
        cu.bevel_depth = 0.16 if (round((x - sx0) / 2.5) % 2) else 0.26
        cu.bevel_resolution = 2
        ob = bpy.data.objects.new("rib", cu); ob.data.materials.append(iron); link(ob)
    for k in (6, 8, 10, 12, 14, 16):
        t = math.pi * k / segs
        x = sx0 + 0.5
        while x < sx1 - 0.5:
            Ls = R.uniform(4.0, 11.0)
            w_ = min(Ls, sx1 - 0.5 - x)
            if R.random() < 0.78 and w_ > 1.0:
                snow_slab("vaultsnow", (w_, 2.2, 0.42),
                          (x + w_ / 2, cy - span / 2 * math.cos(t), wallH + rise * math.sin(t) + 0.2),
                          (math.atan2(rise * math.cos(t), span / 2 * math.sin(t)), 0, 0), lump=0.24, smooth=2, dice=4)
            x += Ls + R.uniform(0.4, 2.0)
    snow_slab("ridgesnow", (sx1 - sx0 + 0.4, 1.6, 0.35), ((sx0 + sx1) / 2, cy, wallH + rise + 0.25), (0, 0, 0), lump=0.2, smooth=3)
    # gable screens with arched track openings and a glowing fan light above
    for (gx, opening, sgn) in ((sx0, L.WEST_OPENING, -1), (sx1, L.EAST_OPENING, 1)):
        oy0, oy1 = opening
        y = sy0
        while y < sy1 - 0.01:
            bw = 1.0
            yc = y + bw / 2
            for z in np.arange(0.25, wallH + 0.2, 0.5):
                top = wallH + rise * math.sqrt(max(0.0, 1 - ((yc - cy) / (span / 2)) ** 2)) - 0.3
                if z > top:
                    continue
                if oy0 - 0.3 < yc < oy1 + 0.3 and z < 6.4:
                    continue
                box("gable", (0.8, bw - 0.03, 0.48), (gx, yc, z), brick, bevel=0.06, subd=1, wobble=0.03, collection=COLL)
            y += bw
        box("lintel", (1.0, oy1 - oy0 + 1.2, 0.7), (gx, (oy0 + oy1) / 2, 6.6), cream, bevel=0.1, subd=2, wobble=0.03, collection=COLL)
        fan = lib.mesh_obj("fan", _fan_bm(gx + sgn * 0.05, cy, wallH + 0.6, span / 2 - 1.0, rise - 1.2), glow, COLL)
    # platforms and their snow-free stone tops, lamps along them
    pl = clay("PlatformStone", P.srgb('#a79a8c'), rough=0.85, dimple=1.4, dimple_scale=2, var=0.2)
    for (a, b) in L.PLATFORMS:
        box("platform", (sx1 - sx0 - 2.0, b - a, 0.95), ((sx0 + sx1) / 2, (a + b) / 2, 0.47), pl, bevel=0.06, subd=2,
            wobble=0.02, collection=COLL)
        for x in np.arange(sx0 + 6, sx1 - 4, 10.0):
            lathe("plamp", [(0.0, 0.0), (0.08, 0.0), (0.06, 3.2), (0.0, 3.25)], (x, (a + b) / 2, 0.95), iron, segs=8, smooth_subd=0)
            blob("plampglow", (x, (a + b) / 2, 4.25), 0.22, lib.emissive("LampBulb", (1.0, 0.8, 0.5), 40), subd=2, lump=0)
    # forecourt: lamps and a wreath over the doors
    lib.blob("stationwreath", (ex, fy + 1.75, 6.4), 0.9, clay("Pine", P.PINE, rough=0.7, dimple=1.2, dimple_scale=8, var=0.25),
             squash=(1, 0.35, 1), subd=3, lump=0.4)


def _fan_bm(x, cy, z0, r, rise):
    bm = bmesh.new()
    c = bm.verts.new((x, cy, z0))
    ring = [bm.verts.new((x, cy - r * math.cos(math.pi * k / 16), z0 + rise * math.sin(math.pi * k / 16))) for k in range(17)]
    for k in range(16):
        bm.faces.new((c, ring[k], ring[k + 1]))
    return bm


def arch_window(x, face_y, z0, w, h, glow, trim, depth=0.05, facing=1):
    """Arched window on a facade: a trim slab behind, the glowing pane proud of it, a sill."""
    prof = [(-w / 2, 0.0), (w / 2, 0.0)] + [(w / 2 * math.cos(math.pi * k / 10), h - w / 2 + w / 2 * math.sin(math.pi * k / 10))
                                           for k in range(1, 10)]
    big = [(u * 1.22, v * 1.07 - 0.08) for u, v in prof]
    rz = 0.0 if facing > 0 else math.pi
    fr = lib.mesh_obj("swinf", lib.prism_bm(big, 0.05), trim, COLL)
    fr.location = (x, face_y - 0.03 * facing, z0); fr.rotation_euler = (0, 0, rz)
    g = lib.mesh_obj("swin", lib.prism_bm(prof, depth), glow, COLL)
    g.location = (x, face_y + 0.02 * facing, z0); g.rotation_euler = (0, 0, rz)
    box("swsill", (w + 0.35, 0.3, 0.14), (x, face_y + facing * 0.12, z0 - 0.07), trim, bevel=0.03, subd=1, wobble=0.01, collection=COLL)
    box("swsillsnow", (w + 0.3, 0.26, 0.08), (x, face_y + facing * 0.13, z0 + 0.03), snow(), bevel=0, subd=0, wobble=0.01,
        smooth_subd=1, collection=COLL)


# ------------------------------------------------------------------ the town square
def build_square():
    sx0, sx1, sy0, sy1 = L.SQUARE
    me = bpy.data.meshes.new("Flagstones")
    tv = []
    bmt = bmesh.new(); bmesh.ops.create_cube(bmt, size=1.0)
    bmesh.ops.bevel(bmt, geom=bmt.edges[:], offset=0.09, segments=2, affect='EDGES')
    tv = [v.co.copy() for v in bmt.verts]; tf = [[v.index for v in f.verts] for f in bmt.faces]; bmt.free()
    V_, F_, A_ = [], [], []
    y = sy1 + 0.2
    row = 0
    while y > sy0 - 2.5:
        hgt = R.uniform(0.85, 1.15)
        x = sx0 - 1.0 + (R.uniform(0, 0.6) if row % 2 else 0)
        while x < sx1 + 1.0:
            w = R.uniform(1.0, 1.55)
            cx, cy = x + w / 2, y - hgt / 2
            # leave the street edge to the existing cobbles, and a circle for the big tree
            if cy > street.e_far(cx) - 0.4 or math.hypot(cx - L.SQUARE_TREE[0], cy - L.SQUARE_TREE[1]) < 3.4:
                x += w + 0.05
                continue
            base = len(V_)
            rot = R.uniform(-0.03, 0.03)
            cr, sr = math.cos(rot), math.sin(rot)
            col = R.random()
            edge = 1 - min(1.0, min(cx - sx0, sx1 - cx, cy - sy0 + 2.0) / 3.0)
            dz = R.uniform(-0.012, 0.012)
            for v in tv:
                px, py, pz = v.x * (w - 0.06), v.y * (hgt - 0.06), (v.z + 0.5) * 0.09 - 0.04 + dz
                V_.append((cx + px * cr - py * sr, cy + px * sr + py * cr, pz))
                A_.append((col, max(edge, 0.25), 0))
            F_ += [[base + i for i in f] for f in tf]
            x += w + R.uniform(0.04, 0.07)
        y -= hgt + R.uniform(0.04, 0.07)
        row += 1
    me.from_pydata(V_, [], F_)
    a = me.attributes.new("cobble", 'FLOAT_VECTOR', 'POINT')
    for i, val in enumerate(A_):
        a.data[i].vector = val
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(lib._mats.get("Cobble") or street.stone_mat())
    link(bpy.data.objects.new("Flagstones", me))
    # big decorated tree at the heart of the square, presents beneath, snow at its feet
    tx, ty = L.SQUARE_TREE
    tub = clay("TubRed", P.MUTED_RED, rough=0.5)
    lathe("treetub", [(0.0, 0.0), (2.6, 0.0), (2.9, 0.9), (2.7, 1.0), (0.0, 1.0)], (tx, ty, 0.0), tub, segs=28, wob=0.04)
    trees.fir("SquareTree", (tx, ty, 0.95), 10.5, 3.6, tiers=9, color=P.srgb('#1f6b3a'), snow_amt=0.45, ornaments=True,
              lights=True, star=True, lean=0.015, collection=COLL)
    props.gift_pile("SquareGifts", (tx + 1.2, ty - 3.6, 0.0), n=6, spread=1.6, scale=1.6)
    for k in range(18):
        a = 2 * math.pi * k / 18
        blob("tubsnow", (tx + 3.1 * math.cos(a), ty + 3.1 * math.sin(a), 0.05), R.uniform(0.35, 0.55), snow("GroundSnow"),
             squash=(1.5, 1.2, 0.5), subd=3, lump=0.35)
    # benches, lamps (glow only: the square's light comes from the windows and the tree)
    for (x, y, rz) in ((tx - 7, ty + 3, 1.2), (tx + 7.5, ty + 2, -1.3), (tx - 6, ty - 6, 2.2), (tx + 8, ty - 7, -2.4)):
        props.bench(f"SqBench{x:.0f}", (x, y, 0.06), rot_z=rz)
    for (x, y) in ((sx0 + 1.5, sy0 + 1.5), (sx1 - 1.5, sy0 + 1.5), (sx0 + 1.5, -12), (sx1 - 1.5, -12)):
        lp = props.lamppost(f"SqLamp{x:.0f}{y:.0f}", (x, y, 0.0))
        for c in list(lp.children):
            if c.type == 'LIGHT':
                bpy.data.objects.remove(c)
    # snow heaped along the square's edges
    for k in range(70):
        side = R.random()
        if side < 0.35:
            x, y = sx0 + R.uniform(-0.5, 0.8), R.uniform(sy0, -9)
        elif side < 0.7:
            x, y = sx1 + R.uniform(-0.8, 0.5), R.uniform(sy0, -9)
        else:
            x, y = R.uniform(sx0, sx1), sy0 + R.uniform(-0.8, 0.5)
        if abs(x - L.ENTRANCE[0]) < 4 and y < sy0 + 1:
            continue
        blob("sqdrift", (x, y, 0.04), R.uniform(0.3, 0.7), snow("GroundSnow"), squash=(1.6, 1.2, 0.5), subd=3, lump=0.35)
    # houses lining the west and east sides, fronts to the square
    cols = [P.srgb('#c45b4a'), P.CREAM_WARM, P.srgb('#5f8f95'), P.srgb('#d8a94f'), P.PINK_LIGHT, P.srgb('#7b8fc4'),
            P.srgb('#9a6fa8'), P.srgb('#e0b27a')]
    k = 0
    for side, x, rz in (("w", sx0 - 3.2, -math.pi / 2), ("e", sx1 + 3.2, math.pi / 2)):
        y = -11.5
        while y > sy0 - 1:
            Wd = R.uniform(4.0, 5.2)
            bg_house(f"Sq{side}{k}", Vector((x + (R.uniform(-0.4, 0.4)), y - Wd / 2, 0.0)), Wd, R.uniform(3.6, 4.4),
                     R.uniform(4.0, 6.0), R.uniform(46, 58), cols[k % len(cols)], rot_z=rz + R.uniform(-0.05, 0.05),
                     gable_front=(k % 3 != 1), windows_lit=0.85)
            y -= Wd + R.uniform(0.6, 1.4)
            k += 1


# ------------------------------------------------------------------ countryside buildings
def build_sites(field):
    for name, (sx, sy, kind, rot) in L.SITES.items():
        z = terrain_z(sx, sy, field)
        if kind == "farm":
            farm(name, sx, sy, z, rot)
        elif kind == "cottage":
            cottage(name, sx, sy, z, rot)
        else:
            chapel(name, sx, sy, z, rot)


def _rel(x, y, rot, dx, dy):
    c, s = math.cos(rot), math.sin(rot)
    return x + dx * c - dy * s, y + dx * s + dy * c


def farm(name, x, y, z, rot):
    red = clay("BarnRed", P.srgb('#a8362e'), rough=0.75, var=0.25, stucco=0.6, bump=0.7)
    white = wood("BarnTrim", P.CREAM, painted=True, rough=0.55)
    roof = clay("BarnRoof", P.srgb('#5a4a4a'), rough=0.7, var=0.2)
    rt = root(name, Vector((x, y, z)), lean=(0, 0, rot))
    for o in list(rt.users_collection):
        o.objects.unlink(rt)
    link(rt)
    # barn with a gambrel roof (the silhouette you can read from the map)
    W, D, Hw = 8.0, 11.0, 4.0
    box("barn", (W, D, Hw), (0, 0, Hw / 2), red, bevel=0.12, subd=3, wobble=0.06, collection=COLL).parent = rt
    gp = [(-W / 2 - 0.3, Hw), (-W / 2 + 0.6, Hw + 2.6), (0, Hw + 3.6), (W / 2 - 0.6, Hw + 2.6), (W / 2 + 0.3, Hw)]
    for i in range(len(gp) - 1):
        (u0, v0), (u1, v1) = gp[i], gp[i + 1]
        ang = math.atan2(v1 - v0, u1 - u0)
        L_ = math.hypot(u1 - u0, v1 - v0)
        box("groof", (L_ + 0.2, D + 0.8, 0.2), ((u0 + u1) / 2, 0, (v0 + v1) / 2), roof, rot=(0, -ang, 0), bevel=0.05, subd=2,
            wobble=0.03, collection=COLL).parent = rt
        snow_slab("gsnow", (L_ + 0.3, D + 1.0, 0.3), ((u0 + u1) / 2 - math.sin(ang) * 0.18, 0, (v0 + v1) / 2 + math.cos(ang) * 0.18),
                  (0, -ang, 0), lump=0.18, smooth=2, parent=rt)
    for gy in (-D / 2 + 0.05, D / 2 - 0.35):
        prism("barngable", [(u, v) for u, v in gp], 0.3, (0, gy, 0), red, bevel=0.05, subd=2, wobble=0.03,
              collection=COLL).parent = rt
    for sgn in (-1, 1):
        box("bdoor", (1.4, 0.12, 2.8), (sgn * 0.72, -D / 2 - 0.05, 1.45), red, bevel=0.03, subd=1, wobble=0.01, collection=COLL).parent = rt
        for (rz_, L2) in ((0.98, 3.0), (-0.98, 3.0)):
            box("bx", (0.12, 0.08, L2), (sgn * 0.72, -D / 2 - 0.13, 1.45), white, rot=(0, rz_ * 0.5, 0), bevel=0.02, subd=0,
                wobble=0, collection=COLL).parent = rt
    box("hayloft", (1.4, 0.1, 1.2), (0, -D / 2 - 0.05, Hw + 1.4), white, bevel=0.02, subd=1, wobble=0.01, collection=COLL).parent = rt
    # silo
    silo = lathe("silo", [(0.0, 0.0), (1.7, 0.0), (1.7, 8.5), (1.4, 9.3), (0.8, 9.8), (0.0, 10.0)], (W / 2 + 2.6, D / 2 - 2.0, 0),
                 clay("SiloCream", P.srgb('#d8c9a8'), rough=0.7, var=0.15, dimple=1.0), segs=24, wob=0.03)
    for o in list(silo.users_collection):
        o.objects.unlink(silo)
    link(silo); silo.parent = rt
    blob("silosnow", (W / 2 + 2.6, D / 2 - 2.0, 9.9), 1.2, snow(), squash=(1.3, 1.3, 0.4), subd=3, lump=0.2).parent = rt
    # farmhouse (its own proportions) beside the yard
    hx, hy = _rel(x, y, rot, -W / 2 - 8.0, -2.0)
    bg_house(name + "_house", Vector((hx, hy, z)), 5.2, 4.6, 4.4, 48, P.CREAM_WARM if R.random() < 0.5 else P.srgb('#e6d8c0'),
             rot_z=rot + R.uniform(-0.1, 0.1), gable_front=False, windows_lit=0.9)
    # paddock fence (posts instanced, rails as one mesh) and hay bales
    rail = wood("FenceWood", P.srgb('#6b4a32'), rough=0.7)
    px0, py0, px1, py1 = W / 2 + 1.5, -D / 2 - 9.0, W / 2 + 15.0, D / 2 - 5.0
    corners = [(px0, py0), (px1, py0), (px1, py1), (px0, py1), (px0, py0)]
    for (a, b) in zip(corners, corners[1:]):
        n = max(2, int(math.dist(a, b) / 2.3))
        for k in range(n):
            u = k / n
            lx, ly = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
            wx, wy = _rel(x, y, rot, lx, ly)
            inst("fencepost", wx, wy, z, rot + R.uniform(-0.1, 0.1), R.uniform(0.9, 1.1))
        for hz in (0.45, 0.85):
            L2 = math.dist(a, b)
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            box("frail", (L2, 0.07, 0.1), ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, hz), rail, rot=(0, R.uniform(-0.01, 0.01), ang),
                bevel=0.02, subd=0, wobble=0, collection=COLL).parent = rt
    for k in range(4):
        bx_, by_ = _rel(x, y, rot, px0 + 3 + k * 2.6, py0 + 3 + (k % 2) * 2.0)
        inst("haybale", bx_, by_, z, R.uniform(0, 6.28), R.uniform(0.9, 1.1))
    # a little orchard
    for i in range(3):
        for j in range(4):
            ox, oy = _rel(x, y, rot, -W / 2 - 3 - i * 4.2, D / 2 + 4 + j * 4.2)
            inst("decid%d" % R.choice([1, 2, 4]), ox, oy, z, R.uniform(0, 6.28), R.uniform(0.55, 0.75), R.uniform(0.85, 1.15))


def cottage(name, x, y, z, rot):
    cols = [P.srgb('#c9665a'), P.srgb('#6f8fc4'), P.srgb('#d4a64a'), P.PINK_LIGHT, P.srgb('#7aa07a')]
    bg_house(name, Vector((x, y, z)), R.uniform(3.8, 4.8), R.uniform(3.4, 4.2), R.uniform(3.4, 4.2), R.uniform(44, 56),
             R.choice(cols), rot_z=rot, gable_front=R.random() < 0.5, windows_lit=0.9)
    for k in range(6):
        fx, fy = _rel(x, y, rot, -3.5 + k * 1.4, -4.4)
        inst("fencepost", fx, fy, z, rot, R.uniform(0.75, 0.9))
    for k in range(3):
        tx, ty = _rel(x, y, rot, R.uniform(-8, 8), R.uniform(5, 9))
        inst("fir%d" % R.randrange(6), tx, ty, z - 0.1, R.uniform(0, 6.28), R.uniform(0.7, 1.0), R.uniform(0.9, 1.1))


def chapel(name, x, y, z, rot):
    white = clay("ChapelWhite", P.srgb('#efe8dc'), rough=0.65, var=0.08, stucco=0.7, bump=0.6)
    roof = clay("ChapelRoof", P.srgb('#59506a'), rough=0.7, var=0.2)
    glow = window_glow("ChapelGlow", color=(1.0, 0.58, 0.26), strength=2.0, frost=False)
    rt = root(name, Vector((x, y, z)), lean=(0, 0, rot))
    for o in list(rt.users_collection):
        o.objects.unlink(rt)
    link(rt)
    W, D, Hw = 5.0, 9.5, 3.8
    prism("nave", [(-W / 2, 0), (W / 2, 0), (W / 2, Hw), (0, Hw + 3.0), (-W / 2, Hw)], D, (0, -D / 2, 0), white, bevel=0.08,
          subd=3, wobble=0.05, collection=COLL).parent = rt
    for sgn in (-1, 1):
        ang = math.atan2(3.0, W / 2)
        box("croof", (math.hypot(W / 2, 3.0) + 0.5, D + 0.6, 0.18), (sgn * W / 4, 0, Hw + 1.55), roof, rot=(0, sgn * ang, 0),
            bevel=0.05, subd=2, wobble=0.03, collection=COLL).parent = rt
        snow_slab("csnow", (math.hypot(W / 2, 3.0) + 0.6, D + 0.8, 0.3), (sgn * W / 4 - sgn * 0.1, 0, Hw + 1.75), (0, sgn * ang, 0),
                  lump=0.16, smooth=2, parent=rt)
        for k in range(3):
            g = box("cwin", (0.06, 0.8, 1.6), (sgn * (W / 2 + 0.02), -D / 2 + 2.2 + k * 2.6, 1.9), glow, bevel=0.02, subd=1,
                    wobble=0, collection=COLL)
            g.parent = rt
    tw = box("ctower", (2.4, 2.4, 7.5), (0, -D / 2 - 0.8, 3.75), white, bevel=0.08, subd=3, wobble=0.04, collection=COLL)
    tw.parent = rt
    sp = lathe("cspire", [(1.9, 0.0), (1.2, 2.0), (0.0, 5.2)], (0, -D / 2 - 0.8, 7.5), roof, segs=4)
    sp.rotation_euler = (0, 0, math.pi / 4)
    for o in list(sp.users_collection):
        o.objects.unlink(sp)
    link(sp); sp.parent = rt
    snow_slab("cspsnow", (1.6, 1.6, 0.25), (0, -D / 2 - 0.8, 7.9), (0, 0, 0), lump=0.08, smooth=2, parent=rt)
    box("cdoor", (1.1, 0.1, 2.0), (0, -D / 2 - 2.02, 1.0), glow, bevel=0.03, subd=1, wobble=0, collection=COLL).parent = rt


# ------------------------------------------------------------------ prototypes (instanced in the browser)
PROTOS = {}


def _join_proto(name, objs):
    o = lib.join(objs, name)
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll = lib.coll("Protos")
    coll.objects.link(o)
    o.location = (0, 0, 0)
    PROTOS[name] = o
    return o


def proto_fir(name, seed, height, radius, color):
    """A light-weight evergreen: drooping scalloped tiers, snow pressed on the tips."""
    rr = random.Random(seed)
    mat = trees.needle_mat("Needles_" + str(round(color[1], 3)), color)
    sn = snow()
    objs = []
    tiers = rr.choice([5, 6, 6, 7])
    for k in range(tiers):
        f = k / (tiers - 1)
        z = height * 0.12 + (height * 0.88) * (f ** 0.92) * 0.9
        Rk = radius * (1 - f) ** 0.95 * rr.uniform(0.86, 1.1) + 0.08 * radius
        droop = Rk * rr.uniform(0.5, 0.75)
        lobes = rr.choice([5, 6, 7, 8]) if Rk > 0.6 else rr.choice([4, 5])
        phase = rr.random() * 6.28
        bm = trees.tier_bm(Rk, droop, lobes, phase, 0.06, seed + k * 3.7, rad_segs=28, rings=3, lobe_amp=0.24)
        o = lib.mesh_obj(f"{name}_t{k}", bm, mat)
        o.location = (rr.uniform(-0.05, 0.05) * radius, rr.uniform(-0.05, 0.05) * radius, z + droop * 0.6)
        m = o.modifiers.new("thick", 'SOLIDIFY'); m.thickness = 0.06 + 0.05 * Rk; m.offset = -1
        lib.clay_mods(o, 0, 0, 0, 0.05 * Rk + 0.02)
        objs.append(o)
        for li in range(lobes):
            if rr.random() < 0.7:
                a = (2 * math.pi * li - phase) / lobes
                s_t = rr.uniform(0.5, 0.8)
                rr_ = Rk * s_t
                tz = z + droop * 0.6 - droop * (s_t ** 1.6) * 1.05 + 0.03
                sr = Rk * rr.uniform(0.14, 0.2) + 0.03
                objs.append(blob("ps", (rr_ * math.cos(a) + o.location.x, rr_ * math.sin(a) + o.location.y, tz + sr * 0.3), sr, sn,
                                 squash=(1.5, 1.1, 0.5), subd=2, lump=0.4, rot=(0, -0.5 * s_t, a)))
        objs.append(blob("pcap", (o.location.x, o.location.y, z + droop * 0.6 + 0.02), Rk * 0.28 + 0.03, sn,
                         squash=(1.3, 1.3, 0.45), subd=2, lump=0.3))
    objs.append(lathe(f"{name}_trunk", [(0.0, 0), (radius * 0.13, 0), (radius * 0.1, height * 0.2), (0, height * 0.22)], (0, 0, 0),
                      clay("Bark", P.WOOD_DARK, rough=0.85, dimple=1.6), segs=8, wob=0.2, smooth_subd=0))
    return _join_proto(name, objs)


LEAF = {"LeafGreen": '#4f7a3e', "LeafOlive": '#7f8a3e', "LeafGold": '#c7962f', "LeafRust": '#b0602f'}


def proto_deciduous(name, seed, height, leaf, snowy=True):
    rr = random.Random(seed)
    bark = clay("BarkGrey", P.srgb('#6a5646'), rough=0.85, dimple=1.4, var=0.2)
    lm = clay(leaf, P.srgb(LEAF[leaf]), rough=0.75, sss=0.1, dimple=1.0, dimple_scale=7, var=0.28, grain=1.2, bump=0.6)
    objs = [lathe(f"{name}_trunk", [(0.0, 0.0), (0.32, 0.0), (0.2, height * 0.45), (0.12, height * 0.6), (0.0, height * 0.62)],
                  (0, 0, 0), bark, segs=8, wob=0.25, smooth_subd=0)]
    cz = height * 0.68
    crown = height * 0.32
    for k in range(rr.randint(8, 12)):
        a, el = rr.random() * 6.28, rr.uniform(-0.3, 0.9)
        d = crown * rr.uniform(0.25, 0.75)
        p = (d * math.cos(a) * math.cos(el), d * math.sin(a) * math.cos(el), cz + d * math.sin(el) * 0.8)
        objs.append(blob("puff", p, crown * rr.uniform(0.42, 0.62), lm, squash=(1, 1, 0.85), subd=2, lump=0.3,
                         rot=(rr.random(), rr.random(), rr.random())))
    if snowy:
        for k in range(rr.randint(2, 4)):
            a = rr.random() * 6.28
            d = crown * rr.uniform(0.0, 0.45)
            objs.append(blob("psnow", (d * math.cos(a), d * math.sin(a), cz + crown * 0.75), crown * rr.uniform(0.32, 0.45), snow(),
                             squash=(1.3, 1.3, 0.45), subd=2, lump=0.35))
    return _join_proto(name, objs)


def proto_bare(name, seed, height):
    """A winter tree: branching clay twigs with snow along the upper branches."""
    rr = random.Random(seed)
    bark = clay("BarkGrey", P.srgb('#6a5646'), rough=0.85, dimple=1.4, var=0.2)
    objs = []

    def branch(a, b, r0, depth):
        o = lib.mesh_obj("br", _tube(a, b, r0, r0 * 0.65), bark)
        objs.append(o)
        if depth == 0:
            return
        d = (Vector(b) - Vector(a))
        for k in range(rr.choice([2, 3])):
            axis = Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(0.3, 1.0))).normalized()
            nd = (d.normalized() * 0.55 + axis * 0.6).normalized() * d.length * rr.uniform(0.55, 0.75)
            branch(b, tuple(Vector(b) + nd), r0 * 0.6, depth - 1)
    branch((0, 0, 0), (0, 0, height * 0.45), 0.3, 3)
    return _join_proto(name, objs)


def _tube(a, b, r0, r1, segs=7):
    a, b = Vector(a), Vector(b)
    d = b - a
    q = d.normalized().to_track_quat('Z', 'Y').to_matrix()
    bm = lib.lathe_bm([(r0, 0.0), (r1, d.length), (0.0, d.length + r1)], segs, 0.2, R.random() * 10)
    for v in bm.verts:
        v.co = q @ v.co + a
    return bm


def build_protos():
    for i, (h, r, c) in enumerate([(7.5, 2.3, P.PINE_DARK), (9.0, 2.6, P.PINE), (6.0, 2.0, P.PINE_DARK), (10.5, 2.9, P.PINE),
                                   (8.0, 2.2, P.srgb('#2c5f40')), (6.8, 2.4, P.srgb('#234f36'))]):
        proto_fir("fir%d" % i, 100 + i * 17, h, r, c)
    for i, (leaf, h) in enumerate([("LeafGreen", 7.0), ("LeafOlive", 6.0), ("LeafGold", 6.5), ("LeafRust", 5.5), ("LeafGold", 8.0)]):
        proto_deciduous("decid%d" % i, 300 + i * 13, h, leaf, snowy=(i % 2 == 0))
    proto_bare("bare0", 501, 7.0)
    for i in range(3):
        rr = random.Random(700 + i)
        lm = clay("Hedge", P.srgb('#46663a'), rough=0.8, dimple=1.0, dimple_scale=7, var=0.25, bump=0.6)
        objs = [blob("hb", (rr.uniform(-0.9, 0.9), rr.uniform(-0.5, 0.5), 0.45), rr.uniform(0.5, 0.8), lm, squash=(1.2, 1, 0.85),
                     subd=2, lump=0.35) for _ in range(5)]
        if i != 1:
            objs.append(blob("hbs", (0, 0, 0.95), 0.6, snow(), squash=(1.6, 1.1, 0.35), subd=2, lump=0.3))
        _join_proto("bush%d" % i, objs)
    for i in range(3):
        _join_proto("rock%d" % i, [blob("rk", (0, 0, 0.2), random.Random(800 + i).uniform(0.4, 0.7),
                                         clay("Rock", P.srgb('#857c77'), rough=0.85, dimple=1.5, var=0.3), squash=(1.3, 1.0, 0.7),
                                         subd=1, lump=0.35, seed=i * 5.1)])
    post = wood("FenceWood", P.srgb('#6b4a32'), rough=0.7)
    _join_proto("fencepost", [box("fp", (0.16, 0.16, 1.15), (0, 0, 0.55), post, bevel=0.03, subd=1, wobble=0.01),
                              blob("fps", (0, 0, 1.15), 0.12, snow(), squash=(1.2, 1.2, 0.5), subd=2, lump=0.2)])
    sw = wood("SleeperWood", P.srgb('#5a4030'), rough=0.8)
    for i in range(2):
        _join_proto("sleeper%d" % i, [box("sl", (0.26, 2.4, 0.13), (0, 0, 0), sw, bevel=0.03, subd=1, wobble=0.012 * (i + 1))])
    hay = clay("Hay", P.srgb('#d3b05a'), rough=0.9, dimple=1.0, dimple_scale=9, var=0.2, grain=1.5)
    hb = lathe("hayb", [(0.0, -0.6), (0.65, -0.6), (0.7, 0.0), (0.65, 0.6), (0.0, 0.6)], (0, 0, 0.68), hay, segs=16, smooth_subd=0)
    hb.rotation_euler = (math.pi / 2, 0, 0)
    _join_proto("haybale", [hb, blob("hbsn", (0, 0, 1.3), 0.5, snow(), squash=(1.3, 1.6, 0.4), subd=2, lump=0.3)])


# ------------------------------------------------------------------ instance placement
def place_instances(field):
    xs, ys, Hm = field
    x0, x1, y0, y1 = L.BOARD
    river = L.catmull(L.RIVER, 2.0)
    paths = [pr["pts"][::4] for pr in PROFILES.values()]
    sites = [(sx, sy, L.SITE_RADIUS[k] + 3) for (sx, sy, k, _) in L.SITES.values()]

    def free(x, y, clear=4.0):
        if not L.in_rect((x, y), L.BOARD, pad=-4.0):
            return False
        if L.in_rect((x, y), L.VILLAGE_GROUND, pad=6.0) or L.in_rect((x, y), (-36, 48, -68, -32), pad=4.0):
            return False
        if L.dist_to_polyline((x, y), river) < 9.0:
            return False
        if any(L.dist_to_polyline((x, y), p) < clear + 3.0 for p in paths):
            return False
        if any(math.hypot(x - sx, y - sy) < r for sx, sy, r in sites):
            return False
        return True

    # woods: clustered around clump centres, plus a few lone trees in the fields
    centres = []
    guard = 0
    while len(centres) < 46 and guard < 5000:
        guard += 1
        x, y = R.uniform(x0 + 8, x1 - 8), R.uniform(y0 + 8, y1 - 8)
        z = terrain_z(x, y, field)
        if free(x, y, 8) and (z > 3.5 or R.random() < 0.35):
            centres.append((x, y, R.uniform(9, 20), z > 5 or y > 55))
    placed = []
    for (cx, cy, rad, conifer) in centres:
        n = int(rad * rad / 6)
        for k in range(n):
            a, rr = R.random() * 6.283, rad * math.sqrt(R.random())
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a) * 0.8
            if not free(x, y) or any((x - px) ** 2 + (y - py) ** 2 < 14.0 for px, py in placed[-260:]):
                continue
            placed.append((x, y))
            z = terrain_z(x, y, field)
            edge = rr / rad
            if conifer or R.random() < 0.3:
                inst("fir%d" % R.randrange(6), x, y, z - 0.1, R.uniform(0, 6.28), R.uniform(1.35, 2.0) * (1.1 - 0.3 * edge), R.uniform(0.88, 1.12))
            else:
                p = "bare0" if R.random() < 0.1 else "decid%d" % R.randrange(5)
                inst(p, x, y, z - 0.1, R.uniform(0, 6.28), R.uniform(1.25, 1.75), R.uniform(0.85, 1.15))
    for k in range(60):
        x, y = R.uniform(x0 + 6, x1 - 6), R.uniform(y0 + 6, y1 - 6)
        if free(x, y):
            inst("decid%d" % R.randrange(5), x, y, terrain_z(x, y, field) - 0.1, R.uniform(0, 6.28), R.uniform(1.0, 1.4), R.uniform(0.85, 1.15))
    # the village's own backdrop: a ring of firs on the hill behind it
    for k in range(60):
        a = R.uniform(0.15, math.pi - 0.15)
        rr = R.uniform(48, 70)
        x, y = 5 + rr * math.cos(a), 10 + rr * math.sin(a) * 0.7
        if free(x, y):
            inst("fir%d" % R.randrange(6), x, y, terrain_z(x, y, field) - 0.1, R.uniform(0, 6.28), R.uniform(0.8, 1.2), R.uniform(0.9, 1.1))
    # hedgerow bushes along the east road and around farms; rocks along the river banks
    for pr in [PROFILES["road_east"], PROFILES["road_west"]]:
        pts = pr["pts"]
        for k in range(0, len(pts), 9):
            p = pts[k]
            a = pts[max(0, k - 2)]; b = pts[min(len(pts) - 1, k + 2)]
            d = Vector((b[0] - a[0], b[1] - a[1])).normalized()
            for sgn in (-1, 1):
                if R.random() < 0.55:
                    x, y = p[0] - d.y * 3.6 * sgn, p[1] + d.x * 3.6 * sgn
                    if not L.in_rect((x, y), L.VILLAGE_GROUND, pad=2) and L.dist_to_polyline((x, y), river) > 8:
                        inst("bush%d" % R.randrange(3), x, y, terrain_z(x, y, field), math.atan2(d.y, d.x), R.uniform(0.8, 1.3))
    for k in range(0, len(river), 2):
        p = river[k]
        a = river[max(0, k - 1)]; b = river[min(len(river) - 1, k + 1)]
        d = Vector((b[0] - a[0], b[1] - a[1])).normalized()
        for sgn in (-1, 1):
            if R.random() < 0.5:
                x, y = p[0] - d.y * R.uniform(3.4, 4.6) * sgn, p[1] + d.x * R.uniform(3.4, 4.6) * sgn
                if L.in_rect((x, y), L.BOARD, pad=-1):
                    inst("rock%d" % R.randrange(3), x, y, terrain_z(x, y, field) - 0.15, R.uniform(0, 6.28), R.uniform(0.6, 1.5))


# ------------------------------------------------------------------ water
def build_river(field):
    water = clay("RiverResin", P.srgb('#2f6f9a'), rough=0.08, sss=0.0, dimple=0.3, dimple_scale=1.2, var=0.15, coat=0.8, wear=0.0)
    lib.tag(water, "water", P.srgb('#2f6f9a'), 0.08)
    pts = L.catmull(L.RIVER, 1.5)
    pts = [p for p in pts if L.in_rect(p, L.BOARD, pad=-0.5)]
    zs = [water_level(p[1]) for p in pts]
    ribbon("River", pts, zs, 6.4, 0.05, water,
           profile=[(-3.3, -0.3), (-3.1, 0.0), (3.1, 0.0), (3.3, -0.3)])


# ------------------------------------------------------------------ trains (animated in the browser)
def build_trains():
    out = []
    for name in L.ROUTES:
        col = P.srgb(L.ROUTE_COLORS[name])
        paint = lib.glossy_paint("Train_" + name, col, rough=0.35)
        black = clay("TrainBlack", (0.03, 0.03, 0.035), rough=0.35, coat=0.6, wear=0.05)
        gold = lib.glossy_paint("Gold", P.GOLD, rough=0.3, metallic=0.6)
        glow = window_glow("CoachGlow", color=(1.0, 0.6, 0.25), strength=1.8, frost=False)
        cream = clay("Cream", P.CREAM, rough=0.65)
        # engine: boiler, cab, chimney, dome, wheels, cowcatcher (local +x forward)
        e = []
        e.append(lathe("boiler", [(0.0, 0.0), (0.78, 0.0), (0.8, 4.0), (0.0, 4.0)], (0, 0, 0), paint, segs=20, smooth_subd=0))
        e[-1].rotation_euler = (0, math.pi / 2, 0); e[-1].location = (-1.6, 0, 1.75)
        e.append(box("cab", (1.9, 2.3, 2.3), (-2.4, 0, 2.15), paint, bevel=0.1, subd=2, wobble=0.01))
        e.append(box("cabroof", (2.3, 2.6, 0.2), (-2.4, 0, 3.35), black, bevel=0.06, subd=1, wobble=0))
        e.append(box("cabwin", (0.06, 1.6, 0.7), (-1.43, 0, 2.6), glow, bevel=0.02, subd=0, wobble=0))
        e.append(lathe("chimney", [(0.32, 0.0), (0.26, 0.9), (0.45, 1.2), (0.0, 1.25)], (1.8, 0, 2.4), black, segs=14, smooth_subd=0))
        e.append(blob("dome", (0.4, 0, 2.55), 0.4, gold, squash=(1, 1, 0.8), subd=2, lump=0))
        e.append(box("frame", (5.6, 1.9, 0.35), (-0.3, 0, 0.75), black, bevel=0.06, subd=1, wobble=0))
        for wx in (-2.4, -0.9, 0.6, 1.8):
            for sgn in (-1, 1):
                w = lathe("wheel", [(0.0, -0.08), (0.48 if wx < 1 else 0.35, -0.08), (0.48 if wx < 1 else 0.35, 0.08), (0.0, 0.08)],
                          (wx, sgn * 0.85, 0.5 if wx < 1 else 0.37), cream if wx < 1 else black, segs=16, smooth_subd=0)
                w.rotation_euler = (math.pi / 2, 0, 0)
                e.append(w)
        e.append(prism("cowcatcher", [(0.0, 0.0), (0.0, 0.7), (0.9, 0.0)], 1.8, (2.4, -0.9, 0.2), black, axis='Z', bevel=0.03, subd=0,
                       wobble=0))
        e[-1].rotation_euler = (math.pi / 2, 0, 0); e[-1].location = (2.4, 0.9, 0.2)
        e.append(blob("lamp", (2.45, 0, 2.0), 0.18, lib.emissive("LampBulb", (1.0, 0.8, 0.5), 40), subd=2, lump=0))
        out.append(_join_proto("train_%s_engine" % name, e))
        c = []
        c.append(box("coach", (5.8, 2.4, 2.2), (0, 0, 1.85), paint, bevel=0.12, subd=2, wobble=0.01))
        c.append(box("croof", (6.0, 2.6, 0.25), (0, 0, 3.05), black, bevel=0.1, subd=1, wobble=0))
        c.append(snow_slab("crsnow", (5.6, 2.2, 0.15), (0, 0, 3.2), (0, 0, 0), lump=0.05, smooth=2))
        for k in range(4):
            for sgn in (-1, 1):
                c.append(box("cw", (0.9, 0.05, 0.7), (-2.0 + k * 1.33, sgn * 1.22, 2.05), glow, bevel=0.02, subd=0, wobble=0))
        c.append(box("cframe", (5.6, 1.9, 0.3), (0, 0, 0.72), black, bevel=0.05, subd=1, wobble=0))
        for wx in (-1.9, -1.1, 1.1, 1.9):
            for sgn in (-1, 1):
                w = lathe("cwheel", [(0.0, -0.07), (0.38, -0.07), (0.38, 0.07), (0.0, 0.07)], (wx, sgn * 0.85, 0.4), black, segs=12,
                          smooth_subd=0)
                w.rotation_euler = (math.pi / 2, 0, 0)
                c.append(w)
        out.append(_join_proto("train_%s_car" % name, c))
    return out


# ------------------------------------------------------------------ entry point
def build():
    import time
    t0 = time.time()
    build_profiles()
    terrain, field = build_terrain()
    print(f"region: terrain {time.time() - t0:.0f}s", flush=True)
    build_railways()
    build_river(field)
    build_station()
    build_square()
    build_sites(field)
    print(f"region: buildings {time.time() - t0:.0f}s", flush=True)
    build_protos()
    place_instances(field)
    build_trains()
    print(f"region: done {time.time() - t0:.0f}s, instances: " +
          ", ".join(f"{k}={len(v)}" for k, v in sorted(INSTANCES.items())), flush=True)
    return field
