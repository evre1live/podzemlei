// «Под Землёй» — внешность героя. Общая для сервера (проверка) и браузера (рисунок и редактор).
// Аватар — объект с номерами вариантов. Старый формат (просто число) превращается в случайную внешность.

export const AVATAR_PARTS = {
  gender: 2,     // мужчина, женщина
  race: 7,       // человек, эльф, гном, полурослик, орк, гоблин, кротолюд
  body: 3,       // обычное, худощавое, могучее
  skin: 8,       // тон кожи (у орков и гоблинов — зелёные и серые, у кротолюда — мех)
  eyes: 9,       // цвет глаз
  brows: 5,      // взгляд: спокойный, суровый, вскинутые брови, с прищуром, усталый
  mouth: 6,      // сомкнутые губы, лёгкая улыбка, ухмылка, оскал, поджатые, приоткрытые
  hair: 16,      // лысый, короткая, зачёс назад, длинные прямые, длинные волнистые, хвост, коса, две косы,
                 // пучок, кудри, гребень, бритые виски с косой, каре, узел воина, растрёпанные, дреды
  hairColor: 12,
  facial: 8,     // нет, щетина, усы, эспаньолка, короткая борода, окладистая, борода с косами, длинная
  hat: 13,       // нет, капюшон, шлем с наносником, рогатый шлем, обруч, корона, шляпа мага, каска шахтёра,
                 // повязка, меховая шапка, венок, широкополая шляпа, берет с пером
  hatColor: 10,  // цвет ткани головного убора
  outfit: 13,    // рубаха, кожаная куртка, кольчуга, латы, мантия мага, плащ с мехом, дорожный плащ, камзол,
                 // роба шахтёра, облачение жреца, наряд следопыта, шкуры, платье с корсажем
  shirt: 10,     // цвет одежды
  extra: 10,     // приметы: нет, шрам через глаз, шрам на щеке, повязка на глаз, боевая раскраска, веснушки,
                 // руны, узор из точек, копоть, морщины
  jewel: 10,     // украшения: нет, серьги-кольца, серьга, кольцо в носу, амулет, гривна, ожерелье из клыков,
                 // монокль, очки, очки-консервы на лбу
  bg: 10,        // фон: 0 — цвет места за столом
};
export const RACES = ['human', 'elf', 'dwarf', 'halfling', 'orc', 'goblin', 'molefolk'];
export const MOLE = 6;
// причёски, которые чаще достаются случайным мужчинам и женщинам
export const HAIR_M = [0, 1, 2, 3, 5, 9, 10, 11, 13, 14, 15];
export const HAIR_F = [3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15];
const KEYS = Object.keys(AVATAR_PARTS);

function mulberry(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const oneOf = (r, list) => list[Math.floor(r() * list.length)];

// Случайная, но правдоподобная внешность: у каждой расы свои привычные глаза, причёски и бороды
export function avatarFromSeed(n) {
  const r = mulberry(1000 + Number(n) * 7919);
  const a = {};
  for (const k of KEYS) a[k] = Math.floor(r() * AVATAR_PARTS[k]);
  a.race = r() < 0.3 ? 0 : 1 + Math.floor(r() * 6);
  a.hair = oneOf(r, a.gender ? HAIR_F : HAIR_M);
  a.facial = a.gender ? 0 : r() < 0.45 ? 0 : a.facial;
  if (a.race === 2 && !a.gender) a.facial = oneOf(r, [4, 5, 6, 6, 7]);      // гномы без бороды не ходят
  if (a.race === 1) { a.facial = 0; a.eyes = oneOf(r, [2, 3, 4, 6]); }      // эльфы
  if (a.race === 4) a.eyes = oneOf(r, [5, 7, 8, 0]);                        // орки
  if (a.race === 5) { a.eyes = oneOf(r, [8, 5, 7]); a.hair = oneOf(r, [0, 10, 13, 14, 1]); }
  if (r() < 0.4) a.hat = 0;
  if (r() < 0.55) a.extra = 0;
  if (r() < 0.55) a.jewel = 0;
  a.brows = r() < 0.5 ? 0 : a.brows;
  a.body = r() < 0.6 ? 0 : a.body;
  a.bg = 0;
  return a;
}

// Привести присланное к допустимому виду. Лишние поля отбрасываются, кривые значения — в 0.
export function cleanAvatar(a, fallback = null) {
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const out = {};
    for (const k of KEYS) {
      const v = Number(a[k]);
      out[k] = Number.isInteger(v) && v >= 0 && v < AVATAR_PARTS[k] ? v : 0;
    }
    return out;
  }
  if (Number.isInteger(a) && a >= 0 && a < 1e6) return a;
  return fallback ?? Math.floor(Math.random() * 1000);
}

// Объект внешности из любого формата
export const avatarConfig = a => (a && typeof a === 'object' ? cleanAvatar(a) : avatarFromSeed(Number.isFinite(Number(a)) ? Number(a) : 0));

// Сменить пол в редакторе: женщинам убираем бороду, а «чужую» причёску меняем на привычную
export function withGender(a, g) {
  const o = { ...a, gender: g ? 1 : 0 };
  if (o.gender) { o.facial = 0; if (!HAIR_F.includes(o.hair)) o.hair = 3; }
  else if (!HAIR_M.includes(o.hair)) o.hair = 1;
  return o;
}
