// The Estimator, Level 3: The Playground. The outdoor half of the film's training montage.
// Every challenge is about position or timing, and the answer is shown by the thing actually happening.
import { runLevel } from './engine.js';
import { RULE, pctStars, offText, tiers, tierHint } from './scoring.js';
import { rint, rfloat } from './rng.js';

const FT = 0.3048, G0 = 0.04;                              // metres per foot; height of the gravel pad

runLevel({
  set: './assets/playground.glb', sky: 0x9fd8f0, indoor: false, noShadow: ['grass', 'pad', 'court'], back: './level2.html',
  cast: { mark: 'mark_tr', markB: 'mark_blind', bill: 'bill_camo' }, mood: 'play',
  results: { need: 10, lo: 9, hi: 15, next: './level4.html', nextLabel: 'Level 4: The Appointment ▸', passQuote: '“You are ready for the Underground.”', aceQuote: '“I have nothing left to teach you. The Underground it is.”', failQuote: '“Again. From the swing.”' },
  build(ctx) {
const { THREE, scene, set, chars, camera, camLook, aimSun, toon, V, clamp, ease, tag, $ } = ctx;
const { mark, markB, bill } = chars;
const pg = { scene: set };
const riders = [1, 2, 3].map((i) => pg.scene.getObjectByName('rider_' + i));

// props the game moves
const PIVOT = V(-6, 0.8, 2.45), SL = 1.95;         // the swing: pivot on the top bar, chain length
const sw = new THREE.Group();
sw.position.copy(PIVOT);
for (const sy of [-1, 1]) {
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, SL, 8), toon(0xd5dbe0));
  rod.rotation.x = Math.PI / 2;
  rod.position.set(0, sy * 0.22, -SL / 2);
  sw.add(rod);
}
const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.56, 0.08), toon(0xd9463b));
seat.position.set(0, 0, -SL);
sw.add(seat);
const lane = new THREE.Group();                    // shows where 'the post' is and the line Mark moves along
{
  const line = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.07, 0.012), toon(0xffffff));
  line.position.set(PIVOT.x + 2.3, PIVOT.y, G0 + 0.012);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), toon(0xffd23f));
  dot.rotation.x = Math.PI / 2;
  dot.position.set(PIVOT.x, PIVOT.y, G0 + 0.016);
  lane.add(line, dot);
  scene.add(lane);
}
const setSwing = (th) => { sw.rotation.y = -th; };  // th > 0 swings the seat towards +X
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 28), toon(0xffffff));
const bag = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), toon(0xe5484d));
bag.scale.z = 0.6;
const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.03), toon(0xffd23f));
for (const m of [sw, ring, bag, tape]) { m.traverse((o) => { o.castShadow = true; }); scene.add(m); }

function place(c, x, y, z, yaw) { c.position.set(x, y, z); c.rotation.set(0, 0, yaw); }
const faceDir = (dx, dy) => Math.atan2(dx, -dy);   // yaw that makes a character look along (dx, dy)
const tmp = V(0, 0, 0);
function reach(c, target, spread = 0.2) {          // both arms straight out towards a point
  for (const s of ['Left', 'Right']) {
    c.updateMatrixWorld(true);
    const sh = c.userData.bones[s + 'Arm'].getWorldPosition(V(0, 0, 0));
    const side = V(-Math.cos(c.rotation.z), -Math.sin(c.rotation.z), 0).multiplyScalar(s === 'Left' ? -spread : spread);
    const dir = target.clone().add(side).sub(sh);
    c.userData.aim(s + 'Arm', s + 'ForeArm', dir);
    c.userData.aim(s + 'ForeArm', s + 'Hand', dir);
  }
}
function billInCar(t) {                             // Bill wedged into the pedal car, timing things
  place(bill, 1.7, 4.7, G0 - 0.2, faceDir(-0.17, -0.98));
  bill.userData.setPose('idle', t + 0.6);
}
function resetProps() {
  setSwing(0);
  ring.visible = bag.visible = tape.visible = lane.visible = false;
  for (const r of riders) r.visible = true;
  markB.visible = false; mark.visible = true; bill.visible = true;
  for (const r of riders) r.rotation.z = 0;
}

const num = (x) => String(Number(x.toFixed(2)));

