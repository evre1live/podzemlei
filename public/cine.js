// «Под Землёй» — режиссёр зрелищных сцен.
// Сервер присылает события партии (fx). Здесь они превращаются в короткие сцены:
// дверь распахивается и из неё вылетает монстр, герой разрубает карту, монстр бросается на игрока,
// проклятие бьёт молнией, на погибшего падает надгробие, над победителем гремит салют.
// Сцены идут по очереди. Если событий накопилось много, очередь проигрывается быстрее.
// Всё движение — transform и opacity через Web Animations API, частицы — общий canvas из fx.js.

import { fx } from '/fx.js';
import { sfx } from '/sfx.js';
import { cardHTML, cardBackSVG, avatarSVG } from '/art.js';
import { def, ruleText, BOSS_FLOOR, LULLABY_PENALTY, MUTAGEN_BONUS } from '/shared/cards.js';
import { sceneKind } from '/art-monsters.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const vw = () => innerWidth, vh = () => innerHeight;
const KEY = 'pz.cine';
let enabled = (() => { try { const v = localStorage.getItem(KEY); return v == null ? true : v === '1'; } catch { return true; } })();

const EASE = {
  out: 'cubic-bezier(.2,.8,.3,1)', in: 'cubic-bezier(.6,0,.9,.45)', io: 'cubic-bezier(.65,0,.35,1)',
  back: 'cubic-bezier(.3,1.45,.5,1)', lin: 'linear', fall: 'cubic-bezier(.45,0,.9,.55)',
};

let api = null;
let layer = null;
const Q = [];
let busy = false, pumpTimer = 0;
const timers = new Set();
const hidden = new Map(); // uid карты → таймер страховки: карта на столе скрыта, пока к ней летит её «двойник»
let panel = null;

function L() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'cine';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}
function box(n) {
  if (!n || !n.isConnected) return null;
  const r = n.getBoundingClientRect();
  return r.width || r.height ? r : null;
}
const cen = r => (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: vw() / 2, y: vh() * 0.45 });
const onScreen = r => r && r.bottom > 0 && r.top < vh() && r.right > 0 && r.left < vw();
const clampX = (x, m = 90) => Math.max(m, Math.min(vw() - m, x));
const clampY = (y, m = 50) => Math.max(m, Math.min(vh() - m, y));
// точка, вокруг которой разворачивается действие: центр сцены, если она на экране, иначе центр экрана
function focus() {
  const r = box(document.getElementById('stage'));
  if (onScreen(r) && r.top > -r.height * 0.25 && r.bottom < vh() + r.height * 0.25) return { x: r.left + r.width / 2, y: clampY(r.top + r.height * 0.42, 110) };
  return { x: vw() / 2, y: vh() * 0.44 };
}
const fitBig = () => Math.max(0.62, Math.min(1.2, (vh() - 150) / 420, (vw() - 30) / 250));

// Контекст сцены: все длительности делятся на скорость очереди
function ctx(sp) {
  const k = {
    sp,
    el(cls, html = '', st = null, parent = null) {
      const d = document.createElement('div');
      d.className = cls;
      if (html) d.innerHTML = html;
      if (st) Object.assign(d.style, st);
      (parent || L()).append(d);
      return d;
    },
    pt(cls, html, x, y) {
      const n = k.el('cn-pt ' + cls, html, { left: x + 'px', top: y + 'px' });
      if (lite && /\bcn-(rays|doorglow|aura|halo)\b/.test(cls)) n.style.display = 'none';
      return n;
    },
    a(node, frames, o = {}) {
      if (!node?.animate) return null;
      return node.animate(frames, { duration: Math.max(1, (o.dur ?? 400) / sp), delay: (o.delay || 0) / sp, easing: o.ease || EASE.out, fill: o.fill || 'both', iterations: o.it ?? 1, direction: o.dir || 'normal', composite: o.comp || 'replace' });
    },
    at(ms, fn) {
      const id = setTimeout(() => { timers.delete(id); try { fn(); } catch (e) { console.warn('cine', e); } }, ms / sp);
      timers.add(id);
    },
    rm(node, ms) { k.at(ms, () => node?.remove()); },
    snd(name, o = {}, ms = 0) { if (ms) k.at(ms, () => sfx.play(name, o)); else sfx.play(name, o); },
    fade(node, ms, dur = 300) { k.at(ms, () => { k.a(node, [{ opacity: 1 }, { opacity: 0 }], { dur, fill: 'forwards' }); k.rm(node, dur + 20); }); },
  };
  return k;
}

// ───────────── лёгкий режим ─────────────
// Если на устройстве сцены идут рывками, убираем самые тяжёлые слои (лучи, большие ореолы) и половину частиц.
let lite = false, slowScenes = 0;
function watchFps() {
  if (lite) return;
  let n = 0, sum = 0;
  const t0 = performance.now();
  let last = t0;
  const f = t => {
    sum += t - last; last = t; n++;
    if (t - t0 < 1200) { requestAnimationFrame(f); return; }
    if (document.hidden || !n) return;
    if (sum / n > 42) { if (++slowScenes >= 2) { lite = true; fx.quality = 0.5; } } else slowScenes = Math.max(0, slowScenes - 1);
  };
  requestAnimationFrame(f);
}

// ───────────── очередь ─────────────
function pump() {
  if (busy || !Q.length) return;
  const sc = Q.shift();
  if (document.hidden) { sc.skip?.(); pump(); return; }
  if (Q.length > 8 && sc.minor) { sc.skip?.(); sc.quick?.(); pump(); return; }
  const sp = (Q.length >= 4 ? 1.8 : Q.length >= 2 ? 1.35 : 1) / (cine.slow || 1);
  busy = true;
  if (!sc.minor) watchFps();
  let dur = 0;
  try { dur = sc.run(ctx(sp)) ?? sc.dur ?? 0; } catch (e) { console.warn('cine', e); sc.skip?.(); }
  const wait = Math.max((sc.minDur || 0) * (cine.slow || 1), dur / sp);
  pumpTimer = setTimeout(() => { busy = false; pump(); }, wait);
}
function enqueue(...scenes) { Q.push(...scenes.filter(Boolean)); pump(); }
function clearAll() {
  Q.splice(0).forEach(s => s.skip?.());
  timers.forEach(clearTimeout); timers.clear();
  clearTimeout(pumpTimer); busy = false;
  if (layer) layer.innerHTML = '';
  document.getElementById('fx')?.replaceChildren();
  closePanel(true);
  [...hidden.keys()].forEach(unhide);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) clearAll(); });

// ───────────── скрытые карты на столе ─────────────
function realCard(uid) { return document.querySelector(`#stage .card[data-uid="${CSS.escape(uid)}"]`); }
function hideTarget(uid) { const c = realCard(uid); return c ? (c.closest('.mon-wrap') || c.closest('.reveal-slot') || c) : null; }
function hide(uid) {
  if (!uid) return;
  clearTimeout(hidden.get(uid));
  hidden.set(uid, setTimeout(() => unhide(uid), 7000));
  hideTarget(uid)?.classList.add('cine-hide');
}
function unhide(uid, pop = false) {
  clearTimeout(hidden.get(uid));
  hidden.delete(uid);
  const t = hideTarget(uid);
  if (!t) return;
  t.classList.remove('cine-hide');
  if (pop) t.animate([{ transform: 'scale(1.14)', filter: 'brightness(1.6)' }, { transform: 'scale(.97)', offset: 0.55 }, { transform: 'none', filter: 'none' }], { duration: 380, easing: EASE.out });
}

// ───────────── «замороженный» бой ─────────────
// Когда бой закончился, сервер уже прислал новый стол. Чтобы развязка была видна, поверх кладём копию
// прежней панели боя: на ней карту разрубают, монстр бросается на героя, а потом копия тает.
export function snapStage() {
  const inner = document.querySelector('#stage .stage-inner');
  const cave = document.getElementById('cave');
  if (!inner || !cave || !inner.querySelector('.fight')) return null;
  const cr = cave.getBoundingClientRect(), r = inner.getBoundingClientRect();
  const node = inner.cloneNode(true);
  node.querySelectorAll('.act-bar, .reward').forEach(e => e.remove());
  node.querySelectorAll('[data-until]').forEach(e => e.removeAttribute('data-until'));
  node.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  node.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
  node.querySelectorAll('[data-roll]').forEach(e => { e.textContent = e.dataset.roll; e.removeAttribute('data-roll'); });
  return { node, left: r.left - cr.left, top: r.top - cr.top, w: r.width };
}
function openPanel(snap) {
  closePanel(true);
  const cave = document.getElementById('cave');
  if (!cave || !snap) return null;
  const n = snap.node;
  n.classList.add('cn-panel');
  n.style.left = snap.left + 'px'; n.style.top = snap.top + 'px'; n.style.width = snap.w + 'px';
  n.querySelectorAll('.mon-body').forEach(phase);
  cave.append(n);
  document.getElementById('stage')?.classList.add('cine-under');
  panel = {
    node: n,
    card: uid => n.querySelector(`.mon-wrap .card[data-uid="${CSS.escape(uid)}"]`),
    shield: side => n.querySelector('.shield.' + side),
  };
  return panel;
}
function closePanel(now = false) {
  if (!panel) return;
  const p = panel; panel = null;
  document.getElementById('stage')?.classList.remove('cine-under');
  if (now) { p.node.remove(); return; }
  p.node.animate([{ opacity: 0, transform: 'scale(.97) translateY(6px)' }], { duration: 360, easing: EASE.in, fill: 'forwards' }).onfinish = () => p.node.remove();
}
const conceal = ce => { const b = ce?.closest('.mon-body') || ce; if (b) b.style.visibility = 'hidden'; };
function monEl(uid) {
  return panel?.card(uid) || document.querySelector(`#stage .mon-wrap .card[data-uid="${CSS.escape(uid)}"]`);
}
const shieldEl = side => document.getElementById(side === 'hero' ? 'shieldHero' : 'shieldMon') || panel?.shield(side);

// фаза бесконечной анимации не сбрасывается при перерисовке
export function phase(el) {
  const t = performance.now();
  el.style.setProperty('--ph', -(t % 3400) + 'ms');
  el.style.setProperty('--ph2', -(t % 4400) + 'ms');
}

