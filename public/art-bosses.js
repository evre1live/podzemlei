// «Под Землёй» — боссы: Люцифер, Аид и Анубис. Рисуются кодом в SVG, как и остальные монстры.
// Сцена 160×120; важное держим в полосе y 12…108 — у большой карты края кадра срезаются.

const INK = '#231a26';
const OUT = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const OUT2 = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const hi = (d, o = 0.45, w = 3) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
// зеркальная копия правой половины
const mirror = svg => `<g transform="translate(160 0) scale(-1 1)">${svg}</g>`;
const both = svg => svg + mirror(svg);

// язычки пламени вдоль низа кадра
function flames(y, color, op, step = 14, seed = 0) {
  let d = `M-4 124 L-4 ${y}`;
  for (let x = -4, i = seed; x < 168; x += step, i++) {
    const h = 14 + ((i * 37) % 17);
    d += ` Q${x + step * 0.25} ${y - h * 0.4} ${x + step * 0.5} ${y - h} Q${x + step * 0.62} ${y - h * 0.35} ${x + step} ${y}`;
  }
  return `<path d="${d} L168 124Z" fill="${color}" opacity="${op}"/>`;
}
const embers = (pts, c = '#ffd27a') => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');

// ───────────── Люцифер ─────────────
function lucifer() {
  const scene = `<rect width="160" height="120" fill="url(#bs-hell)"/><rect width="160" height="120" fill="url(#ht)" opacity=".7"/>`
    + `<path d="M0 0 H160 V12 L150 26 L140 10 L126 20 L112 6 L96 18 L64 18 L48 6 L34 20 L20 10 L10 26 L0 12Z" fill="rgba(40,0,0,.45)"/>`
    + flames(104, '#7a0a06', 0.85, 13) + flames(110, '#ff5a14', 0.5, 11, 3)
    + embers([[14, 40, 1.6], [24, 70, 1.2], [146, 46, 1.8], [138, 76, 1.2], [30, 22, 1], [128, 18, 1.3], [8, 88, 1.4], [152, 92, 1.4]]);
  // огненный ореол за головой
  let halo = '';
  for (let i = 0; i < 13; i++) {
    const a = (-180 + i * 15) * Math.PI / 180, r1 = 30, r2 = 44 + (i % 2) * 8;
    const x1 = 80 + Math.cos(a - 0.12) * r1, y1 = 50 + Math.sin(a - 0.12) * r1, x2 = 80 + Math.cos(a) * r2, y2 = 50 + Math.sin(a) * r2, x3 = 80 + Math.cos(a + 0.12) * r1, y3 = 50 + Math.sin(a + 0.12) * r1;
    halo += `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(80 + Math.cos(a - 0.05) * r2 * 0.8).toFixed(1)} ${(50 + Math.sin(a - 0.05) * r2 * 0.8).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} Q${(80 + Math.cos(a + 0.06) * r2 * 0.75).toFixed(1)} ${(50 + Math.sin(a + 0.06) * r2 * 0.75).toFixed(1)} ${x3.toFixed(1)} ${y3.toFixed(1)}Z `;
  }
  const aura = `<path d="${halo}" fill="#ffb347" opacity=".75"/><circle cx="80" cy="50" r="32" fill="#ffe08a" opacity=".35"/>`;
  // крылья летучей мыши
  const wing = `<path d="M62 76 C50 52 30 32 6 22 C12 34 13 44 13 54 Q20 46 28 50 C28 60 30 68 31 76 Q39 67 46 71 C48 79 50 86 54 92 Z" fill="url(#bs-wing)" ${OUT}/>`
    + `<path d="M58 74 L14 53 M58 77 L31 75 M58 80 L53 91" stroke="${INK}" stroke-width="1.6" opacity=".55"/>` + hi('M54 66 C44 50 30 38 14 30', 0.25, 2);
  // плащ с высоким воротником
  const body = `<path d="M26 124 C30 102 46 90 64 86 L96 86 C114 90 130 102 134 124 Z" fill="url(#bs-cloak)" ${OUT}/>`
    + both(`<path d="M64 88 L46 56 L58 62 L68 78 Z" fill="#b3122a" ${OUT2}/>`)
    + `<path d="M70 86 L80 104 L90 86 Z" fill="#c42a22" ${OUT2}/><path d="M72 76 H88 V88 L80 96 L72 88 Z" fill="url(#bs-red)" ${OUT2}/>`
    + `<circle cx="80" cy="104" r="4" fill="#f2c14e" ${OUT2}/><path d="M64 96 Q80 104 96 96" fill="none" stroke="#f2c14e" stroke-width="2"/>`;
  // трезубец в правой руке
  const fork = `<path d="M134 124 V26" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/><path d="M134 122 V28" stroke="#f2c14e" stroke-width="3.2" stroke-linecap="round"/>`
    + `<path d="M122 32 Q122 40 134 40 Q146 40 146 32" fill="none" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/><path d="M122 32 Q122 40 134 40 Q146 40 146 32" fill="none" stroke="#f2c14e" stroke-width="3.2" stroke-linecap="round"/>`
    + [122, 146].map(x => `<path d="M${x} 34 V18 l-3.4 2.6 l3.4 -9 l3.4 9 l-3.4 -2.6" fill="#f2c14e" ${OUT2}/>`).join('')
    + `<path d="M134 32 V10 l-3.6 3 l3.6 -10 l3.6 10 l-3.6 -3" fill="#f2c14e" ${OUT2}/>`
    + `<path d="M110 100 Q122 92 130 92" stroke="${INK}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M110 100 Q122 92 130 92" stroke="#3a0d16" stroke-width="6.5" fill="none" stroke-linecap="round"/>`
    + `<ellipse cx="134" cy="92" rx="6.5" ry="5.5" fill="url(#bs-red)" ${OUT2}/>`;
  // голова: рога, острые уши, бородка клинышком, хитрая ухмылка
  const head = both(`<path d="M60 52 L44 40 L58 62 Z" fill="url(#bs-red)" ${OUT2}/>`)
    + both(`<path d="M62 37 C54 31 46 22 49 8 C56 16 64 22 73 30 Z" fill="url(#bs-horn)" ${OUT2}/><path d="M57 28 l5 -3 M53 21 l4.5 -2.5" stroke="${INK}" stroke-width="1.4" opacity=".5"/>`)
    + `<path d="M80 80 C72 76 62 70 59 59 C56 46 61 32 80 31 C99 32 104 46 101 59 C98 70 88 76 80 80Z" fill="url(#bs-red)" ${OUT}/>`
    + `<path d="M59 50 C57 36 66 28 80 28 C94 28 103 36 101 50 C97 42 91 39 86 39 L80 47 L74 39 C69 39 63 42 59 50Z" fill="#1d0a10" ${OUT2}/>` + hi('M66 34 Q72 31 78 31', 0.35, 2)
    + both(`<path d="M63 46 L77 50" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`)
    + both(`<ellipse cx="71" cy="55" rx="5.6" ry="4.2" fill="#ffe14a" ${OUT2}/><ellipse cx="71.6" cy="55.3" rx="1.3" ry="3.4" fill="${INK}"/><circle cx="69.6" cy="53.6" r="1" fill="#fff"/>`)
    + `<path d="M80 57 L77.6 63 L82.4 63" fill="none" stroke="#7a0f12" stroke-width="1.8" stroke-linejoin="round"/>`
    + `<path d="M68 66.5 Q74 63.5 80 65.5 Q86 63.5 93 66.5" fill="none" stroke="#1d0a10" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="M70 68 Q80 75 91 67.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M85.6 70.2 l1.8 4 l1.6 -4.6" fill="#fffdf6" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<path d="M75.5 73.5 L80 87 L84.5 73.5 Q80 75.8 75.5 73.5Z" fill="#1d0a10" ${OUT2}/>`
    + `<ellipse cx="66" cy="63" rx="4" ry="2.4" fill="#ff6a5a" opacity=".45"/><ellipse cx="94" cy="63" rx="4" ry="2.4" fill="#ff6a5a" opacity=".45"/>` + hi('M64 44 Q66 36 74 34', 0.3, 2);
  return scene + aura + both(wing) + body + head + fork;
}

