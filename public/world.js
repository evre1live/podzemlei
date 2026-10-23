// «Под Землёй» — живой фон: сказочная пещера по умолчанию и своя сцена для каждой локации.
// Неподвижная часть рисуется одним SVG (раз и навсегда), движение — отдельными слоями,
// которые анимируются только через transform и opacity: так браузер двигает их на видеокарте.

const INK = '#120c1c';
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pct = (v, of) => +(v / of * 100).toFixed(3);
const svgUrl = svg => `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;

// ───────────── неподвижные детали (SVG 1600×900) ─────────────
function ceiling(r, c, base = 40, depth = 150, n = 30) {
  let d = `M0 0 H1600 V${base}`;
  const w = 1600 / n;
  for (let i = n - 1; i >= 0; i--) {
    const x0 = (i + 1) * w, x1 = i * w, xm = x1 + w * (0.3 + r() * 0.4);
    const b = base + r() * 30, tip = b + 20 + r() * depth * (r() < 0.25 ? 1.6 : 0.8);
    d += ` L${x0.toFixed(0)} ${b.toFixed(0)} L${xm.toFixed(0)} ${tip.toFixed(0)} L${x1.toFixed(0)} ${b.toFixed(0)}`;
  }
  return `<path d="${d} Z" fill="${c}"/>`;
}
function ridge(r, c, y, amp, step = 80, opacity = 1) {
  let d = `M0 900 L0 ${y}`;
  for (let x = 0; x <= 1600; x += step) d += ` Q${x + step / 2} ${(y - amp * (0.3 + r())).toFixed(0)} ${x + step} ${(y + (r() - 0.5) * amp * 0.6).toFixed(0)}`;
  return `<path d="${d} L1600 900 Z" fill="${c}" opacity="${opacity}"/>`;
}
function sideWalls(c, w = 220) {
  return `<path d="M0 0 H${w} C${w * 0.7} 200 ${w * 1.1} 420 ${w * 0.6} 600 C${w * 0.3} 720 ${w * 0.7} 820 ${w * 0.5} 900 H0Z" fill="${c}"/>`
    + `<path d="M1600 0 H${1600 - w} C${1600 - w * 0.7} 220 ${1600 - w * 1.1} 400 ${1600 - w * 0.6} 620 C${1600 - w * 0.3} 740 ${1600 - w * 0.7} 820 ${1600 - w * 0.5} 900 H1600Z" fill="${c}"/>`;
}
function glow(id, x, y, r, c, o = 0.5) {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/>`;
}
function crystal(x, y, h, w, c, tilt = 0) {
  return `<g transform="rotate(${tilt} ${x} ${y})"><path d="M${x - w / 2} ${y} L${x - w / 2} ${y - h * 0.78} L${x} ${y - h} L${x + w / 2} ${y - h * 0.78} L${x + w / 2} ${y}Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    + `<path d="M${x} ${y - h} L${x} ${y} L${x + w / 2} ${y} L${x + w / 2} ${y - h * 0.78}Z" fill="#000" opacity=".22"/><path d="M${x - w / 4} ${y - h * 0.72} V${y - h * 0.15}" stroke="#fff" stroke-width="${Math.max(2, w / 9)}" stroke-linecap="round" opacity=".55"/></g>`;
}
function crystals(r, cx, cy, colors, n = 6, scale = 1) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const h = (60 + r() * 150) * scale, w = h * (0.25 + r() * 0.12);
    s += crystal(cx + (r() - 0.5) * 180 * scale, cy + r() * 16, h, w, colors[i % colors.length], (r() - 0.5) * 40);
  }
  return s;
}
function mushroom(x, y, h, capW, c, spots = '#fff') {
  return `<path d="M${x - capW * 0.12} ${y} Q${x - capW * 0.16} ${y - h * 0.5} ${x - capW * 0.1} ${y - h} H${x + capW * 0.1} Q${x + capW * 0.16} ${y - h * 0.5} ${x + capW * 0.12} ${y}Z" fill="#f1e4c8" stroke="${INK}" stroke-width="4"/>`
    + `<path d="M${x - capW / 2} ${y - h} C${x - capW / 2} ${y - h - capW * 0.7} ${x + capW / 2} ${y - h - capW * 0.7} ${x + capW / 2} ${y - h} Q${x} ${y - h + capW * 0.12} ${x - capW / 2} ${y - h}Z" fill="${c}" stroke="${INK}" stroke-width="4"/>`
    + `<g fill="${spots}" opacity=".85"><circle cx="${x - capW * 0.2}" cy="${y - h - capW * 0.22}" r="${capW * 0.06}"/><circle cx="${x + capW * 0.12}" cy="${y - h - capW * 0.32}" r="${capW * 0.08}"/><circle cx="${x + capW * 0.3}" cy="${y - h - capW * 0.12}" r="${capW * 0.05}"/></g>`;
}
function pillar(x, top, bottom, w, c) {
  return `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${bottom - top}" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="${x - w * 0.7}" y="${top - 26}" width="${w * 1.4}" height="28" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="${x - w * 0.7}" y="${bottom - 4}" width="${w * 1.4}" height="24" fill="${c}" stroke="${INK}" stroke-width="4"/>`
    + `<path d="M${x - w * 0.22} ${top + 6} V${bottom - 8} M${x + w * 0.22} ${top + 6} V${bottom - 8}" stroke="#000" stroke-opacity=".18" stroke-width="5"/>`;
}
function stall(x, y, w, h, awning) {
  let stripes = '';
  for (let i = 0; i < 5; i++) stripes += `<path d="M${x - w / 2 + i * w / 5 + w / 10} ${y - h - 50} L${x - w / 2 + i * w / 5 + (i < 2 ? 0 : w / 5)} ${y - h}" stroke="#fff" stroke-width="14" opacity=".55"/>`;
  return `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="#5a3420" stroke="${INK}" stroke-width="4"/><path d="M${x - w / 2 - 16} ${y - h} L${x - w / 2 + 14} ${y - h - 50} H${x + w / 2 - 14} L${x + w / 2 + 16} ${y - h}Z" fill="${awning}" stroke="${INK}" stroke-width="4"/>${stripes}`;
}
function goldPile(x, y, w, h) {
  let coins = '';
  const r = mulberry(x * 7 + y);
  for (let i = 0; i < 14; i++) coins += `<ellipse cx="${(x + (r() - 0.5) * w * 0.8).toFixed(0)}" cy="${(y - r() * h * 0.7).toFixed(0)}" rx="16" ry="7" fill="#ffe08a" stroke="${INK}" stroke-width="2.5"/>`;
  return `<path d="M${x - w / 2} ${y} Q${x - w / 4} ${y - h} ${x} ${y - h} Q${x + w / 4} ${y - h} ${x + w / 2} ${y}Z" fill="#f2c14e" stroke="${INK}" stroke-width="4"/>${coins}`;
}

