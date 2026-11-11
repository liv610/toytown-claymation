// PLACEHOLDER illustrated national map, drawn on a canvas in a folk-art storybook style.
// It stands in for the real folk-art national map (a separate project this experiment does not touch).
// Outline: US Census state boundaries via the us-atlas package (Albers USA, 975 × 610 units), public domain data.
// The real map only needs to supply its artwork as an image plus the positions of places in the same units.
import { feature, mesh } from 'topojson-client';
import { geoPath } from 'd3-geo';

export const MAP_W = 975, MAP_H = 610;
// fictional communities used by the story (positions in map units); none is a real campaign
export const COMMUNITIES = [
  { id: 'maple', name: 'Maple Hollow', x: 706, y: 266, chapter: 1 },
  { id: 'riverton', name: 'Riverton', x: 744, y: 236, chapter: 2 },
  { id: 'c1', name: '', x: 172, y: 142 }, { id: 'c2', name: '', x: 96, y: 300 }, { id: 'c3', name: '', x: 268, y: 330 },
  { id: 'c4', name: '', x: 395, y: 190 }, { id: 'c5', name: '', x: 470, y: 330 }, { id: 'c6', name: '', x: 560, y: 160 },
  { id: 'c7', name: '', x: 600, y: 420 }, { id: 'c8', name: '', x: 760, y: 340 }, { id: 'c9', name: '', x: 860, y: 140 },
  { id: 'c10', name: '', x: 820, y: 230 }, { id: 'c11', name: '', x: 515, y: 470 }, { id: 'c12', name: '', x: 330, y: 470 },
];
// symbolic rail lines (map units), drawn as smooth curves through communities
export const LINES = {
  red: [[96, 300], [268, 330], [470, 330], [706, 266], [744, 236], [820, 230], [860, 140]],
  blue: [[172, 142], [395, 190], [560, 160], [706, 266], [760, 340], [600, 420]],
  green: [[330, 470], [515, 470], [600, 420], [760, 340], [820, 230]],
};
const INK = '#4a3524', PAPER = '#efe2c6';

function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }

