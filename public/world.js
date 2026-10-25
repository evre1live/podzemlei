// «Под Землёй» — живой фон: подземная арена по умолчанию и своя живописная сцена для каждой локации.
// Сцена — картинка во весь экран (/loc/v1). Поверх неё рисуются живые эффекты на видеокарте (vfx.js, PixiJS):
// пламя, дым, искры, вода, лава, туман, молнии. Если WebGL недоступен или включён «неподвижный фон» —
// остаются простые CSS-огоньки ниже (двигаются только transform и opacity).

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pct = (v, of) => +(v / of * 100).toFixed(3);
const at = (x, y) => `left:${pct(x, 1600)}%;top:${pct(y, 900)}%`;

function fireflies(r, n, colors, area = [0, 1600, 120, 860]) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[1] - area[0]), y = area[2] + r() * (area[3] - area[2]);
    s += `<i class="w-ff" style="${at(x, y)};--c:${colors[i % colors.length]};--dx:${((r() - 0.5) * 140).toFixed(0)}px;--dy:${((r() - 0.5) * 90).toFixed(0)}px;--t:${(6 + r() * 8).toFixed(1)}s;--b:${(1.6 + r() * 2.4).toFixed(1)}s;animation-delay:-${(r() * 10).toFixed(1)}s,-${(r() * 4).toFixed(1)}s"></i>`;
  }
  return s;
}
function risers(r, n, colors, { size = [3, 6], speed = [12, 22], cls = 'w-rise' } = {}) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<i class="${cls}" style="left:${(r() * 100).toFixed(2)}%;--c:${colors[i % colors.length]};--s:${(size[0] + r() * (size[1] - size[0])).toFixed(1)}px;--t:${(speed[0] + r() * (speed[1] - speed[0])).toFixed(1)}s;--sx:${((r() - 0.5) * 80).toFixed(0)}px;animation-delay:-${(r() * 20).toFixed(1)}s"></i>`;
  }
  return s;
}
function pulses(list) {
  return list.map(([x, y, rad, c, t, d = 0]) => `<i class="w-pulse" style="${at(x - rad, y - rad)};width:${pct(rad * 2, 1600)}%;height:${pct(rad * 2, 900)}%;--c:${c};--t:${t}s;animation-delay:-${d}s"></i>`).join('');
}
function sparkles(r, n, area, c = '#fff8d6') {
  let s = '';
  for (let i = 0; i < n; i++) s += `<i class="w-spark" style="${at(area[0] + r() * (area[1] - area[0]), area[2] + r() * (area[3] - area[2]))};--c:${c};--s:${(8 + r() * 16).toFixed(0)}px;--t:${(1.8 + r() * 2.6).toFixed(1)}s;animation-delay:-${(r() * 4).toFixed(1)}s"></i>`;
  return s;
}
function steam(r, list) {
  return list.map(([x, y]) => Array.from({ length: 4 }, (_, i) => `<i class="w-steam" style="${at(x, y)};--t:${(4 + r() * 3).toFixed(1)}s;--sx:${((r() - 0.5) * 60).toFixed(0)}px;animation-delay:-${(i * 1.4 + r()).toFixed(1)}s"></i>`).join('')).join('');
}
function fallers(r, n, cls, { size = [3, 7], speed = [6, 14], c = '#fff' } = {}) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<i class="${cls}" style="left:${(r() * 100).toFixed(2)}%;--s:${(size[0] + r() * (size[1] - size[0])).toFixed(1)}px;--t:${(speed[0] + r() * (speed[1] - speed[0])).toFixed(2)}s;--sx:${((r() - 0.5) * (cls === 'w-flake' ? 120 : 40)).toFixed(0)}px;--c:${c};animation-delay:-${(r() * speed[1]).toFixed(2)}s"></i>`;
  return out;
}
function snow(r) { return fallers(r, 40, 'w-flake', { size: [3, 8], speed: [7, 15] }); }
function lightning(x) {
  return `<div class="w-flash"></div><svg class="w-bolt" style="${at(x - 60, 0)}" viewBox="0 0 120 420"><path d="M70 0 L36 170 L68 170 L28 420 L100 140 L66 140 L96 0Z" fill="#fff8c8" stroke="#ffffff" stroke-width="3"/></svg>`;
}

