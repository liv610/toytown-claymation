"""Package the Cycles light-group passes for the hybrid browser viewer.

  blender -b --factory-startup --python scripts/post/export_hybrid.py -- \
      --passes renders/passes/hero --door renders/passes/door --out web/hybrid/assets

Light groups become *display-space deltas*: D_g = display(beauty + k*P_g) - display(beauty).
In the browser: colour = base + sum((gain_g - 1)/k * D_g).  Exact at gain 1 and 1+k,
and a close approximation for the gentle flicker / brightening we use.
"""
import json
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exr  # noqa: E402
import composite as C  # noqa: E402

K = 0.6
WEB_GROUPS = ["shop", "pink", "lampW", "lampE", "tree1", "tree2", "tree3", "star", "garland", "bg"]


def to_display(lin, scene, tmp):
    exr.save_display(lin, tmp, scene)
    img = bpy.data.images.load(tmp, check_existing=False)
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return np.flipud(a.reshape(h, w, 4))[..., :3]


_raw = {}


def save_raw(arr, path, alpha=None):
    h, w = arr.shape[:2]
    key = (w, h)
    img = _raw.get(key)
    if img is None:
        img = bpy.data.images.new("raw_%dx%d" % key, w, h, alpha=True, float_buffer=False)
        img.colorspace_settings.name = 'Non-Color'
        _raw[key] = img
    a = np.ones((h, w, 4), np.float32)
    a[..., :arr.shape[2] if arr.ndim == 3 else 1] = arr if arr.ndim == 3 else arr[..., None]
    if alpha is not None:
        a[..., 3] = alpha
    img.pixels.foreach_set(np.flipud(np.clip(a, 0, 1)).ravel())
    img.filepath_raw = path
    ext = os.path.splitext(path)[1].lower()
    img.file_format = {'.png': 'PNG', '.jpg': 'JPEG', '.webp': 'WEBP'}[ext]
    if ext == '.png':
        img.save(filepath=path)
    else:
        img.save(filepath=path, quality=90)


def main():
    o = C.args()
    out = o["out"]
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, "_tmp.png")
    meta = json.load(open(os.path.join(o["passes"], "camera.json")))
    W, H = meta["res"]
    S = C.load_set(o["passes"], W, H)
    scene = C.scene_for_display()
    lg = S["lg"]
    for i in (1, 2, 3):
        lg["tree%d" % i] = lg["tree%d" % i] + lg["treeglow"] / 3
    lin0 = S["combined"]
    fin = lambda x: C.finish(x, S["mist"])  # noqa: E731
    base = to_display(fin(lin0), scene, tmp)
    save_raw(base, os.path.join(out, "base.webp"))
    save_raw(base, os.path.join(out, "base_lossless.png"))
    deltas = {}
    for g in WEB_GROUPS:
        D = to_display(fin(lin0 + K * lg[g]), scene, tmp) - base
        save_raw(np.clip(D * 2, 0, 1), os.path.join(out, f"d_{g}.png"))
        deltas[g] = f"d_{g}.png"
        print("delta", g, float(D.max()), flush=True)
    # depth -> 16-bit inverse depth packed in R,G (conservative 2x downsample: keep nearest surface)
    z = S["depth"]
    iz = 1.0 / np.clip(z, 1.0, 200.0)
    iz = iz.reshape(H // 2, 2, W // 2, 2).max(axis=(1, 3))
    u = np.round((iz - 1 / 200) / (1 - 1 / 200) * 65535).astype(np.int64)
    dep = np.zeros((H // 2, W // 2, 3), np.float32)
    dep[..., 0] = (u // 256) / 255.0
    dep[..., 1] = (u % 256) / 255.0
    save_raw(dep, os.path.join(out, "depth.png"))
    # local practical glow (display space), for tinting flakes / smoke
    amb = to_display(fin(lg["ambient"]), scene, tmp)
    local = C.blur(C.resize(np.clip(base - amb, 0, None), W // 8, H // 8), 4)
    save_raw(np.sqrt(np.clip(local, 0, 1)), os.path.join(out, "local.png"))
    lower = base[int(H * 0.75):].reshape(-1, 3)
    lum = lower.mean(1)
    flake = lower[lum > np.percentile(lum, 80)].mean(0) * 0.95
    # door: crop frames finished at the door render's resolution, mapped into plate pixels
    door = {"frames": [], "rect": [0, 0, 1, 1], "hotspot": meta.get("door_bbox", [0, 0, 1, 1])}
    if o.get("door"):
        dd = o["door"]
        crop = json.load(open(os.path.join(dd, "crop.json")))
        dmeta = json.load(open(os.path.join(dd, "camera.json")))
        dW, dH = dmeta["res"]
        x0, y0, x1, y1 = [int(round(v)) for v in crop["crop"]]
        S2 = C.load_set(o["passes"], dW, dH)
        feather = 14
        yy, xx = np.mgrid[y0:y1, x0:x1]
        e = np.minimum.reduce([xx - x0, x1 - 1 - xx, yy - y0, (y1 - 1 - yy) if y1 < dH else np.full_like(yy, 10 ** 6)])
        mask = np.clip(e / feather, 0, 1).astype(np.float32)
        sc = W / dW
        rx0, ry0, rx1, ry1 = int(x0 * sc), int(y0 * sc), int(x1 * sc), int(y1 * sc)
        for k in range(1, crop["frames"] + 1):
            dc = C.resize(exr.load_pass(dd, "combined", k), dW, dH)
            full = S2["combined"].copy()
            full[y0:y1, x0:x1] = full[y0:y1, x0:x1] * (1 - mask[..., None]) + dc[y0:y1, x0:x1] * mask[..., None]
            disp = to_display(C.finish(full, S2["mist"]), scene, tmp)
            patch = C.resize(disp[y0:y1, x0:x1], rx1 - rx0, ry1 - ry0)
            am = C.resize(mask[..., None], rx1 - rx0, ry1 - ry0)[..., 0]
            fn = f"door_{k:02d}.png"
            save_raw(patch, os.path.join(out, fn), alpha=am)
            door["frames"].append(fn)
            print("door frame", k, flush=True)
        door["rect"] = [rx0, ry0, rx1, ry1]
    rt = json.load(open(o.get("rt_scene", "web/realtime/assets/scene.json")))
    cx, cy, cz = rt["chimney"]
    info = {"res": [W, H], "base": "base.webp", "depth": "depth.png", "local": "local.png",
            "groups": WEB_GROUPS, "deltas": deltas, "delta_gain": K,
            "camera": meta["frames"]["1"], "flake_color": [float(v) for v in flake],
            "chimney": [cx, -cz, cy], "door": door}
    json.dump(info, open(os.path.join(out, "hybrid.json"), "w"), indent=1)
    os.remove(tmp)
    print("hybrid assets written to", out)


main()
