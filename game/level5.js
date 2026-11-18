// The Estimator, Level 5: The Appointment, Round 2. The physical round, on the playground, in a shirt and tie.
// Lester has no one whispering in his ear out here: his marks are on the ground, and they can be beaten.
import { runLevel } from './engine.js';
import { tiers, tierHint, allow } from './scoring.js';
import { OFFICIAL_LINES, versus, versusText } from './comp.js';
import { rint, rfloat, pick } from './rng.js';

const FT = 0.3048, IN = 0.0254, G0 = 0.04;

runLevel({
  set: './assets/playground.glb', sky: 0x9fd8f0, indoor: false, noShadow: ['grass', 'pad', 'court'], back: './level4.html',
  cast: { mark: 'mark_r2', markB: 'mark_tie_blind', bill: 'bill_suit', lester: 'lester', official: 'official' },
  asker: 'Official', rival: 'Lester', lines: OFFICIAL_LINES, mood: 'tense',
  results: { need: 8, title: "The Official's scorecard", next: './level6.html', nextLabel: 'Round 3: Freestyle ▸',
    passQuote: '“OK, men. Prepare for the Freestyle round. You have five minutes.”', failQuote: '“The Underground thanks you for your time, Mr. Markson.”' },
  build(ctx) {
    const { THREE, scene, set, chars, camera, camLook, aimSun, toon, V, clamp, ease, place, faceDir, aimArm, reach, sit, tag, $ } = ctx;
    const { mark, markB, bill, lester, official } = chars;
    const riders = ['rider_1', 'rider_2', 'rider_3'].map((n) => set.getObjectByName(n));
    const num = (x) => String(Number(x.toFixed(2)));

    // ---------- props ----------
    const PIVOT = V(-6, 0.8, 2.45), SL = 1.95;
    const sw = new THREE.Group();
    sw.position.copy(PIVOT);
    for (const sy of [-1, 1]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, SL, 8), toon(0xd5dbe0));
      rod.rotation.x = Math.PI / 2;
      rod.position.set(0, sy * 0.22, -SL / 2);
      sw.add(rod);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.56, 0.08), toon(0x2a2c33));
    seat.position.set(0, 0, -SL);
    sw.add(seat);
    const setSwing = (th) => { sw.rotation.y = -th; };
    const lane = new THREE.Group();
    {
      const line = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.07, 0.012), toon(0xffffff));
      line.position.set(PIVOT.x + 2.3, PIVOT.y, G0 + 0.012);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), toon(0xffd23f));
      dot.rotation.x = Math.PI / 2;
      dot.position.set(PIVOT.x, PIVOT.y, G0 + 0.016);
      lane.add(line, dot);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 8, 32), toon(0xffffff));
    const lmark = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), toon(0x26262b));   // where Lester ended up
    lmark.rotation.x = Math.PI / 2;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), toon(0xfffbe6));
    const lball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), toon(0x26262b));
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.012), toon(0xffffff));
    const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.03), toon(0xffd23f));
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 20, 1, true), toon(0xe5484d, { side: THREE.DoubleSide }));
    bucket.rotation.x = Math.PI / 2;
    const aimLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.012), toon(0xffffff));
    const throwLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.014), toon(0xf47a2a));
    bucket.scale.setScalar(1.35);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.34), toon(0xf4f1ea));
    for (const m of [sw, lane, ring, lmark, ball, lball, paper, tape, board, bucket, aimLine, throwLine]) { m.traverse((o) => { o.castShadow = true; }); scene.add(m); }
    const dark = document.createElement('div');                 // the blindfold
    dark.style.cssText = 'position:fixed;inset:0;background:#0d0d12;color:#fff6df;display:none;place-items:center;font:800 clamp(22px,3.4vw,40px) "Avenir Next","Trebuchet MS",sans-serif;text-align:center;padding:0 8vw 22vh;box-sizing:border-box;z-index:1';
    dark.textContent = 'Blindfolded. Hit STOP! when you think Mark is standing in the ring.';
    document.body.insertBefore(dark, $('hud'));
    $('act').style.zIndex = 2;

    function watchers(t, ox, oy, look) {                         // the Official with his clipboard, Lester and Bill, standing by
      place(official, ox, oy, G0, faceDir(look[0] - ox, look[1] - oy));
      official.userData.setPose('idle', t + 0.3);
      aimArm(official, 'Left', V(0.2 * Math.sign(look[0] - ox), -0.1, -0.5).add(V(look[0] - ox, look[1] - oy, 0).normalize().multiplyScalar(0.5)));
      board.visible = true;
      const h = official.userData.bones.LeftHand.getWorldPosition(V(0, 0, 0));
      board.position.set(h.x, h.y, h.z + 0.1);
      board.rotation.z = official.rotation.z;
    }
    function reset() {
      setSwing(0);
      for (const m of [lane, ring, lmark, ball, lball, paper, tape, board, bucket, aimLine, throwLine]) m.visible = false;
      tape.rotation.set(0, 0, 0);
      for (const r of riders) r.visible = true;
      for (const c of Object.values(chars)) { c.visible = true; c.rotation.set(0, 0, 0); }
      markB.visible = false;
      dark.style.display = 'none';
    }

    // ---------- jump off the swing into the ring ----------
    const W = Math.sqrt(9.81 / SL) * 0.93, GE = 9.81 * 0.93 * 0.93, GO = 0.8;
    function flight(th0, tp) {                                   // leave the seat tp seconds after the release
      const th = -th0 * Math.cos(W * tp), w = th0 * W * Math.sin(W * tp);
      const x0 = SL * Math.sin(th), z0 = PIVOT.z - SL * Math.cos(th) - 0.5 - G0;
      const vx = SL * Math.cos(th) * w, vz = SL * Math.sin(th) * w;
      const T = (vz + Math.sqrt(vz * vz + 2 * GE * Math.max(0, z0))) / GE;
      return { th, x0, z0, vx, vz, T, land: x0 + vx * T };
    }
    function jump(id, label, th0, lesIn, far, ask, view) {
      let best = 0;
      for (let tp = 0; tp < Math.PI / W; tp += 0.005) best = Math.max(best, flight(th0, tp).land);
      const D = Math.round(best * far / 0.05) * 0.05, period = 2 * Math.PI / W;
      const inches = (land) => Math.round(Math.abs(land - D) / IN);
      return { id, label, kind: 'live', act: 'JUMP!', lock: "I'm ready", ask, view,
        hint: 'Too early and he drops short. Too late and he sails past, or goes nowhere.  ' + tierHint(12, 24, 40, 'inches', ' of the middle'),
        press(t, presses) { if (!presses.length && t > GO) presses.push(t); },
        liveDone(t, presses) { return presses.length ? t > presses[0] + flight(th0, presses[0] - GO).T + 1.8 : t > GO + 4 * period; },
        frame(phase, t, g, presses) {
          const lt = phase === 'live' ? t : 0, p = presses.length ? presses[0] : null;
          for (const r of riders) r.visible = false;
          ring.visible = lmark.visible = true;
          ring.position.set(PIVOT.x + D, PIVOT.y, G0 + 0.04);
          lmark.position.set(PIVOT.x + D + lesIn * IN, PIVOT.y + 0.05, G0 + 0.02);
          tag(V(PIVOT.x + D + lesIn * IN, PIVOT.y, G0 + 0.35), `Lester: ${Math.abs(lesIn)} in. ${lesIn > 0 ? 'long' : 'short'}`);
          watchers(t, -7.4, -1.4, [PIVOT.x + D, PIVOT.y]);
          place(lester, -8.3, -0.6, G0, faceDir(1, 0.3));
          lester.userData.setPose('idle', t + 0.5);
          place(bill, PIVOT.x + D + 2.6, 3.4, G0, faceDir(-0.6, -1));
          bill.userData.setPose('idle', t + 0.6);
          const ts = Math.max(0, (p === null ? lt : Math.min(lt, p)) - GO);
          const th = p !== null && lt > p ? flight(th0, p - GO).th * Math.cos(W * (lt - p)) * Math.exp(-0.5 * (lt - p)) : -th0 * Math.cos(W * ts);
          setSwing(th);
          const yaw = faceDir(1, 0);
          if (p === null || lt <= p) {                           // riding the swing
            sit(mark, 0, 0, 0, yaw, t);
            const h = 0.07 - mark.position.z;
            const lean = th * 0.45;                           // he leans with the swing, but sits up
            mark.position.set(PIVOT.x + SL * Math.sin(th) + h * Math.sin(lean) - 0.05, PIVOT.y, PIVOT.z - SL * Math.cos(th) + 0.04 - h * Math.cos(lean));
            mark.rotation.y = -lean;
            for (const s of ['Left', 'Right']) aimArm(mark, s, V(-Math.sin(th) + 0.1, s === 'Left' ? 0.45 : -0.45, Math.cos(th)));
          } else {
            const f = flight(th0, p - GO), a = lt - p, u = Math.min(a, f.T);
            place(mark, PIVOT.x + f.x0 + f.vx * u, PIVOT.y, G0 + Math.max(0, f.z0 + f.vz * u - 0.5 * GE * u * u), yaw);
            if (a < f.T) mark.userData.setPose('jump', 0.1 + 0.4 * (a / f.T)); else mark.userData.setPose('idle', t);
            if (a >= f.T) { const n = inches(f.land); tag(V(PIVOT.x + f.land, PIVOT.y, 2.0), n <= allow(12) ? 'In the ring!' : `${n} in. ${f.land < D ? 'short' : 'long'}`, true); }
          }
          if (p === null && lt > GO + 4 * period - 0.01) tag(V(PIVOT.x, PIVOT.y, 2.9), 'He never jumped.', true);
        },
        result(g, presses) {
          if (!presses.length) return { stars: 0, rival: 'lose', short: 'no jump', nums: 'Mark is still on the swing.', line: 'The task was to leave the swing, Mr. Markson.' };
          const f = flight(th0, presses[0] - GO), n = inches(f.land), rv = versus(n, Math.abs(lesIn));
          return { stars: tiers(n, 12, 24, 40), rival: rv, short: n <= allow(12) ? 'in the ring' : `${n} in. off`,
            nums: (n <= allow(12) ? `Both feet in the ring, ${n} inches from dead centre.` : `You landed ${n} inches ${f.land < D ? 'short of' : 'past'} the middle of the ring.`) + ` Lester was ${Math.abs(lesIn)} off.` + versusText(rv) };
        } };
    }

    // ---------- roll the ball to the sheet of paper ----------
    const RX = 17, RY0 = -2.3, NET = 7 - RY0, PAPER_FT = rint(17, 27), LES_FT = PAPER_FT - rint(3, 6);
    const roll = { id: 'roll', label: 'Ball to the paper', kind: 'dial', lock: 'Roll it', view: [V(25.5, -8.5, 4.6), V(17.4, 2.6, 0.3)],
      ask: 'The Official has put a sheet of paper on the court. Roll the ball so it stops on it. How far away is the paper?',
      hint: 'Lester rolled the black one. It stopped short. For scale: Mark is 5 foot 10.  ' + tierHint(2, 4, 7, 'feet'),
      dial: { min: 3, max: 45, step: 1, start: 3, unit: 'feet' },
      T: (g) => 1.4 + 0.07 * g,
      dur(g) { return 0.5 + this.T(g) + 2.4; },
      frame(phase, t, g) {
        const rt = phase === 'reveal' ? t : 0, T = this.T(g), dist = Math.min(g * FT, NET - 0.15);
        ball.visible = lball.visible = paper.visible = true;
        paper.position.set(RX, RY0 + PAPER_FT * FT, 0.06);
        lball.position.set(RX + 0.25, RY0 + LES_FT * FT, 0.17);
        if (phase === 'ask') tag(V(RX + 0.25, RY0 + LES_FT * FT, 0.75), 'Lester');
        place(mark, RX, RY0, 0.05, faceDir(0, 1));
        mark.userData.setPose('idle', t);
        const wind = ease(rt / 0.35), fwd = ease((rt - 0.35) / 0.15);
        aimArm(mark, 'Right', V(0.12, 0.5 * wind - 1.3 * fwd > 0 ? 0.5 * wind : -0.5 * wind + 1.4 * fwd, -1 + 0.3 * fwd));
        watchers(t, RX - 2.2, RY0 + 1.0, [RX, RY0 + 5]);
        place(lester, RX + 2.4, RY0 - 0.2, 0.05, faceDir(-0.3, 1));
        lester.userData.setPose('idle', t + 0.5);
        place(bill, RX - 3.4, RY0 - 0.6, 0.05, faceDir(0.5, 1));
        bill.userData.setPose('idle', t + 0.6);
        const u = clamp((rt - 0.5) / T, 0, 1), s = 1 - (1 - u) * (1 - u);
        if (rt <= 0.5) { const h = mark.userData.bones.RightHand.getWorldPosition(V(0, 0, 0)); ball.position.set(h.x, h.y, Math.max(0.17, h.z - 0.1)); }
        else { ball.position.set(RX, RY0 + 0.4 + (dist - 0.4) * s, 0.17); ball.rotation.x = -(dist * s) / 0.12; }
        tape.visible = false;
        if (u >= 1) {
          tag(V(RX, RY0 + dist, 0.8), g * FT > NET - 0.15 ? 'Into the net!' : `You: ${g} ft`);
          const k = ease((rt - 0.5 - T - 0.3) / 1.2), len = PAPER_FT * FT * k;
          if (k > 0) {
            tape.visible = true;
            tape.position.set(RX - 0.6, RY0 + len / 2, 0.07);
            tape.scale.set(Math.max(len, 0.001), 1, 1);
            tape.rotation.z = Math.PI / 2;
            tag(V(RX - 0.9, RY0 + len / 2, 0.3), `${Math.round(PAPER_FT * k)} feet`, k >= 1);
          }
        }
      },
      result(g) {
        const miss = Math.abs(g - PAPER_FT), rv = versus(miss, Math.abs(LES_FT - PAPER_FT)), on = miss <= 1;
        return { stars: tiers(miss, 2, 4, 7), rival: rv, short: `${g} / ${PAPER_FT} ft`,
          nums: (on ? `It stopped on the paper, ${PAPER_FT} feet away.` : `You rolled it ${g} feet. The paper is ${PAPER_FT} feet away.`) + versusText(rv) };
      } };

    // ---------- walk to the ring, blindfolded ----------
    const WK = { x0: -9, y: -4.2, v: rfloat(1.25, 1.6), ft: rint(24, 42), les: 0, max: 60, dim: 1.7 };
    WK.les = WK.ft + pick([-6, -5, 5, 6]);
    const walk = { id: 'walk', label: 'Blindfolded walk', kind: 'live', lock: "I'm ready", view: [V(WK.x0 + WK.ft * FT / 2, -21.5, 5.2), V(WK.x0 + WK.ft * FT / 2, -1.0, 1.6)],
      act: (presses) => (presses.length ? 'STOP!' : 'WALK'),
      ask: 'Walk to the ring, blindfolded, and stop inside it. Press WALK to set off and STOP! when you think he is there.',
      hint: 'You get a moment to see how fast he walks. Then it goes dark.  ' + tierHint(3, 6, 10, 'feet'),
      press(t, presses) { if (presses.length < 2 && (presses.length === 0 || t > presses[0] + 0.3)) presses.push(t); },
      feet(t, presses) { return presses.length ? Math.min(WK.max, WK.v * (Math.min(t, presses[1] ?? 1e9) - presses[0]) / FT) : 0; },
      liveDone(t, presses) { return presses.length === 2 ? t > presses[1] + 2.4 : presses.length === 1 && this.feet(t, presses) >= WK.max && t > presses[0] + WK.max * FT / WK.v + 2; },
      frame(phase, t, g, presses) {
        const lt = phase === 'live' ? t : 0, ft = this.feet(lt, presses), going = presses.length >= 1 && lt < (presses[1] ?? 1e9) && ft < WK.max;
        const stopped = presses.length === 2 && lt >= presses[1] || ft >= WK.max;
        mark.visible = false; markB.visible = true;
        for (const r of riders) r.visible = false;
        ring.visible = lmark.visible = true;
        ring.position.set(WK.x0 + WK.ft * FT, WK.y, G0 + 0.04);
        lmark.position.set(WK.x0 + WK.les * FT, WK.y + 0.1, G0 + 0.02);
        tag(V(WK.x0 + WK.les * FT, WK.y, G0 + 0.35), 'Lester');
        place(markB, WK.x0 + ft * FT, WK.y, G0, faceDir(1, 0));
        markB.userData.setPose(going ? 'run' : 'idle', going ? (lt - presses[0]) * 0.75 : t);
        if (going) { aimArm(markB, 'Left', V(1, 0.25, -0.15)); aimArm(markB, 'Right', V(1, -0.25, -0.15)); }
        watchers(t, WK.x0 - 0.6, WK.y + 1.6, [WK.x0 + 5, WK.y]);
        place(lester, WK.x0 - 1.6, WK.y + 1.2, G0, faceDir(1, -0.2));
        lester.userData.setPose('idle', t + 0.5);
        place(bill, WK.x0 + WK.ft * FT + 2.2, WK.y + 2.2, G0, faceDir(-0.7, -1));
        bill.userData.setPose('idle', t + 0.6);
        dark.style.display = phase === 'live' && going && lt - presses[0] > WK.dim ? 'grid' : 'none';
        tape.visible = false;
        if (stopped) {
          const k = ease((lt - (presses[1] ?? lt) - 0.3) / 1.2);
          tag(V(WK.x0 + ft * FT, WK.y, 2.1), ft >= WK.max ? 'Someone stop him!' : `You: ${ft.toFixed(0)} ft`, true);
          if (k > 0) {
            const len = WK.ft * FT * k;
            tape.visible = true;
            tape.position.set(WK.x0 + len / 2, WK.y - 0.7, G0 + 0.03);
            tape.scale.set(Math.max(len, 0.001), 1, 1);
            tape.rotation.z = 0;
            tag(V(WK.x0 + len / 2, WK.y - 1.3, G0 + 0.1), `${Math.round(WK.ft * k)} feet`);
          }
        }
      },
      result(g, presses) {
        if (!presses.length) return { stars: 0, rival: 'lose', short: 'never set off', nums: 'Mark never set off.' };
        const ft = Math.round(this.feet(1e9, presses.length === 2 ? presses : [presses[0], 1e9])), miss = Math.abs(ft - WK.ft);
        const rv = versus(Math.abs(ft - WK.ft), Math.abs(WK.les - WK.ft));
        return { stars: tiers(miss, 3, 6, 10), rival: rv, short: `${ft} / ${WK.ft} ft`, nums: `You walked ${ft} feet. The ring is ${WK.ft} feet away.` + versusText(rv) };
      } };

    // ---------- turn and throw: how many degrees? ----------
    const TN = { x: -1.5, y: -14.5, deg: rint(5, 31) * 5 + pick([-2, -1, 1, 2]), r: rfloat(6.2, 7.6), les: 0 };
    TN.les = TN.deg + pick([-16, -13, 12, 15]);
    const turn = { id: 'turn', label: 'Turn and throw', kind: 'dial', lock: 'Turn and throw', view: [V(TN.x, TN.y - 13.5, 12.5), V(TN.x, TN.y + 2.2, 0.2)],
      ask: 'Mark faces along the white line. Without moving his feet he must turn and throw the ball into the bucket. How many degrees does he turn?',
      hint: "He only turns once you lock it in. Lester's black ball shows where his throw went.  " + tierHint(4, 10, 20, 'degrees'),
      dial: { min: 0, max: 180, step: 1, start: 0, unit: 'degrees to his left' },
      dur: () => 0.9 + 1.3 + 3.0,
      at(deg, r = TN.r) { const a = deg * Math.PI / 180; return [TN.x + r * Math.cos(a), TN.y + r * Math.sin(a)]; },
      frame(phase, t, g) {
        const rt = phase === 'reveal' ? t : 0, a = (g * Math.PI / 180) * ease(rt / 0.9), fly = clamp((rt - 1.1) / 1.1, 0, 1);
        const [bx, by] = this.at(TN.deg), [lx, ly] = this.at(TN.les), [mx, my] = this.at(g);
        bucket.visible = aimLine.visible = ball.visible = lball.visible = true;
        bucket.position.set(bx, by, G0 + 0.34);
        aimLine.position.set(TN.x + 1.6, TN.y, G0 + 0.012);
        aimLine.scale.set(3.2, 1, 1);
        aimLine.rotation.z = 0;
        lball.position.set(lx, ly, G0 + 0.12);
        if (phase === 'ask') { tag(V(bx, by, G0 + 1.5), 'bucket'); tag(V(TN.x, TN.y, 2.3), 'Mark'); }
        place(mark, TN.x, TN.y, G0, faceDir(Math.cos(a), Math.sin(a)));
        mark.userData.setPose('idle', t);
        const wind = ease((rt - 0.7) / 0.3), fwd = ease((rt - 1.0) / 0.15);
        aimArm(mark, 'Right', V(Math.cos(a) * (0.2 - 0.7 * wind + 1.6 * fwd), Math.sin(a) * (0.2 - 0.7 * wind + 1.6 * fwd), -1 + 0.6 * wind + 0.5 * fwd));
        watchers(t, TN.x - 2.4, TN.y - 1.6, [TN.x + 2, TN.y + 3]);
        place(lester, TN.x - 3.4, TN.y - 0.4, G0, faceDir(1, 0.5));
        lester.userData.setPose('idle', t + 0.5);
        place(bill, TN.x + 5.6, TN.y - 2.2, G0, faceDir(-0.8, 1));
        bill.userData.setPose('idle', t + 0.6);
        if (fly <= 0) { const h = mark.userData.bones.RightHand.getWorldPosition(V(0, 0, 0)); ball.position.set(h.x, h.y, Math.max(G0 + 0.12, h.z - 0.1)); }
        else {
          const miss = Math.abs(g - TN.deg), inIt = miss <= allow(4);
          ball.position.set(TN.x + (mx - TN.x) * fly, TN.y + (my - TN.y) * fly, G0 + 0.12 + (1.3 * (1 - fly) + (inIt ? 0.3 : 0) * fly) + 2.6 * 4 * fly * (1 - fly) * 0.5);
          if (fly >= 1 && inIt) ball.position.set(bx, by, G0 + 0.3);
        }
        tape.visible = false;
        if (fly > 0) {                                       // an orange line along the throw, so it can be compared with the true one
          throwLine.visible = true;
          throwLine.position.set(TN.x + (mx - TN.x) * fly / 2, TN.y + (my - TN.y) * fly / 2, G0 + 0.02);
          throwLine.scale.set(Math.max(0.001, TN.r * fly), 1, 1);
          throwLine.rotation.z = g * Math.PI / 180;
        }
        if (fly >= 1) {
          const k = ease((rt - 2.5) / 1.0), miss = Math.abs(g - TN.deg);
          tag(V(mx, my, G0 + 1.3), miss <= allow(4) ? 'In the bucket!' : `You: ${g}°`, miss <= allow(4));
          if (k > 0) {                                       // the true line, swept round from the white one
            const ang = TN.deg * Math.PI / 180 * k;
            tape.visible = true;
            tape.position.set(TN.x + TN.r / 2 * Math.cos(ang), TN.y + TN.r / 2 * Math.sin(ang), G0 + 0.03);
            tape.scale.set(TN.r, 1, 1);
            tape.rotation.z = ang;
            if (k >= 1) tag(V(bx, by, G0 + 1.6), `Bucket: ${TN.deg}°`, true);
          }
        }
      },
      result(g) {
        const miss = Math.abs(g - TN.deg), rv = versus(miss, Math.abs(TN.les - TN.deg));
        return { stars: tiers(miss, 4, 10, 20), rival: rv, short: `${g}° / ${TN.deg}°`,
          nums: (miss <= allow(4) ? `Straight into the bucket. It was ${TN.deg} degrees round.` : `You turned ${g} degrees. The bucket is ${TN.deg} degrees round, so you were ${miss} out.`) + ` Lester was ${Math.abs(TN.les - TN.deg)} out.` + versusText(rv) };
      } };

    // ---------- Lester lets the swing go ----------
    const REL = 0.7, TH0 = rfloat(0.84, 1.02), LES_GAP = rint(13, 20);
    const chin = (() => {
      const reachX = SL * Math.sin(TH0) + 0.12;
      const outcome = (g) => {
        const front = g * FT - 0.2, gap = front - reachX;
        const thHit = Math.asin(clamp((front - 0.12) / SL, -1, 1));
        return { gap, hit: gap < 0, thHit, tHit: Math.acos(clamp(-thHit / TH0, -1, 1)) / W };
      };
      return { id: 'chin', label: 'Swing to the chin', kind: 'dial', lock: 'Let it go, Lester', view: [V(-4.6, -9.4, 2.2), V(-4.6, 0.8, 1.2)],
        ask: 'Closest to the chin wins. Lester lets the swing go; stand as near as you dare to where it stops.',
        hint: `Lester stood ${LES_GAP} inches clear. The slider moves Mark.  ` + tierHint(6, 14, 26, 'inches') + ' · hit = none',
        dial: { min: 1.5, max: 14, step: 0.25, start: 14, unit: 'feet from the post' },
        dur: (g) => { const o = outcome(g); return REL + (o.hit ? o.tHit + 2.0 : Math.PI / W + 1.8); },
        frame(phase, t, g) {
          const o = outcome(g), tt = phase === 'reveal' ? t - REL : -1;
          for (const r of riders) r.visible = false;
          lane.visible = true;
          let th = -TH0, fall = 0;
          if (tt > 0) {
            if (o.hit && tt >= o.tHit) { const a = tt - o.tHit; th = o.thHit * Math.cos(W * a) * Math.exp(-0.9 * a); fall = ease(a / 0.45); }
            else th = -TH0 * Math.cos(W * tt) * Math.exp(-0.1 * tt);
          }
          setSwing(th);
          const sx = PIVOT.x - SL * Math.sin(TH0), sz = PIVOT.z - SL * Math.cos(TH0);
          const dz = sz - (G0 + 1.28), dx = Math.sqrt(Math.max(0.02, 0.21 - dz * dz));
          place(lester, sx - dx - 0.08, PIVOT.y, G0, faceDir(1, 0));
          lester.userData.setPose('idle', t + 0.6);
          if (tt <= 0.25) reach(lester, V(sx - 0.1, PIVOT.y, sz), 0.2);
          place(mark, PIVOT.x + g * FT + fall * 0.2, PIVOT.y, G0 + fall * 0.14, faceDir(-1, 0));
          mark.rotation.y = fall * 1.5;
          mark.userData.setPose('idle', t);
          watchers(t, -7.5, -1.8, [PIVOT.x + 2, PIVOT.y]);
          place(bill, 0.4, 3.0, G0, faceDir(-1, -0.6));
          bill.userData.setPose('idle', t + 0.6);
          if (o.hit && tt >= o.tHit) tag(V(PIVOT.x + g * FT, PIVOT.y, 2.1), 'BONK!', true);
          if (!o.hit && tt >= Math.PI / W) {
            const inches = Math.round(o.gap / IN);
            tag(V(PIVOT.x + reachX + o.gap / 2, PIVOT.y, sz + 0.75), inches <= 0 ? 'A whisker!' : `${inches} in. to spare`, true);
          }
        },
        result(g) {
          const o = outcome(g), inches = Math.round(o.gap / IN), rv = o.hit ? 'lose' : versus(inches, LES_GAP);
          return { stars: o.hit ? 0 : tiers(inches, 6, 14, 26), rival: rv, short: o.hit ? 'hit' : `${inches} in. clear`,
            nums: (o.hit ? `You stood ${num(g)} feet from the post. The swing reaches ${num((reachX + 0.2) / FT)}.` : `The swing stopped ${inches} inches from your chin. Lester managed ${LES_GAP}.`) + versusText(rv),
            line: o.hit ? 'Mr. Lesterson, wipe that smile off your face.' : null };
        } };
    })();

    const jv = [V(-4.4, -9.8, 2.3), V(-4.4, 0.8, 1.25)];
    const CH = [
      roll,
      jump('jump', 'Off the swing', rfloat(0.8, 0.95), pick([24, 28, 33, -26, -30]), 0.9, 'Swing, let go, and land in the ring. Hit JUMP! (or the space bar) at the moment Mark should leave the seat.', jv),
      walk,
      turn,
      chin,
    ];

    // ---------- cutscene: the huddle ----------
    const CUT = { dur: 27.5, caps: [
      [0.6, 4.6, 'Mark', "I don't know how he's doin' it, man! None of those questions even made him flinch!"],
      [4.9, 9.6, 'Bill', "It feels like he's dead on with every answer. He's more like a calculator than an Estimator. Something doesn't feel right…"],
      [9.9, 13.6, 'Mark', "And what is with the secret service dude with the laptop? He's distracting the hell out of me."],
      [13.9, 18.4, 'Bill', 'Just stay focused, Mark. The next round is physical. We trained for this! Go get him.'],
      [19.6, 26.8, 'Official', 'All right, gentlemen. I will give you a physical task to complete. Each will involve estimation in some capacity.'],
    ] };
    function runCut(t) {
      reset();
      place(mark, 4.6, -3.6, G0, faceDir(-1, 0.25));
      mark.userData.setPose('idle', t);
      place(bill, 3.6, -3.3, G0, faceDir(1, -0.2));
      bill.userData.setPose('idle', t + 0.6);
      watchers(t, -4.6, -1.6, [0, -6]);
      place(lester, -5.6, -0.4, G0, faceDir(0.6, -1));
      lester.userData.setPose('idle', t + 0.5);
      if (t < 19) {
        const u = ease(t / 19);
        camera.position.lerpVectors(V(4.6, -9.2, 1.9), V(3.8, -8.6, 1.75), u);
        camLook.set(4.1, -3.4, 1.05);
      } else {
        const u = ease((t - 19) / 8.5);
        camera.position.lerpVectors(V(-2.2, -8.4, 2.2), V(-3.0, -7.4, 1.9), u);
        camLook.set(-5.0, -0.8, 1.1);
      }
      camera.lookAt(camLook);
      aimSun(camLook);
    }
    function idle(t) {
      reset();
      const a = -0.5 + 0.25 * Math.sin(t * 0.2);
      camera.position.set(-1 + Math.sin(a) * 24, 1 - Math.cos(a) * 24, 8);
      camLook.set(-1, 1, 1);
      camera.lookAt(camLook);
      aimSun(camLook);
      watchers(t, -4.6, -1.6, [0, -6]);
      place(lester, -5.6, -0.4, G0, faceDir(0.6, -1));
      lester.userData.setPose('idle', t + 0.5);
      place(mark, 0.1, -1.2, G0, faceDir(-0.3, -1));
      mark.userData.setPose('idle', t);
      place(bill, 1.2, -0.9, G0, faceDir(-0.5, -1));
      bill.userData.setPose('idle', t + 0.6);
    }
    return { CH, CUT, runCut, idle, reset };
  },
});
