// «Под Землёй» — эффекты: частицы на canvas, всплывающие числа, баннеры, 3D-кубик, полёт карт, наклон карт.
// Canvas рисует, только пока есть живые частицы; при «уменьшить движение» частицы отключаются.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

let cv = null, ctx = null, W = 0, H = 0, raf = 0, last = 0;
const parts = [];
const MAX = 700;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'fx-canvas';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  ctx = cv.getContext('2d');
  resize();
  addEventListener('resize', resize);
}
function resize() {
  if (!cv) return;
  W = innerWidth; H = innerHeight;
  const d = DPR();
  cv.width = Math.round(W * d); cv.height = Math.round(H * d);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(d, 0, 0, d, 0, 0);
}

function add(p) {
  if (parts.length >= MAX) parts.shift();
  parts.push(p);
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
}

function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  ctx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); if (p.onDie) p.onDie(p); continue; }
    if (p.delay) { p.delay -= dt; if (p.delay > 0) { p.life += dt; continue; } p.delay = 0; }
    p.vx += (p.ax || 0) * dt; p.vy += (p.g || 0) * dt;
    if (p.drag) { const k = Math.pow(p.drag, dt * 60); p.vx *= k; p.vy *= k; }
    if (p.wob) p.vx += Math.sin(t / 1000 * p.wob + p.seed) * 14 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += (p.vr || 0) * dt;
    if (p.grow) p.size += p.grow * dt;
    const k = p.life / p.max;
    const a = (p.fadeIn ? Math.min(1, (1 - k) * 6) : 1) * Math.min(1, k * (p.fade || 2)) * (p.alpha ?? 1);
    draw(p, a);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; ctx.clearRect(0, 0, W, H); }
}

function star(x, y, r, n = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r, a = (i * Math.PI) / n - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function heart(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
  ctx.closePath();
}

function draw(p, a) {
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
  const s = p.size;
  switch (p.shape) {
    case 'spark': {
      const len = Math.min(26, Math.hypot(p.vx, p.vy) * 0.05 + 2);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.strokeStyle = p.color; ctx.lineWidth = s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len); ctx.stroke();
      break;
    }
    case 'glow': {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'smoke': {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'star':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; star(0, 0, s, 4, 0.38); ctx.fill(); ctx.restore();
      break;
    case 'confetti':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 2.3));
      ctx.fillStyle = p.color; ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
      break;
    case 'coin': {
      ctx.save(); ctx.translate(p.x, p.y);
      const sx = Math.abs(Math.cos(p.rot)) * 0.85 + 0.15;
      ctx.scale(sx, 1);
      ctx.fillStyle = '#a8680c'; ctx.beginPath(); ctx.arc(0, 1.2, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5c14e'; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#231a26'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(-s * 0.15, -s * 0.55, s * 0.3, s * 1.1);
      ctx.restore();
      break;
    }
    case 'heart':
      ctx.fillStyle = p.color; heart(p.x, p.y, s); ctx.fill();
      ctx.strokeStyle = '#231a26'; ctx.lineWidth = 1.2; ctx.stroke();
      break;
    case 'note':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.2);
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.22;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.4, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.48, -0.1); ctx.lineTo(s * 0.48, -s * 1.6); ctx.quadraticCurveTo(s * 1.1, -s * 1.3, s * 1.1, -s * 0.8); ctx.stroke();
      ctx.restore();
      break;
    case 'drop':
      ctx.fillStyle = p.color; ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.4); ctx.quadraticCurveTo(p.x + s, p.y, p.x, p.y + s * 0.8); ctx.quadraticCurveTo(p.x - s, p.y, p.x, p.y - s * 1.4); ctx.fill();
      break;
    case 'rock':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(-s, -s * 0.4); ctx.lineTo(-s * 0.2, -s); ctx.lineTo(s, -s * 0.3); ctx.lineTo(s * 0.6, s * 0.8); ctx.lineTo(-s * 0.7, s * 0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    default:
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
  }
}

// ───────────── генераторы ─────────────
function center(el) {
  if (!el) return { x: W / 2, y: H / 2, w: 0, h: 0 };
  if (el.x !== undefined && !el.getBoundingClientRect) return { w: 0, h: 0, ...el };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}
