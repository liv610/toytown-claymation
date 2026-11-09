"""Toy Town folk-art palette (authored in sRGB, converted to linear)."""


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


SHOP_BLUE = srgb('#3f74b8')
SHOP_BLUE_DARK = srgb('#2b4f86')
CREAM = srgb('#f0e2c4')
CREAM_WARM = srgb('#e8cfa3')
PINK = srgb('#de8f8c')
PINK_LIGHT = srgb('#efb1a6')
BRICK = srgb('#a2493a')
MUTED_RED = srgb('#a8322f')
DEEP_RED = srgb('#8a2228')
AWNING_GREEN = srgb('#2f7a4c')
SHUTTER_GREEN = srgb('#3f6f57')
PINE = srgb('#235a3c')
PINE_DARK = srgb('#173f2c')
GOLD = srgb('#e2b04a')
ROOF_SLATE = srgb('#4a4660')
STONE = srgb('#8f8a93')
STONE_WARM = srgb('#9b8d80')
IRON = srgb('#24302c')
WOOD = srgb('#7a4b2a')
WOOD_DARK = srgb('#4f301c')
MUSTARD = srgb('#d9a93f')
TEAL = srgb('#3e8a8c')
PLUM = srgb('#6b3d6e')
