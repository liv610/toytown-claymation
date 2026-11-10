"""Toy Town region layout: the single source of truth for the map-scale experiment.

Pure Python (no Blender), so the railway logic can be validated and drawn on its
own before any landscape is built.  Coordinates are Blender metres: +x east,
+y north.  The existing village street runs east-west at y ~ -3, the toy shop
faces south onto it; the new town square opens south of the street and the
station closes the square's south side, its entrance facing north.
"""
import math

BOARD = (-150.0, 170.0, -130.0, 130.0)          # diorama board (x0, x1, y0, y1)
VILLAGE_GROUND = (-40.0, 45.0, -34.0, 40.0)     # the existing hand-built ground mesh
SQUARE = (-13.0, 24.0, -33.5, -7.0)             # town square (x0, x1, y0, y1)
SQUARE_TREE = (5.5, -20.0)

# --- station ------------------------------------------------------------------
HEAD = (-17.0, 29.0, -40.5, -36.0)               # head house (public building)
SHED = (-29.0, 41.0, -62.0, -40.5)               # arched train shed
ENTRANCE = (6.0, -36.0)                          # main doors, on the head house's north face
TRACK_Y = {"red": -44.5, "blue": -50.5, "green": -57.0}
BUFFER_X = {"red": 20.0, "blue": 20.0, "green": -6.0}
PLATFORMS = [  # (y0, y1) strips running the length of the shed
    (-43.0, -40.5),       # concourse platform along the head house (red)
    (-48.9, -46.1),       # island: red / blue
    (-55.4, -52.1),       # island: blue / green
    (-60.6, -58.6),       # south platform (green)
]
WEST_OPENING = (-53.0, -42.0)                    # y range of the arched opening in the west gable
EAST_OPENING = (-60.0, -54.5)                    # y range of the arched opening in the east gable

# --- railway routes: buffer stop -> through the gable -> out into the country ---
ROUTES = {
    "red": [(20.0, -44.5), (-29.0, -44.5), (-48.0, -44.5), (-62.0, -44.0), (-80.0, -39.0), (-99.0, -26.0),
            (-115.0, -4.0), (-127.0, 20.0), (-135.0, 40.0)],
    "blue": [(20.0, -50.5), (-29.0, -50.5), (-48.0, -50.5), (-64.0, -51.5), (-82.0, -57.0), (-101.0, -70.0),
             (-118.0, -88.0), (-129.0, -106.0)],
    "green": [(-6.0, -57.0), (41.0, -57.0), (58.0, -57.0), (74.0, -55.0), (92.0, -47.0),
              (108.0, -29.0), (121.0, -5.0), (133.0, 18.0), (146.0, 38.0)],
}
ROUTE_COLORS = {"red": "#b2333a", "blue": "#3768b0", "green": "#3f8a52"}

RIVER = [(92.0, 135.0), (80.0, 102.0), (67.0, 64.0), (60.0, 30.0), (57.0, 4.0), (60.0, -26.0),
         (66.0, -57.0), (62.0, -90.0), (71.0, -135.0)]
RIVER_WIDTH = 7.0

ROADS = {
    # the toy-shop street continues east, crosses the river on the stone bridge
    "east": [(24.0, -3.2), (40.0, -4.0), (50.0, -3.6), (57.5, -3.0), (66.0, -2.4), (80.0, 0.0), (90.0, 4.5)],
    # a lane from the square's west side out to the west farm
    "west": [(-13.0, -20.0), (-30.0, -18.0), (-50.0, -12.0), (-64.0, 0.0), (-71.0, 10.0)],
}

SITES = {  # farms / cottages beyond town: (x, y, kind, rotation)
    "west_farm": (-76.0, 14.0, "farm", 0.4),
    "nw_cottage": (-56.0, 72.0, "cottage", -0.2),
    "north_chapel": (14.0, 96.0, "chapel", 0.1),
    "north_cottage": (42.0, 104.0, "cottage", 0.6),
    "ne_farm": (102.0, 62.0, "farm", -0.5),
    "east_farm": (95.0, 8.0, "farm", 1.2),
    "sw_farm": (-52.0, -96.0, "farm", 0.25),
    "south_cottage": (22.0, -100.0, "cottage", -0.3),
    "se_cottage": (102.0, -98.0, "cottage", 0.9),
}
SITE_RADIUS = {"farm": 16.0, "cottage": 7.0, "chapel": 8.0}


# ------------------------------------------------------------------ geometry utils
def catmull(points, step=1.0):
    """Centripetal Catmull-Rom through the points, resampled every `step` metres."""
    P = [points[0]] + list(points) + [points[-1]]
    dense = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(8, int(math.dist(p1, p2) * 4))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            dense.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                      + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    dense.append(points[-1])
    out, acc = [dense[0]], 0.0
    for a, b in zip(dense, dense[1:]):
        d = math.dist(a, b)
        acc += d
        if acc >= step:
            out.append(b)
            acc = 0.0
    if out[-1] != dense[-1]:
        out.append(dense[-1])
    return out


def polyline_length(pts):
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def turning_radius(pts, span=6):
    """Smallest radius of curvature, measured over chords of `span` samples."""
    rmin, where = float("inf"), None
    for i in range(span, len(pts) - span):
        a, b, c = pts[i - span], pts[i], pts[i + span]
        ab, bc, ca = math.dist(a, b), math.dist(b, c), math.dist(c, a)
        area2 = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
        if area2 < 1e-9:
            continue
        r = ab * bc * ca / (2 * area2)
        if r < rmin:
            rmin, where = r, b
    return rmin, where


def seg_intersect(p, q, r, s):
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    d1, d2, d3, d4 = cross(r, s, p), cross(r, s, q), cross(p, q, r), cross(p, q, s)
    return (d1 * d2 < 0) and (d3 * d4 < 0)


