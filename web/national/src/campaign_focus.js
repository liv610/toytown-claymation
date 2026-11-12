// The 3D map's side of campaign selection (Milestone 1, step 3, first part). The map does not own any search or
// selection logic: it follows the shared selection (selection.js). When a campaign is selected it
//   - frames the campaign in the part of the screen the finder and the controls leave open (freeArea), and
//   - marks it with a felt-headed sewing pin pushed into the map, with a soft gold stitched ring.
// The pin is its own small layer: the railroad routes, the Toy Town star and the map's label pins are untouched.
// Campaign data comes from the selection (the directory), never from the scene.
import * as THREE from 'three';
import { toWorld } from './geo.js';
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
 * ctx: { scene, geo, relief, rig, camera, regionalDist(), fovFor(dist), canMove(), fly(pose), showing(), reduced }
 * Returns { update(t), pose(campaign), state() }.
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
    const area = freeArea(), W = innerWidth, H = innerHeight;
    const cx = ((area.left + area.right) / 2) / W * 2 - 1, cy = 1 - ((area.top + area.bottom) / 2) / H * 2;
    const dist = THREE.MathUtils.clamp(ctx.regionalDist() * 0.36, 240, 560), el = rig.el, az = 0;
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

  return {
    pose,
    update() {
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
      if (!at) return { selected: false };
      const v = at.clone().project(ctx.camera);
      return { selected: true, visible: pin.visible, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, area: freeArea() };
    },
  };
}
