"""After rebake_props.py: objects hidden by the first bake's faulty grouping (stale matrix_world put
every root at the origin, inside the crop) go back to the live export unless a bake target holds them.

  blender -b renders/hq/bake/hq_baked.blend --python scripts/unhide_live.py
"""
import bpy
from mathutils import Vector
s = bpy.data.scenes["Scene"]
CROP = (-6.6, 11.6, -7.6, 0.9); PAD = 1.5
BIG = ["Cobbles", "StreetBed", "SnowEdges", "SnowGround"]
GROUND = ("bank", "walldrift", "edgelump", "fgdrift", "sqdrift")
taken = set(c.name for c in bpy.data.objects["DoorHinge"].children_recursive) | set(c.name for c in bpy.data.objects["BlueShop"].children_recursive) \
    | set(c.name for c in bpy.data.objects["PinkHouse"].children_recursive)


def root_of(o):
    while o.parent:
        o = o.parent
    return o


def in_bake(o):
    if o.name in taken or o.name in BIG or o.name.startswith(GROUND):
        return True          # every drift object went to the street target (same stale-matrix bug) and is baked there
    r = root_of(o); c = r.matrix_world.translation if r is not o else o.matrix_world @ (sum((Vector(b) for b in o.bound_box), Vector()) / 8)
    if r.name in ("BlueShop", "PinkHouse"):
        return True
    if r.name in ("FirFG", "FirGap", "FirR1") or not (CROP[0] < c.x < CROP[1] and CROP[2] < c.y < CROP[3]):
        return False
    w = [o.matrix_world @ Vector(b) for b in o.bound_box]
    return min(v.x for v in w) > CROP[0] - PAD and max(v.x for v in w) < CROP[1] + PAD and \
        min(v.y for v in w) > CROP[2] - PAD and max(v.y for v in w) < CROP[3] + PAD


n = 0
for o in s.objects:
    if o.type in ('MESH', 'CURVE', 'FONT') and o.hide_render and not o.name.startswith("BAKE_") \
            and not any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection) and not in_bake(o):
        o.hide_render = False; n += 1
print("UNHIDE", n, "objects back to live", flush=True)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
