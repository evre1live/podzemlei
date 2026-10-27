// «Под Землёй» — графика карт: рамки по категориям, живописные рисунки (/cards/v1), гравированные значки (icons.js),
// рубашки колод. Пока у карты нет рисунка, показывается старая картинка, нарисованная кодом (art-monsters.js и иконки ниже).
import { def, DEFS, RACE_NAMES, CLASS_NAMES, TAG_NAMES, SLOT_NAMES, ruleText } from '/shared/cards.js';
import { monsterSVG, monsterDefs, INK } from '/art-monsters.js';
import { avatarSVG, avatarDefs } from '/art-avatar.js';
import { ico } from '/icons.js';
import { CARD_IMG } from '/card-art.js';

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
  g += `<linearGradient id="gold-emb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c8"/><stop offset=".38" stop-color="#e6bb62"/><stop offset=".7" stop-color="#94672a"/><stop offset="1" stop-color="#d7a952"/></linearGradient>`;
  g += `<linearGradient id="silver-emb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#c6ced8"/><stop offset=".72" stop-color="#5f6874"/><stop offset="1" stop-color="#aab3be"/></linearGradient>`;
  g += `<radialGradient id="vig" cx="50%" cy="45%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>`;
  g += `<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  g += `<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>`;
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
  shackles: `<ellipse cx="19.0" cy="27.0" rx="4.6" ry="3" transform="rotate(-64 19.0 27.0)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="19.0" cy="27.0" rx="4.6" ry="3" transform="rotate(-64 19.0 27.0)" fill="none" stroke="#9aa3b0" stroke-width="2"/><ellipse cx="23.3" cy="18.5" rx="4.6" ry="3" transform="rotate(29 23.3 18.5)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="23.3" cy="18.5" rx="4.6" ry="3" transform="rotate(29 23.3 18.5)" fill="none" stroke="#9aa3b0" stroke-width="2"/><ellipse cx="27.7" cy="12.3" rx="4.6" ry="3" transform="rotate(-46 27.7 12.3)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="27.7" cy="12.3" rx="4.6" ry="3" transform="rotate(-46 27.7 12.3)" fill="none" stroke="#9aa3b0" stroke-width="2"/><ellipse cx="32.0" cy="10.0" rx="4.6" ry="3" transform="rotate(90 32.0 10.0)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="32.0" cy="10.0" rx="4.6" ry="3" transform="rotate(90 32.0 10.0)" fill="none" stroke="#9aa3b0" stroke-width="2"/><ellipse cx="36.3" cy="12.3" rx="4.6" ry="3" transform="rotate(46 36.3 12.3)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="36.3" cy="12.3" rx="4.6" ry="3" transform="rotate(46 36.3 12.3)" fill="none" stroke="#9aa3b0" stroke-width="2"/><ellipse cx="40.7" cy="18.5" rx="4.6" ry="3" transform="rotate(151 40.7 18.5)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="40.7" cy="18.5" rx="4.6" ry="3" transform="rotate(151 40.7 18.5)" fill="none" stroke="#9aa3b0" stroke-width="2"/><ellipse cx="45.0" cy="27.0" rx="4.6" ry="3" transform="rotate(64 45.0 27.0)" fill="none" stroke="${INK}" stroke-width="4.6"/><ellipse cx="45.0" cy="27.0" rx="4.6" ry="3" transform="rotate(64 45.0 27.0)" fill="none" stroke="#9aa3b0" stroke-width="2"/><circle cx="19" cy="42" r="12.5" fill="none" stroke="${INK}" stroke-width="10"/><circle cx="19" cy="42" r="12.5" fill="none" stroke="#a9b2be" stroke-width="6"/><path d="M10 34 a12 12 0 0 1 9 -4.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="29.5" r="3.4" fill="#7b8592" ${st2}/><circle cx="45" cy="42" r="12.5" fill="none" stroke="${INK}" stroke-width="10"/><circle cx="45" cy="42" r="12.5" fill="none" stroke="#a9b2be" stroke-width="6"/><path d="M36 34 a12 12 0 0 1 9 -4.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/><circle cx="45" cy="29.5" r="3.4" fill="#7b8592" ${st2}/><rect x="11" y="49" width="16" height="11" rx="2.5" fill="#6b7480" ${st2}/><rect x="37" y="49" width="16" height="11" rx="2.5" fill="#6b7480" ${st2}/><path d="M19 52.5 v4 M45 52.5 v4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><circle cx="19" cy="52.5" r="1.8" fill="${INK}"/><circle cx="45" cy="52.5" r="1.8" fill="${INK}"/>`,
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