// Bean bag toss. Say how far away the ring is; Mark throws exactly that far.
const TOSS = [-8.5, -4.2];
function toss(id, label, feet, ask, view) {
  const flight = (g) => 0.75 + 0.022 * g;
  return { id, label, kind: 'dial', ask, view, lock: 'Throw it!', hint: 'For scale: Mark is 5 foot 10.  ' + RULE,
    dial: { min: 1, max: 60, step: 1, start: 1, unit: 'feet' },
    dur: (g) => 0.5 + flight(g) + 2.2,
    frame(phase, t, g) {
      const M = mark, T = flight(g), land = V(TOSS[0] + g * FT, TOSS[1], G0 + 0.05);
      ring.visible = bag.visible = true;
      ring.position.set(TOSS[0] + feet * FT, TOSS[1], G0 + 0.03);
      place(M, TOSS[0], TOSS[1], G0, faceDir(1, 0));
      M.userData.setPose('idle', t);
      place(bill, TOSS[0] - 0.7, TOSS[1] + 1.5, G0, faceDir(1, -0.45));
      bill.userData.setPose('idle', t + 0.6);
      const rt = phase === 'reveal' ? t : 0;
      const wind = ease(rt / 0.4), fwd = ease((rt - 0.4) / 0.14);             // arm back, then forward
      const dir = V(-0.5 * wind + 1.4 * fwd, -0.15, -0.6 + 0.9 * wind + 0.3 * fwd);
      M.userData.aim('RightArm', 'RightForeArm', dir);
      M.userData.aim('RightForeArm', 'RightHand', dir);
      M.updateMatrixWorld(true);
      const hand = M.userData.bones.RightHand.getWorldPosition(V(0, 0, 0));
      const u = (rt - 0.5) / T;
      if (u <= 0) bag.position.copy(hand);
      else if (u < 1) {
        const from = V(TOSS[0] + 0.45, TOSS[1] - 0.2, G0 + 1.45);
        bag.position.lerpVectors(from, land, u);
        bag.position.z += (1.0 + 0.09 * g) * 4 * u * (1 - u);
      } else bag.position.copy(land);
      tape.visible = false;
      if (u >= 1) {
        tag(land.clone().add(V(0, 0, 0.75)), `You: ${g} ft`);
        const k = ease((rt - 0.5 - T - 0.3) / 1.2), len = feet * FT * k;
        if (k > 0) {
          tape.visible = true;
          tape.position.set(TOSS[0] + len / 2, TOSS[1] - 0.55, G0 + 0.03);
          tape.scale.set(Math.max(len, 0.001), 1, 1);
          tape.rotation.z = 0;
          tag(V(TOSS[0] + len, TOSS[1] - 0.55, G0 + 0.3), `${Math.round(feet * k)} feet`, k >= 1);
        }
      }
    },
    result(g) {
      const sc = Math.round(100 * Math.max(0, 1 - Math.abs(g - feet) / (feet * 0.4)));
      const inRing = Math.abs(g - feet) * FT < 0.3;
      return { stars: pctStars(g, feet).stars, short: `${g} / ${feet} ft`, nums: inRing ? `Right in the ring, ${feet} feet away.` : `You threw it ${g} feet. The ring is ${feet} feet away. ${offText(pctStars(g, feet).off)}`,
        line: inRing ? 'In the ring. I felt something. Pride, possibly.' : null };
    } };
}

