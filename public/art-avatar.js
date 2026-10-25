// «Под Землёй» — портрет героя: собирается из слоёв (фон, волосы, тело и одежда, уши, лицо, черты, борода,
// приметы, украшения, головной убор). Тёмное фэнтези: приглушённые цвета, тёплый свет слева, холодный контур справа.
// Номера деталей проверяет сервер (shared/avatar.js), здесь только рисунок.
import { AVATAR_PARTS, avatarConfig, MOLE } from '/shared/avatar.js';

// ───────────── палитры ─────────────
const SKINS = [
  ['#f0d2bd', '#e3bb9c', '#d3a281', '#bf8a66', '#a6714f', '#895739', '#6b4029', '#4a2d1e'],   // люди, гномы, полурослики
  ['#f1dccb', '#e4c4a6', '#cfa784', '#b38c6a', '#cdd4da', '#a8a2b6', '#6f6781', '#4a4459'],   // эльфы (последние — лунные и тёмные)
  ['#7c8b55', '#62794a', '#4a6239', '#8a8f6b', '#6c7063', '#585550', '#7b6b4b', '#3e4934'],   // орки
  ['#9ba655', '#80994a', '#6a873f', '#a9ab7b', '#8b7a49', '#5d7242', '#6f8a6b', '#4d5d34'],   // гоблины
  ['#3b3430', '#26221f', '#5a4a3d', '#7b6a57', '#4b4b51', '#8a8986', '#d6cec2', '#6b3f2b'],   // кротолюды: мех
];
const RACE_SKIN = [0, 1, 0, 0, 2, 3, 4];
export const skinPalette = race => SKINS[RACE_SKIN[race] ?? 0];
export const EYEC = ['#4b2f1b', '#7b5a2c', '#4d6b3b', '#4a6f93', '#6e7a82', '#c08a2c', '#6c4b8c', '#a3301f', '#c9b13a'];
export const HAIRC = ['#17130f', '#2f2018', '#4f3122', '#7a5a3b', '#a99068', '#d2bd8e', '#8e3d1c', '#b05a2c', '#8a8780', '#dcd8d0', '#aab4c0', '#4c1c22'];
export const CLOTH = ['#7a2a22', '#26375c', '#2c4c33', '#5c3f29', '#2f2f35', '#4b2b54', '#8a6a2b', '#c3baa8', '#1f4b4d', '#3b4b5f'];
export const BGC = [null, '#3b2d1d', '#1e3a33', '#1f2c46', '#33253f', '#41212a', '#2d3421', '#45231a', '#141416', '#3c3c42'];

export const AV_LABELS = {
  gender: ['Мужчина', 'Женщина'],
  race: ['Человек', 'Эльф', 'Гном', 'Полурослик', 'Орк', 'Гоблин', 'Кротолюд'],
  body: ['Обычное', 'Худощавое', 'Могучее'],
  brows: ['Спокойный', 'Суровый', 'Удивлённый', 'Насмешливый', 'Усталый'],
  mouth: ['Сомкнутые губы', 'Лёгкая улыбка', 'Ухмылка', 'Оскал', 'Поджатые губы', 'Приоткрытый рот'],
  hair: ['Лысый', 'Короткая', 'Зачёс назад', 'Длинные прямые', 'Длинные волнистые', 'Хвост', 'Коса', 'Две косы',
    'Пучок', 'Кудри', 'Гребень', 'Виски и коса', 'Каре', 'Узел воина', 'Растрёпанные', 'Дреды'],
  facial: ['Без бороды', 'Щетина', 'Усы', 'Эспаньолка', 'Короткая борода', 'Окладистая', 'Борода с косами', 'Борода мудреца'],
  hat: ['Без убора', 'Капюшон', 'Шлем с наносником', 'Рогатый шлем', 'Обруч', 'Корона', 'Шляпа мага', 'Каска шахтёра',
    'Повязка', 'Меховая шапка', 'Венок', 'Широкополая шляпа', 'Берет с пером'],
  outfit: ['Рубаха', 'Кожаная куртка', 'Кольчуга', 'Латы', 'Мантия мага', 'Плащ с мехом', 'Дорожный плащ', 'Камзол',
    'Роба шахтёра', 'Облачение жреца', 'Наряд следопыта', 'Шкуры', 'Платье с корсажем'],
  extra: ['Нет', 'Шрам через глаз', 'Шрам на щеке', 'Повязка на глаз', 'Боевая раскраска', 'Веснушки', 'Руны',
    'Узор из точек', 'Копоть', 'Морщины'],
  jewel: ['Нет', 'Серьги-кольца', 'Серьга', 'Кольцо в носу', 'Амулет', 'Гривна', 'Клыки на шнурке', 'Монокль', 'Очки', 'Очки-консервы'],
  eyes: ['Карие', 'Ореховые', 'Зелёные', 'Голубые', 'Серые', 'Янтарные', 'Фиалковые', 'Красные', 'Жёлтые'],
  hairColor: ['Чёрные', 'Тёмно-каштановые', 'Каштановые', 'Русые', 'Пепельные', 'Светлые', 'Рыжие', 'Медные', 'С проседью', 'Белые', 'Серебристые', 'Винные'],
  shirt: ['Багровый', 'Синий', 'Хвойный', 'Кожаный', 'Угольный', 'Пурпурный', 'Охра', 'Небелёный лён', 'Бирюзовый', 'Сизый'],
};
AV_LABELS.hatColor = AV_LABELS.shirt;
// у каких уборов есть цвет ткани
export const HAT_COLORED = new Set([1, 6, 8, 11, 12]);
// какие уборы закрывают макушку (пучки и гребни под ними не видны)
const HAT_COVERS = new Set([1, 2, 3, 6, 7, 8, 9, 11, 12]);

