// Geography for the clay national relief.
// Boundaries: US Census cartographic boundaries via the us-atlas package (ISC; data public domain), already
// projected to Albers USA (d3.geoAlbersUsa().scale(1300).translate([487.5, 305])) in a 975 × 610 frame.
// Landscape features are stylised but placed by real longitude/latitude. Towns are generic regional places
// (not Toys for Tots campaign locations); story communities are fictional.
import { feature, mesh } from 'topojson-client';
import { geoAlbersUsa, geoPath } from 'd3-geo';

export const MAP_W = 975, MAP_H = 610;
export const proj = geoAlbersUsa().scale(1300).translate([487.5, 305]);
export const P = (lon, lat) => proj([lon, lat]);                     // → [ax, ay] map units
export const toWorld = (ax, ay) => [ax - MAP_W / 2, ay - MAP_H / 2];  // → [x, z] (y is up)

// ---- stylised landscape, placed by longitude/latitude [lon, lat] -----------------------------------------
const RANGES = [   // ridgelines: points, half-width (map units), peak height (map units)
  { name: 'Rocky Mountains', w: 34, h: 15, pts: [[-114.6, 48.9], [-113.3, 47.2], [-112.2, 45.6], [-110.8, 44.2], [-109.3, 43.0], [-107.4, 41.6], [-106.1, 40.2], [-105.8, 38.7], [-106.2, 37.3], [-105.8, 35.8]] },
  { name: 'Front Range', w: 14, h: 9, pts: [[-105.6, 40.6], [-105.3, 39.4], [-105.0, 38.2]] },
  { name: 'Sierra Nevada', w: 13, h: 12, pts: [[-121.4, 40.3], [-120.3, 38.9], [-119.2, 37.6], [-118.3, 36.4], [-118.2, 35.6]] },
  { name: 'Cascades', w: 12, h: 10, pts: [[-121.6, 48.8], [-121.7, 47.2], [-121.8, 45.6], [-122.0, 44.0], [-122.2, 42.4], [-122.1, 41.3]] },
  { name: 'Coast Ranges', w: 8, h: 4, pts: [[-123.6, 47.6], [-123.7, 45.5], [-123.8, 43.0], [-123.5, 40.5], [-122.6, 38.6], [-121.5, 36.5], [-120.2, 35.0]] },
  { name: 'Appalachians', w: 22, h: 6, pts: [[-85.7, 34.0], [-84.0, 35.4], [-82.3, 36.4], [-80.6, 37.6], [-79.2, 38.9], [-77.8, 40.2], [-76.2, 41.3], [-74.6, 42.2], [-73.6, 43.6], [-72.2, 44.3], [-70.9, 45.0], [-69.6, 45.9]] },
  { name: 'Brooks / Alaska Range', w: 10, h: 7, pts: [[-152, 62.6], [-149, 63.3], [-146, 63.2], [-142, 62.6]] },
];
const BLOBS = [   // plateaus and uplands: centre, radius, height, flat top?
  { name: 'Colorado Plateau', c: [-110.6, 37.2], r: 52, h: 5, flat: true },
  { name: 'Ozarks', c: [-92.6, 36.6], r: 26, h: 2.2 },
  { name: 'Black Hills', c: [-103.6, 44.0], r: 10, h: 3 },
  { name: 'Great Basin', c: [-116.6, 39.6], r: 48, h: 3.2, ridged: true },
  { name: 'Adirondacks', c: [-74.2, 44.1], r: 12, h: 3.2 },
  { name: 'Hawaii', c: [-155.5, 19.6], r: 8, h: 5 },
];
// places that matter to the story (fictional communities in real states)
export const SITES = {
  maple: { name: 'Maple Hollow', state: 'Ohio', lonlat: [-82.45, 40.45], flatR: 9, chapter: 1 },
  riverton: { name: 'Riverton', state: 'Ohio', lonlat: [-81.85, 40.05], flatR: 6, chapter: 2 },
  toytown: { name: 'Toy Town', state: '', lonlat: [-98.6, 39.3], flatR: 9, hub: true },
};
// generic regional towns shown as tiny clusters at national scale (not campaign locations)
export const TOWNS = [[-122.3, 47.6], [-122.7, 45.5], [-122.4, 37.8], [-121.5, 38.6], [-118.2, 34.1], [-117.2, 32.7], [-115.1, 36.2], [-112.1, 33.5], [-110.9, 32.2],
  [-111.9, 40.8], [-116.2, 43.6], [-112.0, 46.6], [-106.6, 35.1], [-105.0, 39.7], [-104.8, 41.1], [-100.8, 46.8], [-96.8, 43.5], [-96.7, 40.8], [-97.3, 37.7],
  [-97.5, 35.5], [-96.8, 32.8], [-95.4, 29.8], [-98.5, 29.4], [-101.9, 33.6], [-93.3, 45.0], [-93.6, 41.6], [-90.2, 38.6], [-94.6, 39.1], [-92.3, 34.7],
  [-90.1, 30.0], [-90.2, 32.3], [-86.8, 33.5], [-86.8, 36.2], [-85.8, 38.3], [-87.6, 41.9], [-89.4, 43.1], [-88.0, 43.0], [-86.2, 39.8], [-83.0, 42.3],
  [-84.4, 33.7], [-81.7, 30.3], [-80.2, 25.8], [-82.5, 27.9], [-81.0, 34.0], [-78.6, 35.8], [-80.8, 35.2], [-77.4, 37.5], [-77.0, 38.9], [-76.6, 39.3],
  [-75.2, 39.95], [-74.0, 40.7], [-73.8, 42.7], [-71.1, 42.4], [-71.4, 41.8], [-72.7, 41.8], [-70.3, 43.7], [-73.2, 44.5], [-79.9, 40.4], [-81.7, 41.5],
  [-84.5, 39.1], [-149.9, 61.2], [-157.9, 21.3], [-108.5, 45.8], [-100.3, 44.4], [-119.7, 46.2]];
