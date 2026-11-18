// Player settings and progress, kept in the browser. No page furniture here, so every module can import it.
const KEY = 'estimator-settings', PROGRESS = 'estimator-level';
const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
const DEFAULTS = { music: 0.7, diff: 'normal', skipCuts: false, gfx: phone ? 'fast' : 'best' };

function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }       // a private window may refuse storage
function write(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* play on without saving */ } }

export const SET = { ...DEFAULTS };
try { Object.assign(SET, JSON.parse(read(KEY) || '{}')); } catch (e) { /* damaged settings: use the defaults */ }
{ const q = new URLSearchParams(location.search); if (q.has('diff')) SET.diff = q.get('diff'); if (q.has('gfx')) SET.gfx = q.get('gfx'); }   // test aids
export function saveSettings() { write(KEY, JSON.stringify(SET)); }

// pct: how close earns three, two and one star. tier: scales misses judged in inches or seconds.
// need: scales the pass mark. clock: scales the answer clocks.
export const DIFFS = {
  relaxed: { name: 'Relaxed', pct: [0.1, 0.25, 0.5], tier: 1.5, need: 0.8, clock: 1.5 },
  normal: { name: 'Standard', pct: [0.05, 0.15, 0.3], tier: 1, need: 1, clock: 1 },
  hard: { name: 'Estimator', pct: [0.03, 0.1, 0.2], tier: 0.7, need: 1.15, clock: 0.75 },
};
export const DIFF = DIFFS[SET.diff] || DIFFS.normal;

export const LEVELS = [
  { n: 1, url: './index.html', name: 'Rock Bottom' },
  { n: 2, url: './level2.html', name: 'Training Day' },
  { n: 3, url: './level3.html', name: 'The Playground' },
  { n: 4, url: './level4.html', name: 'Round 1: Questions' },
  { n: 5, url: './level5.html', name: 'Round 2: Physical' },
  { n: 6, url: './level6.html', name: 'Round 3: Freestyle' },
];
export function levelOf(url) { const m = /level(\d)/.exec(url || ''); return m ? +m[1] : 1; }
export function unlocked() { return Math.max(1, Math.min(LEVELS.length, +read(PROGRESS) || levelOf(read('estimator-unlocked')))); }   // the second key is where earlier versions kept progress
export function unlock(n) { if (n > unlocked()) write(PROGRESS, String(n)); }
export function eraseProgress() { write(PROGRESS, '1'); }