// ───────────── цвет ─────────────
const hx = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
// k < 0 — темнее, k > 0 — светлее
function sh(h, k) { const c = hx(h); return toHex(k < 0 ? c.map(v => v * (1 + k)) : c.map(v => v + (255 - v) * k)); }
function mix(a, b, t) { const x = hx(a), y = hx(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); }
const lum = h => { const [r, g, b] = hx(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// ───────────── геометрия ─────────────
const f = n => +n.toFixed(2);
const P = (x, y) => `${f(x)} ${f(y)}`;
const mx = x => 100 - x;
// Симметричный контур: левая половина от верхней точки на оси до нижней на оси, правая — зеркально.
function sym(start, segs) {
  let d = `M${P(...start)}`;
  const ends = [start];
  for (const [a, b, p] of segs) { d += `C${P(...a)} ${P(...b)} ${P(...p)}`; ends.push(p); }
  for (let i = segs.length - 1; i >= 0; i--) {
    const [a, b] = segs[i], p = ends[i];
    d += `C${P(mx(b[0]), b[1])} ${P(mx(a[0]), a[1])} ${P(mx(p[0]), p[1])}`;
  }
  return d + 'Z';
}
const MIRROR = 'matrix(-1 0 0 1 100 0)';
// зеркальная копия данных пути (x → 100 − x), чтобы свет падал одинаково на обе половины
function mirD(d) {
  const out = [];
  for (const [, cmd, args] of d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    const abs = cmd === cmd.toUpperCase(), C = cmd.toUpperCase();
    if (C === 'A') for (let i = 0; i < n.length; i += 7) { n[i + 2] = -n[i + 2]; n[i + 4] = 1 - n[i + 4]; n[i + 5] = abs ? 100 - n[i + 5] : -n[i + 5]; }
    else if (C === 'H') for (let i = 0; i < n.length; i++) n[i] = abs ? 100 - n[i] : -n[i];
    else if (C !== 'V' && C !== 'Z') for (let i = 0; i < n.length; i += 2) n[i] = abs ? 100 - n[i] : -n[i];
    out.push(cmd + n.map(f).join(' '));
  }
  return out.join('');
}
const both = s => s + `<g transform="${MIRROR}">${s}</g>`;

// пропорции головы: базовые и поправки на пол, расу и телосложение
const BASE = { top: 17.5, browY: 37.6, eyeY: 42.6, noseY: 53, mouthY: 58.8, chinY: 67, templeW: 15.8, cheekW: 16.4, jawW: 13.4, chinW: 4.6,
  eyeDX: 7.1, eyeW: 3.15, eyeH: 1.32, tilt: 0.25, mw: 4.1, nsx: 1, nsy: 1, hairY: 26.6, browT: 1.3 };
const RACE_MOD = [
  {},
  { cheekW: -0.9, jawW: -1.6, chinW: -1.1, chinY: 0.8, templeW: -0.4, tilt: 0.75, nsx: -0.18, browT: -0.2 },
  { cheekW: 2.2, jawW: 3.2, chinW: 2, templeW: 1.6, browY: 0.5, eyeY: 0.4, nsx: 0.5, nsy: 0.4, mw: 0.4, top: 0.8, browT: 0.5 },
  { cheekW: 0.6, jawW: 1.2, chinW: 1, chinY: -2.2, mouthY: -1, noseY: -0.7, eyeW: 0.25, eyeH: 0.22, nsx: -0.12, nsy: -0.15 },
  { cheekW: 2.4, jawW: 4.6, chinW: 4.4, chinY: 0.9, templeW: 1.2, browY: 0.9, eyeH: -0.22, nsx: 0.5, nsy: -0.08, mw: 1.3, browT: 0.45 },
  { cheekW: 0.2, jawW: -2.3, chinW: -2.9, chinY: -0.4, eyeW: 0.75, eyeH: 0.55, eyeDX: 0.7, tilt: 0.8, mw: 1.4, top: 1 },
  { cheekW: 2.6, jawW: 3.6, chinW: 4.2, templeW: 2, top: -0.5 },
];
const FEMALE = { cheekW: -0.5, jawW: -1.6, chinW: -0.9, chinY: -1.2, mouthY: -0.3, eyeW: 0.15, eyeH: 0.2, nsx: -0.1, nsy: -0.08, mw: -0.2, browT: -0.45, browY: -0.5 };
// ширина плеч и шеи: [обычное, худощавое, могучее] × [мужчина, женщина]
const SW = [[36, 31.5, 41], [32, 28.5, 36]], NW = [[7.8, 7.1, 9.6], [6.4, 5.9, 7.6]];
const RACE_BODY = [[0, 0], [-1.5, -0.6], [3, 1.6], [-2, -0.3], [2.5, 2.2], [-4, -1.6], [1, 2.4]];

// голова чуть меньше натуральной величины относительно плеч — чтобы в кадр помещались одежда и украшения
const HS = 0.8, HY = 66;
const hy = y => HY + (y - HY) * HS;
const HEAD = `translate(50 ${HY}) scale(${HS}) translate(-50 ${-HY})`;
function geo(v) {
  const g = { ...BASE };
  for (const [k, d] of Object.entries(RACE_MOD[v.race] || {})) g[k] += d;
  if (v.gender) for (const [k, d] of Object.entries(FEMALE)) g[k] += d;
  const [ds, dn] = RACE_BODY[v.race] || [0, 0];
  g.sw = SW[v.gender][v.body] + ds;
  g.nw = NW[v.gender][v.body] + dn;
  if (v.body === 2) { g.jawW += 0.6; g.chinW += 0.4; }
  if (v.body === 1) { g.cheekW -= 0.3; g.jawW -= 0.5; }
  g.earX = (g.templeW + g.cheekW) / 2 - 0.4;
  return g;
}

function facePath(g) {
  const { top, browY, eyeY, mouthY, chinY, templeW: t, cheekW: c, jawW: j, chinW: ch } = g;
  return sym([50, top], [
    [[50 - t * 0.6, top], [50 - t, top + 5.6], [50 - t, browY - 3.4]],
    [[50 - t, browY + 1.2], [50 - c, eyeY - 1.2], [50 - c, eyeY + 3]],
    [[50 - c, eyeY + 9], [50 - j - 0.5, mouthY - 4.5], [50 - j, mouthY + 0.4]],
    [[50 - j + 1, mouthY + 4.8], [50 - ch - 1.2, chinY], [50, chinY]],
  ]);
}

// ───────────── общие градиенты (один раз на документ: art.js → injectDefs) ─────────────
export function avatarDefs() {
  const R = (id, stops, a = '') => `<radialGradient id="${id}" ${a}>${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</radialGradient>`;
  const L = (id, stops, a = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${id}" ${a}>${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
  return R('av-vig', [[0.52, '#000', 0], [1, '#000', 0.7]], 'cx="50%" cy="44%" r="72%"')
    + R('av-bgl', [[0, '#ffe2b8', 0.22], [1, '#ffe2b8', 0]], 'cx="42%" cy="34%" r="52%"')
    + R('av-sk', [[0, '#fff1e0', 0.16], [0.42, '#fff1e0', 0], [0.8, '#2a1006', 0.12], [1, '#2a1006', 0.42]], 'cx="38%" cy="33%" r="78%"')
    + L('av-skr', [[0.48, '#250c03', 0], [1, '#250c03', 0.34]], 'x1="0" y1="0" x2="1" y2="0"')
    + L('av-cl', [[0, '#fff', 0.1], [0.3, '#fff', 0], [0.72, '#000', 0.26], [1, '#000', 0.55]])
    + L('av-clx', [[0, '#fff', 0.07], [0.45, '#fff', 0], [1, '#000', 0.38]], 'x1="0" y1="0" x2="1" y2="0"')
    + R('av-hr', [[0, '#fff', 0.24], [0.45, '#fff', 0], [1, '#000', 0.5]], 'cx="36%" cy="24%" r="82%"')
    + R('av-hrU', [[0, '#fff', 0.26], [0.3, '#fff', 0], [0.7, '#000', 0.22], [1, '#000', 0.5]], 'gradientUnits="userSpaceOnUse" cx="40" cy="18" r="78"')
    + L('av-rim', [[0, '#d6e4ff', 0], [0.7, '#d6e4ff', 0], [1, '#d6e4ff', 0.32]], 'x1="0" y1="0" x2="1" y2="0"')
    + L('av-clU', [[0, '#fff', 0.1], [0.3, '#fff', 0], [0.75, '#000', 0.3], [1, '#000', 0.55]], 'gradientUnits="userSpaceOnUse" x1="0" y1="66" x2="0" y2="102"')
    + L('av-clxU', [[0, '#fff', 0.08], [0.45, '#fff', 0], [1, '#000', 0.4]], 'gradientUnits="userSpaceOnUse" x1="12" y1="0" x2="88" y2="0"')
    + R('av-sft', [[0, '#000', 1], [1, '#000', 0]])
    + R('av-sfw', [[0, '#2a0e04', 1], [1, '#2a0e04', 0]])
    + R('av-hl', [[0, '#fff', 1], [1, '#fff', 0]])
    + R('av-blush', [[0, '#b8423a', 1], [1, '#b8423a', 0]])
    + R('av-iris', [[0, '#000', 0], [0.55, '#000', 0], [1, '#000', 0.6]])
    + L('av-steel', [[0, '#eef0f2'], [0.32, '#a6abb2'], [0.6, '#4c5159'], [0.84, '#8c9199'], [1, '#c9cdd2']])
    + L('av-steelx', [[0, '#d9dce1'], [0.4, '#9fa4ab'], [1, '#3d4249']], 'x1="0" y1="0" x2="1" y2="0"')
    + L('av-gold', [[0, '#f4e2b2'], [0.38, '#c79a4c'], [0.7, '#76511f'], [1, '#d2ab62']])
    + L('av-glass', [[0, '#fff', 0.42], [0.5, '#fff', 0.04], [1, '#fff', 0.2]], 'x1="0" y1="0" x2="1" y2="1"')
    + `<pattern id="av-mail" width="2.3" height="2" patternUnits="userSpaceOnUse"><circle cx="1.15" cy="1" r=".82" fill="none" stroke="#1d2026" stroke-width=".5"/><path d="M.5 .6a.8 .8 0 0 1 1.1-.2" fill="none" stroke="#e8ecf0" stroke-opacity=".55" stroke-width=".3"/><circle cx="0" cy="0" r=".82" fill="none" stroke="#1d2026" stroke-width=".5"/><circle cx="2.3" cy="0" r=".82" fill="none" stroke="#1d2026" stroke-width=".5"/><circle cx="0" cy="2" r=".82" fill="none" stroke="#1d2026" stroke-width=".5"/><circle cx="2.3" cy="2" r=".82" fill="none" stroke="#1d2026" stroke-width=".5"/></pattern>`;
}
const soft = (cx, cy, rx, ry, op, g = 'av-sfw') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${g})" opacity="${op}"/>`;
// заливка + объём + тонкий контур
const solid = (d, c, shade = 'av-cl', k = -0.5, w = 0.55) => `<path d="${d}" fill="${c}"/>${shade ? `<path d="${d}" fill="url(#${shade})"/>` : ''}<path d="${d}" fill="none" stroke="${sh(c, k)}" stroke-width="${w}" stroke-linejoin="round"/>`;

// ───────────── тело ─────────────
function torsoPath(g, ext = 0) {
  const { sw, nw } = g, s = sw + ext;
  return sym([50, 75.4], [
    [[50 - nw * 0.6, 75.4], [50 - nw - 0.3, 73.4], [50 - nw - 0.3, 71]],
    [[50 - nw - 2, 74.6], [50 - s + 11, 75.4], [50 - s + 4, 77.4]],
    [[50 - s - 0.4, 78.8], [50 - s - 1.6, 82.5], [50 - s - 2, 88]],
    [[50 - s - 2.4, 94], [50 - s - 3, 98], [50 - s - 3, 102]],
    [[50 - s, 102], [40, 102], [50, 102]],
  ]);
}
function neck(g, skin) {
  const { nw } = g, mouthY = hy(g.mouthY), chinY = hy(g.chinY);
  const d = `M${P(50 - nw, mouthY)}C${P(50 - nw + 0.3, mouthY + 7)} ${P(50 - nw - 0.4, 74)} ${P(50 - nw - 1.4, 82)}L${P(50 + nw + 1.4, 82)}C${P(50 + nw + 0.4, 74)} ${P(50 + nw - 0.3, mouthY + 7)} ${P(50 + nw, mouthY)}Z`;
  return `<path d="${d}" fill="${skin}"/><path d="${d}" fill="url(#av-skr)"/>`
    + soft(50, chinY + 2, g.jawW * 0.85, 4, 0.62)
    + `<path d="M${P(50 + nw - 1, mouthY + 4)}C${P(50 + nw - 0.6, 70)} ${P(50 + nw, 74)} ${P(50 + nw + 1, 78)}" fill="none" stroke="url(#av-rim)" stroke-width=".7"/>`;
}

// ───────────── уши ─────────────
function ear(g, skin, race) {
  const x = 50 - g.earX, b = g.browY, n = g.noseY;
  let d;
  switch (race) {
    case 1: d = `M${P(x + 0.8, b + 1.6)}C${P(x - 3, b - 0.6)} ${P(x - 8, b - 8)} ${P(x - 12.5, b - 14)}C${P(x - 8.6, b - 5)} ${P(x - 4.8, b + 6)} ${P(x - 2.6, n - 2)}C${P(x - 1.7, n + 0.6)} ${P(x - 0.4, n + 1)} ${P(x + 0.7, n - 1)}Z`; break;
    case 4: d = `M${P(x + 0.8, b + 1.6)}C${P(x - 2.6, b - 1)} ${P(x - 5, b - 3)} ${P(x - 8, b - 6.4)}C${P(x - 6.4, b + 2)} ${P(x - 3.8, n - 2)} ${P(x - 1.5, n + 0.6)}C${P(x - 0.6, n + 1.2)} ${P(x + 0.2, n + 0.6)} ${P(x + 0.7, n - 1)}Z`; break;
    case 5: d = `M${P(x + 0.8, b + 0.6)}C${P(x - 4, b - 3.4)} ${P(x - 11, b - 6)} ${P(x - 17.5, b - 4.4)}C${P(x - 12.6, b + 1.6)} ${P(x - 6.4, n - 3)} ${P(x - 1.6, n + 0.4)}C${P(x - 0.6, n + 1)} ${P(x + 0.2, n + 0.4)} ${P(x + 0.7, n - 1)}Z`; break;
    case 3: d = `M${P(x + 0.8, b + 1.8)}C${P(x - 2, b - 0.2)} ${P(x - 3.2, b - 1)} ${P(x - 4, b - 2.6)}C${P(x - 3.8, b + 3)} ${P(x - 3.2, n - 3)} ${P(x - 1.8, n)}C${P(x - 1, n + 1.2)} ${P(x + 0.1, n + 1)} ${P(x + 0.7, n - 0.8)}Z`; break;
    default: { const k = race === 2 ? 0.8 : 0; d = `M${P(x + 0.8, b + 2)}C${P(x - 2.4 - k, b + 0.2)} ${P(x - 3.4 - k, b + 4.6)} ${P(x - 2.6 - k, b + 9)}C${P(x - 2, n + 0.4)} ${P(x - 0.8, n + 1.8 + k)} ${P(x + 0.7, n - 0.4)}Z`; }
  }
  const inner = race === 1 ? `M${P(x - 0.6, b + 2.6)}C${P(x - 4, b - 1)} ${P(x - 7, b - 6)} ${P(x - 10, b - 10.4)}`
    : race === 5 ? `M${P(x - 1, b + 1.6)}C${P(x - 5, b - 1.6)} ${P(x - 10, b - 3)} ${P(x - 14, b - 3)}`
    : `M${P(x - 0.4, b + 3)}C${P(x - 2, b + 2.6)} ${P(x - 2.6, b + 6)} ${P(x - 1.6, n - 2.6)}`;
  return `<path d="${d}" fill="${skin}"/><path d="${d}" fill="url(#av-sk)"/><path d="${inner}" fill="none" stroke="${sh(skin, -0.5)}" stroke-width=".8" stroke-linecap="round" opacity=".55"/><path d="${d}" fill="none" stroke="${sh(skin, -0.5)}" stroke-width=".5"/>`;
}

// ───────────── глаза и брови ─────────────
function eye(g, side, iris, skin, v, k) {
  const cx = 50 + side * g.eyeDX, cy = g.eyeY, w = g.eyeW, h = g.eyeH, t = g.tilt;
  const ix = cx - side * w, iy = cy + 0.15, ox = cx + side * w, oy = cy - t;
  const up = `M${P(ix, iy)}C${P(ix + side * w * 0.45, cy - h * 1.38)} ${P(ox - side * w * 0.5, cy - h * 1.3 - t * 0.5)} ${P(ox, oy)}`;
  const shape = up + `C${P(ox - side * w * 0.35, cy + h * 0.85 - t * 0.4)} ${P(ix + side * w * 0.55, cy + h * 0.98)} ${P(ix, iy)}Z`;
  const id = k + (side < 0 ? 'l' : 'r');
  const sclera = v.race === 5 ? '#d8cf9e' : v.race === 4 ? '#d6ccb4' : '#ddd4c8';
  const ir = h * 1.12, icx = cx - side * 0.12, icy = cy - 0.08;
  const dark = sh(skin, -0.5), fem = v.gender === 1;
  let s = soft(cx, cy + 0.2, w * 1.75, h * 2.5, lum(skin) > 0.45 ? 0.24 : 0.34);
  s += `<clipPath id="${id}"><path d="${shape}"/></clipPath><g clip-path="url(#${id})"><path d="${shape}" fill="${sclera}"/>`
    + `<circle cx="${f(icx)}" cy="${f(icy)}" r="${f(ir)}" fill="${iris}"/><circle cx="${f(icx)}" cy="${f(icy)}" r="${f(ir)}" fill="url(#av-iris)"/>`
    + `<circle cx="${f(icx)}" cy="${f(icy)}" r="${f(ir * 0.42)}" fill="#0b0705"/>`
    + `<path d="${up}" fill="none" stroke="#1a0c06" stroke-opacity=".4" stroke-width="${f(h * 0.95)}"/>`
    + `<circle cx="${f(icx - ir * 0.36)}" cy="${f(icy - ir * 0.34)}" r="${f(ir * 0.22)}" fill="#fff" opacity=".85"/></g>`;
  s += `<path d="${up}" fill="none" stroke="#1a0e08" stroke-width="${fem ? 0.9 : 0.68}" stroke-linecap="round"/>`;
  if (fem) s += `<path d="M${P(ox - side * 0.2, oy + 0.1)}l${f(side * 0.95)} -0.75" stroke="#1a0e08" stroke-width=".55" stroke-linecap="round"/>`;
  s += `<path d="M${P(ix + side * w * 0.15, cy - h * 1.55)}Q${P(cx + side * 0.2, cy - h * 2.75)} ${P(ox + side * 0.1, oy - h * 1.15)}" fill="none" stroke="${dark}" stroke-width=".42" opacity=".55"/>`
    + `<path d="M${P(ix + side * w * 0.35, cy + h * 1.05)}Q${P(cx, cy + h * 1.45)} ${P(ox - side * w * 0.2, oy + h * 0.55)}" fill="none" stroke="${dark}" stroke-width=".38" opacity=".45"/>`;
  return s;
}
function brow(g, side, col, kind, fem) {
  const cx = 50 + side * g.eyeDX, w = g.eyeW, by = g.browY;
  let di = 0, dp = -0.9, dq = 0.2;
  if (kind === 1) { di = 1.15; dp = -0.2; dq = -0.45; }
  else if (kind === 2) { di = -1.1; dp = -2; dq = -0.5; }
  else if (kind === 3) { if (side > 0) { di = -0.8; dp = -2.1; dq = -0.5; } else { di = 0.7; dp = -0.35; dq = 0.25; } }
  else if (kind === 4) { di = -0.9; dp = -0.9; dq = 0.9; }
  const th = g.browT;
  const ix = cx - side * w * 0.95, px = cx + side * w * 0.3, ox = cx + side * w * 1.42;
  const d = `M${P(ix, by + di - th * 0.55)}Q${P(px, by + dp - th * 0.55)} ${P(ox, by + dq + 0.4)}Q${P(px, by + dp + th * 0.55)} ${P(ix, by + di + th * 0.5)}Z`;
  return `<path d="${d}" fill="${col}" stroke="${sh(col, -0.3)}" stroke-width=".25" stroke-linejoin="round"/>`;
}

// ───────────── нос и рот ─────────────
function nose(g, skin, race) {
  const y = g.noseY, d = sh(skin, -0.45), dd = sh(skin, -0.65);
  if (race === 5) {   // длинный острый нос гоблина
    const p = `M${P(49.3, g.eyeY + 1.5)}C${P(48.9, y - 4)} ${P(47.4, y + 1.6)} ${P(49.4, y + 4.4)}C${P(50.6, y + 4)} ${P(52.8, y + 1.8)} ${P(52.3, y)}C${P(51.6, y - 3.6)} ${P(50.9, g.eyeY + 1)} ${P(50.6, g.eyeY + 1)}Z`;
    return soft(50.8, y + 2.6, 3.4, 1.4, 0.35) + `<path d="${p}" fill="${skin}"/><path d="${p}" fill="url(#av-skr)"/><path d="${p}" fill="url(#av-sk)"/>`
      + `<path d="M${P(49.4, y + 4.4)}C${P(50.6, y + 4)} ${P(52.8, y + 1.8)} ${P(52.3, y)}" fill="none" stroke="${d}" stroke-width=".5"/>`
      + `<ellipse cx="49.6" cy="${f(y + 2.9)}" rx=".55" ry=".3" fill="${dd}"/><ellipse cx="51.6" cy="${f(y + 2.4)}" rx=".5" ry=".28" fill="${dd}"/>`
      + soft(49.2, y + 1.6, 0.8, 1.4, 0.35, 'av-hl');
  }
  const big = race === 2;
  let s = `<g transform="translate(50 ${f(y)}) scale(${f(g.nsx)} ${f(g.nsy)}) translate(-50 ${f(-y)})">`;
  s += `<path d="M${P(51, g.eyeY + 0.6)}C${P(51.7, y - 6)} ${P(52.5, y - 3.2)} ${P(53, y - 0.9)}L${P(51.5, y - 1.5)}C${P(51.1, y - 5)} ${P(50.7, y - 7)} ${P(50.3, g.eyeY + 0.6)}Z" fill="${d}" opacity=".32"/>`;
  if (big) s += soft(50, y - 1, 3.2, 2.6, 0.35, 'av-blush');
  s += soft(49.3, y - 1.7, big ? 1.6 : 1.05, big ? 1.7 : 1.3, 0.4, 'av-hl');
  s += `<path d="M${P(47.7, y - 1.9)}C${P(46.5, y - 0.9)} ${P(46.9, y + 0.6)} ${P(48.4, y + 0.45)}M${P(52.3, y - 1.9)}C${P(53.5, y - 0.9)} ${P(53.1, y + 0.6)} ${P(51.6, y + 0.45)}" fill="none" stroke="${d}" stroke-width=".55" stroke-linecap="round" opacity=".85"/>`;
  const nr = race === 4 ? 0.55 : 0.34;
  s += `<ellipse cx="48.75" cy="${f(y + 0.25)}" rx=".78" ry="${nr}" fill="${dd}" transform="rotate(14 48.75 ${f(y + 0.25)})"/><ellipse cx="51.25" cy="${f(y + 0.25)}" rx=".78" ry="${nr}" fill="${dd}" transform="rotate(-14 51.25 ${f(y + 0.25)})"/>`;
  s += '</g>' + soft(50.5, y + 1.7 * g.nsy, 2.8 * g.nsx, 1, 0.3);
  return s;
}
function mouth(g, skin, v) {
  const y = g.mouthY, w = g.mw * (v.mouth === 4 ? 0.88 : 1), fem = v.gender === 1, green = v.race === 4 || v.race === 5;
  const uh = (fem ? 1.35 : 1) * (v.mouth === 4 ? 0.6 : 1), lh = (fem ? 1.95 : 1.5) * (v.mouth === 4 ? 0.65 : 1);
  let cl = 0.25, cr = 0.25, mid = 0.05, open = 0;
  if (v.mouth === 1) { cl = cr = -0.55; mid = 0.4; }
  if (v.mouth === 2) { cl = 0.3; cr = -0.95; mid = 0.15; }
  if (v.mouth === 3) { cl = cr = 0.1; open = 1.6; }
  if (v.mouth === 4) { cl = cr = 0.75; mid = -0.05; }
  if (v.mouth === 5) { open = 0.9; }
  const L = [50 - w, y + cl], R = [50 + w, y + cr];
  const up = mix(sh(skin, -0.3), green ? sh(skin, -0.5) : '#7a2e2a', green ? 0.2 : 0.24);
  const lo = mix(sh(skin, -0.13), green ? sh(skin, -0.3) : '#9a4640', green ? 0.2 : 0.2);
  const lineD = sh(skin, -0.7);
  const ly = y + mid + open;      // где начинается нижняя губа
  let s = soft(50, y - uh - 1.6, 1, 1.5, 0.14);   // ямка над губой
  if (open) {
    const hole = `M${P(...L)}Q${P(50, y + mid - 0.4)} ${P(...R)}Q${P(50, ly + 0.9)} ${P(...L)}Z`;
    s += `<path d="${hole}" fill="#2a0f0c"/>`;
    if (v.mouth === 3) s += `<path d="M${P(L[0] + 0.8, y + cl + 0.1)}Q${P(50, y + mid - 0.2)} ${P(R[0] - 0.8, y + cr + 0.1)}L${P(R[0] - 1.2, y + cr + 0.7)}Q${P(50, y + mid + 0.75)} ${P(L[0] + 1.2, y + cl + 0.7)}Z" fill="#e3d9c4"/>`
      + `<path d="M${P(50, y + mid - 0.1)}v.8M${P(48.2, y + mid)}v.75M${P(51.8, y + mid)}v.75" stroke="#9a8d76" stroke-width=".25"/>`;
  }
  s += `<path d="M${P(...L)}C${P(50 - w * 0.55, y - uh * 0.9)} ${P(48.4, y - uh * 1.15)} ${P(49.1, y - uh)}Q${P(50, y - uh * 0.72)} ${P(50.9, y - uh)}C${P(51.6, y - uh * 1.15)} ${P(50 + w * 0.55, y - uh * 0.9)} ${P(...R)}Q${P(50, y + mid - (open ? 0.4 : 0))} ${P(...L)}Z" fill="${up}"/>`;
  s += `<path d="M${P(...L)}Q${P(50, ly)} ${P(...R)}C${P(50 + w * 0.6, ly + lh)} ${P(50 + w * 0.25, ly + lh * 1.25)} ${P(50, ly + lh * 1.25)}C${P(50 - w * 0.25, ly + lh * 1.25)} ${P(50 - w * 0.6, ly + lh)} ${P(...L)}Z" fill="${lo}"/>`;
  s += soft(49.3, ly + lh * 0.62, w * 0.36, 0.4, 0.3, 'av-hl') + soft(50, ly + lh * 1.25 + 1.1, w * 0.6, 0.8, 0.32);
  s += `<path d="M${P(...L)}Q${P(50, y + mid - (open ? 0.4 : 0))} ${P(...R)}" fill="none" stroke="${lineD}" stroke-width=".55" stroke-linecap="round"/>`;
  s += `<circle cx="${f(L[0])}" cy="${f(L[1])}" r=".5" fill="${lineD}" opacity=".4"/><circle cx="${f(R[0])}" cy="${f(R[1])}" r=".5" fill="${lineD}" opacity=".4"/>`;
  if (v.race === 4) {   // клыки орка
    s += both(`<path d="M${P(50 - w + 1.2, ly + 1.2)}C${P(50 - w + 0.6, y - 1)} ${P(50 - w + 0.2, y - 2.6)} ${P(50 - w - 0.3, y - 3.6)}C${P(50 - w + 1.4, y - 2.4)} ${P(50 - w + 2.6, y - 0.6)} ${P(50 - w + 2.7, ly + 1)}Z" fill="#e4d9bf" stroke="#5e513b" stroke-width=".4"/><path d="M${P(50 - w + 0.6, y - 1.6)}l.5 -1" stroke="#fff" stroke-opacity=".7" stroke-width=".35"/>`);
  }
  if (v.race === 5) s += `<path d="M${P(50 + w - 1.6, y + cr - 0.1)}l.5 1.5l.6 -1.5z" fill="#e6dcc0" stroke="#5e513b" stroke-width=".25"/>`;
  return s;
}

// ───────────── одежда ─────────────
const LEATHER = '#4e3727', BRONZE = '#a8854f', LINEN = '#cfc5b0';
// ткань: контур под заливкой и общий для всего торса свет
const clothSet = (ds, c, w = 0.55) => `<g fill="none" stroke="${sh(c, -0.6)}" stroke-width="${f(w * 2)}" stroke-linejoin="round">${ds.map(d => `<path d="${d}"/>`).join('')}</g>`
  + `<g fill="${c}">${ds.map(d => `<path d="${d}"/>`).join('')}</g><g fill="url(#av-clU)">${ds.map(d => `<path d="${d}"/>`).join('')}</g><g fill="url(#av-clxU)">${ds.map(d => `<path d="${d}"/>`).join('')}</g>`;
const cloth = (d, c, w) => clothSet([d], c, w);
const metal = (d, grad = 'av-steel', w = 0.45) => `<path d="${d}" fill="url(#${grad})" stroke="#1d2026" stroke-width="${w}" stroke-linejoin="round"/>`;
const rivet = (x, y, r = 0.55) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="url(#av-steel)" stroke="#1d2026" stroke-width=".25"/>`;
const stitch = (d, c) => `<path d="${d}" fill="none" stroke="${sh(c, 0.35)}" stroke-width=".3" stroke-dasharray=".7 .7" opacity=".7"/>`;
const folds = (list, c, op = 0.55) => `<path d="${list.join('')}" fill="none" stroke="${sh(c, -0.45)}" stroke-width=".5" stroke-linecap="round" opacity="${op}"/>`;
// открытая шея и грудь — кожа с ключицами
function chest(g, skin, d) {
  const nw = g.nw;
  return `<path d="${d}" fill="${skin}"/><path d="${d}" fill="url(#av-skr)"/>${soft(50, 73, nw + 2, 3, 0.25)}`
    + `<path d="M${P(50 - nw - 5, 74.6)}Q${P(50 - 4, 76.4)} ${P(48.8, 75.6)}M${P(50 + nw + 5, 74.6)}Q${P(50 + 4, 76.4)} ${P(51.2, 75.6)}" fill="none" stroke="${sh(skin, -0.4)}" stroke-width=".5" stroke-linecap="round" opacity=".55"/>`
    + `<path d="M50 76.8v6" stroke="${sh(skin, -0.35)}" stroke-width=".45" opacity=".35"/>`;
}
let furN = 0;
const fur = (base, d, edgeSeed = 0) => {
  const id = 'avf' + (furN++).toString(36);
  let s = `<path d="${d}" fill="${base}" stroke="${sh(base, -0.55)}" stroke-width="1.1" stroke-dasharray="1.2 .8" stroke-linejoin="round"/><path d="${d}" fill="${base}"/><path d="${d}" fill="url(#av-clU)"/>`;
  const ls = [];
  for (let i = 0; i < 40; i++) { const x = 12 + ((i * 41 + edgeSeed * 7) % 76), y = 68 + ((i * 17) % 26); ls.push(`M${P(x, y)}l${f(((i % 3) - 1) * 0.5)} 1.8`); }
  return s + `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">` + lines(ls, base, 0.3, 0.45, 0.45) + lines(ls.map(q => q.replace(/^M([\d.]+)/, (_, x) => 'M' + f(+x + 0.8))), base, -0.5, 0.45, 0.5) + '</g>';
};

function outfit(g, v, C, skin) {
  const nw = g.nw, sw = g.sw, T = torsoPath(g), fem = v.gender === 1;
  const Cd = sh(C, -0.4), Cl = sh(C, 0.18);
  let back = '', body = '';
  switch (v.outfit) {
    case 0: default: {   // льняная рубаха с распахнутым воротом и шнуровкой
      const vn = `M${P(50 - nw + 0.6, 70.6)}C${P(50 - nw + 1.4, 75.6)} ${P(48.6, 79.6)} ${P(50, 84)}C${P(51.4, 79.6)} ${P(50 + nw - 1.4, 75.6)} ${P(50 + nw - 0.6, 70.6)}Z`;
      const flap = `M${P(50 - nw - 0.6, 70.4)}C${P(50 - nw - 3.4, 74)} ${P(50 - nw - 2, 79.6)} ${P(49.6, 84.6)}L${P(50, 84)}C${P(48.6, 79.6)} ${P(50 - nw + 1.4, 75.6)} ${P(50 - nw + 0.6, 70.6)}Z`;
      body = cloth(T, C) + chest(g, skin, vn) + clothSet([flap, mirD(flap)], Cl, 0.4)
        + `<path d="M${P(48.6, 77)}L${P(51.4, 78.6)}M${P(51.4, 77)}L${P(48.6, 78.6)}M${P(48.9, 79.8)}L${P(51.1, 81.2)}M${P(51.1, 79.8)}L${P(48.9, 81.2)}" stroke="#d9cdb2" stroke-width=".38"/>`
        + folds([`M${P(50 - sw + 6, 82)}q4 4 5 14`, `M${P(50 + sw - 6, 82)}q-4 4 -5 14`, `M${P(41, 88)}q1 5 0 12`, `M${P(59, 88)}q-1 5 0 12`], C);
      break;
    }
    case 1: {   // кожаная куртка поверх рубахи, ремни с пряжками
      const col = `M${P(50 - nw - 0.8, 70.6)}Q${P(50, 77.6)} ${P(50 + nw + 0.8, 70.6)}L${P(50 + nw + 2, 72.4)}Q${P(50, 80)} ${P(50 - nw - 2, 72.4)}Z`;
      body = cloth(T, C) + chest(g, skin, `M${P(50 - nw, 70)}Q${P(50, 77)} ${P(50 + nw, 70)}Z`) + cloth(col, LINEN, 0.4)
        + `<path d="M50 79.6V102" stroke="${sh(C, -0.6)}" stroke-width=".7"/>`
        + [83.6, 90.6, 97.6].map(y => `<path d="M${P(43.6, y)}H${P(56.4, y)}" stroke="${sh(C, -0.55)}" stroke-width="2.3"/><path d="M${P(43.6, y)}H${P(56.4, y)}" stroke="${sh(C, -0.2)}" stroke-width="1.5"/><rect x="${f(48.4)}" y="${f(y - 1.4)}" width="3.2" height="2.8" rx=".4" fill="none" stroke="${BRONZE}" stroke-width=".55"/>`).join('')
        + stitch(`M${P(50 - sw + 5, 79)}Q${P(50 - nw - 6, 75.4)} ${P(50 - nw - 2.4, 73.4)}M${P(50 + sw - 5, 79)}Q${P(50 + nw + 6, 75.4)} ${P(50 + nw + 2.4, 73.4)}`, C)
        + soft(50 - sw + 8, 82, 5, 2.4, 0.25, 'av-hl');
      break;
    }
    case 2: {   // кольчуга и сюрко
      const coif = `M${P(50 - nw - 1.6, 66)}C${P(50 - nw - 1, 70)} ${P(50 - nw - 3, 73)} ${P(50 - nw - 5, 75)}L${P(50 + nw + 5, 75)}C${P(50 + nw + 3, 73)} ${P(50 + nw + 1, 70)} ${P(50 + nw + 1.6, 66)}Q${P(50, 71)} ${P(50 - nw - 1.6, 66)}Z`;
      const tab = `M${P(50 - nw - 2.6, 75)}Q${P(50, 79.4)} ${P(50 + nw + 2.6, 75)}L${P(50 + nw + 6.4, 102)}L${P(50 - nw - 6.4, 102)}Z`;
      body = `<path d="${T}" fill="#6f757e"/><path d="${T}" fill="url(#av-mail)"/><path d="${T}" fill="url(#av-clU)"/><path d="${T}" fill="none" stroke="#1d2026" stroke-width=".55"/>`
        + `<path d="${coif}" fill="#6f757e"/><path d="${coif}" fill="url(#av-mail)"/><path d="${coif}" fill="url(#av-cl)"/><path d="${coif}" fill="none" stroke="#1d2026" stroke-width=".5"/>`
        + cloth(tab, C) + `<path d="M${P(50 - nw - 1.4, 76.8)}Q${P(50, 81)} ${P(50 + nw + 1.4, 76.8)}M${P(50 - nw - 4.2, 80)}L${P(50 - nw - 6.8, 102)}M${P(50 + nw + 4.2, 80)}L${P(50 + nw + 6.8, 102)}" fill="none" stroke="${BRONZE}" stroke-width=".55" opacity=".8"/>`
        + `<path d="M50 84l2.6 4.6l-2.6 4.6l-2.6 -4.6z" fill="${sh(C, 0.35)}" stroke="${Cd}" stroke-width=".4" opacity=".85"/>`;
      break;
    }
    case 3: {   // латы: плащ за спиной, кираса, наплечники, горжет
      const breast = `M${P(50 - nw - 4, 74)}Q${P(50, 77)} ${P(50 + nw + 4, 74)}C${P(50 + nw + 8, 82)} ${P(50 + nw + 9, 92)} ${P(50 + nw + 8, 102)}L${P(50 - nw - 8, 102)}C${P(50 - nw - 9, 92)} ${P(50 - nw - 8, 82)} ${P(50 - nw - 4, 74)}Z`;
      const pd = `M${P(50 - sw + 9, 75.6)}C${P(50 - sw + 3, 74.2)} ${P(50 - sw - 4.4, 77.4)} ${P(50 - sw - 4.6, 86)}C${P(50 - sw - 3, 88.6)} ${P(50 - sw + 3.6, 89.4)} ${P(50 - sw + 10, 86.6)}C${P(50 - sw + 11, 82)} ${P(50 - sw + 11, 78)} ${P(50 - sw + 9, 75.6)}Z`;
      const lame = `M${P(50 - sw - 4.4, 87)}C${P(50 - sw - 3, 90.6)} ${P(50 - sw + 4, 91.6)} ${P(50 - sw + 10.4, 88.4)}L${P(50 - sw + 10.6, 91)}C${P(50 - sw + 4, 94.4)} ${P(50 - sw - 3, 93.6)} ${P(50 - sw - 4.4, 90)}Z`;
      const gor = `M${P(50 - nw - 1.2, 67.6)}Q${P(50, 70.4)} ${P(50 + nw + 1.2, 67.6)}L${P(50 + nw + 4, 75.2)}Q${P(50, 79.6)} ${P(50 - nw - 4, 75.2)}Z`;
      const one = metal(lame) + metal(pd) + `<path d="M${P(50 - sw - 2.4, 80.4)}C${P(50 - sw + 2, 78)} ${P(50 - sw + 7, 78.4)} ${P(50 - sw + 10, 80.6)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".45"/>` + rivet(50 - sw + 7.8, 78.6) + rivet(50 - sw - 1.6, 84.4);
      body = cloth(T, C) + metal(breast) + `<path d="M50 77.4V102" stroke="#fff" stroke-opacity=".3" stroke-width=".6"/><path d="M50.6 77.4V102" stroke="#1d2026" stroke-opacity=".5" stroke-width=".5"/>`
        + soft(46, 88, 4, 7, 0.22, 'av-hl') + one + `<g transform="${MIRROR}">${one}</g>` + metal(gor)
        + `<path d="M${P(50 - nw - 2.6, 72)}Q${P(50, 76)} ${P(50 + nw + 2.6, 72)}" fill="none" stroke="#1d2026" stroke-width=".45"/>` + rivet(50 - nw - 2, 73.6, 0.45) + rivet(50 + nw + 2, 73.6, 0.45);
      break;
    }
    case 4: {   // мантия мага: стоячий воротник за головой, отделка тесьмой, застёжка с камнем
      const col = `M${P(50 - nw - 1, 74)}C${P(50 - nw - 4, 66)} ${P(50 - nw - 9, 59)} ${P(50 - nw - 12, 55)}C${P(50 - nw - 6, 56)} ${P(50 - 4, 60)} ${P(50, 60)}C${P(54, 60)} ${P(50 + nw + 6, 56)} ${P(50 + nw + 12, 55)}C${P(50 + nw + 9, 59)} ${P(50 + nw + 4, 66)} ${P(50 + nw + 1, 74)}Z`;
      back = cloth(col, Cd, 0.5) + `<path d="M${P(50 - nw - 11.4, 55.6)}C${P(50 - nw - 6, 56.6)} ${P(46, 60.4)} ${P(50, 60.6)}C${P(54, 60.4)} ${P(50 + nw + 6, 56.6)} ${P(50 + nw + 11.4, 55.6)}" fill="none" stroke="${BRONZE}" stroke-width=".8" opacity=".85"/>`;
      const lap = `M${P(50 - nw - 0.6, 70.6)}C${P(50 - nw - 1, 78)} ${P(47, 86)} ${P(50, 92)}L${P(50, 102)}L${P(50 - 4, 102)}C${P(50 - 5, 92)} ${P(50 - nw - 4, 82)} ${P(50 - nw - 3, 72)}Z`;
      body = cloth(T, C) + chest(g, skin, `M${P(50 - nw + 0.6, 70.4)}C${P(50 - nw + 1, 76)} ${P(48.6, 80)} ${P(50, 82)}C${P(51.4, 80)} ${P(50 + nw - 1, 76)} ${P(50 + nw - 0.6, 70.4)}Z`)
        + `<path d="M${P(50 - nw + 0.6, 71.4)}C${P(50 - nw + 1.4, 77)} ${P(48.8, 81)} ${P(50, 83)}C${P(51.2, 81)} ${P(50 + nw - 1.4, 77)} ${P(50 + nw - 0.6, 71.4)}" fill="${sh(C, -0.55)}" opacity=".9"/>`
        + clothSet([lap, mirD(lap)], C, 0.45)
        + `<path d="M${P(50 - nw - 1.6, 71.4)}C${P(50 - nw - 2.2, 79)} ${P(47, 86.4)} ${P(49.4, 92)}V102M${P(50 + nw + 1.6, 71.4)}C${P(50 + nw + 2.2, 79)} ${P(53, 86.4)} ${P(50.6, 92)}V102" fill="none" stroke="${BRONZE}" stroke-width="1.3" opacity=".9"/>`
        + `<path d="M${P(50 - nw - 1.6, 71.4)}C${P(50 - nw - 2.2, 79)} ${P(47, 86.4)} ${P(49.4, 92)}V102M${P(50 + nw + 1.6, 71.4)}C${P(50 + nw + 2.2, 79)} ${P(53, 86.4)} ${P(50.6, 92)}V102" fill="none" stroke="#2a1c0c" stroke-width=".4" stroke-dasharray=".5 1" opacity=".8"/>`
        + `<circle cx="50" cy="92" r="1.8" fill="#3a6a8a" stroke="url(#av-gold)" stroke-width=".8"/><circle cx="49.4" cy="91.4" r=".5" fill="#fff" opacity=".7"/>`;
      break;
    }
    case 5: {   // плащ с меховым воротником
      const F = mix('#6a5846', C, 0.12);
      const mantle = `M${P(50 - sw - 1.6, 86)}C${P(50 - sw + 1, 75)} ${P(50 - nw - 6, 69.6)} ${P(50, 69.6)}C${P(50 + nw + 6, 69.6)} ${P(50 + sw - 1, 75)} ${P(50 + sw + 1.6, 86)}C${P(50 + sw - 4, 88)} ${P(50 + sw - 8, 84)} ${P(50 + sw - 11, 81.6)}C${P(50 + nw + 4, 77)} ${P(54, 78.6)} ${P(50, 78.6)}C${P(46, 78.6)} ${P(50 - nw - 4, 77)} ${P(50 - sw + 11, 81.6)}C${P(50 - sw + 8, 84)} ${P(50 - sw + 4, 88)} ${P(50 - sw - 1.6, 86)}Z`;
      body = cloth(T, C) + `<path d="M${P(50 - 7, 78)}L${P(50 - 9, 102)}L${P(50 + 9, 102)}L${P(50 + 7, 78)}Z" fill="${sh(C, -0.5)}"/>` + folds([`M${P(50 - 7.6, 80)}L${P(50 - 9.6, 102)}`, `M${P(50 + 7.6, 80)}L${P(50 + 9.6, 102)}`], C, 0.8)
        + fur(F, mantle, 1) + `<circle cx="${f(50 - 4.6)}" cy="79.6" r="1.7" fill="url(#av-steel)" stroke="#1d2026" stroke-width=".35"/><circle cx="${f(50 + 4.6)}" cy="79.6" r="1.7" fill="url(#av-steel)" stroke="#1d2026" stroke-width=".35"/>`
        + `<path d="M${P(46.4, 80.2)}Q50 82 ${P(53.6, 80.2)}" fill="none" stroke="#a8adb5" stroke-width=".45" stroke-dasharray=".8 .4"/>`;
      break;
    }
    case 6: {   // дорожный плащ: капюшон откинут, фибула на плече
      const hood = `M${P(50 - nw - 7, 75)}C${P(50 - nw - 8, 66)} ${P(50 - nw - 4, 61)} ${P(50, 61)}C${P(50 + nw + 4, 61)} ${P(50 + nw + 8, 66)} ${P(50 + nw + 7, 75)}Z`;
      back = cloth(hood, sh(C, -0.25));
      const roll = `M${P(50 - nw - 0.8, 68.6)}C${P(50 - nw - 5, 69.4)} ${P(50 - nw - 9, 73)} ${P(50 - sw + 6, 78.6)}C${P(50 - nw - 8, 77.6)} ${P(50 - nw - 4, 75.6)} ${P(50 - nw + 1, 76.4)}Z`;
      const tun = `M${P(50 - nw + 0.4, 71)}Q${P(50, 77)} ${P(50 + nw - 0.4, 71)}L${P(50 + 5, 102)}L${P(50 - 5, 102)}Z`;
      body = cloth(T, C) + cloth(tun, '#3a3029', 0.4) + chest(g, skin, `M${P(50 - nw + 0.6, 70.4)}Q${P(50, 76)} ${P(50 + nw - 0.6, 70.4)}Z`)
        + clothSet([roll, mirD(roll)], Cl, 0.45) + folds([`M${P(50 - 5.4, 80)}L${P(50 - 6.4, 102)}`, `M${P(50 + 5.4, 80)}L${P(50 + 6.4, 102)}`, `M${P(50 - sw + 5, 84)}q3 6 3 16`, `M${P(50 + sw - 5, 84)}q-3 6 -3 16`], C, 0.7)
        + `<circle cx="${f(50 - nw - 5)}" cy="80" r="2.4" fill="none" stroke="url(#av-steel)" stroke-width="1.1"/><circle cx="${f(50 - nw - 5)}" cy="80" r="2.4" fill="none" stroke="#1d2026" stroke-width=".3"/><path d="M${P(50 - nw - 7.6, 81.4)}l5.2 -2.8" stroke="url(#av-steel)" stroke-width=".8"/>`;
      break;
    }
    case 7: {   // камзол: стоячий воротник, пуговицы, вышивка
      const col = `M${P(50 - nw - 0.8, 67.4)}Q${P(50 - nw, 71)} ${P(50 - 1.4, 74.6)}L${P(50 - 1.4, 76.4)}Q${P(50 - nw - 2.6, 74.6)} ${P(50 - nw - 3, 70.4)}Z`;
      const puff = `M${P(50 - sw + 3, 77.6)}C${P(50 - sw - 2.6, 77)} ${P(50 - sw - 4, 82)} ${P(50 - sw - 3.4, 87.4)}C${P(50 - sw, 88.4)} ${P(50 - sw + 4, 86)} ${P(50 - sw + 6, 82)}C${P(50 - sw + 6.4, 80)} ${P(50 - sw + 5, 78)} ${P(50 - sw + 3, 77.6)}Z`;
      body = cloth(T, C) + clothSet([puff, mirD(puff)], Cl, 0.45) + folds([`M${P(50 - sw + 0.6, 79)}q-1 4 -.6 8`, `M${P(50 + sw - 0.6, 79)}q1 4 .6 8`], Cl, 0.7)
        + `<path d="M${P(50 - nw - 2.6, 72)}Q${P(50, 77.4)} ${P(50 + nw + 2.6, 72)}" fill="none" stroke="${LINEN}" stroke-width="1.6"/>`
        + clothSet([col, mirD(col)], Cd, 0.4) + `<path d="${col}${mirD(col)}" fill="none" stroke="${BRONZE}" stroke-width=".45" opacity=".9"/>`
        + `<path d="M50 76.6V102" stroke="${sh(C, -0.6)}" stroke-width=".6"/>`
        + [79, 83, 87, 91, 95, 99].map(y => `<circle cx="50" cy="${y}" r=".95" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".3"/>`).join('')
        + `<path d="M${P(46.6, 79)}c-2.4 1.4 -2.4 4 -.6 5.6c1.6 1.2 1 3.4 -.8 4M${P(53.4, 79)}c2.4 1.4 2.4 4 .6 5.6c-1.6 1.2 -1 3.4 .8 4" fill="none" stroke="${BRONZE}" stroke-width=".45" opacity=".75"/>`;
      break;
    }
    case 8: {   // роба шахтёра: кожаные накладки, лямки, шейный платок
      const sc = lum(C) > 0.3 || hx(C)[0] > 110 ? '#5a3a28' : '#8a3a2a';
      const pad = `M${P(50 - sw + 3, 77.4)}C${P(50 - sw - 2, 77.6)} ${P(50 - sw - 3.6, 82)} ${P(50 - sw - 3.4, 86)}L${P(50 - sw + 6.4, 84.6)}C${P(50 - sw + 7, 81)} ${P(50 - sw + 6, 78.4)} ${P(50 - sw + 3, 77.4)}Z`;
      const scarf = `M${P(50 - nw - 0.6, 69.6)}Q${P(50, 76.4)} ${P(50 + nw + 0.6, 69.6)}L${P(50 + nw + 1.8, 73)}Q${P(50, 80)} ${P(50 - nw - 1.8, 73)}Z`;
      const knot = `M${P(48, 76.4)}L${P(46.4, 84)}L${P(48.8, 83)}L${P(50, 85)}L${P(51.2, 83)}L${P(53.6, 84)}L${P(52, 76.4)}Z`;
      body = cloth(T, C) + clothSet([pad, mirD(pad)], LEATHER, 0.45)
        + `<path d="M${P(50 - nw - 4.4, 74)}L${P(50 - nw - 2, 102)}M${P(50 + nw + 4.4, 74)}L${P(50 + nw + 2, 102)}" stroke="${sh(LEATHER, -0.4)}" stroke-width="2.6"/><path d="M${P(50 - nw - 4.4, 74)}L${P(50 - nw - 2, 102)}M${P(50 + nw + 4.4, 74)}L${P(50 + nw + 2, 102)}" stroke="${LEATHER}" stroke-width="1.9"/>`
        + `<circle cx="${f(50 - nw - 3.2)}" cy="88" r="1.2" fill="none" stroke="${BRONZE}" stroke-width=".55"/><circle cx="${f(50 + nw + 3.2)}" cy="88" r="1.2" fill="none" stroke="${BRONZE}" stroke-width=".55"/>`
        + cloth(scarf, sc, 0.4) + cloth(knot, sh(sc, -0.1), 0.4) + soft(56, 92, 4, 2.2, 0.35, 'av-sft');
      break;
    }
    case 9: {   // облачение жреца: высокий ворот, епитрахиль с солнцами
      const stole = `M${P(50 - nw - 1.6, 70)}C${P(50 - nw - 3, 76)} ${P(50 - 6.4, 84)} ${P(50 - 6.6, 102)}L${P(50 - 2, 102)}C${P(50 - 2, 86)} ${P(50 - nw + 1, 78)} ${P(50 - nw + 1.6, 72)}Z`;
      const S = lum(C) > 0.45 ? '#5a1f22' : '#c3baa8';
      const sun = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="1.3" fill="none" stroke="${BRONZE}" stroke-width=".5"/><path d="M${P(x, y - 2.4)}v1M${P(x, y + 1.4)}v1M${P(x - 2.4, y)}h1M${P(x + 1.4, y)}h1M${P(x - 1.7, y - 1.7)}l.7 .7M${P(x + 1, y + 1)}l.7 .7M${P(x + 1.7, y - 1.7)}l-.7 .7M${P(x - 1, y + 1)}l-.7 .7" stroke="${BRONZE}" stroke-width=".45"/>`;
      body = cloth(T, C) + `<path d="M${P(50 - nw - 0.4, 69)}Q${P(50, 74.4)} ${P(50 + nw + 0.4, 69)}L${P(50 + nw + 1.4, 72)}Q${P(50, 78)} ${P(50 - nw - 1.4, 72)}Z" fill="${sh(C, -0.25)}" stroke="${sh(C, -0.6)}" stroke-width=".4"/>`
        + clothSet([stole, mirD(stole)], S, 0.45) + `<path d="${stole}${mirD(stole)}" fill="none" stroke="${BRONZE}" stroke-width=".4" opacity=".7"/>` + sun(50 - 4.4, 92) + sun(50 + 4.4, 92)
        + folds([`M${P(50 - sw + 6, 82)}q3 6 2 18`, `M${P(50 + sw - 6, 82)}q-3 6 -2 18`], C);
      break;
    }
    case 10: {   // следопыт: кожаный доспех, короткая накидка, колчан за плечом
      for (const [dx, a, fc] of [[-2.4, -8, '#d6cfc0'], [2.6, 10, '#8c2f24'], [0, 0, '#d6cfc0']]) {
        const x = 50 + sw - 7 + dx, y = 63;
        back += `<g transform="rotate(${a} ${f(x)} 76)"><path d="M${P(x, 78)}V${f(y)}" stroke="#5a4330" stroke-width=".7"/><path d="M${P(x, y + 0.4)}l-1.3 1.2v4.2l1.3 -.9zM${P(x, y + 0.4)}l1.3 1.2v4.2l-1.3 -.9z" fill="${fc}" stroke="#3a3028" stroke-width=".3"/></g>`;
      }
      back += `<ellipse cx="${f(50 + sw - 7)}" cy="75.6" rx="4.4" ry="1.6" fill="#3a281b" stroke="#1e140d" stroke-width=".4" transform="rotate(-8 ${f(50 + sw - 7)} 75.6)"/>`;
      const cape = `M${P(50 - nw - 0.6, 70)}C${P(50 - nw - 6, 72)} ${P(50 - sw + 2, 76)} ${P(50 - sw - 2.6, 86)}L${P(50 - sw + 3, 88)}L${P(50 - sw + 6, 85.6)}L${P(50 - sw + 9.4, 88.6)}L${P(50 - nw - 6, 86)}L${P(50 - nw - 3, 89)}L${P(50 - 3, 86)}L50 88.4L${P(50 + 3, 86)}L${P(50 + nw + 3, 89)}L${P(50 + nw + 6, 86)}L${P(50 + sw - 9.4, 88.6)}L${P(50 + sw - 6, 85.6)}L${P(50 + sw - 3, 88)}L${P(50 + sw + 2.6, 86)}C${P(50 + sw - 2, 76)} ${P(50 + nw + 6, 72)} ${P(50 + nw + 0.6, 70)}Q${P(50, 76)} ${P(50 - nw - 0.6, 70)}Z`;
      body = cloth(T, '#4a3626') + cloth(cape, C, 0.45)
        + `<path d="M${P(50 + sw - 6, 80)}L${P(50 - nw - 6, 102)}" stroke="#2a1d14" stroke-width="3.2"/><path d="M${P(50 + sw - 6, 80)}L${P(50 - nw - 6, 102)}" stroke="#6a4c34" stroke-width="2.4"/>`
        + `<rect x="${f(50 - 2.2)}" y="91.4" width="3" height="3" rx=".5" transform="rotate(-36 ${f(50 - 0.7)} 92.9)" fill="none" stroke="${BRONZE}" stroke-width=".6"/>`
        + folds([`M${P(50 - 10, 76)}l-2 9`, `M${P(50 + 10, 76)}l2 9`, `M${P(50 - sw + 6, 79)}l-3 7`], C, 0.6);
      break;
    }
    case 11: {   // шкуры на голые плечи, ремень с бляхами
      const F = mix('#5e4a38', C, 0.18);
      const pelt = `M${P(50 - nw - 1, 71.6)}C${P(50 - nw - 6, 73)} ${P(50 - sw + 2, 75)} ${P(50 - sw - 2.6, 82)}L${P(50 - sw - 3.6, 92)}L${P(50 - sw + 0.6, 89.6)}L${P(50 - sw + 3, 93)}L${P(50 - sw + 5, 88.6)}L${P(50 - sw + 8.4, 91)}L${P(50 - sw + 9, 86)}L${P(50 - nw - 4.4, 84.4)}L${P(50 - nw - 3, 79)}L${P(50 - nw - 0.4, 76.6)}Z`;
      body = `<path d="${T}" fill="${skin}"/><path d="${T}" fill="url(#av-clxU)"/><path d="${T}" fill="url(#av-clU)" opacity=".7"/><path d="${T}" fill="none" stroke="${sh(skin, -0.5)}" stroke-width=".5"/>`
        + chest(g, skin, `M${P(50 - nw, 70)}Z`)
        + `<path d="M${P(41, 86)}Q${P(45, 90.6)} ${P(49.4, 88.6)}M${P(59, 86)}Q${P(55, 90.6)} ${P(50.6, 88.6)}" fill="none" stroke="${sh(skin, -0.4)}" stroke-width=".55" opacity=".5"/>`
        + fur(F, pelt, 2) + `<g transform="${MIRROR}">${fur(F, pelt, 3)}</g>`
        + `<path d="M${P(50 - sw + 4, 80)}L${P(50 + nw + 8, 102)}" stroke="#2a1d14" stroke-width="3"/><path d="M${P(50 - sw + 4, 80)}L${P(50 + nw + 8, 102)}" stroke="${LEATHER}" stroke-width="2.3"/>`
        + [0.3, 0.5, 0.7].map(u => rivet(50 - sw + 4 + (nw + sw + 4) * u, 80 + 22 * u, 0.6)).join('');
      break;
    }
    case 12: {   // платье с корсажем и сорочкой
      const neckline = `M${P(50 - nw - 6, 74)}C${P(50 - nw - 5.4, 80)} ${P(50 - 5, 84.4)} ${P(50, 84.4)}C${P(50 + 5, 84.4)} ${P(50 + nw + 5.4, 80)} ${P(50 + nw + 6, 74)}L${P(50 + nw, 70)}L${P(50 - nw, 70)}Z`;
      const bod = `M${P(50 - 7.6, 83.4)}Q50 86.4 ${P(50 + 7.6, 83.4)}L${P(50 + 6.4, 102)}L${P(50 - 6.4, 102)}Z`;
      const puff = `M${P(50 - sw + 2.4, 77)}C${P(50 - sw - 3, 76.6)} ${P(50 - sw - 4.4, 82)} ${P(50 - sw - 3.6, 88)}C${P(50 - sw, 89)} ${P(50 - sw + 5, 86)} ${P(50 - sw + 6.6, 81)}C${P(50 - sw + 6.4, 78.6)} ${P(50 - sw + 4.6, 77.2)} ${P(50 - sw + 2.4, 77)}Z`;
      body = cloth(T, C) + chest(g, skin, neckline)
        + `<path d="M${P(50 - nw - 6, 74)}C${P(50 - nw - 5.4, 80)} ${P(50 - 5, 84.4)} ${P(50, 84.4)}C${P(50 + 5, 84.4)} ${P(50 + nw + 5.4, 80)} ${P(50 + nw + 6, 74)}" fill="none" stroke="#e6ddca" stroke-width="1.5" stroke-dasharray="1 .5"/>`
        + cloth(bod, sh(C, -0.35), 0.4) + `<path d="M${P(48.4, 86.6)}L${P(51.6, 89.4)}M${P(51.6, 86.6)}L${P(48.4, 89.4)}M${P(48.6, 90.6)}L${P(51.4, 93.4)}M${P(51.4, 90.6)}L${P(48.6, 93.4)}M${P(48.8, 94.6)}L${P(51.2, 97.4)}M${P(51.2, 94.6)}L${P(48.8, 97.4)}" stroke="#d9cdb2" stroke-width=".4"/>`
        + clothSet([puff, mirD(puff)], Cl, 0.45) + folds([`M${P(50 - sw - 1, 80)}q1.6 3 1 7`, `M${P(50 + sw + 1, 80)}q-1.6 3 -1 7`], Cl, 0.6);
      break;
    }
  }
  return { back, body };
}

// ───────────── волосы ─────────────
// волосы: контур под заливкой (не виден внутри сложных форм), общий для всей головы свет
const hairSet = (ds, c, w = 0.5) => `<g fill="none" stroke="${sh(c, -0.55)}" stroke-width="${f(w * 2)}" stroke-linejoin="round">${ds.map(d => `<path d="${d}"/>`).join('')}</g>`
  + `<g fill="${c}">${ds.map(d => `<path d="${d}"/>`).join('')}</g><g fill="url(#av-hrU)">${ds.map(d => `<path d="${d}"/>`).join('')}</g>`;
const hairPaint = (d, c, w = 0.5) => hairSet([d], c, w);
const lines = (list, c, k, w = 0.4, op = 0.7) => `<path d="${list.join('')}" fill="none" stroke="${k < 0 ? sh(c, k) : sh(c, k)}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
const strands = (list, c) => lines(list, c, -0.4, 0.4, 0.75);
const shine = (list, c) => lines(list, c, 0.32, 0.34, 0.5);
// «шапка» волос: внешний край вокруг черепа и линия роста на лбу; part — сдвиг пробора, dip — его глубина
function cap(g, o = {}) {
  const t = g.templeW, T = g.top - (o.vol ?? 2), hl = o.hl ?? g.hairY, side = o.side ?? 1.4, sy = o.sy ?? g.browY + 2.2;
  const L = 50 - t - side, ti = t - 0.8, pk = o.part ?? 0, cr = o.corner ?? 1.2;
  return `M${P(L, sy)}C${P(L - 0.7, T + 11)} ${P(50 - t * 0.78 - side, T)} ${P(50, T)}C${P(50 + t * 0.78 + side, T)} ${P(100 - L + 0.7, T + 11)} ${P(100 - L, sy)}`
    + `L${P(50 + ti, sy)}C${P(50 + ti + 0.3, hl + 7)} ${P(50 + ti - 1, hl + 3)} ${P(50 + ti - 3.5, hl + cr)}`
    + `C${P(56, hl - 0.2)} ${P(52.5 + pk, hl + 0.3)} ${P(50 + pk, hl + (o.dip ?? 0))}`
    + `C${P(47.5 + pk, hl + 0.3)} ${P(44, hl - 0.2)} ${P(50 - ti + 3.5, hl + cr)}`
    + `C${P(50 - ti + 1, hl + 3)} ${P(50 - ti - 0.3, hl + 7)} ${P(50 - ti, sy)}Z`;
}
// прядь вдоль лица до плеч (левая; правая — зеркально)
function curtain(g, len, w = 4, wave = 0) {
  const x0 = 50 - g.templeW, c = g.cheekW, j = g.jawW, nw = g.nw;
  return `M${P(x0 + 1.6, g.hairY + 4)}C${P(x0 - 2, g.hairY + 2)} ${P(x0 - 3.2, g.browY - 4)} ${P(x0 - 3.4, g.browY + 2)}`
    + `C${P(x0 - 3.6 - w * 0.3 - wave, g.mouthY - 6)} ${P(x0 - 2.4 - w + wave, len - 14)} ${P(x0 - 1.6 - w, len)}`
    + `C${P(x0 + 1 - w * 0.4, len + 1.4)} ${P(x0 + 4 - w * 0.2, len + 1.2)} ${P(50 - nw - 2, len - 1)}`
    + `C${P(50 - nw - 1.6 + wave, 80)} ${P(50 - nw - 0.5, 72)} ${P(50 - j + 0.4, g.mouthY + 3)}`
    + `C${P(50 - j - 0.8, g.mouthY - 3)} ${P(50 - c + 0.9, g.eyeY + 6)} ${P(50 - c + 1, g.eyeY + 1)}`
    + `C${P(50 - c + 1.2, g.browY - 3)} ${P(x0 + 1.4, g.hairY + 7)} ${P(x0 + 1.6, g.hairY + 4)}Z`;
}
const backLong = (g, len, w) => sym([50, g.top], [
  [[44, g.top], [50 - g.templeW - 3, g.top + 6], [50 - g.templeW - 3, g.browY - 4]],
  [[50 - g.templeW - 4 - w * 0.4, g.mouthY], [50 - g.templeW - 2 - w, len - 10], [50 - g.templeW - 1 - w, len]],
  [[45, len + 1], [48, len + 1], [50, len + 1]],
]);
// коса из звеньев вдоль кривой
function braid(c, pts, r = 2.3) {
  let s = '';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i], a = i % 2 ? 28 : -28;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 0.72)}" transform="rotate(${a} ${f(x)} ${f(y)})" fill="${c}" stroke="${sh(c, -0.5)}" stroke-width=".45"/>`
      + `<path d="M${P(x - r * 0.5, y - 0.2)}q${f(r * 0.5)} -.5 ${f(r)} 0" transform="rotate(${a} ${f(x)} ${f(y)})" fill="none" stroke="${sh(c, 0.35)}" stroke-width=".35" opacity=".55"/>`;
  }
  return s;
}
const along = (x0, y0, x1, y1, bend, n) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return [x0 + (x1 - x0) * u + Math.sin(u * Math.PI) * bend, y0 + (y1 - y0) * u]; });
const hairShadow = g => soft(50, g.hairY + 2.2, 10.5, 2.4, 0.3);