// ───────────── картинки ─────────────
const INK = '#231a26';
// дверь подземелья: тёмный дуб с железными полосами и заклёпками в каменной арке (текстуры /ui/v1)
const leaf = side => {
  const L1 = side === 'l';
  const shape = L1 ? 'M0 270 V105 A105 105 0 0 1 105 0 V270 Z' : 'M105 270 V105 A105 105 0 0 0 0 0 V270 Z';
  const id = 'cnLeaf' + side;
  let planks = '';
  for (let i = 0; i < 4; i++) planks += `<rect x="${i * 26.25}" y="0" width="26.5" height="270" fill="url(#${id}w)"/><rect x="${i * 26.25}" y="0" width="26.5" height="270" fill="#000" opacity="${[0.05, 0.18, 0.1, 0.22][i]}"/>`;
  let bands = '';
  for (const y of [70, 198]) {
    bands += `<rect x="0" y="${y}" width="105" height="15" fill="url(#${id}i)"/><rect x="0" y="${y}" width="105" height="15" fill="url(#${id}b)"/>`;
    for (const x of [10, 36, 62, 88]) bands += `<circle cx="${x}" cy="${y + 7.5}" r="2.8" fill="#2a2420"/><circle cx="${x - 0.6}" cy="${y + 6.8}" r="1.6" fill="#a89a88"/>`;
  }
  const hx = L1 ? 88 : 17;
  return `<svg class="cn-leaf ${side}" viewBox="0 0 105 270" aria-hidden="true"><defs><clipPath id="${id}"><path d="${shape}"/></clipPath>
    <pattern id="${id}w" width="105" height="160" patternUnits="userSpaceOnUse"><image href="/ui/v1/wood.webp" width="105" height="160" preserveAspectRatio="none"/></pattern>
    <pattern id="${id}i" width="64" height="64" patternUnits="userSpaceOnUse"><image href="/ui/v1/iron.webp" width="64" height="64"/></pattern>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8cfc0" stop-opacity=".35"/><stop offset=".3" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
    <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="${L1 ? 0 : 0.45}"/><stop offset="1" stop-color="#000" stop-opacity="${L1 ? 0.45 : 0}"/></linearGradient></defs>
    <g clip-path="url(#${id})">${planks}<path d="M26.25 0 V270 M52.5 0 V270 M78.75 0 V270" stroke="#0e0805" stroke-width="2"/>${bands}<rect width="105" height="270" fill="url(#${id}g)"/></g>
    <circle cx="${hx}" cy="150" r="5" fill="#3a332c" stroke="#0a0806" stroke-width="1.6"/><circle cx="${hx}" cy="164" r="10" fill="none" stroke="#14100c" stroke-width="5"/><circle cx="${hx}" cy="164" r="10" fill="none" stroke="#8a7a62" stroke-width="2.4"/><circle cx="${hx - 2}" cy="161" r="10" fill="none" stroke="#e0d0b0" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="10 60"/>
    <path d="${shape}" fill="none" stroke="#050403" stroke-width="3"/></svg>`;
};
const ARCH = (() => {
  let joints = '';
  for (let a = 200; a <= 340; a += 20) {
    const t = a * Math.PI / 180;
    joints += `<line x1="${(120 + 105 * Math.cos(t)).toFixed(1)}" y1="${(145 + 105 * Math.sin(t)).toFixed(1)}" x2="${(120 + 120 * Math.cos(t)).toFixed(1)}" y2="${(120 + 120 * Math.sin(t)).toFixed(1)}" stroke="#0c0a08" stroke-width="2.2"/>`;
  }
  for (const y of [185, 235, 285]) joints += `<line x1="0" y1="${y}" x2="15" y2="${y}" stroke="#0c0a08" stroke-width="2.2"/><line x1="225" y1="${y}" x2="240" y2="${y}" stroke="#0c0a08" stroke-width="2.2"/>`;
  return `<svg class="cn-arch" viewBox="-6 -6 252 334" aria-hidden="true"><defs>
    <pattern id="cnStone" width="96" height="96" patternUnits="userSpaceOnUse"><image href="/ui/v1/stone.webp" width="96" height="96"/></pattern>
    <radialGradient id="cnArchSh" cx="50%" cy="40%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>
    <path fill-rule="evenodd" d="M0 320 V120 A120 120 0 0 1 240 120 V320 Z M15 320 V145 A105 105 0 0 1 225 145 V320 Z" fill="url(#cnStone)" stroke="#050403" stroke-width="3"/>
    <path fill-rule="evenodd" d="M0 320 V120 A120 120 0 0 1 240 120 V320 Z M15 320 V145 A105 105 0 0 1 225 145 V320 Z" fill="url(#cnArchSh)"/>
    <path fill-rule="evenodd" d="M3 320 V121 A117 117 0 0 1 237 121 V320 Z M15 320 V145 A105 105 0 0 1 225 145 V320 Z" fill="none" stroke="rgba(255,236,200,.12)" stroke-width="2"/>
    ${joints}<path d="M106 -2 L134 -2 L130 41 L110 41 Z" fill="url(#cnStone)" stroke="#050403" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M114 8 L126 8 L124 30 L116 30Z" fill="none" stroke="#d9ad5c" stroke-opacity=".6" stroke-width="1"/>
    <rect x="-6" y="306" width="252" height="18" rx="2" fill="url(#cnStone)" stroke="#050403" stroke-width="3"/><rect x="-6" y="306" width="252" height="18" rx="2" fill="#000" opacity=".35"/></svg>`;
})();
// лучи — статичная SVG-картинка без масок: дёшево вращать
let rayId = 0;
function raysSVG() {
  const id = 'cnr' + (++rayId);
  let w = '';
  for (let i = 0; i < 24; i++) {
    const a0 = (i * 15 - 3.6) * Math.PI / 180, a1 = (i * 15 + 3.6) * Math.PI / 180;
    w += `M0 0 L${(100 * Math.cos(a0)).toFixed(1)} ${(100 * Math.sin(a0)).toFixed(1)} L${(100 * Math.cos(a1)).toFixed(1)} ${(100 * Math.sin(a1)).toFixed(1)}Z`;
  }
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs><radialGradient id="${id}" r="50%"><stop offset=".1" stop-color="currentColor" stop-opacity=".46"/><stop offset=".55" stop-color="currentColor" stop-opacity=".16"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><path d="${w}" fill="url(#${id})"/></svg>`;
}
const DOOR = `<div class="cn-hole"></div><div class="cn-doorlight"></div>${leaf('l')}${leaf('r')}${ARCH}`;
const SIGIL = (() => {
  let ticks = '';
  for (let i = 0; i < 36; i++) {
    const a = i * 10 * Math.PI / 180, r2 = i % 3 ? 87 : 92;
    ticks += `<line x1="${(100 + 80 * Math.cos(a)).toFixed(1)}" y1="${(100 + 80 * Math.sin(a)).toFixed(1)}" x2="${(100 + r2 * Math.cos(a)).toFixed(1)}" y2="${(100 + r2 * Math.sin(a)).toFixed(1)}"/>`;
  }
  const tri = off => [0, 1, 2].map(i => { const a = (off + i * 120) * Math.PI / 180; return `${(100 + 72 * Math.cos(a)).toFixed(1)},${(100 + 72 * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return `<svg viewBox="0 0 200 200" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="100" cy="100" r="95"/><circle cx="100" cy="100" r="79" stroke-width="2"/>${ticks}<polygon points="${tri(-90)}"/><polygon points="${tri(90)}"/><circle cx="100" cy="100" r="30" stroke-width="2.5"/><circle cx="100" cy="100" r="10" fill="currentColor"/></svg>`;
})();
const CLAW = `<svg viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke-linecap="round">${[[22, 8, 42, 60, 30, 112], [52, 2, 72, 60, 60, 118], [84, 8, 102, 60, 92, 112]].map(([a, b, c, d, e, f]) => `<path pathLength="1" d="M${a} ${b} Q${c} ${d} ${e} ${f}" stroke="#5a0c06" stroke-width="13"/><path pathLength="1" d="M${a} ${b} Q${c} ${d} ${e} ${f}" stroke="#ff5a3d" stroke-width="7"/><path pathLength="1" d="M${a} ${b} Q${c} ${d} ${e} ${f}" stroke="#ffe0c8" stroke-width="2.4"/>`).join('')}</svg>`;
const SLASH = `<svg viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke-linecap="round"><path pathLength="1" d="M4 24 Q150 8 296 16" stroke="rgba(255,200,90,.55)" stroke-width="18" vector-effect="non-scaling-stroke"/><path pathLength="1" d="M4 24 Q150 8 296 16" stroke="#fff6d8" stroke-width="7" vector-effect="non-scaling-stroke"/><path pathLength="1" d="M4 24 Q150 8 296 16" stroke="#fff" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
const TOMB = `<svg viewBox="0 0 80 96" aria-hidden="true"><path d="M10 92 V36 A30 30 0 0 1 70 36 V92 Z" fill="#9a93a3" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M16 88 V38 A24 24 0 0 1 40 13" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/><path d="M40 30 V62 M29 42 H51" stroke="#5f5868" stroke-width="6" stroke-linecap="round"/><path d="M58 50 l-6 8 l4 5 l-5 9" fill="none" stroke="#5f5868" stroke-width="2.5" stroke-linecap="round"/><path d="M2 94 q8 -12 12 0 q6 -14 12 0 q6 -12 12 0 q6 -14 12 0 q6 -12 12 0 q6 -14 14 0 Z" fill="#6fae4a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`;
const GHOST = `<svg viewBox="0 0 60 70" aria-hidden="true"><path d="M6 64 V28 A24 24 0 0 1 54 28 V64 l-8 -7 l-8 7 l-8 -7 l-8 7 l-8 -7 Z" fill="#f4f1ff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="22" cy="30" rx="4.5" ry="6" fill="${INK}"/><ellipse cx="38" cy="30" rx="4.5" ry="6" fill="${INK}"/><ellipse cx="30" cy="45" rx="5" ry="4" fill="${INK}"/></svg>`;
const SWORD = `<svg viewBox="0 0 40 120" aria-hidden="true"><path d="M20 2 L28 16 L26 82 L14 82 L12 16 Z" fill="#e9eef5" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M20 8 V80" stroke="#b9c3cf" stroke-width="2.5"/><rect x="3" y="82" width="34" height="9" rx="4" fill="#e8c15a" stroke="${INK}" stroke-width="3.5"/><rect x="15" y="91" width="10" height="20" rx="3" fill="#7a4b2c" stroke="${INK}" stroke-width="3.5"/><circle cx="20" cy="114" r="5" fill="#e8c15a" stroke="${INK}" stroke-width="3"/></svg>`;
const DAGGER = `<svg viewBox="0 0 30 80" aria-hidden="true"><path d="M15 2 L21 14 L19 52 L11 52 L9 14 Z" fill="#e9eef5" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="3" y="52" width="24" height="7" rx="3" fill="#8f6bc9" stroke="${INK}" stroke-width="3"/><rect x="11" y="59" width="8" height="16" rx="3" fill="#3d3a42" stroke="${INK}" stroke-width="3"/></svg>`;

function bolt(k, x0, y0, x1, y1, color = '#bfe6ff') {
  const n = 9, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : rnd(-26, 26);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    pts.push(`${(x0 + dx * t + (-dy / len) * j).toFixed(1)},${(y0 + dy * t + (dx / len) * j).toFixed(1)}`);
  }
  const p = pts.join(' ');
  const s = k.el('cn-bolt', `<svg width="${vw()}" height="${vh()}" viewBox="0 0 ${vw()} ${vh()}"><polyline points="${p}" fill="none" stroke="${color}" stroke-opacity=".45" stroke-width="12" stroke-linejoin="round"/><polyline points="${p}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>`);
  k.a(s, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.25, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { dur: 420, ease: EASE.lin });
  k.rm(s, 440);
}
function flash(k, color = 'rgba(255,255,255,.75)', dur = 260, delay = 0) {
  const f = k.el('cn-flash', '', { background: color });
  k.a(f, [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }], { dur, delay, ease: EASE.out });
  k.rm(f, dur + delay + 30);
}
function ring(k, x, y, cls = '', size = 1, dur = 620, delay = 0) {
  const r = k.pt('cn-ring ' + cls, '', x, y);
  k.a(r, [{ transform: `scale(${0.25 * size})`, opacity: 1 }, { transform: `scale(${3.2 * size})`, opacity: 0 }], { dur, delay, ease: EASE.out });
  k.rm(r, dur + delay + 30);
}
// не даём надписи вылезти за край экрана
function fitIn(n, x) {
  const w = n.offsetWidth;
  n.style.left = Math.max(w / 2 + 10, Math.min(vw() - w / 2 - 10, x)) + 'px';
}
function stamp(k, x, y, title, sub = '', cls = '', hold = 1100) {
  const s = k.pt('cn-stamp ' + cls, `<b></b>${sub ? '<small></small>' : ''}`, x, clampY(y, 60));
  s.querySelector('b').textContent = title;
  if (sub) s.querySelector('small').textContent = sub;
  fitIn(s, x);
  k.a(s, [{ transform: 'scale(2.6) rotate(-9deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-2deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(-3deg)', opacity: 1 }], { dur: 300, ease: EASE.in });
  k.a(s, [{ transform: 'scale(1) rotate(-3deg)', opacity: 1 }, { transform: 'translateY(-26px) scale(.96) rotate(-3deg)', opacity: 0 }], { dur: 340, delay: 300 + hold, fill: 'forwards', ease: EASE.in });
  k.rm(s, 300 + hold + 380);
  return s;
}
function tag(k, el, text, cls = '', hold = 900, sub = '') {
  const r = box(el);
  // над аватаркой, а если она у верхнего края экрана — под ней
  const below = r && r.top < 110;
  const c = r ? { x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8 } : focus();
  const t = k.pt('cn-tag ' + cls + (below ? ' below' : ''), `<b></b>${sub ? '<small></small>' : ''}`, clampX(c.x, 110), clampY(c.y, 34));
  t.querySelector('b').textContent = text;
  if (sub) t.querySelector('small').textContent = sub;
  fitIn(t, c.x);
  k.a(t, [{ transform: 'translateY(10px) scale(.4)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { dur: 320, ease: EASE.out });
  k.a(t, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-22px)' }], { dur: 380, delay: 320 + hold, fill: 'forwards' });
  k.rm(t, 320 + hold + 420);
}
function jolt(k, el, power = 1, dur = 420) {
  if (!el) return;
  const p = 7 * power;
  k.a(el, [{ transform: 'none' }, { transform: `translate(${-p}px, ${p * 0.4}px) rotate(${-2 * power}deg)` }, { transform: `translate(${p}px, ${-p * 0.4}px) rotate(${2 * power}deg)` }, { transform: `translate(${-p * 0.6}px, 0)` }, { transform: `translate(${p * 0.4}px, 0)` }, { transform: 'none' }], { dur, ease: EASE.lin, fill: 'none' });
}
const quake = (power = 1) => {
  const g = document.querySelector('.game');
  if (!g) return;
  fx.shake(g, power > 1.2 ? 'quake-hard' : 'quake');
};
// карта «летит» по дуге из одной точки в другую
function arc(a, b, lift, n = 6) {
  const pts = [];
  const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - lift;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y, t });
  }
  return pts;
}
function throwThing(k, html, fromEl, toEl, o = {}) {
  const tr = box(toEl);
  if (!tr) { o.hit?.(); return 0; }
  const fr = box(fromEl);
  const a = fr ? cen(fr) : { x: cen(tr).x, y: -60 }, b = cen(tr);
  const n = k.pt('cn-throw', html, a.x, a.y);
  const s0 = o.s0 ?? 0.32, s1 = o.s1 ?? 0.7, spin = o.spin ?? 340;
  const dur = o.dur || 560;
  k.a(n, arc(a, b, o.lift ?? 110).map(p => ({ transform: `translate(${p.x - a.x}px, ${p.y - a.y}px) rotate(${-20 + spin * p.t}deg) scale(${s0 + (Math.sin(p.t * Math.PI) * 0.45) + (s1 - s0) * p.t})`, opacity: p.t > 0.92 ? 0.85 : 1 })), { dur, ease: 'cubic-bezier(.4,.1,.5,1)' });
  k.rm(n, dur + 10);
  k.snd('whoosh');
  if (o.trail !== false) for (let i = 1; i < 5; i++) k.at(dur * i / 5, () => { const p = cen(box(n)); fx.spray(p, { n: 3, speed: [10, 40], size: [1.5, 3], colors: o.trail || ['#fff3b0', '#ffd36b'], shape: 'star', life: [0.3, 0.5] }); });
  k.at(dur, () => o.hit?.());
  return dur;
}
function impact(k, el, text, good, colors) {
  if (!el) return;
  const c = cen(box(el));
  fx.float(el, text, good ? 'good' : 'bad');
  fx.burst(c, { n: 20, colors: colors || (good ? ['#8ff0d2', '#3fa38c', '#fff'] : ['#ff8a66', '#d2502f', '#ffd27a']), speed: 260 });
  ring(k, c.x, c.y, good ? 'good' : 'bad', 0.45, 480);
  fx.shake(el, 'bump');
}
// частицы в тон монстру: огонь, вода, нежить, грибы…
function themeBurst(d, c, fit) {
  const kind = sceneKind(d.tags || []);
  const area = { x: c.x, y: c.y, w: 230 * fit, h: 320 * fit };
  switch (kind) {
    case 'fire':
      fx.spray(area, { n: 46, speed: [120, 420], angle: [-Math.PI, 0], g: -120, size: [1.6, 3.2], colors: ['#ffb347', '#ff7a2f', '#ffe08a', '#fff3b0'], shape: 'spark', life: [0.6, 1.2] });
      fx.spray(area, { n: 18, spreadX: 0.8, spreadY: 0.6, speed: [20, 70], angle: [-2.4, -0.7], g: -60, size: [10, 20], grow: [10, 30], colors: ['rgba(255,120,40,.35)', 'rgba(255,190,80,.3)'], shape: 'glow', life: [0.8, 1.4], fadeIn: true });
      break;
    case 'water':
      fx.spray(area, { n: 40, speed: [160, 420], angle: [-Math.PI * 0.95, -Math.PI * 0.05], g: 760, size: [2.5, 4.5], colors: ['#9ff0f5', '#bff7fa', '#5fc7d8', '#ffffff'], shape: 'drop', add: false, life: [0.7, 1.1] });
      fx.spray(area, { n: 16, spreadX: 0.7, spreadY: 0.5, speed: [20, 60], angle: [-2.2, -0.9], size: [3, 6], colors: ['rgba(190,245,255,.7)'], shape: 'dot', life: [0.8, 1.4], wob: [2, 4], fadeIn: true });
      break;
    case 'undead':
      fx.spray(area, { n: 26, spreadX: 0.9, spreadY: 0.4, dy: 0.25, speed: [20, 80], angle: [-2.6, -0.5], g: -40, size: [14, 26], grow: [16, 34], colors: ['rgba(170,120,255,.32)', 'rgba(110,230,170,.26)', 'rgba(60,30,90,.4)'], shape: 'smoke', add: false, life: [1, 1.7], fadeIn: true, wob: [1, 3] });
      fx.spray(area, { n: 12, spreadX: 0.7, spreadY: 0.5, speed: [40, 110], angle: [-2, -1.1], size: [5, 9], colors: ['rgba(180,255,210,.7)', 'rgba(210,180,255,.7)'], shape: 'glow', life: [0.9, 1.5], wob: [2, 5] });
      break;
    case 'fungus':
      fx.spray(area, { n: 40, spreadX: 0.8, spreadY: 0.6, speed: [30, 140], angle: [-Math.PI, 0], g: -30, size: [2, 4.5], colors: ['#a6f2b7', '#d9ffe6', '#c78bff', '#ffd0f0'], shape: 'dot', life: [1, 1.8], wob: [2, 5], fadeIn: true });
      break;
    case 'metro':
      fx.spray(area, { n: 36, speed: [200, 520], size: [1.4, 2.6], colors: ['#bfe6ff', '#ffffff', '#ffe08a', '#8fd0ff'], shape: 'spark', g: 500, life: [0.35, 0.7] });
      break;
    case 'rock':
      fx.dust(area, { n: 30, rocks: 16 });
      break;
    default:
      fx.spray(area, { n: 30, speed: [150, 380], size: [1.6, 3], colors: ['#ffe08a', '#f5b83d', '#fff3b0'], shape: 'spark', g: 300, life: [0.5, 0.9] });
  }
  fx.dust(area, { n: 22, rocks: kind === 'rock' ? 0 : 6 });
}
// чем рычит монстр: нежить стонет, насекомые жужжат, слизь и грибы хлюпают
export const growlKind = d => { const t = d?.tags || []; return d?.boss ? 'demon' : t.includes('undead') ? 'ghost' : t.includes('insect') ? 'bug' : t.includes('fungus') ? 'slime' : t.includes('water') ? 'water' : t.includes('fire') ? 'fire' : ''; };
const tierOf = d => {
  if (d.boss) return { lv: d.level, tier: 'hell', boss: true, hell: true };
  const lv = d.mirror != null ? 15 : d.level || 1;
  return { lv, tier: lv >= 16 ? 'boss' : lv >= 12 ? 'high' : lv >= 6 ? 'mid' : 'low', boss: lv >= 14 || d.mirror != null };
};
// стена адского огня снизу экрана и пепел, летящий вверх
function hellfire(k, dur = 1600) {
  const W = vw(), H = vh();
  fx.spray({ x: W / 2, y: H + 6, w: W, h: 0 }, { n: 90, spreadX: 1, speed: [220, 520], angle: [-1.85, -1.3], g: -40, size: [2.4, 5.5], colors: ['#ff4a1a', '#ff8a3d', '#ffd27a', '#ff2a10'], shape: 'dot', life: [0.7, 1.4], delay: [0, dur / 1000] });
  fx.spray({ x: W / 2, y: H + 6, w: W, h: 0 }, { n: 50, spreadX: 1, speed: [60, 160], angle: [-1.8, -1.35], g: -30, size: [1.2, 2.4], colors: ['#ffe6a0', '#ffb347'], shape: 'spark', life: [1.4, 2.4], delay: [0, dur / 1000] });
  const wall = k.el('cn-hellwall', '');
  k.a(wall, [{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.25 }, { opacity: 0.85, transform: 'translateY(4%)', offset: 0.75 }, { opacity: 0, transform: 'translateY(30%)' }], { dur: dur + 600, ease: EASE.io });
  k.rm(wall, dur + 650);
}

