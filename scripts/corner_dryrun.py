"""Dry run for the textile corner split: build the region village exactly as export_region.py does, classify every
object with tt/corner.py and check that the split is clean. Writes a JSON report; exports nothing.

  blender -b --factory-startup --python scripts/corner_dryrun.py -- REPORT.json
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
TT_IMPORT_ONLY = True
exec(open(os.path.join(HERE, "build_scene.py")).read())
import bpy  # noqa
from mathutils import Vector  # noqa
from tt import street, region, buildings as Bld, corner  # noqa
out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
t0 = time.time(); street.REGION = True; build(); region.build()
print(f"built {time.time() - t0:.0f}s", flush=True)
objs = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'FONT', 'CURVE') and not o.hide_render
        and not any(c.name == "Cutters" or c.name.endswith("_cut") for c in o.users_collection)]
protos = set(o.name for o in bpy.data.collections["Protos"].objects)
door = set(o.name for o in Bld.DOOR_HINGE.children_recursive)
rep = {"corner_roots": {}, "base_near": [], "split": [], "problems": []}
def bbox(o):
    ps = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return [min(p.x for p in ps), max(p.x for p in ps), min(p.y for p in ps), max(p.y for p in ps), min(p.z for p in ps), max(p.z for p in ps)]
for o in objs:
    if o.name in protos:
        continue
    b = bbox(o)
    if corner.is_split_object(o):
        rep["split"].append({"name": o.name, "bbox": b}); continue
    if corner.is_corner_object(o):
        t = corner.top(o).name; rep["corner_roots"][t] = rep["corner_roots"].get(t, 0) + 1
        continue
    # a base object overlapping the corner's buildings or street stretch: report it (it would stay clay inside the corner)
    x0, x1, y0, y1 = corner.STREET_RECT
    if b[1] > x0 and b[0] < x1 and b[3] > y0 and b[2] < 3.5 and (b[1] - b[0]) < 30:
        rep["base_near"].append({"name": o.name, "root": corner.top(o).name, "bbox": [round(v, 2) for v in b]})
# checks
missing_door = [n for n in door if not corner.is_corner_object(bpy.data.objects[n])]
if missing_door: rep["problems"].append({"door_parts_outside_corner": missing_door})
if corner.top(Bld.DOOR_HINGE).name != "BlueShop": rep["problems"].append("door hinge is not under BlueShop")
rep["door_parts"] = len(door)
rep["lights"] = [{"name": o.name, "pos": [round(v, 2) for v in o.matrix_world.translation]} for o in bpy.context.scene.objects if o.type == 'LIGHT']
json.dump(rep, open(out, "w"), indent=1)
print("corner roots", rep["corner_roots"]); print("split", [s["name"] for s in rep["split"]])
print("base objects near the corner:", len(rep["base_near"])); print("problems", rep["problems"])
print(f"done {time.time() - t0:.0f}s")