function hairStyle(g, v, c, skin, covered) {
  const t = g.templeW, b = g.browY, T = g.top, hl = g.hairY, n = g.nw;
  let back = '', front = '';
  switch (v.hair) {
    case 0: break;
    case 1: {
      const d = cap(g, { vol: 1.7, side: 1.1, sy: b + 1.4 });
      front = hairShadow(g) + hairPaint(d, c) + strands([-3, -2, -1, 0, 1, 2, 3].map(i => `M${P(50 + i * 3.4, T + 0.6)}l${f(i * 0.5)} 3.4`), c)
        + shine([`M${P(42, T + 2)}q4 -1.6 8 -1.4`], c);
      break;
    }
    case 2: {
      const d = cap(g, { vol: 2.8, hl: hl - 1.4, corner: -0.8, side: 1, sy: b + 0.8 });
      front = hairShadow(g) + hairPaint(d, c) + strands([-3, -2, -1, 1, 2, 3].map(i => `M${P(50 + i * 3, hl)}Q${P(50 + i * 3.6, T + 5)} ${P(50 + i * 4.4, T - 1)}`), c)
        + shine([`M${P(46, hl - 0.6)}Q${P(45.4, T + 4)} ${P(44, T - 1.6)}`, `M${P(53, hl - 0.6)}Q${P(53.4, T + 4)} ${P(54.6, T - 1.6)}`], c);
      break;
    }
    case 3: case 4: {
      const wavy = v.hair === 4, len = wavy ? 93 : 90, w = wavy ? 6 : 4;
      back = hairPaint(backLong(g, len - 6, w + 2), sh(c, -0.25));
      const d = cap(g, wavy ? { vol: 3.4, part: -5, dip: -0.6, side: 2 } : { vol: 2.2, dip: -1.8, side: 1.6 });
      const cu = curtain(g, len, w, wavy ? 1.6 : 0);
      const parts = [cu, mirD(cu), d];
      if (wavy) parts.push(`M${P(45, T - 1.4)}C${P(53, hl - 2.4)} ${P(58, hl + 2.6)} ${P(50 + t - 0.6, b - 2)}L${P(50 + t + 2.4, b - 7)}C${P(50 + t, T + 6)} ${P(53, T)} ${P(45, T - 1.4)}Z`);
      front = hairShadow(g) + hairSet(parts, c);
      if (wavy) front += strands([`M${P(46, T)}C${P(52, hl - 1.6)} ${P(56, hl + 1)} ${P(50 + t - 1.2, b - 3.4)}`, `M${P(48, T - 0.6)}C${P(54, hl - 3)} ${P(58, hl)} ${P(50 + t + 0.6, b - 5.4)}`], c);
      else front += lines([`M${P(50, hl - 1.6)}L${P(50, T + 1)}`], c, -0.55, 0.5, 0.8);
      const ls = [0, 1, 2].map(i => `M${P(50 - t - 1 - i * 1.2, b + 2)}C${P(50 - t - 2 - i * 1.4, 64)} ${P(50 - t - 3 - i * 1.2 + (wavy ? 2 : 0), 76)} ${P(50 - t - 2.5 - i * 1.6, len - 3)}`);
      front += strands(ls, c) + `<g transform="${MIRROR}">${strands(ls, c)}</g>` + shine([`M${P(50 - t - 2.2, b)}C${P(50 - t - 3, 60)} ${P(50 - t - 3.6, 72)} ${P(50 - t - 3, 84)}`], c);
      break;
    }
    case 5: case 6: case 7: case 8: case 13: {
      const d = cap(g, { vol: 1.3, side: 0.9, sy: b + 1, dip: v.hair === 6 || v.hair === 7 ? -1.2 : 0 });
      front = hairShadow(g) + hairPaint(d, c)
        + strands([-3, -2, -1, 1, 2, 3].map(i => `M${P(50 + i * 3.2, hl + 0.4)}Q${P(50 + i * 2.6, T + 4)} ${P(50 + i * 1.2, T - 0.6)}`), c)
        + shine([`M${P(45, hl)}Q${P(44, T + 5)} ${P(47, T - 0.4)}`], c);
      if (v.hair === 5) {
        const tail = `M${P(50 + t - 0.6, b + 3)}C${P(50 + t + 4.6, b + 12)} ${P(50 + t + 7.4, 70)} ${P(50 + t + 5, 93)}C${P(50 + t + 3, 94)} ${P(50 + t + 1.4, 89)} ${P(50 + t + 1.6, 80)}C${P(50 + t + 1.2, 66)} ${P(50 + t - 1.8, b + 12)} ${P(50 + t - 1.6, b + 4)}Z`;
        front += hairPaint(tail, c) + strands([`M${P(50 + t + 1, b + 8)}C${P(50 + t + 4, 66)} ${P(50 + t + 4.4, 78)} ${P(50 + t + 3.4, 90)}`], c)
          + `<path d="M${P(50 + t - 1.4, b + 6.6)}l3.4 -1.2" stroke="#3a2a1e" stroke-width="1.4" stroke-linecap="round"/>`;
      }
      if (v.hair === 6 || v.hair === 7) {
        const pts = along(50 - t + 1, b + 9, 50 - t - 2, 90, -2.4, 15);
        let br = braid(c, pts) + `<path d="M${P(pts[14][0] - 1.4, 92)}l2.8 0" stroke="#3a2a1e" stroke-width="1.3"/><path d="M${P(pts[14][0] - 1.6, 93)}l-.4 3M${P(pts[14][0], 93)}v3.4M${P(pts[14][0] + 1.4, 93)}l.4 3" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/>`;
        front += br + (v.hair === 7 ? `<g transform="${MIRROR}">${br}</g>` : '');
      }
      if (v.hair === 8 && !covered) front = hairPaint(`M${P(44.6, T - 2.4)}a5.4 5 0 1 1 10.8 0a5.4 5 0 1 1 -10.8 0Z`, c)
        + lines([`M${P(46.4, T - 3.8)}q3.6 -3 7 0`, `M${P(46.2, T - 1.6)}q3.8 -1.6 7.6 .6`], c, -0.45, 0.4, 0.8)
        + `<path d="M${P(45.6, T + 0.6)}q4.4 1.4 8.8 0" stroke="#3a2a1e" stroke-width="1.2" fill="none"/>` + front;
      if (v.hair === 13 && !covered) front = hairPaint(`M${P(51, T - 3.4)}C${P(57, T - 6)} ${P(62, T - 2)} ${P(64, T + 4.6)}C${P(60, T + 1)} ${P(56, T - 1.4)} ${P(52, T - 0.4)}Z`, c)
        + hairPaint(`M${P(46.6, T - 2.2)}a3.4 3 0 1 1 6.8 0a3.4 3 0 1 1 -6.8 0Z`, c)
        + `<path d="M${P(46.8, T + 0.2)}q3.2 1 6.4 0" stroke="#3a2a1e" stroke-width="1.1" fill="none"/>` + front;
      break;
    }
    case 9: {
      const d = cap(g, { vol: 3.8, side: 3.4, sy: b + 4.4, hl: hl + 0.6 });
      const bump = (x, y, r) => `M${P(x - r, y)}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
      let bumps = '', i = 0;
      for (let a = 180; a <= 360; a += 20) { const r = a * Math.PI / 180; bumps += bump(50 + Math.cos(r) * (t + 3.6), T + 9 + Math.sin(r) * 11.6, 3 + (i++ % 2) * 0.5); }
      for (const x of [-7.5, -2.5, 2.5, 7.5]) bumps += bump(50 + x, hl + 0.2, 2.6);
      let bk = sym([50, T], [[[42, T], [50 - t - 6, T + 8], [50 - t - 6, b + 4]], [[50 - t - 7, g.mouthY + 2], [50 - t - 4, g.mouthY + 7], [50 - t, g.mouthY + 7]], [[46, g.mouthY + 7], [48, g.mouthY + 7], [50, g.mouthY + 7]]]);
      [[b + 3, 3.4, 0], [b + 8.5, 3, 1], [g.noseY + 3, 3.6, 0.4], [g.mouthY + 4, 3.2, 1.6], [g.mouthY + 8, 2.6, 4]].forEach(([y, r, dx]) => { bk += bump(50 - t - 5.2 + dx, y, r) + bump(50 + t + 5.2 - dx, y, r); });
      back = hairPaint(bk, sh(c, -0.2), 0.45);
      front = hairShadow(g) + hairPaint(d + bumps, c, 0.45);
      const curls = [];
      for (let k = 0; k < 14; k++) { const x = 50 - t - 1 + (k * 37 % 31) + (k % 3), y = T + 1 + (k * 13 % 9); curls.push(`M${P(x, y)}a1.3 1.3 0 1 1 1.6 1.4`); }
      front += lines(curls, c, -0.45, 0.4, 0.8) + lines(curls.slice(0, 7).map(q => q.replace(/^M([\d.]+) ([\d.]+)/, (_, x, y) => `M${f(+x + 0.6)} ${f(+y - 0.5)}`)), c, 0.35, 0.3, 0.5);
      break;
    }
    case 10: case 11: {
      const stub = mix(c, skin, 0.5);
      front = `<path d="${cap(g, { vol: 0.6, side: 0.6, sy: b + 1 })}" fill="${stub}" opacity=".75"/>`;
      if (v.hair === 10) {
        const hi = covered ? T - 0.5 : T - 7;
        const crest = `M${P(47.6, hl + 0.8)}C${P(46.6, T + 6)} ${P(46.6, T + 1)} ${P(47.4, hi + 2)}L${P(46.2, hi - 1)}L${P(49, hi + 1.4)}L${P(50, hi - 2)}L${P(51, hi + 1.4)}L${P(53.8, hi - 1)}L${P(52.6, hi + 2)}C${P(53.4, T + 1)} ${P(53.4, T + 6)} ${P(52.4, hl + 0.8)}Z`;
        front += hairPaint(crest, c) + strands([`M${P(50, hl)}L${P(50, hi + 1)}`, `M${P(48.6, hl)}L${P(48, hi + 3)}`, `M${P(51.4, hl)}L${P(52, hi + 3)}`], c);
      } else {
        const strip = `M${P(45, hl + 0.6)}C${P(44.4, T + 6)} ${P(45, T - 0.6)} ${P(50, T - 1.2)}C${P(55, T - 0.6)} ${P(55.6, T + 6)} ${P(55, hl + 0.6)}Q${P(50, hl - 0.6)} ${P(45, hl + 0.6)}Z`;
        front += hairPaint(strip, c) + braid(sh(c, 0.08), along(50, hl - 0.6, 50, T, 0, 5), 1.7);
      }
      break;
    }
    case 12: {
      const lo = g.chinY + 1.2, x0 = 50 - t;
      back = hairPaint(sym([50, T], [[[42, T], [x0 - 3, T + 6], [x0 - 3.4, b - 2]], [[x0 - 4.2, g.mouthY], [x0 - 4, lo], [x0 - 3, lo + 0.6]], [[44, lo + 1], [48, lo + 1], [50, lo + 1]]]), sh(c, -0.25));
      const side = `M${P(x0 + 1, b - 2.8)}C${P(50 - g.cheekW + 1, b)} ${P(50 - g.cheekW + 1.2, g.noseY)} ${P(50 - g.jawW + 0.4, g.mouthY + 1.6)}L${P(50 - g.jawW - 0.4, lo)}L${P(x0 - 4, lo + 0.6)}C${P(x0 - 4.4, g.mouthY)} ${P(x0 - 3.6, b)} ${P(x0 - 2.8, b - 6)}Z`;
      const bangs = `M${P(x0 - 2.6, b - 2)}C${P(x0 - 3.6, T + 9)} ${P(50 - t * 0.78 - 2, T - 2.6)} ${P(50, T - 2.6)}C${P(50 + t * 0.78 + 2, T - 2.6)} ${P(100 - x0 + 3.6, T + 9)} ${P(100 - x0 + 2.6, b - 2)}L${P(100 - x0 - 1, b - 2.6)}C${P(58, b - 3.6)} ${P(42, b - 3.6)} ${P(x0 + 1, b - 2.6)}Z`;
      front = soft(50, b - 1.2, 11, 1.8, 0.35) + hairPaint(side, c) + `<g transform="${MIRROR}">${hairPaint(side, c)}</g>` + hairPaint(bangs, c)
        + strands([-4, -3, -2, -1, 0, 1, 2, 3, 4].map(i => `M${P(50 + i * 2.6, T + 4)}L${P(50 + i * 2.9, b - 3.4)}`), c) + shine([`M${P(43, T + 1)}Q${P(48, T - 1.6)} ${P(55, T)}`], c);
      break;
    }
    case 14: {
      const x0 = 50 - t;
      back = hairPaint(backLong(g, g.mouthY + 12, 3), sh(c, -0.25));
      let fr = `M${P(x0 - 3.2, g.mouthY + 4)}C${P(x0 - 5, b)} ${P(x0 - 4, T + 2)} ${P(50, T - 3.2)}C${P(100 - x0 + 4, T + 2)} ${P(100 - x0 + 5, b)} ${P(100 - x0 + 3.2, g.mouthY + 4)}`;
      // рваный край: пряди вниз по щекам и на лоб
      const tips = [[100 - x0 + 1.4, g.mouthY + 1, 100 - x0 + 0.6, g.noseY], [100 - x0 - 0.2, b + 4, 100 - x0 - 1.4, b - 2], [58, b - 2.2, 56, hl + 4], [53, b - 1, 50, hl + 3.4], [46.6, b - 1.6, 44.6, hl + 3.6], [42, b - 2.6, 40.6, hl + 4.6], [x0 + 0.4, b + 3, x0 + 0.6, b - 1], [x0 - 1.2, g.mouthY + 1, x0 - 0.8, g.noseY]];
      for (const [x, y, x2, y2] of tips) fr += `L${P(x, y)}L${P(x2, y2)}`;
      fr += 'Z';
      front = hairShadow(g) + hairPaint(fr, c) + strands([`M${P(44, T + 1)}L${P(41.6, b - 4)}`, `M${P(50, T)}L${P(50.6, b - 3)}`, `M${P(56, T + 1)}L${P(57.6, b - 4)}`, `M${P(x0 - 2, b)}L${P(x0 - 1, g.mouthY)}`], c)
        + shine([`M${P(46, T + 0.6)}L${P(44.6, hl + 1)}`, `M${P(53, T + 0.4)}L${P(53.6, hl + 1)}`], c);
      break;
    }
    case 15: {
      back = hairPaint(backLong(g, 86, 5), sh(c, -0.3));
      const d = cap(g, { vol: 2.6, side: 1.8, sy: b + 2 });
      front = hairShadow(g) + hairPaint(d, c) + lines([-4, -3, -2, -1, 0, 1, 2, 3, 4].map(i => `M${P(50 + i * 2.8, hl + 0.6)}Q${P(50 + i * 3.4, T + 4)} ${P(50 + i * 1.8, T - 1.6)}`), c, -0.5, 0.5, 0.8);
      const rope = (x, y, x2, y2, bend) => `M${P(x, y)}Q${P((x + x2) / 2 + bend, (y + y2) / 2)} ${P(x2, y2)}`;
      const ropes = [rope(50 - t - 1.2, b - 4, 50 - t - 4.4, 88, -1), rope(50 - t + 0.4, b - 2, 50 - t - 1.4, 92, -2), rope(50 - t - 2.6, b - 6, 50 - t - 7, 84, 0.6), rope(50 - t + 1.8, b + 1, 50 - t + 1.6, 90, -2.6)];
      const R = `<path d="${ropes.join('')}" fill="none" stroke="${sh(c, -0.5)}" stroke-width="3.1" stroke-linecap="round"/><path d="${ropes.join('')}" fill="none" stroke="${c}" stroke-width="2.3" stroke-linecap="round"/>`
        + `<path d="${ropes.join('')}" fill="none" stroke="${sh(c, 0.3)}" stroke-width=".5" stroke-dasharray="1.1 1.4" stroke-linecap="round" opacity=".6"/>`;
      front += R + `<g transform="${MIRROR}">${R}</g>`;
      break;
    }
  }
  return { back, front };
}

// ───────────── борода и усы ─────────────
function beardPath(g, L, W, taper = 0) {
  const t = g.templeW, c = g.cheekW, j = g.jawW, m = g.mouthY, ch = g.chinY, mw = g.mw;
  return sym([50, g.noseY + 1.5], [
    [[47.4, g.noseY + 1.4], [50 - mw - 1.2, g.noseY + 2], [50 - mw - 1.8, m - 0.4]],
    [[50 - mw - 3.4, m - 3], [50 - c + 3.6, g.eyeY + 5.4], [50 - t + 1.2, g.browY + 3]],
    [[50 - t, g.browY + 3], [50 - t - 0.8, g.browY + 3], [50 - t - 0.9, g.browY + 3.6]],
    [[50 - c - 0.9 - W * 0.2, g.eyeY + 8], [50 - j - 1.2 - W, m - 2], [50 - j - 0.8 - W, m + 4]],
    [[50 - j - W * (0.8 - taper * 0.6), ch + L * 0.55], [50 - 6 - W * 0.4 + taper * 5, ch + L], [50, ch + L + 0.5]],
  ]);
}
const mustachePath = (g, droop = 1) => sym([50, g.noseY + 1.3], [
  [[47.4, g.noseY + 1], [50 - g.mw - 1, g.mouthY - 2], [50 - g.mw - 1.9, g.mouthY + droop]],
  [[50 - g.mw - 0.5, g.mouthY - 0.3], [47.4, g.mouthY - 1.3], [50, g.mouthY - 0.9]],
]);
function beard(g, v, c, skin) {
  const k = v.facial, ch = g.chinY, m = g.mouthY;
  if (!k) return { base: '', top: '' };
  if (k === 1) {
    const st = mix(c, skin, 0.25), id = 'avs' + (furN++).toString(36), d = beardPath(g, 0.2, -0.6);
    // щетина: мелкие точки внутри контура бороды и лёгкая тень
    let dots = '';
    for (let i = 0; i < 70; i++) dots += `<circle cx="${f(50 - g.jawW - 1 + ((i * 53) % 29) * (2 * g.jawW + 2) / 29)}" cy="${f(g.noseY + 2 + ((i * 31) % 17) * (g.chinY - g.noseY - 1) / 17)}" r=".22"/>`;
    return { base: `<path d="${d}" fill="${st}" opacity=".2"/><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})" fill="${sh(c, -0.2)}" opacity=".45">${dots}</g>`, top: '' };
  }
  const tex = (y0, y1, x) => strands(Array.from({ length: 9 }, (_, i) => { const xx = 50 + (i - 4) * x; return `M${P(xx, y0 + Math.abs(i - 4) * 0.4)}q${f((i - 4) * 0.2)} ${f((y1 - y0) / 2)} ${f((i - 4) * 0.35)} ${f(y1 - y0)}`; }), c);
  const mus = hairPaint(mustachePath(g, k === 2 ? 1.8 : 1), c, 0.4) + strands([`M${P(48, g.noseY + 2)}l-1.6 2.2`, `M${P(52, g.noseY + 2)}l1.6 2.2`], c);
  if (k === 2) return { base: '', top: mus };
  if (k === 3) {
    const goat = sym([50, m + 1], [[[48, m + 1], [50 - g.mw + 0.4, m + 0.6], [50 - g.mw + 0.2, m + 2]], [[50 - g.mw + 0.4, ch], [50 - 3, ch + 3.4], [50, ch + 4.6]]]);
    return { base: hairPaint(goat, c) + tex(m + 3, ch + 3, 0.7), top: mus };
  }
  const [L, W, taper] = k === 4 ? [2.6, 0.6, 0] : k === 5 ? [11, 2.6, 0] : k === 6 ? [7, 1.6, 0] : [27, 1.2, 1];
  let base = hairPaint(beardPath(g, L, W, taper), c) + tex(m + 1, ch + L - 1, k === 4 ? 2 : 2.4)
    + shine([`M${P(45, m + 3)}q-.6 ${f(L * 0.5)} .4 ${f(L)}`, `M${P(54, m + 3)}q.4 ${f(L * 0.4)} -.2 ${f(L * 0.8)}`], c);
  if (k === 6) {
    const one = braid(c, along(46.4, ch + 6, 45.6, ch + 22, -0.6, 7), 1.9) + `<rect x="43.8" y="${f(ch + 12.6)}" width="3.6" height="1.6" rx=".4" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".35"/>`;
    base += one + `<g transform="${MIRROR}">${one}</g>`;
  }
  return { base, top: mus };
}