// three symbolic lines that meet at Toy Town (a storytelling device, not real logistics)
export const LINES = {
  red: [[-122.3, 47.6], [-116.2, 43.6], [-111.9, 40.8], [-105.0, 39.7], [-98.6, 39.3], [-94.6, 39.1], [-90.2, 38.6], [-86.2, 39.8], [-82.45, 40.45], [-81.85, 40.05], [-79.9, 40.4], [-75.2, 39.95], [-74.0, 40.7], [-71.1, 42.4]],
  blue: [[-122.4, 37.8], [-119.7, 38.9], [-115.1, 39.4], [-111.0, 39.0], [-105.6, 38.0], [-98.6, 39.3], [-93.6, 41.6], [-87.6, 41.9], [-83.0, 42.3], [-78.0, 42.9], [-73.8, 42.7]],
  green: [[-118.2, 34.1], [-112.1, 33.5], [-106.6, 35.1], [-101.9, 35.2], [-98.6, 39.3], [-97.5, 35.5], [-96.8, 32.8], [-90.2, 32.3], [-86.8, 33.5], [-84.4, 33.7], [-81.0, 34.0], [-78.6, 35.8], [-77.4, 37.5]],
};

// ---- deterministic noise for clay lumps ----------------------------------------------------------------
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o = 4) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; }
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// distance from a point to a polyline (map units)
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

