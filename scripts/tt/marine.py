"""A claymation Marine in dress blues, carrying a present.

Built like a stop-motion puppet *and* a game character at once:
  * sculpted clay parts (felt uniform, glossy shoes, gold buttons, red piping)
  * one skinned mesh on a simple humanoid armature (weights from distance to
    each part's candidate bones, so trousers bend at the knee, sleeves at the elbow)
  * a hand-authored walk cycle (24 frames, in place: the game moves him along a path)

The character faces -Y in Blender (= +Z in glTF/three.js).  Height ~1.75 m.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

from . import lib
from .lib import clay

R = random.Random(1775)  # own RNG: never disturbs the scene's random sequence


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mats():
    felt = dict(rough=0.78, sss=0.03, dimple=0.6, grain=1.6, dimple_scale=9, var=0.12, sheen=0.12, bump=0.5, wear=0.04)
    return {
        "coat": clay("MarineCoat", srgb('#16213f'), **felt),
        "trouser": clay("MarineTrouser", srgb('#283c7c'), **felt),
        "red": clay("MarineRed", srgb('#a3141c'), rough=0.5, sss=0.05, dimple=0.3, var=0.08, sheen=0.05, wear=0.05),
        "gold": clay("MarineGold", srgb('#d9a83c'), rough=0.28, sss=0.0, dimple=0.3, var=0.1, metallic=0.85, coat=0.4),
        "white": clay("MarineWhite", srgb('#f2eee4'), rough=0.6, sss=0.12, dimple=0.8, var=0.06, sheen=0.15),
        "black": clay("MarineBlack", srgb('#0e0e12'), rough=0.18, sss=0.0, dimple=0.3, var=0.05, coat=0.9, wear=0.03),
        "skin": clay("MarineSkin", srgb('#e2a47c'), rough=0.55, sss=0.35, dimple=0.7, dimple_scale=6, var=0.1),
        "cheek": clay("MarineCheek", srgb('#e88f78'), rough=0.6, sss=0.35, dimple=0.5, var=0.05),
        "hair": clay("MarineHair", srgb('#3b2418'), rough=0.7, sss=0.05, dimple=1.2, dimple_scale=14, var=0.15, wear=0.08),
        "eye": clay("MarineEye", srgb('#0d0b0b'), rough=0.08, sss=0.0, dimple=0.0, var=0.0, coat=1.0, wear=0.0),
        "giftred": clay("GiftRed", srgb('#b8161e'), rough=0.42, sss=0.05, dimple=0.6, dimple_scale=10, var=0.1, coat=0.25, wear=0.08),
        "giftgold": clay("GiftGold", srgb('#e2b448'), rough=0.3, sss=0.0, dimple=0.3, var=0.08, metallic=0.7, coat=0.3),
    }


# ---------------------------------------------------------------- bones (rest pose)
BONES = {  # name: (head, tail, parent)
    "root": ((0, 0, 0), (0, 0, 0.25), None),
    "hips": ((0, 0, 0.86), (0, 0, 1.0), "root"),
    "spine": ((0, 0, 1.0), (0, 0, 1.18), "hips"),
    "chest": ((0, 0, 1.18), (0, 0, 1.33), "spine"),
    "neck": ((0, 0, 1.33), (0, 0, 1.39), "chest"),
    "head": ((0, 0, 1.39), (0, 0, 1.76), "neck"),
}
for s, x in (("L", 1), ("R", -1)):
    BONES.update({
        f"thigh.{s}": ((0.1 * x, 0, 0.88), (0.1 * x, 0, 0.47), "hips"),
        f"shin.{s}": ((0.1 * x, 0, 0.47), (0.1 * x, 0.0, 0.1), f"thigh.{s}"),
        f"foot.{s}": ((0.1 * x, 0.0, 0.1), (0.1 * x, -0.16, 0.03), f"shin.{s}"),
        f"upper_arm.{s}": ((0.215 * x, 0, 1.29), (0.25 * x, 0, 1.03), "chest"),
        f"forearm.{s}": ((0.25 * x, 0, 1.03), (0.27 * x, 0, 0.8), f"upper_arm.{s}"),
        f"hand.{s}": ((0.27 * x, 0, 0.8), (0.275 * x, 0, 0.7), f"forearm.{s}"),
    })


def seg_dist(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


# ---------------------------------------------------------------- part builders
PARTS = []   # (bmesh, material key, candidate bones)


def add(bm, mat, bones):
    PARTS.append((bm, mat, bones))


def lathe_bm(profile, segs=28, sx=1.0, sy=1.0, center=(0, 0, 0), wob=0.0):
    bm = lib.lathe_bm(profile, segs, wob, R.random() * 10)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co += Vector(center)
    return bm


def smooth_bm(bm, levels=1):
    """Catmull-Clark via a temporary mesh + modifier (keeps parts soft like clay)."""
    me = bpy.data.meshes.new("tmp")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("tmp", me)
    bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new("s", 'SUBSURF')
    m.levels = levels
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    out = bmesh.new()
    out.from_mesh(me2)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(me2)
    return out


def sphere_bm(center, r, squash=(1, 1, 1), subd=3, lump=0.03, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subd, radius=r)
    s = R.random() * 50
    for v in bm.verts:
        n = noise.noise(v.co * (1.5 / max(r, 0.02)) + Vector((s, s, s)))
        v.co *= 1 + lump * n
        v.co = Vector((v.co.x * squash[0], v.co.y * squash[1], v.co.z * squash[2]))
        if rot:
            v.co = rot @ v.co
        v.co += Vector(center)
    return bm


def box_bm(center, size, bevel=0.01, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel, segments=3, affect='EDGES')
    for v in bm.verts:
        if rot:
            v.co = rot @ v.co
        v.co += Vector(center)
    return bm


def tube_bm(a, b, r0, r1, segs=16, rings=8, sy=1.0, wob=0.03):
    """Tapered capsule-ish tube between points a and b (soft clay limb)."""
    a, b = Vector(a), Vector(b)
    axis = (b - a)
    L = axis.length
    q = axis.normalized().to_track_quat('Z', 'Y')
    prof = [(0.0, -r0 * 0.6)]
    for i in range(rings + 1):
        t = i / rings
        r = r0 + (r1 - r0) * t
        prof.append((r, L * t))
    prof.append((0.0, L + r1 * 0.6))
    bm = lib.lathe_bm(prof, segs, wob, R.random() * 10)
    M = q.to_matrix()
    for v in bm.verts:
        v.co.y *= sy
        v.co = M @ v.co + a
    return bm


def curve_tube_bm(points, r, segs=8):
    """Thin piping / trim following a polyline."""
    bm = bmesh.new()
    rings = []
    pts = [Vector(p) for p in points]
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n1 = d.orthogonal().normalized()
        n2 = d.cross(n1)
        ring = [bm.verts.new(p + (n1 * math.cos(2 * math.pi * k / segs) + n2 * math.sin(2 * math.pi * k / segs)) * r)
                for k in range(segs)]
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    return bm


def torso_profile_point(z, ang):
    """Surface of the jacket (elliptical, flared skirt) for placing trim."""
    rx, ry = jacket_r(z)
    return Vector((rx * math.cos(ang), ry * math.sin(ang), z))


def jacket_r(z):
    # chest 0.2 x 0.14, waist 0.18 x 0.13, flared skirt at 0.78
    pts = [(0.76, 0.215, 0.155), (0.86, 0.195, 0.14), (0.95, 0.182, 0.13), (1.1, 0.192, 0.135),
           (1.22, 0.205, 0.145), (1.29, 0.19, 0.13), (1.33, 0.1, 0.085)]
    for (z0, a0, b0), (z1, a1, b1) in zip(pts, pts[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
    return pts[-1][1], pts[-1][2]


def build_parts():
    PARTS.clear()
    # --- legs (trousers): wide straight felt tubes, blood stripe down the outer seam
    for s, x in (("L", 1), ("R", -1)):
        add(tube_bm((0.1 * x, 0, 0.9), (0.1 * x, 0.0, 0.13), 0.092, 0.088, segs=20, rings=12, sy=0.95),
            "trouser", [f"thigh.{s}", f"shin.{s}"])
        add(curve_tube_bm([(0.1 * x + 0.09 * x, 0, z / 20 * 0.76 + 0.14) for z in range(21)], 0.01),
            "red", [f"thigh.{s}", f"shin.{s}"])
        # shoe: glossy black clay, rounded toe
        add(smooth_bm(box_bm((0.1 * x, -0.045, 0.05), (0.13, 0.29, 0.1), bevel=0.035), 1), "black", [f"foot.{s}"])
    # --- jacket (one lathed body, elliptical), skirt flare
    prof = [(0.0, 0.76)] + [(1.0, z / 100) for z in range(76, 134, 3)] + [(0.0, 1.335)]
    bm = lib.lathe_bm([(r, z) for r, z in prof], 36, 0.0, 0)
    for v in bm.verts:
        z = v.co.z
        rx, ry = jacket_r(z)
        L = math.hypot(v.co.x, v.co.y)
        if L > 1e-6:
            a = math.atan2(v.co.y, v.co.x)
            v.co.x, v.co.y = rx * math.cos(a), ry * math.sin(a)
    add(bm, "coat", ["hips", "spine", "chest"])
    # red piping: down the front opening, around the hem, standing collar
    add(curve_tube_bm([torso_profile_point(z / 40 * (1.32 - 0.77) + 0.77, -math.pi / 2 + 0.03) + Vector((0.0, -0.006, 0))
                       for z in range(41)], 0.008), "red", ["hips", "spine", "chest"])
    add(curve_tube_bm([torso_profile_point(0.77, 2 * math.pi * k / 48) * 1.02 for k in range(49)], 0.009), "red", ["hips"])
    # collar
    add(lathe_bm([(0.0, 1.31), (0.082, 1.31), (0.085, 1.38), (0.0, 1.38)], 28, 1.0, 0.9), "coat", ["neck"])
    add(curve_tube_bm([(0.086 * math.cos(2 * math.pi * k / 40), 0.077 * math.sin(2 * math.pi * k / 40), 1.38) for k in range(41)], 0.007),
        "red", ["neck"])
    # gold buttons down the front (6) + collar badges
    for i in range(6):
        z = 1.25 - i * 0.075
        p = torso_profile_point(z, -math.pi / 2 + 0.12)
        add(sphere_bm(p + Vector((0, -0.008, 0)), 0.017, (1, 0.55, 1), 2, 0.0), "gold", ["spine" if z < 1.15 else "chest"])
    for x in (-1, 1):
        add(sphere_bm((0.055 * x, -0.07, 1.355), 0.014, (1, 0.5, 1), 2, 0.0), "gold", ["neck"])
    # chest pocket flaps + buttons
    for x in (-1, 1):
        p = torso_profile_point(1.16, -math.pi / 2 + 0.75 * x)
        add(smooth_bm(box_bm(p + Vector((0, -0.006, 0)), (0.085, 0.015, 0.04), 0.005,
                             Matrix.Rotation(-0.55 * x, 3, 'Z')), 1), "coat", ["chest"])
        add(sphere_bm(p + Vector((0, -0.02, -0.004)), 0.011, (1, 0.5, 1), 2, 0.0), "gold", ["chest"])
    # white belt + gold buckle
    belt = lathe_bm([(0.0, 0.905), (1.0, 0.905), (1.0, 0.955), (0.0, 0.955)], 36)
    for v in belt.verts:
        rx, ry = jacket_r(v.co.z)
        a = math.atan2(v.co.y, v.co.x)
        L = math.hypot(v.co.x, v.co.y)
        if L > 1e-6:
            v.co.x, v.co.y = (rx + 0.008) * math.cos(a), (ry + 0.008) * math.sin(a)
    add(belt, "white", ["hips"])
    add(smooth_bm(box_bm((0, -0.142, 0.93), (0.075, 0.02, 0.06), 0.006), 1), "gold", ["hips"])
    # epaulets + shoulders
    for s, x in (("L", 1), ("R", -1)):
        add(smooth_bm(box_bm((0.15 * x, 0, 1.33), (0.11, 0.08, 0.025), 0.01), 1), "coat", ["chest"])
        add(curve_tube_bm([(0.15 * x + 0.055 * math.cos(a) * x, 0.04 * math.sin(a), 1.343) for a in
                           [math.pi * k / 20 - math.pi / 2 for k in range(21)]], 0.006), "red", ["chest"])
        # sleeve: shoulder to wrist (bends at elbow via weights)
        add(tube_bm((0.205 * x, 0, 1.3), (0.27 * x, 0, 0.83), 0.068, 0.058, segs=18, rings=12), "coat",
            [f"upper_arm.{s}", f"forearm.{s}"])
        # cuff piping + cuff buttons
        add(curve_tube_bm([(0.27 * x + 0.06 * math.cos(2 * math.pi * k / 24), 0.06 * math.sin(2 * math.pi * k / 24), 0.875)
                           for k in range(25)], 0.007), "red", [f"forearm.{s}"])
        for dz in (0.0, 0.03):
            add(sphere_bm((0.27 * x + 0.055 * x, -0.02, 0.9 + dz), 0.01, (0.5, 1, 1), 1, 0.0), "gold", [f"forearm.{s}"])
        # white glove: a soft mitten
        add(sphere_bm((0.275 * x, -0.005, 0.76), 0.074, (0.85, 0.78, 1.12), 3, 0.06), "white", [f"hand.{s}"])
        add(sphere_bm((0.275 * x - 0.045 * x, -0.045, 0.785), 0.03, (1, 1, 1.4), 2, 0.05,
                      Matrix.Rotation(0.4 * x, 3, 'Y')), "white", [f"hand.{s}"])
    # corporal chevrons on the upper sleeves (two red/gold stripes)
    for s, x in (("L", 1), ("R", -1)):
        for k in range(2):
            z = 1.13 - k * 0.032
            pts = []
            for j in range(13):
                t = (j / 12) * 2 - 1
                pts.append((0.229 * x + 0.064 * x * math.cos(t * 0.9), 0.064 * math.sin(t * 0.9), z + 0.035 * (1 - abs(t))))
            add(curve_tube_bm(pts, 0.009), "red", [f"upper_arm.{s}"])
            add(curve_tube_bm([(p[0] + 0.004 * x, p[1], p[2] + 0.009) for p in pts], 0.004), "gold", [f"upper_arm.{s}"])
    # --- head: big rounded clay head, ears, nose, eyes, brows, smile, hair
    head_start = len(PARTS)
    H = Vector((0, -0.005, 1.53))
    hr = (0.165 * 0.95, 0.165 * 0.92, 0.165 * 1.08)

    def face(dx, dz, out=0.0):
        """Point on the front of the head sphere (so features sit on the face)."""
        k = max(0.0, 1 - (dx / hr[0]) ** 2 - (dz / hr[2]) ** 2)
        return H + Vector((dx, -hr[1] * math.sqrt(k) - out, dz))
    add(sphere_bm(H, 0.165, (0.95, 0.92, 1.08), 4, 0.025), "skin", ["head"])
    add(sphere_bm((0, -0.03, 1.415), 0.065, (1, 1, 0.8), 3, 0.0), "skin", ["neck"])
    for x in (-1, 1):
        add(sphere_bm(H + Vector((0.158 * x, 0.01, -0.005)), 0.036, (0.55, 0.9, 1.15), 3, 0.05), "skin", ["head"])
        add(sphere_bm(face(0.058 * x, 0.012, -0.004), 0.02, (1, 0.6, 1.25), 3, 0.0), "eye", ["head"])
        add(sphere_bm(face(0.064 * x, 0.024, 0.005), 0.0055, (1, 1, 1), 1, 0.0), "white", ["head"])  # catchlight
        add(curve_tube_bm([face(0.058 * x + 0.034 * (t - 0.5) * x, 0.062 + 0.012 * math.sin(t * math.pi), 0.002)
                           for t in [k / 8 for k in range(9)]], 0.0075), "hair", ["head"])
        add(sphere_bm(face(0.095 * x, -0.04, -0.012), 0.032, (1, 0.45, 0.75), 2, 0.0), "cheek", ["head"])
        # sideburns / hair under the cap
        add(sphere_bm(H + Vector((0.148 * x, -0.005, 0.055)), 0.034, (0.42, 0.85, 0.95), 3, 0.12), "hair", ["head"])
    add(sphere_bm(face(0.0, -0.02, 0.012), 0.032, (1.1, 0.9, 0.95), 3, 0.03), "skin", ["head"])  # nose
    add(curve_tube_bm([face(0.05 * (t - 0.5) * 2, -0.072 - 0.018 * math.sin(t * math.pi), -0.002)
                       for t in [k / 12 for k in range(13)]], 0.0065), "hair", ["head"])  # smile line
    add(sphere_bm(H + Vector((0, 0.05, 0.07)), 0.15, (1.0, 1.0, 0.75), 3, 0.12), "hair", ["head"])  # back hair
    # --- cap: white crown, black band, glossy visor, gold badge & chinstrap buttons
    add(lathe_bm([(0.0, 1.66), (0.16, 1.655), (0.168, 1.68), (0.0, 1.69)], 36, 1.0, 1.0, (0, 0, 0)), "black", ["head"])
    add(smooth_bm(lathe_bm([(0.0, 1.685), (0.165, 1.685), (0.2, 1.72), (0.205, 1.755), (0.17, 1.785), (0.0, 1.795)],
                           36, 1.0, 0.98, (0, 0.0, 0.0)), 1), "white", ["head"])
    vis = bmesh.new()
    bmesh.ops.create_cone(vis, segments=32, radius1=0.13, radius2=0.13, depth=0.014, cap_ends=True)
    for v in vis.verts:
        if v.co.y > 0:
            v.co.y *= 0.2
        v.co.y = v.co.y * 0.9 - 0.13
        v.co.z += 1.665 - 0.06 * max(0, -v.co.y - 0.1)
    add(smooth_bm(vis, 1), "black", ["head"])
    add(curve_tube_bm([(0.165 * math.cos(a), 0.165 * math.sin(a) * 0.97, 1.66 - 0.02 * math.sin(max(0, -math.sin(a)) * 3))
                       for a in [math.pi + math.pi * k / 16 for k in range(17)]], 0.007), "black", ["head"])
    add(sphere_bm((0, -0.19, 1.725), 0.03, (1, 0.35, 1.05), 3, 0.08), "gold", ["head"])  # generic badge
    for x in (-1, 1):
        add(sphere_bm((0.162 * x, -0.04, 1.665), 0.011, (0.5, 1, 1), 1, 0.0), "gold", ["head"])
    # toy proportions: a big head (about a quarter of the height), scaled about the neck
    pivot = Vector((0, 0, 1.37))
    for bm_, mk, cand in PARTS[head_start:]:
        if cand == ["head"]:
            for v in bm_.verts:
                v.co = pivot + (v.co - pivot) * 1.28


def build_gift(c, yaw=0.25):
    """Present carried in the left hand (built at its posed position)."""
    parts = []
    c = Vector(c)
    rot = Matrix.Rotation(yaw, 3, 'Z')
    parts.append((smooth_bm(box_bm(c, (0.24, 0.2, 0.2), 0.02, rot), 1), "giftred"))
    parts.append((box_bm(c, (0.245, 0.04, 0.205), 0.004, rot), "giftgold"))
    parts.append((box_bm(c, (0.04, 0.205, 0.205), 0.004, rot), "giftgold"))
    for x in (-1, 1):
        parts.append((sphere_bm(c + rot @ Vector((0.04 * x, 0, 0.115)), 0.04, (1.4, 0.55, 0.9), 2, 0.1,
                                Matrix.Rotation(0.5 * x, 3, 'Y')), "giftgold"))
    parts.append((sphere_bm(c + Vector((0, 0, 0.11)), 0.022, (1, 1, 1), 2, 0.0), "giftgold"))
    for p, m in parts:
        PARTS.append((p, m, ["hand.L"]))


def build(name="Marine", location=(0, 0, 0), rot_z=0.0, collection="Set", gift=True):
    """Create armature + skinned mesh.  Returns (armature_object, mesh_object)."""
    M = mats()
    build_parts()
    # armature
    arm = bpy.data.armatures.new(name + "_rig")
    ao = bpy.data.objects.new(name, arm)
    lib.link(ao, collection)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, (h, t, p) in BONES.items():
        eb = arm.edit_bones.new(bn)
        eb.head, eb.tail = h, t
        eb.roll = 0.0
        if p:
            eb.parent = arm.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ao.pose.bones:
        pb.rotation_mode = 'XYZ'
    if gift:
        # the present rides on the left hand: place it where the *posed* hand is,
        # then map it back into the hand's rest space so skinning carries it there
        pose_at(ao, 0)
        bpy.context.view_layer.update()
        pb = ao.pose.bones["hand.L"]
        D = pb.matrix @ pb.bone.matrix_local.inverted()
        hand = pb.matrix.translation
        n0 = len(PARTS)
        build_gift(hand + Vector((-0.06, 0.02, 0.115)))
        Di = D.inverted()
        for part, mk, cand in PARTS[n0:]:
            for v in part.verts:
                v.co = Di @ v.co
        for b in ao.pose.bones:
            b.rotation_euler = (0, 0, 0)
            b.location = (0, 0, 0)
    bm = bmesh.new()
    mat_keys, vweights = [], []
    for part, mk, cand in PARTS:
        if mk not in mat_keys:
            mat_keys.append(mk)
        mi = mat_keys.index(mk)
        for f in part.faces:
            f.material_index = mi
        for v in part.verts:
            if len(cand) == 1:
                vweights.append({cand[0]: 1.0})
                continue
            ds = sorted((seg_dist(v.co, BONES[b][0], BONES[b][1]), b) for b in cand)
            d0 = ds[0][0]
            w = {b: math.exp(-((d - d0) / 0.035) ** 2) for d, b in ds}
            tot = sum(w.values())
            vweights.append({b: x / tot for b, x in w.items() if x / tot > 0.01})
        me = bpy.data.meshes.new("p")
        part.to_mesh(me)
        part.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    for mk in mat_keys:
        me.materials.append(M[mk])
    mo = bpy.data.objects.new(name + "_body", me)
    lib.link(mo, collection)
    groups = {b: mo.vertex_groups.new(name=b) for b in BONES}
    for i, w in enumerate(vweights):
        for b, x in w.items():
            groups[b].add([i], x, 'REPLACE')
    mo.parent = ao
    mod = mo.modifiers.new("rig", 'ARMATURE')
    mod.object = ao
    ao.location = location
    ao.rotation_euler = (0, 0, rot_z)
    return ao, mo


# ---------------------------------------------------------------- walk cycle
CYCLE = 24


def walk_pose(f):
    """Joint angles (degrees, bone-local XYZ) for frame f of the cycle.
    Down-pointing bones: -X swings forward.  Up-pointing bones: Y twists, Z leans."""
    p = 2 * math.pi * f / CYCLE
    P = {}
    for s, ph in (("L", 0.0), ("R", math.pi)):
        q = p + ph
        thigh = 24 * math.sin(q)
        knee = 6 + 52 * max(0.0, math.cos(q + 0.45)) ** 1.6       # big lift mid-swing
        P[f"thigh.{s}"] = (-thigh, 0, 0)
        P[f"shin.{s}"] = (knee, 0, 0)
        P[f"foot.{s}"] = (thigh - knee + 4, 0, 0)                  # keep the sole level
    # free right arm swings with the left leg; left arm hugs the present
    P["upper_arm.R"] = (-20 * math.sin(p), 0, 4)
    P["forearm.R"] = (-(12 + 16 * max(0.0, math.sin(p))), 0, 0)
    P["upper_arm.L"] = (-6 + 2 * math.sin(2 * p), 0, -4)
    P["forearm.L"] = (-58 + 3 * math.sin(2 * p), 0, 10)
    P["hand.L"] = (0, 0, 0)
    P["hips"] = (0, 6 * math.sin(p), 2.5 * math.sin(p))
    P["spine"] = (2, -4 * math.sin(p), -1.2 * math.sin(p))
    P["chest"] = (0, -3 * math.sin(p), 0)
    P["head"] = (-1.5 + 1.5 * math.cos(2 * p), 2 * math.sin(p), 0)
    bob = -0.028 * math.cos(2 * p) + 0.006
    sway = 0.014 * math.sin(p)
    return P, bob, sway


def walk_free_pose(f):
    """Walk with both arms swinging (no present)."""
    P, bob, sway = walk_pose(f)
    p = 2 * math.pi * f / CYCLE
    P["upper_arm.L"] = (20 * math.sin(p), 0, -4)
    P["forearm.L"] = (-(12 + 16 * max(0.0, -math.sin(p))), 0, 0)
    return P, bob, sway


IDLE = 48


def idle_pose(f, carry=False):
    """Standing: soft knees, breathing chest, a little weight shift."""
    p = 2 * math.pi * f / IDLE
    P = {}
    for s, x in (("L", 1), ("R", -1)):
        P[f"thigh.{s}"] = (-1.5, 0, 0)
        P[f"shin.{s}"] = (3, 0, 0)
        P[f"foot.{s}"] = (-1.5, 0, 0)
        P[f"upper_arm.{s}"] = (-3 + 1.0 * math.sin(p), 0, 3 * x * -1)
        P[f"forearm.{s}"] = (-12 - 2 * math.sin(p), 0, 0)
    if carry:
        P["upper_arm.L"] = (-6 + 1.0 * math.sin(p), 0, -4)
        P["forearm.L"] = (-58 + 1.5 * math.sin(p), 0, 10)
    P["hand.L"] = (0, 0, 0)
    P["hips"] = (0, 0, 0.8 * math.sin(p * 0.5 * 2))
    P["spine"] = (1.0 + 1.2 * math.sin(p), 0, 0)
    P["chest"] = (0.8 * math.sin(p), 0, 0)
    P["head"] = (-1 + 1.2 * math.sin(p + 0.6), 1.5 * math.sin(p * 0.5 * 2 + 1), 0)
    return P, 0.004 * math.sin(p), 0.006 * math.sin(p)


def make_clip(ao, name, fn, frames):
    """Bake a pose function into a named action (kept for the glTF exporter)."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ao.animation_data_create()
    ao.animation_data.action = act
    for f in range(frames + 1):
        P, bob, sway = fn(f % frames)
        for bn, (x, y, z) in P.items():
            pb = ao.pose.bones[bn]
            pb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
            pb.keyframe_insert("rotation_euler", frame=f + 1)
        hb = ao.pose.bones["hips"]
        hb.location = (sway, bob, 0)
        hb.keyframe_insert("location", frame=f + 1)
    for fc in act.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    tr = ao.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 1, act)
    ao.animation_data.action = None
    return act


def make_walk(ao, name="Walk"):
    act = bpy.data.actions.new(name)
    ao.animation_data_create()
    ao.animation_data.action = act
    for f in range(CYCLE + 1):
        P, bob, sway = walk_pose(f % CYCLE)
        for bn, (x, y, z) in P.items():
            pb = ao.pose.bones[bn]
            pb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
            pb.keyframe_insert("rotation_euler", frame=f + 1)
        hb = ao.pose.bones["hips"]
        hb.location = (sway, bob, 0)   # hips bone local: Y points up
        hb.keyframe_insert("location", frame=f + 1)
    for fc in act.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    return act


def pose_at(ao, f):
    """Static pose (for stills): apply frame f of the cycle."""
    P, bob, sway = walk_pose(f)
    for bn, (x, y, z) in P.items():
        ao.pose.bones[bn].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
    ao.pose.bones["hips"].location = (sway, bob, 0)
