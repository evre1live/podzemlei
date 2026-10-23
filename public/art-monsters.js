// «Под Землёй» — мультяшные монстры. Всё рисуется кодом в SVG по параметрам карты.
// Каждое тело возвращает разметку и «точки крепления» для лица, шапки и реквизита.
import { def } from '/shared/cards.js';

export const INK = '#231a26';
const OUT = `stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
const OUT2 = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const col = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

// ───────────── фон-сцена ─────────────
// яркие фоны сцен: светлый центр, насыщенный край — монстр в обводке хорошо читается
const SCENE_PAL = {
  cave: ['#ffb47c', '#b04a26', '#fff0c8'],
  water: ['#8eeaf6', '#1c72a6', '#e6fcff'],
  fire: ['#ffc46c', '#cc3416', '#fff3b0'],
  fungus: ['#b8f69e', '#268646', '#f2ffe4'],
  undead: ['#d0b8ff', '#5634a6', '#f5eeff'],
  metro: ['#b8c8f0', '#36488a', '#ffe9a6'],
  rock: ['#e6d4b6', '#76604f', '#fff8e8'],
};
export const sceneKind = (tags = []) => tags.includes('water') ? 'water' : tags.includes('fire') ? 'fire' : tags.includes('fungus') ? 'fungus'
  : tags.includes('undead') ? 'undead' : tags.includes('metro') ? 'metro' : tags.includes('rock') ? 'rock' : 'cave';
function scene(t) {
  const P = SCENE_PAL[t];
  let deco = '';
  if (t === 'cave' || t === 'rock') {
    deco = `<path d="M0 0 H160 V10 L150 26 L142 10 L128 18 L118 6 L100 30 L92 8 L70 16 L58 4 L44 22 L34 8 L20 18 L10 6 L0 14Z" fill="rgba(0,0,0,.28)"/>`
      + `<ellipse cx="80" cy="120" rx="100" ry="16" fill="rgba(0,0,0,.25)"/>`;
  } else if (t === 'water') {
    deco = `<path d="M0 100 Q20 94 40 100 T80 100 T120 100 T160 100 V120 H0Z" fill="rgba(143,227,234,.18)"/>`
      + `<path d="M10 108 Q30 103 50 108 M90 110 Q110 105 130 110" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none"/>`
      + `<circle cx="22" cy="40" r="3" fill="rgba(255,255,255,.18)"/><circle cx="140" cy="28" r="4" fill="rgba(255,255,255,.14)"/><circle cx="130" cy="60" r="2" fill="rgba(255,255,255,.2)"/>`;
  } else if (t === 'fire') {
    deco = `<path d="M0 120 Q10 96 20 110 Q30 90 42 112 Q120 120 160 120Z" fill="rgba(255,120,40,.18)"/>`
      + `<circle cx="18" cy="30" r="1.8" fill="#ffd27a"/><circle cx="142" cy="44" r="2.2" fill="#ffb347"/><circle cx="128" cy="18" r="1.5" fill="#ffd27a"/><circle cx="34" cy="70" r="1.5" fill="#ff8a3d"/>`;
  } else if (t === 'fungus') {
    deco = `<g fill="#a6f2b7" opacity=".55"><circle cx="16" cy="34" r="2.2"/><circle cx="148" cy="24" r="1.8"/><circle cx="136" cy="70" r="2.6"/><circle cx="26" cy="86" r="1.6"/><circle cx="64" cy="14" r="1.4"/></g>`
      + `<path d="M6 120 v-14 q0 -8 8 -8 q8 0 8 8 v14Z M140 120 v-10 q0 -6 6 -6 q6 0 6 6 v10Z" fill="rgba(166,242,183,.2)"/>`;
  } else if (t === 'undead') {
    deco = `<path d="M0 96 Q40 84 80 96 T160 92 V120 H0Z" fill="rgba(185,166,255,.16)"/><path d="M-10 70 Q30 60 60 72 T130 66 T180 70" stroke="rgba(185,166,255,.18)" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  } else if (t === 'metro') {
    let tiles = '';
    for (let x = 0; x < 160; x += 16) tiles += `<path d="M${x} 0 V80" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`;
    for (let y = 8; y < 80; y += 12) tiles += `<path d="M0 ${y} H160" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`;
    deco = tiles + `<rect x="0" y="62" width="160" height="7" fill="rgba(210,80,47,.45)"/><rect x="0" y="80" width="160" height="40" fill="rgba(0,0,0,.25)"/>`;
  }
  return `<rect width="160" height="120" fill="url(#sc-${t})"/><rect width="160" height="120" fill="url(#ht)"/>${deco}
    <ellipse cx="80" cy="44" rx="70" ry="42" fill="${P[2]}" opacity=".22"/><rect width="160" height="120" fill="url(#vig)"/>`;
}

// ───────────── лицо ─────────────
function eye(x, y, r, iris, style, look = 0) {
  let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="#fffdf6" ${OUT2}/>`;
  if (style === 'spiral') {
    s += `<path d="M${x} ${y} m0 -1 a1 1 0 1 1 -1 1 a2.4 2.4 0 1 1 2.4 2.4 a3.8 3.8 0 1 1 -3.8 -3.8 a${r * 0.75} ${r * 0.75} 0 1 1 ${r * 0.75} ${r * 0.75}" fill="none" stroke="#7a3fb8" stroke-width="1.8"/>`;
    return s;
  }
  const ix = x + look * r * 0.25, iy = y + r * 0.08;
  s += `<circle cx="${ix}" cy="${iy}" r="${r * 0.62}" fill="${iris}"/><circle cx="${ix}" cy="${iy}" r="${r * 0.34}" fill="${INK}"/>`;
  s += `<circle cx="${ix - r * 0.24}" cy="${iy - r * 0.28}" r="${r * 0.2}" fill="#fff"/><circle cx="${ix + r * 0.22}" cy="${iy + r * 0.2}" r="${r * 0.09}" fill="#fff"/>`;
  return s;
}
export function face(x, y, o = {}) {
  const n = o.n || 2, r = o.r || 7, gap = o.gap || 18, style = o.style || 'normal', iris = o.iris || '#e0a43a';
  const xs = n === 1 ? [x] : n === 3 ? [x - gap * 0.9, x, x + gap * 0.9] : [x - gap / 2, x + gap / 2];
  let s = '';
  xs.forEach((ex, i) => {
    const ey = n === 3 && i === 1 ? y - r * 0.8 : y;
    const rr = style === 'crazy' ? r * (i === 0 ? 1.15 : 0.8) : r;
    s += eye(ex, ey, rr, iris, style, style === 'crazy' ? (i ? 1 : -1) : 0);
    if (style === 'sleepy') s += `<path d="M${ex - rr - 1} ${ey} A${rr + 1} ${rr + 1} 0 0 1 ${ex + rr + 1} ${ey} Z" fill="${o.lid || '#8a6a5a'}" ${OUT2}/>`;
    const side = n === 1 ? 0 : i < (n - 1) / 2 ? -1 : i > (n - 1) / 2 ? 1 : 0;
    if (style === 'angry') s += `<path d="M${ex - rr} ${ey - rr - 3 + (side < 0 ? -2 : side > 0 ? 3 : 0)} L${ex + rr} ${ey - rr - 3 + (side < 0 ? 3 : side > 0 ? -2 : 0)}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    if (style === 'sad') s += `<path d="M${ex - rr} ${ey - rr - 2 + (side < 0 ? 3 : -2)} L${ex + rr} ${ey - rr - 2 + (side < 0 ? -2 : 3)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  });
  return s;
}
export function mouth(x, y, type = 'grin', w = 24) {
  const h = w / 2;
  switch (type) {
    case 'smile': return `<path d="M${x - h} ${y} Q${x} ${y + h * 0.9} ${x + h} ${y}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="${x - h - 3}" cy="${y - 1}" r="3.2" fill="#ff8f8f" opacity=".5"/><circle cx="${x + h + 3}" cy="${y - 1}" r="3.2" fill="#ff8f8f" opacity=".5"/>`;
    case 'o': return `<ellipse cx="${x}" cy="${y + 3}" rx="${w * 0.22}" ry="${w * 0.28}" fill="#4a1622" ${OUT2}/><ellipse cx="${x}" cy="${y + 6}" rx="${w * 0.12}" ry="${w * 0.1}" fill="#e46a7a"/>`;
    case 'tongue': return `<path d="M${x - h} ${y} Q${x} ${y + h * 1.2} ${x + h} ${y} Z" fill="#4a1622" ${OUT2}/><path d="M${x - 4} ${y + 4} q4 12 8 0" fill="#e46a7a" ${OUT2}/>`;
    case 'fangs': return `<path d="M${x - h} ${y} Q${x} ${y + h * 0.9} ${x + h} ${y} Z" fill="#4a1622" ${OUT2}/><path d="M${x - h * 0.6} ${y + 1} l3 7 l3 -6 M${x + h * 0.6} ${y + 1} l-3 7 l-3 -6" fill="#fffdf6" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case 'flat': return `<path d="M${x - h} ${y + 2} q${h / 2} -3 ${h} 0 t${h} 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: {
      let teeth = '';
      const n = Math.max(3, Math.round(w / 6)), step = (w * 0.86) / n;
      for (let i = 0; i < n; i++) teeth += `<path d="M${x - w * 0.43 + i * step} ${y + 0.5} l${step / 2} ${5} l${step / 2} ${-5}" fill="#fffdf6" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
      return `<path d="M${x - h} ${y} Q${x} ${y + h * 1.25} ${x + h} ${y} Z" fill="#4a1622" ${OUT2}/><path d="M${x - h * 0.45} ${y + h * 0.55} q${h * 0.45} ${h * 0.4} ${h * 0.9} 0" fill="#e46a7a"/>` + teeth;
    }
  }
}

// ───────────── реквизит ─────────────
const Y = '#f5b83d', YD = '#c47f12';
const PROPS = {
  // шапки: (x, y — макушка, w — ширина головы)
  conductorcap: (x, y, w) => `<path d="M${x - w * 0.42} ${y + 4} Q${x - w * 0.5} ${y - 12} ${x} ${y - 14} Q${x + w * 0.5} ${y - 12} ${x + w * 0.42} ${y + 4}Z" fill="#2e3f72" ${OUT}/><path d="M${x - w * 0.46} ${y + 4} Q${x} ${y + 12} ${x + w * 0.5} ${y + 2}" fill="#1b2446" ${OUT2}/><circle cx="${x}" cy="${y - 5}" r="4" fill="${Y}" ${OUT2}/>`,
  hardhat: (x, y, w) => `<path d="M${x - w * 0.42} ${y + 6} Q${x - w * 0.42} ${y - 16} ${x} ${y - 16} Q${x + w * 0.42} ${y - 16} ${x + w * 0.42} ${y + 6}Z" fill="${Y}" ${OUT}/><rect x="${x - w * 0.52}" y="${y + 2}" width="${w * 1.04}" height="7" rx="3.5" fill="${YD}" ${OUT2}/><circle cx="${x}" cy="${y - 4}" r="5" fill="#fff6c8" ${OUT2}/><path d="M${x - 5} ${y - 13} v-3 M${x + 5} ${y - 13} v-3" stroke="${INK}" stroke-width="2"/>`,
  cap: (x, y, w) => `<path d="M${x - w * 0.4} ${y + 4} Q${x - w * 0.36} ${y - 10} ${x + 2} ${y - 11} Q${x + w * 0.4} ${y - 9} ${x + w * 0.4} ${y + 4}Z" fill="#5d5f6e" ${OUT}/><path d="M${x + w * 0.1} ${y + 4} q${w * 0.35} -2 ${w * 0.55} 3 q-${w * 0.2} 4 -${w * 0.55} 1z" fill="#45475a" ${OUT2}/>`,
  sailorcap: (x, y, w) => `<path d="M${x - w * 0.36} ${y + 2} Q${x} ${y - 16} ${x + w * 0.36} ${y + 2}Z" fill="#fffdf6" ${OUT}/><rect x="${x - w * 0.4}" y="${y - 1}" width="${w * 0.8}" height="6" rx="2" fill="#2e5fa6" ${OUT2}/>`,
  bandana: (x, y, w) => `<path d="M${x - w * 0.48} ${y + 10} Q${x} ${y} ${x + w * 0.48} ${y + 10} L${x + w * 0.48} ${y + 18} Q${x} ${y + 8} ${x - w * 0.48} ${y + 18}Z" fill="#2a2230" ${OUT2}/><path d="M${x + w * 0.46} ${y + 12} l14 -6 l-4 9 l10 3 l-12 2" fill="#2a2230" ${OUT2}/>`,
  foilhat: (x, y, w) => `<path d="M${x - w * 0.42} ${y + 6} L${x} ${y - 26} L${x + w * 0.42} ${y + 6}Z" fill="#c9ced8" ${OUT}/><path d="M${x - 8} ${y - 6} l6 4 l4 -8 l6 6" stroke="#fff" stroke-width="2" fill="none"/>`,
  visor: (x, y, w) => `<path d="M${x - w * 0.46} ${y + 6} Q${x} ${y - 2} ${x + w * 0.46} ${y + 6} Q${x + w * 0.2} ${y + 20} ${x} ${y + 16} Q${x - w * 0.2} ${y + 20} ${x - w * 0.46} ${y + 6}Z" fill="rgba(80,200,120,.55)" ${OUT2}/>`,
  hat: (x, y, w) => `<ellipse cx="${x}" cy="${y + 4}" rx="${w * 0.6}" ry="6" fill="#6b4a3a" ${OUT}/><path d="M${x - w * 0.34} ${y + 2} Q${x - w * 0.36} ${y - 18} ${x} ${y - 18} Q${x + w * 0.36} ${y - 18} ${x + w * 0.34} ${y + 2}Z" fill="#7a5644" ${OUT}/><path d="M${x - w * 0.34} ${y - 4} h${w * 0.68}" stroke="#3a2620" stroke-width="4"/><path d="M${x + 6} ${y - 14} l4 4" stroke="${INK}" stroke-width="1.6"/>`,
  headphones: (x, y, w) => `<path d="M${x - w * 0.5} ${y + 16} Q${x - w * 0.5} ${y - 10} ${x} ${y - 10} Q${x + w * 0.5} ${y - 10} ${x + w * 0.5} ${y + 16}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${x - w * 0.5} ${y + 16} Q${x - w * 0.5} ${y - 10} ${x} ${y - 10} Q${x + w * 0.5} ${y - 10} ${x + w * 0.5} ${y + 16}" fill="none" stroke="#3a3f4f" stroke-width="3" stroke-linecap="round"/><rect x="${x - w * 0.5 - 8}" y="${y + 8}" width="13" height="18" rx="5" fill="#d2502f" ${OUT2}/><rect x="${x + w * 0.5 - 5}" y="${y + 8}" width="13" height="18" rx="5" fill="#d2502f" ${OUT2}/>`,
  crown: (x, y, w) => `<path d="M${x - w * 0.34} ${y + 2} v-16 l${w * 0.17} 9 l${w * 0.17} -14 l${w * 0.17} 14 l${w * 0.17} -9 v16Z" fill="${Y}" ${OUT}/><circle cx="${x}" cy="${y - 3}" r="3" fill="#d2502f" ${OUT2}/><circle cx="${x - w * 0.2}" cy="${y - 2}" r="2" fill="#3fa38c"/><circle cx="${x + w * 0.2}" cy="${y - 2}" r="2" fill="#4a7fc1"/>`,
  // лицо: (x, y — центр глаз, g — расстояние между глазами)
  glasses: (x, y, g) => `<circle cx="${x - g / 2}" cy="${y}" r="${g * 0.42}" fill="rgba(200,230,255,.25)" ${OUT2}/><circle cx="${x + g / 2}" cy="${y}" r="${g * 0.42}" fill="rgba(200,230,255,.25)" ${OUT2}/><path d="M${x - g * 0.08} ${y} h${g * 0.16}" stroke="${INK}" stroke-width="2.4"/>`,
  sunglasses: (x, y, g) => `<path d="M${x - g * 0.98} ${y - 5} h${g * 0.86} q0 11 -${g * 0.43} 11 q-${g * 0.43} 0 -${g * 0.43} -11Z M${x + g * 0.12} ${y - 5} h${g * 0.86} q0 11 -${g * 0.43} 11 q-${g * 0.43} 0 -${g * 0.43} -11Z" fill="#1c1820" ${OUT2}/><path d="M${x - g * 0.8} ${y - 3} l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  monocle: (x, y, g) => `<circle cx="${x + g / 2}" cy="${y}" r="${g * 0.45}" fill="rgba(200,230,255,.25)" stroke="${Y}" stroke-width="3"/><path d="M${x + g / 2 + g * 0.3} ${y + g * 0.35} q6 14 -2 26" stroke="${Y}" stroke-width="1.6" fill="none"/>`,
  mustache: (x, y, g) => `<path d="M${x} ${y + g * 0.75} q-${g * 0.35} -6 -${g * 0.9} 2 q${g * 0.4} -2 ${g * 0.9} -2 q${g * 0.5} 0 ${g * 0.9} 2 q-${g * 0.55} -8 -${g * 0.9} -2z" fill="#3a2620" ${OUT2}/>`,
  beard: (x, y, g) => `<path d="M${x - g * 0.9} ${y + g * 0.9} Q${x - g} ${y + g * 2.8} ${x} ${y + g * 3.4} Q${x + g} ${y + g * 2.8} ${x + g * 0.9} ${y + g * 0.9} Q${x} ${y + g * 1.6} ${x - g * 0.9} ${y + g * 0.9}Z" fill="#e9e4dc" ${OUT2}/><path d="M${x - 4} ${y + g * 1.8} q4 6 8 0 M${x - 8} ${y + g * 2.3} q8 8 16 0" stroke="#b5ada3" stroke-width="1.6" fill="none"/>`,
  // в руке: (x, y — точка хвата)
  briefcase: (x, y) => `<rect x="${x - 12}" y="${y}" width="24" height="17" rx="3" fill="#7a4b2c" ${OUT}/><path d="M${x - 5} ${y} v-4 h10 v4" fill="none" ${OUT2}/><rect x="${x - 2}" y="${y + 6}" width="4" height="4" fill="${Y}"/>`,
  calculator: (x, y) => `<rect x="${x - 9}" y="${y - 6}" width="18" height="24" rx="3" fill="#3a3f4f" ${OUT2}/><rect x="${x - 6}" y="${y - 3}" width="12" height="6" fill="#bfe8c0"/><g fill="#e9e4dc"><rect x="${x - 6}" y="${y + 6}" width="3" height="3"/><rect x="${x - 1}" y="${y + 6}" width="3" height="3"/><rect x="${x + 4}" y="${y + 6}" width="3" height="3"/><rect x="${x - 6}" y="${y + 11}" width="3" height="3"/><rect x="${x - 1}" y="${y + 11}" width="3" height="3"/><rect x="${x + 4}" y="${y + 11}" width="3" height="3" fill="${Y}"/></g>`,
  phone: (x, y) => `<rect x="${x - 6}" y="${y - 14}" width="12" height="22" rx="3" fill="#2a2230" ${OUT2}/><rect x="${x - 4}" y="${y - 11}" width="8" height="14" fill="#7fd1ff"/><path d="M${x + 10} ${y - 16} q6 4 0 10 M${x + 14} ${y - 20} q10 8 0 18" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`,
  flag: (x, y) => `<path d="M${x} ${y + 10} V${y - 34}" stroke="#7a4b2c" stroke-width="4" stroke-linecap="round"/><path d="M${x} ${y - 34} h24 l-6 8 l6 8 h-24z" fill="#d2502f" ${OUT2}/>`,
  lantern: (x, y) => `<path d="M${x} ${y - 6} v-6" stroke="${INK}" stroke-width="2"/><rect x="${x - 7}" y="${y - 6}" width="14" height="18" rx="3" fill="#fff3b0" ${OUT2}/><circle cx="${x}" cy="${y + 3}" r="9" fill="#ffe27a" opacity=".35"/><path d="M${x - 7} ${y - 6} h14 M${x - 7} ${y + 12} h14" stroke="#7a5a2a" stroke-width="3"/>`,
  plunger: (x, y) => `<path d="M${x} ${y + 6} V${y - 26}" stroke="#a6743f" stroke-width="4" stroke-linecap="round"/><path d="M${x - 10} ${y - 24} q10 -14 20 0z" fill="#d2502f" ${OUT2}/>`,
  ticket: (x, y) => `<rect x="${x - 10}" y="${y - 6}" width="20" height="13" rx="2" fill="#ffe8a8" ${OUT2}/><path d="M${x - 5} ${y - 6} v13" stroke="${INK}" stroke-width="1" stroke-dasharray="2 2"/><circle cx="${x + 4}" cy="${y}" r="2" fill="#d2502f"/>`,
  coins: (x, y) => `<g ${OUT2}><ellipse cx="${x}" cy="${y + 8}" rx="9" ry="4" fill="${YD}"/><ellipse cx="${x}" cy="${y + 4}" rx="9" ry="4" fill="${Y}"/><ellipse cx="${x + 6}" cy="${y - 2}" rx="7" ry="7" fill="${Y}"/></g><path d="M${x + 6} ${y - 5} v6" stroke="${YD}" stroke-width="2"/>`,
  cup: (x, y) => `<path d="M${x - 8} ${y - 6} h16 l-2 16 h-12z" fill="#c9ced8" ${OUT2}/><circle cx="${x - 2}" cy="${y - 2}" r="2.4" fill="${Y}"/>`,
  sword: (x, y) => `<path d="M${x} ${y + 4} L${x + 26} ${y - 30}" stroke="#d9dee6" stroke-width="5" stroke-linecap="round"/><path d="M${x} ${y + 4} L${x + 26} ${y - 30}" stroke="${INK}" stroke-width="1.2"/><path d="M${x - 6} ${y - 2} l12 9" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  dumbbell: (x, y) => `<path d="M${x - 14} ${y} h28" stroke="#6f7383" stroke-width="4"/><rect x="${x - 20}" y="${y - 8}" width="8" height="16" rx="2" fill="#3a3f4f" ${OUT2}/><rect x="${x + 12}" y="${y - 8}" width="8" height="16" rx="2" fill="#3a3f4f" ${OUT2}/>`,
  keys: (x, y) => `<circle cx="${x}" cy="${y - 4}" r="6" fill="none" stroke="${Y}" stroke-width="3"/><path d="M${x + 2} ${y + 2} l6 14 m-2 -5 l4 -2 M${x - 3} ${y + 2} l-4 14 m1 -4 l-4 -1" stroke="${Y}" stroke-width="3" stroke-linecap="round"/>`,
  stamp: (x, y) => `<rect x="${x - 4}" y="${y - 18}" width="8" height="14" rx="3" fill="#7a4b2c" ${OUT2}/><rect x="${x - 11}" y="${y - 4}" width="22" height="9" rx="2" fill="#d2502f" ${OUT2}/>`,
  book: (x, y) => `<path d="M${x - 14} ${y - 8} q7 -4 14 0 q7 -4 14 0 v20 q-7 -4 -14 0 q-7 -4 -14 0z" fill="#e9e1c6" ${OUT2}/><path d="M${x} ${y - 8} v20" stroke="${INK}" stroke-width="1.6"/><path d="M${x - 10} ${y - 2} h7 M${x - 10} ${y + 3} h7 M${x + 3} ${y - 2} h7" stroke="#8a7a5a" stroke-width="1.2"/>`,
  yarn: (x, y) => `<circle cx="${x}" cy="${y + 2}" r="10" fill="#e86fb1" ${OUT2}/><path d="M${x - 8} ${y - 2} q8 6 16 -2 M${x - 9} ${y + 5} q9 6 18 -2" stroke="#b5427f" stroke-width="1.6" fill="none"/><path d="M${x - 16} ${y - 18} l12 18 M${x + 16} ${y - 18} l-12 18" stroke="#c9ced8" stroke-width="2.6" stroke-linecap="round"/>`,
  pendulum: (x, y) => `<path d="M${x} ${y - 6} l10 22" stroke="${Y}" stroke-width="1.6"/><circle cx="${x + 10}" cy="${y + 18}" r="5" fill="${Y}" ${OUT2}/>`,
  whistle: (x, y) => `<path d="M${x - 8} ${y - 4} h12 a6 6 0 1 1 -6 6 h-6z" fill="#c9ced8" ${OUT2}/>`,
  rebar: (x, y) => `<path d="M${x - 4} ${y + 10} L${x + 18} ${y - 32}" stroke="#a5582f" stroke-width="5" stroke-linecap="round"/><path d="M${x} ${y + 2} l4 1 M${x + 6} ${y - 10} l4 1 M${x + 12} ${y - 22} l4 1" stroke="${INK}" stroke-width="1.4"/>`,
  // на теле: (x, y — шея, w — ширина)
  tie: (x, y) => `<path d="M${x - 4} ${y} h8 l-2 4 l4 18 l-6 6 l-6 -6 l4 -18z" fill="#d2502f" ${OUT2}/>`,
  scarf: (x, y, w) => `<path d="M${x - w * 0.4} ${y - 2} q${w * 0.4} 10 ${w * 0.8} 0 v7 q-${w * 0.4} 10 -${w * 0.8} 0z" fill="#3fa38c" ${OUT2}/><path d="M${x + w * 0.2} ${y + 4} l4 18 l6 -2 l-4 -16" fill="#3fa38c" ${OUT2}/>`,
};
// задний план: плащ, рама, пламя
const BACK = {
  cape: (A) => `<path d="M${A.face.x - 34} ${A.face.y + 14} Q${A.face.x - 60} ${A.face.y + 50} ${A.face.x - 52} 112 H${A.face.x + 52} Q${A.face.x + 60} ${A.face.y + 50} ${A.face.x + 34} ${A.face.y + 14}Z" fill="#8f2a3a" ${OUT}/><path d="M${A.face.x - 40} ${A.face.y + 18} q40 -16 80 0 l-6 12 q-34 -12 -68 0z" fill="#f3eee4" ${OUT2}/><g fill="${INK}"><circle cx="${A.face.x - 24}" cy="${A.face.y + 22}" r="1.6"/><circle cx="${A.face.x}" cy="${A.face.y + 18}" r="1.6"/><circle cx="${A.face.x + 24}" cy="${A.face.y + 22}" r="1.6"/></g>`,
  mirrorframe: () => `<rect x="36" y="8" width="88" height="100" rx="44" fill="rgba(170,220,255,.18)" stroke="${Y}" stroke-width="6"/><rect x="36" y="8" width="88" height="100" rx="44" fill="none" stroke="${INK}" stroke-width="2"/><path d="M50 30 l14 -12 M48 46 l26 -24" stroke="#fff" stroke-width="3" opacity=".45" stroke-linecap="round"/>`,
  flames: () => `<path d="M24 108 Q18 80 32 70 Q30 88 42 86 Q36 64 52 50 Q50 76 62 80" fill="#ff8a3d" opacity=".55"/><path d="M136 108 Q144 80 128 70 Q130 88 118 86 Q124 64 108 50 Q110 76 98 80" fill="#ff8a3d" opacity=".55"/>`,
};
// передний план: эффекты
const FRONT = {
  steam: () => `<g fill="#f3eee4" opacity=".75" ${OUT2}><circle cx="118" cy="22" r="7"/><circle cx="128" cy="14" r="5"/><circle cx="136" cy="8" r="3.5"/></g>`,
  soundwaves: (A) => `<path d="M${A.mouth.x + 20} ${A.mouth.y - 8} q8 8 0 16 M${A.mouth.x + 28} ${A.mouth.y - 14} q14 14 0 28 M${A.mouth.x - 20} ${A.mouth.y - 8} q-8 8 0 16 M${A.mouth.x - 28} ${A.mouth.y - 14} q-14 14 0 28" stroke="#d9b3ff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  notes: () => `<g fill="#f5b83d" ${OUT2}><path d="M24 30 v-14 l10 -3 v14"/><circle cx="21" cy="30" r="4"/><circle cx="31" cy="27" r="4"/><path d="M132 24 v-14"/><circle cx="129" cy="24" r="4"/></g>`,
  antenna: (A) => `<path d="M${A.top.x} ${A.top.y} v-16" stroke="${INK}" stroke-width="2.6"/><circle cx="${A.top.x}" cy="${A.top.y - 18}" r="4" fill="#d2502f" ${OUT2}/>`,
  nails: () => `<g fill="#c9ced8" ${OUT2}><circle cx="24" cy="66" r="3"/><circle cx="136" cy="66" r="3"/></g>`,
  needle: (A) => `<path d="M${A.mouth.x} ${A.mouth.y} L${A.mouth.x + 4} ${A.mouth.y + 26}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  claws: (A) => [A.handL, A.handR].map(h => `<path d="M${h.x - 6} ${h.y} l-4 9 M${h.x} ${h.y + 2} l0 10 M${h.x + 6} ${h.y} l4 9" stroke="#efe6d4" stroke-width="3.4" stroke-linecap="round"/>`).join(''),
  fur: () => `<path d="M40 56 l-6 -4 l8 -2 M120 56 l6 -4 l-8 -2 M60 30 l-2 -8 l6 4 M100 30 l2 -8 l-6 4" stroke="#5a3a2a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};
const HAT = new Set(['headphones', 'conductorcap', 'hardhat', 'cap', 'sailorcap', 'bandana', 'foilhat', 'visor', 'hat']);
const FACE = new Set(['glasses', 'sunglasses', 'monocle', 'mustache', 'beard']);
const HELD = new Set(['briefcase', 'calculator', 'phone', 'flag', 'lantern', 'plunger', 'ticket', 'coins', 'cup', 'sword', 'dumbbell', 'keys', 'stamp', 'book', 'yarn', 'pendulum', 'whistle', 'rebar']);
const NECK = new Set(['tie', 'scarf']);

// ───────────── тела ─────────────
// C: { f — заливка тела, fl — светлый, fd — тёмный, h, s }
const hilite = (d, o = 0.45) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="4" stroke-linecap="round"/>`;
const shadow = (x = 80, w = 46) => `<ellipse cx="${x}" cy="110" rx="${w}" ry="7" fill="rgba(0,0,0,.35)"/>`;
const arm = (x1, y1, x2, y2, C) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + 8} ${x2} ${y2}" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + 8} ${x2} ${y2}" stroke="${C.fd}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="5" fill="${C.fd}" ${OUT2}/>`;

const BODIES = {
  blob(C, a) {
    const pat = a.pattern === 'spots' ? `<g fill="${C.fl}" opacity=".7"><circle cx="58" cy="70" r="6"/><circle cx="104" cy="82" r="8"/><circle cx="96" cy="50" r="4"/><circle cx="66" cy="92" r="4"/></g>` : '';
    return {
      svg: shadow(80, 50) + `<path d="M26 104 C14 70 30 30 74 26 C116 22 140 54 134 86 C132 104 118 106 82 106 C54 106 34 110 26 104Z" fill="${C.f}" ${OUT}/>` + pat
        + `<path d="M46 98 q34 10 70 0" stroke="${C.fd}" stroke-width="4" fill="none" opacity=".6"/>` + hilite('M44 52 Q54 36 74 34'),
      A: { face: { x: 80, y: 58, g: 20 }, mouth: { x: 80, y: 76, w: 26 }, top: { x: 80, y: 30, w: 70 }, handL: { x: 30, y: 82 }, handR: { x: 128, y: 82 }, neck: { x: 80, y: 86 } },
    };
  },
  plank(C) {
    return {
      svg: shadow(80, 60) + `<rect x="16" y="46" width="128" height="40" rx="6" fill="${C.f}" ${OUT}/><path d="M24 60 h34 M74 72 h44 M40 78 h18" stroke="${C.fd}" stroke-width="3" stroke-linecap="round"/><path d="M106 54 q6 6 0 12" stroke="${C.fd}" stroke-width="2.4" fill="none"/>` + hilite('M24 52 H90', 0.35)
        + `<path d="M30 86 l-6 18 M130 86 l6 18" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
      A: { face: { x: 80, y: 62, g: 22 }, mouth: { x: 80, y: 76, w: 20 }, top: { x: 80, y: 46, w: 60 }, handL: { x: 18, y: 66 }, handR: { x: 142, y: 66 }, neck: { x: 80, y: 86 } },
    };
  },
  round(C, a) {
    const heads = a.heads || 1;
    if (heads === 1) {
      return {
        svg: shadow(80, 44) + `<circle cx="50" cy="30" r="12" fill="${C.f}" ${OUT}/><circle cx="110" cy="30" r="12" fill="${C.f}" ${OUT}/><circle cx="50" cy="30" r="6" fill="#ffb0b8"/><circle cx="110" cy="30" r="6" fill="#ffb0b8"/>`
          + `<ellipse cx="80" cy="66" rx="44" ry="40" fill="${C.f}" ${OUT}/><ellipse cx="80" cy="82" rx="26" ry="20" fill="${C.fl}" opacity=".55"/>`
          + `<ellipse cx="80" cy="68" rx="9" ry="6" fill="#ff9aa8" ${OUT2}/>` + hilite('M48 46 Q58 32 76 30')
          + `<path d="M56 104 v6 M104 104 v6" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
        A: { face: { x: 80, y: 54, g: 22 }, mouth: { x: 80, y: 80, w: 22 }, top: { x: 80, y: 28, w: 66 }, handL: { x: 36, y: 84 }, handR: { x: 124, y: 84 }, neck: { x: 80, y: 92 } },
        arms: true,
      };
    }
    const xs = heads === 2 ? [56, 104] : [40, 80, 120];
    let svg = shadow(80, 58) + `<ellipse cx="80" cy="84" rx="${heads === 2 ? 52 : 62}" ry="26" fill="${C.fd}" ${OUT}/>`;
    const extra = [];
    xs.forEach((x, i) => {
      const y = heads === 3 && i === 1 ? 40 : 50;
      svg += `<circle cx="${x - 15}" cy="${y - 16}" r="7" fill="${C.f}" ${OUT2}/><circle cx="${x + 15}" cy="${y - 16}" r="7" fill="${C.f}" ${OUT2}/><circle cx="${x}" cy="${y}" r="21" fill="${C.f}" ${OUT}/>`
        + face(x, y - 3, { r: 5, gap: 13, style: a.eyes || 'angry', iris: C.iris }) + mouth(x, y + 9, a.mouth || 'fangs', 14)
        + `<ellipse cx="${x}" cy="${y + 4}" rx="4" ry="3" fill="#ff9aa8" ${OUT2}/>`;
      extra.push({ x, y });
    });
    const main = heads === 3 ? extra[1] : extra[0];
    return {
      svg, noFace: true,
      A: { face: { x: main.x, y: main.y - 3, g: 13 }, mouth: { x: main.x, y: main.y + 9, w: 14 }, top: { x: main.x, y: main.y - 18, w: 36 }, handL: { x: 30, y: 92 }, handR: { x: 130, y: 92 }, neck: { x: main.x, y: main.y + 22 } },
    };
  },
  box(C) {
    return {
      svg: shadow(80, 52) + `<rect x="28" y="28" width="104" height="74" rx="10" fill="${C.f}" ${OUT}/><rect x="28" y="82" width="104" height="20" rx="5" fill="${C.fd}" ${OUT2}/>`
        + `<circle cx="46" cy="104" r="8" fill="#3a3f4f" ${OUT2}/><circle cx="114" cy="104" r="8" fill="#3a3f4f" ${OUT2}/><circle cx="46" cy="104" r="3" fill="#c9ced8"/><circle cx="114" cy="104" r="3" fill="#c9ced8"/>`
        + `<g fill="${C.fd}"><circle cx="36" cy="36" r="2.4"/><circle cx="124" cy="36" r="2.4"/><circle cx="36" cy="76" r="2.4"/><circle cx="124" cy="76" r="2.4"/></g>` + hilite('M38 40 H96', 0.35),
      A: { face: { x: 80, y: 48, g: 26 }, mouth: { x: 80, y: 66, w: 30 }, top: { x: 80, y: 28, w: 80 }, handL: { x: 22, y: 64 }, handR: { x: 138, y: 64 }, neck: { x: 80, y: 80 } },
      arms: true,
    };
  },
  bug(C) {
    let legs = '';
    for (let i = 0; i < 3; i++) legs += `<path d="M${54 + i * 22} 82 l-10 20 M${60 + i * 22} 82 l10 20" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    return {
      svg: shadow(80, 56) + legs + `<path d="M58 34 q-12 -22 -30 -18 M74 32 q4 -24 22 -26" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="28" cy="16" r="4" fill="${C.fd}" ${OUT2}/><circle cx="96" cy="6" r="4" fill="${C.fd}" ${OUT2}/>`
        + `<ellipse cx="88" cy="70" rx="52" ry="26" fill="${C.f}" ${OUT}/><path d="M88 46 V94 M62 52 q-4 18 0 36 M114 52 q4 18 0 36" stroke="${C.fd}" stroke-width="3" fill="none"/>`
        + `<circle cx="58" cy="50" r="22" fill="${C.f}" ${OUT}/>` + hilite('M70 50 Q86 42 110 46', 0.4) + hilite('M44 40 Q50 32 60 32', 0.5),
      A: { face: { x: 58, y: 46, g: 16 }, mouth: { x: 58, y: 60, w: 16 }, top: { x: 58, y: 28, w: 40 }, handL: { x: 30, y: 72 }, handR: { x: 86, y: 76 }, neck: { x: 58, y: 70 } },
    };
  },
  moth(C) {
    return {
      svg: shadow(80, 40) + `<path d="M80 60 C50 20 14 24 12 52 C10 76 40 84 80 70Z M80 60 C110 20 146 24 148 52 C150 76 120 84 80 70Z" fill="${C.fl}" ${OUT}/>`
        + `<circle cx="38" cy="52" r="10" fill="${C.fd}" ${OUT2}/><circle cx="38" cy="52" r="4" fill="#fffdf6"/><circle cx="122" cy="52" r="10" fill="${C.fd}" ${OUT2}/><circle cx="122" cy="52" r="4" fill="#fffdf6"/>`
        + `<path d="M76 26 q-10 -16 -22 -14 M84 26 q10 -16 22 -14" stroke="${INK}" stroke-width="2.6" fill="none"/><path d="M54 12 l-4 4 M106 12 l4 4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
        + `<ellipse cx="80" cy="74" rx="14" ry="30" fill="${C.f}" ${OUT}/><path d="M68 70 h24 M68 82 h24 M70 94 h20" stroke="${C.fd}" stroke-width="2.4"/><circle cx="80" cy="40" r="15" fill="${C.f}" ${OUT}/>`,
      A: { face: { x: 80, y: 38, g: 12 }, mouth: { x: 80, y: 48, w: 12 }, top: { x: 80, y: 26, w: 28 }, handL: { x: 60, y: 80 }, handR: { x: 100, y: 80 }, neck: { x: 80, y: 54 } },
      small: true,
    };
  },
  worm(C, a) {
    let seg = '';
    const pts = [[26, 92], [42, 84], [58, 80], [74, 80], [90, 76]];
    pts.forEach(([x, y], i) => { seg += `<circle cx="${x}" cy="${y}" r="${15 - i}" fill="${i % 2 ? C.fd : C.f}" ${OUT}/>`; });
    return {
      svg: shadow(70, 56) + seg + `<ellipse cx="108" cy="50" rx="28" ry="30" fill="${C.f}" ${OUT}/>` + hilite('M90 34 Q100 24 114 24'),
      A: { face: { x: 104, y: 42, g: 16 }, mouth: { x: 108, y: 60, w: 22 }, top: { x: 106, y: 22, w: 50 }, handL: { x: 82, y: 70 }, handR: { x: 134, y: 66 }, neck: { x: 108, y: 76 } },
    };
  },
  humanoid(C, a) {
    const skin = col((a.hue + 30) % 360, 35, 74);
    return {
      svg: shadow(80, 40) + `<path d="M48 108 Q46 70 80 66 Q114 70 112 108Z" fill="${C.f}" ${OUT}/><path d="M80 68 V106" stroke="${C.fd}" stroke-width="3"/><g fill="${C.fd}"><circle cx="86" cy="80" r="2.4"/><circle cx="86" cy="92" r="2.4"/></g>`
        + `<circle cx="80" cy="44" r="26" fill="${skin}" ${OUT}/><ellipse cx="80" cy="50" rx="6" ry="5" fill="${col((a.hue + 10) % 360, 45, 62)}" ${OUT2}/>`
        + `<circle cx="54" cy="46" r="6" fill="${skin}" ${OUT2}/><circle cx="106" cy="46" r="6" fill="${skin}" ${OUT2}/>` + hilite('M62 30 Q70 22 82 22', 0.5),
      A: { face: { x: 80, y: 40, g: 18 }, mouth: { x: 80, y: 58, w: 18 }, top: { x: 80, y: 20, w: 56 }, handL: { x: 44, y: 92 }, handR: { x: 118, y: 92 }, neck: { x: 80, y: 68 } },
      arms: true, armFrom: { l: { x: 56, y: 80 }, r: { x: 104, y: 80 } }, lid: skin,
    };
  },
  disc(C) {
    return {
      svg: shadow(80, 56) + `<ellipse cx="80" cy="84" rx="58" ry="18" fill="${C.fd}" ${OUT}/><ellipse cx="80" cy="70" rx="58" ry="26" fill="${C.f}" ${OUT}/><ellipse cx="80" cy="64" rx="34" ry="12" fill="${C.fl}" opacity=".5"/>`
        + `<path d="M40 88 h80" stroke="#3a3f4f" stroke-width="5" stroke-linecap="round"/>` + hilite('M36 62 Q56 48 86 46', 0.4),
      A: { face: { x: 80, y: 62, g: 22, n: 1 }, mouth: { x: 80, y: 78, w: 22 }, top: { x: 80, y: 44, w: 50 }, handL: { x: 22, y: 76 }, handR: { x: 138, y: 76 }, neck: { x: 80, y: 86 } },
    };
  },
  bird(C) {
    return {
      svg: shadow(78, 44) + `<path d="M70 106 l-4 6 h10 M90 106 l-2 6 h10" stroke="#e8902c" stroke-width="4" fill="none" stroke-linecap="round"/>`
        + `<ellipse cx="72" cy="80" rx="44" ry="28" fill="${C.f}" ${OUT}/><path d="M42 74 q20 -16 40 6 q-20 10 -40 -6z" fill="${C.fd}" ${OUT2}/>`
        + `<circle cx="98" cy="44" r="22" fill="${C.f}" ${OUT}/><path d="M114 46 l24 4 l-24 10z" fill="#f5a33d" ${OUT}/><path d="M116 52 l18 2" stroke="${INK}" stroke-width="1.6"/>` + hilite('M84 30 Q92 24 102 24'),
      A: { face: { x: 96, y: 40, g: 14 }, mouth: { x: 0, y: 0, w: 0 }, top: { x: 96, y: 22, w: 40 }, handL: { x: 30, y: 84 }, handR: { x: 116, y: 86 }, neck: { x: 98, y: 64 } },
      noMouth: true,
    };
  },
  spike(C, a) {
    if (a.flip) {
      return {
        svg: shadow(80, 46) + `<path d="M26 108 L80 6 L134 108 Z" fill="${C.f}" ${OUT}/><path d="M56 108 L72 50 M104 108 L92 60" stroke="${C.fd}" stroke-width="3"/><path d="M40 100 q40 10 80 0" stroke="${C.fd}" stroke-width="4" fill="none" opacity=".6"/>` + hilite('M66 40 L76 20', 0.5),
        A: { face: { x: 80, y: 58, g: 18 }, mouth: { x: 80, y: 74, w: 18 }, top: { x: 80, y: 20, w: 30 }, handL: { x: 40, y: 92 }, handR: { x: 122, y: 92 }, neck: { x: 80, y: 82 } },
      };
    }
    return {
      svg: `<path d="M18 0 H142 L84 108 Q80 114 76 108Z" fill="${C.f}" ${OUT}/><path d="M46 6 L64 56 M114 6 L98 46" stroke="${C.fd}" stroke-width="3"/>` + hilite('M40 10 L62 54', 0.4)
        + `<circle cx="80" cy="112" r="3" fill="#9ad0ff" opacity=".8"/>`,
      A: { face: { x: 80, y: 32, g: 20 }, mouth: { x: 80, y: 50, w: 18 }, top: { x: 80, y: 6, w: 40 }, handL: { x: 36, y: 22 }, handR: { x: 124, y: 22 }, neck: { x: 80, y: 60 } },
    };
  },
  shroom(C, a) {
    const spots = a.pattern === 'spots' || !a.pattern ? `<g fill="#fffdf6" opacity=".85" ${OUT2}><circle cx="52" cy="34" r="7"/><circle cx="90" cy="22" r="9"/><circle cx="118" cy="40" r="6"/><circle cx="74" cy="44" r="4"/></g>` : '';
    return {
      svg: shadow(80, 40) + `<path d="M54 108 Q50 76 58 58 H102 Q110 76 106 108Z" fill="#f3e6c8" ${OUT}/><path d="M60 96 q20 8 40 0" stroke="#d9c39a" stroke-width="3" fill="none"/>`
        + `<path d="M14 62 C14 14 146 14 146 62 Q80 74 14 62Z" fill="${C.f}" ${OUT}/>` + spots + hilite('M30 46 Q46 22 76 18', 0.4),
      A: { face: { x: 80, y: 78, g: 18 }, mouth: { x: 80, y: 94, w: 16 }, top: { x: 80, y: 27, w: 90 }, handL: { x: 46, y: 92 }, handR: { x: 114, y: 92 }, neck: { x: 80, y: 102 } },
      arms: true, armFrom: { l: { x: 58, y: 84 }, r: { x: 102, y: 84 } }, lid: '#e9d9b8',
    };
  },
  ghost(C, a) {
    const band = a.pattern === 'bandage' ? `<g stroke="${C.fd}" stroke-width="3" fill="none" opacity=".8"><path d="M40 52 q40 -10 80 4"/><path d="M36 72 q44 10 88 -4"/><path d="M38 92 q40 -12 84 2"/><path d="M50 40 q30 12 62 -6"/></g>` : '';
    return {
      svg: `<ellipse cx="80" cy="112" rx="36" ry="5" fill="rgba(0,0,0,.25)"/><path d="M34 104 V54 C34 14 126 14 126 54 V104 l-12 -10 l-11 10 l-12 -10 l-11 10 l-12 -10 l-11 10 l-11 -10z" fill="${C.f}" ${OUT} opacity=".96"/>` + band
        + hilite('M48 40 Q58 22 80 20', 0.5),
      A: { face: { x: 80, y: 50, g: 24 }, mouth: { x: 80, y: 72, w: 20 }, top: { x: 80, y: 24, w: 70 }, handL: { x: 30, y: 72 }, handR: { x: 130, y: 72 }, neck: { x: 80, y: 82 } },
      arms: true, armFrom: { l: { x: 40, y: 64 }, r: { x: 120, y: 64 } }, defaultMouth: 'o',
    };
  },
  skull(C) {
    return {
      svg: shadow(80, 40) + `<path d="M60 92 h40 v14 h-40z" fill="#efe6d4" ${OUT}/><path d="M68 92 v14 M80 92 v14 M92 92 v14" stroke="${INK}" stroke-width="2"/>`
        + `<path d="M32 58 C32 18 128 18 128 58 C128 72 118 78 116 84 V94 H44 V84 C42 78 32 72 32 58Z" fill="#efe6d4" ${OUT}/>`
        + `<path d="M74 74 l6 -9 l6 9z" fill="${INK}"/><path d="M52 94 v8 M64 94 v8 M76 94 v8 M88 94 v8 M100 94 v8" stroke="${INK}" stroke-width="2.4"/>` + hilite('M46 40 Q58 26 78 24', 0.6),
      A: { face: { x: 80, y: 56, g: 28 }, mouth: { x: 0, y: 0, w: 0 }, top: { x: 80, y: 24, w: 80 }, handL: { x: 30, y: 82 }, handR: { x: 130, y: 82 }, neck: { x: 80, y: 96 } },
      noMouth: true, skullEyes: true,
    };
  },
  swarm(C) {
    let s = shadow(80, 56);
    const bats = [[40, 40, 1], [86, 30, 1.2], [122, 52, 0.9], [62, 74, 1.1], [106, 84, 0.8], [30, 86, 0.7]];
    for (const [x, y, k] of bats) {
      s += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0 C-10 -14 -24 -12 -30 -4 C-22 -2 -20 4 -22 10 C-14 6 -8 8 -4 12 C-2 6 2 6 4 12 C8 8 14 6 22 10 C20 4 22 -2 30 -4 C24 -12 10 -14 0 0Z" fill="${C.f}" ${OUT2}/><circle cx="0" cy="2" r="7" fill="${C.f}" ${OUT2}/>`
        + `<circle cx="-2.4" cy="1" r="1.8" fill="#ffe27a"/><circle cx="2.4" cy="1" r="1.8" fill="#ffe27a"/><path d="M-2 6 l1 2 l1 -2 l1 2 l1 -2" stroke="#fff" stroke-width="1"/></g>`;
    }
    return { svg: s, noFace: true, A: { face: { x: 86, y: 30, g: 6 }, mouth: { x: 86, y: 40, w: 8 }, top: { x: 86, y: 20, w: 20 }, handL: { x: 30, y: 60 }, handR: { x: 130, y: 60 }, neck: { x: 86, y: 40 } } };
  },
  croc(C) {
    let teeth = '';
    for (let i = 0; i < 6; i++) teeth += `<path d="M${88 + i * 9} 62 l4 6 l4 -6" fill="#fffdf6" stroke="${INK}" stroke-width="1.3"/>`;
    return {
      svg: shadow(80, 60) + `<path d="M14 92 Q4 84 18 80 Q30 76 40 80" fill="${C.f}" ${OUT}/><path d="M24 96 Q20 66 54 62 H96 Q120 62 124 80 Q122 100 92 102 H40 Q28 102 24 96Z" fill="${C.f}" ${OUT}/>`
        + `<path d="M44 66 l6 -8 l6 8 M60 64 l6 -8 l6 8" fill="${C.fd}" ${OUT2}/><path d="M38 96 l-4 10 M58 100 l-2 8 M94 100 l2 8 M110 96 l4 10" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
        + `<path d="M80 50 Q84 34 104 36 H140 Q154 38 150 54 Q146 64 136 64 H86 Q78 62 80 50Z" fill="${C.f}" ${OUT}/><path d="M86 62 H146" stroke="${INK}" stroke-width="2"/>` + teeth
        + `<circle cx="144" cy="44" r="2" fill="${INK}"/>` + hilite('M92 40 Q104 34 124 36', 0.4),
      A: { face: { x: 96, y: 36, g: 14 }, mouth: { x: 0, y: 0, w: 0 }, top: { x: 98, y: 30, w: 30 }, handL: { x: 40, y: 92 }, handR: { x: 104, y: 92 }, neck: { x: 84, y: 66 } },
      noMouth: true,
    };
  },
  golem(C) {
    return {
      svg: shadow(80, 56) + `<rect x="22" y="56" width="26" height="30" rx="6" fill="${C.fd}" ${OUT}/><rect x="112" y="56" width="26" height="30" rx="6" fill="${C.fd}" ${OUT}/>`
        + `<path d="M40 46 h80 l8 54 h-96z" fill="${C.f}" ${OUT}/><rect x="52" y="14" width="56" height="40" rx="8" fill="${C.f}" ${OUT}/>`
        + `<path d="M60 70 l8 6 l-4 8 M100 62 l-6 10 l6 6 M66 24 l6 6 M96 44 l6 -6" stroke="${C.fd}" stroke-width="2.4" fill="none"/>`
        + `<rect x="50" y="100" width="22" height="10" rx="3" fill="${C.fd}" ${OUT2}/><rect x="88" y="100" width="22" height="10" rx="3" fill="${C.fd}" ${OUT2}/>` + hilite('M58 20 H90', 0.35),
      A: { face: { x: 80, y: 30, g: 20 }, mouth: { x: 80, y: 44, w: 20 }, top: { x: 80, y: 14, w: 56 }, handL: { x: 34, y: 78 }, handR: { x: 126, y: 78 }, neck: { x: 80, y: 54 } },
      defaultMouth: 'flat',
    };
  },
  excavator(C) {
    return {
      svg: shadow(80, 62) + `<rect x="18" y="88" width="110" height="18" rx="9" fill="#3a3f4f" ${OUT}/><g fill="#c9ced8"><circle cx="32" cy="97" r="4"/><circle cx="56" cy="97" r="4"/><circle cx="80" cy="97" r="4"/><circle cx="104" cy="97" r="4"/></g>`
        + `<rect x="30" y="44" width="64" height="46" rx="6" fill="${C.f}" ${OUT}/><rect x="40" y="52" width="34" height="26" rx="4" fill="#9fd9ef" ${OUT2}/>`
        + `<path d="M94 58 L130 26 L148 46" stroke="${INK}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M94 58 L130 26 L148 46" stroke="${C.fd}" stroke-width="7" fill="none" stroke-linecap="round"/>`
        + `<path d="M138 44 h22 l-4 22 q-10 6 -18 -2z" fill="#8b8494" ${OUT}/><path d="M142 66 l2 6 M150 68 l1 6" stroke="${INK}" stroke-width="2.6"/>`
        + hilite('M36 50 H70', 0.35),
      noFace: true,
      A: { face: { x: 57, y: 60, g: 18 }, mouth: { x: 57, y: 72, w: 14 }, top: { x: 62, y: 44, w: 60 }, handL: { x: 24, y: 70 }, handR: { x: 148, y: 50 }, neck: { x: 62, y: 86 } },
      extra: `<circle cx="50" cy="61" r="5" fill="#efe6d4" ${OUT2}/><circle cx="64" cy="61" r="5" fill="#efe6d4" ${OUT2}/><circle cx="50" cy="61" r="2" fill="#ff5a3d"/><circle cx="64" cy="61" r="2" fill="#ff5a3d"/><path d="M50 72 h14" stroke="${INK}" stroke-width="2"/><path d="M52 70 v4 M56 70 v4 M60 70 v4" stroke="${INK}" stroke-width="1.4"/>`,
    };
  },
  horned(C) {
    return {
      svg: shadow(80, 48) + `<path d="M40 44 C22 34 18 14 26 4 C32 20 40 24 50 28Z M120 44 C138 34 142 14 134 4 C128 20 120 24 110 28Z" fill="#f3e6c8" ${OUT}/>`
        + `<ellipse cx="80" cy="66" rx="44" ry="40" fill="${C.f}" ${OUT}/><ellipse cx="80" cy="82" rx="22" ry="14" fill="${C.fl}" ${OUT2}/><circle cx="72" cy="82" r="3.4" fill="${INK}"/><circle cx="88" cy="82" r="3.4" fill="${INK}"/>`
        + `<circle cx="80" cy="96" r="6" fill="none" stroke="${Y}" stroke-width="3"/>` + hilite('M48 44 Q58 30 76 28'),
      A: { face: { x: 80, y: 54, g: 26 }, mouth: { x: 0, y: 0, w: 0 }, top: { x: 80, y: 28, w: 60 }, handL: { x: 34, y: 86 }, handR: { x: 126, y: 86 }, neck: { x: 80, y: 102 } },
      noMouth: true, arms: true,
    };
  },
  spider(C) {
    let legs = '';
    for (let i = 0; i < 4; i++) {
      legs += `<path d="M66 ${60 + i * 7} Q${36 - i * 3} ${36 + i * 12} ${14 + i * 4} ${70 + i * 10}" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
      legs += `<path d="M94 ${60 + i * 7} Q${124 + i * 3} ${36 + i * 12} ${146 - i * 4} ${70 + i * 10}" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    }
    return {
      svg: `<path d="M80 0 v30" stroke="#e9e4dc" stroke-width="1.6"/>` + shadow(80, 46) + legs + `<ellipse cx="80" cy="66" rx="32" ry="30" fill="${C.f}" ${OUT}/><path d="M68 84 q12 8 24 0" stroke="${C.fd}" stroke-width="3" fill="none"/>` + hilite('M58 52 Q66 40 80 38', 0.45),
      A: { face: { x: 80, y: 58, g: 14, n: 3 }, mouth: { x: 80, y: 74, w: 16 }, top: { x: 80, y: 38, w: 50 }, handL: { x: 30, y: 88 }, handR: { x: 130, y: 88 }, neck: { x: 80, y: 90 } },
      defaultMouth: 'fangs',
    };
  },
  bat(C) {
    return {
      svg: shadow(80, 40) + `<path d="M80 50 C58 22 30 22 8 40 C22 46 22 58 16 70 C32 62 42 68 50 80 C56 68 70 68 80 74 C90 68 104 68 110 80 C118 68 128 62 144 70 C138 58 138 46 152 40 C130 22 102 22 80 50Z" fill="${C.fd}" ${OUT}/>`
        + `<path d="M30 40 l14 24 M56 34 l8 30 M130 40 l-14 24 M104 34 l-8 30" stroke="${INK}" stroke-width="1.8" opacity=".6"/>`
        + `<ellipse cx="80" cy="70" rx="22" ry="30" fill="${C.f}" ${OUT}/><path d="M64 46 l-6 -18 l14 12 M96 46 l6 -18 l-14 12" fill="${C.f}" ${OUT2}/>` + hilite('M66 50 Q72 42 82 42', 0.45),
      A: { face: { x: 80, y: 60, g: 16 }, mouth: { x: 80, y: 76, w: 16 }, top: { x: 80, y: 42, w: 40 }, handL: { x: 52, y: 88 }, handR: { x: 108, y: 88 }, neck: { x: 80, y: 84 } },
      defaultMouth: 'fangs',
    };
  },
  dragon(C, a) {
    const heads = a.heads || 1;
    let s = shadow(80, 60) + `<path d="M40 70 C14 54 12 26 20 14 C28 32 40 38 54 42Z M120 70 C146 54 148 26 140 14 C132 32 120 38 106 42Z" fill="${C.fd}" ${OUT}/>`
      + `<path d="M112 98 q30 4 36 -14 q-2 12 -12 10" stroke="${INK}" stroke-width="3" fill="${C.f}"/><ellipse cx="80" cy="84" rx="38" ry="24" fill="${C.f}" ${OUT}/><ellipse cx="80" cy="90" rx="22" ry="12" fill="${C.fl}" opacity=".6"/>`;
    const hs = heads === 3 ? [[46, 50], [80, 36], [114, 50]] : [[80, 48]];
    hs.forEach(([x, y], i) => {
      const r = heads === 3 ? 17 : 26;
      s += `<path d="M${x} ${y + r * 0.8} L80 76" stroke="${INK}" stroke-width="${heads === 3 ? 12 : 0}" stroke-linecap="round"/><path d="M${x} ${y + r * 0.8} L80 76" stroke="${C.f}" stroke-width="${heads === 3 ? 7 : 0}" stroke-linecap="round"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${C.f}" ${OUT}/><path d="M${x - r * 0.6} ${y - r * 0.6} l-${r * 0.2} -${r * 0.6} l${r * 0.5} ${r * 0.3} M${x + r * 0.6} ${y - r * 0.6} l${r * 0.2} -${r * 0.6} l-${r * 0.5} ${r * 0.3}" fill="#f3e6c8" ${OUT2}/>`;
      s += face(x, y - r * 0.15, { r: r * 0.24, gap: r * 0.72, style: 'angry', iris: '#ffcf4a' }) + mouth(x, y + r * 0.35, 'fangs', r * 0.8);
      s += `<path d="M${x + r * 0.5} ${y + r * 0.5} q${r * 0.5} ${r * 0.2} ${r * 0.8} -${r * 0.1}" stroke="#ff8a3d" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    });
    return { svg: s, noFace: true, A: { face: { x: 80, y: 44, g: 18 }, mouth: { x: 80, y: 56, w: 18 }, top: { x: 80, y: 24, w: 44 }, handL: { x: 50, y: 98 }, handR: { x: 110, y: 98 }, neck: { x: 80, y: 74 } } };
  },
  pit(C) {
    let teeth = '';
    for (let i = 0; i < 10; i++) { const x = 30 + i * 10.4; teeth += `<path d="M${x} 66 l5.2 ${i % 2 ? 10 : 14} l5.2 ${i % 2 ? -10 : -14}" fill="#fffdf6" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`; }
    let low = '';
    for (let i = 0; i < 8; i++) { const x = 40 + i * 10.4; low += `<path d="M${x} 94 l5.2 -${i % 2 ? 8 : 11} l5.2 ${i % 2 ? 8 : 11}" fill="#fffdf6" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`; }
    return {
      svg: `<ellipse cx="80" cy="80" rx="64" ry="30" fill="${C.fd}" ${OUT}/><ellipse cx="80" cy="80" rx="52" ry="20" fill="#0e0a12" ${OUT2}/>` + teeth + low
        + `<path d="M74 86 q6 10 12 0" fill="#e46a7a"/>`,
      noFace: true,
      A: { face: { x: 80, y: 78, g: 26 }, mouth: { x: 80, y: 86, w: 20 }, top: { x: 80, y: 50, w: 100 }, handL: { x: 20, y: 80 }, handR: { x: 140, y: 80 }, neck: { x: 80, y: 100 } },
      extra: `<ellipse cx="64" cy="80" rx="5" ry="3.4" fill="#ffcf4a"/><ellipse cx="96" cy="80" rx="5" ry="3.4" fill="#ffcf4a"/><circle cx="64" cy="80" r="1.6" fill="${INK}"/><circle cx="96" cy="80" r="1.6" fill="${INK}"/>`,
    };
  },
};

// ───────────── сборка ─────────────
export function monsterSVG(uid) {
  const d = def(uid);
  const a = d.art || {};
  const h = a.hue ?? 30, sat = a.sat ?? 52;
  const gid = 'mg-' + d.id;
  const C = { f: `url(#${gid})`, fl: col(h, sat, 74), fd: col(h, Math.max(0, sat - 6), 36), h, s: sat, iris: col((h + 180) % 360, 60, 48) };
  if (a.sat !== undefined && a.sat < 15) C.iris = '#e0a43a';
  const B = (BODIES[a.body] || BODIES.blob)(C, a);
  const A = B.A;
  const props = a.props || [];
  let back = '', front = '';
  for (const p of props) if (BACK[p]) back += BACK[p](A);
  if (B.arms) {
    const fl = B.armFrom?.l || { x: A.handL.x + 14, y: A.handL.y - 16 };
    const fr = B.armFrom?.r || { x: A.handR.x - 14, y: A.handR.y - 16 };
    back += '';
    front += arm(fl.x, fl.y, A.handL.x, A.handL.y, C) + arm(fr.x, fr.y, A.handR.x, A.handR.y, C);
  }
  let faceSvg = '';
  if (!B.noFace) {
    if (B.skullEyes) {
      faceSvg = `<ellipse cx="${A.face.x - 14}" cy="${A.face.y}" rx="11" ry="12" fill="${INK}"/><ellipse cx="${A.face.x + 14}" cy="${A.face.y}" rx="11" ry="12" fill="${INK}"/><circle cx="${A.face.x - 14}" cy="${A.face.y + 1}" r="3.4" fill="${col(h, 90, 62)}"/><circle cx="${A.face.x + 14}" cy="${A.face.y + 1}" r="3.4" fill="${col(h, 90, 62)}"/>`;
    } else {
      faceSvg = face(A.face.x, A.face.y, { n: A.face.n || 2, r: Math.max(5, A.face.g * 0.36), gap: A.face.g, style: a.eyes || 'normal', iris: C.iris, lid: B.lid || C.fd });
    }
    if (!B.noMouth) faceSvg += mouth(A.mouth.x, A.mouth.y, a.mouth || B.defaultMouth || 'grin', A.mouth.w);
  }
  let acc = '';
  for (const p of props) {
    if (HAT.has(p)) acc += PROPS[p](A.top.x, A.top.y, A.top.w);
    else if (FACE.has(p)) acc += PROPS[p](A.face.x, A.face.y, A.face.g);
    else if (NECK.has(p)) acc += PROPS[p](A.neck.x, A.neck.y, A.top.w);
    else if (HELD.has(p)) acc += PROPS[p](props.indexOf(p) % 2 ? A.handL.x : A.handR.x, props.indexOf(p) % 2 ? A.handL.y : A.handR.y);
    else if (FRONT[p]) acc += FRONT[p](A);
  }
  if (a.crown) acc += PROPS.crown(A.top.x, A.top.y - (props.some(p => HAT.has(p)) ? 12 : 0), Math.min(A.top.w, 44));
  return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${scene(sceneKind(d.tags))}${back}${B.svg}${B.extra || ''}${front}${faceSvg}${acc}</svg>`;
}

// Градиенты всех монстров и сцен: кладутся в документ один раз (см. art.js → injectDefs).
export function monsterDefs(defs) {
  let out = '';
  for (const [k, P] of Object.entries(SCENE_PAL)) out += `<radialGradient id="sc-${k}" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${P[0]}"/><stop offset="1" stop-color="${P[1]}"/></radialGradient>`;
  for (const d of defs) {
    if (d.type !== 'monster') continue;
    const a = d.art || {}, h = a.hue ?? 30, sat = a.sat ?? 52;
    out += `<radialGradient id="mg-${d.id}" cx="34%" cy="28%" r="85%"><stop offset="0" stop-color="${col(h, sat, 76)}"/><stop offset=".5" stop-color="${col(h, sat, 58)}"/><stop offset="1" stop-color="${col(h, sat, 40)}"/></radialGradient>`;
  }
  return out;
}
