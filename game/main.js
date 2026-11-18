// The Estimator, Level 1: Rock Bottom.
// World is Z-up, metres. Flow: title -> cutscene -> Bill's questions (estimate, reveal, verdict) -> results.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toonify, toonRamp, InkRenderer } from './toon.js';
import { loadCharacter } from './cast.js';
import { RULE, starText, pctStars, offText, showResults } from './scoring.js';
import { rnd, rint, pick, shuffled } from './rng.js';
import { startMusic } from './music.js';
import { SET, DIFF } from './settings.js';
import { shell, initShell, graphics, frameView } from './shell.js';

const Q = new URLSearchParams(location.search);          // debug: ?start=cut&shot=1&t=3&still=1, ?start=play&q=2&guess=4&rt=1
const $ = (id) => document.getElementById(id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---------- renderer, camera, lights ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = !Q.has('noshadow');
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 120);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enablePan: false, minDistance: 1.5, maxDistance: 16, minPolarAngle: 0.1, maxPolarAngle: 1.5, enableDamping: true, enabled: false });   // free to look all the way round
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a7a92, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
sun.position.set(4.5, -6.5, 8.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
graphics(renderer, sun);
const ink = new InkRenderer(renderer);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  ink.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- sets ----------
const sets = { apartment: new THREE.Group(), cliff: new THREE.Group(), sign: new THREE.Group() };
const SKY = { apartment: 0x2b2e3b, cliff: 0xbfe6f5, sign: 0xbfe6f5 };
for (const g of Object.values(sets)) scene.add(g);
function showSet(name) {
  for (const [n, g] of Object.entries(sets)) g.visible = n === name;
  scene.background = new THREE.Color(SKY[name] ?? 0x14151b);
}
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });
function textPlane(w, h, draw, px = 512) {
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round(px * h / w);
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(0xffffff, { map: tex }));
  m.rotation.x = Math.PI / 2;                    // stand it up, facing -Y
  return m;
}
const obj = (name) => sets.apartment.getObjectByName(name);
function topOf(o, lift = 0.12) {
  const b = new THREE.Box3().setFromObject(o);
  return V((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z + lift);
}

// ---------- load ----------
const gl = new GLTFLoader();
const [apt, clf, markRB, bill, markC, jack, billH, elliot] = await Promise.all([
  gl.loadAsync('./assets/apartment.glb'), gl.loadAsync('./assets/cliff.glb'),
  loadCharacter('mark_rb'), loadCharacter('bill_sweater'), loadCharacter('mark_hike'), loadCharacter('jack'),
  loadCharacter('bill_hike'), loadCharacter('elliot'),
]);
for (const [g, set] of [[apt, sets.apartment], [clf, sets.cliff]]) {
  g.scene.rotation.x = Math.PI / 2;              // glTF is Y-up
  set.add(toonify(g.scene));
}
for (const n of ['plateau', 'valley']) sets.cliff.getObjectByName(n)?.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
scene.updateMatrixWorld(true);
sets.apartment.traverse((o) => {                  // every lamp gets a warm light at its shade
  if (!/^lamp_\d+$/.test(o.name)) return;
  const b = new THREE.Box3().setFromObject(o);
  const c = b.getCenter(V(0, 0, 0));
  const l = new THREE.PointLight(0xffd9a0, 0.55, 3.0, 1.4);
  l.position.set(c.x, c.y, b.max.z - 0.12);
  sets.apartment.add(l);
});
sets.apartment.add(markRB, bill);
sets.cliff.add(markC, jack, billH, elliot);

// the trail sign the film opens the hike on
{
  const s = sets.sign;
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 0.1), toon(0x86c95e));
  ground.position.set(0, 10, -0.05);
  const sign = textPlane(1.5, 1.1, (g, w, h) => {
    g.fillStyle = '#2f6b3f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f4f1ea'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#f4f1ea'; g.textAlign = 'center'; g.font = '800 36px "Avenir Next", "Trebuchet MS", sans-serif';
    g.fillText('SOURLAND MOUNTAIN', w / 2, 120); g.fillText('PRESERVE', w / 2, 170);
    g.font = '700 26px "Avenir Next", "Trebuchet MS", sans-serif';
    g.fillText('Trivedi Pond  4 mi  ▸', w / 2, 290);
  });
  sign.position.set(0, 0, 1.35);
  s.add(ground, sign);
  for (const x of [-0.6, 0.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.0), toon(0x6b4a2e));
    post.position.set(x, 0.07, 1.0);
    s.add(post);
  }
  for (let i = 0; i < 26; i++) {                     // spring woods behind it
    const x = -16 + i * 1.3 + Math.sin(i * 7.1) * 0.5, y = 4 + (i % 4) * 2.2, h = 3.2 + (i % 3) * 0.7;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 7), toon(0x6b5a4a));
    trunk.rotation.x = Math.PI / 2; trunk.position.set(x, y, h / 2);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.7 + (i % 3) * 0.3, 9, 7), toon([0x8fd05a, 0x7cc24e, 0xa3dc6a][i % 3]));
    top.position.set(x, y, h);
    s.add(trunk, top);
  }
}
// rope props on the cliff
const ropeMat = toon(0xffd23f);
const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), ropeMat);
coil.position.set(1.25, -0.42, 0.12);
const ropeBit = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 10), ropeMat);
ropeBit.rotation.x = Math.PI / 2;
for (const m of [coil, ropeBit]) m.castShadow = true;
sets.cliff.add(coil, ropeBit);

