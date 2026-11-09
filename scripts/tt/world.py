"""Lighting, sky, camera, falling snow, render + compositor settings.

The scene is lit like a miniature set on a stage: a big warm soft key, cool
fill from the sky, practical lights (windows, lamps, tree), and a warm rim
from behind that makes snow edges glow.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from . import lib
from .lib import RNG


def sky(strength=1.0):
    w = bpy.data.worlds.new("DuskSky")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    nodes, links = nt.nodes, nt.links
    out = nodes.new("ShaderNodeOutputWorld")
    bg = nodes.new("ShaderNodeBackground")
    tc = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.12, 0.08, 0.08, 1)       # below horizon: warm haze
    e = cr.elements.new(0.5); e.color = (0.85, 0.42, 0.22, 1)  # horizon glow (peach)
    e = cr.elements.new(0.56); e.color = (0.22, 0.17, 0.3, 1)  # mauve
    cr.elements[1].position = 0.75
    cr.elements[1].color = (0.05, 0.06, 0.14, 1)        # deep dusk blue
    links.new(sep.outputs[2], ramp.inputs[0])
    links.new(ramp.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    links.new(bg.outputs[0], out.inputs[0])
    w.mist_settings.start = 22
    w.mist_settings.depth = 70
    w.mist_settings.falloff = 'QUADRATIC'
    return w


def area(name, loc, target, size, energy, color, size_y=None, visible=False):
    L = bpy.data.lights.new(name, 'AREA')
    L.shape = 'RECTANGLE' if size_y else 'DISK'
    L.size = size
    if size_y:
        L.size_y = size_y
    L.energy = energy
    L.color = color
    o = bpy.data.objects.new(name, L)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    lib.link(o, "Lights")
    o.visible_camera = visible
    return o


def lighting():
    # warm soft key from front-left, high (studio softbox above the set)
    area("Key", (-14, -16, 13), (1.5, 0, 1.5), 8, 3400, (1.0, 0.62, 0.36))
    # cool sky fill from the right, low and broad
    area("Fill", (18, -12, 5), (2, 0, 2), 14, 700, (0.5, 0.6, 1.0))
    # warm rim from behind-right: snow edges and roofs glow
    area("Rim", (10, 22, 11), (2, 0, 4), 8, 4500, (1.0, 0.6, 0.35))
    # bounce under-fill: keeps clay from going black in shadow (like card bounce)
    area("Bounce", (2, -10, 0.4), (2, 0, 2.5), 8, 250, (1.0, 0.7, 0.5))
    # warm spill pools from the shop windows onto the cobbles
    for x in (-1.65, 1.65):
        area("Spill", (x, -0.75, 1.7), (x, -2.8, 0), 1.4, 450, (1.0, 0.55, 0.22), size_y=0.9)
    for x in (4.95,):
        area("SpillP", (x, -0.45, 1.4), (x, -2.6, 0), 1.6, 300, (1.0, 0.55, 0.25), size_y=0.9)
    # pink house door lantern glow and a warm pool between the houses
    area("SpillDoor", (7.2, -0.5, 2.2), (7.2, -2.0, 0), 1.0, 150, (1.0, 0.55, 0.25), size_y=0.8)
    # practical glow from inside the shop (lights the toys from behind)
    for x in (-1.65, 1.65):
        L = bpy.data.lights.new("Inside", 'POINT'); L.energy = 30; L.color = (1.0, 0.62, 0.3)
        L.shadow_soft_size = 0.4
        o = bpy.data.objects.new("Inside", L); o.location = (x, 0.45, 1.9)
        lib.link(o, "Lights")


def camera(name="Cam", loc=(-6.2, -15.5, 5.2), target=(1.6, -0.6, 2.2), lens=55, fstop=0.55,
           focus=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = fstop
    cd.dof.aperture_blades = 7
    cd.dof.aperture_ratio = 1.0
    cam = bpy.data.objects.new(name, cd)
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    lib.link(cam, "Cameras")
    f = bpy.data.objects.new(name + "_focus", None)
    f.location = focus or target
    lib.link(f, "Cameras")
    cd.dof.focus_object = f
    bpy.context.scene.camera = cam
    return cam


def falling_snow(center=(2, 0, 4), extent=(30, 16, 8), n=1100):
    """Flakes hanging in the air. In a still they become soft bokeh dots."""
    mat = lib.snow("Flake", sss=0.3)
    bm = bmesh.new()
    tmpl = bmesh.new()
    bmesh.ops.create_icosphere(tmpl, subdivisions=1, radius=1.0)
    tv = [v.co.copy() for v in tmpl.verts]
    tf = [[v.index for v in f.verts] for f in tmpl.faces]
    tmpl.free()
    verts = []
    for i in range(n):
        c = Vector((center[0] + RNG.uniform(-1, 1) * extent[0] / 2,
                    center[1] + RNG.uniform(-1, 1) * extent[1] / 2,
                    center[2] + RNG.uniform(-1, 1) * extent[2] / 2))
        if c.z < 0.2:
            continue
        r = RNG.uniform(0.012, 0.028)
        vs = [bm.verts.new(c + Vector((v.x * r, v.y * r, v.z * r * 0.8))) for v in tv]
        for f in tf:
            bm.faces.new([vs[k] for k in f])
    o = lib.mesh_obj("FallingSnow", bm, mat)
    return o


def render_settings(res=(2560, 1440), samples=384, preview=False):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.02 if not preview else 0.05
    s.cycles.use_denoising = True
    s.cycles.denoiser = 'OPENIMAGEDENOISE'
    s.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    s.cycles.max_bounces = 8
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 3
    s.cycles.transmission_bounces = 6
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.blur_glossy = 1.0
    s.cycles.light_sampling_threshold = 0.01
    s.render.resolution_x, s.render.resolution_y = res
    s.render.resolution_percentage = 100
    s.render.film_transparent = False
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Punchy'
    s.view_settings.exposure = 0.6
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_depth = '16'
    vl = s.view_layers[0]
    vl.use_pass_mist = True
    return s


def compositor(fog_color=(0.3, 0.22, 0.26), fog_amt=0.18, glare=True):
    """Atmospheric haze from the mist pass, soft bloom, gentle vignette."""
    s = bpy.context.scene
    s.use_nodes = True
    nt = s.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    nodes, links = nt.nodes, nt.links
    rl = nodes.new("CompositorNodeRLayers")
    comp = nodes.new("CompositorNodeComposite")
    # haze
    mist_curve = nodes.new("CompositorNodeMath"); mist_curve.operation = 'MULTIPLY'
    links.new(rl.outputs['Mist'], mist_curve.inputs[0]); mist_curve.inputs[1].default_value = fog_amt
    fog = nodes.new("CompositorNodeMixRGB"); fog.blend_type = 'MIX'
    links.new(mist_curve.outputs[0], fog.inputs[0])
    links.new(rl.outputs['Image'], fog.inputs[1])
    fog.inputs[2].default_value = (*fog_color, 1)
    cur = fog.outputs[0]
    if glare:
        g = nodes.new("CompositorNodeGlare")
        g.glare_type = 'FOG_GLOW'
        g.quality = 'HIGH'
        g.threshold = 0.9
        g.size = 8
        g.mix = -0.75
        links.new(cur, g.inputs['Image'])
        cur = g.outputs[0]
        g2 = nodes.new("CompositorNodeGlare")
        g2.glare_type = 'BLOOM'
        g2.threshold = 1.2
        g2.size = 7
        g2.mix = -0.85
        links.new(cur, g2.inputs['Image'])
        cur = g2.outputs[0]
    # vignette
    em = nodes.new("CompositorNodeEllipseMask")
    em.width = 0.95; em.height = 0.9
    bl = nodes.new("CompositorNodeBlur"); bl.size_x = 300; bl.size_y = 300; bl.filter_type = 'GAUSS'
    bl.use_relative = True
    bl.factor_x = 25; bl.factor_y = 25
    links.new(em.outputs[0], bl.inputs[0])
    vm = nodes.new("CompositorNodeMapRange")
    links.new(bl.outputs[0], vm.inputs[0])
    vm.inputs[3].default_value = 0.72
    vm.inputs[4].default_value = 1.0
    mul = nodes.new("CompositorNodeMixRGB"); mul.blend_type = 'MULTIPLY'
    mul.inputs[0].default_value = 1.0
    links.new(cur, mul.inputs[1]); links.new(vm.outputs[0], mul.inputs[2])
    links.new(mul.outputs[0], comp.inputs[0])
    return nt
