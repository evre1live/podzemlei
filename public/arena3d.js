// «Под Землёй» — 3D-арена боя. Герои (KayKit) и монстры (Quaternius) — настоящие анимированные модели (CC0).
// Арена живёт поверх панели боя: перевес сил виден по сгустку энергии между сторонами и по тому, кто чаще бьёт,
// а события боя (зелья, усилители, удары в спину, побег, победа) разыгрываются анимациями и эффектами.
import * as T from '/vendor/three-bundle.js';
import { def } from '/shared/cards.js';

const DIR = '/models/v1/';
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = { out: k => 1 - Math.pow(1 - k, 3), io: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2), back: k => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2) };

// ───────────── загрузка моделей ─────────────
const loader = new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder);
const gltfs = new Map();
const loadGLTF = name => { if (!gltfs.has(name)) gltfs.set(name, loader.loadAsync(DIR + name + '.glb').catch(e => { gltfs.delete(name); throw e; })); return gltfs.get(name); };
let kkLib = null;
const kkClips = () => (kkLib ||= Promise.all([loadGLTF('kk_anims'), loadGLTF('kk_anims_skel')]).then(a => a.flatMap(g => g.animations)));

// ───────────── кто есть кто ─────────────
// классы героев → модели KayKit; цвет — лёгкий оттенок поверх текстуры
const CLASS_HERO = {
  warrior: ['barbarian'], mage: ['mage'], cleric: ['knight', '#fff2c8'], rogue: ['rogue_hooded'], bard: ['rogue', '#ffd3ea'],
  alchemist: ['mage', '#c8ffd9'], engineer: ['knight', '#ffd59a'], witcher: ['rogue_hooded', '#9aa2ad'],
};
const HERO_ATK = {
  knight: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab'],
  barbarian: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin'],
  mage: ['Spellcast_Shoot'],
  rogue: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice'],
  rogue_hooded: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'],
};
const RACE_SIZE = { dwarf: [0.86, 1.1], halfling: [0.76, 1], elf: [1.06, 0.94], orc: [1.08, 1.06], goblin: [0.8, 1], molefolk: [0.9, 1.05] };

// монстры → модели. hue/sat — перекраска, size — рост относительно героя, n — сколько их, fly — парит
const MON = {
  m_slime: { m: 'q_slime_pink', hue: 190, size: 0.6 },
  m_floorboard: { m: 'q_blob_yeti', hue: 30, sat: 0.5, size: 0.62 },
  m_mold: { m: 'q_slime_spiky', hue: 58, size: 0.6 },
  m_moth: { m: 'q_fluffy_flyer', hue: 44, size: 0.7, fly: 0.55 },
  m_mosquito: { m: 'q_bee', hue: 205, size: 0.62, fly: 0.6 },
  m_roach: { m: 'q_crab', hue: 24, sat: 0.6, size: 0.65 },
  m_mole: { m: 'q_blob_ninja', hue: 25, sat: 0.45, light: 0.1, size: 0.7 },
  m_leech: { m: 'q_slime_drop', hue: 110, size: 0.62 },
  m_turnstile: { m: 'q_robot_large', hue: 205, size: 0.8 },
  m_ninjamole: { m: 'q_blob_ninja', size: 0.75 },
  m_beggar: { m: 'q_demon_blue', hue: 30, sat: 0.45, size: 0.85 },
  m_robovac: { m: 'q_robot_walker', size: 0.7 },
  m_duck: { m: 'q_blob_bird', hue: 50, size: 0.75 },
  m_gossip: { m: 'q_pebble_flyer', hue: 262, size: 0.8, fly: 0.5 },
  m_mycel: { m: 'q_mushroom_imp', hue: 305, size: 0.85 },
  m_hypno: { m: 'q_mushroom_imp', size: 0.9 },
  m_ratunion: { m: 'q_blob_alien', hue: 0, sat: 0.08, light: 0.08, size: 0.5, n: 3 },
  m_lasttrain: { m: 'q_ghost', hue: 182, size: 0.95, fly: 0.35, fx: 'ghost' },
  m_inspector: { m: 'skel_minion', kk: true, size: 0.95 },
  m_slug: { m: 'q_slime_horned', hue: 105, size: 0.85 },
  m_cart: { m: 'q_yeti', hue: 25, sat: 0.55, size: 1 },
  m_batchoir: { m: 'q_bat', size: 0.5, n: 3, fly: 0.75 },
  m_watchman: { m: 'q_ninja_brute', hue: 220, sat: 0.45, size: 1.05 },
  m_dj: { m: 'q_blob_alien', hue: 330, size: 0.6, n: 2 },
  m_plumber: { m: 'skel_rogue', kk: true, tint: '#efe0bc', size: 1 },
  m_banshee: { m: 'q_ghost', size: 1, fly: 0.35, fx: 'ghost' },
  m_cashier: { m: 'q_demon_blue', hue: 160, size: 0.95 },
  m_zhek: { m: 'q_robot_large', hue: 215, sat: 0.3, size: 1.1 },
  m_minotaur: { m: 'q_demon', hue: 18, sat: 0.6, size: 1.2 },
  m_endless: { m: 'q_jelly_flyer', hue: 258, size: 1.1, fly: 0.3 },
  m_salamander: { m: 'q_raptor', hue: 12, sat: 0.85, size: 1.05, fx: 'fire' },
  m_spider: { m: 'q_crab', hue: 335, size: 1 },
  m_croc: { m: 'q_raptor', hue: 130, sat: 0.6, size: 1.1 },
  m_paranoid: { m: 'q_alien_big', hue: 85, size: 1.1 },
  m_golem: { m: 'q_yeti', hue: 30, sat: 0.08, light: -0.05, size: 1.25 },
  m_worm: { m: 'q_slime_horned', hue: 352, size: 1.15 },
  m_ghostdriver: { m: 'q_ghost_skull', hue: 195, size: 1.1, fly: 0.35, fx: 'ghost' },
  m_excavator: { m: 'q_mech', hue: 45, sat: 0.8, size: 1.25 },
  m_mirror: { mirror: true, size: 1.05 },
  m_concrete: { m: 'q_orc_brute', hue: 210, sat: 0.08, size: 1.35 },
  m_vampire: { m: 'q_imp', hue: 345, size: 1.15, fly: 0.3 },
  m_heatpipe: { m: 'q_wyvern', hue: 18, sat: 0.85, size: 1.3, fly: 0.35, fx: 'fire' },
  m_lich: { m: 'skel_mage', kk: true, tint: '#b8ffcf', size: 1.2, fx: 'ghost' },
  m_moldking: { m: 'q_mushroom_king', hue: 85, size: 1.3 },
  m_ratqueen: { m: 'q_alien_big', hue: 300, size: 1.35 },
  m_troll: { m: 'q_orc_brute', size: 1.4 },
  m_cricket: { m: 'q_armored_bee', hue: 30, sat: 0.55, size: 1.35, fly: 0.3 },
  m_dragon: { m: 'q_dragon', hue: 6, size: 1.6, fly: 0.3, fx: 'fire' },
  m_pit: { m: 'q_blob_yeti', hue: 270, sat: 0.5, light: -0.12, size: 1.5 },
  m_philosopher: { m: 'q_pebble_flyer', hue: 28, sat: 0.45, size: 1.5, fly: 0.2 },
  m_molekron: { m: 'q_alien_big', hue: 25, sat: 0.55, size: 1.6 },
  m_gorynych: { m: 'q_dragon', hue: 125, size: 1.55, fly: 0.3, fx: 'fire', pals: [{ m: 'q_dragon_whelp', hue: 125, size: 0.75 }, { m: 'q_dragon_whelp', hue: 125, size: 0.75 }] },
  // сказки, мифы и легенды
  m_kolobok: { m: 'q_slime_pink', hue: 40, sat: 0.75, size: 0.6 },
  m_kikimora: { m: 'q_blob_orc', hue: 110, sat: 0.5, size: 0.85 },
  m_likho: { m: 'q_slime_green', hue: 25, sat: 0.35, size: 0.95 },
  m_mimic: { m: 'q_blob_yeti', hue: 35, sat: 0.6, size: 0.85 },
  m_medusa: { m: 'q_alien_big', hue: 140, sat: 0.55, size: 1.0 },
  m_leshy: { m: 'q_mushroom_king', hue: 95, sat: 0.55, size: 1.1 },
  m_cyclops: { m: 'q_orc_brute', hue: 205, sat: 0.35, size: 1.2 },
  m_solovey: { m: 'q_blob_bird', hue: 25, sat: 0.6, size: 0.95 },
  m_koschei: { m: 'q_skeleton', hue: 100, sat: 0.25, size: 1.2, fx: 'souls' },
  m_griffin: { m: 'q_wyvern', hue: 40, sat: 0.6, size: 1.2, fly: 0.35 },
  m_vodyanoy: { m: 'q_yeti', hue: 175, sat: 0.45, size: 1.2 },
  m_genie: { m: 'q_ghost', hue: 255, sat: 0.7, size: 1.2, fly: 0.35, fx: 'ghost' },
  m_babayaga: { m: 'q_blob_wizard', size: 1.1, fly: 0.25 },
  m_basilisk: { m: 'q_raptor', hue: 95, sat: 0.6, size: 1.25 },
  m_cerberus: { m: 'q_demon_blue', hue: 0, sat: 0.1, light: -0.25, size: 1.2, fx: 'fire', pals: [{ m: 'q_demon_blue', hue: 0, sat: 0.1, light: -0.25, size: 0.85 }, { m: 'q_demon_blue', hue: 0, sat: 0.1, light: -0.25, size: 0.85 }] },
  m_manticore: { m: 'q_demon', hue: 28, sat: 0.6, size: 1.35 },
  m_hydra: { m: 'q_dragon', hue: 160, size: 1.6, fly: 0.3, pals: [{ m: 'q_dragon_whelp', hue: 160, size: 0.8 }, { m: 'q_dragon_whelp', hue: 160, size: 0.8 }] },
  m_kraken: { m: 'q_jelly_flyer', hue: 330, size: 1.7, fly: 0.2 },
  m_lucifer: { m: 'q_demon', hue: 2, sat: 0.95, size: 1.95, fx: 'hell' },
  m_hades: { m: 'skel_mage', kk: true, tint: '#7fa6b8', size: 1.95, fx: 'souls' },
  m_anubis: { m: 'q_demon_blue', hue: 42, sat: 0.25, light: -0.28, size: 1.95, fx: 'gold' },
};
const monSpec = d => MON[d.id] || { m: 'q_slime_green', size: clamp(0.55 + (d.level || 5) * 0.05, 0.6, 1.6) };