function place(c, x, y, z, yaw) { c.position.set(x, y, z); c.rotation.z = yaw; }
const faceDir = (dx, dy) => Math.atan2(dx, -dy);   // yaw that makes a character look along (dx, dy)
const UP = V(0, 0, 1);
function hang(c) {                                  // arms straight up, gripping a ledge
  c.userData.setPose(null);
  for (const s of ['Left', 'Right']) {
    c.userData.aim(s + 'Arm', s + 'ForeArm', V(s === 'Left' ? -0.12 : 0.12, 0, 1));
    c.userData.aim(s + 'ForeArm', s + 'Hand', UP);
  }
}

// ---------- cutscene ----------
function camKeys(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const u = b === a ? 0 : ease((t - a.t) / (b.t - a.t));
  camera.position.lerpVectors(a.pos, b.pos, u);
  camera.lookAt(a.look.clone().lerp(b.look, u));
}
const FT = 0.3048, IN = 0.0254;
// ---------- this play's numbers: drawn fresh every time the page loads ----------
const names = (p, n) => Array.from({ length: n }, (_, i) => `${p}_${i + 1}`);
const R = { vac: rint(4, 7), clocks: rint(8, 13), pizza: rint(14, 23), cookie: rint(9, 16), apart: rint(48, 92), beans: rint(90, 220), things: rint(3, 6) };
const vacShown = shuffled(names('vacuum', 7)).slice(0, R.vac), clockShown = shuffled(names('clock', 13)).slice(0, R.clocks);
for (const n of names('vacuum', 7)) obj(n).visible = vacShown.includes(n);
for (const n of names('clock', 13)) obj(n).visible = clockShown.includes(n);
names('pizza', 23).forEach((n, i) => { obj(n).visible = i < R.pizza; });
{ const c = obj('giant_cookie'), k = R.cookie / 12; c.scale.set(c.scale.x * k, c.scale.y, c.scale.z * k); }
{                                                    // extra clutter for the coffee table, and the beans in the jar
  const TZ = 0.435, extras = new THREE.Group();
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), toon(0x3b82c4)); mug.rotation.x = Math.PI / 2; mug.position.set(-0.12, 0.38, TZ + 0.05); mug.name = 'mug';
  const remote = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.19, 0.025), toon(0x2f2b2e)); remote.position.set(0.32, 1.14, TZ + 0.013); remote.rotation.z = 0.5; remote.name = 'remote';
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 9), toon(0xd9463b)); apple.position.set(-0.08, 1.05, TZ + 0.045); apple.name = 'apple';
  [mug, remote, apple].forEach((m, i) => { m.castShadow = true; m.visible = i < R.things - 3; extras.add(m); });
  const cols = [0xe5484d, 0xf5a623, 0xf7d94c, 0x4cae4f, 0x3b82c4, 0x8e5bd0, 0xf08fb4, 0xff7a1a, 0x19b5a5].map((c) => toon(c));
  const geo = new THREE.SphereGeometry(0.02, 7, 5), top = 0.04 + 0.25 * R.beans / 220;
  for (let i = 0; i < R.beans; i++) {
    const m = new THREE.Mesh(geo, cols[i % cols.length]), a = rnd() * 6.283, r = 0.096 * Math.sqrt(rnd());
    m.scale.set(1.45, 0.9, 0.9);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    m.position.set(2.45 + Math.cos(a) * r, -1.95 + Math.sin(a) * r, 0.545 + 0.03 + (top - 0.03) * rnd());
    extras.add(m);
  }
  sets.apartment.add(extras);
}
const MARK_SPOT = [-0.55, 0.25], BILL_SPOT = [MARK_SPOT[0] + 0.981 * R.apart * IN, MARK_SPOT[1] - 0.196 * R.apart * IN];
const COUCH = [0.3, 1.5];
const TARGETS = [['that tiny TV', 'TV', -1.7, -1.8], ['the pizza tower', 'pizza tower', 3.55, -1.75], ['the middle of the kitchen table', 'kitchen table', 5.6, 0.2], ['the jelly bean jar', 'bean jar', 2.45, -1.95]];
const TGT = pick(TARGETS), TGT_FT = Math.round(Math.hypot(TGT[2] - COUCH[0], TGT[3] - COUCH[1]) / FT);
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const JACK_HANG = -3.9, JACK_LAND = -5.3;
const SHOTS = [
  { set: 'sign', dur: 6.4, caps: [[0.6, 3.4, 'Mark', 'Nothing beats 8:59. The way the light falls 2 hours and 15 minutes after sunrise…'],
                                   [3.6, 6.2, 'Elliot', "I don't know why I even wear a watch on trips with Mark."]],
    update(t) {
      camKeys([{ t: 0, pos: V(0.4, -5.6, 1.5), look: V(0, 0, 1.4) }, { t: 6.4, pos: V(-0.2, -4.6, 1.45), look: V(0, 0, 1.4) }], t);
    } },
  { set: 'cliff', dur: 18.2,
    caps: [[0.4, 2.3, 'Jack', "Help! I can't hold on!"], [2.5, 4.6, 'Bill', 'Hold on, Jack! Mark is getting the rope!'],
           [4.9, 7.2, 'Elliot', 'What are you doing?! Throw him the rope!'],
           [7.4, 10.3, 'Mark', "He doesn't need all this rope. I'm just cutting the amount he needs."],
           [10.8, 12.5, 'Jack', "I can't reach! It's too short!"], [12.7, 14.9, 'Mark', "That's ridiculous. It's the perfect length. I just know."],
           [16.0, 18.0, 'Elliot', "You're off the mark, Mark!"]],
    update(t) {
      place(markC, 1.15, 0.3, 0.07, faceDir(1, -0.25));
      markC.userData.setPose('idle', t);
      place(billH, 1.55, -1.45, 0.07, faceDir(1, 0.35));
      billH.userData.setPose('idle', t + 0.5);
      place(elliot, 0.1, 2.3, 0.07, faceDir(0.8, -1));
      elliot.userData.setPose('idle', t + 0.9);
      const fall = Math.max(0, t - 15.0), z = Math.max(JACK_LAND, JACK_HANG - 4.5 * fall * fall), down = z <= JACK_LAND;
      place(jack, down ? 3.3 : 2.82, 0, down ? JACK_LAND + 0.1 : z, faceDir(-1, 0));
      if (down) jack.userData.setPose('idle', 0); else hang(jack);
      jack.rotation.y = down ? -Math.PI / 2 : 0;
      // the rope goes over the edge and hangs down the face: it stops a foot and a half above Jack's fingers
      const grip = jack.userData.bones.RightHand.getWorldPosition(V(0, 0, 0));
      const RX = 2.95, RY = 0.38, ROPE_TOP = 0.15, ROPE_END = (down ? JACK_HANG + 2.2 : grip.z) + 0.45, drop = ease((t - 10.4) / 0.7), len = (ROPE_TOP - ROPE_END) * drop;
      ropeBit.visible = t > 10.4;
      ropeBit.scale.set(1.4, Math.max(len, 0.01), 1.4);
      ropeBit.position.set(RX, RY, ROPE_TOP - len / 2);
      if (!down && t > 11.0 && t < 15.0) {                          // Jack lets go with one hand and stretches for it
        const sh = jack.userData.bones.LeftArm.getWorldPosition(V(0, 0, 0)), dir = V(RX, RY, ROPE_END).sub(sh);
        jack.userData.aim('LeftArm', 'LeftForeArm', dir);
        jack.userData.aim('LeftForeArm', 'LeftHand', dir);
      }
      camKeys([{ t: 0, pos: V(14.5, -12.0, 1.8), look: V(1.6, 0.4, -1.9) }, { t: 5, pos: V(12.5, -10.2, 1.6), look: V(1.6, 0.4, -2.0) },
               { t: 10.0, pos: V(12.5, -10.2, 1.6), look: V(1.6, 0.4, -2.0) }, { t: 11.4, pos: V(8.2, -5.6, -0.4), look: V(2.5, 0.2, -1.5) },
               { t: 15.0, pos: V(8.2, -5.6, -0.4), look: V(2.5, 0.2, -1.5) }, { t: 16.2, pos: V(11.5, -9.4, -1.5), look: V(2.6, 0, -4.4) },
               { t: 18.2, pos: V(11.5, -9.4, -1.5), look: V(2.6, 0, -4.4) }], t);
    } },
  { set: null, dur: 2.6, card: 'Some time later…', caps: [], update() {} },
  { set: 'apartment', dur: 7.4, caps: [[4.9, 7.2, 'Mark', 'Mmm. A perfectly normal-sized cookie.']],
    update(t) {
      place(markRB, MARK_SPOT[0], MARK_SPOT[1], 0.02, faceDir(0.55, -0.85));
      markRB.userData.setPose('idle', t);
      bill.visible = false;
      camKeys([{ t: 0, pos: V(1.6, -2.4, 1.7), look: V(-2.5, 1.0, 0.6) }, { t: 2.6, pos: V(1.2, -3.4, 1.9), look: V(1.2, 2.4, 1.7) },
               { t: 5.0, pos: V(2.3, -4.4, 1.8), look: V(-0.1, 0.45, 0.78) }, { t: 7.4, pos: V(2.1, -4.0, 1.7), look: V(-0.1, 0.45, 0.78) }], t);
    } },
  { set: 'apartment', dur: 17.8,
    caps: [[3.5, 5.4, 'Bill', 'Hello, Mark. How has your estimating been going?'], [5.6, 7.6, 'Mark', 'My estimating is fine. Let me eat my cookie in peace.'],
           [7.8, 9.8, 'Bill', 'Then tell me. How many inches across is that cookie?'], [10.0, 11.4, 'Mark', 'About a quarter inch.'],
           [11.7, 14.6, 'Bill', `It is ${R.cookie} inches wide. You own ${WORD[R.vac]} vacuum cleaners. You can't estimate at all anymore!`],
           [14.9, 17.6, 'Bill', 'Before we train, I need to see how bad it is. Look around your home.']],
    update(t) {
      bill.visible = true;
      const path = [[2.75, 2.25], [2.75, 0.2], BILL_SPOT], T = [0.4, 2.3, 3.2];
      let p = path[0], dir = [0, -1], moving = false;
      if (t >= T[2]) { p = path[2]; dir = [-1, -0.75]; } else if (t > T[0]) {
        const k = t < T[1] ? 0 : 1, u = (t - T[k]) / (T[k + 1] - T[k]);
        p = [path[k][0] + (path[k + 1][0] - path[k][0]) * u, path[k][1] + (path[k + 1][1] - path[k][1]) * u];
        dir = [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]];
        moving = true;
      }
      place(bill, p[0], p[1], 0.02, faceDir(dir[0], dir[1]));
      bill.userData.setPose(moving ? 'run' : 'idle', t);
      place(markRB, MARK_SPOT[0], MARK_SPOT[1], 0.02, t > 3.2 ? faceDir(1, -0.75) : faceDir(0.55, -0.85));
      markRB.userData.setPose('idle', t);
      camKeys([{ t: 0, pos: V(4.4, -5.6, 2.5), look: V(1.3, 0.7, 0.9) }, { t: 4, pos: V(1.5, -5.4, 1.8), look: V(0.45, 0.05, 0.85) },
               { t: 17.8, pos: V(1.2, -5.0, 1.7), look: V(0.45, 0.05, 0.85) }], t);
    } },
];
const CUT_TOTAL = SHOTS.reduce((s, x) => s + x.dur, 0);
function runCut(tAll) {
  let t = tAll, shot = SHOTS[0];
  for (const s of SHOTS) { shot = s; if (t < s.dur) break; t -= s.dur; }
  t = Math.min(t, shot.dur);
  if (shot.set) showSet(shot.set);
  $('card').classList.toggle('hidden', !shot.card);
  if (shot.card) $('card').textContent = shot.card;
  shot.update(t);
  const cap = shot.caps.find((c) => t >= c[0] && t < c[1]);
  $('caption').classList.toggle('hidden', !cap);
  if (cap) {
    const who = $('caption').querySelector('.who');
    who.textContent = cap[2];
    who.className = 'who ' + cap[2].toLowerCase();
    $('caption').querySelector('.text').textContent = cap[3];
  }
}

