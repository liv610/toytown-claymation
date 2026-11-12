// MapProvider: the claymation map-scale diorama (from the experiment/map-scale branch).
//
// Every map provider implements the same small interface, so the journey can swap this one
// for the 2D folk-art national map later:
//   id                         'diorama' | 'flat' | ...
//   mount()                    show the map; resolves when it is on screen
//   unmount()                  hide it (the village may take over the same canvas)
//   places                     [{ id, label }]  selectable places (only 'toytown' in this prototype)
//   enter(placeId, opts)       animate toward the place; resolves with a Handoff for the village:
//                              { kind: 'pose', pose }      a camera pose in the village's world, or
//                              { kind: 'screen', rect }    a screen rectangle (2D maps)
//   onSelect(cb)               the visitor picked a place on the map (pin, click, keyboard)
import { B, V, smooth } from './diorama.js';
import { VILLAGE_POSES } from './village.js';

const MAP_POSE = { pos: B(30, -275, 175), look: B(8, -2, 0), fov: 46 };
const TOWN = B(4, -14, 4);

export function createDioramaMap(host, pins) {
  let cb = () => {}, mounted = false, drift = 0;
  pins.add({ id: 'map-toytown', label: 'Toy Town', hint: 'enter the village', icon: '★', getPos: () => TOWN.clone().add(V(0, 9, 0)), onSelect: () => cb('toytown') });
  pins.setVisible('map-toytown', false);
  // a slow, gentle drift over the board while the map is up
  host.onUpdate((dt) => {
    if (!mounted || host.moving || host.controls.enabled) return;
    drift += dt;
    const a = Math.sin(drift * 0.05) * 0.06;
    const d = MAP_POSE.pos.clone().sub(MAP_POSE.look).applyAxisAngle(V(0, 1, 0), a);
    host.cur.pos.copy(MAP_POSE.look).add(d); host.cur.look.copy(MAP_POSE.look);
  });
  return {
    id: 'diorama',
    places: [{ id: 'toytown', label: 'Toy Town' }],
    onSelect(f) { cb = f; },
    async mount({ reducedMotion } = {}) {
      mounted = true; drift = 0;
      pins.setVisible('map-toytown', true);
      if (host.cur.pos.length() < 1) host.setPose(MAP_POSE); else await host.tweenTo(MAP_POSE, reducedMotion ? 0 : 2.5);
    },
    unmount() { mounted = false; pins.setVisible('map-toytown', false); },
    // ~5 s glide from the board down to the square (skippable: the village can start from any pose)
    async enter(placeId, { reducedMotion } = {}) {
      mounted = false; pins.setVisible('map-toytown', false);
      const A = (host.poses && host.poses.arrival) || VILLAGE_POSES.arrival;   // the look's own arrival (felt: the storybook hero camera)
      const keys = [
        [0.00, host.cur.pos.clone(), host.cur.look.clone(), host.cur.fov],
        [0.35, B(42, -150, 85), B(6, -12, 0.5), 47],
        [0.62, B(30, -58, 27), B(3, -11, 2.5), 48],
        [0.82, B(10, -33, 11), B(1.5, -4, 3.2), 50],
        [1.00, A.pos, A.look, A.fov],
      ];
      const r = await host.fly(keys, reducedMotion ? 0 : 5.2);
      return { kind: 'pose', pose: r === 'done' ? A : { pos: host.cur.pos.clone(), look: host.cur.look.clone(), fov: host.cur.fov } };
    },
    pose: MAP_POSE,
  };
}

// MapProvider stand-in for the 2D folk-art national map: proves the hand-off works when the
// map is not part of the 3D world at all. It is a deliberately plain placeholder drawing.
export function createFlatMap(layer) {
  let cb = () => {};
  layer.innerHTML = `
    <div class="flatmap" role="region" aria-label="Map stand-in">
      <svg viewBox="0 0 800 460" aria-hidden="true">
        <rect x="8" y="8" width="784" height="444" rx="26" class="fm-board"/>
        <path d="M60 120 C 220 140, 300 210, 400 250" class="fm-track fm-red"/>
        <path d="M80 380 C 220 340, 320 290, 400 250" class="fm-track fm-blue"/>
        <path d="M740 140 C 620 170, 520 220, 400 250" class="fm-track fm-green"/>
        <circle cx="140" cy="128" r="9" class="fm-town"/><circle cx="210" cy="356" r="9" class="fm-town"/><circle cx="640" cy="168" r="9" class="fm-town"/>
        <circle cx="560" cy="330" r="9" class="fm-town"/><circle cx="300" cy="190" r="7" class="fm-town"/>
      </svg>
      <p class="fm-note">Stand-in for the national folk-art map · integration test of the hand-off</p>
      <button type="button" class="fm-toytown" style="left:50%;top:54.3%"><span aria-hidden="true">★</span> Toy Town</button>
    </div>`;
  const btn = layer.querySelector('.fm-toytown');
  btn.addEventListener('click', () => cb('toytown'));
  return {
    id: 'flat',
    places: [{ id: 'toytown', label: 'Toy Town' }],
    onSelect(f) { cb = f; },
    async mount() { layer.hidden = false; layer.classList.remove('fm-leaving'); },
    unmount() { layer.hidden = true; },
    async enter(placeId, { reducedMotion } = {}) {
      const rect = btn.getBoundingClientRect();
      layer.style.setProperty('--ox', `${rect.left + rect.width / 2}px`); layer.style.setProperty('--oy', `${rect.top + rect.height / 2}px`);
      layer.classList.add('fm-leaving');
      await new Promise((r) => setTimeout(r, reducedMotion ? 0 : 900));
      layer.hidden = true;
      return { kind: 'screen', rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } };
    },
  };
}
