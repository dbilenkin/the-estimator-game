// The cast. Every character is the Kenney "Animated Characters" base body (CC0) wearing a painted skin (tools/skins.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonify } from './toon.js';

export const CAST = {
  mark: { skin: 'mark', height: 1.78 },          // competition look: shirt and tie
  mark_rb: { skin: 'mark_rb', height: 1.78 },    // rock bottom: tiny shirt, huge shorts
  bill: { skin: 'bill', height: 1.75 },
  lester: { skin: 'lester', height: 1.8 },
  jack: { skin: 'jack', height: 1.75 },
  bill_sweater: { skin: 'bill_sweater', height: 1.75 },
  mark_hike: { skin: 'mark_hike', height: 1.78 },
  bill_hike: { skin: 'bill_hike', height: 1.75 },
  elliot: { skin: 'elliot', height: 1.76 },
  mark_tr: { skin: 'mark_tr', height: 1.78 },       // training at the playground
  mark_blind: { skin: 'mark_blind', height: 1.78 }, // the same, blindfolded
  bill_camo: { skin: 'bill_camo', height: 1.75 },
  mark_suit: { skin: 'mark_suit', height: 1.78 },   // the competition
  mark_r2: { skin: 'mark_r2', height: 1.78 },       // round 2: shirt, tie and sunglasses
  mark_tie_blind: { skin: 'mark_tie_blind', height: 1.78 },
  bill_suit: { skin: 'bill_suit', height: 1.75 },
  official: { skin: 'official', height: 1.73 },
  guard: { skin: 'guard', height: 1.78 },
  smith: { skin: 'smith', height: 1.7 },
  jess: { skin: 'jess', height: 1.65 },
  amy: { skin: 'amy', height: 1.66 },
  jack_home: { skin: 'jack_home', height: 1.75 },  // the ending: on the couch, recovering
  mark_casual: { skin: 'mark_casual', height: 1.78 },
};

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

export async function loadCharacter(id) {
  const def = CAST[id];
  const [gltf, tex] = await Promise.all([
    loader.loadAsync('./assets/characters/kenney_base.glb'),
    texLoader.loadAsync(`./assets/characters/skins/${def.skin}.png`),
  ]);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const root = toonify(gltf.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material.map = tex;
    o.material.color.set(0xffffff);
    o.material.transparent = false;
    o.material.opacity = 1;
    o.material.depthWrite = true;
    o.material.side = THREE.FrontSide;
    o.material.needsUpdate = true;
    o.castShadow = true;
    o.frustumCulled = false;
  });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.scale.multiplyScalar(def.height / (box.max.y - box.min.y));
  const holder = new THREE.Group();          // Z-up holder facing -Y; the model inside stays Y-up
  root.rotation.x = Math.PI / 2;
  holder.add(root);
  holder.name = id;

  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const c of gltf.animations) {
    const a = mixer.clipAction(c);
    a.play();
    a.setEffectiveWeight(0);
    actions[c.name] = a;
  }
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });

  holder.userData = {
    bones, height: def.height,
    // Deterministic posing: show `clip` at `time` seconds (looping). Pass null to release the skeleton for manual posing.
    setPose(clip, time = 0) {
      for (const [n, a] of Object.entries(actions)) {
        a.setEffectiveWeight(n === clip ? 1 : 0);
        if (n === clip) a.time = time % a.getClip().duration;
      }
      mixer.update(0);
    },
    // Point a bone at a world-space direction (used for poses the pack has no animation for).
    aim(boneName, childName, dir) {
      const bone = bones[boneName], child = bones[childName];
      holder.updateMatrixWorld(true);
      const a = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
      const b = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
      const q = new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), dir.clone().normalize());
      const pw = new THREE.Quaternion(), bw = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(pw);
      bone.getWorldQuaternion(bw);
      bone.quaternion.copy(pw.invert().multiply(q.multiply(bw)));
      holder.updateMatrixWorld(true);
    },
  };
  return holder;
}