// ---------- questions ----------
const QUESTIONS = [
  { id: 'table', label: 'Things on the table', ask: "Let's see how bad it is. How many things are on the coffee table?", unit: 'things', answer: R.things, max: 12,
    items: ['giant_cookie', 'shot_glass', 'lamp_6', 'mug', 'remote', 'apple'].slice(0, R.things), perfect: `Congratulations! You can count to ${R.things}!`, solo: true, view: [V(0.9, -3.4, 3.6), V(0.3, 0.75, 0.45)] },
  { id: 'vacuums', label: 'Vacuum cleaners', ask: 'How many vacuum cleaners do you own, Mark?', unit: 'vacuum cleaners', answer: R.vac, max: 20,
    items: vacShown, solo: true, view: [V(2.6, 0.4, 3.6), V(-2.3, 0.75, 0.45)] },
  { id: 'clocks', label: 'Clocks', ask: 'How many clocks are on that wall? None of them agree, by the way.', unit: 'clocks', answer: R.clocks, max: 40,
    items: clockShown, center: true, solo: true, view: [V(2.9, -6.6, 2.0), V(2.9, 2.5, 1.7)] },
  { id: 'cookie', label: 'Cookie width', ask: 'That shot glass is about 2 inches across. How wide is the cookie?', unit: 'inches', answer: R.cookie, max: 40,
    measure: [V(0.1 - R.cookie * IN / 2, 0.72, 0.5), V(0.1 + R.cookie * IN / 2, 0.72, 0.5)], solo: true, view: [V(0.55, -1.5, 2.2), V(0.15, 0.72, 0.45)] },
  { id: 'apart', label: 'Bill to Mark', ask: 'I am 5 foot 9, and you are 5 foot 10. How far apart are we standing? In inches. Please do not say 42 feet.', unit: 'inches', answer: R.apart, max: 200,
    measure: [V(MARK_SPOT[0], MARK_SPOT[1], 0.08), V(BILL_SPOT[0], BILL_SPOT[1], 0.08)], view: [V(0.9, -4.8, 4.0), V((MARK_SPOT[0] + BILL_SPOT[0]) / 2, 0.1, 0.5)] },
  { id: 'pizza', label: 'Pizza boxes', ask: 'How many pizza boxes are in that tower?', unit: 'boxes', answer: R.pizza, max: 60,
    items: names('pizza', R.pizza), last: true, solo: true, view: [V(2.9, -5.9, 1.5), V(3.55, -1.75, 0.62)] },
  { id: 'far', label: `Couch to ${TGT[1]}`, ask: `You are 5 foot 10. How many feet is it from the couch to ${TGT[0]}?`, unit: 'feet', answer: TGT_FT, max: 60,
    measure: [V(COUCH[0], COUCH[1], 0.06), V(TGT[2], TGT[3], 0.06)], solo: true,
    view: TGT[1] === 'TV' ? [V(5.2, 1.9, 2.7), V(-0.7, -0.3, 0.6)] : [V(3.4, -10.0, 9.5), V(2.0, 0.2, 0)] },   // the TV faces the couch, so look from behind the couch
  { id: 'beans', label: 'Jelly beans', ask: 'Last one. The jar that made you the Jellybean King. How many jelly beans?', unit: 'jelly beans', answer: R.beans, max: 600, step: 5,
    bulk: 'jelly_bean_jar', solo: true, view: [V(2.3, -4.6, 1.5), V(2.45, -1.95, 0.5)] },
];
const NEED = 15;                                    // stars (of 24) Bill wants before training starts
const LINES = [
  ['Mark. No.', "You're off the mark, Mark.", 'We have a long road ahead.', 'I am going to pretend I did not hear that.'],
  ["That's… in the same universe, at least.", 'Warmer. Barely.', 'I have seen worse. Today, even.'],
  ["Close. I'll allow it.", 'Not bad. Not good, but not bad.', 'There may be hope for you yet.'],
  ['Exactly right.', 'Spot on, Mark.', 'Now THAT is an estimate.'],
];