// The swing. Bill lets it go; stand as close as you dare to where it will stop.
const W = Math.sqrt(9.81 / SL) * 0.93, REL = 0.7;
function swing(id, label, th0, blind, ask, view) {
  const reachX = SL * Math.sin(th0) + 0.12;                                    // how far the front of the seat gets
  const outcome = (g) => {
    const front = g * FT - 0.2, gap = front - reachX;
    const thHit = Math.asin(clamp((front - 0.12) / SL, -1, 1));
    return { gap, hit: gap < 0, thHit, tHit: Math.acos(clamp(-thHit / th0, -1, 1)) / W };
  };
  return { id, label, kind: 'dial', ask, view, lock: 'Let it go, Bill', blind,
    hint: (blind ? 'Higher, and Mark cannot see it coming.' : 'The slider moves Mark.') + '  ' + tierHint(4, 10, 20, 'inches') + ' · hit = none',
    dial: { min: 1.5, max: 14, step: 0.25, start: 14, unit: 'feet from the post' },
    dur: (g) => { const o = outcome(g); return REL + (o.hit ? o.tHit + 2.0 : Math.PI / W + 1.8); },
    frame(phase, t, g) {
      const M = blind ? markB : mark, o = outcome(g);
      mark.visible = !blind; markB.visible = blind; lane.visible = true;
      const tt = phase === 'reveal' ? t - REL : -1;
      let th = -th0, fall = 0;
      if (tt > 0) {
        if (o.hit && tt >= o.tHit) { const a = tt - o.tHit; th = o.thHit * Math.cos(W * a) * Math.exp(-0.9 * a); fall = ease(a / 0.45); }
        else th = -th0 * Math.cos(W * tt) * Math.exp(-0.1 * tt);
      }
      setSwing(th);
      const sx = PIVOT.x - SL * Math.sin(th0), sz = PIVOT.z - SL * Math.cos(th0);  // where Bill holds the seat
      const dz = sz - (G0 + 1.28), dx = Math.sqrt(Math.max(0.02, 0.21 - dz * dz));
      place(bill, sx - dx - 0.08, PIVOT.y, G0, faceDir(1, 0));
      bill.userData.setPose('idle', t + 0.6);
      if (tt <= 0.25) reach(bill, V(sx - 0.1, PIVOT.y, sz), 0.2);
      place(M, PIVOT.x + g * FT + fall * 0.2, PIVOT.y, G0 + fall * 0.14, faceDir(-1, 0));
      M.rotation.y = fall * 1.5;
      M.userData.setPose('idle', t);
      if (o.hit && tt >= o.tHit) tag(V(PIVOT.x + g * FT, PIVOT.y, 2.1), 'BONK!', true);
      if (!o.hit && tt >= Math.PI / W) {
        const inches = Math.round(o.gap / 0.0254);
        tag(V(PIVOT.x + reachX + o.gap / 2, PIVOT.y, sz + 0.55), inches <= 0 ? 'A whisker!' : `${inches} in. to spare`, true);
      }
    },
    result(g) {
      const o = outcome(g), inches = Math.round(o.gap / 0.0254);
      const sc = o.hit ? 0 : Math.round(100 * clamp(1 - (o.gap - 0.05) / 1.0, 0, 1));
      return { stars: o.hit ? 0 : tiers(inches, 4, 10, 20), short: o.hit ? 'hit' : `${inches} in. clear`,
        nums: o.hit ? `You stood ${num(g)} feet from the post. The swing reaches ${num((reachX + 0.2) / FT)}.` : `The swing stopped ${inches} inches from your ${th0 > 0.85 ? 'chin' : 'belly'}.`,
        line: o.hit ? ['That is what the swing is for, Mark.', 'You were supposed to estimate it. Not catch it.'][blind ? 1 : 0] : null };
    } };
}

// The tunnel. Mark runs in at a steady pace; call the moment he comes out the other end.
const TUN = { y: 2.6, x0: 0, v: rfloat(2.1, 3.1), go: 0.7, end: 8.95, exit: 8.4 };
const tunnel = { id: 'tunnel', label: 'The tunnel', kind: 'live', act: 'NOW!', lock: "I'm ready",
  ask: 'Mark runs through the tunnel at a steady pace. Hit NOW! at the exact moment he pops out the far end.',
  hint: 'Watch how fast he covers the open ground.  ' + tierHint(0.1, 0.25, 0.5, 'seconds'), view: [V(5.0, -8.8, 2.4), V(5.0, 2.6, 1.0)],
  tExit: TUN.go + (TUN.exit - TUN.x0) / TUN.v,
  press(t, presses) { if (!presses.length && t > TUN.go) presses.push(t); },
  liveDone(t, presses) { return presses.length ? t > Math.max(this.tExit, presses[0]) + 1.0 : t > this.tExit + 2.2; },
  frame(phase, t, g, presses) {
    const lt = phase === 'live' ? t : 0, x = Math.min(TUN.end, TUN.x0 + TUN.v * Math.max(0, lt - TUN.go));
    const moving = lt > TUN.go && x < TUN.end;
    place(mark, x, TUN.y, G0, faceDir(1, moving ? 0 : -0.6));
    mark.userData.setPose(moving ? 'run' : 'idle', t * 1.15);
    billInCar(t);
    for (const r of riders) r.visible = false;          // they would sit between the camera and the tunnel
    if (presses.length) {
      const err = presses[0] - this.tExit;
      if (lt >= Math.max(this.tExit, presses[0])) tag(V(TUN.exit - 0.9, TUN.y, 2.45), Math.abs(err) < 0.05 ? 'Spot on!' : `${Math.abs(err).toFixed(2)} s ${err < 0 ? 'early' : 'late'}`, true);
      else tag(V(TUN.exit - 0.9, TUN.y, 2.45), 'NOW!');
    } else if (lt > this.tExit + 0.4) tag(V(TUN.exit - 0.9, TUN.y, 2.45), '…Mark?');
  },
  result(g, presses) {
    const err = presses.length ? presses[0] - this.tExit : 9;
    const sc = Math.round(100 * clamp(1 - (Math.abs(err) - 0.05) / 0.9, 0, 1));
    return { stars: tiers(Math.abs(err), 0.1, 0.25, 0.5), short: err === 9 ? 'no call' : `${Math.abs(err).toFixed(2)} s ${err < 0 ? 'early' : 'late'}`,
      nums: err === 9 ? 'You never called it.' : Math.abs(err) < 0.05 ? 'You called it to the twentieth of a second.' : `You called it ${Math.abs(err).toFixed(2)} seconds ${err < 0 ? 'early' : 'late'}.`, line: null };
  } };

