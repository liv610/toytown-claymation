import bpy, sys
from mathutils import Vector
out = sys.argv[sys.argv.index("--") + 1]
s = bpy.data.scenes["Scene"]; bpy.context.window.scene = s
cam = s.camera or bpy.data.objects.new("RefCam", bpy.data.cameras.new("RefCam")); s.camera = cam
if cam.name not in s.collection.all_objects: s.collection.objects.link(cam)
loc, tgt, lens = Vector((-7.6, -16.4, 5.2)), Vector((2.4, 0.0, 4.15)), 36
cam.location = loc; cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
cam.data.dof.use_dof = False
s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = 960, 540, 100
s.cycles.samples = 64; s.cycles.use_denoising = True
print("VIEW", s.view_settings.view_transform, s.view_settings.look, s.view_settings.exposure, flush=True)
s.render.filepath = out; bpy.ops.render.render(write_still=True)