// ---------- floating number tags ----------
const tags = [];
function tag(pos, text, big = false) {
  const el = document.createElement('div');
  el.className = 'tag' + (big ? ' big' : '');
  el.textContent = text;
  $('tags').appendChild(el);
  const t = { el, pos };
  tags.push(t);
  return t;
}
function clearTags() { for (const t of tags) t.el.remove(); tags.length = 0; }
function placeTags() {
  for (const t of tags) {
    const p = t.pos.clone().project(camera);
    t.el.style.left = ((p.x * 0.5 + 0.5) * innerWidth) + 'px';
    t.el.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + 'px';
    t.el.style.display = p.z < 1 ? '' : 'none';
  }
}
const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.03), toon(0xffd23f));
tape.visible = false;
sets.apartment.add(tape);

// ---------- game state ----------
const S = { mode: 'load', t: 0, qi: 0, guess: 0, results: [], view: null, viewT: 0, bases: new Map(), line: '' };
const still = Q.has('still');
let audio = null;
function ui(ids) {
  for (const id of ['title', 'card', 'caption', 'skip', 'hud', 'ask', 'verdict', 'results']) $(id).classList.toggle('hidden', !ids.includes(id));
}
function enterTitle() {
  S.mode = 'title'; S.t = 0;
  showSet('apartment');
  bill.visible = false; markRB.visible = true;
  place(markRB, MARK_SPOT[0], MARK_SPOT[1], 0.02, faceDir(0.55, -0.85));
  clearTags(); tape.visible = false;
  ui(['title']);
}
function enterCut(t = 0) { S.mode = 'cut'; S.t = t; controls.enabled = false; markRB.visible = true; ui(['skip']); }
function enterPlay(qi = 0) {
  S.mode = 'ask'; S.qi = qi; S.t = 0;
  if (qi === 0) S.results = [];
  const q = QUESTIONS[qi];
  showSet('apartment');
  bill.visible = markRB.visible = !q.solo;        // when Bill asks about a thing, nobody stands in front of it
  place(bill, BILL_SPOT[0], BILL_SPOT[1], 0.02, faceDir(-1, -0.75));
  place(markRB, MARK_SPOT[0], MARK_SPOT[1], 0.02, faceDir(1, -0.75));
  clearTags(); tape.visible = false;
  S.view = { fromPos: camera.position.clone(), fromLook: controls.target.clone(), pos: q.view[0], look: q.view[1] };
  S.viewT = 0;
  controls.enabled = false;
  ui(['hud', 'ask']);
  $('hud').innerHTML = `<b>Question ${qi + 1} of ${QUESTIONS.length}</b>` + QUESTIONS.map((_, i) => `<div class="pip ${i < qi ? 'done' : i === qi ? 'now' : ''}"></div>`).join('');
  $('ask').querySelector('.q').textContent = q.ask;
  const sl = $('slider');
  sl.min = 0; sl.max = q.max; sl.step = q.step || 1;
  setGuess(0);
  $('unit').textContent = q.unit;
  $('ask').querySelector('.hint').textContent = RULE;
}
function setGuess(v) {
  const q = QUESTIONS[S.qi];
  S.guess = clamp(Math.round(v / (q.step || 1)) * (q.step || 1), 0, q.max);
  $('val').textContent = S.guess;
  $('slider').value = S.guess;
}
function enterReveal() { S.mode = 'reveal'; S.t = 0; ui(['hud']); }
function revealDur(q) {
  if (q.items) return q.items.length * clamp(2.4 / q.items.length, 0.14, 0.5) + 0.7;
  return q.measure ? 2.2 : 3.0;
}
function runReveal(q, t) {
  clearTags();
  if (q.items) {
    const dt = clamp(2.4 / q.items.length, 0.14, 0.5);
    q.items.forEach((n, i) => {
      const o = obj(n);
      if (!S.bases.has(n)) S.bases.set(n, o.scale.clone());
      const u = (t - i * dt) / 0.3;
      o.scale.copy(S.bases.get(n)).multiplyScalar(u > 0 && u < 1 ? 1 + 0.22 * Math.sin(Math.PI * u) : 1);
      const shown = Math.min(q.items.length, Math.floor(t / dt) + 1);
      if (q.last ? i === shown - 1 : u > 0) {
        const tg = tag(q.center ? new THREE.Box3().setFromObject(o).getCenter(V(0, 0, 0)) : topOf(o), String(i + 1), i === q.items.length - 1 && t > q.items.length * dt);
        if (q.center) tg.el.style.transform = 'translate(-50%, -50%)';
      }
    });
  } else if (q.measure) {
    const [a, b] = q.measure, u = ease(t / 1.5);
    const end = a.clone().lerp(b, u), mid = a.clone().lerp(end, 0.5), len = a.distanceTo(end);
    tape.visible = true;
    tape.position.copy(mid);
    tape.scale.set(Math.max(len, 0.001), 1, 1);
    if (q.vertical) tape.rotation.set(0, -Math.PI / 2, 0); else tape.rotation.set(0, 0, Math.atan2(b.y - a.y, b.x - a.x));
    tag(q.vertical ? end.clone().add(V(0, 0, 0.3)) : mid.clone().add(V(0, 0, 0.12)), `${Math.round(q.answer * u)} ${q.unit}`, u >= 1);
  } else {
    const u = ease(t / 2.3);
    tag(topOf(obj(q.bulk), 0.1), String(Math.round(q.answer * u)), u >= 1);
  }
}
function enterVerdict() {
  const q = QUESTIONS[S.qi], { off, stars: st } = pctStars(S.guess, q.answer);
  S.mode = 'verdict';
  S.results[S.qi] = { guess: S.guess, stars: st };
  runReveal(q, 99);
  const pool = LINES[st];
  S.line = st === 3 && q.perfect ? q.perfect : pool[(S.qi + S.guess) % pool.length];
  ui(['hud', 'verdict']);
  $('verdict').querySelector('.line').textContent = S.line;
  $('verdict').querySelector('.nums').textContent = `You said ${S.guess}. It's ${q.answer} ${q.unit}. ${offText(off)}`;
  $('verdict').querySelector('.stars').innerHTML = starText(st);
  $('next').textContent = S.qi === QUESTIONS.length - 1 ? 'See how I did' : 'Next';
  controls.enabled = true;
}
function enterResults() {
  S.mode = 'results';
  showSet('apartment');
  bill.visible = markRB.visible = true;
  clearTags(); tape.visible = false;
  ui(['results']);
  showResults($('results'), QUESTIONS.map((q, i) => ({ label: q.label, detail: `${S.results[i].guess} / ${q.answer}`, stars: S.results[i].stars })),
    { need: NEED, next: './level2.html', nextLabel: 'Level 2: Training ▸',
      passQuote: '“Rusty. But I can work with rusty. Training starts at 6.”', aceQuote: '“So it is still in there somewhere. Good. Training starts at 6.”',
      failQuote: '“I cannot train this. Look around again.”' });
  S.view = { fromPos: camera.position.clone(), fromLook: controls.target.clone(), pos: V(6.6, -8.2, 5.4), look: V(0.1, 0.6, 0.75) };
  S.viewT = 0;
}

