// The toy shop interior, felt look: much bigger inside than out, like a storybook — a grand hall of sewn felt.
// A patchwork quilt floor, tall felt walls, floor-to-ceiling shelves of felt toys, a gallery shelf with a little train
// running round the room, a giant felt Christmas tree under arched snowy windows, a night-sky ceiling with appliqué
// stars, a moon and swaying mobiles, a felt castle, a hot-air balloon, a giant teddy and drifting sparkles.
// The journey's six interactive toys stand in the foreground (display table and counter) — see journey toyshop.js.
// Room-local coordinates: x right, y up, z toward the entrance (+z); floor at y = 0, centred on x = 0.
import * as THREE from 'three';
import { Batch, M, V, rect, roundRect, circle, ellipse, TAU, rng } from './vendor/kit.js';
import { makeKit } from './vendor/textile_kit.js';
import { extendKit } from './construct.js';
import { kitMeshes, materials, timeU } from './materials.js';
import { christmasTree } from './props.js';
import { teddy, wreath, bow, C } from './buildings.js';

export const ROOM = { W: 20, D: 16, H: 10 };

const star = (cx, cy, R, r, n = 5) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i * Math.PI) / n, d = i % 2 ? r : R; p.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); } return p; };

/** returns { group, anchors, update(t, dt), lights: [{ pos, color, intensity, distance }], triangles, buildMs } */
export function buildStoryShop() {
  const t0 = performance.now();
  const { W, D, H } = ROOM, hw = W / 2, hd = D / 2;
  const k = extendKit(makeKit(91)), kb = extendKit(makeKit(93));           // kb: far, high things (no shadows)
  const sk = { lights: new Batch('treeLights', 5), lamp: new Batch('lampGlow', 6) };
  const r = rng(17);
  const group = new THREE.Group(); group.name = 'storybook toy shop';
  const movers = [];   // animated groups (train, mobiles, balloon, sparkles)

  // ---------------- floor: a patchwork quilt of felt squares, each square stitched round its edge
  const quilt = [0xb8463e, 0xe0b04a, 0x3d6fb0, 0x2f7a4c, 0xf0e2c4, 0x8a5aa0, 0xd77a5a, 0x5f8a6e];
  const S = 1.25;
  for (let i = 0; i < W / S; i++) for (let j = 0; j < D / S; j++) {
    const x0 = -hw + i * S, z0 = -hd + j * S, F = M([x0, 0, z0 + S], [-Math.PI / 2, 0, 0]);
    k.cut(rect(0.015, 0.015, S - 0.015, S - 0.015), null, F, quilt[(i * 3 + j * 5 + ((i * j) % 3)) % quilt.length], { t: 0.04, amp: 0.004, wave: 0.4 });
    if ((i + j) % 2 === 0) k.S.running(F, rect(0.09, 0.09, S - 0.09, S - 0.09), 0.042, C.cream, { closed: true, len: 0.08, gap: 0.05, r: 0.008 });
  }
  // a big round rug under the display table
  k.cut(circle(0, 0, 2.6, 48), null, M([0, 0.045, 3.2], [-Math.PI / 2, 0, 0]), 0x7a2a32, { t: 0.03, amp: 0.01 });
  k.cut(circle(0, 0, 2.3, 48), [circle(0, 0, 1.9, 40)], M([0, 0.075, 3.2], [-Math.PI / 2, 0, 0]), 0xe0b04a, { t: 0.02, amp: 0.006 });

  // ---------------- walls: deep teal felt above a scalloped cranberry wainscot, blanket-stitched seams
  const wallCol = 0x2f5a5e, wains = 0x8a2a36;
  const wall = (F, len, holes = null) => {
    k.panel(rect(0, 0, len, H), holes, F, wallCol, { t: 0.12, stuff: 0, amp: 0.01 });
    const sc = []; const n = Math.round(len / 0.6); sc.push([0, 0], [len, 0], [len, 1.4]);
    for (let i = n; i >= 0; i--) { const x = (i / n) * len; sc.push([x, 1.4 + 0.12 * Math.abs(Math.sin((i / n) * n * Math.PI / 1))]); }
    k.cut(sc, null, F.clone().multiply(M([0, 0, 0.12])), wains, { t: 0.04, amp: 0.006 });
    k.S.running(F, sc.slice(2).map(([x, y]) => [x, y - 0.1]), 0.165, C.gold, { len: 0.07, gap: 0.05, r: 0.009 });
    for (let x = 2; x < len - 1; x += 4) k.S.running(F, [[x, 1.6], [x, H - 0.2]], 0.125, 0x1f3d40, { len: 0.12, gap: 0.08, r: 0.01 });   // panel seams
  };
  // back wall with two tall arched windows either side of the tree
  const archW = (cx, w, y0, y1) => { const p = [[cx - w / 2, y0], [cx + w / 2, y0], [cx + w / 2, y1 - w / 2]]; for (let i = 1; i < 16; i++) { const a = (i / 16) * Math.PI; p.push([cx + Math.cos(a) * w / 2, y1 - w / 2 + Math.sin(a) * w / 2]); } p.push([cx - w / 2, y1 - w / 2]); return p; };
  const winX = [6.2 , 13.8];
  wall(M([-hw, 0, -hd]), W, winX.map((x) => archW(x, 2.6, 2.4, 8.2)));
  for (const x of winX) {
    const F = M([-hw, 0, -hd - 0.3]);
    kb.cut(archW(x, 2.7, 2.35, 8.25), null, F, 0x223a78, { batch: 'glow', t: 0.03, amp: 0.004 });                     // night outside
    for (let i = 0; i < 9; i++) kb.cut(star(x - 1 + r() * 2, 3 + r() * 4.6, 0.09, 0.04, 6), null, F.clone().multiply(M([0, 0, 0.035])), 0xf4ead8, { batch: 'glow', t: 0.01, amp: 0 });
    k.cut(archW(x, 3.1, 2.15, 8.45), [archW(x, 2.6, 2.4, 8.2)], M([-hw, 0, -hd + 0.12]), C.cream, { t: 0.08, amp: 0.006 });   // frame
    k.S.running(M([-hw, 0, -hd + 0.2]), archW(x, 2.85, 2.27, 8.33), 0.0, C.threadD, { closed: true, len: 0.08, gap: 0.05, r: 0.01 });
    for (const dx of [-0.43, 0.43]) k.cut(rect(x + dx - 0.04, 2.4, x + dx + 0.04, 7.6), null, M([-hw, 0, -hd + 0.06]), C.cream, { t: 0.05, amp: 0 });   // glazing bars
    k.cut(rect(x - 1.3, 4.9, x + 1.3, 4.98), null, M([-hw, 0, -hd + 0.06]), C.cream, { t: 0.05, amp: 0 });
    k.lump(1.6, 0.18, 0.45, M([x - hw, 2.2, -hd + 0.4]), 0xf7f4ee, { batch: 'batt', detail: 2, amp: 0.25 });         // window-seat cushion of batting
    wreath(k, M([x - hw, 8.8, -hd + 0.25]), 1.6);
  }
  // side walls and the entrance wall (with the door we came through)
  for (const sx of [-1, 1]) wall(M([sx * hw, 0, sx < 0 ? hd : -hd], [0, sx * Math.PI / 2, 0]), D);
  wall(M([hw, 0, hd], [0, Math.PI, 0]), W, [roundRect(hw - 1.1, 0, hw + 1.1, 3.0, 0.4)]);
  // ceiling: night-sky felt with appliqué stars and a crescent moon, scalloped bunting round its edge
  kb.panel(rect(-hw, -hd, hw, hd), null, M([0, H, 0], [Math.PI / 2, 0, 0]), 0x1c2346, { t: 0.1, stuff: 0, amp: 0.01 });
  for (let i = 0; i < 70; i++) { const x = -hw + 0.8 + r() * (W - 1.6), z = -hd + 0.8 + r() * (D - 1.6), R0 = 0.08 + r() * 0.16; kb.cut(star(0, 0, R0, R0 * 0.45), null, M([x, H - 0.02, z], [Math.PI / 2, 0, r() * TAU]), r() < 0.7 ? 0xf2d27a : 0xf4ead8, { batch: 'glow', t: 0.015, amp: 0 }); }
  { const moon = [], n = 30; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; moon.push([Math.cos(a) * 0.9, Math.sin(a) * 0.9]); } for (let i = n; i >= 0; i--) { const a = -Math.PI / 2 + (i / n) * Math.PI; moon.push([0.35 + Math.cos(a) * 0.62, Math.sin(a) * 0.75]); }
    kb.pillow(moon, 0.12, M([-4.5, H - 0.08, -2.5], [Math.PI / 2, 0, 0.5]), 0xf2d27a, { batch: 'glow', flat: 2, rings: 3, step: 0.05 }); }
  for (const [x0, z0, x1, z1] of [[-hw, -hd, hw, -hd], [-hw, hd, hw, hd], [-hw, -hd, -hw, hd], [hw, -hd, hw, hd]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.9), ang = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u; const tri = [[-0.38, 0], [0.38, 0], [0, -0.62]];
      kb.cut(tri, null, M([x, H - 0.25, z], [0, -ang, 0]).multiply(M([0, 0, z0 === z1 ? (z0 < 0 ? 0.2 : -0.2) : (x0 < 0 ? 0.2 : -0.2)], [0, z0 === z1 ? 0 : Math.PI / 2, 0])), [C.red, C.gold, C.green, 0x3d6fb0][i % 4], { t: 0.02, amp: 0.004 }); }
  }

  // ---------------- floor-to-ceiling shelves of felt toys down both side walls, with ladders
  const toyFns = [
    (F, s) => teddy(k, F, s * 1.6),
    (F, s) => { const cols = [C.red, 0x3d6fb0, 0xe0b04a, C.green]; [[0, 0, 0], [0.16, 0, 0.02], [0.08, 0.15, 0.01]].forEach(([x, y, z], i) => k.solid(new THREE.BoxGeometry(0.14, 0.14, 0.14), F.clone().multiply(M([x * s, (y + 0.07) * s, z], [0, i * 0.3, 0])), cols[(i + Math.round(s * 7)) % 4], { batch: 'paint', smooth: false })); },
    (F, s) => { k.solid(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.2 * s, 16), F.clone().multiply(M([0, 0.1 * s, 0])), C.red, { batch: 'paint', smooth: false }); for (const y of [0.01, 0.19]) k.solid(new THREE.CylinderGeometry(0.145 * s, 0.145 * s, 0.03 * s, 16), F.clone().multiply(M([0, y * s, 0])), C.gold, { batch: 'paint', smooth: false }); },
    (F, s) => { k.lump(0.16 * s, 0.16 * s, 0.16 * s, F.clone().multiply(M([0, 0.16 * s, 0])), [0xe0b04a, 0x3d6fb0, C.red, 0x8a5aa0][Math.round(s * 13) % 4], { detail: 2, amp: 0.02 }); },   // a stuffed ball
    (F, s) => { const g = new THREE.CylinderGeometry(0.0, 0.18 * s, 0.22 * s, 4, 1); g.rotateY(Math.PI / 4); k.solid(new THREE.BoxGeometry(0.28 * s, 0.24 * s, 0.2 * s), F.clone().multiply(M([0, 0.12 * s, 0])), 0xf0c9c0, { batch: 'paint', smooth: false }); k.solid(g, F.clone().multiply(M([0, 0.35 * s, 0])), C.red, { batch: 'paint', smooth: false }); },   // dollhouse
    (F, s) => { k.lump(0.1 * s, 0.22 * s, 0.1 * s, F.clone().multiply(M([0, 0.22 * s, 0])), [0x3d6fb0, C.red, C.green][Math.round(s * 9) % 3], { detail: 2, amp: 0.03 }); k.lump(0.08 * s, 0.08 * s, 0.08 * s, F.clone().multiply(M([0, 0.5 * s, 0])), 0xe8c8a8, { detail: 2, amp: 0 }); k.lump(0.085 * s, 0.05 * s, 0.085 * s, F.clone().multiply(M([0, 0.58 * s, 0])), 0x2a2630, { detail: 1, amp: 0 }); },   // a toy soldier / doll
  ];
  const shelfRows = [0.9, 2.1, 3.3, 4.5, 5.7];
  for (const sx of [-1, 1]) {
    const xw = sx * (hw - 0.12), z0 = -hd + 1.0, z1 = hd - 2.4, depth = 0.7;
    const T = (x, y, z, ry = 0) => M([x, y, z], [0, ry, 0]);
    // carcass: uprights and shelves of painted wood, a scalloped felt valance on each shelf edge
    for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 4) k.solid(new THREE.BoxGeometry(depth, 6.4, 0.12), T(xw - sx * depth / 2, 3.2, z), 0x7a4b2a, { batch: 'paint', smooth: false });
    for (const y of shelfRows) {
      k.solid(new THREE.BoxGeometry(depth, 0.08, z1 - z0 + 0.12), T(xw - sx * depth / 2, y - 0.04, (z0 + z1) / 2), 0x8a5a36, { batch: 'paint', smooth: false });
      const L = z1 - z0, n = Math.round(L / 0.35), val = [[0, 0], [L, 0]]; for (let i = n; i >= 0; i--) val.push([(i / n) * L, -0.1 - 0.06 * Math.abs(Math.sin(i * Math.PI / 2))]);
      k.cut(val, null, M([xw - sx * depth, y - 0.02, sx > 0 ? z0 : z1], [0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0]), [C.red, C.gold, C.green][Math.round(y) % 3], { t: 0.025, amp: 0.004 });
      // toys along the shelf
      for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.45 + r() * 0.25) {
        const fn = toyFns[Math.floor(r() * toyFns.length)], s = 0.9 + r() * 0.5;
        fn(T(xw - sx * (0.32 + r() * 0.1), y, z, -sx * Math.PI / 2 + (r() - 0.5) * 0.6), s);
      }
    }
    k.solid(new THREE.BoxGeometry(depth + 0.1, 0.14, z1 - z0 + 0.3), T(xw - sx * depth / 2, 6.45, (z0 + z1) / 2), 0x6a3f22, { batch: 'paint', smooth: false });
    // a rolling library ladder leaning on the shelves
    const lz = (z0 + z1) / 2 + sx * 2.2, lx = xw - sx * (depth + 0.55);
    for (const dz of [-0.28, 0.28]) k.solid(new THREE.BoxGeometry(0.07, 6.3, 0.07), M([lx, 3.1, lz + dz], [0, 0, sx * 0.09]), 0x9a6a3a, { batch: 'paint', smooth: false });
    for (let y = 0.4; y < 6; y += 0.42) k.solid(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 8).rotateX(Math.PI / 2), M([lx + sx * y * 0.09, y, lz]), 0x9a6a3a, { batch: 'paint', smooth: false });
  }

  // ---------------- the gallery: a high shelf all round the room with a felt train running on it
  const gy = 7.0, gin = 0.9;
  const gal = [[-hw + gin, -hd + gin], [hw - gin, -hd + gin], [hw - gin, hd - gin], [-hw + gin, hd - gin]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = gal[i], [bx, bz] = gal[(i + 1) % 4], L = Math.hypot(bx - ax, bz - az) + gin * 2, cx = (ax + bx) / 2, cz = (az + bz) / 2, along = Math.abs(bx - ax) > 0.1;
    const ox = along ? 0 : (cx < 0 ? -gin / 2 : gin / 2), oz = along ? (cz < 0 ? -gin / 2 : gin / 2) : 0;
    k.solid(new THREE.BoxGeometry(along ? L : gin * 1.6, 0.12, along ? gin * 1.6 : L), M([cx + ox, gy, cz + oz]), 0x6a3f22, { batch: 'paint', smooth: false });
    // felt garland with glowing lights swagged under the gallery
    const pts = []; const n = Math.round(L / 0.25);
    for (let j = 0; j <= n; j++) { const u = j / n, x = ax + (bx - ax) * u - (along ? 0 : 0), z = az + (bz - az) * u; pts.push(V(x - ox * 0.0, gy - 0.15 - 0.45 * Math.abs(Math.sin(u * Math.PI * Math.round(L / 3))), z)); }
    k.yarn(pts, 0.05, 0x2f6b42);
    for (let j = 0; j < pts.length; j += 2) sk.lights.add(new THREE.SphereGeometry(0.055, 6, 4), M([pts[j].x, pts[j].y - 0.06, pts[j].z]), j % 4 ? 0xffd28a : 0xff9a6a, { vary: 0.03, extra: (j * 0.37) % 1 });
  }
  const loop = new THREE.CatmullRomCurve3(gal.map(([x, z]) => V(x, gy + 0.08, z)), true, 'catmullrom', 0.08), loopL = loop.getLength();
  const rails = []; for (let j = 0; j <= 240; j++) rails.push(loop.getPointAt(j / 240));
  for (const off of [-0.09, 0.09]) k.yarn(rails.map((p, j) => { const t = loop.getTangentAt(j / 240), n = V(-t.z, 0, t.x); return p.clone().addScaledVector(n, off).add(V(0, 0.02, 0)); }), 0.015, 0x5a5560, { closed: true });
  const tk = extendKit(makeKit(95));
  { const P = (x, y, z) => M([x, y, z]);   // engine + two cars, built at the origin facing +x
    tk.solid(new THREE.BoxGeometry(0.5, 0.2, 0.26), P(0, 0.16, 0), C.red, { batch: 'paint', smooth: false });
    tk.solid(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 14).rotateZ(Math.PI / 2), P(0.12, 0.3, 0), 0x2a2630, { batch: 'paint', smooth: false });
    tk.solid(new THREE.BoxGeometry(0.2, 0.24, 0.26), P(-0.14, 0.38, 0), C.red, { batch: 'paint', smooth: false });
    tk.solid(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 10), P(0.22, 0.5, 0), 0x2a2630, { batch: 'paint', smooth: false });
    for (const [cx, col] of [[-0.62, 0x3d6fb0], [-1.14, C.green]]) { tk.solid(new THREE.BoxGeometry(0.44, 0.22, 0.26), P(cx, 0.17, 0), col, { batch: 'paint', smooth: false }); tk.lump(0.12, 0.08, 0.1, P(cx, 0.32, 0), C.gold, { detail: 1, amp: 0.05 }); }
    for (const x of [-1.28, -1.0, -0.76, -0.48, -0.16, 0.16]) for (const z of [-0.14, 0.14]) tk.solid(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 12).rotateX(Math.PI / 2), P(x, 0.065, z), 0xe0b04a, { batch: 'paint', smooth: false });
    for (const [x, y, s] of [[0.24, 0.72, 0.1], [0.12, 0.86, 0.13], [-0.06, 0.98, 0.16]]) tk.lump(s, s * 0.8, s, P(x, y, 0), 0xf7f4ee, { batch: 'batt', detail: 1, amp: 0.3 });   // wool steam
  }
  const trainG = new THREE.Group(); for (const m of kitMeshes(tk)) trainG.add(m); group.add(trainG);
  movers.push((t) => { const u = ((t * 1.1) / loopL) % 1, p = loop.getPointAt(u), tg = loop.getTangentAt(u); trainG.position.copy(p); trainG.rotation.y = Math.atan2(-tg.z, tg.x); });

  // ---------------- the giant felt Christmas tree under the windows, presents round it
  const treeX = 0, treeZ = -hd + 3.2;
  christmasTree(k, sk, treeX, treeZ, 7.6, { R: 2.9, ornaments: 110, lights: 220, orn: 2.2 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + r() * 0.2, d = 1.4 + r() * 0.8, w = 0.4 + r() * 0.45, h = 0.3 + r() * 0.4, col = [C.red, 0x3d6fb0, C.gold, C.green, 0x8a5aa0, C.cream][i % 6];
    const F = M([treeX + Math.cos(a) * d, h / 2, treeZ + Math.sin(a) * d], [0, r() * TAU, 0]);
    k.solid(new THREE.BoxGeometry(w, h, w * 0.85), F, col, { batch: 'woven', smooth: false });
    k.solid(new THREE.BoxGeometry(w + 0.01, h + 0.01, 0.07), F, i % 2 ? C.gold : C.cream, { batch: 'woven', smooth: false });
    bow(k, F.clone().multiply(M([0, h / 2 + 0.03, 0], [-Math.PI / 2, 0, 0])), i % 2 ? C.gold : C.red, 1.3);
  }

  // ---------------- centrepieces: a felt castle, a big rocking horse, a giant teddy, a hot-air balloon
  { const cx = -6.2, cz = -2.5, P = (x, y, z, ry = 0) => M([cx + x, y, cz + z], [0, ry, 0]);   // castle
    const wallC = 0xc9b8d8, roofC = 0x3d6fb0;
    k.solid(new THREE.BoxGeometry(3.2, 2.0, 2.2), P(0, 1.0, 0), wallC, { smooth: false });
    for (let i = 0; i < 7; i++) k.solid(new THREE.BoxGeometry(0.3, 0.3, 2.25), P(-1.45 + i * 0.48, 2.15, 0), wallC, { smooth: false });
    for (const [x, z] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) {
      k.solid(new THREE.CylinderGeometry(0.55, 0.6, 3.0, 20), P(x, 1.5, z), wallC);
      k.solid(new THREE.ConeGeometry(0.75, 1.5, 20), P(x, 3.75, z), roofC);
      k.cut([[0, 0], [0.5, 0.18], [0, 0.36]], null, P(x, 4.5, z), [C.red, C.gold][Math.abs(x + z) > 2.5 ? 0 : 1], { t: 0.02, amp: 0 });
    }
    k.cut(roundRect(-0.45, 0, 0.45, 1.2, 0.4), null, P(0, 0, 1.11), 0x6a3f22, { t: 0.05 });
    for (const x of [-0.9, 0.9]) k.cut(roundRect(-0.18, 0, 0.18, 0.5, 0.17), null, P(x, 1.1, 1.11), C.glow, { batch: 'glow', t: 0.03 });
  }
  { const F = M([6.3, 0, -1.8], [0, -0.6, 0]), s = 3.2;   // rocking horse
    const horse = [[-0.25, 0.05], [0.25, 0.05], [0.18, 0.12], [0.16, 0.32], [0.3, 0.55], [0.22, 0.6], [0.08, 0.44], [-0.14, 0.42], [-0.22, 0.48], [-0.24, 0.3], [-0.16, 0.12]].map(([x, y]) => [x * s, y * s + 0.2]);
    for (const z of [-0.18, 0.18]) k.panel(horse, null, F.clone().multiply(M([0, 0, z])), 0xf0e2c4, { t: 0.16, stuff: 0.08, amp: 0.01 });
    k.lump(0.5, 0.16, 0.22, F.clone().multiply(M([-0.05 * s, 0.38 * s + 0.2, 0])), C.red, { detail: 2, amp: 0.02 });   // saddle
    const rocker = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * 1.25 + (i / 24) * Math.PI * 0.5; rocker.push([Math.cos(a) * 3.0, 3.0 + Math.sin(a) * 3.0 + 0.08]); }
    for (let i = 24; i >= 0; i--) { const a = Math.PI * 1.25 + (i / 24) * Math.PI * 0.5; rocker.push([Math.cos(a) * 2.86, 3.0 + Math.sin(a) * 2.86 + 0.08]); }
    for (const z of [-0.3, 0.3]) k.cut(rocker, null, F.clone().multiply(M([0, 0, z])), 0x7a4b2a, { t: 0.1, amp: 0.004 });
    k.yarn([V(0.3 * s, 0.56 * s, 0), V(-0.1 * s, 0.5 * s, 0.25), V(-0.2 * s, 0.42 * s, 0.1)].map((p) => p.applyMatrix4(F)), 0.03, C.gold);
  }
  teddy(k, M([-7.4, 0, 3.4], [0, 0.7, 0]), 6.5);                    // a giant teddy sitting by the shelves
  // hot-air balloon hanging from the ceiling: felt gores, a basket, swaying on its thread
  const balloon = (() => {
    const bk = extendKit(makeKit(97)), n = 8;
    for (let i = 0; i < n; i++) {
      const g = new THREE.SphereGeometry(1.1, 6, 12, (i / n) * TAU, TAU / n, 0, Math.PI * 0.82); g.scale(1, 1.2, 1);
      bk.solid(g, M([0, 0, 0]), [C.red, C.cream, 0x3d6fb0, C.gold][i % 4], { smooth: false });
    }
    bk.solid(new THREE.CylinderGeometry(0.32, 0.26, 0.4, 14), M([0, -1.95, 0]), 0x9a6a3a, { batch: 'woven', smooth: false });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; bk.S.add(V(Math.cos(a) * 0.5, -1.0, Math.sin(a) * 0.5), V(Math.cos(a) * 0.28, -1.75, Math.sin(a) * 0.28), C.threadD, 0.012); }
    const g = new THREE.Group(); for (const m of kitMeshes(bk, { cast: false })) g.add(m); return g;
  })();
  const bal = new THREE.Group(); bal.position.set(4.5, H - 0.1, 1.0); balloon.position.y = -2.1; bal.add(balloon); group.add(bal);
  movers.push((t) => { bal.rotation.z = 0.05 * Math.sin(t * 0.6); bal.rotation.x = 0.04 * Math.sin(t * 0.47 + 1); balloon.rotation.y = t * 0.08; });
  // mobiles: felt stars and little planets on threads, turning slowly
  const mobiles = [];
  for (const [mx, mz] of [[-2.5, 0.5], [2.0, -3.5], [-5, 5], [6.5, 4.8]]) {
    const mk = extendKit(makeKit(101 + mobiles.length)), arms = 3;
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * TAU, x = Math.cos(a) * 0.8, z = Math.sin(a) * 0.8, drop = 0.6 + (i % 2) * 0.4;
      mk.S.add(V(0, 0, 0), V(x, -0.1, z), C.thread, 0.01); mk.S.add(V(x, -0.1, z), V(x, -drop, z), C.thread, 0.008);
      if (i % 2) mk.lump(0.18, 0.18, 0.18, M([x, -drop - 0.18, z]), [0x8a5aa0, 0x3d6fb0, C.red][i % 3], { detail: 2, amp: 0.02 });
      else mk.pillow(star(0, 0, 0.26, 0.11), 0.05, M([x, -drop - 0.26, z]), C.gold, { flat: 2.5, rings: 2, step: 0.03 });
    }
    mk.S.add(V(0, 0, 0), V(0, H - 6.6, 0), C.thread, 0.01);
    const g = new THREE.Group(); for (const m of kitMeshes(mk, { cast: false })) g.add(m); g.position.set(mx, 6.6, mz); group.add(g); mobiles.push(g);
  }
  movers.push((t) => mobiles.forEach((g, i) => { g.rotation.y = t * (0.12 + i * 0.03) + i; }));

  // ---------------- the shop counter and display table for the interactive toys (anchors returned to the journey)
  const tableTop = 0.86, table = [1.4, tableTop, 3.2];
  k.solid(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 40), M([table[0], tableTop - 0.05, table[2]]), 0x8a5a36, { batch: 'paint' });
  k.drape(M([table[0], tableTop + 0.002, table[2]], [-Math.PI / 2, 0, 0]), -1.15, 1.15, -1.15, 1.15, { thick: 0.04, edge: 0.05, rag: 0.03, res: 0.08, color: 0xd9c4a0 });
  k.solid(new THREE.CylinderGeometry(0.18, 0.26, tableTop - 0.1, 16), M([table[0], (tableTop - 0.1) / 2, table[2]]), 0x6a3f22, { batch: 'paint' });
  k.solid(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24), M([table[0], 0.03, table[2]]), 0x6a3f22, { batch: 'paint' });
  // a low three-tier display stand beside it (teddy, blocks, drum)
  const stand = [-1.6, 0, 2.6], tiers = [0.55, 1.05, 1.55];
  for (const [i, y] of tiers.entries()) k.solid(new THREE.BoxGeometry(1.5 - i * 0.2, 0.08, 0.6), M([stand[0], y - 0.04, stand[2] - i * 0.12]), 0x8a5a36, { batch: 'paint', smooth: false });
  for (const x of [-0.72, 0.72]) k.solid(new THREE.BoxGeometry(0.08, 1.6, 0.6), M([stand[0] + x, 0.8, stand[2]]), 0x6a3f22, { batch: 'paint', smooth: false });
  for (const y of tiers) { const L = 1.4, n = 7, val = [[0, 0], [L, 0]]; for (let i = n; i >= 0; i--) val.push([(i / n) * L, -0.08 - 0.04 * Math.abs(Math.sin(i * Math.PI / 2))]); k.cut(val, null, M([stand[0] - 0.7, y - 0.02, stand[2] + 0.31]), C.red, { t: 0.02, amp: 0.003 }); }
  // the counter, with a brass bell and a felt cash box, by the entrance
  k.solid(new THREE.BoxGeometry(3.2, 1.05, 0.9), M([6.6, 0.52, 5.2]), 0x7a4b2a, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(3.35, 0.07, 1.0), M([6.6, 1.07, 5.2]), 0x5a3a20, { batch: 'paint', smooth: false });
  k.panel(rect(-1.5, 0.1, 1.5, 0.95), null, M([6.6, 0, 5.66]), 0x2f6b55, { t: 0.04, stuff: 0.02, amp: 0.004 });
  k.S.running(M([6.6, 0, 5.71]), rect(-1.4, 0.18, 1.4, 0.87), 0, C.gold, { closed: true, len: 0.07, gap: 0.05, r: 0.009 });

  // ---------------- sparkles drifting in the air (the shop's magic)
  const NS = 260, sp = new Float32Array(NS * 3), seed = new Float32Array(NS);
  for (let i = 0; i < NS; i++) { sp[i * 3] = (r() - 0.5) * (W - 2); sp[i * 3 + 1] = 0.6 + r() * (H - 1.5); sp[i * 3 + 2] = (r() - 0.5) * (D - 2); seed[i] = r() * 100; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const sparkU = { uT: { value: 0 } };
  const smat = new THREE.ShaderMaterial({
    uniforms: sparkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float seed; uniform float uT; varying float vA;
      void main(){ vec3 p = position; p.y += mod(uT * 0.12 + seed, 8.0) - 4.0; p.x += 0.3 * sin(uT * 0.3 + seed); p.z += 0.3 * cos(uT * 0.27 + seed * 1.3);
        vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * 2.0 + seed * 7.0), 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(90.0 / -mv.z, 1.5, 9.0); }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * a * 1.4, a); }`,
  });
  const sparks = new THREE.Points(sg, smat); sparks.frustumCulled = false; group.add(sparks);
  movers.push((t) => { sparkU.uT.value = t; });

  // ---------------- assemble
  const front = kitMeshes(k, { extra: { lights: sk.lights, lamp: sk.lamp } }), back = kitMeshes(kb, { cast: false });
  for (const m of [...front, ...back]) group.add(m);
  let triangles = 0; group.traverse((o) => { if (o.isMesh && o.geometry.index) triangles += (o.geometry.index.count / 3) * (o.isInstancedMesh ? o.count : 1); });
  // the room's own lights (the journey switches them on inside): warm lamps, the tree's glow, cool window light
  const lights = [
    { pos: [0, H - 1.5, 2.5], color: 0xffbf80, intensity: 20, distance: 20 },
    { pos: [treeX + 2.5, 2.2, treeZ + 3.6], color: 0xffd0a0, intensity: 7, distance: 9 },
    { pos: [-6.5, 4.5, 2.5], color: 0xffc890, intensity: 9, distance: 12 },
    { pos: [6.5, 4.5, 2.5], color: 0xffc890, intensity: 9, distance: 12 },
    { pos: [0, 5.5, -hd + 1.0], color: 0x8fa0ff, intensity: 6, distance: 9 },
    { pos: [table[0] - 1.4, 2.6, table[2] + 1.4], color: 0xffd8a8, intensity: 2.5, distance: 5 },
  ];
  const mats = materials();
  return {
    group, lights, triangles: Math.round(triangles), buildMs: performance.now() - t0,
    anchors: { tableTop, table, stand, tiers, counter: [6.6, 1.1, 5.2], tree: [treeX, 0, treeZ] },
    update(t) { timeU.value = t; for (const f of movers) f(t); void mats; },
  };
}
