// Copied from experiment/textile-storybook @ d509733 (web/handmade/src). Kept as-is so the port can be traced;
// the project's own textile system builds on it in ../*.js.
// Paper and card materials.
//
// What makes paper read as paper (in order of importance, from looking at real pop-up books and paper dioramas):
//   1. thickness and the cut edge: card has a visible edge, slightly lighter and rougher than the face
//      (the core of dyed card is paler and fibrous), and a wandering hand-cut line;
//   2. layering: pieces sit a few millimetres in front of each other, and the shadow in that gap does most of
//      the work (that is geometry + shadows, not this file);
//   3. a matte, toothy surface with faint fibres and uneven colour from sheet to sheet;
//   4. light coming *through* thin paper (vellum windows, lanterns).
// All texture is procedural and in object space, so a piece keeps its texture when it moves (doors, puppets).
import * as THREE from 'three';
import { GLSL_NOISE, GLSL_TRIPLANAR, periodicFbm, wrapStroke, packTexture, canvasChannel, rng } from './kit.js';

export const timeU = { value: 0 };

const PAPER_GLSL = GLSL_NOISE + /* glsl */`
// fibres: noise stretched along three directions (long along d, very fine across it)
float fibreFam(vec3 p, vec3 d, float lo, float hi){ vec3 q = p*hi + d*dot(p,d)*(lo-hi); float n = vn3(q); return pow(1.0-abs(2.0*n-1.0), 8.0); }
float fibres(vec3 p){
  return fibreFam(p, vec3(0.80,0.10,0.59), 9.0, 150.0) + fibreFam(p + 3.1, vec3(-0.30,0.90,0.31), 9.0, 150.0) + fibreFam(p + 7.7, vec3(0.20,-0.40,0.89), 9.0, 150.0);
}
`;

