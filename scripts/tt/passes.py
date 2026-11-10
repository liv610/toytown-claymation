"""Light groups + EXR pass outputs for the hybrid (re-lightable) pipeline.

Every emitter is assigned to a light group.  Cycles then writes each group's
contribution as its own image; summing them reproduces the beauty render
exactly, so lights can be dimmed/flickered per frame in post for free.
"""
import json
import math
import os

import bpy
from mathutils import Vector

GROUPS = ["ambient", "shop", "pink", "lampW", "lampE", "tree1", "tree2", "tree3", "treeglow",
          "star", "garland", "bg"]


def _root(o):
    while o.parent:
        o = o.parent
    return o


def assign_lightgroups():
    s = bpy.context.scene
    vl = s.view_layers[0]
    for g in GROUPS:
        if g not in vl.lightgroups:
            vl.lightgroups.add(name=g)
    s.world.lightgroup = "ambient"
    fl = 0
    counts = {g: 0 for g in GROUPS}
    for o in s.objects:
        lg = "ambient"
        r = _root(o).name
        if o.type == 'LIGHT':
            n = o.name
            if n.startswith(("SpillP", "SpillDoor")):
                lg = "pink"
            elif n.startswith(("Spill", "Inside", "awnLight", "Interior")):
                lg = "shop"
            elif n.startswith("LampWest"):
                lg = "lampW"
            elif n.startswith("LampEast"):
                lg = "lampE"
            elif n.startswith("starLight"):
                lg = "star"
            elif n.startswith("treeGlow"):
                lg = "treeglow"
        elif o.type in ('MESH', 'FONT', 'CURVE') and o.data and hasattr(o.data, "materials"):
            mats = [m.name for m in o.data.materials if m]
            if any(m in ("ShopGlow", "UpperGlow", "InteriorShade") for m in mats):
                lg = "shop"
            elif any(m in ("PinkGlow", "LampShade") for m in mats):
                lg = "pink"
            elif "BgGlow" in mats:
                lg = "bg"
            elif any(m in ("LampGlass", "LampBulb") for m in mats):
                lg = "lampW" if r == "LampWest" else "lampE"
            elif "FairyLight" in mats:
                lg = "tree%d" % (fl % 3 + 1)
                fl += 1
            elif "StarGlow" in mats:
                lg = "star"
            elif "Bulb" in mats:
                lg = "garland"
        o.lightgroup = lg
        counts[lg] += 1
    print("lightgroups:", counts)


def setup_outputs(out_dir, lightgroups=True, denoise_groups=True):
    """Compositor: write denoised Combined, each light group, Depth and Mist
    as EXR sequences into out_dir/<pass>/<pass>_####.exr."""
    s = bpy.context.scene
    vl = s.view_layers[0]
    vl.use_pass_z = True
    vl.use_pass_mist = True
    vl.cycles.denoising_store_passes = True
    s.use_nodes = True
    nt = s.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    nodes, links = nt.nodes, nt.links
    rl = nodes.new("CompositorNodeRLayers")
    comp = nodes.new("CompositorNodeComposite")
    links.new(rl.outputs['Image'], comp.inputs['Image'])

    def fout(name, depth32=False):
        f = nodes.new("CompositorNodeOutputFile")
        f.base_path = os.path.join(out_dir, name) + os.sep
        f.format.file_format = 'OPEN_EXR'
        f.format.color_depth = '32' if depth32 else '16'
        f.format.exr_codec = 'ZIP'
        f.file_slots[0].path = name + "_"
        return f

    links.new(rl.outputs['Image'], fout("combined").inputs[0])
    if not denoise_groups:   # strip mode: keep the denoiser's guides, denoise after stitching
        links.new(rl.outputs['Denoising Normal'], fout("dn_normal").inputs[0])
        links.new(rl.outputs['Denoising Albedo'], fout("dn_albedo").inputs[0])
    links.new(rl.outputs['Depth'], fout("depth", True).inputs[0])
    links.new(rl.outputs['Mist'], fout("mist", True).inputs[0])
    if lightgroups:
        names = [o.name for o in rl.outputs]
        for g in GROUPS:
            sock = None
            for cand in (g, "Combined_" + g):
                if cand in names:
                    sock = rl.outputs[cand]
            if sock is None:
                print("WARNING: no socket for lightgroup", g, names)
                continue
            src = sock
            if denoise_groups:
                dn = nodes.new("CompositorNodeDenoise")
                dn.prefilter = 'ACCURATE'
                links.new(sock, dn.inputs['Image'])
                links.new(rl.outputs['Denoising Normal'], dn.inputs['Normal'])
                links.new(rl.outputs['Denoising Albedo'], dn.inputs['Albedo'])
                src = dn.outputs[0]
            links.new(src, fout("lg_" + g).inputs[0])


def camera_meta(cam, path, extra=None, frames=None):
    """Write per-frame camera data so post-processing can project 3D snow."""
    s = bpy.context.scene
    out = {"res": [s.render.resolution_x, s.render.resolution_y], "frames": {}}
    fr = frames or [s.frame_current]
    for f in fr:
        s.frame_set(f)
        cd = cam.data
        fd = (cd.dof.focus_object.matrix_world.translation - cam.matrix_world.translation)
        fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        out["frames"][str(f)] = {
            "matrix_world": [list(r) for r in cam.matrix_world],
            "lens": cd.lens, "sensor": cd.sensor_width, "fstop": cd.dof.aperture_fstop,
            "focus": fd.dot(fwd),
        }
    if extra:
        out.update(extra)
    with open(path, "w") as fh:
        json.dump(out, fh, indent=1)


def screen_bbox(objs, cam):
    """Pixel bbox (x0, y0, x1, y1; top-left origin) of objects as seen by cam."""
    from bpy_extras.object_utils import world_to_camera_view
    s = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    W, H = s.render.resolution_x, s.render.resolution_y
    xs, ys = [], []
    for o in objs:
        oe = o.evaluated_get(dg)
        for c in oe.bound_box:
            p = world_to_camera_view(s, cam, oe.matrix_world @ Vector(c))
            xs.append(p.x * W)
            ys.append((1 - p.y) * H)
    return [min(xs), min(ys), max(xs), max(ys)]
