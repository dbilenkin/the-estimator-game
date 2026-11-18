// The Estimator, Level 2: Training. Indoors at Mark's home, after the film's training montage:
// chips on the kitchen table, hands held apart, Bill's stopwatch, the bean bag and the ring on the carpet, and the sugar.
// It gets harder as it goes: the chips are shown for less time and there are more of them.
import { runLevel } from './engine.js';
import { RULE, pctStars, offText } from './scoring.js';
import { rint } from './rng.js';

const FT = 0.3048, IN = 0.0254, TOP = 0.76, FLOOR = 0.02;   // metres per foot and inch; height of the table top

runLevel({
  set: './assets/apartment.glb', sky: 0x2b2e3b, indoor: true, back: './index.html',
  cast: { mark: 'mark_tr', bill: 'bill' }, mood: 'home',
  results: { need: 14, lo: 4, hi: 11, next: './level3.html', nextLabel: 'Level 3: The Playground ▸',
    passQuote: '“Good. Now we go outside.”', aceQuote: '“Better than good. Do not let it go to your head. Outside.”', failQuote: '“Not yet. Back to the table.”' },
  build(ctx) {
    const { THREE, scene, set, chars, camera, camLook, toon, V, clamp, ease, place, faceDir, aimArm, tag } = ctx;
    const { mark, bill } = chars;
    set.traverse((o) => { if (/^(vacuum|pizza)_\d+$|^jelly_bean_jar$|^side_table$|^chip_case$|^lamp_[24]$/.test(o.name)) o.visible = false; });   // Bill made him tidy up first

    // ---------- props ----------
    const CHIP_COLS = [0xd9463b, 0xf4f1ea, 0x3b82c4, 0x2f2b2e, 0x4cae4f];
    const chipMeshes = Array.from({ length: 60 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), toon(CHIP_COLS[i % 5]));
      m.rotation.x = Math.PI / 2;
      m.castShadow = true;
      scene.add(m);
      return m;
    });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.02), toon(0x3b5fa8));     // the tea towel Bill drops over them
    cover.position.set(5.4, 0.2, TOP + 0.03);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 28), toon(0xffffff));
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), toon(0xe5484d));
    bag.scale.z = 0.6;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.02), toon(0xffd23f));
    const sugar = new THREE.Group();                 // a bag of sugar, a covered bowl, and the stream between them
    const sack = new THREE.Group();
    const sackBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), toon(0xfbf6ea));
    sackBody.position.z = 0.12;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.105, 0.08), toon(0xd9463b));
    band.position.z = 0.12;
    sack.add(sackBody, band);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.12, 20), toon(0x3b82c4));
    bowl.rotation.x = Math.PI / 2;
    bowl.position.set(5.6, 0.1, TOP + 0.06);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.015, 20), toon(0x27558a));
    lid.rotation.x = Math.PI / 2;
    lid.position.set(5.6, 0.1, TOP + 0.125);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), toon(0xffffff));
    stream.rotation.x = Math.PI / 2;
    stream.position.set(5.6, 0.1, TOP + 0.28);
    sugar.add(sack, bowl, lid, stream);
    for (const m of [cover, ring, bag, tape, sugar]) { m.traverse((o) => { o.castShadow = true; }); scene.add(m); }

    function reset() {
      for (const m of chipMeshes) m.visible = false;
      cover.visible = ring.visible = bag.visible = tape.visible = sugar.visible = false;
    }
    function atTable(t) {                             // Mark and Bill at either end of the kitchen table
      place(mark, 4.3, 0.2, FLOOR, faceDir(1, -0.4));
      mark.userData.setPose('idle', t);
      place(bill, 6.95, 0.2, FLOOR, faceDir(-1, -0.4));
      bill.userData.setPose('idle', t + 0.6);
    }
    function layout(n, seed) {                        // n chip positions scattered on the table, not touching
      let s = seed;
      const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
      const pts = [];
      while (pts.length < n) {
        const p = [4.9 + rnd() * 1.05, -0.2 + rnd() * 0.78];
        if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.068)) pts.push(p);
      }
      return pts;
    }

    // ---------- the challenges ----------
    // Chips on the table. With `show`, Bill covers them after that many seconds.
    function chips(id, label, n, show, ask) {
      const pts = layout(n, rint(1, 99999)), span = Math.min(3, n * 0.14), ARRIVE = 1.0;
      return { id, label, kind: 'dial', ask, lock: "That's my estimate", view: [V(5.4, -2.7, 2.7), V(5.4, 0.2, 0.7)],
        hint: (show ? `You get ${show} seconds, then I cover them.  ` : '') + RULE,
        dial: { min: 0, max: n < 10 ? 15 : n < 30 ? 60 : 150, step: 1, start: 0, unit: 'chips' },
        dur: () => span + 1.4,
        frame(phase, t, g) {
          atTable(t);
          chipMeshes.forEach((m, i) => { m.visible = i < n; if (i < n) { m.position.set(pts[i][0], pts[i][1], TOP + 0.007); m.scale.setScalar(1); } });
          const covered = phase === 'ask' && show > 0 && t > show + ARRIVE;
          cover.visible = covered;
          if (phase === 'ask' && show && !covered) tag(V(6.25, 0.42, 1.0), String(Math.max(1, Math.ceil(show + ARRIVE - t))), true);
          if (phase === 'reveal') {
            const dt = span / n, k = Math.min(n, Math.floor(t / dt) + 1), u = (t - (k - 1) * dt) / dt;
            if (u < 1) chipMeshes[k - 1].scale.setScalar(1 + 0.7 * Math.sin(Math.PI * clamp(u, 0, 1)));
            tag(V(pts[k - 1][0], pts[k - 1][1], TOP + 0.16), String(k), k === n && t > span);
          }
        },
        result(g) {
          const r = pctStars(g, n);
          return { stars: r.stars, short: `${g} / ${n}`, nums: `You said ${g}. There are ${n} chips. ${offText(r.off)}`,
            line: n <= 5 && r.stars === 3 ? 'Your first correct estimate. Do not celebrate yet.' : null };
        } };
    }

    // Hands apart. No number on the dial: the player judges the gap by eye against Mark's height.
    function hands(id, label, inches, ask) {
      let s = 0;
      return { id, label, kind: 'dial', ask, lock: "That's it", view: [V(4.0, -5.8, 1.5), V(4.0, -0.9, 1.0)],
        hint: 'No numbers this time. For scale, Mark is 70 inches tall.  ' + RULE,
        dial: { min: 4, max: 52, step: 1, start: 4, unit: 'slide to move his hands', secret: true },
        dur: () => 3.2,
        frame(phase, t, g) {
          place(mark, 4.0, -0.9, FLOOR, faceDir(0, -1));
          mark.userData.setPose('idle', 0);
          place(bill, 5.35, -0.7, FLOOR, faceDir(-1, -0.7));
          bill.userData.setPose('idle', t + 0.6);
          const hp = {};
          for (let it = 0; it < 5; it++) {             // settle the arms so the hands really are g inches apart
            for (const side of ['Left', 'Right']) {
              mark.updateMatrixWorld(true);
              const sh = mark.userData.bones[side + 'Arm'].getWorldPosition(V(0, 0, 0));
              const sx = Math.sign(sh.x - mark.position.x) || 1;
              aimArm(mark, side, V(sx * s, -Math.sqrt(Math.max(0.01, 1 - s * s)), 0.02));
              mark.updateMatrixWorld(true);
              hp[side] = mark.userData.bones[side + 'Hand'].getWorldPosition(V(0, 0, 0));
            }
            s = clamp(s + (g * IN - hp.Left.distanceTo(hp.Right)) / 0.9, -0.6, 0.97);
          }
          tape.visible = false;
          if (phase === 'reveal') {
            const u = ease(t / 1.0), a = hp.Left.x < hp.Right.x ? hp.Left : hp.Right, len = g * IN * u;
            tape.visible = true;
            tape.position.set(a.x + len / 2, a.y - 0.06, a.z + 0.02);
            tape.scale.set(Math.max(len, 0.001), 1, 1);
            tape.rotation.set(0, 0, 0);
            tag(V(mark.position.x, a.y - 0.06, a.z + 0.28), `${Math.round(g * u)} inches`, u >= 1);
            if (t > 1.6) tag(V(mark.position.x, a.y - 0.06, a.z - 0.3), `Bill asked for ${inches}`);
          }
        },
        result(g) {
          const r = pctStars(g, inches);
          return { stars: r.stars, short: `${g} / ${inches} in`, nums: `Your hands were ${g} inches apart. I asked for ${inches}. ${offText(r.off)}`, line: null };
        } };
    }

    // Bill's stopwatch. You see it run for the first second, then it is hidden.
    function stopwatch(id, label, secs, ask) {
      const at = V(5.6, 0.3, 1.5);
      return { id, label, kind: 'live', act: 'STOP!', lock: 'Start the watch', ask, view: [V(5.6, -3.9, 1.9), V(5.6, 0.2, 1.05)],
        hint: 'You see the watch for the first moment only.  ' + RULE,
        press(t, p) { if (!p.length && t > 0.3) p.push(t); },
        liveDone(t, p) { return p.length ? t > p[0] + 1.3 : t > secs * 2.5 + 2; },
        frame(phase, t, g, p) {
          atTable(t);
          if (phase !== 'live') tag(at, '0.0 s');
          else if (p.length) tag(at, `${p[0].toFixed(1)} s`, true);
          else tag(at, t < 0.7 ? `${t.toFixed(1)} s` : '?.? s');
        },
        result(g, p) {
          if (!p.length) return { stars: 0, short: 'no call', nums: 'You never stopped it.', line: 'Mark? The watch is still running.' };
          const r = pctStars(p[0], secs);
          return { stars: r.stars, short: `${p[0].toFixed(1)} / ${secs} s`, nums: `You stopped it at ${p[0].toFixed(1)} seconds. I asked for ${secs}. ${offText(r.off)}`, line: null };
        } };
    }

    // The bean bag and the ring on the carpet. In the film Mark's first throw goes into the far wall.
    const T0 = [2.6, -1.2], RING_FT = rint(6, 10), WALL = -2.82;
    const flight = (g) => 0.75 + 0.022 * g;
    const toss = { id: 'toss', label: 'Bean bag on the carpet', kind: 'dial', lock: 'Throw it!', view: [V(0.5, -7.6, 4.4), V(0.5, -0.7, 0.6)],
      ask: 'The bean bag goes in the ring on the carpet. How far away is the ring?', hint: 'For scale, Mark is 5 foot 10.  ' + RULE,
      dial: { min: 1, max: 30, step: 1, start: 1, unit: 'feet' },
      dur: (g) => 0.5 + flight(g) + 2.2,
      frame(phase, t, g) {
        const T = flight(g), lx = T0[0] - g * FT, thud = lx < WALL, land = V(Math.max(WALL, lx), T0[1], FLOOR + 0.05);
        ring.visible = bag.visible = true;
        ring.position.set(T0[0] - RING_FT * FT, T0[1], FLOOR + 0.03);
        place(mark, T0[0], T0[1], FLOOR, faceDir(-1, 0));
        mark.userData.setPose('idle', t);
        place(bill, T0[0] + 0.8, T0[1] + 1.2, FLOOR, faceDir(-1, -0.5));
        bill.userData.setPose('idle', t + 0.6);
        const rt = phase === 'reveal' ? t : 0, wind = ease(rt / 0.4), fwd = ease((rt - 0.4) / 0.14);
        mark.updateMatrixWorld(true);
        const near = ['Left', 'Right'].map((sd) => [sd, mark.userData.bones[sd + 'Arm'].getWorldPosition(V(0, 0, 0)).y]).sort((a, b) => a[1] - b[1])[0][0];
        aimArm(mark, near, V(0.5 * wind - 1.4 * fwd, -0.15, -0.6 + 0.9 * wind + 0.3 * fwd));
        mark.updateMatrixWorld(true);
        const hand = mark.userData.bones[near + 'Hand'].getWorldPosition(V(0, 0, 0));
        const u = (rt - 0.5) / T;
        if (u <= 0) bag.position.copy(hand);
        else if (u < 1) {
          bag.position.lerpVectors(V(T0[0] - 0.45, T0[1] - 0.2, FLOOR + 1.45), V(lx, T0[1], FLOOR + 0.05), u);
          bag.position.z += (0.9 + 0.07 * g) * 4 * u * (1 - u);
          if (bag.position.x < WALL) bag.position.x = WALL;          // it has hit the wall
        } else bag.position.copy(land);
        tape.visible = false;
        if (u >= 1) {
          tag(land.clone().add(V(0, 0, 0.7)), thud ? `THUD. ${g} ft` : `You: ${g} ft`);
          const k = ease((rt - 0.5 - T - 0.3) / 1.2), len = RING_FT * FT * k;
          if (k > 0) {
            tape.visible = true;
            tape.position.set(T0[0] - len / 2, T0[1] - 0.5, FLOOR + 0.03);
            tape.scale.set(Math.max(len, 0.001), 1.5, 1);
            tape.rotation.set(0, 0, 0);
            tag(V(T0[0] - len, T0[1] - 0.5, FLOOR + 0.3), `${Math.round(RING_FT * k)} feet`, k >= 1);
          }
        }
      },
      result(g) {
        const r = pctStars(g, RING_FT), inRing = Math.abs(g - RING_FT) * FT < 0.28;
        return { stars: r.stars, short: `${g} / ${RING_FT} ft`,
          nums: inRing ? `In the ring, ${RING_FT} feet away.` : `You threw it ${g} feet. The ring is ${RING_FT} feet away. ${offText(r.off)}`,
          line: T0[0] - g * FT < WALL ? 'That was the wall, Mark. The wall.' : inRing ? 'In the ring. I felt something. Pride, possibly.' : null };
      } };

    // The sugar. It pours at a steady spoonful a second into a covered bowl, so this is really about time.
    function sugarPour(n) {
      return { id: 'sugar', label: 'Sugar', kind: 'live', act: (p) => (p.length ? 'STOP' : 'POUR'), lock: "I'm ready", view: [V(5.5, -3.2, 2.0), V(5.5, 0.2, 0.95)],
        ask: `The sugar pours at exactly one spoonful a second. Pour me ${n} spoonfuls. You cannot see into the bowl.`,
        hint: 'Press once to pour and once to stop.  ' + RULE,
        press(t, p) { if (p.length < 2 && t > 0.3) p.push(t); },
        liveDone(t, p) { return p.length === 2 ? t > p[1] + 1.4 : t > n * 4 + 20; },
        frame(phase, t, g, p) {
          atTable(t);
          sugar.visible = true;
          const pouring = phase === 'live' && (p.length === 1 || (p.length === 2 && t < p[1]));
          stream.visible = pouring;
          sack.position.set(pouring ? 5.42 : 5.25, 0.1, TOP + (pouring ? 0.5 : 0));
          sack.rotation.y = pouring ? 2.1 : 0;
          if (p.length === 2 && (phase !== 'live' || t >= p[1])) tag(V(5.6, 0.1, TOP + 0.5), `${(p[1] - p[0]).toFixed(1)} spoonfuls`, true);
        },
        result(g, p) {
          if (p.length < 2) return { stars: 0, short: 'none', nums: 'Nothing was measured.', line: 'You have buried the table in sugar, Mark.' };
          const v = p[1] - p[0], r = pctStars(v, n);
          return { stars: r.stars, short: `${v.toFixed(1)} / ${n}`, nums: `You poured ${v.toFixed(1)} spoonfuls. I asked for ${n}. ${offText(r.off)}`, line: null };
        } };
    }

    const HANDS = rint(14, 34), SECS = rint(4, 9);
    const CH = [
      chips('chips1', 'Chips: a few', rint(3, 7), 0, 'We start from the very beginning. How many chips are on the table? Take your time.'),
      hands('hands', 'Hands apart', HANDS, `Hold your hands ${HANDS} inches apart. No ruler.`),
      stopwatch('watch', 'Stopwatch', SECS, `I start the watch. Stop it at exactly ${SECS} seconds.`),
      chips('chips2', 'Chips: a glance', rint(14, 28), 3, 'More chips, and less time. How many?'),
      toss,
      sugarPour(rint(6, 12)),
      chips('chips3', 'Chips: a pile', rint(38, 60), 2, 'Last one, and it is a real estimate. You cannot count these. How many chips?'),
    ];

    // ---------- cutscene and idle ----------
    const CUT = { dur: 9.0, caps: [[0.6, 3.6, 'Bill', 'Six a.m. Put the watch on. You cannot estimate time yet.'],
      [3.9, 6.0, 'Mark', 'It has been, what, three days since you left?'], [6.3, 8.7, 'Bill', 'Eleven hours. We start from the very beginning.']] };
    function runCut(t) {
      atTable(t);
      const u = ease(t / 6);
      camera.position.lerpVectors(V(2.6, -6.2, 2.8), V(5.4, -4.4, 1.8), u);
      camLook.lerpVectors(V(4.6, 0.4, 0.9), V(5.6, 0.2, 1.0), u);
      camera.lookAt(camLook);
    }
    function idle(t) {
      atTable(t);
      const a = -0.15 + 0.25 * Math.sin(t * 0.2);
      camera.position.set(5.0 + Math.sin(a) * 8, 0.2 - Math.cos(a) * 8, 3.8);
      camLook.set(5.0, 0.4, 0.8);
      camera.lookAt(camLook);
    }
    return { CH, CUT, runCut, idle, reset };
  },
});