// ───────────── дверь ─────────────
// возвращает момент (мс), когда из двери вылетает карта
function door(k, c, fit) {
  const dr = k.pt('cn-door', DOOR, c.x, c.y);
  const sc = fit * 1.02;
  k.a(dr, [{ transform: `scale(${sc * 0.6})`, opacity: 0 }, { transform: `scale(${sc})`, opacity: 1 }], { dur: 260, ease: EASE.back });
  k.a(dr, [{ transform: `scale(${sc})` }, { transform: `scale(${sc}) translateX(-6px) rotate(-1.2deg)` }, { transform: `scale(${sc}) translateX(6px) rotate(1.2deg)` }, { transform: `scale(${sc}) translateX(-3px)` }, { transform: `scale(${sc})` }], { dur: 240, delay: 270, fill: 'none', ease: EASE.lin });
  const [l, r] = dr.querySelectorAll('.cn-leaf');
  k.a(l, [{ transform: 'perspective(900px) rotateY(0deg)' }, { transform: 'perspective(900px) rotateY(-14deg)', offset: 0.18 }, { transform: 'perspective(900px) rotateY(-112deg)' }], { dur: 560, delay: 500, ease: 'cubic-bezier(.4,.05,.2,1)' });
  k.a(r, [{ transform: 'perspective(900px) rotateY(0deg)' }, { transform: 'perspective(900px) rotateY(14deg)', offset: 0.18 }, { transform: 'perspective(900px) rotateY(112deg)' }], { dur: 560, delay: 500, ease: 'cubic-bezier(.4,.05,.2,1)' });
  k.a(dr.querySelector('.cn-doorlight'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0.6, transform: 'scale(1.15)' }], { dur: 700, delay: 560 });
  const glow = k.pt('cn-doorglow', '', c.x, c.y);
  k.a(glow, [{ opacity: 0, transform: `scale(${fit * 0.35})` }, { opacity: 1, transform: `scale(${fit * 1.2})`, offset: 0.3 }, { opacity: 0, transform: `scale(${fit * 1.9})` }], { dur: 1000, delay: 580 });
  k.rm(glow, 1650);
  k.snd('doorOpen', {}, 430);
  k.at(300, () => fx.dust({ x: c.x, y: c.y + 150 * fit, w: 220 * fit, h: 10 }, { n: 8 }));
  k.at(620, () => fx.spray({ x: c.x, y: c.y + 40 * fit, w: 180 * fit, h: 240 * fit }, { n: 18, spreadX: 0.9, spreadY: 0.9, speed: [20, 90], size: [2, 4], colors: ['#fff3b0', '#ffe08a', '#ffffff'], shape: 'star', life: [0.6, 1.1], fadeIn: true }));
  k.fade(dr, 1050, 320);
  return 640;
}
function sigil(k, c, fit, cls) {
  const w = k.pt('cn-sigil ' + cls, `<div class="cn-sigil-tilt"><div class="cn-sigil-in">${SIGIL}</div></div>`, c.x, c.y + 150 * fit);
  const inner = w.querySelector('.cn-sigil-in');
  k.a(w, [{ opacity: 0, transform: `scale(${fit * 0.2})` }, { opacity: 1, transform: `scale(${fit})`, offset: 0.3 }, { opacity: 1, transform: `scale(${fit * 1.05})`, offset: 0.75 }, { opacity: 0, transform: `scale(${fit * 1.3})` }], { dur: 1500, ease: EASE.out });
  k.a(inner, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(220deg)' }], { dur: 1500, ease: EASE.lin });
  k.rm(w, 1520);
  k.snd('portal');
  k.at(120, () => fx.spray({ x: c.x, y: c.y + 150 * fit, w: 200 * fit, h: 40 * fit }, { n: 26, spreadX: 1, spreadY: 0.6, speed: [60, 200], angle: [-2.2, -0.9], g: -40, size: [2, 4], colors: cls === 'wander' ? ['#ffb08a', '#ff7a5a', '#fff3b0'] : ['#d9b3ff', '#b88ae6', '#fff'], shape: 'dot', life: [0.6, 1.2] }));
  return 300;
}

// ───────────── сцены ─────────────
const S = {};

// появление монстра: из выбитой двери, из магического круга (монстр из руки) или как подкрепление
S.intro = (f, o) => {
  const d = def(f.card);
  const { lv, tier, boss } = tierOf(d);
  return {
    skip() { unhide(f.card); },
    run(k) {
      closePanel();
      const c = { x: vw() / 2, y: vh() * 0.44 };
      const fit = fitBig();
      const hell = !!d.boss;
      const dim = k.el('cn-dim ' + tier);
      k.a(dim, [{ opacity: 0 }, { opacity: 1 }], { dur: hell ? 600 : 240 });
      if (hell) { k.snd('bossRise'); quake(0.6); k.at(200, () => hellfire(k, 1500)); }
      const t0 = o.door ? door(k, c, fit) : sigil(k, c, fit, hell ? 'hell' : o.wandering ? 'wander' : tier);
      const rays = k.pt('cn-rays ' + tier, raysSVG(), c.x, c.y);
      k.a(rays, [{ opacity: 0, transform: `scale(${fit * 0.5}) rotate(0deg)` }, { opacity: 1, transform: `scale(${fit}) rotate(28deg)`, offset: 0.3 }, { opacity: 0, transform: `scale(${fit * 1.1}) rotate(80deg)` }], { dur: 1700, delay: t0 - 60, ease: EASE.lin });
      const aura = k.pt('cn-aura ' + tier, '', c.x, c.y);
      k.a(aura, [{ opacity: 0, transform: `scale(${fit * 0.3})` }, { opacity: 1, transform: `scale(${fit})`, offset: 0.25 }, { opacity: 0.8, transform: `scale(${fit * 1.1})`, offset: 0.7 }, { opacity: 0, transform: `scale(${fit * 0.9})` }], { dur: 1450, delay: t0 });
      const card = k.pt('cn-card', cardHTML(f.card, { size: 'lg', tab: false }), c.x, c.y);
      k.a(card, [
        { transform: `scale(${fit * 0.1}) rotate(-16deg)`, opacity: 0 },
        { transform: `scale(${fit * 1.18}) rotate(4deg)`, opacity: 1, offset: 0.55 },
        { transform: `scale(${fit * 0.95}) rotate(-1.5deg)`, offset: 0.8 },
        { transform: `scale(${fit}) rotate(0deg)`, opacity: 1 }], { dur: 540, delay: t0, ease: EASE.out });
      // монстр «дышит», пока висит в центре
      k.a(card.firstElementChild, [{ transform: 'scale(1)' }, { transform: 'scale(1.035) translateY(-3px)' }, { transform: 'scale(1)' }], { dur: 900, delay: t0 + 540, it: 2, ease: EASE.io, fill: 'none' });
      k.snd('growl', { pitch: 1.35 - Math.min(lv, 20) / 28, dur: 0.6 + Math.min(lv, 20) / 40, kind: growlKind(d) }, t0 + (hell ? 1200 : 60));
      k.at(t0 + 290, () => {
        ring(k, c.x, c.y, tier, fit, 700);
        if (tier === 'high' || tier === 'boss') ring(k, c.x, c.y, tier, fit * 0.7, 800, 90);
        quake(boss ? 1.6 : 1);
        themeBurst(d, c, fit);
        sfx.play('boom', { k: boss ? 1.2 : lv >= 8 ? 0.9 : 0.65 });
        if (hell) {
          flash(k, 'rgba(255,60,20,.6)', 480);
          bolt(k, c.x - 300 * fit, 0, c.x - 110 * fit, c.y + 40, '#ff7a4a');
          k.at(110, () => bolt(k, c.x + 300 * fit, 0, c.x + 120 * fit, c.y - 20, '#ffb347'));
          k.at(260, () => bolt(k, c.x - 40 * fit, 0, c.x + 10 * fit, c.y - 160 * fit, '#ff4a1a'));
          k.at(240, () => { quake(2.2); ring(k, c.x, c.y, 'hell', fit * 1.3, 900); });
          sfx.play('thunder');
          fx.vignette('rgba(200,20,0,.75)');
          k.at(260, () => stamp(k, c.x, Math.max(70, c.y - 168 * fit - 34), 'Босс!', d.quote || '', 'hell', 1300));
        } else if (boss) {
          flash(k, 'rgba(255,40,30,.42)', 360);
          bolt(k, c.x - 260 * fit, 0, c.x - 110 * fit, c.y + 40, '#ff9a8a');
          k.at(130, () => bolt(k, c.x + 280 * fit, 0, c.x + 120 * fit, c.y - 20, '#ffb3ff'));
          sfx.play('thunder');
          fx.spray({ x: c.x, y: vh() + 10, w: vw(), h: 0 }, { n: 40, spreadX: 1, speed: [120, 300], angle: [-1.9, -1.25], g: -60, size: [1.5, 3], colors: ['#ff8a3d', '#ffb347', '#ff5a3d'], shape: 'spark', life: [1, 1.8], delay: [0, 0.6] });
        } else flash(k, 'rgba(255,240,210,.28)', 220);
      });
      const sub = hell ? `${o.wandering ? 'Из темноты · ' : ''}сила ${f.power ?? '×2'} — ${f.power != null && f.power <= BOSS_FLOOR ? 'меньше не бывает' : 'вдвое больше героя'}` : o.wandering ? 'Подкрепление!' : boss ? 'Босс подземелья' : 'Уровень ' + (d.mirror != null ? '?' : lv);
      const plate = k.pt('cn-plate ' + tier, `<span class="cn-lv">${d.mirror != null ? '?' : lv}</span><span><small>${sub}</small><b></b></span>`, c.x, Math.min(vh() - 40, c.y + 168 * fit + 30));
      plate.querySelector('b').textContent = d.name;
      k.a(plate, [{ opacity: 0, transform: 'translateY(16px) scale(.6)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.06)', offset: 0.65 }, { opacity: 1, transform: 'none' }], { dur: 340, delay: t0 + 330, ease: EASE.out });
      let T = t0 + (hell ? 2300 : 1000);
      if (o.ambush) {
        k.at(t0 + 640, () => {
          const cl = k.pt('cn-claw big', CLAW, c.x, c.y);
          cl.querySelectorAll('path').forEach((p, i) => k.a(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { dur: 160, delay: Math.floor(i / 3) * 55, ease: EASE.out }));
          k.fade(cl, 520, 260);
          fx.vignette('rgba(210,40,20,.7)');
          flash(k, 'rgba(255,60,30,.35)', 260);
          quake(1.6);
          stamp(k, c.x, Math.max(70, c.y - 168 * fit - 34), 'Засада!', '', 'bad', 560);
          sfx.play('claw'); sfx.play('ambush', { delay: 0.05 });
        });
        T += 460;
      }
      k.at(T, () => {
        k.a(dim, [{ opacity: 1 }, { opacity: 0 }], { dur: 380, fill: 'forwards' });
        k.a(plate, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { dur: 220, fill: 'forwards' });
        k.a(aura, [{ opacity: 0.8 }, { opacity: 0 }], { dur: 260, fill: 'forwards' });
        k.rm(dim, 400); k.rm(plate, 240); k.rm(aura, 280); k.rm(rays, 300);
        const tr = box(realCard(f.card));
        if (!tr) { k.a(card, [{ opacity: 1 }, { opacity: 0, transform: `scale(${fit * 0.8})` }], { dur: 280, fill: 'forwards' }); k.rm(card, 300); unhide(f.card); return; }
        const cw = card.firstElementChild.offsetWidth || 236;
        const s = tr.width / cw;
        const dx = tr.left + tr.width / 2 - c.x, dy = tr.top + tr.height / 2 - c.y;
        k.a(card, [{ transform: `scale(${fit})` }, { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 50}px) scale(${(fit + s) / 2 * 1.06}) rotate(-7deg)`, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)` }], { dur: 400, ease: EASE.io, fill: 'forwards' });
        k.snd('whoosh');
        k.at(400, () => {
          card.remove();
          unhide(f.card, true);
          const real = realCard(f.card);
          fx.dust(real, { n: 18, rocks: 4 });
          sfx.play('slam');
          fx.shake(document.getElementById('stage'), 'quake');
          clash(k);
        });
      });
      return T + 520;
    },
  };
};
// щиты героев и монстров сшибаются
function clash(k) {
  const h = document.getElementById('shieldHero'), m = document.getElementById('shieldMon');
  if (!h || !m) return;
  const hr = box(h), mr = box(m);
  if (!hr || !mr) return;
  const horiz = Math.abs(hr.top - mr.top) < hr.height;
  const dx = horiz ? 26 : 0, dy = horiz ? 0 : 18;
  k.a(h, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) rotate(6deg) scale(1.08)`, offset: 0.4 }, { transform: 'none' }], { dur: 420, ease: EASE.io, fill: 'none' });
  k.a(m, [{ transform: 'none' }, { transform: `translate(${-dx}px, ${-dy}px) rotate(-6deg) scale(1.08)`, offset: 0.4 }, { transform: 'none' }], { dur: 420, ease: EASE.io, fill: 'none' });
  k.at(170, () => {
    const vs = box(document.querySelector('#stage .versus'));
    const p = vs ? cen(vs) : { x: (cen(hr).x + cen(mr).x) / 2, y: (cen(hr).y + cen(mr).y) / 2 };
    fx.burst(p, { n: 26, speed: 340, colors: ['#fff3b0', '#ffd36b', '#ffffff', '#ff8a66'] });
    ring(k, p.x, p.y, '', 0.4, 420);
    sfx.play('clang');
  });
}

// выбитая дверь без монстра: карта вылетает из двери и ложится на стол
S.reveal = f => ({
  skip() { unhide(f.card); },
  run(k) {
    closePanel();
    const d = def(f.card);
    const c = { x: vw() / 2, y: vh() * 0.44 };
    const fit = fitBig() * 0.92;
    const dim = k.el('cn-dim soft');
    k.a(dim, [{ opacity: 0 }, { opacity: 1 }], { dur: 240 });
    const t0 = door(k, c, fit);
    const kind = d.type === 'curse' ? 'curse' : d.type === 'location' ? 'loc' : d.type === 'event' ? 'event' : 'item';
    const rays = k.pt('cn-rays ' + kind, raysSVG(), c.x, c.y);
    k.a(rays, [{ opacity: 0, transform: `scale(${fit * 0.5})` }, { opacity: 1, transform: `scale(${fit}) rotate(25deg)`, offset: 0.35 }, { opacity: 0, transform: `scale(${fit * 1.1}) rotate(60deg)` }], { dur: 1300, delay: t0 - 60, ease: EASE.lin });
    k.rm(rays, t0 + 1300);
    const card = k.pt('cn-card', cardHTML(f.card, { size: 'lg', tab: false }), c.x, c.y);
    k.a(card, [{ transform: `scale(${fit * 0.1}) rotateY(180deg)`, opacity: 0 }, { transform: `scale(${fit * 1.1}) rotateY(-20deg)`, opacity: 1, offset: 0.6 }, { transform: `scale(${fit}) rotateY(0deg)`, opacity: 1 }], { dur: 520, delay: t0, ease: EASE.out });
    k.snd('flip', {}, t0);
    k.at(t0 + 280, () => {
      fx.spray(c, { n: 26, speed: [120, 320], size: [2, 4], colors: kind === 'curse' ? ['#d9b3ff', '#b88ae6', '#fff'] : ['#fff3b0', '#ffe08a', '#ffffff'], shape: 'star', life: [0.5, 1] });
      ring(k, c.x, c.y, kind, fit * 0.8, 600);
    });
    const T = t0 + 820;
    k.at(T, () => {
      k.a(dim, [{ opacity: 1 }, { opacity: 0 }], { dur: 340, fill: 'forwards' }); k.rm(dim, 360);
      const tr = box(realCard(f.card));
      if (!tr) { k.a(card, [{ opacity: 1 }, { opacity: 0, transform: `scale(${fit * 0.7})` }], { dur: 300, fill: 'forwards' }); k.rm(card, 320); unhide(f.card); return; }
      const s = tr.width / (card.firstElementChild.offsetWidth || 236);
      const dx = tr.left + tr.width / 2 - c.x, dy = tr.top + tr.height / 2 - c.y;
      k.a(card, [{ transform: `scale(${fit})` }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(fit + s) / 2}) rotate(6deg)`, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { dur: 380, ease: EASE.io, fill: 'forwards' });
      k.snd('whoosh');
      k.at(380, () => { card.remove(); unhide(f.card, true); sfx.play('place'); fx.sparkle(realCard(f.card), { n: 10 }); });
    });
    return T + 420;
  },
});