// ───────────── кротолюд ─────────────
function moleTufts(g, fur) {
  let tufts = '';
  for (let a = 168; a <= 372; a += 8) {
    const r = a * Math.PI / 180, r2 = (a + 4) * Math.PI / 180, rx = g.templeW + 0.6, ry = g.browY - g.top + 2, cy = g.browY + 2;
    tufts += `${tufts ? 'L' : 'M'}${P(50 + Math.cos(r) * rx, cy + Math.sin(r) * ry)}L${P(50 + Math.cos(r2) * (rx + 1.7), cy + Math.sin(r2) * (ry + 1.7))}`;
  }
  return `<path d="${tufts}Z" fill="${fur}" stroke="${sh(fur, -0.45)}" stroke-width=".4"/>`;
}
// шерсть поверх лица — короткие штрихи
function moleFur(g, fur) {
  const ls = [];
  for (let i = 0; i < 22; i++) { const x = 50 - g.templeW + 2 + (i * 37 % 29), y = g.top + 3 + (i * 23 % 17); ls.push(`M${P(x, y)}l${f((x - 50) * 0.04)} 1.6`); }
  return lines(ls, fur, lum(fur) > 0.5 ? -0.3 : 0.25, 0.35, 0.5);
}
function moleFace(g, v, fur) {
  const n = g.noseY, e = g.eyeY, light = sh(fur, lum(fur) > 0.6 ? -0.12 : 0.22);
  let s = soft(50, n + 1.2, 8.4, 7.6, 0.85, 'av-hl').replace('opacity=".85"', `opacity="${lum(fur) > 0.6 ? 0.1 : 0.22}"`);
  s += `<ellipse cx="50" cy="${f(n + 1.8)}" rx="7.4" ry="6.6" fill="${light}" opacity=".55"/>`;
  // глазки-бусинки
  for (const sd of [-1, 1]) s += soft(50 + sd * 6.6, e + 0.6, 2.4, 1.8, 0.4) + `<circle cx="${f(50 + sd * 6.6)}" cy="${f(e + 0.6)}" r="1" fill="#0a0807"/><circle cx="${f(50 + sd * 6.6 - 0.35)}" cy="${f(e + 0.25)}" r=".33" fill="#fff" opacity=".8"/>`;
  // рот
  const sm = v.mouth === 1 ? 0.9 : v.mouth === 4 ? -0.4 : v.mouth === 2 ? 0.5 : 0.2;
  s += `<path d="M${P(47.4, n + 5.6)}Q${P(50, n + 6 + sm)} ${P(52.6, n + 5.6 - (v.mouth === 2 ? 0.8 : 0))}" fill="none" stroke="${sh(fur, -0.7)}" stroke-width=".6" stroke-linecap="round"/>`;
  if (v.mouth === 3 || v.mouth === 5) s += `<path d="M${P(49, n + 5.8)}h2v1.5h-2z" fill="#eee4cf" stroke="#6a5a40" stroke-width=".25"/>`;
  // рыльце
  const sn = `M${P(48.7, e + 3)}C${P(47.9, n - 4)} ${P(45.6, n - 1)} ${P(46.2, n + 1.6)}C${P(46.8, n + 3.5)} ${P(53.2, n + 3.5)} ${P(53.8, n + 1.6)}C${P(54.4, n - 1)} ${P(52.1, n - 4)} ${P(51.3, e + 3)}Z`;
  s += soft(50.6, n + 3.4, 4.4, 1.4, 0.4) + `<path d="${sn}" fill="#c48a84"/><path d="${sn}" fill="url(#av-sk)"/><path d="${sn}" fill="none" stroke="#6a3a36" stroke-width=".45"/>`
    + `<ellipse cx="48.6" cy="${f(n + 2)}" rx=".8" ry=".45" fill="#4a1e1c"/><ellipse cx="51.4" cy="${f(n + 2)}" rx=".8" ry=".45" fill="#4a1e1c"/>` + soft(49, n - 1.2, 1.4, 2, 0.4, 'av-hl');
  // усы-вибриссы
  const wh = [[-14, n + 0.2], [-14.6, n + 2.8], [-13.4, n + 5.4]].map(([dx, y]) => `M${P(50 - 4, n + 2.6)}Q${P(50 + dx * 0.6, y - 0.6)} ${P(50 + dx, y)}`);
  s += both(`<path d="${wh.join('')}" fill="none" stroke="#efe6d6" stroke-width=".3" opacity=".7"/>`);
  return s;
}