// ───────────── сцены ─────────────
// локации с живописным фоном: картинка во весь экран, поверх — только лёгкие анимации
const IMG_SCENES = new Set(['loc_tavern', 'loc_dungeon', 'loc_glade', 'loc_forge', 'loc_ice', 'loc_graveyard', 'loc_sky', 'loc_cove', 'loc_library', 'loc_oasis', 'loc_flooded', 'loc_grove', 'loc_koschei']);
function sceneOf(key) {
  const r = mulberry(hash(key));
  const S = { img: `/loc/v1/${IMG_SCENES.has(key) ? key : 'default'}.webp`, fx: '' };
  const fx = (...a) => { S.fx += a.join(''); };
  switch (key) {
    // ───── живописные локации: картинка-фон и лёгкая анимация поверх (огонь, светлячки, снег, молнии) ─────
    case 'loc_tavern':
      fx(pulses([[349, 143, 170, 'rgba(255,150,60,.5)', 1.7, 0], [349, 143, 90, 'rgba(255,210,120,.55)', 1.1, 0.4], [134, 134, 60, 'rgba(255,214,140,.5)', 2.2, 0.3], [1550, 124, 60, 'rgba(255,214,140,.5)', 2.6, 1], [38, 402, 45, 'rgba(255,214,140,.5)', 1.6, 0.2], [67, 660, 45, 'rgba(255,214,140,.5)', 1.9, 0.7], [139, 670, 40, 'rgba(255,214,140,.5)', 1.4, 1.1], [498, 57, 40, 'rgba(255,214,140,.5)', 2.1, 0.5], [1153, 38, 45, 'rgba(255,214,140,.5)', 1.8, 0.9], [1325, 851, 45, 'rgba(255,214,140,.5)', 2.3, 0.2]]),
        risers(r, 12, ['rgba(255,214,140,.55)', 'rgba(255,170,90,.5)'], { size: [2, 4], speed: [16, 28] }));
      break;
    case 'loc_dungeon':
      fx(pulses([[187, 158, 80, 'rgba(255,170,70,.55)', 1.3, 0], [57, 253, 70, 'rgba(255,170,70,.55)', 1.6, 0.5], [627, 24, 70, 'rgba(255,170,70,.55)', 1.4, 0.2], [943, 24, 70, 'rgba(255,170,70,.55)', 1.2, 0.8], [1335, 57, 75, 'rgba(255,170,70,.55)', 1.5, 0.3], [1531, 277, 70, 'rgba(255,170,70,.55)', 1.7, 1], [182, 612, 75, 'rgba(255,170,70,.55)', 1.4, 0.6], [584, 756, 70, 'rgba(255,170,70,.55)', 1.3, 0.1], [1010, 756, 70, 'rgba(255,170,70,.55)', 1.6, 0.9], [1407, 574, 75, 'rgba(255,170,70,.55)', 1.2, 0.4], [91, 306, 110, 'rgba(120,255,90,.45)', 2.4, 0], [57, 430, 100, 'rgba(120,255,90,.4)', 2.8, 1.2]]),
        sparkles(r, 10, [1359, 1600, 0, 163], '#ffe9a0'), sparkles(r, 8, [0, 306, 650, 900], '#ffe9a0'),
        risers(r, 10, ['rgba(255,190,110,.5)', 'rgba(150,255,120,.35)'], { size: [2, 4], speed: [14, 24] }));
      break;
    case 'loc_glade':
      fx(pulses([[57, 230, 110, 'rgba(110,170,255,.45)', 2.6, 0], [105, 564, 110, 'rgba(130,150,255,.45)', 3, 1], [1048, 38, 90, 'rgba(120,170,255,.4)', 2.4, 0.6], [1435, 77, 80, 'rgba(130,190,255,.4)', 2.8, 1.4], [622, 727, 80, 'rgba(140,170,255,.4)', 2.5, 0.3], [182, 392, 55, 'rgba(255,214,120,.55)', 1.9, 0.2], [641, 57, 55, 'rgba(255,214,120,.55)', 2.2, 0.8], [943, 57, 55, 'rgba(255,214,120,.55)', 2.1, 0.4], [536, 746, 50, 'rgba(255,214,120,.5)', 1.8, 1], [1048, 746, 50, 'rgba(255,214,120,.5)', 2.3, 0.5]]),
        fireflies(r, 34, ['#fff36b', '#d6f59a', '#a6e8ff']), sparkles(r, 12, [1407, 1600, 172, 622], '#c8f4ff'));
      break;
    case 'loc_forge':
      fx(pulses([[53, 536, 230, 'rgba(255,110,30,.5)', 2.8, 0], [1550, 536, 230, 'rgba(255,110,30,.5)', 3.2, 1.2], [287, 163, 140, 'rgba(255,140,40,.55)', 2.2, 0.4], [191, 880, 200, 'rgba(255,110,30,.45)', 3, 0.8], [1407, 880, 200, 'rgba(255,110,30,.45)', 2.6, 1.6], [646, 153, 55, 'rgba(255,170,70,.55)', 1.3, 0.2], [957, 153, 55, 'rgba(255,170,70,.55)', 1.5, 0.7], [153, 612, 55, 'rgba(255,170,70,.55)', 1.4, 0.5], [1431, 612, 55, 'rgba(255,170,70,.55)', 1.2, 0.9], [632, 684, 55, 'rgba(255,170,70,.55)', 1.6, 0.1], [967, 684, 55, 'rgba(255,170,70,.55)', 1.3, 0.6], [1392, 158, 70, 'rgba(255,170,60,.5)', 1.1, 0.3]]),
        sparkles(r, 10, [1321, 1493, 86, 210], '#ffd27a'),
        risers(r, 24, ['#ffb347', '#ff8a3d', '#ffd27a'], { size: [2, 4], speed: [8, 15] }));
      break;
    case 'loc_ice':
      fx(pulses([[96, 287, 70, 'rgba(255,214,120,.55)', 1.6, 0], [321, 172, 65, 'rgba(255,214,120,.55)', 1.9, 0.5], [660, 81, 65, 'rgba(255,214,120,.55)', 1.4, 0.2], [900, 81, 65, 'rgba(255,214,120,.55)', 1.7, 0.8], [1344, 67, 65, 'rgba(255,214,120,.55)', 1.5, 0.3], [1531, 72, 60, 'rgba(255,214,120,.5)', 1.8, 1], [660, 689, 70, 'rgba(255,214,120,.55)', 1.6, 0.6], [938, 689, 70, 'rgba(255,214,120,.55)', 1.3, 0.1], [1435, 660, 120, 'rgba(150,210,255,.4)', 3.2, 0], [239, 593, 110, 'rgba(150,210,255,.35)', 2.8, 1.3]]),
        sparkles(r, 14, [239, 1388, 239, 670], '#e8f6ff'), snow(r));
      break;
    case 'loc_graveyard':
      fx(pulses([[38, 172, 70, 'rgba(90,255,170,.5)', 1.8, 0], [718, 105, 65, 'rgba(90,255,170,.5)', 1.5, 0.4], [876, 105, 65, 'rgba(90,255,170,.5)', 1.7, 0.9], [1569, 38, 60, 'rgba(90,255,170,.45)', 2, 0.2], [1163, 48, 55, 'rgba(90,255,170,.45)', 1.9, 0.7], [526, 660, 65, 'rgba(90,255,170,.5)', 1.6, 0.3], [1100, 660, 65, 'rgba(90,255,170,.5)', 1.4, 1], [1550, 478, 60, 'rgba(90,255,170,.45)', 1.8, 0.6], [1196, 182, 45, 'rgba(255,214,140,.5)', 1.5, 0.2], [507, 143, 45, 'rgba(255,214,140,.5)', 1.7, 0.8], [1411, 736, 45, 'rgba(255,214,140,.5)', 1.3, 0.4], [316, 746, 45, 'rgba(255,214,140,.5)', 1.9, 1.1]]),
        steam(r, [[120, 860], [800, 880], [1480, 860]]), fireflies(r, 14, ['#b9ffd9', '#e3b3ff', '#fff3b0'], [80, 1520, 200, 820]));
      break;
    case 'loc_sky':
      fx(lightning(260), `<div class="w-late">${lightning(1380)}</div>`, pulses([[86, 545, 110, 'rgba(140,170,255,.5)', 2.4, 0], [1512, 536, 110, 'rgba(140,170,255,.5)', 2.8, 1], [258, 335, 90, 'rgba(140,170,255,.4)', 2.2, 0.5], [1340, 316, 90, 'rgba(140,170,255,.4)', 2.6, 1.3], [450, 583, 60, 'rgba(255,214,120,.55)', 1.6, 0.2], [1153, 583, 60, 'rgba(255,214,120,.55)', 1.8, 0.7], [598, 727, 60, 'rgba(255,214,120,.55)', 1.4, 0.4], [943, 727, 60, 'rgba(255,214,120,.55)', 1.7, 0.9]]),
        risers(r, 14, ['rgba(220,230,255,.6)', 'rgba(180,200,255,.5)'], { size: [2, 4], speed: [14, 26] }));
      break;
    case 'loc_cove':
      fx(sparkles(r, 16, [0, 411, 650, 900], '#e6fbff'), sparkles(r, 14, [1416, 1600, 77, 727], '#e6fbff'), sparkles(r, 8, [1100, 1435, 0, 153], '#e6fbff'),
        pulses([[220, 91, 55, 'rgba(255,214,120,.55)', 1.8, 0], [866, 316, 50, 'rgba(255,214,120,.5)', 2.1, 0.6], [1139, 727, 55, 'rgba(255,214,120,.55)', 1.6, 0.3], [450, 842, 50, 'rgba(255,214,120,.5)', 1.9, 0.9]]),
        risers(r, 8, ['rgba(255,240,200,.5)'], { size: [2, 4], speed: [18, 30] }));
      break;
    case 'loc_library':
      fx(pulses([[287, 67, 130, 'rgba(190,110,255,.5)', 2.4, 0], [86, 220, 80, 'rgba(190,110,255,.45)', 2, 0.7], [1531, 268, 80, 'rgba(190,110,255,.45)', 2.2, 1.2], [603, 684, 70, 'rgba(200,120,255,.55)', 1.8, 0.3], [1005, 684, 70, 'rgba(200,120,255,.55)', 2, 0.9], [120, 67, 45, 'rgba(255,214,140,.5)', 1.5, 0.2], [1440, 239, 45, 'rgba(255,214,140,.5)', 1.8, 0.6], [1464, 497, 45, 'rgba(255,214,140,.5)', 1.4, 1], [254, 713, 45, 'rgba(255,214,140,.5)', 1.7, 0.4], [1397, 736, 45, 'rgba(255,214,140,.5)', 1.6, 0.8]]),
        sparkles(r, 14, [1378, 1600, 0, 191], '#d9c8ff'), sparkles(r, 6, [172, 402, 0, 143], '#e9d8ff'),
        risers(r, 14, ['rgba(200,140,255,.6)', 'rgba(255,230,160,.45)'], { size: [2, 4], speed: [14, 24] }));
      break;
    case 'loc_oasis':
      fx(sparkles(r, 16, [1321, 1600, 258, 497], '#e6fbff'), sparkles(r, 6, [1435, 1569, 38, 268], '#e6fbff'),
        pulses([[105, 660, 110, 'rgba(190,110,255,.5)', 2.4, 0], [785, 38, 90, 'rgba(255,190,90,.5)', 2.2, 0.4], [660, 143, 50, 'rgba(255,214,120,.55)', 1.6, 0.2], [919, 143, 50, 'rgba(255,214,120,.55)', 1.9, 0.7], [1359, 430, 45, 'rgba(255,214,120,.5)', 1.7, 1], [1177, 861, 45, 'rgba(255,214,120,.5)', 2.1, 0.5]]),
        risers(r, 12, ['rgba(255,230,170,.5)', 'rgba(200,140,255,.45)'], { size: [2, 4], speed: [16, 28] }));
      break;
    case 'loc_flooded':
      fx(pulses([[397, 113, 55, 'rgba(255,214,140,.5)', 1.6, 0.00], [469, 84, 55, 'rgba(255,214,140,.5)', 1.9, 0.37], [555, 84, 55, 'rgba(255,214,140,.5)', 2.2, 0.74], [608, 113, 55, 'rgba(255,214,140,.5)', 2.5, 1.11], [273, 244, 55, 'rgba(255,214,140,.5)', 1.6, 0.28], [732, 368, 55, 'rgba(255,214,140,.5)', 1.9, 0.65], [799, 435, 55, 'rgba(255,214,140,.5)', 2.2, 1.02], [1512, 251, 55, 'rgba(255,214,140,.5)', 2.5, 0.19], [1426, 421, 55, 'rgba(255,214,140,.5)', 1.6, 0.56]]), sparkles(r, 24, [0, 1600, 580, 900], '#fff3d6'), risers(r, 8, ['rgba(220,245,255,.45)'], { size: [2, 3], speed: [18, 30] }));
      break;
    case 'loc_grove':
      fx(pulses([[962, 565, 90, 'rgba(255,150,60,.55)', 1.4, 0], [962, 565, 40, 'rgba(255,220,140,.6)', 0.9, 0.3], [651, 105, 200, 'rgba(80,230,210,.3)', 3, 0], [957, 258, 140, 'rgba(80,230,210,.3)', 3.4, 0.5], [1282, 191, 200, 'rgba(255,190,90,.3)', 3.2, 0.3], [1493, 622, 80, 'rgba(255,200,110,.45)', 2.2, 0.7]]),
        fireflies(r, 18, ['#8dffe8', '#ffe08a', '#3fe0d0'], [100, 1500, 150, 760]), risers(r, 14, ['rgba(141,255,232,.55)', 'rgba(255,210,122,.5)'], { size: [2, 4], speed: [16, 28] }));
      break;
    case 'loc_koschei':
      fx(pulses([[526, 256, 60, 'rgba(110,255,170,.45)', 1.7, 0.00], [713, 402, 60, 'rgba(110,255,170,.45)', 2.0, 0.37], [876, 251, 60, 'rgba(110,255,170,.45)', 2.3, 0.74], [1134, 298, 60, 'rgba(110,255,170,.45)', 2.6, 1.11], [1273, 375, 60, 'rgba(110,255,170,.45)', 1.7, 0.28], [1488, 103, 60, 'rgba(110,255,170,.45)', 2.0, 0.65], [603, 536, 60, 'rgba(110,255,170,.45)', 2.3, 1.02], [1421, 493, 60, 'rgba(110,255,170,.45)', 2.6, 0.19]]), pulses([[1005, 394, 80, 'rgba(255,215,120,.5)', 2.4, 0]]),
        sparkles(r, 14, [0, 440, 535, 900], '#fff3c0'), sparkles(r, 14, [1150, 1600, 575, 900], '#fff3c0'), risers(r, 10, ['rgba(120,255,180,.45)'], { size: [2, 4], speed: [14, 24] }));
      break;
    default:
      // основной стол до первой локации — подземная арена с факелами
      fx(pulses([[182, 139, 85, 'rgba(255,160,60,.55)', 1.3, 0], [43, 263, 80, 'rgba(255,160,60,.55)', 1.6, 0.5], [632, 33, 80, 'rgba(255,160,60,.55)', 1.4, 0.2], [952, 33, 80, 'rgba(255,160,60,.55)', 1.2, 0.8], [1541, 268, 80, 'rgba(255,160,60,.55)', 1.5, 0.3], [129, 641, 90, 'rgba(255,160,60,.55)', 1.7, 1], [1478, 636, 90, 'rgba(255,160,60,.55)', 1.3, 0.6]]), pulses([[182, 139, 38, 'rgba(255,220,140,.6)', 0.91, 0], [43, 263, 36, 'rgba(255,220,140,.6)', 1.12, 0.5], [632, 33, 36, 'rgba(255,220,140,.6)', 0.98, 0.2], [952, 33, 36, 'rgba(255,220,140,.6)', 0.84, 0.8], [1541, 268, 36, 'rgba(255,220,140,.6)', 1.05, 0.3], [129, 641, 40, 'rgba(255,220,140,.6)', 1.19, 1], [1478, 636, 40, 'rgba(255,220,140,.6)', 0.91, 0.6]]),
        risers(r, 16, ['#ffb347', '#ff8a3d', 'rgba(255,214,140,.6)'], { size: [2, 4], speed: [10, 20] }));
  }
  return S;
}