// ───────────── Аид ─────────────
function hades() {
  const scene = `<rect width="160" height="120" fill="url(#bs-styx)"/><rect width="160" height="120" fill="url(#ht)" opacity=".5"/>`
    + `<path d="M-10 74 Q30 62 64 74 T140 70 T180 74" stroke="rgba(140,255,200,.16)" stroke-width="9" fill="none" stroke-linecap="round"/>`
    + `<path d="M0 104 Q20 98 40 104 T80 104 T120 104 T160 104 V124 H0Z" fill="#0b3a3c"/><path d="M8 110 Q26 106 44 110 M96 112 Q116 107 136 112" stroke="#6dffb0" stroke-opacity=".35" stroke-width="1.6" fill="none"/>`
    // души над рекой
    + [[18, 30, 0.8], [144, 22, 0.7], [134, 58, 0.55]].map(([x, y, sc]) => `<g transform="translate(${x} ${y}) scale(${sc})" opacity=".7"><path d="M-7 10 V-1 A7 7 0 0 1 7 -1 V10 l-2.4 -2 l-2.3 2 l-2.3 -2 l-2.3 2 l-2.3 -2 Z" fill="#dcfff0" stroke="#7affc0" stroke-width="1.2"/><circle cx="-2.4" cy="-1" r="1.2" fill="#1d4a44"/><circle cx="2.4" cy="-1" r="1.2" fill="#1d4a44"/></g>`).join('')
    + embers([[30, 50, 1.2], [122, 40, 1], [12, 76, 1.1], [150, 84, 1.3]], '#8dffc4');
  // длинные тёмные волосы за головой
  const hair = `<path d="M57 48 C52 66 54 82 60 92 L100 92 C106 82 108 66 103 48 C98 34 62 34 57 48Z" fill="#2a2238" ${OUT}/>`;
  // тёмная мантия с золотой каймой-меандром и перевязью
  let meander = 'M60 98';
  for (let x = 60; x < 104; x += 8) meander += ` h4 v-4 h-2 v2 M${x + 8} 98`;
  const body = `<path d="M24 124 C28 102 46 90 64 87 L96 87 C114 90 132 102 136 124 Z" fill="url(#bs-robe)" ${OUT}/>`
    + `<path d="M58 90 L108 124 L94 124 L52 94 Z" fill="#5a3a86" ${OUT2}/><path d="M57 94 L103 124" stroke="#f2c14e" stroke-width="1.6" stroke-dasharray="3 2"/>`
    + `<circle cx="58" cy="92" r="5" fill="#f2c14e" ${OUT2}/><circle cx="58" cy="92" r="2.2" fill="#5affa8"/>`;
  // двузубец с зелёным огнём в левой руке
  const bident = `<g transform="translate(0 14)">` + `<path d="M31.4 110 L36 24" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M31.5 108 L36 26" stroke="#5b6274" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="M26 30 Q36 36 46 28" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M26 30 Q36 36 46 28" fill="none" stroke="#5b6274" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="M27 30 L23 12 l-2.8 3 l2 -10 l5.4 8.6 l-3.6 -1.2 L31 30Z M45 28 L47 10 l-3.4 2.4 l4 -9.4 l3.8 9.6 l-3.4 -2 L49 28Z" fill="#8a93a6" ${OUT2}/>`
    + `<path d="M23 8 Q17 0 22 -6 Q23 0 27 2 Q28 -4 25 -8 Q33 -2 30 8 Z M47 6 Q41 -2 46 -8 Q47 -2 51 0 Q52 -6 49 -10 Q57 -4 54 6 Z" fill="#5affa8" opacity=".9"/><path d="M24 7 Q22 2 24 -1 Q26 3 28 4Z M48 5 Q46 0 48 -3 Q50 1 52 2Z" fill="#e6fff2"/></g>`
    + `<path d="M58 100 Q44 98 36 92" stroke="${INK}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M58 100 Q44 98 36 92" stroke="#3a2e58" stroke-width="6.5" fill="none" stroke-linecap="round"/>`
    + `<ellipse cx="34" cy="90" rx="6" ry="5.5" fill="url(#bs-pale)" ${OUT2}/>`;
  // голова: железная корона с изумрудами, горящие зелёные глаза, густая кудрявая борода
  const head = `<ellipse cx="80" cy="54" rx="20" ry="22" fill="url(#bs-pale)" ${OUT}/>`
    + `<path d="M60 58 C58 72 62 86 70 95 C74 100 77 103 80 105 C83 103 86 100 90 95 C98 86 102 72 100 58 C96 67 89 71 80 71 C71 71 64 67 60 58Z" fill="#30263f" ${OUT}/>`
    + [[66, 94], [72, 100], [80, 104], [88, 100], [94, 94], [62, 84], [98, 84]].map(([x, y]) => `<path d="M${x - 3} ${y - 2} q3 5 6 0" fill="none" stroke="#6b5a86" stroke-width="1.6" stroke-linecap="round"/>`).join('')
    + `<path d="M67 68 Q73 63.5 80 66 Q87 63.5 93 68 Q87 72 80 69.5 Q73 72 67 68Z" fill="#251d33" ${OUT2}/>`
    + `<path d="M80 50 L77.8 61 Q80 62.6 82.2 61" fill="none" stroke="#6f7c94" stroke-width="1.8" stroke-linejoin="round"/>`
    + both(`<path d="M62 45 Q69 41 77 48" fill="none" stroke="#251d33" stroke-width="4.4" stroke-linecap="round"/>`)
    + both(`<circle cx="71" cy="53" r="6" fill="#5affa8" opacity=".35"/><ellipse cx="71" cy="53" rx="4.6" ry="3.4" fill="#cfffe6" ${OUT2}/><circle cx="71.4" cy="53.4" r="1.7" fill="#0e6b46"/>`)
    + `<path d="M59 40 L59 30 L64 22 L68 30 L73 16 L77 28 L80 14 L83 28 L87 16 L92 30 L96 22 L101 30 L101 40 Q80 34 59 40Z" fill="url(#bs-iron)" ${OUT2}/>`
    + [[64, 33], [80, 30], [96, 33]].map(([x, y]) => `<path d="M${x} ${y - 3} l2.6 3 l-2.6 3 l-2.6 -3Z" fill="#5affa8" stroke="${INK}" stroke-width="1.2"/>`).join('')
    + hi('M64 38 Q72 34 78 34', 0.3, 1.6);
  // Цербер выглядывает снизу справа
  const pup = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8 -4 L-10 -15 L-3 -8 Z M8 -4 L10 -15 L3 -8 Z" fill="#2a2532" ${OUT2}/><circle r="9" fill="#2a2532" ${OUT2}/><ellipse cx="0" cy="5" rx="5.4" ry="4" fill="#3d3646" ${OUT2}/><ellipse cx="0" cy="2.6" rx="2" ry="1.4" fill="${INK}"/><circle cx="-3.6" cy="-2" r="1.9" fill="#ff5a3d"/><circle cx="3.6" cy="-2" r="1.9" fill="#ff5a3d"/><path d="M-2 8.4 q2 2.4 4 0" fill="#ff8aa0" stroke="${INK}" stroke-width="1"/></g>`;
  const dog = `<path d="M2 124 Q6 104 24 102 Q42 104 46 124Z" fill="#2a2532" ${OUT2}/>` + pup(9, 107, 0.85) + pup(39, 107, 0.85) + pup(24, 99, 0.95);
  return scene + hair + body + head + dog + bident;
}

