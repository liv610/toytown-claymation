// Copied from experiment/textile-storybook @ d509733 (web/handmade/src). Kept as-is so the port can be traced;
// the project's own textile system builds on it in ../*.js.
// Experiment C — mixed-media textile storybook: the material library.
//
// Rule of this experiment: every material is cheap to shade. Each one samples ONE generated, mip-mapped detail
// texture (R = relief, G = albedo detail, B = slow mottling, A = mask) with UVs projected per piece on the CPU,
// and bumps the normal from its relief — no triplanar, no per-pixel noise, no fibre shells. Material identity comes
// from construction (geometry) and from the right micro-structure for each material, not from adding fuzz.
import * as THREE from 'three';
import { periodicFbm, wrapStroke, packTexture, canvasChannel, rng } from './kit.js';
import { feltTexture } from './felt_materials.js';

export const timeU = { value: 0 };
const N = 512;

// ------------------------------------------------------------------ textures (generated once)
const cache = {};
/** plain-weave cotton/linen: threads over and under, slubs, slightly uneven tension */
function weaveTexture() {
  if (cache.weave) return cache.weave;
  const T = 32, cell = N / T, r = rng(12), h = new Float32Array(N * N), d = new Float32Array(N * N);
  const warpTone = Array.from({ length: T }, () => 0.85 + 0.3 * r()), weftTone = Array.from({ length: T }, () => 0.85 + 0.3 * r());
  const slub = periodicFbm(N, 8, 3, 3, 0.55);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = Math.floor(x / cell), j = Math.floor(y / cell), fx = (x % cell) / cell, fy = (y % cell) / cell;
    const warpOver = (i + j) % 2 === 0;
    const across = warpOver ? fx : fy, along = warpOver ? fy : fx;
    const crown = Math.sin(across * Math.PI) ** 0.6, bow = 0.75 + 0.25 * Math.sin(along * Math.PI);   // a thread's round profile, dipping where it goes under
    const k = y * N + x;
    h[k] = crown * bow * (0.85 + 0.3 * slub[k]);
    d[k] = (warpOver ? warpTone[i] : weftTone[j]) * (0.55 + 0.45 * crown) * (0.9 + 0.2 * slub[k]);
  }
  for (let k = 0; k < d.length; k++) d[k] = Math.min(1, d[k] * 0.85);
  cache.weave = packTexture(N, [h, d, periodicFbm(N, 3, 3, 9, 0.5), slub]);
  return cache.weave;
}
/** cotton batting: soft, low-contrast, a few loose fibres; reads soft, not hairy */
function battingTexture() {
  if (cache.batt) return cache.batt;
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, N, N); const r = rng(8);
  for (let i = 0; i < 2600; i++) { const x = r() * N, y = r() * N, a = r() * 6.28, L = 10 + r() * 40, v = 150 + r() * 105; wrapStroke(g, N, (gg) => { gg.strokeStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.12})`; gg.lineWidth = 1 + r() * 2; gg.beginPath(); gg.moveTo(x, y); gg.quadraticCurveTo(x + Math.cos(a + 1) * L * 0.5, y + Math.sin(a + 1) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); gg.stroke(); }); }
  const fib = canvasChannel(cv), puff = periodicFbm(N, 6, 4, 4, 0.55), h = new Float32Array(N * N);
  for (let k = 0; k < h.length; k++) h[k] = 0.7 * puff[k] + 0.3 * fib[k];
  cache.batt = packTexture(N, [h, fib, puff, puff]);
  return cache.batt;
}
/** painted wood: brush strokes along the grain, a little grain showing through */
function paintTexture() {
  if (cache.paint) return cache.paint;
  const h = new Float32Array(N * N), d = new Float32Array(N * N), streak = periodicFbm(N, 4, 4, 21, 0.6), grain = periodicFbm(N, 2, 3, 22, 0.5);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, sx = streak[(y * N + ((x * 1) % N))], s2 = streak[((y * 7) % N) * N + ((Math.floor(x / 16)) % N)];
    h[k] = 0.5 + 0.35 * (s2 - 0.5) + 0.15 * (sx - 0.5); d[k] = 0.9 + 0.1 * grain[(((x * 3) % N) * N + (y % N)) % (N * N)];
  }
  cache.paint = packTexture(N, [h, d, grain, streak]);
  return cache.paint;
}
/** four small cotton prints in one tile (calico flowers, polka dots, stars, sprigs) — the mask is the print */
function printTexture() {
  if (cache.print) return cache.print;
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  const q = N / 2, r = rng(15);
  const quad = (ox, oy, fn) => { g.save(); g.beginPath(); g.rect(ox, oy, q, q); g.clip(); fn(ox, oy); g.restore(); };
  quad(0, 0, (ox, oy) => { for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const cx = ox + (x + 0.5 + (y % 2) * 0.5) * q / 6, cy = oy + (y + 0.5) * q / 6; for (let p = 0; p < 5; p++) { const a = p / 5 * 6.28; g.beginPath(); g.arc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 5, 0, 6.28); g.fill(); } } });
  quad(q, 0, (ox, oy) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(ox + (x + 0.5 + (y % 2) * 0.5) * q / 8, oy + (y + 0.5) * q / 8, 6, 0, 6.28); g.fill(); } });
  quad(0, q, (ox, oy) => { for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const cx = ox + (x + 0.5 + (y % 2) * 0.5) * q / 6, cy = oy + (y + 0.5) * q / 6; g.beginPath(); for (let p = 0; p < 10; p++) { const a = -Math.PI / 2 + p / 10 * 6.28, rr = p % 2 ? 4 : 10; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill(); } });
  quad(q, q, (ox, oy) => { g.lineWidth = 3; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const cx = ox + (x + 0.5) * q / 5 + (r() - 0.5) * 10, cy = oy + (y + 0.5) * q / 5 + (r() - 0.5) * 10, a = r() * 6.28; g.beginPath(); g.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); g.stroke(); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + Math.cos(a) * 4 * s, cy + Math.sin(a) * 4 * s, 7, 3.5, a + s * 0.9, 0, 6.28); g.fill(); } } });
  const mask = canvasChannel(cv);
  const w = weaveTexture().image.data, h = new Float32Array(N * N), d = new Float32Array(N * N);
  for (let k = 0; k < h.length; k++) { h[k] = w[k * 4] / 255; d[k] = w[k * 4 + 1] / 255; }
  cache.print = packTexture(N, [h, d, null, mask]);
  return cache.print;
}

// ------------------------------------------------------------------ the shared shader shape
/**
 * kind:
 *   felt   wool felt (soft, matte, faint sheen), cut edges a touch darker
 *   woven  cotton / linen (thread relief, satin-ish sheen along threads)
 *   print  printed calico: woven + a small print (aExtra selects one of four prints, 0..3)
 *   batt   cotton batting snow (soft, bright, slightly cool in shadow)
 *   paint  painted wood (brush strokes, a soft gloss)
 *   glow   thin fabric lit from behind (threads darker, gaps bright)
 */
const KINDS = {
  felt: { tex: () => feltTexture(), scale: 3.5, bump: 0.004, rough: 0.96, sheen: 0.45 },
  woven: { tex: weaveTexture, scale: 4.0, bump: 0.0025, rough: 0.82, sheen: 0.55 },
  print: { tex: printTexture, scale: 3.2, bump: 0.0022, rough: 0.82, sheen: 0.5 },
  batt: { tex: battingTexture, scale: 1.6, bump: 0.022, rough: 1.0, sheen: 0.9 },
  paint: { tex: paintTexture, scale: 2.0, bump: 0.0012, rough: 0.42, sheen: 0, clearcoat: 0.35 },
  glow: { tex: weaveTexture, scale: 3.0, bump: 0.0, rough: 0.9, sheen: 0 },
};
export function textileMaterial(kind, { glow = 0, glowColor = 0xffb45e, side = THREE.FrontSide, name, scaleMul = 1 } = {}) {
  const K = KINDS[kind];
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: K.rough, metalness: 0, side, sheen: K.sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.8, 0.78, 0.75), clearcoat: K.clearcoat || 0, clearcoatRoughness: 0.5 });
  if (glow) { m.emissive = new THREE.Color(glowColor); m.emissiveIntensity = glow; }
  m.name = name || kind; m.userData.light = { value: 1 };
  const tex = K.tex();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDet = { value: tex }; sh.uniforms.uScale = { value: K.scale * scaleMul }; sh.uniforms.uLight = m.userData.light;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec2 aUv; attribute float aEdge; attribute float aSeed; attribute float aExtra;
        varying vec2 vTUv; varying float vEdge; varying float vSeed; varying float vExtra;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vTUv = aUv; vEdge = aEdge; vSeed = aSeed; vExtra = aExtra;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D tDet; uniform float uScale; uniform float uLight; varying vec2 vTUv; varying float vEdge; varying float vSeed; varying float vExtra;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 st = vTUv * uScale + vec2(fract(vSeed * 7.31), fract(vSeed * 3.17)) * 4.0;
        ${kind === 'print' ? 'vec2 cellUv = fract(st); float pi = floor(vExtra + 0.5); vec2 off = vec2(mod(pi, 2.0), floor(pi / 2.0)) * 0.5; vec4 tx = texture2D(tDet, st); float prn = texture2D(tDet, cellUv * 0.5 + off).a;' : 'vec4 tx = texture2D(tDet, st);'}
        float edge = smoothstep(0.3, 0.95, vEdge);
        ${{
    felt: 'diffuseColor.rgb *= (0.88 + 0.22 * tx.g) * (0.93 + 0.12 * tx.b) * (1.0 - 0.12 * edge);',
    woven: 'diffuseColor.rgb *= (0.7 + 0.4 * tx.g) * (0.94 + 0.1 * tx.b);',
    print: 'diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.97, 0.93, 0.84), diffuseColor.rgb * 0.45, step(0.5, fract(vSeed * 13.0))), smoothstep(0.35, 0.65, prn)); diffuseColor.rgb *= 0.72 + 0.38 * tx.g;',
    batt: 'diffuseColor.rgb *= 0.9 + 0.12 * tx.g + 0.04 * tx.b;',
    paint: 'diffuseColor.rgb *= (0.95 + 0.06 * tx.g) * (1.0 - 0.06 * tx.a);',
    glow: 'diffuseColor.rgb *= 0.8 + 0.3 * tx.g;',
  }[kind]}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${K.bump ? `{ vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float h = tx.r; float dhx = dFdx(h) * ${K.bump.toFixed(4)}, dhy = dFdy(h) * ${K.bump.toFixed(4)};
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= uLight * vColor.rgb * ${kind === 'glow' ? '(0.55 + 0.75 * (1.0 - tx.g)) * (0.85 + 0.3 * tx.b)' : '1.0'};`);
  };
  m.customProgramCacheKey = () => 'textile-' + kind + (glow ? '-g' : '') + (scaleMul !== 1 ? '-s' : '');
  return m;
}

/** embroidery floss and sewing thread: per-instance colour, a twisted ply, a soft satin sheen */
export function threadMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.48, sheen: 0.7, sheenRoughness: 0.3, sheenColor: new THREE.Color(1, 1, 1) });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSt;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSt = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSt;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat ply = 0.5 + 0.5 * sin(atan(vSt.z, vSt.x) * 2.0 + vSt.y * 18.0); diffuseColor.rgb *= 0.78 + 0.26 * ply;');
  };
  m.customProgramCacheKey = () => 'textile-thread';
  return m;
}
/** twisted yarn: two-ply spiral along the tube (uv.x runs along it) */
export function yarnMaterial(color, twists = 300) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 0.95, 0.9) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTw = { value: twists };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vY;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvY = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vY; uniform float uTw;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat tw = fract(vY.x * uTw + vY.y * 2.0); float ply = smoothstep(0.0, 0.25, tw) * smoothstep(1.0, 0.6, tw); diffuseColor.rgb *= 0.62 + 0.45 * ply;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ float tw = fract(vY.x * uTw + vY.y * 2.0); vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float h = sin(tw * 3.1416); float dhx = dFdx(h) * 0.004, dhy = dFdy(h) * 0.004; vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }');
  };
  m.customProgramCacheKey = () => 'textile-yarn';
  return m;
}