// ───────────── движущиеся слои (HTML) ─────────────
const at = (x, y) => `left:${pct(x, 1600)}%;top:${pct(y, 900)}%`;
function waveTile(fill, crest, h = 60, amp = 14) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${h}" viewBox="0 0 400 ${h}"><path d="M0 ${amp} Q50 0 100 ${amp} T200 ${amp} T300 ${amp} T400 ${amp} V${h} H0Z" fill="${fill}"/><path d="M0 ${amp} Q50 0 100 ${amp} T200 ${amp} T300 ${amp} T400 ${amp}" fill="none" stroke="${crest}" stroke-width="3" stroke-opacity=".8"/></svg>`);
}
function river(y, h, colors, speed = [14, 9], opts = {}) {
  const [back, front, crest] = colors;
  return `<div class="w-river${opts.cls ? ' ' + opts.cls : ''}" style="top:${pct(y, 900)}%;height:${pct(h, 900)}%">`
    + `<div class="w-wave" style="background-image:${waveTile(back, crest, 80, 18)};animation-duration:${speed[0]}s;background-size:400px 100%"></div>`
    + `<div class="w-wave w-wave2" style="background-image:${waveTile(front, crest, 80, 12)};animation-duration:${speed[1]}s;background-size:300px 100%;top:22%"></div>`
    + (opts.shine ? `<div class="w-shine"></div>` : '') + `</div>`;
}
function waterfall(x, top, bottom, w, c) {
  return `<div class="w-fall" style="${at(x - w / 2, top)};width:${pct(w, 1600)}%;height:${pct(bottom - top, 900)}%;--c:${c}"><i></i></div>`
    + `<div class="w-foam" style="${at(x - w, bottom - 30)};width:${pct(w * 2, 1600)}%;height:${pct(60, 900)}%"></div>`;
}
function fireflies(r, n, colors, area = [0, 1600, 120, 860]) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[1] - area[0]), y = area[2] + r() * (area[3] - area[2]);
    s += `<i class="w-ff" style="${at(x, y)};--c:${colors[i % colors.length]};--dx:${((r() - 0.5) * 140).toFixed(0)}px;--dy:${((r() - 0.5) * 90).toFixed(0)}px;--t:${(6 + r() * 8).toFixed(1)}s;--b:${(1.6 + r() * 2.4).toFixed(1)}s;animation-delay:-${(r() * 10).toFixed(1)}s,-${(r() * 4).toFixed(1)}s"></i>`;
  }
  return s;
}
// пылинки, споры, искры: колонна во всю высоту, точка внизу ползёт вверх
function risers(r, n, colors, { size = [3, 6], speed = [12, 22], cls = 'w-rise' } = {}) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<i class="${cls}" style="left:${(r() * 100).toFixed(2)}%;--c:${colors[i % colors.length]};--s:${(size[0] + r() * (size[1] - size[0])).toFixed(1)}px;--t:${(speed[0] + r() * (speed[1] - speed[0])).toFixed(1)}s;--sx:${((r() - 0.5) * 80).toFixed(0)}px;animation-delay:-${(r() * 20).toFixed(1)}s"></i>`;
  }
  return s;
}
function drips(r, n, c = '#bfeaff') {
  let s = '';
  for (let i = 0; i < n; i++) s += `<i class="w-drip" style="left:${(4 + r() * 92).toFixed(2)}%;top:${(4 + r() * 8).toFixed(1)}%;--c:${c};--t:${(3 + r() * 5).toFixed(1)}s;animation-delay:-${(r() * 8).toFixed(1)}s"></i>`;
  return s;
}
// лучи света рисуются в неподвижной картинке: так они ничего не стоят при анимации
let rayN = 0;
function rays(list) {
  return list.map(([x, y, w, ang, c, o]) => {
    const H = 1100, dx = Math.tan(ang * Math.PI / 180) * H, id = 'gray' + (rayN++);
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${o * 1.6}"/><stop offset=".8" stop-color="${c}" stop-opacity="0"/></linearGradient>`
      + `<path d="M${x - w * 0.12} ${y} L${x + w * 0.12} ${y} L${x + w / 2 - dx} ${y + H} L${x - w / 2 - dx} ${y + H}Z" fill="url(#${id})"/>`;
  }).join('');
}
function pulses(list) {
  return list.map(([x, y, rad, c, t, d = 0]) => `<i class="w-pulse" style="${at(x - rad, y - rad)};width:${pct(rad * 2, 1600)}%;height:${pct(rad * 2, 900)}%;--c:${c};--t:${t}s;animation-delay:-${d}s"></i>`).join('');
}
function sparkles(r, n, area, c = '#fff8d6') {
  let s = '';
  for (let i = 0; i < n; i++) s += `<i class="w-spark" style="${at(area[0] + r() * (area[1] - area[0]), area[2] + r() * (area[3] - area[2]))};--c:${c};--s:${(8 + r() * 16).toFixed(0)}px;--t:${(1.8 + r() * 2.6).toFixed(1)}s;animation-delay:-${(r() * 4).toFixed(1)}s"></i>`;
  return s;
}
function eyesL(r, n, c, area) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<i class="w-eyes" style="${at(area[0] + r() * (area[1] - area[0]), area[2] + r() * (area[3] - area[2]))};--c:${c};--s:${(0.7 + r() * 0.8).toFixed(2)};--t:${(4 + r() * 6).toFixed(1)}s;animation-delay:-${(r() * 8).toFixed(1)}s"></i>`;
  return s;
}
function lanterns(list) {
  return list.map(([x, y, len, c, t]) => `<div class="w-lantern" style="${at(x, y)};height:${pct(len + 60, 900)}%;--c:${c};--t:${t}s"><b style="height:${pct(len, len + 60)}%"></b><em></em></div>`).join('');
}
function stringLights(y, n, colors) {
  let fxs = '', d = '';
  for (let i = 0; i <= 80; i++) { const x = i * 20, yy = y + Math.sin(x / 1600 * Math.PI * 3) * 26; d += (i ? ' L' : 'M') + x + ' ' + yy.toFixed(1); }
  for (let i = 0; i < n; i++) {
    const x = 40 + i * (1520 / (n - 1)), yy = y + Math.sin(x / 1600 * Math.PI * 3) * 26 + 14;
    fxs += `<i class="w-bulb" style="${at(x, yy)};--c:${colors[i % colors.length]};animation-delay:-${(i % 4) * 0.6}s"></i>`;
  }
  return { svg: `<path d="${d}" fill="none" stroke="${INK}" stroke-width="4"/>`, fx: fxs };
}
function rings(x, y, c, n = 3) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<i class="w-ring" style="${at(x, y)};--c:${c};animation-delay:-${(i * 4 / n).toFixed(2)}s"></i>`;
  return s;
}
function steam(r, list) {
  return list.map(([x, y]) => Array.from({ length: 4 }, (_, i) => `<i class="w-steam" style="${at(x, y)};--t:${(4 + r() * 3).toFixed(1)}s;--sx:${((r() - 0.5) * 60).toFixed(0)}px;animation-delay:-${(i * 1.4 + r()).toFixed(1)}s"></i>`).join('')).join('');
}
// снег и дождь — много тонких колонн: каждая крошечный слой, а не огромный лист на весь экран
function fallers(r, n, cls, { size = [3, 7], speed = [6, 14], c = '#fff' } = {}) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<i class="${cls}" style="left:${(r() * 100).toFixed(2)}%;--s:${(size[0] + r() * (size[1] - size[0])).toFixed(1)}px;--t:${(speed[0] + r() * (speed[1] - speed[0])).toFixed(2)}s;--sx:${((r() - 0.5) * (cls === 'w-flake' ? 120 : 40)).toFixed(0)}px;--c:${c};animation-delay:-${(r() * speed[1]).toFixed(2)}s"></i>`;
  return out;
}
function snow(r) { return fallers(r, 40, 'w-flake', { size: [3, 8], speed: [7, 15] }); }
function rain(r, c = '#bcd4ff') { return fallers(r, 70, 'w-drop', { size: [16, 30], speed: [0.55, 1.05], c }); }
function lightning(x) {
  return `<div class="w-flash"></div><svg class="w-bolt" style="${at(x - 60, 0)}" viewBox="0 0 120 420"><path d="M70 0 L36 170 L68 170 L28 420 L100 140 L66 140 L96 0Z" fill="#fff8c8" stroke="#ffffff" stroke-width="3"/></svg>`;
}
function clouds(c) {
  const tile = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="220"><g fill="${c}"><ellipse cx="120" cy="110" rx="150" ry="60"/><ellipse cx="260" cy="80" rx="120" ry="60"/><ellipse cx="420" cy="120" rx="170" ry="62"/><ellipse cx="620" cy="90" rx="150" ry="60"/><ellipse cx="760" cy="120" rx="110" ry="50"/></g></svg>`);
  return `<div class="w-clouds" style="background-image:${tile}"></div>`;
}

