"""Townspeople for the national story: a parent, a child and a volunteer.

Built exactly like the Marine (sculpted clay parts skinned onto the same humanoid armature, the same
hand-authored walk / idle cycles), so they move and read as one stop-motion cast. marine.py is not modified:
its builder is reused by temporarily swapping in a different wardrobe (parts + materials).
"""
import math

from mathutils import Matrix, Vector

from .lib import clay
from . import marine as Mr

srgb = Mr.srgb
OUTFITS = {
    # coat, trousers, hat, hat brim / pompom, scarf, scarf stripe, mittens, boots, skin, cheek, hair, coat length, head scale
    "parent": dict(coat='#2f6b55', trouser='#2c2f45', hat='#a8322f', pom='#f0e2c4', scarf='#e2b04a', stripe='#a8322f',
                   mitt='#a8322f', boot='#5a3a26', skin='#8a5a3c', cheek='#9a5848', hair='#1a120e', coat_bottom=0.56, head=1.28),
    "child": dict(coat='#3f74b8', trouser='#2c2f45', hat='#e2b04a', pom='#f6f2ea', scarf='#a8322f', stripe='#f0e2c4',
                  mitt='#e2b04a', boot='#a8322f', skin='#8a5a3c', cheek='#a05a4a', hair='#1a120e', coat_bottom=0.62, head=1.5),
    "volunteer": dict(coat='#f0e2c4', trouser='#3b3f58', hat='#2f6b55', pom='#a8322f', scarf='#a8322f', stripe='#f0e2c4',
                      mitt='#2f6b55', boot='#4a3022', skin='#e2a47c', cheek='#e88f78', hair='#7a4b2a', coat_bottom=0.8, head=1.28,
                      vest='#a8322f'),
}


def wardrobe(o):
    felt = dict(rough=0.82, sss=0.03, dimple=0.7, grain=1.6, dimple_scale=9, var=0.14, sheen=0.15, bump=0.6, wear=0.04)
    knit = dict(rough=0.9, sss=0.03, dimple=1.4, grain=2.2, dimple_scale=16, var=0.18, sheen=0.2, bump=0.9, wear=0.05)
    m = {
        "coat": clay("PCoat_" + o['coat'], srgb(o['coat']), **felt),
        "trouser": clay("PTrouser_" + o['trouser'], srgb(o['trouser']), **felt),
        "hat": clay("PHat_" + o['hat'], srgb(o['hat']), **knit),
        "pom": clay("PPom_" + o['pom'], srgb(o['pom']), **knit),
        "scarf": clay("PScarf_" + o['scarf'], srgb(o['scarf']), **knit),
        "stripe": clay("PStripe_" + o['stripe'], srgb(o['stripe']), **knit),
        "mitt": clay("PMitt_" + o['mitt'], srgb(o['mitt']), **knit),
        "boot": clay("PBoot_" + o['boot'], srgb(o['boot']), rough=0.5, sss=0.0, dimple=0.4, var=0.08, coat=0.3, wear=0.05),
        "skin": clay("PSkin_" + o['skin'], srgb(o['skin']), rough=0.55, sss=0.35, dimple=0.7, dimple_scale=6, var=0.1),
        "cheek": clay("PCheek_" + o['cheek'], srgb(o['cheek']), rough=0.6, sss=0.35, dimple=0.5, var=0.05),
        "hair": clay("PHair_" + o['hair'], srgb(o['hair']), rough=0.7, sss=0.05, dimple=1.2, dimple_scale=14, var=0.15, wear=0.08),
        "eye": clay("MarineEye", srgb('#0d0b0b'), rough=0.08, sss=0.0, dimple=0.0, var=0.0, coat=1.0, wear=0.0),
        "white": clay("MarineWhite", srgb('#f2eee4'), rough=0.6, sss=0.12, dimple=0.8, var=0.06, sheen=0.15),
        "button": clay("PButton", srgb('#5a3a26'), rough=0.4, sss=0.0, dimple=0.3, var=0.08, coat=0.4),
    }
    if 'vest' in o:
        m["vest"] = clay("PVest_" + o['vest'], srgb(o['vest']), **felt)
    return m


def coat_r(z, bottom):
    """Winter coat: fuller than the dress jacket, flaring to its hem."""
    pts = [(bottom, 0.23, 0.17), (0.86, 0.205, 0.155), (0.97, 0.19, 0.145), (1.12, 0.2, 0.15), (1.24, 0.21, 0.155), (1.3, 0.19, 0.14), (1.34, 0.1, 0.09)]
    for (z0, a0, b0), (z1, a1, b1) in zip(pts, pts[1:]):
        if z <= z1:
            t = (z - z0) / max(1e-6, z1 - z0)
            return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
    return pts[-1][1], pts[-1][2]


