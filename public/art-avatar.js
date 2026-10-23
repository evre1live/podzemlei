// «Под Землёй» — портрет героя из деталей: кожа, глаза, брови, рот, волосы, борода, шапка, очки, приметы, одежда, фон.
import { AVATAR_PARTS, avatarConfig } from '/shared/avatar.js';

const INK = '#231a26';
const st = (w = 2.4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export const SKIN = [
  ['#ffeedf', '#ffdcc0', '#e6b38f'], ['#fbe3c9', '#f3c9a1', '#d4a078'], ['#f1d1aa', '#e5b588', '#c38c60'], ['#e4b88f', '#d29d70', '#aa7449'],
  ['#cf9a70', '#b97a51', '#8f5532'], ['#ad7650', '#93603d', '#6b4226'], ['#8a5b3c', '#73472d', '#4f2f1b'], ['#644130', '#4e311f', '#331f13'],
];
export const HAIRC = ['#2a2230', '#4a2f22', '#7a4b2c', '#a0472a', '#d9772e', '#e8c15a', '#9aa3ad', '#f1ebe0', '#4a7fc1', '#e86fa1'];
export const CLOTH = ['#f5b83d', '#d2502f', '#3fa38c', '#4a7fc1', '#8f6bc9', '#e86fb1', '#6b8f3c', '#8a5a3c', '#3d3a42', '#efe6d4'];
export const BGC = [null, '#f5b83d', '#3fa38c', '#4a7fc1', '#8f6bc9', '#e86fb1', '#79a83f', '#d2502f', '#2a2230', '#efe6d4'];

// подписи для редактора
export const AV_LABELS = {
  eyes: ['Обычные', 'Довольные', 'Подмигивает', 'Сонные', 'Удивлённые', 'Сердитые', 'Сияющие'],
  brows: ['Без бровей', 'Обычные', 'Густые', 'Поднятые', 'Хмурые'],
  mouth: ['Улыбка', 'Зубастая', 'Хохот', 'Спокойный', 'Язык', 'Ухмылка', 'Удивление', 'Щербинка'],
  hair: ['Лысый', 'Короткая', 'Ёжик', 'Длинные', 'Каре', 'Кудри', 'Ирокез', 'Хвост', 'Косички', 'Афро', 'Чёлка набок', 'Пучок'],
  facial: ['Нет', 'Щетина', 'Усы', 'Усы-завитки', 'Борода', 'Борода мудреца'],
  hat: ['Без шапки', 'Каска шахтёра', 'Кепка', 'Вязаная шапка', 'Колпак мага', 'Корона', 'Капюшон', 'Бандана', 'Цилиндр', 'Рогатый шлем', 'Наушники', 'Венок'],
  glasses: ['Без очков', 'Круглые', 'Квадратные', 'Тёмные', 'Монокль', 'Очки шахтёра'],
  extra: ['Нет', 'Веснушки', 'Румянец', 'Шрам', 'Повязка', 'Серьга', 'Пластырь'],
};

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

// градиенты кожи кладутся в документ один раз (art.js → injectDefs)
export function avatarDefs() {
  return SKIN.map((c, i) => `<radialGradient id="sk-${i}" cx="40%" cy="32%" r="80%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient>`).join('')
    + `<radialGradient id="av-glow" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
}

// ───────────── волосы: задний и передний слой ─────────────
function hairBack(i, c) {
  const f = `fill="${c}" ${st(2.2)}`;
  switch (i) {
    case 3: return `<path d="M27 50 C25 27 38 21 50 21 C62 21 75 27 73 50 L77 88 C66 93 34 93 23 88Z" ${f}/>`;
    case 4: return `<path d="M25 54 C23 27 38 21 50 21 C62 21 77 27 75 54 L76 72 C70 77 63 76 62 70 L62 50 L38 50 L38 70 C37 76 30 77 24 72Z" ${f}/>`;
    case 5: return `<path d="M26 56 C22 26 38 18 50 18 C62 18 78 26 74 56Z" ${f}/>`;
    case 7: return `<path d="M64 33 C86 34 90 62 79 80 C74 66 72 52 62 45Z" ${f}/><circle cx="68" cy="34" r="4" fill="${shade(c, -0.3)}" ${st(1.6)}/>`;
    case 8: return [28, 72].map(x => `<path d="M${x - 4} 50 h8 v34 q-4 6 -8 0z" ${f}/><path d="M${x - 4} 58 h8 M${x - 4} 66 h8 M${x - 4} 74 h8" stroke="${shade(c, -0.35)}" stroke-width="1.4"/><circle cx="${x}" cy="86" r="3" fill="#d2502f" ${st(1.4)}/>`).join('');
    case 9: return `<circle cx="50" cy="40" r="31" ${f}/><g fill="${shade(c, 0.12)}" opacity=".6"><circle cx="34" cy="22" r="5"/><circle cx="62" cy="16" r="4"/><circle cx="74" cy="34" r="4"/></g>`;
    case 11: return `<circle cx="50" cy="17" r="9.5" ${f}/><path d="M43 21 q7 4 14 0" stroke="${shade(c, -0.35)}" stroke-width="1.6" fill="none"/>`;
    default: return '';
  }
}
function hairFront(i, c) {
  const f = `fill="${c}" ${st(2.2)}`;
  const hl = d => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="2.6" stroke-linecap="round"/>`;
  switch (i) {
    case 0: return `<path d="M38 31 q8 -5 16 -3" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 1: return `<path d="M29 48 C28 29 38 23 50 23 C62 23 72 29 71 48 C66 39 58 35 50 35 C42 35 34 39 29 48Z" ${f}/>` + hl('M36 32 q8 -6 18 -5');
    case 2: return `<path d="M29 47 L30 32 L35 36 L37 22 L44 30 L50 17 L56 30 L63 22 L65 36 L70 32 L71 47 C64 39 57 36 50 36 C43 36 36 39 29 47Z" ${f}/>`;
    case 3: return `<path d="M29 47 C30 29 40 24 50 24 C60 24 70 29 71 47 C64 38 56 33 50 33 C44 33 36 38 29 47Z" ${f}/>` + hl('M37 30 q8 -5 16 -3');
    case 4: return `<path d="M28 51 C28 29 40 23 50 23 C60 23 72 29 72 51 L69 51 C67 40 60 34 50 35 C40 34 33 40 31 51Z" ${f}/><path d="M36 38 q14 -6 28 0" stroke="${shade(c, -0.3)}" stroke-width="1.4" fill="none"/>` + hl('M37 29 q8 -4 16 -3');
    case 5: return [[30, 45], [31, 35], [37, 28], [45, 24], [55, 24], [63, 28], [69, 35], [70, 45]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.6" ${f}/>`).join('') + `<path d="M34 40 q16 -8 32 0" fill="${c}"/>`;
    case 6: return `<path d="M44 41 C44 26 47 13 50 8 C53 13 56 26 56 41Z" ${f}/><path d="M30 46 q-2 -10 4 -14 M70 46 q2 -10 -4 -14" stroke="${shade(c, -0.1)}" stroke-width="3" stroke-opacity=".35" fill="none" stroke-linecap="round"/>`;
    case 7: return `<path d="M29 47 C29 30 40 25 50 25 C60 25 71 30 71 47 C65 39 57 35 50 35 C43 35 35 39 29 47Z" ${f}/>` + hl('M37 31 q8 -5 16 -3');
    case 8: return `<path d="M29 47 C29 30 40 24 50 24 C60 24 71 30 71 47 C66 38 56 32 50 33 C44 32 34 38 29 47Z" ${f}/><path d="M50 25 V33" stroke="${shade(c, -0.4)}" stroke-width="1.6"/>`;
    case 9: return `<path d="M29 46 C29 30 40 26 50 26 C60 26 71 30 71 46 C64 40 56 37 50 37 C44 37 36 40 29 46Z" ${f}/>`;
    case 10: return `<path d="M29 49 C27 30 40 22 54 23 C66 24 73 32 71 49 C68 40 62 35 57 34 C50 41 38 45 29 49Z" ${f}/>` + hl('M44 28 q8 -3 16 1');
    case 11: return `<path d="M29 46 C29 31 40 26 50 26 C60 26 71 31 71 46 C64 40 56 37 50 37 C44 37 36 40 29 46Z" ${f}/>` + hl('M38 31 q8 -4 15 -3');
    default: return '';
  }
}

