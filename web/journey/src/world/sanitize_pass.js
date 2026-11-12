// A full-screen pass that replaces non-finite pixels (NaN / Inf) and caps extreme values. A single bad pixel — a
// half-float overflow from a tiny, very bright highlight, or a NaN from a degenerate normal — is harmless on its own,
// but ambient occlusion, depth of field and above all bloom blur it into large black blocks. Cheap insurance.
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function sanitizePass(cap = 64) {
  return new ShaderPass({
    name: 'SanitizePass',
    uniforms: { tDiffuse: { value: null }, uCap: { value: cap } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uCap; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        bool bad = any(isnan(c)) || any(isinf(c)) || any(notEqual(c, c)) || any(greaterThan(abs(c), vec4(6.0e4)));
        gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : clamp(c, vec4(0.0), vec4(uCap));
      }`,
  });
}
