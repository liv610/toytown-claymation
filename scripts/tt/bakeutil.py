"""Shared bits of the visual-quality bake: OIDN denoise + scale/sRGB encode of one baked atlas."""
import os
import bpy
import numpy as np


def denoise_encode(key, size, hgt, out_dir):
    """bake_<key>_raw.exr -> bake_<key>_dn_0001.exr (OIDN) -> bake_<key>.png (divided by a scale, sRGB). Returns the scale."""
    main = bpy.context.window.scene
    ds = bpy.data.scenes.get("Denoise")
    if ds is None:
        ds = bpy.data.scenes.new("Denoise"); ds.render.engine = 'CYCLES'; ds.cycles.samples = 1
        cam = bpy.data.objects.new("dc", bpy.data.cameras.new("dc")); ds.collection.objects.link(cam); ds.camera = cam
    ds.use_nodes = True
    ds.render.resolution_x, ds.render.resolution_y, ds.render.resolution_percentage = size, hgt, 100
    nt = ds.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    im = bpy.data.images.load(os.path.join(out_dir, f"bake_{key}_raw.exr"), check_existing=False)
    im.colorspace_settings.name = 'Non-Color'
    a_ = nt.nodes.new("CompositorNodeImage"); a_.image = im
    dn = nt.nodes.new("CompositorNodeDenoise"); dn.prefilter = 'NONE'
    fo = nt.nodes.new("CompositorNodeOutputFile"); fo.base_path = out_dir + os.sep
    fo.format.file_format = 'OPEN_EXR'; fo.format.color_depth = '32'; fo.file_slots[0].path = f"bake_{key}_dn_"
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(a_.outputs[0], dn.inputs['Image']); nt.links.new(dn.outputs[0], fo.inputs[0]); nt.links.new(dn.outputs[0], comp.inputs[0])
    bpy.context.window.scene = ds; ds.frame_current = 1
    bpy.ops.render.render(write_still=False)
    dim = bpy.data.images.load(os.path.join(out_dir, f"bake_{key}_dn_0001.exr"), check_existing=False)
    dim.colorspace_settings.name = 'Non-Color'
    px = np.empty(size * hgt * 4, np.float32); dim.pixels.foreach_get(px); px = px.reshape(hgt, size, 4)[..., :3]
    scale = float(np.percentile(px, 99.6)) * 1.05 + 1e-4
    enc = np.clip(px / scale, 0, 1)
    enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
    out = bpy.data.images.new("enc_" + key, size, hgt, alpha=False); out.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((hgt, size, 4), np.float32); rgba[..., :3] = enc
    out.pixels.foreach_set(rgba.ravel()); out.filepath_raw = os.path.join(out_dir, f"bake_{key}.png"); out.file_format = 'PNG'; out.save()
    bpy.context.window.scene = main
    return scale


def bake_to(ob, key, size, hgt, out_dir):
    img = bpy.data.images.new(f"bake_{key}_img", size, hgt, alpha=False, float_buffer=True)
    for m in ob.data.materials:
        if m and m.use_nodes:
            n = m.node_tree.nodes.get("BakeTarget") or m.node_tree.nodes.new("ShaderNodeTexImage")
            n.name = "BakeTarget"; n.image = img; m.node_tree.nodes.active = n
    s = bpy.context.window.scene
    for o in s.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='COMBINED', pass_filter={'EMIT', 'DIRECT', 'INDIRECT', 'DIFFUSE'}, margin=8, use_clear=True)
    img.filepath_raw = os.path.join(out_dir, f"bake_{key}_raw.exr"); img.file_format = 'OPEN_EXR'; img.save()
