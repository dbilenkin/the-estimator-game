// What every level shares around the game itself: the menu (pause, restart, level select, start over, settings),
// the "turn your phone sideways" card, and the rule for where the 3D picture sits on the screen.
import { SET, saveSettings, DIFFS, LEVELS, unlocked, unlock, eraseProgress } from './settings.js';

export const shell = { paused: false, menuOpen: false, audio: null };
const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const portraitPhone = () => innerHeight > innerWidth && innerWidth < 600;
function refreshPause() { shell.paused = shell.menuOpen || portraitPhone(); }

export function graphics(renderer, sun) {              // 'fast' is for phones: fewer pixels, no shadows
  const fast = SET.gfx === 'fast';
  renderer.setPixelRatio(Math.min(devicePixelRatio, fast ? 1.25 : 2));
  if (fast) renderer.shadowMap.enabled = false;
  if (sun && fast) sun.castShadow = false;
}

export function initShell(level) {
  unlock(level);                                        // being on a level means it is open
  const here = LEVELS[level - 1];
  const btn = el('button', '', '☰');
  btn.id = 'menubtn';
  btn.setAttribute('aria-label', 'Menu');
  const rotate = el('div', '', '<div><b>↻</b>Turn your phone sideways.<small>The Estimator plays in landscape.</small></div>');
  rotate.id = 'rotate';
  const menu = el('div', 'hidden');
  menu.id = 'menu';
  menu.innerHTML = `<div class="card panel">
    <h2>Paused</h2><div class="where">Level ${here.n}: ${here.name}</div>
    <div class="cols">
      <div>
        <button class="primary" data-do="resume">Resume</button>
        <button data-do="restart">Restart this level</button>
        <button data-do="over">Start the game over</button>
        <div class="confirm hidden">This erases your progress and goes back to Level 1.<br><button class="primary" data-do="over-yes">Erase and start over</button><button data-do="over-no">Keep playing</button></div>
        <h3>Levels</h3><div class="levels"></div>
      </div>
      <div>
        <h3>Settings</h3>
        <label>Music <input type="range" min="0" max="100" step="5" data-set="music"><span data-out="music"></span></label>
        <label>Difficulty <span class="seg" data-set="diff">${Object.entries(DIFFS).map(([k, d]) => `<button data-v="${k}">${d.name}</button>`).join('')}</span></label>
        <label>Cutscenes <span class="seg" data-set="skipCuts"><button data-v="false">Play</button><button data-v="true">Skip</button></span></label>
        <label>Graphics <span class="seg" data-set="gfx"><button data-v="best">Best</button><button data-v="fast">Fast</button></span></label>
        <div class="note"></div>
        <div class="how">Drag the picture to look around. Scroll or pinch to zoom.</div>
      </div>
    </div></div>`;
  document.body.append(btn, menu, rotate);

  const note = menu.querySelector('.note');
  let reload = false;
  function paint() {
    menu.querySelector('[data-set=music]').value = Math.round(SET.music * 100);
    menu.querySelector('[data-out=music]').textContent = SET.music === 0 ? 'Off' : Math.round(SET.music * 100) + '%';
    for (const seg of menu.querySelectorAll('.seg')) for (const b of seg.children) b.classList.toggle('on', String(SET[seg.dataset.set]) === b.dataset.v);
    const d = DIFFS[SET.diff], p = d.pct.map((x) => Math.round(x * 100));
    note.textContent = `${d.name}: three stars within ${p[0]}%, two within ${p[1]}%, one within ${p[2]}%.` + (reload ? ' The level restarts when you close this menu.' : '');
    const open = unlocked();
    menu.querySelector('.levels').innerHTML = LEVELS.map((l) => `<button data-go="${l.url}" ${l.n > open ? 'disabled' : ''} class="${l.n === level ? 'on' : ''}">${l.n > open ? '🔒' : l.n}<small>${l.name}</small></button>`).join('');
  }
  function show(open) {
    if (!open && reload) { location.href = location.pathname + (level === 1 ? '' : '?start=play'); return; }
    shell.menuOpen = open;
    menu.classList.toggle('hidden', !open);
    menu.querySelector('.confirm').classList.add('hidden');
    refreshPause();
    if (open) paint();
  }
  btn.onclick = () => show(!shell.menuOpen);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') show(!shell.menuOpen); });
  addEventListener('resize', refreshPause);
  refreshPause();
  menu.addEventListener('input', (e) => {
    if (e.target.dataset.set !== 'music') return;
    SET.music = +e.target.value / 100;
    saveSettings();
    if (shell.audio) shell.audio.setVolume(SET.music);
    paint();
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (e.target === menu) return show(false);
    if (!b) return;
    const seg = b.parentElement.dataset.set;
    if (seg) {
      const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v;
      if (SET[seg] !== v && seg !== 'skipCuts') reload = true;          // stars and picture quality are set when a level loads
      SET[seg] = v;
      saveSettings();
      return paint();
    }
    if (b.dataset.go) location.href = b.dataset.go;
    const act = b.dataset.do;
    if (act === 'resume') show(false);
    if (act === 'restart') location.href = location.pathname + '?start=play';
    if (act === 'over') menu.querySelector('.confirm').classList.remove('hidden');
    if (act === 'over-no') menu.querySelector('.confirm').classList.add('hidden');
    if (act === 'over-yes') { eraseProgress(); location.href = './index.html'; }
  });

  // on the first page, offer to carry on from the furthest level reached
  const far = unlocked();
  if (level === 1 && far > 1 && document.getElementById('play')) {
    const go = el('button', '', `Continue · Level ${far}: ${LEVELS[far - 1].name} ▸`);
    go.id = 'continue';
    go.onclick = () => { location.href = LEVELS[far - 1].url; };
    document.getElementById('play').after(go);
  }
  if (new URLSearchParams(location.search).has('menu')) show(true);      // test aid
  return { open: () => show(true) };
}

