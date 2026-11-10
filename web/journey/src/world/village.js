// Toy Town at street level: arrival, free look, hotspots and the small surprises.
// It uses the diorama host's set as-is (no geometry changes) and adds two story props:
// a toy drop-off box beside the toy shop and presents that appear under the tree after an action.
//
// Entry contract (see docs/JOURNEY_PROTOTYPE.md):
//   village.enter(handoff)  handoff = { kind: 'pose', pose } from a 3D map, or
//                                     { kind: 'screen' } from a 2D map (we descend from the sky)
import { B, V, clamp, smooth, patch } from './diorama.js';

export const VILLAGE_POSES = {
  arrival: { pos: B(-7.6, -16.4, 5.2), look: B(2.4, 0.0, 4.15), fov: 53 },
  overview: { pos: B(-3.5, -14.5, 3.4), look: B(3.0, -1.5, 1.4), fov: 55 },
  sky: { pos: B(12, -48, 30), look: B(3, -6, 2), fov: 50 },          // where a 2D map hands over
  window: { pos: B(2.1, -5.3, 1.45), look: B(3.1, -0.8, 1.15), fov: 50 },
  street: { pos: B(0.5, -8.5, 2.2), look: B(3.5, -1.8, 0.8), fov: 55 },
  tree: { pos: B(-6.2, -7.2, 2.0), look: B(-3.7, -1.4, 1.5), fov: 50 },
  lamp: { pos: B(-7.8, -7.8, 2.3), look: B(-5.0, -2.3, 2.2), fov: 50 },
};
export const ANCHORS = {
  dropBox: B(2.45, -1.62, 0), wagon: B(7.6, -2.6, 0), shopWindow: B(1.65, -1.0, 1.15),
  xmasTree: B(-3.7, -1.4, 0), lampWest: B(-5.0, -2.3, 0), underTree: B(-3.2, -2.2, 0),
};
const EXPLORE = { minDistance: 3, maxDistance: 22, maxPolar: 84, minPolar: 30, box: [-9, 13, 0.4, 13] };

