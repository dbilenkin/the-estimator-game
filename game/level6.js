// The Estimator, Level 6: The Appointment, Round 3. Freestyle: Mark and Lester in the rope circle, three minutes on the clock.
// Lester asks, with a voice in his ear. Then Bill throws a rock, and Mark gets to ask one back.
import { runLevel } from './engine.js';
import { RULE, pctStars, offText } from './scoring.js';
import { OFFICIAL_LINES, versus, versusText } from './comp.js';
import { rint, rfloat } from './rng.js';

const FT = 0.3048, IN = 0.0254, CM = 0.01;
const ROUND_FT = rint(26, 38), GAP_IN = rint(30, 58), LAP_S = rint(50, 85) / 10, PINE_FT = rint(30, 46), ROPE_CM = rint(26, 48);   // this play's numbers
const C = [3.5, -3.5], RAD = ROUND_FT * FT / (2 * Math.PI);    // the rope circle
const GUARD = [10.6, 4.2], BILL = [rfloat(5.6, 8.0), rfloat(-9.2, -6.4)];
const H = [0, -70];                                     // where Jack and Amy's living room sits, far from the garden

runLevel({
  set: './assets/backyard.glb', sky: 0x9fd8f0, indoor: false, noShadow: ['grass'], back: './level5.html',
  cast: { mark: 'mark_suit', bill: 'bill_suit', lester: 'lester', official: 'official', guard: 'guard', smith: 'smith',
    amy: 'amy', jackH: 'jack_home', markC: 'mark_casual' },
  extra: [{ url: './assets/jackhome.glb', at: [H[0], H[1], 0] }], mood: 'tense',
  asker: 'Lester', judge: 'Official', rival: 'Lester', lines: OFFICIAL_LINES,
  results: { need: 12, lo: 15, hi: 20, title: "The Official's scorecard", next: null, nextLabel: 'The ending ▸',
    passQuote: '“Time!”', failQuote: '“Time. The Underground thanks you, Mr. Markson. Mr. Lesterson, a word.”' },
  build(ctx) {
    const { THREE, scene, set, chars, camera, camLook, aimSun, toon, V, clamp, ease, place, faceDir, aimArm, reach, sit, tag, across } = ctx;
    const { mark, bill, lester, official, guard, smith, amy, jackH, markC } = chars;
    { const rc = set.getObjectByName('rope_circle'), k = RAD / 1.5; rc.scale.set(rc.scale.x * k, rc.scale.y, rc.scale.z * k); }
    { const p = set.getObjectByName('pine_1'); p.scale.multiplyScalar(PINE_FT * FT / 11.58); }
    const bailey = set.getObjectByName('bailey');
    const putSet = (o, x, y, z, yaw = 0) => { o.position.set(x, z, -y); o.rotation.set(0, yaw, 0); };
    const UPY = V(0, 1, 0);
    function stick(m, a, b) {
      const d = b.clone().sub(a), len = d.length();
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(UPY, d.normalize());
      m.scale.set(1, Math.max(len, 0.001), 1);
    }
    const unit = (r, col) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), toon(col));
    const rope = unit(0.03, 0xe8d36a), measure = unit(0.02, 0xffd23f);
    const rock = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), toon(0x8a8a90));
    const earpiece = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), toon(0x111013));
    const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14), toon(0xc9cdd2));
    const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), toon(0x5a3524));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.06), toon(0x2a1a12));
    handle.position.z = 0.21;
    briefcase.add(handle);
    const envelope = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.17), toon(0xffffff));
    for (const m of [rope, measure, rock, earpiece, watch, briefcase, envelope]) { m.castShadow = true; scene.add(m); }

    function armsOnTable(c, yaw) {
      const f = V(Math.sin(yaw), -Math.cos(yaw), 0);
      for (const s of ['Left', 'Right']) { c.userData.aim(s + 'Arm', s + 'ForeArm', V(f.x * 0.35, f.y * 0.35, -1)); c.userData.aim(s + 'ForeArm', s + 'Hand', V(f.x, f.y, -0.05)); }
    }
    function toEar(c, k) {                              // right hand up to the ear
      if (k <= 0) return;
      const yaw = c.rotation.z, f = V(Math.sin(yaw), -Math.cos(yaw), 0), sd = V(Math.cos(yaw), Math.sin(yaw), 0);
      c.userData.aim('RightArm', 'RightForeArm', V(0, 0, -1).lerp(V(sd.x * 0.3 + f.x * 0.3, sd.y * 0.3 + f.y * 0.3, 0.4), k));
      const el = c.userData.bones.RightForeArm.getWorldPosition(V(0, 0, 0)), head = c.userData.bones.Head.getWorldPosition(V(0, 0, 0));
      head.z += 0.12;
      c.userData.aim('RightForeArm', 'RightHand', V(f.x, f.y, -0.05).lerp(head.sub(el).addScaledVector(sd, 0.1), k));
    }
    // everyone in their places for the round; o.guardDown: the security guy is on the ground looking for his earpiece
    function stage(t, o = {}) {
      const mp = o.markAt || [C[0] - 0.62, C[1]], lp = o.lesterAt || [C[0] + 0.62, C[1]];
      place(mark, mp[0], mp[1], 0, faceDir(lp[0] - mp[0], lp[1] - mp[1]));
      mark.userData.setPose('idle', t);
      place(lester, lp[0], lp[1], 0, o.lesterYaw ?? faceDir(mp[0] - lp[0], mp[1] - lp[1]));
      lester.userData.setPose(o.lesterWalk ? 'run' : 'idle', o.lesterWalk ? t * 0.7 : t + 0.5);
      toEar(lester, o.ear || 0);
      const op = o.officialAt || [C[0] + 0.3, C[1] + RAD + 0.7];
      place(official, op[0], op[1], 0, faceDir(C[0] - op[0], C[1] - op[1]));
      official.userData.setPose('idle', t + 0.3);
      aimArm(official, 'Left', V(0.25, -0.6, -0.35));
      const h = official.userData.bones.LeftHand.getWorldPosition(V(0, 0, 0));
      watch.visible = true;
      watch.position.set(h.x, h.y - 0.03, h.z + 0.06);
      place(bill, BILL[0], BILL[1], 0, o.billYaw ?? faceDir(-0.6, 0.8));
      bill.userData.setPose('idle', t + 0.6);
      if (o.guardDown) {
        place(guard, GUARD[0] - 1.3, GUARD[1] - 0.2, 0.25, faceDir(-1, -0.4));
        guard.userData.setPose('idle', t);
        guard.rotation.y = 1.35;
      } else { sit(guard, GUARD[0], GUARD[1], 0.52, 0, t + 0.3); armsOnTable(guard, 0); }
      putSet(bailey, -3.2, 2.2, 0, -0.9);
      for (const c of [smith, amy, jackH, markC]) c.visible = false;
    }
    function reset() {
      for (const m of [rope, measure, rock, earpiece, watch, briefcase, envelope]) m.visible = false;
      for (const c of Object.values(chars)) { c.visible = true; c.rotation.set(0, 0, 0); }
    }

    // ---------- Lester's questions (he answers them himself, with help) ----------
    function question(q) {
      const fmt = q.fmt || ((x) => String(x));
      return { id: q.id, label: q.label, kind: 'dial', who: q.who, ask: q.ask, view: q.view, lock: "That's my estimate", limit: q.limit, limitFrom: q.limitFrom || 0,
        hint: (q.hint ? q.hint + '  ' : '') + RULE, dial: q.dial,
        dur: () => 4.6,
        frame(phase, t, g) {
          const rt = phase === 'reveal' ? t : -1;
          q.stage(phase, t, rt, rt >= 0 && !q.noEar ? ease((rt - 0.2) / 0.35) * (1 - ease((rt - 1.9) / 0.4)) : 0);
          const mp = mark.position, lp = lester.position;
          if (rt >= 0.2) tag(V(mp.x, mp.y, 1.8 + (q.tagUp || 0)), `You: ${fmt(g)}`);
          if (rt >= 1.1) tag(V(lp.x, lp.y, 2.15 + (q.tagUp || 0)), `Lester: ${fmt(q.les)}`);
          if (rt >= 2.4) tag(q.at, `${fmt(q.answer)} ${q.dial.unit}`, true);
        },
        result(g) {
          const r = pctStars(g, q.answer), rv = versus(Math.abs(g - q.answer), Math.abs(q.les - q.answer));
          return { stars: r.stars, rival: rv, short: `${fmt(g)} / ${fmt(q.answer)}`,
            nums: `You said ${fmt(g)}. Lester said ${fmt(q.les)}. It's ${fmt(q.answer)} ${q.dial.unit}. ${offText(r.off)}` + versusText(rv), line: q.line ? q.line(r.stars) : null };
        } };
    }
    const THROW_FT = Math.round(Math.hypot(GUARD[0] - BILL[0], GUARD[1] - BILL[1]) / FT);

    const circle = question({ id: 'circle', label: 'Round the rope', answer: ROUND_FT, les: ROUND_FT, limit: 12,
      ask: 'Let us start simple, Markson. This rope we are standing in. How far is it, all the way round? In feet.', hint: 'For scale: Mark is 5 foot 10.',
      dial: { min: 5, max: 100, step: 1, start: 5, unit: 'feet' }, view: [V(3.5, -10.5, 10.5), V(3.5, -3.3, 0.3)], at: V(C[0], C[1] + RAD, 0.5),
      stage(phase, t, rt, ear) { stage(t, { ear }); } });
    const gap = question({ id: 'gap', label: 'Nose to nose', answer: GAP_IN, les: GAP_IN, limit: 8, tagUp: 0.7,
      ask: 'Too easy? How far is my nose from yours, right now? Inches.', hint: 'For scale: Mark is 5 foot 10.',
      dial: { min: 5, max: 120, step: 1, start: 5, unit: 'inches' }, view: [V(3.5, -11.0, 2.0), V(3.5, -3.5, 1.1)], at: V(C[0], C[1], 2.5),
      stage(phase, t, rt, ear) {
        const half = GAP_IN * IN / 2 + 0.13;
        stage(t, { ear, markAt: [C[0] - half, C[1]], lesterAt: [C[0] + half, C[1]], officialAt: [C[0] + 2.6, C[1] + 1.6] });
        measure.visible = rt >= 2.4;
        if (measure.visible) stick(measure, V(C[0] - GAP_IN * IN / 2, C[1], 1.45), V(C[0] + GAP_IN * IN / 2, C[1], 1.45));
      } });
    const lap = question({ id: 'lap', label: "Lester's lap", answer: LAP_S, les: LAP_S, limit: 8, limitFrom: 2.2 + LAP_S, fmt: (x) => x.toFixed(1),
      ask: 'I am going to walk once round you. How long did it take me? To the tenth of a second.', hint: 'He starts and stops behind the Official.',
      dial: { min: 0.5, max: 15, step: 0.1, start: 0.5, unit: 'seconds' }, view: [V(3.5, -10.5, 5.2), V(3.5, -3.2, 0.7)], at: V(C[0], C[1] + 1.1, 2.3),
      stage(phase, t, rt, ear) {
        const lt = phase === 'ask' ? t : 99, u = clamp((lt - 1.6) / LAP_S, 0, 1), a = Math.PI / 2 + u * 2 * Math.PI, R = Math.min(1.05, RAD - 0.2);
        const walking = u > 0 && u < 1;
        stage(t, { ear, markAt: [C[0], C[1]], lesterAt: [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)], lesterWalk: walking,
          lesterYaw: walking ? faceDir(-Math.sin(a), Math.cos(a)) : faceDir(0, -1) });
        mark.rotation.z = faceDir(0, 1);
        if (phase === 'ask' && lt < 1.6) tag(V(C[0], C[1] + R, 2.1), 'Ready…');
      } });
    const pine = question({ id: 'pine', label: 'The pine', answer: PINE_FT, les: PINE_FT, limit: 10,
      ask: 'That pine behind the Official. The tall one in the middle. How tall? Feet. Give me something to laugh at.', hint: 'For scale: the white shed with the dark roof is 10 feet tall, and Mark is 5 foot 10.',
      dial: { min: 5, max: 150, step: 1, start: 5, unit: 'feet' }, view: [V(3.5, -56, 3.0), V(3.6, 4, 5.8)], at: V(7.4, 7.0, 8.5),
      stage(phase, t, rt, ear) {
        stage(t, { ear });
        measure.visible = rt >= 2.4;
        if (measure.visible) stick(measure, V(5.6, 7.0, 0), V(5.6, 7.0, PINE_FT * FT * ease((rt - 2.4) / 1.2)));
      } });

    // Bill's throw: one rock, at the security guy's earpiece
    const flightT = (g) => 0.9 + 0.012 * g;
    const toss = { id: 'rock', label: "Bill's throw", kind: 'dial', who: 'Bill', lock: 'Throw it', limit: 12, view: across(BILL[0], BILL[1], GUARD[0], GUARD[1], 1),
      ask: '(Bill, to himself.) The security guy is feeding Lester every answer. One rock, at that earpiece. How far is he? In feet.',
      hint: 'For this one throw, you are Bill. For scale: Bill is 5 foot 9.  ' + RULE,
      dial: { min: 5, max: 120, step: 1, start: 5, unit: 'feet' },
      dur(g) { return 0.5 + flightT(g) + (pctStars(g, THROW_FT).stars === 3 ? 2.6 : 5.2); },
      frame(phase, t, g) {
        const rt = phase === 'reveal' ? t : 0, T = flightT(g), hit = pctStars(g, THROW_FT).stars === 3;
        const dir = V(GUARD[0] - BILL[0], GUARD[1] - BILL[1], 0).normalize();
        const t2 = 0.5 + T + 1.6, T2 = flightT(THROW_FT);                    // the second rock, if the first one missed
        const pinged = hit ? rt >= 0.5 + T : rt >= t2 + 0.5 + T2;
        stage(t, { billYaw: faceDir(dir.x, dir.y), guardDown: pinged, ear: pinged ? 1 : 0 });
        tag(V(GUARD[0], GUARD[1], 2.3), pinged ? 'Earpiece out!' : 'Security guy');
        if (phase === 'ask') tag(V(BILL[0], BILL[1], 2.3), 'Bill (you)');
        const head = V(GUARD[0], GUARD[1] - 0.05, 1.3);
        function arc(r0, T_, ft) {                                            // returns true once landed
          const wind = ease(r0 / 0.35), fwd = ease((r0 - 0.35) / 0.15);
          if (r0 < 0.9) aimArm(bill, 'Right', V(dir.x * (-0.5 * wind + 1.4 * fwd), dir.y * (-0.5 * wind + 1.4 * fwd), -0.6 + 0.9 * wind + 0.3 * fwd));
          const u = (r0 - 0.5) / T_, from = V(BILL[0] + dir.x * 0.4, BILL[1] + dir.y * 0.4, 1.3);
          const land = Math.abs(ft - THROW_FT) / THROW_FT <= 0.1 ? head.clone() : V(BILL[0] + dir.x * ft * FT, BILL[1] + dir.y * ft * FT, 0.07);
          rock.visible = true;
          if (u <= 0) rock.position.copy(bill.userData.bones.RightHand.getWorldPosition(V(0, 0, 0)));
          else if (u < 1) { rock.position.lerpVectors(from, land, u); rock.position.z += (1.2 + 0.05 * ft) * 4 * u * (1 - u); }
          else rock.position.copy(land);
          return u >= 1;
        }
        if (phase === 'ask') { rock.visible = true; aimArm(bill, 'Right', V(dir.x * 0.4, dir.y * 0.4, -0.8)); rock.position.copy(bill.userData.bones.RightHand.getWorldPosition(V(0, 0, 0))); }
        else if (hit || rt < t2) {
          if (arc(rt, T, g)) tag(hit ? head.clone().add(V(0, 0, 0.6)) : rock.position.clone().add(V(0, 0, 0.5)), hit ? 'PING!' : `You: ${g} ft`, hit);
        } else if (arc(rt - t2, T2, THROW_FT)) tag(head.clone().add(V(0, 0, 0.6)), 'Second rock: PING!', true);
        else tag(V(BILL[0], BILL[1], 1.9), `It was ${THROW_FT} feet. Again.`);
        earpiece.visible = pinged;
        earpiece.position.set(GUARD[0] - 2.0, GUARD[1] - 0.9, 0.08);
      },
      result(g) {
        const r = pctStars(g, THROW_FT);
        return { stars: r.stars, short: `${g} / ${THROW_FT} ft`, nums: `You threw ${g} feet. He is ${THROW_FT} feet away. ${offText(r.off)}` + (r.stars === 3 ? '' : ' The second rock got him.'),
          line: r.stars === 3 ? '(Bill.) “Bingo, Bill. Still got it!”' : '(Bill.) “C’mon, Mark, he’s out of answers!”' };
      } };

    function dangle() {                                 // Lester holds the cut piece out at arm's length; it hangs straight down
      aimArm(lester, 'Right', V(-0.75, -0.55, 0.42));
      const h = lester.userData.bones.RightHand.getWorldPosition(V(0, 0, 0));
      rope.visible = true;
      stick(rope, V(h.x, h.y, h.z - 0.02), V(h.x, h.y, h.z - 0.02 - ROPE_CM * CM));
      return h;
    }
    // the last question is Mark's own
    const HOLD = [C[0] + 0.25, C[1] - 0.25];
    const last = question({ id: 'rope', label: 'The piece of rope', who: 'Official', answer: ROPE_CM, les: 61, limit: 10, noEar: true,
      ask: 'Ten seconds! Mr. Lesterson says two feet. Mr. Markson, your own question: how long is that piece of rope? In centimetres.',
      hint: 'Two feet is 61 centimetres. For scale: Lester is 5 foot 11, and his head is about 30 centimetres tall.',
      dial: { min: 5, max: 120, step: 1, start: 5, unit: 'centimetres' }, view: [V(2.9, -7.6, 1.75), V(3.75, -3.6, 1.1)], at: V(HOLD[0], HOLD[1] - 0.3, 1.95),
      line: (stars) => (stars === 3 ? `(Mark.) “${ROPE_CM - 1}.76241328 centimetres. On the mark.”` : null),
      stage(phase, t, rt) {
        stage(t, { guardDown: true, markAt: [C[0] - 0.85, C[1] + 0.1], lesterAt: [C[0] + 0.75, C[1] + 0.1], lesterYaw: faceDir(-0.5, -1) });
        dangle();
        earpiece.visible = true;
        earpiece.position.set(GUARD[0] - 2.0, GUARD[1] - 0.9, 0.08);
      } });

    const CH = [circle, gap, lap, pine, toss, last];

    // ---------- cutscene: the corner, then the circle ----------
    const CUT = { dur: 35.6, caps: [
      [0.6, 4.6, 'Bill', 'All right, Mark, I think you took the edge in the physical part. And I think I know why.'],
      [4.8, 6.6, 'Mark', 'The training paid off, I know—'],
      [6.8, 13.4, 'Bill', 'Yes, but did you notice the security guard suddenly stopped all of his “busy work”? He can’t help Lester with the physical stuff. He’s feeding him real answers for everything else.'],
      [13.6, 15.8, 'Mark', "What? That's crazy, man. What do we do?"],
      [16.0, 20.4, 'Bill', "Let me worry about the security. Just focus. You're better than Lester."],
      [21.4, 25.2, 'Official', 'Freestyle round, gentlemen. Three minutes on the clock. Begin.'],
      [25.6, 28.2, 'Lester', 'What is the volume of that pond, Mark?'],
      [28.4, 30.4, 'Mark', '3,760,000 gallons.'],
      [30.6, 35.0, 'Lester', 'You have to do better than that, Markson. 3,850,400 gallons.'],
          ] };
    function runCut(t) {
      reset();
      stage(t, { ear: t > 30.4 && t < 32 ? 1 : 0 });
      if (t < 20.8) {
        place(mark, -1.6, -6.4, 0, faceDir(-1, 0.2));
        mark.userData.setPose('idle', t);
        place(bill, -2.6, -6.1, 0, t > 7 && t < 9.5 ? faceDir(1, 0.85) : faceDir(1, -0.2));
        bill.userData.setPose('idle', t + 0.6);
        place(lester, C[0] + 0.62, C[1], 0, faceDir(-1, -0.6));
        if (t > 7 && t < 13.4) { camera.position.set(5.4, -3.4, 1.9); camLook.set(10.5, 3.9, 0.95); camera.fov = 30; }
        else { const u = ease(t / 20); camera.position.lerpVectors(V(-1.8, -11.4, 1.9), V(-2.4, -10.8, 1.75), u); camLook.set(-2.1, -6.2, 1.05); camera.fov = 30; }
      } else {
        camera.fov = 30;
        const u = ease((t - 20.8) / 18);
        camera.position.lerpVectors(V(3.5, -10.6, 2.6), V(2.6, -9.2, 2.0), u);
        camLook.set(3.5, -3.2, 1.0);
      }
      camera.updateProjectionMatrix();
      camera.lookAt(camLook);
      aimSun(camLook);
    }

    // ---------- the ending ----------
    const OUT = { dur: 55, calm: 32.5, caps: [
      [0.4, 1.8, 'Official', 'Time!'],
      [6.0, 10.2, 'Mystery Guyson', 'That is correct, Mark. Within a few angstroms.'],
      [10.5, 14.6, 'Official', "That's impossible! No one can estimate length to an atomic level!"],
      [14.9, 16.4, 'Mystery Guyson', 'Until now.'],
      [16.8, 21.0, 'Mystery Guyson', 'Congratulations, Mark Markson, and welcome to the Underground.'],
      [21.3, 24.4, 'Mystery Guyson', 'This belongs to you. Invest it well.'],
      [26.0, 28.4, 'Mark', 'Good arm… for an old coach.'],
      [28.7, 31.4, 'Bill', 'Good guess… for a new Estimator.'],
      [40.5, 43.1, 'Jack', "Man, I don't know what to say."],
      [43.5, 50.5, 'Mark', "Just focus on getting well and healing up after the surgery. There's always more rocks to climb, buddy… and we got plenty of extra rope."],
    ], cards: [
      [32.5, 35.0, 'A few days later…'],
      [51.5, 55, 'THE END'],
    ] };
    function runOut(t) {
      reset();
      camera.fov = 30;
      if (t < 32.5) {
        stage(t, { guardDown: true, markAt: [C[0] - 0.85, C[1] + 0.1], lesterAt: [C[0] + 0.75, C[1] + 0.1], lesterYaw: t > 4 ? faceDir(-0.2, -1) : faceDir(-0.5, -1), billYaw: faceDir(-0.8, 1), officialAt: [C[0] + 2.2, C[1] + 1.5] });
        smith.visible = true;
        const a = ease((t - 1.5) / 4.0);                                    // Mystery Guyson walks in with the briefcase
        const sx = -4.5 + (C[0] - 0.1 + 4.5) * a, sy = 3.5 + (C[1] + 0.95 - 3.5) * a, walking = t > 1.5 && t < 5.5;
        place(smith, sx, sy, 0, walking ? faceDir(1, -0.55) : faceDir(t > 16.4 ? -0.7 : 0.15, -1));
        smith.userData.setPose(walking ? 'run' : 'idle', walking ? t * 0.75 : t);
        const kneel = ease((t - 5.6) / 0.6) * (1 - ease((t - 14.6) / 0.6));
        smith.position.z = -0.1 * kneel;
        const give = ease((t - 21.3) / 1.2);                                 // the briefcase changes hands
        briefcase.visible = true;
        const sh = smith.userData.bones.LeftHand.getWorldPosition(V(0, 0, 0));
        if (give < 1) { briefcase.position.set(sh.x, sh.y, Math.max(0.2, sh.z - 0.22)); briefcase.rotation.z = smith.rotation.z; }
        if (t < 16) {                                                        // Lester still holding the rope while it is examined
          const h = dangle();
          if (t > 6) tag(V(h.x, h.y, h.z + 0.45), `${ROPE_CM - 1}.76241328 cm`);
        }
        if (t > 24.4) {                                                      // Bill comes over; the hug
          const b = ease((t - 24.4) / 1.4), hug = ease((t - 31.4) / 0.5);
          const bx = BILL[0] + (C[0] - 1.5 - BILL[0]) * b, by = BILL[1] + (C[1] - 0.35 - BILL[1]) * b;
          place(bill, bx, by, 0, b < 1 ? faceDir(-1, 1) : faceDir(1, 0.1));
          bill.userData.setPose(b < 1 ? 'run' : 'idle', t * (b < 1 ? 0.8 : 1));
          mark.rotation.z = faceDir(-1, -0.1);
          if (hug > 0) { aimArm(bill, 'Left', V(0.8, 0.5, 0.25)); aimArm(mark, 'Left', V(-0.8, -0.5, 0.25)); }
        }
        if (give >= 1) { const mh = mark.userData.bones.RightHand.getWorldPosition(V(0, 0, 0)); briefcase.position.set(mh.x, mh.y, Math.max(0.2, mh.z - 0.22)); briefcase.rotation.z = mark.rotation.z; }
        if (t < 5.6) { const u = ease(t / 5.6); camera.position.lerpVectors(V(3.5, -10.6, 3.2), V(2.2, -9.4, 2.2), u); camLook.set(3.0, -3.4, 1.0); }
        else if (t < 25) { const u = ease((t - 5.6) / 19); camera.position.lerpVectors(V(2.2, -9.4, 2.2), V(3.2, -8.6, 1.9), u); camLook.set(3.4, -3.8, 1.0); }
        else { const u = ease((t - 25) / 7); camera.position.lerpVectors(V(1.6, -8.6, 1.9), V(2.0, -7.6, 1.7), u); camLook.set(2.3, -3.6, 1.05); }
      } else {                                                               // Jack and Amy's: the cheque
        for (const c of [mark, bill, lester, official, guard, smith]) c.visible = false;
        for (const c of [amy, jackH, markC]) c.visible = true;
        const hx = H[0], hy = H[1];
        sit(jackH, hx + 0.25, hy + 2.12, 0.5, 0, t);
        for (const sd of ['Left', 'Right']) { jackH.userData.aim(sd + 'Arm', sd + 'ForeArm', V(sd === 'Left' ? 0.2 : -0.2, -0.3, -1)); jackH.userData.aim(sd + 'ForeArm', sd + 'Hand', V(0, -1, 0.1)); }
        const inn = ease((t - 35.3) / 3.0);                                  // Mark comes in from the door
        const mx = hx + 2.95 + (1.55 - 2.95) * inn, my = hy + 2.45 + (0.95 - 2.45) * inn, walking = inn > 0 && inn < 1;
        place(markC, mx, my, 0, walking ? faceDir(-0.7, -1) : faceDir(-1, 0.85));
        markC.userData.setPose(walking ? 'run' : 'idle', walking ? t * 0.8 : t);
        place(amy, hx + 2.75, hy + 1.55, 0, faceDir(-1, 0.1));
        amy.userData.setPose('idle', t + 0.4);
        // the envelope: Mark's hand, then Amy's, then Jack's
        const k1 = ease((t - 38.5) / 0.8), k2 = ease((t - 39.7) / 0.8);
        if (k1 > 0 && k1 < 1) { aimArm(markC, 'Left', V(0.6, 0.8, 0.1)); aimArm(amy, 'Right', V(-0.6, -0.8, 0.1)); }
        const hm = markC.userData.bones.LeftHand.getWorldPosition(V(0, 0, 0)), ha = amy.userData.bones.RightHand.getWorldPosition(V(0, 0, 0)),
          hj = jackH.userData.bones.RightHand.getWorldPosition(V(0, 0, 0));
        briefcase.visible = false;
        envelope.visible = true;
        envelope.position.copy(hm).lerp(ha, k1).lerp(V(hj.x, hj.y - 0.05, hj.z + 0.08), k2);
        envelope.rotation.set(1.2, 0, 0.2);
        const u = ease((t - 35) / 20);
        camera.position.lerpVectors(V(hx - 0.2, hy - 5.6, 2.2), V(hx + 0.5, hy - 4.3, 1.75), u);
        camLook.set(hx + 1.0, hy + 1.7, 0.95);
      }
      camera.updateProjectionMatrix();
      camera.lookAt(camLook);
      aimSun(camLook);
    }
    function idle(t) {
      reset();
      camera.fov = 30; camera.updateProjectionMatrix();
      stage(t);
      const a = 0.1 + 0.25 * Math.sin(t * 0.2);
      camera.position.set(3 + Math.sin(a) * 15, -2 - Math.cos(a) * 15, 5.5);
      camLook.set(3.5, -2.5, 1.0);
      camera.lookAt(camLook);
      aimSun(camLook);
    }
    return { CH, CUT, runCut, idle, reset, OUT, runOut };
  },
});