// ------------------------------------------------------------------ the paper texture (one tile ≈ 25 cm of world = ~8 mm of real card)
let PAPER_TEX = null;
export function paperTexture() {
  if (PAPER_TEX) return PAPER_TEX;
  const n = 512;
  const tooth = periodicFbm(n, 24, 4, 11, 0.55);                // cold-press tooth
  const sheet = periodicFbm(n, 3, 3, 23, 0.5);                  // uneven dye within a sheet
  // fibres: short curved strokes, light and dark, wrapped so the tile repeats
  const cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, n, n); const r = rng(5);
  for (let i = 0; i < 2600; i++) {
    const x = r() * n, y = r() * n, a = r() * Math.PI * 2, L = 6 + r() * r() * 46, bend = (r() - 0.5) * 0.8;
    const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L, cx = (x + x1) / 2 + Math.cos(a + 1.57) * L * bend * 0.3, cy = (y + y1) / 2 + Math.sin(a + 1.57) * L * bend * 0.3;
    const v = 60 + r() * 195;
    wrapStroke(g, n, (gg) => { gg.strokeStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.35})`; gg.lineWidth = 0.5 + r() * 1.1; gg.beginPath(); gg.moveTo(x, y); gg.quadraticCurveTo(cx, cy, x1, y1); gg.stroke(); });
  }
  const fib = canvasChannel(cv);
  const h = new Float32Array(n * n); for (let i = 0; i < h.length; i++) h[i] = 0.62 * tooth[i] + 0.38 * fib[i];
  PAPER_TEX = packTexture(n, [h, fib, sheet, tooth]);
  return PAPER_TEX;
}

/**
 * Card stock. Per-vertex: color (the sheet), aEdge (1 on the cut edge), aSeed (per-piece texture offset),
 * aExtra (spare). Surface detail comes from the mip-mapped paper tile, mapped triplanar in object space.
 */
export function cardMaterial({ roughness = 0.86, metalness = 0, tooth = 1, name = 'card', side = THREE.DoubleSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, side });
  m.name = name;
  const tex = paperTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTooth = { value: tooth }; sh.uniforms.tPaper = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aEdge; attribute float aSeed; attribute float aExtra;
        varying float vEdge; varying float vSeed; varying float vExtra; varying vec3 vP; varying vec3 vON;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEdge = aEdge; vSeed = aSeed; vExtra = aExtra; vP = position; vON = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTooth; uniform sampler2D tPaper; varying float vEdge; varying float vSeed; varying float vExtra; varying vec3 vP; varying vec3 vON;
        ${GLSL_NOISE}${GLSL_TRIPLANAR}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 pp = vP + vec3(fract(vSeed * 7.31), fract(vSeed * 3.17), fract(vSeed * 5.73)) * 9.0;
        vec4 tx = triplanar(tPaper, pp, normalize(vON), 4.0);
        float edge = smoothstep(0.35, 0.95, vEdge);
        float sheet = fbm3(pp * 0.9);
        diffuseColor.rgb *= (0.93 + 0.12 * sheet) * (0.94 + 0.12 * tx.b) * (1.0 + 0.12 * uTooth * (tx.g - 0.2)) * (0.97 + 0.06 * tx.a);
        // the cut edge: the paler, fibrous core of the card
        vec3 core = mix(diffuseColor.rgb, vec3(0.92, 0.88, 0.79), 0.42) * (0.92 + 0.12 * tx.a);
        diffuseColor.rgb = mix(diffuseColor.rgb, core, edge);
        `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + 0.1 * edge - 0.06 * tx.g, 0.0, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(normal, -vViewPosition, tx.r * uTooth + edge * tx.a * 0.6, 0.0032);`);
  };
  m.customProgramCacheKey = () => 'paper-card-' + tooth + '-' + metalness;
  return m;
}

/**
 * Vellum / tracing paper lit from behind: the windows and lanterns. Emission is modulated by the cloudy
 * fibre structure of translucent paper, and is brighter where the paper is thinner (the edge reads darker).
 * uLight scales the glow (lamp switching, door opening).
 */
export function vellumMaterial({ color = 0xffc77a, strength = 1.6, name = 'vellum' } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: new THREE.Color(color), emissiveIntensity: strength, side: THREE.DoubleSide });
  m.name = name;
  m.userData.light = { value: 1 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLight = m.userData.light;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aEdge; attribute float aSeed; attribute float aExtra; varying float vEdge; varying float vSeed; varying float vExtra; varying vec3 vP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEdge = aEdge; vSeed = aSeed; vExtra = aExtra; vP = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLight; varying float vEdge; varying float vSeed; varying float vExtra; varying vec3 vP;
        ${PAPER_GLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 pp = vP + vSeed * 19.0;
          float cloud = 0.55 + 0.6 * fbm3(pp * 9.0) + 0.25 * fibres(pp * 0.7);
          float lit = uLight * (0.85 + 0.15 * vExtra);
          totalEmissiveRadiance *= vColor.rgb * cloud * lit * (1.0 - 0.6 * smoothstep(0.4, 0.9, vEdge));
        }`);
  };
  m.customProgramCacheKey = () => 'paper-vellum';
  return m;
}

/** the falling snow: tumbling scraps of white paper, animated entirely in the vertex shader */
export function confettiMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.8, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = timeU;
    const inject = `
      vec4 sd = aSnow; float H = 13.0;
      vec3 c = sd.xyz; c.y = mod(c.y - (0.55 + 0.35 * sd.w) * uT, H) - 0.4;
      c.x += 0.45 * sin(uT * (0.4 + sd.w) + sd.w * 40.0); c.z += 0.3 * cos(uT * (0.33 + 0.5 * sd.w) + sd.w * 17.0);
      float a1 = uT * (1.2 + 2.2 * sd.w) + sd.w * 31.0, a2 = uT * (0.9 + 1.4 * fract(sd.w * 7.0)) + sd.w * 11.0;
      mat3 R1 = mat3(1.0,0.0,0.0, 0.0,cos(a1),sin(a1), 0.0,-sin(a1),cos(a1));
      mat3 R2 = mat3(cos(a2),0.0,-sin(a2), 0.0,1.0,0.0, sin(a2),0.0,cos(a2));
      mat3 R = R2 * R1; float s = 0.65 + 0.7 * fract(sd.w * 13.0);`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSnow; uniform float uT;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${inject}\nobjectNormal = R * objectNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = R * (transformed * s) + c;`);
  };
  m.customProgramCacheKey = () => 'paper-confetti';
  return m;
}
