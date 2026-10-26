// Тайные команды стола. Игрок пишет команду в чат — сервер её никому не показывает,
// а нужная карта приходит ему вместо ближайшей карты клада (см. orderCard в движке).
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
};
// «/witcher», «/WITCHER» → карта; всё остальное → null
export function cheatCard(text) {
  const m = /^\/([a-z]+)$/i.exec(String(text || '').trim());
  return (m && CHEATS[m[1].toUpperCase()]) || null;
}