// ───────────── локации: живописные сцены ─────────────
// Картинки лежат в /loc/v2: <ключ>.webp — фон стола 1920 px, <ключ>@4k.webp — он же в 4K, <ключ>-card.webp — кадр для карты.
export const LOC_IMG = new Set(['loc_tavern', 'loc_dungeon', 'loc_glade', 'loc_forge', 'loc_ice', 'loc_graveyard', 'loc_sky', 'loc_cove', 'loc_library', 'loc_oasis', 'loc_flooded', 'loc_grove', 'loc_koschei']);
export const locImg = (key, card = true) => `/loc/v2/${LOC_IMG.has(key) ? key : 'loc_tavern'}${card ? '-card' : ''}.webp`;
export function locationSVG(key) {
  // у новой локации без картины — гравированный знак на тёмной патине
  if (!LOC_IMG.has(key)) return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="lg-${key}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2c4a40"/><stop offset="1" stop-color="#0a1411"/></radialGradient></defs><rect width="160" height="120" fill="url(#lg-${key})"/><g transform="translate(52 32) scale(.109)" fill="#cfe9dd" opacity=".9">${ICON_PATH(ICON_OF[key] || 'stone-tower')}</g></svg>`;
  return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="${locImg(key)}" width="160" height="120" preserveAspectRatio="xMidYMid slice"/></svg>`;
}

