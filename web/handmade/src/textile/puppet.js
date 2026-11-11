// Experiment C — the Marine as a small stuffed stop-motion puppet.
//
// Design choices (character, not anatomy): the head is about 1.6× the old one and sewn from six panels, so the
// seams show; the face is all craft — button eyes on felt whites, embroidered brows and smile, felt cheeks; the
// body is a soft, slightly pear-shaped stuffed felt coat with side seams; limbs are short soft tubes with button
// joints; hands are cotton mittens; shoes are big round felt toes. Proportions are a touch uneven on purpose.
// It rides the same skeleton and Walk clip as every other Marine; a small additive head bob and tilt is layered on
// top so the walk reads as a performed puppet rather than a game loop.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, M, circle, ellipse, roundRect, slab } from '../kit.js';
import { rigPuppet } from '../puppet.js';
import { makeKit, lumpGeo, pillowGeo, fbm3js } from './kit.js';

const NAVY = 0x2b3d6a, TROUSER = 0x34548f, RED = 0xb3262c, WHITE = 0xf3eee4, SKIN = 0xe0a882, BLACK = 0x1c1a20, GOLD = 0xd9a441, HAIR = 0x5a3420, CHEEK = 0xec8f80, THREAD = 0xf3e9d6;
const up = V(0, 1, 0);
const face = (p, n) => new THREE.Matrix4().lookAt(V(0, 0, 0), n.clone().normalize().negate(), up.clone().add(V(0.0013, 0, 0.0011))).setPosition(p);

/** a stuffed limb: lathe profile from a to b, rounded at both ends, a little fuller in the middle */
function limbGeo(a, b, rA, rB, seg = 12, belly = 0.08) {
  const len = a.distanceTo(b), pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, end = Math.sin(t * Math.PI) ** 0.32, r = (rA + (rB - rA) * t) * Math.max(0.05, end) * (1 + belly * Math.sin(t * Math.PI)); pts.push(new THREE.Vector2(r, t * len)); }
  const g = new THREE.LatheGeometry(pts, seg); g.deleteAttribute('uv');
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize())); g.translate(a.x, a.y, a.z);
  return g;
}
/** the head: a ball sewn from six panels — the seams pull in slightly, the face panel stays smooth */
function headGeo(R, c) {
  let g = new THREE.SphereGeometry(R, 36, 26); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const p = g.attributes.position, seams = [0.55, 1.6, 2.65, -0.55, -1.6, -2.65].map((a) => a);
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)), az = Math.atan2(v.x, v.z), lat = Math.asin(v.y / R);
    let pull = 0; for (const s of seams) { let d = Math.abs(az - s); d = Math.min(d, Math.PI * 2 - d); pull = Math.max(pull, Math.exp(-((d / 0.05) ** 2))); }
    pull *= Math.cos(lat) ** 0.5;
    const puff = 1 + 0.025 * Math.cos(lat) - 0.03 * pull + 0.008 * fbm3js(v.x * 9, v.y * 9, v.z * 9, 3);
    v.multiplyScalar(puff); v.set(v.x * 1.05, v.y * 0.94, v.z * 0.98);
    p.setXYZ(i, v.x + c.x, v.y + c.y, v.z + c.z);
  }
  g.computeVertexNormals();
  return { g, seams };
}

