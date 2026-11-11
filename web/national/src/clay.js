// Hand-made clay surface for the national map and its dioramas.
// Same look as Toy Town's shader (world-space Voronoi lumps, fbm thumbprints, mottled colour), with one change
// that matters across a 1000× zoom range: the sculpted detail fades out once it gets smaller than a pixel
// (screen-space derivative), so nothing sparkles or turns to noise at middle distances.
export const timeU = { value: 0 };
const NOISE = /* glsl */`
varying vec3 vCP;
float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
float cells(vec3 p){ vec3 i=floor(p), f=fract(p); float d=1.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec3 o=vec3(x,y,z);
    vec3 r=o+vec3(h3(i+o),h3(i+o+7.1),h3(i+o+3.3))-f; d=min(d,dot(r,r)); } return sqrt(d); }
`;
// per kind: [base frequency of the lumps, bump amplitude, colour mottling]
const KINDS = { clay: [3.5, 0.025, 0.28], snow: [11.0, 0.03, 0.12], terrain: [0.35, 0.16, 0.34], water: [0.6, 0.05, 0.1], wood: [3.5, 0.02, 0.3], cobble: [3.0, 0.03, 0.3], fabric: [3.5, 0.015, 0.2] };
export function clay(mat, kind = 'clay', local = false, scale = 1) {   // scale: world units per local unit (miniature dioramas)
  const [F, A, M] = KINDS[kind] || KINDS.clay;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = timeU;
    const src = local ? 'position' : '(modelMatrix * vec4(transformed, 1.0)).xyz';
    const srcI = local ? 'position' : '(modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCP;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n#ifdef USE_INSTANCING\nvCP = ${srcI};\n#else\nvCP = ${src};\n#endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float m = fbm(vCP * ${(F * 0.26).toFixed(3)}); diffuseColor.rgb *= ${(1 - M / 2).toFixed(3)} + ${M.toFixed(3)} * m; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // fade the sculpted detail once a lump would be smaller than ~2 pixels
          float px = length(fwidth(vCP)) * ${F.toFixed(3)};
          float aa = 1.0 - smoothstep(0.25, 0.9, px);
          if (aa > 0.01) {
            ${kind === 'water' ? `float h = fbm(vCP * ${F.toFixed(3)} + vec3(uT * 0.15, 0.0, uT * 0.08)) + 0.4 * fbm(vCP * ${(F * 3.8).toFixed(3)} - uT * 0.2);`
              : kind === 'snow' ? `float h = -0.9 * cells(vCP * ${F.toFixed(3)}) - 0.35 * cells(vCP * ${(F * 3.1).toFixed(3)}) + 0.6 * fbm(vCP * ${(F * 0.55).toFixed(3)});`
              : `float h = 0.9 * cells(vCP * ${F.toFixed(3)} + fbm(vCP * ${(F * 0.34).toFixed(3)})) + 0.6 * fbm(vCP * ${(F * 2.0).toFixed(3)});`}
            float amp = ${(A * scale).toFixed(5)} * aa;
            vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
            float dhx = dFdx(h) * amp, dhy = dFdy(h) * amp;
            vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
            normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
          }
        }`);
  };
  mat.customProgramCacheKey = () => 'nat-' + kind + (local ? '-l' + scale : '');
  return mat;
}
