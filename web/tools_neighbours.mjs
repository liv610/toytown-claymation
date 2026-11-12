// Canada, Mexico, Central America and the Caribbean for the felt national map, projected into the same coordinates as
// the US map (Albers, the lower-48 part of us-atlas' Albers USA: geoAlbers().scale(1300).translate([487.5, 305])) and
// cut to the map board. Writes web/national/assets/neighbours-albers.json (GeoJSON, projected [x, y]).
//   cd web && node tools_neighbours.mjs
// Data: world-atlas 2.0.2 countries-50m (Natural Earth, public domain; package ISC licence). npm install --no-save world-atlas@2.0.2
import fs from 'fs';
import { createRequire } from 'module';
import { geoAlbers } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const A = geoAlbers().scale(1300).translate([487.5, 305]);
const BOARD = [-260, -180, 1180, 840];   // x0, y0, x1, y1 (map units): the felt board, with a margin
const KEEP = { 124: 'Canada', 484: 'Mexico', 192: 'Cuba', 44: 'Bahamas', 332: 'Haiti', 214: 'Dominican Republic', 388: 'Jamaica', 630: 'Puerto Rico',
  320: 'Guatemala', 84: 'Belize', 340: 'Honduras', 222: 'El Salvador', 558: 'Nicaragua', 136: 'Cayman Islands', 796: 'Turks and Caicos' };
const out = { type: 'FeatureCollection', features: [] };
// Sutherland–Hodgman: cut a ring to the board rectangle (so the felt backing never reaches past the frame)
function clipRing(r) {
  const [x0, y0, x1, y1] = BOARD;
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]], [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
  let pts = r.slice(0, -1);
  for (const [inside, cut] of edges) {
    const res = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b); if (ia) res.push(a); if (ia !== ib) res.push(cut(a, b).map((v) => +v.toFixed(2))); }
    pts = res; if (!pts.length) break;
  }
  return pts.length > 2 ? [...pts, pts[0]] : [];
}
let pts = 0;
for (const f of feature(topo, topo.objects.countries).features) {
  const name = KEEP[+f.id]; if (!name) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, keep = [];
  for (const poly of polys) {
    const rings = poly.map((ring) => {
      const r = []; let last = null;
      for (const [lo, la] of ring) { const p = A([lo, la]); if (!p) continue; if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) continue; r.push([+p[0].toFixed(2), +p[1].toFixed(2)]); last = p; }
      if (r.length > 2) r.push(r[0]);
      return r;
    }).map(clipRing).filter((r) => r.length > 3);
    if (!rings.length) continue;
    const xs = rings[0].map((p) => p[0]), ys = rings[0].map((p) => p[1]);
    if (Math.max(...xs) < BOARD[0] || Math.min(...xs) > BOARD[2] || Math.max(...ys) < BOARD[1] || Math.min(...ys) > BOARD[3]) continue;   // off the board
    if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < 0.5) continue;                                         // specks
    keep.push(rings); pts += rings.reduce((s, r) => s + r.length, 0);
  }
  if (keep.length) out.features.push({ type: 'Feature', id: f.id, properties: { name }, geometry: { type: 'MultiPolygon', coordinates: keep } });
}
fs.writeFileSync('national/assets/neighbours-albers.json', JSON.stringify(out));
console.log(out.features.map((f) => f.properties.name).join(', '), '·', pts, 'points ·', (fs.statSync('national/assets/neighbours-albers.json').size / 1024).toFixed(0), 'KB');
