"""Chapter 1 props: new, unwrapped toys (the recurring red toy truck, a teddy, blocks, a ball, a doll),
a cardboard carton of toys for the Marine to carry and a wagon of donated toys.

Each prop is built around its own root empty (named), origin at its base centre, so the browser can move it.
Toys are shown new and unwrapped, never as wrapped presents.
"""
import math

from .lib import RNG, box, blob, clay, lathe, wood
from . import palette as P
from .buildings import root, par
from .props import iron


def _m():
    return {
        "red": clay("ToyRed", P.srgb('#c4372c'), rough=0.32, sss=0.03, dimple=0.35, var=0.06, coat=0.5, wear=0.04),
        "cream": clay("ToyCream", P.CREAM, rough=0.45, dimple=0.4, var=0.05, wear=0.04),
        "glass": clay("ToyGlass", P.srgb('#bfe0f0'), rough=0.15, coat=0.8, dimple=0.1, var=0.02, wear=0.0),
        "tyre": clay("ToyTyre", P.srgb('#1c1a1a'), rough=0.6, dimple=0.4, var=0.05, wear=0.02),
        "bear": clay("ToyBear", P.srgb('#b07a48'), rough=0.85, dimple=1.4, dimple_scale=14, grain=2.0, var=0.14, sheen=0.3, wear=0.05),
        "bearlt": clay("ToyBearLight", P.srgb('#e8cfa3'), rough=0.85, dimple=1.2, dimple_scale=14, var=0.1, sheen=0.3, wear=0.05),
        "eye": clay("ToyEye", P.srgb('#120e0c'), rough=0.1, coat=1.0, dimple=0.0, var=0.0, wear=0.0),
        "blue": clay("ToyBlue", P.SHOP_BLUE, rough=0.4, dimple=0.4, var=0.06, coat=0.3, wear=0.05),
        "gold": clay("ToyGold", P.GOLD, rough=0.4, dimple=0.4, var=0.06, coat=0.3, wear=0.05),
        "green": clay("ToyGreen", P.SHUTTER_GREEN, rough=0.4, dimple=0.4, var=0.06, coat=0.3, wear=0.05),
        "card": clay("Cardboard", P.srgb('#c49a62'), rough=0.9, dimple=0.8, dimple_scale=6, var=0.12, wear=0.1),
        "tape": clay("CardTape", P.srgb('#d9b47c'), rough=0.4, dimple=0.2, var=0.04, coat=0.3, wear=0.02),
    }


def truck(name, loc=(0, 0, 0), s=1.0, rot_z=0.0):
    """The recurring red toy: a little red truck. Origin under its wheels, ~0.32 m long at s=1."""
    M = _m()
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (s, s, s)
    o = [box("chassis", (0.32, 0.15, 0.07), (0, 0, 0.075), M["red"], bevel=0.025, subd=2, wobble=0.004),
         box("cab", (0.11, 0.14, 0.1), (0.08, 0, 0.155), M["red"], bevel=0.025, subd=2, wobble=0.004),
         box("rail", (0.16, 0.152, 0.035), (-0.065, 0, 0.125), M["cream"], bevel=0.012, subd=1, wobble=0.0),
         box("windscreen", (0.012, 0.11, 0.05), (0.136, 0, 0.165), M["glass"], bevel=0.005, subd=1, wobble=0.0),
         blob("lampL", (0.162, 0.05, 0.085), 0.014, M["cream"], (0.6, 1, 1), 2, 0.0),
         blob("lampR", (0.162, -0.05, 0.085), 0.014, M["cream"], (0.6, 1, 1), 2, 0.0)]
    for x in (-0.095, 0.095):
        for y in (-0.08, 0.08):
            w = lathe("wheel", [(0.0, -0.016), (0.034, -0.016), (0.04, -0.008), (0.04, 0.008), (0.034, 0.016), (0.0, 0.016)],
                      (x, y, 0.04), M["tyre"], segs=20)
            w.rotation_euler = (math.pi / 2, 0, 0)
            o += [w, blob("hub", (x, y * 1.22, 0.04), 0.014, M["cream"], (1, 0.5, 1), 2, 0.0)]
    par(o, R)
    return R