// ───────────── головные уборы ─────────────
const hatCloth = (d, c, w = 0.5) => `<path d="${d}" fill="none" stroke="${sh(c, -0.6)}" stroke-width="${f(w * 2)}" stroke-linejoin="round"/><path d="${d}" fill="${c}"/><path d="${d}" fill="url(#av-cl)"/><path d="${d}" fill="url(#av-clx)"/>`;
function hat(g, v, C, skin) {
  const t = g.templeW, b = g.browY, T = g.top, hl = g.hairY, n = g.noseY, j = g.jawW;
  let back = '', front = '';
  switch (v.hat) {
    case 1: {   // капюшон
      const out = sym([50, T - 7], [[[44, T - 7], [50 - t - 6, T - 1], [50 - t - 7.4, b - 2]], [[50 - t - 8.6, b + 14], [50 - t - 13, 84], [50 - t - 18, 104]], [[50 - 10, 104], [46, 104], [50, 104]]]);
      const hole = sym([50, hl - 4.6], [[[44, hl - 4.6], [50 - t - 1.8, hl], [50 - t - 2, b + 4]], [[50 - t - 2.2, g.mouthY], [50 - j - 1, g.chinY + 1], [50, g.chinY + 4.4]]]);
      back = `<path d="${hole}" fill="${sh(C, -0.72)}"/>` + soft(50, b, t + 2, 14, 0.5, 'av-sft');
      front = `<path d="${out}${hole}" fill-rule="evenodd" fill="none" stroke="${sh(C, -0.6)}" stroke-width="1"/><path d="${out}${hole}" fill-rule="evenodd" fill="${C}"/><path d="${out}${hole}" fill-rule="evenodd" fill="url(#av-cl)"/><path d="${out}${hole}" fill-rule="evenodd" fill="url(#av-clx)"/>`
        + `<path d="${hole}" fill="none" stroke="${sh(C, 0.2)}" stroke-width=".6" opacity=".6"/>`
        + soft(50, hl + 1, t, 4, 0.45, 'av-sft')
        + folds([`M${P(50 - t - 4, b + 8)}q-2 12 -6 26`, `M${P(50 + t + 4, b + 8)}q2 12 6 26`, `M${P(50 - 3, T - 5)}q-6 2 -10 8`], C, 0.6);
      break;
    }
    case 2: case 3: {   // шлем с наносником / рогатый шлем
      const dome = `M${P(50 - t - 2, b - 1)}C${P(50 - t - 2.4, T + 4)} ${P(50 - t * 0.7, T - 3.6)} ${P(50, T - 3.6)}C${P(50 + t * 0.7, T - 3.6)} ${P(50 + t + 2.4, T + 4)} ${P(50 + t + 2, b - 1)}Q${P(50, b - 5)} ${P(50 - t - 2, b - 1)}Z`;
      const band = `M${P(50 - t - 2, b - 1)}Q${P(50, b - 5)} ${P(50 + t + 2, b - 1)}L${P(50 + t + 2.2, b - 3.6)}Q${P(50, b - 7.8)} ${P(50 - t - 2.2, b - 3.6)}Z`;
      if (v.hat === 3) for (const sd of [-1, 1]) {
        const x = 50 + sd * (t + 0.6), hy0 = T + 9;
        const horn = `M${P(x, hy0)}C${P(x + sd * 6, hy0 - 1)} ${P(x + sd * 10, hy0 - 6)} ${P(x + sd * 10.6, T - 9)}C${P(x + sd * 8.4, hy0 - 8)} ${P(x + sd * 5, hy0 - 6.4)} ${P(x - sd * 0.4, hy0 - 5.6)}Z`;
        front += `<path d="${horn}" fill="#cbbd9c" stroke="#4a3e2c" stroke-width=".5"/><path d="${horn}" fill="url(#av-cl)"/>` + lines([1, 2, 3].map(i => `M${P(x + sd * (2 + i * 2), hy0 - 0.4 - i * 1.2)}l${f(sd * -0.8)} ${f(-2.6 - i * 0.2)}`), '#cbbd9c', -0.45, 0.4, 0.7);
      }
      front = soft(50, b - 0.6, t + 1, 2.4, 0.4, 'av-sft') + front + metal(dome) + `<path d="M50 ${f(T - 3.4)}V${f(b - 5)}" stroke="#fff" stroke-opacity=".4" stroke-width=".7"/><path d="M50.7 ${f(T - 3.2)}V${f(b - 5)}" stroke="#1d2026" stroke-opacity=".45" stroke-width=".5"/>`
        + soft(44, T + 3, 3.4, 5, 0.3, 'av-hl') + metal(band) + [-1, -0.62, -0.25, 0.25, 0.62, 1].map(u => rivet(50 + u * (t + 0.6), b - 3.4 - (1 - u * u) * 3.4, 0.5)).join('');
      if (v.hat === 2) front += metal(`M${P(48.8, b - 4.6)}L${P(51.2, b - 4.6)}L${P(50.8, n - 3.2)}Q50 ${f(n - 2.4)} ${P(49.2, n - 3.2)}Z`, 'av-steelx', 0.4);
      break;
    }
    case 4: {   // обруч с камнем
      const d = `M${P(50 - t - 0.8, hl + 4)}Q${P(50, hl - 1.6)} ${P(50 + t + 0.8, hl + 4)}L${P(50 + t + 0.8, hl + 5.2)}Q${P(50, hl - 0.4)} ${P(50 - t - 0.8, hl + 5.2)}Z`;
      front = metal(d, 'av-steel', 0.35) + `<path d="M50 ${f(hl + 1)}l-1.5 1.9l1.5 3l1.5 -3z" fill="#5f97b8" stroke="url(#av-steel)" stroke-width=".55"/><circle cx="49.5" cy="${f(hl + 2.4)}" r=".4" fill="#fff" opacity=".8"/>`;
      break;
    }
    case 5: {   // корона
      const y = hl - 0.6;
      let pts = `M${P(50 - t - 0.6, y + 2)}`;
      for (let i = 0; i <= 8; i++) { const x = 50 - t - 0.6 + i * (2 * t + 1.2) / 8, up = i % 2 ? (i === 3 || i === 5 ? 6.2 : 7.6) : 2.4; pts += `L${P(x, y + 2 - up - (i === 4 ? 1.6 : 0))}`; }
      pts += `L${P(50 + t + 0.6, y + 4.2)}Q${P(50, y + 1)} ${P(50 - t - 0.6, y + 4.2)}Z`;
      front = metal(pts, 'av-gold', 0.4) + `<path d="M${P(50 - t - 0.6, y + 2)}Q${P(50, y - 1)} ${P(50 + t + 0.6, y + 2)}" fill="none" stroke="#3a2a10" stroke-width=".35" opacity=".7"/>`
        + [[-1, '#8a2a2a'], [0, '#2f5f7a'], [1, '#8a2a2a']].map(([u, c]) => `<circle cx="${f(50 + u * 6.4)}" cy="${f(y + 1.6 + Math.abs(u) * 0.9)}" r=".9" fill="${c}" stroke="#3a2a10" stroke-width=".3"/>`).join('')
        + [1, 3, 5, 7].map(i => `<circle cx="${f(50 - t - 0.6 + i * (2 * t + 1.2) / 8)}" cy="${f(y + 2 - (i === 3 || i === 5 ? 6.2 : 7.6))}" r=".7" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".25"/>`).join('');
      break;
    }
    case 6: {   // шляпа мага
      const brim = `M${P(50 - t - 12, hl + 1.6)}C${P(50 - t - 10, hl - 3.4)} ${P(50 + t + 10, hl - 3.4)} ${P(50 + t + 12, hl + 1.6)}C${P(50 + t + 6, hl + 4.4)} ${P(50 - t - 6, hl + 4.4)} ${P(50 - t - 12, hl + 1.6)}Z`;
      const cone = `M${P(50 - t + 0.4, hl - 0.4)}C${P(50 - 7, T - 4)} ${P(50 - 2, T - 12)} ${P(50 + 3, T - 16)}C${P(50 + 7, T - 18)} ${P(50 + 12, T - 16)} ${P(50 + 14, T - 13)}C${P(50 + 10, T - 13.6)} ${P(50 + 6, T - 12)} ${P(50 + 5, T - 8)}C${P(50 + 6, T - 2)} ${P(50 + t - 2, hl - 2)} ${P(50 + t - 0.4, hl - 0.4)}Q${P(50, hl + 1.4)} ${P(50 - t + 0.4, hl - 0.4)}Z`;
      front = soft(50, hl + 4, t + 2, 3, 0.45, 'av-sft') + hatCloth(brim, sh(C, -0.1)) + hatCloth(cone, C)
        + `<path d="M${P(50 - t + 0.2, hl - 1.6)}Q${P(50, hl + 0.2)} ${P(50 + t - 0.2, hl - 1.6)}L${P(50 + t - 0.6, hl - 3.8)}Q${P(50, hl - 2)} ${P(50 - t + 0.6, hl - 3.8)}Z" fill="${sh(C, -0.55)}"/>`
        + `<path d="M50 ${f(hl - 3.6)}l.7 1.4l1.5 .2l-1.1 1l.3 1.5l-1.4 -.7l-1.4 .7l.3 -1.5l-1.1 -1l1.5 -.2z" fill="url(#av-gold)"/>`;
      break;
    }
    case 7: {   // каска шахтёра с лампой
      const dome = `M${P(50 - t - 2.2, hl + 2.4)}C${P(50 - t - 2.4, T + 2)} ${P(50 - t * 0.7, T - 3.4)} ${P(50, T - 3.4)}C${P(50 + t * 0.7, T - 3.4)} ${P(50 + t + 2.4, T + 2)} ${P(50 + t + 2.2, hl + 2.4)}Z`;
      const brim = `M${P(50 - t - 4.4, hl + 2.6)}Q${P(50, hl - 0.6)} ${P(50 + t + 4.4, hl + 2.6)}Q${P(50, hl + 5.2)} ${P(50 - t - 4.4, hl + 2.6)}Z`;
      front = soft(50, hl + 4.4, t + 1, 2.6, 0.45, 'av-sft') + hatCloth(dome, '#5a4630') + `<path d="M50 ${f(T - 3.2)}V${f(hl + 1)}" stroke="#2a1e12" stroke-width="1.2" opacity=".5"/>` + hatCloth(brim, '#4a3826')
        + `<rect x="46.4" y="${f(hl - 4.6)}" width="7.2" height="5.4" rx="1.2" fill="url(#av-gold)" stroke="#2a1e0c" stroke-width=".45"/>`
        + `<circle cx="50" cy="${f(hl - 1.9)}" r="2.1" fill="#ffe7a6" stroke="#5a4320" stroke-width=".45"/><circle cx="50" cy="${f(hl - 1.9)}" r="5" fill="url(#av-hl)" opacity=".5"/>`;
      break;
    }
    case 8: {   // повязка с узлом
      const wrap = `M${P(50 - t - 1.8, b - 2)}C${P(50 - t - 2.6, T + 2)} ${P(50 - t * 0.7, T - 2.2)} ${P(50, T - 2.2)}C${P(50 + t * 0.7, T - 2.2)} ${P(50 + t + 2.6, T + 2)} ${P(50 + t + 1.8, b - 2)}Q${P(50, hl - 0.8)} ${P(50 - t - 1.8, b - 2)}Z`;
      const tails = `M${P(50 + t + 1, b - 3)}C${P(50 + t + 4, b)} ${P(50 + t + 5, b + 6)} ${P(50 + t + 4.4, b + 11)}L${P(50 + t + 2.4, b + 10)}C${P(50 + t + 2.8, b + 6)} ${P(50 + t + 1.4, b + 2)} ${P(50 + t - 0.4, b - 1)}Z`;
      front = soft(50, hl + 1.6, t, 2, 0.35, 'av-sft') + hatCloth(tails, sh(C, -0.15)) + hatCloth(wrap, C)
        + `<circle cx="${f(50 + t + 1)}" cy="${f(b - 3.2)}" r="1.9" fill="${sh(C, -0.1)}" stroke="${sh(C, -0.6)}" stroke-width=".45"/>`
        + folds([`M${P(50 - 8, T + 2)}q4 3 3 9`, `M${P(50 + 4, T + 1)}q3 4 5 8`], C, 0.6);
      break;
    }
    case 9: {   // меховая шапка
      const F = '#6a5644', top = `M${P(50 - t + 0.6, hl)}C${P(50 - t, T - 2)} ${P(50 - 6, T - 6)} ${P(50, T - 6)}C${P(50 + 6, T - 6)} ${P(50 + t, T - 2)} ${P(50 + t - 0.6, hl)}Z`;
      let band = `M${P(50 - t - 3, hl + 3.8)}`;
      for (let i = 0; i <= 12; i++) band += `L${P(50 - t - 3 + i * (2 * t + 6) / 12, hl + 3.8 + (i % 2 ? 1.2 : 0) - Math.sin(i / 12 * Math.PI) * 2)}`;
      for (let i = 12; i >= 0; i--) band += `L${P(50 - t - 3 + i * (2 * t + 6) / 12, hl - 3.4 - (i % 2 ? 0.9 : 0) - Math.sin(i / 12 * Math.PI) * 2)}`;
      band += 'Z';
      front = soft(50, hl + 4.6, t + 1, 2.2, 0.4, 'av-sft') + hatCloth(top, '#4a2f22') + `<path d="${band}" fill="${F}" stroke="${sh(F, -0.55)}" stroke-width=".9" stroke-dasharray="1 .6"/><path d="${band}" fill="${F}"/><path d="${band}" fill="url(#av-cl)"/>`
        + lines(Array.from({ length: 16 }, (_, i) => `M${P(50 - t - 1 + i * (2 * t + 2) / 15, hl - 2 - Math.sin(i / 15 * Math.PI) * 2 + (i % 3))}l${f((i % 3 - 1) * 0.4)} 2`), F, 0.3, 0.4, 0.55);
      break;
    }
    case 10: {   // венок
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, x = 50 - t - 0.8 + u * (2 * t + 1.6), y = hl + 3.4 - Math.sin(u * Math.PI) * 4.6;
        const a = (u - 0.5) * 50 + (i % 2 ? 38 : -38), c = i % 2 ? '#4a6a34' : '#3a5428';
        front += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.1" ry=".95" transform="rotate(${f(a)} ${f(x)} ${f(y)})" fill="${c}" stroke="#1e2c14" stroke-width=".35"/><path d="M${P(x - 1.6, y)}h3.2" transform="rotate(${f(a)} ${f(x)} ${f(y)})" stroke="#7a9a5a" stroke-width=".25"/>`;
      }
      front += [[-7, 0.6], [-1.6, -0.8], [4.4, 0.2], [9.4, 1.4]].map(([dx, dy]) => `<circle cx="${f(50 + dx)}" cy="${f(hl - 0.4 + dy + Math.abs(dx) * 0.12)}" r=".7" fill="#8a2420" stroke="#3a0e0c" stroke-width=".25"/>`).join('');
      break;
    }
    case 11: {   // широкополая шляпа
      const brim = `M${P(50 - t - 15, hl + 2.4)}C${P(50 - t - 12, hl - 4.6)} ${P(50 + t + 12, hl - 4.6)} ${P(50 + t + 15, hl + 2.4)}C${P(50 + t + 8, hl + 6)} ${P(50 - t - 8, hl + 6)} ${P(50 - t - 15, hl + 2.4)}Z`;
      const crown = `M${P(50 - t + 1, hl)}C${P(50 - t + 0.4, T - 2)} ${P(50 - t + 2, T - 6)} ${P(50 - 4, T - 6.4)}Q${P(50, T - 4.4)} ${P(50 + 4, T - 6.4)}C${P(50 + t - 2, T - 6)} ${P(50 + t - 0.4, T - 2)} ${P(50 + t - 1, hl)}Q${P(50, hl + 1.6)} ${P(50 - t + 1, hl)}Z`;
      front = soft(50, hl + 5.4, t + 3, 4, 0.55, 'av-sft') + hatCloth(brim, sh(C, -0.08)) + hatCloth(crown, C)
        + `<path d="M${P(50 - t + 0.8, hl - 1.6)}Q${P(50, hl)} ${P(50 + t - 0.8, hl - 1.6)}L${P(50 + t - 0.9, hl - 3.6)}Q${P(50, hl - 2)} ${P(50 - t + 0.9, hl - 3.6)}Z" fill="${sh(C, -0.55)}"/>`;
      break;
    }
    case 12: {   // берет с пером
      const beret = `M${P(50 - t - 3.4, hl + 1.6)}C${P(50 - t - 6, T - 1)} ${P(50 - 4, T - 6.6)} ${P(50 + 4, T - 5.4)}C${P(50 + t + 1, T - 4)} ${P(50 + t + 3, T + 3)} ${P(50 + t + 1.2, hl - 1.4)}Q${P(50, hl - 1.2)} ${P(50 - t - 3.4, hl + 1.6)}Z`;
      const feather = `M${P(50 + t - 1, hl - 3)}C${P(50 + t + 6, T - 2)} ${P(50 + t + 9, T - 10)} ${P(50 + t + 14, T - 13)}C${P(50 + t + 10, T - 7)} ${P(50 + t + 7, T + 1)} ${P(50 + t + 1, hl - 1.6)}Z`;
      front = soft(50, hl + 2.4, t + 1, 2, 0.35, 'av-sft') + `<path d="${feather}" fill="#d8d0bf" stroke="#4a443a" stroke-width=".4"/><path d="M${P(50 + t, hl - 2.2)}C${P(50 + t + 6, T - 1)} ${P(50 + t + 9, T - 9)} ${P(50 + t + 14, T - 13)}" fill="none" stroke="#6a6254" stroke-width=".35"/>`
        + lines([1, 2, 3, 4].map(i => `M${P(50 + t + 2 + i * 2.4, T + 2 - i * 3.2)}l1.4 1.4`), '#d8d0bf', -0.3, 0.3, 0.7)
        + hatCloth(beret, C) + `<path d="M${P(50 - t - 3.2, hl + 1.4)}Q${P(50, hl - 1.6)} ${P(50 + t + 1, hl - 1.6)}" fill="none" stroke="${sh(C, -0.55)}" stroke-width="1.2"/>`
        + `<circle cx="${f(50 + t - 0.6)}" cy="${f(hl - 2.2)}" r="1.1" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".3"/>`;
      break;
    }
  }
  return { back, front };
}

