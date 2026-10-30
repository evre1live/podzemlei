// «Под Землёй» — настоящий кубик: three.js (MIT) и физика cannon-es (MIT).
// Кубик бросают из-под руки игрока на стол: он летит, бьётся о борт, кувыркается и замирает.
// Бросок считается физикой заранее, а выпавшую грань подменяют на ту, что прислал сервер:
// внутри тела кубик повёрнут так, что нужное число окажется сверху. Собирается в public/vendor (art/dice3d/build.sh).
import { WebGLRenderer, Scene, PerspectiveCamera, Mesh, MeshStandardMaterial, CanvasTexture, SRGBColorSpace, PlaneGeometry, ShadowMaterial,
  HemisphereLight, DirectionalLight, PointLight, Vector3, Quaternion, PCFSoftShadowMap, ACESFilmicToneMapping, Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { World, Body, Box, Plane, Vec3, Material, ContactMaterial } from 'cannon-es';

// грани: +x, -x, +y, -y, +z, -z (порядок материалов BoxGeometry); противоположные дают в сумме 7
const FACE_VAL = [2, 5, 1, 6, 3, 4];
const FACE_N = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
  5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.27, .23], [.73, .23], [.27, .5], [.73, .5], [.27, .77], [.73, .77]] };

let tex = null;
function faceTextures() {
  if (tex) return tex;
  tex = FACE_VAL.map(v => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    // кость: тёплая слоновая кость с прожилками
    const bg = g.createRadialGradient(S * .35, S * .3, S * .1, S * .5, S * .5, S * .75);
    bg.addColorStop(0, '#f6eedb'); bg.addColorStop(.7, '#e2d4b4'); bg.addColorStop(1, '#bfae88');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    g.globalAlpha = .07;
    for (let i = 0; i < 14; i++) { g.strokeStyle = i % 2 ? '#7a6440' : '#fff'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * S; g.moveTo(0, y); g.bezierCurveTo(S * .3, y + 20 - Math.random() * 40, S * .6, y + 20 - Math.random() * 40, S, y + 10 - Math.random() * 20); g.stroke(); }
    g.globalAlpha = 1;
    const r = v === 1 ? S * .13 : S * .085;
    for (const [x, y] of PIPS[v]) {
      const px = x * S, py = y * S;
      const pg = g.createRadialGradient(px - r * .25, py - r * .3, r * .1, px, py, r);
      if (v === 1) { pg.addColorStop(0, '#d8402a'); pg.addColorStop(.75, '#7a1206'); pg.addColorStop(1, '#3a0402'); }
      else { pg.addColorStop(0, '#3a2a1c'); pg.addColorStop(.75, '#140c06'); pg.addColorStop(1, '#050302'); }
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,250,235,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, r + 1.5, Math.PI * .1, Math.PI * .9); g.stroke();
    }
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
    return t;
  });
  return tex;
}

// бросок: физика до остановки, кадры записываются (60 к/с)
function simulate(B) {
  const W = B.x1 - B.x0, D = B.z1 - B.z0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const world = new World({ gravity: new Vec3(0, -34, 0), allowSleep: true });
  const mFloor = new Material('floor'), mDie = new Material('die');
  world.addContactMaterial(new ContactMaterial(mFloor, mDie, { friction: 0.3, restitution: 0.42 }));
  const floor = new Body({ mass: 0, material: mFloor, shape: new Plane() }); floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(floor);
  const wall = (x, z, ry) => { const b = new Body({ mass: 0, material: mFloor, shape: new Plane() }); b.position.set(x, 0, z); b.quaternion.setFromEuler(0, ry, 0); world.addBody(b); };
  wall(B.x0, cz, Math.PI / 2); wall(B.x1, cz, -Math.PI / 2); wall(cx, B.z0, 0); wall(cx, B.z1, Math.PI);
  const die = new Body({ mass: 1, material: mDie, shape: new Box(new Vec3(.5, .5, .5)), linearDamping: 0.12, angularDamping: 0.18, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.15 });
  const rnd = (a, b) => a + Math.random() * (b - a);
  // бросок из-под руки (ближний край) к середине стола
  die.position.set(cx + rnd(-W * .25, W * .25), 2.2, B.z1 - 0.55);
  die.quaternion.setFromEuler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3));
  die.velocity.set(rnd(-3, 3), rnd(2.5, 4), -rnd(D * 1.7, D * 2.2));
  die.angularVelocity.set(rnd(-24, 24), rnd(-14, 14), rnd(-24, 24));
  world.addBody(die);
  const frames = [], hits = [];
  die.addEventListener('collide', e => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 2.5) hits.push({ i: frames.length, v }); });
  let still = 0;
  for (let i = 0; i < 60 * 5; i++) {
    for (let k = 0; k < 2; k++) world.step(1 / 120);
    frames.push({ p: die.position.clone(), q: die.quaternion.clone() });
    // почти замер — дальше не считаем (хвост доигрывать незачем)
    still = die.velocity.length() < 0.12 && die.angularVelocity.length() < 0.2 && die.position.y < 0.56 ? still + 1 : 0;
    if (still > 6 || (die.sleepState === Body.SLEEPING && i > 20)) break;
  }
  return { frames, hits };
}

