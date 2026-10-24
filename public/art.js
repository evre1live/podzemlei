// «Под Землёй» — вся графика игры рисуется кодом: мультяшные монстры (art-monsters.js),
// иконки вещей, сцены локаций, рубашки колод, аватары героев и рамки карт.
import { def, DEFS, RACE_NAMES, CLASS_NAMES, TAG_NAMES, SLOT_NAMES, ruleText } from '/shared/cards.js';
import { monsterSVG, monsterDefs, INK } from '/art-monsters.js';
import { avatarSVG, avatarDefs } from '/art-avatar.js';

export { monsterSVG };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────────── общие градиенты (один раз на документ) ─────────────
const TOON = {
  lamp: ['#ffe9a6', '#f5b83d', '#b8730e'],
  gold: ['#fff4bf', '#f2c14e', '#a8680c'],
  rust: ['#ff9a74', '#d2502f', '#8f2a1a'],
  verd: ['#8ff0d2', '#3fa38c', '#1d5f50'],
  blue: ['#a9d0ff', '#4a7fc1', '#264a80'],
  white: ['#ffffff', '#f1ebdf', '#c9bda6'],
  steel: ['#f2f5f9', '#a3acb7', '#5b6470'],
  wood: ['#d09466', '#8a5a3c', '#55331f'],
  purple: ['#d3b6ff', '#8f6bc9', '#53388a'],
  skin: ['#ffe3c8', '#ebc39f', '#bf8b63'],
  bone: ['#fffaf0', '#ece2cd', '#bfae8e'],
  glass: ['#f0fdff', '#b9e1e6', '#6fa7b3'],
  dark: ['#6a6572', '#3d3a42', '#1d1b21'],
  green: ['#c4ef86', '#79a83f', '#3e5e1a'],
  pink: ['#ffc6dc', '#e86fa1', '#9c3561'],
  red: ['#ff8f8f', '#e0413a', '#8c1e1e'],
  orange: ['#ffc58a', '#f08a3a', '#a4501a'],
  leaf: ['#9ff0b5', '#4cbf73', '#21673b'],
  beige: ['#fff7e4', '#ead3a6', '#b8955c'],
};
// яркие сочные фоны под картинкой карты: светлый центр, насыщенный край
const BG = {
  item: ['#ffc76e', '#d8621a', '#fff3c8'],
  oneshot: ['#86f4de', '#128a78', '#e8fffa'],
  buff: ['#ffa4ca', '#c22f6a', '#fff0f6'],
  gold: ['#ffe680', '#d4840e', '#fffbe0'],
  door: ['#a2d6ff', '#2c66c0', '#eef8ff'],
  curse: ['#d2aaff', '#6428c0', '#f6eeff'],
  enhancer: ['#ffa078', '#c02e16', '#fff0e8'],
  event: ['#ffd47e', '#d06018', '#fff6e0'],
  special: ['#a4f6d4', '#1a946c', '#effff8'],
  pet: ['#d8f67e', '#549618', '#f8ffe6'],
  dark: ['#25342c', '#040505', '#7dff9a'],
};
export function injectDefs() {
  if (typeof document === 'undefined' || document.getElementById('pz-defs')) return;
  let g = '';
  for (const [k, [a, b, c]] of Object.entries(TOON)) g += `<linearGradient id="t-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
  for (const [k, [a, b]] of Object.entries(BG)) g += `<radialGradient id="bg-${k}" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  // комиксовый растр и мягкое затемнение краёв картинки
  g += `<pattern id="ht" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.15" fill="#fff" fill-opacity=".2"/></pattern>`;
  g += `<radialGradient id="vig" cx="50%" cy="45%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>`;
  g += `<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  g += `<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>`;
  for (const [k, [a, b]] of Object.entries(LOC_BG)) g += `<radialGradient id="lb-${k}" cx="50%" cy="42%" r="78%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  g += avatarDefs();
  g += monsterDefs(Object.values(DEFS));
  const box = document.createElement('div');
  box.id = 'pz-defs';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  box.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>${g}</defs></svg>`;
  document.body.prepend(box);
}

// ───────────── иконки 64×64 ─────────────
const u = k => `url(#t-${k})`;
const L = u('lamp'), GD = u('gold'), R = u('rust'), G = u('verd'), B = u('blue'), W = u('white'), S = u('steel'), Br = u('wood'),
  Pu = u('purple'), SK = u('skin'), BN = u('bone'), GL = u('glass'), DK = u('dark'), GR = u('green'), PK = u('pink'), RD = u('red'),
  OR = u('orange'), LF = u('leaf'), BE = u('beige');
// плоские цвета — для линий (градиент по рамке не работает на прямых без ширины)
const fL = '#f5b83d', fR = '#d2502f', fG = '#3fa38c', fS = '#9aa3ad', fBr = '#8a5a3c', fPu = '#8f6bc9', fW = '#efe6d4';
const st = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const st2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const hl = (d, w = 3, o = 0.6) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
const eyes2 = (x1, x2, y, r = 2.8) => `<circle cx="${x1}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x1 - 0.9}" cy="${y - 1}" r="${r * 0.38}" fill="#fff"/><circle cx="${x2 - 0.9}" cy="${y - 1}" r="${r * 0.38}" fill="#fff"/>`;
const blush = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="3.2" fill="#ff8f8f" opacity=".45"/><circle cx="${x2}" cy="${y}" r="3.2" fill="#ff8f8f" opacity=".45"/>`;

const ICONS = {
  // ── головняк
  helmet: `<path d="M12 40 C12 15 52 15 52 40Z" fill="${L}" ${st}/><path d="M32 17 V40" stroke="#b8730e" stroke-width="2"/><rect x="7" y="38" width="50" height="9" rx="4.5" fill="${GD}" ${st}/><circle cx="32" cy="28" r="7" fill="${GL}" ${st}/><circle cx="30" cy="26" r="2.4" fill="#fff"/>` + hl('M17 33 Q19 23 26 19'),
  hardlamp: `<path d="M38 22 L64 8 V44Z" fill="url(#beam)"/><path d="M8 42 C8 18 46 18 46 42Z" fill="${L}" ${st}/><rect x="4" y="40" width="46" height="9" rx="4.5" fill="${GD}" ${st}/><rect x="30" y="20" width="14" height="14" rx="4" fill="${S}" ${st}/><circle cx="39" cy="27" r="4.5" fill="#fff6c8" ${st2}/>` + hl('M13 34 Q15 25 22 21'),
  lamp: `<path d="M8 38 q24 -18 48 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M8 38 q24 -18 48 0" fill="none" stroke="#6b4a3a" stroke-width="2.5" stroke-linecap="round"/><path d="M44 28 L64 18 V46Z" fill="url(#beam)"/><rect x="20" y="24" width="24" height="18" rx="5" fill="${S}" ${st}/><circle cx="38" cy="33" r="5" fill="#fff6c8" ${st2}/>` + hl('M24 28 h8', 2.4),
  crown: `<path d="M8 48 V18 l12 13 l12 -19 l12 19 l12 -13 V48Z" fill="${GD}" ${st}/><rect x="6" y="44" width="52" height="10" rx="3" fill="${L}" ${st}/><circle cx="32" cy="34" r="5" fill="${RD}" ${st2}/><circle cx="18" cy="38" r="3" fill="${B}" ${st2}/><circle cx="46" cy="38" r="3" fill="${G}" ${st2}/><g fill="#fff"><circle cx="8" cy="16" r="1.5"/><circle cx="56" cy="16" r="1.5"/></g>` + hl('M12 24 v14', 2.4),
  // ── броник
  jacket: `<path d="M20 12 L32 19 L44 12 L57 23 L50 33 L46 29 V56 H18 V29 L14 33 L7 23Z" fill="${G}" ${st}/><path d="M18 31 h28 M18 42 h28" stroke="#f5e27a" stroke-width="4"/><path d="M32 19 v37" stroke="${INK}" stroke-width="2"/>` + hl('M22 18 L14 24', 2.4),
  mail: `<path d="M18 10 h28 l9 13 v34 H9 V23Z" fill="${S}" ${st}/><g fill="${GD}" ${st2}><circle cx="20" cy="29" r="4.2"/><circle cx="32" cy="29" r="4.2"/><circle cx="44" cy="29" r="4.2"/><circle cx="26" cy="39" r="4.2"/><circle cx="38" cy="39" r="4.2"/><circle cx="20" cy="49" r="3.8"/><circle cx="32" cy="49" r="3.8"/><circle cx="44" cy="49" r="3.8"/></g>` + hl('M14 22 L20 14', 2.4),
  diver: `<circle cx="32" cy="29" r="21" fill="${GD}" ${st}/><circle cx="32" cy="29" r="12" fill="${GL}" ${st}/><path d="M26 23 q4 -4 9 -2" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="15" y="47" width="34" height="11" rx="3" fill="${Br}" ${st}/><g fill="${INK}"><circle cx="13" cy="29" r="3"/><circle cx="51" cy="29" r="3"/><circle cx="32" cy="10" r="2.4"/></g>` + hl('M16 20 Q20 12 28 9'),
  robe: `<path d="M24 8 h16 l15 49 H9Z" fill="${Pu}" ${st}/><path d="M32 8 v49" stroke="${fL}" stroke-width="3"/><g fill="#fff3b0"><path d="M20 30 l1.5 3 l3 .4 l-2.2 2 l.6 3 l-2.9 -1.6 l-2.9 1.6 l.6 -3 l-2.2 -2 l3 -.4z"/><circle cx="44" cy="44" r="2"/><circle cx="40" cy="24" r="1.5"/></g>` + hl('M22 14 L14 44', 2.4, 0.4),
  barrel: `<path d="M14 8 h36 q6 24 0 48 H14 q-6 -24 0 -48Z" fill="${Br}" ${st}/><path d="M11 20 h42 M11 44 h42" stroke="${INK}" stroke-width="5"/><path d="M11 20 h42 M11 44 h42" stroke="${fS}" stroke-width="2.5"/><path d="M26 9 q-3 23 0 46 M38 9 q3 23 0 46" stroke="#55331f" stroke-width="1.6" fill="none"/><rect x="24" y="0" width="16" height="9" rx="2" fill="${S}" ${st2}/>` + hl('M18 26 v12'),
  // ── обувка
  boots: `<path d="M14 8 h16 v30 h17 q9 0 9 11 v5 H14Z" fill="${G}" ${st}/><path d="M14 47 h42" stroke="${INK}" stroke-width="3"/><rect x="12" y="52" width="46" height="6" rx="3" fill="${DK}" ${st2}/><path d="M18 18 h10 M18 26 h10" stroke="#f5e27a" stroke-width="3"/>` + hl('M18 12 v20', 2.4),
  sneakers: `<path d="M8 40 q2 -13 14 -15 l8 -11 q13 4 15 15 q11 0 15 7 v8 H8Z" fill="${W}" ${st}/><path d="M8 45 h52" stroke="${fR}" stroke-width="5"/><path d="M27 21 l6 6 M32 17 l6 6" stroke="${INK}" stroke-width="2"/><path d="M2 28 h9 M0 35 h9" stroke="${fL}" stroke-width="3" stroke-linecap="round"/><path d="M40 32 q6 0 10 3" stroke="${fR}" stroke-width="3" fill="none"/>`,
  slippers: `<ellipse cx="32" cy="43" rx="26" ry="11" fill="${Pu}" ${st}/><path d="M16 41 q16 -20 34 0" fill="${W}" ${st}/><circle cx="33" cy="29" r="6" fill="${PK}" ${st2}/><circle cx="31" cy="27" r="1.6" fill="#fff"/>` + hl('M12 44 q4 4 12 4', 2.4, 0.5),
  // ── в руки
  shovel: `<path d="M32 4 v32" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M32 4 v32" stroke="#b07a4a" stroke-width="4" stroke-linecap="round"/><path d="M25 5 h14" ${st}/><path d="M19 35 h26 v9 q0 13 -13 15 q-13 -2 -13 -15z" fill="${S}" ${st}/>` + hl('M24 40 v4 q1 6 5 8', 2.4),
  pick: `<path d="M41 23 L14 59" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M41 23 L14 59" stroke="#b07a4a" stroke-width="5" stroke-linecap="round"/><path d="M8 22 Q34 -2 60 17 Q41 11 27 30 Q21 23 8 22Z" fill="${S}" ${st}/>` + hl('M16 19 Q30 8 46 9', 2.4),
  hammer: `<rect x="29" y="24" width="7" height="34" rx="3" fill="${Br}" ${st}/><rect x="15" y="6" width="34" height="20" rx="4" fill="${RD}" ${st}/><rect x="11" y="9" width="6" height="14" rx="2" fill="${S}" ${st2}/><rect x="47" y="9" width="6" height="14" rx="2" fill="${S}" ${st2}/>` + hl('M20 11 h22', 2.6),
  drill: `<rect x="6" y="20" width="36" height="20" rx="7" fill="${L}" ${st}/><rect x="14" y="38" width="12" height="20" rx="4" fill="${DK}" ${st}/><path d="M42 26 h10 l10 4 l-10 4 h-10z" fill="${S}" ${st}/><path d="M46 26 l-2 8 M50 26 l-2 8" stroke="${INK}" stroke-width="1.6"/><circle cx="16" cy="30" r="4" fill="${DK}" ${st2}/><path d="M28 24 h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M54 18 l4 -4 M58 42 l4 4" stroke="${fL}" stroke-width="2.6" stroke-linecap="round"/>`,
  shield: `<circle cx="32" cy="32" r="25" fill="${S}" ${st}/><circle cx="32" cy="32" r="17" fill="${Br}" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="32" r="6" fill="${GD}" ${st2}/><g fill="${INK}"><circle cx="32" cy="10" r="1.8"/><circle cx="32" cy="54" r="1.8"/><circle cx="10" cy="32" r="1.8"/><circle cx="54" cy="32" r="1.8"/></g>` + hl('M14 22 Q20 12 32 9'),
  crossbow: `<path d="M8 22 Q32 4 56 22" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M8 22 Q32 4 56 22" fill="none" stroke="#b07a4a" stroke-width="3" stroke-linecap="round"/><path d="M8 22 L32 34 L56 22" stroke="${INK}" stroke-width="1.5" fill="none"/><rect x="28" y="14" width="8" height="44" rx="2" fill="${Br}" ${st}/><rect x="21" y="10" width="22" height="11" rx="3" fill="${RD}" ${st}/><path d="M32 2 v12" stroke="${INK}" stroke-width="2.6"/><path d="M29 4 l3 -4 l3 4z" fill="${S}" ${st2}/>`,
  censer: `<path d="M32 2 v15" stroke="${INK}" stroke-width="2"/><path d="M17 26 h30 l-5 19 h-20z" fill="${GD}" ${st}/><path d="M21 26 q11 -12 22 0" fill="${L}" ${st}/><circle cx="32" cy="17" r="3" fill="${GD}" ${st2}/><path d="M24 57 q-5 -5 0 -10 M38 59 q5 -7 -2 -11" stroke="#d6d0de" stroke-width="3.4" fill="none" stroke-linecap="round"/>` + hl('M22 30 l2 10', 2.2),
  lute: `<path d="M38 20 L56 4" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M38 20 L56 4" stroke="#b07a4a" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="26" cy="40" rx="18" ry="17" transform="rotate(-40 26 40)" fill="${Br}" ${st}/><circle cx="25" cy="40" r="5" fill="#3a2418" ${st2}/><path d="M18 50 L50 10 M21 52 L52 13" stroke="#f1ebdf" stroke-width="1"/><path d="M14 36 q2 -10 10 -14" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  rail: `<path d="M10 52 L54 12" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M10 52 L54 12" stroke="${fS}" stroke-width="8" stroke-linecap="round"/><path d="M14 46 L50 14" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><rect x="4" y="44" width="14" height="16" rx="3" fill="${Br}" ${st}/>`,
  staff: `<circle cx="47" cy="13" r="12" fill="url(#glow)"/><path d="M18 60 L44 16" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M18 60 L44 16" stroke="#b07a4a" stroke-width="4" stroke-linecap="round"/><rect x="40" y="5" width="15" height="13" rx="3" transform="rotate(30 47 11)" fill="${S}" ${st}/><circle cx="47" cy="12" r="3.4" fill="#fff6c8"/><path d="M56 4 l6 -3 M57 12 h6" stroke="${fL}" stroke-width="3" stroke-linecap="round"/>`,
  bow: `<path d="M18 5 Q54 32 18 59" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M18 5 Q54 32 18 59" fill="none" stroke="#b07a4a" stroke-width="3.5" stroke-linecap="round"/><path d="M18 5 V59" stroke="${INK}" stroke-width="1.5"/><g ${st2}><circle cx="29" cy="15" r="3.8" fill="${L}"/><circle cx="38" cy="25" r="3.8" fill="${RD}"/><circle cx="40" cy="36" r="3.8" fill="${G}"/><circle cx="34" cy="47" r="3.8" fill="${B}"/></g>`,
  knuckles: `<path d="M8 26 q0 -10 10 -10 h28 q10 0 10 10 v6 q0 8 -8 8 h-30 q-10 0 -10 -8z" fill="${S}" ${st}/><g fill="#2a2230" ${st2}><circle cx="17" cy="27" r="5"/><circle cx="28" cy="27" r="5"/><circle cx="39" cy="27" r="5"/><circle cx="50" cy="27" r="4.4"/></g><path d="M16 40 q16 18 32 0" fill="${S}" ${st}/><path d="M12 18 l-2 -6 M22 14 l0 -7 M34 14 l1 -7 M46 15 l3 -6" stroke="${fS}" stroke-width="3" stroke-linecap="round"/>` + hl('M14 19 h30', 2.2),
  claws: `<path d="M10 40 q0 -14 22 -14 q22 0 22 14 v8 q0 8 -10 8 h-24 q-10 0 -10 -8z" fill="${Br}" ${st}/><path d="M16 30 q-4 -16 2 -26 q4 12 6 24 M28 28 q-2 -16 4 -26 q3 12 4 26 M40 28 q1 -16 9 -24 q0 12 -3 26" fill="${BN}" ${st}/><path d="M18 44 h28" stroke="#55331f" stroke-width="2"/>`,
  crowbar: `<path d="M18 57 L46 12 q4 -7 11 -3" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M18 57 L46 12 q4 -7 11 -3" fill="none" stroke="${fR}" stroke-width="5" stroke-linecap="round"/><path d="M14 55 l-7 6" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M14 55 l-7 6" stroke="${fR}" stroke-width="4" stroke-linecap="round"/>` + hl('M24 46 L42 16', 1.6, 0.5),
  wrench: `<path d="M14 54 L40 28" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M14 54 L40 28" stroke="${fS}" stroke-width="6.5" stroke-linecap="round"/><path d="M36 30 a14 14 0 1 1 18 -18 l-9 9 l-5 -1 l-1 -5 l9 -9 a14 14 0 0 0 -12 24z" fill="${S}" ${st}/><circle cx="16" cy="52" r="2" fill="${INK}"/>`,
  taser: `<rect x="12" y="19" width="32" height="21" rx="5" fill="${DK}" ${st}/><rect x="12" y="37" width="13" height="20" rx="3" fill="${DK}" ${st}/><rect x="17" y="24" width="18" height="6" rx="2" fill="#7fd1ff"/><path d="M44 24 l8 -4 M44 35 l8 4" ${st}/><path d="M52 12 l6 6 l-6 4 l6 6 l-6 4" stroke="${fL}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  ladle: `<path d="M46 6 L28 40" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M46 6 L28 40" stroke="${fS}" stroke-width="4" stroke-linecap="round"/><path d="M10 39 h34 q0 18 -17 18 q-17 0 -17 -18z" fill="${S}" ${st}/><path d="M14 40 h26" stroke="#e8c88a" stroke-width="3"/>` + hl('M15 45 q3 7 10 8', 2.4),
  extinguisher: `<path d="M38 10 h10 l10 -4" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="18" y="16" width="26" height="44" rx="10" fill="${RD}" ${st}/><rect x="24" y="6" width="14" height="12" rx="3" fill="${DK}" ${st}/><rect x="18" y="32" width="26" height="10" fill="${W}" stroke="${INK}" stroke-width="2"/><path d="M58 6 q4 6 0 12 M60 2 q8 10 0 20" stroke="#cfeffa" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + hl('M23 22 v8 M23 46 v8'),
  trap: `<path d="M6 50 h52" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="8" y="40" width="48" height="12" rx="3" fill="${Br}" ${st}/><path d="M14 40 q18 -34 36 0" fill="none" stroke="${INK}" stroke-width="5"/><path d="M14 40 q18 -34 36 0" fill="none" stroke="${fS}" stroke-width="2.5"/><path d="M38 34 l12 -6 l2 10 z" fill="#f5d36a" ${st2}/><circle cx="44" cy="33" r="1.4" fill="#c99a2e"/>`,
  flashlight: `<path d="M42 14 L64 2 V40 Z" fill="url(#beam)"/><rect x="8" y="22" width="26" height="16" rx="4" fill="${DK}" ${st} transform="rotate(-22 21 30)"/><path d="M30 18 l12 -6 l6 14 l-12 6z" fill="${S}" ${st}/><ellipse cx="45" cy="19" rx="3" ry="7" transform="rotate(-22 45 19)" fill="#fff6c8" ${st2}/><circle cx="18" cy="32" r="2.4" fill="${fR}"/>`,
  charm: `<path d="M32 2 v10" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="11" r="4" fill="none" ${st}/><path d="M32 17 l7 14 l15 2 l-11 11 l3 15 l-14 -8 l-14 8 l3 -15 l-11 -11 l15 -2z" fill="${GD}" ${st}/>` + hl('M26 33 l4 -8', 2.4),
  trolley: `<path d="M8 22 h48 l-6 25 H14Z" fill="${Br}" ${st}/><path d="M14 30 h36 M16 38 h32" stroke="#55331f" stroke-width="1.6"/><circle cx="20" cy="53" r="6" fill="${S}" ${st}/><circle cx="44" cy="53" r="6" fill="${S}" ${st}/><g fill="${S}" ${st2}><circle cx="22" cy="20" r="7"/><circle cx="34" cy="15" r="8"/><circle cx="46" cy="20" r="6"/></g><g fill="#fff3b0"><circle cx="31" cy="12" r="1.6"/><circle cx="20" cy="18" r="1.2"/></g>`,
  ring: `<circle cx="32" cy="39" r="17" fill="none" stroke="${INK}" stroke-width="10"/><circle cx="32" cy="39" r="17" fill="none" stroke="${fL}" stroke-width="6"/><path d="M20 30 q4 -6 10 -7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M23 22 l9 -16 l9 16 l-9 6z" fill="${RD}" ${st}/><path d="M29 14 l3 -4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  flasks: `<path d="M12 22 h12 v10 l8 20 q2 6 -4 6 h-20 q-6 0 -4 -6 l8 -20z" fill="${GL}" ${st}/><path d="M7 46 h22 l3 6 q1 4 -3 4 h-22 q-4 0 -3 -4z" fill="${LF}"/><path d="M38 14 h12 v14 q10 6 10 16 q0 14 -16 14 q-16 0 -16 -14 q0 -10 10 -16z" fill="${GL}" ${st}/><path d="M29 44 q0 -2 1 -4 h28 q1 2 1 4 q0 12 -15 12 q-15 0 -15 -12z" fill="${PK}"/><circle cx="40" cy="46" r="2" fill="#fff"/><circle cx="48" cy="50" r="1.4" fill="#fff"/><circle cx="16" cy="48" r="1.6" fill="#fff"/><path d="M44 8 q-3 -4 0 -8 M18 16 q-3 -4 0 -8" stroke="#d6d0de" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  sack: `<path d="M22 14 q10 6 20 0 l-3 8 q20 8 20 26 q0 12 -26 12 q-26 0 -26 -12 q0 -18 20 -26z" fill="${u('wood')}" ${st}/><path d="M24 20 q8 4 16 0" stroke="${INK}" stroke-width="3" fill="none"/><text x="32" y="48" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="15" fill="${fL}" stroke="${INK}" stroke-width="1">₽</text>` + hl('M14 40 q0 -8 6 -12', 2.4, 0.4),
  godarmor: `<circle cx="32" cy="32" r="30" fill="url(#glow)"/><ellipse cx="32" cy="5" rx="12" ry="3" fill="none" stroke="#fff3b0" stroke-width="2.6"/><path d="M12 22 C3 25 0 36 6 44 C8 38 12 35 17 35Z M52 22 C61 25 64 36 58 44 C56 38 52 35 47 35Z" fill="${W}" ${st}/><path d="M6 32 l6 1 M3 38 l7 0 M58 32 l-6 1 M61 38 l-7 0" stroke="#c9bda6" stroke-width="1.6"/><path d="M18 12 L32 8 L46 12 L50 24 L46 50 L32 58 L18 50 L14 24Z" fill="${GD}" ${st}/><path d="M32 9 V57" stroke="#a8680c" stroke-width="2"/><path d="M19 26 Q25 33 32 30 Q39 33 45 26 M20 40 Q26 45 32 43 Q38 45 44 40" fill="none" stroke="#a8680c" stroke-width="2"/><path d="M32 33 l5.5 6.5 l-5.5 6.5 l-5.5 -6.5z" fill="#a6f2ff" ${st2}/><path d="M30.5 37 l2 -2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` + hl('M20 16 L17 28', 2.6, 0.7),
  pet_dragon: `<circle cx="32" cy="34" r="30" fill="url(#glow)"/><path d="M34 27 C40 8 57 5 62 12 C56 14 54 20 57 27 C50 22 44 25 40 31Z" fill="${OR}" ${st}/><path d="M42 24 l8 -10 M47 26 l9 -8" stroke="#a4501a" stroke-width="1.6"/><path d="M44 51 C53 53 59 48 60 41" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M44 51 C53 53 59 48 60 41" fill="none" stroke="#f2c14e" stroke-width="3" stroke-linecap="round"/><path d="M58 38 l5 2 l-3 4z" fill="${GD}" ${st2}/><path d="M10 53 C6 41 14 31 26 31 C36 31 44 37 46 47 C48 55 40 61 30 59 C24 58 18 61 12 59Z" fill="${GD}" ${st}/><path d="M20 45 q8 4 16 0 M22 51 q6 3 12 0" stroke="#a8680c" stroke-width="2" fill="none"/><path d="M7 31 C5 21 13 15 21 17 C27 18 30 23 28 29 C26 33 18 35 12 34Z" fill="${GD}" ${st}/><path d="M15 17 l-4 -9 l8 6 M21 17 l2 -9 l3 8" fill="${BN}" ${st2}/><circle cx="19" cy="24" r="3" fill="#fffdf6" ${st2}/><circle cx="19.6" cy="24.4" r="1.6" fill="${INK}"/><circle cx="18.6" cy="23.2" r=".7" fill="#fff"/><circle cx="9" cy="29" r="1.2" fill="${INK}"/><path d="M8 33 q4 2 9 0" stroke="${INK}" stroke-width="1.6" fill="none"/><g fill="#fff"><path d="M50 50 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1z"/><circle cx="36" cy="14" r="1.4"/></g>` + hl('M14 40 Q18 34 26 33', 2.4, 0.6),
  // ── питомцы
  pet_rat: `<path d="M50 46 q14 2 10 -10" stroke="#e7a5a5" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="34" cy="42" rx="20" ry="14" fill="${S}" ${st}/><circle cx="18" cy="30" r="13" fill="${S}" ${st}/><circle cx="12" cy="19" r="6" fill="#f3b5c0" ${st2}/><circle cx="25" cy="18" r="6" fill="#f3b5c0" ${st2}/><circle cx="8" cy="34" r="3" fill="#e86fa1" ${st2}/>` + eyes2(15, 23, 29, 2.4) + `<path d="M4 32 l-4 -2 M4 36 h-4" stroke="${INK}" stroke-width="1.2"/>`,
  pet_firefly: `<circle cx="32" cy="44" r="16" fill="url(#glow)"/><path d="M30 24 q-18 -18 -24 -4 q4 12 22 10 M34 24 q18 -18 24 -4 q-4 12 -22 10" fill="${GL}" ${st2} opacity=".9"/><ellipse cx="32" cy="42" rx="9" ry="12" fill="#fff36b" ${st}/><path d="M24 40 h16" stroke="#e0c43a" stroke-width="2"/><circle cx="32" cy="24" r="9" fill="${DK}" ${st}/>` + eyes2(29, 35, 23, 2.2) + `<path d="M28 15 q-4 -8 -8 -10 M36 15 q4 -8 8 -10" stroke="${INK}" stroke-width="2" fill="none"/>`,
  pet_hamster: `<ellipse cx="32" cy="38" rx="24" ry="20" fill="${OR}" ${st}/><ellipse cx="32" cy="44" rx="14" ry="10" fill="#fff2dc"/><circle cx="14" cy="22" r="6" fill="${OR}" ${st2}/><circle cx="50" cy="22" r="6" fill="${OR}" ${st2}/><circle cx="14" cy="22" r="2.6" fill="#f3b5c0"/><circle cx="50" cy="22" r="2.6" fill="#f3b5c0"/>` + eyes2(24, 40, 33, 3) + blush(18, 46, 40) + `<ellipse cx="32" cy="38" rx="3" ry="2" fill="#e86fa1"/><path d="M29 42 q3 3 6 0" stroke="${INK}" stroke-width="1.8" fill="none"/><path d="M26 56 v4 M38 56 v4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  pet_cat: `<path d="M10 26 L12 6 L26 18 Z M54 26 L52 6 L38 18 Z" fill="${DK}" ${st}/><path d="M14 22 L15 12 L22 18Z M50 22 L49 12 L42 18Z" fill="#f3b5c0"/><ellipse cx="32" cy="34" rx="23" ry="20" fill="${DK}" ${st}/><ellipse cx="22" cy="31" rx="5" ry="6" fill="#d6f56a" ${st2}/><ellipse cx="42" cy="31" rx="5" ry="6" fill="#d6f56a" ${st2}/><ellipse cx="22" cy="32" rx="1.8" ry="4.6" fill="${INK}"/><ellipse cx="42" cy="32" rx="1.8" ry="4.6" fill="${INK}"/><path d="M29 41 l3 3 l3 -3z" fill="#f3b5c0"/><path d="M32 44 q-3 4 -6 2 M32 44 q3 4 6 2 M6 38 h12 M6 44 l12 -2 M58 38 h-12 M58 44 l-12 -2" stroke="#efe6d4" stroke-width="1.4" fill="none"/><path d="M8 58 h48" stroke="${fL}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="58" r="3" fill="${GD}" ${st2}/>`,
  // ── разовые
  jar: `<rect x="15" y="18" width="34" height="41" rx="7" fill="${GL}" ${st}/><rect x="13" y="9" width="38" height="11" rx="3" fill="${RD}" ${st}/><g fill="${Br}" stroke="${INK}" stroke-width="1.5"><path d="M21 48 q4 -11 11 -2 v8 h-7z"/><path d="M33 42 q7 -11 11 0 v11 h-7z"/></g><path d="M20 24 v14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
  bottle: `<path d="M26 3 h12 v13 q11 6 11 19 v23 H15 V35 q0 -13 11 -19z" fill="${Br}" ${st}/><rect x="15" y="32" width="34" height="15" fill="${GD}" stroke="${INK}" stroke-width="2"/><path d="M24 40 h16" stroke="${INK}" stroke-width="2"/><rect x="25" y="0" width="14" height="6" rx="2" fill="${RD}" ${st2}/>` + hl('M20 50 v5'),
  potion: `<path d="M26 4 h12 v14 q16 8 16 22 q0 18 -22 18 q-22 0 -22 -18 q0 -14 16 -22z" fill="${GL}" ${st}/><path d="M11 38 q10 -6 21 0 t21 0 q1 18 -21 18 q-22 0 -21 -18z" fill="${RD}"/><path d="M26 4 h12 v14 q16 8 16 22 q0 18 -22 18 q-22 0 -22 -18 q0 -14 16 -22z" fill="none" ${st}/><rect x="24" y="0" width="16" height="7" rx="2" fill="${Br}" ${st2}/><g fill="#fff"><circle cx="24" cy="46" r="2.4"/><circle cx="36" cy="50" r="1.6"/><circle cx="40" cy="42" r="1.2"/></g>` + hl('M16 34 q-2 6 0 12', 3, 0.7),
  energy: `<rect x="17" y="8" width="30" height="50" rx="6" fill="${LF}" ${st}/><path d="M17 18 h30 M17 48 h30" stroke="${INK}" stroke-width="2"/><path d="M35 22 l-9 13 h7 l-4 11 l11 -15 h-7 l4 -9z" fill="#fff36b" ${st2}/><rect x="24" y="3" width="16" height="6" rx="2" fill="${S}" ${st2}/>` + hl('M22 24 v18'),
  pies: `<ellipse cx="32" cy="50" rx="27" ry="8" fill="${W}" ${st}/><path d="M10 46 q-2 -14 12 -16 q4 -10 14 -6 q14 -4 16 10 q6 4 2 12z" fill="${OR}" ${st}/><path d="M18 38 q4 -4 8 0 M30 32 q4 -4 8 0 M40 40 q3 -3 6 0" stroke="#a4501a" stroke-width="2" fill="none"/><path d="M22 18 q-4 -6 0 -12 M32 16 q-4 -6 0 -12 M42 18 q-4 -6 0 -12" stroke="#e2dde8" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + hl('M18 33 q6 -6 12 -6', 2.4),
  wrap: `<path d="M14 54 L40 7 q11 4 13 15 L26 60Z" fill="#ecc98d" ${st}/><path d="M38 13 q7 2 9 9" stroke="${fG}" stroke-width="4" fill="none"/><path d="M35 22 q7 2 9 9" stroke="${fR}" stroke-width="4" fill="none"/><path d="M31 31 q6 2 8 8" stroke="#f5e27a" stroke-width="4" fill="none"/><path d="M48 3 q6 6 0 10 M54 9 q6 6 0 10" stroke="#e2dde8" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  can: `<rect x="17" y="7" width="30" height="50" rx="7" fill="${B}" ${st}/><path d="M17 21 h30 M17 43 h30" stroke="${INK}" stroke-width="2"/><path d="M25 29 l7 -5 l7 5 l-7 5z" fill="#fff"/><path d="M9 14 l4 2 M7 24 l5 0" stroke="#b9e1e6" stroke-width="2.6" stroke-linecap="round"/>` + hl('M22 12 v6 M22 26 v12'),
  boom: `<circle cx="32" cy="38" r="14" fill="url(#glow)"/><rect x="21" y="22" width="22" height="36" rx="4" fill="${RD}" ${st}/><path d="M21 34 h22 M21 46 h22" stroke="${INK}" stroke-width="2"/><path d="M32 22 q0 -11 9 -13" stroke="${INK}" stroke-width="2.4" fill="none"/><path d="M41 9 l5 -7 l2 7 l7 -2 l-4 7 l7 2 l-7 3 l2 6 l-7 -3" fill="#fff36b" ${st2}/>` + hl('M26 26 v6'),
  holywater: `<circle cx="32" cy="36" r="24" fill="url(#glow)"/><path d="M27 6 h10 v10 q13 6 13 20 q0 22 -18 22 q-18 0 -18 -22 q0 -14 13 -20z" fill="${GL}" ${st}/><path d="M16 38 q16 -6 32 0 q0 18 -16 18 q-16 0 -16 -18z" fill="#bfe8ff"/><path d="M32 28 v20 M25 35 h14" stroke="${fL}" stroke-width="4" stroke-linecap="round"/><rect x="25" y="2" width="14" height="6" rx="2" fill="${GD}" ${st2}/>` + hl('M20 26 q-3 6 -2 12', 3, 0.7),
  rope: `<path d="M32 4 v8" stroke="${INK}" stroke-width="3"/><path d="M26 4 h12" ${st}/><ellipse cx="32" cy="36" rx="22" ry="20" fill="none" stroke="${INK}" stroke-width="9"/><ellipse cx="32" cy="36" rx="22" ry="20" fill="none" stroke="#d9b071" stroke-width="5"/><ellipse cx="32" cy="36" rx="13" ry="11" fill="none" stroke="${INK}" stroke-width="8"/><ellipse cx="32" cy="36" rx="13" ry="11" fill="none" stroke="#c99a52" stroke-width="4"/><path d="M14 28 l4 3 M18 22 l3 4 M46 22 l-3 4 M50 28 l-4 3" stroke="#8a6a3a" stroke-width="1.4"/><path d="M38 54 q8 6 4 10" stroke="#c99a52" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  smoke: `<circle cx="21" cy="40" r="13" fill="#b8b2c2" ${st}/><circle cx="39" cy="33" r="15" fill="#cfc9d8" ${st}/><circle cx="33" cy="16" r="10" fill="#e8e3ee" ${st}/><rect x="23" y="47" width="18" height="13" rx="3" fill="${G}" ${st}/>` + hl('M30 26 q2 -6 8 -6', 2.4),
  scroll: `<rect x="13" y="11" width="38" height="42" rx="3" fill="${W}" ${st}/><rect x="9" y="6" width="46" height="9" rx="4.5" fill="${Br}" ${st}/><rect x="9" y="49" width="46" height="9" rx="4.5" fill="${Br}" ${st}/><path d="M20 25 h24 M20 31 h18 M20 37 h22" stroke="${INK}" stroke-width="2"/><circle cx="42" cy="44" r="4" fill="${RD}" ${st2}/>`,
  amulet: `<path d="M17 5 L32 26 L47 5" fill="none" stroke="${fL}" stroke-width="2.6"/><circle cx="32" cy="40" r="17" fill="${GD}" ${st}/><circle cx="32" cy="40" r="10" fill="${Pu}" ${st2}/><circle cx="28" cy="36" r="3" fill="#fff" opacity=".8"/>`,
  // ── уровни и клад
  up: `<path d="M32 4 L56 32 H41 V59 H23 V32 H8Z" fill="${G}" ${st}/>` + hl('M14 30 L30 11'),
  up2: `<path d="M32 3 L55 25 H41 V33 H55 L32 59 L9 33 H23 V25 H9Z" fill="${RD}" ${st}/>` + hl('M15 24 L30 9'),
  down: `<path d="M32 59 L56 32 H41 V5 H23 V32 H8Z" fill="${B}" ${st}/>` + hl('M28 10 V30'),
  shieldup: `<path d="M32 4 L54 12 V30 Q54 50 32 60 Q10 50 10 30 V12Z" fill="${S}" ${st}/><path d="M32 12 L46 17 V30 Q46 44 32 51 Q18 44 18 30 V17Z" fill="${RD}" ${st2}/><path d="M32 20 l9 10 h-6 v10 h-6 V30 h-6z" fill="#fff"/>`,
  pack: `<g transform="translate(-6 4) scale(.8)"><path d="M8 40 q0 -26 24 -26 q24 0 24 26 q0 18 -24 18 q-24 0 -24 -18z" fill="${S}" ${st}/></g><g transform="translate(18 4) scale(.8)"><path d="M8 40 q0 -26 24 -26 q24 0 24 26 q0 18 -24 18 q-24 0 -24 -18z" fill="${S}" ${st}/></g><path d="M10 44 q0 -28 22 -28 q22 0 22 28 q0 16 -22 16 q-22 0 -22 -16z" fill="${DK}" ${st}/>` + eyes2(24, 40, 36, 3.2) + `<path d="M22 48 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4" stroke="#fff" stroke-width="1.6" fill="none"/><text x="52" y="16" font-family="sans-serif" font-size="15" font-weight="800" fill="${fL}" stroke="${INK}" stroke-width="1">×2</text>`,
  rabid: `<path d="M10 42 q0 -30 22 -30 q22 0 22 30 q0 16 -22 16 q-22 0 -22 -16z" fill="${RD}" ${st}/><path d="M16 30 l10 4 M48 30 l-10 4" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>` + eyes2(24, 40, 38, 3.4) + `<path d="M18 48 q14 -6 28 0 q-14 12 -28 0z" fill="#4a1622" ${st2}/><path d="M22 48 l2 4 l2 -4 M38 48 l2 4 l2 -4" fill="#fff"/><path d="M28 56 q-2 6 2 8 M36 56 q1 4 -1 6" stroke="#e6fbff" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M6 14 l6 6 M58 14 l-6 6 M32 2 v6" stroke="${fL}" stroke-width="3" stroke-linecap="round"/>`,
  chest: `<circle cx="32" cy="30" r="26" fill="url(#glow)"/><rect x="7" y="27" width="50" height="29" rx="4" fill="${Br}" ${st}/><path d="M7 27 q25 -23 50 0" fill="${Br}" ${st}/><path d="M7 38 h50" stroke="${INK}" stroke-width="2"/><path d="M17 15 v41 M47 15 v41" stroke="${fL}" stroke-width="3"/><rect x="27" y="31" width="10" height="12" rx="2" fill="${GD}" ${st2}/><path d="M13 21 l-5 -9 M51 21 l5 -9 M32 9 v-7" stroke="${fL}" stroke-width="3" stroke-linecap="round"/>`,
  eyes: `<rect x="3" y="9" width="58" height="46" rx="11" fill="#140f18" ${st}/><ellipse cx="21" cy="30" rx="9" ry="6" fill="#ffd34d"/><ellipse cx="43" cy="30" rx="9" ry="6" fill="#ffd34d"/><circle cx="23" cy="30" r="3" fill="${INK}"/><circle cx="45" cy="30" r="3" fill="${INK}"/><path d="M24 44 q8 6 16 0" stroke="#e46a7a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M27 45 l2 3 l2 -3 M33 45 l2 3 l2 -3" stroke="#fff" stroke-width="1.4" fill="none"/>`,
  // ── проклятия
  wind: `<path d="M6 24 h34 q11 0 11 -9 q0 -9 -9 -7 M6 34 h42 q11 0 11 9 q0 9 -9 7 M6 44 h24" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M6 24 h34 q11 0 11 -9 q0 -9 -9 -7 M6 34 h42 q11 0 11 9 q0 9 -9 7 M6 44 h24" fill="none" stroke="#cfeffa" stroke-width="3.5" stroke-linecap="round"/>`,
  rocks: `<path d="M3 57 L16 33 L28 40 L38 20 L61 57Z" fill="${S}" ${st}/><path d="M16 33 l4 10 M38 20 l-2 14 l8 6" stroke="#5b6470" stroke-width="2" fill="none"/><circle cx="20" cy="11" r="6" fill="${S}" ${st}/><circle cx="45" cy="7" r="4.5" fill="${S}" ${st}/><path d="M20 2 v-2 M14 4 l-2 -2 M26 4 l2 -2" stroke="${INK}" stroke-width="1.6"/>`,
  puddle: `<ellipse cx="32" cy="47" rx="27" ry="11" fill="${B}" ${st}/><ellipse cx="26" cy="45" rx="10" ry="3" fill="#bfe8ff" opacity=".6"/><path d="M24 30 q8 -15 0 -24 q-8 9 0 24z" fill="${GL}" ${st}/>`,
  rust: `<rect x="9" y="15" width="46" height="34" rx="5" fill="#b5653f" ${st}/><g fill="#7e3b22"><circle cx="21" cy="27" r="5"/><circle cx="40" cy="38" r="7"/><circle cx="46" cy="22" r="3"/><circle cx="18" cy="42" r="2.4"/></g><path d="M20 49 q0 8 3 10 M40 49 q-1 6 2 8" stroke="#b5653f" stroke-width="3" stroke-linecap="round"/>`,
  paper: `<path d="M13 5 h28 l10 10 v44 H13Z" fill="${W}" ${st}/><path d="M41 5 v10 h10" fill="#d8cdb6" ${st2}/><path d="M21 24 h22 M21 32 h22 M21 40 h14" stroke="${INK}" stroke-width="2"/><circle cx="41" cy="48" r="8" fill="none" stroke="${fR}" stroke-width="3"/><path d="M37 48 h8" stroke="${fR}" stroke-width="2"/>`,
  question: `<circle cx="32" cy="32" r="25" fill="${Pu}" ${st}/><path d="M24 24 q0 -11 8 -11 q9 0 9 9 q0 6 -9 8 v6" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><circle cx="32" cy="47" r="3.2" fill="#fff"/>` + hl('M14 24 Q18 14 28 10', 2.6, 0.4),
  hand: `<path d="M18 59 V28 q0 -4 4 -4 q4 0 4 4 V17 q0 -4 4 -4 q4 0 4 4 v-4 q0 -4 4 -4 q4 0 4 4 v10 q0 -4 4 -4 q4 0 4 4 v21 q0 15 -15 19Z" fill="${SK}" ${st}/><path d="M26 28 v10 M34 18 v20 M42 22 v16" stroke="#bf8b63" stroke-width="1.6"/>`,
  drop: `<path d="M32 5 Q51 30 51 41 a19 19 0 0 1 -38 0 Q13 30 32 5Z" fill="${GL}" ${st}/><path d="M23 41 q2 9 11 9" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
  eye: `<path d="M3 32 Q32 4 61 32 Q32 60 3 32Z" fill="${W}" ${st}/><circle cx="32" cy="32" r="11" fill="${B}" ${st}/><circle cx="32" cy="32" r="4.6" fill="${INK}"/><circle cx="28" cy="28" r="2.4" fill="#fff"/>`,
  backpack: `<rect x="14" y="14" width="36" height="44" rx="10" fill="${G}" ${st}/><path d="M22 14 q0 -10 10 -10 q10 0 10 10" fill="none" ${st}/><rect x="20" y="34" width="24" height="16" rx="4" fill="${u('verd')}" ${st2}/><path d="M20 40 h24" stroke="${INK}" stroke-width="1.6"/><g fill="${S}" ${st2}><circle cx="22" cy="10" r="5"/><circle cx="44" cy="12" r="6"/></g><text x="58" y="20" font-family="sans-serif" font-size="13" font-weight="800" fill="${fR}" stroke="${INK}" stroke-width=".8">−2</text>`,
  // ── события
  ev_quake: `<path d="M2 44 h60 v18 H2z" fill="${Br}" ${st}/><path d="M30 44 l-4 8 l6 3 l-4 7" stroke="${INK}" stroke-width="2.6" fill="none"/><path d="M8 36 l4 -6 l4 6 M46 34 l5 -8 l5 8" stroke="${INK}" stroke-width="2.6" fill="none"/><g fill="${S}" ${st2}><path d="M20 10 l8 -2 l4 7 l-6 5 l-7 -3z"/><path d="M42 16 l6 0 l2 6 l-6 3 l-4 -4z"/></g><path d="M4 26 q4 -4 0 -8 M60 26 q-4 -4 0 -8" stroke="${fL}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  ev_light: `<circle cx="32" cy="26" r="26" fill="url(#glow)"/><path d="M20 26 a12 12 0 1 1 24 0 q0 8 -6 12 v6 h-12 v-6 q-6 -4 -6 -12z" fill="#fff36b" ${st}/><rect x="25" y="44" width="14" height="10" rx="2" fill="${S}" ${st2}/><path d="M25 48 h14" stroke="${INK}" stroke-width="1.6"/><path d="M28 30 l4 -6 l4 6" stroke="#c99a2e" stroke-width="2" fill="none"/><path d="M6 26 h-5 M58 26 h5 M12 8 l-4 -4 M52 8 l4 -4 M32 0 v-2" stroke="${fL}" stroke-width="3" stroke-linecap="round"/>`,
  ev_fair: `<path d="M6 26 L32 6 L58 26Z" fill="${RD}" ${st}/><path d="M14 20 v-0 M32 6 L22 26 M32 6 L42 26" stroke="#fff" stroke-width="3"/><rect x="10" y="26" width="44" height="30" fill="${W}" ${st}/><rect x="16" y="34" width="14" height="22" fill="${Br}" ${st2}/><g ${st2}><circle cx="42" cy="38" r="4" fill="${GD}"/><circle cx="48" cy="46" r="3" fill="${RD}"/><circle cx="40" cy="48" r="3" fill="${G}"/></g><path d="M32 6 v-6 l8 3 l-8 3" fill="${fL}" stroke="${INK}" stroke-width="1.6"/>`,
  ev_rollcall: `<rect x="12" y="8" width="40" height="52" rx="4" fill="${Br}" ${st}/><rect x="17" y="14" width="30" height="42" rx="2" fill="${W}" ${st2}/><rect x="24" y="4" width="16" height="9" rx="2" fill="${S}" ${st2}/><path d="M21 24 l3 3 l5 -6 M21 34 l3 3 l5 -6 M21 44 l3 3 l5 -6" stroke="${fG}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M32 25 h11 M32 35 h11 M32 45 h11" stroke="${INK}" stroke-width="2"/>`,
  // ── расы
  elf: `<path d="M13 32 L1 12 L19 24Z M51 32 L63 12 L45 24Z" fill="${SK}" ${st}/><circle cx="32" cy="34" r="18" fill="${SK}" ${st}/><path d="M13 30 q2 -24 19 -24 q17 0 19 24 q-6 -10 -19 -12 q-13 2 -19 12z" fill="${GD}" ${st}/>` + eyes2(25, 39, 35, 3) + blush(21, 43, 41) + `<path d="M28 44 q4 3 8 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M26 10 l6 -6 l6 6" fill="${LF}" ${st2}/>`,
  dwarf: `<circle cx="32" cy="27" r="16" fill="${SK}" ${st}/><path d="M15 30 q17 44 34 0 q-6 7 -17 7 q-11 0 -17 -7z" fill="#c4743a" ${st}/><path d="M24 38 q8 -4 16 0" stroke="${INK}" stroke-width="2.4" fill="none"/><path d="M13 23 q19 -28 38 0z" fill="${S}" ${st}/><rect x="11" y="21" width="42" height="6" rx="3" fill="${S}" ${st2}/><path d="M32 3 v-0 M14 20 l-6 -10 l10 4 M50 20 l6 -10 l-10 4" fill="${BN}" ${st2}/>` + eyes2(26, 38, 30, 2.6) + `<ellipse cx="32" cy="34" rx="3.4" ry="2.6" fill="#e9967a" ${st2}/>`,
  halfling: `<circle cx="32" cy="31" r="17" fill="${SK}" ${st}/><path d="M15 27 q3 -20 17 -15 q14 -5 17 15 q-5 -5 -9 -4 q-2 -7 -8 -4 q-6 -3 -8 4 q-4 -1 -9 4z" fill="#8a5a3c" ${st}/><g fill="#8a5a3c" ${st2}><circle cx="18" cy="16" r="4"/><circle cx="46" cy="16" r="4"/><circle cx="32" cy="10" r="4.4"/></g>` + eyes2(26, 38, 32, 2.8) + blush(21, 43, 38) + `<path d="M26 40 q6 5 12 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M18 54 q14 -6 28 0" stroke="${INK}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M18 54 q14 -6 28 0" stroke="${fG}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`,
  orc: `<path d="M12 28 L2 22 L12 38Z M52 28 L62 22 L52 38Z" fill="${GR}" ${st}/><path d="M12 30 q0 -22 20 -22 q20 0 20 22 v8 q0 18 -20 18 q-20 0 -20 -18z" fill="${GR}" ${st}/><path d="M18 26 l10 4 M46 26 l-10 4" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>` + eyes2(25, 39, 33, 2.8) + `<path d="M20 44 q12 6 24 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M22 45 l1 -8 l4 7z M42 45 l-1 -8 l-4 7z" fill="${BN}" ${st2}/><path d="M20 10 l4 -6 l4 4 l4 -6 l4 6 l4 -4 l4 6" fill="none" stroke="#2a2230" stroke-width="3" stroke-linecap="round"/>`,
  goblin: `<path d="M16 30 L0 14 L4 34Z M48 30 L64 14 L60 34Z" fill="${u('leaf')}" ${st}/><path d="M14 32 q0 -22 18 -22 q18 0 18 22 q0 22 -18 22 q-18 0 -18 -22z" fill="${u('leaf')}" ${st}/><circle cx="24" cy="30" r="6" fill="#fff36b" ${st2}/><circle cx="40" cy="30" r="6" fill="#fff36b" ${st2}/><circle cx="25" cy="31" r="2.4" fill="${INK}"/><circle cx="41" cy="31" r="2.4" fill="${INK}"/><path d="M32 34 l-4 8 h8z" fill="#3e9c5f" ${st2}/><path d="M20 44 q12 10 24 0 z" fill="#4a1622" ${st2}/><path d="M24 45 l2 3 l2 -3 M36 45 l2 3 l2 -3" stroke="#fff" stroke-width="1.4" fill="none"/>`,
  molefolk: `<path d="M8 56 q0 -46 24 -46 q24 0 24 46z" fill="${DK}" ${st}/><ellipse cx="32" cy="42" rx="12" ry="10" fill="#d8b8a8" ${st2}/><ellipse cx="32" cy="36" rx="6" ry="4.6" fill="#e86fa1" ${st2}/><circle cx="30" cy="35" r="1.4" fill="#fff"/><path d="M22 26 q3 -2 6 0 M36 26 q3 -2 6 0" stroke="#efe6d4" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M14 44 l-8 4 M14 48 l-8 8 M50 44 l8 4 M50 48 l8 8" stroke="${INK}" stroke-width="1.4"/><path d="M4 60 q2 -8 8 -6 l2 6 M60 60 q-2 -8 -8 -6 l-2 6" fill="#d8b8a8" ${st2}/><path d="M30 46 v3 M34 46 v3" stroke="#fff" stroke-width="1.6"/>`,
  // ── классы
  warrior: `<path d="M14 50 L46 18" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M14 50 L46 18" stroke="${fS}" stroke-width="6" stroke-linecap="round"/><path d="M9 40 l15 15 M7 59 l9 -9" ${st}/><path d="M50 50 L18 18" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M50 50 L18 18" stroke="#d9dee6" stroke-width="6" stroke-linecap="round"/><path d="M55 40 l-15 15 M57 59 l-9 -9" ${st}/><path d="M22 34 L32 22 L42 34 L32 52Z" fill="${RD}" ${st}/><path d="M32 28 v16" stroke="#fff" stroke-width="2.4"/>`,
  mage: `<path d="M32 2 L50 50 H14Z" fill="${Pu}" ${st}/><path d="M32 2 q10 14 24 8" stroke="${INK}" stroke-width="2.4" fill="none"/><ellipse cx="32" cy="52" rx="26" ry="7" fill="${Pu}" ${st}/><g fill="#fff36b"><path d="M29 24 l2 4 l4 .5 l-3 3 l.8 4 l-3.8 -2 l-3.8 2 l.8 -4 l-3 -3 l4 -.5z"/><circle cx="38" cy="40" r="2.4"/><circle cx="24" cy="42" r="1.6"/></g><path d="M18 44 q14 4 28 0" stroke="${fL}" stroke-width="4" fill="none"/>`,
  cleric: `<circle cx="32" cy="32" r="27" fill="url(#glow)" opacity=".5"/>`
    // золотой скипетр с солнечным самоцветом
    + `<rect x="47.4" y="15" width="5.2" height="45" rx="2.4" fill="${GD}" ${st2}/><rect x="46" y="16" width="8" height="3.4" rx="1.6" fill="${GD}" ${st2}/>`
    + `<g stroke="${fL}" stroke-width="2.2" stroke-linecap="round"><path d="M50 0.8 v2.4 M58.8 3.4 l-1.7 1.7 M41.2 3.4 l1.7 1.7 M61 11 h-2.4 M39 11 h2.4"/></g>`
    + `<circle cx="50" cy="10.5" r="6.4" fill="${GD}" ${st2}/><circle cx="50" cy="10.5" r="2.8" fill="#7cd3ff" stroke="${INK}" stroke-width="1.4"/><circle cx="49" cy="9.4" r="1" fill="#fff"/>`
    // бежевая мантия с золотой каймой и верёвочным поясом
    + `<path d="M9 63 Q10 43 19 36 Q28 31 38 34 Q46 38 47 63 Z" fill="${BE}" ${st}/>`
    + `<path d="M24 36 L21.5 62 M36 35.5 L38.5 62" stroke="${INK}" stroke-width="5.6"/><path d="M24 36 L21.5 62 M36 35.5 L38.5 62" stroke="${fL}" stroke-width="3"/>`
    + `<path d="M10.5 58.5 Q28 62.5 46.6 58.5" stroke="${INK}" stroke-width="5" fill="none"/><path d="M10.5 58.5 Q28 62.5 46.6 58.5" stroke="${fL}" stroke-width="2.6" fill="none"/>`
    + `<path d="M14 47.5 Q28 52 45 47.5" stroke="${INK}" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M14 47.5 Q28 52 45 47.5" stroke="#d8b06a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="2.6 1.6"/>`
    + `<path d="M20 50 l-1.6 7" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M20 50 l-1.6 7" stroke="#d8b06a" stroke-width="1.8" stroke-linecap="round"/>`
    // капюшон за головой
    + `<path d="M15.5 31 Q13 12 30 8.5 Q47 12 44.5 31 Q38 36.5 30 36.5 Q22 36.5 15.5 31Z" fill="${BE}" ${st}/><path d="M18.5 29 Q17.5 15 30 12.5" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/>`
    // круглое улыбчивое лицо с хохолком на макушке
    + `<circle cx="30" cy="23.5" r="10.6" fill="${SK}" ${st}/><path d="M27.5 13.6 q2.5 -4.6 5.5 -1.2 q-2.6 -0.6 -2.4 1.6" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`
    + `<path d="M24.6 22.4 q2 -2.6 4 0 M31.4 22.4 q2 -2.6 4 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>` + blush(23.6, 36.4, 26.6)
    + `<circle cx="30" cy="25" r="1.7" fill="#e7a07f"/><path d="M25.6 28 q4.4 5.4 8.8 0 z" fill="#fff" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>`
    // рука держит скипетр, вторая лежит на животе
    + `<path d="M37.5 37 Q45 37.5 47.6 31.5" stroke="${INK}" stroke-width="8.4" stroke-linecap="round" fill="none"/><path d="M37.5 37 Q45 37.5 47.6 31.5" stroke="#ead3a6" stroke-width="5" stroke-linecap="round" fill="none"/>`
    + `<circle cx="49.8" cy="30" r="3.7" fill="${SK}" ${st2}/><circle cx="23" cy="43.5" r="3.3" fill="${SK}" ${st2}/>`,
  rogue: `<path d="M8 30 q24 -24 48 0 q-24 14 -48 0z" fill="${DK}" ${st}/><ellipse cx="22" cy="28" rx="5" ry="4" fill="#fff"/><ellipse cx="42" cy="28" rx="5" ry="4" fill="#fff"/><circle cx="23" cy="28" r="2" fill="${INK}"/><circle cx="43" cy="28" r="2" fill="${INK}"/><path d="M4 32 l-4 8 M60 32 l4 8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M14 50 L44 50" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M14 50 L44 50" stroke="#d9dee6" stroke-width="4" stroke-linecap="round"/><path d="M44 50 l10 -5 v10z" fill="${S}" ${st2}/><rect x="6" y="45" width="10" height="10" rx="2" fill="${Br}" ${st2}/>`,
  bard: `<path d="M8 22 q24 -20 48 0 q-6 8 -24 8 q-18 0 -24 -8z" fill="${RD}" ${st}/><path d="M42 16 q12 -18 20 -12 q-8 2 -14 16" fill="${GD}" ${st2}/><g fill="${INK}"><path d="M20 58 v-20 l18 -5 v20" stroke="${INK}" stroke-width="3" fill="none"/><ellipse cx="17" cy="58" rx="5" ry="4"/><ellipse cx="35" cy="53" rx="5" ry="4"/></g><path d="M20 42 l18 -5" stroke="${INK}" stroke-width="3"/><circle cx="48" cy="44" r="3" fill="${fL}"/><circle cx="54" cy="36" r="2" fill="${fL}"/>`,
  alchemist: `<path d="M26 6 h12 v16 l14 26 q3 8 -6 8 h-28 q-9 0 -6 -8 l14 -26z" fill="${GL}" ${st}/><path d="M15 40 h34 l4 8 q3 8 -6 8 h-30 q-9 0 -6 -8z" fill="${LF}"/><path d="M26 6 h12 v16 l14 26 q3 8 -6 8 h-28 q-9 0 -6 -8 l14 -26z" fill="none" ${st}/><rect x="23" y="2" width="18" height="6" rx="2" fill="${Br}" ${st2}/><g fill="#fff"><circle cx="26" cy="48" r="2.4"/><circle cx="36" cy="44" r="1.6"/><circle cx="40" cy="51" r="1.2"/></g><path d="M44 14 q4 -4 2 -8 M50 20 q6 -4 4 -10" stroke="#a6f2b7" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  engineer: `<path d="M32 8 l5 0 l2 6 l6 3 l6 -3 l4 4 l-3 6 l3 6 l6 2 v6 l-6 2 l-3 6 l3 6 l-4 4 l-6 -3 l-6 3 l-2 6 h-6 l-2 -6 l-6 -3 l-6 3 l-4 -4 l3 -6 l-3 -6 l-6 -2 v-6 l6 -2 l3 -6 l-3 -6 l4 -4 l6 3 l6 -3 l2 -6z" fill="${S}" ${st}/><circle cx="32" cy="35" r="9" fill="${DK}" ${st2}/><path d="M10 58 L40 28" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M10 58 L40 28" stroke="${fL}" stroke-width="4" stroke-linecap="round"/>`,
  witcher: `<path d="M13 2 Q21 15 32 14 Q43 15 51 2" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="M13 2 Q21 15 32 14 Q43 15 51 2" fill="none" stroke="#d4d9e0" stroke-width="2.6" stroke-dasharray="3.2 2.2" stroke-linecap="round"/><rect x="28" y="11" width="8" height="7" rx="2.2" fill="${S}" ${st2}/><circle cx="32" cy="39" r="23" fill="${S}" ${st}/><circle cx="32" cy="39" r="18.6" fill="#22262d" stroke="#eef1f5" stroke-width="1.6"/><path d="M18.5 28 L21.5 20.5 L27 26.5 Q32 25 37 26.5 L42.5 20.5 L45.5 28 Q48.5 34 47.5 41 Q45.5 53 32 56 Q18.5 53 16.5 41 Q15.5 34 18.5 28Z" fill="${S}" ${st2}/><circle cx="25.4" cy="38" r="9" fill="#62ff98" opacity=".22"/><circle cx="38.6" cy="38" r="9" fill="#62ff98" opacity=".22"/><circle cx="25.4" cy="38" r="6.2" fill="#e3e7ec" ${st2}/><circle cx="38.6" cy="38" r="6.2" fill="#e3e7ec" ${st2}/><circle cx="25.4" cy="38" r="3.9" fill="#6dff9e"/><circle cx="38.6" cy="38" r="3.9" fill="#6dff9e"/><circle cx="25.4" cy="38" r="1.7" fill="${INK}"/><circle cx="38.6" cy="38" r="1.7" fill="${INK}"/><circle cx="24.2" cy="36.6" r="1" fill="#fff"/><circle cx="37.4" cy="36.6" r="1" fill="#fff"/><path d="M18.5 31.5 L32 36.5 L45.5 31.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29.6 43 H34.4 L32 48.5Z" fill="#e8c15a" ${st2}/><path d="M24.5 50.5 q3.7 2.4 7.5 0 q3.8 2.4 7.5 0" fill="none" stroke="#5b6470" stroke-width="1.7" stroke-linecap="round"/>${hl('M14 30 Q18 20 28 17', 2.4, 0.7)}`,
  mix: `<circle cx="23" cy="32" r="17" fill="${G}" ${st} opacity=".92"/><circle cx="41" cy="32" r="17" fill="${GD}" ${st} opacity=".92"/><path d="M32 18 q6 14 0 28 q-6 -14 0 -28z" fill="#fff" opacity=".45"/>`,
  badge: `<rect x="11" y="9" width="42" height="48" rx="6" fill="${W}" ${st}/><rect x="25" y="4" width="14" height="9" rx="2" fill="${S}" ${st2}/><path d="M19 32 h26 M19 40 h26 M19 48 h15" stroke="${INK}" stroke-width="2"/><text x="32" y="26" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="800" fill="${fR}">×2</text>`,
};

// ───────────── сцены локаций 160×120 ─────────────
const LOC_BG = {
  loc_water: ['#2c6a76', '#0d2028'], loc_mushroom: ['#24513f', '#0b1a14'], loc_station: ['#4a4f63', '#16171f'],
  loc_vault: ['#6a5326', '#1d1509'], loc_boiler: ['#8f3218', '#220b08'], loc_market: ['#6b3f5e', '#1e0f1a'],
  loc_rats: ['#4f3d33', '#171110'], loc_dark: ['#1f1a26', '#050407'], loc_echo: ['#4a4566', '#131120'],
  loc_lake: ['#2c4f7a', '#0b1424'], loc_crystal: ['#4a3a7a', '#120c26'], loc_lava: ['#8a2a10', '#1e0706'],
  loc_ice: ['#7fb6d9', '#1a3550'], loc_storm: ['#3d4a66', '#0d1220'], loc_temple: ['#7a5a2a', '#1e1408'],
  loc_tavern: ['#7a4a26', '#20120a'], loc_garden: ['#2a5a3a', '#08180e'], loc_lair: ['#6a4a12', '#140c04'],
};
const LOCS = {
  loc_water: `<path d="M-4 120 V60 Q-4 6 80 6 Q164 6 164 60 V120Z" fill="#183c46" opacity=".55"/><path d="M14 120 V64 Q14 22 80 22 Q146 22 146 64 V120" fill="none" stroke="#0c2128" stroke-width="10"/><g stroke="#0c2128" stroke-width="2" opacity=".6"><path d="M20 60 h12 M128 60 h12 M24 40 h10 M126 40 h10"/></g>
    <path d="M0 84 Q20 78 40 84 T80 84 T120 84 T160 84 V120 H0Z" fill="#3a8fa0"/><path d="M0 84 Q20 78 40 84 T80 84 T120 84 T160 84" fill="none" stroke="#9ff0f5" stroke-width="2.6"/>
    <path d="M10 98 q14 -5 28 0 M62 104 q14 -5 28 0 M112 96 q14 -5 28 0" stroke="#bff7fa" stroke-width="2" fill="none" opacity=".7"/>
    <g transform="translate(98 66) rotate(-12)"><path d="M0 0 h10 v12 h10 q6 0 6 6 v2 H0Z" fill="${G}" ${st2}/></g>
    <g fill="#bff7fa"><path d="M40 30 q4 6 0 8 q-4 -2 0 -8z"/><path d="M116 38 q3 5 0 7 q-3 -2 0 -7z"/><circle cx="60" cy="74" r="2"/><circle cx="70" cy="66" r="1.4"/></g>`,
  loc_mushroom: `<g opacity=".5" fill="#a6f2b7"><circle cx="20" cy="20" r="2"/><circle cx="140" cy="16" r="1.6"/><circle cx="90" cy="10" r="1.4"/><circle cx="64" cy="40" r="1.8"/><circle cx="120" cy="50" r="2.2"/></g>
    <path d="M0 104 Q40 96 80 102 T160 100 V120 H0Z" fill="#0f2a1e"/>
    <ellipse cx="44" cy="58" rx="40" ry="26" fill="#7dffb0" opacity=".12"/>
    <path d="M36 110 Q34 76 40 62 H52 Q56 76 54 110Z" fill="#f3e6c8" ${st}/><path d="M10 64 C10 26 82 26 82 64 Q46 72 10 64Z" fill="#5fe39a" ${st}/><g fill="#d9ffe6" ${st2}><circle cx="30" cy="46" r="5"/><circle cx="56" cy="40" r="6"/><circle cx="70" cy="54" r="3.4"/></g>
    <path d="M110 110 Q108 92 112 84 H120 Q124 92 122 110Z" fill="#f3e6c8" ${st2}/><path d="M94 86 C94 62 138 62 138 86 Q116 92 94 86Z" fill="#c78bff" ${st}/><g fill="#f1e2ff"><circle cx="108" cy="76" r="3"/><circle cx="124" cy="72" r="3.6"/></g>
    <path d="M140 112 v-8 q0 -6 6 -6 q6 0 6 6 v8Z" fill="#ffd36b" ${st2}/><path d="M78 112 v-6 q0 -5 5 -5 q5 0 5 5 v6Z" fill="#7fd1ff" ${st2}/>`,
  loc_station: `<g stroke="rgba(255,255,255,.07)" stroke-width="1">${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 16} 0 V74"/>`).join('')}${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${8 + i * 12} H160"/>`).join('')}</g>
    <rect x="0" y="52" width="160" height="8" fill="#d2502f" opacity=".7"/><rect x="40" y="12" width="80" height="22" rx="4" fill="#20314f" ${st2}/><text x="80" y="28" text-anchor="middle" font-family="Underdog, sans-serif" font-size="13" fill="#f6e7c1">Глубинная</text>
    <circle cx="18" cy="14" r="10" fill="url(#glow)" opacity=".8"/><path d="M18 0 v8" stroke="${INK}" stroke-width="2"/><circle cx="18" cy="12" r="4" fill="#fff3b0" ${st2}/>
    <rect x="0" y="74" width="160" height="12" fill="#8b8494" ${st2}/><path d="M0 86 H160 V120 H0Z" fill="#141218"/><path d="M0 100 H160 M0 112 H160" stroke="#9aa3ad" stroke-width="3"/><g fill="#5a3a2a"><rect x="10" y="96" width="8" height="20"/><rect x="50" y="96" width="8" height="20"/><rect x="90" y="96" width="8" height="20"/><rect x="130" y="96" width="8" height="20"/></g>
    <rect x="108" y="58" width="36" height="6" rx="2" fill="${Br}" ${st2}/><path d="M112 64 v10 M140 64 v10" stroke="${INK}" stroke-width="3"/>
    <path d="M60 40 Q60 70 74 70 L68 62 Q66 50 60 40Z" fill="#b9a6ff" opacity=".25"/>`,
  loc_vault: `<circle cx="80" cy="56" r="52" fill="url(#glow)" opacity=".18"/><circle cx="80" cy="56" r="44" fill="${S}" ${st}/><circle cx="80" cy="56" r="34" fill="#7a828d" ${st2}/><g fill="${INK}">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<circle cx="${(80 + Math.cos(a) * 39).toFixed(1)}" cy="${(56 + Math.sin(a) * 39).toFixed(1)}" r="2.4"/>`; }).join('')}</g>
    <circle cx="80" cy="56" r="10" fill="${GD}" ${st2}/><path d="M80 34 v44 M58 56 h44 M64 40 l32 32 M96 40 l-32 32" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M80 34 v44 M58 56 h44 M64 40 l32 32 M96 40 l-32 32" stroke="${fS}" stroke-width="2" stroke-linecap="round"/><circle cx="80" cy="56" r="6" fill="${GD}" ${st2}/>
    <g ${st2}><ellipse cx="18" cy="110" rx="12" ry="5" fill="#a8680c"/><ellipse cx="18" cy="104" rx="12" ry="5" fill="#f2c14e"/><ellipse cx="18" cy="98" rx="12" ry="5" fill="#ffe08a"/><ellipse cx="142" cy="110" rx="12" ry="5" fill="#a8680c"/><ellipse cx="142" cy="104" rx="12" ry="5" fill="#ffe08a"/></g><rect x="120" y="76" width="22" height="14" rx="2" fill="${GD}" ${st2} transform="rotate(-8 131 83)"/>`,
  loc_boiler: `<path d="M0 0 h160 v120 h-160z" fill="#ff7a3a" opacity=".06"/><path d="M0 22 H50 M110 22 H160 M14 0 V40 M146 0 V60" stroke="${INK}" stroke-width="10"/><path d="M0 22 H50 M110 22 H160 M14 0 V40 M146 0 V60" stroke="#a5582f" stroke-width="6"/>
    <rect x="44" y="20" width="72" height="84" rx="30" fill="${RD}" ${st}/><path d="M44 50 h72 M44 76 h72" stroke="${INK}" stroke-width="3"/><g fill="${INK}"><circle cx="52" cy="50" r="2"/><circle cx="108" cy="50" r="2"/><circle cx="52" cy="76" r="2"/><circle cx="108" cy="76" r="2"/></g>
    <circle cx="80" cy="36" r="10" fill="${W}" ${st2}/><path d="M80 36 l6 -5" stroke="${fR}" stroke-width="2.4" stroke-linecap="round"/><rect x="64" y="84" width="32" height="16" rx="3" fill="#2a0e08" ${st2}/><path d="M68 98 q4 -10 8 0 q4 -12 8 0 q4 -8 8 0" fill="#ffb347"/>
    <g fill="#f3eee4" opacity=".7"><circle cx="128" cy="14" r="7"/><circle cx="138" cy="8" r="5"/><circle cx="30" cy="40" r="5"/></g><path d="M0 108 H160 V120 H0z" fill="#1c0a06"/>`,
  loc_market: `<path d="M0 18 Q40 30 80 18 T160 18" stroke="${INK}" stroke-width="1.6" fill="none"/><g>${[12, 36, 60, 84, 108, 132, 152].map((x, i) => `<circle cx="${x}" cy="${20 + Math.sin(i) * 4}" r="4" fill="${['#ffd36b', '#ff8f8f', '#7fd1ff', '#a6f2b7'][i % 4]}" ${st2}/>`).join('')}</g>
    <rect x="8" y="52" width="66" height="44" fill="${Br}" ${st}/><path d="M4 52 L12 32 H70 L78 52Z" fill="${RD}" ${st}/><path d="M24 32 L20 52 M41 32 V52 M58 32 L62 52" stroke="#fff" stroke-width="4"/><g ${st2}><circle cx="24" cy="62" r="6" fill="${GD}"/><circle cx="40" cy="64" r="5" fill="${G}"/><rect x="50" y="58" width="14" height="10" fill="${S}"/></g>
    <rect x="88" y="56" width="64" height="40" fill="${Br}" ${st}/><path d="M84 56 L92 38 H148 L156 56Z" fill="${B}" ${st}/><path d="M104 38 L100 56 M120 38 V56 M136 38 L140 56" stroke="#fff" stroke-width="4"/><g ${st2}><path d="M98 70 h16 l-2 10 h-12z" fill="${W}"/><circle cx="130" cy="72" r="7" fill="${PK}"/></g>
    <path d="M0 96 H160 V120 H0z" fill="#2a1622"/><text x="120" y="112" text-anchor="middle" font-family="Underdog, sans-serif" font-size="11" fill="#ffd36b">всё по 100!</text>`,
  loc_rats: `<path d="M0 100 Q40 92 80 98 T160 96 V120 H0Z" fill="#241a16"/>${[[24, 40], [64, 26], [112, 36], [140, 70], [36, 78], [94, 74]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${14 - (i % 3) * 2}" ry="${10 - (i % 3) * 2}" fill="#0c0806" ${st2}/><circle cx="${x - 4}" cy="${y}" r="2.2" fill="#ff5a3d"/><circle cx="${x + 4}" cy="${y}" r="2.2" fill="#ff5a3d"/>`).join('')}
    <path d="M62 112 L98 112 L92 96 Z" fill="#ffd36b" ${st}/><circle cx="84" cy="106" r="2.4" fill="#c99a2e"/><circle cx="74" cy="108" r="1.6" fill="#c99a2e"/>
    <path d="M108 104 q14 -6 22 2" stroke="#e7a5a5" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  loc_dark: `<circle cx="80" cy="84" r="34" fill="url(#glow)" opacity=".35"/><rect x="76" y="78" width="8" height="20" rx="2" fill="${W}" ${st2}/><path d="M80 78 q-5 -8 0 -16 q5 8 0 16z" fill="#ffd36b" ${st2}/><ellipse cx="80" cy="100" rx="16" ry="4" fill="#3a2a18" ${st2}/>
    ${[[30, 36], [126, 30], [44, 70], [138, 66], [96, 18]].map(([x, y], i) => `<g opacity="${0.5 + (i % 3) * 0.2}"><ellipse cx="${x - 5}" cy="${y}" rx="3.4" ry="${i % 2 ? 2.2 : 3}" fill="#fff36b"/><ellipse cx="${x + 5}" cy="${y}" rx="3.4" ry="${i % 2 ? 2.2 : 3}" fill="#fff36b"/></g>`).join('')}`,
  loc_echo: `<path d="M0 0 H160 V14 L150 40 L140 14 L124 30 L114 8 L98 46 L88 10 L70 26 L60 6 L44 38 L32 10 L20 28 L10 8 L0 22Z" fill="#2a2640" ${st2}/><path d="M0 120 L14 96 L24 104 L40 84 L54 120Z M110 120 L124 90 L136 100 L148 86 L160 120Z" fill="#2a2640" ${st2}/>
    <path d="M54 62 q-10 10 0 20 M44 54 q-18 18 0 36 M106 62 q10 10 0 20 M116 54 q18 18 0 36" stroke="#d9b3ff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="80" y="78" text-anchor="middle" font-family="Underdog, sans-serif" font-size="18" fill="#f6e7c1">о-о-о</text><text x="80" y="96" text-anchor="middle" font-family="Underdog, sans-serif" font-size="11" fill="#d9b3ff" opacity=".7">о-о…</text>`,
};
Object.assign(LOCS, {
  loc_lake: `<path d="M0 0 H160 V14 L148 34 L138 12 L120 26 L108 6 L94 30 L84 8 L66 20 L54 4 L40 26 L28 8 L14 22 L0 10Z" fill="#0d1a2e"/>
    <path d="M76 0 L84 0 L120 70 L40 70Z" fill="#cfe8ff" opacity=".12"/><ellipse cx="80" cy="6" rx="10" ry="4" fill="#e6f4ff" opacity=".5"/>
    <path d="M0 66 H160 V120 H0Z" fill="#163a5c"/><path d="M0 66 H160" stroke="#8fc6ff" stroke-width="2" opacity=".7"/>
    <path d="M76 66 L84 66 L100 120 L60 120Z" fill="#cfe8ff" opacity=".16"/>
    <path d="M12 80 q14 -4 28 0 M100 86 q14 -4 28 0 M40 100 q14 -4 28 0 M110 104 q14 -4 28 0" stroke="#bfe4ff" stroke-width="1.6" fill="none" opacity=".6"/>
    <path d="M28 72 q20 -10 40 0 l-4 6 h-32z" fill="#3a2418" ${st2}/><path d="M48 62 v12" stroke="${INK}" stroke-width="2"/><path d="M48 62 l12 6 l-12 2z" fill="#efe6d4" ${st2}/>
    <path d="M14 66 L22 86 L30 66 M126 66 L132 80 L138 66" fill="#0d1a2e" opacity=".5"/>`,
  loc_crystal: `<path d="M0 0 H160 V12 L148 28 L136 10 L120 22 L106 4 L92 24 L78 6 L62 20 L48 4 L34 22 L18 8 L0 18Z" fill="#160f2e"/>
    <path d="M70 0 L90 0 L110 120 L50 120Z" fill="#e6d4ff" opacity=".08"/>
    ${[[24, 104, 46, 14, '#7fe8ff'], [40, 110, 30, 10, '#c78bff'], [120, 104, 52, 16, '#ff9ad9'], [138, 110, 32, 10, '#7fe8ff'], [80, 112, 24, 9, '#fff3b0'], [104, 112, 28, 10, '#c78bff']].map(([x, y, h, w, c]) => `<path d="M${x - w / 2} ${y} L${x - w / 2} ${y - h * 0.75} L${x} ${y - h} L${x + w / 2} ${y - h * 0.75} L${x + w / 2} ${y}Z" fill="${c}" ${st2}/><path d="M${x} ${y - h} L${x} ${y} L${x + w / 2} ${y} L${x + w / 2} ${y - h * 0.75}Z" fill="#231a26" opacity=".25"/><path d="M${x - w / 4} ${y - h * 0.7} v${h * 0.5}" stroke="#fff" stroke-width="1.6" opacity=".7"/>`).join('')}
    <path d="M0 112 H160 V120 H0Z" fill="#160f2e"/><g fill="#fff"><path d="M60 40 l1.5 3 l3 1.5 l-3 1.5 l-1.5 3 l-1.5 -3 l-3 -1.5 l3 -1.5z"/><circle cx="100" cy="50" r="1.6"/><circle cx="30" cy="40" r="1.2"/><circle cx="130" cy="36" r="1.4"/></g>`,
  loc_lava: `<path d="M0 0 H160 V16 L146 30 L134 10 L118 26 L104 6 L90 28 L76 8 L60 22 L46 6 L32 24 L16 8 L0 20Z" fill="#1a0604"/>
    <path d="M0 62 Q40 52 80 64 T160 58 V82 Q120 92 80 84 T0 88Z" fill="#ff6a1a"/><path d="M0 66 Q40 58 80 68 T160 63 V78 Q120 86 80 79 T0 82Z" fill="#ffc04a"/>
    <path d="M20 70 q10 -3 20 0 M90 74 q12 -3 24 0" stroke="#fff3b0" stroke-width="2" fill="none" opacity=".8"/>
    <path d="M0 84 Q30 80 60 90 L80 120 H0Z M160 82 Q130 80 104 92 L90 120 H160Z" fill="#2a0c08" ${st2}/>
    <path d="M0 58 Q40 46 80 58 T160 52" stroke="#ff8a3d" stroke-width="6" fill="none" opacity=".25"/>
    <g fill="#ffd27a"><circle cx="30" cy="44" r="1.8"/><circle cx="70" cy="36" r="1.4"/><circle cx="120" cy="40" r="2"/><circle cx="140" cy="26" r="1.4"/></g>`,
  loc_ice: `<path d="M0 0 H160 V8 ${Array.from({ length: 16 }, (_, i) => `L${i * 10 + 5} ${10 + (i * 37) % 26} L${i * 10 + 10} 8`).join(' ')} L160 8 V0Z" fill="#e6f6ff" ${st2}/>
    <path d="M0 92 Q40 84 80 92 T160 88 V120 H0Z" fill="#cfeaff" ${st2}/><path d="M10 100 h40 M90 104 h50" stroke="#fff" stroke-width="2" opacity=".7"/>
    <path d="M24 92 L34 56 L44 92Z M112 90 L124 50 L136 90Z" fill="#a9d8f5" ${st2}/><path d="M34 60 v26 M124 56 v28" stroke="#fff" stroke-width="1.6" opacity=".8"/>
    <g fill="#fff">${[[20, 30], [50, 44], [80, 28], [100, 60], [140, 36], [66, 70], [30, 70], [150, 70]].map(([x, y]) => `<path d="M${x} ${y - 3} v6 M${x - 3} ${y} h6 M${x - 2} ${y - 2} l4 4 M${x + 2} ${y - 2} l-4 4" stroke="#fff" stroke-width="1.2"/>`).join('')}</g>`,
  loc_storm: `<path d="M0 0 H160 V40 H0Z" fill="#1a2236"/><g fill="#3a4560"><ellipse cx="30" cy="20" rx="30" ry="12"/><ellipse cx="80" cy="14" rx="34" ry="12"/><ellipse cx="130" cy="22" rx="32" ry="12"/></g>
    <path d="M86 18 L76 46 L88 46 L78 76 L102 38 L90 38 L98 18Z" fill="#fff6a8" ${st2}/>
    <path d="M0 30 L0 120 H34 L40 90 L28 60 L36 40 L20 30Z M160 30 L160 120 H124 L118 92 L130 64 L122 42 L140 30Z" fill="#141826" ${st2}/>
    <g stroke="#a9c8ff" stroke-width="1.4" opacity=".55">${Array.from({ length: 14 }, (_, i) => `<path d="M${10 + i * 11} ${40 + (i * 29) % 40} l-4 12"/>`).join('')}</g>
    <path d="M40 120 Q80 100 120 120Z" fill="#2a3450"/>`,
  loc_temple: `<path d="M64 0 L96 0 L120 120 L40 120Z" fill="#ffe8a0" opacity=".16"/>
    ${[18, 52, 108, 142].map(x => `<rect x="${x - 8}" y="20" width="16" height="84" fill="#c9b48a" ${st2}/><rect x="${x - 11}" y="14" width="22" height="8" fill="#e0cfa6" ${st2}/><path d="M${x - 4} 24 v76 M${x + 4} 24 v76" stroke="#a8916a" stroke-width="1.4"/>`).join('')}
    <rect x="58" y="86" width="44" height="18" fill="#a8916a" ${st2}/><rect x="54" y="80" width="52" height="8" fill="#c9b48a" ${st2}/>
    <circle cx="80" cy="70" r="9" fill="#fff3b0" ${st2}/><circle cx="80" cy="70" r="16" fill="url(#glow)" opacity=".6"/>
    <g fill="#ffd56a" opacity=".85"><text x="34" y="60" font-size="10" font-family="serif">ᚱ</text><text x="122" y="54" font-size="10" font-family="serif">ᚷ</text><text x="80" y="40" font-size="9" font-family="serif" text-anchor="middle">ᛟ</text></g>
    <path d="M0 104 H160 V120 H0Z" fill="#5a4220"/>`,
  loc_tavern: `<path d="M0 0 H160 V120 H0Z" fill="#5a341a" opacity=".5"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${i * 20} 0 V96" stroke="#3a2010" stroke-width="2"/>`).join('')}
    <rect x="112" y="40" width="40" height="50" rx="4" fill="#2a1408" ${st2}/><path d="M116 88 q6 -16 12 0 q6 -20 12 0 q4 -12 8 0Z" fill="#ff8a3d"/><path d="M120 86 q4 -8 8 0 q4 -10 8 0Z" fill="#ffd27a"/>
    <path d="M40 0 v18" stroke="${INK}" stroke-width="2"/><rect x="33" y="18" width="14" height="18" rx="3" fill="#fff3b0" ${st2}/><circle cx="40" cy="27" r="14" fill="url(#glow)" opacity=".7"/>
    <rect x="6" y="80" width="100" height="8" rx="2" fill="#8a5a3c" ${st2}/><path d="M14 88 v22 M96 88 v22" stroke="${INK}" stroke-width="4"/>
    <path d="M30 80 v-12 h10 v12Z" fill="#e8c88a" ${st2}/><path d="M40 70 q5 0 5 5 q0 4 -5 4" fill="none" ${st2}/><path d="M30 68 q5 -5 10 0" fill="#fff" ${st2}/>
    <path d="M60 80 v-10 h9 v10Z" fill="#e8c88a" ${st2}/><ellipse cx="22" cy="104" rx="14" ry="16" fill="#8a5a3c" ${st2}/><path d="M9 98 h26 M9 110 h26" stroke="#3a2010" stroke-width="2"/>
    <path d="M0 110 H160 V120 H0Z" fill="#2a1408"/>`,
  loc_garden: `<path d="M0 0 H160 V12 L146 26 L130 8 L116 22 L100 6 L86 24 L70 6 L56 20 L40 4 L26 22 L10 8 L0 16Z" fill="#06120a"/>
    ${[[20, 96, '#ff9ad9'], [44, 104, '#fff3b0'], [74, 98, '#7fe8ff'], [104, 102, '#ff9ad9'], [130, 96, '#c78bff'], [150, 104, '#fff3b0']].map(([x, y, c]) => `<path d="M${x} 120 V${y}" stroke="#3e9c5f" stroke-width="3"/><path d="M${x} ${y + 8} q-8 -6 -10 2 M${x} ${y + 12} q8 -6 10 2" stroke="#3e9c5f" stroke-width="2.4" fill="none"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="${x}" cy="${y - 5}" rx="3.4" ry="5" transform="rotate(${a} ${x} ${y})" fill="${c}" ${st2}/>`).join('')}<circle cx="${x}" cy="${y}" r="3" fill="#f5b83d"/><circle cx="${x}" cy="${y}" r="12" fill="${c}" opacity=".18"/>`).join('')}
    <g fill="#fff36b">${[[30, 40], [60, 30], [90, 50], [120, 34], [140, 60], [50, 66], [100, 76], [16, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/><circle cx="${x}" cy="${y}" r="6" opacity=".25"/>`).join('')}</g>`,
  loc_lair: `<ellipse cx="96" cy="44" rx="30" ry="14" fill="#1a0e04"/><ellipse cx="96" cy="44" rx="24" ry="11" fill="#ffcf4a" ${st2}/><ellipse cx="96" cy="44" rx="3.4" ry="10" fill="${INK}"/><circle cx="90" cy="40" r="2.4" fill="#fff" opacity=".8"/>
    <path d="M0 120 L0 92 Q20 70 44 84 Q60 66 82 82 Q104 64 124 84 Q142 72 160 88 V120Z" fill="#f2c14e" ${st2}/><path d="M0 104 Q40 90 80 102 T160 100 V120 H0Z" fill="#c8922c"/>
    <g ${st2}>${[[24, 88], [52, 80], [76, 92], [108, 82], [136, 90], [40, 100], [96, 104], [124, 106]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3" fill="#ffe08a"/>`).join('')}</g>
    <rect x="58" y="70" width="18" height="12" rx="2" fill="#8a5a3c" ${st2}/><path d="M58 74 h18" stroke="#f2c14e" stroke-width="2"/>
    <path d="M20 40 q10 -10 20 -4 q10 -12 22 -2" stroke="#6a5a4a" stroke-width="6" fill="none" opacity=".35" stroke-linecap="round"/>
    <g fill="#fff"><path d="M40 70 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1z"/><path d="M130 76 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1z"/></g>`,
});
export function locationSVG(key) {
  return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="120" fill="url(#lb-${LOC_BG[key] ? key : 'loc_dark'})"/>${LOCS[key] || ''}</svg>`;
}

// ───────────── иконки и арт карт ─────────────
export function iconSVG(name, cls = '') {
  if (LOCS[name]) return locationSVG(name).replace('<svg ', `<svg class="${cls}" `);
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[name] || ICONS.question}</svg>`;
}

const BG_OF = {
  item: 'item', oneshot: 'oneshot', buff: 'buff', levelup: 'gold', hoard: 'gold', race: 'door', class: 'door',
  curse: 'curse', enhancer: 'enhancer', wandering: 'enhancer', event: 'event', halfbreed: 'special', supermunch: 'special',
};
function bgDeco(k) {
  switch (k) {
    case 'gold': case 'event': {
      let rays = '';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rays += `<path d="M80 58 L${(80 + Math.cos(a - 0.12) * 120).toFixed(1)} ${(58 + Math.sin(a - 0.12) * 120).toFixed(1)} L${(80 + Math.cos(a + 0.12) * 120).toFixed(1)} ${(58 + Math.sin(a + 0.12) * 120).toFixed(1)}Z"/>`; }
      return `<g fill="#fff" opacity=".07">${rays}</g>`;
    }
    case 'curse': return `<g fill="none" stroke="#d9b3ff" stroke-width="3" opacity=".22"><path d="M80 58 m-40 0 a40 40 0 1 1 40 40 a30 30 0 1 1 -30 -30 a20 20 0 1 1 20 20"/></g><g fill="#d9b3ff" opacity=".5"><circle cx="20" cy="22" r="2"/><circle cx="142" cy="30" r="1.6"/><circle cx="132" cy="96" r="2.2"/></g>`;
    case 'enhancer': return `<g fill="#ffb08a" opacity=".16"><path d="M0 120 L30 70 L50 120Z M110 120 L134 64 L160 120Z"/></g><g fill="#ffd27a"><circle cx="20" cy="30" r="1.8"/><circle cx="140" cy="22" r="1.6"/></g>`;
    case 'oneshot': return `<g fill="none" stroke="#8ff0d8" stroke-width="2" opacity=".35"><circle cx="24" cy="30" r="5"/><circle cx="136" cy="40" r="7"/><circle cx="128" cy="90" r="4"/><circle cx="30" cy="92" r="3"/></g>`;
    case 'buff': return `<g fill="#ffb0c8" opacity=".35"><path d="M24 30 q-6 -6 -10 0 q0 6 10 12 q10 -6 10 -12 q-4 -6 -10 0z"/><path d="M136 80 q-4 -4 -7 0 q0 4 7 8 q7 -4 7 -8 q-3 -4 -7 0z"/></g>`;
    case 'dark': return `<ellipse cx="80" cy="64" rx="60" ry="44" fill="#7dff9a" opacity=".08"/><g fill="#7dff9a"><circle cx="22" cy="30" r="1.4" opacity=".6"/><circle cx="140" cy="24" r="1.1" opacity=".5"/><circle cx="132" cy="92" r="1.6" opacity=".45"/><circle cx="28" cy="96" r="1" opacity=".5"/></g>`;
    case 'door': return `<path d="M44 120 V52 Q44 18 80 18 Q116 18 116 52 V120" fill="#0b1220" opacity=".35"/>`;
    case 'pet': return `<g fill="#d6f59a" opacity=".3"><circle cx="24" cy="94" r="5"/><circle cx="16" cy="84" r="2.4"/><circle cx="28" cy="82" r="2.4"/><circle cx="136" cy="30" r="5"/><circle cx="128" cy="20" r="2.4"/><circle cx="140" cy="18" r="2.4"/></g>`;
    default: return `<g fill="#ffd479"><path d="M24 28 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" opacity=".7"/><path d="M136 82 l1.6 3 l3 1.6 l-3 1.6 l-1.6 3 l-1.6 -3 l-3 -1.6 l3 -1.6z" opacity=".6"/><circle cx="130" cy="26" r="1.6" opacity=".6"/></g>`;
  }
}
export function iconScene(key, kind = 'item') {
  return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="120" fill="url(#bg-${kind})"/>${kind === 'dark' ? '' : '<rect width="160" height="120" fill="url(#ht)"/>'}${bgDeco(kind)}<ellipse cx="80" cy="56" rx="54" ry="40" fill="url(#glow)" opacity="${kind === 'dark' ? 0.1 : 0.3}"/><rect width="160" height="120" fill="url(#vig)"/><ellipse cx="80" cy="102" rx="32" ry="6" fill="rgba(0,0,0,.3)"/><g transform="translate(40 16) scale(1.25)">${ICONS[key] || ICONS.question}</g></svg>`;
}
export function cardArt(d, uid = null) {
  if (d.type === 'monster') return monsterSVG(uid || d.id + '#0');
  if (d.type === 'location') return locationSVG(d.art);
  const kind = d.bg || (d.slot === 'pet' ? 'pet' : BG_OF[d.type] || 'item');
  return iconScene(typeof d.art === 'string' ? d.art : 'question', kind);
}

