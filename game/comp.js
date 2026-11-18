// Shared by the three competition levels: how the Official reacts, by stars earned.
export const OFFICIAL_LINES = [
  ['Noted. Regrettably.', 'The Underground has seen… better.', 'I will write that down. In pencil.'],
  ['In the vicinity, Mr. Markson.', 'A guess. Not yet an estimate.'],
  ['Acceptable.', 'Close, Mr. Markson.'],
  ['Excellent, Mr. Markson.', 'Precisely the sort of thing we look for.'],
];
export function versus(mine, his) { return mine < his - 1e-9 ? 'win' : mine > his + 1e-9 ? 'lose' : 'tie'; }
export const versusText = (r) => (r === 'win' ? ' You beat Lester.' : r === 'tie' ? ' A tie with Lester.' : ' Point to Lester.');
