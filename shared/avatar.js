// «Под Землёй» — облик героя. Общий для сервера (проверка) и браузера (портрет и редактор).
// Облик — живописный портрет: пол, раса и один из шести образов, плюс рамка медальона.
// Старый формат (просто число) превращается в случайный облик; лишние поля прежних версий отбрасываются.

export const AVATAR_PARTS = {
  gender: 2,  // мужчина, женщина
  race: 7,    // человек, эльф, гном, полурослик, орк, гоблин, кротолюд
  look: 6,    // воин, маг, следопыт, жрец, мастеровой, знать
  frame: 13,  // 0 — без рамки, дальше 12 рамок медальона
};
export const RACES = ['human', 'elf', 'dwarf', 'halfling', 'orc', 'goblin', 'mole'];
export const MOLE = 6;
const KEYS = Object.keys(AVATAR_PARTS);

// имя файла портрета: p_<раса>_<m|f>_<образ 1–6>
export const portraitId = a => `p_${RACES[a.race] || 'human'}_${a.gender ? 'f' : 'm'}_${(a.look || 0) + 1}`;

function mulberry(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Случайный облик: люди встречаются чаще, рамка — у каждого четвёртого
export function avatarFromSeed(n) {
  const r = mulberry(1000 + Number(n) * 7919);
  return {
    gender: r() < 0.5 ? 0 : 1,
    race: r() < 0.3 ? 0 : 1 + Math.floor(r() * 6),
    look: Math.floor(r() * 6),
    frame: r() < 0.25 ? 1 + Math.floor(r() * 12) : 0,
  };
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

// Облик из любого формата
export const avatarConfig = a => (a && typeof a === 'object' ? cleanAvatar(a) : avatarFromSeed(Number.isFinite(Number(a)) ? Number(a) : 0));

// Сменить пол: образ и раса остаются, портрет берётся с листа другого пола
export const withGender = (a, g) => ({ ...a, gender: g ? 1 : 0 });
