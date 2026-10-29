// «Под Землёй» — портрет героя: живописный портрет из /avatars/v1, сцена и свет за ним и, по желанию, рамка медальона.
// Номера деталей проверяет сервер (shared/avatar.js); список файлов — avatar-art.js (обновляет art/cut.py).
// Сцена: герой вырезан из своего фона (art/scene.py), за ним — размытая локация, вокруг — ореол и кромка света,
// сверху — тон картинки. Рамка надевается снаружи круга портрета: портрет своего размера не меняет.
import { AVATAR_PARTS, avatarConfig, portraitId, SCENE_NATIVE, SCENE_LIVE } from '/shared/avatar.js';
import { PORTRAITS, FRAMES, ROLES, SCENES } from '/avatar-art.js';

// свет: ореол за героем, кромка по контуру, тон картинки сверху вниз (мягкий свет)
export const LIGHTS = [
  { id: 'moon', name: 'Лунный свет', halo: '#8fb4ff', rim: '#dce9ff', top: '#7c9ee0', bottom: '#0f1830' },
  { id: 'forge', name: 'Жар горна', halo: '#ff8a2a', rim: '#ffd08a', top: '#ffb35e', bottom: '#4a1604' },
  { id: 'frost', name: 'Морозная мгла', halo: '#bdf0ff', rim: '#ffffff', top: '#d2f5ff', bottom: '#1a3552' },
  { id: 'curse', name: 'Проклятье', halo: '#4dff7f', rim: '#c2ffd0', top: '#5cff9a', bottom: '#03200e' },
  { id: 'blood', name: 'Кровавая луна', halo: '#ff3a2a', rim: '#ff9f90', top: '#ff6050', bottom: '#260404' },
  { id: 'candle', name: 'Свет свечи', halo: '#ffc160', rim: '#ffe9b8', top: '#ffd28a', bottom: '#2a1606' },
  { id: 'arcane', name: 'Тайная магия', halo: '#b47bff', rim: '#ead6ff', top: '#b58cff', bottom: '#160b2a' },
  { id: 'none', name: 'Без подсветки' },
];
const LIGHT_BY_ID = Object.fromEntries(LIGHTS.map((l, i) => [l.id, i]));


export const AV_LABELS = {
  gender: ['Мужчина', 'Женщина'],
  race: ['Человек', 'Эльф', 'Гном', 'Полурослик', 'Орк', 'Гоблин', 'Кротолюд'],
  look: ROLES,
  frame: ['Без рамки', ...FRAMES.map(f => f[2])],
  scene: ['Родной фон', 'Локация партии', ...SCENES.map(s => s[2])],
  light: ['По сцене', ...LIGHTS.map(l => l.name)],
};

// подпись образа: что на портрете
export const lookNote = a => PORTRAITS.get(portraitId(avatarConfig(a)))?.[1] || '';
// уменьшенный портрет для каталога (без рамки)
export const portraitThumb = a => { const id = portraitId(a), p = PORTRAITS.get(id); return p ? `/avatars/v1/t/${id}.webp?v=${p[0]}` : ''; };

// локация идущей партии — для сцены «Локация партии» (игра сообщает её при каждой отрисовке стола)
let liveLoc = null;
export const setAvatarLocation = id => { liveLoc = id || null; };

const portraitOf = v => {
  let id = portraitId(v);
  if (!PORTRAITS.has(id)) id = portraitId({ ...v, look: 0 });
  if (!PORTRAITS.has(id)) id = 'p_human_m_1';
  return [id, PORTRAITS.get(id)];
};
// сцена: [id, отпечаток фона, название, свет по умолчанию] или null (родной фон)
export function sceneOf(v) {
  if (v.scene === SCENE_NATIVE) return null;
  if (v.scene === SCENE_LIVE) return SCENES.find(s => s[0] === liveLoc) || SCENES.find(s => s[0] === 'default') || null;
  return SCENES[v.scene - 2] || null;
}
// свет: номер в LIGHTS или -1 (нет света)
export function lightOf(v, sc = sceneOf(v)) {
  const i = v.light ? v.light - 1 : sc ? LIGHT_BY_ID[sc[3]] ?? -1 : -1;
  return i >= 0 && LIGHTS[i].halo ? i : -1;
}