def teddy(name, loc=(0, 0, 0), s=1.0, rot_z=0.0):
    """Sitting teddy bear (~0.3 m tall), facing -Y."""
    M = _m()
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (s, s, s)
    o = [blob("body", (0, 0, 0.1), 0.085, M["bear"], (1, 0.9, 1.15), 3, 0.08),
         blob("belly", (0, -0.06, 0.09), 0.05, M["bearlt"], (1, 0.5, 1.1), 2, 0.05),
         blob("head", (0, -0.01, 0.235), 0.072, M["bear"], (1.05, 0.95, 0.95), 3, 0.06),
         blob("snout", (0, -0.07, 0.22), 0.03, M["bearlt"], (1.1, 0.8, 0.85), 2, 0.04),
         blob("nose", (0, -0.096, 0.232), 0.011, M["eye"], (1.2, 0.8, 0.8), 2, 0.0)]
    for x in (-1, 1):
        o += [blob("ear", (0.055 * x, 0.0, 0.295), 0.026, M["bear"], (1, 0.6, 1), 2, 0.05),
              blob("eye", (0.028 * x, -0.066, 0.25), 0.0095, M["eye"], (1, 0.7, 1), 2, 0.0),
              blob("arm", (0.085 * x, -0.03, 0.12), 0.032, M["bear"], (0.8, 0.9, 1.5), 2, 0.05, rot=(0.5, -0.4 * x, 0)),
              blob("leg", (0.05 * x, -0.07, 0.035), 0.036, M["bear"], (0.9, 1.3, 0.8), 2, 0.05),
              blob("pad", (0.05 * x, -0.115, 0.035), 0.022, M["bearlt"], (1, 0.4, 1), 2, 0.0)]
    o.append(blob("bow", (0, -0.05, 0.175), 0.022, M["red"], (1.8, 0.7, 0.8), 2, 0.05))
    par(o, R)
    return R


def blocks(name, loc=(0, 0, 0), s=1.0, rot_z=0.0):
    M = _m()
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (s, s, s)
    o = []
    for (x, y, z, k, a) in [(0, 0, 0, "blue", 0.1), (0.1, 0.01, 0, "gold", -0.2), (0.05, 0.0, 0.09, "red", 0.4), (-0.06, 0.08, 0, "green", 0.3)]:
        o.append(box("block", (0.085, 0.085, 0.085), (x, y, z + 0.0425), M[k], rot=(0, 0, a), bevel=0.012, subd=1, wobble=0.004))
    par(o, R)
    return R


def ball(name, loc=(0, 0, 0), s=1.0):
    M = _m()
    R = root(name, loc)
    R.scale = (s, s, s)
    o = [blob("ball", (0, 0, 0.08), 0.08, M["blue"], (1, 1, 1), 3, 0.02),
         blob("band", (0, 0, 0.08), 0.0815, M["gold"], (1, 1, 0.3), 3, 0.0)]
    par(o, R)
    return R


def doll(name, loc=(0, 0, 0), s=1.0, rot_z=0.0):
    """Little wooden peg doll in a cranberry dress."""
    M = _m()
    skin = clay("DollSkin", P.srgb('#e8b48c'), rough=0.5, dimple=0.3, var=0.05)
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (s, s, s)
    o = [lathe("dress", [(0.0, 0.0), (0.06, 0.0), (0.055, 0.06), (0.035, 0.14), (0.0, 0.15)], (0, 0, 0), M["red"], segs=24),
         blob("head", (0, 0, 0.18), 0.04, skin, (1, 1, 1.05), 3, 0.02),
         blob("hair", (0, 0.01, 0.195), 0.042, wood("DollHair", P.WOOD, rough=0.6), (1.05, 1.0, 0.9), 2, 0.05),
         blob("collar", (0, 0, 0.145), 0.035, M["cream"], (1, 1, 0.35), 2, 0.0)]
    par(o, R)
    return R