export async function drawIllustratedMap(topoUrl, K = 4) {
  const topo = await (await fetch(topoUrl)).json();
  const states = feature(topo, topo.objects.states).features;
  const nation = feature(topo, topo.objects.nation);
  const borders = mesh(topo, topo.objects.states, (a, b) => a !== b);
  const c = document.createElement('canvas'); c.width = MAP_W * K; c.height = MAP_H * K;
  const g = c.getContext('2d'); g.scale(K, K);
  const path = geoPath(null, g);
  const r = rng(7);

  // paper: base, grain, warm vignette
  g.fillStyle = PAPER; g.fillRect(0, 0, MAP_W, MAP_H);
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,90,60' : '255,250,235'},${0.04 + r() * 0.06})`; g.fillRect(r() * MAP_W, r() * MAP_H, 0.6 + r(), 0.6 + r()); }
  const vg = g.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.35, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(110,70,30,0.28)'); g.fillStyle = vg; g.fillRect(0, 0, MAP_W, MAP_H);

  // coastline ripples (folk-art water lines)
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const [w, a] of [[34, 0.07], [22, 0.1], [12, 0.14]]) { g.beginPath(); path(nation); g.strokeStyle = `rgba(70,120,150,${a})`; g.lineWidth = w; g.stroke(); }

  // states: soft washes, a little hand-tinted variation
  const tints = ['#e7cba0', '#d8c08e', '#cdd3ad', '#e2c6b3', '#c8d5c3', '#e6d7a8', '#d9c9b5'];
  for (const s of states) {
    const h = [...s.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
    g.beginPath(); path(s); g.fillStyle = tints[h % tints.length]; g.fill();
  }
  // winter: snow settles across the north
  g.save(); g.beginPath(); path(nation); g.clip();
  const sg = g.createLinearGradient(0, 40, 0, 330); sg.addColorStop(0, 'rgba(255,255,255,0.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sg; g.fillRect(0, 0, MAP_W, MAP_H);
  for (let i = 0; i < 4000; i++) { const y = r() * 340; if (r() > 1 - y / 340) continue; g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(r() * MAP_W, y, 0.6 + r() * 1.2, 0, 7); g.fill(); }
  // painted landscape icons
  const inside = (s, x, y) => { g.beginPath(); path(s); return g.isPointInPath(x * K, y * K); };
  const byId = Object.fromEntries(states.map((s) => [s.id, s]));
  const scatter = (ids, n, draw) => { for (const id of ids) { const s = byId[id]; if (!s) continue; const [[x0, y0], [x1, y1]] = path.bounds(s); for (let i = 0, k = 0; i < n * 6 && k < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); if (inside(s, x, y)) { draw(x, y); k++; } } } };
  const mountain = (x, y) => { const s = 7 + r() * 6; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 1.2); g.lineTo(x + s, y); g.closePath(); g.fillStyle = '#a99a86'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke(); g.beginPath(); g.moveTo(x - s * 0.38, y - s * 0.75); g.lineTo(x, y - s * 1.2); g.lineTo(x + s * 0.38, y - s * 0.75); g.lineTo(x + s * 0.1, y - s * 0.62); g.lineTo(x - s * 0.1, y - s * 0.8); g.closePath(); g.fillStyle = '#fbf7ef'; g.fill(); };
  const pine = (x, y) => { const s = 3 + r() * 2; g.fillStyle = r() < 0.5 ? '#3f6b4c' : '#4c7a55'; g.beginPath(); g.moveTo(x, y - s * 2.2); g.lineTo(x + s, y); g.lineTo(x - s, y); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - s * 0.4, y - s * 1.3); g.lineTo(x, y - s * 2.2); g.lineTo(x + s * 0.4, y - s * 1.3); g.stroke(); };
  const wheat = (x, y) => { g.strokeStyle = '#b8955a'; g.lineWidth = 0.7; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 2.4, y); g.lineTo(x + i * 2.4 + 0.8, y - 5); g.stroke(); } };
  const cactus = (x, y) => { g.strokeStyle = '#5f8a5a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 7); g.moveTo(x, y - 4); g.lineTo(x - 2.5, y - 4); g.lineTo(x - 2.5, y - 6); g.moveTo(x, y - 3); g.lineTo(x + 2.5, y - 3); g.lineTo(x + 2.5, y - 5.5); g.stroke(); };
  scatter(['08', '49', '56', '30', '16', '35', '32'], 7, mountain); scatter(['53', '41', '06'], 4, mountain);
  scatter(['53', '41', '23', '27', '55', '26', '33', '50', '36', '42', '54', '51', '37', '13', '01', '28', '47', '21', '02'], 6, pine);
  scatter(['20', '31', '19', '38', '46', '40', '17', '18', '39', '29'], 7, wheat);
  scatter(['04', '35', '48'], 5, cactus);
  g.restore();

  // inked borders: dashed state lines, a doubled national outline
  g.setLineDash([3, 2.5]); g.beginPath(); path(borders); g.strokeStyle = 'rgba(74,53,36,0.55)'; g.lineWidth = 0.8; g.stroke(); g.setLineDash([]);
  g.beginPath(); path(nation); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
  g.beginPath(); path(nation); g.strokeStyle = 'rgba(74,53,36,0.35)'; g.lineWidth = 4.5; g.globalCompositeOperation = 'multiply'; g.stroke(); g.globalCompositeOperation = 'source-over';

  // symbolic rail lines with little ties
  const curve = (pts) => { g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } g.lineTo(...pts[pts.length - 1]); };
  for (const [name, pts] of Object.entries(LINES)) {
    const col = { red: '#b8322a', blue: '#2f5f9e', green: '#3a7a52' }[name];
    curve(pts); g.strokeStyle = 'rgba(74,53,36,0.6)'; g.lineWidth = 4.2; g.setLineDash([0.8, 2.6]); g.stroke();
    curve(pts); g.strokeStyle = col; g.lineWidth = 2.2; g.setLineDash([]); g.stroke();
  }
  // communities: little house glyphs
  for (const cm of COMMUNITIES) {
    const { x, y } = cm, s = cm.chapter ? 5.2 : 4;
    g.fillStyle = '#f7efe0'; g.strokeStyle = INK; g.lineWidth = 0.9;
    g.beginPath(); g.rect(x - s, y - s * 0.6, s * 2, s * 1.4); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - s * 1.25, y - s * 0.55); g.lineTo(x, y - s * 1.7); g.lineTo(x + s * 1.25, y - s * 0.55); g.closePath(); g.fillStyle = '#b8322a'; g.fill(); g.stroke();
    g.fillStyle = '#f2b85c'; g.fillRect(x - s * 0.3, y - s * 0.1, s * 0.6, s * 0.6);
    if (cm.name) { g.font = `600 ${cm.chapter ? 8.5 : 7}px Georgia, serif`; g.fillStyle = INK; g.textAlign = 'center'; g.fillText(cm.name, x, y + s * 2.6); }
  }
  // title ribbon, compass, placeholder note, deckled frame
  g.save(); g.translate(150, 548);
  g.fillStyle = '#b8322a'; g.beginPath(); g.moveTo(-122, -16); g.lineTo(122, -16); g.lineTo(134, 0); g.lineTo(122, 16); g.lineTo(-122, 16); g.lineTo(-134, 0); g.closePath(); g.fill();
  g.strokeStyle = '#f2d27a'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = '#fff8ee'; g.font = '600 17px Georgia, serif'; g.textAlign = 'center'; g.fillText('The Railroad of Hope', 0, 6);
  g.restore();
  g.fillStyle = 'rgba(74,53,36,0.75)'; g.font = 'italic 8px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Placeholder illustration · stand-in for the folk-art national map · boundaries: US Census (public domain)', 18, 596);
  g.save(); g.translate(905, 520); g.strokeStyle = INK; g.fillStyle = '#efe2c6'; g.lineWidth = 0.9;
  g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.stroke();
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -20); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fillStyle = i === 3 ? '#b8322a' : '#c9b48e'; g.fill(); g.stroke(); }
  g.fillStyle = INK; g.font = '700 8px Georgia, serif'; g.textAlign = 'center'; g.fillText('N', 0, -25); g.restore();
  g.strokeStyle = 'rgba(74,53,36,0.7)'; g.lineWidth = 2; g.strokeRect(8, 8, MAP_W - 16, MAP_H - 16); g.lineWidth = 0.7; g.strokeRect(13, 13, MAP_W - 26, MAP_H - 26);
  return { canvas: c, communities: COMMUNITIES };
}
