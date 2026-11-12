// The felt Toy Town street, exactly as the felt style test builds and renders it (vendor/felt_index.js buildFelt and
// the test page's post-processing: ambient occlusion, depth of field, bloom, its own exposure and light rig), without
// the felt fibres. The journey draws it in place of the clay street once the camera is down in the town, crossfading
// from the clay map. The journey's own characters and story props are drawn into it (host.share), so the Marine story,
// the drop-off box and the toy keep working; the felt test's own puppet is hidden (the textile puppet is used).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sanitizePass } from '../../journey/src/world/sanitize_pass.js';
import { buildFelt } from './vendor/felt_index.js';
import { fuzzU } from './vendor/felt_materials.js';
import { LAMP, CAMS } from './vendor/layout.js';
import { makeKit } from './vendor/textile_kit.js';
import { extendKit } from './construct.js';
import { wagon } from './props.js';
import { kitMeshes, guard } from './materials.js';

const V3 = (a) => new THREE.Vector3().fromArray(a);

/**
 * marine: the Marine glTF (rig + clips); spots: { lamp: [x, z], wagon: [x, z, rotY] } in Toy Town's coordinates;
 * post: false on low-end devices (no ambient occlusion or depth of field).
 */
export function buildFeltTown({ marine, renderer, camera, width, height, dpr = 1, spots, post = true }) {
  const t0 = performance.now();
  // the test's lamp stands at its own layout's spot: move it to Toy Town's (the lamp hotspot and pin point there)
  const savedLamp = { ...LAMP }; Object.assign(LAMP, { x: spots.lamp[0], z: spots.lamp[1] });
  fuzzU.shells.value = 0;
  const s = buildFelt({ marine });
  Object.assign(LAMP, savedLamp);
  // no fibres; the test's own puppet is not used (the journey's Marines are drawn in instead)
  const drop = []; s.scene.traverse((o) => { if (o.userData && o.userData.fuzz) drop.push(o); });
  for (const o of drop) o.removeFromParent();
  if (s.puppet && s.puppet.root) s.puppet.root.visible = false;
  s.scene.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.onBeforeCompile && m.customProgramCacheKey && !m.userData.guarded && (guard(m), (m.userData.guarded = true))); } });
  // the journey's Marine story ends at Toy Town's wagon, which the test street does not have
  const k = extendKit(makeKit(61)); wagon(k, spots.wagon[0], spots.wagon[1], spots.wagon[2]);
  for (const m of kitMeshes(k)) s.scene.add(m);

  // the test page's post-processing, sized for this canvas
  const rt = new THREE.WebGLRenderTarget(width * dpr, height * dpr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(s.scene, camera)); composer.addPass(sanitizePass());
  let bokeh = null;
  if (post) {
    const ao = new GTAOPass(s.scene, camera, width, height); ao.blendIntensity = s.ao ?? 0.9; ao.updateGtaoMaterial({ radius: s.aoRadius ?? 0.35, distanceExponent: 1.5, thickness: 1.0, scale: 1.0 }); composer.addPass(ao);
    bokeh = new BokehPass(s.scene, camera, { focus: 15, aperture: s.bokeh ?? 0.0003, maxblur: 0.009 }); composer.addPass(bokeh);
  }
  composer.addPass(sanitizePass());   // no bad pixel reaches bloom (it would spread into black blocks)
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), s.bloom ?? 0.32, 0.55, 0.88));
  composer.addPass(new OutputPass());

  // the test's cameras, as journey poses (the village uses these while the felt street shows)
  const P = (c) => ({ pos: V3(c.pos), look: V3(c.target), fov: c.fovH });
  // (targets nudged out in front of the shop's face: a camera target inside a wall makes the camera collide with it)
  const out = (p, dz) => { p.look.z += dz; return p; };
  const poses = { arrival: out(P(CAMS.Hero), 1.4), overview: out(P(CAMS.Hero), 1.4), window: out(P(CAMS.Close), 0.6), street: out(P(CAMS.Street), 0.8) };
  // what the camera and the ground probes should hit in this street: its solid felt, not its sky, snow or glow
  const collide = []; s.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && o.material && !o.material.isShaderMaterial && !/glow|light|lamp|beads/i.test(o.material.name || '')) collide.push(o); });
  return {
    scene: s.scene, composer, poses, collide, exposure: s.exposure ?? 1.1, buildMs: performance.now() - t0,
    setSize(w, h) { composer.setSize(w, h); },
    render(dt, dist, toScreen) {
      if (bokeh) { bokeh.uniforms.focus.value = dist; bokeh.uniforms.aperture.value = s.bokeh ?? 0.0003; }
      renderer.toneMappingExposure = s.exposure ?? 1.1;
      composer.renderToScreen = toScreen; composer.render(dt);
      return composer.readBuffer.texture;
    },
    update(t, dt) { s.update(t, dt); },
  };
}