// общие для всех портретов заготовки: круг, виньетка и по фильтру и тону на каждый свет
export const avatarDefs = () => {
  const c = h => [1, 3, 5].map(k => (parseInt(h.slice(k, k + 2), 16) / 255).toFixed(3));
  let g = '<clipPath id="avClip" clipPathUnits="userSpaceOnUse"><circle cx="50" cy="50" r="50"/></clipPath>'
    + '<radialGradient id="avVig" cx="50%" cy="44%" r="58%"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>';
  LIGHTS.forEach((l, i) => {
    if (!l.halo) return;
    const [hr, hg, hb] = c(l.halo), [rr, rg, rb] = c(l.rim);
    // карта света: в красном канале ореол, в зелёном — кромка; цвет ставим свой, яркость канала — в прозрачность
    g += `<filter id="avHalo${i}" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 ${hr}  0 0 0 0 ${hg}  0 0 0 0 ${hb}  .95 0 0 0 0"/></filter>`
      + `<filter id="avRim${i}" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 ${rr}  0 0 0 0 ${rg}  0 0 0 0 ${rb}  0 .85 0 0 0"/></filter>`
      + `<linearGradient id="avTone${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l.top}"/><stop offset="1" stop-color="${l.bottom}"/></linearGradient>`;
  });
  return g;
};

// насколько рамка выходит за круг портрета с каждой стороны (доля размера портрета): под неё оставляют место
export const frameExt = a => { const v = avatarConfig(a), fr = v.frame ? FRAMES[v.frame - 1] : null; return fr ? +((96 / fr[3] - 100) / 200).toFixed(3) : 0; };

// Портрет героя. Рамка — снаружи круга (svg с классом av-framed выходит за свои границы).
export function avatarSVG(a, seatColor = '#3a3a42', cls = '') {
  const v = avatarConfig(a);
  const fr = v.frame ? FRAMES[v.frame - 1] : null;
  const [id, p] = portraitOf(v);
  const cut = p?.[2] ? `?v=${p[2]}` : null;
  const sc = cut ? sceneOf(v) : null;
  const li = cut ? lightOf(v, sc) : -1;
  let s = '<rect width="100" height="100" fill="#0e0d0c"/>';
  if (cut) {
    // объёмный портрет: фон и герой — отдельными слоями, при наклоне они расходятся (art/scene.py: c/ — герой, n/ — родной фон без героя)
    const bg = sc ? `/avatars/v1/bg/${sc[0]}.webp?v=${sc[1]}` : `/avatars/v1/n/${id}.webp${cut}`;
    s += `<g class="av-bg"><image href="${bg}" x="-4" y="-4" width="108" height="108" preserveAspectRatio="xMidYMid slice"/></g><g class="av-hero">`;
    if (li >= 0) s += `<image href="/avatars/v1/g/${id}.webp${cut}" width="100" height="100" filter="url(#avHalo${li})"/>`;
    s += `<image href="/avatars/v1/c/${id}.webp${cut}" width="100" height="100"/>`;
    if (li >= 0) s += `<image href="/avatars/v1/g/${id}.webp${cut}" width="100" height="100" filter="url(#avRim${li})" style="mix-blend-mode:screen"/>`;
    s += '</g>';
    if (li >= 0) s += `<rect width="100" height="100" fill="url(#avTone${li})" opacity=".5" style="mix-blend-mode:soft-light"/>`;
  } else s += `<image href="/avatars/v1/${id}.webp?v=${p?.[0] || ''}" width="100" height="100"/>`;
  if (sc || li >= 0) s += '<rect width="100" height="100" fill="url(#avVig)"/>';
  const pic = `<g clip-path="url(#avClip)">${s}</g>`;
  if (!fr) return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${pic}</svg>`;
  // проём рамки чуть меньше круга: кольцо ложится на самый край портрета, а сам портрет не уменьшается
  const F = 96 / fr[3], o = (100 - F) / 2;
  return `<svg class="${cls} av-framed" viewBox="0 0 100 100" overflow="visible" aria-hidden="true">${pic}`
    + `<image class="av-frame" href="/avatars/v1/${fr[0]}.webp?v=${fr[1]}" x="${o.toFixed(1)}" y="${o.toFixed(1)}" width="${F.toFixed(1)}" height="${F.toFixed(1)}"/></svg>`;
}

export { AVATAR_PARTS };