// Hurdles over the spring riders. Jump too early or too late and Mark meets a duck.
const HUR = { y: -2.2, x0: -4.0, v: rfloat(2.6, 3.4), go: 0.7, end: 8.3, JL: 2.3, JH: 1.05, c: [0.5, 3.4, 6.0], half: 0.25, need: 0.62, ideal: 1.15 };
const hurdles = { id: 'hurdles', label: 'Hurdles', kind: 'live', act: 'JUMP!', lock: "I'm ready",
  ask: 'Mark runs at the horse, the duck and the plane. Hit JUMP! (or the space bar) to clear each one.',
  hint: 'Too early and he lands on it. Too late and he runs into it. One star for each one cleared.', view: [V(2.2, -23, 3.4), V(2.2, -2.2, 1.0)],
  xAt: (t) => Math.min(HUR.end, HUR.x0 + HUR.v * Math.max(0, t - HUR.go)),
  press(t, presses) { if (t > HUR.go) presses.push(t); },
  jumps(presses) {                                   // take-off points; presses while already in the air are ignored
    const out = [];
    for (const p of presses) { const x = this.xAt(p); if (x < HUR.end && (!out.length || x >= out[out.length - 1] + HUR.JL)) out.push(x); }
    return out;
  },
  height(js, x) { for (const x0 of js) if (x >= x0 && x < x0 + HUR.JL) { const s = (x - x0) / HUR.JL; return 4 * HUR.JH * s * (1 - s); } return 0; },
  judge(js) {                                        // per rider: cleared or not, and how far the take-off was from ideal
    return HUR.c.map((c) => {
      const before = js.filter((x0) => x0 < c - HUR.half);
      const ok = this.height(before, c - HUR.half) >= HUR.need && this.height(before, c + HUR.half) >= HUR.need;
      const x0 = before.length ? before[before.length - 1] : -99;
      return { ok, e: Math.abs(x0 - (c - HUR.ideal)) };
    });
  },
  liveDone(t) { return this.xAt(t) >= HUR.end && t > HUR.go + (HUR.end - HUR.x0) / HUR.v + 0.6; },
  frame(phase, t, g, presses) {
    const lt = phase === 'live' ? t : 0, x = this.xAt(lt), js = this.jumps(presses.filter((p) => p <= lt)), res = this.judge(js);
    const h = this.height(js, x), moving = lt > HUR.go && x < HUR.end;
    let flip = 0, bump = 0;
    HUR.c.forEach((c, i) => {
      const tb = HUR.go + (c - HUR.half - HUR.x0) / HUR.v, a = lt - tb;      // when he reaches this rider
      riders[i].rotation.z = 0;
      if (a < 0) return;
      const top = V(c, HUR.y, 1.25);
      if (res[i].ok) tag(top, '✓');
      else {
        tag(top, 'BONK!');
        riders[i].rotation.z = 0.5 * Math.sin(13 * a) * Math.exp(-2.5 * a);
        if (a < 0.6) { flip = ease(a / 0.6); bump = Math.sin(Math.PI * a / 0.6); }
      }
    });
    place(mark, x, HUR.y, G0 + h + 0.55 * bump, faceDir(1, moving ? 0 : -0.6));
    mark.rotation.y = flip * Math.PI * 2;
    if (h > 0) { const x0 = js.filter((j) => j <= x).pop(); mark.userData.setPose('jump', 0.05 + 0.44 * (x - x0) / HUR.JL); }
    else mark.userData.setPose(moving ? 'run' : 'idle', t * 1.3);
    place(bill, HUR.x0 - 1.0, HUR.y + 1.6, G0, faceDir(1, -0.5));
    bill.userData.setPose('idle', t + 0.6);
    if (phase === 'live') {                            // close on Mark while he runs; the whole course before and after
      const wide = Math.max(1 - ease(lt / 0.7), ease((lt - HUR.go - (HUR.end - HUR.x0) / HUR.v - 0.2) / 0.9));
      camera.position.lerpVectors(V(x + 2.0, -11.5, 1.5), V(2.2, -23, 3.4), wide);
      camLook.lerpVectors(V(x + 2.0, HUR.y, 1.25), V(2.2, HUR.y, 1.0), wide);
      camera.lookAt(camLook); aimSun(camLook);
    }
  },
  result(g, presses) {
    const res = this.judge(this.jumps(presses)), n = res.filter((r) => r.ok).length;
    const sc = Math.round(res.reduce((s, r) => s + (r.ok ? 100 - 45 * Math.min(1, r.e / 0.486) : 0), 0) / 3);
    return { stars: n, short: `${n} of 3 cleared`, nums: n === 3 ? 'You cleared all three.' : `You cleared ${n} of 3.`,
      line: n === 0 ? 'The duck won. All three of them won.' : null };
  } };