export function createVillage(host, pins, { onHotspot, allowPin = () => true }) {
  const T = host.THREE;
  const props = new T.Group(); host.scene.add(props);

  // ---------------- story prop: the toy drop-off box (painted wood, a hand-lettered sign)
  const dropBox = new T.Group();
  {
    const wood = new T.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.7 }); patch(wood, 'clay', {}, true);
    const trim = new T.MeshStandardMaterial({ color: 0xf1e3c6, roughness: 0.6 }); patch(trim, 'clay', {}, true);
    const W = 0.62, D = 0.44, Hh = 0.42, t = 0.035;
    const add = (g, m, x, y, z) => { const me = new T.Mesh(g, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; dropBox.add(me); return me; };
    add(new T.BoxGeometry(W, t, D), wood, 0, t / 2, 0);
    add(new T.BoxGeometry(W, Hh, t), wood, 0, Hh / 2, D / 2 - t / 2);
    add(new T.BoxGeometry(W, Hh, t), wood, 0, Hh / 2, -D / 2 + t / 2);
    add(new T.BoxGeometry(t, Hh, D), wood, W / 2 - t / 2, Hh / 2, 0);
    add(new T.BoxGeometry(t, Hh, D), wood, -W / 2 + t / 2, Hh / 2, 0);
    add(new T.BoxGeometry(W + 0.04, 0.04, D + 0.04), trim, 0, Hh, 0).scale.set(1, 1, 1);
    add(new T.BoxGeometry(W - 2 * t, 0.16, D - 2 * t), new T.MeshStandardMaterial({ color: 0x5a3d2c, roughness: 0.9 }), 0, 0.1, 0);   // toys already inside
    // sign on a little post
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f3e7cf'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#b8322a'; g.lineWidth = 14; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = '#7a1e18'; g.textAlign = 'center'; g.font = 'bold 82px Georgia, serif'; g.fillText('TOY', 256, 108);
    g.font = 'bold 64px Georgia, serif'; g.fillText('DROP-OFF', 256, 186);
    g.fillStyle = '#c9952e'; g.font = '40px Georgia, serif'; g.fillText('★  new, unwrapped  ★', 256, 232);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const sign = add(new T.PlaneGeometry(0.56, 0.28), new T.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 0.74, -D / 2 - 0.012);
    sign.rotation.y = Math.PI;
    add(new T.CylinderGeometry(0.018, 0.018, 0.66), trim, 0, 0.33 + 0.05, -D / 2 - 0.03);
    const snowCap = new T.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.8 }); patch(snowCap, 'snow', {}, true);
    add(new T.BoxGeometry(0.6, 0.025, 0.05), snowCap, 0, 0.885, -D / 2 - 0.012);
  }
  const gy = host.groundAt(ANCHORS.dropBox.x, ANCHORS.dropBox.z, 1.0);
  dropBox.position.set(ANCHORS.dropBox.x, gy, ANCHORS.dropBox.z);
  dropBox.rotation.y = Math.PI + 0.12;              // sign faces the street
  props.add(dropBox);
  const dropTop = dropBox.position.clone().setY(gy + 0.3);   // where a dropped-off toy rests

  // ---------------- thank-you presents under the little tree (appear after an action)
  const thanks = [];
  const palette = [0xc8342c, 0x2f6f9e, 0xd9a73a, 0x3f8a5a, 0xc96a92];
  function addPresent() {
    const i = thanks.length; if (i > 7) return;
    const s = 0.22 + 0.06 * ((i * 37) % 3);
    const box = new T.Mesh(new T.BoxGeometry(s, s * 0.8, s), new T.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.6 }));
    const rib = new T.Mesh(new T.BoxGeometry(s * 1.02, s * 0.82, s * 0.18), new T.MeshStandardMaterial({ color: 0xf2d27a, roughness: 0.4, metalness: 0.2 }));
    box.add(rib); patch(box.material, 'clay', {}, true);
    const a = i * 2.4, r = 0.55 + 0.12 * (i % 2);
    const p = ANCHORS.xmasTree.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r + 0.35));
    box.position.set(p.x, host.groundAt(p.x, p.z, 0.8) + s * 0.4, p.z); box.rotation.y = a;
    box.castShadow = box.receiveShadow = true; box.scale.setScalar(0.01);
    props.add(box); thanks.push({ box, t0: host.time });
  }

  // ---------------- small surprises
  let twinkle = 0, lampOff = false;
  const fairy = [];
  host.scene.traverse((o) => { if (o.isMesh && o.material && /FairyLight|StarGlow|Bulb/.test(o.material.name) && !fairy.includes(o.material)) fairy.push(o.material); });
  fairy.forEach((m) => { m.userData.base = m.emissiveIntensity; });
  function celebrate(k = 1) { twinkle = Math.max(twinkle, k); }
  function toggleLamp() {
    lampOff = !lampOff;
    for (const l of Object.values(host.lamps)) l.intensity = lampOff ? 0.0 : l.userData.base;
    return !lampOff;
  }
  host.onUpdate((dt, t) => {
    twinkle = Math.max(0, twinkle - dt * 0.45);
    const w = smooth(twinkle);
    fairy.forEach((m, i) => { m.emissiveIntensity = m.userData.base * (1 + w * (1.2 + 0.8 * Math.sin(t * 9 + i * 1.7))); });
    host.treeGlow.intensity = host.treeGlow.userData.base * (1 + 0.8 * w);
    for (const th of thanks) { const k = clamp((t - th.t0) / 0.6); th.box.scale.setScalar(0.01 + 0.99 * (1 - Math.pow(1 - k, 3)) * (1 + 0.12 * Math.sin(k * Math.PI))); }
  });

  // ---------------- hotspots
  const HOT = {
    shop: { label: 'Toy shop window', hint: 'see the toys', icon: '✦', pos: () => ANCHORS.shopWindow.clone().add(V(0, 0.72, 0)) },
    tree: { label: 'Christmas tree', hint: 'make it twinkle', icon: '✶', pos: () => ANCHORS.xmasTree.clone().add(V(0, 2.75, 0)) },
    lamp: { label: 'Lamppost', hint: 'switch it', icon: '✺', pos: () => ANCHORS.lampWest.clone().add(V(0, 3.45, 0)) },
  };
  const owned = new Map();            // pin id -> extra condition (the journey can register its own pins here)
  const registerPin = (id, ok = () => true) => owned.set(id, ok);
  let pinsOn = false;
  function showPins(v) { pinsOn = v; for (const [id, ok] of owned) pins.setVisible(id, v && ok() && allowPin(id)); }
  for (const [id, h] of Object.entries(HOT)) { pins.add({ id, label: h.label, hint: h.hint, icon: h.icon, getPos: h.pos, onSelect: (k) => onHotspot(k) }); registerPin(id); }
  showPins(false);

  let mounted = false;
  async function enter(handoff = { kind: 'pose' }, { reducedMotion } = {}) {
    mounted = true;
    host.explore(null);
    if (handoff.kind === 'screen') {           // from a 2D map: start in the sky above town and settle
      host.setPose(VILLAGE_POSES.sky);
      await host.tweenTo(VILLAGE_POSES.arrival, reducedMotion ? 0 : 2.6);
    } else if (handoff.pose) {
      host.setPose(handoff.pose);
      if (handoff.pose !== VILLAGE_POSES.arrival) await host.tweenTo(VILLAGE_POSES.arrival, reducedMotion ? 0 : 1.2);
    } else host.setPose(VILLAGE_POSES.arrival);
    if (!mounted) return;
    await host.tweenTo(VILLAGE_POSES.overview, reducedMotion ? 0 : 1.6);
    freeLook();
  }
  function freeLook() { showPins(true); host.explore(EXPLORE); }
  function leave() { mounted = false; showPins(false); host.explore(null); }
  async function focus(poseName, { reducedMotion } = {}) {
    host.explore(null);
    await host.tweenTo(VILLAGE_POSES[poseName], reducedMotion ? 0 : 1.4);
  }

  return { enter, leave, focus, freeLook, showPins, registerPin, refreshPins: () => showPins(pinsOn), celebrate, toggleLamp, addPresent, poses: VILLAGE_POSES, anchors: ANCHORS, dropBox, dropTop, pins, get mounted() { return mounted; } };
}
