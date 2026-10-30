// Колесо Подлеца: рисунок колеса в SVG — один и тот же на столе (маленькое), в окне правил и в сцене вращения.
// 16 равных секторов по WHEEL_RING (shared/cards.js): сколько секторов у исхода, такой у него и шанс.
// Сектор i занимает угол [i·22,5°; (i+1)·22,5°) по часовой стрелке от 12 часов — так же считает сцена в cine.js.
import { WHEEL, WHEEL_RING, WHEEL_SECTORS } from '/shared/cards.js';
import { ICONS } from '/icons.js';

// цвет и значок каждого исхода; tone — для таблички с итогом
export const WHEEL_LOOK = {
  mon7:    { c1: '#8e1b14', c2: '#4e0a07', ink: '#ffe9c8', icon: 'claws', tone: 'bad' },
  mon10:   { c1: '#a3201a', c2: '#5c0b08', ink: '#ffe3b0', icon: 'fanged-skull', tone: 'bad' },
  mon20:   { c1: '#d0391c', c2: '#6e0f05', ink: '#fff3c4', icon: 'daemon-skull', tone: 'bad' },
  monster: { c1: '#4b1a6e', c2: '#1f0a33', ink: '#f0dcff', icon: 'troll', tone: 'bad' },
  boss:    { c1: '#1c1012', c2: '#050304', ink: '#ffcf6a', icon: 'crowned-skull', tone: 'boss' },
  hero5:   { c1: '#1f6e58', c2: '#0b3027', ink: '#dfffee', icon: 'heart-plus', tone: 'good' },
  jinx:    { c1: '#25366e', c2: '#0d1533', ink: '#dbe6ff', icon: 'evil-eyes', tone: 'odd' },
  loot:    { c1: '#9a6c18', c2: '#4a3006', ink: '#fff4d0', icon: 'open-treasure-chest', tone: 'odd' },
  dud:     { c1: '#4a4744', c2: '#1e1c1b', ink: '#e8e2d8', icon: 'whirlwind', tone: 'odd' },
};
export const WHEEL_STEP = 360 / WHEEL_SECTORS;
export const wheelAt = slot => WHEEL[WHEEL_RING[slot]];
export const wheelChance = w => Math.round(w.n / WHEEL_SECTORS * 1000) / 10;

const R = 200, RS = 168;                      // радиус колеса и секторов в координатах viewBox
const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [R + r * Math.cos(a), R + r * Math.sin(a)]; };
const f = n => n.toFixed(2);
// значок game-icons (512×512) в нужной точке, повёрнутый вдоль радиуса
const icon = (name, r, deg, size, color) => {
  const [x, y] = pt(r, deg);
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)}) translate(${-size / 2} ${-size / 2}) scale(${size / 512})"><path fill="${color}" d="${ICONS[name] || ''}"/></g>`;
};

