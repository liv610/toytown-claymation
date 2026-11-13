// The 3D map's side of campaign selection (Milestone 1, step 3, first part). The map does not own any search or
// selection logic: it follows the shared selection (selection.js). When a campaign is selected it
//   - frames the campaign in the part of the screen the finder and the controls leave open (freeArea), and
//   - marks it with a felt-headed sewing pin pushed into the map, with a soft gold stitched ring.
// The pin is its own small layer: the railroad routes, the Toy Town star and the map's label pins are untouched.
// Campaign data comes from the selection (the directory), never from the scene.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { toWorld, proj, insetShift, MAP_W, MAP_H } from './geo.js';
import { stateByFips, stateByCode } from '../../shared/us_states.js';
import { felt } from './felt.js';
import { selection } from './selection.js';

/** the part of the window the map can show without the top bar, the finder or the bottom controls over it (CSS px) */
export function freeArea() {
  const W = innerWidth, H = innerHeight, box = (sel) => { const e = document.querySelector(sel); const r = e && e.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? r : null; };
  const bar = box('.topbar'), acts = box('.actions'), f = box('#finder');
  let left = 0, right = W, top = bar ? bar.bottom : 0, bottom = H - 76;                 // the controls row along the bottom
  if (acts && acts.top > H / 2) bottom = Math.min(bottom, acts.top - 64);               // phones: help bar at the bottom
  const full = { left, right, top, bottom };
  if (f) {
    if (f.width < W * 0.6) right = Math.min(right, f.left - 12);                        // side panel (wide screens)
    else top = Math.max(top, f.bottom + 8);                                               // strip (tablets, phones)
  }
  // if the finder leaves too little room (a phone showing results), frame in the whole map area instead; the visitor
  // can tuck the finder away to see it
  if (bottom - top < H * 0.22 || right - left < W * 0.3) return { ...full, covered: true };
  return { left, right, top, bottom, covered: false };
}

/**
 * ctx: { scene, geo, relief, rig, camera, dom, minDist, regionalDist(), fovFor(dist), canMove(), fly(pose), showing(), reduced }
 * Returns { update(t), pose(campaign), state(), project(lon, lat) }.
 * States (step 3, stage 1): a short click (not a drag) on a state over the country view browses it
 * (selection.browse); whatever set the browsed state, the map outlines it with a gold running stitch and frames it.
 */