// ---------- input ----------
function music() { if (audio) return; audio = shell.audio = startMusic(S.mode === 'cut' ? 'drama' : 'home', SET.music); }
$('play').onclick = () => { if (SET.skipCuts) enterPlay(0); else enterCut(0); music(); };
for (const ev of ['pointerdown', 'touchend', 'click']) addEventListener(ev, music, { once: true });
$('skip').onclick = () => enterPlay(0);
$('slider').oninput = (e) => setGuess(+e.target.value);
$('minus').onclick = () => setGuess(S.guess - (QUESTIONS[S.qi].step || 1));
$('plus').onclick = () => setGuess(S.guess + (QUESTIONS[S.qi].step || 1));
$('lock').onclick = enterReveal;
$('next').onclick = () => (S.qi === QUESTIONS.length - 1 ? enterResults() : enterPlay(S.qi + 1));
$('again').onclick = () => { location.href = location.pathname + '?start=play'; };   // reload: every play draws new numbers
addEventListener('keydown', (e) => {
  if (shell.paused) return;
  if (S.mode === 'ask') {
    const st = QUESTIONS[S.qi].step || 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setGuess(S.guess + st);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setGuess(S.guess - st);
    if (e.key === 'Enter') enterReveal();
  } else if (S.mode === 'verdict' && e.key === 'Enter') $('next').click();
});

