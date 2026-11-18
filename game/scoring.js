// One scoring rule for the whole game, so the stars always mean the same thing.
//   On the standard difficulty: three stars within 5% of the truth, two within 15%, one within 30%.
// A level is passed by earning at least `need` stars; the rank title is just a name for the share of stars earned.
// The difficulty setting moves the percentages, the inch and second allowances, the pass mark and the answer clocks together.
import { DIFF, unlock, levelOf } from './settings.js';
const P = DIFF.pct.map((p) => Math.round(p * 100));
export const RULE = `★★★ within ${P[0]}%  ·  ★★ within ${P[1]}%  ·  ★ within ${P[2]}%`;
export const starText = (n) => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';
export function pctStars(guess, answer) {
  const off = Math.abs(guess - answer) / answer;
  return { off, stars: off <= DIFF.pct[0] ? 3 : off <= DIFF.pct[1] ? 2 : off <= DIFF.pct[2] ? 1 : 0 };
}
export const offText = (off) => (off === 0 ? 'Exactly right.' : off >= 9.995 ? 'Off by more than 1000%.' : `Off by ${Math.round(off * 100)}%.`);
// for misses measured in inches, feet, degrees or seconds: the allowances stretch or shrink with the difficulty
export const allow = (x) => (x < 2 ? Math.round(x * DIFF.tier * 100) / 100 : Math.round(x * DIFF.tier));
export function tiers(value, t3, t2, t1) { return value <= allow(t3) ? 3 : value <= allow(t2) ? 2 : value <= allow(t1) ? 1 : 0; }
export const tierHint = (t3, t2, t1, unit, what = '') => `★★★ within ${allow(t3)} ${unit}${what}  ·  ★★ ${allow(t2)}  ·  ★ ${allow(t1)}`;

const LADDER = ['Deplorable Deducer', 'Awful Assessor', 'Jumbled Judger', 'Inferior Inferrer', 'Careless Counter', 'Pathetic Pourer', 'Mediocre Measurer',
  'Excellent Evaluator', 'Gifted Guesser', 'Astounding Appraiser', 'Postulating Prodigy', 'Competition Contender', 'Certified Calculator',
  'Outstanding Observer', 'Exceptional Estimator', 'Competition Official', 'Lester Lesterson', 'Bill Billson', 'Underground Boss', 'Mark Markson'];

// rows: [{label, detail, stars}]. The title comes from the original game's 20-step ladder and always matches the result:
// a failed level gets one of the seven unflattering titles, a passed one climbs from 'Excellent Evaluator' to 'Mark Markson' at full marks.
export function showResults(el, rows, { need, next, nextLabel, failQuote, passQuote, aceQuote, title = "Bill's assessment", note = '', onNext = null }) {
  const max = rows.length * 3;
  need = Math.min(max, Math.round(need * DIFF.need));
  const total = rows.reduce((s, r) => s + r.stars, 0), passed = total >= need;
  const rank = passed ? 8 + Math.round(((total - need) / (max - need)) * 12) : 1 + Math.round((total / need) * 6);
  const ace = total >= max * 0.85;
  el.querySelector('h2').textContent = `${title} · ${total} of ${max} stars`;
  el.querySelector('.rank').textContent = LADDER[rank - 1];
  el.querySelector('.quote').innerHTML = `${note}` + (passed ? `You needed ${need} stars to move on. ${ace && aceQuote ? aceQuote : passQuote}` : `You need ${need} stars to move on. ${failQuote}`);
  el.querySelector('table').innerHTML = rows.map((r) => `<tr><td>${r.label}</td><td>${r.detail}</td><td>${starText(r.stars)}</td></tr>`).join('');
  const nb = el.querySelector('#nextlevel');
  if (nb) { nb.classList.toggle('hidden', !(passed && (next || onNext))); if (next || onNext) { nb.textContent = nextLabel; nb.onclick = onNext || (() => { location.href = next; }); } }
  if (passed && next) unlock(levelOf(next));
  return { total, max, passed };
}