def parts(o):
    P = Mr.PARTS
    P.clear()
    add, sphere, tube, ctube, lathe, box, smooth = Mr.add, Mr.sphere_bm, Mr.tube_bm, Mr.curve_tube_bm, Mr.lathe_bm, Mr.box_bm, Mr.smooth_bm
    bottom = o['coat_bottom']
    # ---- legs: trousers into rounded boots
    for s, x in (("L", 1), ("R", -1)):
        add(tube((0.1 * x, 0, 0.9), (0.1 * x, 0.0, 0.16), 0.085, 0.08, segs=18, rings=12, sy=0.95), "trouser", [f"thigh.{s}", f"shin.{s}"])
        add(smooth(box((0.1 * x, -0.035, 0.08), (0.14, 0.27, 0.16), bevel=0.05), 1), "boot", [f"foot.{s}"])
        add(tube((0.1 * x, 0.0, 0.2), (0.1 * x, 0.0, 0.07), 0.088, 0.09, segs=18, rings=4), "boot", [f"shin.{s}"])
    # ---- the coat: one lathed body that flares to its hem, a row of toggles, a soft collar
    import bmesh  # noqa
    from . import lib
    prof = [(0.0, bottom)] + [(1.0, z / 100) for z in range(int(bottom * 100), 134, 3)] + [(0.0, 1.345)]
    bm = lib.lathe_bm(prof, 36, 0.0, 0)
    for v in bm.verts:
        rx, ry = coat_r(v.co.z, bottom)
        L = math.hypot(v.co.x, v.co.y)
        if L > 1e-6:
            a = math.atan2(v.co.y, v.co.x); v.co.x, v.co.y = rx * math.cos(a), ry * math.sin(a)
    add(bm, "coat", ["hips", "spine", "chest"])
    if 'vest' in o:   # the volunteer's warm vest over a cream sweater
        vb = lib.lathe_bm([(0.0, 0.92)] + [(1.0, z / 100) for z in range(92, 132, 3)] + [(0.0, 1.32)], 36, 0.0, 0)
        for v in vb.verts:
            rx, ry = coat_r(v.co.z, bottom)
            L = math.hypot(v.co.x, v.co.y)
            if L > 1e-6:
                a = math.atan2(v.co.y, v.co.x)
                open_front = 0.0 if abs(a + math.pi / 2) > 0.35 else -0.03
                v.co.x, v.co.y = (rx + 0.012 + open_front) * math.cos(a), (ry + 0.012 + open_front) * math.sin(a)
        add(vb, "vest", ["hips", "spine", "chest"])
    for i in range(4):
        z = 1.24 - i * 0.1
        rx, ry = coat_r(z, bottom)
        add(sphere((0.0, -ry - 0.008, z), 0.02, (1, 0.5, 1), 2, 0.0), "button", ["spine" if z < 1.15 else "chest"])
    add(ctube([(coat_r(bottom + 0.01, bottom)[0] * 1.02 * math.cos(2 * math.pi * k / 48), coat_r(bottom + 0.01, bottom)[1] * 1.02 * math.sin(2 * math.pi * k / 48), bottom + 0.01) for k in range(49)], 0.014), "coat", ["hips"])
    # ---- sleeves and knitted mittens
    for s, x in (("L", 1), ("R", -1)):
        add(smooth(box((0.15 * x, 0, 1.31), (0.12, 0.13, 0.06), 0.03), 1), "coat", ["chest"])
        add(tube((0.205 * x, 0, 1.3), (0.27 * x, 0, 0.84), 0.075, 0.066, segs=18, rings=12), "coat", [f"upper_arm.{s}", f"forearm.{s}"])
        add(tube((0.27 * x, 0, 0.88), (0.272 * x, 0, 0.83), 0.07, 0.07, segs=18, rings=3), "stripe" if 'vest' not in o else "coat", [f"forearm.{s}"])
        add(sphere((0.275 * x, -0.005, 0.76), 0.072, (0.9, 0.8, 1.1), 3, 0.08), "mitt", [f"hand.{s}"])
        add(sphere((0.275 * x - 0.048 * x, -0.04, 0.79), 0.03, (1, 1, 1.3), 2, 0.06, Matrix.Rotation(0.4 * x, 3, 'Y')), "mitt", [f"hand.{s}"])
    # ---- head (same sculpt as the Marine's, no cap) with a knitted hat and a chunky scarf
    head_start = len(P)
    H = Vector((0, -0.005, 1.53)); hr = (0.165 * 0.95, 0.165 * 0.92, 0.165 * 1.08)

    def face(dx, dz, out=0.0):
        k = max(0.0, 1 - (dx / hr[0]) ** 2 - (dz / hr[2]) ** 2)
        return H + Vector((dx, -hr[1] * math.sqrt(k) - out, dz))
    add(sphere(H, 0.165, (0.95, 0.92, 1.08), 4, 0.025), "skin", ["head"])
    add(sphere((0, -0.03, 1.415), 0.065, (1, 1, 0.8), 3, 0.0), "skin", ["neck"])
    for x in (-1, 1):
        add(sphere(H + Vector((0.158 * x, 0.01, -0.005)), 0.036, (0.55, 0.9, 1.15), 3, 0.05), "skin", ["head"])
        add(sphere(face(0.058 * x, 0.012, -0.004), 0.02, (1, 0.6, 1.25), 3, 0.0), "eye", ["head"])
        add(sphere(face(0.064 * x, 0.024, 0.005), 0.0055, (1, 1, 1), 1, 0.0), "white", ["head"])
        add(ctube([face(0.058 * x + 0.034 * (t - 0.5) * x, 0.062 + 0.012 * math.sin(t * math.pi), 0.002) for t in [k / 8 for k in range(9)]], 0.0075), "hair", ["head"])
        add(sphere(face(0.095 * x, -0.04, -0.012), 0.032, (1, 0.45, 0.75), 2, 0.0), "cheek", ["head"])
        add(sphere(H + Vector((0.15 * x, 0.0, 0.03)), 0.04, (0.45, 0.85, 1.1), 3, 0.15), "hair", ["head"])
    add(sphere(face(0.0, -0.02, 0.012), 0.032, (1.1, 0.9, 0.95), 3, 0.03), "skin", ["head"])
    add(ctube([face(0.05 * (t - 0.5) * 2, -0.072 - 0.018 * math.sin(t * math.pi), -0.002) for t in [k / 12 for k in range(13)]], 0.0065), "hair", ["head"])
    add(sphere(H + Vector((0, 0.06, 0.02)), 0.155, (1.0, 0.95, 0.85), 3, 0.12), "hair", ["head"])
    # knitted hat: dome, rolled brim, pompom
    add(smooth(lathe([(0.0, 1.71), (0.172, 1.62), (0.168, 1.66), (0.14, 1.74), (0.08, 1.79), (0.0, 1.8)], 32, 1.0, 1.0), 1), "hat", ["head"])
    add(ctube([(0.176 * math.cos(2 * math.pi * k / 40), 0.17 * math.sin(2 * math.pi * k / 40), 1.625) for k in range(41)], 0.03), "pom" if o['pom'] != o['hat'] else "hat", ["head"])
    add(sphere((0, 0.0, 1.83), 0.062, (1, 1, 1), 3, 0.35), "pom", ["head"])
    if o['head'] != 1.28 or True:
        pivot = Vector((0, 0, 1.37))
        for bm_, mk, cand in P[head_start:]:
            if cand == ["head"]:
                for v in bm_.verts:
                    v.co = pivot + (v.co - pivot) * o['head']
    # chunky scarf wrapped at the neck, one tail hanging over the chest (stripes knitted in)
    for k in range(3):
        add(ctube([(0.11 * math.cos(2 * math.pi * j / 30), 0.1 * math.sin(2 * math.pi * j / 30), 1.33 + 0.035 * k) for j in range(31)], 0.034), "scarf" if k != 1 else "stripe", ["neck", "chest"])
    add(ctube([(0.06, -0.11, 1.33), (0.075, -0.15, 1.24), (0.08, -0.16, 1.14), (0.075, -0.16, 1.07)], 0.04), "scarf", ["chest"])
    add(ctube([(0.077, -0.162, 1.1), (0.078, -0.163, 1.085)], 0.042), "stripe", ["chest"])


def build(kind, name=None, location=(0, 0, 0)):
    """Build one townsperson with the Marine's rig and clips. Returns (armature_object, mesh_object)."""
    o = OUTFITS[kind]
    M = wardrobe(o)
    saved = Mr.mats, Mr.build_parts
    try:
        Mr.mats = lambda: M
        Mr.build_parts = lambda: parts(o)
        ao, mo = Mr.build(name or kind.capitalize(), location=location, gift=False)
    finally:
        Mr.mats, Mr.build_parts = saved
    return ao, mo