// ---------- main loop ----------
function moveView(dt) {
  if (!S.view) return;
  S.viewT = Math.min(1, S.viewT + dt / 0.9);
  const u = ease(S.viewT);
  camera.position.lerpVectors(S.view.fromPos, S.view.pos, u);
  controls.target.lerpVectors(S.view.fromLook, S.view.look, u);
  camera.lookAt(controls.target);
  if (S.viewT >= 1) { S.view = null; controls.enabled = S.mode !== 'results'; }
}
const clock = new THREE.Clock(), frame = {};
let frames = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1) * (still || shell.paused ? 0 : 1);
  S.t += dt;
  if (audio) audio.setMood(S.mode === 'cut' ? 'drama' : 'home');
  if (S.mode === 'title') {
    const a = 0.64 + 0.22 * Math.sin(S.t * 0.25);
    camera.position.set(0.1 + Math.sin(a) * 12.4, 0.6 - Math.cos(a) * 12.4, 5.4);
    camera.lookAt(0.1, 0.6, 0.75);
    markRB.userData.setPose('idle', S.t);
  } else if (S.mode === 'cut') {
    runCut(S.t);
    if (S.t >= CUT_TOTAL && !still) enterPlay(0);
  } else {
    if (S.mode === 'ask') {                            // from the third question on there is a clock; when it runs out the dial is locked in
      const lim = [0, 0, 20, 18, 16, 14, 14, 12][S.qi] * DIFF.clock, left = lim - S.t;
      $('lock').textContent = lim ? `That's my estimate · ${Math.max(0, Math.ceil(left))}` : "That's my estimate";
      if (lim && left <= 0 && !still) enterReveal();
    }
    markRB.userData.setPose('idle', S.t + 5);
    bill.userData.setPose('idle', S.t + 5.6);
    if (S.view) moveView(still ? 1 : dt); else if (controls.enabled && !shell.paused) controls.update();
    if (S.mode === 'reveal') {
      const q = QUESTIONS[S.qi];
      runReveal(q, S.t);
      if (S.t >= revealDur(q) && !still) enterVerdict();
    }
  }
  const playing = ['ask', 'reveal', 'verdict'].includes(S.mode);
  frameView(camera, frame, { playing, panel: S.mode === 'ask' ? $('ask') : S.mode === 'verdict' ? $('verdict') : null, cine: S.mode === 'cut', snap: still });
  if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
  placeTags();
  if (Q.has('noink')) renderer.render(scene, camera); else ink.render(scene, camera);
  if (++frames === 3) document.title = 'ready';
}

// ---------- start (with debug entry points) ----------
controls.target.set(0.1, 0.6, 0.75);
camera.position.set(6.6, -8.2, 5.4);
const start = Q.get('start');
if (start === 'cut') {
  const n = +(Q.get('shot') || 0);
  enterCut(SHOTS.slice(0, n).reduce((s, x) => s + x.dur, 0) + +(Q.get('t') || 0));
} else if (start === 'play') {
  enterPlay(+(Q.get('q') || 0));
  if (Q.has('guess')) setGuess(+Q.get('guess'));
  if (Q.has('rt')) { enterReveal(); S.t = +Q.get('rt'); }
  if (Q.has('verdict')) enterVerdict();
} else if (start === 'results') {
  S.results = QUESTIONS.map((q, i) => { const g = Math.round(q.answer * (0.6 + 0.08 * i)); return { guess: g, stars: pctStars(g, q.answer).stars }; });
  enterResults();
} else enterTitle();
initShell(1);
renderer.setAnimationLoop(tick);