function emit(n, at, mk) {
  if (reduced()) return;
  ensure();
  n = Math.max(1, Math.round(n * (fx.quality ?? 1)));
  for (let i = 0; i < n; i++) {
    const p = mk(i);
    add({ x: at.x, y: at.y, vx: 0, vy: 0, g: 0, rot: rnd(0, 6.28), vr: 0, size: 3, color: '#fff', life: 1, seed: Math.random() * 10, ...p, max: p.life ?? 1 });
  }
}
const PAL = {
  gold: ['#ffe08a', '#f5b83d', '#fff3b0', '#ffd36b'],
  confetti: ['#f5b83d', '#d2502f', '#3fa38c', '#4a7fc1', '#e86fa1', '#fff3b0', '#a6f2b7'],
  green: ['#8ff0d2', '#3fa38c', '#c4ef86', '#ffffff'],
  red: ['#ff8a66', '#d2502f', '#ffb08a'],
  purple: ['rgba(190,140,255,.55)', 'rgba(120,70,200,.5)', 'rgba(220,180,255,.45)'],
  dust: ['rgba(214,190,160,.55)', 'rgba(170,140,110,.5)', 'rgba(240,220,190,.45)'],
};

const R = (v, d) => Array.isArray(v) ? rnd(v[0], v[1]) : (v ?? d);
function explode(x, y, pal) {
  // вспышка салюта: кольцо искр, звёздочки и мягкое свечение
  const n = 46;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(-0.05, 0.05), v = rnd(170, 290);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, drag: 0.955, rot: 0, vr: 0, size: rnd(1.6, 2.6), color: pick(pal), shape: 'spark', add: true, life: rnd(0.9, 1.3), max: 1.3, seed: 0 });
  }
  for (let i = 0; i < 16; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(30, 150);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, drag: 0.96, rot: rnd(0, 6), vr: rnd(-6, 6), size: rnd(2.5, 4.5), color: '#fff8e0', shape: 'star', add: true, life: rnd(0.8, 1.4), max: 1.4, fadeIn: true, seed: 0 });
  }
  add({ x, y, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, size: 70, grow: 120, color: 'rgba(255,240,200,.5)', shape: 'glow', add: true, life: 0.45, max: 0.45, seed: 0 });
}
const FIRE_PALS = [['#ffe08a', '#f5b83d', '#fff3b0'], ['#ff8ab6', '#e86fa1', '#ffd0e4'], ['#8ff0d2', '#3fa38c', '#e6fff6'], ['#9cc4ff', '#4a7fc1', '#e6f0ff'], ['#d9b3ff', '#8f6bc9', '#f3e6ff'], ['#ffb08a', '#d2502f', '#ffe0c8']];