// кто-то бросает карту в бой: вылетает из его аватарки и бьёт по щиту
function throwScene(f, o) {
  return {
    minor: true,
    quick() { o.hit?.(null); },
    run(k) {
      const mine = f.pid === api.meId();
      const to = o.to();
      const hit = () => o.hit?.(k, to);
      if (mine && o.uid) { k.at(480, hit); return 520; } // свою карту уже несёт полёт из руки
      const from = api.avaOf(f.pid);
      const dur = throwThing(k, o.html || cardHTML(o.uid, { size: 'sm', tab: false }), from, to, { hit, trail: o.trail, s1: o.s1, spin: o.spin });
      return dur + 160;
    },
  };
}
S.mod = f => throwScene(f, {
  uid: f.card, to: () => shieldEl(f.side === 'monster' ? 'mon' : 'hero'),
  hit: (k, el) => { if (!k) return; impact(k, el, `${f.n > 0 ? '+' : '−'}${Math.abs(f.n)}`, f.side !== 'monster'); sfx.play(f.side === 'monster' ? 'modBad' : 'modGood'); },
});
S.enhance = f => throwScene(f, {
  uid: f.card, to: () => shieldEl('mon'),
  hit: (k, el) => {
    if (!k) return;
    const d = def(f.card);
    impact(k, el, d.double ? '×2' : `${d.bonus > 0 ? '+' : '−'}${Math.abs(d.bonus)}`, d.bonus < 0, d.bonus < 0 ? null : ['#ff8a66', '#d2502f', '#ffd27a']);
    sfx.play(d.bonus < 0 ? 'modGood' : 'enhance');
    if (!(d.bonus < 0)) { const m = document.querySelector('#stage .mon-wrap:last-child .mon-body'); if (m) k.a(m, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'scale(1)' }], { dur: 420, fill: 'none' }); }
  },
});
S.backstab = f => throwScene({ ...f, pid: f.by }, {
  html: `<div class="cn-dagger">${DAGGER}</div>`, s0: 0.8, s1: 1, spin: 720, trail: ['#d9b3ff', '#8f6bc9'],
  to: () => api.heroAva(f.pid) || shieldEl('hero'),
  hit: (k, el) => {
    if (!k) return;
    const c = cen(box(el));
    const sl = k.pt('cn-slash small', SLASH, c.x, c.y);
    sl.style.transform = 'rotate(-35deg)';
    sl.querySelectorAll('path').forEach(p => k.a(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { dur: 140 }));
    k.fade(sl, 200, 200);
    impact(k, shieldEl('hero'), '−2', false);
    sfx.play('backstab');
  },
});
S.lullaby = f => ({
  minor: true,
  run(k) {
    const from = api.avaOf(f.pid) || shieldEl('hero'), to = shieldEl('mon');
    fx.notes(from, to);
    sfx.play('lullaby');
    k.at(650, () => { impact(k, to, `−${LULLABY_PENALTY}`, true); const z = box(to); if (z) zzz(k, cen(z), 3); });
    return 800;
  },
});
S.mutagen = f => ({
  run(k) {
    const el = shieldEl('hero');
    const c = cen(box(el));
    sfx.play('mutagen');
    const au = k.pt('cn-aura mutagen', '', c.x, c.y);
    k.a(au, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(.9)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.5)' }], { dur: 1200 });
    k.rm(au, 1220);
    fx.spray({ ...c, w: 120, h: 140 }, { n: 34, spreadX: 0.8, spreadY: 0.6, speed: [40, 140], angle: [-2.4, -0.7], g: -80, size: [3, 6], colors: ['rgba(140,255,180,.8)', 'rgba(60,220,150,.75)', '#e6fbff'], shape: 'dot', life: [0.8, 1.4], wob: [2, 5] });
    [0, 180, 360].forEach(t => ring(k, c.x, c.y, 'good', 0.5, 600, t));
    k.at(380, () => { impact(k, el, `+${MUTAGEN_BONUS}`, true, ['#a6f2b7', '#3fa38c', '#e6fbff']); stamp(k, c.x, c.y - 90, 'Мутаген!', `${api.pname(f.pid)}: +${MUTAGEN_BONUS} к силе`, 'good', 700); });
    return 1100;
  },
});
S.power = f => ({
  minor: true,
  run(k) {
    const hero = shieldEl('hero');
    const c = cen(box(hero));
    if (f.ab === 'rage') {
      sfx.play('boom', { k: 0.5 }); sfx.play('growl', { pitch: 1.6, dur: 0.4 });
      fx.spray({ ...c, w: 110, h: 120 }, { n: 44, spreadX: 0.9, spreadY: 0.5, dy: 0.3, speed: [80, 260], angle: [-2.3, -0.85], g: -160, size: [1.8, 3.2], colors: ['#ff7a2f', '#ffb347', '#ff4a2a', '#ffe08a'], shape: 'spark', life: [0.5, 1] });
      jolt(k, hero, 1.2);
      impact(k, hero, `Ярость +${f.n}`, true, ['#ff7a2f', '#ffb347', '#fff3b0']);
    } else if (f.ab === 'turn') {
      sfx.play('legendary', { gap: 0 });
      const mon = shieldEl('mon');
      beam(k, hero, mon, 'holy');
      k.at(260, () => { impact(k, hero, `+${f.n}`, true, ['#fff3b0', '#ffffff', '#a6f2ff']); fx.sparkle(mon, { n: 16, colors: ['#ffffff', '#fff3b0'] }); });
    } else {
      sfx.play('whoosh'); sfx.play('buff', { delay: 0.1 });
      const av = api.avaOf(f.pid) || hero;
      fx.spray(av, { n: 26, spreadX: 0.8, speed: [30, 90], angle: [-2.2, -0.9], g: -120, size: [2.5, 5], colors: ['#ffffff', '#cfeaff', '#a6f2ff'], shape: 'star', life: [0.7, 1.2], wob: [3, 6] });
      fx.float(av, `+${f.n} к побегу`, 'good');
    }
    return 650;
  },
});
function beam(k, fromEl, toEl, cls) {
  const a = cen(box(fromEl)), b = cen(box(toEl));
  const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const bm = k.el('cn-beam ' + cls, '', { left: a.x + 'px', top: a.y + 'px', width: len + 'px' });
  k.a(bm, [{ transform: `rotate(${ang}deg) scaleX(0)`, opacity: 1 }, { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.35 }, { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 0 }], { dur: 650, ease: EASE.out });
  k.rm(bm, 670);
}
S.buff = f => ({
  minor: true,
  run(k) {
    const av = api.avaOf(f.pid);
    fx.sparkle(av, { n: 18, colors: ['#ffb0c8', '#ff7aa8', '#fff3b0'] });
    const r = box(av); if (r) ring(k, cen(r).x, cen(r).y, 'good', 0.4, 500);
    fx.float(av, `+${f.n} в бою`, 'good');
    sfx.play('buff');
    return 450;
  },
});

