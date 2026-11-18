// The Estimator, Level 4: The Appointment, Round 1. The Underground's Official asks; Mark and Lester answer.
// Lester never misses (he has help). Every answer is on a clock, and the clock gets shorter.
import { runLevel } from './engine.js';
import { RULE, pctStars, offText } from './scoring.js';
import { OFFICIAL_LINES } from './comp.js';
import { rint, pick } from './rng.js';

const FT = 0.3048, IN = 0.0254, TOP = 0.7425, SEAT = 0.47;

runLevel({
  set: './assets/backyard.glb', sky: 0x9fd8f0, indoor: false, noShadow: ['grass'], back: './level3.html',
  cast: { mark: 'mark_suit', bill: 'bill_suit', lester: 'lester', official: 'official', guard: 'guard' },
  asker: 'Official', rival: 'Lester', startCam: null, mood: 'tense',
  lines: OFFICIAL_LINES,
  results: { need: 13, lo: 11, hi: 16, title: "The Official's scorecard", next: './level5.html', nextLabel: 'Round 2: Physical ▸',
    passQuote: '“Round 1 is complete. Round 2 will begin in five minutes.”', aceQuote: '“Round 1 is complete. Remarkable, Mr. Markson. Round 2 in five minutes.”', failQuote: '“The Underground thanks you for your time, Mr. Markson.”' },
  build(ctx) {
    const { THREE, scene, set, chars, camera, camLook, aimSun, toon, V, clamp, ease, place, faceDir, aimArm, sit, tag, across } = ctx;
    const { mark, bill, lester, official, guard } = chars;
    const bailey = set.getObjectByName('bailey');
    const putSet = (o, x, y, z, yaw = 0) => { o.position.set(x, z, -y); o.rotation.set(0, yaw, 0); };   // the set is Y-up inside
    const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    // ---------- props ----------
    const UPY = V(0, 1, 0);
    function stick(m, a, b) {                          // stretch a unit cylinder from a to b
      const d = b.clone().sub(a), len = d.length();
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(UPY, d.normalize());
      m.scale.set(1, len, 1);
    }
    const leash = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), toon(0x7a4fc9));
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 6), toon(0xe5484d));
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.02), toon(0x3b2a20));
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.33, 0.006), toon(0xffffff));
    paper.position.z = 0.012;
    board.add(paper);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.66, 0.02), toon(0x3b2a20));
    const picks = new THREE.Group();
    const PICKS = rint(24, 52);
    {
      const r = rnd(5), geo = new THREE.BoxGeometry(0.075, 0.009, 0.009), mat = toon(0xc08a4a), pts = [];
      while (pts.length < PICKS) {
        const p = [(r() - 0.5) * 1.3, -0.1 + r() * 0.42];
        if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05)) pts.push(p);
      }
      for (const p of pts) { const m = new THREE.Mesh(geo, mat); m.position.set(p[0], p[1], TOP + 0.006); m.rotation.z = r() * Math.PI; picks.add(m); }
    }
    const birds = new THREE.Group();
    const BIRDS = rint(13, 30);
    {
      const r = rnd(9), geo = new THREE.BoxGeometry(0.34, 0.12, 0.03), mat = toon(0x2a2326);
      for (let i = 0; i < BIRDS; i++) {
        const b = new THREE.Group();
        for (const s of [-1, 1]) { const piv = new THREE.Group(), w = new THREE.Mesh(geo, mat); w.position.x = 0.17; piv.add(w); piv.rotation.z = s > 0 ? -0.45 : Math.PI + 0.45; b.add(piv); }
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat);
        body.scale.set(1.5, 1, 1); b.add(body);
        b.rotation.z = -Math.PI / 2 + 1.57;
        b.scale.setScalar(0.6);
        b.userData = { ox: (r() - 0.5) * 7, oy: (r() - 0.5) * 3, oz: (r() - 0.5) * 3.4, ph: r() * 6 };
        birds.add(b);
      }
    }
    for (const m of [leash, pen, board, cover, picks, birds]) scene.add(m);
    const measure = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), toon(0xffd23f));
    scene.add(measure);

    // ---------- staging ----------
    function armsOnTable(c, yaw) {
      const f = V(Math.sin(yaw), -Math.cos(yaw), 0);
      for (const s of ['Left', 'Right']) {
        c.userData.aim(s + 'Arm', s + 'ForeArm', V(f.x * 0.35, f.y * 0.35, -1));
        c.userData.aim(s + 'ForeArm', s + 'Hand', V(f.x, f.y, -0.05));
      }
    }
    function raise(c, side, k, yaw, out = 0.3) {       // lift one hand towards the ear / above the head
      const f = V(Math.sin(yaw), -Math.cos(yaw), 0), sgn = side === 'Left' ? 1 : -1;
      const sd = V(-Math.cos(yaw) * sgn, -Math.sin(yaw) * sgn, 0);
      const up = V(0, 0, -1).lerp(V(sd.x * out + f.x * 0.3, sd.y * out + f.y * 0.3, 0.4), k);
      c.userData.aim(side + 'Arm', side + 'ForeArm', up);
      const el = c.userData.bones[side + 'ForeArm'].getWorldPosition(V(0, 0, 0)), head = c.userData.bones.Head.getWorldPosition(V(0, 0, 0));
      head.z += 0.12;
      c.userData.aim(side + 'ForeArm', side + 'Hand', V(f.x, f.y, -0.05).lerp(head.sub(el).addScaledVector(sd, 0.1), k));
    }
    function atTable(t, o = {}) {
      sit(mark, -0.5, -0.66, SEAT, Math.PI, t);
      armsOnTable(mark, Math.PI);
      sit(lester, 0.5, -0.66, SEAT, Math.PI, t + 0.5);
      armsOnTable(lester, Math.PI);
      if (o.ear) raise(lester, 'Right', o.ear, Math.PI);
      if (o.clear) for (const c of [mark, lester]) { for (const s of ['Left', 'Right']) aimArm(c, s, V(s === 'Left' ? -0.12 : 0.12, 0, -1)); }
      for (const c of [mark, lester, official]) c.traverse((m) => { if (m.isMesh) m.castShadow = !o.clear; });
      if (!o.officialUp) { sit(official, 0, 0.66, SEAT, 0, t + 0.9); if (!o.clear) armsOnTable(official, 0); board.visible = true; board.position.set(0, 0.2, TOP + 0.012); board.rotation.set(0, 0, 0); }
      sit(guard, 10.6, 4.2, 0.52, 0, t + 0.3);
      armsOnTable(guard, 0);
      place(bill, 3.2, -1.2, 0, faceDir(-1, 0.3));
      bill.userData.setPose('idle', t + 0.6);
      putSet(bailey, -1.9, 1.5, 0, 0.5);
    }
    function reset() {
      for (const m of [leash, pen, board, cover, picks, birds, measure]) m.visible = false;
      for (const c of Object.values(chars)) { c.visible = true; c.rotation.set(0, 0, 0); }
    }

    // ---------- the questions ----------
    // spec: answer, les (what Lester says), at (where the answer label goes), extra(phase, t) for staging, hide/limit timings
    function question(q) {
      const fmt = q.fmt || ((x) => String(x));
      return { id: q.id, label: q.label, kind: 'dial', ask: q.ask, view: q.view, lock: "That's my estimate", limit: q.limit, limitFrom: q.limitFrom || 0,
        hint: (q.hint ? q.hint + '  ' : '') + RULE + '  ·  The clock locks in whatever is on the dial.',
        dial: q.dial,
        dur: () => 4.6,
        frame(phase, t, g) {
          const rt = phase === 'reveal' ? t : -1;
          atTable(t, { ear: rt >= 0 ? ease((rt - 0.2) / 0.35) * (1 - ease((rt - 1.9) / 0.4)) : 0, officialUp: q.officialUp, clear: q.clear });
          q.stage(phase, t, rt);
          if (rt >= 0.2) tag(V(-0.5, -0.66, 1.75), `You: ${fmt(g)}`);
          if (rt >= 1.1) tag(V(0.5, -0.66, 1.75), `Lester: ${fmt(q.les)}`);
          if (rt >= 2.4) tag(q.at, `${fmt(q.answer)} ${q.dial.unit}`, true);
        },
        result(g) {
          const r = pctStars(g, q.answer), dm = Math.abs(g - q.answer), dl = Math.abs(q.les - q.answer);
          const rival = dm < dl - 1e-9 ? 'win' : dm > dl + 1e-9 ? 'lose' : 'tie';
          return { stars: r.stars, rival, short: `${fmt(g)} / ${fmt(q.answer)}`,
            nums: `You said ${fmt(g)}. Lester said ${fmt(q.les)}. It's ${fmt(q.answer)} ${q.dial.unit}. ${offText(r.off)}` + (rival === 'win' ? ' You beat him.' : rival === 'tie' ? ' A tie.' : ' Point to Lester.') };
        } };
    }

    const LEASH_IN = rint(48, 80), PEN_S = rint(30, 65) / 10, POOL_IN = rint(42, 72), FENCE = rint(26, 43);
    { const pool = set.getObjectByName('pool'), k = POOL_IN / 58; pool.scale.set(pool.scale.x * k, pool.scale.y, pool.scale.z * k); }
    for (let i = FENCE + 1; i <= 43; i++) set.getObjectByName('picket_' + i).visible = false;
    const FENCE_Y = -5.4 + FENCE * 0.15;
    // "from this table to ...": a different landmark each time
    const TGT = pick([['the door of that shed', 'shed', -9, 7.5], ['the middle of the paddling pool', 'pool', -4.6, 4.6], ['the middle of that rope circle', 'rope circle', 3.5, -3.5],
      ['the table where that security man is sitting', 'patio table', 10.6, 3.4]]);
    const TGT_M = Math.hypot(TGT[2], TGT[3]), SHED_FT = Math.round(TGT_M / FT), td = [TGT[2] / TGT_M, TGT[3] / TGT_M];
    const shedDoor = V(TGT[2], TGT[3], 0.05);
    const CH = [
      question({ id: 'leash', label: "Bailey's leash", answer: LEASH_IN, les: LEASH_IN, limit: 20, officialUp: true,
        ask: 'This is Bailey. He is not competing. How long is his leash, in inches?', hint: 'For scale: the Official is 5 foot 8.',
        dial: { min: 10, max: 150, step: 1, start: 10, unit: 'inches' }, view: [V(-2.4, -5.6, 2.3), V(-2.5, 1.4, 0.8)], at: V(-2.6, 1.5, 1.2),
        stage(phase, t) {
          place(official, -3.5, 1.5, 0, faceDir(0.4, -1));
          official.userData.setPose('idle', t);
          aimArm(official, 'Left', V(0.75, 0, -0.65));
          const hand = official.userData.bones.LeftHand.getWorldPosition(V(0, 0, 0));
          const len = LEASH_IN * IN, dz = hand.z - 0.33, dx = Math.sqrt(len * len - dz * dz);
          putSet(bailey, hand.x + dx, 1.5 - 0.14, 0, Math.PI / 2 - 0.25);
          leash.visible = true;
          stick(leash, hand, V(hand.x + dx, 1.5, 0.33));
          board.visible = false;
        } }),
      question({ id: 'pen', label: 'The pen', answer: PEN_S, les: PEN_S, limit: 10, limitFrom: 2.6 + PEN_S, fmt: (x) => x.toFixed(1),
        ask: 'Watch my pen. I will hold it up, once. For how many seconds was it in the air?', hint: 'No counting out loud.',
        dial: { min: 0.5, max: 12, step: 0.1, start: 0.5, unit: 'seconds' }, view: [V(0, -3.6, 2.9), V(0, 0.6, 1.55)], at: V(0, 0.66, 2.3),
        stage(phase, t) {
          const lt = phase === 'ask' ? t : 99, k = lt > 1.6 && lt < 1.6 + PEN_S ? 1 : 0;
          const f = V(0, -1, 0);
          official.userData.aim('RightArm', 'RightForeArm', k ? V(-0.75, -0.1, 0.9) : V(-0.1, -0.35, -1));
          official.userData.aim('RightForeArm', 'RightHand', k ? V(-0.2, -0.1, 1) : f);
          const hand = official.userData.bones.RightHand.getWorldPosition(V(0, 0, 0));
          pen.visible = true;
          pen.position.set(hand.x, hand.y, hand.z + (k ? 0.16 : 0.03));
          pen.rotation.set(k ? Math.PI / 2 : 0, 0, 0);
          if (phase === 'ask' && lt < 1.6) tag(V(0, 0.66, 1.9), 'Ready…');
        } }),
      question({ id: 'pool', label: 'The paddling pool', answer: POOL_IN, les: POOL_IN, limit: 14,
        ask: 'The paddling pool by the shed. How far across is it, in inches?', hint: 'For scale: the table is 6 feet long.',
        dial: { min: 10, max: 150, step: 1, start: 10, unit: 'inches' }, view: [V(1.6, -4.6, 3.0), V(-3.0, 3.2, 0.2)], at: V(-4.6, 4.6, 0.6),
        stage(phase, t, rt) {
          measure.visible = rt >= 2.4;
          if (measure.visible) stick(measure, V(-4.6 - POOL_IN * IN / 2, 4.6, 0.3), V(-4.6 + POOL_IN * IN / 2, 4.6, 0.3));
        } }),
      question({ id: 'shed', label: `Table to ${TGT[1]}`, answer: SHED_FT, les: SHED_FT, limit: 12,
        ask: `From the middle of this table to ${TGT[0]}. How many feet?`, hint: 'For scale: the table is 6 feet long.',
        dial: { min: 5, max: 120, step: 1, start: 5, unit: 'feet' },
        view: across(0, 0, TGT[2], TGT[3]), at: V(TGT[2] / 2, TGT[3] / 2, 0.6),
        stage(phase, t, rt) {
          if (phase === 'ask') { tag(V(TGT[2], TGT[3], 1.0), TGT[1]); tag(V(0, 0, 1.6), 'this table'); }
          measure.visible = rt >= 2.4;
          if (measure.visible) stick(measure, V(0, 0, 0.06), V(shedDoor.x * ease((rt - 2.4) / 1.2), shedDoor.y * ease((rt - 2.4) / 1.2), 0.06));
        } }),
      question({ id: 'fence', label: 'Fence pickets', answer: FENCE, les: FENCE, limit: 12,
        ask: 'The fence along the side of the garden. How many pickets?', hint: '',
        dial: { min: 5, max: 150, step: 1, start: 5, unit: 'pickets' }, view: [V(8.6, FENCE_Y, 3.4), V(-11.5, FENCE_Y, 0.9)], at: V(-11.4, FENCE_Y, 2.5),
        stage() {} }),
      question({ id: 'picks', label: 'Toothpicks', answer: PICKS, les: PICKS - 1, limit: 9, limitFrom: 0, clear: true,
        ask: 'I have spilled a box of toothpicks. You get four seconds. How many?', hint: 'Then my clipboard goes over them.',
        dial: { min: 5, max: 150, step: 1, start: 5, unit: 'toothpicks' }, view: [V(0, -0.5, 3.9), V(0, 0.0, 0.74)], at: V(0, 0.05, 0.95),
        stage(phase, t, rt) {
          picks.visible = true;
          const hid = phase === 'ask' ? ease((t - 4) / 0.4) : 1 - ease((rt - 2.2) / 0.4);
          cover.visible = hid > 0.01;
          cover.position.set(0, 0.95 - 0.95 * hid, TOP + 0.05);
          board.visible = false;
        } }),
      question({ id: 'birds', label: 'The birds', answer: BIRDS, les: BIRDS, limit: 8, limitFrom: 5.4,
        ask: 'Look up. How many birds?', hint: 'They will not come back.',
        dial: { min: 1, max: 80, step: 1, start: 1, unit: 'birds' }, view: [V(-9, -9, 1.2), V(-10, 2, 5.6)], at: V(-10, 2, 6.2),
        stage(phase, t) {
          const lt = phase === 'ask' ? t : 99;
          birds.visible = lt < 5.4;
          const cx = -20.5 + 5.0 * (lt - 1.0);
          for (const b of birds.children) {
            const u = b.userData;
            b.position.set(cx + u.ox * 0.75, 2 + u.oy * 0.5, 5.6 + u.oz * 0.55 + 0.1 * Math.sin(lt * 3 + u.ph));
            const flap = 0.6 * Math.sin(lt * 11 + u.ph);
            b.children[0].rotation.y = -flap; b.children[1].rotation.y = -flap;
          }
        } }),
    ];

    // ---------- cutscene: Lester ----------
    const CUT = { dur: 33, caps: [
      [0.6, 2.6, 'Bill', 'You gotta be kidding me.'],
      [3.0, 4.4, 'Lester', 'Hello, Bill.'], [4.6, 5.9, 'Bill', 'Hello, Lester.'],
      [6.2, 9.6, 'Lester', 'So this is your last hope? Such a shame he has to lose to me.'],
      [9.9, 13.8, 'Bill', "I'm surprised the Underground is giving you another shot after last year. Usually they don't hire animals."],
      [14.1, 19.2, 'Lester', "Don't worry, Mark. It will all be over soon, and you can get back to estimating how many cookies your mommy baked for you."],
      [19.6, 21.4, 'Mark', 'What the hell was that about?'],
      [21.7, 26.2, 'Bill', 'Last year he got inside my best estimator’s head and humiliated her in front of everyone. Stay focused.'],
      [27.0, 32.6, 'Official', 'Gentlemen, this is a simple competition. Round one: I ask, you give me your best estimate. Let’s begin.'],
    ] };
    function runCut(t) {
      reset();
      if (t < 26.6) {
        place(mark, -4.3, -4.6, 0, faceDir(1, 0.15));
        mark.userData.setPose('idle', t);
        place(bill, -5.2, -4.0, 0, faceDir(1, -0.1));
        bill.userData.setPose('idle', t + 0.6);
        const a = ease(t / 2.8), b = ease((t - 19.2) / 3.5);
        const lx = 4.5 - 7.4 * a + 3.4 * b, ly = -6.5 + 2.2 * a + 3.6 * b, moving = (t < 2.8) || (t > 19.2 && t < 22.7);
        place(lester, lx, ly, 0, moving ? faceDir(t < 2.8 ? -1 : 0.7, t < 2.8 ? 0.3 : 0.75) : faceDir(-1, -0.1));
        lester.userData.setPose(moving ? 'run' : 'idle', t * (moving ? 0.8 : 1));
        sit(official, 0, 0.66, SEAT, 0, t);
        armsOnTable(official, 0);
        board.visible = true; board.position.set(0, 0.2, TOP + 0.012);
        sit(guard, 10.6, 4.2, 0.52, 0, t);
        armsOnTable(guard, 0);
        putSet(bailey, -1.9, 1.5, 0, 0.5);
        if (t < 3) { const u = ease(t / 3); camera.position.lerpVectors(V(6, -17, 6.5), V(-2.2, -10.5, 2.0), u); camLook.lerpVectors(V(0, 2, 1.5), V(-3.6, -4.4, 1.0), u); }
        else if (t < 19.4) { const u = ease((t - 3) / 16); camera.position.lerpVectors(V(-2.2, -10.5, 2.0), V(-2.8, -9.6, 1.8), u); camLook.set(-3.4, -4.4, 1.0); }
        else { const u = ease((t - 19.4) / 7); camera.position.lerpVectors(V(-1.6, -8.4, 1.9), V(-2.4, -7.8, 1.75), u); camLook.set(-4.7, -4.3, 1.05); }
      } else {
        atTable(t);
        const u = ease((t - 26.6) / 6.4);
        camera.position.lerpVectors(V(-4.2, -1.6, 2.0), V(-3.6, -1.2, 1.8), u);
        camLook.set(0.1, 0.2, 1.0);
      }
      camera.lookAt(camLook);
      aimSun(camLook);
    }
    function idle(t) {
      reset();
      atTable(t);
      const a = -0.3 + 0.25 * Math.sin(t * 0.2);
      camera.position.set(Math.sin(a) * 15, 1 - Math.cos(a) * 15, 5.5);
      camLook.set(0, 2.5, 1.2);
      camera.lookAt(camLook);
      aimSun(camLook);
    }
    return { CH, CUT, runCut, idle, reset };
  },
});
