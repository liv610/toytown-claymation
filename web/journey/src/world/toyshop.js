// The toy shop interior: a small room set you step into from the shop window.
// Built here from simple clay shapes (no new Blender assets) and placed away from the board so it
// never collides with the village. Six toys, each with a short "come alive" trick when tapped.
//
//   const shop = createToyShop(host, pins, { windowImage, onToy, storybook })
// storybook (the felt look): a builder for the storybook hall (textile/src/storyshop.js). The room below is replaced
// by that much bigger felt hall; the six interactive toys, their tricks, pins and cards stay exactly the same, set
// out on the hall's display table and stand (and drawn a little larger so they read in the big room).
//   await shop.enter() / shop.leave() / shop.focus(id) / shop.overview()
import { V, clamp, smooth, ramp, patch } from './diorama.js';
import { TOYS } from '../actions/catalog.js';

export function createToyShop(host, pins, { windowImage, onToy, storybook = null }) {
  const T = host.THREE;
  const O = V(600, 0, 0);                       // room origin, far off the board
  const room = new T.Group(); room.position.copy(O); host.scene.add(room);
  const mat = (color, kind = 'clay', opts = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: 0.75, ...opts }); patch(m, kind, {}, true); return m; };
  const mesh = (g, m, x = 0, y = 0, z = 0, parent = room) => { const me = new T.Mesh(g, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; parent.add(me); return me; };
  const W = 8, D = 6, H = 3.3;
  const story = storybook ? storybook() : null;
  if (story) console.debug('storybook shop', story.triangles, 'triangles', Math.round(story.buildMs), 'ms');
  const wood = mat(0xa86a3e, 'wood'), dark = mat(0x5b3720, 'wood');
  const twinkles = [];
  let bell = null, tableTop = 0.82, shelfY = [1.15, 1.7, 2.25];
  if (story) {
    room.add(story.group);
    for (const L of story.lights) {
      const p = new T.PointLight(L.color, L.intensity, L.distance, 1.2); p.position.set(O.x + L.pos[0], L.pos[1], O.z + L.pos[2]);
      p.visible = false; host.scene.add(p); host.roomLights.push(p);
    }
    tableTop = story.anchors.tableTop;
  } else {

  // ---------------- the room: plank floor, cream plaster above a blue wainscot, beams, window
  const planks = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#8a5a36', '#7d5230', '#93613b', '#84552f'][i % 4]; g.fillRect(0, i * 64, 512, 64); g.fillStyle = 'rgba(40,20,8,0.5)'; g.fillRect(0, i * 64, 512, 3); g.fillRect((i * 173) % 512, i * 64, 3, 64); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 1.5); return t;
  })();
  const floor = mesh(new T.PlaneGeometry(W, D), new T.MeshStandardMaterial({ map: planks, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2;
  const plaster = mat(0xf6e8cf), wains = mat(0x3d5f93), trim = mat(0xfaf2e2), sage = mat(0x7d9c84);
  mesh(new T.BoxGeometry(W, H, 0.1), plaster, 0, H / 2, -D / 2);                          // back wall
  mesh(new T.BoxGeometry(0.1, H, D), plaster, -W / 2, H / 2, 0);                          // side walls
  mesh(new T.BoxGeometry(0.1, H, D), plaster, W / 2, H / 2, 0);
  for (const [x, z, w, d] of [[0, -D / 2 + 0.07, W, 0.04], [-W / 2 + 0.07, 0, 0.04, D], [W / 2 - 0.07, 0, 0.04, D]]) {
    mesh(new T.BoxGeometry(w, 1.0, d), wains, x, 0.5, z); mesh(new T.BoxGeometry(w + 0.01, 0.07, d + 0.04), trim, x, 1.02, z);
  }
  mesh(new T.BoxGeometry(W, 0.1, D), plaster, 0, H, 0);                                    // ceiling + beams
  for (let i = -2; i <= 2; i++) mesh(new T.BoxGeometry(0.16, 0.16, D), dark, i * 1.7, H - 0.12, 0);
  // front wall with the shop window looking back out at the snowy street
  mesh(new T.BoxGeometry(W, H, 0.1), plaster, 0, H / 2, D / 2).visible = false;            // (behind camera; casts nothing)
  const winTex = new T.TextureLoader().load(windowImage); winTex.colorSpace = T.SRGBColorSpace;
  const win = mesh(new T.PlaneGeometry(2.4, 1.35), new T.MeshBasicMaterial({ map: winTex, toneMapped: false, color: 0xbfb0a0 }), -W / 2 + 0.06, 1.75, -0.6);
  win.rotation.y = Math.PI / 2; win.castShadow = false;
  for (const [y, h, w] of [[1.75, 1.45, 0.08], [1.75, 0.08, 2.5]]) { const f = mesh(new T.BoxGeometry(0.06, h, w), trim, -W / 2 + 0.08, y, -0.6); if (w > 1) { f.position.y = 1.75 + 0.7; mesh(new T.BoxGeometry(0.06, 0.08, 2.5), trim, -W / 2 + 0.08, 1.05, -0.6); } }
  mesh(new T.BoxGeometry(0.06, 1.45, 0.08), trim, -W / 2 + 0.08, 1.75, -0.6 - 1.24); mesh(new T.BoxGeometry(0.06, 1.45, 0.08), trim, -W / 2 + 0.08, 1.75, -0.6 + 1.24);

  // ---------------- furniture: back shelves, centre display table, counter, a little tree
  shelfY = [1.15, 1.7, 2.25];
  mesh(new T.BoxGeometry(4.6, 2.5, 0.06), sage, 0.3, 1.4, -D / 2 + 0.18);
  for (const y of shelfY) { mesh(new T.BoxGeometry(4.7, 0.06, 0.5), wood, 0.3, y, -D / 2 + 0.4); mesh(new T.BoxGeometry(4.7, 0.04, 0.04), trim, 0.3, y + 0.04, -D / 2 + 0.66); }
  for (const x of [-2.0, 2.6]) mesh(new T.BoxGeometry(0.08, 2.5, 0.5), dark, x, 1.4, -D / 2 + 0.4);
  tableTop = 0.82;
  mesh(new T.CylinderGeometry(1.05, 1.05, 0.08, 40), wood, 0, tableTop - 0.04, -0.6);
  mesh(new T.CylinderGeometry(0.16, 0.22, tableTop - 0.08, 16), dark, 0, (tableTop - 0.08) / 2, -0.6);
  mesh(new T.CylinderGeometry(0.5, 0.5, 0.04, 24), dark, 0, 0.02, -0.6);
  mesh(new T.BoxGeometry(0.7, 1.0, 2.2), wood, W / 2 - 0.6, 0.5, -0.2);                  // counter
  mesh(new T.BoxGeometry(0.78, 0.06, 2.3), dark, W / 2 - 0.6, 1.03, -0.2);
  bell = mesh(new T.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9a73a, 'clay', { metalness: 0.5, roughness: 0.35 }), W / 2 - 0.6, 1.06, 0.4);
  const treeG = new T.Group(); treeG.position.set(-W / 2 + 0.8, 0, -D / 2 + 0.8); room.add(treeG);
  const needles = mat(0x2f6a45);
  for (let i = 0; i < 4; i++) mesh(new T.ConeGeometry(0.62 - i * 0.13, 0.62, 14), needles, 0, 0.55 + i * 0.38, 0, treeG);
  for (let i = 0; i < 22; i++) {
    const a = i * 2.4, h = 0.45 + (i / 22) * 1.35, r = 0.58 - (h - 0.45) * 0.36;
    const b = mesh(new T.SphereGeometry(0.03, 8, 6), new T.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 3 }), Math.cos(a) * r, h, Math.sin(a) * r, treeG);
    b.castShadow = false; twinkles.push(b);
  }
  mesh(new T.OctahedronGeometry(0.09), new T.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 4 }), 0, 2.15, 0, treeG);
  // garland of greenery and bulbs along the shelf top
  for (let i = 0; i < 26; i++) {
    const x = -2.0 + i * 0.18, y = 2.62 - 0.08 * Math.sin((i % 13) / 12 * Math.PI);
    mesh(new T.IcosahedronGeometry(0.07, 0), needles, x + 0.3, y, -D / 2 + 0.3).castShadow = false;
    if (i % 3 === 0) { const b = mesh(new T.SphereGeometry(0.025, 8, 6), new T.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa850, emissiveIntensity: 3 }), x + 0.3, y - 0.07, -D / 2 + 0.36); b.castShadow = false; twinkles.push(b); }
  }
  // hanging lamps (+ the room's own lights, off until we step inside)
  for (const x of [-1.6, 1.6]) {
    mesh(new T.CylinderGeometry(0.01, 0.01, 0.6), dark, x, H - 0.3, -0.4);
    mesh(new T.ConeGeometry(0.28, 0.24, 20, 1, true), mat(0x2f5f4a, 'clay', { side: T.DoubleSide }), x, H - 0.66, -0.4);
    mesh(new T.SphereGeometry(0.08, 12, 8), new T.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 5 }), x, H - 0.76, -0.4).castShadow = false;
    const L = new T.PointLight(0xffc488, 11, 10, 1.5); L.position.set(O.x + x, H - 0.85, O.z - 0.4); L.visible = false; host.scene.add(L); host.roomLights.push(L);
  }
  const fill = new T.PointLight(0xffd8b0, 6, 11, 1.3); fill.position.set(O.x, 1.6, O.z + 2.4); fill.visible = false; host.scene.add(fill); host.roomLights.push(fill);
  const glowWin = new T.PointLight(0xa8b8ff, 1.2, 4, 2); glowWin.position.set(O.x - W / 2 + 0.6, 1.7, O.z - 0.6); glowWin.visible = false; host.scene.add(glowWin); host.roomLights.push(glowWin);
  }

  // ---------------- the toys (each: build, idle, play)
  const red = mat(0xc8342c), blue = mat(0x2f5f9e), yellow = mat(0xe0b040), green = mat(0x3f8a5a), cream = mat(0xf3e7cf), black = mat(0x2a2220), gold = mat(0xd9a73a, 'clay', { metalness: 0.4, roughness: 0.4 });
  const felt = mat(0x9a6538, 'felt'), feltDark = mat(0x6e4426, 'felt');
  const wheel = (p, r, x, y, z) => { const w = mesh(new T.CylinderGeometry(r, r, 0.03, 18), black, x, y, z, p); w.rotation.x = Math.PI / 2; return w; };
  const toys = {};
  // in the storybook hall: the table toys keep their places relative to the table, the shelf toys go on the stand
  const A = story && story.anchors;
  const spot = (id, x, y, z) => {
    if (!A) return [x, y, z];
    const tb = A.table, st = A.stand, ti = A.tiers;
    return { train: [tb[0] - 0.55, A.tableTop, tb[2] + 0.05], top: [tb[0] + 0.45, A.tableTop, tb[2] - 0.55], truck: [tb[0] + 0.5, A.tableTop, tb[2] + 0.45],
      blocks: [st[0] + 0.25, ti[0], st[2] + 0.02], teddy: [st[0] - 0.25, ti[1], st[2] - 0.12], drum: [st[0] + 0.05, ti[2], st[2] - 0.24] }[id];
  };
  const place = (id, g, x, y, z, ry = 0) => { g.position.set(...spot(id, x, y, z)); g.rotation.y = ry; if (story) g.scale.setScalar(1.5); room.add(g); toys[id] = { id, g, home: g.position.clone(), play: 0, t0: -9 }; return toys[id]; };

  // 1. wooden train on a little oval track (display table)
  {
    const g = new T.Group(), loco = new T.Group(); g.add(loco);
    mesh(new T.BoxGeometry(0.26, 0.1, 0.12), red, 0, 0.08, 0, loco);
    const boiler = mesh(new T.CylinderGeometry(0.05, 0.05, 0.16, 16), blue, 0.05, 0.16, 0, loco); boiler.rotation.z = Math.PI / 2;
    mesh(new T.BoxGeometry(0.09, 0.12, 0.12), yellow, -0.08, 0.2, 0, loco);
    mesh(new T.CylinderGeometry(0.018, 0.024, 0.07, 10), black, 0.11, 0.25, 0, loco);
    for (const x of [-0.08, 0.08]) for (const z of [-0.065, 0.065]) wheel(loco, 0.04, x, 0.04, z);
    const car = new T.Group(); car.position.x = -0.3; loco.add(car);
    mesh(new T.BoxGeometry(0.2, 0.09, 0.12), green, 0, 0.08, 0, car);
    for (const x of [-0.06, 0.06]) for (const z of [-0.065, 0.065]) wheel(car, 0.035, x, 0.04, z);
    const track = mesh(new T.TorusGeometry(0.34, 0.012, 6, 48), dark, 0, 0.005, 0, g); track.rotation.x = Math.PI / 2; track.scale.set(1.25, 1, 1);
    const t = place('train', g, -0.5, tableTop, -0.55); t.loco = loco;
    t.idle = () => {};
    t.anim = (k) => {
      const a = Math.PI / 2 + (k > 0 ? smooth(k) * Math.PI * 4 : 0);   // front of the oval; two laps, then home
      loco.position.set(Math.cos(a) * 0.425, 0, Math.sin(a) * 0.34);
      loco.rotation.y = -Math.atan2(Math.cos(a) * 0.34, -Math.sin(a) * 0.425);
    };
    t.anim(0);
  }
  // 2. spinning top (display table)
  {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const prof = [[0, 0], [0.02, 0.01], [0.11, 0.07], [0.12, 0.09], [0.08, 0.13], [0.02, 0.15], [0.015, 0.22], [0, 0.22]].map(([x, y]) => new T.Vector2(x, y));
    const stripes = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = ['#c8342c', '#f3e7cf', '#2f8a7a', '#e0b040'][i % 4]; x.fillRect(i * 32, 0, 32, 64); } const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
    mesh(new T.LatheGeometry(prof, 32), new T.MeshStandardMaterial({ map: stripes, roughness: 0.5 }), 0, 0, 0, body);
    const t = place('top', g, 0.35, tableTop, -1.15);
    t.idle = (tt) => { body.rotation.y = tt * 0.3; };
    t.anim = (k, tt) => { const s = k > 0 ? Math.sin(k * Math.PI) : 0; body.rotation.y = tt * 0.3 + smooth(k) * 60; body.rotation.z = 0.12 * s * Math.sin(tt * 9); body.position.x = 0.06 * s * Math.cos(tt * 4); body.position.z = 0.06 * s * Math.sin(tt * 4); };
  }
  // 3. teddy bear (middle shelf)
  {
    const g = new T.Group(), sph = (r, m, x, y, z, p = g) => mesh(new T.SphereGeometry(r, 18, 14), m, x, y, z, p);
    sph(0.13, felt, 0, 0.14, 0).scale.set(1, 1.1, 0.9);
    const head = new T.Group(); head.position.set(0, 0.33, 0.01); g.add(head);
    sph(0.1, felt, 0, 0, 0, head); sph(0.04, felt, -0.075, 0.075, 0, head); sph(0.04, felt, 0.075, 0.075, 0, head);
    sph(0.045, cream, 0, -0.02, 0.085, head); sph(0.015, black, 0, -0.005, 0.125, head); sph(0.012, black, -0.035, 0.03, 0.09, head); sph(0.012, black, 0.035, 0.03, 0.09, head);
    const armL = new T.Group(); armL.position.set(-0.12, 0.2, 0); g.add(armL); sph(0.045, feltDark, -0.03, -0.06, 0.02, armL).scale.set(1, 1.6, 1);
    const armR = new T.Group(); armR.position.set(0.12, 0.2, 0); g.add(armR); sph(0.045, feltDark, 0.03, -0.06, 0.02, armR).scale.set(1, 1.6, 1);
    sph(0.05, feltDark, -0.07, 0.03, 0.07).scale.set(1, 0.8, 1.4); sph(0.05, feltDark, 0.07, 0.03, 0.07).scale.set(1, 0.8, 1.4);
    const bow = mesh(new T.TorusGeometry(0.025, 0.012, 6, 12), red, 0, 0.255, 0.085, g); bow.scale.set(1.6, 1, 1);
    const t = place('teddy', g, -0.9, shelfY[1] + 0.03, -D / 2 + 0.42);
    t.idle = (tt) => { head.rotation.z = 0.05 * Math.sin(tt * 0.8); };
    t.anim = (k, tt) => { const w = k > 0 ? Math.sin(k * Math.PI) : 0; armR.rotation.z = 2.3 * w + 0.35 * w * Math.sin(tt * 12); g.position.y = t.home.y + 0.05 * w * Math.abs(Math.sin(tt * 6)); head.rotation.z = 0.25 * w * Math.sin(tt * 6); };
  }
  // 4. letter blocks (bottom shelf)
  {
    const g = new T.Group(), letters = ['T', 'O', 'Y', 'S', '★', '!'], cols = ['#c8342c', '#2f5f9e', '#e0b040', '#3f8a5a', '#c96a92', '#e07a30'];
    const blocks = letters.map((L, i) => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#f3e7cf'; x.fillRect(0, 0, 128, 128); x.strokeStyle = cols[i]; x.lineWidth = 12; x.strokeRect(8, 8, 112, 112);
      x.fillStyle = cols[i]; x.font = 'bold 84px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(L, 64, 70);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      const b = mesh(new T.BoxGeometry(0.11, 0.11, 0.11), new T.MeshStandardMaterial({ map: t, roughness: 0.7 }), 0, 0, 0, g);
      return b;
    });
    const row = (i) => V(-0.3 + i * 0.12, 0.055, 0), pyr = (i) => [V(-0.12, 0.055, 0), V(0, 0.055, 0), V(0.12, 0.055, 0), V(-0.06, 0.165, 0), V(0.06, 0.165, 0), V(0, 0.275, 0)][i];
    const t = place('blocks', g, 0.7, shelfY[0] + 0.03, -D / 2 + 0.42);
    t.idle = () => {};
    t.anim = (k) => blocks.forEach((b, i) => {
      const kk = clamp(k * 1.6 - i * 0.1), up = k > 0 ? Math.sin(kk * Math.PI) * 0.18 : 0;
      const p = row(i).lerp(pyr(i), smooth(kk) * (k < 0.85 ? 1 : 1 - smooth((k - 0.85) / 0.15)));
      b.position.set(p.x, p.y + up, p.z); b.rotation.y = smooth(kk) * Math.PI * 2;
    });
    t.anim(0);
  }
  // 5. toy truck (display table)
  {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    mesh(new T.BoxGeometry(0.3, 0.05, 0.14), blue, 0, 0.06, 0, body);
    mesh(new T.BoxGeometry(0.1, 0.1, 0.13), red, 0.1, 0.13, 0, body);
    mesh(new T.BoxGeometry(0.03, 0.05, 0.11), mat(0xbfe0f0, 'clay', { roughness: 0.2 }), 0.15, 0.15, 0, body);
    mesh(new T.BoxGeometry(0.17, 0.06, 0.14), yellow, -0.06, 0.11, 0, body);
    const ws = [];
    for (const x of [-0.09, 0.1]) for (const z of [-0.075, 0.075]) ws.push(wheel(body, 0.035, x, 0.035, z));
    const t = place('truck', g, 0.5, tableTop, -0.3, 0.3);
    t.idle = () => {};
    t.anim = (k) => { const s = k > 0 ? Math.sin(k * Math.PI * 2) * 0.22 : 0; body.position.x = s; ws.forEach((w) => { w.rotation.y = s * 12; }); body.rotation.z = k > 0 ? 0.03 * Math.sin(k * 40) : 0; };
  }
  // 6. drum with sticks (top shelf)
  {
    const g = new T.Group();
    const shell = mesh(new T.CylinderGeometry(0.12, 0.12, 0.14, 28), red, 0, 0.07, 0, g);
    mesh(new T.CylinderGeometry(0.125, 0.125, 0.02, 28), gold, 0, 0.005, 0, g); mesh(new T.CylinderGeometry(0.125, 0.125, 0.02, 28), gold, 0, 0.135, 0, g);
    const skin = mesh(new T.CylinderGeometry(0.115, 0.115, 0.005, 28), cream, 0, 0.145, 0, g);
    const sticks = [-1, 1].map((sg) => { const s = new T.Group(); s.position.set(0.05 * sg, 0.2, 0.06); g.add(s); const st = mesh(new T.CylinderGeometry(0.006, 0.006, 0.18, 6), wood, 0, 0, 0, s); st.rotation.z = 0.9 * sg; st.position.x = 0.06 * sg; mesh(new T.SphereGeometry(0.014, 8, 6), cream, -0.0, -0.06, 0, s); return s; });
    const t = place('drum', g, 0.15, shelfY[2] + 0.03, -D / 2 + 0.42);
    t.idle = () => {};
    t.anim = (k, tt) => { const on = k > 0 && k < 1; sticks.forEach((s, i) => { s.rotation.x = on ? -0.5 * Math.max(0, Math.sin(tt * 14 + i * Math.PI)) : 0; }); const hit = on ? Math.max(0, Math.sin(tt * 14)) : 0; shell.scale.set(1 + 0.04 * hit, 1 - 0.05 * hit, 1 + 0.04 * hit); skin.position.y = 0.145 - 0.01 * hit; };
  }

  // ---------------- interaction
  const PLAY = 3.2;
  host.onUpdate((dt, tt) => {
    twinkles.forEach((b, i) => { b.material.emissiveIntensity = 2.2 + 1.4 * Math.sin(tt * 2.2 + i * 1.3); });
    for (const t of Object.values(toys)) {
      const k = clamp((tt - t.t0) / PLAY);
      if (k < 1) t.anim(k, tt); else if (t.played) { t.anim(0, tt); t.played = false; }
      t.idle && t.idle(tt);
    }
    if (bell) bell.rotation.z = 0.0;
    if (story && mounted) story.update(tt);
  });
  function play(id) { const t = toys[id]; t.t0 = host.time; t.played = true; }
  const pinPos = (id) => () => { const p = (id === 'train' ? toys.train.loco : toys[id].g).getWorldPosition(V()); return p.add(V(0, id === 'teddy' ? 0.55 : id === 'blocks' ? 0.42 : id === 'drum' ? 0.36 : 0.4, 0)); };
  for (const toy of TOYS) pins.add({ id: 'toy-' + toy.id, label: toy.name, hint: `ages ${toy.ages}`, icon: '✦', getPos: pinPos(toy.id), onSelect: () => onToy(toy.id) });
  const showPins = (v) => { for (const toy of TOYS) pins.setVisible('toy-' + toy.id, v); };
  showPins(false);
  // tap a toy directly in the 3D view too
  let down = null;
  host.renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  host.renderer.domElement.addEventListener('pointerup', (e) => {
    if (!mounted || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const hit = host.pick(e.clientX, e.clientY, Object.values(toys).map((t) => t.g), 20);
    if (!hit) return;
    let o = hit.object; while (o && !Object.values(toys).some((t) => t.g === o)) o = o.parent;
    const t = Object.values(toys).find((x) => x.g === o); if (t) onToy(t.id);
  });

  const W2 = (x, y, z) => O.clone().add(V(x, y, z));
  const OVERVIEW = story ? { pos: W2(3.4, 3.1, 7.3), look: W2(-1.2, 2.6, -2.0), fov: 72 } : { pos: W2(1.0, 1.95, 2.75), look: W2(-0.15, 1.2, -1.7), fov: 60 };
  const EXPLORE = story ? { minDistance: 1.6, maxDistance: 9.5, minPolar: 40, maxPolar: 88, box: [O.x - 8.6, O.x + 8.6, O.z - 6.6, O.z + 7.4] }
    : { minDistance: 1.4, maxDistance: 3.6, minPolar: 45, maxPolar: 88, box: [O.x - 2.5, O.x + 2.5, O.z - 2.4, O.z + 1.2] };
  let mounted = false;
  return {
    toys, play, origin: O,
    get mounted() { return mounted; },
    enter() { mounted = true; host.setInterior(room); host.setPose(OVERVIEW); host.explore(EXPLORE); showPins(true); },
    leave() { mounted = false; showPins(false); host.explore(null); host.setInterior(null); },
    async focus(id, { reducedMotion } = {}) {
      showPins(false); host.explore(null);
      play(id);
      const bb = new T.Box3().setFromObject(toys[id].g), p = bb.getCenter(V()), size = bb.getSize(V()).length();
      const dir = V(0.35, 0.32, 1).normalize();
      // frame the toy (and the room around it) on the left, leaving the right side for the card
      const look = p.clone().add(V(0.22 + size * 0.25, 0, 0));
      await host.tweenTo(host.clearPose({ pos: look.clone().addScaledVector(dir, Math.max(1.1, size * 2.6)), look, fov: 46 }), reducedMotion ? 0 : 1.0);
    },
    async overview({ reducedMotion } = {}) { await host.tweenTo(OVERVIEW, reducedMotion ? 0 : 1.0); host.explore(EXPLORE); showPins(true); },
    showPins, poses: { overview: OVERVIEW },
  };
}
