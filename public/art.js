// «Под Землёй» — оригинальная графика: процедурные монстры, иконки вещей, аватары героев.
import { def, RACE_NAMES, CLASS_NAMES } from '/shared/cards.js';

const INK = '#231a26';
const SW = 3;
const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────────── монстры ─────────────
function eyes(cx, cy, n = 2, r = 6, gap = 14, angry = false) {
  let out = '';
  const xs = n === 1 ? [cx] : n === 3 ? [cx - gap, cx, cx + gap] : [cx - gap / 2, cx + gap / 2];
  xs.forEach((x, i) => {
    const y = n === 3 && i === 1 ? cy - 5 : cy;
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
    out += `<circle cx="${x + 1.5}" cy="${y + 1}" r="${r * 0.45}" fill="${INK}"/>`;
    if (angry) out += `<path d="M${x - r - 1} ${y - r - 3} L${x + r} ${y - r + (i === 0 ? 2 : -2) + (i === 0 ? 0 : 0)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  });
  return out;
}
function mouth(cx, cy, w = 22, teeth = 3) {
  let t = '';
  const step = w / teeth;
  for (let i = 0; i < teeth; i++) t += `<path d="M${cx - w / 2 + i * step} ${cy} l${step / 2} 6 l${step / 2} -6" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  return `<path d="M${cx - w / 2} ${cy} Q${cx} ${cy + 16} ${cx + w / 2} ${cy}" fill="#5a1f2b" stroke="${INK}" stroke-width="2.5"/>` + t;
}
function crown(cx, top) {
  return `<path d="M${cx - 14} ${top} l0 -12 l7 7 l7 -11 l7 11 l7 -7 l0 12 z" fill="#f5b83d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
}
const face = (cx, cy, o = {}) => eyes(cx, cy, o.eyes || 2, o.r || 6, o.gap || 16, o.angry) + mouth(cx, cy + (o.my || 14), o.mw || 22, o.teeth || 3);

const BODIES = {
  blob: (f, sh) => `<path d="M20 86 C10 60 22 26 52 22 C82 18 104 42 100 70 C98 86 88 90 60 90 C40 90 26 92 20 86Z" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M34 40 q8 -10 20 -10" stroke="#fff" stroke-opacity=".5" stroke-width="4" fill="none" stroke-linecap="round"/>` + face(60, 50),
  round: (f, sh, a) => {
    const heads = a.heads || 1;
    if (heads > 1) {
      let out = `<ellipse cx="60" cy="72" rx="40" ry="22" fill="${sh}" stroke="${INK}" stroke-width="${SW}"/>`;
      const xs = heads === 2 ? [40, 80] : [30, 60, 90];
      xs.forEach((x, i) => {
        const y = heads === 3 && i === 1 ? 34 : 42;
        out += `<circle cx="${x}" cy="${y}" r="20" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><circle cx="${x - 14}" cy="${y - 16}" r="6" fill="${f}" stroke="${INK}" stroke-width="2.5"/><circle cx="${x + 14}" cy="${y - 16}" r="6" fill="${f}" stroke="${INK}" stroke-width="2.5"/>`;
        out += eyes(x, y - 3, 2, 4.5, 11, true) + mouth(x, y + 8, 14, 2);
        if (a.crown && (heads === 2 ? i === 0 : i === 1)) out += crown(x, y - 18);
      });
      return out;
    }
    return `<circle cx="34" cy="24" r="10" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><circle cx="86" cy="24" r="10" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="60" cy="56" rx="38" ry="34" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="60" cy="72" rx="14" ry="9" fill="${sh}"/>` + face(60, 48) + (a.crown ? crown(60, 26) : '');
  },
  box: (f, sh) => `<rect x="22" y="22" width="76" height="62" rx="8" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><rect x="22" y="70" width="76" height="14" rx="4" fill="${sh}" stroke="${INK}" stroke-width="${SW}"/><circle cx="36" cy="88" r="7" fill="${INK}"/><circle cx="84" cy="88" r="7" fill="${INK}"/>` + face(60, 42, { angry: true }),
  bug: (f, sh) => {
    let legs = '';
    for (let i = 0; i < 3; i++) { legs += `<path d="M${42 + i * 16} 70 l-10 18" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M${46 + i * 16} 70 l10 18" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`; }
    return legs + `<path d="M48 24 q-10 -18 -22 -14 M72 24 q10 -18 22 -14" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="56" rx="40" ry="24" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M60 32 v46" stroke="${sh}" stroke-width="4"/><circle cx="60" cy="36" r="16" fill="${sh}" stroke="${INK}" stroke-width="${SW}"/>` + eyes(60, 34, 2, 5, 12, true);
  },
  disc: (f, sh) => `<ellipse cx="60" cy="70" rx="46" ry="16" fill="${sh}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="60" cy="56" rx="46" ry="22" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M60 34 v-14 m-8 0 h16" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` + eyes(60, 52, 1, 9, 0, true) + `<path d="M40 66 h40" stroke="${INK}" stroke-width="3"/>`,
  bird: (f, sh) => `<ellipse cx="54" cy="64" rx="36" ry="24" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><circle cx="80" cy="34" r="18" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M94 36 l18 4 l-18 6z" fill="#f5b83d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 60 q16 -12 30 4" fill="${sh}" stroke="${INK}" stroke-width="2.5"/>` + eyes(80, 30, 1, 5, 0, true),
  spike: (f, sh) => `<path d="M16 16 H104 L64 96 Z" fill="${f}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M40 16 L56 60 M80 16 L70 50" stroke="${sh}" stroke-width="3"/>` + face(60, 34, { r: 5, gap: 14, my: 12, mw: 16, teeth: 2 }),
  shroom: (f, sh) => `<rect x="44" y="50" width="32" height="40" rx="10" fill="#efe2c8" stroke="${INK}" stroke-width="${SW}"/><path d="M12 56 C14 18 106 18 108 56 Z" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><circle cx="36" cy="38" r="6" fill="#fff" opacity=".8"/><circle cx="76" cy="30" r="8" fill="#fff" opacity=".8"/><circle cx="92" cy="46" r="5" fill="#fff" opacity=".8"/>` + eyes(60, 64, 2, 4.5, 14) + `<path d="M52 80 q8 6 16 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  ghost: (f, sh) => `<path d="M24 92 V48 C24 20 96 20 96 48 V92 l-12 -10 l-12 10 l-12 -10 l-12 10 l-12 -10z" fill="${f}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" opacity=".95"/>` + eyes(60, 48, 2, 7, 22) + `<ellipse cx="60" cy="68" rx="8" ry="10" fill="${INK}"/>`,
  skull: (f, sh) => `<path d="M26 54 C26 22 94 22 94 54 C94 66 86 70 84 74 V88 H36 V74 C34 70 26 66 26 54Z" fill="#efe6d4" stroke="${INK}" stroke-width="${SW}"/><circle cx="46" cy="54" r="10" fill="${INK}"/><circle cx="74" cy="54" r="10" fill="${INK}"/><circle cx="46" cy="54" r="3" fill="${f}"/><circle cx="74" cy="54" r="3" fill="${f}"/><path d="M56 70 l4 -6 l4 6z" fill="${INK}"/><path d="M44 80 v8 M52 80 v8 M60 80 v8 M68 80 v8 M76 80 v8" stroke="${INK}" stroke-width="2.5"/><path d="M30 34 q30 -22 60 0" stroke="${f}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  plank: (f, sh) => `<rect x="10" y="40" width="100" height="30" rx="4" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M18 52 h30 M64 60 h38" stroke="${sh}" stroke-width="3"/><circle cx="16" cy="55" r="3" fill="${INK}"/><circle cx="104" cy="55" r="3" fill="${INK}"/>` + eyes(60, 50, 2, 5, 16) + `<path d="M48 64 q12 -6 24 0" stroke="${INK}" stroke-width="2.5" fill="none"/>`,
  horned: (f, sh) => `<path d="M30 40 C14 30 12 12 20 4 C26 18 34 22 42 26Z M90 40 C106 30 108 12 100 4 C94 18 86 22 78 26Z" fill="#efe2c8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="60" cy="58" rx="38" ry="32" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="60" cy="72" rx="18" ry="12" fill="${sh}" stroke="${INK}" stroke-width="2.5"/><circle cx="54" cy="72" r="3" fill="${INK}"/><circle cx="66" cy="72" r="3" fill="${INK}"/>` + eyes(60, 48, 2, 6, 22, true),
  spider: (f, sh) => {
    let legs = '';
    for (let i = 0; i < 4; i++) {
      legs += `<path d="M48 ${50 + i * 7} Q${22 - i * 2} ${30 + i * 12} ${8 + i * 3} ${60 + i * 9}" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      legs += `<path d="M72 ${50 + i * 7} Q${98 + i * 2} ${30 + i * 12} ${112 - i * 3} ${60 + i * 9}" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    }
    return `<path d="M60 0 v28" stroke="${INK}" stroke-width="2"/>` + legs + `<circle cx="60" cy="58" r="26" fill="${f}" stroke="${INK}" stroke-width="${SW}"/>` + eyes(60, 52, 3, 5, 13, true) + mouth(60, 64, 16, 2);
  },
  worm: (f, sh) => {
    let seg = '';
    const pts = [[22, 80], [36, 70], [50, 64], [64, 62], [78, 56]];
    pts.forEach(([x, y], i) => { seg += `<circle cx="${x}" cy="${y}" r="${14 - i}" fill="${i % 2 ? sh : f}" stroke="${INK}" stroke-width="2.5"/>`; });
    return seg + `<circle cx="90" cy="40" r="22" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><circle cx="96" cy="44" r="12" fill="#5a1f2b" stroke="${INK}" stroke-width="2.5"/><path d="M88 40 l4 4 l-4 4 M104 40 l-4 4 l4 4" stroke="#fff" stroke-width="2"/>` + eyes(84, 28, 2, 4, 10, true);
  },
  bat: (f, sh) => `<path d="M60 40 C40 20 20 22 6 34 C16 40 18 50 14 60 C26 54 34 58 40 66 C46 56 54 56 60 60 C66 56 74 56 80 66 C86 58 94 54 106 60 C102 50 104 40 114 34 C100 22 80 20 60 40Z" fill="${sh}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="60" cy="56" rx="18" ry="24" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M48 36 l-4 -14 l10 10 M72 36 l4 -14 l-10 10" fill="${f}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` + eyes(60, 50, 2, 4.5, 12, true) + `<path d="M54 64 l3 6 l3 -6 l3 6 l3 -6" fill="#fff" stroke="${INK}" stroke-width="1.8"/>`,
  dragon: (f, sh) => `<path d="M28 56 C8 40 10 18 16 10 C24 26 32 30 44 36Z M92 56 C112 40 110 18 104 10 C96 26 88 30 76 36Z" fill="${sh}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M84 84 q26 4 30 -14 q-2 10 -10 8" stroke="${INK}" stroke-width="3" fill="${f}"/><ellipse cx="60" cy="68" rx="30" ry="22" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="60" cy="40" rx="26" ry="20" fill="${f}" stroke="${INK}" stroke-width="${SW}"/><path d="M44 24 l-6 -14 l12 8 M76 24 l6 -14 l-12 8" fill="#efe2c8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M48 76 h24" stroke="${sh}" stroke-width="3"/>` + eyes(60, 36, 2, 5, 18, true) + mouth(60, 46, 20, 3) + `<path d="M74 52 q10 4 18 -2 q-4 8 6 10" stroke="#f5b83d" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  pit: (f, sh) => {
    let teeth = '';
    for (let i = 0; i < 9; i++) { const x = 22 + i * 9.5; teeth += `<path d="M${x} 50 l4.5 ${i % 2 ? 9 : 12} l4.5 ${i % 2 ? -9 : -12}" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`; }
    return `<ellipse cx="60" cy="60" rx="52" ry="26" fill="${sh}" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="60" cy="60" rx="42" ry="18" fill="#140f18" stroke="${INK}" stroke-width="2.5"/>` + teeth + `<circle cx="48" cy="64" r="3" fill="#f5b83d"/><circle cx="70" cy="64" r="3" fill="#f5b83d"/>`;
  },
};

export function monsterSVG(uid) {
  const d = def(uid);
  const a = d.art || {};
  const sat = a.sat ?? 45;
  const f = hsl(a.hue ?? 30, sat, 58);
  const sh = hsl(a.hue ?? 30, sat, 42);
  const body = (BODIES[a.body] || BODIES.blob)(f, sh, a);
  return `<svg viewBox="0 0 120 100" aria-hidden="true">${body}</svg>`;
}

// ───────────── иконки вещей и карт ─────────────
const L = '#f5b83d', R = '#d2502f', G = '#3fa38c', B = '#4a7fc1', W = '#efe6d4', S = '#9aa3ad', Br = '#8a5a3c', Pu = '#8f6bc9';
const st = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const ICONS = {
  helmet: `<path d="M12 40 C12 18 52 18 52 40Z" fill="${L}" ${st}/><rect x="8" y="40" width="48" height="7" rx="3" fill="${L}" ${st}/><circle cx="32" cy="26" r="6" fill="#fff" ${st}/>`,
  lamp: `<path d="M10 36 q22 -14 44 0" fill="none" ${st}/><rect x="22" y="26" width="20" height="16" rx="4" fill="${S}" ${st}/><path d="M42 30 l14 -6 v20 l-14 -6z" fill="#fff6c8" ${st}/>`,
  crown: `<path d="M10 46 V20 l11 12 l11 -16 l11 16 l11 -12 V46Z" fill="${L}" ${st}/><circle cx="32" cy="38" r="4" fill="${R}"/>`,
  jacket: `<path d="M20 14 L32 20 L44 14 L56 24 L50 32 L46 28 V54 H18 V28 L14 32 L8 24Z" fill="${G}" ${st}/><path d="M18 30 h28 M18 40 h28 M32 20 v34" stroke="${INK}" stroke-width="2"/>`,
  mail: `<path d="M18 12 h28 l8 12 v32 H10 V24Z" fill="${S}" ${st}/><g fill="${L}" stroke="${INK}" stroke-width="1.6"><circle cx="20" cy="30" r="4"/><circle cx="32" cy="30" r="4"/><circle cx="44" cy="30" r="4"/><circle cx="26" cy="40" r="4"/><circle cx="38" cy="40" r="4"/><circle cx="20" cy="50" r="3.5"/><circle cx="32" cy="50" r="3.5"/><circle cx="44" cy="50" r="3.5"/></g>`,
  diver: `<circle cx="32" cy="30" r="20" fill="${L}" ${st}/><circle cx="32" cy="30" r="11" fill="#b9e1e6" ${st}/><rect x="16" y="48" width="32" height="10" rx="3" fill="${Br}" ${st}/><circle cx="14" cy="30" r="3" fill="${INK}"/><circle cx="50" cy="30" r="3" fill="${INK}"/>`,
  robe: `<path d="M24 10 h16 l14 46 H10Z" fill="${Pu}" ${st}/><path d="M32 10 v46" stroke="${L}" stroke-width="3"/><circle cx="32" cy="22" r="3" fill="${L}"/>`,
  boots: `<path d="M14 10 h14 v30 h18 q8 0 8 10 v4 H14Z" fill="${G}" ${st}/><path d="M14 46 h40" stroke="${INK}" stroke-width="3"/>`,
  sneakers: `<path d="M8 40 q2 -12 14 -14 l8 -10 q12 4 14 14 q10 0 14 6 v8 H8Z" fill="#fff" ${st}/><path d="M8 44 h48" stroke="${R}" stroke-width="4"/><path d="M28 22 l6 6 M32 18 l6 6" stroke="${INK}" stroke-width="2"/><path d="M2 30 h8 M0 36 h8" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`,
  slippers: `<ellipse cx="32" cy="42" rx="24" ry="10" fill="${Pu}" ${st}/><path d="M18 40 q14 -18 30 0" fill="#fff" ${st}/><circle cx="33" cy="30" r="4" fill="${L}" ${st}/>`,
  shovel: `<path d="M32 6 v30" stroke="${Br}" stroke-width="5" stroke-linecap="round"/><path d="M26 6 h12" ${st}/><path d="M20 36 h24 v8 q0 12 -12 14 q-12 -2 -12 -14z" fill="${S}" ${st}/>`,
  pick: `<path d="M40 24 L14 58" stroke="${Br}" stroke-width="6" stroke-linecap="round"/><path d="M10 22 Q34 0 58 18 Q40 12 26 30 Q20 24 10 22Z" fill="${S}" ${st}/>`,
  hammer: `<rect x="22" y="6" width="20" height="18" rx="3" fill="${R}" ${st}/><rect x="28" y="24" width="8" height="22" fill="${S}" ${st}/><path d="M32 46 v12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M14 12 h8 M42 12 h8" ${st}/>`,
  shield: `<circle cx="32" cy="32" r="24" fill="${S}" ${st}/><circle cx="32" cy="32" r="16" fill="none" stroke="${INK}" stroke-width="2"/><path d="M20 26 h24 M20 32 h24 M20 38 h24" stroke="${INK}" stroke-width="2"/>`,
  crossbow: `<path d="M8 22 Q32 6 56 22" fill="none" ${st}/><path d="M8 22 L32 34 L56 22" stroke="${INK}" stroke-width="1.5" fill="none"/><rect x="28" y="16" width="8" height="40" rx="2" fill="${Br}" ${st}/><rect x="22" y="12" width="20" height="10" rx="3" fill="${R}" ${st}/>`,
  censer: `<path d="M32 4 v14" stroke="${INK}" stroke-width="2"/><path d="M18 26 h28 l-4 18 h-20z" fill="${L}" ${st}/><path d="M22 26 q10 -10 20 0" fill="${L}" ${st}/><path d="M26 54 q-4 -4 0 -8 M38 56 q4 -6 -2 -10" stroke="${S}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  rail: `<path d="M10 50 L54 14" stroke="${S}" stroke-width="10" stroke-linecap="round"/><path d="M10 50 L54 14" stroke="${INK}" stroke-width="2" fill="none"/><rect x="6" y="44" width="12" height="14" rx="2" fill="${Br}" ${st}/>`,
  staff: `<path d="M20 58 L44 14" stroke="${Br}" stroke-width="6" stroke-linecap="round"/><rect x="38" y="4" width="16" height="12" rx="3" transform="rotate(30 46 10)" fill="${S}" ${st}/><path d="M52 6 l10 -4 M54 12 l10 0" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`,
  bow: `<path d="M18 6 Q52 32 18 58" fill="none" stroke="${Br}" stroke-width="5" stroke-linecap="round"/><path d="M18 6 V58" stroke="${INK}" stroke-width="1.5"/><g fill="${L}" stroke="${INK}" stroke-width="1.5"><circle cx="30" cy="16" r="3.5"/><circle cx="38" cy="26" r="3.5" fill="${R}"/><circle cx="40" cy="36" r="3.5" fill="${G}"/><circle cx="34" cy="46" r="3.5"/></g>`,
  crowbar: `<path d="M18 56 L46 12 q4 -6 10 -2" fill="none" stroke="${R}" stroke-width="6" stroke-linecap="round"/><path d="M14 54 l-6 6" stroke="${R}" stroke-width="5" stroke-linecap="round"/>`,
  taser: `<rect x="14" y="20" width="30" height="20" rx="4" fill="#3d3a42" ${st}/><rect x="14" y="38" width="12" height="18" rx="3" fill="#3d3a42" ${st}/><path d="M44 24 l8 -4 M44 36 l8 4" ${st}/><path d="M52 14 l6 6 l-6 4 l6 6" stroke="${L}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  ladle: `<path d="M44 8 L28 40" stroke="${S}" stroke-width="5" stroke-linecap="round"/><path d="M12 40 h30 q0 16 -15 16 q-15 0 -15 -16z" fill="${S}" ${st}/>`,
  charm: `<path d="M32 4 v10" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="12" r="4" fill="none" ${st}/><path d="M32 18 l6 14 l14 2 l-10 10 l2 14 l-12 -7 l-12 7 l2 -14 l-10 -10 l14 -2z" fill="${L}" ${st}/>`,
  trolley: `<path d="M8 22 h48 l-6 24 H14Z" fill="${Br}" ${st}/><circle cx="20" cy="52" r="6" fill="${S}" ${st}/><circle cx="44" cy="52" r="6" fill="${S}" ${st}/><g fill="#8b8494" stroke="${INK}" stroke-width="2"><circle cx="22" cy="20" r="7"/><circle cx="34" cy="16" r="8"/><circle cx="46" cy="20" r="6"/></g>`,
  ring: `<circle cx="32" cy="38" r="16" fill="none" stroke="${L}" stroke-width="7"/><circle cx="32" cy="38" r="16" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M24 22 l8 -14 l8 14z" fill="${R}" ${st}/>`,
  jar: `<rect x="16" y="18" width="32" height="40" rx="6" fill="#b9e1e6" ${st}/><rect x="14" y="10" width="36" height="10" rx="3" fill="${R}" ${st}/><g fill="${Br}" stroke="${INK}" stroke-width="1.5"><path d="M22 46 q4 -10 10 -2 v8 h-6z"/><path d="M34 40 q6 -10 10 0 v10 h-6z"/></g>`,
  bottle: `<path d="M26 4 h12 v12 q10 6 10 18 v22 H16 V34 q0 -12 10 -18z" fill="${Br}" ${st}/><rect x="16" y="32" width="32" height="14" fill="${L}" stroke="${INK}" stroke-width="2"/>`,
  wrap: `<path d="M14 52 L40 8 q10 4 12 14 L26 58Z" fill="#e8c88a" ${st}/><path d="M38 14 q6 2 8 8" stroke="${G}" stroke-width="4" fill="none"/><path d="M36 22 q6 2 8 8" stroke="${R}" stroke-width="4" fill="none"/><path d="M48 4 q6 6 0 10 M54 10 q6 6 0 10" stroke="${R}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  can: `<rect x="18" y="8" width="28" height="48" rx="6" fill="${B}" ${st}/><path d="M18 22 h28 M18 42 h28" stroke="${INK}" stroke-width="2"/><path d="M26 30 l6 -4 l6 4 l-6 4z" fill="#fff"/><path d="M10 14 l4 2 M8 24 l5 0" stroke="#b9e1e6" stroke-width="2.5" stroke-linecap="round"/>`,
  boom: `<rect x="22" y="22" width="20" height="34" rx="3" fill="${R}" ${st}/><path d="M32 22 q0 -10 8 -12" stroke="${INK}" stroke-width="2" fill="none"/><path d="M40 10 l4 -6 l2 6 l6 -2 l-4 6 l6 2 l-6 2" fill="${L}" ${st}/>`,
  smoke: `<circle cx="22" cy="40" r="12" fill="#b8b2c2" ${st}/><circle cx="38" cy="34" r="14" fill="#cfc9d8" ${st}/><circle cx="34" cy="18" r="9" fill="#e2dde8" ${st}/><rect x="24" y="48" width="16" height="12" rx="3" fill="${G}" ${st}/>`,
  scroll: `<rect x="14" y="12" width="36" height="40" rx="3" fill="${W}" ${st}/><rect x="10" y="8" width="44" height="8" rx="4" fill="${Br}" ${st}/><rect x="10" y="48" width="44" height="8" rx="4" fill="${Br}" ${st}/><path d="M20 26 h24 M20 32 h18 M20 38 h22" stroke="${INK}" stroke-width="2"/>`,
  amulet: `<path d="M18 6 L32 26 L46 6" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="40" r="16" fill="#9b8f80" ${st}/><circle cx="34" cy="38" r="5" fill="#2a2230" ${st}/>`,
  up: `<path d="M32 6 L54 32 H40 V58 H24 V32 H10Z" fill="${G}" ${st}/>`,
  up2: `<path d="M32 4 L54 26 H40 V34 L54 34 L32 58 L10 34 H24 V26 H10Z" fill="${R}" ${st}/>`,
  down: `<path d="M32 58 L54 32 H40 V6 H24 V32 H10Z" fill="${B}" ${st}/>`,
  chest: `<rect x="8" y="26" width="48" height="28" rx="3" fill="${Br}" ${st}/><path d="M8 26 q24 -22 48 0" fill="${Br}" ${st}/><rect x="28" y="30" width="8" height="10" rx="2" fill="${L}" ${st}/><path d="M14 22 l-4 -8 M50 22 l4 -8 M32 10 v-6" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`,
  eyes: `<rect x="4" y="10" width="56" height="44" rx="10" fill="#140f18" ${st}/><ellipse cx="22" cy="30" rx="8" ry="5" fill="${L}"/><ellipse cx="42" cy="30" rx="8" ry="5" fill="${L}"/><circle cx="24" cy="30" r="2.5" fill="${INK}"/><circle cx="44" cy="30" r="2.5" fill="${INK}"/><ellipse cx="34" cy="46" rx="4" ry="2.5" fill="${R}"/>`,
  wind: `<path d="M8 24 h32 q10 0 10 -8 q0 -8 -8 -6 M8 34 h40 q10 0 10 8 q0 8 -8 6 M8 44 h22" fill="none" ${st}/>`,
  rocks: `<path d="M4 56 L16 34 L28 40 L38 22 L60 56Z" fill="#8b8494" ${st}/><circle cx="20" cy="12" r="5" fill="#8b8494" ${st}/><circle cx="44" cy="8" r="4" fill="#8b8494" ${st}/>`,
  puddle: `<ellipse cx="32" cy="46" rx="26" ry="10" fill="${B}" ${st}/><path d="M24 30 q8 -14 0 -22 q-8 8 0 22z" fill="#b9e1e6" ${st}/>`,
  rust: `<rect x="10" y="16" width="44" height="32" rx="4" fill="#b5653f" ${st}/><circle cx="22" cy="28" r="5" fill="#7e3b22"/><circle cx="40" cy="38" r="7" fill="#7e3b22"/><circle cx="46" cy="22" r="3" fill="#7e3b22"/>`,
  paper: `<path d="M14 6 h26 l10 10 v42 H14Z" fill="#fff" ${st}/><path d="M22 24 h20 M22 32 h20 M22 40 h14" stroke="${INK}" stroke-width="2"/><circle cx="40" cy="48" r="7" fill="none" stroke="${R}" stroke-width="3"/>`,
  question: `<circle cx="32" cy="32" r="24" fill="${Pu}" ${st}/><path d="M24 24 q0 -10 8 -10 q8 0 8 8 q0 6 -8 8 v6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="46" r="3" fill="#fff"/>`,
  hand: `<path d="M18 58 V28 q0 -4 4 -4 q4 0 4 4 V18 q0 -4 4 -4 q4 0 4 4 v-4 q0 -4 4 -4 q4 0 4 4 v10 q0 -4 4 -4 q4 0 4 4 v20 q0 14 -14 18Z" fill="#e7c2a0" ${st}/>`,
  drop: `<path d="M32 6 Q50 30 50 40 a18 18 0 0 1 -36 0 Q14 30 32 6Z" fill="#b9e1e6" ${st}/><path d="M24 40 q2 8 10 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  eye: `<path d="M4 32 Q32 6 60 32 Q32 58 4 32Z" fill="#fff" ${st}/><circle cx="32" cy="32" r="10" fill="${B}" ${st}/><circle cx="32" cy="32" r="4" fill="${INK}"/>`,
  // расы и классы
  elf: `<path d="M14 30 L4 14 L18 24Z M50 30 L60 14 L46 24Z" fill="#e7c2a0" ${st}/><circle cx="32" cy="32" r="18" fill="#e7c2a0" ${st}/><path d="M14 26 q18 -22 36 0 q-8 -6 -18 -6 q-10 0 -18 6z" fill="${L}" ${st}/><circle cx="26" cy="34" r="2.5" fill="${INK}"/><circle cx="38" cy="34" r="2.5" fill="${INK}"/>`,
  dwarf: `<circle cx="32" cy="26" r="16" fill="#e7c2a0" ${st}/><path d="M16 30 q16 40 32 0 q-6 6 -16 6 q-10 0 -16 -6z" fill="${Br}" ${st}/><path d="M14 22 q18 -24 36 0z" fill="${L}" ${st}/><circle cx="26" cy="26" r="2.5" fill="${INK}"/><circle cx="38" cy="26" r="2.5" fill="${INK}"/>`,
  halfling: `<circle cx="32" cy="30" r="16" fill="#e7c2a0" ${st}/><path d="M16 26 q4 -18 16 -14 q12 -4 16 14 q-4 -4 -8 -4 q-2 -6 -8 -4 q-6 -2 -8 4 q-4 0 -8 4z" fill="${Br}" ${st}/><circle cx="26" cy="32" r="2.5" fill="${INK}"/><circle cx="38" cy="32" r="2.5" fill="${INK}"/><path d="M26 40 q6 4 12 0" stroke="${INK}" stroke-width="2.5" fill="none"/><path d="M20 52 h24" stroke="${G}" stroke-width="6" stroke-linecap="round"/>`,
  warrior: `<path d="M14 50 L46 18" stroke="${S}" stroke-width="7" stroke-linecap="round"/><path d="M14 50 L46 18" stroke="${INK}" stroke-width="1.5"/><path d="M10 40 l14 14 M8 58 l8 -8" ${st}/><path d="M50 50 L18 18" stroke="${S}" stroke-width="7" stroke-linecap="round"/><path d="M54 40 l-14 14 M56 58 l-8 -8" ${st}/>`,
  mage: `<path d="M32 4 L50 52 H14Z" fill="${Pu}" ${st}/><path d="M8 52 h48" ${st}/><circle cx="30" cy="26" r="3" fill="${L}"/><circle cx="36" cy="38" r="2.5" fill="${L}"/>`,
  cleric: `<rect x="26" y="6" width="12" height="52" rx="2" fill="${L}" ${st}/><rect x="12" y="20" width="40" height="12" rx="2" fill="${L}" ${st}/>`,
  rogue: `<path d="M10 30 q22 -20 44 0 q-22 12 -44 0z" fill="${INK}"/><circle cx="24" cy="30" r="4" fill="#fff"/><circle cx="40" cy="30" r="4" fill="#fff"/><path d="M18 46 L46 46" stroke="${S}" stroke-width="5" stroke-linecap="round"/><path d="M46 46 l8 -4 v8z" fill="${S}" ${st}/>`,
  mix: `<circle cx="24" cy="32" r="16" fill="${G}" ${st} opacity=".9"/><circle cx="40" cy="32" r="16" fill="${L}" ${st} opacity=".9"/>`,
  badge: `<rect x="12" y="10" width="40" height="46" rx="5" fill="#fff" ${st}/><rect x="26" y="6" width="12" height="8" rx="2" fill="${S}" ${st}/><path d="M20 30 h24 M20 38 h24 M20 46 h14" stroke="${INK}" stroke-width="2"/><text x="32" y="25" font-size="11" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="${R}">×2</text>`,
};
export function iconSVG(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[name] || ICONS.question}</svg>`;
}

// ───────────── аватары ─────────────
const SKIN = ['#f1c9a5', '#d9a27c', '#b97a56', '#8d5a3b', '#e8b98f', '#c99572'];
export function avatarSVG(n = 0, color = '#f5b83d') {
  const skin = SKIN[n % SKIN.length];
  const hat = Math.floor(n / 2) % 6;
  const beard = n % 3;
  let h = '';
  if (hat === 0) h = `<path d="M12 30 C12 10 52 10 52 30Z" fill="${color}" ${st}/><rect x="8" y="28" width="48" height="6" rx="3" fill="${color}" ${st}/><circle cx="32" cy="20" r="5" fill="#fff6c8" ${st}/>`;
  if (hat === 1) h = `<path d="M10 34 C10 8 54 8 54 34Z" fill="${color}" ${st}/><path d="M8 30 v18 q6 2 8 -4 V30Z M56 30 v18 q-6 2 -8 -4 V30Z" fill="#c9b49a" ${st}/><rect x="10" y="26" width="44" height="8" rx="4" fill="#c9b49a" ${st}/>`;
  if (hat === 2) h = `<path d="M8 50 C4 14 60 14 56 50 C52 40 48 30 32 28 C16 30 12 40 8 50Z" fill="${color}" ${st}/>`;
  if (hat === 3) h = `<path d="M12 28 q20 -18 40 0 v4 H12Z" fill="${color}" ${st}/><path d="M50 30 l10 6 l-8 4z" fill="${color}" ${st}/>`;
  if (hat === 4) h = `<path d="M14 30 q0 -20 18 -22 q18 2 18 22Z" fill="${color}" ${st}/><circle cx="32" cy="7" r="5" fill="#fff" ${st}/><path d="M14 28 h36" stroke="#fff" stroke-width="4"/>`;
  if (hat === 5) h = `<rect x="18" y="4" width="28" height="24" rx="2" fill="${color}" ${st}/><rect x="10" y="26" width="44" height="6" rx="3" fill="${color}" ${st}/>`;
  const bd = beard === 1 ? `<path d="M22 46 q10 -6 20 0 q-10 4 -20 0z" fill="#5b3a2a" ${st}/>`
    : beard === 2 ? `<path d="M16 40 q16 30 32 0 q-6 6 -16 6 q-10 0 -16 -6z" fill="#8a5a3c" ${st}/>` : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="38" r="20" fill="${skin}" ${st}/><circle cx="25" cy="38" r="2.6" fill="${INK}"/><circle cx="39" cy="38" r="2.6" fill="${INK}"/><path d="M28 47 q4 3 8 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="20" cy="44" r="3" fill="#e88" opacity=".45"/><circle cx="44" cy="44" r="3" fill="#e88" opacity=".45"/>${bd}${h}</svg>`;
}

// ───────────── карты ─────────────
const TYPE_LABEL = {
  monster: 'Монстр', curse: 'Проклятие', race: 'Раса', class: 'Класс', halfbreed: 'Особое', supermunch: 'Особое',
  enhancer: 'Усилитель монстра', wandering: 'Бродячий монстр', item: 'Вещь', oneshot: 'Разовая', levelup: 'Уровень', hoard: 'Клад',
};
const SLOT_LABEL = { head: 'Головняк', armor: 'Броник', feet: 'Обувка', hand: 'В руки', none: 'Прочее' };

export function cardText(d) {
  if (d.type === 'monster') {
    const parts = [];
    if (d.undead) parts.push('<b>Нежить.</b>');
    (d.vs || []).forEach(v => parts.push(esc(v.text) + '.'));
    if (d.text) parts.push(esc(d.text));
    parts.push(`<span class="bad"><b>Расплата:</b> ${esc(d.bad.text)}</span>`);
    return parts.join(' ');
  }
  if (d.type === 'item') {
    const req = d.text ? esc(d.text) : '';
    return req;
  }
  return esc(d.text || '');
}

export function cardArt(d) {
  if (d.type === 'monster') return monsterSVG(d.id + '#0');
  return iconSVG(typeof d.art === 'string' ? d.art : 'question');
}

function nameClass(n) {
  const longest = Math.max(...n.split(/\s+/).map(w => w.length));
  if (n.length > 24 || longest > 11) return 'xlong';
  if (n.length > 15 || longest > 9) return 'long';
  return '';
}

export function cardHTML(uid, o = {}) {
  const d = def(uid);
  const cls = ['card', d.deck, 't-' + d.type, o.size || 'md'];
  if (o.selected) cls.push('selected');
  if (o.playable) cls.push('playable');
  if (o.dim) cls.push('dim');
  let corner = '';
  if (d.type === 'monster') corner = `<span class="corner lv" title="Уровень монстра">${d.level}</span>`;
  else if (d.type === 'item' && d.bonus) corner = `<span class="corner bonus" title="Бонус к силе">+${d.bonus}</span>`;
  else if (d.type === 'oneshot' && d.bonus) corner = `<span class="corner bonus" title="Бонус">+${d.bonus}</span>`;
  else if (d.type === 'enhancer') corner = `<span class="corner ${d.bonus > 0 ? 'lv' : 'bonus'}">${d.bonus > 0 ? '+' : ''}${d.bonus}</span>`;
  if (corner) cls.push('has-corner');
  if (/>[+−-]?\d{2,}</.test(corner) || /\+\d{2}/.test(corner)) cls.push('wide-corner');
  let foot = '';
  if (d.type === 'monster') foot = `<span title="Клад за победу">◆ ${d.treasures}</span><span>${d.levels > 1 ? '+2 ур.' : '+1 ур.'}</span>`;
  else if (d.type === 'item') foot = `<span>${SLOT_LABEL[d.slot]}${d.hands === 2 ? ' ×2' : ''}${d.big ? ', большая' : ''}</span><span>${d.value} г</span>`;
  else if (d.value) foot = `<span>${TYPE_LABEL[d.type]}</span><span>${d.value} г</span>`;
  else foot = `<span>${TYPE_LABEL[d.type]}</span>`;
  const attrs = o.attrs || '';
  return `<div class="${cls.join(' ')}" data-uid="${esc(uid)}" ${attrs} tabindex="${o.tab === false ? -1 : 0}" role="button" aria-label="${esc(d.name)}">
    ${corner}
    <div class="c-name ${nameClass(d.name)}">${esc(d.name)}</div>
    <div class="c-art">${cardArt(d)}</div>
    <div class="c-text">${cardText(d)}</div>
    <div class="c-foot">${foot}</div>
  </div>`;
}

export function chipHTML(uid, o = {}) {
  const d = def(uid);
  const val = d.bonus ? `+${d.bonus}` : d.runBonus ? `бег +${d.runBonus}` : '';
  return `<button class="chip ${o.cls || ''}" data-uid="${esc(uid)}" title="${esc(d.name)}">${iconSVG(typeof d.art === 'string' ? d.art : 'question')}<span class="chip-name">${esc(d.name)}</span>${val ? `<b>${val}</b>` : ''}</button>`;
}

export { TYPE_LABEL, SLOT_LABEL, RACE_NAMES, CLASS_NAMES };