// Where the 3D picture goes: inside the free part of the screen, clear of the progress bar and of whichever panel is showing.
// A panel along the bottom (a desk screen) leaves the space above it; a panel docked on the right (a phone held sideways) leaves the space beside it.
// When that space is narrower than the views were composed for, the camera widens so the same width of scene still fits.
const BASE = { play: 24, show: 30 }, COMPOSED = { play: 2.6, show: 1.75 };
export function frameView(camera, st, { playing, panel, cine, snap }) {
  const W = innerWidth, H = innerHeight;
  if (panel && playing) {
    const p = panel.getBoundingClientRect();
    if (p.width) st.free = p.left > W * 0.45 ? { r: p.left - 10, b: H } : { r: W, b: p.top - 14 };
  }
  const hud = document.getElementById('hud').getBoundingClientRect();
  const want = playing ? { t: hud.height ? hud.bottom + 8 : 58, r: st.free ? st.free.r : W, b: st.free ? st.free.b : H * 0.6 }
    : { t: 0, r: W, b: cine ? H - Math.max(0.14 * H, 84) : H };
  const k = snap || !st.set ? 1 : 0.18;
  for (const key of ['t', 'r', 'b']) st[key] = (st.set ? st[key] : want[key]) + (want[key] - (st.set ? st[key] : want[key])) * k;
  st.set = true;
  const w = Math.max(50, st.r), h = Math.max(50, st.b - st.t), aspect = w / h, kind = playing ? 'play' : 'show';
  const half = Math.tan((BASE[kind] * Math.PI) / 360) * Math.max(1, COMPOSED[kind] / aspect);
  camera.fov = Math.min(80, (Math.atan(half) * 360) / Math.PI);
  camera.aspect = aspect;
  camera.setViewOffset(w, h, 0, -st.t, W, H);
}

// two fingers on the picture: pinch to zoom. Calls zoom(factor) with >1 to move away.
export function pinchZoom(dom, zoom) {
  const pts = new Map();
  let last = 0;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  dom.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) last = dist(); });
  dom.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const d = dist(); if (last > 0 && d > 0) zoom(last / d); last = d; }
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) dom.addEventListener(ev, (e) => { pts.delete(e.pointerId); last = 0; });
  return () => pts.size >= 2;
}
