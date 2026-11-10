"""Fast iteration render of the Marine alone (studio light, snowy floor)."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
from mathutils import Vector
from tt import lib, marine, world
a = sys.argv[sys.argv.index("--") + 1:]
out, frame, res, samples = a[0], int(a[1]), int(a[2]), int(a[3])
view = a[4] if len(a) > 4 else "front"
lib.reset_scene()
world.sky(0.6)
ao, mo = marine.build()
marine.pose_at(ao, frame)
bpy.context.view_layer.update()
for b in ("foot.L", "hand.L", "hand.R", "head"):
    pb = ao.pose.bones[b]; print("BONE", b, tuple(round(c, 3) for c in pb.tail))
lib.box("floor", (8, 8, 0.2), (0, 0, -0.1), lib.snow(), bevel=0, subd=0, wobble=0)
world.area("Key", (-3, -4, 4), (0, 0, 1.1), 2.5, 900, (1.0, 0.7, 0.45))
world.area("Rim", (2.5, 3, 3), (0, 0, 1.3), 2, 700, (1.0, 0.6, 0.35))
world.area("Fill", (4, -3, 1.5), (0, 0, 1), 3, 150, (0.55, 0.65, 1.0))
cams = {"front": ((1.3, -3.2, 1.05), (0.0, 0, 1.0)), "side": ((3.4, -0.3, 1.0), (0, 0, 0.95)),
        "close": ((0.8, -2.0, 0.85), (0.05, 0, 1.15))}
loc, tgt = cams[view]
world.camera("C", loc, tgt, 50, 2.8, tgt)
world.render_settings((res, res), samples, preview=True)
s = bpy.context.scene; s.render.filepath = out
bpy.ops.render.render(write_still=True)
