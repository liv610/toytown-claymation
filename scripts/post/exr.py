"""EXR <-> numpy helpers using Blender's own image I/O (no extra deps)."""
import glob
import os

import bpy
import numpy as np


def load(path):
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return np.flipud(a.reshape(h, w, 4))  # top-left origin


def find(dirpath, name, frame=1):
    c = glob.glob(os.path.join(dirpath, name, f"{name}_{frame:04d}.exr"))
    return c[0] if c else None


def load_pass(dirpath, name, frame=1, channels=3):
    p = find(dirpath, name, frame)
    if p is None:
        raise FileNotFoundError(f"{dirpath}/{name} frame {frame}")
    a = load(p)
    return a[..., 0] if channels == 1 else a[..., :channels]


_out_img = {}


def save_display(rgb, path, scene):
    """Save a linear image through the scene's view transform (AgX etc.)."""
    h, w = rgb.shape[:2]
    key = (w, h)
    if key not in _out_img:
        img = bpy.data.images.new("post_out_%dx%d" % key, w, h, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Linear Rec.709'
        _out_img[key] = img
    img = _out_img[key]
    a = np.ones((h, w, 4), dtype=np.float32)
    a[..., :3] = rgb
    img.pixels.foreach_set(np.flipud(a).ravel())
    img.update()
    s = scene
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_depth = '8'
    s.render.image_settings.color_mode = 'RGB'
    img.save_render(path, scene=s)
