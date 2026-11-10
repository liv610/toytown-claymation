"""Draw the region plan (top-down) to check the railway logic by eye."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
from tt import layout as L

S = 4.0  # px per metre
x0, x1, y0, y1 = L.BOARD
W, H = int((x1 - x0) * S) + 80, int((y1 - y0) * S) + 120
img = Image.new("RGB", (W, H), "#f3ecdf")
d = ImageDraw.Draw(img)
P = lambda p: (40 + (p[0] - x0) * S, 80 + (y1 - p[1]) * S)
R = lambda r, **k: d.rectangle([P((r[0], r[3])), P((r[1], r[2]))], **k)
try:
    F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
except Exception:
    F = FB = ImageFont.load_default()
R(L.BOARD, outline="#7a6a55", width=3, fill="#e7efd9")
d.line([P(p) for p in L.catmull(L.RIVER, 1)], fill="#5b8ccc", width=int(L.RIVER_WIDTH * S))
for n, r in L.ROADS.items():
    d.line([P(p) for p in L.catmull(r, 1)], fill="#c9b48a", width=int(4 * S))
R(L.VILLAGE_GROUND, outline="#b9a68c", width=2)
R(L.SQUARE, fill="#d8cdbb", outline="#8a7a66", width=2)
d.ellipse([P((L.SQUARE_TREE[0] - 3, L.SQUARE_TREE[1] + 3)), P((L.SQUARE_TREE[0] + 3, L.SQUARE_TREE[1] - 3))], fill="#2f6b3c")
R(L.SHED, fill="#cfc6d6", outline="#5a4f63", width=2)
R(L.HEAD, fill="#e4b98f", outline="#6b4a33", width=2)
for (a, b) in L.PLATFORMS:
    R((L.SHED[0] + 1, L.SHED[1] - 1, a, b), fill="#bfb3a5")
for f in L.VILLAGE_FOOTPRINTS:
    R(f, fill="#4f78b8")
for name, pts in L.sampled().items():
    col = L.ROUTE_COLORS[name]
    d.line([P(p) for p in pts], fill=col, width=int(1.8 * S))
    b = pts[0]; d.rectangle([P((b[0] - 1, b[1] + 1)), P((b[0] + 1, b[1] - 1))], fill="#222")
    e = pts[-1]; d.ellipse([P((e[0] - 3, e[1] + 3)), P((e[0] + 3, e[1] - 3))], outline="#333", width=3)
    d.text(P((e[0] + 4, e[1] + 6)), f"{name} (tunnel)", fill=col, font=F)
for nm, (sx, sy, kind, _) in L.SITES.items():
    r = L.SITE_RADIUS[kind]
    d.ellipse([P((sx - r, sy + r)), P((sx + r, sy - r))], outline="#8a5a3a", width=2)
    d.text(P((sx - r, sy - r - 1)), nm.replace("_", " "), fill="#6b4a33", font=F)
g = L.river_crossing(L.ROUTES["green"]); rb = L.river_crossing(L.ROADS["east"])
for c, lbl in ((g, "railway bridge"), (rb, "stone road bridge")):
    d.rectangle([P((c[0] - 4, c[1] + 3)), P((c[0] + 4, c[1] - 3))], outline="#333", width=3)
    d.text(P((c[0] + 6, c[1] + 2)), lbl, fill="#333", font=F)
d.text(P((L.SQUARE[0] + 1, L.SQUARE[3] - 1)), "town square", fill="#333", font=F)
d.text(P((L.HEAD[0] + 1, L.HEAD[3] - 0.5)), "station head house (entrance faces square)", fill="#333", font=F)
d.text(P((L.SHED[0] + 1, L.SHED[2] - 1)), "arched train shed", fill="#333", font=F)
d.text(P((L.VILLAGE_GROUND[0] + 1, L.VILLAGE_GROUND[3] - 1)), "existing village", fill="#6b5b45", font=F)
ok, lines = L.validate()
d.text((40, 20), f"Toy Town region plan   ·   railway check: {sum(l.startswith('PASS') for l in lines)} passed, "
       f"{sum(l.startswith('FAIL') for l in lines)} failed   ·   grid 10 m", fill="#333", font=FB)
for gx in range(int(x0), int(x1) + 1, 50):
    d.text(P((gx, y0 - 2)), f"{gx}", fill="#998", font=F)
# station detail inset
img.save(sys.argv[1])
# zoomed station inset
S2 = 12
iw, ih = int(110 * S2), int(40 * S2)
inset = Image.new("RGB", (iw, ih + 40), "#f3ecdf"); di = ImageDraw.Draw(inset)
ox, oy = -40, -34
Q = lambda p: ((p[0] - ox) * S2, 30 + (oy - p[1]) * S2)
RQ = lambda r, **k: di.rectangle([Q((r[0], r[3])), Q((r[1], r[2]))], **k)
RQ((-13, 24, -40, -33.5), fill="#d8cdbb")
RQ(L.SHED, fill="#cfc6d6", outline="#5a4f63", width=3); RQ(L.HEAD, fill="#e4b98f", outline="#6b4a33", width=3)
for (a, b) in L.PLATFORMS:
    RQ((L.SHED[0] + 1, L.SHED[1] - 1, a, b), fill="#bfb3a5")
for (a, b), x in ((L.WEST_OPENING, L.SHED[0]), (L.EAST_OPENING, L.SHED[1])):
    di.line([Q((x, a)), Q((x, b))], fill="#f3ecdf", width=8)
for name, pts in L.sampled().items():
    di.line([Q(p) for p in pts], fill=L.ROUTE_COLORS[name], width=10)
    b = pts[0]; di.rectangle([Q((b[0] - 0.6, b[1] + 1.4)), Q((b[0] + 0.6, b[1] - 1.4))], fill="#222")
di.rectangle([Q((L.ENTRANCE[0] - 2, -35.4)), Q((L.ENTRANCE[0] + 2, -36.6))], fill="#2b2b2b")
di.text((10, 4), "Station: red + blue enter the west gable, green the east gable; black bars = buffer stops; dark gap = entrance to square",
        fill="#333", font=F)
inset.save(sys.argv[1].replace(".png", "_station.png"))
print("\n".join(l for l in lines if l.startswith("FAIL")) or "all checks pass")