// ───────────── иконки и арт карт ─────────────
// старые ключи рисунков → гравированные значки (game-icons.net, CC BY 3.0)
const ART2ICON = {
  chest: 'chest', amulet: 'padlock', crown: 'crown', elf: 'elf-ear', dwarf: 'dwarf-face', halfling: 'barefoot', orc: 'orc-head', goblin: 'goblin-head',
  molefolk: 'mole', warrior: 'crossed-swords', mage: 'pointy-hat', cleric: 'holy-symbol', rogue: 'cloak-dagger', bard: 'lyre', alchemist: 'round-bottom-flask',
  engineer: 'gear-hammer', witcher: 'crossed-sabres', warlock: 'warlock-hood', mix: 'yin-yang', badge: 'double-face-mask', human: 'person',
};
export function iconSVG(name, cls = '') {
  if (ART2ICON[name]) return ico(ART2ICON[name], cls);
  if (LOC_IMG.has(name)) return locationSVG(name).replace('<svg ', `<svg class="${cls}" `);
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[name] || ICONS.question}</svg>`;
}

const BG_OF = {
  item: 'item', oneshot: 'oneshot', buff: 'buff', levelup: 'gold', hoard: 'gold', jackpot: 'gold', race: 'door', class: 'door',
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
// значок в медальоне карты: по самой карте, иначе по её виду
const ICON_OF = {
  m_slime: 'slime', m_floorboard: 'claw-slashes', m_mold: 'cheese-wedge', m_moth: 'butterfly', m_mosquito: 'fly', m_roach: 'beetle-shell', m_mole: 'mole', m_leech: 'leeching-worm',
  m_turnstile: 'security-gate', m_ninjamole: 'running-ninja', m_beggar: 'cloak', m_robovac: 'vintage-robot', m_duck: 'duck', m_gossip: 'dripping-stone', m_mycel: 'mushrooms-cluster',
  m_hypno: 'mushroom-gills', m_ratunion: 'rat', m_lasttrain: 'subway-train', m_inspector: 'skeleton', m_slug: 'slime', m_cart: 'mine-wagon', m_batchoir: 'bat', m_watchman: 'lantern-flame',
  m_dj: 'rat', m_plumber: 'monkey-wrench', m_banshee: 'floating-ghost', m_cashier: 'coins', m_zhek: 'archive-register', m_minotaur: 'minotaur', m_endless: 'earth-worm',
  m_salamander: 'salamander', m_spider: 'spider-web', m_croc: 'croc-jaws', m_paranoid: 'gas-mask', m_golem: 'rock-golem', m_worm: 'earth-worm', m_ghostdriver: 'ghost',
  m_excavator: 'mine-truck', m_mirror: 'mirror-mirror', m_concrete: 'golem-head', m_vampire: 'vampire-dracula', m_heatpipe: 'snake', m_lich: 'crowned-skull', m_moldking: 'mushrooms',
  m_ratqueen: 'rat', m_troll: 'troll', m_cricket: 'insect-jaws', m_dragon: 'dragon-head', m_pit: 'spiky-pit', m_philosopher: 'stone-bust', m_molekron: 'mole', m_gorynych: 'dragon-breath',
  m_kolobok: 'bread', m_kikimora: 'frog', m_likho: 'eyeball', m_mimic: 'mimic-chest', m_medusa: 'medusa-head', m_leshy: 'holy-oak', m_cyclops: 'cyclops', m_solovey: 'whistle',
  m_koschei: 'crowned-skull', m_griffin: 'griffin-symbol', m_vodyanoy: 'frog', m_genie: 'magic-lamp', m_babayaga: 'witch-flight', m_basilisk: 'snake-tongue', m_cerberus: 'wolf-head',
  m_manticore: 'scorpion-tail', m_hydra: 'hydra', m_kraken: 'kraken-tentacle', m_lucifer: 'daemon-skull', m_hades: 'horned-skull', m_anubis: 'anubis',
  m_rusteater: 'rusty-sword', m_viy: 'eyeball', m_chudo: 'hydra', m_ghosttrain: 'subway-train', m_ratking: 'rat', m_swarm: 'fly', m_mimicdoor: 'door',
  m_midnight: 'floating-ghost', m_bannik: 'water-drop', m_morena: 'snowflake-1', m_chernobog: 'daemon-skull',
  i_ares: 'crested-helmet', i_epochboots: 'boots', i_excalibur: 'broadsword', i_overalls: 'breastplate', i_kingmail: 'breastplate', i_kingcrown: 'crown', i_kinghammer: 'war-pick',
  i_gasmask: 'gas-mask', i_canary: 'mining-helmet', i_ushanka: 'crested-helmet', i_ratcloak: 'cloak', i_firesuit: 'fire-extinguisher', i_trays: 'breastplate',
  i_rollers: 'running-shoe', i_valenki: 'boots', i_waders: 'rubber-boot', i_samovar: 'flame', i_turnshield: 'security-gate', i_kladenets: 'broadsword',
  p_raven: 'all-seeing-eye', p_owl: 'paw-print',
  t_tripwire: 'tripwire', t_pit: 'spiky-pit', t_net: 'fishing-net', t_gas: 'poison-gas', t_rocks: 'falling-rocks', t_plate: 'mantrap',
  a_porter: 'backpack', a_guide: 'walking-scout', a_merc: 'swordman', d_duel: 'gauntlet',
  ev_shift: 'cycle', ev_union: 'vote', ev_flood: 'big-wave', loc_flooded: 'flood', loc_grove: 'mushroom-house', loc_koschei: 'crowned-skull',
  k_draft: 'whirlwind', k_cavein: 'stone-pile', k_puddle: 'water-drop', k_rust: 'rusty-sword', k_rusthands: 'rusty-sword', k_tax: 'coins', k_fever: 'heart-minus', k_amnesia: 'brain',
  k_fired: 'cross-mark', k_pickpocket: 'robber-hand', k_klepto: 'robber-hand', k_flu: 'snowflake-1', k_backpack: 'knapsack', k_jinx: 'evil-eyes',
  e_seasoned: 'upgrade', e_armored: 'armor-upgrade', e_hungry: 'sharp-smile', e_pack: 'two-shadows', e_rabid: 'fanged-skull', e_morning: 'alarm-clock', e_baby: 'egg-clutch',
  e_decrepit: 'hourglass', e_cold: 'snowflake-1', w_wandering: 'evil-eyes',
  ev_quake: 'earth-crack', ev_light: 'sunbeams', ev_fair: 'shop', ev_draft: 'whirlwind', ev_rollcall: 'scroll-unfurled', ev_luxtax: 'coins',
  i_helmet: 'mining-helmet', i_headlamp: 'mining-helmet', i_hardlamp: 'mining-helmet', i_barrel: 'crested-helmet', i_crown: 'crown', i_quilt: 'breastplate', i_tokens: 'breastplate',
  i_diver: 'diving-helmet', i_godarmor: 'breastplate', i_robe: 'robe', i_boots: 'rubber-boot', i_runners: 'running-shoe', i_slippers: 'boot-prints', i_shovel: 'spade', i_pick: 'war-pick',
  i_jackhammer: 'drill', i_drill: 'drill', i_hatch: 'round-shield', i_stapler: 'crossbow', i_censer: 'incense', i_lute: 'lyre', i_rail: 'broadsword', i_staff: 'wizard-staff', i_bow: 'bow-arrow',
  i_knuckles: 'mailed-fist', i_claws: 'claws', i_crowbar: 'crowbar', i_wrench: 'monkey-wrench', i_extinguisher: 'fire-extinguisher', i_trap: 'wolf-trap', i_flashlight: 'flashlight',
  i_taser: 'electric', i_ladle: 'ladle', i_charm: 'clover', i_flasks: 'fizzing-flask', i_sack: 'swap-bag', i_trolley: 'mine-wagon', i_ring: 'diamond-ring',
  p_rat: 'rat', p_firefly: 'lantern', p_hamster: 'paw-print', p_golddragon: 'dragon-head', p_cat: 'cat', p_roach: 'horse-head',
  o_pickles: 'mushrooms', o_kvass: 'beer-stein', o_shawarma: 'meat', o_cola: 'soda-can', o_firecracker: 'firework-rocket', o_holywater: 'holy-water', o_rope: 'grapple',
  o_smoke: 'smoke-bomb', o_petrify: 'scroll-unfurled', o_slave: 'handcuffs', o_ward: 'stone-sphere',
  b_courage: 'standing-potion', b_energy: 'soda-can', b_pies: 'bread',
  l_stash: 'two-coins', l_bribe: 'coins', l_manual: 'open-book', l_sleep: 'night-sleep', l_exam: 'graduate-cap', l_friend: 'shaking-hands', l_map: 'treasure-map', l_bonus: 'coins-pile',
  l_shortcut: 'path-distance', h_hoard: 'open-treasure-chest', g_atlantis: 'trident', k_farewell: 'tombstone',
  r_elf: 'elf-ear', r_dwarf: 'dwarf-face', r_halfling: 'barefoot', r_orc: 'orc-head', r_goblin: 'goblin-head', r_mole: 'mole',
  c_warrior: 'crossed-swords', c_mage: 'pointy-hat', c_cleric: 'holy-symbol', c_rogue: 'cloak-dagger', c_bard: 'lyre', c_alchemist: 'round-bottom-flask', c_engineer: 'gear-hammer',
  c_witcher: 'crossed-sabres', c_warlock: 'warlock-hood', x_halfbreed: 'yin-yang', x_super: 'double-face-mask',
};
const ICON_OF_TYPE = { monster: 'claw-slashes', curse: 'cursed-star', enhancer: 'upgrade', wandering: 'evil-eyes', event: 'sunbeams', location: 'stone-tower', item: 'broadsword',
  oneshot: 'fizzing-flask', buff: 'standing-potion', levelup: 'upgrade', hoard: 'open-treasure-chest', race: 'person', class: 'crossed-swords', halfbreed: 'yin-yang', supermunch: 'double-face-mask',
  ally: 'person', trap: 'wolf-trap', duel: 'gauntlet' };
export function cardIcon(d) {
  return ICON_OF[d.id] || (d.boss ? 'horned-skull' : d.tags?.includes('undead') ? 'skull-crossed-bones' : ICON_OF_TYPE[d.type] || 'cursed-star');
}
// у карты есть живописный рисунок?
export const hasCardImg = id => CARD_IMG.has(id);
export const cardImgUrl = id => `/cards/v1/${id}.webp?v=${CARD_IMG.get(id)}`;
export function cardArt(d, uid = null) {
  if (CARD_IMG.has(d.id)) return `<img class="c-img" src="${cardImgUrl(d.id)}" alt="" loading="lazy" decoding="async" draggable="false">`;
  if (d.type === 'location' && LOC_IMG.has(d.art)) return locationSVG(d.art);
  // пока нет живописи — гравированная золотая эмблема на тёмном фоне в цвете категории
  return `<div class="emb">${ico(cardIcon(d), 'emb-ico')}</div>`;
}
// значок категории для медальона (у карт с эмблемой вместо рисунка — чтобы не повторять большой знак)
export function kindIcon(d) {
  if (d.boss) return 'horned-skull';
  if (d.type === 'monster') { const t = d.tags || []; return t.includes('undead') ? 'skull-crossed-bones' : t.includes('rat') ? 'rat' : t.includes('fungus') ? 'mushroom-gills' : t.includes('insect') ? 'beetle-shell' : t.includes('water') ? 'wave-crest' : t.includes('fire') ? 'flame' : t.includes('rock') ? 'stone-block' : t.includes('metro') ? 'subway-train' : t.includes('machine') ? 'vintage-robot' : t.includes('beast') ? 'wolf-head' : 'claw-slashes'; }
  if (d.type === 'item') return { head: 'crested-helmet', armor: 'breastplate', feet: 'boots', hand: 'broadsword', pet: 'paw-print' }[d.slot] || 'diamond-ring';
  if (d.type === 'race') return 'person';
  if (d.type === 'class') return 'crossed-swords';
  return ICON_OF_TYPE[d.type] || 'cursed-star';
}

// ───────────── рубашки колод ─────────────
// тёмный металл с золотой каймой и гравированным знаком колоды; если есть живописная рубашка — она под рамкой
export function cardBackSVG(deck) {
  const tr = deck === 'treasure';
  const id = tr ? 'back_treasure' : 'back_door';
  const art = CARD_IMG.has(id) ? `<image href="${cardImgUrl(id)}" x="0" y="0" width="60" height="84" preserveAspectRatio="xMidYMid slice"/>` : '';
  const c1 = tr ? '#4a3a24' : '#2a2c32', c2 = tr ? '#16110a' : '#0b0c0f', gem = tr ? '#d9a83a' : '#5b8fd0';
  const path = ICON_PATH(tr ? 'open-treasure-chest' : 'dungeon-gate');
  return `<svg viewBox="0 0 60 84" preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id="bk-${deck}" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
    <rect width="60" height="84" fill="url(#bk-${deck})"/>${art}
    <rect x="2.5" y="2.5" width="55" height="79" rx="3" fill="none" stroke="#c9c6c0" stroke-opacity=".55" stroke-width=".8"/>
    <rect x="4.5" y="4.5" width="51" height="75" rx="2" fill="none" stroke="#000" stroke-opacity=".6" stroke-width=".8"/>
    ${art ? '' : `<path d="M30 14 L33 20 L30 26 L27 20Z M30 58 L33 64 L30 70 L27 64Z" fill="#c9c6c0" opacity=".55"/>
    <circle cx="30" cy="42" r="13" fill="#0c0c0e" stroke="#c9c6c0" stroke-opacity=".8" stroke-width="1.1"/>
    <g transform="translate(22.5 34.5) scale(.0293)" fill="${tr ? '#e2c27e' : '#dcd9d3'}">${path}</g>`}
    ${[[6, 6], [54, 6], [6, 78], [54, 78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${gem}" stroke="#000" stroke-width=".5"/>`).join('')}
  </svg>`;
}
const ICON_PATH = name => { const m = ico(name).match(/<path[^>]*>/); return m ? m[0].replace(' fill="currentColor"', '') : ''; };

// ───────────── аватары: см. art-avatar.js ─────────────
export { avatarSVG };

// ───────────── тексты и рамки карт ─────────────
const TYPE_LABEL = {
  monster: 'Монстр', curse: 'Проклятие', race: 'Раса', class: 'Класс', halfbreed: 'Особое', supermunch: 'Особое',
  enhancer: 'Усилитель', wandering: 'Бродячий', item: 'Вещь', oneshot: 'Разовая', levelup: 'Уровень', hoard: 'Клад', jackpot: 'Сокровище',
  location: 'Локация', event: 'Событие', buff: 'Зелье', ally: 'Спутник', trap: 'Ловушка', duel: 'Вызов',
};
const SLOT_LABEL = SLOT_NAMES;

export function cardText(d) {
  // у босса главное — расплата: она идёт первой, чтобы читалась и на маленькой карте
  if (d.boss) return `<span class="bad"><b>Расплата:</b> ${esc(d.bad.text)}</span> ${esc(d.text)}`;
  if (d.type === 'monster') {
    const parts = [];
    const chips = (d.tags || []).map(t => `<i>${esc(TAG_NAMES[t] || t)}</i>`);
    if (d.levelOnly) chips.push('<i class="lo" title="Вещи, зелья и способности не помогают">только уровень</i>');
    if (d.noHelp) chips.push('<i class="nh" title="Позвать на помощь нельзя">без помощи</i>');
    if (chips.length) parts.push(`<span class="tags">${chips.join(' ')}</span>`);
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
  if (d.boss) return { cls: 'lv hell', v: d.level, t: 'Уровень босса — 666, а сила — вдвое больше силы героя' };
  if (d.type === 'monster') return d.mirror != null ? { cls: 'lv', v: '?', t: 'Сила зависит от лидера' } : { cls: 'lv', v: d.level, t: 'Уровень монстра' };
  if (d.type === 'oneshot' && d.effect === 'escapeBonus') return { cls: 'run', v: '+' + d.bonus, t: 'К побегу' };
  if ((d.type === 'item' || d.type === 'oneshot' || d.type === 'buff' || d.type === 'ally') && d.bonus) return { cls: 'bonus', v: '+' + d.bonus, t: 'Бонус к силе' };
  if (d.type === 'ally' && d.runBonus) return { cls: 'run', v: '+' + d.runBonus, t: 'К побегу' };
  if (d.type === 'ally' && d.handBonus) return { cls: 'bonus', v: '+' + d.handBonus, t: 'К пределу руки' };
  if (d.type === 'enhancer') return d.double ? { cls: 'lv', v: '×2', t: 'Удваивает монстра' } : { cls: d.bonus > 0 ? 'lv' : 'bonus', v: (d.bonus > 0 ? '+' : '') + d.bonus, t: 'Сила монстра' };
  return null;
}

// легендарная карта: бегущий по кромке свет, золотое сияние и мерцающие искры (у дракона — угольки)
const LEG_AURA = `<i class="c-aura" aria-hidden="true">${[[9, 16], [88, 9], [91, 54], [10, 60], [52, 5], [72, 90], [24, 92], [56, 46]]
  .map(([x, y], i) => `<b style="--x:${x}%;--y:${y}%;--d:-${(i * 0.43).toFixed(2)}s;--e:${(i * 11 + 7) % 90 + 5}%"></b>`).join('')}</i>`;

export function cardHTML(uid, o = {}) {
  const d = def(uid);
  const cls = ['card', d.deck, 't-' + d.type, o.size || 'md'];
  if (d.rarity && d.rarity !== 'common') cls.push('r-' + d.rarity);
  if (d.bg) cls.push('k-' + d.bg);
  if (d.boss) cls.push('boss');
  if (d.id === 'p_golddragon') cls.push('k-dragon');
  if (d.type === 'item' && d.slot === 'pet') cls.push('pet');
  if (d.type === 'enhancer' && d.bonus < 0) cls.push('weak');
  if (CARD_IMG.has(d.id) || (d.type === 'location' && LOC_IMG.has(d.art))) cls.push('painted');
  if (o.selected) cls.push('selected');
  if (o.playable) cls.push('playable');
  if (o.dim) cls.push('dim');
  if (o.cls) cls.push(o.cls);
  const c = cornerOf(d);
  const corner = c ? `<span class="corner ${c.cls}${String(c.v).length > 2 ? ' wide' : ''}" title="${c.t}">${c.v}</span>` : '';
  // нижняя планка: слева — что даёт карта, по центру — её вид, справа — цена или уровни
  let fl = '', fr = '', label;
  if (d.boss) { label = 'Босс'; fl = `<span title="Сила босса — вдвое больше силы героя">сила ×2</span>`; fr = `<span title="Клад и уровни за победу"><i class="ico-gem"></i>${d.treasures} · +${d.levels}</span>`; }
  else if (d.type === 'monster') { label = d.tags?.includes('undead') ? 'Нежить' : 'Монстр'; fl = `<span title="Клад за победу"><i class="ico-gem"></i>${d.treasures}</span>`; fr = `<span title="Уровни за победу">+${d.levels || 1} ур.</span>`; }
  else if (d.type === 'item') {
    label = d.slot === 'pet' ? 'Питомец' : (SLOT_LABEL[d.slot] || 'Шмотка') + (d.hands === 2 ? ' ×2' : d.hands === 3 ? ' ×3' : '');
    fl = d.big ? '<span title="Большая вещь">больш.</span>' : '';
    fr = `<span>${d.value ? d.value + ' г' : 'бесценно'}</span>`;
  } else { label = d.rarity === 'legendary' ? 'Легенда' : TYPE_LABEL[d.type]; if (d.value) fr = `<span>${d.value} г</span>`; }
  const big = o.size === 'lg';
  return `<div class="${cls.join(' ')}" data-uid="${esc(uid)}" ${o.attrs || ''} tabindex="${o.tab === false ? -1 : 0}" role="button" aria-label="${esc(d.name)}">
    <div class="c-name ${nameClass(d.name)}"><span>${esc(d.name)}</span></div>
    <div class="c-art"><div class="c-pic">${cardArt(d, uid)}</div>${corner}<i class="c-medal" title="${esc(label)}">${ico(CARD_IMG.has(d.id) || (d.type === 'location' && LOC_IMG.has(d.art)) ? cardIcon(d) : kindIcon(d))}</i></div>
    <div class="c-text">${cardText(d)}</div>
    <div class="c-foot"><span class="fl">${fl}</span><b class="fc">${esc(label)}</b><span class="fr">${fr}</span></div>
    <i class="c-orn" aria-hidden="true"></i>
    ${d.rarity === 'legendary' ? LEG_AURA : ''}<i class="c-glare" aria-hidden="true"></i>
  </div>`;
}

export function chipHTML(uid, o = {}) {
  const d = def(uid);
  const val = d.bonus ? `+${d.bonus}` : d.runBonus ? `бег +${d.runBonus}` : '';
  return `<button class="chip ${o.cls || ''}${d.rarity && d.rarity !== 'common' ? ' r-' + d.rarity : ''}" data-uid="${esc(uid)}" title="${esc(d.name)}">${ico(cardIcon(d), 'chip-ico')}<span class="chip-name">${esc(d.name)}</span>${val ? `<b>${val}</b>` : ''}</button>`;
}

export { TYPE_LABEL, SLOT_LABEL, RACE_NAMES, CLASS_NAMES };

if (typeof document !== 'undefined') {
  if (document.body) injectDefs(); else document.addEventListener('DOMContentLoaded', injectDefs);
}