// ───────────── рубашки колод ─────────────
export function cardBackSVG(deck) {
  if (deck === 'treasure') {
    return `<svg viewBox="0 0 60 84" preserveAspectRatio="none" aria-hidden="true"><rect width="60" height="84" fill="${GD}"/><rect x="4" y="4" width="52" height="76" rx="6" fill="none" stroke="#7a4d0a" stroke-width="2" stroke-dasharray="4 3"/><g transform="translate(12 22) scale(.56)">${ICONS.chest}</g><path d="M0 0 L60 84" stroke="#fff" stroke-opacity=".14" stroke-width="18"/></svg>`;
  }
  return `<svg viewBox="0 0 60 84" preserveAspectRatio="none" aria-hidden="true"><rect width="60" height="84" fill="${B}"/><rect x="4" y="4" width="52" height="76" rx="6" fill="none" stroke="#14233d" stroke-width="2" stroke-dasharray="4 3"/><path d="M16 66 V36 Q16 20 30 20 Q44 20 44 36 V66Z" fill="${Br}" ${st2}/><path d="M23 66 V38 M30 66 V22 M37 66 V38" stroke="#55331f" stroke-width="1.6"/><circle cx="39" cy="48" r="2.4" fill="${GD}" ${st2}/><path d="M0 0 L60 84" stroke="#fff" stroke-opacity=".12" stroke-width="18"/></svg>`;
}

