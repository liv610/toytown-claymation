// Shared puppet rig: reuses the existing Marine's skeleton and hand-authored clips (Walk, Idle, WalkCarry, IdleCarry)
// but throws away its clay skin. Each style builds its own rigid parts (cut card, stuffed cloth) in the Marine's
// rest-pose model space; they are attached to the bones, so the puppet is articulated exactly like a real
// jointed puppet — each part moves rigidly with its bone, joints are visible.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { V } from './kit.js';

const key = (n) => n.replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * gltf: the loaded marine.glb. build({ part, bone, joint }) creates the parts:
 *   part(boneName, object3D)   object3D is authored in model space (character faces +z, feet at y = 0)
 *   joint(name)                rest-pose world position of a bone's head (e.g. 'forearm.L' = the left elbow)
 */
export function rigPuppet(gltf, build) {
  const root = skClone(gltf.scene);
  let skinned = null; const skins = [];
  root.traverse((o) => { if (o.isSkinnedMesh) { skinned = o; skins.push(o); } });
  const bones = {};
  skinned.skeleton.bones.forEach((b) => { bones[key(b.name)] = b; });
  skinned.skeleton.pose();
  for (const m of skins) m.visible = false;     // the clay skin (body and its carried present) is not used
  root.updateMatrixWorld(true);
  const joint = (n) => bones[key(n)].getWorldPosition(V());
  const part = (n, obj) => { root.add(obj); obj.updateMatrixWorld(true); bones[key(n)].attach(obj); obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; };
  build({ part, joint, bones });
  const mixer = new THREE.AnimationMixer(root);
  const clips = {};
  for (const a of gltf.animations) clips[a.name] = mixer.clipAction(a);
  return { root, mixer, clips };
}