export function worldHTML(key) {
  const S = sceneOf(key || 'default');
  return `<div class="w-box"><div class="w-img" style="background-image:url('${S.img}')"></div><div class="w-fx">${S.fx}</div></div><div class="w-vignette"></div>`;
}

// Живые эффекты подгружаются, только когда нужны: библиотека весит ~230 КБ
let vfx = null, vfxKey = null;
// фон откликается на события: бой окрашивает края, победа и смена хода вспыхивают светом
export function worldMood(kind, o) {
  document.getElementById('world')?.classList.toggle('mood-combat', kind === 'combat' ? true : kind === 'calm' ? false : document.getElementById('world')?.classList.contains('mood-combat'));
  vfx?.then(m => m.vfxMood?.(kind, o)).catch(() => {});
}
function syncVfx(host) {
  const k = current;
  if (!k || host.classList.contains('still')) { if (vfx && !k) vfx.then(m => m.hideVfx()); return; }
  if (vfxKey === k && vfx) return;
  vfxKey = k;
  vfx ??= import('/vfx.js');
  vfx.then(m => current === k && m.showVfx(host, k, sceneOf(k).img)).catch(e => console.warn('Живые эффекты недоступны:', e?.message || e));
}
let watching = false;
function watchStill(host) {
  if (watching) return;
  watching = true;
  // включили живой фон в настройках — эффекты появляются без перезагрузки
  new MutationObserver(() => { if (!host.classList.contains('still')) { vfxKey = null; syncVfx(host); } }).observe(host, { attributes: true, attributeFilter: ['class'] });
}

