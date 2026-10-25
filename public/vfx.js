// «Под Землёй» — живые эффекты поверх фона: огонь, дым, искры, магия, снег, туман, вода, лава, молнии.
// Рисуются на видеокарте через PixiJS (MIT, /vendor). Текстуры частиц — Kenney Particle Pack (CC0, /vfx).
// Координаты эффектов заданы в пикселях исходной картинки сцены (1672×941) и пересчитываются в «логические» 1600×900.
// Холст повторяет «обложку» 16:9 из CSS, поэтому эффекты встают точно на свои места на картинке.

const W = 1600, H = 900, SW = 1672, SH = 941;
const P = (x, y) => [x * W / SW, y * H / SH];
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = c => { const v = parseInt(c.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
// цвет частицы в формате Pixi: BGR + прозрачность в старшем байте
const pack = (r, g, b, a) => ((b << 16) | (g << 8) | r) + (((a * 255) | 0) << 24);

// где лежит текстура в атласе (номер столбца и строки, ячейки 128×128)
const ATLAS = {
  flame_05: [0, 0], flame_06: [1, 0], muzzle_02: [2, 0], muzzle_03: [3, 0], muzzle_04: [4, 0], muzzle_05: [5, 0],
  fire_01: [0, 1], fire_02: [1, 1], flame_01: [2, 1], flame_02: [3, 1], flame_03: [4, 1], flame_04: [5, 1],
  smoke_01: [0, 2], smoke_04: [1, 2], smoke_05: [2, 2], smoke_07: [3, 2], light_01: [4, 2], circle_05: [5, 2],
  circle_02: [0, 3], star_01: [1, 3], star_04: [2, 3], star_06: [3, 3], star_07: [4, 3], magic_04: [5, 3],
  magic_05: [0, 4], twirl_01: [1, 4], twirl_02: [2, 4], twirl_03: [3, 4], spark_01: [4, 4], spark_02: [5, 4],
  spark_03: [0, 5], spark_04: [1, 5], spark_05: [2, 5], spark_06: [3, 5], trace_01: [4, 5], trace_05: [5, 5],
  glow: [0, 6], dot: [1, 6], beam: [2, 6], ring: [3, 6],
};
const TEX = 128;
const FLAMES = ['muzzle_02', 'muzzle_03', 'muzzle_05', 'flame_05', 'flame_06'];

const PAL = {
  fire: ['#fff3c0', '#ffbf4a', '#ff6a1a', '#6a1606'],
  gold: ['#fffbe0', '#ffd77a', '#ff9a2e', '#5a2406'],
  green: ['#eafff2', '#8dffc0', '#25d47a', '#0b3a22'],
  purple: ['#fff0ff', '#e0a8ff', '#9a4dff', '#2a0c55'],
};

// ───────────── кирпичики сцен ─────────────
// Каждый возвращает список «излучателей». Размеры — в логических пикселях (полотно 1600×900).
function torch(x, y, s = 1, pal = PAL.fire, o = {}) {
  const [X, Y] = P(x, y);
  const sparks = o.sparks ?? 2.4 * s;
  return [
    { glow: true, at: [X, Y - 12 * s], size: 210 * s, color: pal[1], alpha: o.glow ?? 0.34, flicker: 0.25 },
    { tex: FLAMES, add: true, at: [X, Y], spread: [(o.w ?? 6) * s, 2 * s], rate: (o.rate ?? 34) * Math.sqrt(s), life: [0.3, 0.62],
      vx: [-8 * s, 8 * s], vy: [-80 * s, -48 * s], size: [46 * s, 12 * s], sizeVar: 0.35,
      colors: pal, alpha: [0, 0.8, 0], rot: [-0.2, 0.2], spin: [-0.7, 0.7], anchor: 0.75 },
    { tex: ['fire_01', 'fire_02'], add: true, at: [X, Y - 4 * s], spread: [(o.w ?? 4) * s, 2 * s], rate: 12 * Math.sqrt(s), life: [0.2, 0.4],
      vy: [-30 * s, -14 * s], size: [26 * s, 16 * s], colors: [pal[0], pal[1], pal[2]], alpha: [0, 0.5, 0], spin: [-2, 2] },
    ...(sparks > 0.05 ? [{ tex: ['dot'], add: true, at: [X, Y - 14 * s], spread: [(o.w ?? 8) * s, 4 * s], rate: sparks, life: [0.8, 1.8],
      vx: [-22, 22], vy: [-130, -55], acc: [0, -8], sway: [14, 3], size: [4.5, 1.5], colors: [pal[0], pal[1], pal[2]], alpha: [0, 1, 0], flicker: 0.4 }] : []),
    ...(o.smoke === false ? [] : [{ tex: ['smoke_04', 'smoke_05'], at: [X, Y - 34 * s], spread: [5 * s, 2], rate: 1.3 * s, life: [1.8, 3.2],
      vx: [-8, 8], vy: [-36, -20], size: [24 * s, 90 * s], colors: ['#3a2a20', '#221c18'], alpha: [0, o.smokeA ?? 0.16, 0], spin: [-0.3, 0.3], rot: [0, 6.28] }]),
  ];
}
const candle = (x, y, s = 0.5, pal = PAL.gold) => torch(x, y, s, pal, { smoke: false, sparks: 0, glow: 0.42, rate: 22 });
// широкий огонь: камин, горн — несколько языков пламени в ряд
const hearth = (x, y, w, s, pal = PAL.fire) => {
  const n = Math.max(2, Math.round(w / (34 * s)));
  return Array.from({ length: n }, (_, i) => torch(x - w / 2 + (i + 0.5) * w / n, y + (i % 2) * 6, s * rnd(0.85, 1.1), pal, { smoke: i % 2 === 0, sparks: 1.6 * s, glow: 0.18 })).flat();
};
function glow(x, y, size, color, alpha = 0.35, o = {}) {
  const [X, Y] = P(x, y);
  return [{ glow: true, at: [X, Y], tex: o.tex || 'glow', size, color, alpha, flicker: o.flicker ?? 0, pulse: o.pulse || null, spin: o.spin || 0 }];
}
function area(x0, x1, y0, y1) { const [a, b] = P(x0, y0), [c, d] = P(x1, y1); return [a, c, b, d]; }
const embers = (ar, rate, pal = PAL.fire, o = {}) => [{ tex: ['dot'], add: true, area: ar, rate, life: o.life || [3, 6],
  vx: [-12, 12], vy: o.vy || [-70, -25], sway: [24, 1.2], size: o.size || [5, 1.5], colors: [pal[0], pal[1], pal[2]], alpha: [0, 0.9, 0], flicker: 0.35 }];
const motes = (ar, rate, color = '#ffd99a', o = {}) => [{ tex: ['dot'], add: true, area: ar, rate, life: [7, 12], wander: 10,
  vx: [-6, 6], vy: [-10, 4], size: o.size || [3.2, 3.2], sizeVar: 0.4, colors: [color, color], alpha: [0, o.a ?? 0.45, 0], pulse: [0.7, 0.4], prewarm: true }];
const fireflies = (ar, n, colors) => [{ tex: ['glow'], add: true, area: ar, rate: n / 8, life: [6, 10], wander: 55,
  vx: [-20, 20], vy: [-20, 20], size: [22, 22], sizeVar: 0.4, colors, alpha: [0, 1, 1, 0], pulse: [1.4, 0.8], prewarm: true }];
const twinkles = (ar, rate, colors = ['#ffffff', '#fff3c4'], size = 22) => [{ tex: ['star_06', 'star_07', 'star_04'], add: true, area: ar, rate,
  life: [0.6, 1.4], size: [0, size, 0], sizeVar: 0.4, colors, alpha: [0, 1, 0], rot: [0, 6.28], spin: [-1, 1] }];
const fog = (ar, color, alpha = 0.16, o = {}) => [{ tex: ['smoke_01', 'smoke_07', 'smoke_04'], area: ar, rate: o.rate || 0.6, life: [14, 22],
  vx: o.vx || [6, 16], vy: [-3, 3], size: o.size || [320, 480], colors: [color, color], alpha: [0, alpha, 0], spin: [-0.05, 0.05], rot: [0, 6.28], prewarm: true }];
const bubbles = (ar, rate, color) => [{ tex: ['circle_02'], add: true, area: ar, rate, life: [0.8, 1.6], vy: [-30, -12], vx: [-4, 4],
  size: [5, 16], colors: [color, color], alpha: [0, 0.8, 0] }];
const ripples = (ar, rate, color = '#e6fbff', a = 0.35) => [{ tex: ['ring'], add: true, area: ar, rate, life: [1.4, 2.4], size: [6, 70],
  colors: [color, color], alpha: [a, 0], flat: 0.32, noRot: true }];
// искры от молота: вспышка и веер раскалённых брызг
function sparkBursts(x, y, color = '#ffd27a') {
  const [X, Y] = P(x, y);
  return [{ tex: ['dot', 'star_04'], add: true, at: [X, Y], spread: [6, 3], burst: { every: [1.4, 3.2], count: [12, 24] }, life: [0.4, 0.9],
    speed: [140, 340], dir: [-2.7, -0.45], acc: [0, 480], size: [5, 1.5], colors: ['#fffbe0', color, '#ff5a1a'], alpha: [1, 1, 0] },
  { glow: true, at: [X, Y], size: 200, color, alpha: 0, burstGlow: true }];
}
function electric(x, y, color = '#bcd0ff') {
  const [X, Y] = P(x, y);
  return [{ tex: ['spark_01', 'spark_02', 'spark_03', 'spark_04'], add: true, at: [X, Y], spread: [10, 14], burst: { every: [0.25, 1.3], count: [1, 2] },
    life: [0.06, 0.16], size: [80, 90], colors: ['#ffffff', color], alpha: [1, 0], rot: [0, 6.28] },
  ...glow(x, y, 170, color, 0.3, { flicker: 0.5 })];
}
function wisps(x, y, vx, vy, pal = PAL.purple, o = {}) {
  const [X, Y] = P(x, y);
  return [{ tex: ['flame_01', 'flame_02', 'flame_03', 'flame_04'], add: true, at: [X, Y], spread: [6, 4], rate: o.rate || 5, life: o.life || [2.4, 3.8],
    vx, vy, sway: [18, 0.8], size: o.size || [36, 150], colors: [pal[0], pal[1], pal[2], pal[3]], alpha: [0, o.a ?? 0.55, 0], rot: [0, 6.28], spin: [-0.9, 0.9] }];
}
const rising = (ar, rate, colors, o = {}) => [{ tex: o.tex || ['star_06', 'magic_05', 'dot'], add: true, area: ar, rate, life: o.life || [2, 4],
  vx: [-10, 10], vy: o.vy || [-60, -25], sway: [14, 1.4], size: o.size || [12, 3], colors, alpha: [0, 1, 0], spin: [-1.5, 1.5], rot: [0, 6.28] }];
function orb(x, y, color = '#c78bff') {
  const [X, Y] = P(x, y);
  return [
    { glow: true, at: [X, Y], size: 300, color, alpha: 0.5, pulse: [0.6, 0.35] },
    { glow: true, at: [X, Y], tex: 'twirl_01', size: 150, color, alpha: 0.55, spin: 1.6 },
    { glow: true, at: [X, Y], tex: 'twirl_03', size: 120, color: '#ffd6ff', alpha: 0.45, spin: -2.4 },
    { tex: ['star_06', 'dot'], add: true, at: [X, Y], orbit: [40, 95], angVel: [1.2, 2.4], rate: 9, life: [1.4, 2.6], size: [10, 3],
      colors: ['#ffffff', '#e0a8ff', '#9a4dff'], alpha: [0, 1, 0] },
  ];
}
// косые лучи света из окна или двери
function rays(x, y, len, angle, color, alpha = 0.16, n = 3, gap = 26) {
  const [X, Y] = P(x, y);
  return Array.from({ length: n }, (_, i) => ({ glow: true, at: [X + (i - (n - 1) / 2) * gap, Y], tex: 'beam', size: 110, stretch: len / 110,
    rotation: angle + (i - (n - 1) / 2) * 0.05, color, alpha, pulse: [0.12 + i * 0.04, 0.5], anchorTop: true, swing: [0.025 + i * 0.006, 0.04 + i * 0.013] }));
}
const snow = q => [
  { tex: ['dot'], area: [-80, W + 80, -30, -10], rate: 10 * q, life: [14, 22], vx: [-8, 8], vy: [28, 46], sway: [26, 0.5], size: [3, 3], sizeVar: 0.5, colors: ['#ffffff', '#e8f4ff'], alpha: [0.75, 0.75, 0.75, 0], noScale: true, prewarm: true },
  { tex: ['dot'], area: [-80, W + 80, -30, -10], rate: 3 * q, life: [7, 11], vx: [-14, 14], vy: [80, 130], sway: [40, 0.7], size: [7, 7], sizeVar: 0.4, colors: ['#ffffff', '#ffffff'], alpha: [0.9, 0.9, 0.9, 0], noScale: true, prewarm: true },
];
function fall(x0, x1, y0, y1, color = '#dff7ff', rate = 14) {
  const [a, b] = P(x0, y0), [c, d] = P(x1, y1);
  return [{ tex: ['trace_05', 'trace_01'], add: true, area: [a, c, b, b + 10], rate, life: [(d - b) / 300, (d - b) / 220], vy: [220, 300], vx: [-4, 4],
    size: [64, 56], colors: [color, color], alpha: [0, 0.6, 0.5, 0], noRot: true },
  { tex: ['smoke_01', 'smoke_04'], area: [a - 10, c + 10, d - 14, d], rate: 2.4, life: [1.6, 2.8], vx: [-12, 12], vy: [-26, -10], size: [40, 120],
    colors: ['#ffffff', '#cfefff'], alpha: [0, 0.3, 0], spin: [-0.3, 0.3], rot: [0, 6.28] }];
}
// вода и лава «живут» прямо на картинке: этот участок фона чуть колышется
const water = (poly, o = {}) => [{ water: true, poly: poly.map(([x, y]) => P(x, y)), scale: o.scale || [9, 6], speed: o.speed || [14, 6] }];
const lava = (poly, o = {}) => water(poly, { scale: [14, 10], speed: [8, 5], ...o });
const lightning = xs => [{ lightning: true, xs: xs.map(x => P(x, 0)[0]), every: [4.5, 9] }];

// ───────────── общие слои для всех сцен ─────────────
// Тёплый или холодный тон «воздуха» каждой локации: им окрашены пылинки, боке и лучи
const AIR = { loc_tavern: '#ffcf8a', loc_dungeon: '#d8ffb0', loc_glade: '#e6f7b0', loc_forge: '#ffb070', loc_ice: '#dff1ff', loc_graveyard: '#b9ffd9', loc_sky: '#e8f0ff',
  loc_cove: '#d8fbff', loc_library: '#e6d2ff', loc_oasis: '#ffe2a8', loc_flooded: '#d8f2ff', loc_grove: '#b8fff0', loc_koschei: '#c9ffd9' };
// лучи света сверху: где в сцене есть пролом, окно или свод с небом
const SHAFTS = {
  loc_glade: [[820, 0, 720, 0.04, '#fff3c4', 0.08, 4, 70]],
  loc_ice: [[830, 0, 700, 0.05, '#dff1ff', 0.09, 4, 55]],
  loc_graveyard: [[1100, 0, 680, -0.18, '#cfe0ff', 0.07, 3, 70]],
  loc_flooded: [[1010, 0, 720, 0.12, '#bfe6ff', 0.1, 4, 45]],
  loc_grove: [[760, 0, 650, 0.03, '#9ff5e8', 0.08, 3, 70]],
  loc_koschei: [[255, 0, 620, -0.08, '#b8ffd4', 0.07, 3, 50]],
  loc_library: [[980, 0, 640, 0.1, '#e9d8ff', 0.06, 3, 60]],
  default: [[834, 0, 560, 0, '#ffe2b0', 0.06, 3, 80]],
};
const WATERY = new Set(['loc_cove', 'loc_flooded', 'loc_grove', 'loc_oasis']);
function common(key, q) {
  const air = AIR[key] || '#ffd99a';
  const out = [
    // боке: крупные размытые пятна света плывут у самого «объектива» — глубина кадра
    { tex: ['glow'], add: true, area: [-120, W + 120, -80, H + 80], rate: 0.45 * q, life: [18, 28], vx: [-9, 9], vy: [-7, 3], wander: 3,
      size: [70, 160, 90], sizeVar: 0.45, colors: [air, air], alpha: [0, 0.09, 0.09, 0], prewarm: true },
    // мелкая пыль в воздухе, медленно кружится
    { tex: ['dot'], add: true, area: [0, W, 0, H], rate: 2.2 * q, life: [9, 15], vx: [-5, 5], vy: [-6, 6], wander: 8, size: [2.2, 2.2], sizeVar: 0.5,
      colors: [air, '#ffffff'], alpha: [0, 0.32, 0.25, 0], prewarm: true },
  ];
  // со свода время от времени сыплется пыль (на воде — капает)
  if (key !== 'loc_sky') {
    const drip = WATERY.has(key);
    for (const [x, i] of [[180, 0], [760, 1], [1380, 2]]) out.push({ tex: ['dot'], at: P(x + i * 37, -6), spread: [drip ? 8 : 70, 2], burst: { every: [8 + i * 3, 17 + i * 4], count: drip ? [3, 6] : [14, 26] },
      life: [1.6, 2.6], vx: [-5, 5], vy: [30, 70], acc: [0, drip ? 420 : 150], size: drip ? [3, 2.4] : [2.2, 1.4], sizeVar: 0.4,
      colors: drip ? ['#e6f8ff', '#bfe6ff'] : ['#e8dcc8', '#a89880'], alpha: [0, drip ? 0.8 : 0.5, drip ? 0.7 : 0.35, 0] });
  }
  for (const r of SHAFTS[key] || []) out.push(...rays(...r));
  return out;
}

// ───────────── сцены ─────────────
function scene(key, q) {
  switch (key) {
    case 'loc_tavern': return [
      ...hearth(337, 160, 100, 1.7),
      ...glow(335, 140, 520, '#ff9a40', 0.3, { flicker: 0.2 }),
      ...glow(133, 147, 160, '#ffb347', 0.45, { flicker: 0.15 }), ...glow(1629, 131, 160, '#ffb347', 0.45, { flicker: 0.15 }),
      ...[[518, 46], [583, 16], [1233, 24], [1117, 6], [29, 400], [67, 694], [143, 687], [427, 774]].flatMap(([x, y]) => candle(x, y)),
      ...rays(1527, 40, 620, 0.62, '#9fb8ff', 0.09, 4),
      ...motes(area(150, 1500, 120, 860), 3 * q),
      ...embers(area(270, 400, 120, 170), 2.5, PAL.fire, { life: [1.5, 2.6], vy: [-80, -40] }),
    ];
    case 'loc_dungeon': return [
      ...[[196, 133], [53, 253], [671, 24], [997, 24], [1387, 53], [1623, 273], [191, 633], [611, 787], [1057, 787], [1473, 587]].flatMap(([x, y]) => torch(x, y, 0.95)),
      ...glow(387, 60, 220, '#ff9a40', 0.35, { flicker: 0.3 }), ...glow(1613, 627, 220, '#ff9a40', 0.35, { flicker: 0.3 }), ...glow(1353, 840, 200, '#ff9a40', 0.3, { flicker: 0.3 }),
      ...glow(150, 330, 340, '#7dff5a', 0.3, { pulse: [0.5, 0.35] }), ...glow(60, 540, 320, '#7dff5a', 0.28, { pulse: [0.4, 0.35] }),
      ...bubbles(area(90, 200, 300, 380), 3, '#a8ff7a'), ...bubbles(area(0, 120, 480, 590), 3, '#a8ff7a'),
      ...wisps(130, 340, [-6, 6], [-26, -12], PAL.green, { rate: 1.2, a: 0.22, size: [40, 140] }),
      ...lava([[110, 200], [170, 190], [190, 330], [150, 390], [80, 380], [100, 300]], { scale: [8, 10], speed: [4, 10] }),
      ...twinkles(area(1460, 1660, 60, 220), 1.4 * q, ['#ffffff', '#ffe9a0']), ...twinkles(area(0, 330, 700, 930), 1.4 * q, ['#ffffff', '#ffe9a0']),
      ...twinkles(area(1300, 1500, 760, 850), 0.8 * q, ['#ffffff', '#ffe9a0']),
      ...motes(area(200, 1450, 150, 800), 2 * q, '#cfe8b0', { a: 0.3 }),
    ];
    case 'loc_glade': return [
      ...fireflies(area(80, 1500, 120, 860), 40 * q, ['#fff36b', '#d6f59a', '#a6e8ff', '#ffe08a']),
      ...[[47, 187, 300], [67, 253, 240], [40, 547, 280], [127, 573, 220], [133, 773, 340], [1133, 40, 260], [427, 60, 190], [560, 53, 190], [1287, 800, 210], [1000, 873, 190], [393, 820, 190]]
        .flatMap(([x, y, s], i) => glow(x, y, s, i % 3 ? '#7fa8ff' : '#9a8cff', 0.32, { pulse: [0.3 + (i % 4) * 0.1, 0.4] })),
      ...[[671, 60], [984, 60], [157, 413], [1629, 200], [557, 780], [1087, 780], [1600, 753]].flatMap(([x, y]) => [...glow(x, y, 170, '#ffcf6a', 0.48, { flicker: 0.12 }), ...candle(x, y + 2, 0.4)]),
      ...water([[1533, 53], [1593, 53], [1600, 215], [1530, 220]], { scale: [4, 12], speed: [0, 40] }),
      ...water([[1520, 360], [1600, 350], [1672, 330], [1672, 680], [1610, 660], [1550, 580], [1525, 460]], { scale: [10, 6], speed: [6, 22] }),
      ...fall(1535, 1590, 60, 215, '#dff7ff', 10),
      ...twinkles(area(1520, 1672, 360, 670), 4 * q, ['#ffffff', '#c8f4ff'], 18), ...ripples(area(1540, 1660, 400, 650), 1.2),
      ...rising(area(300, 1400, 700, 900), 1.2 * q, ['#d6f59a', '#a6e8ff'], { tex: ['dot'], size: [4, 1], life: [3, 5] }),
    ];
    case 'loc_forge': return [
      ...lava([[0, 213], [100, 220], [147, 300], [110, 450], [140, 560], [120, 640], [0, 650]]),
      ...lava([[1533, 400], [1672, 380], [1672, 750], [1600, 740], [1545, 600]]),
      ...lava([[253, 770], [500, 760], [510, 870], [480, 941], [260, 941]]),
      ...lava([[1200, 770], [1440, 760], [1440, 941], [1205, 941]]),
      ...lava([[413, 0], [587, 0], [570, 55], [430, 60]]), ...lava([[1573, 0], [1672, 0], [1672, 110], [1580, 105]]),
      ...lava([[267, 120], [413, 120], [425, 235], [290, 240]], { scale: [6, 14], speed: [2, 18] }),
      ...glow(60, 430, 600, '#ff6a1a', 0.4, { pulse: [0.35, 0.35] }), ...glow(1610, 560, 600, '#ff6a1a', 0.4, { pulse: [0.3, 0.35] }),
      ...glow(380, 860, 500, '#ff6a1a', 0.38, { pulse: [0.4, 0.3] }), ...glow(1320, 860, 500, '#ff6a1a', 0.38, { pulse: [0.45, 0.3] }),
      ...glow(340, 175, 420, '#ff8a2a', 0.42, { flicker: 0.2 }), ...glow(1413, 167, 200, '#ffb347', 0.45, { flicker: 0.3 }),
      ...[[684, 120], [987, 120], [163, 633], [1507, 627], [667, 713], [1000, 713], [1547, 487]].flatMap(([x, y]) => torch(x, y, 0.9)),
      ...sparkBursts(1413, 160),
      ...embers(area(0, 160, 300, 900), 5 * q), ...embers(area(1520, 1672, 380, 900), 5 * q),
      ...embers(area(240, 520, 760, 941), 4 * q), ...embers(area(1190, 1450, 760, 941), 4 * q), ...embers(area(260, 430, 110, 240), 3 * q),
      ...bubbles(area(10, 130, 250, 620), 3, '#ffb347'), ...bubbles(area(1545, 1665, 420, 730), 3, '#ffb347'),
    ];
    case 'loc_ice': return [
      ...snow(q),
      ...[[724, 87], [940, 87], [340, 160], [96, 287], [1411, 64], [1616, 160], [691, 720], [980, 720]].flatMap(([x, y]) => torch(x, y, 0.95, PAL.gold, { smokeA: 0.1 })),
      ...[[307, 107], [40, 153], [1467, 693], [1640, 773], [907, 40], [813, 40], [210, 640], [1320, 600]].flatMap(([x, y], i) => glow(x, y, 260, '#8fd4ff', 0.28, { pulse: [0.25 + i * 0.05, 0.4] })),
      ...twinkles(area(260, 1440, 220, 700), 3 * q, ['#ffffff', '#cfefff'], 16),
      ...water([[1507, 333], [1672, 320], [1672, 590], [1540, 580], [1500, 480]], { scale: [7, 4], speed: [10, 4] }),
      ...fog(area(-100, 1700, 760, 940), '#dff1ff', 0.14), ...fog(area(-100, 400, 200, 700), '#dff1ff', 0.1, { rate: 0.25 }),
    ];
    case 'loc_graveyard': return [
      ...[[53, 147], [196, 40], [740, 87], [931, 87], [1224, 60], [1409, 53], [1620, 440], [557, 693], [1147, 693]].flatMap(([x, y]) => torch(x, y, 0.95, PAL.green, { smokeA: 0.12 })),
      ...[[513, 140], [667, 167], [887, 73], [1067, 147], [1413, 227], [193, 213], [123, 287], [117, 493], [180, 473], [357, 760], [713, 727], [971, 727], [1323, 780], [1473, 607], [1547, 480]].flatMap(([x, y]) => candle(x, y - 6)),
      ...[[607, 807], [976, 887], [1131, 173], [37, 473], [1527, 727]].flatMap(([x, y]) => glow(x, y, 170, '#d07bff', 0.34, { pulse: [0.4, 0.4] })),
      ...fog(area(-150, 500, 640, 960), '#5fe0b8', 0.2), ...fog(area(1250, 1800, 640, 960), '#5fe0b8', 0.2), ...fog(area(-100, 1700, 840, 960), '#8a6ad8', 0.12, { rate: 0.4 }),
      ...fog(area(-150, 260, 150, 640), '#5fe0b8', 0.12, { rate: 0.25 }),
      ...wisps(560, 690, [-8, 8], [-40, -20], PAL.green, { rate: 1.4, a: 0.28 }), ...wisps(1150, 690, [-8, 8], [-40, -20], PAL.green, { rate: 1.4, a: 0.28 }),
      ...fireflies(area(150, 1500, 200, 800), 14 * q, ['#b9ffd9', '#e3b3ff', '#fff3b0']),
    ];
    case 'loc_sky': return [
      ...lightning([120, 260, 950, 1180, 1560]),
      ...[[191, 607], [680, 747], [987, 747], [1477, 607]].flatMap(([x, y]) => torch(x, y, 1.1, PAL.gold)),
      ...[[473, 127], [1196, 127], [267, 233], [1407, 227]].flatMap(([x, y]) => [...glow(x, y, 160, '#ffd27a', 0.45, { flicker: 0.12 }), ...candle(x, y, 0.4)]),
      ...electric(200, 187), ...electric(1467, 187), ...electric(73, 720), ...electric(1607, 720),
      ...fog(area(-200, 260, 0, 941), '#b9a8ff', 0.16, { rate: 0.5, vx: [8, 18] }), ...fog(area(1400, 1900, 0, 941), '#b9a8ff', 0.16, { rate: 0.5, vx: [-18, -8] }),
      ...motes(area(250, 1450, 150, 800), 2.5 * q, '#e8f0ff', { a: 0.4 }),
    ];
    case 'loc_cove': return [
      ...water([[0, 850], [120, 838], [260, 800], [420, 790], [560, 800], [560, 941], [0, 941]], { scale: [10, 6], speed: [14, 6] }),
      ...water([[1500, 300], [1600, 250], [1672, 250], [1672, 560], [1600, 520], [1530, 440]], { scale: [10, 6], speed: [-12, 6] }),
      ...water([[990, 0], [1215, 0], [1200, 120], [1120, 175], [1010, 170], [985, 90]], { scale: [9, 6], speed: [10, 8] }),
      ...twinkles(area(0, 560, 800, 941), 4 * q, ['#ffffff', '#e6fbff'], 20), ...twinkles(area(1500, 1672, 250, 560), 2.5 * q, ['#ffffff', '#e6fbff'], 20),
      ...twinkles(area(990, 1210, 0, 170), 1.8 * q, ['#ffffff', '#e6fbff'], 18),
      ...ripples(area(40, 520, 850, 930), 1.6), ...ripples(area(1540, 1660, 300, 520), 1),
      ...[[483, 80], [896, 53], [1193, 787], [549, 860]].flatMap(([x, y]) => [...glow(x, y, 180, '#ffd27a', 0.45, { flicker: 0.15 }), ...candle(x, y + 2, 0.4)]),
      ...fall(85, 120, 230, 360, '#e6fbff', 6),
      ...motes(area(200, 1450, 150, 780), 2 * q, '#fff3d6', { a: 0.35 }),
    ];
    case 'loc_library': return [
      ...orb(287, 62),
      ...[[127, 53], [93, 133], [220, 180], [247, 180], [160, 353], [544, 40], [747, 13], [924, 13], [1207, 60], [1513, 233], [1517, 500], [267, 713], [1477, 760]].flatMap(([x, y]) => candle(x, y - 4, 0.45)),
      ...glow(629, 690, 230, '#c78bff', 0.5, { pulse: [0.5, 0.4] }), ...glow(1037, 690, 230, '#c78bff', 0.5, { pulse: [0.45, 0.4] }),
      ...rising(area(610, 650, 650, 700), 2.2, ['#ffffff', '#e0a8ff', '#9a4dff']), ...rising(area(1020, 1060, 650, 700), 2.2, ['#ffffff', '#e0a8ff', '#9a4dff']),
      ...glow(107, 233, 230, '#b06bff', 0.42, { pulse: [0.35, 0.4] }), ...glow(1600, 287, 230, '#b06bff', 0.42, { pulse: [0.3, 0.4] }),
      ...rising(area(70, 150, 200, 260), 1.4, ['#ffffff', '#c78bff'], { tex: ['magic_05', 'star_06'] }), ...rising(area(1560, 1640, 250, 310), 1.4, ['#ffffff', '#c78bff'], { tex: ['magic_05', 'star_06'] }),
      ...twinkles(area(1300, 1672, 0, 170), 2.5 * q, ['#ffffff', '#d9c8ff'], 16),
      ...motes(area(200, 1450, 150, 800), 3 * q, '#ffe3a8', { a: 0.4 }),
    ];
    case 'loc_oasis': return [
      ...water([[1420, 320], [1520, 300], [1672, 290], [1672, 510], [1560, 500], [1450, 420]], { scale: [9, 5], speed: [10, 6] }),
      ...water([[1580, 185], [1650, 175], [1660, 350], [1585, 360]], { scale: [4, 12], speed: [0, 40] }),
      ...fall(1585, 1650, 190, 350, '#e6fbff', 10),
      ...twinkles(area(1420, 1672, 300, 510), 3.5 * q, ['#ffffff', '#e6fbff'], 18), ...ripples(area(1460, 1650, 340, 490), 1.2),
      ...wisps(240, 680, [-38, -18], [-46, -26], PAL.purple, { rate: 6 }),
      ...rising(area(80, 260, 560, 690), 2.2, ['#ffffff', '#e0a8ff'], { vy: [-50, -20] }),
      ...glow(235, 690, 220, '#c78bff', 0.4, { pulse: [0.5, 0.35] }),
      ...[[720, 113], [953, 113]].flatMap(([x, y]) => torch(x, y, 1.1, PAL.fire)),
      ...[[47, 440], [117, 200], [1587, 173], [1216, 920], [557, 880]].flatMap(([x, y]) => [...glow(x, y, 160, '#ffcf6a', 0.45, { flicker: 0.15 }), ...candle(x, y, 0.4)]),
      ...glow(833, 40, 340, '#ffc04d', 0.32, { pulse: [0.3, 0.3] }), ...rays(833, 20, 420, 0, '#ffd27a', 0.07, 3, 40),
      ...motes(area(250, 1400, 180, 800), 3 * q, '#ffe6b0', { a: 0.35 }),
    ];
    case 'loc_flooded': return [
      ...[[415, 118], [490, 88], [580, 88], [635, 118], [285, 255], [312, 318], [765, 385], [835, 455], [875, 480], [1580, 262], [1490, 440]].flatMap(([x, y]) => [...glow(x, y, 150, '#ffd27a', 0.42, { flicker: 0.12 }), ...candle(x, y, 0.35)]),
      ...glow(525, 140, 420, '#ffb347', 0.22, { flicker: 0.08 }),
      ...water([[0, 600], [820, 595], [1000, 625], [1500, 635], [1672, 620], [1672, 941], [0, 941]], { scale: [10, 6], speed: [8, 4] }),
      ...twinkles(area(0, 1672, 640, 941), 4 * q, ['#ffffff', '#ffe9a0', '#cfefff'], 18), ...ripples(area(100, 1600, 650, 930), 2),
      ...fall(905, 935, 0, 300, '#dff7ff', 8), ...fall(1200, 1240, 0, 260, '#dff7ff', 8), ...fall(190, 230, 500, 600, '#dff7ff', 6),
      ...fog(area(700, 1300, 300, 650), '#9fd8e8', 0.12, { rate: 0.35 }),
      ...motes(area(200, 1450, 150, 600), 1.5 * q, '#e6f6ff', { a: 0.3 }),
    ];
    case 'loc_grove': return [
      ...hearth(1005, 595, 40, 0.8),
      ...glow(1005, 580, 300, '#ff9a40', 0.4, { flicker: 0.25 }),
      ...glow(680, 110, 520, '#3fe0d0', 0.22, { pulse: [0.25, 0.3] }), ...glow(1000, 270, 360, '#3fe0d0', 0.2, { pulse: [0.3, 0.3] }),
      ...glow(1340, 200, 520, '#ffb347', 0.22, { pulse: [0.22, 0.3] }), ...glow(1590, 60, 300, '#ffb347', 0.22, { pulse: [0.28, 0.3] }),
      ...[[1560, 650, 200], [140, 450, 150], [520, 465, 140], [870, 395, 160], [60, 240, 180], [1600, 310, 160]].flatMap(([x, y, sz], i) => glow(x, y, sz, '#ffcf6a', 0.38, { pulse: [0.35 + i * 0.05, 0.35] })),
      ...rising(area(300, 1500, 250, 700), 2.5 * q, ['#8dffe8', '#3fe0d0', '#ffd27a'], { tex: ['dot'], size: [4, 1], life: [4, 7], vy: [-30, -10] }),
      ...fireflies(area(100, 1600, 150, 800), 18 * q, ['#8dffe8', '#ffe08a']),
      ...fall(255, 300, 270, 420, '#dff7ff', 8), ...fall(250, 370, 600, 800, '#dff7ff', 12), ...fall(430, 460, 520, 600, '#dff7ff', 6), ...fall(605, 760, 760, 830, '#dff7ff', 8),
      ...water([[110, 850], [640, 850], [640, 941], [110, 941]], { scale: [8, 5], speed: [6, 4] }),
      ...twinkles(area(110, 640, 860, 941), 2.5 * q, ['#ffffff', '#c8f4ff'], 16),
    ];
    case 'loc_koschei': return [
      ...[[550, 268], [745, 420], [915, 262], [1185, 312], [1330, 392], [1555, 108], [630, 560], [830, 462], [1485, 515], [40, 378], [120, 322], [240, 350]].flatMap(([x, y]) => [...glow(x, y, 150, '#5cff9a', 0.36, { flicker: 0.15 }), ...candle(x, y, 0.4, PAL.green)]),
      ...glow(1050, 412, 200, '#ffd77a', 0.4, { pulse: [0.4, 0.35] }),
      ...fall(205, 300, 120, 350, '#dff7ff', 10), ...fall(305, 380, 380, 650, '#dff7ff', 10),
      ...twinkles(area(0, 460, 560, 941), 3.5 * q, ['#ffffff', '#ffe9a0']), ...twinkles(area(1200, 1672, 600, 941), 3.5 * q, ['#ffffff', '#ffe9a0']),
      ...twinkles(area(440, 1200, 560, 700), 1.2 * q, ['#ffffff', '#ffe9a0']),
      ...fog(area(-100, 1700, 760, 960), '#5fe0b8', 0.12, { rate: 0.35 }),
      ...wisps(1050, 520, [-8, 8], [-34, -16], PAL.green, { rate: 1, a: 0.2 }),
      ...motes(area(200, 1450, 150, 700), 1.5 * q, '#c9ffd9', { a: 0.3 }),
    ];
    default: return [ // подземная арена
      ...[[191, 128], [56, 255], [671, 24], [997, 24], [1609, 268], [137, 648], [1547, 662]].flatMap(([x, y]) => torch(x, y, 1.05)),
      ...motes(area(180, 1450, 150, 800), 3 * q, '#ffd99a', { a: 0.35 }),
      ...embers(area(150, 1500, 600, 900), 1.2 * q, PAL.fire, { life: [5, 8], vy: [-30, -12] }),
      ...fog(area(-100, 1700, 800, 960), '#8a6040', 0.1, { rate: 0.3 }),
    ];
  }
}

// ───────────── движок ─────────────
let PIXI = null, app = null, host = null, frames = {}, dispTex = null;
let groups = null, dim = null, vig = null, flash = null, mood = null;
// настроение сцены: в бою края кадра наливаются цветом опасности, на смене хода вспыхивают огни
let moodA = 0, moodTarget = 0, moodColor = 0xff3a1a, moodPulse = 1.2, flare = 0;
// ударная волна по фону (ShockwaveFilter из pixi-filters, MIT): в победу, на выход босса, на легендарку
let Shock = null, shock = null, shockT = 0, shockEnd = 0;
let scenes = [], current = null, quality = 1, running = false, ready = null;
let worldA = 0, worldTarget = 0, clock = 0, lastW = 0, lastH = 0, layout = () => {};

function makeNoiseTexture() {
  // бесшовный шум для колыхания воды и лавы: каналы R и G — смещения по X и Y
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), T = Math.PI * 2 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    const a = Math.sin(x * T * 2 + Math.sin(y * T * 3) * 1.5) + Math.sin(y * T + x * T) * 0.6 + Math.sin((x + y) * T * 4) * 0.3;
    const b = Math.cos(y * T * 2 + Math.sin(x * T * 2) * 1.5) + Math.cos(x * T * 3 - y * T) * 0.6 + Math.sin((x - y) * T * 3) * 0.3;
    img.data[i] = 128 + a * 60; img.data[i + 1] = 128 + b * 60; img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = PIXI.Texture.from(c);
  t.source.addressMode = 'repeat';
  return t;
}
function gradientTexture(kind) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  if (kind === 'dim') {
    c.width = 4; c.height = 256;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(10,8,20,.14)'); gr.addColorStop(1, 'rgba(10,8,20,.30)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  } else if (kind === 'edge') {
    c.width = c.height = 512;
    const gr = g.createRadialGradient(256, 256, 120, 256, 256, 362);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,.95)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  } else {
    c.width = c.height = 512;
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 362);
    gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  }
  return PIXI.Texture.from(c);
}