export function textilePuppet(gltf, mats) {
  const kits = {};
  let boneMap = null;
  const rig = rigPuppet(gltf, ({ part, joint, bones }) => {
    boneMap = bones;
    const K = (bone) => kits[bone] || (kits[bone] = makeKit(Object.keys(kits).length * 7 + 5));
    const add = (bone, geo, col, batch = 'felt') => K(bone).solid(geo, null, col, { batch });
    const seam = (bone, a, b, out, r, col = THREAD, n = 8) => { const k = K(bone); for (let i = 0; i < n; i++) { const t0 = (i + 0.2) / n, t1 = (i + 0.65) / n; k.S.add(a.clone().lerp(b, t0).addScaledVector(out, r), a.clone().lerp(b, t1).addScaledVector(out, r), col, 0.0065, out); } };
    const button = (bone, p, n, s, col, batch = 'paint') => K(bone).button(face(p, n), 0, 0, 0, s, col, { batch, thread: THREAD });

    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1, out = V(sx, 0, 0);
      const hip = joint('thigh.' + s), knee = joint('shin.' + s), ankle = joint('foot.' + s);
      add('thigh.' + s, limbGeo(hip.clone().add(V(-sx * 0.01, 0.05, 0)), knee.clone().add(V(0, -0.03, 0)), 0.095, 0.08), TROUSER);
      add('shin.' + s, limbGeo(knee.clone().add(V(0, 0.05, 0)), ankle.clone().add(V(0, 0.02, 0)), 0.08, 0.072), TROUSER);
      // the red trouser stripe: a ribbon sewn down the outer seam
      for (const [bone, a, b, r] of [['thigh.' + s, hip.clone().add(V(0, -0.05, 0)), knee.clone().add(V(0, 0.02, 0)), 0.092], ['shin.' + s, knee.clone().add(V(0, -0.02, 0)), ankle.clone().add(V(0, 0.07, 0)), 0.078]]) {
        const g = new THREE.BoxGeometry(0.026, a.distanceTo(b), 0.008); g.translate(sx * r, (a.y + b.y) / 2, a.z); add(bone, g, RED, 'woven');
        seam(bone, a, b, out, r + 0.006, 0x7a161a, 6);
      }
      // big round felt shoes
      const shoe = lumpGeo(0.075, 0.055, 0.125, { detail: 2, amp: 0.04, seed: 3 }); shoe.translate(ankle.x, 0.05, ankle.z + 0.055); add('foot.' + s, shoe, BLACK);
      // arms: soft navy tubes, red felt cuffs, white cotton mittens, button joints at the shoulder
      const sh = joint('upper_arm.' + s), el = joint('forearm.' + s), wr = joint('hand.' + s);
      add('upper_arm.' + s, limbGeo(sh.clone().add(V(-sx * 0.01, 0.05, 0)), el.clone().add(V(0, -0.02, 0)), 0.062, 0.056), NAVY);
      add('forearm.' + s, limbGeo(el.clone().add(V(0, 0.04, 0)), wr.clone().add(V(0, 0.03, 0)), 0.056, 0.052), NAVY);
      const cuff = new THREE.TorusGeometry(0.058, 0.016, 8, 16); cuff.rotateX(Math.PI / 2); cuff.translate(wr.x, wr.y + 0.05, wr.z); add('forearm.' + s, cuff, RED);
      seam('upper_arm.' + s, sh, el, V(0, 0, -1), 0.068); seam('forearm.' + s, el, wr, V(0, 0, -1), 0.06, THREAD, 6);
      const mitt = lumpGeo(0.05, 0.068, 0.042, { detail: 2, amp: 0.05, seed: 9 }); mitt.translate(wr.x, wr.y - 0.035, wr.z + 0.005); add('hand.' + s, mitt, WHITE, 'woven');
      const thumb = lumpGeo(0.02, 0.032, 0.02, { detail: 1, amp: 0.05, seed: 2 }); thumb.translate(wr.x - sx * 0.035, wr.y - 0.02, wr.z + 0.025); add('hand.' + s, thumb, WHITE, 'woven');
      button('upper_arm.' + s, sh.clone().add(V(sx * 0.074, 0.0, 0)), out, 0.03, GOLD, 'metal');
      // a stitched corporal's chevron on each sleeve
      const ch = face(V(sh.x + sx * 0.072, sh.y - 0.12, sh.z), out);
      K('upper_arm.' + s).S.addLocal(ch, [-0.035, 0.02, 0.004], [0, -0.006, 0.004], GOLD, 0.008); K('upper_arm.' + s).S.addLocal(ch, [0, -0.006, 0.004], [0.035, 0.02, 0.004], GOLD, 0.008);
      K('upper_arm.' + s).S.addLocal(ch, [-0.035, -0.005, 0.004], [0, -0.03, 0.004], RED, 0.008); K('upper_arm.' + s).S.addLocal(ch, [0, -0.03, 0.004], [0.035, -0.005, 0.004], RED, 0.008);
    }
    // body: a soft, slightly pear-shaped coat with side seams, a red placket line, gold buttons, a cotton belt
    { const prof = [[0.0, 0.79], [0.205, 0.79], [0.215, 0.83], [0.2, 0.92], [0.185, 0.98], [0.0, 0.98]].map(([a, b]) => new THREE.Vector2(a, b)); const skirt = new THREE.LatheGeometry(prof, 22); skirt.scale(1, 1, 0.76); add('hips', skirt, NAVY); }
    const belt = new THREE.CylinderGeometry(0.205, 0.205, 0.055, 22, 1, true); belt.scale(1, 1, 0.76); belt.translate(0, 0.94, 0); add('hips', belt, WHITE, 'woven');
    const buckle = new THREE.BoxGeometry(0.06, 0.05, 0.015); buckle.translate(0, 0.94, 0.158); add('hips', buckle, GOLD, 'metal');
    { const prof = [[0.0, 0.9], [0.17, 0.9], [0.192, 0.98], [0.196, 1.1], [0.19, 1.22], [0.18, 1.3], [0.16, 1.37], [0.11, 1.41], [0.0, 1.43]].map(([a, b]) => new THREE.Vector2(a, b));
      const coat = new THREE.LatheGeometry(prof, 22); coat.scale(1, 1, 0.74); add('spine', coat, NAVY); }
    const collar = new THREE.CylinderGeometry(0.075, 0.085, 0.055, 16); collar.translate(0, 1.4, 0); add('chest', collar, RED);
    for (const sxs of [-1, 1]) { seam('spine', V(sxs * 0.19, 1.0, 0), V(sxs * 0.19, 1.2, 0), V(sxs, 0, 0), 0.005, THREAD, 5); seam('chest', V(sxs * 0.188, 1.22, 0), V(sxs * 0.16, 1.38, 0), V(sxs, 0, 0), 0.006, THREAD, 4); }
    const ck = K('chest'), sk2 = K('spine');
    for (let i = 0; i < 9; i++) { const y = 1.0 + i * 0.042, kk = y > 1.2 ? ck : sk2, z = 0.141 - (y > 1.22 ? (y - 1.22) * 0.12 : 0); kk.S.add(V(0.03, y, z), V(0.03, y + 0.024, z - 0.001), RED, 0.0055, V(0, 0, 1)); }
    for (let i = 0; i < 4; i++) { const y = 1.02 + i * 0.085, z = 0.143 - (y > 1.22 ? (y - 1.22) * 0.13 : 0); button(y > 1.2 ? 'chest' : 'spine', V(-0.004, y, z), V(0, 0.08, 1), 0.019, GOLD, 'metal'); }
    // the head
    const R = 0.205, hc = V(0, 1.625, 0.02);
    const { g: hg, seams } = headGeo(R, hc); add('head', hg, SKIN, 'woven');
    add('neck', limbGeo(V(0, 1.36, 0), V(0, 1.48, 0), 0.055, 0.055, 10), SKIN, 'woven');
    const hk = K('head');
    for (const sa of seams) {         // stitches along the visible panel seams (sides and back)
      for (let i = 2; i < 13; i++) { const l0 = -1.0 + i * 0.16, l1 = l0 + 0.09; const p = (l) => V(Math.sin(sa) * Math.cos(l) * R * 1.05 * 0.985, Math.sin(l) * R * 0.94, Math.cos(sa) * Math.cos(l) * R * 0.98 * 0.985).add(hc); hk.S.add(p(l0), p(l1), 0xc08a68, 0.0045, p(l0).sub(hc).normalize()); }
    }
    for (const e of [-1, 1]) {
      // eyes: a felt white, a black button slightly to the inside and up (friendly), a tiny catchlight bead
      const ep = V(e * 0.074, 1.648, 0), n = V(e * 0.36, 0.06, 1).normalize(); ep.z = hc.z + Math.sqrt(Math.max(0, R ** 2 - (ep.x / 1.05) ** 2 - ((ep.y - hc.y) / 0.94) ** 2)) * 0.98 + 0.002;
      const wf = slab(ellipse(0, 0, 0.041, 0.047, 18), null, 0.008, { bevel: 0.003, bevelSeg: 1, smoothNormals: true }); wf.applyMatrix4(face(ep, n)); hk.B.felt.add(wf, null, 0xfbf6ec, {});
      button('head', ep.clone().addScaledVector(n, 0.006).add(V(-e * 0.008, 0.004, 0)), n, 0.026, BLACK, 'paint');
      hk.B.bead.add(new THREE.SphereGeometry(0.006, 6, 4), M(ep.clone().addScaledVector(n, 0.02).add(V(-e * 0.0, 0.016, 0)).toArray()), 0xffffff);
      // embroidered brows, slightly raised (curious), satin-stitched
      const bF = face(ep.clone().add(V(0, 0.062, -0.004)), n);
      hk.S.satin(bF, [[-0.03, -0.004], [0, 0.008], [0.03, 0.0]], 0.002, 0x4a2c1c, { width: 0.012, spacing: 0.006, r: 0.004, slant: 0.2 });
      // felt cheeks
      const cp = V(e * 0.112, 1.572, 0); cp.z = hc.z + Math.sqrt(Math.max(0, R ** 2 - (cp.x / 1.05) ** 2 - ((cp.y - hc.y) / 0.94) ** 2)) * 0.98 + 0.002;
      const cg = slab(circle(0, 0, 0.034, 16), null, 0.006, { bevel: 0.002, bevelSeg: 1, smoothNormals: true }); cg.applyMatrix4(face(cp, V(e * 0.6, -0.05, 1))); hk.B.felt.add(cg, null, CHEEK, {});
      // ears: little stuffed half-moons, a stitched line inside
      const ear = pillowGeo(ellipse(0, 0, 0.04, 0.052, 14), 0.016, { rings: 3 }); ear.applyMatrix4(face(V(e * 0.212, 1.615, 0.0), V(e, 0, -0.15))); hk.B.woven.add(ear, null, SKIN, {});
    }
    // smile: backstitched in dark red floss, a wide gentle curve; a small stuffed nose
    let prev = null; for (let i = 0; i <= 10; i++) { const t = i / 10, a = (-0.5 + t) * 1.5, p = V(Math.sin(a) * 0.062, 1.548 - Math.cos(a) * 0.016 + 0.016, 0); p.z = hc.z + Math.sqrt(Math.max(0, R ** 2 - (p.x / 1.05) ** 2 - ((p.y - hc.y) / 0.94) ** 2)) * 0.98 * 1.02 + 0.004; if (prev) hk.S.add(prev, p, 0x8a2226, 0.0055, V(p.x, 0, 1).normalize()); prev = p; }
    const nose = lumpGeo(0.026, 0.021, 0.02, { detail: 2, amp: 0.03, seed: 5 }); nose.translate(0, 1.598, hc.z + R * 0.96); add('head', nose, 0xd6936c, 'woven');
    // hair: a cap of brown felt sewn over the back of the head (a separate panel, slightly proud), a few yarn curls at the temples
    { const hairG = new THREE.SphereGeometry(R * 1.035, 28, 14, Math.PI * 0.92, Math.PI * 1.16, 0.12, 1.1); hairG.deleteAttribute('uv');
      const hp = hairG.attributes.position; for (let i = 0; i < hp.count; i++) { hp.setX(i, hp.getX(i) * 1.05); hp.setY(i, hp.getY(i) * 0.94); hp.setZ(i, hp.getZ(i) * 0.98); }
      hairG.translate(hc.x, hc.y + 0.004, hc.z); add('head', hairG, HAIR);
      for (const e of [-1, 1]) for (let i = 0; i < 3; i++) { const l = new THREE.TorusGeometry(0.016, 0.0075, 6, 10); const ax = e * (R * 0.97), y = 1.69 - i * 0.032; l.rotateY(Math.PI / 2); l.translate(ax * (1.0 - i * 0.02) * 1.03, y, hc.z + 0.07 - i * 0.012); add('head', l, HAIR, 'woven'); } }
    // the cap: black felt band, a stuffed white crown tipped back a little, a pillowy visor, a gold button
    const band = new THREE.CylinderGeometry(0.196, 0.19, 0.07, 26, 1); band.translate(0, 1.77, hc.z - 0.01); add('head', band, BLACK);
    const crown = pillowGeo(circle(0, 0, 0.25, 32), 0.07, { rings: 4, flat: 3, under: 0.35 }); crown.applyMatrix4(M([0, 1.835, hc.z - 0.025], [-Math.PI / 2 - 0.08, 0, 0])); hk.B.felt.add(crown, null, WHITE, {});
    const vis = pillowGeo([[-0.15, 0], [0.15, 0], [0.12, 0.08], [0, 0.11], [-0.12, 0.08]], 0.016, { rings: 3 }); vis.applyMatrix4(M([0, 1.745, hc.z + 0.17], [Math.PI / 2 - 0.42, 0, 0])); hk.B.felt.add(vis, null, BLACK, {});
    button('head', V(0, 1.785, hc.z + 0.198), V(0, 0.1, 1), 0.024, GOLD, 'metal');
    const bk = K('head'); for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; bk.S.add(V(Math.sin(a) * 0.198, 1.765, hc.z - 0.01 + Math.cos(a) * 0.192), V(Math.sin(a + 0.13) * 0.198, 1.765, hc.z - 0.01 + Math.cos(a + 0.13) * 0.192), RED, 0.006, V(Math.sin(a), 0, Math.cos(a))); }

  });
  // one skinned mesh per material instead of a mesh per bone: every part is rigidly weighted to its bone
  // (it moves exactly like a jointed puppet, but costs ~7 draw calls instead of ~80 in every pass)
  let skinned = null; rig.root.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  const skel = skinned.skeleton, inv = skinned.matrixWorld.clone().invert(), key = (n) => n.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const groups = {};
  for (const [bone, kk] of Object.entries(kits)) {
    const bi = skel.bones.indexOf(boneMap[key(bone)]);
    const push = (name, g) => { if (!g) return; g.applyMatrix4(inv); const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); (groups[name] = groups[name] || []).push(g); };
    for (const b of ['felt', 'woven', 'paint', 'metal', 'bead']) push(b, kk.B[b].build());
    push('stitch', kk.S.geometry());
  }
  const stitchMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(1, 1, 1) });
  for (const [name, list] of Object.entries(groups)) {
    const m = new THREE.SkinnedMesh(mergeGeometries(list), name === 'stitch' ? stitchMat : mats[name]);
    m.castShadow = name !== 'stitch'; m.receiveShadow = true; m.frustumCulled = false; m.name = 'puppet-' + name;
    skinned.parent.add(m); m.position.copy(skinned.position); m.quaternion.copy(skinned.quaternion); m.scale.copy(skinned.scale);
    m.bind(skel, skinned.bindMatrix);
  }
  // a small additive performance on top of the walk: the big head bobs with the step and tilts, a little curious
  const head = rig.root.getObjectByProperty('isBone', true) && Object.values(rig.root.children).length ? null : null; void head;
  let headBone = null, neckBone = null; rig.root.traverse((o) => { if (o.isBone && /^head$/i.test(o.name)) headBone = o; if (o.isBone && /^neck$/i.test(o.name)) neckBone = o; });
  rig.afterPose = (phase) => {
    if (!headBone) return;
    const a = phase * Math.PI * 2;
    headBone.rotateZ(0.07 + 0.045 * Math.sin(a));
    headBone.rotateX(0.03 * Math.sin(a * 2 + 0.6) - 0.04);
    if (neckBone) neckBone.rotateY(0.06 * Math.sin(a + 1.0));
  };
  return rig;
}