// «Добить!»: герой заносит оружие
S.strike = f => ({
  minor: true,
  run(k) {
    const el = shieldEl('hero');
    const r = box(el);
    if (!r) return 0;
    const c = cen(r);
    const sw = k.pt('cn-sword', SWORD, c.x, c.y);
    k.a(sw, [{ transform: 'translate(-10px, 30px) rotate(-70deg) scale(.5)', opacity: 0 }, { transform: 'translate(0, -40px) rotate(-20deg) scale(1)', opacity: 1, offset: 0.4 }, { transform: 'translate(10px, -50px) rotate(25deg) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(14px, -54px) rotate(30deg) scale(.9)', opacity: 0 }], { dur: 700, ease: EASE.io });
    k.rm(sw, 720);
    sfx.play('shing');
    k.at(260, () => { ring(k, c.x, c.y, 'gold', 0.55, 520); fx.spray({ x: c.x, y: c.y - 50 }, { n: 16, speed: [60, 200], size: [2, 4], colors: ['#fff3b0', '#ffffff', '#ffd36b'], shape: 'star', life: [0.4, 0.8] }); });
    return 500;
  },
});

// подмога: аватар помощника перелетает на сторону героев
S.helper = f => ({
  run(k) {
    const from = api.avaOf(f.pid), to = api.heroAva(f.pid) || shieldEl('hero');
    const tr = box(to);
    if (!tr) return 0;
    // «Ты мой раб»: помощника тащат в бой в кандалах
    const forced = !!f.forced;
    sfx.play(forced ? 'clang' : 'charge');
    const dur = throwThing(k, `<div class="cn-avafly${forced ? ' chained' : ''}" style="--seat:${api.color(f.pid)}">${avatarSVG(api.avatar(f.pid), api.color(f.pid))}</div>`, from, to, { s0: 0.7, s1: 0.9, spin: 0, lift: forced ? 60 : 140, dur: forced ? 760 : 620, trail: forced ? ['#a9b2be', '#6b7480', '#ffffff'] : ['#8ff0d2', '#3fa38c', '#ffffff'],
      hit: () => { const c = cen(tr); ring(k, c.x, c.y, forced ? 'bad' : 'good', 0.55, 520); fx.sparkle(to, { n: 18, colors: forced ? ['#c9ced8', '#ffffff', '#8d96a3'] : ['#8ff0d2', '#ffffff', '#fff3b0'] }); fx.shake(shieldEl('hero'), 'bump'); if (forced) sfx.play('clang'); } });
    k.at(dur, () => { const c = cen(box(shieldEl('hero')) || tr); stamp(k, c.x, c.y - 90, forced ? 'Ты мой раб!' : 'На помощь!', forced ? `${api.pname(f.pid)} обязан помогать` : api.pname(f.pid), forced ? 'bad' : 'good', forced ? 900 : 650); });
    return dur + (forced ? 950 : 700);
  },
});