def carton(name, loc=(0, 0, 0), s=1.0, rot_z=0.0):
    """An open cardboard carton with new toys peeking out (what the Marine carries in)."""
    M = _m()
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (s, s, s)
    W, D, H = 0.5, 0.36, 0.3
    o = [box("bottom", (W, D, 0.02), (0, 0, 0.01), M["card"], bevel=0.005, subd=1, wobble=0.003)]
    for sy in (-1, 1):
        o.append(box("side", (W, 0.02, H), (0, sy * D / 2, H / 2), M["card"], bevel=0.006, subd=1, wobble=0.004))
        o.append(box("flap", (W, 0.015, 0.14), (0, sy * (D / 2 + 0.05), H + 0.04), M["card"], rot=(sy * 0.75, 0, 0), bevel=0.005, subd=1, wobble=0.004))
    for sx in (-1, 1):
        o.append(box("end", (0.02, D, H), (sx * W / 2, 0, H / 2), M["card"], bevel=0.006, subd=1, wobble=0.004))
    o.append(box("tape", (0.06, D + 0.025, 0.004), (0, 0, 0.0), M["tape"], bevel=0.001, subd=0, wobble=0.0))
    par(o, R)
    inner = [teddy(name + "_bear", (-0.1, 0.02, H - 0.17), 0.85, 0.3), blocks(name + "_blocks", (0.1, -0.05, H - 0.1), 0.8, 0.3),
             ball(name + "_ball", (0.12, 0.08, H - 0.13), 0.75)]
    par(inner, R)
    return R


def toy_wagon(name, loc=(0, 0, 0), rot_z=0.0, scale=1.2):
    """A red pull wagon carrying donated toys (unwrapped). Handle points to -X."""
    red = wood("WagonRed", P.MUTED_RED, painted=True, rough=0.4)
    dark = wood("WagonDark", P.DEEP_RED, painted=True, rough=0.4)
    M = _m()
    R = root(name, loc, lean=(0, 0, rot_z))
    R.scale = (scale, scale, scale)
    Lx, Ly, Hz, z0 = 1.0, 0.62, 0.22, 0.26
    o = [box("bed", (Lx, Ly, 0.05), (0, 0, z0), red, bevel=0.02, subd=1, wobble=0.006)]
    for sy in (-1, 1):
        o.append(box("side", (Lx, 0.05, Hz), (0, sy * Ly / 2, z0 + Hz / 2), red, bevel=0.02, subd=2, wobble=0.008))
    for sx in (-1, 1):
        o.append(box("end", (0.05, Ly, Hz), (sx * Lx / 2, 0, z0 + Hz / 2), red, bevel=0.02, subd=2, wobble=0.008))
    for k in range(2):
        o.append(box("strip", (Lx + 0.02, 0.06, 0.025), (0, -Ly / 2 - 0.01, z0 + 0.05 + k * 0.09), dark, bevel=0.008, subd=1, wobble=0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            w = lathe("wheel", [(0.0, -0.035), (0.13, -0.035), (0.145, -0.02), (0.145, 0.02), (0.13, 0.035), (0.0, 0.035)],
                      (sx * 0.33, sy * (Ly / 2 + 0.05), 0.15), M["tyre"], segs=24)
            w.rotation_euler = (math.pi / 2, 0, 0)
            o += [w, blob("hub", (sx * 0.33, sy * (Ly / 2 + 0.09), 0.15), 0.05, red, (1, 0.5, 1), 2, 0)]
    o.append(box("handle", (0.75, 0.035, 0.035), (-Lx / 2 - 0.34, 0, 0.3), iron(), rot=(0, -0.45, 0), bevel=0.01, subd=0, wobble=0))
    o.append(box("grip", (0.04, 0.24, 0.04), (-Lx / 2 - 0.68, 0, 0.46), iron(), bevel=0.015, subd=0, wobble=0))
    par(o, R)
    top = z0 + 0.03
    load = [teddy(name + "_bear", (-0.25, 0.08, top), 1.15, -0.2), truck(name + "_truck", (0.2, -0.12, top), 0.9, 0.5),
            blocks(name + "_blocks", (0.22, 0.14, top), 1.0, 0.2), ball(name + "_ball", (-0.05, -0.17, top), 0.9),
            doll(name + "_doll", (0.0, 0.14, top), 1.1, 0.0)]
    par(load, R)
    return R