export function attachCampaignFocus(ctx) {
  const { scene, geo, relief, rig } = ctx;
  // ------------------------------------------------ the pin: felt head, a fine steel shaft, a stitched gold ring
  const pin = new THREE.Group(); pin.name = 'campaign-pin'; pin.visible = false;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), felt(new THREE.MeshStandardMaterial({ color: 0xc8372c, roughness: 0.95 }), 'felt', { key: '-pin' }));
  // a long hat pin: its head stands clear of the map's label pins when a campaign shares a place with one (Maple Hollow)
  const HEAD_Y = 6.2; head.position.y = HEAD_Y; head.scale.set(1.3, 1.35, 1.3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.03, 5.6, 10), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, metalness: 0.7, roughness: 0.3 }));
  shaft.position.y = 2.8;
  for (const m of [head, shaft]) { m.castShadow = true; pin.add(m); }
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb43c, emissiveIntensity: 0.9, roughness: 0.9 });
  const ring = new THREE.Group(); const dash = new THREE.CylinderGeometry(0.11, 0.11, 0.62, 6);
  for (let i = 0; i < 18; i++) {                                                    // a running stitch round the pin
    const a = i / 18 * Math.PI * 2, d = new THREE.Mesh(dash, ringMat);
    d.position.set(Math.cos(a) * 1.9, 0.08, Math.sin(a) * 1.9); d.rotation.set(Math.PI / 2, 0, -a); ring.add(d);
  }
  pin.add(ring); scene.add(pin);

  let at = null, t0 = 0, framed = null;                                           // selection's world position; last framing
  function place(c) {
    const a = geo.P(c.location.lon, c.location.lat);
    if (!a) return null;
    const [x, z] = toWorld(a[0], a[1]);
    return new THREE.Vector3(x, relief.surfaceY(a[0], a[1]), z);
  }
  /** a regional view of the campaign, shifted so the campaign sits in the middle of the free area */
  function pose(c) {
    const p = place(c); if (!p) return null;
    return framedPose(p, THREE.MathUtils.clamp(ctx.regionalDist() * 0.36, 240, 560));
  }
  /** look at p from dist, shifted so p sits in the middle of the free area */
  function framedPose(p, dist) {
    const area = freeArea(), W = innerWidth, H = innerHeight;
    const cx = ((area.left + area.right) / 2) / W * 2 - 1, cy = 1 - ((area.top + area.bottom) / 2) / H * 2;
    const el = rig.el, az = 0;
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(ctx.fovFor(dist)) / 2), halfW = halfH * (W / H);
    const fwd = new THREE.Vector3(-Math.cos(el) * Math.sin(az), -Math.sin(el), -Math.cos(el) * Math.cos(az));
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const target = p.clone().addScaledVector(right, -cx * halfW).addScaledVector(up, -cy * halfH);
    return { target, dist, az, el };
  }
  function follow(cur) {
    at = cur ? place(cur.campaign) : null; t0 = performance.now();
    if (!at || !ctx.canMove()) return;
    framed = pose(cur.campaign); if (framed) ctx.fly(framed);
  }
  selection.subscribe((cur) => follow(cur));
  // the finder opened, closed or changed size: if the visitor has not moved the camera since, re-frame the campaign in
  // the space that is now open (not when the finder now covers most of the map)
  addEventListener('finderlayout', () => {
    const cur = selection.get(); if (!cur || !framed || !ctx.canMove() || freeArea().covered) return;
    const still = rig.target.distanceTo(framed.target) < 0.5 && Math.abs(rig.dist - framed.dist) < 0.5;
    const moving = ctx.flying && ctx.flying();
    if (!still && !moving) return;
    framed = pose(cur.campaign); if (framed) ctx.fly(framed);
  });
  if (selection.get()) follow(selection.get());                                   // chosen before the map had loaded

  // ------------------------------------------------ states: which state is under a point, its outline, its framing
  // A state-id image of the board (1 px per map unit), drawn once from the map's own state shapes (Alaska and Hawaii
  // where the felt board puts them): a click costs one pixel read, however many campaigns there are.
  const shapes = new Map();                                                         // code → polygons (map units)
  for (const f of feature(geo.topo, geo.topo.objects.states).features) {
    const st = stateByFips.get(f.id); if (!st) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    shapes.set(st.code, geo.neighbours ? polys.map((poly) => {
      const xs = poly[0].map((q) => q[0]), ys = poly[0].map((q) => q[1]), ll = proj.invert([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
      return ll && ll[0] < -140 ? poly.map((ring) => ring.map((q) => insetShift(q, ll[0], ll[1]))) : poly;
    }) : polys);
  }
  const [bx0, by0, bx1, by1] = geo.board, BW = Math.ceil(bx1 - bx0), BH = Math.ceil(by1 - by0), codes = [...shapes.keys()];
  const idc = document.createElement('canvas'); idc.width = BW; idc.height = BH;
  const ig = idc.getContext('2d', { willReadFrequently: true }); ig.translate(-bx0, -by0);
  codes.forEach((code, i) => {
    ig.fillStyle = `rgb(${(i + 1) * 4},0,0)`; ig.beginPath();
    for (const poly of shapes.get(code)) for (const ring of poly) ring.forEach(([x, y], j) => (j ? ig.lineTo(x, y) : ig.moveTo(x, y)));
    ig.fill('evenodd');
  });
  const ids = ig.getImageData(0, 0, BW, BH).data;
  const stateAt = (ax, ay) => {
    const x = Math.floor(ax - bx0), y = Math.floor(ay - by0); if (x < 0 || y < 0 || x >= BW || y >= BH) return null;
    const i = Math.round(ids[(y * BW + x) * 4] / 4) - 1; return i >= 0 && i < codes.length ? codes[i] : null;
  };
  const boxOf = (code) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of shapes.get(code)) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1]; };

  // a click (not a drag) on the land over the country view → browse that state
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
  function pickState(clientX, clientY) {
    const r = ctx.dom.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const hit = ray.intersectObject(relief.land, false)[0];
    const p = hit ? hit.point : ray.ray.intersectPlane(ground, new THREE.Vector3());
    return p ? stateAt(p.x + MAP_W / 2, p.z + MAP_H / 2) : null;
  }
  let down = null, touches = 0;
  ctx.dom.addEventListener('pointerdown', (e) => { touches++; down = touches === 1 ? { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId } : null; });
  const up = (e) => {
    touches = Math.max(0, touches - 1);
    const d = down; down = null;
    if (!d || d.id !== e.pointerId || e.type !== 'pointerup' || !ctx.canMove()) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || e.timeStamp - d.t > 700) return;   // that was a drag
    const code = pickState(e.clientX, e.clientY); if (code) selection.browse(code, { via: 'map' });
  };
  ctx.dom.addEventListener('pointerup', up); ctx.dom.addEventListener('pointercancel', up);

  // the browsed state: a gold running stitch round its outline (one mesh), and a camera move that frames it
  // a couched cord: gold stitches over a continuous dark thread, so it reads on every felt colour (gold alone vanished
  // on the tan and olive felt). Unlit, so it looks the same everywhere; colours chosen for the map's tone mapping.
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xe0a02a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6 });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x2a1a12, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  let outline = null, browsed = null;
  function stitchOutline(code, w) {
    const pos = [], cord = [], gap = w * 1.1, len = w * 3.2, lift = Math.max(0.5, w * 0.9), Y = (ax, ay) => relief.surfaceY(ax, ay) + lift;
    const quad = (out, ax, ay, bx, by, half, dy) => {
      const seg = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / seg * half, ny = (bx - ax) / seg * half;
      const ya = Y(ax, ay) + dy, yb = Y(bx, by) + dy, [x0, z0] = toWorld(ax, ay), [x1, z1] = toWorld(bx, by);
      out.push(x0 - nx, ya, z0 - ny, x0 + nx, ya, z0 + ny, x1 + nx, yb, z1 + ny, x0 - nx, ya, z0 - ny, x1 + nx, yb, z1 + ny, x1 - nx, yb, z1 - ny);
    };
    for (const poly of shapes.get(code)) {
      const ring = poly[0]; let carry = 0;
      for (let j = 1; j < ring.length; j++) {
        const [ax, ay] = ring[j - 1], [bx, by] = ring[j], seg = Math.hypot(bx - ax, by - ay); if (!seg) continue;
        const ux = (bx - ax) / seg, uy = (by - ay) / seg;
        quad(cord, ax, ay, bx, by, w * 0.85, -0.05);                                // the dark thread, unbroken
        let s0 = carry;
        for (; s0 < seg; s0 += len + gap) {
          const s1 = Math.min(seg, s0 + len);
          quad(pos, ax + ux * s0, ay + uy * s0, ax + ux * s1, ay + uy * s1, w / 2, 0);   // a gold stitch
        }
        carry = s0 - seg;                                                           // where the next stitch starts on the next segment
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const gc = new THREE.BufferGeometry(); gc.setAttribute('position', new THREE.Float32BufferAttribute(cord, 3));
    const m = new THREE.Mesh(g, outlineMat); m.name = 'state-outline'; m.renderOrder = 3;
    const c = new THREE.Mesh(gc, cordMat); c.renderOrder = 2; m.add(c); return m;
  }
  function stateDist(code) {
    const [x0, y0, x1, y1] = boxOf(code), area = freeArea(), fy = (area.bottom - area.top) / innerHeight, fx = (area.right - area.left) / innerWidth;
    const ry = (y1 - y0) / 2 * Math.sin(rig.el) + 4, rx = (x1 - x0) / 2 + 4, aspect = innerWidth / innerHeight;
    let dist = 400;
    for (let i = 0; i < 4; i++) { const t = Math.tan(THREE.MathUtils.degToRad(ctx.fovFor(dist)) / 2); dist = Math.max(ry / (0.8 * fy * t), rx / (0.8 * fx * t * aspect)); }
    return THREE.MathUtils.clamp(dist * 1.25, ctx.minDist * 1.3, ctx.regionalDist());   // a little country round the state
  }
  function browse(reg) {
    if (outline) { scene.remove(outline); outline.geometry.dispose(); outline.children[0].geometry.dispose(); outline = null; }
    browsed = reg && shapes.has(reg.code) ? reg.code : null;
    if (!browsed) return;
    const dist = stateDist(browsed);
    outline = stitchOutline(browsed, dist * 0.006); scene.add(outline);
    if (!ctx.canMove() || selection.get()) return;                                 // a selected campaign keeps the camera
    const [x0, y0, x1, y1] = boxOf(browsed), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, [x, z] = toWorld(cx, cy);
    framed = null; ctx.fly(framedPose(new THREE.Vector3(x, relief.surfaceY(cx, cy), z), dist));
  }
  selection.onRegion((reg) => browse(reg));
  if (selection.region()) browse(selection.region());

  return {
    pose,
    update() {
      if (outline) outline.visible = ctx.showing();
      pin.visible = !!at && ctx.showing();
      if (!pin.visible) return;
      const s = rig.dist * 0.014, k = (performance.now() - t0) / 1000;
      pin.position.copy(at); pin.scale.setScalar(s);
      const settle = ctx.reduced ? 1 : Math.min(1, k / 0.5);                         // the pin pushes in once
      head.position.y = HEAD_Y + (1 - settle) * (1 - settle) * 3;
      const pulse = ctx.reduced ? 1 : 1 + 0.08 * Math.sin(k * 2.4);
      ring.scale.set(pulse, 1, pulse); ringMat.emissiveIntensity = ctx.reduced ? 0.8 : 0.7 + 0.25 * Math.sin(k * 2.4);
    },
    state() {
      let box = null;
      if (outline) { outline.geometry.computeBoundingBox(); const b = outline.geometry.boundingBox; box = [b.min.toArray().map(Math.round), b.max.toArray().map(Math.round)]; }
      const reg = { browsed, outline: !!outline && outline.visible, stitches: outline ? outline.geometry.attributes.position.count / 6 : 0, box };
      if (!at) return { selected: false, ...reg };
      const v = at.clone().project(ctx.camera);
      return { selected: true, visible: pin.visible, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, area: freeArea(), ...reg };
    },
    /** screen position (CSS px) of a longitude/latitude on the map, and the state there (tests) */
    project(lon, lat) {
      const a = geo.P(lon, lat); if (!a) return null;
      const [x, z] = toWorld(a[0], a[1]), v = new THREE.Vector3(x, relief.surfaceY(a[0], a[1]), z).project(ctx.camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, state: stateAt(a[0], a[1]), area: freeArea() };
    },
  };
}