// ───────────── аватары: см. art-avatar.js ─────────────
export { avatarSVG };

// ───────────── тексты и рамки карт ─────────────
const TYPE_LABEL = {
  monster: 'Монстр', curse: 'Проклятие', race: 'Раса', class: 'Класс', halfbreed: 'Особое', supermunch: 'Особое',
  enhancer: 'Усилитель', wandering: 'Бродячий', item: 'Вещь', oneshot: 'Разовая', levelup: 'Уровень', hoard: 'Клад',
  location: 'Локация', event: 'Событие', buff: 'Зелье',
};
const SLOT_LABEL = SLOT_NAMES;

export function cardText(d) {
  if (d.type === 'monster') {
    const parts = [];
    if (d.tags?.length) parts.push(`<span class="tags">${d.tags.map(t => `<i>${esc(TAG_NAMES[t] || t)}</i>`).join('')}</span>`);
    (d.vs || []).forEach(v => parts.push(esc(v.text) + '.'));
    (d.vsItem || []).forEach(v => parts.push(esc(v.text) + '.'));
    if (d.text) parts.push(esc(d.text));
    if (d.ambush) parts.push(`<span class="amb"><b>Засада!</b> ${esc(d.ambush.text.replace(/^Засада!\s*/, ''))}</span>`);
    parts.push(`<span class="bad"><b>Расплата:</b> ${esc(d.bad.text)}</span>`);
    return parts.join(' ');
  }
  return esc(ruleText(d.text || ''));
}