// победа: удар разрубает карту монстра, половинки разлетаются, клад летит к победителю
S.victory = f => ({
  run(k) {
    const uids = f.cards || [];
    const pos = uids.map(u => box(monEl(u))).filter(Boolean);
    const center = pos.length ? cen(pos[0]) : focus();
    uids.forEach((u, i) => k.at(i * 170, () => slashCard(k, u)));
    const base = (uids.length - 1) * 170;
    k.at(base + 330, () => {
      const p = focus();
      stamp(k, p.x, Math.min(p.y, center.y) - 60, 'Победа!', f.helper ? `${api.pname(f.pid)} и ${api.pname(f.helper)}` : api.pname(f.pid), 'win', 1050);
      const chips = [`+${f.levels || 1} ${f.levels > 1 ? (f.levels < 5 ? 'уровня' : 'уровней') : 'уровень'}`];
      if (f.treasures) chips.push(`+${f.treasures} клада`);
      const row = k.pt('cn-chips', chips.map(t => `<span>${t}</span>`).join(''), clampX(p.x, 100), clampY(Math.min(p.y, center.y) + 10, 80));
      row.querySelectorAll('span').forEach((s, i) => k.a(s, [{ opacity: 0, transform: 'translateY(12px) scale(.5)' }, { opacity: 1, transform: 'none' }], { dur: 300, delay: 180 + i * 120, ease: EASE.back }));
      k.fade(row, 1500, 300);
      fx.confetti({ at: { x: p.x, y: Math.min(p.y, center.y) - 40, w: 300, h: 0 }, n: 70 });
      sfx.play('victory');
    });
    k.at(base + 620, () => treasureRain(k, f));
    return base + 1650;
  },
});
function slashCard(k, uid) {
  const ce = monEl(uid);
  const r = box(ce);
  if (!r) return;
  const c = cen(r);
  const ang = Math.atan2(-0.4 * r.height, r.width) * 180 / Math.PI;
  const L = Math.hypot(r.width, 0.4 * r.height) * 1.9;
  // замах: карта вздрагивает от удара
  k.a(ce, [{ transform: 'none' }, { transform: 'translateX(-5px) rotate(-3deg) scale(1.04)' }, { transform: 'translateX(4px) rotate(2deg)' }], { dur: 120, ease: EASE.lin, fill: 'none' });
  const sl = k.pt('cn-slash', SLASH, c.x, c.y);
  sl.style.width = L + 'px'; sl.style.height = Math.max(40, r.height * 0.3) + 'px';
  sl.style.transform = `rotate(${ang}deg)`;
  sl.querySelectorAll('path').forEach(p => k.a(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { dur: 150, ease: EASE.out }));
  k.a(sl, [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { dur: 420, fill: 'forwards' });
  k.rm(sl, 440);
  sfx.play('slash');
  k.at(110, () => {
    flash(k, 'rgba(255,255,255,.55)', 180);
    quake(1);
    const html = ce.outerHTML;
    conceal(ce);
    const mk = cls => {
      const h = k.el('cn-half ' + cls, html, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      const inner = h.firstElementChild;
      if (inner) { inner.style.width = r.width + 'px'; inner.style.height = r.height + 'px'; inner.style.margin = '0'; inner.style.visibility = 'visible'; }
      return h;
    };
    const A = mk('a'), B = mk('b');
    k.a(A, [{ transform: 'none', opacity: 1 }, { transform: 'translate(16px, -22px) rotate(7deg)', opacity: 1, offset: 0.16 }, { transform: 'translate(70px, 300px) rotate(38deg)', opacity: 0 }], { dur: 950, ease: EASE.fall });
    k.a(B, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-12px, 14px) rotate(-5deg)', opacity: 1, offset: 0.16 }, { transform: 'translate(-60px, 320px) rotate(-30deg)', opacity: 0 }], { dur: 1000, ease: EASE.fall });
    k.rm(A, 960); k.rm(B, 1010);
    const gl = k.pt('cn-hitglow', '', c.x, c.y);
    k.a(gl, [{ opacity: 1, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(2.3)' }], { dur: 600 });
    k.rm(gl, 620);
    ring(k, c.x, c.y, 'gold', 0.7, 560);
    const rad = ang * Math.PI / 180;
    for (let i = -3; i <= 3; i++) {
      const p = { x: c.x + Math.cos(rad) * i * r.width * 0.16, y: c.y + Math.sin(rad) * i * r.width * 0.16 };
      fx.burst(p, { n: 7, speed: 300, colors: ['#fff3b0', '#ffffff', '#ffd36b', '#ff8a66'], g: 500 });
    }
    sfx.play('shatter');
  });
}
function treasureRain(k, f) {
  const deck = document.getElementById('deckTreasure');
  const n = Math.min(6, f.treasures || 0);
  const to = api.avaOf(f.pid), toH = f.helper ? api.avaOf(f.helper) : null;
  const from = box(deck) && onScreen(box(deck)) ? deck : null;
  for (let i = 0; i < n; i++) {
    const target = toH && i % 3 === 2 ? toH : to;
    k.at(i * 95, () => throwThing(k, `<div class="cn-tback">${cardBackSVG('treasure')}</div>`, from || document.getElementById('stage'), target, { s0: 0.6, s1: 0.45, spin: rnd(200, 420), lift: rnd(80, 170), dur: 640, trail: false,
      hit: () => { fx.sparkle(target, { n: 6 }); sfx.play('coins', { n: 1, gap: 0 }); } }));
  }
  if (to) k.at(n * 95 + 600, () => fx.coins(document.getElementById('stage'), to, { n: 8 }));
}

// не убежал: монстр бросается на героя, когти полосуют аватарку
S.caught = f => ({
  run(k) {
    const d = def(f.card);
    const ce = monEl(f.card);
    const r = box(ce);
    const av = api.avaOf(f.pid);
    const ar = box(av);
    const a = r ? cen(r) : focus();
    const b = ar ? cen(ar) : { x: vw() / 2, y: vh() * 0.8 };
    const m = k.pt('cn-mon', ce ? ce.outerHTML : cardHTML(f.card, { size: 'sm', tab: false }), a.x, a.y);
    conceal(ce);
    const dx = b.x - a.x, dy = b.y - a.y;
    const D = 1150;
    k.a(m, [
      { transform: 'none', offset: 0, easing: EASE.out },
      { transform: `translate(${-dx * 0.07}px, ${-dy * 0.07}px) scale(1.22) rotate(-9deg)`, offset: 0.3 },
      { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.25) rotate(-10deg)`, offset: 0.44, easing: 'cubic-bezier(.55,0,.85,.4)' },
      { transform: `translate(${dx * 0.9}px, ${dy * 0.9}px) scale(.95) rotate(12deg)`, offset: 0.66, easing: EASE.out },
      { transform: `translate(${dx * 0.62}px, ${dy * 0.62}px) scale(.86) rotate(5deg)`, opacity: 1, offset: 0.82 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(.7) rotate(0deg)`, opacity: 0 }], { dur: D, ease: EASE.lin });
    k.rm(m, D + 20);
    sfx.play('growl', { pitch: 1.1, dur: 0.5, kind: growlKind(d) });
    k.at(D * 0.44, () => sfx.play('dash'));
    k.at(D * 0.66, () => {
      const size = Math.max(110, (ar?.width || 80) * 1.7);
      const cl = k.pt('cn-claw', CLAW, b.x, b.y);
      cl.style.width = cl.style.height = size + 'px';
      cl.querySelectorAll('path').forEach((p, i) => k.a(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { dur: 150, delay: Math.floor(i / 3) * 50, ease: EASE.out }));
      k.fade(cl, 650, 300);
      const hit = k.pt('cn-hit', '', b.x, b.y);
      k.a(hit, [{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(2)' }], { dur: 500 });
      k.rm(hit, 520);
      fx.vignette('rgba(210,40,20,.6)');
      fx.spray(b, { n: 26, speed: [120, 360], size: [2.5, 5], colors: ['#ff5a3d', '#ff8a66', '#ffd27a', '#fff'], shape: 'star', g: 400, life: [0.5, 0.9] });
      jolt(k, av?.closest('.opp') || av, 1.4, 480);
      quake(1);
      sfx.play('claw');
      const bad = (d.bad?.text || '').split(/(?<=[.!?])\s/)[0].slice(0, 70);
      tag(k, av, 'Расплата!', 'bad', 1100, bad);
    });
    return D + 450;
  },
});
// удрал: монстр промахивается и уносится прочь, за героем пыль и линии скорости
S.escaped = f => ({
  run(k) {
    const ce = monEl(f.card);
    const r = box(ce);
    const av = api.avaOf(f.pid);
    const ar = box(av);
    const a = r ? cen(r) : focus();
    const b = ar ? cen(ar) : { x: vw() / 2, y: vh() * 0.8 };
    const m = k.pt('cn-mon', ce ? ce.outerHTML : cardHTML(f.card, { size: 'sm', tab: false }), a.x, a.y);
    conceal(ce);
    if (f.calm) {
      k.a(m, [{ transform: 'none' }, { transform: 'rotate(-6deg) scale(.96)', offset: 0.3 }, { transform: 'rotate(4deg) scale(.96)', offset: 0.6 }, { transform: 'translateY(20px) scale(.8)', opacity: 0 }], { dur: 1000, ease: EASE.io });
      k.rm(m, 1020);
      zzz(k, a, 2);
      tag(k, av, 'Не стал гнаться', 'good', 700);
      sfx.play('sleep');
      return 950;
    }
    const dx = b.x - a.x, dy = b.y - a.y;
    const side = dx >= 0 ? 1 : -1;
    k.a(m, [{ transform: 'none', easing: EASE.out }, { transform: `translate(${-dx * 0.05}px, ${-dy * 0.05}px) scale(1.12) rotate(-6deg)`, offset: 0.25, easing: 'cubic-bezier(.55,0,.85,.4)' },
      { transform: `translate(${dx * 0.75}px, ${dy * 0.75}px) scale(.9) rotate(8deg)`, offset: 0.55, easing: EASE.out },
      { transform: `translate(${dx * 0.75 + side * 260}px, ${dy * 0.75 + 40}px) scale(.7) rotate(${side * 30}deg)`, opacity: 0 }], { dur: 1000, ease: EASE.lin });
    k.rm(m, 1020);
    k.at(450, () => {
      sfx.play('dash');
      if (ar) {
        const sp = k.pt('cn-speed', '', b.x - side * ar.width * 0.9, b.y);
        sp.style.width = ar.width * 2 + 'px'; sp.style.height = ar.height * 0.9 + 'px';
        k.a(sp, [{ opacity: 0, transform: `translateX(${side * 40}px) scaleX(.4)` }, { opacity: 1, transform: 'none', offset: 0.3 }, { opacity: 0, transform: `translateX(${-side * 60}px) scaleX(1.2)` }], { dur: 600 });
        k.rm(sp, 620);
        fx.dust(av, { n: 14 });
      }
      jolt(k, av?.closest('.opp') || av, 0.6, 300);
      tag(k, av, 'Удрал!', 'good', 800);
    });
    return 1050;
  },
});
S.pet = f => ({
  run(k) {
    const av = api.avaOf(f.pid);
    const ce = f.mon ? monEl(f.mon) : null;
    const r = box(ce);
    fx.hearts(av);
    sfx.play('pet');
    if (r) {
      const a = cen(r);
      const m = k.pt('cn-mon', ce.outerHTML, a.x, a.y);
      conceal(ce);
      k.a(m, [{ transform: 'none' }, { transform: 'translateX(-10px) rotate(-8deg) scale(1.05)', offset: 0.2 }, { transform: 'translateX(40px) translateY(-30px) rotate(20deg) scale(.8)', opacity: 0 }], { dur: 800, ease: EASE.io });
      k.rm(m, 820);
      k.at(150, () => { fx.burst(a, { n: 18, colors: ['#ff7aa8', '#ffb0c8', '#fff'] }); sfx.play('clang'); });
    }
    tag(k, av, `${def(f.card).name} спасает!`, 'good', 900);
    return 950;
  },
});
// монстр исчез без боя: дымовая шашка, окаменение, чары
S.vanish = f => ({
  run(k) {
    const els = (f.cards || []).map(monEl).filter(Boolean);
    if (f.how === 'smoke') {
      const p = els.length ? cen(box(els[0])) : focus();
      sfx.play('poof');
      fx.spray({ ...p, w: 320, h: 200 }, { n: 46, spreadX: 1, spreadY: 0.8, speed: [30, 160], g: -20, size: [18, 34], grow: [30, 60], colors: ['rgba(150,140,170,.55)', 'rgba(110,100,130,.5)', 'rgba(190,170,220,.45)'], shape: 'smoke', add: false, life: [0.9, 1.6], fadeIn: true });
      if (panel) k.a(panel.node, [{ opacity: 1 }, { opacity: 0.05 }], { dur: 500, delay: 150, fill: 'forwards' });
      stamp(k, p.x, p.y - 40, 'Пуф!', 'Герои растворились в дыму', 'curse', 800);
      return 1250;
    }
    els.forEach(ce => {
      const r = box(ce); if (!r) return;
      const c = cen(r);
      const m = k.pt('cn-mon', ce.outerHTML, c.x, c.y);
      conceal(ce);
      if (f.how === 'stone') {
        m.classList.add('petrify');
        sfx.play('stone');
        const cr = k.el('cn-crack', `<svg viewBox="0 0 100 140" preserveAspectRatio="none"><path pathLength="1" d="M48 0 L56 30 L40 52 L60 76 L44 104 L54 140 M56 30 L80 44 M40 52 L18 66 M60 76 L84 92" fill="none" stroke="#2a2430" stroke-width="3"/></svg>`, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        cr.querySelectorAll('path').forEach(p => k.a(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { dur: 380, delay: 300 }));
        k.a(m, [{ transform: 'none', opacity: 1 }, { transform: 'none', opacity: 1, offset: 0.6 }, { transform: 'translateY(30px) scale(.96)', opacity: 0 }], { dur: 1200, ease: EASE.in });
        k.rm(m, 1220); k.fade(cr, 750, 300);
        k.at(760, () => { fx.dust({ ...c, w: r.width, h: r.height }, { n: 24, rocks: 18 }); quake(0.8); });
        tag(k, ce, 'Окаменел!', 'good', 800);
      } else {
        sfx.play('sleep');
        k.a(m, [{ transform: 'none' }, { transform: 'rotate(12deg) translateY(6px)', offset: 0.5 }, { transform: 'rotate(16deg) translateY(16px) scale(.9)', opacity: 0 }], { dur: 1200, ease: EASE.io });
        k.rm(m, 1220);
        zzz(k, { x: c.x + r.width * 0.3, y: r.top + 10 }, 4);
        tag(k, ce, 'Уснул!', 'good', 800);
      }
    });
    return 1300;
  },
});
function zzz(k, p, n) {
  for (let i = 0; i < n; i++) {
    const z = k.pt('cn-z', 'z', p.x, p.y);
    z.style.fontSize = 18 + i * 7 + 'px';
    k.a(z, [{ opacity: 0, transform: 'translate(0, 0) scale(.5)' }, { opacity: 1, transform: `translate(${10 + i * 10}px, ${-20 - i * 18}px) scale(1)`, offset: 0.4 }, { opacity: 0, transform: `translate(${24 + i * 14}px, ${-60 - i * 26}px) scale(1.1)` }], { dur: 1100, delay: i * 200, ease: EASE.out });
    k.rm(z, 1100 + i * 200 + 20);
  }
}

// проклятие: магический круг, молнии, лиловый дым
S.curse = (f, o = {}) => ({
  run(k) {
    const av = api.avaOf(f.pid);
    const ar = box(av);
    const b = ar ? cen(ar) : focus();
    let t = 0;
    if (o.fromDoor) {
      const src = realCard(f.card) || document.querySelector('#stage .reveal-slot .card');
      if (src && av) t = throwThing(k, cardHTML(f.card, { size: 'sm', tab: false }), src, av, { s0: 0.8, s1: 0.4, spin: 360, trail: ['#d9b3ff', '#b88ae6'] });
    } else if (f.by && f.by !== api.meId()) t = throwThing(k, cardHTML(f.card, { size: 'sm', tab: false }), api.avaOf(f.by), av, { s1: 0.45, trail: ['#d9b3ff', '#b88ae6'] });
    else if (f.by === api.meId()) t = 450;
    k.at(t, () => {
      const size = Math.max(130, (ar?.width || 80) * 2);
      const sg = k.pt('cn-sigil curse flat', `<div class="cn-sigil-tilt"><div class="cn-sigil-in">${SIGIL}</div></div>`, b.x, b.y);
      sg.style.width = sg.style.height = size + 'px';
      k.a(sg, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.3)' }], { dur: 1100 });
      k.a(sg.querySelector('.cn-sigil-in'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-200deg)' }], { dur: 1100, ease: EASE.lin });
      k.rm(sg, 1120);
      sfx.play('curse');
      k.at(200, () => {
        bolt(k, b.x - 40, Math.max(0, b.y - 260), b.x - 6, b.y, '#d9b3ff');
        k.at(110, () => bolt(k, b.x + 50, Math.max(0, b.y - 240), b.x + 8, b.y, '#b88ae6'));
        flash(k, 'rgba(170,110,255,.28)', 260);
        fx.smoke(av, { n: 22 });
        jolt(k, av?.closest('.opp') || av, 1, 420);
        sfx.play('zap');
        tag(k, av, 'Проклятие!', 'curse', 900, def(f.card).name);
      });
    });
    return t + 1150;
  },
});
S.ward = f => ({
  run(k) {
    const av = api.avaOf(f.pid);
    const r = box(av); if (!r) return 0;
    const c = cen(r);
    const bub = k.pt('cn-bubble', '', c.x, c.y);
    bub.style.width = bub.style.height = r.width * 1.5 + 'px';
    k.a(bub, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.35 }, { opacity: 1, transform: 'scale(1)', offset: 0.7 }, { opacity: 0, transform: 'scale(1.35)' }], { dur: 1000 });
    k.rm(bub, 1020);
    sfx.play('ward');
    k.at(680, () => fx.burst(c, { n: 20, colors: ['#a6f2ff', '#ffffff', '#8ff0d2'], speed: 220 }));
    tag(k, av, 'Отвёл проклятие!', 'good', 800);
    return 900;
  },
});
S.death = f => ({
  run(k) {
    const av = api.avaOf(f.pid);
    const r = box(av);
    const c = r ? cen(r) : focus();
    const w = Math.max(64, (r?.width || 70) * 1.05);
    const tb = k.pt('cn-tomb', TOMB, c.x, c.y);
    tb.style.width = w + 'px'; tb.style.height = w * 1.2 + 'px';
    const top = Math.min(220, c.y + w);
    k.a(tb, [{ transform: `translateY(${-top}px) rotate(-12deg)`, opacity: 0 }, { transform: `translateY(${-top * 0.9}px) rotate(-12deg)`, opacity: 1, offset: 0.1, easing: 'cubic-bezier(.5,0,1,.6)' }, { transform: 'translateY(6px) rotate(3deg)', offset: 0.42, easing: EASE.out }, { transform: 'translateY(-8px) rotate(-2deg)', offset: 0.55 }, { transform: 'translateY(0) rotate(0deg)', opacity: 1, offset: 0.68 }, { transform: 'translateY(0)', opacity: 1, offset: 0.9 }, { transform: 'translateY(0)', opacity: 0 }], { dur: 1700, ease: EASE.lin });
    k.rm(tb, 1720);
    sfx.play('death');
    k.at(1700 * 0.42, () => { fx.dust({ x: c.x, y: c.y + w * 0.5, w: w * 1.6, h: 10 }, { n: 16, rocks: 5 }); sfx.play('slam'); jolt(k, av?.closest('.opp') || av, 1, 360); });
    k.at(800, () => {
      const g = k.pt('cn-ghost', GHOST, c.x, c.y - 10);
      g.style.width = w * 0.7 + 'px'; g.style.height = w * 0.82 + 'px';
      k.a(g, [{ opacity: 0, transform: 'translateY(0) scale(.6)' }, { opacity: 0.95, transform: 'translate(-8px, -40px) scale(1)', offset: 0.35 }, { opacity: 0.8, transform: 'translate(10px, -80px) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-4px, -120px) scale(.9)' }], { dur: 1200, ease: EASE.io });
      k.rm(g, 1220);
    });
    tag(k, av, 'Погиб!', 'bad', 1000);
    return 1500;
  },
});
S.levelUp = f => ({
  minor: true,
  quick() { fx.float(api.avaOf(f.pid), `+${f.to - f.from} ур.`, 'good'); },
  run(k) {
    const av = api.avaOf(f.pid);
    const r = box(av);
    if (!r) return 0;
    const c = cen(r);
    const pl = k.el('cn-pillar', '', { left: c.x + 'px', top: '0px', height: c.y + 'px', width: r.width * 0.9 + 'px' });
    k.a(pl, [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'scaleY(1) scaleX(1.8)', opacity: 0 }], { dur: 900, ease: EASE.out });
    k.rm(pl, 920);
    ring(k, c.x, c.y, 'gold', r.width / 180, 600);
    fx.rise(av);
    fx.float(av, `+${f.to - f.from} ур.`, 'good');
    const lvl = api.lvlEl(f.pid);
    if (lvl) k.a(lvl, [{ transform: 'rotateX(0) scale(1)' }, { transform: 'rotateX(180deg) scale(1.5)', offset: 0.5 }, { transform: 'rotateX(360deg) scale(1)' }], { dur: 600, ease: EASE.io, fill: 'none' });
    sfx.play('levelUp');
    const W = api.winLevel?.() || 10;
    if (f.to >= W) stamp(k, c.x, c.y - 70, `${W}-й уровень!`, api.pname(f.pid), 'legend', 900);
    return 650;
  },
});
S.levelDown = f => ({
  minor: true,
  quick() { fx.float(api.avaOf(f.pid), `−${f.from - f.to} ур.`, 'bad'); },
  run(k) {
    const av = api.avaOf(f.pid);
    fx.drops(av);
    fx.float(av, `−${f.from - f.to} ур.`, 'bad');
    jolt(k, av?.closest('.opp') || av, 0.8, 380);
    const r = box(av); if (r) { const c = cen(r); ring(k, c.x, c.y, 'bad', r.width / 200, 500); }
    const lvl = api.lvlEl(f.pid);
    if (lvl) k.a(lvl, [{ transform: 'translateY(0)' }, { transform: 'translateY(6px) scale(.8)', offset: 0.4 }, { transform: 'none' }], { dur: 420, fill: 'none' });
    sfx.play('levelDown');
    return 500;
  },
});

// легендарная вещь: витрина с лучами и нимбом
S.legendary = f => ({
  run(k) {
    const d = def(f.card);
    const c = { x: vw() / 2, y: vh() * 0.44 };
    const fit = fitBig();
    const dim = k.el('cn-dim legend');
    k.a(dim, [{ opacity: 0 }, { opacity: 1 }], { dur: 300 });
    const rays = k.pt('cn-rays legend', raysSVG(), c.x, c.y);
    k.a(rays, [{ opacity: 0, transform: `scale(${fit * 0.4}) rotate(0deg)` }, { opacity: 1, transform: `scale(${fit * 1.1}) rotate(40deg)`, offset: 0.3 }, { opacity: 1, transform: `scale(${fit * 1.15}) rotate(100deg)`, offset: 0.8 }, { opacity: 0, transform: `scale(${fit * 1.2}) rotate(125deg)` }], { dur: 2300, ease: EASE.lin });
    const halo = k.pt('cn-halo', '', c.x, c.y);
    k.a(halo, [{ opacity: 0, transform: `scale(${fit * 0.5}) rotate(0deg)` }, { opacity: 1, transform: `scale(${fit}) rotate(90deg)`, offset: 0.3 }, { opacity: 1, transform: `scale(${fit}) rotate(240deg)`, offset: 0.8 }, { opacity: 0, transform: `scale(${fit * 1.1}) rotate(300deg)` }], { dur: 2300, ease: EASE.lin });
    const card = k.pt('cn-card', cardHTML(f.card, { size: 'lg', tab: false }), c.x, c.y);
    k.a(card, [{ transform: `scale(${fit * 0.15}) rotateY(720deg)`, opacity: 0 }, { transform: `scale(${fit * 1.12}) rotateY(20deg)`, opacity: 1, offset: 0.7 }, { transform: `scale(${fit}) rotateY(0deg)`, opacity: 1 }], { dur: 900, ease: EASE.out });
    sfx.play('legendary', { always: true });
    k.at(650, () => {
      fx.spray({ ...c, w: 300 * fit, h: 380 * fit }, { n: 40, spreadX: 1, spreadY: 1, speed: [20, 90], size: [3, 6], colors: ['#fff3b0', '#ffd56a', '#ffffff', '#a6f2ff', '#ffb0e0'], shape: 'star', life: [0.8, 1.5], fadeIn: true, delay: [0, 0.8] });
      fx.burst(c, { n: 40, colors: ['#ffe08a', '#f5b83d', '#fff', '#d9b3ff'], speed: 380, g: 100 });
      ring(k, c.x, c.y, 'legend', fit, 800);
      flash(k, 'rgba(255,240,200,.4)', 300);
    });
    stamp(k, c.x, Math.max(64, c.y - 168 * fit - 62), 'Легендарная вещь!', `${d.name} достаётся игроку ${api.pname(f.pid)}`, 'legend', 1300).style.zIndex = 3;
    k.at(1900, () => {
      k.a(dim, [{ opacity: 1 }, { opacity: 0 }], { dur: 400, fill: 'forwards' }); k.rm(dim, 420); k.rm(rays, 450); k.rm(halo, 450);
      const tr = box(api.avaOf(f.pid));
      if (!tr) { k.fade(card, 0, 300); return; }
      const t = cen(tr);
      k.a(card, [{ transform: `scale(${fit})`, opacity: 1 }, { transform: `translate(${(t.x - c.x) * 0.5}px, ${(t.y - c.y) * 0.5 - 60}px) scale(${fit * 0.6}) rotate(-10deg)`, opacity: 1, offset: 0.5 }, { transform: `translate(${t.x - c.x}px, ${t.y - c.y}px) scale(.18) rotate(-20deg)`, opacity: 0.4 }], { dur: 520, ease: EASE.io, fill: 'forwards' });
      k.rm(card, 540);
      k.snd('whoosh');
      k.at(520, () => { fx.sparkle(api.avaOf(f.pid), { n: 22, colors: ['#fff3b0', '#ffd56a', '#ffffff', '#a6f2ff'] }); fx.burst(t, { n: 26, colors: ['#ffe08a', '#f5b83d', '#fff'], speed: 260 }); ring(k, t.x, t.y, 'legend', 0.5, 500); });
    });
    return 2500;
  },
});

// показать карту в центре: вылетает рубашкой вперёд и переворачивается
function showcase(k, uid, cls) {
  const c = { x: vw() / 2, y: vh() * 0.42 };
  const fit = fitBig() * 0.85;
  const card = k.pt('cn-card', cardHTML(uid, { size: 'lg', tab: false }), c.x, c.y);
  k.a(card, [{ transform: `translateY(60px) scale(${fit * 0.3}) rotateY(-180deg)`, opacity: 0 }, { transform: `scale(${fit * 1.06}) rotateY(12deg)`, opacity: 1, offset: 0.65 }, { transform: `scale(${fit}) rotateY(0deg)`, opacity: 1 }], { dur: 560, ease: EASE.out });
  k.snd('flip');
  k.at(300, () => { ring(k, c.x, c.y, cls, fit * 0.8, 600); fx.spray(c, { n: 20, speed: [120, 300], size: [2, 4], shape: 'star', colors: ['#fff3b0', '#ffffff', '#ffe08a'], life: [0.5, 0.9] }); });
  return { card, c, fit };
}
function caption(k, x, y, title, text, cls, hold = 1100) {
  const cp = k.pt('cn-caption ' + cls, `<b></b><small></small>`, clampX(x, 40), clampY(y, 60));
  cp.querySelector('b').textContent = title;
  cp.querySelector('small').textContent = text;
  k.a(cp, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { dur: 300, ease: EASE.out });
  k.fade(cp, 300 + hold, 300);
}
S.location = (f, o = {}) => ({
  run(k) {
    const d = def(f.card);
    const dim = k.el('cn-dim soft');
    k.a(dim, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { dur: 1900 });
    k.rm(dim, 1920);
    const c = { x: vw() / 2, y: vh() * 0.42 };
    const iris = k.pt('cn-iris', '', c.x, c.y);
    k.a(iris, [{ opacity: 0, transform: 'scale(.1)' }, { opacity: 1, transform: 'scale(1)', offset: 0.25 }, { opacity: 0, transform: 'scale(4.5)' }], { dur: 1300, ease: EASE.out });
    k.rm(iris, 1320);
    sfx.play('location');
    let card = null;
    if (o.fromDoor) {
      const src = realCard(f.card);
      const r = box(src);
      if (r) { card = k.pt('cn-card', src.outerHTML, cen(r).x, cen(r).y); src.style.visibility = 'hidden'; k.at(1500, () => { if (src.isConnected) src.style.visibility = ''; }); }
    } else card = showcase(k, f.card, 'loc').card;
    k.at(260, () => fx.ambient({ x: c.x, y: c.y, w: Math.min(vw(), 700), h: 300 }, d.art));
    caption(k, c.x, Math.min(vh() - 70, c.y + 200), d.name, ruleText(d.text), 'loc', 1000);
    k.at(1350, () => {
      const pill = document.getElementById('locBanner');
      const tr = box(pill);
      if (!card) return;
      const cr = box(card);
      if (!tr || !cr) { k.fade(card, 0, 300); return; }
      const a = cen(cr), b = cen(tr);
      const cur = getComputedStyle(card).transform;
      k.a(card, [{ transform: cur === 'none' ? 'none' : cur, opacity: 1 }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(.12)`, opacity: 0.2 }], { dur: 480, ease: EASE.io, fill: 'forwards' });
      k.rm(card, 500);
      k.snd('whoosh');
      k.at(480, () => { if (pill) { fx.shake(pill, 'pop-in'); fx.sparkle(pill, { n: 12, colors: ['#a6f2d8', '#ffffff', '#fff3b0'] }); } });
    });
    return 1850;
  },
});
S.event = (f, o = {}) => ({
  run(k) {
    const d = def(f.card);
    const dim = k.el('cn-dim soft');
    k.a(dim, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { dur: 1900 });
    k.rm(dim, 1920);
    const c = { x: vw() / 2, y: vh() * 0.42 };
    let card = null;
    if (!o.fromDoor) card = showcase(k, f.card, 'event').card;
    sfx.play('event');
    caption(k, c.x, Math.min(vh() - 70, c.y + 200), d.name, ruleText(d.text), 'event', 1100);
    k.at(420, () => {
      const W = vw(), H = vh();
      switch (d.event) {
        case 'quake':
          quake(2); sfx.play('quake');
          fx.spray({ x: W / 2, y: -10, w: W, h: 0 }, { n: 40, spreadX: 1, speed: [0, 60], angle: [1.2, 1.9], g: 1100, size: [3, 7], colors: ['#8b8494', '#6a6572', '#a39b8a'], shape: 'rock', add: false, life: [1, 1.5], delay: [0, 0.5] });
          fx.dust({ x: W / 2, y: H - 20, w: W, h: 10 }, { n: 30 });
          break;
        case 'light': {
          const pl = k.el('cn-pillar wide', '', { left: W / 2 + 'px', top: '0px', height: H + 'px', width: Math.min(W, 420) + 'px' });
          k.a(pl, [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'scaleY(1) scaleX(1.6)', opacity: 0 }], { dur: 1200 });
          k.rm(pl, 1220);
          fx.spray({ x: W / 2, y: H * 0.4, w: 400, h: H * 0.8 }, { n: 40, spreadX: 1, spreadY: 1, speed: [10, 60], size: [3, 6], colors: ['#fff3b0', '#ffffff'], shape: 'star', life: [0.8, 1.5], fadeIn: true });
          break;
        }
        case 'fair':
          fx.spray({ x: W / 2, y: -20, w: W * 0.8, h: 0 }, { n: 34, spreadX: 1, speed: [0, 80], angle: [1.3, 1.85], g: 700, size: [5, 8], shape: 'coin', add: false, life: [1.2, 1.8], delay: [0, 0.6] });
          fx.confetti({ n: 60 });
          sfx.play('coins', { n: 6 });
          break;
        case 'draft': {
          const wd = k.el('cn-wind');
          k.a(wd, [{ transform: 'translateX(-60%)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translateX(60%)', opacity: 0 }], { dur: 1100, ease: EASE.io });
          k.rm(wd, 1120);
          fx.spray({ x: -20, y: H * 0.5, w: 0, h: H * 0.6 }, { n: 30, spreadY: 1, speed: [500, 900], angle: [-0.25, 0.25], ax: 0, g: 40, size: [3, 6], colors: ['#f3ede0', '#e4d8c0', '#fff7e6'], shape: 'confetti', add: false, life: [1, 1.6], wob: [3, 6] });
          sfx.play('whoosh'); sfx.play('dash', { delay: 0.2 });
          break;
        }
        case 'luxtax':
          fx.spray({ x: W / 2, y: H * 0.3, w: W * 0.6, h: 0 }, { n: 26, spreadX: 1, speed: [100, 260], angle: [-2.6, -0.5], g: 900, size: [5, 8], shape: 'coin', add: false, life: [1, 1.4] });
          sfx.play('levelDown');
          break;
        default:
          fx.burst({ x: W / 2, y: H * 0.42 }, { n: 34, speed: 360, g: 160 });
          fx.sparkle({ x: W / 2, y: H * 0.3, w: W * 0.8, h: 120 }, { n: 26 });
          sfx.play('bell');
      }
    });
    if (card) k.at(1500, () => { k.a(card, [{ opacity: 1 }, { opacity: 0, transform: `${getComputedStyle(card).transform === 'none' ? '' : getComputedStyle(card).transform} translateY(-30px)` }], { dur: 320, fill: 'forwards' }); k.rm(card, 340); });
    return 1850;
  },
});

// кубик — тоже часть очереди, чтобы не накладывался на удары
S.dice = f => ({
  minDur: 1500,
  skip() {},
  run(k) {
    const host = document.getElementById('fx');
    if (!host) return 0;
    const label = `${api.pname(f.pid)}: ${f.label || 'бросок'}${f.bonus ? ` (${f.bonus > 0 ? '+' : ''}${f.bonus})` : ''} — ${f.ok ? 'успех' : 'неудача'}`;
    fx.dice(host, f.value, f.ok, label);
    sfx.play('dice', { always: true });
    setTimeout(() => sfx.play(f.ok ? 'diceOk' : 'diceFail', { always: true }), 900);
    setTimeout(() => {
      const die = host.querySelector('.die3-scene');
      if (die) { const c = cen(box(die)); ring(k, c.x, c.y, f.ok ? 'good' : 'bad', 0.6, 520); if (f.ok) fx.spray(c, { n: 16, speed: [80, 240], shape: 'star', size: [2.5, 5], colors: ['#8ff0d2', '#ffffff', '#fff3b0'], life: [0.5, 0.9] }); }
    }, 900);
    setTimeout(() => { host.innerHTML = ''; }, 2050);
    return 2100;
  },
});

const PANEL_KINDS = new Set(['victory', 'caught', 'escaped', 'pet', 'vanish']);
// порядок внутри одной пачки событий: появление → вмешательство → кубик → развязка → последствия
const RANK = { combat: 1, wandering: 1, strike: 2, helper: 2, mod: 2, enhance: 2, backstab: 2, lullaby: 2, mutagen: 2, power: 2, buff: 2, dice: 3, escaped: 4, caught: 4, pet: 4, vanish: 4, victory: 5, location: 6, event: 6, curse: 6, ward: 6.5, death: 7, levelUp: 8, levelDown: 8, legendary: 9 };

export const cine = {
  get on() { return enabled && !reduced(); },
  get idle() { return !busy && !Q.length; },
  get lite() { return lite; },
  setLite(v) { lite = !!v; fx.quality = v ? 0.5 : 1; },
  get enabled() { return enabled; },
  set(v) { enabled = !!v; try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* приватный режим */ } if (!enabled) clearAll(); },
  init(a) { api = a; },
  snapStage,
  // карты, к которым полетит «двойник», прячем ещё до первой отрисовки, чтобы они не мигнули
  prehide(list) {
    if (!this.on || document.hidden) return;
    for (const f of list) {
      if (f.kind === 'reveal' && def(f.card)?.type !== 'monster') hide(f.card);
      if (f.kind === 'combat' || f.kind === 'wandering') hide(f.card);
    }
  },
  decorate() {
    for (const uid of hidden.keys()) hideTarget(uid)?.classList.add('cine-hide');
    document.querySelectorAll('#stage .mon-body').forEach(phase);
  },
  play(list, snap) {
    if (!api) return;
    if (document.hidden) { [...hidden.keys()].forEach(unhide); return; }
    const reveal = list.find(f => f.kind === 'reveal');
    const kinds = new Set(list.map(f => f.kind));
    const doorCard = reveal?.card;
    const items = list.filter(f => RANK[f.kind] !== undefined).map((f, i) => ({ f, i })).sort((a, b) => RANK[a.f.kind] - RANK[b.f.kind] || a.i - b.i).map(x => x.f);
    const scenes = [];
    const dt = reveal ? def(doorCard) : null;
    if (reveal && dt.type !== 'monster') scenes.push(S.reveal(reveal));
    const aftermath = !!snap && items.some(f => PANEL_KINDS.has(f.kind));
    let lastPanel = -1;
    for (const f of items) {
      let sc = null;
      switch (f.kind) {
        case 'combat': sc = S.intro(f, { door: f.card === doorCard, ambush: kinds.has('ambush') }); break;
        case 'wandering': sc = S.intro(f, { door: false, wandering: true }); break;
        case 'curse': sc = S.curse(f, { fromDoor: f.card === doorCard }); break;
        case 'location': sc = S.location(f, { fromDoor: f.card === doorCard }); break;
        case 'event': sc = S.event(f, { fromDoor: f.card === doorCard }); break;
        default: sc = S[f.kind]?.(f);
      }
      if (!sc) continue;
      scenes.push(sc);
      if (aftermath && (PANEL_KINDS.has(f.kind) || f.kind === 'dice')) lastPanel = scenes.length - 1;
    }
    if (aftermath && lastPanel >= 0) {
      openPanel(snap);
      scenes.splice(lastPanel + 1, 0, { run() { closePanel(); return 260; }, skip() { closePanel(true); } });
    }
    enqueue(...scenes);
  },
  // мой ход: лента «Ваш ход» проносится через экран
  turn() {
    if (!this.on) return;
    enqueue({
      minor: true,
      run(k) {
        const y = Math.max(90, vh() * 0.3);
        const rb = k.el('cn-turn', '<b>Ваш ход</b>', { top: y + 'px' });
        k.a(rb, [{ transform: 'translateX(-110vw) skewX(-12deg)' }, { transform: 'translateX(0) skewX(-12deg)', offset: 0.28 }, { transform: 'translateX(2vw) skewX(-12deg)', offset: 0.72 }, { transform: 'translateX(110vw) skewX(-12deg)' }], { dur: 1250, ease: EASE.io });
        k.rm(rb, 1270);
        const me = api.avaOf(api.meId());
        const r = box(me);
        if (r) k.at(300, () => { const c = cen(r); ring(k, c.x, c.y, 'gold', r.width / 170, 600); fx.sparkle(me, { n: 12 }); });
        return 700;
      },
    });
  },
  // конец партии: салют
  gameOver() {
    if (reduced()) return;
    const pops = fx.fireworks({ n: 10, span: 3.4 });
    pops.forEach((t, i) => { if (i < 7) setTimeout(() => sfx.play('firework', { fly: 0.05, gap: 0, always: true }), (t - 0.05) * 1000); });
  },
  clear: clearAll,
};