// ───────────── сцены ─────────────
function sceneOf(key) {
  const r = mulberry(hash(key));
  const S = { sky: ['#1b1640', '#2a3a6a', '#173b4a'], svg: '', fx: '' };
  const sv = (...a) => { S.svg += a.join(''); };
  const fx = (...a) => { S.fx += a.join(''); };
  switch (key) {
    case 'loc_water':
      S.sky = ['#0e2a30', '#1d4a52', '#0b2328'];
      sv(glow('g1', 800, 300, 520, '#6fd6c8', 0.25), ceiling(r, '#0a1c20', 30, 110));
      for (let i = 0; i < 4; i++) { const x = 200 + i * 400; sv(`<path d="M${x - 150} 900 V420 Q${x - 150} 260 ${x} 260 Q${x + 150} 260 ${x + 150} 420 V900" fill="none" stroke="#123238" stroke-width="40"/><path d="M${x - 150} 900 V420 Q${x - 150} 260 ${x} 260 Q${x + 150} 260 ${x + 150} 420 V900" fill="none" stroke="#1f4a50" stroke-width="6" stroke-dasharray="30 18"/>`); }
      fx(river(600, 300, ['#1f6a72', '#2f8f96', '#bff7fa'], [16, 10], { shine: true }), `<div class="w-caustic"></div>`, drips(r, 12), risers(r, 10, ['rgba(191,247,250,.6)'], { size: [3, 7], speed: [10, 18] }));
      break;
    case 'loc_mushroom':
      S.sky = ['#0b2420', '#164a3a', '#0d2a20'];
      sv(glow('g1', 400, 600, 420, '#7dffb0', 0.22), glow('g2', 1250, 560, 380, '#c78bff', 0.2), ceiling(r, '#071612', 30, 120), ridge(r, '#0f2e24', 700, 80));
      sv(mushroom(260, 860, 260, 360, '#5fe39a', '#d9ffe6'), mushroom(560, 880, 150, 200, '#c78bff', '#f1e2ff'), mushroom(1320, 870, 300, 420, '#ff9ad9', '#ffe0f2'), mushroom(1060, 890, 120, 160, '#7fd1ff', '#e6f8ff'), mushroom(760, 900, 80, 110, '#ffd36b'));
      fx(pulses([[260, 560, 260, '#7dffb0', 4], [1320, 520, 300, '#ff9ad9', 5, 2], [560, 700, 160, '#c78bff', 3.4, 1]]), risers(r, 26, ['#a6f2b7', '#d9ffe6', '#c78bff'], { size: [3, 6], speed: [14, 26] }), fireflies(r, 8, ['#d9ffe6']));
      break;
    case 'loc_station': {
      S.sky = ['#22242f', '#2c3040', '#17181f'];
      let tiles = '';
      for (let x = 0; x < 1600; x += 64) tiles += `<path d="M${x} 80 V560" stroke="#ffffff" stroke-opacity=".05" stroke-width="2"/>`;
      for (let y = 80; y < 560; y += 40) tiles += `<path d="M0 ${y} H1600" stroke="#ffffff" stroke-opacity=".05" stroke-width="2"/>`;
      sv(tiles, `<rect x="0" y="430" width="1600" height="36" fill="#d2502f" opacity=".75"/><rect x="540" y="150" width="520" height="110" rx="14" fill="#20314f" stroke="${INK}" stroke-width="6"/><text x="800" y="225" text-anchor="middle" font-family="Underdog, sans-serif" font-size="60" fill="#f6e7c1">Глубинная</text>`,
        `<rect x="0" y="560" width="1600" height="60" fill="#7a7486" stroke="${INK}" stroke-width="5"/><rect x="0" y="560" width="1600" height="12" fill="#f5b83d" opacity=".7"/><rect x="0" y="620" width="1600" height="280" fill="#0f0e14"/><path d="M0 720 H1600 M0 800 H1600" stroke="#9aa3ad" stroke-width="10"/>`);
      for (let x = 30; x < 1600; x += 140) sv(`<rect x="${x}" y="700" width="40" height="120" fill="#3a2a20"/>`);
      for (const x of [200, 600, 1000, 1400]) sv(`<path d="M${x} 0 V60" stroke="${INK}" stroke-width="6"/><rect x="${x - 40}" y="60" width="80" height="22" rx="6" fill="#fff3b0" stroke="${INK}" stroke-width="4"/>`);
      fx(pulses([[200, 90, 160, '#fff3b0', 2.6], [600, 90, 160, '#fff3b0', 3.2, 1], [1000, 90, 160, '#fff3b0', 0.4, 0], [1400, 90, 160, '#fff3b0', 3, 2]]), `<i class="w-train" style="top:${pct(600, 900)}%;height:${pct(200, 900)}%"></i>`, risers(r, 12, ['rgba(185,166,255,.45)'], { size: [6, 12], speed: [20, 34] }));
      break;
    }
    case 'loc_vault':
      S.sky = ['#2a1c08', '#4a3510', '#1e1406'];
      sv(glow('g1', 800, 420, 560, '#ffd56a', 0.3), ceiling(r, '#1a1004', 30, 110));
      sv(`<circle cx="800" cy="430" r="300" fill="#8b8494" stroke="${INK}" stroke-width="10"/><circle cx="800" cy="430" r="240" fill="#6f6878" stroke="${INK}" stroke-width="6"/>`);
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; sv(`<circle cx="${(800 + Math.cos(a) * 272).toFixed(0)}" cy="${(430 + Math.sin(a) * 272).toFixed(0)}" r="14" fill="#3d3a42"/>`); }
      sv(`<g class="w-static-wheel"><circle cx="800" cy="430" r="60" fill="#f2c14e" stroke="${INK}" stroke-width="6"/><path d="M800 300 V560 M670 430 H930 M708 338 L892 522 M892 338 L708 522" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><path d="M800 300 V560 M670 430 H930 M708 338 L892 522 M892 338 L708 522" stroke="#c9ced8" stroke-width="10" stroke-linecap="round"/></g>`,
        goldPile(200, 900, 420, 220), goldPile(1400, 900, 460, 240), goldPile(820, 920, 300, 110));
      fx(sparkles(r, 22, [80, 1520, 560, 880]), risers(r, 10, ['#ffe08a'], { size: [2, 4], speed: [14, 24] })); sv(rays([[800, -40, 260, 0, '#fff0b0', 0.22]]));
      break;
    case 'loc_boiler':
      S.sky = ['#3a0e06', '#6a1c0c', '#240806'];
      sv(glow('g1', 800, 560, 620, '#ff6a2a', 0.35), ceiling(r, '#1e0604', 30, 90));
      for (const [y, h] of [[180, 40], [300, 34], [650, 44]]) sv(`<rect x="0" y="${y}" width="1600" height="${h}" fill="#7a3a1e" stroke="${INK}" stroke-width="5"/><rect x="0" y="${y + 4}" width="1600" height="6" fill="#fff" opacity=".12"/>`);
      for (const x of [150, 470, 1130, 1450]) sv(`<rect x="${x - 20}" y="0" width="40" height="900" fill="#6a3018" stroke="${INK}" stroke-width="5"/>`);
      for (const [x, w] of [[330, 260], [1270, 300]]) sv(`<rect x="${x - w / 2}" y="420" width="${w}" height="430" rx="${w / 2.4}" fill="#b0402a" stroke="${INK}" stroke-width="8"/><circle cx="${x}" cy="520" r="44" fill="#efe6d4" stroke="${INK}" stroke-width="6"/><path d="M${x} 520 l24 -18" stroke="#d2502f" stroke-width="7" stroke-linecap="round"/><rect x="${x - 70}" y="700" width="140" height="80" rx="10" fill="#2a0c06" stroke="${INK}" stroke-width="6"/>`);
      fx(pulses([[330, 740, 120, '#ffb347', 1.2], [1270, 740, 130, '#ffb347', 1.5, 0.5], [800, 600, 500, '#ff6a2a', 4]]), steam(r, [[440, 300], [1150, 180], [700, 650], [1500, 300]]), risers(r, 30, ['#ffb347', '#ffd27a', '#ff8a3d'], { size: [2, 5], speed: [6, 12], cls: 'w-rise w-ember' }));
      break;
    case 'loc_market':
      S.sky = ['#2a1230', '#4a2050', '#1a0c20'];
      sv(glow('g1', 800, 500, 620, '#ff9ad9', 0.18), ceiling(r, '#140818', 24, 90));
      sv(stall(240, 820, 300, 240, '#d2502f'), stall(620, 840, 260, 200, '#4a7fc1'), stall(1000, 830, 280, 220, '#3fa38c'), stall(1380, 820, 300, 250, '#f5b83d'), ridge(r, '#1a0c20', 860, 20, 120));
      { const sl = stringLights(110, 18, ['#ffd36b', '#ff8f8f', '#7fd1ff', '#a6f2b7']); sv(sl.svg); fx(sl.fx); }
      fx(lanterns([[160, 140, 120, '#ffd36b', 3.2], [800, 150, 90, '#ff9ad9', 3.8], [1440, 140, 130, '#ffd36b', 3.4]]), fireflies(r, 10, ['#ffd36b', '#ff9ad9']));
      break;
    case 'loc_rats':
      S.sky = ['#241812', '#3a2a20', '#140e0a'];
      sv(glow('g1', 800, 500, 500, '#ff5a3d', 0.12), ceiling(r, '#120c08', 30, 120), ridge(r, '#1c140e', 760, 60));
      for (let i = 0; i < 16; i++) sv(`<ellipse cx="${(80 + r() * 1440).toFixed(0)}" cy="${(160 + r() * 520).toFixed(0)}" rx="${(40 + r() * 40).toFixed(0)}" ry="${(28 + r() * 26).toFixed(0)}" fill="#0a0604" stroke="#3a2a20" stroke-width="6"/>`);
      sv(`<path d="M640 900 L800 900 L760 820Z" fill="#ffd36b" stroke="${INK}" stroke-width="5"/>`);
      fx(eyesL(r, 16, '#ff5a3d', [80, 1520, 150, 690]), risers(r, 10, ['rgba(214,190,160,.4)'], { size: [3, 6], speed: [18, 30] }));
      break;
    case 'loc_dark':
      S.sky = ['#08060c', '#0d0a12', '#040306'];
      sv(glow('g1', 800, 760, 300, '#ffd36b', 0.35), `<rect x="785" y="700" width="30" height="80" rx="6" fill="#efe6d4" stroke="${INK}" stroke-width="5"/><ellipse cx="800" cy="790" rx="70" ry="16" fill="#3a2a18"/>`);
      fx(`<i class="w-flame" style="${at(785, 640)};width:${pct(30, 1600)}%;height:${pct(64, 900)}%"></i>`, pulses([[800, 720, 260, '#ffd36b', 0.9]]), eyesL(r, 14, '#fff36b', [60, 1540, 80, 700]));
      break;
    case 'loc_echo':
      S.sky = ['#1a1630', '#2c2650', '#120e22'];
      sv(glow('g1', 800, 450, 520, '#d9b3ff', 0.2), ceiling(r, '#0e0b1c', 40, 260, 22), ridge(r, '#161228', 780, 120, 100));
      fx(rings(800, 450, '#d9b3ff', 4), rings(300, 520, '#a9c8ff', 2), rings(1300, 500, '#a9c8ff', 2), risers(r, 14, ['#d9b3ff'], { size: [2, 4], speed: [16, 26] }));
      break;
    case 'loc_lake':
      S.sky = ['#0c1a36', '#163056', '#0a1426'];
      sv(glow('g1', 800, 40, 260, '#e6f4ff', 0.6), ceiling(r, '#08101e', 30, 130), `<path d="M740 0 H860 L1060 520 H540Z" fill="#cfe8ff" opacity=".07"/>`);
      sv(`<rect x="0" y="520" width="1600" height="380" fill="#123056"/><path d="M700 520 H900 L1000 900 H600Z" fill="#cfe8ff" opacity=".09"/>`);
      fx(river(500, 400, ['#18406e', '#1f548a', '#bfe4ff'], [26, 18], { shine: true, cls: 'w-calm' }), `<div class="w-caustic w-caustic-lake"></div>`,
        `<div class="w-boat" style="${at(1030, 470)}"><svg viewBox="0 0 220 120"><path d="M10 70 Q110 120 210 70 L190 96 H30Z" fill="#3a2418" stroke="${INK}" stroke-width="6"/><path d="M110 10 V74" stroke="${INK}" stroke-width="6"/><path d="M110 14 L168 50 L110 60Z" fill="#efe6d4" stroke="${INK}" stroke-width="5"/></svg></div>`,
        fireflies(r, 10, ['#bfe4ff', '#ffffff'], [0, 1600, 120, 500])); sv(rays([[800, -20, 180, 0, '#e6f4ff', 0.18]]));
      break;
    case 'loc_crystal': {
      S.sky = ['#160c30', '#2a1a5a', '#120a26'];
      sv(glow('g1', 300, 650, 420, '#7fe8ff', 0.28), glow('g2', 1300, 620, 440, '#ff9ad9', 0.26), glow('g3', 800, 300, 400, '#c78bff', 0.2), ceiling(r, '#0c0620', 30, 120));
      const C = ['#7fe8ff', '#c78bff', '#ff9ad9', '#a6f2d8', '#fff3b0'];
      sv(crystals(r, 240, 880, C, 8, 1.6), crystals(r, 1360, 880, C, 9, 1.7), crystals(r, 800, 900, C, 5, 1), crystals(r, 560, 900, C, 4, 0.8), crystals(r, 1080, 900, C, 4, 0.9));
      fx(pulses([[240, 700, 260, '#7fe8ff', 3], [1360, 680, 280, '#ff9ad9', 3.6, 1.5], [800, 800, 200, '#fff3b0', 2.8, 0.7]]), sparkles(r, 26, [60, 1540, 200, 880], '#ffffff')); sv(rays([[420, -40, 140, 18, '#c78bff', 0.18], [1180, -40, 140, -16, '#7fe8ff', 0.18], [800, -40, 120, 2, '#ffffff', 0.14]]));
      break;
    }
    case 'loc_lava':
      S.sky = ['#1e0604', '#4a0e06', '#140404'];
      sv(glow('g1', 800, 760, 720, '#ff6a1a', 0.45), ceiling(r, '#140302', 30, 120), `<path d="M0 900 V640 Q180 600 360 660 Q560 720 700 700 L700 900Z M1600 900 V630 Q1420 600 1240 660 Q1040 720 900 700 L900 900Z" fill="#1e0806"/>`);
      fx(river(700, 200, ['#ff6a1a', '#ffb347', '#fff3b0'], [18, 11], { cls: 'w-lava' }), risers(r, 28, ['#ffb347', '#ffd27a', '#ff6a1a'], { size: [2, 5], speed: [5, 11], cls: 'w-rise w-ember' }));
      break;
    case 'loc_ice': {
      S.sky = ['#9cc8e8', '#4a7fa8', '#1a3a5a'];
      let ic = '';
      for (let i = 0; i < 46; i++) { const x = i * 36 + r() * 12, h = 40 + r() * 170; ic += `<path d="M${x - 14} 0 L${x} ${h} L${x + 14} 0Z" fill="#e6f6ff" stroke="#7fa8c8" stroke-width="3"/>`; }
      sv(glow('g1', 800, 300, 600, '#ffffff', 0.25), ic, ridge(r, '#cfeaff', 760, 60, 120), `<path d="M180 800 L260 420 L340 800Z M1260 800 L1340 380 L1420 800Z M700 820 L760 600 L820 820Z" fill="#a9d8f5" stroke="#5a88a8" stroke-width="5"/>`);
      fx(snow(r), sparkles(r, 16, [100, 1500, 400, 860], '#ffffff'));
      break;
    }
    case 'loc_storm':
      S.sky = ['#111726', '#2a3550', '#0b0f1a'];
      sv(glow('g1', 800, 120, 600, '#a9c8ff', 0.14), `<path d="M0 0 V900 H320 L360 700 L280 520 L340 300 L240 120 L300 0Z M1600 0 V900 H1280 L1240 690 L1320 500 L1250 280 L1350 110 L1300 0Z" fill="#0d111c"/>`, ridge(r, '#151b2c', 820, 40, 120));
      fx(clouds('#3a4560'), lightning(760), rain(r));
      break;
    case 'loc_temple': {
      S.sky = ['#2a1c0c', '#4a3416', '#1a1006'];
      sv(glow('g1', 800, 520, 520, '#ffe08a', 0.3), `<path d="M680 0 H920 L1200 900 H400Z" fill="#ffe8a0" opacity=".08"/>`);
      for (const x of [140, 420, 1180, 1460]) sv(pillar(x, 120, 820, 110, '#c9b48a'));
      sv(`<rect x="640" y="700" width="320" height="140" fill="#a8916a" stroke="${INK}" stroke-width="6"/><rect x="600" y="660" width="400" height="50" fill="#c9b48a" stroke="${INK}" stroke-width="6"/><rect x="0" y="840" width="1600" height="60" fill="#5a4220"/>`);
      fx(pulses([[800, 600, 180, '#fff3b0', 3]]), `<i class="w-orb" style="${at(760, 560)}"></i>`,
        Array.from({ length: 10 }, (_, i) => `<i class="w-rune" style="left:${(8 + i * 9 + r() * 4).toFixed(1)}%;--t:${(14 + r() * 10).toFixed(1)}s;animation-delay:-${(r() * 20).toFixed(1)}s">${'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᛟ'[i]}</i>`).join(''));
      sv(rays([[800, -60, 320, 0, '#ffe8a0', 0.2], [620, -60, 120, 10, '#ffe8a0', 0.12], [980, -60, 120, -10, '#ffe8a0', 0.12]]));
      break;
    }
    case 'loc_tavern': {
      S.sky = ['#3a2010', '#5a341a', '#24140a'];
      let planks = '';
      for (let x = 0; x < 1600; x += 90) planks += `<rect x="${x}" y="0" width="88" height="760" fill="${['#5a341a', '#62391c', '#553018'][x / 90 % 3]}"/><path d="M${x + 44} 80 v20 M${x + 30} 400 v16" stroke="#3a2010" stroke-width="6" stroke-linecap="round"/>`;
      sv(planks, `<rect x="0" y="740" width="1600" height="160" fill="#2a1408"/><path d="M0 742 H1600" stroke="#8a5a3c" stroke-width="8"/>`,
        `<rect x="1080" y="360" width="380" height="400" rx="14" fill="#2a1408" stroke="${INK}" stroke-width="8"/><rect x="1040" y="330" width="460" height="50" rx="8" fill="#6a3a1c" stroke="${INK}" stroke-width="6"/>`,
        `<rect x="160" y="640" width="640" height="34" rx="6" fill="#8a5a3c" stroke="${INK}" stroke-width="6"/><path d="M200 674 V820 M760 674 V820" stroke="${INK}" stroke-width="16"/>`,
        `<path d="M300 640 V580 h50 v60Z M520 640 V590 h44 v50Z" fill="#e8c88a" stroke="${INK}" stroke-width="5"/>`,
        `<ellipse cx="900" cy="760" rx="70" ry="86" fill="#8a5a3c" stroke="${INK}" stroke-width="6"/><path d="M834 720 H966 M834 800 H966" stroke="#3a2010" stroke-width="8"/>`);
      fx(`<i class="w-fire" style="${at(1150, 560)};width:${pct(240, 1600)}%;height:${pct(200, 900)}%"></i>`, pulses([[1270, 650, 360, '#ff8a3d', 1.1]]), lanterns([[420, 0, 160, '#fff3b0', 4], [1000, 0, 110, '#fff3b0', 4.6]]), steam(r, [[330, 560], [540, 570]]));
      break;
    }
    case 'loc_garden':
      S.sky = ['#06140c', '#123a22', '#081a10'];
      sv(glow('g1', 800, 600, 600, '#a6f2b7', 0.14), ceiling(r, '#040c08', 30, 120), ridge(r, '#0a2414', 760, 60));
      for (let i = 0; i < 22; i++) {
        const x = 40 + r() * 1520, y = 780 + r() * 100, c = ['#ff9ad9', '#fff3b0', '#7fe8ff', '#c78bff'][i % 4], sz = 14 + r() * 14;
        sv(`<path d="M${x} 900 V${y}" stroke="#3e9c5f" stroke-width="6"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="${x}" cy="${y - sz * 0.6}" rx="${sz * 0.4}" ry="${sz * 0.6}" transform="rotate(${a} ${x} ${y})" fill="${c}" stroke="${INK}" stroke-width="3"/>`).join('')}<circle cx="${x}" cy="${y}" r="${sz * 0.32}" fill="#f5b83d"/>`);
      }
      fx(fireflies(r, 34, ['#fff36b', '#d6f59a', '#ffffff']), risers(r, 12, ['#ff9ad9', '#fff3b0'], { size: [3, 5], speed: [18, 28] }));
      break;
    case 'loc_lair':
      S.sky = ['#140c04', '#2a1a06', '#0c0602'];
      sv(glow('g1', 800, 840, 700, '#ffd56a', 0.3), ceiling(r, '#0a0602', 30, 120), goldPile(300, 920, 700, 320), goldPile(1300, 920, 760, 340), goldPile(800, 940, 520, 200));
      fx(`<div class="w-dragoneye" style="${at(900, 220)}"><i></i></div>`, sparkles(r, 24, [60, 1540, 600, 880]), steam(r, [[300, 400], [1200, 360]]), risers(r, 10, ['#ffe08a'], { size: [2, 4], speed: [14, 22] }));
      break;
    default: {
      // сказочная пещера: кристаллы, светящиеся грибы, подземная река и водопад
      S.sky = ['#1a1442', '#2b3a72', '#173f4e'];
      sv(glow('g1', 800, 0, 380, '#fff3c4', 0.45), glow('g2', 260, 700, 420, '#7fe8ff', 0.26), glow('g3', 1360, 640, 420, '#ff9ad9', 0.24));
      sv(ceiling(r, '#120e2c', 30, 140), `<path d="M700 0 H900 L1180 760 H420Z" fill="#fff3c4" opacity=".06"/>`);
      sv(ridge(r, '#2a2458', 560, 140, 140, 0.9), ridge(r, '#1e1a44', 680, 90, 110));
      sv(sideWalls('#140f30', 200));
      sv(`<path d="M1170 260 Q1200 250 1230 262 L1260 820 L1150 820Z" fill="#1e1a44"/>`);
      const C = ['#7fe8ff', '#c78bff', '#ff9ad9', '#a6f2d8'];
      sv(crystals(r, 170, 820, C, 7, 1.3), crystals(r, 1450, 810, C, 7, 1.3));
      sv(mushroom(430, 830, 150, 200, '#5fe39a', '#d9ffe6'), mushroom(540, 840, 90, 120, '#c78bff', '#f1e2ff'), mushroom(1120, 830, 120, 160, '#ff9ad9', '#ffe0f2'));
      fx(river(780, 140, ['#1f5c7a', '#2f86a8', '#c8f4ff'], [18, 11], { shine: true }), waterfall(1205, 262, 800, 60, '#9fe6ff'),
        pulses([[170, 700, 230, '#7fe8ff', 3.4], [1450, 690, 230, '#ff9ad9', 4, 1.6], [430, 680, 150, '#7dffb0', 2.8, 0.8]]),
        '',
        fireflies(r, 20, ['#fff36b', '#a6f2ff', '#ffb0e0']), risers(r, 12, ['rgba(255,243,196,.55)'], { size: [2, 4], speed: [18, 30] })); sv(rays([[800, -40, 220, 0, '#fff3c4', 0.2], [700, -40, 90, 12, '#fff3c4', 0.12], [900, -40, 90, -12, '#fff3c4', 0.12]]));
    }
  }
  return S;
}

export function worldHTML(key) {
  key = key || 'default';
  const S = sceneOf(key);
  // у каждой сцены свои id градиентов, чтобы при смене сцен не перепутались
  S.svg = S.svg.replace(/id="(g[\w]*)"/g, `id="${key}-$1"`).replace(/url\(#(g[\w]*)\)/g, `url(#${key}-$1)`);
  return `<div class="w-box"><svg class="w-static" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">`
    + `<defs><linearGradient id="wsky-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${S.sky[0]}"/><stop offset=".55" stop-color="${S.sky[1]}"/><stop offset="1" stop-color="${S.sky[2]}"/></linearGradient></defs>`
    + `<rect width="1600" height="900" fill="url(#wsky-${key})"/>${S.svg}</svg><div class="w-fx">${S.fx}</div></div><div class="w-vignette"></div>`;
}

// Плавная смена сцены: новая проявляется поверх старой
let current = null;
export function setWorld(host, key) {
  if (!host) return;
  const k = key === null ? null : key || 'default';
  if (k === current) return;
  current = k;
  const old = [...host.children];
  if (k) {
    const el = document.createElement('div');
    el.className = 'world';
    el.dataset.w = k;
    el.innerHTML = worldHTML(k);
    host.append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  }
  old.forEach(o => { o.classList.remove('on'); setTimeout(() => o.remove(), 1400); });
  document.body.classList.toggle('has-world', !!k);
}