export const fx = {
  // универсальный «распылитель» частиц: форма, цвета, разброс скоростей и углов задаются снаружи
  spray(el, o = {}) {
    const c = center(el);
    const [a0, a1] = o.angle || [0, Math.PI * 2];
    emit(o.n || 20, c, () => {
      const a = rnd(a0, a1), v = R(o.speed, 200);
      return { x: c.x + rnd(-1, 1) * (o.spreadX ?? 0) * c.w / 2, y: c.y + rnd(-1, 1) * (o.spreadY ?? 0) * c.h / 2 + (o.dy || 0) * c.h,
        vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v + (o.vy || 0), ax: o.ax || 0, g: o.g ?? 0, drag: o.drag ?? 0.95,
        size: R(o.size, 3), grow: o.grow ? R(o.grow) : 0, color: pick(o.colors || PAL.gold), shape: o.shape || 'dot',
        add: o.add ?? true, life: R(o.life, 0.8), fadeIn: !!o.fadeIn, fade: o.fade, wob: o.wob ? R(o.wob) : 0, vr: rnd(-6, 6), delay: o.delay ? R(o.delay) : 0, alpha: o.alpha };
    });
  },
  // салют: ракеты взлетают и рассыпаются; возвращает моменты взрывов (для звука)
  fireworks(o = {}) {
    if (reduced()) return [];
    ensure();
    const n = o.n || 8, span = o.span || 3.2, pops = [];
    for (let i = 0; i < n; i++) {
      const delay = (i / n) * span + rnd(0, 0.25);
      const x = rnd(W * 0.12, W * 0.88), y = H + 10, top = rnd(H * 0.12, H * 0.42);
      const life = rnd(0.75, 1.05), vy = -(H + 10 - top) / life * 1.45;
      const pal = pick(FIRE_PALS);
      pops.push(delay + life);
      add({ x, y, vx: rnd(-40, 40), vy, g: -vy / life * 0.9, drag: 1, rot: 0, vr: 0, size: 2.4, color: '#fff3d6', shape: 'spark', add: true, life, max: life, delay, seed: 0,
        onDie: p => explode(p.x, p.y, pal) });
    }
    return pops;
  },
  burst(el, o = {}) {
    const c = el?.x !== undefined ? el : center(el);
    const n = o.n || 24, sp = o.speed || 260, pal = o.colors || PAL.gold;
    emit(n, c, () => {
      const a = rnd(0, Math.PI * 2), v = rnd(sp * 0.35, sp);
      return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g ?? 380, drag: 0.94, size: rnd(1.6, 3.2), color: pick(pal), shape: o.shape || 'spark', add: o.add ?? true, life: rnd(0.45, 0.9) };
    });
  },
  sparkle(el, o = {}) {
    const c = center(el);
    emit(o.n || 14, c, () => ({ x: c.x + rnd(-c.w / 2, c.w / 2), y: c.y + rnd(-c.h / 2, c.h / 2), vx: rnd(-20, 20), vy: rnd(-60, -10), size: rnd(3, 6), vr: rnd(-3, 3), color: pick(o.colors || PAL.gold), shape: 'star', add: true, life: rnd(0.6, 1.2), fadeIn: true, delay: rnd(0, 0.3) }));
  },
  rise(el, o = {}) { // уровень вверх: искры поднимаются столбом
    const c = center(el);
    emit(o.n || 34, c, () => ({ x: c.x + rnd(-c.w * 0.45, c.w * 0.45), y: c.y + c.h * 0.4, vx: rnd(-14, 14), vy: rnd(-180, -70), size: rnd(2.5, 5.5), vr: rnd(-4, 4), color: pick(o.colors || PAL.gold), shape: pick(['star', 'dot', 'star']), add: true, life: rnd(0.8, 1.5), fadeIn: true, delay: rnd(0, 0.35), drag: 0.985 }));
    emit(1, c, () => ({ shape: 'glow', size: c.w * 0.9, color: 'rgba(255,224,138,.55)', life: 0.6, grow: 60 }));
  },
  drops(el, o = {}) { // уровень вниз
    const c = center(el);
    emit(o.n || 16, c, () => ({ x: c.x + rnd(-c.w * 0.4, c.w * 0.4), y: c.y - c.h * 0.2, vx: rnd(-30, 30), vy: rnd(-40, 20), g: 520, size: rnd(2.4, 4), color: pick(['#4a7fc1', '#8fb8ff', '#d2502f']), shape: 'drop', life: rnd(0.6, 1) }));
  },
  smoke(el, o = {}) {
    const c = center(el);
    emit(o.n || 18, c, () => ({ x: c.x + rnd(-c.w * 0.3, c.w * 0.3), y: c.y + rnd(-c.h * 0.2, c.h * 0.3), vx: rnd(-26, 26), vy: rnd(-70, -20), size: rnd(8, 16), grow: rnd(14, 30), color: pick(o.colors || PAL.purple), shape: 'smoke', life: rnd(0.9, 1.6), fadeIn: true, wob: rnd(1, 3) }));
    if (o.sparks !== false) fx.burst(c, { n: 10, colors: ['#d9b3ff', '#b88ae6', '#fff'], speed: 160, g: 0 });
  },
  dust(el, o = {}) {
    const c = center(el);
    const bottom = c.y + c.h * 0.45;
    emit(o.n || 26, c, () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      return { x: c.x + side * rnd(0, c.w * 0.5), y: bottom, vx: side * rnd(40, 180), vy: rnd(-60, -10), size: rnd(6, 13), grow: rnd(10, 26), drag: 0.93, color: pick(PAL.dust), shape: 'smoke', life: rnd(0.6, 1.1) };
    });
    if (o.rocks) emit(o.rocks, c, () => ({ x: c.x + rnd(-c.w / 2, c.w / 2), y: c.y - c.h / 2, vx: rnd(-90, 90), vy: rnd(-220, -80), g: 900, vr: rnd(-8, 8), size: rnd(2.5, 5), color: pick(['#8b8494', '#6a6572', '#a39b8a']), shape: 'rock', life: rnd(0.8, 1.2) }));
  },
  confetti(o = {}) {
    const c = o.at ? center(o.at) : { x: W / 2, y: H * 0.35, w: W, h: 0 };
    emit(o.n || 120, c, () => {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(260, 720);
      return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 620, drag: 0.965, vr: rnd(-10, 10), size: rnd(3, 6), color: pick(PAL.confetti), shape: 'confetti', life: rnd(1.6, 2.8), fade: 3, wob: rnd(2, 5) };
    });
  },
  coins(from, to, o = {}) {
    const a = center(from), b = to ? center(to) : null;
    const n = o.n || 12;
    emit(n, a, i => {
      if (b) {
        const t = rnd(0.65, 0.95), g = rnd(500, 800);
        return { x: a.x + rnd(-14, 14), vx: (b.x - a.x) / t, vy: (b.y - a.y) / t - (g * t) / 2, g, size: rnd(5, 7.5), vr: rnd(6, 12), shape: 'coin', life: t, fade: 10, delay: i * 0.05 };
      }
      const ang = rnd(-Math.PI * 0.9, -Math.PI * 0.1), v = rnd(200, 460);
      return { vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: 820, size: rnd(5, 8), vr: rnd(6, 14), shape: 'coin', life: rnd(1.1, 1.6), fade: 4 };
    });
  },
  hearts(el) {
    const c = center(el);
    emit(10, c, () => ({ x: c.x + rnd(-c.w * 0.3, c.w * 0.3), y: c.y, vx: rnd(-30, 30), vy: rnd(-120, -50), size: rnd(5, 8), color: pick(['#ff7aa8', '#e86fa1', '#ffb0c8']), shape: 'heart', life: rnd(0.9, 1.4), wob: 3, delay: rnd(0, 0.25), fadeIn: true }));
  },
  notes(el, toEl) {
    const c = center(el), d = toEl ? center(toEl) : null;
    emit(12, c, () => ({ x: c.x + rnd(-20, 20), y: c.y + rnd(-10, 10), vx: d ? (d.x - c.x) * rnd(0.6, 1.1) : rnd(-40, 40), vy: d ? (d.y - c.y) * rnd(0.6, 1.1) - 40 : rnd(-110, -60), size: rnd(6, 9), color: pick(['#f5b83d', '#d9b3ff', '#8ff0d2']), shape: 'note', life: rnd(1, 1.5), wob: 4, delay: rnd(0, 0.4), fadeIn: true }));
  },
  ambient(el, kind) { // короткий всплеск атмосферы локации
    const c = center(el);
    const spec = {
      loc_water: { shape: 'drop', colors: ['#9ff0f5', '#bff7fa'], g: 400, vy: [0, 40], y: -0.5 },
      loc_mushroom: { shape: 'dot', colors: ['#a6f2b7', '#d9ffe6', '#c78bff'], g: -30, vy: [-50, -10], y: 0.3, add: true },
      loc_boiler: { shape: 'spark', colors: ['#ffb347', '#ff8a3d', '#ffd27a'], g: -80, vy: [-160, -60], y: 0.45, add: true },
      loc_vault: { shape: 'coin', colors: ['#f5c14e'], g: 600, vy: [-260, -120], y: 0.2 },
      loc_dark: { shape: 'glow', colors: ['rgba(255,243,107,.35)'], g: 0, vy: [-6, 6], y: 0 },
      loc_echo: { shape: 'note', colors: ['#d9b3ff', '#f6e7c1'], g: -20, vy: [-60, -20], y: 0.2 },
      loc_rats: { shape: 'dot', colors: ['#ff5a3d'], g: 0, vy: [-10, 10], y: 0 },
      loc_market: { shape: 'confetti', colors: PAL.confetti, g: 300, vy: [-260, -100], y: 0.1 },
      loc_station: { shape: 'smoke', colors: ['rgba(185,166,255,.3)', 'rgba(255,212,121,.25)'], g: -10, vy: [-30, -5], y: 0.2 },
    }[kind] || { shape: 'dot', colors: PAL.gold, g: -30, vy: [-60, -20], y: 0.3, add: true };
    emit(30, c, () => ({ x: c.x + rnd(-c.w / 2, c.w / 2), y: c.y + c.h * spec.y + rnd(-c.h * 0.3, c.h * 0.3), vx: rnd(-30, 30), vy: rnd(...spec.vy), g: spec.g, size: spec.shape === 'glow' ? rnd(6, 12) : spec.shape === 'smoke' ? rnd(10, 18) : rnd(2.5, 5), grow: spec.shape === 'smoke' ? 14 : 0, vr: rnd(-6, 6), color: pick(spec.colors), shape: spec.shape, add: spec.add, life: rnd(1, 2), fadeIn: true, delay: rnd(0, 0.6), wob: 2 }));
  },

  // ───────────── DOM-эффекты ─────────────
  float(el, text, cls = '') {
    const c = center(el);
    const d = document.createElement('div');
    d.className = 'fx-float ' + cls + (text.length > 9 ? ' long' : '');
    d.textContent = text;
    d.style.left = c.x + 'px'; d.style.top = c.y + 'px';
    document.body.append(d);
    setTimeout(() => d.remove(), 1500);
  },
  banner(title, sub = '', kind = '') {
    const d = document.createElement('div');
    d.className = 'fx-banner ' + kind;
    d.innerHTML = `<b></b>${sub ? '<small></small>' : ''}`;
    d.querySelector('b').textContent = title;
    if (sub) d.querySelector('small').textContent = sub;
    document.body.append(d);
    setTimeout(() => d.remove(), 2300);
    return d;
  },
  vignette(color = 'rgba(210,80,47,.55)') {
    const d = document.createElement('div');
    d.className = 'fx-vignette';
    d.style.setProperty('--vc', color);
    document.body.append(d);
    setTimeout(() => d.remove(), 900);
  },
  shake(el, cls = 'shake') {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  },
  // Полёт карты: клон летит из одной точки в другую и тает.
  fly(html, fromRect, toEl, o = {}) {
    if (reduced() || !fromRect) return;
    const to = center(toEl);
    const d = document.createElement('div');
    d.className = 'fx-fly';
    d.innerHTML = html;
    const card = d.firstElementChild;
    if (!card) return;
    d.style.left = fromRect.left + 'px'; d.style.top = fromRect.top + 'px';
    d.style.width = fromRect.width + 'px'; d.style.height = fromRect.height + 'px';
    document.body.append(d);
    const dx = to.x - (fromRect.left + fromRect.width / 2), dy = to.y - (fromRect.top + fromRect.height / 2);
    const anim = d.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) rotate(${o.spin ?? -8}deg) scale(1.12)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${(o.spin ?? -8) * 2}deg) scale(${o.endScale ?? 0.55})`, opacity: 0 },
    ], { duration: o.duration || 620, easing: 'cubic-bezier(.3,.7,.4,1)' });
    anim.onfinish = () => { d.remove(); if (o.onArrive) o.onArrive(); };
  },
  // 3D-кубик: крутится и встаёт на нужную грань.
  dice(host, value, ok, label) {
    const rot = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] }[value] || [0, 0];
    const pip = n => {
      const P = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n];
      return Array.from({ length: 9 }, (_, i) => `<i class="${P.includes(i + 1) ? 'on' : ''}"></i>`).join('');
    };
    host.innerHTML = `<div class="die3 ${ok ? 'ok' : 'fail'}"><div class="die3-scene"><div class="die3-cube" style="--fx:${rot[0] + 720}deg;--fy:${rot[1] + 1080}deg">
      ${[1, 2, 3, 4, 5, 6].map(n => `<div class="f f${n}">${pip(n)}</div>`).join('')}</div><div class="die3-shadow"></div></div><div class="dlabel"></div></div>`;
    host.querySelector('.dlabel').textContent = label;
    const die = host.querySelector('.die3');
    setTimeout(() => {
      die.classList.add('landed');
      if (!reduced()) fx.burst(die.querySelector('.die3-scene'), { n: ok ? 26 : 14, colors: ok ? PAL.green : PAL.red, speed: 240, g: 300 });
    }, reduced() ? 0 : 900);
  },
};

// ───────────── наклон карт за указателем ─────────────
const fine = matchMedia('(hover: hover) and (pointer: fine)');
let tiltEl = null, tiltRaf = 0, tx = 0, ty = 0;
function untilt(el) {
  if (!el) return;
  el.classList.remove('tilting');
  el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
}
document.addEventListener('pointermove', e => {
  if (!fine.matches || reduced()) return;
  const card = e.target.closest?.('.card');
  if (card !== tiltEl) { untilt(tiltEl); tiltEl = card; }
  if (!card || card.classList.contains('dim')) return;
  tx = e.clientX; ty = e.clientY;
  if (tiltRaf) return;
  tiltRaf = requestAnimationFrame(() => {
    tiltRaf = 0;
    if (!tiltEl || !tiltEl.isConnected) return;
    const r = tiltEl.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (tx - r.left) / r.width)), py = Math.max(0, Math.min(1, (ty - r.top) / r.height));
    const max = tiltEl.classList.contains('lg') ? 12 : 9;
    tiltEl.classList.add('tilting');
    tiltEl.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
    tiltEl.style.setProperty('--rx', ((0.5 - py) * 2 * max).toFixed(2) + 'deg');
    tiltEl.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    tiltEl.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  });
}, { passive: true });
document.addEventListener('pointerleave', () => { untilt(tiltEl); tiltEl = null; });
document.addEventListener('pointerdown', () => { untilt(tiltEl); tiltEl = null; }, { passive: true });
