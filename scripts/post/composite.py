"""Hybrid post pipeline: turn one Cycles render (split into light groups)
into an animated, living shot.

  * lights flicker  -> per-light-group gains, applied to physically rendered passes
  * snow falls      -> 3D flakes in world space, projected through the real camera,
                       occluded by the render's depth pass, defocused with the same
                       thin-lens maths as the camera, lit by the light around them
  * door opens      -> crop renders of the doorway (rendered on twos) spliced in
  * finishing       -> mist haze, bloom, vignette, then the scene's AgX view transform

Run inside Blender (for EXR I/O and colour management):
  blender -b --factory-startup --python scripts/post/composite.py -- --mode loop ...
"""
import json
import math
import os
import random
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exr  # noqa: E402

GROUPS = ["ambient", "shop", "pink", "lampW", "lampE", "tree1", "tree2", "tree3", "treeglow",
          "star", "garland", "bg"]


# --------------------------------------------------------------------------
# image utilities (pure numpy)
# --------------------------------------------------------------------------
def resize(img, w, h):
    """Bilinear resize (also used for downscaling with a pre-blur)."""
    H, W = img.shape[:2]
    if (W, H) == (w, h):
        return img
    if w < W:  # area-ish prefilter for downscaling
        k = W / w
        if k > 1.2:
            img = box_blur(img, max(1, int(k / 2)))
    ys = (np.arange(h) + 0.5) * H / h - 0.5
    xs = (np.arange(w) + 0.5) * W / w - 0.5
    y0 = np.clip(np.floor(ys).astype(int), 0, H - 1); y1 = np.clip(y0 + 1, 0, H - 1)
    x0 = np.clip(np.floor(xs).astype(int), 0, W - 1); x1 = np.clip(x0 + 1, 0, W - 1)
    fy = np.clip(ys - y0, 0, 1)[:, None]; fx = np.clip(xs - x0, 0, 1)[None, :]
    if img.ndim == 3:
        fy = fy[..., None]; fx = fx[..., None]
    a = img[y0][:, x0]; b = img[y0][:, x1]; c = img[y1][:, x0]; d = img[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def box_blur(img, r):
    if r < 1:
        return img
    out = img
    for axis in (0, 1):
        c = np.cumsum(out, axis=axis, dtype=np.float64)
        n = out.shape[axis]
        pad = [(0, 0)] * out.ndim
        pad[axis] = (1, 0)
        c = np.pad(c, pad)
        idx_hi = np.clip(np.arange(n) + r + 1, 0, n)
        idx_lo = np.clip(np.arange(n) - r, 0, n)
        hi = np.take(c, idx_hi, axis=axis); lo = np.take(c, idx_lo, axis=axis)
        cnt = (idx_hi - idx_lo).astype(np.float64)
        shape = [1] * out.ndim; shape[axis] = n
        out = ((hi - lo) / cnt.reshape(shape)).astype(np.float32)
    return out


def blur(img, sigma):
    """Fast gaussian-ish blur: downsample, 3x box, upsample."""
    H, W = img.shape[:2]
    f = max(1, int(sigma / 3))
    small = resize(img, max(1, W // f), max(1, H // f)) if f > 1 else img
    r = max(1, int(round(sigma / f * 0.9)))
    for _ in range(3):
        small = box_blur(small, r)
    return resize(small, W, H) if f > 1 else small


def bloom(img, threshold=0.85, strength=0.32):
    bright = np.clip(img - threshold, 0, None)
    acc = np.zeros_like(img)
    for s, w in ((3, 0.45), (10, 0.3), (32, 0.18), (90, 0.12)):
        acc += w * blur(bright, s * img.shape[1] / 1920)
    return img + strength * acc


def vignette(img, lo=0.74):
    H, W = img.shape[:2]
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    nx = (x / W - 0.5) / 0.55; ny = (y / H - 0.5) / 0.52
    r = np.sqrt(nx * nx + ny * ny)
    v = np.clip(1 - (r - 0.55) / 0.6, 0, 1)
    v = v * v * (3 - 2 * v)
    return img * (lo + (1 - lo) * v)[..., None]


# --------------------------------------------------------------------------
# flicker: every term uses whole cycles per loop so the loop is seamless
# --------------------------------------------------------------------------
class Flicker:
    def __init__(self, T, seed=7):
        r = random.Random(seed)
        self.T = T
        self.ph = {g: [r.random() * 6.283 for _ in range(6)] for g in GROUPS}
        # gas-lamp "gutters": short dips at random but fixed loop times
        self.dips = {g: [(r.uniform(0, T), r.uniform(0.12, 0.3), r.uniform(0.06, 0.14)) for _ in range(2)]
                     for g in ("lampW", "lampE")}

    def _s(self, g, t, harmonics, amps):
        p = self.ph[g]
        return sum(a * math.sin(2 * math.pi * n * t / self.T + p[i]) for i, (n, a) in enumerate(zip(harmonics, amps)))

    def _dip(self, g, t):
        d = 0.0
        for (t0, w, depth) in self.dips.get(g, []):
            dt = min(abs(t - t0), self.T - abs(t - t0))
            d += depth * math.exp(-(dt / w) ** 2)
        return d

    def gains(self, t):
        T = self.T
        g = {"ambient": 1.0}
        # interiors: warm, almost steady, with the soft breathing of a fire / old bulb
        g["shop"] = 1 + self._s("shop", t, (3, 11, 23, 41), (0.012, 0.016, 0.010, 0.007))
        g["pink"] = 1 + self._s("pink", t, (5, 13, 29, 47), (0.018, 0.020, 0.012, 0.008))  # fireside: a bit livelier
        g["bg"] = 1 + self._s("bg", t, (4, 17), (0.015, 0.01))
        # street lamps: gas-lantern shimmer plus the occasional gutter
        for k in ("lampW", "lampE"):
            g[k] = 1 + self._s(k, t, (19, 31, 53, 71), (0.022, 0.018, 0.014, 0.01)) - self._dip(k, t)
        # tree strands twinkle out of phase; overall tree glow follows their average
        for i in range(3):
            n = ("tree1", "tree2", "tree3")[i]
            ph = 2 * math.pi * i / 3
            v = 0.5 + 0.5 * math.sin(2 * math.pi * 6 * t / T + ph) + 0.15 * math.sin(2 * math.pi * 17 * t / T + ph * 2)
            g[n] = 0.72 + 0.42 * max(0.0, min(1.15, v))
        g["treeglow"] = (g["tree1"] + g["tree2"] + g["tree3"]) / 3
        g["star"] = 1 + 0.07 * math.sin(2 * math.pi * 3 * t / T + 0.4)
        g["garland"] = 1 + 0.1 * math.sin(2 * math.pi * 4 * t / T + 1.3)
        return g


# --------------------------------------------------------------------------
# snow
# --------------------------------------------------------------------------
class Snow:
    """World-space flakes in a box around the street. Each flake falls at its own
    speed with a gentle sway; positions wrap vertically so a loop of T seconds is
    seamless (fall speed = whole multiples of box height / T)."""

    def __init__(self, n=11000, box=((-18, 26), (-30, 14), (-0.3, 12.0)), T=10.0, seed=3):
        r = np.random.default_rng(seed)
        (x0, x1), (y0, y1), (z0, z1) = box
        self.z0, self.H = z0, z1 - z0
        self.p0 = np.stack([r.uniform(x0, x1, n), r.uniform(y0, y1, n), r.uniform(z0, z1, n)], 1)
        k = r.choice([1, 1, 1, 2], n)                   # most fall ~1.2 m/s, some faster
        self.v = k * self.H / T
        self.size = r.lognormal(np.log(0.022), 0.35, n).clip(0.01, 0.06)  # flake radius (m)
        self.sway_a = r.uniform(0.05, 0.35, n)
        self.sway_n = r.integers(1, 4, n)
        self.sway_p = r.uniform(0, 6.283, n)
        self.T = T
        self.bright = r.uniform(0.75, 1.1, n)

    def positions(self, t):
        p = self.p0.copy()
        p[:, 2] = self.z0 + np.mod(p[:, 2] - self.z0 - self.v * t, self.H)
        w = 2 * np.pi * self.sway_n * t / self.T + self.sway_p
        p[:, 0] += self.sway_a * np.sin(w)
        p[:, 1] += 0.5 * self.sway_a * np.cos(w * 0.7)
        return p


def project(cam, pts, W, H):
    """World -> pixel (top-left origin) + planar depth, matching Blender's camera."""
    M = np.array(cam["matrix_world"], dtype=np.float64)
    Minv = np.linalg.inv(M)
    ph = np.c_[pts, np.ones(len(pts))] @ Minv.T
    X, Y, Z = ph[:, 0], ph[:, 1], -ph[:, 2]
    fpx = cam["lens"] / cam["sensor"] * W          # sensor fit: horizontal
    with np.errstate(divide='ignore', invalid='ignore'):
        u = W / 2 + fpx * X / Z
        v = H / 2 - fpx * Y / Z
    return u, v, Z, fpx


def draw_snow(img, depth, local_light, snow, cam, t, dt, W, H, base_rgb):
    p = snow.positions(t)
    p2 = snow.positions(t + dt * 0.5)                 # half-frame shutter for a hint of streak
    u, v, Z, fpx = project(cam, p, W, H)
    u2, v2, _, _ = project(cam, p2, W, H)
    wrapped = np.abs(p2[:, 2] - p[:, 2]) > 0.5      # flake wrapped top<->bottom this frame
    u2 = np.where(wrapped, u, u2); v2 = np.where(wrapped, v, v2)
    f = cam["lens"] / 1000.0
    N = max(cam["fstop"], 0.05)
    S = max(cam["focus"], 0.5)
    A = f / N
    vis = (Z > 0.6) & (u > -150) & (u < W + 150) & (v > -150) & (v < H + 150)
    idx = np.nonzero(vis)[0]
    # thin-lens circle of confusion (pixels, diameter)
    coc = A * f * np.abs(Z[idx] - S) / (Z[idx] * (S - f)) / (cam["sensor"] / 1000.0) * W
    rgeo = snow.size[idx] * fpx / Z[idx]
    r = np.maximum(np.maximum(rgeo, coc * 0.5), 0.6)
    r = np.minimum(r, 0.05 * W)
    alpha = np.clip((np.maximum(rgeo, 0.6) / r) ** 2, 0.025, 1.0) * 0.95
    sh, sw = local_light.shape[:2]
    order = np.argsort(-Z[idx])                        # far to near
    for j in order:
        i = idx[j]
        cx, cy, rr = u[i], v[i], r[j]
        ex, ey = u2[i] - cx, v2[i] - cy
        x0 = int(max(0, math.floor(min(cx, cx + ex) - rr - 2))); x1 = int(min(W, math.ceil(max(cx, cx + ex) + rr + 2)))
        y0 = int(max(0, math.floor(min(cy, cy + ey) - rr - 2))); y1 = int(min(H, math.ceil(max(cy, cy + ey) + rr + 2)))
        if x1 <= x0 or y1 <= y0:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        # distance to the motion segment
        L2 = ex * ex + ey * ey
        if L2 > 1e-6:
            tt = np.clip(((xx - cx) * ex + (yy - cy) * ey) / L2, 0, 1)
            dx = xx - (cx + tt * ex); dy = yy - (cy + tt * ey)
        else:
            dx = xx - cx; dy = yy - cy
        d = np.sqrt(dx * dx + dy * dy)
        if rr < 1.6:
            prof = np.exp(-(d / max(rr, 0.6)) ** 2 * 1.3)
        else:
            prof = np.clip(rr + 0.5 - d, 0, 1)        # bokeh disc, soft 1px edge
        a = prof * alpha[j]
        occl = depth[y0:y1, x0:x1] > Z[i]
        a = a * occl
        if not a.any():
            continue
        lx = int(np.clip(cx / W * sw, 0, sw - 1)); ly = int(np.clip(cy / H * sh, 0, sh - 1))
        col = (base_rgb + local_light[ly, lx]) * snow.bright[i]
        a = a[..., None]
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + col * a


# --------------------------------------------------------------------------
# shot assembly
# --------------------------------------------------------------------------
def load_set(d, W, H, groups=True):
    cam = json.load(open(os.path.join(d, "camera.json")))
    S = {"cam": cam}
    rw, rh = cam["res"]
    S["combined"] = resize(exr.load_pass(d, "combined"), W, H)
    S["depth"] = resize(exr.load_pass(d, "depth", channels=1), W, H)
    S["mist"] = resize(exr.load_pass(d, "mist", channels=1), W, H)
    if groups:
        S["lg"] = {g: resize(exr.load_pass(d, "lg_" + g), W, H) for g in GROUPS}
    S["scale"] = W / rw
    return S


def snow_base_color(ambient, H):
    """How bright a white flake is under the set's general light: the ground
    snow's typical radiance from the ambient (key/fill/sky) group."""
    lower = ambient[int(H * 0.72):, :, :].reshape(-1, 3)
    lum = lower.mean(1)
    sel = lower[lum > np.percentile(lum, 70)]
    return sel.mean(0) * 0.9


def finish(lin, mist, fog_color=(0.3, 0.22, 0.26), fog_amt=0.18):
    m = (mist * fog_amt)[..., None]
    lin = lin * (1 - m) + np.array(fog_color, np.float32) * m
    lin = bloom(lin)
    return vignette(lin)


def scene_for_display():
    s = bpy.context.scene
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Punchy'
    s.view_settings.exposure = 0.6
    return s


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {}
    i = 0
    while i < len(a):
        if a[i].startswith("--"):
            k = a[i][2:]
            if i + 1 < len(a) and not a[i + 1].startswith("--"):
                o[k] = a[i + 1]; i += 2
            else:
                o[k] = True; i += 1
        else:
            i += 1
    return o


def run_fixed(o):
    """Fixed camera (hero): flicker + snow (+ optional door splice)."""
    W, H = (int(v) for v in o.get("res", "1920x1080").split("x"))
    fps = int(o.get("fps", 24))
    T = float(o.get("loop", 10.0))
    nfr = int(o.get("frames", int(T * fps)))
    S = load_set(o["passes"], W, H)
    cam = S["cam"]["frames"]["1"]
    door = None
    if o.get("door"):
        dd = o["door"]
        crop = json.load(open(os.path.join(dd, "crop.json")))
        dcam = json.load(open(os.path.join(dd, "camera.json")))
        sc = W / dcam["res"][0]
        x0, y0, x1, y1 = [int(round(v * sc)) for v in crop["crop"]]
        door = {"dir": dd, "box": (x0, y0, x1, y1), "n": crop["frames"], "cache": {}, "rw": dcam["res"]}
        door_start = float(o.get("door_start", 4.0))
        # feather mask inside the crop rectangle
        fm = np.zeros((H, W), np.float32)
        feather = max(6, int(14 * W / 1920))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        e = np.minimum.reduce([xx - x0, x1 - 1 - xx, yy - y0, np.full_like(yy, 10 ** 6) if y1 >= H else y1 - 1 - yy])
        fm[y0:y1, x0:x1] = np.clip(e / feather, 0, 1)
        door["mask"] = fm[..., None]
    snow = Snow(T=T)
    flick = Flicker(T)
    base_rgb = snow_base_color(S["lg"]["ambient"], H)
    scene = scene_for_display()
    out = o["out"]
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    start = int(o.get("start", 0))
    for fi in range(start, nfr):
        if os.path.exists(os.path.join(out, f"frame_{fi:04d}.png")) and o.get("resume"):
            continue
        t = fi / fps
        comb, lg = S["combined"], S["lg"]
        if door:
            # stop-motion door: crop frames advance on twos
            k = 1 + int(max(0.0, (t - door_start) * fps) // 2)
            k = min(max(k, 1), door["n"])
            if k not in door["cache"]:
                dW, dH = W, H
                dc = {"combined": resize(exr.load_pass(door["dir"], "combined", k), dW, dH)}
                for g in GROUPS:
                    dc[g] = resize(exr.load_pass(door["dir"], "lg_" + g, k), dW, dH)
                door["cache"] = {k: dc}
            dc = door["cache"][k]
            m = door["mask"]
            comb = comb * (1 - m) + dc["combined"] * m
            lg = {g: lg[g] * (1 - m) + dc[g] * m for g in GROUPS}
        gains = flick.gains(t)
        lin = comb.copy()
        for g in GROUPS:
            if g != "ambient" and abs(gains[g] - 1) > 1e-4:
                lin += (gains[g] - 1) * lg[g]
        # light that flakes catch from practicals (windows, lamps, tree)
        practical = sum(lg[g] * gains[g] for g in GROUPS if g != "ambient")
        local = blur(resize(practical, W // 8, H // 8), 5) * 2.2
        draw_snow(lin, S["depth"], local, snow, cam, t, 1 / fps, W, H, base_rgb)
        lin = finish(lin, S["mist"])
        exr.save_display(lin, os.path.join(out, f"frame_{fi:04d}.png"), scene)
        if fi % 24 == 0:
            print(f"frame {fi}/{nfr}  {time.time() - t0:.0f}s", flush=True)


def run_camera(o):
    """Moving camera or single stills: combined + per-frame depth + camera."""
    d = o["passes"]
    meta = json.load(open(os.path.join(d, "camera.json")))
    rw, rh = meta["res"]
    W, H = (int(v) for v in o.get("res", f"{rw}x{rh}").split("x"))
    fps = float(o.get("fps", 12))
    snow = Snow(T=10.0)
    scene = scene_for_display()
    out = o["out"]
    os.makedirs(out, exist_ok=True)
    base_rgb = None
    frames = sorted(int(k) for k in meta["frames"].keys())
    for fi, f in enumerate(frames):
        cam = meta["frames"][str(f)]
        comb = resize(exr.load_pass(d, "combined", f), W, H)
        depth = resize(exr.load_pass(d, "depth", f, channels=1), W, H)
        mist = resize(exr.load_pass(d, "mist", f, channels=1), W, H)
        if base_rgb is None:
            base_rgb = snow_base_color(comb, H) * 0.85
        local = blur(resize(np.clip(comb - 0.25, 0, None), W // 8, H // 8), 5) * 1.6
        lin = comb.copy()
        draw_snow(lin, depth, local, snow, cam, fi / fps, 1 / fps, W, H, base_rgb)
        lin = finish(lin, mist)
        exr.save_display(lin, os.path.join(out, f"frame_{fi:04d}.png"), scene)
    print("camera frames:", len(frames))


if __name__ == "__main__":
    o = args()
    (run_camera if o.get("mode") == "camera" else run_fixed)(o)