async function init(hostEl) {
  host = hostEl;
  PIXI = await import('/vendor/pixi-8.20.1.min.mjs');
  const small = Math.min(innerWidth, innerHeight) < 600;
  quality = small || (navigator.hardwareConcurrency || 4) <= 4 ? 0.6 : 1;
  app = new PIXI.Application();
  await app.init({ backgroundAlpha: 0, antialias: false, autoDensity: true, resolution: Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5),
    resizeTo: host, preference: 'webgl', powerPreference: 'low-power', hello: false });
  if (quality < 1) app.ticker.maxFPS = 40;
  app.canvas.className = 'w-vfx';
  const base = await PIXI.Assets.load('/vfx/particles-v1.webp');
  for (const [k, [cx, cy]] of Object.entries(ATLAS)) frames[k] = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(cx * TEX, cy * TEX, TEX, TEX) });
  dispTex = makeNoiseTexture();
  const root = new PIXI.Container();
  groups = { bg: new PIXI.Container(), water: new PIXI.Container(), parts: new PIXI.Container(), bolts: new PIXI.Container() };
  // копия картины фона: видна только во время ударной волны, чтобы волна гнула и картину
  groups.bg.visible = false;
  dim = new PIXI.Sprite(gradientTexture('dim')); dim.width = W; dim.height = H;
  root.addChild(groups.bg, groups.water, dim, groups.parts, groups.bolts);
  try { ({ ShockwaveFilter: Shock } = await import('/vendor/pixi-shockwave-6.1.5.min.mjs')); } catch { Shock = null; }
  vig = new PIXI.Sprite(gradientTexture('vig'));
  flash = new PIXI.Graphics().rect(0, 0, 10, 10).fill(0xffffff); flash.alpha = 0; flash.blendMode = 'add'; flash.tint = 0xe8f0ff;
  mood = new PIXI.Sprite(gradientTexture('edge')); mood.blendMode = 'add'; mood.alpha = 0;
  app.stage.addChild(root, vig, mood, flash);
  layout = () => {
    const vw = app.screen.width, vh = app.screen.height;
    lastW = vw; lastH = vh;
    const bw = Math.max(vw, vh * 16 / 9), bh = Math.max(vh, vw * 9 / 16);
    root.scale.set(bw / W); root.position.set((vw - bw) / 2, (vh - bh) / 2);
    vig.width = vw; vig.height = vh; flash.width = vw; flash.height = vh; mood.width = vw; mood.height = vh;
  };
  layout();
  app.ticker.add(t => step(Math.min(t.deltaMS / 1000, 0.05)));
  host.append(app.canvas);
  running = true;
  // «неподвижный фон» в настройках — холст прячется, возвращаются простые CSS-огоньки
  new MutationObserver(syncStill).observe(host, { attributes: true, attributeFilter: ['class'] });
  syncStill();
}
function syncStill() {
  if (!app) return;
  const still = host.classList.contains('still');
  if (host.classList.contains('vfx') === still) host.classList.toggle('vfx', !still);
  app.canvas.style.display = still ? 'none' : '';
  if (still && running) { app.ticker.stop(); running = false; }
  if (!still && !running) { app.ticker.start(); running = true; }
}