// ───────────── Анубис ─────────────
function anubis() {
  const scene = `<rect width="160" height="120" fill="url(#bs-desert)"/><rect width="160" height="120" fill="url(#ht)" opacity=".4"/>`
    + embers([[14, 14, 0.9], [36, 8, 0.7], [58, 20, 0.6], [104, 10, 0.8], [150, 40, 0.7], [22, 40, 0.6], [112, 30, 0.6]], '#fff6d8')
    + `<circle cx="134" cy="24" r="11" fill="#ffe9a8"/><circle cx="130" cy="21" r="11" fill="#fff6d8" opacity=".55"/>`
    + `<path d="M-4 96 L22 62 L48 96Z" fill="#5a2c5e"/><path d="M22 62 L48 96 L34 96Z" fill="#41204a"/><path d="M118 98 L146 58 L174 98Z" fill="#5a2c5e"/><path d="M146 58 L174 98 L160 98Z" fill="#41204a"/>`
    + `<path d="M0 100 Q40 92 80 100 T160 98 V124 H0Z" fill="#d88a3e"/><path d="M0 108 Q50 102 100 110 T160 106 V124 H0Z" fill="#b8682a"/>`;
  // полосатый немес спадает на плечи
  const nemes = both(`<path d="M62 36 C54 50 50 72 50 94 L66 94 L66 58 Z" fill="url(#bs-nemes)" ${OUT2}/>`)
    + `<path d="M58 40 Q80 24 102 40 L98 54 Q80 46 62 54 Z" fill="url(#bs-nemes)" ${OUT2}/>`;
  // бронзовые плечи и широкое ожерелье-усех
  const body = `<path d="M26 124 C30 102 46 92 64 90 L96 90 C114 92 130 102 134 124 Z" fill="url(#bs-bronze)" ${OUT}/>`
    + `<path d="M50 92 Q80 128 110 92" fill="none" stroke="${INK}" stroke-width="20"/>`
    + `<path d="M50 92 Q80 128 110 92" fill="none" stroke="#2b5fb8" stroke-width="16.5"/><path d="M50 92 Q80 128 110 92" fill="none" stroke="#f2c14e" stroke-width="11"/>`
    + `<path d="M50 92 Q80 128 110 92" fill="none" stroke="#3fc1b0" stroke-width="6"/><path d="M50 92 Q80 128 110 92" fill="none" stroke="#c8402e" stroke-width="1.8" stroke-dasharray="2 3"/>`
    + `<path d="M68 90 L68 84 L92 84 L92 90" fill="#1c1a26" ${OUT2}/>`;
  // посох-уас в левой руке и анх в правой
  const staff = `<path d="M28 124 L30 30" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M28 122 L30 32" stroke="#f2c14e" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="M30 32 L28 22 L40 18 L42 23 L35 25 Z" fill="#f2c14e" ${OUT2}/>`
    + `<path d="M56 102 Q40 100 32 92" stroke="${INK}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M56 102 Q40 100 32 92" stroke="#9a5a2c" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="M38 97.5 l3 -6" stroke="#f2c14e" stroke-width="3"/>`
    + `<ellipse cx="30" cy="90" rx="6" ry="5.5" fill="url(#bs-bronze)" ${OUT2}/>`;
  const ankh = `<circle cx="132" cy="70" r="16" fill="#ffe08a" opacity=".35"/>`
    + `<path d="M132 76 C124 70 125 56 132 56 C139 56 140 70 132 76 Z M122 77 H142 M132 77 V98" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="M132 76 C124 70 125 56 132 56 C139 56 140 70 132 76 Z M122 77 H142 M132 77 V98" fill="none" stroke="#f2c14e" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="M104 102 Q120 100 128 92" stroke="${INK}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M104 102 Q120 100 128 92" stroke="#9a5a2c" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="M121 97.5 l-3 -6" stroke="#f2c14e" stroke-width="3"/>`
    + `<ellipse cx="131" cy="90" rx="6" ry="5.5" fill="url(#bs-bronze)" ${OUT2}/>`;
  // голова шакала: высокие уши, длинная морда, глаза с золотой подводкой
  const head = both(`<path d="M64 42 L57 6 L77 30 Z" fill="url(#bs-jackal)" ${OUT2}/><path d="M65 34 L60.5 14 L72 29 Z" fill="#f2c14e" opacity=".9"/>`)
    + `<ellipse cx="80" cy="44" rx="17" ry="15" fill="url(#bs-jackal)" ${OUT}/>`
    + `<path d="M67 48 C66 62 72 76 80 82 C88 76 94 62 93 48 C88 52 72 52 67 48 Z" fill="url(#bs-jackal)" ${OUT}/>`
    + `<path d="M64 38 Q80 31 96 38" fill="none" stroke="#f2c14e" stroke-width="3.4" stroke-linecap="round"/><path d="M64 38 Q80 31 96 38" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>`
    + both(`<path d="M64.5 45 Q71 39.5 77.5 45 Q71 48.4 64.5 45 Z" fill="#ffb02e" ${OUT2}/><circle cx="71.6" cy="44.8" r="1.8" fill="${INK}"/><path d="M64 45.5 L57 48" stroke="#f2c14e" stroke-width="2" stroke-linecap="round"/>`)
    + `<ellipse cx="80" cy="79.5" rx="4.4" ry="2.8" fill="#0b0a10" ${OUT2}/><circle cx="78.6" cy="78.6" r="0.9" fill="#fff" opacity=".7"/>`
    + `<path d="M74 70 Q80 76 86 70" fill="none" stroke="#f2c14e" stroke-width="1.2" opacity=".6"/>`
    + hi('M70 36 Q76 32 82 32', 0.25, 2) + hi('M72 56 Q74 66 78 72', 0.18, 2);
  return scene + nemes + body + head + staff + ankh;
}

