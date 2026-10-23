// «Под Землёй» — звуки. Всё синтезируется в браузере через Web Audio: никаких файлов.
// Звук включается после первого касания или нажатия (так требуют браузеры).
// Атмосфера пещеры (гул, ветер, капли) — по желанию, выключена по умолчанию.

const KEY = 'pz.sfx';
const st = (() => {
  const d = { on: true, vol: 0.7, amb: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return d; }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* приватный режим */ } };
const rnd = (a, b) => a + Math.random() * (b - a);

// ───────────── движок: микшер, компрессор, пещерная реверберация ─────────────
function impulse(ac, sec, decay) {
  const len = Math.floor(ac.sampleRate * sec);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    // ранние отражения от стен
    for (const [ms, k] of [[23, 0.5], [41, 0.35], [67, 0.25]]) { const j = Math.floor(ac.sampleRate * ms / 1000) + c * 7; if (j < len) d[j] += k * (c ? -1 : 1); }
  }
  return buf;
}
function makeEngine(ac, destination) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
  const master = ac.createGain();
  master.gain.value = 0.8;
  master.connect(comp); comp.connect(destination);
  const verb = ac.createConvolver();
  verb.buffer = impulse(ac, 1.7, 3.2);
  const wet = ac.createGain(); wet.gain.value = 0.42;
  verb.connect(wet); wet.connect(master);
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return {
    ac, master, verb, noise,
    out(node, send = 0.25) {
      node.connect(master);
      if (send > 0) { const g = ac.createGain(); g.gain.value = send; node.connect(g); g.connect(verb); }
    },
  };
}

