// «Под Землёй» — герб героя вместо мультяшного портрета: щит с полем, делением, вторым цветом и гербовым знаком.
// Используются те же поля внешности, что проверяет сервер (shared/avatar.js):
//   shirt — цвет поля, glasses — деление щита, hatColor — второй цвет, hat — знак, bg — фон медальона (0 — цвет места).
import { AVATAR_PARTS, avatarConfig } from '/shared/avatar.js';
import { ICONS } from '/icons.js';

// геральдические цвета
export const TINCT = ['#8e1f1a', '#1f3f7a', '#1f5a3a', '#1c1814', '#4e2766', '#b88a32', '#b9bec4', '#5e1824', '#8e4c16', '#2f6380'];
export const TINCT_NAMES = ['Червлень', 'Лазурь', 'Зелень', 'Чернь', 'Пурпур', 'Золото', 'Серебро', 'Кровь', 'Ржавь', 'Небо'];
export const BGC = [null, '#5a4318', '#1f4a3c', '#1f3456', '#3a2450', '#4a1e2a', '#2f3a1c', '#5a2016', '#141210', '#4a4a50'];
// совместимость со старым редактором
export const SKIN = TINCT.map(c => [c, c, c]);
export const HAIRC = TINCT;
export const CLOTH = TINCT;
const CHARGES = ['crossed-swords', 'dragon-head', 'wolf-head', 'crowned-skull', 'stone-tower', 'holy-oak', 'lantern-flame', 'crown', 'griffin-symbol', 'bat', 'spider-web', 'flame'];

export const AV_LABELS = {
  hat: ['Мечи', 'Дракон', 'Волк', 'Череп в короне', 'Башня', 'Дуб', 'Фонарь', 'Корона', 'Грифон', 'Летучая мышь', 'Паутина', 'Пламя'],
  glasses: ['Цельный', 'Рассечённый', 'Пересечённый', 'Скошенный', 'Четверочастный', 'Стропило'],
  shirt: TINCT_NAMES, hatColor: TINCT_NAMES,
};

// общие градиенты кладутся в документ один раз (art.js → injectDefs)
export function avatarDefs() {
  return `<radialGradient id="cr-bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`
    + `<radialGradient id="cr-shade" cx="38%" cy="28%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>`
    + `<linearGradient id="cr-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2a4"/><stop offset=".45" stop-color="#c99a45"/><stop offset=".55" stop-color="#7d5a22"/><stop offset="1" stop-color="#d9ad5c"/></linearGradient>`;
}

const SHIELD = 'M50 16 L80 24 C80 54 71 73 50 88 C29 73 20 54 20 24 Z';
function division(kind, c2) {
  switch (kind) {
    case 1: return `<rect x="50" y="0" width="50" height="100" fill="${c2}"/>`;
    case 2: return `<rect x="0" y="50" width="100" height="50" fill="${c2}"/>`;
    case 3: return `<path d="M20 24 L80 84 L80 100 L0 100 L0 44Z" fill="${c2}"/>`;
    case 4: return `<rect x="50" y="0" width="50" height="50" fill="${c2}"/><rect x="0" y="50" width="50" height="50" fill="${c2}"/>`;
    case 5: return `<path d="M10 78 L50 40 L90 78 L90 62 L50 24 L10 62Z" fill="${c2}"/>`;
    default: return '';
  }
}
let uid = 0;
export function avatarSVG(a, seatColor = '#d9ad5c', cls = '') {
  const v = avatarConfig(a);
  const c1 = TINCT[v.shirt] || TINCT[0];
  let c2 = TINCT[v.hatColor] || TINCT[5];
  if (c2 === c1) c2 = v.shirt === 5 ? TINCT[3] : TINCT[5];
  const bg = BGC[v.bg] || seatColor || '#5a4318';
  const icon = ICONS[CHARGES[v.hat] || CHARGES[0]] || '';
  // знак на светлом поле — чернёный, на тёмном — золотой
  const light = v.shirt === 5 || v.shirt === 6;
  const k = 'cr' + (uid++);
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${k}"><path d="${SHIELD}"/></clipPath></defs>`
    + `<rect width="100" height="100" fill="${bg}"/><rect width="100" height="100" fill="url(#cr-bg)"/>`
    + `<circle cx="50" cy="52" r="44" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>`
    + `<path d="${SHIELD}" transform="translate(0 2.5)" fill="#000" opacity=".55"/>`
    + `<g clip-path="url(#${k})"><rect width="100" height="100" fill="${c1}"/>${division(v.glasses, c2)}`
    + `<g transform="translate(31 33) scale(.0742)" fill="${light ? '#1c1612' : 'url(#gold-emb)'}" stroke="#000" stroke-opacity=".55" stroke-width="10"><path d="${icon}"/></g>`
    + `<rect width="100" height="100" fill="url(#cr-shade)"/></g>`
    + `<path d="${SHIELD}" fill="none" stroke="url(#cr-rim)" stroke-width="3.4" stroke-linejoin="round"/>`
    + `<path d="${SHIELD}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width=".8"/>`
    + `</svg>`;
}

export { AVATAR_PARTS };
