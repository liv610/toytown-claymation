"""Fill the empty (black) gutters of a baked atlas by push-pull, so mipmaps don't bleed black into islands.
  python3 tools/fill_gutters.py in.png out.png"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)
mask = (src.sum(-1) > 3).astype(np.float32)          # texels some face wrote to


def pushpull(c, w):
    if min(c.shape[:2]) <= 1:
        return c / np.maximum(w, 1e-6)[..., None]
    h2, w2 = c.shape[0] // 2 * 2, c.shape[1] // 2 * 2
    cs = c[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3))
    ws = w[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
    low = pushpull(cs, ws)                              # normalised colour one level down
    up = np.repeat(np.repeat(low, 2, 0), 2, 1)
    up = np.pad(up, ((0, c.shape[0] - up.shape[0]), (0, c.shape[1] - up.shape[1]), (0, 0)), mode="edge")
    own = c / np.maximum(w, 1e-6)[..., None]
    return np.where((w > 0)[..., None], own, up)


def fill(m):
    o = pushpull(src * m[..., None], m)
    return np.where(m[..., None] > 0, src, o)


out = fill(mask)
# dark flecks inside snow (bake rays that started inside a decimated, self-intersecting snow cap):
# texels far darker than their bright neighbourhood are treated as empty and filled from around them
lum = out @ np.array([0.3, 0.55, 0.15], np.float32)
med = np.asarray(Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(11))).astype(np.float32)
speck = (mask > 0) & (med > 150) & (lum < 0.62 * med)
mask2 = mask * (~speck)
out = fill(mask2)
print(f"  {speck.mean() * 100:.2f}% dark flecks repaired")
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(sys.argv[2])
print(sys.argv[1], f"filled {100 * (1 - mask.mean()):.0f}% empty texels")
