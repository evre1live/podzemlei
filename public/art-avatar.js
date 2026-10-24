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
  hair: ['Лысый', 'Короткая', 'Ёжик', 'Длинные', 'Каре', 'Кудри', 'Ирокез', 'Хвост', 'Косички', 'Афро', 'Чёлка набок', 'Пучок',
    'Локоны', 'Два хвостика', 'Боб с чёлкой', 'Зализанные', 'Растрёпанные', 'Высокий хвост', 'Дреды', 'Кок'],
  gender: ['Мужчина', 'Женщина'],
  body: ['Обычный', 'Худой', 'Крепкий', 'Толстый'],
  outfit: ['Футболка', 'Рубашка', 'Худи', 'Свитер', 'Кожанка', 'Костюм с галстуком', 'Жилет шахтёра', 'Доспехи', 'Мантия мага', 'Плащ путника'],
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
    case 12: return `<path d="M27 48 C24 26 38 20 50 20 C62 20 76 26 73 48 C77 56 72 62 77 70 C80 78 74 84 77 92 C66 97 34 97 23 92 C26 84 20 78 23 70 C28 62 23 56 27 48Z" ${f}/><path d="M28 70 q4 6 0 12 M72 70 q-4 6 0 12" stroke="${shade(c, -0.3)}" stroke-width="1.6" fill="none"/>`;
    case 13: return [[22, -1], [78, 1]].map(([x, k]) => `<path d="M${x + 6 * k} 38 C${x - 10 * k} 40 ${x - 12 * k} 58 ${x - 4 * k} 70 C${x + 2 * k} 62 ${x + 4 * k} 52 ${x + 10 * k} 46Z" ${f}/><circle cx="${x + 7 * k}" cy="40" r="3.6" fill="#e86fa1" ${st(1.6)}/>`).join('');
    case 14: return `<path d="M26 52 C24 27 38 21 50 21 C62 21 76 27 74 52 L74 66 C70 71 64 70 62 64 L62 50 L38 50 L38 64 C36 70 30 71 26 66Z" ${f}/>`;
    case 17: return `<path d="M54 19 C74 6 92 26 84 56 C82 68 76 76 72 82 C74 66 74 50 66 38 C62 30 58 26 54 24Z" ${f}/><path d="M62 30 q12 10 12 30" stroke="${shade(c, -0.3)}" stroke-width="1.6" fill="none"/><rect x="51" y="15" width="8" height="7" rx="3" fill="#e86fa1" ${st(1.6)} transform="rotate(-30 55 18)"/>`;
    case 18: return [24, 30, 36, 64, 70, 76].map((x, k) => `<rect x="${x - 3}" y="${40 + (k % 3) * 2}" width="6.4" height="${38 + (k % 2) * 8}" rx="3.2" fill="${c}" ${st(1.8)}/><path d="M${x - 3} ${56 + (k % 3) * 3} h6.4 M${x - 3} ${66 + (k % 3) * 3} h6.4" stroke="${shade(c, -0.35)}" stroke-width="1.2"/>`).join('');
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
    case 12: return `<path d="M28 52 C26 29 40 22 52 23 C64 24 74 31 72 52 C70 44 66 38 60 36 C56 42 44 38 40 34 C35 39 31 45 28 52Z" ${f}/>` + hl('M40 29 q9 -4 18 -1');
    case 13: return `<path d="M29 46 C29 30 40 25 50 25 C60 25 71 30 71 46 C65 39 57 35 50 35 C43 35 35 39 29 46Z" ${f}/><path d="M50 25 V35" stroke="${shade(c, -0.4)}" stroke-width="1.6"/>` + hl('M37 31 q7 -5 12 -4');
    case 14: return `<path d="M28 50 C27 29 40 23 50 23 C60 23 73 29 72 50 L70 50 C70 45 69 43 67 42 L33 42 C31 43 30 45 30 50Z" ${f}/><path d="M33 42 V37 M39 42 V36 M45 42 V35.5 M51 42 V35.5 M57 42 V36 M63 42 V37" stroke="${shade(c, -0.3)}" stroke-width="1.3"/>` + hl('M37 28 q8 -4 16 -3');
    case 15: return `<path d="M29 46 C28 29 40 23 50 23 C60 23 72 29 71 46 C68 38 62 33 50 32.5 C38 33 32 38 29 46Z" ${f}/><path d="M36 33 q14 -9 30 -2 M38 29 q12 -6 25 -2 M41 26 q9 -3 18 0" stroke="${shade(c, 0.25)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    case 16: return `<path d="M29 48 L26 38 L33 39 L30 28 L38 32 L39 20 L46 28 L51 17 L55 28 L63 19 L63 32 L71 27 L68 38 L75 38 L71 48 C64 40 57 36 50 36 C43 36 36 40 29 48Z" ${f}/>`;
    case 17: return `<path d="M29 46 C29 30 40 24 50 24 C60 24 71 30 71 46 C66 39 58 34 50 34 C42 34 34 39 29 46Z" ${f}/><path d="M36 37 q8 -8 18 -10 M44 36 q8 -6 16 -6" stroke="${shade(c, -0.25)}" stroke-width="1.3" fill="none"/>` + hl('M37 30 q8 -5 15 -4');
    case 18: return `<path d="M29 46 C29 30 40 25 50 25 C60 25 71 30 71 46 C65 39 57 36 50 36 C43 36 35 39 29 46Z" ${f}/>` + [33, 41, 50, 59, 67].map(x => `<circle cx="${x}" cy="${x === 50 ? 35.5 : x === 41 || x === 59 ? 36.5 : 39}" r="3.2" fill="${shade(c, 0.08)}" ${st(1.4)}/>`).join('');
    case 19: return `<path d="M29 47 C28 34 33 26 40 22 C44 12 62 8 70 16 C76 22 72 30 66 31 C70 36 71 41 71 47 C66 40 58 35 50 35 C42 35 34 40 29 47Z" ${f}/>` + hl('M44 17 q10 -6 20 0');
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
function lashes(i) {
  const w = i === 4 ? 1.1 : 0;
  const openL = `<path d="M${38.4 - w} 47.4 l-2.6 -1.8 M${38 - w} 49.4 l-2.9 -0.6" ${st(1.5)}/>`;
  const openR = `<path d="M${61.6 + w} 47.4 l2.6 -1.8 M${62 + w} 49.4 l2.9 -0.6" ${st(1.5)}/>`;
  const shutL = `<path d="M37.8 50.6 l-2.5 -1.3" ${st(1.6)}/>`, shutR = `<path d="M62.2 50.6 l2.5 -1.3" ${st(1.6)}/>`;
  if (i === 1) return shutL + shutR;
  if (i === 2) return openL + shutR;
  return openL + openR;
}
function lips(i) {
  if (![0, 3, 5].includes(i)) return '';
  return `<path d="M44.5 ${i === 3 ? 64.6 : 64.2} Q50 ${i === 3 ? 66.8 : 67.4} 55.5 ${i === 3 ? 64.6 : 64.2}" stroke="#d9637a" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".75"/>`;
}
function brows(i, c, thin = false) {
  const col = shade(c, -0.25);
  const s = w => `stroke="${col}" stroke-width="${thin ? w * 0.72 : w}" fill="none" stroke-linecap="round"`;
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
// ───────────── телосложение ─────────────
// плечи: L — край внизу, NL — край у шеи, y — высота плеч; голова слегка растягивается по ширине
const BUILD = {
  m: [{ L: 12, NL: 41, y: 79, neck: 6 }, { L: 19, NL: 43, y: 80.5, neck: 4.6 }, { L: 5, NL: 39, y: 77.5, neck: 8.6 }, { L: -2, NL: 37, y: 77, neck: 9.4, fat: 1 }],
  f: [{ L: 17, NL: 42, y: 80, neck: 5.2 }, { L: 22, NL: 44, y: 81, neck: 4.2 }, { L: 10, NL: 40, y: 78.5, neck: 7.2 }, { L: 3, NL: 38, y: 78, neck: 8.4, fat: 1 }],
};
const HEAD = [{ sx: 1, sy: 1 }, { sx: 0.9, sy: 1.02 }, { sx: 1.07, sy: 0.99 }, { sx: 1.16, sy: 1 }];
const torsoPath = T => T.fat ? `M${T.L} 112 C${T.L - 1} ${T.y - 2} ${T.NL - 14} ${T.y - 1.5} ${T.NL} ${T.y} L${100 - T.NL} ${T.y} C${114 - T.NL} ${T.y - 1.5} ${101 - T.L} ${T.y - 2} ${100 - T.L} 112Z` : `M${T.L} 112 C${T.L + 2} ${T.y + 8} ${T.NL - 10} ${T.y + 1.5} ${T.NL} ${T.y} L${100 - T.NL} ${T.y} C${110 - T.NL} ${T.y + 1.5} ${98 - T.L} ${T.y + 8} ${100 - T.L} 112Z`;

// лицо по телосложению: худое с тенями под скулами, крепкое с квадратной челюстью, полное со щеками и вторым подбородком
function faceShape(body, fem, skin, sk) {
  const fill = `fill="url(#sk-${skin})"`;
  if (body === 2 && !fem) return `<path d="M50 26.5 C63 26.5 71.5 36 71.5 50 C71.5 62 68.5 70 60.5 72.8 C55 74.6 45 74.6 39.5 72.8 C31.5 70 28.5 62 28.5 50 C28.5 36 37 26.5 50 26.5Z" ${fill} ${st(2.4)}/><path d="M41 72 q9 3 18 0" stroke="${sk[2]}" stroke-width="1.6" fill="none" opacity=".7"/>`;
  if (body === 3) return `<path d="M39.5 72 Q50 82 60.5 72 L59 70 H41Z" ${fill} ${st(2.2)}/>`
    + `<path d="M50 26.5 C62 26.5 70.5 35 71 46 C71.6 54 74 61 69.6 67.6 C65.6 73.6 57.5 76 50 76 C42.5 76 34.4 73.6 30.4 67.6 C26 61 28.4 54 29 46 C29.5 35 38 26.5 50 26.5Z" ${fill} ${st(2.4)}/>`
    + `<path d="M43.5 73.6 Q50 75.8 56.5 73.6" stroke="${sk[2]}" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="33.5" cy="61.5" rx="4.6" ry="3" fill="#ff7a7a" opacity=".28"/><ellipse cx="66.5" cy="61.5" rx="4.6" ry="3" fill="#ff7a7a" opacity=".28"/>`;
  const out = `<ellipse cx="50" cy="50" rx="21.5" ry="23.5" ${fill} ${st(2.4)}/>`;
  if (body === 1) return out + `<path d="M33.5 57 q2 5.5 6 8 M66.5 57 q-2 5.5 -6 8" stroke="${sk[2]}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75"/>`;
  return out;
}

// ───────────── одежда: 10 видов ─────────────
function outfit(i, c, T, fem) {
  const NL = T.NL, NR = 100 - T.NL, L = T.L, R = 100 - T.L, y = T.y;
  const dk = shade(c, -0.28), lt = shade(c, 0.4);
  const base = (col = c) => `<path d="${torsoPath(T)}" fill="${col}" ${st(2.2)}/>`;
  const shine = `<path d="M${L + 8} ${y + 14} q4 -7 12 -9" stroke="#fff" stroke-opacity=".3" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const sym = (fn) => fn(1) + fn(-1);
  switch (i) {
    case 1: // рубашка с воротником
      return base() + `<path d="M50 ${y + 7} V112" stroke="${dk}" stroke-width="1.6"/><circle cx="50" cy="${y + 12}" r="1.3" fill="#fff" ${st(0.8)}/><circle cx="50" cy="${y + 18}" r="1.3" fill="#fff" ${st(0.8)}/>`
        + sym(k => `<path d="M${50 - k * (50 - NL)} ${y - 0.5} L50 ${y + 6.5} L${50 - k * (50 - NL - 2)} ${y + 10.5} L${50 - k * (50 - NL + 5)} ${y + 3}Z" fill="${lt}" ${st(1.6)}/>`) + shine;
    case 2: // худи
      return base() + `<path d="M${NL - 6} ${y - 1} Q50 ${y + 13} ${NR + 6} ${y - 1}" fill="none" stroke="${INK}" stroke-width="9.6" stroke-linecap="round"/><path d="M${NL - 6} ${y - 1} Q50 ${y + 13} ${NR + 6} ${y - 1}" fill="none" stroke="${shade(c, -0.15)}" stroke-width="6.4" stroke-linecap="round"/>`
        + `<path d="M46 ${y + 6} v10 M54 ${y + 6} v10" stroke="#f1ebe0" stroke-width="1.8" stroke-linecap="round"/><circle cx="46" cy="${y + 16.5}" r="1.3" fill="#f1ebe0" ${st(0.8)}/><circle cx="54" cy="${y + 16.5}" r="1.3" fill="#f1ebe0" ${st(0.8)}/>`
        + `<path d="M36 112 L39 ${y + 17} H61 L64 112" fill="none" stroke="${dk}" stroke-width="1.8"/>` + shine;
    case 3: { // вязаный свитер с высоким горлом
      let zig = `M${L + 7} ${y + 15}`;
      for (let x = L + 7; x < R - 10; x += 5) zig += ` l2.5 -3.4 l2.5 3.4`;
      return base() + `<path d="${zig}" stroke="${lt}" stroke-width="1.8" fill="none" stroke-linejoin="round"/><g fill="${lt}">${Array.from({ length: Math.floor((R - L - 18) / 6) }, (_, k) => `<circle cx="${L + 10 + k * 6}" cy="${y + 19.5}" r="1"/>`).join('')}</g>`
;
    }
    case 4: // кожаная куртка поверх футболки
      return base('#3a3540') + `<path d="M${NL + 2} ${y} L50 ${y + 17} L${NR - 2} ${y}Z" fill="${c}" ${st(1.6)}/>`
        + sym(k => `<path d="M${50 - k * (50 - NL)} ${y - 0.5} L${50 - k * (50 - NL + 7)} ${y + 3} L${50 - k * 5} ${y + 19} L${50 - k * 0.5} ${y + 17}Z" fill="#2a2630" ${st(1.6)}/>`)
        + `<path d="M45 ${y + 19} L44 112 M55 ${y + 19} L56 112" stroke="#1d1a20" stroke-width="1.6"/><path d="M44.6 ${y + 26} v6" stroke="#c9ced6" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M${L + 8} ${y + 14} q4 -7 12 -9 M${R - 20} ${y + 8} q6 1 10 6" stroke="#fff" stroke-opacity=".28" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 5: { // костюм с галстуком
      const tie = ['#d2502f', '#e86fb1'].includes(c) ? '#3d3a42' : '#d2502f';
      return base() + `<path d="M${NL + 1} ${y} L50 ${y + 19} L${NR - 1} ${y}Z" fill="#f4efe6" ${st(1.6)}/>`
        + `<path d="M47.6 ${y + 2.6} H52.4 L53.4 ${y + 6} L52.2 ${y + 17} L50 ${y + 20.5} L47.8 ${y + 17} L46.6 ${y + 6}Z" fill="${tie}" ${st(1.4)}/><path d="M47.8 ${y + 2.6} H52.2 L51.6 ${y + 5.6} H48.4Z" fill="${shade(tie, -0.2)}" ${st(1.2)}/>`
        + sym(k => `<path d="M${50 - k * (50 - NL)} ${y - 0.5} L${50 - k * (50 - NL + 6)} ${y + 5} L${50 - k * 4.5} ${y + 21} L${50 - k * 1} ${y + 19}Z" fill="${dk}" ${st(1.6)}/>`) + shine;
    }
    case 6: // оранжевый жилет шахтёра со светоотражающими полосами
      return base() + `<path d="M${NL + 2} ${y} Q50 ${y + 8} ${NR - 2} ${y}" fill="${dk}" ${st(1.4)}/>`
        + sym(k => `<path d="M${50 - k * (50 - L - 1)} 112 C${50 - k * (50 - L - 3)} ${y + 9} ${50 - k * (50 - NL + 8)} ${y + 2} ${50 - k * (50 - NL - 1)} ${y + 0.5} L${50 - k * 4} ${y + 15} L${50 - k * 5} 112Z" fill="#ff8a2a" ${st(1.8)}/>`
          + `<path d="M${50 - k * (50 - L - 7)} ${y + 12.5} L${50 - k * 4.6} ${y + 12.5} M${50 - k * (50 - L - 5)} ${y + 18.5} L${50 - k * 4.8} ${y + 18.5}" stroke="#e9eef5" stroke-width="2.6"/>`);
    case 7: // доспехи
      return base('#a3acb7') + `<path d="M50 ${y + 7} V112" stroke="#6b7480" stroke-width="2"/><path d="M${L + 12} ${y + 6} L${R - 8} 112" stroke="${INK}" stroke-width="7"/><path d="M${L + 12} ${y + 6} L${R - 8} 112" stroke="${c}" stroke-width="4.4"/>`
        + `<path d="M${NL - 2} ${y + 1} Q50 ${y + 9} ${NR + 2} ${y + 1}" fill="none" stroke="#8a929d" stroke-width="4" stroke-linecap="round"/>`
        + sym(k => { const x = 50 - k * (50 - L - 10); return `<path d="M${x - 12} ${y + 15} L${x - 11} ${y + 19} H${x + 11} L${x + 12} ${y + 15}Z" fill="#8f98a4" ${st(1.6)}/>`
          + `<path d="M${x - 13} ${y + 15} Q${x - 13} ${y - 1} ${x} ${y - 1} Q${x + 13} ${y - 1} ${x + 13} ${y + 15}Z" fill="#c3cad3" ${st(1.8)}/>`
          + `<path d="M${x - 8} ${y + 7} Q${x - 6} ${y + 2} ${x} ${y + 1.5}" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="${x - 9}" cy="${y + 12.5}" r="1.1" fill="#5b6470"/><circle cx="${x + 9}" cy="${y + 12.5}" r="1.1" fill="#5b6470"/>`; });
    case 8: { // мантия мага со звёздами
      const star = (x, yy, r) => `<path d="M${x} ${yy - r} l${r * 0.3} ${r * 0.7} l${r * 0.7} ${r * 0.1} l-${r * 0.55} ${r * 0.45} l${r * 0.2} ${r * 0.75} l-${r * 0.65} -${r * 0.4} l-${r * 0.65} ${r * 0.4} l${r * 0.2} -${r * 0.75} l-${r * 0.55} -${r * 0.45} l${r * 0.7} -${r * 0.1}z" fill="#fff36b"/>`;
      return base() + `<path d="M${NL} ${y} L50 ${y + 15} L${NR} ${y}" fill="${dk}" stroke="#f2c14e" stroke-width="2.6" stroke-linejoin="round"/><path d="M50 ${y + 15} V112" stroke="#f2c14e" stroke-width="2.4"/><circle cx="50" cy="${y + 15}" r="2.6" fill="#f2c14e" ${st(1.2)}/>`
        + star(L + 14, y + 13, 2.6) + star(R - 14, y + 16, 2.2) + star(L + 22, y + 19, 1.6) + `<circle cx="${R - 22}" cy="${y + 10}" r="1" fill="#fff36b"/>`;
    }
    case 9: // плащ путника с капюшоном за спиной и пряжками
      return `<path d="M${NL - 6} ${y + 1} Q50 ${y - 10} ${NR + 6} ${y + 1}" fill="${shade(c, -0.22)}" ${st(2)}/>` + base('#8a5a3c')
        + sym(k => `<path d="M${50 - k * (50 - L + 2)} 112 C${50 - k * (50 - L)} ${y + 6} ${50 - k * (50 - NL + 8)} ${y} ${50 - k * (50 - NL - 2)} ${y - 1} L${50 - k * (50 - NL - 5)} ${y + 3} C${50 - k * 6} ${y + 14} ${50 - k * 10} ${y + 20} ${50 - k * 12} 112Z" fill="${c}" ${st(1.8)}/>`)
        + `<path d="M${NL + 4} ${y + 3.4} Q50 ${y + 7} ${NR - 4} ${y + 3.4}" stroke="#c9ced6" stroke-width="1.4" fill="none"/><circle cx="${NL + 4}" cy="${y + 3.4}" r="2.6" fill="#f2c14e" ${st(1.2)}/><circle cx="${NR - 4}" cy="${y + 3.4}" r="2.6" fill="#f2c14e" ${st(1.2)}/>`;
    default: // футболка
      return base() + `<path d="M${NL + 1} ${y + 0.5} Q50 ${y + (fem ? 11 : 8)} ${NR - 1} ${y + 0.5}" fill="${dk}" ${st(1.8)}/>`
        + sym(k => `<path d="M${50 - k * (50 - L - 10)} ${y + 15} q${k * 3} -5 ${k * 8} -7" stroke="${dk}" stroke-width="1.4" fill="none"/>`) + shine;
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
  const fem = v.gender === 1;
  const T = BUILD[fem ? 'f' : 'm'][v.body] || BUILD.m[0];
  const H = HEAD[v.body] || HEAD[0];
  const sx = H.sx * (fem && v.body !== 3 ? 0.96 : 1);
  // вся голова (с волосами и шапкой) масштабируется вокруг центра лица
  const g = `<g transform="translate(50 52) scale(${sx.toFixed(3)} ${H.sy}) translate(-50 -52)">`;
  return `<svg class="${cls}" viewBox="5 5 90 90" aria-hidden="true">`
    + `<rect width="100" height="100" fill="${shade(bg, -0.25)}"/><circle cx="50" cy="40" r="58" fill="${bg}" opacity=".9"/><rect width="100" height="100" fill="url(#av-glow)"/>`
    + `<g opacity=".18" fill="#fff"><circle cx="16" cy="20" r="2"/><circle cx="84" cy="26" r="1.6"/><circle cx="80" cy="70" r="1.4"/></g>`
    // фигура чуть уменьшена, чтобы в кружок попадали плечи и одежда
    + `<g transform="matrix(.84 0 0 .84 8 3.4)">` + g + hatBack(v.hat, hatc) + (hood ? '' : hairBack(v.hair, hc)) + `</g>`
    + outfit(v.outfit, shirt, T, fem)
    + `<path d="M${50 - T.neck} 66 H${50 + T.neck} V${T.y + 2} Q50 ${T.y + 6} ${50 - T.neck} ${T.y + 2}Z" fill="${sk[2]}" ${st(1.8)}/>`
    + (v.outfit === 3 ? `<rect x="${50 - T.neck - 2}" y="${T.y - 7}" width="${2 * T.neck + 4}" height="10" rx="3" fill="${shade(shirt, -0.12)}" ${st(1.8)}/>` + Array.from({ length: 5 }, (_, k) => `<path d="M${50 - T.neck + k * (T.neck * 2) / 4} ${T.y - 6} v8" stroke="${shade(shirt, -0.28)}" stroke-width="1"/>`).join('') : '')
    + g
    + `<ellipse cx="29" cy="53" rx="5" ry="6.4" fill="url(#sk-${v.skin})" ${st(2)}/><ellipse cx="71" cy="53" rx="5" ry="6.4" fill="url(#sk-${v.skin})" ${st(2)}/>`
    + faceShape(v.body, fem, v.skin, sk)
    + extraUnder(v.extra)
    + eyes(v.eyes, sk[1]) + (fem ? lashes(v.eyes) : '') + brows(v.brows, v.hair === 0 && v.brows ? '#4a2f22' : hc, fem)
    + `<path d="M48.2 55.5 Q50 58.6 51.8 55.5" fill="none" stroke="${sk[2]}" stroke-width="2" stroke-linecap="round"/>`
    + (fem ? lips(v.mouth) : '') + mouth(v.mouth)
    + facial(v.facial, hc)
    + extraOver(v.extra)
    + glasses(v.glasses)
    + (hood ? hairFront(v.hair === 0 ? 0 : Math.min(v.hair, 1), hc) : hairFront(v.hair, hc))
    + hat(v.hat, hatc)
    + `</g></g></svg>`;
}

export { AVATAR_PARTS };