export async function loadGeography(url) {
  const topo = await (await fetch(url)).json();
  const nation = feature(topo, topo.objects.nation);
  const borders = mesh(topo, topo.objects.states, (a, b) => a !== b);
  const ranges = RANGES.map((r) => ({ ...r, P: r.pts.map(([lo, la]) => P(lo, la)).filter(Boolean) }));
  const blobs = BLOBS.map((b) => ({ ...b, P: P(...b.c) })).filter((b) => b.P);
  const sites = Object.fromEntries(Object.entries(SITES).map(([k, s]) => [k, { ...s, id: k, a: P(...s.lonlat) }]));

  // land mask (R) + state borders (G) at K px per map unit, and a blurred copy for the coastal taper
  const K = 2, W = MAP_W * K, H = MAP_H * K;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.scale(K, K);
  const path = geoPath(null, g);
  g.fillStyle = '#000'; g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle = '#f00'; g.beginPath(); path(nation); g.fill();
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#0f0'; g.lineWidth = 0.9; g.lineJoin = 'round';
  g.beginPath(); path(borders); g.stroke(); g.globalCompositeOperation = 'source-over';
  const blur = document.createElement('canvas'); blur.width = W / 2; blur.height = H / 2;
  const bg = blur.getContext('2d'); bg.filter = 'blur(7px)'; bg.drawImage(c, 0, 0, W / 2, H / 2);
  const mask = g.getImageData(0, 0, W, H).data, soft = bg.getImageData(0, 0, W / 2, H / 2).data;
  const inside = (ax, ay) => { const x = Math.round(ax * K), y = Math.round(ay * K); return x >= 0 && y >= 0 && x < W && y < H && mask[(y * W + x) * 4] > 127; };
  const coast = (ax, ay) => { const x = Math.round(ax), y = Math.round(ay); if (x < 0 || y < 0 || x >= W / 2 || y >= H / 2) return 0; return soft[(y * (W / 2) + x) * 4] / 255; };

  // height model (map units); story sites are flattened so their dioramas sit level
  function height(ax, ay) {
    if (!inside(ax, ay)) return -1.2;
    let h = 0.55 + 1.1 * fbm(ax * 0.035, ay * 0.035) + 0.5 * fbm(ax * 0.12 + 7, ay * 0.12);
    for (const r of ranges) {
      let d = 1e9; for (let i = 0; i < r.P.length - 1; i++) d = Math.min(d, segDist(ax, ay, ...r.P[i], ...r.P[i + 1]));
      if (d > r.w * 2.4) continue;
      const ridge = 1 - Math.abs(fbm(ax * 0.09 + r.w, ay * 0.09) * 2 - 1);               // ridged lumps = peaks
      h += r.h * Math.exp(-((d / r.w) ** 2)) * (0.45 + 0.75 * ridge);
    }
    for (const b of blobs) {
      const d = Math.hypot(ax - b.P[0], ay - b.P[1]); if (d > b.r * 2) continue;
      const k = b.flat ? smoothstep(b.r, b.r * 0.6, d) : Math.exp(-((d / b.r) ** 2) * 2);
      h += b.h * k * (b.ridged ? 0.4 + 0.9 * Math.abs(Math.sin(ax * 0.35 + fbm(ax * 0.05, ay * 0.05) * 6)) : 0.8 + 0.4 * fbm(ax * 0.1, ay * 0.1));
    }
    h *= 0.35 + 0.65 * smoothstep(0.35, 0.95, coast(ax, ay));                                 // gentle coasts
    for (const s of Object.values(sites)) {                                                    // level ground for dioramas
      const d = Math.hypot(ax - s.a[0], ay - s.a[1]);
      if (d < s.flatR * 2) h += (siteBase(s) - h) * smoothstep(s.flatR * 2, s.flatR, d);
    }
    return h;
  }
  function siteBase(s) { if (s.base == null) s.base = 0.9 + 0.6 * fbm(s.a[0] * 0.035, s.a[1] * 0.035); return s.base; }

  // clay colours: winter across the north, wheat plains, desert southwest, green south and coasts, snowy peaks
  function colour(ax, ay, h) {
    const hex = (n) => [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    const n = fbm(ax * 0.05 + 3, ay * 0.05);
    let col = mix(hex(0x7ea85a), hex(0x6a9a4c), smoothstep(330, 430, ay));                    // fresh green clay, deeper in the south
    col = mix(col, hex(0xd9b25c), smoothstep(560, 470, ax) * smoothstep(250, 330, ax) * (0.75 + 0.25 * n)); // golden plains
    col = mix(col, hex(0xd98b5a), smoothstep(400, 330, ax) * smoothstep(250, 330, ay));          // terracotta desert
    col = mix(col, hex(0xc4643f), smoothstep(80, 30, Math.hypot(ax - 268, ay - 300)));          // red rock country
    col = mix(col, hex(0x4f8048), smoothstep(160, 120, ax) * smoothstep(220, 120, ay));          // Pacific Northwest
    col = mix(col, hex(0x9b8676), smoothstep(5, 11, h));                                         // mountain rock
    // winter: snow across the northern tier, reaching further south around the Great Lakes and Appalachians
    const line = 212 + 72 * smoothstep(560, 690, ax) * smoothstep(900, 780, ax);
    const winter = smoothstep(line + 22, line - 28, ay + (n - 0.5) * 50);
    const peaks = smoothstep(7, 12, h);
    col = mix(col, hex(0xf5f2ec), Math.min(1, winter * 0.9 + peaks));
    for (const s of Object.values(sites)) { const d = Math.hypot(ax - s.a[0], ay - s.a[1]); col = mix(col, hex(0xf1eee8), smoothstep(s.flatR * 1.6, s.flatR * 0.8, d)); }
    return col;
  }

  // forest density: Pacific Northwest, northern woods, New England, Appalachians, the Southeast, mountain slopes
  function forest(ax, ay, h) {
    if (!inside(ax, ay)) return 0;
    let f = 0;
    f += smoothstep(175, 110, ax) * smoothstep(230, 120, ay);
    f += smoothstep(560, 620, ax) * smoothstep(215, 165, ay) * smoothstep(780, 700, ax) * 0.8;
    f += smoothstep(800, 860, ax) * smoothstep(210, 120, ay);
    f += smoothstep(1.5, 4, h) * smoothstep(9, 6, h) * 0.9;
    f += smoothstep(380, 430, ay) * smoothstep(620, 680, ax) * 0.55;
    return Math.min(1, f) * (0.55 + 0.45 * fbm(ax * 0.08, ay * 0.08 + 9));
  }

  return { topo, nation, borders, maskCanvas: c, inside, height, colour, forest, sites, ranges, siteBase,
    towns: TOWNS.map((t) => P(...t)).filter(Boolean), lines: Object.fromEntries(Object.entries(LINES).map(([k, v]) => [k, v.map((p) => P(...p)).filter(Boolean)])) };
}
