/* Под Землёй — стол от первого лица на three.js.
   Исходник: client/scene3d.js. Сборка: npm run build:3d → public/scene3d.js (window.PZ3D).

   Сцена только рисует: правила, ходы и клики живут в app.js. Поверх холста лежит обычная разметка игры
   (таблички соперников, бой, кнопки, рука) — PZ3D лишь сообщает, где на экране сидит герой и лежат колоды,
   поэтому все прежние сцены, эффекты и клики работают и в 3D.

   Зал собран из картины локации (/loc/v2): её пол ложится на пол, а дальняя стена с воротами встаёт
   вертикально за спинами соперников. Стол — столешница таверны из лобби, на нём сукно локации. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const TY = 0.76;          // высота столешницы, м
const RATIO = 1.5;        // карта: высота / ширина
const TABLE_K = 912 / 1400; // столешница-картинка: глубина / ширина
const LAMP_Y = 2.25;
const LAMP_I = 13;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const ease = k => 1 - Math.pow(1 - k, 3);
const easeIO = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- поддержка и качество
function supported() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch { return false; }
}
let lockedTier = false; // качество задано вручную (localStorage pz.q3d) — сами не понижаем
function pickTier() {
  try { const q = localStorage.getItem('pz.q3d'); if (q === 'low' || q === 'high') { lockedTier = true; return q; } } catch {}
  const coarse = matchMedia('(pointer: coarse)').matches;
  return coarse || Math.min(innerWidth, innerHeight) < 640 || (navigator.hardwareConcurrency || 4) <= 2 ? 'low' : 'high';
}

// ---------------------------------------------------------------- текстуры
let R = null; // всё живое состояние сцены
const loader = new THREE.TextureLoader();
const texCache = new Map();
function tex(url, opt = {}) {
  const key = url + '|' + (opt.repeat || '') + '|' + (opt.srgb === false ? 'l' : 's');
  if (texCache.has(key)) { const t = texCache.get(key); if (opt.onLoad && t.image) opt.onLoad(t); return t; }
  const t = loader.load(url, opt.onLoad, undefined, opt.onError);
  if (opt.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = R ? R.aniso : 4;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.repeat[0], opt.repeat[1]); }
  texCache.set(key, t);
  return t;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = R ? R.aniso : 4;
  return t;
}
function radialTex(stops, size = 128) {
  return canvasTex(size, size, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
const imgCache = new Map();
function img(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  return imgCache.get(src);
}

// ---------------------------------------------------------------- локации
// rect — где на картине пол арены: [слева, сверху, справа, снизу] в долях картинки. Всё, что выше, — дальняя стена.
// W — ширина пола в метрах, wallK — во сколько раз стена на картине «сплющена» взглядом сверху.
// vista — картина не арена сверху, а вид с земли: она целиком встаёт стеной, пол — тёмный.
// wl — средняя яркость стены на картине (замерена): по ней зал притушен так, чтобы стол оставался светлее фона.
const LOC_DEF = { rect: [0.05, 0.2, 0.94, 0.85], W: 11, wallK: 1.55, wl: 0.22 };
const LOC = {
  default: { wl: 0.22 },
  loc_dungeon: { rect: [0.05, 0.19, 0.95, 0.86], wl: 0.23 },
  loc_forge: { rect: [0.07, 0.24, 0.93, 0.8], wl: 0.32 },
  loc_ice: { rect: [0.07, 0.2, 0.92, 0.82], wl: 0.4 },
  loc_library: { rect: [0.1, 0.27, 0.9, 0.84], wl: 0.22 },
  loc_graveyard: { rect: [0.08, 0.22, 0.92, 0.84], wl: 0.25 },
  loc_tavern: { rect: [0.1, 0.24, 0.9, 0.86], wl: 0.21 },
  loc_cove: { rect: [0.1, 0.24, 0.9, 0.86], wl: 0.375 },
  loc_sky: { rect: [0.12, 0.23, 0.88, 0.86], wl: 0.38 },
  loc_oasis: { rect: [0.08, 0.2, 0.93, 0.86], wl: 0.4 },
  loc_glade: { wl: 0.32 },
  loc_grove: { wl: 0.29 },
  loc_koschei: { vista: true, horizon: 0.56, W: 15, wl: 0.15 },
  loc_flooded: { vista: true, horizon: 0.5, W: 15, wl: 0.19 },
};
// свет зала: цвет лампы над столом, заливки, тумана и пламени свечей
const ENV_DEF = { lamp: 0xffc68a, hemi: 0xa0815e, ground: 0x120a05, fog: 0x0b0806, fogD: 0.045, flame: 0xffa040, bg: 0x070504 };
const ENV = {
  loc_forge: { lamp: 0xffb070, hemi: 0xc0683a, fog: 0x140705, flame: 0xff7a20 },
  loc_ice: { lamp: 0xdfeaff, hemi: 0x8fb4d8, ground: 0x0a1018, fog: 0x0a1118, flame: 0xa8d8ff, bg: 0x060a10 },
  loc_sky: { lamp: 0xe6e2ff, hemi: 0x9a96d8, ground: 0x0c0a18, fog: 0x0c0a1a, flame: 0xffc070, bg: 0x08071a },
  loc_library: { lamp: 0xffd0a0, hemi: 0x8a6ab8, ground: 0x0e0a14, fog: 0x0d0914, flame: 0xc890ff, bg: 0x08060e },
  loc_graveyard: { lamp: 0xd8f0d8, hemi: 0x5a9a88, ground: 0x08100e, fog: 0x07100e, flame: 0x7af0b0, bg: 0x050a09 },
  loc_koschei: { lamp: 0xd8f0c8, hemi: 0x4a8a5a, ground: 0x060c08, fog: 0x050b07, flame: 0x70f090, bg: 0x040806 },
  loc_grove: { lamp: 0xe8f0c0, hemi: 0x6a9a58, ground: 0x0a0f08, fog: 0x080d07, flame: 0xc8f080, bg: 0x060905 },
  loc_glade: { lamp: 0xfff0c8, hemi: 0x8aa868, ground: 0x0c1008, fog: 0x0a0e07, flame: 0xffd070, bg: 0x070905 },
  loc_cove: { lamp: 0xffe0b0, hemi: 0x6aa8b8, ground: 0x08100f, fog: 0x08100f, flame: 0xffb050, bg: 0x060b0c },
  loc_flooded: { lamp: 0xd8e8f0, hemi: 0x4a7a8a, ground: 0x060c10, fog: 0x060c10, flame: 0xffc070, bg: 0x04080b },
  loc_oasis: { lamp: 0xffe2b0, hemi: 0xc8a068, fog: 0x120d07, flame: 0xffb040 },
  loc_tavern: { lamp: 0xffc080, hemi: 0xb07a48, fog: 0x100905, flame: 0xffa040 },
};
const locOf = key => { const L = { ...LOC_DEF, ...(LOC[key] || {}) }; L.dim = clamp(0.205 / L.wl, 0.5, 1.12); return L; };
const envOf = key => ({ ...ENV_DEF, ...(ENV[key] || {}) });
const locImg = key => `/loc/v2/${LOC[key] ? key : 'default'}${R && R.tier === 'high' && R.bigTex ? '@4k' : ''}.webp`;
const matImg = key => `/ui/table/v2/mat-${LOC[key] && key !== 'default' ? key.replace(/^loc_/, '') : 'default'}${R && R.tier === 'high' ? '' : '-1024'}.webp`;

// ---------------------------------------------------------------- шейдеры
const FIG_VS = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// портрет соперника: вырезанный герой (c/), карта света (g/: зелёный канал — кромка), подсветка хода и удара
const FIG_FS = `uniform sampler2D map; uniform float square; uniform vec3 tint; uniform vec3 rimCol; uniform float sat;
uniform float opacity; uniform float flash; uniform float light; uniform float ready; uniform float rim; uniform float ghost;
varying vec2 vUv;
void main(){
  if (ready < 0.5) discard;
  vec4 c = texture2D(map, vUv);
  float a = c.a * smoothstep(0.0, 0.1, vUv.y);
  // портрет без вырезки (квадрат с фоном) — мягкий овал, чтобы не стоял картонкой
  if (square > 0.5) { vec2 p = (vUv - vec2(0.5, 0.54)) * vec2(2.0, 1.9); a *= 1.0 - smoothstep(0.62, 1.0, length(p)); }
  vec3 col = c.rgb;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, sat);
  col *= tint * light * mix(0.72, 1.06, smoothstep(0.1, 0.9, vUv.y));
  float edge = clamp(c.a - texture2D(map, vUv + vec2(0.0, 0.014)).a, 0.0, 1.0);
  col += rimCol * edge * rim * light;
  col = mix(col, vec3(0.55, 0.8, 1.0) * (l * 0.9 + 0.25), ghost * 0.75);
  col = mix(col, vec3(0.95, 0.16, 0.08), flash);
  gl_FragColor = vec4(col, a * opacity * (1.0 - ghost * 0.45));
  if (gl_FragColor.a < 0.004) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// зал: картина локации, притушенная к краям и вверх; вспышка молнии или удара осветляет её целиком
const ROOM_FS = `uniform sampler2D map; uniform sampler2D map2; uniform float mixv; uniform vec3 tint; uniform float flash; uniform vec3 flashCol; uniform float ready;
varying vec2 vUv; varying float vShade; varying float vBlur;
void main(){
  vec3 c = texture2D(map, vUv, vBlur).rgb;
  if (mixv > 0.001) c = mix(c, texture2D(map2, vUv, vBlur).rgb, mixv);
  c *= tint * vShade * ready;
  c += flashCol * flash * (0.25 + dot(c, vec3(0.5)));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ROOM_VS = `attribute float shade; attribute float blur; uniform float soft; varying vec2 vUv; varying float vShade; varying float vBlur;
void main(){ vUv = uv; vShade = shade; vBlur = blur * soft; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ---------------------------------------------------------------- зал из картины локации
function roomGeometry(L, zFar) {
  const [uL, vT, uR, vB] = L.rect;
  const W = L.W;
  // картина нарисована взглядом сверху под ~55°: глубина пола на ней сжата, высота стены — ещё сильнее
  const D = (W * (((vB - vT) * 9) / ((uR - uL) * 16))) / 0.82;
  const NX = 72, NY = 60, r = 0.38, q = (r * Math.PI) / 2;
  const pos = [], uv = [], shade = [], blur = [], idx = [];
  for (let j = 0; j <= NY; j++) {
    // сетка гуще у стены: там изгиб
    const v = j / NY;
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      const fu = (u - uL) / (uR - uL), fv = (v - vT) / (vB - vT);
      let x = (fu - 0.5) * W, z = zFar + fv * D, y = 0;
      if (fv < 0) {
        const s = -fv * D * L.wallK * 0.82;
        if (s < q) { const a = s / r; z = zFar - r * Math.sin(a); y = r * (1 - Math.cos(a)); }
        else { z = zFar - r; y = r + (s - q); }
        z -= y * 0.05;
      }
      pos.push(x, y, z);
      uv.push(u, 1 - v);
      // свет: у стола светлее, к углам зала темнее; верх стены уходит в темноту
      const dx = x / (W * 0.5), dz = (z - 0.4) / (D * 0.62);
      let k = 1 - 0.34 * smooth(0.3, 1.2, Math.hypot(dx, dz));
      k *= smooth(0.0, 0.07, v);
      // стена и дальний пол — мягче (как вне фокуса), пол у стола — резкий
      shade.push(k * L.dim * (y > 0.05 ? 0.94 : 1));
      blur.push(y > 0.02 ? 1 : smooth(0.5, -0.2, fv) * 0.8);
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
  g.setAttribute('blur', new THREE.Float32BufferAttribute(blur, 1));
  g.setIndex(idx);
  // где на стене ворота: середина верхней кромки картины
  const wallTop = r + ((vT * D * L.wallK * 0.82) - q);
  return { g, D, wallTop, zWall: zFar - r };
}
function vistaGeometry(L, zFar) {
  // картина целиком — стена-задник: линия горизонта стоит на уровне глаз
  const W = L.W, H = (W * 9) / 16, NX = 40, NY = 24;
  const pos = [], uv = [], shade = [], blur = [], idx = [];
  const y0 = 1.25 - (1 - L.horizon) * H;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY;
    const bend = Math.pow(Math.abs(u - 0.5) * 2, 2) * 1.6; // края задника загибаются к игроку
    pos.push((u - 0.5) * W, y0 + (1 - v) * H, zFar - 0.6 + bend);
    uv.push(u, 1 - v);
    shade.push(L.dim * smooth(0, 0.08, v) * (0.75 + 0.25 * smooth(1.0, 0.7, v)));
    blur.push(0.7);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
  g.setAttribute('blur', new THREE.Float32BufferAttribute(blur, 1));
  g.setIndex(idx);
  return { g, D: 6, wallTop: y0 + H, zWall: zFar - 0.6 };
}
function buildRoom() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: ROOM_VS, fragmentShader: ROOM_FS,
    uniforms: { map: { value: null }, map2: { value: null }, mixv: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 0.9, 0.75) }, ready: { value: 0 }, soft: { value: 1.7 } },
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  // пол под картиной-задником и тень под столом
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01;
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: radialTex([[0, 'rgba(0,0,0,.82)'], [0.55, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']], 256), transparent: true, depthWrite: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.012;
  return { mesh, mat, floor, under, key: null, zFar: -3.4, door: new THREE.Vector3(0, 1.4, -3.8) };
}
function setLocation(key) {
  if (!LOC[key]) key = 'default';
  const room = R.room;
  if (room.key === key) return;
  const first = room.key === null;
  room.key = key;
  const L = locOf(key);
  const zFar = -(R.rz + 2.35);
  room.zFar = zFar;
  const G = L.vista ? vistaGeometry(L, zFar) : roomGeometry(L, zFar);
  room.mesh.geometry.dispose();
  room.mesh.geometry = G.g;
  room.vista = !!L.vista;
  room.door.set(0, L.vista ? 1.5 : clamp(G.wallTop * 0.55, 0.9, 1.7), G.zWall);
  const u = room.mat.uniforms;
  const t = tex(locImg(key), { onLoad: () => { if (R && R.room.key === key) { u.ready.value = 1; if (!R.active) render(); } } });
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  u.map.value = t;
  if (t.image && (t.image.naturalWidth || t.image.width)) u.ready.value = 1; else if (first) u.ready.value = 0;
  // свет зала
  const E = envOf(key);
  R.envNow = E;
  R.scene.background.setHex(E.bg);
  R.scene.fog.color.setHex(E.fog);
  R.scene.fog.density = E.fogD;
  R.hemi.color.setHex(E.hemi); R.hemi.groundColor.setHex(E.ground);
  R.lamp.spot.color.setHex(E.lamp).lerp(_white, 0.35);
  for (const c of R.candles.list) { c.light.color.setHex(E.flame); c.flames.forEach(f => f.material.color.setHex(E.flame)); }
  setMat(key);
}

const _white = new THREE.Color(0xffffff);
// ---------------------------------------------------------------- отражения латуни и лака
const envMats = new Set();
function withEnv(mat, k = 1) {
  mat.envMapIntensity = k; envMats.add(mat);
  if (R && R.envTex) mat.envMap = R.envTex;
  return mat;
}
function buildEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0x241a12, side: THREE.BackSide })));
  const panel = (w, h, r, g, b, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(2, 2, 9, 6.4, 3.6, 0, 3.4, 0.01);          // светильник над столом
  panel(1.2, 1.8, 2.2, 1.3, 0.6, -3.6, 1.2, -3.2); // факелы у дальней стены
  panel(1.2, 1.8, 2.2, 1.3, 0.6, 3.6, 1.2, -3.2);
  panel(4, 1.4, 0.5, 0.36, 0.22, 0, 0.9, -4.8);
  panel(3.2, 1.3, 0.2, 0.26, 0.4, 0, 1.0, 4.6);    // холодный отсвет за спиной игрока
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.04);
  pm.dispose();
  s.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt;
}
let brassM = null;
const brassMat = () => (brassM = brassM || withEnv(new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 1, roughness: 0.3 }), 1.1));
const woodMat = (color, repeat = [2, 2]) => new THREE.MeshStandardMaterial({ map: tex('/ui/obj/v2/boards.webp', { repeat }), color, roughness: 0.7, metalness: 0.02 });

// ---------------------------------------------------------------- стол
function buildTable() {
  const g = new THREE.Group();
  // столешница — дубовый овал из лобби: края отсекаются по прозрачности самой картинки
  const topTex = tex('/ui/obj/v2/tavern-table.webp');
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
    withEnv(new THREE.MeshStandardMaterial({ map: topTex, alphaTest: 0.5, roughness: 0.56, metalness: 0.02, color: 0x8f8a86 }), 0.3));
  top.rotation.x = -Math.PI / 2; top.position.y = TY; top.receiveShadow = true;
  // торец: кольцо из досок чуть уже овала
  const side = new THREE.Mesh(new THREE.CylinderGeometry(0.985, 0.972, 0.07, 96, 1, true), woodMat(0x6a4a30, [12, 0.5]));
  side.position.y = TY - 0.036; side.castShadow = true;
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.972, 64), new THREE.MeshStandardMaterial({ color: 0x140d08, roughness: 1 }));
  under.rotation.x = Math.PI / 2; under.position.y = TY - 0.071;
  g.add(top, side, under);
  // козлы: две опоры и перекладина
  const legs = new THREE.Group();
  const legM = woodMat(0x3a2716, [1, 2]);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, TY - 0.07, 0.11), legM);
    post.position.set(sx * 0.6, (TY - 0.07) / 2, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 1.0), legM);
    foot.position.set(sx * 0.6, 0.045, 0);
    legs.add(post, foot);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.06), legM);
  bar.position.y = 0.3;
  legs.add(bar);
  return { group: g, legs, top };
}
// сукно локации: картинка поля с закруглёнными углами, прошитой кромкой и тенью по краю
function buildMat() {
  const cv = document.createElement('canvas');
  cv.width = 1536; cv.height = 1024;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = R.aniso;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.92, metalness: 0 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = TY + 0.004; mesh.receiveShadow = true;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.filter = 'blur(9px)'; g.fillStyle = 'rgba(0,0,0,.75)';
      roundRect(g, 22, 22, w - 44, h - 44, 14); g.fill();
    }), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = TY + 0.0012;
  return { mesh, shadow, cv, tex: t, key: null };
}
function drawMat(im) {
  const M = R.mat, g = M.cv.getContext('2d'), w = M.cv.width, h = M.cv.height;
  g.clearRect(0, 0, w, h);
  g.save();
  roundRect(g, 4, 4, w - 8, h - 8, 34); g.clip();
  if (im) g.drawImage(im, 0, 0, w, h); else { g.fillStyle = '#3a2416'; g.fillRect(0, 0, w, h); }
  // кромка: тёмный кант и золотая строчка
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.88, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.lineWidth = 16; g.strokeStyle = 'rgba(20,12,6,.72)'; roundRect(g, 10, 10, w - 20, h - 20, 30); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(226,186,104,.85)'; g.setLineDash([16, 9]); roundRect(g, 27, 27, w - 54, h - 54, 22); g.stroke();
  g.restore();
  M.tex.needsUpdate = true;
}
function setMat(key) {
  const M = R.mat;
  if (M.key === key) return;
  M.key = key;
  if (!M.drawn) { drawMat(null); M.drawn = true; }
  img(matImg(key)).then(im => { if (R && R.mat.key === key && im) { drawMat(im); if (!R.active) render(); } });
}

// ---------------------------------------------------------------- свет над столом и свечи
function buildLamp(tier) {
  const spot = new THREE.SpotLight(0xffc68a, LAMP_I, 8, 0.98, 0.9, 1.25);
  spot.position.set(0, LAMP_Y, 0.1);
  spot.target.position.set(0, TY, 0.02);
  spot.castShadow = true;
  const sz = tier === 'high' ? 2048 : 1024;
  spot.shadow.mapSize.set(sz, sz);
  spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.01;
  spot.shadow.radius = tier === 'high' ? 5 : 3;
  spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 4;
  return { spot };
}
function buildCandles() {
  const g = new THREE.Group();
  const wax = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6, emissive: 0x4a2a10, emissiveIntensity: 0.5 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.6, metalness: 0.7 });
  const flameTex = canvasTex(64, 96, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h * 0.66, 1, w / 2, h * 0.58, w * 0.46);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.3, 'rgba(255,220,150,.95)'); gr.addColorStop(0.7, 'rgba(255,140,50,.4)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(w / 2, 2); c.bezierCurveTo(w * 0.95, h * 0.5, w * 0.85, h * 0.95, w / 2, h * 0.97); c.bezierCurveTo(w * 0.15, h * 0.95, w * 0.05, h * 0.5, w / 2, 2); c.fill();
  });
  const haloTex = radialTex([[0, 'rgba(255,255,255,.55)'], [0.35, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']]);
  const list = [];
  const cluster = (heights) => {
    const c = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.012, 28), iron);
    plate.position.y = 0.006; plate.castShadow = true; plate.receiveShadow = true;
    c.add(plate);
    const flames = [];
    heights.forEach((hh, i) => {
      const a = (i / heights.length) * Math.PI * 2 + 0.6, rr = heights.length > 1 ? 0.034 : 0;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, hh, 14), wax);
      body.position.set(Math.cos(a) * rr, 0.012 + hh / 2, Math.sin(a) * rr); body.castShadow = true;
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.scale.set(0.03, 0.05, 1); fl.position.set(body.position.x, 0.012 + hh + 0.024, body.position.z);
      fl.userData.y = fl.position.y; fl.userData.p = Math.random() * 10;
      c.add(body, fl); flames.push(fl);
    });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    halo.scale.set(0.42, 0.42, 1); halo.position.y = 0.13;
    const light = new THREE.PointLight(0xffa040, 0.55, 2.2, 2);
    light.position.y = 0.16;
    c.add(halo, light);
    g.add(c);
    const o = { group: c, flames, halo, light, p: Math.random() * 10 };
    list.push(o);
    return o;
  };
  cluster([0.11, 0.075, 0.05]);
  cluster([0.09, 0.06]);
  return { group: g, list };
}
function buildDust(n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const seed = [];
  for (let i = 0; i < n; i++) seed.push({ a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * 1.7, y: TY + 0.05 + Math.random() * 1.3, s: 0.2 + Math.random() * 0.8, p: Math.random() * 10 });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.012, map: radialTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']], 64),
    color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, seed, pos, geo };
}

// ---------------------------------------------------------------- карты
const cardGeo = new THREE.PlaneGeometry(1, RATIO);
const cardMat = map => new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.78, metalness: 0, color: 0xece4d6 });
const backMats = new Map();
function backMat(deck) {
  const url = (R.hooks.back && R.hooks.back(deck)) || `/cards/v1/back_${deck}.webp`;
  if (!backMats.has(url)) backMats.set(url, cardMat(roundedBack(url)));
  return backMats.get(url);
}
// рубашка: картинка с закруглёнными углами
function roundedBack(url) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 384;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = R.aniso;
  const g = cv.getContext('2d');
  const paint = im => {
    g.clearRect(0, 0, 256, 384);
    g.save(); roundRect(g, 2, 2, 252, 380, 18); g.clip();
    if (im) g.drawImage(im, 0, 0, 256, 384); else { g.fillStyle = '#3a2618'; g.fillRect(0, 0, 256, 384); }
    g.restore();
    g.lineWidth = 3; g.strokeStyle = 'rgba(10,6,3,.9)'; roundRect(g, 2.5, 2.5, 251, 379, 18); g.stroke();
    t.needsUpdate = true;
  };
  paint(null);
  img(url).then(im => { if (im) paint(im); if (R && !R.active) render(); });
  return t;
}
// лицо карты на столе: рисунок, рамка по виду карты и название. Подробности игрок читает в досье по нажатию
const faceMats = new Map();
const TONE = { door: ['#3b2a1c', '#c9a468'], treasure: ['#4a3a16', '#e8c66a'], monster: ['#4a1a14', '#e0a088'], curse: ['#2c1c3e', '#c0a0e8'], item: ['#1f3a34', '#9ad8c0'] };
function faceMat(uid) {
  const f = (R.hooks.face && R.hooks.face(uid)) || { name: '', img: null, tone: 'door' };
  const key = f.key || uid;
  if (faceMats.has(key)) return faceMats.get(key);
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 384;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = R.aniso;
  const g = cv.getContext('2d');
  const [bg, ink] = TONE[f.tone] || TONE.door;
  const paint = im => {
    g.clearRect(0, 0, 256, 384);
    g.save(); roundRect(g, 2, 2, 252, 380, 18); g.clip();
    g.fillStyle = bg; g.fillRect(0, 0, 256, 384);
    const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 384);
    // рисунок
    const ax = 18, ay = 58, aw = 220, ah = 232;
    g.save(); roundRect(g, ax, ay, aw, ah, 10); g.clip();
    g.fillStyle = '#120c08'; g.fillRect(ax, ay, aw, ah);
    if (im) { const s = Math.max(aw / im.width, ah / im.height), sw = aw / s, sh = ah / s; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, ax, ay, aw, ah); }
    g.restore();
    g.lineWidth = 3; g.strokeStyle = ink; g.globalAlpha = 0.8; roundRect(g, ax, ay, aw, ah, 10); g.stroke(); g.globalAlpha = 1;
    // название
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink;
    let fs = 30;
    do { g.font = `700 ${fs}px "Cormorant SC", Georgia, serif`; fs -= 1; } while (g.measureText(f.name).width > 222 && fs > 13);
    g.fillText(f.name, 128, 32);
    if (f.note) { g.font = '700 26px "Cormorant SC", Georgia, serif'; g.fillText(f.note, 128, 332); }
    g.restore();
    g.lineWidth = 4; g.strokeStyle = 'rgba(8,5,3,.95)'; roundRect(g, 3, 3, 250, 378, 18); g.stroke();
    g.lineWidth = 2; g.strokeStyle = ink; g.globalAlpha = 0.55; roundRect(g, 9, 9, 238, 366, 13); g.stroke(); g.globalAlpha = 1;
    t.needsUpdate = true;
  };
  paint(null);
  const go = im => { paint(im); if (R && !R.active) render(); };
  (document.fonts ? document.fonts.load('700 30px "Cormorant SC"').catch(() => {}) : Promise.resolve()).then(() => (f.img ? img(f.img).then(go) : go(null)));
  const m = cardMat(t);
  faceMats.set(key, m);
  return m;
}
function flatCard(mat, w) {
  const m = new THREE.Mesh(cardGeo, mat);
  m.scale.set(w, w, 1);
  m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- места соперников
let glowTex = null, shadowTex = null;
function makeSeat() {
  glowTex = glowTex || radialTex([[0, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
  shadowTex = shadowTex || radialTex([[0, 'rgba(0,0,0,.85)'], [0.55, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]);
  const holder = new THREE.Group(); // смотрит на камеру
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.translate(0, 0.5, 0);
  const figMat = new THREE.ShaderMaterial({
    vertexShader: FIG_VS, fragmentShader: FIG_FS,
    uniforms: { map: { value: null }, square: { value: 0 }, ready: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, rimCol: { value: new THREE.Color(1, 0.7, 0.4) },
      sat: { value: 1 }, opacity: { value: 0 }, flash: { value: 0 }, light: { value: 1 }, rim: { value: 0.34 }, ghost: { value: 0 } },
    transparent: true, depthWrite: false,
  });
  const fig = new THREE.Mesh(plane, figMat);
  fig.renderOrder = 2;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffd28a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.renderOrder = 1;
  holder.add(glow, fig);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }));
  shadow.rotation.order = 'YXZ'; shadow.rotation.x = -Math.PI / 2;
  return { holder, fig, figMat, glow, shadow, fan: new THREE.Group(), equip: new THREE.Group(), data: null, art: null, w: 0.68, h: 0.68, bottom: TY - 0.12,
    equipKey: '', handN: -1, state: { light: 1, glowA: 0, glowCol: new THREE.Color(0xffd28a), dead: 0, ghost: 0 }, hitT: -9e9, nodT: -9e9, phase: Math.random() * 10, geo: null, home: new THREE.Vector3() };
}

// ---------------------------------------------------------------- публичный объект
function mount(area, hooks = {}) {
  if (R) return true;
  if (!supported()) return false;
  const tier = pickTier();
  const canvas = document.createElement('canvas');
  canvas.id = 'scene3d';
  area.prepend(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'high', powerPreference: 'high-performance', stencil: false }); }
  catch { canvas.remove(); return false; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ENV_DEF.bg);
  scene.fog = new THREE.FogExp2(ENV_DEF.fog, ENV_DEF.fogD);
  const hemi = new THREE.HemisphereLight(ENV_DEF.hemi, ENV_DEF.ground, 0.5);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x9a8370, 0.3);
  fill.position.set(0.6, 2.4, 3.2);
  scene.add(fill);

  R = {
    tier, area, canvas, renderer, scene, hooks, hemi, fill,
    aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    bigTex: renderer.capabilities.maxTextureSize >= 4096 && (window.devicePixelRatio || 1) * innerWidth >= 2200,
    camera: new THREE.PerspectiveCamera(45, 1, 0.05, 60), base: new THREE.PerspectiveCamera(45, 1, 0.05, 60),
    composer: null, bloom: null, bokeh: null, grade: null,
    seats: [], k: -1, rx: 1.3, rz: 0.85, view: null, active: false, raf: 0, last: performance.now(), t: 0,
    fx: [], shake: 0, kick: 0, par: { x: 0, y: 0, tx: 0, ty: 0 }, size: { w: 1, h: 1, top: 0, bottom: 0 }, camD: 0,
    perf: { acc: 0, n: 0, slow: 0 }, look: null, lookAt: { on: 0, p: new THREE.Vector3() }, tense: 0, flash: 0,
    lastLay: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, decks: {}, piles: {}, pileTop: {}, envNow: ENV_DEF,
  };
  R.envRT = buildEnv(renderer);
  R.envTex = R.envRT.texture;
  envMats.forEach(m => { m.envMap = R.envTex; m.needsUpdate = true; });
  R.room = buildRoom();
  scene.add(R.room.floor, R.room.mesh, R.room.under);
  const table = buildTable();
  R.table = table.group; R.legs = table.legs;
  scene.add(table.group, table.legs);
  R.mat = buildMat();
  scene.add(R.mat.shadow, R.mat.mesh);
  R.lamp = buildLamp(tier);
  scene.add(R.lamp.spot, R.lamp.spot.target);
  R.candles = buildCandles();
  scene.add(R.candles.group);
  R.dust = buildDust(tier === 'high' ? 260 : 110);
  scene.add(R.dust.pts);
  // колоды: стопки с рубашкой сверху
  const edgeTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#d8c39a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(90,60,30,.35)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); });
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.8 });
  for (const d of ['door', 'treasure']) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, RATIO), [edgeMat, edgeMat, backMat(d), edgeMat, edgeMat, edgeMat]);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    R.decks[d] = { mesh: m, h: 0.01, n: -1 };
    R.piles[d] = new THREE.Group();
    scene.add(R.piles[d]);
  }
  // вспышки: огни живут в сцене всегда, чтобы не пересобирать шейдеры
  R.flashes = [0, 1].map(() => { const l = new THREE.PointLight(0xffb060, 0, 6, 2); scene.add(l); return l; });
  R.flashI = 0;

  if (tier === 'high') setupComposer();
  R.grain = document.createElement('div');
  R.grain.id = 'grain3d';
  R.grain.classList.toggle('gl', !!R.grade);
  canvas.after(R.grain);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); const cb = R && R.hooks.onLost; unmount(); if (cb) cb(); });
  R.onMove = e => { if (e.pointerType === 'touch') return; R.par.tx = (e.clientX / innerWidth - 0.5) * 2; R.par.ty = (e.clientY / innerHeight - 0.5) * 2; };
  window.addEventListener('pointermove', R.onMove, { passive: true });
  R.ro = new ResizeObserver(() => resize());
  R.ro.observe(area);
  setLocation('default');
  resize();
  return true;
}

// Как в кино: чуть глубже тени, тёплые света и холодок в тенях, виньетка, плёночное зерно, лёгкое расслоение цвета к краям
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, k: { value: 1 }, tense: { value: 0 }, tenseCol: { value: new THREE.Color(0.75, 0.1, 0.05) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float k; uniform float tense; uniform vec3 tenseCol;
varying vec2 vUv;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){
  vec2 d = vUv - 0.5;
  vec2 o = d * dot(d, d) * 0.006 * k;
  vec3 c = vec3(texture2D(tDiffuse, vUv - o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + o).b);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.3 * k);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c += mix(vec3(-0.01, 0.002, 0.016), vec3(0.02, 0.008, -0.016), smoothstep(0.05, 0.75, l)) * k;
  c = mix(vec3(l), c, 1.0 + 0.08 * k);
  float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 1.15)));
  c *= mix(1.0 - 0.46 * k, 1.0, v);
  c += tenseCol * tense * (1.0 - v) * 0.5;
  float n = hash(vUv * res + fract(time * 7.13) * 91.7);
  c += (n - 0.5) * 0.045 * k * (1.0 - 0.55 * l);
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`,
};
function setupComposer() {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  R.composer = new EffectComposer(R.renderer, rt);
  R.composer.addPass(new RenderPass(R.scene, R.camera));
  // глубина резкости: стол в фокусе, зал за спинами соперников мягче
  R.bokeh = new BokehPass(R.scene, R.camera, { focus: 2.4, aperture: 0.0009, maxblur: 0.006 });
  R.composer.addPass(R.bokeh);
  R.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.92);
  R.composer.addPass(R.bloom);
  R.composer.addPass(new OutputPass());
  R.grade = new ShaderPass(GradeShader);
  R.composer.addPass(R.grade);
}
function dropQuality() {
  // не тянет — упрощаем: без пост-обработки, ниже разрешение, без теней
  if (R.composer) { R.composer.dispose(); R.composer = null; R.bloom = null; R.bokeh = null; R.grade = null; if (R.grain) R.grain.classList.remove('gl'); }
  else if (R.renderer.getPixelRatio() > 1) R.renderer.setPixelRatio(1);
  else if (R.renderer.shadowMap.enabled) { R.renderer.shadowMap.enabled = false; R.lamp.spot.castShadow = false; }
  else return;
  resize();
}

function unmount() {
  if (!R) return;
  cancelAnimationFrame(R.raf);
  window.removeEventListener('pointermove', R.onMove);
  if (R.ro) R.ro.disconnect();
  if (R.composer) R.composer.dispose();
  if (R.envRT) R.envRT.dispose();
  R.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  for (const t of texCache.values()) t.dispose();
  R.renderer.dispose();
  R.canvas.remove();
  if (R.grain) R.grain.remove();
  R = null;
  texCache.clear(); faceMats.clear(); backMats.clear(); envMats.clear();
  brassM = null; glowTex = null; shadowTex = null;
}

function resize() {
  if (!R) return;
  const w = Math.max(1, R.area.clientWidth), h = Math.max(1, R.area.clientHeight);
  const pad = (R.hooks.pad && R.hooks.pad()) || {};
  R.size = { w, h, top: pad.top || 0, bottom: pad.bottom || 0, left: pad.left || 0, right: pad.right || 0 };
  const portrait = w / h < 0.85;
  if (portrait !== !!R.portrait) {
    R.portrait = portrait;
    if (R.k > 0 && R.view) { R.k = -2; update(R.view); }
  }
  R.renderer.setSize(w, h, false);
  if (R.composer) {
    R.composer.setPixelRatio(R.renderer.getPixelRatio());
    R.composer.setSize(w, h);
    if (R.grade) R.grade.uniforms.res.value.set(w * R.renderer.getPixelRatio(), h * R.renderer.getPixelRatio());
  }
  fitCamera();
  layoutDOM();
  if (!R.active) render();
}

// ---------------------------------------------------------------- раскладка стола
const SPAN = [0, 0, 60, 96, 120, 138, 150, 160];
const SPAN_TALL = [0, 0, 100, 150, 186, 206, 222, 234]; // узкий экран: длинный стол, соперники вдоль боков
function tableSize(k) {
  if (R.portrait) { const rz = 0.8 + 0.075 * k; return { rx: Math.max(0.62, rz * 0.62), rz }; }
  const rx = 1.1 + 0.075 * k;
  return { rx, rz: rx * TABLE_K };
}
// угол места на овале; на узком экране — равные промежутки по длине края, а не по углу
function seatPhi(i, k) {
  const span = (((R.portrait ? SPAN_TALL : SPAN)[Math.min(k, 7)] || 0) * Math.PI) / 180;
  if (!R.portrait || k < 2) return -span / 2 + (span * (i + 0.5)) / k;
  const N = 400, acc = [0];
  let px = R.rx * Math.sin(-span / 2), pz = -R.rz * Math.cos(-span / 2);
  for (let j = 1; j <= N; j++) {
    const f = -span / 2 + (span * j) / N, x = R.rx * Math.sin(f), z = -R.rz * Math.cos(f);
    acc.push(acc[j - 1] + Math.hypot(x - px, z - pz)); px = x; pz = z;
  }
  const want = (acc[N] * (i + 0.5)) / k;
  let j = 1;
  while (j < N && acc[j] < want) j++;
  return -span / 2 + (span * j) / N;
}
function seatGeometry(i, k) {
  const phi = seatPhi(i, k);
  const { rx, rz } = R;
  const E = new THREE.Vector3(rx * Math.sin(phi), TY, -rz * Math.cos(phi));
  const n = new THREE.Vector3(Math.sin(phi) / rx, 0, -Math.cos(phi) / rz).normalize();
  const t = new THREE.Vector3(-n.z, 0, n.x);
  return { phi, E, n, t };
}
function arrange(k) {
  R.k = k;
  const { rx, rz } = tableSize(k);
  R.rx = rx; R.rz = rz;
  R.table.scale.set(rx, 1, rz);
  R.legs.scale.set(rx, 1, rz);
  // сукно вписано в овал
  const mw = (R.portrait ? 1.28 : 1.42) * rx, md = R.portrait ? Math.min(rz * 1.3, mw * 1.5) : mw / 1.5;
  R.matW = mw; R.matD = md;
  R.mat.mesh.scale.set(mw, md, 1);
  R.mat.shadow.scale.set(mw * 1.12, md * 1.16, 1);
  R.room.under.scale.set(rx * 3.6, rz * 4.2, 1);
  while (R.seats.length < k) { const s = makeSeat(); R.scene.add(s.holder, s.shadow, s.fan, s.equip); R.seats.push(s); }
  while (R.seats.length > k) { const s = R.seats.pop(); R.scene.remove(s.holder, s.shadow, s.fan, s.equip); }
  R.seats.forEach((s, i) => {
    s.geo = seatGeometry(i, k);
    placeSeat(s);
    s.handN = -1; s.equipKey = '';
  });
  // колоды и сброс — слева на сукне, свечи — по дальним углам
  const dx = R.portrait ? -mw * 0.3 : mw * 0.5 - 0.2, dz = R.portrait ? -md * 0.3 : -md * 0.1;
  R.decks.door.mesh.position.set(dx - 0.08, TY, dz);
  R.decks.treasure.mesh.position.set(dx + 0.08, TY, dz);
  R.piles.door.position.set(dx - 0.08, TY, dz + 0.235);
  R.piles.treasure.position.set(dx + 0.08, TY, dz + 0.235);
  const cs = R.candles.list;
  cs[0].group.position.set(-rx * 0.66, TY, -rz * 0.34);
  cs[1].group.position.set(rx * 0.68, TY, -rz * 0.3);
  cs[1].group.visible = !R.portrait;
  // зал зависит от размера стола: дальняя стена — за спинами
  const key = R.room.key; R.room.key = '';
  setLocation(key || 'default');
}
function placeSeat(s) {
  const G = s.geo;
  if (!G) return;
  s.home.copy(G.E).addScaledVector(G.n, 0.3);
  s.holder.position.set(s.home.x, TY, s.home.z); // ось наклона — на уровне стола
  s.shadow.position.set(G.E.x - G.n.x * 0.06, TY + 0.0035, G.E.z - G.n.z * 0.06);
  s.shadow.rotation.y = Math.atan2(G.t.x, G.t.z) + Math.PI / 2;
  s.shadow.scale.set(0.7, 0.3, 1);
  s.fig.scale.set(s.w, s.h, 1);
  s.fig.position.y = s.bottom - TY;
  s.glow.scale.set(s.w * 1.7, s.h * 1.45, 1);
  s.glow.position.set(0, s.bottom + s.h * 0.55 - TY, -0.04);
}
function seatArt(s, art) {
  s.art = art.c;
  s.h = R.portrait ? 0.8 : 0.68; s.w = s.h;
  s.bottom = TY - 0.13;
  placeSeat(s);
  const u = s.figMat.uniforms;
  u.ready.value = 0;
  const t = tex(art.c, { onLoad: () => { if (s.art === art.c) u.ready.value = 1; } });
  u.map.value = t;
  if (t.image && (t.image.naturalWidth || t.image.width)) u.ready.value = 1;
  u.square.value = art.flat ? 1 : 0;
}

// ---------------------------------------------------------------- камера
// Глаза игрока — над ближним краем стола. Наклон подбираем так, чтобы макушки соперников стояли у верхней
// границы (под шапкой), а угол обзора — чтобы все влезли по ширине и середина стола была выше руки.
const _v = new THREE.Vector3();
function fitCamera() {
  if (!R || R.k < 0) return;
  const { w, h, top, bottom } = R.size;
  const cam = R.base;
  const aspect = w / h;
  cam.aspect = aspect;
  cam.rotation.order = 'YXZ';
  const topLim = 1 - (2 * (top + 14)) / h;
  const botLim = -1 + (2 * (bottom + 10)) / h;
  const heads = R.seats.map(s => new THREE.Vector3(s.home.x, s.bottom + s.h + 0.02, s.home.z));
  const sides = R.seats.map(() => [new THREE.Vector3(), new THREE.Vector3()]);
  const placeSides = () => R.seats.forEach((s, i) => {
    const dx = cam.position.x - s.home.x, dz = cam.position.z - s.home.z, l = Math.hypot(dx, dz) || 1;
    for (const [j, sx] of [[0, -1], [1, 1]]) sides[i][j].set(s.home.x + (sx * s.w * 0.44 * dz) / l, (s.bottom + s.h + TY) / 2, s.home.z - (sx * s.w * 0.44 * dx) / l);
  });
  const middle = new THREE.Vector3(0, TY, 0.12);
  const setFov = v => { cam.fov = v; cam.updateProjectionMatrix(); };
  const aim = p => { cam.rotation.set(p, 0, 0); cam.updateMatrixWorld(); };
  const maxTop = () => Math.max(...heads.map(p => _v.copy(p).project(cam).y));
  const pin = () => { let lo = -1.3, hi = 0.4; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; aim(m); if (maxTop() > topLim) lo = m; else hi = m; } aim(hi); };
  const xl = -1 + (2 * (R.size.left + 8)) / w, xr = 1 - (2 * (R.size.right + 8)) / w;
  const fits = () => {
    for (const pr of sides) for (const p of pr) { const x = _v.copy(p).project(cam).x; if (x < xl || x > xr) return false; }
    if (_v.copy(middle).project(cam).y < botLim + 0.34) return false;
    return true;
  };
  const visMax = aspect >= 1 ? 62 : 76;
  const tall = R.portrait;
  let done = false;
  for (let step = 0; step < 40 && !done; step++) {
    if (tall) cam.position.set(0, 1.9 + step * 0.15, R.rz * 0.55 + step * 0.06);
    else cam.position.set(0, 1.42 + step * 0.07, R.rz + 0.62 + step * 0.1);
    placeSides(); setFov(visMax); pin();
    if (!fits()) continue;
    let lo = 32, hi = visMax;
    for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; setFov(m); pin(); if (fits()) hi = m; else lo = m; }
    setFov(hi); pin();
    R.camD = step; done = true;
  }
  R.camera.fov = cam.fov; R.camera.aspect = aspect;
  R.camera.updateProjectionMatrix();
  R.camera.position.copy(cam.position);
  R.camera.quaternion.copy(cam.quaternion);
  // герои чуть откинуты к камере, чтобы при взгляде сверху не сплющивались
  const pitch = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ').x;
  for (const s of R.seats) {
    s.holder.rotation.order = 'YXZ';
    s.holder.rotation.y = Math.atan2(cam.position.x - s.home.x, cam.position.z - s.home.z);
    s.holder.rotation.x = Math.min(0, pitch) * (tall ? 0.6 : 0.35);
    s.holder.updateMatrixWorld(true);
  }
}
const onFig = (s, x, y) => s.holder.localToWorld(new THREE.Vector3(x, y - TY, 0));
function project(v) {
  _v.copy(v).project(R.camera);
  return { x: ((_v.x + 1) / 2) * R.size.w, y: ((1 - _v.y) / 2) * R.size.h };
}

// разметка игры встаёт на свои места: таблички — к героям, якоря колод — к стопкам
const _tmp = new THREE.Vector3();
function layoutDOM() {
  if (!R || !R.view || !R.hooks.place) return;
  const seats = [];
  for (const s of R.seats) {
    if (!s.data) continue;
    const top = project(onFig(s, 0, s.bottom + s.h));
    const edge = project(_tmp.copy(s.geo.E));
    const l = project(onFig(s, -s.w * 0.4, TY + 0.2)), r = project(onFig(s, s.w * 0.4, TY + 0.2));
    const front = project(_tmp.copy(s.geo.E).addScaledVector(s.geo.n, -0.2));
    seats.push({ id: s.data.id, x: top.x, top: top.y, edge: edge.y, w: Math.abs(r.x - l.x), fx: front.x, fy: front.y });
  }
  const P = (x, y, z) => project(_tmp.set(x, y, z));
  const dd = R.decks.door, dt = R.decks.treasure;
  const out = {
    seats,
    door: P(dd.mesh.position.x, TY + dd.h, dd.mesh.position.z),
    treasure: P(dt.mesh.position.x, TY + dt.h, dt.mesh.position.z),
    pile: P(R.piles.door.position.x + 0.08, TY, R.piles.door.position.z),
    pileW: Math.abs(P(R.piles.door.position.x + 0.065, TY, R.piles.door.position.z).x - P(R.piles.door.position.x - 0.065, TY, R.piles.door.position.z).x),
    center: P(0, TY, 0),
    stand: P(0, TY, -R.matD * 0.18),      // где стоит монстр
    standTop: P(0, TY + 0.62, -R.matD * 0.18),
    near: P(0, TY, R.rz * 0.72),
    cardPx: Math.abs(P(0.065, TY, 0).x - P(-0.065, TY, 0).x),
    matL: P(-R.matW / 2, TY, 0.1).x, matR: P(R.matW / 2, TY, 0.1).x,
    gate: project(R.room.door),
  };
  R.hooks.place(out);
}

// ---------------------------------------------------------------- состояние стола
function setFan(s, n, force) {
  n = Math.min(n, 9);
  if (s.handN === n && !force) return;
  s.handN = n;
  const mat = backMat('door');
  while (s.fan.children.length < n) s.fan.add(flatCard(mat, 0.07));
  s.fan.children.forEach((c, j) => {
    c.visible = j < n;
    const a = (j - (n - 1) / 2) * 0.2;
    c.position.set(Math.sin(a) * 0.05, 0.0012 + j * 0.0009, -Math.cos(a) * 0.05 + 0.05);
    c.rotation.y = -a;
  });
  const G = s.geo;
  const p = G.E.clone().addScaledVector(G.n, -0.12).addScaledVector(G.t, 0.27);
  s.fan.position.set(p.x, TY + 0.003, p.z);
  s.fan.rotation.y = Math.atan2(-G.n.x, -G.n.z) + Math.PI;
}
function setEquip(s, ids) {
  const key = ids.join(',');
  if (s.equipKey === key) return;
  s.equipKey = key;
  while (s.equip.children.length) s.equip.remove(s.equip.children[0]);
  const G = s.geo;
  const m = Math.min(ids.length, 8), cw = 0.092, stepW = Math.min(cw + 0.01, 0.5 / Math.max(1, m));
  const base = G.E.clone().addScaledVector(G.n, -0.43);
  ids.slice(0, m).forEach((id, j) => {
    const c = flatCard(faceMat(id), cw);
    const off = (j - (m - 1) / 2) * stepW;
    c.position.copy(base).addScaledVector(G.t, off);
    c.position.y = TY + 0.004 + j * 0.0004;
    c.rotation.y = Math.atan2(-G.n.x, -G.n.z) + Math.PI + (((j * 7919) % 13) / 13 - 0.5) * 0.14;
    s.equip.add(c);
  });
}
function setDeck(d, n) {
  const D = R.decks[d];
  if (D.n === n) return;
  D.n = n;
  const hh = 0.003 + Math.min(120, n) * 0.00042;
  D.h = hh;
  D.mesh.visible = n > 0;
  D.mesh.scale.set(0.13, hh, 0.13);
  D.mesh.position.y = TY + 0.003 + hh / 2;
}
function setPile(d, uid) {
  if (R.pileTop[d] === uid) return;
  const prev = R.pileTop[d];
  R.pileTop[d] = uid;
  const G = R.piles[d];
  if (uid == null) { while (G.children.length) G.remove(G.children[0]); return; }
  // верхняя карта ложится на прежние, чуть вразнобой; глубже трёх не храним
  while (G.children.length > 2) G.remove(G.children[0]);
  G.children.forEach((c, j) => (c.position.y = 0.004 + j * 0.0012));
  const top = flatCard(faceMat(uid), 0.13);
  const y = 0.004 + G.children.length * 0.0012, ry = (Math.random() - 0.5) * 0.3;
  top.position.set((Math.random() - 0.5) * 0.02, y, (Math.random() - 0.5) * 0.02);
  top.rotation.y = ry;
  G.add(top);
  if (prev !== undefined && R.active) addFx(260, k => { const e = ease(k); top.position.y = y + 0.07 * (1 - e); top.rotation.y = ry + 0.5 * (1 - e); });
}

function update(view) {
  if (!R) return;
  R.view = view;
  const opp = view.opp || [];
  const k = Math.max(1, opp.length);
  const rebuilt = k !== R.k;
  if (rebuilt) arrange(k);
  setLocation(view.loc || 'default');
  opp.forEach((p, i) => {
    const s = R.seats[i];
    s.data = p;
    if (s.art !== p.art.c) seatArt(s, p.art);
    setFan(s, p.out ? 0 : p.hand);
    setEquip(s, p.out ? [] : p.equip || []);
  });
  for (let i = opp.length; i < R.seats.length; i++) R.seats[i].data = null;
  setDeck('door', view.decks ? view.decks.door : 0);
  setDeck('treasure', view.decks ? view.decks.treasure : 0);
  setPile('door', view.piles ? view.piles.door : null);
  setPile('treasure', view.piles ? view.piles.treasure : null);
  R.mood = view.mood || null;
  if (rebuilt) fitCamera();
  layoutDOM();
  if (!R.active) render();
}

// ---------------------------------------------------------------- эффекты
function addFx(ms, fn, done) { R.fx.push({ t0: performance.now(), ms, fn, done }); }
const seatById = id => R.seats.find(s => s.data && s.data.id === id);
function flashLight(at, color, peak, ms) {
  const l = R.flashes[R.flashI++ % R.flashes.length];
  l.color.set(color); l.position.copy(at);
  addFx(ms, k => (l.intensity = peak * (1 - k) * (1 - k)), () => (l.intensity = 0));
}
function lookBlend(cam, target, w) {
  _q.copy(cam.quaternion);
  cam.lookAt(target);
  cam.quaternion.slerpQuaternions(_q, cam.quaternion, w);
}
const _q = new THREE.Quaternion();
function fx(type, d = {}) {
  if (!R) return;
  const now = performance.now();
  switch (type) {
    case 'shake': R.shake = Math.max(R.shake, clamp(d.power || 0.5, 0, 1.4)); break;
    case 'kick': R.kick = Math.max(R.kick, d.power || 0.6); break;
    case 'flash': {
      R.flash = Math.max(R.flash, d.alpha != null ? clamp(d.alpha * 2.2, 0, 1) : 0.6);
      if (d.color != null) R.room.mat.uniforms.flashCol.value.set(d.color);
      flashLight(_tmp.set(0, TY + 0.9, -0.2).clone(), d.color != null ? d.color : 0xffe0b0, 7, 520);
      break;
    }
    case 'look': {
      // взгляд к герою, воротам или середине стола
      const s = d.seat && seatById(d.seat);
      const p = d.gate ? R.room.door.clone() : s ? new THREE.Vector3(s.home.x, TY + 0.45, s.home.z) : new THREE.Vector3(0, TY + 0.1, 0);
      R.look = { p, t0: now, ms: d.ms || 1500, w: d.w || 0.22 };
      break;
    }
    case 'hit': { const s = seatById(d.seat); if (s) { s.hitT = now; flashLight(new THREE.Vector3(s.home.x, TY + 0.5, s.home.z + 0.3), 0xff5030, 5, 420); } break; }
    case 'nod': { const s = seatById(d.seat); if (s) s.nodT = now; break; }
    case 'cheer': { const s = seatById(d.seat); if (s) { s.cheerT = now; flashLight(new THREE.Vector3(s.home.x, TY + 0.6, s.home.z + 0.3), 0xffd070, 4, 700); } break; }
  }
}

// ---------------------------------------------------------------- кадр
const _c1 = new THREE.Color();
function tick(now) {
  const dt = clamp((now - R.last) / 1000, 0, 0.1);
  R.last = now;
  R.t += dt;
  const t = R.t;
  for (let i = R.fx.length - 1; i >= 0; i--) {
    const f = R.fx[i], k = Math.min(1, (now - f.t0) / f.ms);
    f.fn(k);
    if (k >= 1) { if (f.done) f.done(); R.fx.splice(i, 1); }
  }
  // живой огонь: лампа над столом и свечи дрожат вместе
  const fl = 1 + Math.sin(t * 13.1) * 0.025 + Math.sin(t * 7.3 + 1.3) * 0.03 + (Math.random() - 0.5) * 0.035;
  const M = R.mood || {};
  const tenseT = M.combat ? (M.boss ? 1 : M.losing ? 0.7 : 0.35) : 0;
  R.tense = damp(R.tense, tenseT, 1.6, dt);
  R.lamp.spot.intensity = LAMP_I * fl * (1 - 0.22 * R.tense);
  for (const c of R.candles.list) {
    const k = 1 + Math.sin(t * 11 + c.p) * 0.08 + Math.sin(t * 23 + c.p * 2) * 0.05;
    c.light.intensity = 0.55 * k * (1 + 0.6 * R.tense);
    c.halo.material.opacity = 0.42 * k;
    for (const f of c.flames) {
      const w = Math.sin(t * 9 + f.userData.p) * 0.5 + Math.sin(t * 17 + f.userData.p * 3) * 0.5;
      f.scale.set(0.03 * (1 + w * 0.08), 0.05 * (1 + w * 0.16), 1);
      f.position.y = f.userData.y + w * 0.002;
    }
  }
  // пылинки в свету
  const D = R.dust;
  for (let i = 0; i < D.seed.length; i++) {
    const p = D.seed[i];
    p.a += dt * 0.04 * p.s;
    p.y += Math.sin(t * 0.3 + p.p) * 0.0008 * p.s + dt * 0.006 * p.s;
    if (p.y > TY + 1.4) p.y = TY + 0.05;
    D.pos[i * 3] = Math.cos(p.a) * p.r + Math.sin(t * 0.2 + p.p) * 0.03;
    D.pos[i * 3 + 1] = p.y;
    D.pos[i * 3 + 2] = Math.sin(p.a) * p.r * 0.75 - 0.1;
  }
  D.geo.attributes.position.needsUpdate = true;
  // зал: вспышка гаснет, в бою картина чуть темнее и теплее
  R.flash = Math.max(0, R.flash - dt * 2.4);
  const ru = R.room.mat.uniforms;
  ru.flash.value = R.flash * R.flash;
  const dimK = 1 - 0.2 * R.tense;
  ru.tint.value.setRGB(dimK * (1 + 0.1 * R.tense), dimK * (1 - 0.06 * R.tense), dimK * (1 - 0.1 * R.tense));
  if (R.grade) { R.grade.uniforms.time.value = t; R.grade.uniforms.tense.value = R.tense * (0.5 + 0.18 * Math.sin(t * 2.2)); R.grade.uniforms.tenseCol.value.setRGB(M.boss ? 0.45 : 0.75, 0.1, M.boss ? 0.5 : 0.05); }
  // соперники
  const E = R.envNow;
  for (const s of R.seats) {
    const p = s.data;
    if (!p) { s.holder.visible = s.shadow.visible = s.fan.visible = s.equip.visible = false; continue; }
    s.holder.visible = s.shadow.visible = s.fan.visible = s.equip.visible = true;
    const S = s.state, u = s.figMat.uniforms;
    S.dead = damp(S.dead, p.out ? 1 : 0, 3, dt);
    S.ghost = damp(S.ghost, p.ghost ? 1 : 0, 3, dt);
    let light = 0.98, glowT = 0;
    _c1.set(0xffd28a);
    if (p.turn) { glowT = 0.5 + Math.sin(t * 2.4) * 0.1; light = 1.16; }
    if (p.fighter) { _c1.set(0xff7a4a); glowT = Math.max(glowT, 0.55 + Math.sin(t * 3.2) * 0.12); light = 1.18; }
    else if (p.helper) { _c1.set(0x7ae0b8); glowT = Math.max(glowT, 0.45); light = 1.1; }
    if (M.combat && !p.fighter && !p.helper) light *= 0.86;
    S.glowA = damp(S.glowA, glowT, 6, dt);
    S.glowCol.lerp(_c1, 1 - Math.exp(-8 * dt));
    S.light = damp(S.light, light * (1 - S.dead * 0.5), 6, dt);
    if (!u.ready.value) { const im = u.map.value && u.map.value.image; if (im && (im.naturalWidth || im.width)) u.ready.value = 1; }
    u.sat.value = 1 - S.dead * 0.85;
    u.ghost.value = S.ghost;
    u.light.value = S.light * (0.97 + (fl - 1) * 0.7);
    u.tint.value.set(E.lamp).lerp(_c1.set(0xffffff), 0.62);
    u.rimCol.value.set(E.flame).lerp(_c1.set(0xffffff), 0.25);
    u.opacity.value = damp(u.opacity.value, u.ready.value ? 1 : 0, 5, dt);
    s.glow.material.opacity = S.glowA * (1 - S.dead);
    s.glow.material.color.copy(S.glowCol);
    // живое движение: дыхание, вздрагивание от удара, кивок, радость
    const ht = (now - s.hitT) / 1000, nt = (now - s.nodT) / 1000, ct = (now - (s.cheerT || -9e9)) / 1000;
    let ox = 0, oy = Math.sin(t * 1.7 + s.phase) * 0.004 * (1 - S.dead) + (Math.sin(t * 1.3 + s.phase) * 0.5 + 0.5) * 0.03 * S.ghost;
    let rz = Math.sin(t * 0.6 + s.phase) * 0.008, tilt = 0;
    u.flash.value = 0;
    if (ht < 0.45) { const k = 1 - ht / 0.45; ox += Math.sin(ht * 70) * 0.025 * k; rz += Math.sin(ht * 50) * 0.05 * k; u.flash.value = 0.5 * k * k; }
    if (nt < 0.9) tilt = Math.sin((nt / 0.9) * Math.PI) * 0.16;
    if (ct < 1.2) oy += Math.abs(Math.sin(ct * Math.PI * 5)) * 0.03 * (1 - ct / 1.2);
    oy -= ease(clamp(S.dead, 0, 1)) * 0.1;
    s.fig.position.set(ox, s.bottom - TY + oy, 0);
    s.fig.rotation.set(tilt, 0, rz);
    s.fig.scale.y = s.h * (1 + Math.sin(t * 1.7 + s.phase) * 0.005);
  }
  // камера: параллакс от мыши, взгляд, тряска
  const P = R.par;
  P.x = damp(P.x, P.tx, 2.5, dt); P.y = damp(P.y, P.ty, 2.5, dt);
  R.shake = Math.max(0, R.shake - dt * 2.2);
  R.kick = Math.max(0, R.kick - dt * 5);
  const cam = R.camera;
  cam.position.copy(R.base.position);
  cam.quaternion.copy(R.base.quaternion);
  // постоянный лёгкий доворот: к тому, кто ходит или бьётся
  const LA = R.lookAt;
  const who = R.seats.find(s => s.data && s.data.fighter) || R.seats.find(s => s.data && s.data.turn);
  LA.on = damp(LA.on, who ? 1 : 0, 2, dt);
  if (who) LA.p.lerp(_tmp.set(who.home.x * 0.55, TY + 0.2, who.home.z * 0.4), 1 - Math.exp(-2.5 * dt));
  if (LA.on > 0.002) lookBlend(cam, LA.p, 0.11 * LA.on);
  if (R.look) {
    const k = (now - R.look.t0) / R.look.ms;
    if (k >= 1) R.look = null;
    else lookBlend(cam, R.look.p, R.look.w * (k < 0.25 ? easeIO(k / 0.25) : 1 - easeIO((k - 0.25) / 0.75)));
  }
  if (R.bokeh) R.bokeh.uniforms.focus.value = cam.position.distanceTo(_tmp.set(0, TY, -0.1));
  cam.position.x += P.x * 0.03;
  cam.position.y += -P.y * 0.014;
  cam.rotateY(-P.x * 0.012);
  const sh = R.shake * R.shake;
  cam.rotateX(R.kick * 0.03 + Math.sin(t * 41) * 0.012 * sh);
  cam.rotateY(Math.sin(t * 37 + 1) * 0.012 * sh);
  cam.rotateZ(Math.sin(t * 29 + 2) * 0.01 * sh);
  cam.updateMatrixWorld();
  const LL = R.lastLay;
  if (LL.p.distanceToSquared(cam.position) > 4e-6 || LL.q.angleTo(cam.quaternion) > 0.0015) { LL.p.copy(cam.position); LL.q.copy(cam.quaternion); layoutDOM(); }
  // защита от тормозов
  const pf = R.perf;
  pf.acc += dt; pf.n++;
  if (pf.acc > 2.5 && !lockedTier) {
    const avg = pf.acc / pf.n;
    pf.slow = avg > 0.034 ? pf.slow + 1 : 0;
    if (pf.slow >= 2) { pf.slow = 0; dropQuality(); }
    pf.acc = 0; pf.n = 0;
  }
}
function render() {
  if (!R) return;
  if (R.composer) R.composer.render(); else R.renderer.render(R.scene, R.camera);
}
function loop(now) {
  if (!R || !R.active) return;
  R.raf = requestAnimationFrame(loop);
  if (document.hidden) { R.last = now; return; }
  tick(now);
  render();
}
function setActive(on) {
  if (!R || on === R.active) return;
  R.active = on;
  cancelAnimationFrame(R.raf);
  if (on) { R.last = performance.now(); resize(); R.raf = requestAnimationFrame(loop); }
}

window.PZ3D = {
  supported, mount, unmount, mounted: () => !!R, setActive, update, layout: () => layoutDOM(), resize, fx,
  step: ms => { if (R) { tick(R.last + ms); render(); } },
  _debug: () => R,
  quality: () => (R ? { tier: R.tier, post: !!R.composer, dpr: R.renderer.getPixelRatio(), camD: R.camD, fov: R.camera.fov } : null),
};