// ───── излучатели ─────
function makeScene(key, bgUrl) {
  const S = { key, bgUrl, alpha: 0, target: 1, emitters: [], statics: [], waters: [], bolts: null };
  const dyn = { position: true, rotation: true, color: true, vertex: true, uvs: true };
  S.pcAdd = new PIXI.ParticleContainer({ texture: frames.glow, dynamicProperties: dyn }); S.pcAdd.blendMode = 'add';
  S.pcNorm = new PIXI.ParticleContainer({ texture: frames.glow, dynamicProperties: dyn });
  S.waterC = new PIXI.Container();
  S.bgC = new PIXI.Container(); groups.bg.addChild(S.bgC);
  S.boltC = new PIXI.Container(); S.boltC.blendMode = 'add';
  S.partsC = new PIXI.Container(); S.partsC.addChild(S.pcNorm, S.pcAdd);
  groups.water.addChild(S.waterC); groups.parts.addChild(S.partsC); groups.bolts.addChild(S.boltC);
  for (const spec of [...scene(key, quality), ...common(key, quality)]) {
    if (spec.water) S.waters.push({ spec });
    else if (spec.lightning) S.bolts = { spec, next: rnd(1, 4), live: [] };
    else if (spec.glow) S.statics.push(makeStatic(S, spec));
    else S.emitters.push(makeEmitter(S, spec));
  }
  PIXI.Assets.load(bgUrl).then(tex => {
    if (S.dead) return;
    const sp = new PIXI.Sprite(tex); sp.width = W; sp.height = H; S.bgC.addChild(sp);
    for (const w of S.waters) buildWater(S, w, tex);
  }).catch(() => {});
  return S;
}
function makeStatic(S, spec) {
  const p = new PIXI.Particle({ texture: frames[spec.tex || 'glow'], anchorX: 0.5, anchorY: spec.anchorTop ? 0 : 0.5, x: spec.at[0], y: spec.at[1] });
  const sc = spec.size / TEX;
  p.scaleX = sc; p.scaleY = sc * (spec.stretch || 1);
  p.rotation = spec.rotation || 0;
  p.color = 0;
  S.pcAdd.addParticle(p);
  const [r, g, b] = rgb(spec.color);
  return { p, spec, r, g, b, ph: Math.random() * 10, fl: 1, boost: spec.burstGlow ? 0 : undefined };
}
function makeEmitter(S, spec) {
  const max = Math.max(2, Math.ceil((spec.rate || 0) * (spec.life?.[1] || 1) * 1.15 + (spec.burst ? spec.burst.count[1] * 1.2 : 0)));
  const pc = spec.add ? S.pcAdd : S.pcNorm;
  const pool = [];
  for (let i = 0; i < max; i++) {
    const p = new PIXI.Particle({ texture: frames[spec.tex[0]], anchorX: 0.5, anchorY: spec.anchor ?? 0.5 });
    p.color = 0; pc.addParticle(p);
    pool.push({ p, life: 0, age: 0, dead: true });
  }
  const E = { spec, pool, cols: spec.colors.map(rgb), acc: Math.random(), nextBurst: spec.burst ? rnd(...spec.burst.every) : 0 };
  // туман, снег и пылинки должны быть на экране сразу, а не наползать с нуля
  if (spec.prewarm) for (let t = 0; t < spec.life[1]; t += 0.25) updEmitter(E, 0.25, 0, t);
  return E;
}
function spawn(E) {
  const s = E.spec, it = E.pool.find(x => x.dead);
  if (!it) return null;
  it.p.texture = frames[pickOne(s.tex)];
  it.dead = false; it.age = 0; it.life = rnd(...s.life);
  if (s.area) { it.x = rnd(s.area[0], s.area[1]); it.y = rnd(s.area[2], s.area[3]); }
  else { const sp = s.spread || [0, 0]; it.x = s.at[0] + rnd(-sp[0], sp[0]); it.y = s.at[1] + rnd(-sp[1], sp[1]); }
  if (s.speed) { const a = rnd(...s.dir), v = rnd(...s.speed); it.vx = Math.cos(a) * v; it.vy = Math.sin(a) * v; }
  else { it.vx = s.vx ? rnd(...s.vx) : 0; it.vy = s.vy ? rnd(...s.vy) : 0; }
  if (s.orbit) { it.r = rnd(...s.orbit); it.th = rnd(0, 6.28); it.w = rnd(...s.angVel) * (Math.random() < 0.5 ? -1 : 1); it.cx = it.x; it.cy = it.y; }
  it.k = 1 + (s.sizeVar ? rnd(-s.sizeVar, s.sizeVar) : 0);
  it.rot = s.noRot ? 0 : s.rot ? rnd(...s.rot) : 0; it.spin = s.spin ? rnd(...s.spin) : 0;
  it.ph = Math.random() * 6.28;
  return it;
}
function curve(arr, t) {
  if (arr.length === 1) return arr[0];
  const f = t * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f));
  return lerp(arr[i], arr[i + 1], f - i);
}
function updEmitter(E, dt, fade, time) {
  const s = E.spec;
  E.burst = false;
  if (s.burst) {
    E.nextBurst -= dt;
    if (E.nextBurst <= 0) { const n = Math.round(rnd(...s.burst.count)); for (let i = 0; i < n; i++) spawn(E); E.nextBurst = rnd(...s.burst.every); E.burst = true; }
  } else {
    E.acc += s.rate * dt;
    while (E.acc >= 1) {
      E.acc -= 1;
      const it = spawn(E);
      if (it) it.age = E.acc / s.rate; // рождение «между кадрами» — поток ровный и при низком FPS
    }
  }
  for (const it of E.pool) {
    if (it.dead) continue;
    it.age += dt;
    const t = it.age / it.life;
    if (t >= 1) { it.dead = true; it.p.color = 0; continue; }
    if (s.orbit) {
      it.th += it.w * dt; it.x = it.cx + Math.cos(it.th) * it.r; it.y = it.cy + Math.sin(it.th) * it.r * 0.42;
    } else {
      if (s.acc) { it.vx += s.acc[0] * dt; it.vy += s.acc[1] * dt; }
      if (s.wander) { it.vx += (Math.random() - 0.5) * s.wander * dt * 6; it.vy += (Math.random() - 0.5) * s.wander * dt * 6; it.vx *= 0.985; it.vy *= 0.985; }
      it.x += it.vx * dt; it.y += it.vy * dt;
      if (s.area && s.wander) {
        if (it.x < s.area[0]) it.vx = Math.abs(it.vx);
        if (it.x > s.area[1]) it.vx = -Math.abs(it.vx);
        if (it.y < s.area[2]) it.vy = Math.abs(it.vy);
        if (it.y > s.area[3]) it.vy = -Math.abs(it.vy);
      }
    }
    const sw = s.sway ? Math.sin(time * s.sway[1] * 6.28 + it.ph) * s.sway[0] : 0;
    const p = it.p;
    p.x = it.x + sw; p.y = it.y;
    it.rot += it.spin * dt; p.rotation = it.rot;
    const sc = Math.max(0.001, (s.noScale ? s.size[0] : curve(s.size, t)) * it.k / TEX);
    p.scaleX = sc; p.scaleY = sc * (s.flat || 1);
    let a = curve(s.alpha, t);
    if (s.flicker) a *= 1 - Math.random() * s.flicker;
    if (s.pulse) a *= 1 - s.pulse[1] * (0.5 + 0.5 * Math.sin(time * s.pulse[0] * 6.28 + it.ph));
    const c = E.cols, f = t * (c.length - 1), i = Math.min(c.length - 2, Math.floor(f)), u = f - i;
    p.color = pack(lerp(c[i][0], c[i + 1][0], u) | 0, lerp(c[i][1], c[i + 1][1], u) | 0, lerp(c[i][2], c[i + 1][2], u) | 0, Math.max(0, Math.min(1, a * fade)));
  }
}
function updStatic(St, dt, fade, time) {
  const s = St.spec;
  let a = s.alpha;
  // огни вспыхивают ярче на смене хода и в победу
  if (s.flicker && flare > 0) a *= 1 + flare * 0.9;
  if (s.swing) St.p.rotation = (s.rotation || 0) + Math.sin(time * s.swing[1] * 6.28 + St.ph) * s.swing[0];
  if (St.boost !== undefined) { St.boost = Math.max(0, St.boost - dt * 2.5); a = 0.55 * St.boost; }
  if (s.flicker) { St.fl = lerp(St.fl, 1 - Math.random() * s.flicker, 0.35); a *= St.fl; }
  if (s.pulse) a *= 1 - s.pulse[1] * (0.5 + 0.5 * Math.sin(time * s.pulse[0] * 6.28 + St.ph));
  if (s.spin) St.p.rotation += s.spin * dt;
  St.p.color = pack(St.r, St.g, St.b, Math.max(0, Math.min(1, a * fade)));
}
function buildWater(S, w, tex) {
  const pts = w.spec.poly, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 14;
  const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad), x1 = Math.min(W, Math.max(...xs) + pad), y1 = Math.min(H, Math.max(...ys) + pad);
  const sx = tex.source.width / W, sy = tex.source.height / H;
  const sub = new PIXI.Texture({ source: tex.source, frame: new PIXI.Rectangle(x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy) });
  const spr = new PIXI.Sprite(sub); spr.position.set(x0, y0); spr.width = x1 - x0; spr.height = y1 - y0;
  const mask = new PIXI.Graphics().poly(pts.flat()).fill(0xffffff);
  const map = new PIXI.Sprite(dispTex); map.scale.set(1.6);
  const filter = new PIXI.DisplacementFilter({ sprite: map, scale: { x: w.spec.scale[0], y: w.spec.scale[1] } });
  filter.resolution = quality < 1 ? 0.5 : 1;
  spr.filters = [filter]; spr.mask = mask;
  S.waterC.addChild(map, spr, mask);
  w.map = map;
}
function bolt(x0, y0, x1, y1, g, width) {
  const pts = [[x0, y0]], n = 9;
  for (let i = 1; i < n; i++) { const t = i / n; pts.push([lerp(x0, x1, t) + rnd(-26, 26), lerp(y0, y1, t) + rnd(-10, 10)]); }
  pts.push([x1, y1]);
  for (const [w, a, c] of [[width * 7, 0.12, 0x8fb0ff], [width * 3, 0.3, 0xbfd0ff], [width, 1, 0xffffff]]) g.poly(pts.flat(), false).stroke({ width: w, color: c, alpha: a, join: 'round', cap: 'round' });
  return pts;
}
function updBolts(S, dt, fade) {
  const B = S.bolts;
  if (!B) return;
  B.next -= dt;
  if (B.next <= 0 && fade > 0.5) {
    const x = pickOne(B.spec.xs), g = new PIXI.Graphics();
    const pts = bolt(x, -10, x + rnd(-120, 120), rnd(220, 520), g, 2.4);
    const mid = pts[Math.floor(rnd(3, 6))];
    bolt(mid[0], mid[1], mid[0] + rnd(-140, 140), mid[1] + rnd(80, 200), g, 1.3);
    S.boltC.addChild(g);
    B.live.push({ g, age: 0, life: 0.45 });
    flash.tint = 0xe8f0ff; flash.alpha = 0.16;
    B.next = rnd(...B.spec.every);
  }
  for (const b of B.live) { b.age += dt; b.g.alpha = b.age > b.life ? 0 : (Math.random() < 0.25 ? 0.25 : 1) * (1 - b.age / b.life) * fade; }
  B.live = B.live.filter(b => { if (b.age > b.life) { b.g.destroy(); return false; } return true; });
}
function dropScene(S) {
  S.dead = true;
  S.waterC.destroy({ children: true }); S.partsC.destroy({ children: true }); S.boltC.destroy({ children: true }); S.bgC.destroy({ children: true });
  // картинку фона держим в памяти видеокарты, только пока она нужна
  if (!scenes.some(o => o.bgUrl === S.bgUrl)) PIXI.Assets.unload(S.bgUrl).catch(() => {});
}
function step(dt) {
  clock += dt;
  if (app.screen.width !== lastW || app.screen.height !== lastH) layout();
  worldA += Math.sign(worldTarget - worldA) * Math.min(Math.abs(worldTarget - worldA), dt / 1.3);
  dim.alpha = vig.alpha = worldA;
  if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - dt * 0.9);
  moodA += Math.sign(moodTarget - moodA) * Math.min(Math.abs(moodTarget - moodA), dt / 0.9);
  mood.alpha = moodA * worldA * (0.72 + 0.28 * Math.sin(clock * moodPulse * 6.28));
  mood.tint = moodColor;
  if (flare > 0) flare = Math.max(0, flare - dt * 1.1);
  if (shock) {
    shockT += dt; shock.time = shockT;
    if (shockT >= shockEnd) { app.stage.filters = null; shock.destroy(); shock = null; groups.bg.visible = false; }
  }
  for (const S of scenes) {
    S.alpha += Math.sign(S.target - S.alpha) * Math.min(Math.abs(S.target - S.alpha), dt / 1.2);
    const f = S.alpha;
    S.waterC.alpha = f; S.bgC.alpha = f;
    for (const E of S.emitters) {
      updEmitter(E, dt, f, clock);
      if (E.burst) for (const St of S.statics) if (St.boost !== undefined) St.boost = 1;
    }
    for (const St of S.statics) updStatic(St, dt, f, clock);
    for (const w of S.waters) if (w.map) { w.map.x += w.spec.speed[0] * dt; w.map.y += w.spec.speed[1] * dt; }
    updBolts(S, dt, f);
  }
  // погасшие сцены удаляем
  const gone = scenes.filter(S => S.target === 0 && S.alpha <= 0);
  if (gone.length) { scenes = scenes.filter(S => !gone.includes(S)); gone.forEach(dropScene); }
}

