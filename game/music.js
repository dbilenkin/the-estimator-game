// Background music, made here rather than played from a file: a small band (bass, soft keys, a plucked lead, brushes)
// that improvises over a chord loop, so it never repeats exactly. Three moods: 'home', 'play' and 'tense'.
const MOODS = {
  home: { bpm: 84, root: 48, swing: 0.16, scale: [0, 2, 4, 7, 9], lead: 'triangle', drums: 0.5,
    prog: [[[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]]] },
  play: { bpm: 108, root: 50, swing: 0.1, scale: [0, 2, 4, 7, 9], lead: 'square', drums: 0.8,
    prog: [[[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]]] },
  tense: { bpm: 118, root: 45, swing: 0, scale: [0, 2, 3, 7, 8], lead: 'sawtooth', drums: 1, pulse: true,
    prog: [[[0, 3, 7], [0, 3, 7], [8, 12, 15], [7, 10, 14]], [[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 11, 14]]] },
  // cutscenes: slow, low and ominous. Held string chords, a pulsing bass, big drum hits, a lonely high line.
  drama: { bpm: 70, root: 38, swing: 0, scale: [0, 2, 3, 7, 8], lead: 'triangle', drums: 1, pulse: true, pad: true, sparse: true, boom: true,
    prog: [[[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], [[0, 3, 7], [3, 7, 10], [8, 12, 15], [7, 11, 14]]] },
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function startMusic(moodName = 'home', volume = 1) {
  let M = MOODS[moodName] || MOODS.home, pending = null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { setMood() {}, setVolume() {}, toggle() { return false; }, stop() {} };
  const ac = new AC(), master = ac.createGain(), lp = ac.createBiquadFilter();
  // phones start audio asleep and only wake it inside a tap or a click, so keep trying on each one until it is running
  const wake = () => { if (ac.state !== 'running') ac.resume().catch(() => {}); };
  for (const ev of ['touchend', 'click', 'pointerup', 'keydown']) addEventListener(ev, wake, true);
  wake();
  master.gain.value = 0.0;
  master.gain.linearRampToValueAtTime(0.3 * volume, ac.currentTime + 1.5);
  lp.type = 'lowpass'; lp.frequency.value = 2600;
  master.connect(lp); lp.connect(ac.destination);
  const echo = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
  echo.delayTime.value = 0.42; fb.gain.value = 0.28; wet.gain.value = 0.22;
  echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  function note(type, midi, t, dur, vol, send = 0, attack = 0.012) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master);
    if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(echo); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t, vol) {
    const n = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6500;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.07);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.1);
  }
  function kick(t, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.2);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
  }
  function snare(t, vol) {
    const n = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    n.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1900;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.2);
  }

  let nextT = ac.currentTime + 0.15, i = 0, deg = 2, rest = 0, motif = [];
  function schedule() {
    while (nextT < ac.currentTime + 0.35) {
      if (pending && i % 8 === 0) { M = pending; pending = null; i = 0; motif = []; }     // change mood on a bar line
      const beat = 60 / M.bpm, step = beat / 2;         // eighth notes
      const bar = Math.floor(i / 8), s8 = i % 8, section = Math.floor(bar / 8) % M.prog.length;
      const chord = M.prog[section][bar % 4], t = nextT + (s8 % 2 ? step * M.swing : 0);
      const quiet = bar % 16 >= 14 ? 0.6 : 1;            // a breath every sixteen bars
      // bass: root on one, fifth or walk-up later in the bar
      if (s8 === 0) note('triangle', M.root - 12 + chord[0], t, beat * 1.6, 0.5);
      if (s8 === 4) note('triangle', M.root - 12 + (M.pulse ? chord[0] : chord[2]), t, beat * 0.9, 0.38);
      if (s8 === 7 && Math.random() < 0.5) note('triangle', M.root - 12 + chord[1], t, step * 0.9, 0.3);
      if (M.pulse && s8 % 2 === 1) note('triangle', M.root - 12 + chord[0], t, step * 0.6, 0.2);
      if (M.pad && s8 === 0) for (const c of chord) { note('sawtooth', M.root + c, t, beat * 4.2, 0.045, 0.2, beat * 1.2); note('sawtooth', M.root + 12 + c + 0.07, t, beat * 4.2, 0.022, 0.2, beat * 1.6); }
      // keys: the chord, on one and a push on the "and" of two
      if (!M.pad && (s8 === 0 || s8 === 3)) for (const c of chord) note('sine', M.root + 12 + c, t, beat * (s8 === 0 ? 1.4 : 0.8), 0.07 * quiet, 0.3);
      // lead: a random walk on the scale; every other four bars it repeats the phrase it just played
      if (bar >= 2) {
        const phrase = Math.floor(bar / 2), repeat = phrase % 2 === 1 && motif.length === 16, k = (bar % 2) * 8 + s8;
        let play = null;
        if (repeat) play = motif[k];
        else {
          if (rest > 0) rest--;
          else if (Math.random() < (M.sparse ? (s8 % 4 ? 0 : 0.55) : s8 % 2 ? 0.35 : 0.6)) {
            deg = Math.max(0, Math.min(9, deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
            play = { deg, len: M.sparse ? 4 : Math.random() < 0.3 ? 2 : 1 };
            if (Math.random() < 0.25) rest = 1 + Math.floor(Math.random() * 2);
          }
          if (k === 0) motif = [];
          motif[k] = play;
        }
        if (play) {
          const m = M.root + 24 + M.scale[play.deg % 5] + 12 * Math.floor(play.deg / 5);
          note(M.lead, m, t, step * play.len * 0.95, (M.lead === 'triangle' ? 0.16 : 0.055) * quiet, 0.5);
        }
      }
      // brushes
      const d = M.drums;
      if (M.boom) {
        if (s8 === 0) { kick(t, 0.9); snare(t, 0.05); }
        if (s8 === 6 && bar % 2 === 1) { kick(t, 0.6); kick(t + step, 0.75); }
      } else if (bar >= 1) {
        hat(t, (s8 % 2 ? 0.035 : 0.06) * d);
        if (s8 === 0 || (s8 === 5 && d > 0.7)) kick(t, 0.5 * d);
        if (s8 === 2 || s8 === 6) snare(t, 0.12 * d);
      }
      nextT += step; i++;
    }
  }
  const timer = setInterval(schedule, 90);
  schedule();
  let on = true;
  return {
    setMood(name) { const m = MOODS[name]; if (m && m !== M && m !== pending) pending = m; if (m === M) pending = null; },
    setVolume(v) { volume = v; master.gain.cancelScheduledValues(ac.currentTime); master.gain.linearRampToValueAtTime(on ? 0.3 * volume : 0, ac.currentTime + 0.15); if (ac.state === 'suspended') ac.resume(); },
    toggle() { on = !on; master.gain.cancelScheduledValues(ac.currentTime); master.gain.linearRampToValueAtTime(on ? 0.3 * volume : 0, ac.currentTime + 0.2); return on; },
    stop() { clearInterval(timer); ac.close(); },
  };
}
