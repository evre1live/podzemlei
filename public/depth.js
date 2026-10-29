// «Под Землёй» — объёмные карты и портреты.
// Карты: у рисунка есть карта глубины (art/depth.py), и пока карта в фокусе — она под курсором или открыта крупно —
// поверх рисунка работает один общий WebGL-холст: ближние планы сдвигаются сильнее дальних, картинка «выходит» из рамки.
// Крупная карта ещё и чуть наклоняется с бликом. Портреты: фон и герой — разные слои (art-avatar.js), при наведении
// они расходятся; крупные портреты (редактор, медальон в бою) покачиваются сами.
// На слабых устройствах и при «уменьшить движение» всё это выключено.
import { DEPTH } from '/depth-art.js';

// включено по умолчанию, кроме «уменьшить движение» и совсем слабых устройств; переключатель — в «Звук и эффекты»
export const depthDefault = () => !(matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.hardwareConcurrency || 4) <= 2);
export function depthOn() { try { const v = JSON.parse(localStorage.getItem('pz.depth3d')); return v ?? depthDefault(); } catch { return depthDefault(); } }
const still = () => !depthOn();
export function applyDepth() { document.documentElement.classList.toggle('no-depth', still()); if (still()) release(); }
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

// ───────── WebGL ─────────
const VS = `attribute vec2 a; varying vec2 v; void main(){ v = vec2(a.x * .5 + .5, .5 - a.y * .5); gl_Position = vec4(a, 0., 1.); }`;
const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D uImg, uDep;
uniform vec4 uMap;   // окно холста → координаты рисунка (как object-fit: cover)
uniform vec2 uOff;   // сдвиг взгляда
uniform float uZoom;
void main() {
  vec2 q = (v - .5) * uZoom + .5;
  vec2 uv = q * uMap.xy + uMap.zw;
  // несколько шагов: точка берёт глубину там, куда её сдвинуло, — края переднего плана не рвутся
  vec2 p = uv;
  for (int i = 0; i < 5; i++) { float d = texture2D(uDep, p).r; p = uv + uOff * (d - .42); }
  gl_FragColor = texture2D(uImg, clamp(p, 0., 1.));
}`;
let gl = null, cv = null, prog = null, loc = {}, texCache = new Map(), depCache = new Map();
function initGL() {
  if (gl !== null) return !!gl;
  cv = document.createElement('canvas');
  cv.className = 'depth-cv';
  gl = cv.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false }) || false;
  if (!gl) return false;
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = false; return false; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['uImg', 'uDep', 'uMap', 'uOff', 'uZoom']) loc[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(loc.uImg, 0); gl.uniform1i(loc.uDep, 1);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); gl = false; });
  return true;
}
function texFrom(src) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  return t;
}
const keep = (map, k, v) => { map.set(k, v); if (map.size > 24) { const [k0, t] = map.entries().next().value; map.delete(k0); gl?.deleteTexture?.(t); } return v; };
// у какого рисунка есть глубина: путь картинки без .webp → отпечаток файла в соседней папке d/
function depthUrl(img) {
  const u = new URL(img.currentSrc || img.src, location.href);
  const key = u.pathname.replace(/^\//, '').replace(/\.webp$/, '');
  const h = DEPTH.get(key);
  if (!h) return null;
  const i = key.lastIndexOf('/');
  return `/${key.slice(0, i)}/d/${key.slice(i + 1)}.webp?v=${h}`;
}
const depImgs = new Map();
function loadDepth(url) {
  if (depImgs.has(url)) return depImgs.get(url);
  const im = new Image(); im.decoding = 'async'; im.src = url;
  const p = im.decode().then(() => im, () => null);
  depImgs.set(url, p);
  return p;
}

// ───────── фокус: одна карта за раз ─────────
let cur = null; // { img, host, card, big, dep, url, tx, ty, px, py, inside, t0 }
let raf = 0;
async function focus(img, big) {
  if (still() || !img || cur?.img === img) return;
  const url = depthUrl(img);
  if (!url || !initGL()) return;
  release();
  const me = cur = { img, host: img.parentElement, card: img.closest('.card'), big, url, tx: 0, ty: 0, px: 0, py: 0, inside: false, t0: performance.now(), alpha: 0 };
  const dep = await loadDepth(url);
  if (cur !== me || !dep || !img.isConnected) return;
  if (!img.complete) await img.decode().catch(() => {});
  if (cur !== me) return;
  me.dep = dep;
  me.host.appendChild(cv);
  cv.style.opacity = '0';
  if (big && me.card) {
    me.card.classList.add('depth-tilt');
    me.glare = document.createElement('i'); me.glare.className = 'depth-glare'; me.card.appendChild(me.glare);
  }
  if (!raf) raf = requestAnimationFrame(frame);
}
function release(img) {
  if (!cur || (img && cur.img !== img)) return;
  const c = cur; cur = null;
  if (cv?.parentElement) cv.remove();
  c.card?.classList.remove('depth-tilt');
  if (c.card) { c.card.style.rotate = ''; }
  c.glare?.remove();
}
function frame(now) {
  raf = 0;
  const c = cur;
  if (!c) return;
  if (!c.img.isConnected) { release(); return; }
  const r = c.host.getBoundingClientRect();
  if (!r.width || !r.height) { raf = requestAnimationFrame(frame); return; }
  // взгляд: за курсором, а крупная карта без курсора сама плавно покачивается
  const t = (now - c.t0) / 1000;
  let gx = c.inside ? c.px : c.big ? Math.sin(t * 0.7) * 0.55 : 0;
  let gy = c.inside ? c.py : c.big ? Math.cos(t * 0.53) * 0.4 : 0;
  c.tx += (gx - c.tx) * 0.12; c.ty += (gy - c.ty) * 0.12;
  c.alpha = Math.min(1, c.alpha + 0.12);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  gl.viewport(0, 0, W, H);
  // object-fit: cover и object-position рисунка
  const iw = c.img.naturalWidth || 1, ih = c.img.naturalHeight || 1;
  const s = Math.max(r.width / iw, r.height / ih), dw = iw * s, dh = ih * s;
  const op = getComputedStyle(c.img).objectPosition.split(' ').map(x => (x.endsWith('%') ? parseFloat(x) / 100 : 0.5));
  const ox = (r.width - dw) * (op[0] ?? 0.5), oy = (r.height - dh) * (op[1] ?? 0.5);
  gl.uniform4f(loc.uMap, r.width / dw, r.height / dh, -ox / dw, -oy / dh);
  const amp = c.big ? 0.032 : 0.022;
  gl.uniform2f(loc.uOff, -c.tx * amp, -c.ty * amp * 0.75);
  gl.uniform1f(loc.uZoom, 0.955);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texCache.get(c.img.src) || keep(texCache, c.img.src, texFrom(c.img)));
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, depCache.get(c.url) || keep(depCache, c.url, texFrom(c.dep)));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  cv.style.opacity = String(c.alpha);
  if (c.big && c.card) {
    const mag = Math.hypot(c.tx, c.ty);
    c.card.style.rotate = mag > 0.001 ? `${(-c.ty / mag).toFixed(3)} ${(c.tx / mag).toFixed(3)} 0 ${(mag * 7).toFixed(2)}deg` : '';
    c.card.style.setProperty('--gx', `${50 + c.tx * 40}%`); c.card.style.setProperty('--gy', `${40 + c.ty * 35}%`);
  }
  raf = requestAnimationFrame(frame);
}

// крупная карта на экране (окно карты, справочник, сцена) — в фокусе сама; иначе фокус у карты под курсором
const BIG = '.pop > .card .c-pic > img.c-img, .g-zoom-in > .card .c-pic > img.c-img, .cn-card .c-pic > img.c-img';
export function depthScan() {
  const big = [...document.querySelectorAll(BIG)].filter(x => x.isConnected).at(-1);
  if (big) return focus(big, true);
  if (cur?.big) release();
}
function pointer(e) {
  const c = cur;
  if (c) {
    const r = c.host.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const card = c.card?.getBoundingClientRect();
    const near = card && e.clientX >= card.left && e.clientX <= card.right && e.clientY >= card.top && e.clientY <= card.bottom;
    c.inside = inside || near;
    if (c.inside) {
      const box = near ? card : r;
      c.px = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width) * 2 - 1));
      c.py = Math.max(-1, Math.min(1, ((e.clientY - box.top) / box.height) * 2 - 1));
    }
    if (!c.big && !c.inside) release();
  }
  // мышью — фокус у карты под курсором (если на экране нет крупной)
  if (e.pointerType === 'mouse' && finePointer.matches && !cur?.big) {
    const img = e.target.closest?.('.card')?.querySelector('.c-pic > img.c-img');
    if (img && img !== cur?.img) focus(img, false);
  }
  avatarPointer(e);
}

// ───────── портреты: фон и герой расходятся ─────────
let avHover = null;
function avatarPointer(e) {
  if (still()) return;
  const svg = e.target.closest?.('svg') ;
  const el = svg && svg.querySelector(':scope > g > .av-hero') ? svg : null;
  if (avHover && avHover !== el) { avHover.style.removeProperty('--pdx'); avHover.style.removeProperty('--pdy'); avHover.classList.remove('av-hover'); avHover = null; }
  if (!el || e.pointerType !== 'mouse') return;
  const r = el.getBoundingClientRect();
  el.classList.add('av-hover');
  el.style.setProperty('--pdx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
  el.style.setProperty('--pdy', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  avHover = el;
}

export function initDepth() {
  applyDepth();
  document.addEventListener('pointermove', pointer, { passive: true });
  document.addEventListener('pointerdown', pointer, { passive: true });
  // палец по крупной карте — она поворачивается за ним
  document.addEventListener('touchmove', e => { const t = e.touches[0]; if (t && cur?.big) pointer({ clientX: t.clientX, clientY: t.clientY, pointerType: 'touch', target: e.target }); }, { passive: true });
  document.addEventListener('touchend', () => { if (cur) cur.inside = false; }, { passive: true });
  // окно карты, справочник и сцены появляются и исчезают — проверяем, есть ли крупная карта
  new MutationObserver(() => { cancelAnimationFrame(scanT); scanT = requestAnimationFrame(depthScan); }).observe(document.body, { childList: true, subtree: true });
}
let scanT = 0;