// ───────────── кирпичики ─────────────
function env(g, t, a, vol, dur, hold = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  if (hold) g.gain.setValueAtTime(vol, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + hold + 0.01, dur));
}
function tone(E, { t, f, f2, type = 'sine', dur = 0.2, vol = 0.2, a = 0.005, hold = 0, wet = 0.2, lp, vib, vibF = 6, lin = false }) {
  const { ac } = E;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) { if (lin) o.frequency.linearRampToValueAtTime(f2, t + dur); else o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur); }
  let lfo = null;
  if (vib) {
    lfo = ac.createOscillator(); lfo.frequency.value = vibF;
    const lg = ac.createGain(); lg.gain.value = vib;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const g = ac.createGain();
  env(g, t, a, vol, dur, hold);
  let node = o;
  if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g);
  E.out(g, wet);
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseV(E, { t, dur = 0.2, vol = 0.2, type = 'bandpass', f = 1000, f2, q = 1, a = 0.005, hold = 0, wet = 0.2 }) {
  const { ac } = E;
  const src = ac.createBufferSource();
  src.buffer = E.noise; src.loop = true;
  const fl = ac.createBiquadFilter();
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain();
  env(g, t, a, vol, dur, hold);
  src.connect(fl); fl.connect(g);
  E.out(g, wet);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function bell(E, { t, f, dur = 1, vol = 0.12, wet = 0.5, partials = [1, 2.0, 2.99, 4.18], gains = [1, 0.45, 0.25, 0.12] }) {
  partials.forEach((p, i) => tone(E, { t, f: f * p, dur: dur * (1 - i * 0.18), vol: vol * (gains[i] ?? 0.1), a: 0.003, wet }));
}
const thud = (E, t, k = 1) => {
  tone(E, { t, f: 125, f2: 42, dur: 0.32, vol: 0.5 * k, wet: 0.35 });
  noiseV(E, { t, dur: 0.18, vol: 0.32 * k, type: 'lowpass', f: 480, wet: 0.3 });
};
const coin = (E, t, f = rnd(1900, 2600)) => {
  [[1, 0.11, 0.38], [2.76, 0.055, 0.22], [5.4, 0.028, 0.12]].forEach(([p, v, d]) => tone(E, { t, f: f * p, dur: d, vol: v, a: 0.002, wet: 0.4 }));
};

// ───────────── сами звуки ─────────────
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G4 = 392;
const SOUNDS = {
  click(E, t) { tone(E, { t, f: 1150, f2: 720, type: 'triangle', dur: 0.05, vol: 0.12, wet: 0 }); },
  flip(E, t) {
    noiseV(E, { t, dur: 0.07, vol: 0.2, type: 'highpass', f: 2400, wet: 0.08 });
    noiseV(E, { t: t + 0.025, dur: 0.05, vol: 0.1, type: 'bandpass', f: 5200, q: 2, wet: 0 });
  },
  deal(E, t) { noiseV(E, { t, dur: 0.09, vol: 0.32, type: 'bandpass', f: 1800, f2: 4400, q: 0.8, wet: 0.08 }); },
  whoosh(E, t) { noiseV(E, { t, dur: 0.34, vol: 0.2, a: 0.13, type: 'bandpass', f: 340, f2: 2700, q: 1.1, wet: 0.2 }); },
  place(E, t) {
    noiseV(E, { t, dur: 0.09, vol: 0.26, type: 'lowpass', f: 1400, wet: 0.15 });
    tone(E, { t, f: 190, f2: 90, dur: 0.1, vol: 0.18, wet: 0.1 });
  },
  door(E, t) {
    // скрип петель: пила через узкий фильтр, высота дрожит
    const { ac } = E;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t);
    o.frequency.linearRampToValueAtTime(245, t + 0.18);
    o.frequency.linearRampToValueAtTime(172, t + 0.4);
    const l = ac.createOscillator(); l.frequency.value = 23;
    const lg = ac.createGain(); lg.gain.value = 22;
    l.connect(lg); lg.connect(o.frequency);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 6;
    const g = ac.createGain(); env(g, t, 0.05, 0.2, 0.42, 0.24);
    o.connect(bp); bp.connect(g); E.out(g, 0.35);
    o.start(t); l.start(t); o.stop(t + 0.46); l.stop(t + 0.46);
    thud(E, t + 0.36, 0.75);
  },
  growl(E, t, o = {}) {
    const p = o.pitch || 1, d = o.dur || 0.75;
    const { ac } = E;
    const o1 = ac.createOscillator(); o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(76 * p, t);
    o1.frequency.linearRampToValueAtTime(98 * p, t + d * 0.3);
    o1.frequency.exponentialRampToValueAtTime(50 * p, t + d);
    const o2 = ac.createOscillator(); o2.type = 'square';
    o2.frequency.setValueAtTime(38 * p, t);
    o2.frequency.exponentialRampToValueAtTime(27 * p, t + d);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
    lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(950, t + d * 0.3); lp.frequency.exponentialRampToValueAtTime(320, t + d);
    const am = ac.createGain(); am.gain.value = 0.6;
    const trem = ac.createOscillator(); trem.frequency.value = 27;
    const tg = ac.createGain(); tg.gain.value = 0.4;
    trem.connect(tg); tg.connect(am.gain);
    const g = ac.createGain(); env(g, t, 0.06, 0.2, d, d * 0.35);
    o1.connect(lp); o2.connect(lp); lp.connect(am); am.connect(g); E.out(g, 0.3);
    [o1, o2, trem].forEach(x => { x.start(t); x.stop(t + d + 0.05); });
    noiseV(E, { t, dur: d * 0.9, vol: 0.09, a: 0.05, type: 'bandpass', f: 360, q: 3, wet: 0.3 });
  },
  ambush(E, t) {
    [233.08, 277.18, 329.63, 415.3].forEach(f => tone(E, { t, f, type: 'square', dur: 0.55, vol: 0.06, lp: 2200, wet: 0.45 }));
    noiseV(E, { t, dur: 0.16, vol: 0.2, type: 'highpass', f: 1800, wet: 0.3 });
    SOUNDS.growl(E, t + 0.12, { pitch: 0.9, dur: 0.6 });
  },
  curse(E, t) {
    tone(E, { t, f: 220, dur: 1.3, a: 0.35, vol: 0.09, vib: 7, vibF: 5.5, wet: 0.7 });
    tone(E, { t, f: 233, dur: 1.3, a: 0.35, vol: 0.09, vib: 7, vibF: 6.2, wet: 0.7 });
    tone(E, { t, f: 110, f2: 96, type: 'triangle', dur: 1.4, a: 0.4, vol: 0.12, wet: 0.6 });
    tone(E, { t: t + 0.1, f: 900, f2: 430, dur: 1, a: 0.25, vol: 0.035, vib: 14, vibF: 7, wet: 0.85 });
    noiseV(E, { t, dur: 1.2, a: 0.3, vol: 0.1, type: 'lowpass', f: 230, wet: 0.5 });
  },
  death(E, t) {
    tone(E, { t, f: 196, f2: 82, dur: 1.2, vol: 0.2, wet: 0.6 });
    tone(E, { t, f: 98, f2: 55, type: 'square', dur: 0.9, vol: 0.07, lp: 420, wet: 0.4 });
    thud(E, t + 0.05, 0.8);
    bell(E, { t: t + 0.2, f: 147, dur: 1.8, vol: 0.1, wet: 0.7 });
  },
  levelUp(E, t) {
    [C5, E5, G5, C6, E6].forEach((f, i) => bell(E, { t: t + i * 0.065, f, dur: 0.6, vol: 0.12, wet: 0.55 }));
    noiseV(E, { t: t + 0.25, dur: 0.45, a: 0.1, vol: 0.04, type: 'highpass', f: 6500, wet: 0.8 });
  },
  levelDown(E, t) {
    tone(E, { t, f: 330, f2: 300, type: 'sawtooth', dur: 0.22, vol: 0.11, lp: 950, wet: 0.3 });
    tone(E, { t: t + 0.22, f: 262, f2: 165, type: 'sawtooth', dur: 0.55, a: 0.02, vol: 0.12, lp: 750, vib: 6, vibF: 5, wet: 0.35 });
  },
  victory(E, t) {
    [G4, C5, E5, G5].forEach((f, i) => tone(E, { t: t + i * 0.09, f, type: 'triangle', dur: 0.18, vol: 0.15, wet: 0.35 }));
    [C5, E5, G5, C6].forEach(f => {
      tone(E, { t: t + 0.36, f, type: 'triangle', dur: 0.95, a: 0.01, hold: 0.25, vol: 0.08, wet: 0.5 });
      tone(E, { t: t + 0.36, f, type: 'square', dur: 0.7, a: 0.01, vol: 0.022, lp: 2400, wet: 0.4 });
    });
    for (let i = 0; i < 6; i++) coin(E, t + 0.42 + i * 0.075 + rnd(0, 0.03));
  },
  fanfare(E, t) {
    [C5, E5, G5, C6, E6].forEach((f, i) => tone(E, { t: t + i * 0.1, f, type: 'triangle', dur: 0.2, vol: 0.15, wet: 0.35 }));
    [C5, E5, G5, C6, E6].forEach(f => {
      tone(E, { t: t + 0.55, f, type: 'triangle', dur: 1.8, a: 0.02, hold: 0.6, vol: 0.07, vib: 3, vibF: 5, wet: 0.6 });
      tone(E, { t: t + 0.55, f: f / 2, type: 'square', dur: 1.3, a: 0.02, vol: 0.018, lp: 1600, wet: 0.4 });
    });
    for (let i = 0; i < 10; i++) coin(E, t + 0.6 + i * 0.08 + rnd(0, 0.04));
  },
  coins(E, t, o = {}) { const n = o.n || 5; for (let i = 0; i < n; i++) coin(E, t + i * 0.07 + rnd(0, 0.03)); },
  dice(E, t) {
    // стук кубика по камню: щелчки всё реже, затем глухой удар
    let tt = t;
    for (let i = 0; i < 10; i++) {
      noiseV(E, { t: tt, dur: 0.03, vol: 0.24, type: 'bandpass', f: rnd(1600, 3400), q: 5, wet: 0.2 });
      tone(E, { t: tt, f: rnd(650, 1150), type: 'triangle', dur: 0.025, vol: 0.05, wet: 0 });
      tt += 0.045 + i * 0.012;
    }
    tone(E, { t: t + 0.86, f: 150, f2: 70, dur: 0.15, vol: 0.32, wet: 0.2 });
    noiseV(E, { t: t + 0.86, dur: 0.06, vol: 0.22, type: 'lowpass', f: 900, wet: 0.2 });
  },
  diceOk(E, t) { [E5, 987.77, E6].forEach((f, i) => bell(E, { t: t + i * 0.08, f, dur: 0.7, vol: 0.13, wet: 0.5 })); },
  diceFail(E, t) {
    tone(E, { t, f: 311, f2: 294, type: 'square', dur: 0.18, vol: 0.07, lp: 1200, wet: 0.3 });
    tone(E, { t: t + 0.18, f: 233, f2: 175, type: 'square', dur: 0.42, vol: 0.08, lp: 900, vib: 5, vibF: 5, wet: 0.35 });
  },
  modGood(E, t) {
    tone(E, { t, f: 520, f2: 1040, dur: 0.14, vol: 0.17, wet: 0.2 });
    bell(E, { t: t + 0.08, f: 1568, dur: 0.35, vol: 0.06, wet: 0.4 });
  },
  modBad(E, t) {
    tone(E, { t, f: 180, f2: 88, type: 'square', dur: 0.18, vol: 0.2, lp: 700, wet: 0.2 });
    noiseV(E, { t, dur: 0.1, vol: 0.2, type: 'lowpass', f: 520, wet: 0.2 });
  },
  enhance(E, t) { SOUNDS.growl(E, t, { pitch: 1.25, dur: 0.42 }); SOUNDS.modBad(E, t + 0.05); },
  backstab(E, t) {
    noiseV(E, { t, dur: 0.2, vol: 0.28, type: 'bandpass', f: 4200, f2: 700, q: 2.5, wet: 0.2 });
    thud(E, t + 0.12, 0.5);
  },
  lullaby(E, t) {
    [G5, E5, C5, E5, 587.33, C5].forEach((f, i) => bell(E, { t: t + i * 0.21, f, dur: 0.8, vol: 0.075, wet: 0.6, partials: [1, 3.01, 5.2], gains: [1, 0.3, 0.12] }));
  },
  pet(E, t) {
    for (let i = 0; i < 3; i++) tone(E, { t: t + i * 0.09, f: 1300 + i * 150, f2: 1900 + i * 160, dur: 0.07, vol: 0.08, wet: 0.2 });
    bell(E, { t: t + 0.3, f: C6, dur: 0.6, vol: 0.06, wet: 0.5 });
  },
  buff(E, t) {
    for (let i = 0; i < 6; i++) { const f = rnd(280, 480); tone(E, { t: t + i * 0.065, f, f2: f * 1.9, dur: 0.06, vol: 0.13, wet: 0.25 }); }
    tone(E, { t: t + 0.45, f: 660, f2: 990, dur: 0.25, vol: 0.06, wet: 0.4 });
    bell(E, { t: t + 0.5, f: E6, dur: 0.6, vol: 0.05, wet: 0.5 });
  },
  location(E, t) {
    noiseV(E, { t, dur: 1.3, a: 0.5, vol: 0.11, type: 'bandpass', f: 260, f2: 900, q: 0.8, wet: 0.6 });
    bell(E, { t: t + 0.25, f: G4, dur: 2, vol: 0.09, wet: 0.8 });
    bell(E, { t: t + 0.42, f: 587.33, dur: 1.8, vol: 0.06, wet: 0.8 });
  },
  event(E, t) {
    bell(E, { t, f: 98, dur: 2.4, vol: 0.24, wet: 0.7, partials: [1, 1.48, 2.03, 2.71, 3.6], gains: [1, 0.55, 0.45, 0.28, 0.18] });
    noiseV(E, { t, dur: 0.15, vol: 0.18, type: 'lowpass', f: 650, wet: 0.4 });
  },
  quake(E, t) {
    noiseV(E, { t, dur: 1.2, a: 0.08, hold: 0.4, vol: 0.32, type: 'lowpass', f: 140, wet: 0.4 });
    tone(E, { t, f: 48, f2: 34, dur: 1.1, vol: 0.25, vib: 6, vibF: 9, wet: 0.3 });
    for (let i = 0; i < 6; i++) noiseV(E, { t: t + 0.2 + i * rnd(0.08, 0.16), dur: 0.05, vol: 0.12, type: 'bandpass', f: rnd(900, 2200), q: 4, wet: 0.4 });
  },
  yourTurn(E, t) {
    bell(E, { t, f: G5, dur: 0.7, vol: 0.12, wet: 0.5 });
    bell(E, { t: t + 0.13, f: 1174.66, dur: 0.9, vol: 0.11, wet: 0.5 });
  },
  tick(E, t, o = {}) { tone(E, { t, f: o.last ? 2000 : 1500, dur: 0.04, vol: o.last ? 0.3 : 0.22, wet: 0 }); },
  bell(E, t) {
    bell(E, { t, f: 880, dur: 1.3, vol: 0.13, wet: 0.5 });
    bell(E, { t: t + 0.24, f: 1108.73, dur: 1.3, vol: 0.11, wet: 0.5 });
  },
  pop(E, t) { tone(E, { t, f: 420, f2: 880, dur: 0.08, vol: 0.22, wet: 0.1 }); },
  error(E, t) {
    tone(E, { t, f: 196, type: 'square', dur: 0.1, vol: 0.06, lp: 700, wet: 0.1 });
    tone(E, { t: t + 0.11, f: 165, type: 'square', dur: 0.14, vol: 0.06, lp: 700, wet: 0.1 });
  },
  mutagen(E, t) {
    // бульканье зелья, затем нарастающий гул силы
    for (let i = 0; i < 5; i++) { const f = rnd(220, 380); tone(E, { t: t + i * 0.07, f, f2: f * 2.1, dur: 0.07, vol: 0.12, wet: 0.3 }); }
    tone(E, { t: t + 0.35, f: 70, f2: 140, type: 'sawtooth', dur: 0.8, a: 0.3, vol: 0.09, lp: 900, wet: 0.4 });
    tone(E, { t: t + 0.35, f: 140, f2: 280, type: 'triangle', dur: 0.8, a: 0.3, vol: 0.07, vib: 8, vibF: 9, wet: 0.5 });
    noiseV(E, { t: t + 0.4, dur: 0.7, a: 0.3, vol: 0.08, type: 'bandpass', f: 400, f2: 2400, q: 1.5, wet: 0.4 });
    bell(E, { t: t + 1.0, f: 880, dur: 0.8, vol: 0.08, wet: 0.6 });
  },
  legendary(E, t) {
    // торжественный аккорд с перезвоном — найдена легендарка
    [261.63, 329.63, 392, 523.25].forEach((f, i) => tone(E, { t: t + i * 0.05, f, type: 'triangle', dur: 2.2, a: 0.08, hold: 0.6, vol: 0.07, vib: 2.5, vibF: 5, wet: 0.7 }));
    [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => bell(E, { t: t + 0.25 + i * 0.09, f, dur: 1.1, vol: 0.06, wet: 0.7 }));
    noiseV(E, { t: t + 0.2, dur: 1.4, a: 0.4, vol: 0.05, type: 'highpass', f: 6000, wet: 0.9 });
  },
  // ───── звуки зрелищных сцен ─────
  doorOpen(E, t) {
    // тяжёлая дверь медленно расходится: долгий скрип, поток воздуха и свет
    const { ac } = E;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(118, t);
    o.frequency.linearRampToValueAtTime(205, t + 0.32);
    o.frequency.linearRampToValueAtTime(140, t + 0.7);
    const l = ac.createOscillator(); l.frequency.value = 17;
    const lg = ac.createGain(); lg.gain.value = 18;
    l.connect(lg); lg.connect(o.frequency);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 880; bp.Q.value = 7;
    const g = ac.createGain(); env(g, t, 0.06, 0.17, 0.74, 0.4);
    o.connect(bp); bp.connect(g); E.out(g, 0.4);
    o.start(t); l.start(t); o.stop(t + 0.8); l.stop(t + 0.8);
    noiseV(E, { t: t + 0.18, dur: 0.75, a: 0.25, vol: 0.14, type: 'bandpass', f: 260, f2: 1500, q: 0.9, wet: 0.5 });
    noiseV(E, { t: t + 0.35, dur: 0.8, a: 0.2, vol: 0.035, type: 'highpass', f: 6500, wet: 0.9 });
    bell(E, { t: t + 0.42, f: 1568, dur: 0.9, vol: 0.035, wet: 0.8 });
  },
  portal(E, t) {
    noiseV(E, { t, dur: 0.9, a: 0.3, vol: 0.12, type: 'bandpass', f: 200, f2: 1700, q: 2.5, wet: 0.6 });
    tone(E, { t, f: 110, f2: 220, type: 'triangle', dur: 0.9, a: 0.3, vol: 0.08, vib: 9, vibF: 7, wet: 0.6 });
    tone(E, { t: t + 0.1, f: 660, f2: 330, dur: 0.7, a: 0.2, vol: 0.03, vib: 20, vibF: 11, wet: 0.8 });
  },
  boom(E, t, o = {}) {
    const k = o.k || 1;
    tone(E, { t, f: 92, f2: 31, dur: 0.75, vol: 0.5 * k, wet: 0.45 });
    tone(E, { t, f: 46, f2: 28, type: 'triangle', dur: 0.9, vol: 0.28 * k, wet: 0.3 });
    noiseV(E, { t, dur: 0.42, vol: 0.34 * k, type: 'lowpass', f: 520, f2: 120, wet: 0.45 });
    noiseV(E, { t, dur: 0.05, vol: 0.2 * k, type: 'highpass', f: 2600, wet: 0.2 });
  },
  thunder(E, t) {
    noiseV(E, { t, dur: 0.09, vol: 0.32, type: 'highpass', f: 1800, wet: 0.3 });
    noiseV(E, { t: t + 0.04, dur: 0.12, vol: 0.26, type: 'bandpass', f: 1200, q: 0.8, wet: 0.4 });
    noiseV(E, { t: t + 0.06, dur: 1.7, a: 0.05, hold: 0.3, vol: 0.34, type: 'lowpass', f: 210, f2: 70, wet: 0.6 });
    tone(E, { t: t + 0.06, f: 52, f2: 33, dur: 1.4, vol: 0.18, vib: 5, vibF: 7, wet: 0.5 });
  },
  claw(E, t) {
    for (let i = 0; i < 3; i++) noiseV(E, { t: t + i * 0.055, dur: 0.1, vol: 0.26, type: 'bandpass', f: 3400 - i * 300, f2: 700, q: 3.5, wet: 0.25 });
    thud(E, t + 0.04, 0.55);
  },
  slam(E, t) {
    thud(E, t, 1.15);
    noiseV(E, { t, dur: 0.14, vol: 0.2, type: 'bandpass', f: 900, q: 0.7, wet: 0.3 });
  },
  clang(E, t) {
    bell(E, { t, f: 1180, dur: 0.75, vol: 0.12, wet: 0.45, partials: [1, 2.41, 3.93, 5.6], gains: [1, 0.6, 0.35, 0.2] });
    noiseV(E, { t, dur: 0.06, vol: 0.22, type: 'highpass', f: 3500, wet: 0.2 });
    thud(E, t, 0.35);
  },
  shing(E, t) {
    noiseV(E, { t, dur: 0.32, a: 0.03, vol: 0.14, type: 'bandpass', f: 3200, f2: 9000, q: 3, wet: 0.35 });
    bell(E, { t: t + 0.05, f: 2480, dur: 0.75, vol: 0.05, wet: 0.6, partials: [1, 2.76, 5.4], gains: [1, 0.4, 0.15] });
  },
  slash(E, t) {
    noiseV(E, { t, dur: 0.2, a: 0.02, vol: 0.34, type: 'bandpass', f: 500, f2: 6200, q: 1.3, wet: 0.25 });
    bell(E, { t: t + 0.07, f: 1960, dur: 0.5, vol: 0.06, wet: 0.5, partials: [1, 2.76, 5.4], gains: [1, 0.35, 0.12] });
    thud(E, t + 0.08, 0.6);
  },
  shatter(E, t) {
    for (let i = 0; i < 16; i++) noiseV(E, { t: t + rnd(0, 0.38) * (i / 16 + 0.2), dur: 0.03, vol: rnd(0.08, 0.18), type: 'bandpass', f: rnd(2600, 7600), q: 6, wet: 0.35 });
    tone(E, { t, f: 3400, f2: 2900, dur: 0.3, vol: 0.04, wet: 0.6 });
    noiseV(E, { t, dur: 0.25, vol: 0.18, type: 'lowpass', f: 700, wet: 0.3 });
  },
  poof(E, t) {
    noiseV(E, { t, dur: 0.55, a: 0.02, vol: 0.32, type: 'lowpass', f: 1500, f2: 260, wet: 0.45 });
    noiseV(E, { t, dur: 0.4, a: 0.05, vol: 0.12, type: 'bandpass', f: 700, f2: 2500, q: 1, wet: 0.4 });
  },
  stone(E, t) {
    noiseV(E, { t, dur: 0.7, a: 0.08, vol: 0.24, type: 'lowpass', f: 420, wet: 0.4 });
    for (let i = 0; i < 9; i++) noiseV(E, { t: t + 0.05 + i * rnd(0.05, 0.09), dur: 0.04, vol: 0.14, type: 'bandpass', f: rnd(1000, 2600), q: 5, wet: 0.3 });
    thud(E, t + 0.55, 0.8);
  },
  zap(E, t) {
    tone(E, { t, f: 1400, f2: 160, type: 'sawtooth', dur: 0.28, vol: 0.07, lp: 3200, wet: 0.35 });
    for (let i = 0; i < 6; i++) noiseV(E, { t: t + i * 0.035, dur: 0.025, vol: 0.16, type: 'highpass', f: 3000, wet: 0.2 });
  },
  dash(E, t) { noiseV(E, { t, dur: 0.24, a: 0.03, vol: 0.28, type: 'bandpass', f: 700, f2: 3600, q: 1.4, wet: 0.2 }); },
  charge(E, t) {
    [G4, C5, E5, G5].forEach((f, i) => tone(E, { t: t + i * 0.07, f, type: 'triangle', dur: 0.28, vol: 0.1, wet: 0.4 }));
    tone(E, { t: t + 0.28, f: G5, type: 'square', dur: 0.4, vol: 0.025, lp: 2600, wet: 0.5 });
    noiseV(E, { t, dur: 0.35, a: 0.1, vol: 0.09, type: 'bandpass', f: 400, f2: 2400, q: 1, wet: 0.3 });
  },
  heartbeat(E, t) {
    tone(E, { t, f: 74, f2: 40, dur: 0.14, vol: 0.34, wet: 0.15 });
    tone(E, { t: t + 0.17, f: 66, f2: 38, dur: 0.12, vol: 0.22, wet: 0.15 });
  },
  firework(E, t, o = {}) {
    const fly = o.fly ?? 0.8;
    tone(E, { t, f: 520, f2: 1900, dur: fly, a: 0.05, vol: 0.035, wet: 0.5, lin: true });
    noiseV(E, { t: t + fly, dur: 0.3, vol: 0.3, type: 'lowpass', f: 1800, f2: 300, wet: 0.6 });
    tone(E, { t: t + fly, f: 120, f2: 50, dur: 0.3, vol: 0.18, wet: 0.5 });
    for (let i = 0; i < 10; i++) noiseV(E, { t: t + fly + 0.12 + rnd(0, 0.55), dur: 0.02, vol: rnd(0.04, 0.09), type: 'highpass', f: 4000, wet: 0.6 });
  },
  sleep(E, t) {
    [E5, C5, G4].forEach((f, i) => bell(E, { t: t + i * 0.22, f, dur: 0.9, vol: 0.07, wet: 0.7, partials: [1, 3.01], gains: [1, 0.2] }));
    noiseV(E, { t: t + 0.1, dur: 0.9, a: 0.4, vol: 0.05, type: 'bandpass', f: 500, q: 1, wet: 0.6 });
  },
  ward(E, t) {
    bell(E, { t, f: 1318.5, dur: 0.8, vol: 0.09, wet: 0.6 });
    bell(E, { t: t + 0.09, f: 1975.5, dur: 0.8, vol: 0.06, wet: 0.6 });
    tone(E, { t, f: 400, f2: 900, dur: 0.3, vol: 0.06, wet: 0.4 });
  },
  drip(E, t) {
    const f = rnd(900, 1700);
    tone(E, { t, f, f2: f * 1.7, dur: 0.07, vol: 0.12, wet: 0.95 });
    if (Math.random() < 0.35) tone(E, { t: t + rnd(0.12, 0.3), f: f * 0.9, f2: f * 1.5, dur: 0.06, vol: 0.07, wet: 0.95 });
  },
};