// перекраска мультяшных моделей: меняем оттенок, глаза и зубы не трогаем
function retint(root, spec) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map(m0 => {
      const m = m0.clone();
      if (spec.tint) m.color.multiply(new T.Color(spec.tint));
      else if (spec.hue != null && !/eye|white|black|teeth|tooth|pupil|mouth|tongue/i.test(m.name)) {
        const hsl = {}; m.color.getHSL(hsl);
        if (hsl.s > 0.08 || spec.sat != null) m.color.setHSL(spec.hue / 360, spec.sat ?? Math.max(hsl.s, 0.45), clamp(hsl.l + (spec.light || 0), 0.06, 0.9));
      }
      return m;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
    o.frustumCulled = false;
  });
}

// ───────────── текстуры, нарисованные на лету ─────────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return t;
}
const glowTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const shadowTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.6)'); r.addColorStop(0.6, 'rgba(0,0,0,.25)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const ringTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.75, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const beamTex = canvasTex(128, 16, (g, w, h) => {
  const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 6, h); }
});
beamTex.wrapS = T.RepeatWrapping;
function floorTex(tint) {
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#2b2230'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 260; i++) { // каменные плиты
      const x = Math.random() * w, y = Math.random() * w, s = 18 + Math.random() * 46;
      g.fillStyle = `hsla(${280 + Math.random() * 40}, 12%, ${14 + Math.random() * 12}%, .9)`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.55 + Math.random() * 0.3), Math.random() * 3, 0, TAU); g.fill();
    }
    const r = g.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2);
    r.addColorStop(0, tint); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
}
const runeTex = canvasTex(512, 512, (g, w) => {
  const c = w / 2;
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6;
  g.beginPath(); g.arc(c, c, c - 10, 0, TAU); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(c, c, c - 34, 0, TAU); g.stroke();
  g.font = '28px serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.save(); g.translate(c + Math.cos(a) * (c - 22), c + Math.sin(a) * (c - 22)); g.rotate(a + Math.PI / 2); g.fillText(glyphs[i], 0, 0); g.restore(); }
  g.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * (c - 34), c + Math.sin(a) * (c - 34)); g.lineTo(c + Math.cos(a + Math.PI * 2 / 3) * (c - 34), c + Math.sin(a + Math.PI * 2 / 3) * (c - 34)); g.stroke(); }
});
function textSprite(text, color = '#fff', size = 64) {
  const tex = canvasTex(256, 128, (g, w, h) => { g.font = `bold ${size}px Underdog, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(20,10,30,.85)'; g.strokeText(text, w / 2, h / 2); g.fillStyle = color; g.fillText(text, w / 2, h / 2); });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.45, 1);
  return s;
}

// ───────────── частицы ─────────────
const PVERT = `attribute float size; attribute vec4 tint; varying vec4 vTint; void main(){ vTint = tint; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const PFRAG = `uniform sampler2D map; varying vec4 vTint; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vTint.rgb, vTint.a * t.a); if (gl_FragColor.a < 0.01) discard; }`;
class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.list = [];
    const g = new T.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.tint = new Float32Array(max * 4);
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('size', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
    g.setAttribute('tint', new T.BufferAttribute(this.tint, 4).setUsage(T.DynamicDrawUsage));
    this.geo = g;
    const mat = new T.ShaderMaterial({ uniforms: { map: { value: glowTex } }, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
    this.points = new T.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 20 : 10;
    scene.add(this.points);
  }
  emit(o) {
    const n = Math.round(o.n * (Particles.quality || 1));
    for (let i = 0; i < n && this.list.length < this.max; i++) {
      const a = rnd(0, TAU), up = o.up ?? 1, sp = rnd(o.speed?.[0] ?? 0.5, o.speed?.[1] ?? 2);
      const dir = o.dir ? new T.Vector3(...o.dir).normalize() : new T.Vector3(Math.cos(a) * (o.spreadXZ ?? 1), rnd(-0.2, 1) * up, Math.sin(a) * (o.spreadXZ ?? 1) * 0.6).normalize();
      if (o.dir && o.cone) dir.add(new T.Vector3(rnd(-o.cone, o.cone), rnd(-o.cone, o.cone), rnd(-o.cone, o.cone) * 0.5)).normalize();
      const p0 = new T.Vector3(...o.at).add(new T.Vector3(rnd(-1, 1) * (o.area?.[0] || 0), rnd(-1, 1) * (o.area?.[1] || 0), rnd(-1, 1) * (o.area?.[2] || 0)));
      const col = new T.Color(pick(o.colors || ['#fff']));
      this.list.push({ p: p0, v: dir.multiplyScalar(sp), life: 0, max: rnd(o.life?.[0] ?? 0.5, o.life?.[1] ?? 1), size: rnd(o.size?.[0] ?? 0.08, o.size?.[1] ?? 0.16), col, g: o.g ?? -2.5, drag: o.drag ?? 1.2, grow: o.grow ?? 0, alpha: o.alpha ?? 1, delay: rnd(0, o.delay || 0), twinkle: o.twinkle || 0 });
    }
  }
  update(dt) {
    let j = 0;
    for (const q of this.list) {
      if (q.delay > 0) { q.delay -= dt; this.list[j++] = q; continue; }
      q.life += dt;
      if (q.life >= q.max) continue;
      q.v.y += q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt);
      if (q.p.y < 0.02 && q.g < 0) { q.p.y = 0.02; q.v.y *= -0.3; q.v.x *= 0.7; q.v.z *= 0.7; }
      this.list[j++] = q;
    }
    this.list.length = j;
    for (let i = 0; i < this.max; i++) {
      const q = this.list[i];
      if (!q || q.delay > 0) { this.size[i] = 0; this.tint[i * 4 + 3] = 0; continue; }
      const k = q.life / q.max;
      this.pos[i * 3] = q.p.x; this.pos[i * 3 + 1] = q.p.y; this.pos[i * 3 + 2] = q.p.z;
      this.size[i] = q.size * (1 + q.grow * k) * 10;
      const fade = k < 0.12 ? k / 0.12 : 1 - Math.pow((k - 0.12) / 0.88, 1.6);
      const tw = q.twinkle ? 0.55 + 0.45 * Math.sin(q.life * q.twinkle) : 1;
      this.tint[i * 4] = q.col.r; this.tint[i * 4 + 1] = q.col.g; this.tint[i * 4 + 2] = q.col.b; this.tint[i * 4 + 3] = q.alpha * fade * tw;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.size.needsUpdate = true; this.geo.attributes.tint.needsUpdate = true;
  }
}

// ───────────── актёры: герои и монстры ─────────────
const findClip = (clips, ...res) => { for (const re of res) { const c = clips.find(x => re.test(x.name)); if (c) return c; } return null; };
function clipSetQ(clips) {
  const tail = c => c.name.split('|').pop();
  const by = re => clips.filter(c => re.test(tail(c)));
  return {
    idle: findClip(clips, /(^|\|)(idle|flying_idle|slime_idle|skeleton_idle|frog_idle|trex_idle|velociraptor_idle)$/i, /flying$/i, /idle/i, /walk/i) || clips[0],
    attack: by(/attack|bite_front|punch|headbutt|weapon|kick|slash|shoot/i),
    hit: findClip(clips, /hit|recieve|react/i),
    death: findClip(clips, /death|dead/i),
    run: findClip(clips, /fast_flying/i, /(^|\|)run$/i, /run|gallop|walk/i),
    taunt: findClip(clips, /dance/i, /(^|\|)yes$/i, /wave/i, /jump$/i),
    spawn: findClip(clips, /spawn/i),
  };
}
function clipSetKK(clips, kind) {
  const get = n => clips.find(c => c.name === n) || null;
  const hero = kind in HERO_ATK;
  return {
    idle: get(kind === 'barbarian' ? '2H_Melee_Idle' : hero ? 'Idle' : 'Idle_Combat') || get('Idle'),
    attack: (hero ? HERO_ATK[kind] : ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Spin', '1H_Melee_Attack_Jump_Chop']).map(get).filter(Boolean),
    cast: get('Spellcast_Shoot'), raise: get('Spellcast_Raise'), drink: get('Use_Item'), throw: get('Throw'),
    hit: get('Hit_A'), hit2: get('Hit_B'), block: get('Block'), death: hero ? get('Death_A') : get('Death_C_Skeletons') || get('Death_A'),
    run: get('Running_A'), cheer: get('Cheer'), dodge: get('Dodge_Backward'), jump: get('Jump_Full_Short'), lie: get('Lie_Down'),
    spawn: hero ? null : get('Spawn_Ground_Skeletons'), taunt: get('Cheer'), summon: get('Spellcast_Summon'),
  };
}

// честная высота анимированной модели: кости в позе покоя
function measure(obj) {
  obj.updateMatrixWorld(true);
  const box = new T.Box3();
  obj.traverse(o => {
    if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
    else if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
  });
  return box;
}

class Actor {
  constructor(arena, o) {
    this.a = arena; this.side = o.side; this.id = o.id; this.uid = o.uid || null; this.height = o.height;
    this.root = new T.Group(); this.root.position.copy(o.pos); this.home = o.pos.clone();
    this.face = o.side === 'hero' ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42;
    this.root.rotation.y = this.face;
    this.body = new T.Group(); this.root.add(this.body);
    this.fly = o.fly || 0; this.alive = true; this.busyUntil = 0; this.phase = Math.random() * 10;
    const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.scale.setScalar(o.height * 0.9 * (o.wide || 1));
    this.shadow = sh; this.root.add(sh);
    if (o.ring) { // цветное кольцо места игрока под героем
      const ring = new T.Mesh(new T.RingGeometry(0.36, 0.42, 40), new T.MeshBasicMaterial({ color: o.ring, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; ring.scale.setScalar(o.height * 1.1); this.ringMesh = ring; this.root.add(ring);
    }
    arena.scene.add(this.root);
  }
  attach(model, clips, set, scale) {
    this.model = model; this.clips = clips; this.set = set;
    model.scale.multiply(scale);
    this.body.add(model);
    this.mixer = new T.AnimationMixer(model);
    this.mixer.addEventListener('finished', e => this.onFinished(e));
    this.loop(set.idle);
  }
  action(clip) { return clip ? this.mixer.clipAction(clip) : null; }
  loop(clip, fade = 0.25) {
    const act = this.action(clip); if (!act) return;
    act.reset(); act.setLoop(T.LoopRepeat); act.clampWhenFinished = false; act.enabled = true; act.setEffectiveWeight(1); act.time = Math.random() * clip.duration;
    if (this.current && this.current !== act) act.crossFadeFrom(this.current, fade, false);
    act.play(); this.current = act; this.looping = clip;
  }
  // разовое действие с плавным переходом и возвратом к стойке
  once(clip, { fade = 0.12, speed = 1, hold = false, then = null } = {}) {
    if (!this.mixer || !clip) return 0;
    const act = this.action(clip);
    act.reset(); act.setLoop(T.LoopOnce, 1); act.clampWhenFinished = true; act.timeScale = speed; act.enabled = true; act.setEffectiveWeight(1);
    if (this.current && this.current !== act) act.crossFadeFrom(this.current, fade, false);
    act.play(); this.current = act; this.hold = hold; this.after = then;
    return clip.duration / speed;
  }
  onFinished(e) {
    if (e.action !== this.current || this.hold) return;
    const next = this.after; this.after = null;
    this.loop(next || this.set.idle, 0.2);
  }
  attack() {
    if (!this.alive || !this.mixer) return 0;
    const c = pick(this.set.attack.length ? this.set.attack : [this.set.taunt || this.set.idle]);
    const d = this.once(c, { speed: 1.15 });
    this.lunge(this.side === 'hero' ? 0.32 : -0.32, d);
    return d;
  }
  hit(dir) { if (!this.alive) return; this.once(this.set.hit2 && Math.random() < 0.5 ? this.set.hit2 : this.set.hit, { speed: 1.2 }); this.knock(dir); }
  lunge(dx, d) { const a = this.a, x0 = this.home.x; a.tween(Math.max(0.3, d), k => { this.root.position.x = x0 + dx * Math.sin(Math.min(1, k * 1.6) * Math.PI); }); }
  knock(dir) { const a = this.a, x0 = this.home.x; a.tween(0.45, k => { this.root.position.x = x0 + dir * 0.18 * Math.sin(k * Math.PI) * (1 - k * 0.5); }); }
  die() {
    if (!this.alive) return 0; this.alive = false;
    return this.once(this.set.death, { hold: true, speed: 1 }) || 0.6;
  }
  update(dt, t) {
    this.mixer?.update(dt * (this.slow || 1));
    if (this.fly) this.body.position.y = this.fly + Math.sin(t * 2.2 + this.phase) * 0.06;
    if (this.ringMesh) this.ringMesh.material.opacity = 0.55 + 0.3 * Math.sin(t * 3 + this.phase);
  }
  chest() { return new T.Vector3().copy(this.root.position).add(new T.Vector3(0, this.height * 0.55 + this.fly, 0)); }
  dispose() { this.a.scene.remove(this.root); this.mixer?.stopAllAction(); }
}

// ───────────── сама арена ─────────────
export class Arena {
  constructor(host, { lite = false } = {}) {
    this.host = host; this.lite = lite;
    Particles.quality = lite ? 0.5 : 1;
    const r = this.renderer = new T.WebGLRenderer({ antialias: !lite, alpha: false, powerPreference: 'high-performance' });
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.6));
    host.append(r.domElement);
    const s = this.scene = new T.Scene();
    s.background = new T.Color('#191320');
    s.fog = new T.Fog('#191320', 7, 15);
    this.cam = new T.PerspectiveCamera(30, 2, 0.1, 60);
    this.camBase = new T.Vector3(0, 1.7, 7); this.look = new T.Vector3(0, 0.75, 0);
    // свет: тёплый ключевой, холодный контровой, мягкий общий
    s.add(new T.HemisphereLight(0xffe9d0, 0x2a1830, 1.25));
    const key = new T.DirectionalLight(0xfff0dc, 2.3); key.position.set(-2.5, 5, 4.5); s.add(key);
    const rim = new T.DirectionalLight(0x8fb8ff, 1.5); rim.position.set(3, 3, -4); s.add(rim);
    const fill = new T.DirectionalLight(0xffe2c8, 1.1); fill.position.set(0.5, 2, 7); s.add(fill); // со стороны зрителя, чтобы тёмные модели не тонули
    this.heroLight = new T.PointLight(0x5effc0, 0, 6, 1.6); this.heroLight.position.set(-1.6, 1.2, 1); s.add(this.heroLight);
    this.monLight = new T.PointLight(0xff4a2a, 0, 6, 1.6); this.monLight.position.set(1.6, 1.2, 1); s.add(this.monLight);
    this.flashLight = new T.PointLight(0xffffff, 0, 7, 1.4); this.flashLight.position.set(0, 1.2, 1.2); s.add(this.flashLight);
    this.buildCave();
    this.add = new Particles(s, lite ? 500 : 1200, true);
    this.norm = new Particles(s, lite ? 250 : 600, false);
    this.buildClash();
    this.tweens = []; this.timers = []; this.actors = new Map(); this.heroes = []; this.monsters = [];
    this.k = 0.5; this.kShown = 0.5; this.power = 0; this.shake = 0; this.t = 0; this.nextExchange = 2.5;
    this.clock = new T.Clock();
    if (!lite) {
      try {
        this.composer = new T.EffectComposer(r);
        this.composer.addPass(new T.RenderPass(s, this.cam));
        this.bloom = new T.UnrealBloomPass(new T.Vector2(256, 128), 0.42, 0.4, 0.86);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new T.OutputPass());
      } catch { this.composer = null; }
    }
    this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.running = true;
    this.loopFn = () => { if (!this.running) return; this.frame(); this.raf = requestAnimationFrame(this.loopFn); };
    this.raf = requestAnimationFrame(this.loopFn);
  }
  buildCave() {
    const s = this.scene;
    this.floorMat = new T.MeshStandardMaterial({ map: floorTex('rgba(255,170,90,.32)'), roughness: 0.95, metalness: 0 });
    const floor = new T.Mesh(new T.CircleGeometry(9, 48), this.floorMat); floor.rotation.x = -Math.PI / 2; s.add(floor);
    this.rune = new T.Mesh(new T.PlaneGeometry(4.6, 4.6), new T.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.2, depthWrite: false, blending: T.AdditiveBlending, color: 0xffc46a }));
    this.rune.rotation.x = -Math.PI / 2; this.rune.position.y = 0.02; s.add(this.rune);
    // скалы по краям и сталактиты
    const rockMat = new T.MeshStandardMaterial({ color: '#3a2e40', roughness: 1, flatShading: true });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI + Math.PI, R = rnd(5.2, 7.5);
      const m = new T.Mesh(new T.DodecahedronGeometry(rnd(0.6, 1.5), 0), rockMat);
      m.position.set(Math.cos(a) * R * 1.3, rnd(0, 0.6), Math.sin(a) * R * 0.75 - 1.2); m.scale.y = rnd(0.8, 2.4); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); s.add(m);
    }
    const stal = new T.MeshStandardMaterial({ color: '#2c2233', roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) { const m = new T.Mesh(new T.ConeGeometry(rnd(0.15, 0.4), rnd(0.8, 2.2), 6), stal); m.position.set(rnd(-6, 6), 4.6, rnd(-4, -1)); m.rotation.x = Math.PI; s.add(m); }
    // кристаллы светятся в темноте
    const crys = new T.MeshStandardMaterial({ color: '#8f6bc9', emissive: '#5b2fa8', emissiveIntensity: 1.2, roughness: 0.3, flatShading: true });
    for (const [x, z] of [[-4.2, -2.6], [4.6, -2.2], [-3.2, -3.6], [3.4, -3.8]]) for (let j = 0; j < 3; j++) { const m = new T.Mesh(new T.OctahedronGeometry(rnd(0.15, 0.3), 0), crys); m.position.set(x + rnd(-0.3, 0.3), rnd(0.1, 0.35), z + rnd(-0.3, 0.3)); m.scale.y = rnd(1.6, 2.8); m.rotation.z = rnd(-0.4, 0.4); s.add(m); }
    // факелы
    this.torches = [];
    for (const x of [-3.4, 3.4]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 1.4, 8), new T.MeshStandardMaterial({ color: '#4a3424' })); pole.position.set(x, 0.7, -2.4); s.add(pole);
      const flame = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffa54a, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); flame.position.set(x, 1.5, -2.4); flame.scale.setScalar(0.6); s.add(flame);
      const l = new T.PointLight(0xff9a4a, 1.6, 7, 1.5); l.position.set(x, 1.6, -2.2); s.add(l);
      this.torches.push({ flame, l, x });
    }
    this.motes = new Particles(s, 80, true);
  }
  buildClash() {
    const s = this.scene;
    const mk = color => { const m = new T.Mesh(new T.PlaneGeometry(1, 0.18), new T.MeshBasicMaterial({ map: beamTex.clone(), color, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending })); m.material.map.wrapS = T.RepeatWrapping; m.renderOrder = 15; s.add(m); return m; };
    this.beamH = mk(0x5effc0); this.beamM = mk(0xff4a2a);
    this.orb = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); this.orb.renderOrder = 16; s.add(this.orb);
    this.orbCore = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); this.orbCore.renderOrder = 17; s.add(this.orbCore);
    this.auraH = this.groundGlow(0x5effc0); this.auraM = this.groundGlow(0xff4a2a);
    this.setClashVisible(false);
  }
  groundGlow(color) {
    const m = new T.Mesh(new T.PlaneGeometry(2.4, 2.4), new T.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.03; this.scene.add(m); return m;
  }
  setClashVisible(v) { for (const o of [this.beamH, this.beamM, this.orb, this.orbCore]) o.visible = v; }
  resize() {
    const w = Math.max(10, this.host.clientWidth), h = Math.max(10, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
    this.cam.aspect = w / h;
    // на узком экране отъезжаем, чтобы обе стороны помещались
    // на узком (телефонном) экране смотрим из-за плеча героя: стороны уходят вглубь и помещаются крупнее
    // и шире угол обзора: в портретном кадре по горизонтали иначе почти ничего не помещается
    const narrow = clamp((1.5 - this.cam.aspect) / 0.75, 0, 1);
    this.yaw = 0.85 * narrow;
    this.cam.fov = 30 + 20 * narrow;
    const need = 2.9 - 1.2 * narrow, half = Math.tan(T.MathUtils.degToRad(this.cam.fov / 2)) * this.cam.aspect;
    this.camBase.z = Math.max(4.6, need / half + 0.6);
    this.camBase.y = 1.5 + this.camBase.z * 0.05;
    // снизу арену закрывают кнопки — поднимаем картинку, чтобы бойцы стояли над ними
    this.cam.setViewOffset(w, h, 0, h * (0.08 + 0.04 * narrow), w, h);
    this.cam.updateProjectionMatrix();
  }
  setTheme(loc) {
    const art = loc ? def(loc).art : '';
    const T0 = { loc_lava: ['#ff6a2a', '#2a1210'], loc_boiler: ['#ff8a3a', '#24130f'], loc_ice: ['#8fe8ff', '#121c26'], loc_water: ['#6fd8ea', '#10202a'], loc_lake: ['#6fd8ea', '#10202a'], loc_mushroom: ['#7dff9a', '#122016'], loc_garden: ['#c8ff7a', '#161f12'], loc_crystal: ['#d29aff', '#1a1226'], loc_dark: ['#ffd27a', '#0a0709'], loc_storm: ['#a8b8ff', '#121426'], loc_temple: ['#ffe9a8', '#221a12'], loc_vault: ['#ffd56a', '#211a0e'], loc_lair: ['#ffb347', '#24160c'], loc_station: ['#b9a6ff', '#16122a'], loc_rats: ['#ff7a5a', '#1f1014'], loc_tavern: ['#ffb26a', '#22160e'], loc_market: ['#ff9ad2', '#22121c'], loc_echo: ['#d9b3ff', '#18122a'], loc_flooded: ['#6fd8ea', '#0f1c24'] }[art] || ['#ffb46a', '#191320'];
    this.scene.background.set(T0[1]); this.scene.fog.color.set(T0[1]);
    this.torches.forEach(t => { t.l.color.set(T0[0]); t.flame.material.color.set(T0[0]); });
    this.rune.material.color.set(T0[0]);
  }
  tween(dur, fn, done) { this.tweens.push({ t: 0, dur, fn, done }); }
  after(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }
  flash(color = 0xffffff, power = 6, dur = 0.25) { this.flashLight.color.set(color); this.tween(dur, k => { this.flashLight.intensity = power * (1 - k); }); }
  shock(at, color = 0xffffff, size = 1.6, dur = 0.5) {
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: ringTex, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, 0.05, at.z); this.scene.add(m);
    this.tween(dur, k => { m.scale.setScalar(0.2 + size * ease.out(k)); m.material.opacity = 1 - k; }, () => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
  slash(at, color = 0xfff3c0, flip = false) {
    const m = new T.Mesh(new T.RingGeometry(0.42, 0.55, 32, 1, 0, Math.PI * 0.9), new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    m.position.copy(at); m.rotation.z = flip ? Math.PI * 0.6 : -Math.PI * 0.15; m.renderOrder = 22; this.scene.add(m);
    this.tween(0.22, k => { m.rotation.z += (flip ? 0.12 : -0.12); m.material.opacity = 1 - k; m.scale.setScalar(1 + k * 0.5); }, () => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
  sparks(at, colors = ['#fff3b0', '#ffd27a', '#ffffff'], n = 26) {
    this.add.emit({ at: [at.x, at.y, at.z], n, speed: [1.5, 4.2], life: [0.25, 0.6], size: [0.05, 0.11], colors, g: -6, drag: 2 });
    this.add.emit({ at: [at.x, at.y, at.z], n: 2, speed: [0, 0.1], life: [0.1, 0.16], size: [0.35, 0.5], colors: [colors[0]], g: 0, alpha: 0.7 });
  }
  impact(target, color = '#fff3b0', strong = false) {
    const at = target.chest();
    at.z += 0.15;
    this.sparks(at, [color, '#ffffff', '#ffd27a'], strong ? 46 : 24);
    this.shock(target.root.position, new T.Color(color), strong ? 2.6 : 1.4);
    this.flash(new T.Color(color), strong ? 9 : 4);
    this.shake = Math.max(this.shake, strong ? 0.12 : 0.05);
  }

  // ───── моделирование актёров ─────
  async makeHero(p, slot) {
    const cls = p.classes?.[0] ? def(p.classes[0]).cls : null;
    const [kind, tint] = CLASS_HERO[cls] || ['knight'];
    const race = p.races?.[0] ? def(p.races[0]).race : null;
    const [hs, wide] = RACE_SIZE[race] || [1, 1];
    const pos = slot === 0 ? new T.Vector3(-1.35, 0, 0.1) : new T.Vector3(-2.15, 0, -0.55);
    const a = new Actor(this, { side: 'hero', id: p.id, pos, height: 1 * hs, ring: p.color, wide });
    a.kind = kind; a.name = p.name;
    try {
      const [g, clips] = await Promise.all([loadGLTF('hero_' + kind), kkClips()]);
      if (this.disposed) return a;
      const model = T.cloneSkinned(g.scene);
      if (tint) retint(model, { tint });
      const box = measure(model); const s = hs / (box.max.y - box.min.y);
      a.attach(model, clips, clipSetKK(clips, kind), new T.Vector3(s * wide, s, s * wide));
    } catch (e) { console.warn('hero model', e); }
    return a;
  }
  async makeMonster(m, i, total, mirrorOf) {
    const d = def(m.uid);
    const spec = monSpec(d);
    const H = spec.size || 1;
    const x = 1.35 + (total > 1 ? (i * 0.85) : 0), z = total > 1 ? (i % 2 ? -0.55 : 0.2) - i * 0.12 : 0.05;
    const group = [];
    const add = async (sp, pos, h) => {
      const a = new Actor(this, { side: 'mon', id: m.uid + ':' + group.length, uid: m.uid, pos, height: h, fly: sp.fly ? sp.fly * h : 0, wide: sp.n ? 0.8 : 1.3 });
      a.spec = sp; group.push(a);
      try {
        if (sp.mirror) {
          const leader = mirrorOf;
          const kind = (CLASS_HERO[leader?.classes?.[0] ? def(leader.classes[0]).cls : null] || ['knight'])[0];
          const [g, clips] = await Promise.all([loadGLTF('hero_' + kind), kkClips()]);
          const model = T.cloneSkinned(g.scene);
          model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#b8d8ff'); o.material.metalness = 0.9; o.material.roughness = 0.15; o.material.transparent = true; o.material.opacity = 0.85; o.material.emissive = new T.Color('#2a4a8a'); } });
          const box = measure(model); const s = h / (box.max.y - box.min.y);
          a.attach(model, clips, clipSetKK(clips, kind), new T.Vector3(s, s, s));
        } else if (sp.kk) {
          const [g, clips] = await Promise.all([loadGLTF(sp.m), kkClips()]);
          const model = T.cloneSkinned(g.scene);
          retint(model, sp);
          const box = measure(model); const s = h / (box.max.y - box.min.y);
          a.attach(model, clips, clipSetKK(clips, 'skel'), new T.Vector3(s, s, s));
        } else {
          const g = await loadGLTF(sp.m);
          const model = T.cloneSkinned(g.scene);
          retint(model, sp);
          const box = measure(model); const s = h / (box.max.y - box.min.y);
          model.position.y -= box.min.y * s;
          a.attach(model, g.animations, clipSetQ(g.animations), new T.Vector3(s, s, s));
        }
      } catch (e) { console.warn('monster model', sp.m, e); }
    };
    const n = spec.n || 1;
    for (let k = 0; k < n; k++) {
      const off = n > 1 ? new T.Vector3((k - (n - 1) / 2) * 0.55, 0, (k % 2) * -0.35) : new T.Vector3();
      await add(spec, new T.Vector3(x, 0, z).add(off), H);
    }
    for (const [k, pal] of (spec.pals || []).entries()) await add(pal, new T.Vector3(x + 0.55, 0, z + (k ? 0.75 : -0.85)), pal.size);
    return group;
  }
  spawnFx(a, boss) {
    const p = a.root.position;
    if (boss) return;
    this.norm.emit({ at: [p.x, 0.1, p.z], area: [0.3, 0, 0.2], n: 18, speed: [0.5, 1.4], life: [0.45, 0.9], size: [0.09, 0.17], colors: ['#5a4a66', '#3a2e44', '#7a6a86'], g: 0.6, drag: 1.8, grow: 0.9, alpha: 0.6, up: 0.6 });
    this.add.emit({ at: [p.x, 0.2, p.z], n: 20, speed: [1, 2.6], life: [0.4, 0.8], size: [0.05, 0.1], colors: ['#d9b3ff', '#ffffff', '#b88ae6'], g: -1 });
    this.shock(p, 0xd9b3ff, 1.6);
  }

  // ───── главная синхронизация с состоянием игры ─────
  // вызовы идут строго по очереди: модели грузятся асинхронно, а состояние меняется быстро
  sync(game, fresh) {
    this.chain = (this.chain || Promise.resolve()).then(() => this.syncNow(game, fresh)).catch(e => { console.warn('arena', e); return { active: false }; });
    return this.chain;
  }
  async syncNow(game, fresh) {
    if (this.disposed) return { active: false };
    const c = game.combat;
    this.setTheme(game.location);
    if (!c) {
      // бой закончился: доигрываем развязку и гасим арену
      if (!this.key) return { active: false };
      const ends = (fresh || []).filter(f => ['victory', 'escaped', 'caught', 'vanish', 'pet', 'death'].includes(f.kind));
      const dur = ends.length && !this.ended ? this.finale(ends, game) : 0;
      this.key = null;
      return { active: dur > 0, until: performance.now() + dur * 1000 };
    }
    const key = `${game.turn.n}:${c.fighter}:${c.monsters[0]?.uid || ''}`;
    if (key !== this.key) await this.startFight(game, key);
    if (this.disposed) return;
    // новые участники: помощник и монстры «из темноты»
    const heroIds = [c.fighter, c.helper].filter(Boolean);
    for (const [slot, id] of heroIds.entries()) if (!this.actors.has(id)) await this.addHero(game, id, slot, true);
    const uids = c.monsters.map(m => m.uid);
    for (const [i, m] of c.monsters.entries()) if (!this.monUids.has(m.uid)) await this.addMonster(game, m, i, uids.length, true);
    this.setBalance(c.numbers);
    this.react(fresh || [], game);
    // монстр исчез (окаменел, уснул) — его разыгрывает событие, а здесь подчищаем на всякий случай
    for (const uid of [...this.monUids]) if (!uids.includes(uid) && !this.leaving.has(uid)) this.vanish([uid], 'stone');
    return { active: true };
  }
  async startFight(game, key) {
    this.clearActors();
    this.key = key; this.monUids = new Set(); this.leaving = new Set(); this.ended = false; this.balanceReady = false;
    const c = game.combat;
    this.setClashVisible(true);
    this.kShown = 0.5;
    const tasks = [this.addHero(game, c.fighter, 0, false)];
    if (c.helper) tasks.push(this.addHero(game, c.helper, 1, false));
    c.monsters.forEach((m, i) => tasks.push(this.addMonster(game, m, i, c.monsters.length, false)));
    await Promise.all(tasks);
  }
  async addHero(game, id, slot, entering) {
    const p = game.players.find(x => x.id === id);
    if (!p || this.actors.has(id)) return;
    this.actors.set(id, null);
    const a = await this.makeHero(p, slot);
    if (this.disposed) return;
    this.actors.set(id, a); this.heroes.push(a);
    // герой вбегает на арену
    const x1 = a.home.x; a.root.position.x = x1 - 3.2;
    if (a.set?.run) a.loop(a.set.run, 0.1);
    this.tween(entering ? 0.9 : 0.75, k => { a.root.position.x = x1 - 3.2 * (1 - ease.out(k)); }, () => { if (a.set) a.loop(a.set.idle, 0.2); });
  }
  async addMonster(game, m, i, total, entering) {
    this.monUids.add(m.uid);
    const leader = [...game.players].sort((a, b) => b.level - a.level)[0];
    const d = def(m.uid);
    const delay = entering ? 0.15 : 1.15; // ждём, пока карта монстра долетит на своё место
    const group = await this.makeMonster(m, i, total, leader);
    if (this.disposed) return;
    for (const a of group) {
      this.monsters.push(a);
      a.root.visible = false;
      this.after(delay, () => {
        a.root.visible = true;
        const s0 = a.root.scale.clone();
        a.root.scale.setScalar(0.01);
        this.tween(0.55, k => a.root.scale.copy(s0).multiplyScalar(ease.back(k)));
        if (d.boss) this.bossEntrance(a, d); else this.spawnFx(a);
        if (a.set?.spawn) a.once(a.set.spawn, { speed: 1.4 });
        else if (a.set?.taunt && Math.random() < 0.6) a.once(a.set.taunt);
        else this.after(0.4, () => a.attack());
      });
    }
  }
  bossEntrance(a, d) {
    const p = a.root.position;
    const color = { hell: ['#ff4a1a', '#ffb347', '#ff2a10'], souls: ['#5affa8', '#c8ffe8', '#2a8a6a'], gold: ['#ffd56a', '#fff3b0', '#c8902c'] }[a.spec.fx] || ['#ff4a1a', '#ffb347'];
    this.add.emit({ at: [p.x, 0.05, p.z], area: [0.6, 0, 0.4], n: 120, speed: [1.5, 3.8], dir: [0, 1, 0], cone: 0.35, life: [0.6, 1.4], size: [0.1, 0.24], colors: color, g: 0.5, drag: 0.6 });
    this.shock(p, new T.Color(color[0]), 3.4, 0.8);
    this.after(0.25, () => this.shock(p, new T.Color(color[1]), 2.4, 0.7));
    this.flash(new T.Color(color[0]), 14, 0.6);
    this.shake = 0.2;
    a.auraFx = a.spec.fx;
  }
  setBalance(n) {
    const h = Math.max(0, n.heroes), m = Math.max(0, n.monsters);
    const k = h + m > 0 ? h / (h + m) : 0.5;
    const changed = this.balanceReady && Math.abs(k - this.k) > 0.001;
    const dir = Math.sign(k - this.k);
    this.k = k; this.power = Math.min(1, (h + m) / 40); this.winning = n.winning;
    if (!this.balanceReady) { this.balanceReady = true; return; }
    if (changed && this.heroes.length && this.monsters.length) {
      // сила сместилась — сторона, которая выросла, бьёт; вторая принимает удар
      const att = dir > 0 ? this.lead('hero') : this.lead('mon');
      const def0 = dir > 0 ? this.lead('mon') : this.lead('hero');
      if (att && def0) this.exchange(att, def0, Math.abs(dir) > 0 && Math.abs(k - this.kShown) > 0.12);
    }
  }
  lead(side) { return (side === 'hero' ? this.heroes : this.monsters).find(a => a.alive && a.model) || null; }
  exchange(att, target, strong = false, blocked = false) {
    const d = att.attack();
    const hitAt = Math.max(0.18, d * 0.42);
    this.after(hitAt, () => {
      if (!target.alive) return;
      const color = att.side === 'hero' ? '#8ff0d2' : '#ff8a66';
      if (att.kind === 'mage' && att.side === 'hero') this.bolt(att, target, '#9ad0ff');
      if (blocked && target.set?.block) { target.once(target.set.block); this.sparks(target.chest(), ['#ffffff', '#c9ced8'], 14); return; }
      target.hit(target.side === 'hero' ? -1 : 1);
      this.impact(target, color, strong);
      this.slash(target.chest().add(new T.Vector3(0, 0, 0.3)), new T.Color(color), att.side !== 'hero');
    });
    return hitAt;
  }
  bolt(from, to, color) {
    const a = from.chest(), b = to.chest();
    for (let i = 0; i < 6; i++) this.after(i * 0.03, () => this.add.emit({ at: [a.x + (b.x - a.x) * (i / 6), a.y + (b.y - a.y) * (i / 6), a.z + 0.2], n: 8, speed: [0.2, 0.8], life: [0.2, 0.45], size: [0.08, 0.16], colors: [color, '#ffffff'], g: 0 }));
  }

  // ───── события боя ─────
  react(list, game) {
    for (const f of list) {
      const hero = this.actors.get(f.pid);
      switch (f.kind) {
        case 'mod': {
          const side = f.side === 'monster' ? 'mon' : 'hero';
          const a = this.lead(side);
          if (a) this.aura(a, side === 'hero' ? '#8ff0d2' : '#ff6a4a');
          break;
        }
        case 'buff': if (hero) { hero.once(hero.set?.drink || hero.set?.raise); this.aura(hero, '#ffb0d0'); } break;
        case 'power': if (hero) {
          if (f.ab === 'rage') { hero.once(hero.set?.cheer); this.aura(hero, '#ff5a3d', 50); }
          else if (f.ab === 'turn') { hero.once(hero.set?.raise); this.monsters.forEach(m => { this.add.emit({ at: [m.root.position.x, 3, m.root.position.z], n: 40, dir: [0, -1, 0], cone: 0.05, speed: [3, 5], life: [0.4, 0.8], size: [0.08, 0.16], colors: ['#fff3b0', '#ffffff'], g: -2 }); this.after(0.35, () => { m.hit(1); this.impact(m, '#fff3b0'); }); }); }
          else if (f.ab === 'levitate') { const y0 = hero.body.position.y; this.tween(1.6, k => { hero.body.position.y = y0 + Math.sin(k * Math.PI) * 0.35; }); this.add.emit({ at: [hero.root.position.x, 0.1, hero.root.position.z], n: 30, speed: [0.3, 1], dir: [0, 1, 0], cone: 0.6, life: [0.6, 1.2], size: [0.06, 0.12], colors: ['#a9d0ff', '#ffffff'], g: 0.8 }); }
        } break;
        case 'mutagen': if (hero) { hero.once(hero.set?.drink); this.aura(hero, '#6dff9a', 60); hero.glow = '#6dff9a'; } break;
        case 'backstab': if (hero) { hero.hit(-1); this.impact(hero, '#d9b3ff'); } break;
        case 'lullaby': for (const m of this.monsters) { m.slow = 0.45; this.zzz(m); this.after(3.5, () => { m.slow = 1; }); } break;
        case 'enhance': {
          const target = this.lead('mon');
          if (target) { target.once(target.set?.taunt || target.set?.attack?.[0]); this.aura(target, (f.n ?? 1) < 0 ? '#8ff0d2' : '#ff4a1a', 50); this.grow(target, (f.n ?? 1) < 0 ? 0.9 : 1.12); }
          break;
        }
        case 'strike': {
          const a = this.actors.get(f.pid) || this.lead('hero');
          if (a) { a.once(a.set?.raise || a.set?.cheer); this.aura(a, '#fff3b0', 60); }
          break;
        }
        case 'dice': if (hero && /Побег/.test(f.label || '')) hero.once(hero.set?.dodge, { speed: 1.2 }); break;
      }
    }
    // развязка внутри боя: монстра окаменили или усыпили, а бой ещё идёт
    const gone = list.filter(f => f.kind === 'vanish' && f.how !== 'smoke');
    for (const f of gone) this.vanish(f.cards || [], f.how);
  }
  aura(a, color, n = 36) {
    const p = a.root.position;
    this.add.emit({ at: [p.x, 0.15, p.z], area: [0.3, 0, 0.25], n, dir: [0, 1, 0], cone: 0.5, speed: [0.8, 2], life: [0.6, 1.2], size: [0.06, 0.14], colors: [color, '#ffffff'], g: 0.6, drag: 0.8 });
    this.shock(p, new T.Color(color), 1.4, 0.6);
  }
  grow(a, f) { const s0 = a.root.scale.clone(); this.tween(0.4, k => a.root.scale.copy(s0).multiplyScalar(1 + (f - 1) * ease.back(k))); }
  zzz(a) {
    for (let i = 0; i < 3; i++) this.after(i * 0.5, () => {
      const s = textSprite('z', '#d9b3ff', 72); const p = a.chest(); s.position.set(p.x + 0.2, p.y + 0.3, p.z + 0.2); this.scene.add(s);
      this.tween(1.4, k => { s.position.y = p.y + 0.3 + k * 0.8; s.position.x = p.x + 0.2 + Math.sin(k * 6) * 0.1; s.material.opacity = 1 - k; s.scale.set(0.5 + k * 0.4, 0.25 + k * 0.2, 1); }, () => { this.scene.remove(s); s.material.map.dispose(); s.material.dispose(); });
    });
  }
  // развязка боя: победа, побег, расплата, дым, окаменение
  finale(list, game) {
    if (this.ended && !list.some(f => f.kind === 'death')) return;
    this.ended = true;
    let t = 0;
    for (const f of list) {
      const hero = this.actors.get(f.pid);
      if (f.kind === 'victory') {
        t = Math.max(t, this.victory(f) - 1.2);
      } else if (f.kind === 'escaped' && hero) {
        const mon = this.monsters.find(m => m.uid === f.card) || this.lead('mon');
        this.after(t, () => {
          if (!f.calm && mon) { mon.attack(); this.after(0.35, () => this.sparks(hero.chest(), ['#ffffff'], 10)); }
          hero.once(hero.set?.dodge, { speed: 1.3, then: hero.set?.run });
          const x0 = hero.root.position.x;
          this.after(0.45, () => { hero.root.rotation.y = -Math.PI / 2; hero.loop(hero.set?.run, 0.1); this.tween(1.1, k => { hero.root.position.x = x0 - 4.5 * k; }); });
          this.norm.emit({ at: [x0, 0.05, hero.root.position.z], n: 14, speed: [0.3, 1], life: [0.5, 0.9], size: [0.12, 0.24], colors: ['#6a5a76', '#4a3e54'], g: 0.3, grow: 1.2, alpha: 0.6, up: 0.4 });
        });
        t += 0.4;
      } else if (f.kind === 'caught' && hero) {
        const mon = this.monsters.find(m => m.uid === f.card) || this.lead('mon');
        this.after(t, () => {
          if (mon) { mon.attack(); mon.lunge(-0.9, 0.7); }
          this.after(0.38, () => { hero.hit(-1); this.impact(hero, '#ff5a3d', true); });
        });
        t += 0.8;
      } else if (f.kind === 'death' && hero) {
        this.after(t + 0.45, () => { hero.die(); this.norm.emit({ at: [hero.root.position.x, 0.2, hero.root.position.z], n: 22, speed: [0.3, 1.2], life: [0.8, 1.4], size: [0.2, 0.35], colors: ['#3a2e44', '#2a2230'], g: 0.4, grow: 1.5, alpha: 0.7 }); });
        t += 1;
      } else if (f.kind === 'pet' && hero) {
        this.after(t, () => { this.add.emit({ at: [hero.root.position.x, 0.9, hero.root.position.z + 0.2], n: 30, speed: [0.6, 1.6], life: [0.6, 1.1], size: [0.08, 0.16], colors: ['#ff7aa8', '#ffb0c8', '#ffffff'], g: 0.8 }); hero.once(hero.set?.cheer); });
        t += 0.6;
      } else if (f.kind === 'vanish') {
        this.after(t, () => this.vanish(f.cards || [], f.how));
        t += 1.2;
      }
    }
    return t + 1.2;
  }
  victory(f) {
    const heroes = this.heroes.filter(a => a.alive && a.model);
    const mons = this.monsters.filter(a => a.alive);
    let t = 0;
    heroes.forEach((h, i) => this.after(i * 0.25, () => {
      const d = h.attack();
      if (h.kind === 'mage') mons.forEach(m => this.bolt(h, m, '#9ad0ff'));
      t = Math.max(t, d);
    }));
    this.after(0.5, () => {
      mons.forEach((m, i) => this.after(i * 0.12, () => {
        m.hit(1); this.impact(m, '#fff3b0', true);
        this.slash(m.chest().add(new T.Vector3(0, 0, 0.3)), new T.Color('#fff6d8'));
        this.after(0.3, () => { const d = m.die(); this.after(Math.min(1.3, d + 0.2), () => this.dissolve(m)); });
      }));
      this.flash(0xfff3c0, 12, 0.4); this.shake = 0.14;
    });
    // клад летит к победителю
    this.after(1.5, () => {
      const h = heroes[0]; if (!h) return;
      const n = Math.min(60, 12 + (f.treasures || 1) * 8);
      for (const m of mons) this.add.emit({ at: [m.root.position.x, 0.6, m.root.position.z], n, dir: [-1, 1.6, 0.2], cone: 0.5, speed: [2.5, 4.2], life: [0.9, 1.4], size: [0.07, 0.12], colors: ['#ffd56a', '#ffe9a8', '#f2c14e'], g: -5, drag: 0.4, twinkle: 18 });
      heroes.forEach(x => x.once(x.set?.cheer, { hold: false }));
    });
    this.after(0.5, () => this.setClashVisible(false));
    return 2.6;
  }
  dissolve(a) {
    const p = a.root.position;
    this.norm.emit({ at: [p.x, a.height * 0.5, p.z], area: [0.3, a.height * 0.4, 0.2], n: 40, speed: [0.3, 1.2], life: [0.7, 1.3], size: [0.16, 0.3], colors: ['#4a3a56', '#6a5a76', '#2a2230'], g: 0.6, grow: 1.6, alpha: 0.7 });
    this.add.emit({ at: [p.x, a.height * 0.5, p.z], area: [0.3, a.height * 0.4, 0.2], n: 30, speed: [0.5, 2], life: [0.5, 1], size: [0.05, 0.1], colors: ['#d9b3ff', '#ffffff'], g: 0.5 });
    const s0 = a.root.scale.clone();
    this.tween(0.6, k => { a.root.scale.copy(s0).multiplyScalar(1 - ease.io(k)); }, () => { a.root.visible = false; });
  }
  vanish(uids, how) {
    for (const uid of uids) this.leaving.add(uid);
    const targets = how === 'smoke' ? [...this.heroes, ...this.monsters] : this.monsters.filter(m => uids.includes(m.uid));
    if (how === 'smoke') {
      const c = new T.Vector3(0, 0.6, 0);
      this.norm.emit({ at: [c.x, 0.4, c.z], area: [2.4, 0.4, 0.8], n: 120, speed: [0.3, 1.4], life: [1, 1.8], size: [0.3, 0.6], colors: ['#8a7a96', '#6a5a76', '#b8aac6'], g: 0.25, grow: 1.4, alpha: 0.85, up: 0.5 });
      this.after(0.5, () => targets.forEach(a => { a.root.visible = false; }));
      this.setClashVisible(false);
      return;
    }
    for (const a of targets) {
      a.alive = false;
      if (how === 'stone') {
        a.mixer?.stopAllAction?.(); a.slow = 0;
        a.model?.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#8d8794'); o.material.map = null; o.material.needsUpdate = true; } });
        this.after(0.7, () => {
          const p = a.root.position;
          this.norm.emit({ at: [p.x, a.height * 0.5, p.z], area: [0.3, a.height * 0.4, 0.2], n: 50, speed: [1, 3], life: [0.6, 1.1], size: [0.08, 0.18], colors: ['#8d8794', '#6a6470', '#b0aab8'], g: -7, drag: 0.5 });
          this.shock(p, 0xc9c2d0, 2); a.root.visible = false;
        });
      } else {
        this.zzz(a);
        a.once(a.set?.death, { hold: true, speed: 0.6 });
        this.after(1.6, () => this.dissolve(a));
      }
    }
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    const t = this.t;
    for (let i = this.timers.length - 1; i >= 0; i--) if (t >= this.timers[i].at) { const fn = this.timers[i].fn; this.timers.splice(i, 1); try { fn(); } catch (e) { console.warn(e); } }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const w = this.tweens[i]; w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      try { w.fn(k); } catch (e) { console.warn(e); }
      if (k >= 1) { this.tweens.splice(i, 1); w.done?.(); }
    }
    for (const a of [...this.heroes, ...this.monsters]) a.update(dt, t);
    // перевес: сгусток энергии съезжает к слабой стороне
    this.kShown += (this.k - this.kShown) * Math.min(1, dt * 2.2);
    const H = this.lead('hero'), M = this.lead('mon');
    if (this.orb.visible && H && M) {
      const a = H.chest(), b = M.chest();
      const x = T.MathUtils.lerp(a.x + 0.35, b.x - 0.35, clamp(this.kShown, 0.1, 0.9));
      const y = (a.y + b.y) / 2 + 0.05, z = 0.35;
      const pulse = 1 + Math.sin(t * 9) * 0.08;
      const col = new T.Color('#ff4a2a').lerp(new T.Color('#5effc0'), this.kShown);
      this.orb.position.set(x, y, z); this.orb.scale.setScalar((0.42 + this.power * 0.35) * pulse); this.orb.material.color.copy(col).multiplyScalar(0.8); this.orb.material.opacity = 0.85;
      this.orbCore.position.set(x, y, z + 0.01); this.orbCore.scale.setScalar(0.16 * pulse); this.orbCore.material.color.set('#fff6e0'); this.orbCore.material.opacity = 0.9;
      const beam = (m, from, to) => { const len = Math.abs(to - from); m.position.set((from + to) / 2, y, z - 0.02); m.scale.set(len, 1 + this.power * 0.8, 1); m.material.map.offset.x -= dt * 2.2; m.material.map.repeat.x = len * 1.5; };
      beam(this.beamH, a.x + 0.3, x); beam(this.beamM, x, b.x - 0.3);
      this.beamH.material.opacity = 0.18 + 0.32 * this.kShown; this.beamM.material.opacity = 0.18 + 0.32 * (1 - this.kShown);
      if (Math.random() < dt * 14) this.add.emit({ at: [x, y, z], n: 2, speed: [0.5, 1.6], life: [0.2, 0.45], size: [0.04, 0.08], colors: [`#${col.getHexString()}`, '#ffffff'], g: 0 });
      // земля светится под тем, кто сильнее
      this.auraH.position.set(a.x, 0.03, H.root.position.z); this.auraM.position.set(b.x, 0.03, M.root.position.z);
      this.auraH.material.opacity = 0.1 + 0.4 * this.kShown * this.kShown; this.auraM.material.opacity = 0.1 + 0.4 * (1 - this.kShown) * (1 - this.kShown);
      this.heroLight.intensity = 1.5 * this.kShown; this.monLight.intensity = 1.5 * (1 - this.kShown);
      // сами по себе обмениваются ударами: сильный бьёт чаще
      if (!this.ended && t > this.nextExchange) {
        const heroTurn = Math.random() < this.kShown;
        this.exchange(heroTurn ? H : M, heroTurn ? M : H, false, Math.random() < 0.35);
        this.nextExchange = t + rnd(2.6, 4.6);
      }
    } else { this.auraH.material.opacity *= 0.95; this.auraM.material.opacity *= 0.95; }
    // особые ауры боссов и огненных монстров
    for (const m of this.monsters) {
      if (!m.root.visible || !m.alive) continue;
      const fx = m.spec?.fx; if (!fx || Math.random() > dt * (fx === 'hell' ? 40 : 14)) continue;
      const p = m.root.position;
      const cols = { hell: ['#ff4a1a', '#ffb347', '#ff2a10'], fire: ['#ff8a3d', '#ffd27a'], ghost: ['#c8b8ff', '#ffffff'], souls: ['#5affa8', '#c8ffe8'], gold: ['#ffd56a', '#fff3b0'] }[fx];
      this.add.emit({ at: [p.x, 0.1 + (m.fly || 0), p.z], area: [m.height * 0.35, 0, 0.2], n: 2, dir: [0, 1, 0], cone: 0.3, speed: [0.6, 1.6], life: [0.5, 1], size: [0.06, 0.14], colors: cols, g: 0.6, drag: 0.5 });
    }
    // факелы и пыль
    for (const tr of this.torches) { const f = 1 + Math.sin(t * 13 + tr.x) * 0.08 + Math.sin(t * 7.3) * 0.06; tr.l.intensity = 1.5 * f; tr.flame.scale.setScalar(0.55 * f); }
    if (Math.random() < dt * 3) this.motes.emit({ at: [rnd(-4, 4), 0.2, rnd(-2.5, 1)], n: 1, dir: [0, 1, 0], cone: 0.3, speed: [0.05, 0.2], life: [4, 7], size: [0.02, 0.04], colors: ['#ffd696'], g: 0.02, drag: 0.1, twinkle: 3 });
    this.rune.rotation.z += dt * 0.05; this.rune.material.opacity = 0.12 + 0.12 * this.power + 0.04 * Math.sin(t * 2);
    this.add.update(dt); this.norm.update(dt); this.motes.update(dt);
    // камера: лёгкое дыхание, тряска при ударах
    this.shake *= Math.pow(0.02, dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const yaw = this.yaw || 0, dist = this.camBase.z;
    this.cam.position.set(this.camBase.x - Math.sin(yaw) * dist + Math.sin(t * 0.35) * 0.12 + sx + (this.kShown - 0.5) * 0.4, this.camBase.y + sy, Math.cos(yaw) * dist);
    this.cam.lookAt(this.look.x + (this.kShown - 0.5) * 0.3, this.look.y, this.look.z);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.cam);
  }
  clearActors() {
    for (const a of [...this.heroes, ...this.monsters]) a.dispose();
    this.heroes = []; this.monsters = []; this.actors.clear(); this.monUids = new Set(); this.leaving = new Set();
    this.tweens = []; this.timers = [];
  }
  stop() { this.ended = true; }
  pause() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); }
  resume() { if (this.running || this.disposed) return; this.running = true; this.clock.getDelta(); this.raf = requestAnimationFrame(this.loopFn); }
  dispose() {
    this.disposed = true; this.running = false; cancelAnimationFrame(this.raf); this.ro.disconnect();
    this.clearActors();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

// заранее подгрузить модели, которые почти наверняка понадобятся
export function prefetch(names = ['hero_knight']) { kkClips().catch(() => {}); names.forEach(n => loadGLTF(n).catch(() => {})); }