function nameClass(n) {
  const longest = Math.max(...n.split(/\s+/).map(w => w.length));
  if (n.length > 24 || longest > 11) return 'xlong';
  if (n.length > 15 || longest > 9) return 'long';
  return '';
}

export function cornerOf(d) {
  if (d.type === 'monster') return d.mirror != null ? { cls: 'lv', v: '?', t: 'Сила зависит от лидера' } : { cls: 'lv', v: d.level, t: 'Уровень монстра' };
  if (d.type === 'oneshot' && d.effect === 'escapeBonus') return { cls: 'run', v: '+' + d.bonus, t: 'К побегу' };
  if ((d.type === 'item' || d.type === 'oneshot' || d.type === 'buff') && d.bonus) return { cls: 'bonus', v: '+' + d.bonus, t: 'Бонус к силе' };
  if (d.type === 'enhancer') return d.double ? { cls: 'lv', v: '×2', t: 'Удваивает монстра' } : { cls: d.bonus > 0 ? 'lv' : 'bonus', v: (d.bonus > 0 ? '+' : '') + d.bonus, t: 'Сила монстра' };
  return null;
}

export function cardHTML(uid, o = {}) {
  const d = def(uid);
  const cls = ['card', d.deck, 't-' + d.type, o.size || 'md'];
  if (d.rarity && d.rarity !== 'common') cls.push('r-' + d.rarity);
  if (d.bg) cls.push('k-' + d.bg);
  if (o.selected) cls.push('selected');
  if (o.playable) cls.push('playable');
  if (o.dim) cls.push('dim');
  if (o.cls) cls.push(o.cls);
  const c = cornerOf(d);
  const corner = c ? `<span class="corner ${c.cls}${String(c.v).length > 2 ? ' wide' : ''}" title="${c.t}">${c.v}</span>` : '';
  let foot = '';
  if (d.type === 'monster') foot = `<span title="Клад за победу"><i class="ico-gem"></i>${d.treasures}</span><span>+${d.levels || 1} ур.</span>`;
  else if (d.type === 'item') foot = `<span>${SLOT_LABEL[d.slot] || ''}${d.hands === 2 ? ' ×2' : d.hands === 3 ? ' ×3' : ''}${d.big ? ' · большая' : ''}</span><span>${d.value ? d.value + ' г' : 'бесценно'}</span>`;
  else if (d.value) foot = `<span>${TYPE_LABEL[d.type]}</span><span>${d.value} г</span>`;
  else foot = `<span>${TYPE_LABEL[d.type]}</span>`;
  const typeTag = d.rarity === 'legendary' ? 'Легенда' : d.type === 'monster' ? (d.tags?.includes('undead') ? 'Нежить' : 'Монстр') : TYPE_LABEL[d.type];
  return `<div class="${cls.join(' ')}" data-uid="${esc(uid)}" ${o.attrs || ''} tabindex="${o.tab === false ? -1 : 0}" role="button" aria-label="${esc(d.name)}">
    <div class="c-name ${nameClass(d.name)}"><span>${esc(d.name)}</span></div>
    <div class="c-art">${cardArt(d, uid)}${corner}<span class="c-type">${typeTag}</span></div>
    <div class="c-text">${cardText(d)}</div>
    <div class="c-foot">${foot}</div>
    <i class="c-glare" aria-hidden="true"></i>
  </div>`;
}

export function chipHTML(uid, o = {}) {
  const d = def(uid);
  const val = d.bonus ? `+${d.bonus}` : d.runBonus ? `бег +${d.runBonus}` : '';
  return `<button class="chip ${o.cls || ''}${d.rarity && d.rarity !== 'common' ? ' r-' + d.rarity : ''}" data-uid="${esc(uid)}" title="${esc(d.name)}">${iconSVG(typeof d.art === 'string' ? d.art : 'question')}<span class="chip-name">${esc(d.name)}</span>${val ? `<b>${val}</b>` : ''}</button>`;
}

export { TYPE_LABEL, SLOT_LABEL, RACE_NAMES, CLASS_NAMES };

if (typeof document !== 'undefined') {
  if (document.body) injectDefs(); else document.addEventListener('DOMContentLoaded', injectDefs);
}