// ───────────── приметы ─────────────
function marks(g, v, skin) {
  const b = g.browY, e = g.eyeY, n = g.noseY, m = g.mouthY, dx = g.eyeDX, t = g.templeW;
  const under = [], over = [];
  const dk = sh(skin, -0.42);
  switch (v.extra) {
    case 1: over.push(`<path d="M${P(50 - dx + 1.2, b - 4.4)}L${P(50 - dx - 1.4, n + 1.6)}" stroke="${sh(skin, -0.35)}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><path d="M${P(50 - dx + 1.2, b - 4.4)}L${P(50 - dx - 1.4, n + 1.6)}" stroke="${mix(skin, '#efc2b6', 0.5)}" stroke-width=".7" stroke-linecap="round"/>`
      + `<path d="M${P(50 - dx - 0.2, b - 2)}l1.4 .5M${P(50 - dx - 0.9, n - 3)}l1.4 .5M${P(50 - dx - 1.2, n - 0.4)}l1.4 .5" stroke="${dk}" stroke-width=".3" opacity=".7"/>`); break;
    case 2: over.push(`<path d="M${P(50 + dx + 0.4, n - 3.4)}Q${P(50 + dx + 2.4, n)} ${P(50 + dx + 4, m + 1)}" fill="none" stroke="${sh(skin, -0.35)}" stroke-width="1.4" stroke-linecap="round" opacity=".5"/><path d="M${P(50 + dx + 0.4, n - 3.4)}Q${P(50 + dx + 2.4, n)} ${P(50 + dx + 4, m + 1)}" fill="none" stroke="${mix(skin, '#efc2b6', 0.5)}" stroke-width=".6" stroke-linecap="round"/>`); break;
    case 3: over.push(`<path d="M${P(50 - t - 1, b - 6)}L${P(50 + t + 1, b - 1.4)}" stroke="#1a1410" stroke-width=".9"/><path d="M${P(50 - dx - 4.6, e + 0.4)}L${P(50 - t - 1, e + 4)}" stroke="#1a1410" stroke-width=".9"/>`
      + `<path d="M${P(50 - dx - 3.6, e - 2.2)}C${P(50 - dx - 2, e - 3.8)} ${P(50 - dx + 2.4, e - 3.6)} ${P(50 - dx + 3.4, e - 1.4)}C${P(50 - dx + 3.4, e + 2)} ${P(50 - dx + 0.6, e + 3.4)} ${P(50 - dx - 1.4, e + 3)}C${P(50 - dx - 3.6, e + 2.4)} ${P(50 - dx - 4.2, e)} ${P(50 - dx - 3.6, e - 2.2)}Z" fill="#221a14" stroke="#0a0806" stroke-width=".4"/>`
      + `<path d="M${P(50 - dx - 2.8, e - 1.8)}C${P(50 - dx - 1.4, e - 2.8)} ${P(50 - dx + 1.6, e - 2.6)} ${P(50 - dx + 2.4, e - 1)}" fill="none" stroke="#5a4a3a" stroke-width=".3" stroke-dasharray=".5 .5"/>`); break;
    case 4: under.push(`<path d="M${P(50 - t + 0.4, e - 2.8)}Q${P(50, e - 3.6)} ${P(50 + t - 0.4, e - 2.8)}L${P(50 + t - 1, e + 1.6)}L${P(50 + t - 2.4, e + 2.6)}L${P(50 + 8, e + 2.4)}Q${P(50, e + 4)} ${P(50 - 8, e + 2.4)}L${P(50 - t + 2.4, e + 2.6)}L${P(50 - t + 1, e + 1.6)}Z" fill="#17120f" opacity=".5"/><path d="M50 ${f(m + 2.2)}V${f(g.chinY - 0.6)}" stroke="#17120f" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`); break;
    case 5: {
      const dots = [];
      for (let i = 0; i < 26; i++) { const x = 50 + ((i * 47) % 23) - 11.5, y = n - 4 + ((i * 29) % 7); if (Math.abs(x - 50) > 1.6 || y < n - 2) dots.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${0.22 + (i % 3) * 0.06}"/>`); }
      under.push(`<g fill="${sh(skin, -0.38)}" opacity=".65">${dots.join('')}</g>`); break;
    }
    case 6: under.push(`<path d="M50 ${f(b - 7.4)}v4.2M${P(48.4, b - 6.6)}l1.6 1.2l1.6 -1.2M${P(50 + dx + 2.4, n - 2)}l1.2 2.4l-1.2 2.4M${P(50 + dx + 4, n - 1.2)}v4.2M${P(50 + dx + 4, n + 1)}l1.4 -1" fill="none" stroke="#2c4e7a" stroke-width=".6" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`); break;
    case 7: {
      const dots = [];
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { dots.push(`<circle cx="${f(50 + sd * (dx - 2.4 + i * 1.6))}" cy="${f(b - 2.2 - Math.sin(i / 3 * Math.PI) * 0.7)}" r=".33"/>`); dots.push(`<circle cx="${f(50 + sd * (dx + 0.6 + i * 1.1))}" cy="${f(n - 2.6 + i * 0.9)}" r=".3"/>`); }
      dots.push(`<circle cx="50" cy="${f(b - 4.4)}" r=".45"/>`);
      under.push(`<g fill="#eee4cc" opacity=".85">${dots.join('')}</g>`); break;
    }
    case 8: under.push(soft(50 - dx - 1, n + 1, 4.6, 2.6, 0.45, 'av-sft') + soft(50 + 5, b - 5, 4, 1.8, 0.35, 'av-sft') + soft(50 + dx + 3, m + 2, 2.6, 1.6, 0.3, 'av-sft')
      + `<path d="M${P(50 - dx - 4, n + 2)}l5 -1.6M${P(50 + 3, b - 5.4)}l4 .6" stroke="#1a1410" stroke-width=".5" opacity=".4"/>`); break;
    case 9: under.push(`<path d="M${P(50 - 6, b - 4.6)}Q50 ${f(b - 5.6)} ${P(50 + 6, b - 4.6)}M${P(50 - 5, b - 6.8)}Q50 ${f(b - 7.6)} ${P(50 + 5, b - 6.8)}M${P(50 - dx - g.eyeW - 0.6, e - 0.6)}l-1.6 -.6M${P(50 - dx - g.eyeW - 0.6, e + 0.6)}l-1.6 .6M${P(50 + dx + g.eyeW + 0.6, e - 0.6)}l1.6 -.6M${P(50 + dx + g.eyeW + 0.6, e + 0.6)}l1.6 .6`
      + `M${P(47.4, n - 0.8)}Q${P(50 - g.mw - 1.6, m - 2.4)} ${P(50 - g.mw - 1, m + 0.6)}M${P(52.6, n - 0.8)}Q${P(50 + g.mw + 1.6, m - 2.4)} ${P(50 + g.mw + 1, m + 0.6)}M${P(50 - dx - 2, e + 2.4)}q2 1 4 0M${P(50 + dx - 2, e + 2.4)}q2 1 4 0" fill="none" stroke="${dk}" stroke-width=".42" stroke-linecap="round" opacity=".55"/>`); break;
  }
  return { under: under.join(''), over: over.join('') };
}

// ───────────── украшения ─────────────
function jewels(g, v) {
  const n = g.noseY, e = g.eyeY, dx = g.eyeDX, hl = g.hairY, nw = g.nw;
  const lobe = (sd) => [50 + sd * (g.earX + 1.2), n + (v.race === 1 ? 0.2 : v.race === 5 ? -0.6 : 0.6)];
  let head = '', body = '', top = '';
  switch (v.jewel) {
    case 1: for (const sd of [-1, 1]) { const [x, y] = lobe(sd); head += `<circle cx="${f(x)}" cy="${f(y + 2)}" r="2" fill="none" stroke="#3a2a10" stroke-width="1.1"/><circle cx="${f(x)}" cy="${f(y + 2)}" r="2" fill="none" stroke="url(#av-gold)" stroke-width=".75"/>`; } break;
    case 2: { const [x, y] = lobe(-1); head += `<circle cx="${f(x)}" cy="${f(y + 0.6)}" r=".7" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".25"/><path d="M${P(x, y + 1.2)}l-1.4 3.2l1.4 2l1.4 -2z" fill="#9a2a2a" stroke="#3a2a10" stroke-width=".35"/><path d="M${P(x - 0.5, y + 3)}l.4 -1" stroke="#fff" stroke-width=".35" opacity=".7"/>`; break; }
    case 3: { const y = v.race === MOLE ? n + 3.4 : v.race === 5 ? n + 4.2 : n + 0.8; head += `<path d="M${P(48.6, y)}a1.4 1.4 0 0 0 2.8 0" fill="none" stroke="#1d2026" stroke-width="1"/><path d="M${P(48.6, y)}a1.4 1.4 0 0 0 2.8 0" fill="none" stroke="url(#av-steel)" stroke-width=".65"/>`; break; }
    case 4: body = `<path d="M${P(50 - nw - 0.4, 70.6)}Q${P(50 - nw + 1, 80)} ${P(50, 84.6)}Q${P(50 + nw - 1, 80)} ${P(50 + nw + 0.4, 70.6)}" fill="none" stroke="#2a2018" stroke-width=".5"/>`
      + `<circle cx="50" cy="87" r="3" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".45"/><circle cx="50" cy="87" r="1.6" fill="#7a2230" stroke="#3a1a10" stroke-width=".35"/><circle cx="49.4" cy="86.4" r=".45" fill="#fff" opacity=".7"/>`; break;
    case 5: { const arc = `M${P(50 - nw - 1, 70)}Q${P(50 - nw, 75.6)} ${P(50 - 2.4, 76)}M${P(50 + nw + 1, 70)}Q${P(50 + nw, 75.6)} ${P(50 + 2.4, 76)}`;
      body = `<path d="${arc}" fill="none" stroke="#3a2a10" stroke-width="1.9" stroke-linecap="round"/><path d="${arc}" fill="none" stroke="url(#av-gold)" stroke-width="1.4" stroke-linecap="round"/><path d="${arc}" fill="none" stroke="#5a4018" stroke-width=".4" stroke-dasharray=".6 .6"/>`
        + `<circle cx="${f(50 - 2.6)}" cy="76" r="1" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".3"/><circle cx="${f(50 + 2.6)}" cy="76" r="1" fill="url(#av-gold)" stroke="#3a2a10" stroke-width=".3"/>`; break; }
    case 6: body = `<path d="M${P(50 - nw - 0.6, 70.6)}Q${P(50, 85)} ${P(50 + nw + 0.6, 70.6)}" fill="none" stroke="#2a2018" stroke-width=".55"/>`
      + [-2, -1, 0, 1, 2].map(i => { const x = 50 + i * 2.6, y = 79.4 - i * i * 0.5; return `<path d="M${P(x - 0.7, y)}Q${P(x - 0.2, y + 2.6)} ${P(x + i * 0.2, y + 3.6)}Q${P(x + 0.6, y + 2)} ${P(x + 0.7, y)}Z" fill="#e2d6ba" stroke="#5e513b" stroke-width=".3" transform="rotate(${i * -10} ${f(x)} ${f(y)})"/>`; }).join(''); break;
    case 7: top = `<circle cx="${f(50 + dx)}" cy="${f(e)}" r="3.2" fill="url(#av-glass)" stroke="#3a2a10" stroke-width="1.2"/><circle cx="${f(50 + dx)}" cy="${f(e)}" r="3.2" fill="none" stroke="url(#av-gold)" stroke-width=".8"/><path d="M${P(50 + dx + 2, e + 2.3)}C${P(50 + dx + 4, e + 8)} ${P(50 + dx + 2, g.mouthY + 4)} ${P(50 + dx + 5, g.chinY + 6)}" fill="none" stroke="url(#av-gold)" stroke-width=".35" stroke-dasharray=".6 .3"/>`; break;
    case 8: top = `<g fill="url(#av-glass)" stroke="#3a3530" stroke-width=".45"><circle cx="${f(50 - dx)}" cy="${f(e + 0.2)}" r="2.8"/><circle cx="${f(50 + dx)}" cy="${f(e + 0.2)}" r="2.8"/></g><path d="M${P(50 - dx + 2.8, e - 0.2)}Q50 ${f(e - 1.4)} ${P(50 + dx - 2.8, e - 0.2)}M${P(50 - dx - 2.8, e)}L${P(50 - g.earX + 0.4, e - 0.6)}M${P(50 + dx + 2.8, e)}L${P(50 + g.earX - 0.4, e - 0.6)}" fill="none" stroke="#3a3530" stroke-width=".45"/>`; break;
    case 9: top = `<path d="M${P(50 - g.templeW - 1.6, hl + 3)}Q50 ${f(hl - 1)} ${P(50 + g.templeW + 1.6, hl + 3)}" fill="none" stroke="#2a1d14" stroke-width="1.8"/>`
      + [-1, 1].map(sd => `<circle cx="${f(50 + sd * 4.4)}" cy="${f(hl + 1.4)}" r="3" fill="#2a1d14"/><circle cx="${f(50 + sd * 4.4)}" cy="${f(hl + 1.4)}" r="2.6" fill="#b0763a" stroke="url(#av-gold)" stroke-width=".8"/><circle cx="${f(50 + sd * 4.4)}" cy="${f(hl + 1.4)}" r="2.2" fill="url(#av-glass)"/>`).join('')
      + `<path d="M${P(48, hl + 1.6)}h4" stroke="#2a1d14" stroke-width="1.1"/>`; break;
  }
  return { head, body, top };
}

// ───────────── лицо целиком ─────────────
function head(g, v, skin) {
  const fp = facePath(g), dark = sh(skin, -0.48);
  let s = `<path d="${fp}" fill="${skin}"/><path d="${fp}" fill="url(#av-sk)"/><path d="${fp}" fill="url(#av-skr)"/>`;
  // скулы, щёки, лоб, подбородок
  s += both(soft(50 - g.cheekW + 3.2, g.noseY + 0.6, 3.4, 2.6, v.race === 1 || v.race === 4 ? 0.2 : 0.13));
  s += soft(50 - 9.2, g.noseY - 1.6, 3.4, 2.2, v.race === 2 || v.race === 3 ? 0.3 : 0.14, 'av-blush') + soft(50 + 9.2, g.noseY - 1.6, 3.4, 2.2, v.race === 2 || v.race === 3 ? 0.24 : 0.1, 'av-blush');
  s += soft(46, g.browY - 6.5, 6, 3.4, 0.12, 'av-hl') + soft(49, g.chinY - 3, 2.6, 1.6, 0.1, 'av-hl');
  // надбровье
  s += soft(50, g.browY + 1.6, 9, 1.8, v.race === 4 || v.race === 2 ? 0.3 : 0.14);
  s += `<path d="${fp}" fill="none" stroke="${dark}" stroke-width=".55"/>`;
  s += `<path d="${fp}" fill="none" stroke="url(#av-rim)" stroke-width=".7"/>`;
  return s;
}

let uid = 0;
const cache = new Map();
const VIEWS = { full: '7 14 86 86', face: '31 33 38 38', head: '19 14 62 62' };

export function avatarSVG(a, seatColor = '#3a3a42', cls = '', view = 'full') {
  const v = avatarConfig(a);
  const key = JSON.stringify(v) + seatColor + cls + view;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = build(v, seatColor, cls, view);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

function build(v, seatColor, cls, view) {
  const k = 'av' + (uid++).toString(36);
  const g = geo(v);
  const pal = skinPalette(v.race);
  const skin = pal[v.skin] || pal[2];
  const hair = HAIRC[v.hairColor] || HAIRC[1];
  const clothC = CLOTH[v.shirt] || CLOTH[0];
  const bg = BGC[v.bg] || mix(seatColor || '#3a3a42', '#0b0a09', 0.62);
  const mole = v.race === MOLE;
  const covered = HAT_COVERS.has(v.hat);
  const hs = mole ? { back: '', front: '' } : hairStyle(g, v, hair, skin, covered);
  const bd = mole ? { base: '', top: '' } : beard(g, v, hair, skin);
  let s = `<rect width="100" height="100" fill="${bg}"/><rect width="100" height="100" fill="url(#av-bgl)"/>`;
  const of = outfit(g, v, clothC, skin);
  const ht = hat(g, v, CLOTH[v.hatColor] || CLOTH[0], skin);
  const mk = marks(g, v, skin), jw = jewels(g, v);
  s += `<g transform="${HEAD}">${ht.back}${hs.back}</g>` + of.back;
  s += neck(g, skin);
  s += of.body + jw.body;
  s += `<g transform="${HEAD}">`;
  if (!mole && v.hat !== 1) s += both(ear(g, skin, v.race));
  if (mole) s += moleTufts(g, skin);
  s += head(g, v, skin);
  s += mk.under;
  if (mole) s += moleFur(g, skin) + moleFace(g, v, skin);
  else {
    s += eye(g, -1, EYEC[v.eyes] || EYEC[0], skin, v, k) + eye(g, 1, EYEC[v.eyes] || EYEC[0], skin, v, k);
    s += brow(g, -1, sh(hair, -0.12), v.brows, v.gender) + brow(g, 1, sh(hair, -0.12), v.brows, v.gender);
    s += nose(g, skin, v.race);
    s += bd.base + mouth(g, skin, v) + bd.top;
  }
  // очки-консервы лежат поверх убора, остальное — под ним
  s += mk.over + hs.front + jw.head + (v.jewel === 9 ? '' : jw.top) + ht.front + (v.jewel === 9 ? jw.top : '');
  s += '</g>';
  s += `<rect width="100" height="100" fill="url(#av-vig)"/>`;
  return `<svg class="${cls}" viewBox="${VIEWS[view] || VIEWS.full}" aria-hidden="true">${s}</svg>`;
}

export { AVATAR_PARTS };
