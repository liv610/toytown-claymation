// Toy Town · inside the Community Hall: the sorting room (Milestone 2B). One more visitor-paced beat, played live and
// continuing the same story clock as the donation and the collection (scene_donation.js builds this module and hands it
// its puppets, props and posing helpers: one scene, one timeline, one controller).
//
//   The camera drifts from the street to the hall's lit left window and passes through it, warmly, into the room.
//   The Marine carries the carton in and sets it on the long sorting table; a volunteer welcomes it, draws it closer,
//   and lifts out the red truck, into the lamplight. She looks it over, carries it to the cart of toys made ready for
//   the community and lays it in the crate. The Marine wheels the cart to the back door, which another volunteer opens
//   onto the snowy night: the next part of the journey.
//   Around them the room keeps working (wall clock): a volunteer sorts books, one letters box labels, one fills a shelf;
//   garlands sway, lamps breathe.
//
// The room is built inside the street model's own hall, to its measurements (scripts/tt/community.py: the hall is 8 wide,
// 6.5 deep, its door 1.4 × 2.4 at the middle of the front, four front windows at x ±2.6): its windows sit exactly behind
// the windows seen from the street, and the street sees into this room through the open door. Everything is a pure
// function of story time t (wall clock w for the room's ambient life), like the rest of the scene.
//
// Story accuracy: this is an illustration of community volunteers preparing donated toys. Labels name kinds of toys,
// never ages, rules or procedures; each local campaign organises its work in its own way (the beat's draft copy says so).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// the room, in Toy Town units (inside faces of the hall's walls; the floor is the top of the hall's stone footing)
export const HALL = { x0: -3.82, x1: 3.82, z0: -6.28, z1: -0.16, y0: 0.272, y1: 4.42 };
const WINS = [[-2.6, 1.6, 1.1, 1.6], [2.6, 1.6, 1.1, 1.6], [-2.6, 3.65, 0.8, 0.8], [2.6, 3.65, 0.8, 0.8]];   // x, centre y, w, h
const DOORW = { x0: -0.68, x1: 0.68, y1: 2.42 };
const BACK = { x0: -0.55, x1: 0.55, y1: 0.272 + 2.15 };       // the back door, to the yard
const TABLE = { x: 0, z: -2.62, w: 2.7, d: 0.9, h: 0.74 };
const TOP = HALL.y0 + TABLE.h + 0.03;                          // the sorting table's top surface
const CART0 = { x: 2.2, z: -3.66 }, CART_H = 0.5;              // the cart of prepared toys, its deck height

