// «Под Землёй» — внешность героя. Общая для сервера (проверка) и браузера (рисунок и редактор).
// Аватар — объект с номерами вариантов. Старый формат (просто число) превращается в случайную внешность.

export const AVATAR_PARTS = {
  skin: 8,       // тон кожи
  eyes: 7,       // обычные, довольные, подмигивает, сонные, удивлённые, сердитые, сияющие
  brows: 5,      // нет, обычные, густые, поднятые, хмурые
  mouth: 8,      // улыбка, зубастая, хохот, ровно, язык, ухмылка, «о», щербинка
  hair: 20,      // лысый, короткая, ёжик, длинные, каре, кудри, ирокез, хвост, косички, афро, чёлка набок, пучок,
                 // локоны, два хвостика, боб с чёлкой, зализанные, растрёпанные, высокий хвост, дреды, кок
  hairColor: 10,
  facial: 6,     // нет, щетина, усы, усы-завитки, борода, борода волшебника
  hat: 12,       // нет, каска, кепка, шапка, колпак, корона, капюшон, бандана, цилиндр, рогатый шлем, наушники, венок
  hatColor: 10,
  glasses: 6,    // нет, круглые, квадратные, тёмные, монокль, очки шахтёра
  extra: 7,      // нет, веснушки, румянец, шрам, повязка на глаз, серьга, пластырь
  shirt: 10,     // цвет одежды
  bg: 10,        // фон: 0 — цвет места за столом
  gender: 2,     // мужчина, женщина
  body: 4,       // обычный, худой, крепкий, толстый
  outfit: 10,    // футболка, рубашка, худи, свитер, кожанка, костюм с галстуком, жилет шахтёра, доспехи, мантия мага, плащ путника
};
// причёски, которые чаще достаются случайным мужчинам и женщинам
export const HAIR_M = [0, 1, 2, 5, 6, 9, 10, 15, 16, 18, 19];
export const HAIR_F = [3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 17, 18];
const KEYS = Object.keys(AVATAR_PARTS);

function mulberry(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// случайная, но приятная внешность: шапки и бороды не у всех
export function avatarFromSeed(n) {
  const r = mulberry(1000 + Number(n) * 7919);
  const pick = k => Math.floor(r() * AVATAR_PARTS[k]);
  const a = {};
  for (const k of KEYS) a[k] = pick(k);
  if (r() < 0.35) a.hat = 0;
  if (r() < 0.55) a.facial = 0;
  if (r() < 0.6) a.glasses = 0;
  if (r() < 0.5) a.extra = 0;
  const hairs = a.gender ? HAIR_F : HAIR_M;
  a.hair = hairs[Math.floor(r() * hairs.length)];
  if (a.gender) a.facial = 0;
  const b = r(); a.body = b < 0.4 ? 0 : b < 0.6 ? 1 : b < 0.8 ? 2 : 3;
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