const BOSS_ART = { lucifer, hades, anubis };
export const bossSVG = name => `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${(BOSS_ART[name] || lucifer)()}</svg>`;

// градиенты боссов — кладутся в общий <defs> один раз
export function bossDefs() {
  const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const rad = (id, stops, cx = '50%', cy = '40%', r = '75%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
  return rad('bs-hell', [[0, '#ffc45a'], [0.4, '#e2401a'], [0.8, '#6a0a08'], [1, '#2a0404']], '50%', '42%', '72%')
    + rad('bs-styx', [[0, '#2f7a70'], [0.55, '#0f3a40'], [1, '#04121a']], '50%', '40%', '75%')
    + lin('bs-desert', [[0, '#1f1650'], [0.5, '#5a2e7a'], [0.8, '#d0705a'], [1, '#f2a65a']])
    + rad('bs-red', [[0, '#ff7a5a'], [0.55, '#e0301e'], [1, '#8a0e10']], '36%', '30%', '85%')
    + lin('bs-horn', [[0, '#3a2a2a'], [0.55, '#8a7a6a'], [1, '#f3e6c8']], 0, 1)
    + lin('bs-wing', [[0, '#b3122a'], [1, '#4a0612']], 1, 1)
    + lin('bs-cloak', [[0, '#3a1220'], [1, '#12060a']])
    + rad('bs-pale', [[0, '#eef2f8'], [0.6, '#b4c0d2'], [1, '#7a869c']], '38%', '30%', '85%')
    + lin('bs-robe', [[0, '#3a2e5a'], [1, '#141024']])
    + lin('bs-iron', [[0, '#8a93a6'], [0.5, '#4a4f60'], [1, '#2a2d38']])
    + rad('bs-jackal', [[0, '#625d80'], [0.5, '#2c283a'], [1, '#100e18']], '38%', '28%', '85%')
    + rad('bs-bronze', [[0, '#d8935a'], [0.6, '#9a5a2c'], [1, '#5a3014']], '40%', '30%', '85%')
    + `<linearGradient id="bs-nemes" x1="0" y1="0" x2="0" y2="7" gradientUnits="userSpaceOnUse" spreadMethod="repeat"><stop offset="0" stop-color="#f2c14e"/><stop offset=".5" stop-color="#f2c14e"/><stop offset=".5" stop-color="#2b5fb8"/><stop offset="1" stop-color="#2b5fb8"/></linearGradient>`;
}