// лёгкий параллакс: фон чуть смещается за мышью, будто смотришь в глубину пещеры
let parRaf = 0;
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || parRaf) return;
  parRaf = requestAnimationFrame(() => {
    parRaf = 0;
    const h = document.getElementById('world');
    if (!h || h.classList.contains('still')) return;
    h.style.setProperty('--wx', ((0.5 - e.clientX / innerWidth) * 18).toFixed(1) + 'px');
    h.style.setProperty('--wy', ((0.5 - e.clientY / innerHeight) * 11).toFixed(1) + 'px');
  });
}, { passive: true });

// Плавная смена сцены: новая проявляется поверх старой
let current = null;
export function setWorld(host, key) {
  if (!host) return;
  const k = key === null ? null : key || 'default';
  if (k === current) return;
  current = k;
  watchStill(host);
  const old = [...host.querySelectorAll(':scope > .world')];
  const drop = () => old.forEach(o => { o.classList.remove('on'); setTimeout(() => o.remove(), 1400); });
  document.body.classList.toggle('has-world', !!k);
  if (!k) { vfxKey = null; syncVfx(host); return drop(); }
  const el = document.createElement('div');
  el.className = 'world';
  el.dataset.w = k;
  el.innerHTML = worldHTML(k);
  host.querySelector(':scope > .w-vfx') ? host.insertBefore(el, host.querySelector(':scope > .w-vfx')) : host.append(el);
  // новая сцена проявляется, когда картинка уже загружена — без вспышки пустого фона; старая уходит следом
  let shown = false;
  const show = () => {
    if (shown || current !== k) return;
    shown = true;
    // в фоновой вкладке кадры не рисуются — тогда выручает таймер
    let on = false;
    const reveal = () => { if (on || current !== k) return; on = true; el.classList.add('on'); setTimeout(drop, 900); syncVfx(host); };
    requestAnimationFrame(() => requestAnimationFrame(reveal));
    setTimeout(reveal, 120);
  };
  const im = new Image();
  im.onload = show; im.onerror = show;
  im.src = sceneOf(k).img;
  setTimeout(show, 2500);
}
