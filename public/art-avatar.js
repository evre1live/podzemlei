// «Под Землёй» — портрет героя: живописный портрет из /avatars/v1 и, по желанию, рамка медальона поверх.
// Номера деталей проверяет сервер (shared/avatar.js); список файлов — avatar-art.js (обновляет art/cut.py).
import { AVATAR_PARTS, avatarConfig, portraitId } from '/shared/avatar.js';
import { PORTRAITS, FRAMES, ROLES } from '/avatar-art.js';

export const AV_LABELS = {
  gender: ['Мужчина', 'Женщина'],
  race: ['Человек', 'Эльф', 'Гном', 'Полурослик', 'Орк', 'Гоблин', 'Кротолюд'],
  look: ROLES,
  frame: ['Без рамки', ...FRAMES.map(f => f[2])],
};

// подпись образа: что на портрете
export const lookNote = a => PORTRAITS.get(portraitId(avatarConfig(a)))?.[1] || '';
// уменьшенный портрет для каталога (без рамки)
export const portraitThumb = a => { const id = portraitId(a), p = PORTRAITS.get(id); return p ? `/avatars/v1/t/${id}.webp?v=${p[0]}` : ''; };

const portraitUrl = v => {
  let id = portraitId(v);
  if (!PORTRAITS.has(id)) id = portraitId({ ...v, look: 0 });
  if (!PORTRAITS.has(id)) id = 'p_human_m_1';
  const p = PORTRAITS.get(id);
  return p ? `/avatars/v1/${id}.webp?v=${p[0]}` : '';
};

// раньше здесь были градиенты векторного портрета; оставлено для art.js
export const avatarDefs = () => '';

export function avatarSVG(a, seatColor = '#3a3a42', cls = '') {
  const v = avatarConfig(a);
  const fr = v.frame ? FRAMES[v.frame - 1] : null;
  const url = portraitUrl(v);
  let s = '<rect width="100" height="100" fill="#0e0d0c"/>';
  if (fr) {
    // портрет чуть шире проёма рамки, чтобы между ними не было щели
    const size = Math.min(100, (fr[3] + 0.08) * 100), o = (100 - size) / 2;
    s += `<image href="${url}" x="${o.toFixed(1)}" y="${o.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}"/>`
      + `<image href="/avatars/v1/${fr[0]}.webp?v=${fr[1]}" width="100" height="100"/>`;
  } else s += `<image href="${url}" width="100" height="100"/>`;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${s}</svg>`;
}

export { AVATAR_PARTS };
