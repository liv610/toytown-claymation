"""The textile test corner: which parts of the Blender village belong to it.

The corner is the toy shop, the pink house and everything around them that the textile version rebuilds
(Christmas tree, gift piles, both lamps, bench, wagon, framing firs, and the street stones in front).
Two rules:
  * objects built by a named builder are taken whole, by their top-level root (BUILDERS);
  * the long street meshes (cobbles and edge stones, built once for the whole town) are split per
    triangle at the corner rectangle (SPLIT_PREFIXES), so the textile street can replace that stretch.
Everything else (ground snow, the street bed, background houses, the region) stays in the base village.
Coordinates are Blender's (x east, y north, z up).
"""

BUILDERS = ("BlueShop", "PinkHouse", "XmasTree", "TreeGifts", "ShopGifts", "DoorGifts", "LampWest", "LampEast",
            "Bench", "Wagon", "FirGap", "FirFG", "FirR1",
            # the first row of neighbours behind and beside the shop, and the firs between them
            "Bg0", "Bg1", "Bg2", "Bg3", "Bg4", "FirBg15", "FirBg17")
# the stretch of street the textile stones replace (x0, x1, y0, y1)
STREET_RECT = (-8.6, 12.2, -7.2, 0.4)
SPLIT_PREFIXES = ("Cobbles",)                 # one mesh for the whole street: split per triangle
LOOSE_PREFIXES = ("edgelump",)                # small separate snow lumps along the street edges: taken by position


def top(o):
    while o.parent is not None:
        o = o.parent
    return o


def is_corner_object(o):
    t = top(o)
    if t.name.split(".")[0] in BUILDERS:
        return True
    if t.name.lower().startswith(LOOSE_PREFIXES):
        c = t.matrix_world.translation
        return in_street_rect(c.x, c.y)
    return False


def is_split_object(o):
    n = o.name.lower()
    return any(n.startswith(p.lower()) for p in SPLIT_PREFIXES)


def in_street_rect(x, y):
    x0, x1, y0, y1 = STREET_RECT
    return x0 <= x <= x1 and y0 <= y <= y1
