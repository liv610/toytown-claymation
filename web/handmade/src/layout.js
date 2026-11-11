// The one small section of Toy Town that both experiments build, in shared world coordinates
// (three.js: x east, y up, z toward the viewer; metres at the village's "full-size" scale, as in the
// clay scene, so the existing camera presets and the Marine's walk speed carry over unchanged).
import * as THREE from 'three';

export const SHOP = { x: 0, z: 0, W: 5.2, D: 5.0, H: 5.2, pitch: THREE.MathUtils.degToRad(53), plinth: 0.45 };
SHOP.ridge = SHOP.H + (SHOP.W / 2) * Math.tan(SHOP.pitch);
export const PINK = { x: 5.95, z: -0.45, W: 4.1, D: 4.4, H: 3.9, pitch: THREE.MathUtils.degToRad(47), plinth: 0.35 };
PINK.ridge = PINK.H + (PINK.D / 2) * Math.tan(PINK.pitch);
export const TREE = { x: -3.75, z: 1.45, h: 3.3 };
export const LAMP = { x: 3.3, z: 2.25, h: 3.3 };
export const DOOR = { x: 0, w: 1.05, y0: 0.45, h: 2.1 };          // the shop door (opening, centred at x)
export const STREET = { x0: -9.0, x1: 11.5, zWalk: 1.35, z1: 7.0, zBoard: 8.4, zBack: -6.4 };
export const GIFTS = [                                             // presents: position, size (w, h, d), rotation, colours
  { p: [-1.45, 0.95], s: [0.5, 0.42, 0.45], r: 0.25, c: 0xb8262c, c2: 0xe9c25a },
  { p: [-1.05, 1.05], s: [0.36, 0.3, 0.36], r: -0.35, c: 0x2f6f8f, c2: 0xf3ead8 },
  { p: [-3.2, 2.25], s: [0.55, 0.4, 0.5], r: 0.5, c: 0x2f7a4c, c2: 0xc23a33 },
  { p: [-4.15, 2.3], s: [0.42, 0.5, 0.42], r: -0.2, c: 0xd9a441, c2: 0xb8262c },
  { p: [-3.65, 2.75], s: [0.34, 0.26, 0.34], r: 0.9, c: 0x9a4f8f, c2: 0xf3ead8 },
];

// identical camera positions for both treatments (pos, target, horizontal field of view in degrees)
export const CAMS = {
  Hero:     { label: 'Hero',     pos: [-7.6, 5.0, 15.6], target: [1.6, 2.9, 0.0], fovH: 50 },
  Elevated: { label: 'Elevated', pos: [-5.6, 13.2, 15.8], target: [1.4, 1.0, -0.4], fovH: 50 },
  Close:    { label: 'Close-up', pos: [-3.45, 2.75, 4.0], target: [-1.25, 2.05, 0.1], fovH: 42 },
  Street:   { label: 'Street',   pos: [9.6, 1.25, 7.6], target: [0.4, 2.2, 0.4], fovH: 54 },
  Side:     { label: 'Side',     pos: [-10.8, 4.6, 2.6], target: [0.4, 3.1, -1.9], fovH: 50 },
  Roof:     { label: 'Roof detail', pos: [-4.2, 8.2, 3.4], target: [-1.3, 6.3, -1.2], fovH: 40 },
  Marine:   { label: 'Marine', follow: true, pos: [-3, 1.5, 5], target: [-3, 1.1, 3], fovH: 46 },
};

// the Marine's beat: a loop along the street, past the lamp and the shop door
export const MARINE_PATH = [[-7.0, 3.6], [-4.6, 3.95], [-1.6, 2.65], [1.2, 2.6], [4.6, 3.3], [7.6, 3.4], [9.4, 4.4],
  [8.2, 5.6], [4.6, 5.5], [0.6, 5.6], [-3.6, 5.5], [-6.6, 5.3], [-7.9, 4.5]];