let uid = 0;
// big — с подписями и лампочками; small — только цветные сектора и значки (для стола)
export function wheelSVG({ big = true, win = -1 } = {}) {
  const id = 'wh' + (++uid);
  const defs = [], sec = [], lab = [];
  WHEEL_RING.forEach((wi, i) => {
    const w = WHEEL[wi], L = WHEEL_LOOK[w.id], a0 = i * WHEEL_STEP, a1 = a0 + WHEEL_STEP, mid = a0 + WHEEL_STEP / 2;
    const [x0, y0] = pt(RS, a0), [x1, y1] = pt(RS, a1);
    defs.push(`<radialGradient id="${id}g${i}" cx="${R}" cy="${R}" r="${RS}" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="${L.c2}"/><stop offset=".78" stop-color="${L.c1}"/><stop offset="1" stop-color="${L.c2}"/></radialGradient>`);
    sec.push(`<path class="wh-sec${i === win ? ' win' : ''}" data-slot="${i}" d="M${R} ${R}L${f(x0)} ${f(y0)}A${RS} ${RS} 0 0 1 ${f(x1)} ${f(y1)}Z" fill="url(#${id}g${i})"/>`);
    lab.push(icon(L.icon, big ? 140 : 118, mid, big ? 30 : 44, L.ink));
    if (big) {
      // подпись вдоль радиуса: читается от ступицы к ободу
      const [tx, ty] = pt(92, mid), num = /^\+/.test(w.label);
      lab.push(`<text x="${f(tx)}" y="${f(ty)}" transform="rotate(${f(mid - 90)} ${f(tx)} ${f(ty)})" fill="${L.ink}" font-size="${num ? 22 : 15}" class="${num ? 'num' : 'word'}" text-anchor="middle" dominant-baseline="central">${w.label}</text>`);
    }
  });
  // латунные спицы-разделители
  const div = WHEEL_RING.map((_, i) => { const [x, y] = pt(RS, i * WHEEL_STEP); return `<line x1="${R}" y1="${R}" x2="${f(x)}" y2="${f(y)}"/>`; }).join('');
  // лампочки по ободу: чётные и нечётные мигают по очереди
  const bulbs = big ? Array.from({ length: 32 }, (_, i) => { const [x, y] = pt(184, i * 360 / 32 + 360 / 64); return `<circle class="wh-bulb ${i % 2 ? 'b' : 'a'}" cx="${f(x)}" cy="${f(y)}" r="5.2"/>`; }).join('') : '';
  // заклёпки на ступице
  const studs = Array.from({ length: 8 }, (_, i) => { const [x, y] = pt(36, i * 45 + 22.5); return `<circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="url(#${id}st)"/>`; }).join('');
  return `<svg class="wheel-svg${big ? ' big' : ''}" viewBox="0 0 400 400" aria-hidden="true">
    <defs>${defs.join('')}
      <linearGradient id="${id}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7dc95"/><stop offset=".35" stop-color="#a8742a"/><stop offset=".6" stop-color="#ffe7a6"/><stop offset="1" stop-color="#6e4613"/></linearGradient>
      <radialGradient id="${id}iron" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#2a2420"/><stop offset=".93" stop-color="#4a4038"/><stop offset="1" stop-color="#14100d"/></radialGradient>
      <radialGradient id="${id}hub" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffefb8"/><stop offset=".45" stop-color="#c99335"/><stop offset="1" stop-color="#5a3a0e"/></radialGradient>
      <radialGradient id="${id}st" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#bfb6a8"/><stop offset="1" stop-color="#3a342e"/></radialGradient>
      <radialGradient id="${id}shine" cx=".35" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="${R}" cy="${R}" r="198" fill="url(#${id}iron)"/>
    <circle cx="${R}" cy="${R}" r="${RS + 6}" fill="none" stroke="url(#${id}rim)" stroke-width="5"/>
    ${bulbs}
    <g class="wh-face">${sec.join('')}<g class="wh-div" stroke="url(#${id}rim)" stroke-width="2.4">${div}</g>${lab.join('')}</g>
    <circle cx="${R}" cy="${R}" r="${RS}" fill="url(#${id}shine)" pointer-events="none"/>
    <circle cx="${R}" cy="${R}" r="46" fill="url(#${id}hub)" stroke="#3a2608" stroke-width="2"/>
    <circle cx="${R}" cy="${R}" r="40" fill="none" stroke="#ffe9b0" stroke-opacity=".45" stroke-width="1.2"/>
    ${studs}
    ${icon('double-face-mask', 0, 0, 46, '#3a2406')}
  </svg>`;
}
// стрелка над колесом: латунный клин с камнем
export const WHEEL_POINTER = `<svg class="wheel-ptr-svg" viewBox="0 0 60 80" aria-hidden="true">
  <defs><linearGradient id="whp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4e14"/><stop offset=".5" stop-color="#ffe3a0"/><stop offset="1" stop-color="#7a4e14"/></linearGradient>
  <radialGradient id="whg" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ff9a8a"/><stop offset=".5" stop-color="#c0141a"/><stop offset="1" stop-color="#4a0306"/></radialGradient></defs>
  <path d="M30 78 L8 22 Q30 2 52 22 Z" fill="url(#whp)" stroke="#3a2406" stroke-width="2"/>
  <circle cx="30" cy="24" r="10" fill="url(#whg)" stroke="#3a2406" stroke-width="1.5"/>
</svg>`;