export function createSorting(K) {
  const { V, clamp, smooth, ramp, lerp, angLerp, yawOf, curve, travel, root, group, S, makeChar, gp, gv, roomMat, slab, contact, setContact,
    pose, walker, walkW, bend, lookAt, reach, turnBone, axes, elbowPole, W, L, marine, carton, truck, T, BEATS, groundMeshes, punch } = K;
  const s0 = BEATS.collection[1];                               // the sorting room picks up where the collection ends
  const room = new THREE.Group(); room.name = 'SortingRoom'; root.add(room);
  const add = (o, p) => { (p || room).add(o); return o; };
  const mesh = (g, m, p) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return add(o, p); };
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  // ---------------------------------------------------------------- materials: plaster, painted wainscot, waxed planks, felt
  const paper = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#ecd0a6'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(196,140,92,0.22)'; x.fillRect(i * 64 + 26, 0, 12, h); x.fillStyle = 'rgba(255,240,215,0.35)'; x.fillRect(i * 64 + 4, 0, 4, h); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const cx = i * 64 + 52 + (j % 2) * 0, cy = j * 64 + 18 + (i % 2) * 32;
      x.fillStyle = 'rgba(63,111,87,0.55)'; for (const a of [-0.6, 0.6]) { x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.ellipse(0, -5, 2.6, 6, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
      x.fillStyle = 'rgba(179,58,44,0.7)'; x.beginPath(); x.arc(cx, cy + 1, 2.2, 0, Math.PI * 2); x.fill(); } });
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  const plaster = roomMat(0xffffff, 'clay', { map: paper }), wains = roomMat(0x6f4a33, 'wood'), trim = roomMat(0xeee2c8, 'wood'), oak = roomMat(0x9a6a40, 'wood');
  const oakDark = roomMat(0x6b4429, 'wood'), card = roomMat(0xc49a63), cardDark = roomMat(0xa77d4c);
  const felt = (c) => roomMat(c, 'fabric');
  const floorTex = canvasTex(512, 512, (x, w, h) => {
    const n = 8; for (let i = 0; i < n; i++) { let y = 0; const off = rnd() * 200;
      while (y < h) { const len = 120 + rnd() * 220, l = 0.86 + 0.24 * rnd(); x.fillStyle = `rgb(${Math.round(150 * l)},${Math.round(98 * l)},${Math.round(58 * l)})`;
        x.fillRect(i * w / n, y - off % 60, w / n, len); for (let k = 0; k < 9; k++) { x.strokeStyle = `rgba(70,40,20,${0.05 + 0.06 * rnd()})`; x.lineWidth = 1 + rnd() * 1.5;
          const gx = i * w / n + 4 + rnd() * (w / n - 8); x.beginPath(); x.moveTo(gx, y); x.bezierCurveTo(gx + 3, y + len * 0.3, gx - 3, y + len * 0.7, gx + 1, y + len); x.stroke(); }
        x.fillStyle = 'rgba(40,22,10,0.55)'; x.fillRect(i * w / n, y - off % 60 + len - 2, w / n, 2); y += len; }
      x.fillStyle = 'rgba(40,22,10,0.6)'; x.fillRect(i * w / n, 0, 2, h); } });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2.2, 1.8);
  const floorMat = roomMat(0xffffff, 'wood', { map: floorTex });

  // ---------------------------------------------------------------- the shell: floor, ceiling and beams, four walls
  const W2 = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0, H = HALL.y1 - HALL.y0, cx = (HALL.x0 + HALL.x1) / 2, cz = (HALL.z0 + HALL.z1) / 2;
  const quad = (w, h, m, pos, ry = 0, rx = 0) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); q.position.set(...pos); q.rotation.set(rx, ry, 0); q.receiveShadow = true; return add(q); };
  const floor = quad(W2, D, floorMat, [cx, HALL.y0, cz], 0, -Math.PI / 2); floor.name = 'SortingFloor'; groundMeshes.push(floor);
  quad(W2, D, roomMat(0xd9b48a), [cx, HALL.y1, cz], 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) { const b = slab(W2, 0.16, 0.14, oakDark); b.position.set(cx, HALL.y1 - 0.08, HALL.z1 - 0.7 - i * 1.32); add(b); }
  // a wall with openings (front: the door and four windows; back: the back door), as seen from inside
  function wallWithHoles(len, holes, m) {           // in the wall's own x (along it) and y; holes [x0, x1, y0, y1]
    // (an opening down to the floor, a door, is a notch in the outline: a hole touching the edge would not be cut)
    const sh = new THREE.Shape(); sh.moveTo(-len / 2, HALL.y0);
    for (const [a, b, c, d] of holes.filter((h) => h[2] <= HALL.y0).sort((p, q) => p[0] - q[0])) { sh.lineTo(a, HALL.y0); sh.lineTo(a, d); sh.lineTo(b, d); sh.lineTo(b, HALL.y0); }
    sh.lineTo(len / 2, HALL.y0); sh.lineTo(len / 2, HALL.y1); sh.lineTo(-len / 2, HALL.y1); sh.closePath();
    for (const [a, b, c, d] of holes.filter((h) => h[2] > HALL.y0)) { const p = new THREE.Path(); p.moveTo(a, c); p.lineTo(a, d); p.lineTo(b, d); p.lineTo(b, c); p.closePath(); sh.holes.push(p); }
    const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    const o = new THREE.Mesh(g, m); o.receiveShadow = true; return o;
  }
  // front wall: seen from inside it faces -z, so its own x runs the other way (mirror the openings)
  const frontHoles = [[-DOORW.x1, -DOORW.x0, HALL.y0 - 0.01, DOORW.y1], ...WINS.map(([x, y, w, h]) => [-x - w / 2 - 0.02, -x + w / 2 + 0.02, y - h / 2 - 0.02, y + h / 2 + 0.02])];
  const front = add(wallWithHoles(W2, frontHoles, plaster)); front.position.set(cx, 0, HALL.z1); front.rotation.y = Math.PI;
  const back = add(wallWithHoles(W2, [[BACK.x0, BACK.x1, HALL.y0 - 0.01, BACK.y1]], plaster)); back.position.set(cx, 0, HALL.z0);
  const sidePaper = paper.clone(); sidePaper.needsUpdate = true; sidePaper.repeat.set(D / 2, H / 2); const sidePlaster = roomMat(0xffffff, 'clay', { map: sidePaper });
  quad(D, H, sidePlaster, [HALL.x0, HALL.y0 + H / 2, cz], Math.PI / 2);
  quad(D, H, sidePlaster, [HALL.x1, HALL.y0 + H / 2, cz], -Math.PI / 2);
  // painted wainscot, a chair rail and skirting all round (not across the openings)
  { const WH = 0.9;
    const run = (x0, x1, z, ry) => { const w = x1 - x0; if (w < 0.05) return; const q = quad(w, WH, wains, [0, 0, 0], ry); const s = ry === 0 ? 1 : -1;
      q.position.set(ry === 0 ? (x0 + x1) / 2 : -(x0 + x1) / 2, HALL.y0 + WH / 2, z + 0.012 * s);
      const rail = slab(w, 0.05, 0.04, trim); rail.position.set(q.position.x, HALL.y0 + WH + 0.02, z + 0.02 * s); add(rail); };
    run(HALL.x0, BACK.x0, HALL.z0, 0); run(BACK.x1, HALL.x1, HALL.z0, 0);
    // the front wall from inside (mirrored x): between the openings, below the windows' sills
    for (const wx of [-2.6, 2.6]) { const q = quad(1.2, 0.5, wains, [wx, HALL.y0 + 0.25, HALL.z1 - 0.012], Math.PI); }
    run(-HALL.x1, -2.6 - 0.6, HALL.z1, Math.PI); run(-2.6 + 0.6, DOORW.x0, HALL.z1, Math.PI); run(DOORW.x1, 2.6 - 0.6, HALL.z1, Math.PI); run(2.6 + 0.6, -HALL.x0, HALL.z1, Math.PI);
    for (const sx of [-1, 1]) { const q = quad(D, WH, wains, [HALL.x0 * -sx * -1, HALL.y0 + WH / 2, cz], sx * Math.PI / 2); q.position.x = sx < 0 ? HALL.x1 - 0.012 : HALL.x0 + 0.012; q.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2;
      const rail = slab(0.04, 0.05, D, trim); rail.position.set(sx < 0 ? HALL.x1 - 0.02 : HALL.x0 + 0.02, HALL.y0 + WH + 0.02, cz); add(rail); } }
  // reveals: the wall's thickness around each opening (between the room and the street model's face)
  const reveal = (x0, x1, y0, y1, z0, z1) => {
    const d = z1 - z0, zc = (z0 + z1) / 2;
    const top = slab(x1 - x0, 0.02, d, plaster); top.position.set((x0 + x1) / 2, y1, zc); add(top);
    for (const x of [x0, x1]) { const s = slab(0.02, y1 - y0, d, plaster); s.position.set(x, (y0 + y1) / 2, zc); add(s); }
  };
  reveal(DOORW.x0, DOORW.x1, HALL.y0, DOORW.y1, HALL.z1, -0.02);
  reveal(BACK.x0, BACK.x1, HALL.y0, BACK.y1, -6.5, HALL.z0);
  punch('Hall_wall', -6.62, [BACK.x0, BACK.x1, BACK.y1], -6.38);   // (the street model's wall, cut through for the back door, like the front)

  // ---------------------------------------------------------------- windows from inside: the snowy evening outside
  // The street model's panes are lit pictures, seen from the street. From inside, each opening frames a painted view of
  // the snowy street at dusk (the houses across the way, lamps, a drift on the sill) with snow drifting down past it.
  const outside = canvasTex(256, 320, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1c2346'); g.addColorStop(0.55, '#3a4677'); g.addColorStop(1, '#8a8fb4'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const hs = [[-10, 150, 90, '#7d4a52'], [70, 120, 80, '#4f6b7a'], [150, 140, 120, '#a1673d']];
    for (const [hx, hy, hw, col] of hs) { x.fillStyle = col; x.fillRect(hx, hy, hw, h); x.beginPath(); x.moveTo(hx - 8, hy); x.lineTo(hx + hw / 2, hy - 46); x.lineTo(hx + hw + 8, hy); x.fill();
      x.fillStyle = '#eef0f6'; x.beginPath(); x.moveTo(hx - 10, hy + 2); x.lineTo(hx + hw / 2, hy - 48); x.lineTo(hx + hw + 10, hy + 2); x.lineTo(hx + hw + 10, hy - 6); x.lineTo(hx + hw / 2, hy - 56); x.lineTo(hx - 10, hy - 6); x.fill();
      for (let k = 0; k < 2; k++) { x.fillStyle = '#ffcf7a'; x.fillRect(hx + 14 + k * (hw / 2), hy + 26, 18, 22); x.fillStyle = 'rgba(255,190,100,0.25)'; x.fillRect(hx + 8 + k * (hw / 2), hy + 20, 30, 34); } }
    const lg = x.createRadialGradient(205, 170, 2, 205, 170, 70); lg.addColorStop(0, 'rgba(255,214,150,0.9)'); lg.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = lg; x.fillRect(120, 90, 136, 160);
    x.fillStyle = '#2a2a3a'; x.fillRect(203, 172, 4, 150);
    x.fillStyle = '#f2f3f8'; x.beginPath(); x.moveTo(0, h - 46); x.bezierCurveTo(70, h - 70, 160, h - 40, w, h - 64); x.lineTo(w, h); x.lineTo(0, h); x.fill();
  });
  const flakesTex = canvasTex(128, 256, (x, w, h) => { for (let i = 0; i < 70; i++) { const r = 0.8 + rnd() * 2.2; x.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * rnd()})`; x.beginPath(); x.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); x.fill(); } });
  flakesTex.wrapS = flakesTex.wrapT = THREE.RepeatWrapping;
  const viewMat = new THREE.MeshBasicMaterial({ map: outside, color: new THREE.Color(0.95, 0.95, 1.0) });
  const flakeMats = [];
  for (const [x, y, w, h] of WINS) {
    const v = mesh(new THREE.PlaneGeometry(w + 0.04, h + 0.04), viewMat); v.position.set(x, y, -0.035); v.rotation.y = Math.PI; v.castShadow = false;
    const ft = flakesTex.clone(); ft.needsUpdate = true; ft.repeat.set(w * 1.6, h * 0.8); const fm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, opacity: 0.85 }); flakeMats.push(fm);
    const f = mesh(new THREE.PlaneGeometry(w + 0.04, h + 0.04), fm); f.position.set(x, y, -0.045); f.rotation.y = Math.PI; f.castShadow = false;
    reveal(x - w / 2 - 0.02, x + w / 2 + 0.02, y - h / 2 - 0.02, y + h / 2 + 0.02, HALL.z1, -0.03);
    // inside frame, muntins and a deep sill
    for (const [sx, sy, px, py] of [[w + 0.16, 0.08, x, y + h / 2 + 0.06], [0.08, h + 0.12, x - w / 2 - 0.06, y], [0.08, h + 0.12, x + w / 2 + 0.06, y]]) { const s = slab(sx, sy, 0.05, trim); s.position.set(px, py, HALL.z1 - 0.025); add(s); }
    { const m1 = slab(0.035, h, 0.03, trim); m1.position.set(x, y, -0.06); add(m1); const m2 = slab(w, 0.035, 0.03, trim); m2.position.set(x, y + h * 0.08, -0.06); add(m2); }
    const sill = slab(w + 0.3, 0.05, 0.24, trim); sill.position.set(x, y - h / 2 - 0.045, HALL.z1 - 0.06); add(sill);
  }
  // on the low sills: a felt candle and a little potted fir (details for a closer look)
  for (const sx of [-1, 1]) {
    const bx = sx * 2.6, sy = 1.6 - 0.8 - 0.02;
    const pot = mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 12), felt(0xb0442f)); pot.position.set(bx + 0.32 * sx, sy + 0.045, HALL.z1 - 0.07);
    const fir = mesh(new THREE.ConeGeometry(0.075, 0.22, 10), felt(0x2f6b4a)); fir.position.set(bx + 0.32 * sx, sy + 0.2, HALL.z1 - 0.07);
    const cnd = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), felt(0xf2e6cc)); cnd.position.set(bx - 0.3 * sx, sy + 0.06, HALL.z1 - 0.07);
  }

  // ---------------------------------------------------------------- the back door, to the snowy yard
  const backPivot = add(new THREE.Group()); backPivot.position.set(BACK.x0, 0, HALL.z0 + 0.02);
  { const bw = BACK.x1 - BACK.x0, bh = BACK.y1 - HALL.y0, leaf = slab(bw - 0.03, bh - 0.02, 0.06, roomMat(0x2f5d46, 'wood'));
    leaf.position.set(bw / 2, HALL.y0 + bh / 2, 0.02); backPivot.add(leaf);
    for (const [px, py, sw, sh] of [[bw / 2, HALL.y0 + bh * 0.72, bw * 0.72, bh * 0.34], [bw / 2, HALL.y0 + bh * 0.3, bw * 0.72, bh * 0.36]]) { const p = slab(sw, sh, 0.02, roomMat(0x285140, 'wood')); p.position.set(px, py, 0.06); backPivot.add(p); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), roomMat(0xd4a64a)); knob.position.set(bw - 0.12, HALL.y0 + 1.0, 0.09); backPivot.add(knob);
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 18), felt(0x2f6b4a)); wreath.position.set(bw / 2, HALL.y0 + 1.6, 0.08); backPivot.add(wreath);
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), felt(0xc8302a)); bow.scale.set(1.6, 0.8, 0.6); bow.position.set(bw / 2, HALL.y0 + 1.45, 0.12); backPivot.add(bow);
    backPivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const frame = [[bw + 0.16, 0.08, 0, BACK.y1 + 0.04], [0.08, bh, -bw / 2 - 0.04, HALL.y0 + bh / 2], [0.08, bh, bw / 2 + 0.04, HALL.y0 + bh / 2]];
    for (const [sx, sy, px, py] of frame) { const s = slab(sx, sy, 0.06, trim); s.position.set(px, py, HALL.z0 + 0.03); add(s); }
    // the same door seen from behind the hall (outside), so the building agrees with itself from every side
    // (one-sided, facing out: from inside, the open doorway looks through them to the yard)
    const outFrame = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.2, bh + 0.12), trim); outFrame.position.set(0, HALL.y0 + bh / 2 + 0.03, -6.52); outFrame.rotation.y = Math.PI; add(outFrame);
    const outDoor = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), roomMat(0x2f5d46, 'wood')); outDoor.position.set(0, HALL.y0 + bh / 2, -6.535); outDoor.rotation.y = Math.PI; add(outDoor); }
  // the yard beyond the door: a painted snowy night with a lantern, falling snow, and a cool light that spills in
  const yardTex = canvasTex(256, 384, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#141a38'); g.addColorStop(0.6, '#2c3766'); g.addColorStop(1, '#6f7aa8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * rnd()})`; x.fillRect(rnd() * w, rnd() * h * 0.5, 1.5, 1.5); }
    for (const fx of [30, 200]) { x.fillStyle = '#1d3b33'; x.beginPath(); x.moveTo(fx, 160); x.lineTo(fx - 38, 300); x.lineTo(fx + 38, 300); x.fill(); x.fillStyle = '#e9edf5'; x.beginPath(); x.moveTo(fx, 162); x.lineTo(fx - 16, 210); x.lineTo(fx + 16, 210); x.fill(); }
    const lg = x.createRadialGradient(150, 210, 2, 150, 210, 60); lg.addColorStop(0, 'rgba(255,214,150,0.95)'); lg.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = lg; x.fillRect(80, 140, 140, 140);
    x.fillStyle = '#f1f3f9'; x.beginPath(); x.moveTo(0, h - 90); x.bezierCurveTo(80, h - 120, 170, h - 80, w, h - 110); x.lineTo(w, h); x.lineTo(0, h); x.fill();
  });
  const yard = mesh(new THREE.PlaneGeometry(3.4, 3.1), new THREE.MeshBasicMaterial({ map: yardTex, color: new THREE.Color(0.9, 0.92, 1) })); yard.position.set(0, HALL.y0 + 1.3, -7.75); yard.castShadow = false;   // (beyond the door's outward swing)
  const yardSnowTex = flakesTex.clone(); yardSnowTex.needsUpdate = true; yardSnowTex.repeat.set(2.5, 1.6);
  const yardSnow = new THREE.MeshBasicMaterial({ map: yardSnowTex, transparent: true, depthWrite: false, opacity: 0 }); flakeMats.push(yardSnow);
  { const ys = mesh(new THREE.PlaneGeometry(2.6, 2.8), yardSnow); ys.position.set(0, HALL.y0 + 1.25, -7.6); ys.castShadow = false; }
  const coldLight = new THREE.PointLight(0x9fb4ff, 0, 4.5 * S, 2); coldLight.position.set(0, HALL.y0 + 1.6, -6.7); root.add(coldLight);

  // ---------------------------------------------------------------- felt toys, many of them (a few instanced templates)
  // Each template is a little felt toy (merged primitives with painted parts); instances vary in colour, size and turn.
  const geo = {
    sphere: (r, sx = 1, sy = 1, sz = 1, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)).scale(sx, sy, sz),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg),
  };
  const paint = (g, rgb, at = [0, 0, 0], rot = null) => { g = g.toNonIndexed(); if (rot) g.rotateX(rot[0] || 0).rotateY(rot[1] || 0).rotateZ(rot[2] || 0); g.translate(...at);
    const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(rgb, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; };
  const WHITE = [1, 1, 1], DARK = [0.12, 0.08, 0.07], CREAM = [1.0, 0.93, 0.8];
  const TEMPLATES = {
    teddy: mergeGeometries([paint(geo.sphere(0.07, 1, 1.15, 0.9), WHITE, [0, 0.075, 0]), paint(geo.sphere(0.055), WHITE, [0, 0.19, 0]),
      paint(geo.sphere(0.022), WHITE, [-0.045, 0.235, 0]), paint(geo.sphere(0.022), WHITE, [0.045, 0.235, 0]), paint(geo.sphere(0.024, 1, 0.8, 1), CREAM, [0, 0.18, 0.045]),
      paint(geo.sphere(0.007, 1, 1, 1, 6), DARK, [-0.02, 0.205, 0.048]), paint(geo.sphere(0.007, 1, 1, 1, 6), DARK, [0.02, 0.205, 0.048]), paint(geo.sphere(0.009, 1, 0.8, 1, 6), DARK, [0, 0.19, 0.068]),
      paint(geo.sphere(0.026, 1, 1.5, 1), WHITE, [-0.07, 0.09, 0.015]), paint(geo.sphere(0.026, 1, 1.5, 1), WHITE, [0.07, 0.09, 0.015]),
      paint(geo.sphere(0.03, 1, 0.8, 1.3), WHITE, [-0.035, 0.02, 0.03]), paint(geo.sphere(0.03, 1, 0.8, 1.3), WHITE, [0.035, 0.02, 0.03])]),
    bunny: mergeGeometries([paint(geo.sphere(0.065, 1, 1.1, 0.9), WHITE, [0, 0.07, 0]), paint(geo.sphere(0.05), WHITE, [0, 0.175, 0]),
      paint(geo.sphere(0.018, 1, 3.4, 0.7), WHITE, [-0.022, 0.27, 0]), paint(geo.sphere(0.018, 1, 3.4, 0.7), WHITE, [0.022, 0.27, 0]),
      paint(geo.sphere(0.006, 1, 1, 1, 6), DARK, [-0.018, 0.185, 0.044]), paint(geo.sphere(0.006, 1, 1, 1, 6), DARK, [0.018, 0.185, 0.044]), paint(geo.sphere(0.008, 1, 1, 1, 6), [0.9, 0.5, 0.55], [0, 0.17, 0.05])]),
    ball: mergeGeometries([paint(geo.sphere(0.065, 1, 1, 1, 16), WHITE, [0, 0.065, 0]), paint(new THREE.TorusGeometry(0.064, 0.009, 6, 20), CREAM, [0, 0.065, 0], [Math.PI / 2, 0, 0.3])]),
    book: mergeGeometries([paint(geo.box(0.13, 0.025, 0.17), WHITE, [0, 0.0125, 0]), paint(geo.box(0.12, 0.018, 0.005), CREAM, [0.003, 0.0125, 0.086])]),
    blocks: mergeGeometries([paint(geo.box(0.06, 0.06, 0.06), [0.85, 0.28, 0.24], [-0.035, 0.03, 0]), paint(geo.box(0.06, 0.06, 0.06), [0.25, 0.47, 0.75], [0.035, 0.03, 0.01], [0, 0.3, 0]),
      paint(geo.box(0.06, 0.06, 0.06), [0.93, 0.74, 0.3], [0, 0.09, 0], [0, 0.5, 0])]),
    doll: mergeGeometries([paint(geo.cyl(0.03, 0.06, 0.13, 12), WHITE, [0, 0.065, 0]), paint(geo.sphere(0.038), [0.86, 0.62, 0.48], [0, 0.165, 0]),
      paint(geo.sphere(0.041, 1, 0.75, 1), [0.3, 0.17, 0.1], [0, 0.185, -0.006]), paint(geo.sphere(0.006, 1, 1, 1, 6), DARK, [-0.013, 0.168, 0.034]), paint(geo.sphere(0.006, 1, 1, 1, 6), DARK, [0.013, 0.168, 0.034])]),
    train: mergeGeometries([paint(geo.box(0.17, 0.06, 0.08), WHITE, [0, 0.05, 0]), paint(geo.box(0.07, 0.07, 0.085), WHITE, [-0.05, 0.11, 0]), paint(geo.cyl(0.012, 0.016, 0.05, 8), DARK, [0.05, 0.1, 0]),
      ...[-0.055, 0.0, 0.055].flatMap((x) => [paint(geo.cyl(0.022, 0.022, 0.012, 12), DARK, [x, 0.022, 0.045], [Math.PI / 2, 0, 0]), paint(geo.cyl(0.022, 0.022, 0.012, 12), DARK, [x, 0.022, -0.045], [Math.PI / 2, 0, 0])])]),
    drum: mergeGeometries([paint(geo.cyl(0.06, 0.06, 0.08, 16), WHITE, [0, 0.04, 0]), paint(geo.cyl(0.063, 0.063, 0.012, 16), CREAM, [0, 0.082, 0]), paint(geo.cyl(0.063, 0.063, 0.012, 16), CREAM, [0, 0.0, 0])]),
    puzzle: mergeGeometries([paint(geo.box(0.16, 0.035, 0.12), WHITE, [0, 0.018, 0]), paint(geo.box(0.12, 0.004, 0.08), CREAM, [0, 0.037, 0])]),
  };
  const toyMat = roomMat(0xffffff, 'fabric', { vertexColors: true });
  const PAL = { teddy: [0xb07a4a, 0x8a5a3a, 0xd9b48a, 0xc8302a, 0x7d8fb0], bunny: [0xf0e4d6, 0xe6b7c0, 0xc9c2b8], ball: [0xc8302a, 0x2d5fae, 0xe8c55a, 0x3f8f63],
    book: [0x2d5fae, 0xc8302a, 0x3f6f57, 0xd9a93f, 0x7d3552, 0xe9dcc0], blocks: [0xffffff], doll: [0xc8302a, 0x5a7bc0, 0x6f9f6a, 0xd17aa0], train: [0x2d5fae, 0x3f6f57, 0xd9a93f],
    drum: [0xc8302a, 0x2d5fae], puzzle: [0x7d3552, 0x3f8f63, 0xd9a93f] };
  const toyPlacements = Object.fromEntries(Object.keys(TEMPLATES).map((k) => [k, []]));
  const placeToy = (kind, x, y, z, yaw = 0, s = 1, color = null) => { toyPlacements[kind].push({ x, y, z, yaw, s, color: color ?? PAL[kind][Math.floor(rnd() * PAL[kind].length)] }); };
  const toyMeshes = {};
  function buildToys() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (const [k, list] of Object.entries(toyPlacements)) { if (!list.length) continue;
      const im = new THREE.InstancedMesh(TEMPLATES[k], toyMat, list.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      list.forEach((p, i) => { q.setFromAxisAngle(V(0, 1, 0), p.yaw); m.compose(V(p.x, p.y, p.z), q, V(p.s, p.s, p.s)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(p.color)); });
      add(im); toyMeshes[k] = im; }
  }
  // a single toy as its own mesh (the ones that are carried, placed or arranged during the scene)
  const oneToy = (kind, color, s = 1) => { const g = TEMPLATES[kind].clone(); const n = g.attributes.color, col = new THREE.Color(color);
    for (let i = 0; i < n.count; i++) { const r = n.getX(i), gg = n.getY(i), b = n.getZ(i); if (r > 0.95 && gg > 0.95 && b > 0.95) n.setXYZ(i, col.r, col.g, col.b); else if (r > 0.95 && gg > 0.9) n.setXYZ(i, Math.min(1, col.r * 1.25 + 0.15), Math.min(1, col.g * 1.25 + 0.15), Math.min(1, col.b * 1.25 + 0.15)); }
    const o = mesh(g, toyMat); o.scale.setScalar(s); return o; };

  // ---------------------------------------------------------------- shelves along the back wall, full of toys
  function shelfUnit(x0, x1, z, depth, levels, ys, face = 1, gap = null) {    // face: +1 = facing +z (on the back wall)
    const w = x1 - x0, xc = (x0 + x1) / 2, zc = z + face * depth / 2, top = ys[ys.length - 1] + 0.05;
    for (const x of [x0 + 0.03, x1 - 0.03]) { const p = slab(0.05, top - HALL.y0, depth, oak); p.position.set(x, (top + HALL.y0) / 2, zc); add(p); }
    const backB = slab(w, top - HALL.y0, 0.02, oakDark); backB.position.set(xc, (top + HALL.y0) / 2, z + face * 0.012); add(backB);
    for (const y of ys) { const b = slab(w - 0.04, 0.035, depth, oak); b.position.set(xc, y, zc); add(b);
      const lip = slab(w - 0.04, 0.03, 0.015, trim); lip.position.set(xc, y + 0.02, z + face * (depth - 0.006)); add(lip); }
    // fill each level: a row of toys, books stood up at the ends
    ys.slice(0, levels).forEach((y, li) => { let x = x0 + 0.1;
      while (x < x1 - 0.12) {
        if (gap && (li === 2 || li === 3) && x > gap[0] && x < gap[1]) { x = gap[1]; continue; }   // (the gaps the shelf filler fills)
        const r = rnd(), kinds = ['teddy', 'teddy', 'bunny', 'ball', 'doll', 'train', 'drum', 'blocks', 'puzzle'];
        if (r < 0.18) { const n = 3 + Math.floor(rnd() * 4); for (let i = 0; i < n && x < x1 - 0.06; i++) { placeToy('book', x, y + 0.02 + 0.085 * 0, zc, 0, 1); toyPlacements.book.at(-1).stand = true; x += 0.032; } x += 0.05; continue; }
        const k = kinds[Math.floor(rnd() * kinds.length)], s = 0.85 + 0.3 * rnd(), wdt = { teddy: 0.16, bunny: 0.13, ball: 0.14, doll: 0.1, train: 0.19, drum: 0.13, blocks: 0.13, puzzle: 0.17 }[k] * s;
        placeToy(k, x + wdt / 2, y + 0.018, zc + face * (rnd() - 0.5) * 0.06, face > 0 ? (rnd() - 0.5) * 0.7 : Math.PI + (rnd() - 0.5) * 0.7, s);
        x += wdt + 0.02 + rnd() * 0.04;
      } });
  }
  shelfUnit(HALL.x0 + 0.15, BACK.x0 - 0.35, HALL.z0, 0.34, 4, [HALL.y0 + 0.42, HALL.y0 + 0.92, HALL.y0 + 1.42, HALL.y0 + 1.92, HALL.y0 + 2.42]);
  shelfUnit(BACK.x1 + 0.35, HALL.x1 - 0.15, HALL.z0, 0.34, 4, [HALL.y0 + 0.42, HALL.y0 + 0.92, HALL.y0 + 1.42, HALL.y0 + 1.92, HALL.y0 + 2.42], 1, [1.2, 2.05]);
  // books stand on end: turn their stored placement into an upright book
  for (const p of toyPlacements.book) if (p.stand) { p.upright = true; }

  // ---------------------------------------------------------------- the sorting table, the cart, crates and boxes
  const table = (x, z, w, d, h, m = oak) => { const g = new THREE.Group(); g.position.set(x, HALL.y0, z); add(g);
    const t = slab(w, 0.06, d, m); t.position.y = h; g.add(t);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = slab(0.06, h - 0.03, 0.06, oakDark); l.position.set(sx * (w / 2 - 0.08), (h - 0.03) / 2, sz * (d / 2 - 0.08)); g.add(l); }
    const apron = slab(w - 0.16, 0.08, d - 0.16, oakDark); apron.position.y = h - 0.07; g.add(apron);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
  table(TABLE.x, TABLE.z, TABLE.w, TABLE.d, TABLE.h);
  // a felt runner down the table, a clipboard, a jar of pencils, a mug
  { const run = slab(TABLE.w - 0.3, 0.006, 0.3, felt(0xb33a2c)); run.position.set(TABLE.x, TOP + 0.003, TABLE.z - 0.05); add(run);
    const clip = slab(0.2, 0.012, 0.26, oakDark); clip.position.set(1.0, TOP + 0.006, -2.4); clip.rotation.y = 0.2; add(clip);
    const paper = slab(0.17, 0.004, 0.21, roomMat(0xf6f0e2)); paper.position.set(1.0, TOP + 0.014, -2.4); paper.rotation.y = 0.2; add(paper);
    const jar = mesh(geo.cyl(0.035, 0.03, 0.09, 12), roomMat(0x6d8fa8)); jar.position.set(1.05, TOP + 0.045, -3.0);
    for (let i = 0; i < 3; i++) { const p = mesh(geo.cyl(0.005, 0.005, 0.13, 6), felt([0xc8302a, 0x2d5fae, 0x3f8f63][i])); p.position.set(1.05 + (i - 1) * 0.012, TOP + 0.08, -3.0); p.rotation.z = (i - 1) * 0.2; }
    const mug = mesh(geo.cyl(0.035, 0.032, 0.07, 12), roomMat(0xe9dcc0)); mug.position.set(-0.55, TOP + 0.035, -2.95);
    const h1 = mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 10), roomMat(0xe9dcc0)); h1.position.set(-0.515, TOP + 0.035, -2.95); h1.rotation.y = Math.PI / 2; }
  // open cartons and toys waiting on the table (sorted by kind into little groups)
  const openBox = (x, z, w, d, h, y = HALL.y0, yaw = 0, m = card) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; add(g);
    const b = slab(w, 0.015, d, m); b.position.y = 0.008; g.add(b);
    for (const sz of [-1, 1]) { const s = slab(w, h, 0.015, m); s.position.set(0, h / 2, sz * d / 2); g.add(s); const f = slab(w, 0.012, h * 0.5, m); f.position.set(0, h + h * 0.18, sz * (d / 2 + h * 0.2)); f.rotation.x = sz * 0.9; g.add(f); }
    for (const sx of [-1, 1]) { const s = slab(0.015, h, d, m); s.position.set(sx * w / 2, h / 2, 0); g.add(s); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
  openBox(-1.08, -2.45, 0.42, 0.32, 0.22, TOP, 0.15);                            // books waiting (the book sorter's)
  for (let i = 0; i < 4; i++) placeToy('book', -1.08 + (i - 1.5) * 0.08, TOP + 0.02 + i * 0.026, -2.45, 0.15 + (rnd() - 0.5) * 0.3, 1);
  for (const [k, x, z, yaw] of [['teddy', -0.62, -2.92, 0.4], ['bunny', -0.42, -2.98, -0.3], ['ball', 1.18, -2.95, 0], ['puzzle', 0.75, -2.96, 0.2], ['blocks', -0.75, -2.62, -0.4], ['doll', 1.2, -2.6, 0.2]])
    placeToy(k, x, TOP, z, yaw, 1);
  // the cart for prepared toys: a wooden deck on castors, a handle, and a slatted crate with a READY tag
  const cart = add(new THREE.Group()); cart.position.set(CART0.x, HALL.y0, CART0.z);
  { const deck = slab(0.62, 0.05, 0.86, oak); deck.position.y = CART_H - 0.03; cart.add(deck);
    const shelf2 = slab(0.58, 0.03, 0.8, oak); shelf2.position.y = 0.16; cart.add(shelf2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = slab(0.04, CART_H - 0.1, 0.04, oakDark); l.position.set(sx * 0.27, (CART_H - 0.1) / 2 + 0.06, sz * 0.39); cart.add(l);
      const w = new THREE.Mesh(geo.cyl(0.05, 0.05, 0.035, 14), roomMat(0x2a2a2a)); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.27, 0.05, sz * 0.39); cart.add(w); }
    for (const sx of [-1, 1]) { const u = slab(0.03, 0.42, 0.03, oakDark); u.position.set(sx * 0.27, CART_H + 0.18, 0.41); cart.add(u); }
    const bar = new THREE.Mesh(geo.cyl(0.02, 0.02, 0.6, 10), roomMat(0xb33a2c)); bar.rotation.z = Math.PI / 2; bar.position.set(0, CART_H + 0.38, 0.41); cart.add(bar);
    // the crate
    const CW = 0.54, CD = 0.62, CH = 0.24;
    for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) { const s = slab(CW, 0.055, 0.02, oak); s.position.set(0, CART_H + 0.035 + k * 0.08, sz * (CD / 2 - 0.01)); cart.add(s); }
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const s = slab(0.02, 0.055, CD, oak); s.position.set(sx * (CW / 2 - 0.01), CART_H + 0.035 + k * 0.08, 0); cart.add(s); }
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(256, 128, (x) => {
      x.fillStyle = '#f3ead6'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#b33a2c'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
      x.fillStyle = '#3e2418'; x.font = '700 58px "Fraunces", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('READY', 112, 66);
      x.fillStyle = '#b33a2c'; x.beginPath(); x.moveTo(218, 56); x.bezierCurveTo(218, 42, 200, 42, 200, 54); x.bezierCurveTo(200, 64, 218, 74, 218, 80); x.bezierCurveTo(218, 74, 236, 64, 236, 54); x.bezierCurveTo(236, 42, 218, 42, 218, 56); x.fill(); }) }));
    tag.position.set(0, CART_H + 0.12, CD / 2 + 0.006); tag.rotation.z = -0.04; cart.add(tag);
    cart.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  // toys already made ready in the crate (they ride with the cart)
  const crateToys = [['teddy', 0x8a5a3a, -0.14, 0.12, 0.3, 1.0], ['doll', 0x5a7bc0, 0.14, 0.16, -0.4, 1.0], ['book', 0x2d5fae, 0.13, -0.16, 0.2, 1.0], ['ball', 0x3f8f63, -0.13, -0.14, 0, 0.9], ['puzzle', 0xd9a93f, 0.0, -0.02, 0.1, 0.9], ['bunny', 0xf0e4d6, 0.02, 0.22, 0.0, 0.95]];
  for (const [k, c, x, z, yaw, s] of crateToys) { const o = oneToy(k, c, s); cart.attach(o); o.position.set(x, CART_H + 0.03 + (k === 'puzzle' ? 0.05 : 0), z); o.rotation.set(k === 'puzzle' ? 0.25 : 0, yaw, 0); }
  const TRUCK_IN_CRATE = V(-0.02, CART_H + 0.1, -0.02);       // where the red truck settles, on top of the others (cart's space)

  // labelled boxes: closed cartons with hand-written labels, stacked by the left wall and under the table
  const labelTex = (word, col = '#3e2418') => canvasTex(256, 128, (x) => { x.clearRect(0, 0, 256, 128); x.translate(128, 66); x.rotate(-0.04);
    x.fillStyle = col; x.font = '700 50px "Fraunces", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word, 0, 0);
    x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.moveTo(-86, 32); x.quadraticCurveTo(0, 40, 84, 28); x.stroke(); });
  const closedBox = (x, y, z, w, h, d, yaw, word) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; add(g);
    const b = slab(w, h, d, card); b.position.y = h / 2; g.add(b); const tp = slab(0.06, 0.004, d + 0.004, roomMat(0xcfb98a)); tp.position.y = h + 0.002; g.add(tp);
    if (word) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.4), new THREE.MeshStandardMaterial({ map: labelTex(word), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      l.position.set(0, h * 0.55, d / 2 + 0.003); g.add(l); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
  for (const [x, y, z, w, h, d, yaw, word] of [
    [-3.45, HALL.y0, -4.15, 0.55, 0.4, 0.45, Math.PI / 2, 'BOOKS'], [-3.45, HALL.y0 + 0.4, -4.12, 0.5, 0.36, 0.42, Math.PI / 2 + 0.08, 'PUZZLES'], [-3.42, HALL.y0, -4.75, 0.55, 0.44, 0.45, Math.PI / 2 - 0.05, 'PLUSH'],
    [-3.45, HALL.y0 + 0.44, -4.76, 0.52, 0.34, 0.44, Math.PI / 2, 'GAMES'], [-3.4, HALL.y0, -5.35, 0.5, 0.38, 0.42, Math.PI / 2 + 0.06, 'TOYS'],
    [-0.75, HALL.y0, -2.75, 0.48, 0.34, 0.4, 0.05, 'TOYS'], [0.55, HALL.y0, -2.6, 0.5, 0.36, 0.42, -0.08, 'BOOKS'],
    [3.4, HALL.y0, -1.6, 0.5, 0.36, 0.42, -Math.PI / 2, 'PLUSH'], [3.42, HALL.y0, -2.15, 0.48, 0.32, 0.4, -Math.PI / 2 + 0.07, 'GAMES']]) closedBox(x, y, z, w, h, d, yaw, word);

  // the label station by the left wall: a small table, a box being lettered, a marker
  table(-3.3, -2.75, 0.62, 1.25, 0.72, oak);
  const LBOX = { x: -3.28, z: -2.75, w: 0.46, h: 0.32, d: 0.4 }, LTOP = HALL.y0 + 0.75;
  const lbox = closedBox(LBOX.x, LTOP, LBOX.z, LBOX.w, LBOX.h, LBOX.d, Math.PI / 2, null);
  const WORDS = ['BOOKS', 'PLUSH', 'PUZZLES', 'GAMES', 'TOYS'];
  const lettering = WORDS.map((w) => new THREE.MeshStandardMaterial({ map: labelTex(w, '#2f1c12'), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const letterPlane = new THREE.Mesh(new THREE.PlaneGeometry(LBOX.w * 0.8, LBOX.w * 0.4), lettering[0]);
  letterPlane.position.set(0, LBOX.h * 0.55, LBOX.d / 2 + 0.004); lbox.add(letterPlane);
  // a blank card over the lettering that shrinks from the left as it is written (the word appears stroke by stroke)
  const blank = new THREE.Mesh(new THREE.PlaneGeometry(1, LBOX.w * 0.42), card); blank.position.set(0, LBOX.h * 0.55, LBOX.d / 2 + 0.006); lbox.add(blank);
  const marker = mesh(geo.cyl(0.011, 0.011, 0.11, 8), felt(0x1f1f2a));

  // the book sorter's pile, by the table's left end
  const PILE = V(-1.12, TOP, -2.86);
  const pile = Array.from({ length: 6 }, (_, i) => { const b = oneToy('book', PAL.book[i % PAL.book.length]); b.position.set(PILE.x + (rnd() - 0.5) * 0.015, PILE.y + i * 0.026, PILE.z); b.rotation.y = 0.1 + (rnd() - 0.5) * 0.25; return b; });
  const bookInHand = oneToy('book', 0x7d3552);

  // the shelf filler's basket of plush, and the gaps on the right-hand shelf she fills, one by one
  const BASKET = V(2.3, HALL.y0, -5.48);
  { const bk = mesh(geo.cyl(0.24, 0.2, 0.28, 18), roomMat(0xa8794a, 'wood')); bk.position.set(BASKET.x, BASKET.y + 0.14, BASKET.z);
    for (let i = 0; i < 5; i++) placeToy(['teddy', 'bunny', 'teddy', 'ball', 'bunny'][i], BASKET.x + Math.cos(i * 1.3) * 0.1, BASKET.y + 0.22, BASKET.z + Math.sin(i * 1.3) * 0.08, i, 0.9); }
  const SLOTS = [[1.32, 1.42], [1.55, 1.92], [1.6, 1.42], [1.85, 1.92], [1.9, 1.42]].map(([x, y]) => V(x, HALL.y0 + y + 0.018, HALL.z0 + 0.17));
  const slotToys = SLOTS.map((p, i) => { const o = oneToy(i % 2 ? 'bunny' : 'teddy', i % 2 ? 0xe6b7c0 : [0xb07a4a, 0xd9b48a, 0x7d8fb0][i % 3]); o.position.copy(p); return o; });
  const toyInHand = oneToy('teddy', 0xc8302a);

  // ---------------------------------------------------------------- coats by the door, a little tree, a banner of thanks
  { const rail = slab(0.9, 0.06, 0.05, oak); rail.position.set(-1.45, HALL.y0 + 1.75, HALL.z1 - 0.03); add(rail);
    for (let i = 0; i < 4; i++) { const peg = mesh(geo.cyl(0.015, 0.015, 0.09, 8), oakDark); peg.rotation.x = Math.PI / 2; peg.position.set(-1.8 + i * 0.23, HALL.y0 + 1.75, HALL.z1 - 0.08); }
    const scarf = (x, c) => { const s = slab(0.08, 0.62, 0.025, felt(c)); s.position.set(x, HALL.y0 + 1.45, HALL.z1 - 0.1); add(s);
      const s2 = slab(0.08, 0.5, 0.025, felt(c)); s2.position.set(x + 0.07, HALL.y0 + 1.5, HALL.z1 - 0.12); s2.rotation.z = 0.12; add(s2); };
    scarf(-1.82, 0xc8302a); scarf(-1.35, 0x3f6f57);
    const hat = mesh(geo.sphere(0.1, 1, 0.75, 1), felt(0xd9a93f)); hat.position.set(-1.12, HALL.y0 + 1.8, HALL.z1 - 0.12);
    const pom = mesh(geo.sphere(0.04), felt(0xf4efe6)); pom.position.set(-1.12, HALL.y0 + 1.89, HALL.z1 - 0.12);
    const mat = slab(0.9, 0.012, 0.55, felt(0x7d3a2e)); mat.position.set(0, HALL.y0 + 0.006, -0.55); add(mat); }
  { const tx = 3.15, tz = -0.75;                                           // a small felt tree in the front corner, with lights
    const pot = mesh(geo.cyl(0.16, 0.13, 0.22, 14), felt(0xb33a2c)); pot.position.set(tx, HALL.y0 + 0.11, tz);
    for (let k = 0; k < 4; k++) { const c = mesh(new THREE.ConeGeometry(0.42 - k * 0.09, 0.42, 12), felt(0x2f6b4a)); c.position.set(tx, HALL.y0 + 0.42 + k * 0.27, tz); }
    const star = mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffb030, emissiveIntensity: 1.2 })); star.position.set(tx, HALL.y0 + 1.42, tz); }
  { const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.46), new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide, map: canvasTex(512, 108, (x) => {
      x.fillStyle = '#efe3c8'; x.fillRect(0, 0, 512, 108); x.fillStyle = '#b33a2c'; for (let i = 0; i < 512; i += 18) x.fillRect(i, 0, 9, 7);
      x.fillStyle = '#2f5d46'; x.font = 'italic 600 52px "Fraunces", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Thank you, Toy Town', 236, 58);
      x.fillStyle = '#b33a2c'; x.beginPath(); x.moveTo(478, 50); x.bezierCurveTo(478, 36, 460, 36, 460, 48); x.bezierCurveTo(460, 58, 478, 68, 478, 74); x.bezierCurveTo(478, 68, 496, 58, 496, 48); x.bezierCurveTo(496, 36, 478, 36, 478, 50); x.fill(); }) }));
    ban.position.set(0, BACK.y1 + 0.55, HALL.z0 + 0.03); add(ban); }

  // ---------------------------------------------------------------- warm light: pendant lamps, string lights, felt garlands
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffc070, emissiveIntensity: 3 });
  const shadeMat = roomMat(0x2f5d46, 'fabric'), shadeIn = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb860, emissiveIntensity: 0.9, side: THREE.BackSide, roughness: 1 });
  const LAMPS = [[-0.75, -2.62], [0.75, -2.62], [2.55, -3.9], [-2.25, -4.75], [0, -1.05]];
  const lampSwing = LAMPS.map(([x, z], i) => { const p = add(new THREE.Group()); p.position.set(x, HALL.y1, z);
    const len = i === 4 ? 1.0 : 1.25 + (i % 2) * 0.1;
    const cord = new THREE.Mesh(geo.cyl(0.006, 0.006, len, 6), oakDark); cord.position.y = -len / 2; p.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.17, 18, 1, true), shadeMat); shade.position.y = -len - 0.06; p.add(shade);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.195, 0.165, 18, 1, true), shadeIn); inner.position.y = -len - 0.06; p.add(inner);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 5, 24), roomMat(0xd9a93f)); rim.rotation.x = Math.PI / 2; rim.position.y = -len - 0.145; p.add(rim);
    const bulb = new THREE.Mesh(geo.sphere(0.05), bulbMat); bulb.position.y = -len - 0.12; p.add(bulb);
    return { p, len, ph: i * 1.7 }; });
  const lampLight = (i, inten) => { const [x, z] = LAMPS[i]; const l = new THREE.PointLight(0xffb469, 0, 4.1 * S, 2); l.position.set(x, HALL.y1 - lampSwing[i].len - 0.2, z); l.userData.base = inten; root.add(l); return l; };
  const lights = [lampLight(0, 12), lampLight(1, 12), lampLight(2, 9.5), lampLight(3, 8)];
  // garlands: felt swags across the ceiling with pennants, felt stars and string lights; they sway a little
  const garlands = [];
  const flagMats = [0xc8302a, 0x2f6b4a, 0xf0dcae, 0xd9a93f].map((c) => roomMat(c, 'fabric', { side: THREE.DoubleSide }));
  const tri = new THREE.BufferGeometry().setFromPoints([V(-0.06, 0, 0), V(0.06, 0, 0), V(0, -0.13, 0)]); tri.computeVertexNormals();
  const NB = 150, bulbs = new THREE.InstancedMesh(geo.sphere(0.018, 1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), NB); bulbs.frustumCulled = false; add(bulbs);
  const bulbCols = [0xffd9a0, 0xff9a7a, 0xffe7b0, 0x9fe0b0, 0xffd9a0].map((c) => new THREE.Color(c).multiplyScalar(2.2));
  let nb = 0;
  function garland(a, b, sag, { flags = true, lightsOn = true } = {}) {
    const g = add(new THREE.Group()); const mid = a.clone().add(b).multiplyScalar(0.5); g.position.copy(mid);
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; const p = a.clone().lerp(b, u).sub(mid); p.y -= sag * 4 * u * (1 - u); pts.push(p); }
    const cv = new THREE.CatmullRomCurve3(pts); const rope = new THREE.Mesh(new THREE.TubeGeometry(cv, 40, 0.012, 5), felt(0x2f6b4a)); g.add(rope);
    const L = a.distanceTo(b);
    if (flags) { const n = Math.floor(L / 0.2); for (let i = 1; i < n; i++) { const p = cv.getPointAt(i / n); const f = new THREE.Mesh(tri, flagMats[i % 4]); f.position.copy(p); f.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); g.add(f); } }
    if (lightsOn) { const n = Math.floor(L / 0.16); for (let i = 0; i < n && nb < NB; i++, nb++) { const p = cv.getPointAt((i + 0.5) / n).add(mid).add(V(0, -0.025, 0)); bulbs.setColorAt(nb, bulbCols[nb % bulbCols.length]); bulbs.userData[nb] = p; } }
    garlands.push({ g, axis: b.clone().sub(a).normalize(), ph: garlands.length * 1.3, lights: [nb] }); return g;
  }
  const GY = HALL.y1 - 0.42;
  garland(V(HALL.x0 + 0.1, GY, HALL.z1 - 0.3), V(HALL.x1 - 0.1, GY, HALL.z0 + 0.5), 0.7);
  garland(V(HALL.x1 - 0.1, GY, HALL.z1 - 0.3), V(HALL.x0 + 0.1, GY, HALL.z0 + 0.5), 0.7);
  garland(V(HALL.x0 + 0.2, GY - 0.2, HALL.z0 + 0.1), V(HALL.x1 - 0.2, GY - 0.2, HALL.z0 + 0.1), 0.35, { flags: false });
  garland(V(HALL.x0 + 0.1, GY - 0.25, HALL.z1 - 0.1), V(HALL.x1 - 0.1, GY - 0.25, HALL.z1 - 0.1), 0.3, { flags: true, lightsOn: true });
  const bulbBase = []; for (let i = 0; i < nb; i++) bulbBase.push(bulbs.userData[i]); bulbs.count = nb;
  { const m = new THREE.Matrix4(); bulbBase.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m); }); }
  // felt stars and snowflakes hanging from the beams
  const hangers = [];
  for (let i = 0; i < 9; i++) { const x = -3 + i * 0.75, z = -1.6 - (i % 3) * 1.4, len = 0.4 + 0.35 * rnd(); const p = add(new THREE.Group()); p.position.set(x, HALL.y1 - 0.15, z);
    const th = new THREE.Mesh(geo.cyl(0.003, 0.003, len, 4), roomMat(0xf2e3c4)); th.position.y = -len / 2; p.add(th);
    const st = new THREE.Mesh(i % 2 ? new THREE.OctahedronGeometry(0.07) : new THREE.TorusGeometry(0.06, 0.016, 5, 6), felt(i % 2 ? 0xd9a93f : 0xf4efe6)); st.position.y = -len - 0.06; st.scale.z = 0.4; p.add(st);
    hangers.push({ p, ph: rnd() * 6, f: 0.6 + 0.4 * rnd() }); }

  const NSP = 12, sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.014), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc458).multiplyScalar(1.6), transparent: true, depthWrite: false }), NSP);
  sparks.frustumCulled = false; add(sparks); const spSeed = Array.from({ length: NSP }, (_, i) => [Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1), Math.abs(Math.sin(i * 78.233) * 12543.123 % 1)]);
  function sparkle(k, at) {       // k: 0..1 through a 1.6 s burst (outside it: none); at: town-space centre
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(); sparks.visible = k > 0 && k < 1;
    for (let i = 0; i < NSP; i++) { const [a, b] = spSeed[i], sz = sparks.visible ? (1 - k) * (0.6 + 0.7 * b) : 0, ang = i * 2.4 + k * 2.2, r = 0.1 + 0.18 * k * a;
      m.compose(V(at.x + Math.cos(ang) * r, at.y + 0.05 + k * (0.3 + 0.35 * b), at.z + Math.sin(ang) * r * 0.7), q, V(sz, sz, sz)); sparks.setMatrixAt(i, m); }
    sparks.instanceMatrix.needsUpdate = true; }

  // ---------------------------------------------------------------- the volunteers (Chapter 1's sculpts, their own clothes)
  const host = makeChar(gv, { colors: [[/PCoat|PVest/, 0x7d3552], [/PHat/, 0xf0e2c4], [/PSkin/, 0x8d5a3b], [/PHair/, 0x2a1a12], [/PScarf/, 0xe8c55a]] });   // receives the truck
  const booky = makeChar(gp, { colors: [[/PCoat/, 0x2d5fae], [/PHat/, 0xd9a93f], [/PScarf/, 0xc8302a], [/PMitt/, 0xd9a93f], [/PSkin/, 0xe0b08a]] });                 // sorts books
  const letterer = makeChar(gp, { colors: [[/PCoat/, 0x3f6f57], [/PHat/, 0xc8302a], [/PScarf/, 0xf0e2c4], [/PMitt/, 0xc8302a], [/PSkin/, 0xc98a62]] });         // letters labels
  const filler = makeChar(gv, { colors: [[/PCoat|PVest/, 0xd9a93f], [/PHat/, 0x2f5d46], [/PSkin/, 0x6b4630], [/PHair/, 0x1a120c], [/PScarf/, 0xc8302a]] });    // fills shelves, opens the back door
  const VOLS = [host, booky, letterer, filler];
  VOLS.forEach((M) => contact(M, false));

  // ---------------------------------------------------------------- the script (u = seconds into the sorting beat)
  // (the Marine stands a moment inside the door while the camera comes in through the window, then walks to the table)
  const U = { mWalk: 3.2, setDown0: 5.5, setDown1: 6.5, nod: 7.1, pull0: 6.9, pull1: 7.7, lift0: 8.1, lift1: 9.1, turn0: 10.1, turn1: 11.5,
    hWalk: 12.5, place0: 13.8, place1: 14.7, pat0: 14.8, pat1: 15.9, mGo: 15.3, door0: 16.4, door1: 17.8, push0: 18.8 };
  const HOST = V(0.35, 0, -3.28), HOST_CART = V(1.6, 0, -3.62), HOST_ASIDE = V(2.62, 0, -4.9);
  const M_ENTRY = V(0, 0, -0.9), M_TABLE = V(-0.18, 0, -1.92);
  const M1 = curve([[M_ENTRY.x, M_ENTRY.z], [-0.08, -1.35], [M_TABLE.x, M_TABLE.z]]), LM1 = M1.getLength();
  const CARTPATH = curve([[CART0.x, CART0.z], [2.0, -4.4], [1.2, -4.95], [0.32, -5.28], [0.05, -5.72]]), LCP = CARTPATH.getLength(), vCart = 0.62;   // (it ends square to the door)
  const HANDLE = 0.41, BEHIND = 0.4;                                  // the handle's distance from the cart's centre; the Marine's from the handle
  const M_CART = V(CART0.x, 0, CART0.z + HANDLE + BEHIND);
  const M2 = curve([[M_TABLE.x, M_TABLE.z], [0.75, -1.72], [1.75, -1.82], [2.25, -2.35], [M_CART.x, M_CART.z]]), LM2 = M2.getLength(), vM2 = 0.95;
  const H1 = curve([[HOST.x, HOST.z], [1.0, -3.42], [HOST_CART.x, HOST_CART.z]]), LH1 = H1.getLength(), H1_YAW = yawOf(H1.getTangentAt(0));
  const H2 = curve([[HOST_CART.x, HOST_CART.z], [1.68, -4.3], [2.25, -4.75], [HOST_ASIDE.x, HOST_ASIDE.z]]), LH2 = H2.getLength();
  const FILL = V(1.68, 0, -5.52);
  const BHINGE = V(BACK.x0, 0, HALL.z0 + 0.02), BW = BACK.x1 - BACK.x0;
  const backHandle = (th) => V(BHINGE.x + (BW - 0.12) * Math.cos(th) + 0.09 * Math.sin(th), HALL.y0 + 1.0, BHINGE.z - (BW - 0.12) * Math.sin(th) + 0.09 * Math.cos(th));
  const F_DOOR = V(0.78, 0, -5.74), F_PUSH = V(0.6, 0, -5.86), F_ASIDE = V(1.12, 0, -5.8);
  const F1 = curve([[FILL.x, FILL.z], [1.2, -5.62], [F_DOOR.x, F_DOOR.z]]), LF1 = F1.getLength();
  const mTableArrive = U.mWalk + LM1 / 0.7 + 0.6, mCartArrive = U.mGo + LM2 / vM2 + 0.6, hCartArrive = U.hWalk + LH1 / 0.75 + 0.6;
  U.place0 = Math.max(U.place0, hCartArrive + 0.05); U.place1 = U.place0 + 0.9; U.pat0 = U.place1 + 0.1; U.pat1 = U.pat0 + 1.1;
  U.mGo = Math.max(U.mGo, U.pat0 + 0.3); U.push0 = Math.max(U.push0, U.mGo + LM2 / vM2 + 0.6 + 0.35); U.door0 = U.push0 - 2.4; U.door1 = U.door0 + 1.4;
  const pushTime = LCP / vCart + 0.6;
  const END = +(s0 + U.push0 + pushTime + 1.6).toFixed(2);
  BEATS.sorting = [s0, END];
  Object.assign(T, { sort0: s0, sortEnd: END, ...Object.fromEntries(Object.entries(U).map(([k, v]) => ['s_' + k, +(s0 + v).toFixed(2)])) });

  buildToys();
  { const im = toyMeshes.book, m = new THREE.Matrix4(), q = new THREE.Quaternion(); toyPlacements.book.forEach((p, i) => { if (!p.upright) return;
      q.setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2 - 0.08 * Math.sin(i))); m.compose(V(p.x, p.y + 0.085, p.z), q, V(1, 1, 1)); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; }

  // ---------------------------------------------------------------- one moment of the room
  const backAngle = (u) => { if (u < U.door0) return 0; const k = clamp((u - U.door0) / (U.door1 - U.door0)); return 1.35 * (k < 0.35 ? 0.45 * smooth(k / 0.35) : 0.45 + 0.55 * (1 - Math.pow(1 - (k - 0.35) / 0.65, 2.2))); };   // (pushed, then it swings on)
  const cartAt = (u) => { if (u < U.push0) return { p: V(CART0.x, 0, CART0.z), yaw: Math.PI, v: 0 };
    const tr = travel(u, U.push0, LCP, vCart), k = clamp(tr.s / LCP), p = CARTPATH.getPointAt(k), d = CARTPATH.getTangentAt(Math.min(k, 0.999));
    return { p, yaw: yawOf(d), v: tr.v, s: tr.s }; };
  function evaluate(tc, wc, { door = 0 } = {}) {
    const u = tc - s0, live = u > -1 / 12;
    const on = door > 0.01 || u > -0.05;                                // the room is only drawn when it can be seen
    room.visible = on; VOLS.forEach((M) => { M.obj.visible = on; });
    lights.forEach((l) => { l.intensity = on ? l.userData.base * S * S * (1 + 0.035 * Math.sin(wc * 5.3 + l.userData.base) * Math.sin(wc * 2.1)) : 0; });
    flakeMats.forEach((m) => { m.map.offset.y = (wc * 0.18) % 1; m.map.offset.x = 0.04 * Math.sin(wc * 0.5); });
    // garlands, lamps and hangers sway a little (on twos)
    garlands.forEach((G, i) => { G.g.quaternion.setFromAxisAngle(G.axis, 0.035 * Math.sin(wc * 0.7 + G.ph)); });
    lampSwing.forEach((Lm) => { Lm.p.rotation.set(0.02 * Math.sin(wc * 0.9 + Lm.ph), 0, 0.02 * Math.sin(wc * 0.7 + Lm.ph * 1.3)); });
    hangers.forEach((Hg) => { Hg.p.rotation.set(0.05 * Math.sin(wc * Hg.f + Hg.ph), wc * 0.3 * Hg.f + Hg.ph, 0.05 * Math.cos(wc * Hg.f * 0.8 + Hg.ph)); });
    { const m = new THREE.Matrix4(); bulbBase.forEach((p, i) => { const tw = 0.75 + 0.25 * Math.sin(wc * 1.7 + i * 2.3); m.makeScale(tw, tw, tw).setPosition(p.x, p.y, p.z); bulbs.setMatrixAt(i, m); }); bulbs.instanceMatrix.needsUpdate = true; }
    if (!on) return;
    if (!live) sparkle(-1, V());
    const marineHead = () => marine.bones.head.getWorldPosition(V());
    const bl = (x, off, per) => { const q = (((x + off) % per) + per) % per; return q < 0.16 ? Math.sin(Math.PI * q / 0.16) : 0; };

    // ---- the cart and the back door
    const ca = cartAt(u); cart.position.set(ca.p.x, HALL.y0, ca.p.z); cart.rotation.y = ca.yaw - Math.PI; cart.updateMatrixWorld(true);
    const bth = live ? backAngle(u) : 0; backPivot.rotation.y = bth;
    const opened = clamp(bth / 1.2); coldLight.intensity = 4 * S * S * opened; yardSnow.opacity = 0.85 * opened;

    // ---- the host's body first: the truck she holds is placed from her pose (her arms follow it below)
    { let p = HOST.clone(), y = 0, wv = 0, ph = 0;
      if (live && u > U.turn1) { y = angLerp(0, H1_YAW, smooth((u - U.turn1) / (U.hWalk - U.turn1 + 0.3))); wv = 0.25 * Math.sin(Math.PI * clamp((u - U.turn1) / (U.hWalk - U.turn1))); ph = (u - U.turn1) * 0.8; }
      if (live && u > U.hWalk) { const m = walker(H1, LH1, 0.75, U.hWalk, u, Math.PI / 2, host.stride, y); p = m.p; y = m.yaw; wv = walkW(m); ph = m.phase; }
      if (live && u > U.push0 - 2.6) { const m = walker(H2, LH2, 0.7, U.push0 - 2.6, u, yawOf(V(-0.9, 0, -0.35)), host.stride, Math.PI / 2); p = m.p; y = m.yaw; wv = walkW(m); ph = m.phase; }
      pose(host, p, y, { Walk: wv, Idle: 1 - wv }, wc, { phase: ph, off: 0.9 }); }

    // ---- the Marine, the carton and the truck (from the moment the collection ends)
    if (live) {
      marine.obj.visible = true; carton.visible = true; truck.visible = true;
      let mp = M_ENTRY.clone(), my = Math.PI, mw = 0, mph = 0, carryW = 0.6;
      if (u > U.mWalk) { const m = walker(M1, LM1, 0.7, U.mWalk, u, Math.PI, marine.stride, Math.PI); mp = m.p; my = m.yaw; mw = walkW(m); mph = m.phase; }
      carryW = 0.6 * (1 - ramp(u, U.setDown0 + 0.3, U.setDown1));
      if (u > U.mGo) { const m = walker(M2, LM2, vM2, U.mGo, u, Math.PI, marine.stride, Math.PI); mp = m.p; my = m.yaw; mw = walkW(m); mph = m.phase; }
      if (u > U.push0) { const d = V(Math.sin(ca.yaw), 0, Math.cos(ca.yaw)); mp = ca.p.clone().addScaledVector(d, -(HANDLE + BEHIND)); mp.gy = undefined; my = ca.yaw; mw = walkW({ speed: ca.v }); mph = (ca.s || 0) / marine.stride; }
      pose(marine, mp, my, { WalkCarry: mw * carryW, Walk: mw * (1 - carryW), IdleCarry: (1 - mw) * carryW, Idle: (1 - mw) * (1 - carryW) }, wc, { phase: mph });
      const setBend = ramp(u, U.setDown0, U.setDown0 + 0.6) * (1 - ramp(u, U.setDown1 - 0.1, U.setDown1 + 0.5));
      const nodK = ramp(u, U.nod, U.nod + 0.2) * (1 - ramp(u, U.nod + 0.45, U.nod + 0.75)) + ramp(u, U.pat0 + 0.6, U.pat0 + 0.8) * (1 - ramp(u, U.pat0 + 1.0, U.pat0 + 1.3));
      bend(marine, 0.3 * setBend + 0.05 * carryW * (1 - mw) + 0.12 * ramp(u, U.push0 - 0.4, U.push0));
      // the carton: carried, then set down on the table near its front edge, then drawn in by the host
      const { fwd } = axes(marine), bob = mw * 0.018 * Math.sin(mph * Math.PI * 4);
      const carry = marine.obj.getWorldPosition(V()).addScaledVector(fwd, 0.32 * S).add(V(0, (0.77 + bob - 0.17) * S, 0));
      const onTable = W(V(-0.18, TOP, -2.5)), drawn = W(V(-0.05, TOP, -2.78));
      let cw = carry; const kd = smooth((u - U.setDown0) / (U.setDown1 - U.setDown0));
      if (u >= U.setDown0) cw = carry.clone().lerp(onTable, kd);
      if (u >= U.pull0) cw = onTable.clone().lerp(drawn, smooth((u - U.pull0) / (U.pull1 - U.pull0)));
      if (carton.parent !== group) group.attach(carton);
      carton.position.copy(L(cw)); carton.rotation.set(0, u < U.setDown0 ? my - Math.PI : lerp(my - Math.PI, 0.12, kd), 0); carton.updateMatrixWorld(true);
      if (u < U.setDown1 + 0.1) { const cc = carton.localToWorld(V(0, 0.2, 0)), sd = V(0.27 * S, 0, 0).applyAxisAngle(V(0, 1, 0), carton.rotation.y);
        const k = 1 - ramp(u, U.setDown1, U.setDown1 + 0.3); reach(marine, 'L', cc.clone().add(sd), k, elbowPole(marine, 'L', 0.6)); reach(marine, 'R', cc.clone().sub(sd), k, elbowPole(marine, 'R', 0.6)); }
      // pushing the cart: both hands on its handle
      const pushK = ramp(u, U.push0 - 0.5, U.push0);
      if (pushK > 0) { const hb = cart.localToWorld(V(0, CART_H + 0.38, HANDLE)), side = cart.localToWorld(V(0.2, CART_H + 0.38, HANDLE)).sub(hb);
        reach(marine, 'L', hb.clone().add(side), pushK, elbowPole(marine, 'L')); reach(marine, 'R', hb.clone().sub(side), pushK, elbowPole(marine, 'R')); }
      // the truck: on the toys in the carton; lifted out and held up in the lamplight; looked over; carried to the cart;
      // laid in the crate; from then on it rides with the cart
      const hp = host.obj.getWorldPosition(V()), hfwd = axes(host).fwd;
      const inCarton = carton.localToWorld(V(0.02, 0.33, -0.01));
      const show = hp.clone().addScaledVector(hfwd, 0.46 * S).add(V(0, 1.15 * S, 0));
      const crate = cart.localToWorld(TRUCK_IN_CRATE.clone());
      let tp, tq = new THREE.Quaternion();
      if (u < U.lift0) { tp = inCarton; tq.copy(carton.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.25)); }
      else if (u < U.place1) {
        const k1 = smooth((u - U.lift0) / (U.lift1 - U.lift0));
        tp = inCarton.clone().lerp(show, k1); tp.y += Math.sin(Math.PI * k1) * 0.06 * S;
        if (u > U.lift1) { tp = show.clone(); tp.y += Math.sin((u - U.lift1) * 5) * 0.004 * S; }
        const hy = host.obj.rotation.y;
        // looked over: tipped on its side to see the wheels, and back
        const roll = Math.PI * 0.62 * Math.sin(Math.PI * clamp((u - U.turn0) / (U.turn1 - U.turn0)));
        tq.setFromEuler(new THREE.Euler(0, lerp(carton.rotation.y + 0.25, hy, k1), 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), roll));
        if (u > U.place0) { const kp = smooth((u - U.place0) / (U.place1 - U.place0)); tp = show.clone().lerp(crate, kp); tp.y += Math.sin(Math.PI * kp) * 0.05 * S;
          tq.slerp(cart.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2 + 0.15)), kp); }
      } else { tp = crate; tq.copy(cart.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2 + 0.15)); }
      truck.position.copy(L(tp)); truck.quaternion.copy(tq); truck.updateMatrixWorld(true);
      { const k1 = (u - U.lift1 + 0.3) / 1.6, k2 = (u - U.place1 + 0.1) / 1.6; sparkle(k1 > 0 && k1 < 1 ? k1 : k2 > 0 && k2 < 1 ? k2 : -1, L(truck.getWorldPosition(V()))); }
      // eye lines: the host; the truck; the host again (a nod); the cart
      const tw = truck.getWorldPosition(V());
      if (u < U.mWalk + 0.6) lookAt(marine, W(V(0, 1.4, -3)), 0.5);
      else if (u < U.lift0) lookAt(marine, u < U.setDown0 ? W(V(-0.1, TOP, -2.5)) : host.bones.head.getWorldPosition(V()), 0.8);
      else if (u < U.mGo) lookAt(marine, u > U.pat0 + 0.3 ? host.bones.head.getWorldPosition(V()) : tw, 0.8);
      else lookAt(marine, u < U.push0 ? cart.localToWorld(V(0, CART_H + 0.3, 0)) : W(V(0, 1.2, -6.4)), 0.6);
      turnBone(marine.bones.head, axes(marine).right, 0.25 * nodK);
    }

    // ---- the host volunteer: at the table; welcomes the carton; lifts out the truck; carries it to the cart
    {
      const truckK = live ? ramp(u, U.lift0 - 0.35, U.lift0) * (1 - ramp(u, U.place1 - 0.05, U.place1 + 0.35)) : 0;
      const pullK = live ? ramp(u, U.pull0 - 0.3, U.pull0) * (1 - ramp(u, U.pull1, U.pull1 + 0.3)) : 0;
      const patK = live ? ramp(u, U.pat0, U.pat0 + 0.3) * (1 - ramp(u, U.pat1 - 0.2, U.pat1 + 0.2)) : 0;
      const heartK = live ? ramp(u, U.push0 + 1.4, U.push0 + 2.0) : 0;
      bend(host, 0.3 * pullK + 0.22 * ramp(u, U.lift0 - 0.3, U.lift0) * (1 - ramp(u, U.lift0 + 0.3, U.lift1)) + 0.28 * ramp(u, U.place0, U.place0 + 0.4) * (1 - ramp(u, U.place1, U.pat1)) - 0.04 * heartK);
      if (truckK > 0) { const tw = truck.getWorldPosition(V()).add(V(0, 0.07 * S, 0)), side = V(0.15 * S, 0, 0).applyQuaternion(truck.quaternion);
        const lr = side.dot(axes(host).right) > 0 ? 1 : -1;
        reach(host, 'L', tw.clone().addScaledVector(side, lr), truckK, elbowPole(host, 'L')); reach(host, 'R', tw.clone().addScaledVector(side, -lr), truckK, elbowPole(host, 'R')); }
      if (pullK > 0) { const cc = carton.localToWorld(V(0, 0.2, 0)), sd = V(0.27 * S, 0, 0).applyAxisAngle(V(0, 1, 0), carton.rotation.y);
        reach(host, 'L', cc.clone().sub(sd), pullK, elbowPole(host, 'L', 0.6)); reach(host, 'R', cc.clone().add(sd), pullK, elbowPole(host, 'R', 0.6)); }
      if (patK > 0) reach(host, 'R', cart.localToWorld(V(-0.05, CART_H + 0.24, -0.1)), patK, elbowPole(host, 'R'));
      if (heartK > 0) { const ch = host.bones.chest.getWorldPosition(V()).addScaledVector(axes(host).fwd, 0.1 * S).add(V(0, 0.02 * S, 0)); reach(host, 'R', ch, heartK, elbowPole(host, 'R', 0.2)); reach(host, 'L', ch.clone().addScaledVector(axes(host).right, -0.04 * S), heartK * 0.9, elbowPole(host, 'L', 0.2)); }
      // before the Marine comes in: sorting the toys on the table (a hand to them now and then)
      if (!live || u < U.pull0 - 0.4) { const q = ((wc + 1.3) % 6.1) / 6.1, k = ramp(q, 0.15, 0.3) * (1 - ramp(q, 0.55, 0.7));
        reach(host, q < 0.5 ? 'R' : 'L', W(V(q < 0.5 ? 0.62 : 0.1, TOP + 0.05, -2.62)), 0.85 * k * (live ? 1 - ramp(u, U.mWalk, U.mWalk + 0.6) : 1), elbowPole(host, q < 0.5 ? 'R' : 'L'));
        bend(host, 0.12 * k); }
      const tw = truck.getWorldPosition(V());
      if (!live || u < U.mWalk + 0.5) lookAt(host, W(V(0.4, TOP, -2.6)), 0.7);
      else if (u < U.lift0) lookAt(host, u < U.pull0 ? marineHead() : carton.localToWorld(V(0, 0.3, 0)), 0.85);
      else if (u < U.pat0 + 0.4) lookAt(host, tw, 0.9);
      else if (u < U.push0 - 0.3) lookAt(host, marineHead(), 0.8);
      else lookAt(host, cart.localToWorld(V(0, CART_H + 0.2, 0)), 0.7);
      // a smile in the eyes: a happy squint as the truck comes up into the light, and as it is laid in the crate
      const sq = live ? 0.55 * (ramp(u, U.lift1 - 0.2, U.lift1) * (1 - ramp(u, U.lift1 + 0.7, U.lift1 + 1.0)) + ramp(u, U.place1, U.place1 + 0.2) * (1 - ramp(u, U.place1 + 0.8, U.place1 + 1.1))) : 0;
      const tilt = live ? 0.16 * ramp(u, U.lift1 - 0.1, U.lift1 + 0.3) * (1 - ramp(u, U.turn0, U.turn0 + 0.4)) : 0;
      turnBone(host.bones.head, axes(host).fwd, tilt);
      if (live) { const nod = ramp(u, U.nod - 0.25, U.nod - 0.05) * (1 - ramp(u, U.nod + 0.2, U.nod + 0.5)); turnBone(host.bones.head, axes(host).right, 0.28 * nod); }
      host.blink.value = Math.max(bl(tc, 1.1, 4.2), sq);
    }

    // ---- the book sorter, at the table's left end: a book from the box to the pile, again and again
    { const per = 5.3, q = ((wc + 0.7) % per) / per, n = Math.floor((wc + 0.7) / per) % 6;
      const BP = V(-1.74, 0, -2.66); pose(booky, BP, Math.PI / 2, { Idle: 1 }, wc, { off: 2.2 });
      const boxIn = W(V(-1.08, TOP + 0.15, -2.45)), pileTop = W(V(PILE.x, PILE.y + (n + 1) * 0.026 + 0.03, PILE.z));
      const take = ramp(q, 0.05, 0.25), carry = smooth(clamp((q - 0.3) / 0.25)), back = ramp(q, 0.62, 0.8);
      const hand = boxIn.clone().lerp(pileTop, carry);
      const holding = q > 0.25 && q < 0.58;
      reach(booky, 'R', hand, take * (1 - back), elbowPole(booky, 'R')); bend(booky, 0.18 * take * (1 - back));
      pile.forEach((b, i) => { b.visible = i < n; });
      bookInHand.visible = holding; if (holding) { bookInHand.position.copy(L(booky.bones.handR.getWorldPosition(V()))).add(V(0, -0.02, 0)); bookInHand.rotation.set(0, 0.2, 0.1 * (1 - carry)); }
      // reacts to the Marine coming in, and to the truck
      let look = W(V(-1.1, TOP + 0.1, -2.65)), lw = 0.6;
      { const r = U.mWalk + 0.8; if (live && u > r && u < r + 2.2) { look = marineHead(); lw = 0.75 * ramp(u, r, r + 0.4) * (1 - ramp(u, r + 1.8, r + 2.2)); } }
      if (live && u > U.lift1 - 0.2 && u < U.turn1) { look = truck.getWorldPosition(V()); lw = 0.7; }
      lookAt(booky, look, lw);
      booky.blink.value = bl(wc, 2.2, 4.4);
    }

    // ---- the letterer, by the left wall: writes a word on a box, caps the marker, looks round, starts the next
    { const per = 7.4, q = ((wc + 3.1) % per) / per, n = Math.floor((wc + 3.1) / per) % WORDS.length;
      const LP = V(-2.68, 0, -2.75); pose(letterer, LP, -Math.PI / 2, { Idle: 1 }, wc, { off: 0.4 });
      const wr = clamp((q - 0.08) / 0.5);                                // how much of the word is written
      letterPlane.material = lettering[n];
      blank.scale.x = LBOX.w * 0.82 * (1 - wr); blank.position.x = LBOX.w * 0.82 * wr / 2;
      const writing = q > 0.06 && q < 0.6, edge = lbox.localToWorld(V(-LBOX.w * 0.41 + LBOX.w * 0.82 * wr, LBOX.h * (0.55 + 0.06 * Math.sin(wc * 31)), LBOX.d / 2 + 0.02));
      const wk = ramp(q, 0.02, 0.08) * (1 - ramp(q, 0.6, 0.68));
      reach(letterer, 'R', edge, 0.95 * wk, elbowPole(letterer, 'R')); bend(letterer, 0.16 * wk);
      marker.position.copy(L(letterer.bones.handR.getWorldPosition(V()))); marker.rotation.set(0.5, 0, wk > 0.5 ? 0.9 : 0.2);
      let look = writing ? edge : W(V(-1.5, 1.3, -2.2)), lw = 0.7;
      { const r = U.mWalk + 1.1; if (live && u > r && u < r + 1.7) { look = marineHead(); lw = 0.7 * ramp(u, r, r + 0.4) * (1 - ramp(u, r + 1.3, r + 1.7)); } }
      lookAt(letterer, look, lw);
      letterer.blink.value = bl(wc, 3.4, 3.8);
    }

    // ---- the shelf filler at the back: a toy from the basket onto the shelf; later, she opens the back door
    { const per = 6.2, q = ((wc + 2.0) % per) / per, n = Math.floor((wc + 2.0) / per) % SLOTS.length;
      let p = FILL.clone(), y = Math.PI, wv = 0, ph = 0, waveK = 0;
      const doorK = live ? ramp(u, U.door0 - 1.6, U.door0 - 1.2) : 0;
      if (live && u > U.door0 - 1.6) { const m = walker(F1, LF1, 0.8, U.door0 - 1.6, u, Math.PI, filler.stride, Math.PI); p = m.p; y = m.yaw; wv = walkW(m); ph = m.phase; }
      const bth2 = live ? backAngle(u) : 0;
      if (live && u > U.door0) { const k = smooth((u - U.door0) / 0.6); p = F_DOOR.clone().lerp(F_PUSH, k); y = angLerp(Math.PI, yawOf(V(-0.4, 0, -1)), k); wv = 0.4 * Math.sin(Math.PI * clamp((u - U.door0) / 0.6)); ph = (u - U.door0) * 1.1; }
      if (live && u > U.door0 + 0.9) { const m = walker(curve([[F_PUSH.x, F_PUSH.z], [0.9, -5.72], [F_ASIDE.x, F_ASIDE.z]]), 0.6, 0.6, U.door0 + 0.9, u, yawOf(V(-0.7, 0, 0.7)), filler.stride, yawOf(V(-0.4, 0, -1))); p = m.p; y = m.yaw; wv = walkW(m); ph = m.phase; }
      { const r = U.mWalk + 1.5; if (live && u > r && u < r + 1.6) waveK = ramp(u, r, r + 0.3) * (1 - ramp(u, r + 1.2, r + 1.6)); }
      pose(filler, p, y, { Wave: waveK * (1 - wv), Walk: wv, Idle: (1 - waveK) * (1 - wv) }, wc, { phase: ph, off: 1.6 });
      // the shelf work (before the door): stoop to the basket, rise, place the toy in the next gap
      const work = 1 - doorK - waveK;
      const slot = SLOTS[n], stoop = ramp(q, 0.05, 0.2) * (1 - ramp(q, 0.3, 0.42)), place = ramp(q, 0.42, 0.62) * (1 - ramp(q, 0.75, 0.88));
      slotToys.forEach((o, i) => { o.visible = i < n || (i === n && q > 0.7); });
      const inHand = q > 0.25 && q < 0.7 && work > 0.5;
      if (work > 0) {
        bend(filler, 0.55 * stoop * work);
        reach(filler, 'L', stoop > place ? W(V(BASKET.x, BASKET.y + 0.25, BASKET.z)) : W(slot.clone().add(V(0, 0.08, 0.02))), Math.max(stoop, place) * work, elbowPole(filler, 'L'));
      }
      toyInHand.visible = inHand; if (inHand) { toyInHand.position.copy(L(filler.bones.handL.getWorldPosition(V()))).add(V(0, -0.1, 0)); toyInHand.rotation.set(0, Math.PI, 0); }
      const fh = ramp(u, U.door0 - 0.35, U.door0) * (1 - ramp(u, U.door0 + 0.45, U.door0 + 0.75));
      if (live && fh > 0) reach(filler, 'R', W(backHandle(bth2)), fh, elbowPole(filler, 'R'));
      let look = stoop > place ? W(V(BASKET.x, BASKET.y + 0.2, BASKET.z)) : W(slot), lw = 0.7 * work;
      if (live && u > U.mWalk + 1.3 && u < U.mWalk + 3.2) { look = marineHead(); lw = 0.8; }
      if (live && u > U.door0 - 1.6) { look = u < U.door0 + 0.9 ? W(backHandle(bth2)) : u < U.push0 ? W(V(0, 1.2, -7.5)) : cart.localToWorld(V(0, CART_H + 0.3, 0)); lw = 0.75; }
      lookAt(filler, look, lw);
      filler.blink.value = bl(wc, 0.6, 4.6);
    }
    VOLS.forEach(setContact);
    const at = (M) => L(M.obj.getWorldPosition(V()));
    Object.assign(state, { host: at(host), booky: at(booky), letterer: at(letterer), filler: at(filler), cart: { x: cart.position.x, z: cart.position.z, yaw: cart.rotation.y },
      backDoor: bth, room: room.visible, crate: L(cart.localToWorld(TRUCK_IN_CRATE.clone())) });
  }
  const state = {};

  // ---------------------------------------------------------------- the camera's shots in the room (absolute story time)
  // Through the window: from the collection's last frame the camera drifts left along the hall's front to its lit window,
  // eases in, and passes through the glass into the room (a warm glow at the moment of crossing); then the room.
  const ease = (t, a, b) => smooth((t - a) / (b - a));
  const mix3 = (a, b, k) => a.clone().lerp(b, k);
  const A = (u) => s0 + u;
  const WIN_PATH = new THREE.CatmullRomCurve3([V(1.3, 1.48, 2.7), V(-0.55, 1.58, 3.25), V(-1.85, 1.5, 2.5), V(-2.3, 1.4, 1.25), V(-2.33, 1.38, 0.3), V(-2.3, 1.42, -0.35),
    V(-1.95, 1.7, -0.75), V(-1.25, 1.95, -0.58)], false, 'centripetal');
  const WIN_LOOK = [[0, V(0, 1.3, 0.05)], [0.32, V(-2.15, 1.45, 0.1)], [0.6, V(-2.34, 1.38, -0.9)], [0.74, V(-1.6, 1.35, -2.6)], [1, V(0.1, 1.15, -2.85)]];
  const lookAlong = (k) => { let i = 0; while (i < WIN_LOOK.length - 2 && k > WIN_LOOK[i + 1][0]) i++; const [k0, a] = WIN_LOOK[i], [k1, b] = WIN_LOOK[i + 1]; return mix3(a, b, smooth((k - k0) / (k1 - k0))); };
  // a slow drift along the hall's front that eases in towards the glowing window (the window stays a window, not a
  // wall of light, until the last moment), a held breath, then through and round to the table
  const WT = 5.4, winK = (t) => { const u = t - A(0); return u < 2.6 ? 0.5 * smooth(u / 2.6) : 0.5 + 0.5 * smooth((u - 2.6) / (WT - 2.6)); };
  const sh = (a, b, p0, p1, l0, l1, cut = false, e0 = a, e1 = b) => ({ t0: A(a), t1: b === null ? END + 0.3 : A(b), cut,
    pos: (t) => mix3(p0, p1, ease(t, A(e0), e1 === null ? END : A(e1))), look: (t) => mix3(l0, l1, ease(t, A(e0), e1 === null ? END : A(e1))) });
  const shots = {
    wide: [
      { t0: A(0), t1: A(WT), still: A(WT), pos: (t) => WIN_PATH.getPointAt(winK(t)), look: (t) => lookAlong(winK(t)) },
      // the room: from beside the door, the Marine bringing the carton to the table, the host coming to meet it
      sh(WT, U.pull0, V(-1.25, 1.95, -0.58), V(-1.02, 1.86, -0.78), V(0.1, 1.15, -2.85), V(0.05, 1.2, -2.8)),
      // the reveal, from the table's front-right: the host's face, the truck coming up into the lamplight, the Marine
      sh(U.pull0, U.turn1, V(1.08, 1.56, -1.42), V(0.88, 1.52, -1.6), V(0.22, 1.4, -3.05), V(0.26, 1.42, -3.1), true),
      // to the cart: round to its front; the truck goes into the crate; a quiet moment
      sh(U.turn1, U.pat1 + 0.3, V(0.88, 1.46, -1.68), V(3.15, 1.75, -1.95), V(0.5, 1.28, -3.2), V(2.0, 1.12, -3.62), false, U.turn1, U.place0 + 0.1),
      // the room at work: wide and a little high from the front-right; the Marine comes round, the back door opens
      sh(U.pat1 + 0.3, U.push0 + 0.2, V(3.2, 2.45, -0.75), V(3.05, 2.38, -0.95), V(0.6, 1.05, -4.1), V(0.5, 1.05, -4.4), true),
      // the hand-off: the cart rolls to the open back door and the snowy night; the host watches, a hand on her heart
      sh(U.push0 + 0.2, null, V(-1.55, 2.7, -3.55), V(-1.72, 2.62, -3.95), V(0.7, 0.95, -5.1), V(0.15, 0.95, -5.9), true),
    ],
  };
  // phones: the same shots from a little further back and higher (inside the room), so the action fits a tall frame
  const inRoom = (p) => V(clamp(p.x, HALL.x0 + 0.25, HALL.x1 - 0.25), Math.min(p.y, HALL.y1 - 0.45), clamp(p.z, HALL.z0 + 0.3, -0.35));
  const tallify = (seg, k, up) => ({ ...seg, pos: (t) => { const p = seg.pos(t), l = seg.look(t); return inRoom(l.clone().add(p.clone().sub(l).multiplyScalar(k)).add(V(0, up, 0))); } });
  shots.tall = [
    { ...shots.wide[0], pos: (t) => WIN_PATH.getPointAt(winK(t)).add(V(0, 0.05, 0)) },
    tallify(shots.wide[1], 1.12, 0.2), tallify(shots.wide[2], 1.25, 0.18), tallify(shots.wide[3], 1.25, 0.2), tallify(shots.wide[4], 1.0, 0.25), tallify(shots.wide[5], 1.2, 0.22),
  ];
  // the warm glow as the lens crosses the window glass, and how far inside the hall the camera is (for the lighting)
  const crossing = (p) => { const nearWin = Math.abs(p.x + 2.6) < 0.7 && p.y > 0.7 && p.y < 2.5; const dz = p.z + 0.05; return nearWin ? 0.92 * Math.pow(smooth(1 - (dz > 0 ? dz / 0.85 : -dz / 0.5)), 1.6) : 0; };
  const insideK = (p) => smooth(clamp(-p.z / 0.3)) * (p.x > HALL.x0 - 0.1 && p.x < HALL.x1 + 0.1 ? 1 : 0);

  return { group: room, evaluate, state, shots, crossing, insideK, beats: BEATS, end: END, cast: { host, booky, letterer, filler }, cart, U, s0 };
}
