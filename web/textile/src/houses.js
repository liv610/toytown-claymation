// A neighbour's house in the same construction language as the hero buildings: sewn felt or cloth walls, curtained
// windows in card or wood frames, felt shutters, a tab roof, at the footprint the clay village used (corner.json).
import * as THREE from 'three';
import { rect, roundRect, M, V, basis } from './vendor/kit.js';
import { C, holly, cardFrame, curtain, shutter, chimney } from './buildings.js';

/**
 * spec (Blender units, from corner.json): pos [x, y, z], W, D, H, pitch (deg), color (linear rgb), rot_z, gable_front.
 * detail: 1 for street neighbours, 0 for the row behind (bigger tabs, coarser stuffing, no shutters or stitching).
 */
/** a window frame cut from cream felt, outlined in running stitch (the felt look's frame) */
function feltFrame(k, F, x0, y0, x1, y1, z, { b = 0.09, thread = 0x3a2a22 } = {}) {
  k.cut(roundRect(x0 - b, y0 - b, x1 + b, y1 + b, 0.05), [roundRect(x0, y0, x1, y1, 0.03)], F.clone().multiply(M([0, 0, z])), 0xf0e2c4, { t: 0.05, bevel: 0.02, amp: 0.006 });
  k.S.running(F.clone().multiply(M([0, 0, z + 0.052])), roundRect(x0 - b * 0.5, y0 - b * 0.5, x1 + b * 0.5, y1 + b * 0.5, 0.04), 0, thread, { closed: true, len: 0.06, gap: 0.04, r: 0.009 });
}
export function house(k, spec, { detail = 1, seed = 1, roofFabrics = null, batch = 'felt', style = 'textile' } = {}) {
  const felt = style === 'felt';
  const { W, D, H, gable_front: gf } = spec, pitch = THREE.MathUtils.degToRad(spec.pitch), hw = W / 2;
  const col = new THREE.Color().setRGB(...spec.color).getHex();
  const Mb = M([spec.pos[0], spec.pos[2], -spec.pos[1]], [0, spec.rot_z, 0]);
  const F = (x = 0, y = 0, z = 0, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  let s0 = seed * 7919 + 13; const rr = () => ((s0 = (s0 * 9301 + 49297) % 233280) / 233280);
  const ridgeH = H + (gf ? hw : D / 2) * Math.tan(pitch), front = gf ? [[-hw, 0], [hw, 0], [hw, H], [0, ridgeH], [-hw, H]] : rect(-hw, 0, hw, H);
  // openings on the street face: a door, and windows on each floor (most lit behind gathered curtains)
  const floors = Math.max(1, Math.floor((H - 0.5) / 1.5)), cols = Math.max(2, Math.floor(W / 1.2)), holes = [], wins = [];
  const doorX = (rr() - 0.5) * W * 0.4, dw = 0.75;
  holes.push(rect(doorX - dw / 2, 0.15, doorX + dw / 2, 1.85));
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    const cx = -hw + (c + 0.5) * W / cols, cy = 0.75 + f * 1.5, w = 0.55, h = 0.75;
    if (f === 0 && Math.abs(cx - doorX) < 0.75) continue;
    holes.push(rect(cx - w / 2, cy, cx + w / 2, cy + h)); wins.push([cx - w / 2, cy, cx + w / 2, cy + h, rr() < 0.82]);
  }
  const t = felt ? 0.09 : 0.07, stuff = (detail ? 0.03 : 0.018) * (felt ? 1.4 : 1);
  k.sewnWall(front, holes, Mb, col, { seams: [-hw * 0.3, hw * 0.35], batch, stuff, t, pucker: detail && !felt ? 0.005 : 0, stitch: !!detail, grid: detail ? 0.16 : 0.32, thread: felt ? 0x3a2a22 : 0xf4ead6 });
  k.sewnWall(front, null, F(0, 0, -D + t), col, { seams: [0], batch, stuff: 0, t, pucker: 0, stitch: false });
  for (const s of [1, -1]) {
    const side = gf ? rect(0, 0, D, H) : [[0, 0], [D, 0], [D, H], [D / 2, ridgeH], [0, H]];
    const P = Mb.clone().multiply(basis(V(s * (hw - (s > 0 ? 0 : t)), 0, s > 0 ? 0 : -D), V(0, 0, s > 0 ? -1 : 1), V(0, 1, 0)));
    k.sewnWall(side, detail ? [rect(D * 0.35, 1.0, D * 0.35 + 0.5, 1.7)] : null, P, col, { seams: [D * 0.6], batch, stuff: stuff * 0.7, t, pucker: 0, stitch: !!detail, grid: detail ? 0.2 : 0.4 });
    if (detail) { curtain(k, P, D * 0.35, 1.0, D * 0.35 + 0.5, 1.7, -0.04); if (felt) feltFrame(k, P, D * 0.35, 1.0, D * 0.35 + 0.5, 1.7, t); else cardFrame(k, P, D * 0.35, 1.0, D * 0.35 + 0.5, 1.7, t, { border: 0.07 }); }
  }
  const shutterCol = [0x8a2a2a, 0x2f5a45, 0x3a4a6e, 0x6a4a2a][seed % 4];
  for (const [x0, y0, x1, y1, lit] of wins) {
    curtain(k, F(), x0, y0, x1, y1, -0.04, lit ? C.glow : 0x4a4058);
    if (felt) feltFrame(k, F(), x0, y0, x1, y1, t); else if ((seed + Math.round(x0 * 3)) % 2) k.woodFrame(F(), x0, y0, x1, y1, t, C.cream, { w: 0.07 }); else cardFrame(k, F(), x0, y0, x1, y1, t, { border: 0.075 });
    if (detail) { shutter(k, F(), x0 - 0.15, y0 - 0.03, 0.3, y1 - y0 + 0.06, -1, 0.35, shutterCol, t + 0.004); shutter(k, F(), x1 + 0.15, y0 - 0.03, 0.3, y1 - y0 + 0.06, 1, 0.4, shutterCol, t + 0.004); }
    k.lump((x1 - x0) * 0.55, 0.035, 0.06, F((x0 + x1) / 2, y0 - 0.06, t + 0.05), C.white, { batch: 'batt', detail: 1, amp: 0.3 });
  }
  // the door: a felt panel with an appliqué inset, a wooden knob, a sprig of holly
  const dc = [0x6a2a2a, 0x2f5a45, 0x3a4a6e][seed % 3];
  k.panel(rect(doorX - dw / 2 + 0.01, 0.16, doorX + dw / 2 - 0.01, 1.84), null, F(0, 0, -0.02), dc, { t: 0.05, stuff: 0, amp: 0.004 });
  k.cut(roundRect(doorX - 0.22, 0.4, doorX + 0.22, 1.5, 0.05), null, F(0, 0, 0.03), new THREE.Color(dc).multiplyScalar(0.8).getHex(), { t: 0.025, bevel: 0.008, amp: 0.003 });
  k.solid(new THREE.SphereGeometry(0.04, 10, 8), F(doorX + dw / 2 - 0.14, 0.95, 0.07), C.gold, { batch: 'paint' });
  if (detail) holly(k, F(doorX, 1.95, t + 0.02), 3, 0.7);
  // roof: rows of felt tabs (sometimes a patch of calico among them), a folded ridge strip, batting
  const fabrics = roofFabrics || [[{ color: 0x4d4a68 }, { color: 0x605d7e }], [{ color: 0x6b3326 }, { color: 0x7d4434 }, { color: 0xb4545a, batch: 'print', extra: 1 }], [{ color: 0x46604a }, { color: 0x557359 }], [{ color: 0x5a3b2e }, { color: 0x6c4a3a }, { color: 0xd7a35a, batch: 'print', extra: 0 }]][seed % 4];
  const R = gf ? Mb : Mb.clone().multiply(M([0, 0, -D / 2], [0, Math.PI / 2, 0]));
  const roofO = gf ? { halfSpan: hw, zf: 0.3, zb: -D - 0.3 } : { halfSpan: D / 2, zf: hw + 0.3, zb: -hw - 0.3 };
  const roof = k.shingleRoof(R, { ...roofO, eaveH: H, pitch, fabrics, tile: detail ? 0.34 : 0.5, rowH: detail ? 0.28 : 0.38, sag: 0.06 + rr() * 0.05, shape: rr() < 0.5 ? 'round' : 'square' });
  if (rr() < 0.7) { const cx = (rr() - 0.5) * W * 0.4; chimney(k, Mb, cx, -D * 0.45, gf ? roof.heightAt(cx) - 0.1 : ridgeH - 0.4, ridgeH + 0.7); }
  // a drift of batting along the foot of the street wall
  k.drape(F(0, 0.02, 0.35, [-Math.PI / 2, 0, 0]), -hw - 0.1, hw + 0.1, -0.5, 0.0, { thick: 0.12, edge: 0.2, rag: 0.2, res: 0.15 });
}