def crossings(a, b):
    """Points where polyline a crosses polyline b."""
    out = []
    for p, q in zip(a, a[1:]):
        for r, s in zip(b, b[1:]):
            if seg_intersect(p, q, r, s):
                out.append(((p[0] + q[0]) / 2, (p[1] + q[1]) / 2))
    return out


def in_rect(p, r, pad=0.0):
    return r[0] - pad <= p[0] <= r[1] + pad and r[2] - pad <= p[1] <= r[3] + pad


def dist_to_polyline(p, pts):
    best = float("inf")
    for a, b in zip(pts, pts[1:]):
        ax, ay = b[0] - a[0], b[1] - a[1]
        L2 = ax * ax + ay * ay
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / L2))
        best = min(best, math.dist(p, (a[0] + ax * t, a[1] + ay * t)))
    return best


# village buildings that tracks and roads must avoid (approximate footprints)
VILLAGE_FOOTPRINTS = [(-2.7, 2.7, 0.0, 5.1), (3.8, 8.1, 0.4, 4.9)]


def sampled():
    return {k: catmull(v, 1.0) for k, v in ROUTES.items()}


def validate():
    """Check the railway network for physical coherence.  Returns (ok, report lines)."""
    R = sampled()
    river = catmull(RIVER, 1.0)
    roads = {k: catmull(v, 1.0) for k, v in ROADS.items()}
    lines, ok = [], True

    def check(cond, msg):
        nonlocal ok
        lines.append(("PASS " if cond else "FAIL ") + msg)
        ok = ok and cond

    for name, pts in R.items():
        L = polyline_length(pts)
        rmin, where = turning_radius(pts)
        lines.append(f"     {name}: length {L:.0f} m, tightest curve radius {rmin:.0f} m near ({where[0]:.0f}, {where[1]:.0f})")
        check(rmin >= 30.0, f"{name}: no curve tighter than 30 m (miniature limit)")
        check(in_rect(pts[0], SHED), f"{name}: terminates inside the train shed at a buffer stop")
        y = TRACK_Y[name]
        plat = [p for p in PLATFORMS if p[0] - 3.2 <= y <= p[1] + 3.2]
        check(len(plat) >= 1, f"{name}: buffer stop sits beside a platform")
        # where does the route leave the shed?
        exit_pt = next(p for p in pts if not in_rect(p, SHED))
        side = "west" if exit_pt[0] < SHED[0] + 1 else ("east" if exit_pt[0] > SHED[1] - 1 else "side wall")
        want = "east" if name == "green" else "west"
        opening = EAST_OPENING if want == "east" else WEST_OPENING
        check(side == want and opening[0] <= exit_pt[1] <= opening[1],
              f"{name}: leaves the shed through the {want} gable opening (exits {side} at y={exit_pt[1]:.1f})")
        inside = [p for p in pts if in_rect(p, SHED)]
        check(all(abs(p[1] - y) < 0.05 for p in inside), f"{name}: runs straight along its own platform track inside the shed")
        check(not any(in_rect(p, SQUARE, pad=2.0) for p in pts), f"{name}: never enters the town square")
        check(not any(in_rect(p, HEAD, pad=0.5) for p in pts), f"{name}: never passes through the head house")
        check(not any(in_rect(p, VILLAGE_GROUND, pad=0.0) and not in_rect(p, SHED) for p in pts),
              f"{name}: stays clear of the village ground")
        n_river = len(crossings(pts, river))
        if name == "green":
            check(n_river == 1, f"green: crosses the river exactly once (on the railway bridge), found {n_river}")
        else:
            check(n_river == 0, f"{name}: does not cross the river (found {n_river})")
        for rn, rp in roads.items():
            c = crossings(pts, rp)
            check(len(c) == 0, f"{name}: no level crossing with the {rn} road")
        for sn, (sx, sy, kind, _) in SITES.items():
            d = dist_to_polyline((sx, sy), pts)
            check(d > SITE_RADIUS[kind] + 4, f"{name}: clear of {sn} ({d:.0f} m)")
        e = pts[-1]
        edge = min(e[0] - BOARD[0], BOARD[1] - e[0], e[1] - BOARD[2], BOARD[3] - e[1])
        check(edge <= 26.0, f"{name}: ends at a tunnel portal near the board edge ({edge:.0f} m from the edge)")
    names = list(R)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = R[names[i]], R[names[j]]
            c = crossings(a, b)
            d = min(min(math.dist(p, q) for q in b[::2]) for p in a[::2])
            check(not c, f"{names[i]} and {names[j]} never cross")
            check(d >= 5.8, f"{names[i]} and {names[j]} stay on separate tracks, never closer than their 6 m spacing (closest {d:.1f} m)")
    for rn, rp in roads.items():
        n = len(crossings(rp, river))
        check(n == (1 if rn == "east" else 0), f"{rn} road crosses the river {n} time(s) (stone bridge on the east road)")
    fore = SQUARE[2] - HEAD[3]
    check(0 < fore <= 4.0 and abs(ENTRANCE[1] - HEAD[3]) < 0.01 and SQUARE[0] < ENTRANCE[0] < SQUARE[1],
          f"station entrance is on the head house's north face, facing the square across a {fore:.1f} m forecourt")
    return ok, lines


def river_crossing(route_or_road):
    river = catmull(RIVER, 1.0)
    pts = catmull(route_or_road, 1.0)
    c = crossings(pts, river)
    return c[0] if c else None


if __name__ == "__main__":
    ok, lines = validate()
    print("\n".join(lines))
    print("RESULT:", "network is coherent" if ok else "PROBLEMS FOUND")