const CH = [
  swing('swing1', 'The swing', rfloat(0.58, 0.8), false, 'I let go of the swing. Stand as close as you can to where it stops, without getting hit.', [V(-5.0, -9.6, 1.9), V(-5.0, 0.8, 1.1)]),
  tunnel,
  hurdles,
  toss('toss2', 'Bean bag, far ring', rint(22, 40), 'You did this on the carpet. Now do it across the playground. How far is the ring?', [V(-14.2, -9.6, 3.6), V(-3.4, -4.2, 0.1)]),
  swing('swing2', 'The swing, blindfolded', rfloat(0.92, 1.1), true, 'Final exam. Higher, and blindfolded. Pick your spot and trust it.', [V(-0.6, -8.8, 2.9), V(-5.2, 0.8, 1.0)]),
];
// ---------- cutscene ----------
const CUT = { dur: 12.6, caps: [[0.8, 5.2, 'Bill', "An estimator's body is his instrument, Mark. Today we train outside."],
  [6.0, 8.1, 'Mark', 'Why are you in a toy car?'], [8.4, 10.3, 'Bill', 'It looked about my size.'], [10.5, 12.4, 'Bill', "It was not. Let's begin."]] };
function runCut(t) {
  billInCar(t);
  place(mark, 0.1, 3.2, G0, faceDir(0.75, 0.25));
  mark.userData.setPose('idle', t);
  if (t < 5.5) {
    const u = ease(t / 5.5);
    camera.position.lerpVectors(V(-15, -16, 7), V(-6, -12.5, 4.2), u);
    camLook.lerpVectors(V(-3, 1, 1), V(0.5, 2.5, 1), u);
  } else {
    const u = ease((t - 5.5) / 7);
    camera.position.lerpVectors(V(-0.6, -2.6, 1.75), V(-0.3, -2.0, 1.65), u);
    camLook.set(1.0, 4.0, 0.9);
  }
  camera.lookAt(camLook);
  aimSun(camLook);
  const cap = CUT.caps.find((c) => t >= c[0] && t < c[1]);
  $('caption').classList.toggle('hidden', !cap);
  if (cap) {
    const who = $('caption').querySelector('.who');
    who.textContent = cap[2];
    who.className = 'who ' + cap[2].toLowerCase();
    $('caption').querySelector('.text').textContent = cap[3];
  }
}


function idle(t) {
  const a = -0.5 + 0.25 * Math.sin(t * 0.2);
  camera.position.set(-1 + Math.sin(a) * 24, 1 - Math.cos(a) * 24, 8);
  camLook.set(-1, 1, 1);
  camera.lookAt(camLook);
  aimSun(camLook);
  billInCar(t);
  place(mark, 0.1, 3.2, G0, faceDir(0.3, -1));
  mark.userData.setPose('idle', t);
}
return { CH, CUT, runCut, idle, reset: resetProps };
  },
});