// ───────────── лицо ─────────────
function eyes(i, skinDark) {
  const one = (x, o = {}) => {
    const rx = o.wide ? 4.8 : 3.7, ry = o.wide ? 5.4 : 4.3, ir = o.wide ? 2 : o.big ? 3.3 : 2.6;
    let s = `<ellipse cx="${x}" cy="50" rx="${rx}" ry="${ry}" fill="#fffdf6" ${st(1.8)}/><circle cx="${x}" cy="50.6" r="${ir}" fill="#4a3426"/><circle cx="${x}" cy="50.6" r="${ir * 0.55}" fill="${INK}"/>`;
    s += o.big ? `<path d="M${x - 1.6} 48.2 l.6 1.2 l1.3 .2 l-1 .9 l.3 1.3 l-1.2 -.7 l-1.2 .7 l.3 -1.3 l-1 -.9 l1.3 -.2z" fill="#fff"/>` : `<circle cx="${x - 1}" cy="49.2" r="1" fill="#fff"/>`;
    return s;
  };
  const arc = x => `<path d="M${x - 4} 51 Q${x} 46.5 ${x + 4} 51" fill="none" ${st(2.4)}/>`;
  switch (i) {
    case 1: return arc(42) + arc(58);
    case 2: return one(42) + arc(58);
    case 3: return one(42) + one(58) + [42, 58].map(x => `<path d="M${x - 4.2} 50.2 A4.2 4.4 0 0 1 ${x + 4.2} 50.2 Z" fill="${skinDark}" ${st(1.6)}/>`).join('');
    case 4: return one(42, { wide: true }) + one(58, { wide: true });
    case 5: return one(42) + one(58) + `<path d="M37.5 45.6 L46 47.8 M62.5 45.6 L54 47.8" ${st(2.6)}/>`;
    case 6: return one(42, { big: true }) + one(58, { big: true });
    default: return one(42) + one(58);
  }
}
function brows(i, c) {
  const col = shade(c, -0.25);
  const s = w => `stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"`;
  switch (i) {
    case 1: return `<path d="M37.5 43.5 Q42 40.6 46 42.6 M62.5 43.5 Q58 40.6 54 42.6" ${s(2.2)}/>`;
    case 2: return `<path d="M37 43.6 Q42 40 46.5 42.4 M63 43.6 Q58 40 53.5 42.4" ${s(3.8)}/>`;
    case 3: return `<path d="M37.5 41 Q42 37 46 39.6 M62.5 41 Q58 37 54 39.6" ${s(2.2)}/>`;
    case 4: return `<path d="M37 41.4 L46.5 44.4 M63 41.4 L53.5 44.4" ${s(3)}/>`;
    default: return '';
  }
}
function mouth(i) {
  const d = '#4a1622';
  switch (i) {
    case 1: return `<path d="M42 61 Q50 70 58 61Z" fill="${d}" ${st(1.8)}/><path d="M43.4 61.5 H56.6 L55.6 63.6 H44.4Z" fill="#fffdf6"/>`;
    case 2: return `<path d="M41 60 Q50 75 59 60Z" fill="${d}" ${st(1.8)}/><path d="M45.5 66.5 Q50 63 54.5 66.5 Q50 70.5 45.5 66.5Z" fill="#e46a7a"/>`;
    case 3: return `<path d="M44.5 63.5 H55.5" ${st(2.2)}/>`;
    case 4: return `<path d="M43 61.5 Q50 67.5 57 61.5" fill="none" ${st(2.2)}/><path d="M47 64.4 q3 7 6 0" fill="#e46a7a" ${st(1.4)}/>`;
    case 5: return `<path d="M43.5 63.5 Q51 66.5 57 60.5" fill="none" ${st(2.2)}/>`;
    case 6: return `<ellipse cx="50" cy="64" rx="2.8" ry="3.6" fill="${d}" ${st(1.6)}/>`;
    case 7: return `<path d="M42 61 Q50 70 58 61Z" fill="${d}" ${st(1.8)}/><path d="M43.6 61.5 H48.8 V63.8 H44.3Z M51.2 61.5 H56.4 L55.7 63.8 H51.2Z" fill="#fffdf6"/>`;
    default: return `<path d="M43 61.5 Q50 68 57 61.5" fill="none" ${st(2.3)}/>`;
  }
}
function facial(i, c) {
  const f = `fill="${c}" ${st(1.8)}`;
  const must = `<path d="M40 60 C44 56 48 58 50 59 C52 58 56 56 60 60 C56 62.5 52 61.5 50 60.5 C48 61.5 44 62.5 40 60Z" ${f}/>`;
  switch (i) {
    case 1: return `<g fill="${shade(c, -0.1)}" opacity=".5">${[[36, 62], [39, 66], [43, 69], [47, 70], [53, 70], [57, 69], [61, 66], [64, 62], [41, 63], [59, 63], [50, 71]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('')}</g>`;
    case 2: return must;
    case 3: return `<path d="M41 59.5 C44 56 48 58 50 59 C52 58 56 56 59 59.5 C62 57 64 58 63.5 61 C62 63 60 62 59 61 C55 62.5 52 61.5 50 60.5 C48 61.5 45 62.5 41 61 C40 62 38 63 36.5 61 C36 58 38 57 41 59.5Z" ${f}/>`;
    case 4: return `<path d="M29 52 C29 75 40 84 50 84 C60 84 71 75 71 52 C67 63 61 67.5 50 67.5 C39 67.5 33 63 29 52Z" ${f}/>` + must;
    case 5: return `<path d="M30 54 C30 72 40 78 44 86 C46 92 48 98 50 100 C52 98 54 92 56 86 C60 78 70 72 70 54 C66 63 60 67.5 50 67.5 C40 67.5 34 63 30 54Z" ${f}/><path d="M44 74 q6 6 12 0 M46 84 q4 4 8 0" stroke="${shade(c, -0.3)}" stroke-width="1.4" fill="none"/>` + must;
    default: return '';
  }
}
function extraUnder(i) {
  if (i === 1) return `<g fill="#b8704a" opacity=".55">${[[36, 56], [39, 58], [37, 60], [64, 56], [61, 58], [63, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('')}</g>`;
  if (i === 2 || i === 0) return `<circle cx="36" cy="58" r="4" fill="#ff8f8f" opacity="${i === 2 ? 0.6 : 0.28}"/><circle cx="64" cy="58" r="4" fill="#ff8f8f" opacity="${i === 2 ? 0.6 : 0.28}"/>`;
  return `<circle cx="36" cy="58" r="4" fill="#ff8f8f" opacity=".28"/><circle cx="64" cy="58" r="4" fill="#ff8f8f" opacity=".28"/>`;
}
function extraOver(i) {
  switch (i) {
    case 3: return `<path d="M37 40 L46 58" stroke="#b5554a" stroke-width="2" stroke-linecap="round"/><path d="M38.5 45 l3 -1.5 M40.5 50 l3 -1.5 M42.5 55 l3 -1.5" stroke="#b5554a" stroke-width="1.4" stroke-linecap="round"/>`;
    case 4: return `<path d="M28 41 L72 46" stroke="${INK}" stroke-width="2"/><ellipse cx="58" cy="50" rx="6.4" ry="5.8" fill="#1d1a20" ${st(1.6)}/><path d="M54.5 47.5 q3 -2 6 0" stroke="#fff" stroke-opacity=".3" stroke-width="1.4" fill="none"/>`;
    case 5: return `<circle cx="29.5" cy="60" r="2.6" fill="none" stroke="#f2c14e" stroke-width="2"/><circle cx="29.5" cy="62.6" r="1.4" fill="#d2502f"/>`;
    case 6: return `<g transform="rotate(-18 62 60)"><rect x="56" y="57.5" width="12" height="5" rx="1.8" fill="#f1d9b8" ${st(1.2)}/><rect x="59.5" y="54" width="5" height="12" rx="1.8" fill="#f1d9b8" ${st(1.2)}/></g>`;
    default: return '';
  }
}
function glasses(i) {
  switch (i) {
    case 1: return `<circle cx="42" cy="50" r="6.6" fill="rgba(190,230,255,.22)" ${st(2.2)}/><circle cx="58" cy="50" r="6.6" fill="rgba(190,230,255,.22)" ${st(2.2)}/><path d="M48.6 49.5 h2.8 M35.4 49 L29 47 M64.6 49 L71 47" ${st(2)}/>`;
    case 2: return `<rect x="34.6" y="44.6" width="14.4" height="11" rx="2.4" fill="rgba(190,230,255,.22)" ${st(2.2)}/><rect x="51" y="44.6" width="14.4" height="11" rx="2.4" fill="rgba(190,230,255,.22)" ${st(2.2)}/><path d="M49 49 h2 M34.6 48 L29 47 M65.4 48 L71 47" ${st(2)}/>`;
    case 3: return `<path d="M34 45 H49 Q49 56 42 56 Q34 56 34 45Z M51 45 H66 Q66 56 58 56 Q51 56 51 45Z" fill="#1d1a20" ${st(2)}/><path d="M49 46 h2 M34 46 L29 45 M66 46 L71 45" ${st(2)}/><path d="M36.5 47.5 l4 0 M53.5 47.5 l4 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`;
    case 4: return `<circle cx="58" cy="50" r="6.4" fill="rgba(190,230,255,.22)" stroke="#f2c14e" stroke-width="2.4"/><path d="M63 55 q5 10 -1 22" stroke="#f2c14e" stroke-width="1.3" fill="none"/>`;
    case 5: return `<path d="M28 49 H72" stroke="#3d3a42" stroke-width="5"/><circle cx="42" cy="50" r="7.4" fill="#8fd8e8" stroke="#6b6572" stroke-width="3"/><circle cx="58" cy="50" r="7.4" fill="#8fd8e8" stroke="#6b6572" stroke-width="3"/><circle cx="42" cy="50" r="7.4" fill="none" ${st(1.4)}/><circle cx="58" cy="50" r="7.4" fill="none" ${st(1.4)}/><path d="M38.5 47 l3 -2 M54.5 47 l3 -2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`;
    default: return '';
  }
}
// ───────────── головные уборы ─────────────
function hatBack(i, c) {
  if (i === 6) return `<path d="M19 72 C14 30 29 13 50 13 C71 13 86 30 81 72 L86 100 H14Z" fill="${c}" ${st(2.2)}/>`;
  return '';
}
function hat(i, c) {
  const f = `fill="${c}" ${st(2.2)}`;
  const dk = shade(c, -0.28), lt = shade(c, 0.35);
  switch (i) {
    case 1: return `<path d="M27 41 C27 17 73 17 73 41Z" ${f}/><rect x="22" y="38" width="56" height="7.5" rx="3.7" fill="${dk}" ${st(2)}/><rect x="44" y="21" width="12" height="11" rx="3" fill="#9aa3ad" ${st(1.8)}/><circle cx="50" cy="26.5" r="3.6" fill="#fff6c8" ${st(1.4)}/><path d="M33 33 q2 -10 9 -13" stroke="#fff" stroke-opacity=".45" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case 2: return `<path d="M28 39 C28 19 72 19 72 39Z" ${f}/><path d="M50 37 C64 34 82 36 86 41 C78 45 62 43 50 41Z" fill="${dk}" ${st(2)}/><circle cx="50" cy="20" r="2.2" fill="${dk}" ${st(1.2)}/><path d="M36 32 q4 -8 12 -10" stroke="#fff" stroke-opacity=".4" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 3: return `<path d="M27 42 C26 16 74 16 73 42Z" ${f}/><rect x="25" y="35" width="50" height="9" rx="4" fill="${dk}" ${st(2)}/><path d="M33 35 v9 M39 35 v9 M45 35 v9 M51 35 v9 M57 35 v9 M63 35 v9 M69 35 v9" stroke="${shade(c, -0.45)}" stroke-width="1.2"/><circle cx="50" cy="14" r="6.4" fill="#f1ebe0" ${st(1.8)}/>`;
    case 4: return `<path d="M31 35 L54 -2 L69 35Z" ${f}/><path d="M54 -2 q10 8 18 4" stroke="${INK}" stroke-width="1.8" fill="none"/><ellipse cx="50" cy="35.5" rx="29" ry="6" fill="${dk}" ${st(2)}/><g fill="#fff36b"><path d="M47 18 l1.4 2.8 l3 .4 l-2.2 2 l.6 3 l-2.8 -1.5 l-2.8 1.5 l.6 -3 l-2.2 -2 l3 -.4z"/><circle cx="57" cy="27" r="1.6"/><circle cx="41" cy="29" r="1.2"/></g>`;
    case 5: return `<path d="M31 35 L31 18 L39.5 26 L50 11 L60.5 26 L69 18 L69 35Z" fill="#f2c14e" ${st(2.2)}/><rect x="30" y="31" width="40" height="6" rx="2" fill="#c8922c" ${st(1.8)}/><circle cx="50" cy="24" r="3" fill="${c}" ${st(1.4)}/><circle cx="38" cy="28" r="2" fill="${lt}" ${st(1)}/><circle cx="62" cy="28" r="2" fill="${lt}" ${st(1)}/>`;
    case 6: return `<path d="M25 58 C22 32 35 21 50 21 C65 21 78 32 75 58 C72 41 63 30 50 30 C37 30 28 41 25 58Z" fill="${dk}" ${st(2)}/>`;
    case 7: return `<path d="M28 39 C34 30 66 30 72 39 L72 45 C66 37 34 37 28 45Z" ${f}/><path d="M71 41 L83 36 L80 44 L87 49 L76 46Z" ${f}/><g fill="#fff" opacity=".85"><circle cx="38" cy="37" r="1.3"/><circle cx="46" cy="35" r="1.3"/><circle cx="54" cy="35" r="1.3"/><circle cx="62" cy="37" r="1.3"/></g>`;
    case 8: return `<ellipse cx="50" cy="31" rx="27" ry="5.4" fill="${dk}" ${st(2)}/><rect x="35.5" y="1" width="29" height="30" rx="3" ${f}/><rect x="35.5" y="21" width="29" height="5.5" fill="${lt}" ${st(1.6)}/><path d="M40 6 v12" stroke="#fff" stroke-opacity=".35" stroke-width="2.6" stroke-linecap="round"/>`;
    case 9: return `<path d="M30 32 C17 28 13 15 18 6 C22 17 28 21 37 25Z M70 32 C83 28 87 15 82 6 C78 17 72 21 63 25Z" fill="#f1e6cc" ${st(2)}/><path d="M28 41 C28 18 72 18 72 41Z" fill="#a3acb7" ${st(2.2)}/><rect x="26" y="35" width="48" height="7" rx="3" fill="${c}" ${st(1.8)}/><path d="M50 20 V35" stroke="#5b6470" stroke-width="2"/><g fill="#5b6470"><circle cx="34" cy="38.5" r="1.3"/><circle cx="66" cy="38.5" r="1.3"/></g>`;
    case 10: return `<path d="M27 52 C27 16 73 16 73 52" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M27 52 C27 16 73 16 73 52" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><rect x="20" y="44" width="11" height="18" rx="5" ${f}/><rect x="69" y="44" width="11" height="18" rx="5" ${f}/>`;
    case 11: {
      const pts = [[30, 38], [37, 31], [45, 27], [55, 27], [63, 31], [70, 38]];
      return `<path d="M28 40 C36 26 64 26 72 40" fill="none" stroke="#4f8a3a" stroke-width="3"/>` + pts.map(([x, y], k) => {
        const pc = k % 2 ? '#fff3b0' : c;
        return `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-3.2" rx="2.4" ry="3.4" transform="rotate(${a})" fill="${pc}" ${st(1)}/>`).join('')}<circle r="1.8" fill="#f5b83d"/></g>`;
      }).join('') + `<path d="M33 35 l-4 -3 M67 35 l4 -3" stroke="#4f8a3a" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    default: return '';
  }
}

export function avatarSVG(a, seatColor = '#f5b83d', cls = '') {
  const v = avatarConfig(a);
  const sk = SKIN[v.skin] || SKIN[0];
  const hc = HAIRC[v.hairColor] || HAIRC[0];
  const hatc = CLOTH[v.hatColor] || CLOTH[0];
  const shirt = CLOTH[v.shirt] || CLOTH[3];
  const bg = BGC[v.bg] || seatColor || '#f5b83d';
  const hood = v.hat === 6;
  const neckSh = sk[2];
  return `<svg class="${cls}" viewBox="9 5 82 82" aria-hidden="true">`
    + `<rect width="100" height="100" fill="${shade(bg, -0.25)}"/><circle cx="50" cy="40" r="56" fill="${bg}" opacity=".9"/><rect width="100" height="100" fill="url(#av-glow)"/>`
    + `<g opacity=".18" fill="#fff"><circle cx="16" cy="20" r="2"/><circle cx="84" cy="26" r="1.6"/><circle cx="80" cy="70" r="1.4"/></g>`
    + hatBack(v.hat, hatc)
    + (hood ? '' : hairBack(v.hair, hc))
    + `<path d="M12 101 C14 85 29 80 41 79 L59 79 C71 80 86 85 88 101Z" fill="${shirt}" ${st(2.2)}/><path d="M41 79 L50 90 L59 79" fill="${shade(shirt, -0.25)}" ${st(1.8)}/><path d="M20 92 q4 -7 12 -9" stroke="#fff" stroke-opacity=".3" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    + `<path d="M44 68 H56 V81 Q50 85 44 81Z" fill="${neckSh}" ${st(1.8)}/>`
    + `<ellipse cx="29" cy="53" rx="5" ry="6.4" fill="url(#sk-${v.skin})" ${st(2)}/><ellipse cx="71" cy="53" rx="5" ry="6.4" fill="url(#sk-${v.skin})" ${st(2)}/>`
    + `<ellipse cx="50" cy="50" rx="21.5" ry="23.5" fill="url(#sk-${v.skin})" ${st(2.4)}/>`
    + extraUnder(v.extra)
    + eyes(v.eyes, sk[1]) + brows(v.brows, v.hair === 0 && v.brows ? '#4a2f22' : hc)
    + `<path d="M48.2 55.5 Q50 58.6 51.8 55.5" fill="none" stroke="${sk[2]}" stroke-width="2" stroke-linecap="round"/>`
    + mouth(v.mouth)
    + facial(v.facial, hc)
    + extraOver(v.extra)
    + glasses(v.glasses)
    + (hood ? hairFront(v.hair === 0 ? 0 : Math.min(v.hair, 1), hc) : hairFront(v.hair, hc))
    + hat(v.hat, hatc)
    + `</svg>`;
}

export { AVATAR_PARTS };