// ───────────── снаружи ─────────────
// Показать эффекты сцены key (картинка bgUrl). Если WebGL нет — тихо остаются простые CSS-эффекты.
export async function showVfx(hostEl, key, bgUrl) {
  current = key;
  try {
    if (!ready) ready = init(hostEl);
    await ready;
  } catch (e) {
    console.warn('Живые эффекты выключены:', e?.message || e);
    hostEl.classList.remove('vfx');
    app?.canvas?.remove();
    return;
  }
  if (current !== key) return;
  // затемнение и виньетку теперь рисует холст: если сцена уже на экране, включаем их сразу, без мигания
  if (worldA === 0 && host.querySelector('.world.on')) worldA = 1;
  worldTarget = 1;
  const same = scenes.find(S => S.key === key);
  for (const S of scenes) S.target = S === same ? 1 : 0;
  if (!same) scenes.push(makeScene(key, bgUrl));
}
// Настроение фона от событий партии: бой, вспышки, огни
export function vfxMood(kind, o = {}) {
  if (!app) return;
  if (kind === 'combat') { moodTarget = o.boss ? 0.5 : o.losing ? 0.36 : 0.24; moodColor = o.boss ? 0xc23cff : o.losing ? 0xff3218 : 0xff7a2a; moodPulse = o.boss ? 1.6 : o.losing ? 1.1 : 0.6; }
  else if (kind === 'calm') moodTarget = 0;
  else if (kind === 'flash') { flash.tint = o.color ?? 0xffffff; flash.alpha = Math.max(flash.alpha, o.alpha ?? 0.2); }
  else if (kind === 'flare') flare = Math.max(flare, o.n ?? 1);
  else if (kind === 'shock' && Shock && running) {
    // экранная точка → точка холста (фон слегка увеличен и смещён параллаксом)
    const r = app.canvas.getBoundingClientRect(), sw = app.screen.width / (r.width || 1), sh = app.screen.height / (r.height || 1);
    const x = ((o.x ?? innerWidth / 2) - r.left) * sw, y = ((o.y ?? innerHeight / 2) - r.top) * sh;
    const radius = Math.hypot(app.screen.width, app.screen.height) * 0.8, speed = 1100;
    if (shock) shock.destroy();
    shock = new Shock({ center: { x, y }, speed, amplitude: 22 * (o.power ?? 1), wavelength: 170, brightness: 1.12, radius });
    shock.resolution = quality < 1 ? 0.5 : 1;
    shockT = 0; shockEnd = radius / speed + 0.1;
    app.stage.filterArea = app.screen;
    app.stage.filters = [shock];
    groups.bg.visible = true;
  }
}
export function hideVfx() {
  current = null;
  worldTarget = 0;
  for (const S of scenes) S.target = 0;
}
// для проверок: сколько частиц живёт сейчас
export function vfxStats() {
  let live = 0, pool = 0;
  for (const S of scenes) for (const E of S.emitters) { pool += E.pool.length; live += E.pool.filter(i => !i.dead).length; }
  return { scenes: scenes.map(S => S.key), live, pool, fps: app ? Math.round(app.ticker.FPS) : 0, quality };
}
