// Random values for the questions, so no two plays are the same. ?seed=N pins them (used for test screenshots).
const Q = new URLSearchParams(location.search);
let s = Q.has('seed') ? (+Q.get('seed') * 2654435761) >>> 0 : (Math.random() * 4294967296) >>> 0;
export function rnd() {                              // mulberry32
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));          // whole number, lo..hi inclusive
export const rstep = (lo, hi, step) => lo + step * rint(0, Math.round((hi - lo) / step));
export const rfloat = (lo, hi) => lo + rnd() * (hi - lo);
export const pick = (arr) => arr[rint(0, arr.length - 1)];
export function shuffled(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rint(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
