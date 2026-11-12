// Felt surface for the national map and its dioramas (the felt look): the felt style test's wool tile mapped in world
// space, matte with a soft sheen where fibres catch light at grazing angles, a gentle stuffed puff instead of clay
// thumbprints. Like clay.js, the fine detail fades once it is smaller than a pixel (the map zooms ~1000×).
import { feltTexture } from '../../textile/src/vendor/felt_materials.js';

const TEX = { value: null };
const GLSL = /* glsl */`
varying vec3 vFP;
uniform sampler2D tFelt;
float fh3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float fvn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(fh3(i),fh3(i+vec3(1,0,0)),f.x),mix(fh3(i+vec3(0,1,0)),fh3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(fh3(i+vec3(0,0,1)),fh3(i+vec3(1,0,1)),f.x),mix(fh3(i+vec3(0,1,1)),fh3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float ffbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s+=a*fvn(p); p*=2.03; a*=0.5; } return s; }
vec4 ftri(vec3 p, vec3 n, float s){
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(tFelt, p.yz * s) * w.x + texture2D(tFelt, p.xz * s + 0.37) * w.y + texture2D(tFelt, p.xy * s + 0.71) * w.z; }
float fstitch(float d, float along, float w, float dash){
  float px = fwidth(d) + 1e-4, ww = max(w, px);
  return smoothstep(ww + px, ww, d) * step(fract(along / dash), 0.58) * clamp(w / ww, 0.0, 1.0); }
`;
// per kind: wool tile frequency (per world unit), puff frequency, puff amplitude, colour richness
const KINDS = { felt: [3.0, 1.2, 0.02, 1.15], snow: [2.2, 0.8, 0.03, 1.0], land: [0.9, 0.08, 0.0, 1.12], sea: [0.6, 0.05, 0.0, 1.0], wood: [3.0, 1.2, 0.012, 1.05] };

/**
 * mat: a MeshStandardMaterial. kind: felt | snow | land | sea | wood. scale: world units per local unit for dioramas
 * placed at miniature scale (Maple Hollow), so the wool keeps its real size. extra(sh): more shader edits (land, sea).
 */
export function felt(mat, kind = 'felt', { scale = 1, extra = null, key = '' } = {}) {
  const [F, PF, PA, RICH] = KINDS[kind] || KINDS.felt;
  if (!TEX.value) TEX.value = feltTexture();
  mat.roughness = Math.max(mat.roughness ?? 1, kind === 'sea' ? 0.85 : 0.94); mat.metalness = 0;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tFelt = TEX;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFP;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
        vFP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
        vFP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 fp = vFP / ${scale.toFixed(4)};
        float fpx = length(fwidth(fp)) * ${F.toFixed(3)};
        float fNear = 1.0 - smoothstep(0.3, 1.0, fpx);                // the wool tile only where it is bigger than a pixel
        vec4 ftx = mix(vec4(0.5), ftri(fp, normalize(cross(dFdx(vFP), dFdy(vFP)) + 1e-6), ${F.toFixed(3)}), fNear);
        diffuseColor.rgb *= (0.9 + 0.16 * ftx.b) * (0.9 + 0.2 * ftx.g) * (0.95 + 0.1 * ffbm(fp * ${(PF * 0.6).toFixed(3)}));
        { float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, ${RICH.toFixed(2)}), 0.0); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h = ${PA > 0 ? `ffbm(fp * ${PF.toFixed(3)}) * ${(PA * scale).toFixed(5)} / ${F.toFixed(3)} * 40.0` : '0.0'} + (ftx.r + 0.5 * ftx.a) * 0.004 * ${scale.toFixed(4)} * fNear;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 nb = abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2);
          normal = dot(nb, nb) > 1e-12 ? normalize(nb) : normal;
        }`)
      .replace('#include <opaque_fragment>', `
        { float g = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);   // felt sheen
          outgoingLight += g * 0.5 * totalDiffuse * vec3(1.0, 0.97, 0.92); }
        #include <opaque_fragment>`);
    if (extra) extra(sh);
  };
  mat.customProgramCacheKey = () => 'nfelt-' + kind + '-' + scale + key;
  return mat;
}
export { GLSL as FELT_GLSL };
