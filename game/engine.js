// Shared engine for the challenge levels (Level 2 indoors, Level 3 on the playground).
// A level supplies its set, cast and a build(ctx) that returns its challenges; the engine runs
// title -> cutscene -> challenges (set up, watch it play out, verdict) -> results, with one scoring rule and a pass mark.
// World is Z-up, metres.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonify, toonRamp, InkRenderer } from './toon.js';
import { loadCharacter } from './cast.js';
import { starText, showResults } from './scoring.js';
import { startMusic } from './music.js';
import { SET, DIFF, levelOf } from './settings.js';
import { shell, view, fit, initShell, graphics, frameView, pinchZoom } from './shell.js';

// debug: ?start=cut&t=7&still=1, ?start=play&q=1&guess=5&rt=1.5&still=1, ?start=play&q=3&live=2&press=1.1,2.2&still=1,
//        ?start=results, ?sim=8 (fast-forward 8 s), &auto=1 (click through), ?cam=x,y,z,lx,ly,lz
export async function runLevel(cfg) {
  const Q = new URLSearchParams(location.search);
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
  scene.background = new THREE.Color(cfg.sky);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 140);
  camera.up.set(0, 0, 1);
  const camLook = V(0, 0.5, 1);
  scene.add(new THREE.HemisphereLight(0xfff8e8, cfg.indoor ? 0x8a7a92 : 0x8fa07a, cfg.indoor ? 1.15 : 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  graphics(renderer, sun);
  const aimSun = (p) => { sun.target.position.set(p.x, p.y, 0); sun.position.set(p.x + 6, p.y - 8, 12); };
  if (cfg.indoor) { sun.target.position.set(2.5, 0, 0); sun.position.set(7, -6.5, 8.5); }
  const ink = new InkRenderer(renderer);
  function resize() {
    renderer.setSize(view.w, view.h);
    ink.setSize(view.w, view.h);
    camera.aspect = view.w / view.h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });

  // ---------- load ----------
  const names = Object.keys(cfg.cast);
  const extra = cfg.extra || [];                   // further sets, placed elsewhere in the world (for an ending somewhere else)
  const [gltf, extras, ...loaded] = await Promise.all([new GLTFLoader().loadAsync(cfg.set), Promise.all(extra.map((e) => new GLTFLoader().loadAsync(e.url))),
    ...names.map((n) => loadCharacter(cfg.cast[n]))]);
  const set = gltf.scene;
  set.rotation.x = Math.PI / 2;                    // glTF is Y-up
  scene.add(toonify(set));
  extras.forEach((g, i) => { g.scene.rotation.x = Math.PI / 2; g.scene.position.set(...extra[i].at); scene.add(toonify(g.scene)); });
  for (const n of cfg.noShadow || []) set.getObjectByName(n)?.traverse((o) => { o.castShadow = false; });
  const chars = {};
  names.forEach((n, i) => { chars[n] = loaded[i]; scene.add(loaded[i]); });
  scene.updateMatrixWorld(true);
  if (cfg.indoor) set.traverse((o) => {            // every lamp gets a warm light at its shade
    if (!/^lamp_\d+$/.test(o.name)) return;
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(V(0, 0, 0));
    const l = new THREE.PointLight(0xffd9a0, 0.55, 3.0, 1.4);
    l.position.set(c.x, c.y, b.max.z - 0.12);
    scene.add(l);
  });

  function place(c, x, y, z, yaw) { c.position.set(x, y, z); c.rotation.set(0, 0, yaw); }
  const faceDir = (dx, dy) => Math.atan2(dx, -dy);   // yaw that makes a character look along (dx, dy)
  function aimArm(c, side, dir) {                    // straight arm along a world direction
    c.userData.aim(side + 'Arm', side + 'ForeArm', dir);
    c.userData.aim(side + 'ForeArm', side + 'Hand', dir);
  }
  function reach(c, target, spread = 0.2) {          // both arms straight out towards a point
    for (const s of ['Left', 'Right']) {
      c.updateMatrixWorld(true);
      const sh = c.userData.bones[s + 'Arm'].getWorldPosition(V(0, 0, 0));
      const side = V(-Math.cos(c.rotation.z), -Math.sin(c.rotation.z), 0).multiplyScalar(s === 'Left' ? -spread : spread);
      aimArm(c, s, target.clone().add(side).sub(sh));
    }
  }

  // ---------- floating tags ----------
  const tags = [];
  function tag(pos, text, big = false) {
    const el = document.createElement('div');
    el.className = 'tag' + (big ? ' big' : '');
    el.textContent = text;
    $('tags').appendChild(el);
    tags.push({ el, pos });
  }
  function clearTags() { for (const t of tags) t.el.remove(); tags.length = 0; }
  function placeTags() {
    const placed = [];
    for (const t of tags) {                           // keep labels on screen, below the HUD, and off each other
      const p = t.pos.clone().project(camera), w = t.el.offsetWidth || 160, h = t.el.offsetHeight || 40;
      let x = clamp((p.x * 0.5 + 0.5) * view.w, w / 2 + 8, Math.max(w / 2 + 8, (S.mode === 'ask' || S.mode === 'verdict' ? frame.r || view.w : view.w) - w / 2 - 8));
      let y = Math.max((-p.y * 0.5 + 0.5) * view.h, (frame.t || 0) + 6 + h);
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 6 && Math.abs(q.y - y) < Math.max(q.h, h) + 6);
        if (!hit) break;
        y = hit.y + Math.max(hit.h, h) + 8;
      }
      placed.push({ x, y, w, h });
      t.el.style.left = x + 'px';
      t.el.style.top = y + 'px';
      t.el.style.display = p.z < 1 ? '' : 'none';
    }
  }

  function sit(c, x, y, seatZ, yaw, t = 0) {            // seated on a chair whose seat is at seatZ, facing yaw
    c.userData.setPose('idle', t);
    place(c, x, y, 0, yaw);
    c.updateMatrixWorld(true);
    const b = c.userData.bones, hip = b.LeftUpLeg.getWorldPosition(V(0, 0, 0)).z, knee = b.LeftLeg.getWorldPosition(V(0, 0, 0)).z;
    c.position.z = seatZ + 0.07 - hip;
    const fwd = V(Math.sin(yaw), -Math.cos(yaw), -0.08);
    for (const sd of ['Left', 'Right']) { c.userData.aim(sd + 'UpLeg', sd + 'Leg', fwd); c.userData.aim(sd + 'Leg', sd + 'Foot', V(fwd.x * 0.1, fwd.y * 0.1, -1)); }
    return hip - knee;
  }
  // a camera that looks at the stretch from a to b side-on, so both ends sit left and right across the picture
  function across(ax, ay, bx, by, side = -1) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let nx = -dy / len, ny = dx / len;
    if (Math.sign(ny || -1) !== side) { nx = -nx; ny = -ny; }
    const mx = (ax + bx) / 2, my = (ay + by) / 2, d = 1.1 * len + 5;
    return [V(mx + nx * d, my + ny * d, 0.75 * len + 4), V(mx, my, 0.3)];
  }
  const L = cfg.build({ THREE, scene, set, chars, camera, camLook, aimSun, toon, V, clamp, ease, place, faceDir, aimArm, reach, sit, tag, across, $ });
  const CH = L.CH;
  const LINES = cfg.lines || [
    ['Mark. No.', "You're off the mark, Mark.", 'I am going to pretend I did not see that.', 'We will be here a while.'],
    ["That's… in the right neighbourhood, at least.", 'Warmer. Barely.', 'I have seen worse. Today, even.'],
    ["Close. I'll allow it.", 'Not bad. Not good, but not bad.', 'There may be hope for you yet.'],
    ['Now THAT is an estimate.', 'Spot on, Mark.', 'You are starting to scare me. Good.'],
  ];
  const num = (x) => String(Number(x.toFixed(2)));

  // ---------- game state ----------
  const S = { mode: 'load', t: 0, qi: 0, guess: 0, presses: [], endT: 0, results: [], view: null, viewT: 0 };
  const still = Q.has('still');
  let audio = null;
  function ui(ids) {
    for (const id of ['title', 'card', 'caption', 'skip', 'hud', 'ask', 'act', 'verdict', 'results']) $(id).classList.toggle('hidden', !ids.includes(id));
    if (L.ui) L.ui(S.mode);
  }
  function setView(pos, look) { S.view = { fromPos: camera.position.clone(), fromLook: camLook.clone(), pos, look }; S.viewT = 0; }
  function moveView(dt) {
    if (!S.view) return;
    S.viewT = Math.min(1, S.viewT + dt / 1.0);
    const u = ease(S.viewT);
    camera.position.lerpVectors(S.view.fromPos, S.view.pos, u);
    camLook.lerpVectors(S.view.fromLook, S.view.look, u);
    camera.lookAt(camLook);
    if (!cfg.indoor) aimSun(camLook);
    if (S.viewT >= 1) S.view = null;
  }
  function hud() {
    const tl = cfg.rival ? `<b class="tally">Mark ${tally()[0]} · ${cfg.rival} ${tally()[1]}</b>` : '';
    $('hud').innerHTML = `<b>Challenge ${S.qi + 1} of ${CH.length}</b>` + tl + CH.map((_, i) => `<div class="pip ${i < S.qi ? 'done' : i === S.qi ? 'now' : ''}"></div>`).join('');
  }
  function tally() {                                   // head to head: who was closer on each challenge so far
    let m = 0, r = 0;
    for (const x of S.results) { if (x && x.rival === 'win') m++; if (x && x.rival === 'lose') r++; }
    return [m, r];
  }
  function setWho(c) {
    const w = c.who || cfg.asker || 'Bill';
    for (const id of ['ask', 'verdict']) { const el = $(id).querySelector('.who'); el.textContent = id === 'verdict' ? (cfg.judge || w) : w; el.className = 'who ' + el.textContent.toLowerCase().split(' ').pop(); }
  }
  function enterOut(t = 0) { S.mode = 'out'; S.t = t; L.reset(); ui(['skip']); }
  function enterTitle() { S.mode = 'title'; S.t = 0; L.reset(); ui(['title']); }
  function enterCut(t = 0) { S.mode = 'cut'; S.t = t; L.reset(); ui(['skip']); }
  function enterPlay(qi = 0) {
    S.mode = 'ask'; S.qi = qi; S.t = 0; S.presses = [];
    if (qi === 0) S.results = [];
    const c = CH[qi];
    L.reset();
    setView(c.view[0], c.view[1]);
    ui(['hud', 'ask']);
    hud();
    setWho(c);
    $('ask').querySelector('.q').textContent = c.ask;
    $('ask').querySelector('.hint').textContent = c.hint;
    $('ask').classList.toggle('nodial', c.kind === 'live');
    $('lock').textContent = c.lock;
    if (c.dial) {
      const sl = $('slider');
      sl.min = c.dial.min; sl.max = c.dial.max; sl.step = c.dial.step;
      $('unit').textContent = c.dial.unit;
      setGuess(c.dial.start);
    }
  }
  function setGuess(v) {
    const d = CH[S.qi].dial;
    if (!d) return;
    S.guess = clamp(Math.round(v / d.step) * d.step, d.min, d.max);
    $('val').textContent = d.secret ? '?' : num(S.guess);    // some challenges are judged by eye, with no number to read
    $('slider').value = S.guess;
  }
  function actLabel() { const c = CH[S.qi]; $('act').textContent = typeof c.act === 'function' ? c.act(S.presses) : c.act; }
  function go() {                                      // the button on the question panel
    const c = CH[S.qi];
    S.t = 0;
    if (c.kind === 'live') { S.mode = 'live'; ui(['hud', 'act']); actLabel(); } else { S.mode = 'reveal'; ui(['hud']); }
  }
  function act() { if (S.mode === 'live') { CH[S.qi].press(S.t, S.presses); actLabel(); } }
  function enterVerdict() {
    const c = CH[S.qi], r = c.result(S.guess, S.presses);
    S.endT = c.kind === 'live' ? S.t : 99;
    S.mode = 'verdict'; S.t = 0;
    S.results[S.qi] = r;
    ui(['hud', 'verdict']);
    hud();
    $('verdict').querySelector('.line').textContent = r.line || LINES[r.stars][(S.qi + S.guess + S.presses.length) % LINES[r.stars].length];
    $('verdict').querySelector('.nums').textContent = r.nums;
    $('verdict').querySelector('.stars').innerHTML = starText(r.stars);
    $('next').textContent = S.qi === CH.length - 1 ? 'See how I did' : 'Next';
  }
  function enterResults() {
    S.mode = 'results'; S.t = 0;
    L.reset();
    ui(['results']);
    const note = cfg.rival ? `Head to head: Mark ${tally()[0]}, ${cfg.rival} ${tally()[1]}. ` : '';
    showResults($('results'), CH.map((c, i) => ({ label: c.label, detail: S.results[i].short, stars: S.results[i].stars })),
      { ...cfg.results, note, onNext: L.OUT ? () => enterOut(0) : null });
  }

  // ---------- input ----------
  function music() { if (audio) return; audio = shell.audio = startMusic(cfg.mood || 'home', SET.music); }
  $('play').onclick = () => { music(); if (SET.skipCuts) enterPlay(0); else enterCut(0); };
  for (const ev of ['pointerdown', 'touchend', 'click']) addEventListener(ev, music, { once: true });      // after a reload there is no Play button to start it
  $('skip').onclick = () => { if (S.mode === 'out') S.t = L.OUT.dur; else enterPlay(0); };
  // drag to look around while answering; the wheel zooms. Each new question starts from its own view again.
  let drag = null;
  const canLook = () => (S.mode === 'ask' || S.mode === 'verdict') && !S.view && !shell.paused;
  function zoomBy(k) {
    if (!canLook()) return;
    const off = camera.position.clone().sub(camLook), r = clamp(off.length() * clamp(k, 0.8, 1.25), 1.5, 80);
    camera.position.copy(camLook).add(off.setLength(r));
  }
  const pinching = pinchZoom(renderer.domElement, zoomBy);
  renderer.domElement.addEventListener('pointerdown', (e) => { if (canLook()) { drag = [e.clientX, e.clientY]; renderer.domElement.setPointerCapture(e.pointerId); } });
  for (const ev of ['pointerup', 'pointercancel']) renderer.domElement.addEventListener(ev, () => { drag = null; });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag || !canLook()) return;
    if (pinching()) { drag = [e.clientX, e.clientY]; return; }
    const off = camera.position.clone().sub(camLook), r = off.length();
    let az = Math.atan2(off.y, off.x) - (e.clientX - drag[0]) * 0.006, el = Math.asin(clamp(off.z / r, -1, 1)) + (e.clientY - drag[1]) * 0.005;
    el = clamp(el, 0.06, 1.5);
    camera.position.set(camLook.x + r * Math.cos(el) * Math.cos(az), camLook.y + r * Math.cos(el) * Math.sin(az), camLook.z + r * Math.sin(el));
    camera.lookAt(camLook);
    drag = [e.clientX, e.clientY];
  });
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(1 + e.deltaY * 0.001);
  }, { passive: false });
  $('slider').oninput = (e) => setGuess(+e.target.value);
  $('minus').onclick = () => setGuess(S.guess - CH[S.qi].dial.step);
  $('plus').onclick = () => setGuess(S.guess + CH[S.qi].dial.step);
  $('lock').onclick = go;
  $('act').onpointerdown = (e) => { e.preventDefault(); act(); };
  $('next').onclick = () => (S.qi === CH.length - 1 ? enterResults() : enterPlay(S.qi + 1));
  $('again').onclick = () => { location.href = location.pathname + '?start=play'; };   // reload: every play draws new numbers
  $('back').onclick = () => { location.href = cfg.back; };
  addEventListener('keydown', (e) => {
    if (e.repeat || shell.paused) return;
    if (S.mode === 'ask') {
      const d = CH[S.qi].dial;
      if (d && (e.key === 'ArrowRight' || e.key === 'ArrowUp')) setGuess(S.guess + d.step);
      if (d && (e.key === 'ArrowLeft' || e.key === 'ArrowDown')) setGuess(S.guess - d.step);
      if (e.key === 'Enter') go();
    } else if (S.mode === 'live' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); act(); }
    else if (S.mode === 'verdict' && e.key === 'Enter') $('next').click();
  });

  // ---------- main loop ----------
  const clock = new THREE.Clock(), frame = {};
  let frames = 0;
  function showCap(caps) {
    const cap = caps.find((c) => S.t >= c[0] && S.t < c[1]);
    $('caption').classList.toggle('hidden', !cap);
    if (cap) {
      const who = $('caption').querySelector('.who');
      who.textContent = cap[2];
      who.className = 'who ' + cap[2].toLowerCase().split(' ').pop();
      $('caption').querySelector('.text').textContent = cap[3];
    }
  }
  function step(dt) {                                  // advance the game by dt seconds (no drawing)
    S.t += dt;
    if (audio) audio.setMood(S.mode === 'cut' || (S.mode === 'out' && S.t < (L.OUT.calm ?? 1e9)) ? 'drama' : S.mode === 'out' ? 'home' : (cfg.mood || 'home'));
    clearTags();
    if (S.mode === 'out') {                            // the ending: a cutscene with title cards, stopping on the last card
      const t = Math.min(S.t, L.OUT.dur);
      L.runOut(t);
      S.t = t;
      showCap(L.OUT.caps);
      const card = (L.OUT.cards || []).find((c) => t >= c[0] && t < c[1] + (c[1] >= L.OUT.dur ? 1 : 0));
      $('card').classList.toggle('hidden', !card);
      if (card) $('card').innerHTML = card[2];
      $('skip').classList.toggle('hidden', t >= L.OUT.dur);
      return;
    }
    if (S.mode === 'title' || S.mode === 'results') L.idle(S.t);
    else if (S.mode === 'cut') {
      L.runCut(S.t);
      showCap(L.CUT.caps);
      const card = (L.CUT.cards || []).find((c) => S.t >= c[0] && S.t < c[1]);
      $('card').classList.toggle('hidden', !card);
      if (card) $('card').innerHTML = card[2];
      if (S.t >= L.CUT.dur && !still) enterPlay(0);
    } else {
      const c = CH[S.qi], seen = S.presses.filter((p) => p <= S.t);
      moveView(still ? 1 : dt);
      if (S.mode === 'ask') {
        c.frame('ask', S.t, S.guess, S.presses);
        if (c.limit) {                                 // a clock on the answer: when it runs out, whatever is on the dial is locked in
          const left = (c.limitFrom || 0) + c.limit * DIFF.clock - S.t;
          $('lock').textContent = S.t < (c.limitFrom || 0) ? c.lock : `${c.lock} · ${Math.max(0, Math.ceil(left))}`;
          $('lock').classList.toggle('hurry', left < 4 && left > 0);
          if (left <= 0 && !still) go();
        }
      }
      else if (S.mode === 'live') { c.frame('live', S.t, S.guess, seen); if (!still && c.liveDone(S.t, seen)) enterVerdict(); }
      else if (S.mode === 'reveal') { c.frame('reveal', S.t, S.guess, S.presses); if (!still && S.t >= c.dur(S.guess)) enterVerdict(); }
      else c.frame(c.kind === 'live' ? 'live' : 'reveal', S.endT + S.t, S.guess, S.presses);
    }
  }
  function tick() {
    if (fit()) resize();                               // phone browsers do not always announce a change of size
    const dt = Math.min(clock.getDelta(), 0.1);
    step(still || shell.paused ? 0 : dt);
    const playing = ['ask', 'live', 'reveal', 'verdict'].includes(S.mode);
    const panel = S.mode === 'ask' ? $('ask') : S.mode === 'verdict' ? $('verdict') : S.mode === 'live' ? $('act') : null;
    frameView(camera, frame, { playing, panel, cine: S.mode === 'cut' || S.mode === 'out', snap: still });
    if (Q.has('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
    placeTags();
    if (Q.has('noink')) renderer.render(scene, camera); else ink.render(scene, camera);
    if (++frames === 3) document.title = 'ready';
  }

  // ---------- start (with debug entry points) ----------
  camera.position.copy(cfg.startCam || V(-12, -22, 8));
  const start = Q.get('start');
  if (start === 'cut') enterCut(+(Q.get('t') || 0));
  else if (start === 'out') enterOut(+(Q.get('t') || 0));
  else if (start === 'play') {
    enterPlay(+(Q.get('q') || 0));
    if (Q.has('guess')) setGuess(+Q.get('guess'));
    if (Q.has('at')) S.t = +Q.get('at');
    if (Q.has('press')) S.presses = Q.get('press').split(',').filter(Boolean).map(Number);
    if (Q.has('rt')) { go(); S.t = +Q.get('rt'); }
    if (Q.has('live')) { go(); S.t = +Q.get('live'); }
  } else if (start === 'results') {
    S.results = CH.map((c, i) => ({ stars: (i * 2 + (+Q.get('seed') || 1)) % 4, short: 'sample', rival: i % 2 ? 'win' : 'lose' }));
    enterResults();
  } else enterTitle();
  if (Q.has('sim')) {                                  // test aid: fast-forward; &auto=1 also clicks through
    for (let i = 0; i < +Q.get('sim') * 60; i++) {
      step(1 / 60);
      if (Q.has('auto') && S.mode === 'verdict' && S.t > 0.5) $('next').click();
      if (Q.has('auto') && S.mode === 'ask' && S.t > 0.5) { if (Q.has('press')) S.presses = Q.get('press').split(',').map(Number); go(); }
    }
  }
  initShell(levelOf(location.pathname));
  renderer.setAnimationLoop(tick);
}