// ───────────── живой звук в браузере ─────────────
let ac = null, E = null;
const last = {};
function applyVol() {
  if (!E) return;
  const v = st.on ? 0.15 + st.vol * 0.85 : 0;
  E.master.gain.setTargetAtTime(st.on ? v * v : 0, ac.currentTime, 0.05);
}
function unlock() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { ac = new Ctx({ latencyHint: 'interactive' }); } catch { return; }
    E = makeEngine(ac, ac.destination);
    E.master.gain.value = 0;
    applyVol();
    if (st.on && st.amb) ambStart();
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
}
for (const ev of ['pointerdown', 'keydown', 'touchend', 'click']) addEventListener(ev, unlock, { capture: true, passive: true });

// атмосфера пещеры: низкий гул, ветер в тоннеле, редкие капли
let amb = null;
function ambStart() {
  if (amb || !E || document.hidden) return;
  const t = ac.currentTime;
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.linearRampToValueAtTime(1, t + 3);
  E.out(bus, 0.25);
  const nodes = [];
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const dg = ac.createGain(); dg.gain.value = 0.032;
  for (const f of [55, 82.4, 110.3]) { const o = ac.createOscillator(); o.frequency.value = f; o.connect(lp); o.start(t); nodes.push(o); }
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ac.createGain(); lg.gain.value = 0.014;
  lfo.connect(lg); lg.connect(dg.gain); lfo.start(t); nodes.push(lfo);
  lp.connect(dg); dg.connect(bus);
  const src = ac.createBufferSource(); src.buffer = E.noise; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 0.7;
  const wl = ac.createOscillator(); wl.frequency.value = 0.045;
  const wlg = ac.createGain(); wlg.gain.value = 140;
  wl.connect(wlg); wlg.connect(bp.frequency); wl.start(t); nodes.push(wl);
  const wg = ac.createGain(); wg.gain.value = 0.02;
  src.connect(bp); bp.connect(wg); wg.connect(bus); src.start(t); nodes.push(src);
  amb = { bus, nodes, timer: 0 };
  const drip = () => {
    if (!amb) return;
    SOUNDS.drip(E, ac.currentTime + 0.02);
    amb.timer = setTimeout(drip, rnd(1800, 6500));
  };
  amb.timer = setTimeout(drip, rnd(800, 2500));
}
function ambStop() {
  if (!amb) return;
  const a = amb; amb = null;
  clearTimeout(a.timer);
  const t = ac.currentTime;
  a.bus.gain.cancelScheduledValues(t);
  a.bus.gain.setValueAtTime(a.bus.gain.value, t);
  a.bus.gain.linearRampToValueAtTime(0.0001, t + 0.6);
  setTimeout(() => { a.nodes.forEach(n => { try { n.stop(); } catch { /* уже остановлен */ } }); a.bus.disconnect(); }, 700);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) ambStop();
  else if (st.on && st.amb) ambStart();
});

export const sfx = {
  // o.delay — задержка в секундах; o.always — играть даже во вкладке на фоне; o.gap — защита от повторов, мс
  play(name, o = {}) {
    if (!st.on || !E || ac.state === 'closed') return;
    if (document.hidden && !o.always) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const now = performance.now();
    if (last[name] && now - last[name] < (o.gap ?? 45)) return;
    last[name] = now;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    try { fn(E, ac.currentTime + 0.01 + (o.delay || 0), o); } catch { /* звук — не главное */ }
  },
  get state() { return { ...st, ready: !!E }; },
  set(p) {
    Object.assign(st, p);
    save();
    applyVol();
    if (st.on && st.amb) ambStart(); else ambStop();
  },
  names: Object.keys(SOUNDS),
  // для проверки: отрисовать звук без колонок и вернуть буфер
  async render(name, o = {}, seconds = 3) {
    const oc = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
    const e = makeEngine(oc, oc.destination);
    SOUNDS[name](e, 0.01, o);
    return oc.startRendering();
  },
};