// какая грань тела смотрит вверх в последнем кадре
function upFace(q) {
  const Q = new Quaternion(q.x, q.y, q.z, q.w);
  let best = 0, bd = -2;
  FACE_N.forEach((n, i) => { const d = n.clone().applyQuaternion(Q).y; if (d > bd) { bd = d; best = i; } });
  return best;
}

let renderer = null;
// rect — область стола на экране; возвращает Promise, который исполняется, когда кубик замер: { x, y } — где он на экране
export function roll3d(host, value, rect, { duration = 1000, onHit } = {}) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (!renderer) {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  }
  renderer.setPixelRatio(dpr); renderer.setSize(rect.width, rect.height, false);
  const cv = renderer.domElement; cv.className = 'die3d-cv';
  Object.assign(cv.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', pointerEvents: 'none' });
  host.append(cv);
  // камера смотрит на стол сверху под углом; кубик — 1 единица, на экране около 64 px
  const scene = new Scene();
  const cam = new PerspectiveCamera(28, rect.width / rect.height, 0.1, 200);
  const tilt = 0.42, unitsW = rect.width / 64, dist = unitsW / 2 / Math.tan((28 * Math.PI / 180) * cam.aspect / 2) ;
  cam.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // видимая часть пола — по лучам из углов кадра; борта — чуть внутри неё
  const onFloor = (x, y) => { const v = new Vector3(x, y, 0.5).unproject(cam).sub(cam.position).normalize(); const t = -cam.position.y / v.y; return cam.position.clone().add(v.multiplyScalar(t)); };
  const far = onFloor(0, 0.88), near = onFloor(0, -0.82), farR = onFloor(0.9, 0.88);
  const B = { x0: -farR.x + 0.6, x1: farR.x - 0.6, z0: far.z + 0.6, z1: near.z - 0.6 };
  const W = B.x1 - B.x0, D = B.z1 - B.z0;
  scene.add(new HemisphereLight(0xffe6c0, 0x2a1a10, 1.1));
  const key = new DirectionalLight(0xffd7a0, 2.6); key.position.set(-W * .35, 14, D * .1); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -W, right: W, top: D, bottom: -D, near: 1, far: 60 }); key.shadow.radius = 4; key.shadow.bias = -0.0006;
  scene.add(key);
  const candle = new PointLight(0xff9a40, 18, W * 1.2, 1.6); candle.position.set(B.x0, 3, B.z0); scene.add(candle);
  const floor = new Mesh(new PlaneGeometry(W * 3, D * 3), new ShadowMaterial({ opacity: 0.55 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const mats = faceTextures().map(t => new MeshStandardMaterial({ map: t, roughness: 0.38, metalness: 0.0 }));
  const geo = new RoundedBoxGeometry(1, 1, 1, 4, 0.12);
  const mesh = new Mesh(geo, mats); mesh.castShadow = true;
  const body = new Group(); body.add(mesh); scene.add(body);
  const { frames, hits } = simulate(B);
  // нужная грань — туда, куда смотрит выпавшая
  const want = FACE_VAL.indexOf(value), got = upFace(frames[frames.length - 1].q);
  mesh.quaternion.setFromUnitVectors(FACE_N[want], FACE_N[got]);
  // кадры раскладываются на duration мс (бросок чуть ускоряется, если физика считала долго)
  const n = frames.length, t0 = performance.now();
  const hitTimes = hits.map(h => ({ t: (h.i / n) * duration, v: h.v })), played = new Set();
  return new Promise(resolve => {
    let done = false;
    const tick = now => {
      const k = Math.max(0, Math.min(1, (now - t0) / duration)), fi = Math.min(n - 1, k * (n - 1));
      const a = frames[Math.floor(fi)], b = frames[Math.min(n - 1, Math.floor(fi) + 1)], u = fi - Math.floor(fi);
      body.position.set(a.p.x + (b.p.x - a.p.x) * u, a.p.y + (b.p.y - a.p.y) * u, a.p.z + (b.p.z - a.p.z) * u);
      const qa = new Quaternion(a.q.x, a.q.y, a.q.z, a.q.w), qb = new Quaternion(b.q.x, b.q.y, b.q.z, b.q.w);
      body.quaternion.slerpQuaternions(qa, qb, u);
      renderer.render(scene, cam);
      for (const [i, h] of hitTimes.entries()) if (!played.has(i) && now - t0 >= h.t) { played.add(i); onHit?.(h.v); }
      if (k < 1) requestAnimationFrame(tick);
      else if (!done) {
        done = true;
        const p = body.position.clone().project(cam);
        resolve({ x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height, canvas: cv, frames: n, dispose: () => { cv.remove(); geo.dispose(); mats.forEach(m => m.dispose()); } });
      }
    };
    requestAnimationFrame(tick);
  });
}
