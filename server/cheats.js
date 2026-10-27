// Тайные команды стола. Игрок пишет команду в чат — сервер её никому не показывает,
// а нужная карта приходит ему вместо ближайшей карты клада (см. orderCard в движке).
// С NOW на конце (/ARESNOW) карта сразу ложится в руку, а соперники не видят, что карт стало больше (grantCard).
// Файл лежит на сервере и в браузер не отдаётся.
export const CHEATS = {
  WITCHER: 'c_witcher',      // Ведьмак
  GODMODE: 'i_godarmor',     // Доспехи Бога
  EXC: 'i_excalibur',        // Меч Экскалибур
  GOLDENDRAGON: 'p_golddragon', // Золотой Дракон
  ARES: 'i_ares',            // Шлем Ареса
  AGEBOOTS: 'i_epochboots',  // Сапоги эпохи
  WARLOCK: 'c_warlock',      // Чернокнижник
  PLOTVA: 'p_roach',         // Конь Плотва
  MIXBLOOD: 'x_halfbreed',   // Смешанная кровь
  '2CL': 'x_super',          // Совместитель
  ATLANTIS: 'g_atlantis',    // Сокровища Атлантиды
  HELP1: 'a_porter',         // Носильщик Савелий
  HELP2: 'a_guide',          // Проводник Митрич
  HELP3: 'a_merc',           // Наёмник Кондрат
};
// «/witcher», «/WITCHER», «/2cl» → карта; всё остальное → null
export function cheatCard(text) {
  const m = /^\/([a-z0-9]+)$/i.exec(String(text || '').trim());
  return (m && CHEATS[m[1].toUpperCase()]) || null;
}
// та же команда с NOW на конце — карта сразу в руку: «/ARESNOW», «/2clnow» → карта; иначе null
export function cheatCardNow(text) {
  const m = /^\/([a-z0-9]+?)now$/i.exec(String(text || '').trim());
  return (m && CHEATS[m[1].toUpperCase()]) || null;
}
// тайные команды на голды: «/GET5000» — сразу +5000 в кошелёк (тоже никому не видны)
export const CHEAT_GOLD = { GET5000: 5000 };
export function cheatGold(text) {
  const m = /^\/([a-z0-9]+)$/i.exec(String(text || '').trim());
  return (m && CHEAT_GOLD[m[1].toUpperCase()]) || 0;
}
