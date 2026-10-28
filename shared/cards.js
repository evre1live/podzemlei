// «Под Землёй» — оригинальная колода.
// Все названия, тексты и шутки придуманы для этой игры.
// Поля:
//  deck: 'door' (Проходы) | 'treasure' (Клад)
//  type: monster | curse | race | class | halfbreed | supermunch | enhancer | wandering | location | event | trap | duel
//        item | oneshot | buff | levelup | hoard | ally
//  copies: сколько экземпляров в колоде
//  rarity: common | rare | epic | legendary — влияет на рамку и блеск карты
//  noSteal — вещь нельзя украсть (плут, клептоман); petSave:false — питомец не жертвует собой
//
// Особенности монстров:
//  tags: ['undead','rat','fungus','water','fire','insect','metro','rock']
//  vs: [{cls|race, n, text}] — бонус против класса или расы
//  vsItem: [{tag, n, text}] — бонус/штраф, если у героя надета вещь с тегом (свет, вода)
//  soloBonus — сильнее против одиночки; noHelp — звать на помощь нельзя
//  escape:false — убежать нельзя; escapeMod — поправка к побегу; noPursue — не гонится за низкими уровнями
//  levelOnly — против него считается только уровень героя: вещи, зелья, способности и разовые карты героям не помогают
//  ambush — эффект при встрече; mirror — сила = уровень лидера + mirror
//  boss — босс: уровень 666, сила вдвое больше силы героя; усилители, локации и чары на него не действуют
//  art — параметры рисунка: body, hue, props, eyes, mouth, pattern, heads, crown

const M = (id, name, level, treasures, extra = {}) => ({
  id, deck: 'door', type: 'monster', name, level, treasures, levels: 1, copies: 1,
  rarity: level >= 15 ? 'epic' : level >= 10 ? 'rare' : 'common', ...extra,
});
// Боссы — гроза лидеров. Новичков не трогают, а тех, кто дорос до 9-го уровня, при неудачном побеге убивают и отбрасывают на 5 уровней.
// Уровень на карте всегда 666, а сила — вдвое больше силы героя, против которого босс вышел.
export const BOSS_LEVEL = 666;
export const BOSS_MULT = 2;
export const BOSS_MIN_LEVEL = 9;
export const BOSS_FLOOR = 30; // слабого героя босс не трогает, но и лёгкой добычей не становится
// Баланс классов и «неприятностей» (подобран по тысячам партий ботов)
export const TROUBLE_BONUS = 4;  // монстр, которого искали сами, разбужен и злее на столько
export const WITCHER_BONUS = 3;  // постоянный бонус ведьмака
export const MUTAGEN_BONUS = 6;  // мутаген, раз за партию
export const LULLABY_PENALTY = 2; // колыбельная барда: монстры слабее на столько
export const LULLABY_MAX = 1;     // и не чаще раза за бой
export const DISTILL_COST = 3;    // перегонка алхимика: столько карт сбросить
// Приручение: зверя, побеждённого с таким перевесом, можно оставить себе питомцем
export const TAME_MARGIN = 10;
export const tameBonus = d => Math.max(1, Math.ceil((d.level || 0) / 4));
// Ловушки: обезвредить — выбросить на кубике столько; плуту и механику бросок легче
export const TRAP_ROLL = 4;
export const TRAP_SKILL = 2;
export const TRAP_FAIL_LEVELS = 1; // сорвалась при обезвреживании — ещё и уровень долой
// Чернокнижник: приручает зверя уже при таком перевесе
export const WARLOCK_TAME = 5;
// Ящик Пандоры: в любом бою любой игрок может открыть его за голды — сила монстров вдвое (вся сила стороны
// монстров: сами монстры, их усилители и бонусы), героям −3 к побегу, а тот, кто не убежит, теряет все вещи
// и питомца: их раздают другим игрокам наугад. Раз за бой.
export const PANDORA_COST = 3000;
export const PANDORA_MULT = 2;
export const PANDORA_ESCAPE = 3;
// Испытание дня: в этот день у всех одна и та же колода и одно условие дня
export const DAILY = [
  { id: 'deep', name: 'Глубокий спуск', text: 'Партия начинается сразу с глубины 1: монстры +1.' },
  { id: 'rich', name: 'Богатый старт', text: 'Каждому на старте ещё 2 карты клада.' },
  { id: 'loc', name: 'С места в карьер', text: 'Партия начинается сразу в локации дня.' },
  { id: 'veteran', name: 'Бывалые', text: 'Все начинают со 2-го уровня.' },
  { id: 'fair', name: 'Ярмарочный день', text: 'На подземном рынке всё на четверть дешевле.' },
  { id: 'beasts', name: 'Звериный день', text: 'Зверя можно приручить уже при перевесе 5.' },
];
export const dailyOf = date => { let h = 7; for (const ch of String(date)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return DAILY[h % DAILY.length]; };
// дата испытания — по Москве, чтобы день у всех игроков менялся в одну полночь
export const dailyDate = (t = Date.now()) => new Date(t + 3 * 3600 * 1000).toISOString().slice(0, 10);

// ───────── Кошелёк и подземный рынок ─────────
// Голды копятся в кошельке: за проданные вещи и выполненные контракты. Тратятся на рынке.
// Рынок открыт всегда: в свой ход вне боя можно купить разовые карты, зелья, проклятия и «Получи уровень» —
// только те, что ещё лежат в колоде, поэтому их число ограничено. Уровень — не больше одного за ход.
// У каждой локации своя ценовая политика по разделам рынка (поле prices, all — на всё остальное).
export const SHOP_CATS = { level: 'Уровни', curse: 'Проклятия', duel: 'Поединки', food: 'Еда и питьё', potion: 'Зелья', gear: 'Снаряжение', magic: 'Магия' };
const SHOP_SHORT = { level: 'уровни', curse: 'проклятия', duel: 'поединки', food: 'еда', potion: 'зелья', gear: 'снаряжение', magic: 'магия' };
export const shopCat = d => (d.type === 'levelup' ? 'level' : d.type === 'curse' ? 'curse' : d.type === 'duel' ? 'duel' : d.type === 'oneshot' || d.type === 'buff' ? d.shop || 'gear' : null);
// «Роковая женщина»: проигравший теряет большую вещь и столько уровней
export const FEMME_LEVELS = 2;
// «Шопоголик» — статус-сюрприз: потратил на рынке столько голдов — цены ниже и рынок открыт в любой момент, даже в бою
export const REGULAR_SPEND = 5000;
export const REGULAR_DISCOUNT = 0.2;
// цена без поправок: уровень — 1000, проклятие — по тому, как больно бьёт, разовые и зелья — вдвое дороже, чем их продают
const CURSE_PRICE = { levels: 600, slot: 400, smallItem: 300, bestItems: 600, race: 500, class: 500, cards: 150, giveToTop: 400, nextCombat: 100, nextEscape: 100 };
export const roundPrice = v => Math.max(50, Math.round(v / 50) * 50);
export function shopBase(d) {
  if (d.price) return d.price;
  if (d.type === 'levelup') return 1000;
  if (d.type === 'curse') {
    let v = 0;
    for (const f of d.fx) {
      const k = f.k === 'slot' && f.slot === 'hands' ? 500 : CURSE_PRICE[f.k] || 300;
      v += ['levels', 'cards', 'nextCombat', 'nextEscape'].includes(f.k) ? k * Math.abs(f.n || 1) : k;
    }
    return Math.max(200, roundPrice(v));
  }
  return Math.max(200, (d.value || 0) * 2);
}
// «Рынок: еда −50%, уровни +25%» — для текста локации
export function priceSummary(pr) {
  if (!pr) return '';
  const pct = m => `${m < 1 ? '−' : '+'}${Math.round(Math.abs(1 - m) * 100)}%`;
  const parts = Object.keys(SHOP_SHORT).filter(k => pr[k] != null).map(k => `${SHOP_SHORT[k]} ${pct(pr[k])}`);
  if (pr.all != null) parts.push(`${parts.length ? 'всё остальное' : 'всё'} ${pct(pr.all)}`);
  return parts.length ? `Рынок: ${parts.join(', ')}.` : '';
}

// Глубина: каждые every кругов подземелье уходит глубже, и все монстры, кроме боссов, получают +1 к силе за каждую глубину.
// Глубже max не спускаемся: иначе монстры со временем становятся непобедимыми и партия не кончается.
// В длинных партиях спуск глубже — иначе к середине партии монстры перестают пугать.
export const DEPTH = { 5: { every: 2, max: 2 }, 10: { every: 3, max: 3 }, 15: { every: 1, max: 7 }, 20: { every: 1, max: 8 } };
export const DEPTH_TREASURE_EVERY = 3; // с каждой третьей глубины победа приносит ещё карту клада
// Смерть стоит уровня, а погибший, пока ждёт своего хода, — призрак: раз за ход подкидывает ±2 в чужой бой.
export const DEATH_LEVELS = 1;
export const GHOST_BONUS = 2;
// Обмен: предложение ждёт ответа столько, потом считается отклонённым
export const TRADE_TIMEOUT_MS = 30000;
// Характеры ботов
export const PERSONAS = { cautious: 'осторожный', greedy: 'жадный', vengeful: 'мстительный' };

// Контракты — тайные цели. Выполнил — голды в кошелёк и новый контракт; самому отстающему ещё карта клада.
// ev — какое событие двигает счётчик, need — сколько раз, reward — голды (gold), уровень (levels) или карты клада (treasures).
export const CONTRACTS = [
  { id: 'q_undead', name: 'Охотник на нежить', text: 'Победи 2 монстров-нежить.', ev: 'kill', tag: 'undead', need: 2, reward: { gold: 1000 } },
  { id: 'q_big', name: 'Крупная дичь', text: 'Победи монстра 12-го уровня или выше.', ev: 'kill', minLevel: 12, need: 1, reward: { gold: 1000 } },
  { id: 'q_solo', name: 'Одиночка', text: 'Победи 2 раза без помощника.', ev: 'killSolo', need: 2, reward: { gold: 1000 } },
  { id: 'q_help', name: 'Плечо друга', text: 'Помоги другому победить 2 раза.', ev: 'helpWin', need: 2, reward: { gold: 1000 } },
  { id: 'q_trouble', name: 'Искатель приключений', text: 'Найди неприятности и победи.', ev: 'troubleWin', need: 1, reward: { gold: 1000 } },
  { id: 'q_beasts', name: 'Зверолов', text: 'Победи 2 монстров-зверей: зверя, крысу или насекомое.', ev: 'kill', tags: ['beast', 'rat', 'insect'], need: 2, reward: { gold: 600 } },
  { id: 'q_sell', name: 'Барыга', text: 'Продай 3 вещи.', ev: 'sellItem', need: 3, reward: { gold: 600 } },
  { id: 'q_loot', name: 'Сталкер', text: 'Обшарь 3 комнаты.', ev: 'loot', need: 3, reward: { gold: 600 } },
  { id: 'q_flee', name: 'Ноги в руки', text: 'Удери от монстра 2 раза.', ev: 'escape', need: 2, reward: { gold: 600 } },
  { id: 'q_curse', name: 'Злой язык', text: 'Наложи 2 проклятия на соперников.', ev: 'curse', need: 2, reward: { gold: 600 } },
  { id: 'q_potion', name: 'Зельевар', text: 'Используй 3 разовые карты или зелья.', ev: 'oneshot', need: 3, reward: { gold: 600 } },
  { id: 'q_outfit', name: 'Модник', text: 'Надень разом головняк, броник и обувку.', ev: 'outfit', need: 1, reward: { gold: 600 } },
  { id: 'q_trade', name: 'Купец', text: 'Обменяйся вещами с другим игроком.', ev: 'trade', need: 1, reward: { gold: 600 } },
];
export const CONTRACT_DEFS = Object.fromEntries(CONTRACTS.map(k => [k.id, k]));

// Комплекты снаряжения: все вещи комплекта надеты — сверху бонус (bonus — к силе, run — к побегу, vsTag — против меток монстров).
// места спутника: что он может носить за героя
export const ALLY_SLOT_NAMES = { hand: 'оружие', armor: 'броник', head: 'головняк' };
export const ALLY_SLOT_TEXT = slots => { const n = (slots || []).map(k => ALLY_SLOT_NAMES[k]); return 'носит ' + (n.length > 1 ? `${n.slice(0, -1).join(', ')} и ${n.at(-1)}` : n[0] || 'ничего'); };
export const SETS = {
  legend: { name: 'Легендарный', items: ['i_ares', 'i_godarmor', 'i_epochboots', 'i_excalibur'], bonus: 7, text: 'Шлем Ареса, Доспехи Бога, Сапоги эпохи и Меч Экскалибур вместе: ещё +7 к силе. Носит только человек или герой со «Смешанной кровью».' },
  miner: { name: 'Шахтёрский', items: ['i_helmet', 'i_overalls', 'i_pick'], bonus: 3, run: 1, text: 'Каска шахтёра, Роба шахтёра и Кирка ударника вместе: +3 к силе и +1 к побегу.' },
  king: { name: 'Подгорного короля', items: ['i_kingcrown', 'i_kingmail', 'i_kinghammer'], bonus: 3, vsTag: { tag: 'fire', n: 5 }, text: 'Венец, кольчуга и молот подгорного короля вместе: +3 к силе, против огненных ещё +5.' },
};
export const rewardText = r => (r.gold ? `${r.gold} голдов в кошелёк` : r.levels ? `+${r.levels} уровень` : `${r.treasures} карты клада`);
const BOSS = (id, name, extra) => ({
  id, deck: 'door', type: 'monster', boss: true, name, level: BOSS_LEVEL, treasures: 5, levels: 2, copies: 1, rarity: 'epic',
  noPursue: BOSS_MIN_LEVEL - 1,
  text: `Сила вдвое больше силы героя, против которого он вышел, но не меньше ${BOSS_FLOOR}. Не гонится за героями ниже ${BOSS_MIN_LEVEL}-го уровня.${extra.more ? ' ' + extra.more : ''}`,
  bad: { text: '−5 уровней, и ты погибаешь.', fx: [{ k: 'levels', n: 5 }, { k: 'death' }] },
  ...extra,
});
const RACE = (id, race, name, copies, text) => ({ id, deck: 'door', type: 'race', race, name, copies, art: race, text, rarity: 'rare' });
const CLS = (id, cls, name, copies, text) => ({ id, deck: 'door', type: 'class', cls, name, copies, art: cls, text, rarity: 'rare' });

export const CARD_DEFS = [
  // ───────────── РАСЫ ─────────────
  RACE('r_elf', 'elf', 'Эльф', 3, '+1 к побегу. Получаешь уровень за каждого монстра, которого помог убить другому.'),
  RACE('r_dwarf', 'dwarf', 'Гном', 3, 'Носишь сколько угодно больших вещей. В руке можно держать 6 карт.'),
  RACE('r_halfling', 'halfling', 'Полурослик', 2, 'Раз в ход продаёшь одну вещь вдвое дороже. Провалив побег, можешь сбросить карту и бросить ещё раз.'),
  RACE('r_orc', 'orc', 'Орк', 2, 'Крепкий лоб: +2 к силе, пока не надет головняк. За победу над монстром 10+ уровня — ещё карта клада.'),
  RACE('r_goblin', 'goblin', 'Гоблин', 2, 'Барахольщик: каждая проданная вещь стоит на 200 голдов дороже. Помогая в бою, получает сверх обещанного ещё карту клада — из колоды, а не из доли бойца.'),
  RACE('r_mole', 'molefolk', 'Кротолюд', 2, 'Подкоп: +2 к побегу. Проклятия на головняк, броник и обувку его не берут — шкура толстая.'),

  // ───────────── КЛАССЫ ─────────────
  CLS('c_warrior', 'warrior', 'Воин', 3, 'Ярость: в бою сбрось до 3 карт, +1 за каждую. Ничья в бою — твоя победа.'),
  CLS('c_mage', 'mage', 'Маг', 3, 'Чары: сбрось всю руку (от 3 карт) и усыпи монстра — его клад твой, но без уровня. Левитация: до 3 карт, +1 к побегу за каждую.'),
  CLS('c_cleric', 'cleric', 'Жрец', 2, 'Изгнание: против нежити сбрось до 3 карт, +3 за каждую. Проклятие на тебя срывается на броске 5–6.'),
  CLS('c_rogue', 'rogue', 'Плут', 3, 'Удар в спину: сбрось карту — участник боя получает −2. Карманник: сбрось карту и выброси 4+, чтобы стащить мелкую вещь. Провал — минус уровень.'),
  CLS('c_bard', 'bard', 'Бард', 2, 'Колыбельная: в любом бою сбрось карту — монстры −2 (раз за бой). Слава: побеждая сам, берёт ещё карту клада.'),
  CLS('c_alchemist', 'alchemist', 'Алхимик', 2, 'Мастер зелий: твои разовые карты дают на 2 больше. Перегонка: раз в ход вне боя сбрось 3 карты и возьми карту клада.'),
  CLS('c_engineer', 'engineer', 'Механик', 2, 'Третья рука: можешь держать вещи на три руки. Наладчик: +1 к силе за каждую надетую большую вещь. Против механизмов +3.'),
  { ...CLS('c_witcher', 'witcher', 'Ведьмак', 2, '+3 к силе всегда. Мутаген: один раз за всю партию сбрось в бою 2 карты — ещё +6 к силе.'), rarity: 'epic', bg: 'dark' },
  { ...CLS('c_warlock', 'warlock', 'Чернокнижник', 2, 'Тень: от любого монстра уходит без броска. Подчинение: приручает зверя при перевесе 5, а не 10. Призыв: раз за бой подкидывает монстра с руки в любой бой — свой или чужой — без «Из темноты вылезло…».'), rarity: 'epic', bg: 'dark' },

  { id: 'x_halfbreed', deck: 'door', type: 'halfbreed', name: 'Смешанная кровь', copies: 2, art: 'mix', rarity: 'rare',
    text: 'Можешь иметь две расы сразу и пользоваться обеими. Части Легендарного комплекта подходят тебе при любой расе.' },
  { id: 'x_super', deck: 'door', type: 'supermunch', name: 'Совместитель', copies: 2, art: 'badge', rarity: 'rare',
    text: 'Можешь иметь два класса сразу. Две зарплаты, одна жизнь.' },

  // ───────────── МОНСТРЫ ─────────────
  M('m_slime', 'Слизнячок-попрошайка', 1, 1, {
    art: { body: 'blob', hue: 185, eyes: 'sad', mouth: 'o', props: ['cup'] },
    text: 'Плачет — бить неловко.',
    bad: { text: 'Обрызгал соплями. Ничего не теряешь.', fx: [{ k: 'nothing' }] } }),
  M('m_floorboard', 'Скрипучая половица', 1, 1, {
    copies: 2, art: { body: 'plank', hue: 32, eyes: 'sleepy', mouth: 'smile', props: ['nails'] },
    text: 'Эльфам +1 клад: они ступают так тихо, что половица теряется.', bonusTreasureVs: { race: 'elf', n: 1 },
    bad: { text: 'Скрипит так, что стыдно. Ничего не теряешь.', fx: [{ k: 'nothing' }] } }),
  M('m_mold', 'Сырная плесень', 1, 1, {
    tags: ['fungus'], art: { body: 'blob', hue: 62, pattern: 'spots', mouth: 'tongue' },
    bad: { text: 'Въелась в подошвы. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_moth', 'Фонарный мотылёк', 2, 1, {
    tags: ['insect'], art: { body: 'moth', hue: 42, eyes: 'crazy' },
    vsItem: [{ tag: 'light', n: 3, text: '+3 против героя с источником света — летит на огонёк' }],
    bad: { text: 'Вцепился в шапку и унёс. Теряешь головняк.', fx: [{ k: 'slot', slot: 'head' }] } }),
  M('m_mosquito', 'Комар из вентиляции', 2, 1, {
    tags: ['insect'], art: { body: 'bug', hue: 205, props: ['needle'], eyes: 'angry' },
    bad: { text: 'Звенел всю ночь. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_roach', 'Таракан-качок', 2, 1, {
    copies: 2, tags: ['insect'], art: { body: 'bug', hue: 22, props: ['dumbbell'], eyes: 'angry' },
    bad: { text: 'Отжал у тебя вещь. Теряешь мелкую вещь.', fx: [{ k: 'smallItem' }] } }),
  M('m_mole', 'Крот-бухгалтер', 3, 1, {
    tags: ['beast'],
    art: { body: 'round', hue: 18, props: ['glasses', 'calculator'] }, vs: [{ cls: 'rogue', n: 3, text: '+3 против плутов — у него всё посчитано' }],
    bad: { text: 'Выставил счёт. Сбрось 2 карты с руки.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_leech', 'Пиявка-кредитор', 3, 1, {
    tags: ['water'], escapeMod: -1, art: { body: 'worm', hue: 115, props: ['monocle', 'coins'] },
    text: 'Не отстаёт: −1 к побегу.',
    bad: { text: 'Присосалась к кошельку. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_turnstile', 'Голодный турникет', 3, 1, {
    tags: ['metro', 'machine'], art: { body: 'box', hue: 205, props: ['ticket'], eyes: 'angry', mouth: 'fangs' },
    bad: { text: 'Не пропустил и зажевал. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_ninjamole', 'Крот-ниндзя', 4, 1, {
    tags: ['beast'],
    escapeMod: -2, art: { body: 'round', hue: 255, props: ['bandana', 'sword'], eyes: 'angry' },
    text: 'Быстрее тени: −2 к побегу.',
    bad: { text: 'Увёл ботинки прямо с ног. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_beggar', 'Попрошайка из перехода', 4, 2, {
    tags: ['metro'], noPursue: 3, art: { body: 'humanoid', hue: 30, props: ['hat', 'cup'], eyes: 'sad', mouth: 'smile' },
    text: 'Не гонится за 3-м уровнем и ниже: с них нечего взять.',
    bad: { text: 'Выклянчил. Сбрось 2 карты.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_robovac', 'Ржавый робот-пылесос', 4, 2, {
    tags: ['machine'],
    art: { body: 'disc', hue: 190, props: ['antenna'] },
    bad: { text: 'Всосал всё мелкое. Теряешь мелкую вещь.', fx: [{ k: 'smallItem' }] } }),
  M('m_duck', 'Канализационная утка', 4, 2, {
    tags: ['water', 'beast'], noPursue: 2, art: { body: 'bird', hue: 50, props: ['sailorcap'] },
    text: 'Не гонится за 2-м уровнем и ниже.',
    bad: { text: 'Утащила шапку в гнездо. Теряешь головняк.', fx: [{ k: 'slot', slot: 'head' }] } }),
  M('m_gossip', 'Сталактит-сплетник', 6, 2, {
    tags: ['rock'], art: { body: 'spike', hue: 262, props: ['phone'] },
    bad: { text: 'Рассказал всем твои секреты. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_mycel', 'Грибница-сплетница', 6, 2, {
    tags: ['fungus'], art: { body: 'shroom', hue: 300, props: ['scarf'], mouth: 'smile' }, vs: [{ race: 'elf', n: -2, text: '−2 против эльфов: они её не слушают' }],
    bad: { text: 'Опутала руку. Сбрось все карты с руки.', fx: [{ k: 'hand' }] } }),
  M('m_hypno', 'Гриб-гипнотизёр', 7, 2, {
    tags: ['fungus'], art: { body: 'shroom', hue: 200, eyes: 'spiral', props: ['pendulum'] },
    ambush: { text: 'Засада! Загипнотизировал: сбрось случайную карту.', fx: [{ k: 'cards', n: 1 }] },
    bad: { text: 'Ты забыл, кем работал. Теряешь класс.', fx: [{ k: 'class' }] } }),
  M('m_ratunion', 'Крысиный профсоюз', 7, 2, {
    tags: ['rat', 'beast'], soloBonus: 3, art: { body: 'round', hue: 0, sat: 8, heads: 3, props: ['flag'] },
    text: 'Один в поле не воин: +3 против одиночки.',
    bad: { text: 'Объявили забастовку тебе. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_lasttrain', 'Призрак последней электрички', 7, 2, {
    tags: ['undead', 'metro'], art: { body: 'ghost', hue: 180, props: ['conductorcap', 'lantern'] },
    bad: { text: 'Увёз в депо. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_inspector', 'Скелет-контролёр', 7, 2, {
    tags: ['undead', 'metro'], art: { body: 'skull', hue: 45, props: ['conductorcap', 'ticket'] }, vs: [{ race: 'halfling', n: 3, text: '+3 против полуросликов — ловит безбилетников' }],
    bad: { text: 'Выписал штраф. Теряешь броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),
  M('m_slug', 'Слизень-коллектор', 8, 2, {
    art: { body: 'blob', hue: 108, props: ['briefcase', 'tie'], eyes: 'angry' }, vs: [{ race: 'dwarf', n: 4, text: '+4 против гномов — у них долги по ипотеке шахты' }],
    bad: { text: 'Взыскал. −1 уровень и сбрось 2 карты.', fx: [{ k: 'levels', n: 1 }, { k: 'cards', n: 2 }] } }),
  M('m_cart', 'Вагонетка-оборотень', 8, 2, {
    tags: ['metro', 'machine'], art: { body: 'box', hue: 25, eyes: 'angry', mouth: 'fangs', props: ['fur'] },
    bad: { text: 'Переехала. Теряешь большую вещь.', fx: [{ k: 'slot', slot: 'big' }] } }),
  M('m_batchoir', 'Хор летучих мышей', 9, 2, {
    tags: ['beast'],
    soloBonus: 4, art: { body: 'swarm', hue: 275, props: ['notes'] },
    text: 'Нападают стаей на одиночек: +4, если ты без помощника.',
    bad: { text: 'Перепели тебя. Сбрось 2 карты.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_watchman', 'Ночной сторож', 9, 2, {
    art: { body: 'humanoid', hue: 220, props: ['cap', 'keys', 'mustache'], eyes: 'sleepy' },
    vsItem: [{ tag: 'light', n: -5, text: '−5 против героя с фонарём: боится света' }],
    bad: { text: 'Выгнал до утра. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_dj', 'Двухголовая крыса-диджей', 9, 2, {
    tags: ['rat', 'beast'], art: { body: 'round', hue: 330, heads: 2, props: ['headphones'] },
    bad: { text: 'Басы сорвали с тебя всё лишнее. Теряешь головняк и обувку.', fx: [{ k: 'slot', slot: 'head' }, { k: 'slot', slot: 'feet' }] } }),
  M('m_plumber', 'Мумия сантехника', 9, 2, {
    tags: ['undead', 'water'], art: { body: 'ghost', hue: 38, pattern: 'bandage', props: ['plunger'] },
    bad: { text: 'Перекрыла стояк. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_banshee', 'Банши из бойлерной', 10, 2, {
    tags: ['undead'], art: { body: 'ghost', hue: 285, mouth: 'o', props: ['soundwaves'] },
    bad: { text: 'Перекричала тебя. Теряешь класс.', fx: [{ k: 'class' }] } }),
  M('m_cashier', 'Кассир подземного банка', 10, 3, {
    noHelp: true, art: { body: 'humanoid', hue: 160, props: ['visor', 'glasses', 'coins'] },
    text: 'Обслуживание строго по одному: звать на помощь нельзя.',
    bad: { text: 'Списал комиссию. Теряешь самую ценную вещь.', fx: [{ k: 'bestItems', n: 1 }] } }),
  M('m_zhek', 'Подземный ЖЭК', 12, 3, {
    art: { body: 'box', hue: 210, props: ['stamp', 'tie'], eyes: 'sleepy' },
    bad: { text: 'Предписание об изъятии. Теряешь броник и 1 уровень.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'levels', n: 1 }] } }),
  M('m_minotaur', 'Минотавр-экскурсовод', 12, 3, {
    art: { body: 'horned', hue: 15, props: ['flag'] }, vs: [{ cls: 'mage', n: 5, text: '+5 против магов — он слышал все фокусы' }],
    bad: { text: 'Водил по лабиринту три часа. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_endless', 'Червь-бесконечник', 12, 3, {
    tags: ['metro'], escape: false, art: { body: 'worm', hue: 258, props: ['hardhat'], eyes: 'sleepy' },
    text: 'Убежать нельзя: тоннель везде. Зато кусается небольно.',
    bad: { text: 'Укусил в пятку. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_salamander', 'Саламандра из котельной', 12, 3, {
    tags: ['fire', 'beast'], art: { body: 'croc', hue: 12, props: ['flames'] },
    vsItem: [{ tag: 'water', n: -5, text: '−5 против героя с огнетушителем' }],
    bad: { text: 'Прожгла одежду. Теряешь броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),
  M('m_spider', 'Паук-вязальщица', 13, 3, {
    tags: ['beast'],
    art: { body: 'spider', hue: 340, props: ['yarn'] },
    bad: { text: 'Связала тебе новую личность. Теряешь расу.', fx: [{ k: 'race' }] } }),
  M('m_croc', 'Канализационный аллигатор', 13, 3, {
    tags: ['water', 'beast'], escapeMod: -2, art: { body: 'croc', hue: 135, props: ['sunglasses'] },
    text: 'Плавает быстрее тебя: −2 к побегу.',
    bad: { text: 'Откусил кусок броника. Теряешь броник и 1 уровень.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'levels', n: 1 }] } }),
  M('m_paranoid', 'Бункерный параноик', 13, 3, {
    noHelp: true, art: { body: 'humanoid', hue: 90, props: ['foilhat'], eyes: 'crazy' }, vs: [{ cls: 'rogue', n: 4, text: '+4 против плутов — никому не верит' }],
    text: 'Посторонних не пускает: звать на помощь нельзя.',
    bad: { text: 'Конфисковал всё подозрительное. Сбрось руку.', fx: [{ k: 'hand' }] } }),
  M('m_golem', 'Каменный голем-вахтёр', 14, 3, {
    tags: ['rock', 'machine'], art: { body: 'golem', hue: 30, sat: 6, props: ['cap', 'keys'] }, noPursue: 4,
    text: 'Не гонится за 4-м уровнем и ниже: «Детям можно».',
    bad: { text: '«Посторонним вход воспрещён!» −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_worm', 'Червь-метростроевец', 14, 3, {
    tags: ['metro'], art: { body: 'worm', hue: 350, props: ['hardhat'] },
    bad: { text: 'Прорыл тоннель через твою экипировку. Теряешь всё, что в руках.', fx: [{ k: 'slot', slot: 'hands' }] } }),
  M('m_ghostdriver', 'Призрак-машинист', 14, 3, {
    tags: ['undead', 'metro'], noPursue: 3, art: { body: 'ghost', hue: 195, props: ['conductorcap', 'whistle'] },
    text: 'Не гонится за 3-м уровнем и ниже.',
    bad: { text: '«Осторожно, двери закрываются!» −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_excavator', 'Экскаватор-мертвец', 15, 3, {
    tags: ['undead', 'machine'], art: { body: 'excavator', hue: 45 },
    bad: { text: 'Зачерпнул ковшом. Теряешь большую вещь и 2 уровня.', fx: [{ k: 'slot', slot: 'big' }, { k: 'levels', n: 2 }] } }),
  M('m_mirror', 'Зеркальный двойник', 0, 3, {
    mirror: 2, rarity: 'epic', art: { body: 'ghost', hue: 200, props: ['mirrorframe'], eyes: 'angry' },
    text: 'Сила — уровень лидера партии плюс 2. Чем ты круче, тем он злее.',
    bad: { text: 'Поменялся с тобой местами. Теряешь расу и класс.', fx: [{ k: 'race' }, { k: 'class' }] } }),
  M('m_concrete', 'Бетонный голем', 16, 4, {
    tags: ['rock', 'machine'], art: { body: 'golem', hue: 210, sat: 4, props: ['rebar'], eyes: 'angry' }, vs: [{ race: 'dwarf', n: -3, text: '−3 против гномов: знают, где трещины' }],
    bad: { text: 'Залил тебя бетоном. −2 уровня, теряешь броник.', fx: [{ k: 'levels', n: 2 }, { k: 'slot', slot: 'armor' }] } }),
  M('m_vampire', 'Вампир-ростовщик', 16, 4, {
    tags: ['undead'], art: { body: 'bat', hue: 340, props: ['monocle', 'coins'] },
    bad: { text: 'Проценты выросли. Теряешь 2 самые ценные вещи.', fx: [{ k: 'bestItems', n: 2 }] } }),
  M('m_heatpipe', 'Змей теплотрассы', 16, 4, {
    tags: ['fire'], art: { body: 'worm', hue: 18, props: ['steam'], eyes: 'angry' }, levels: 2,
    bad: { text: 'Горячий приём. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_lich', 'Лич из архива', 17, 4, {
    tags: ['undead'], art: { body: 'skull', hue: 150, props: ['book', 'glasses'] }, vs: [{ cls: 'cleric', n: 4, text: '+4 против жрецов — у него справка' }],
    bad: { text: 'Сдал тебя в архив — навечно. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_moldking', 'Плесневой король', 17, 4, {
    tags: ['fungus'], art: { body: 'shroom', hue: 85, crown: true, pattern: 'spots', eyes: 'angry' },
    ambush: { text: 'Засада! Споры в лицо: сбрось случайную карту.', fx: [{ k: 'cards', n: 1 }] },
    bad: { text: 'Всё покрылось плесенью. Теряешь все вещи.', fx: [{ k: 'allItems' }] } }),
  M('m_ratqueen', 'Королева пещерных крыс', 18, 4, {
    tags: ['rat', 'beast'], art: { body: 'round', hue: 300, crown: true, props: ['cape'] }, levels: 2,
    bad: { text: 'Свита отобрала всё. −2 уровня и сбрось руку.', fx: [{ k: 'levels', n: 2 }, { k: 'hand' }] } }),
  M('m_troll', 'Тролль-налоговик', 18, 4, {
    art: { body: 'horned', hue: 120, props: ['briefcase', 'tie'] }, levels: 2,
    bad: { text: 'Налог на всё. Теряешь все вещи.', fx: [{ k: 'allItems' }] } }),
  M('m_cricket', 'Медведка-великан', 19, 4, {
    tags: ['insect'], escapeMod: -1, art: { body: 'bug', hue: 30, props: ['claws'], eyes: 'angry', mouth: 'fangs' }, levels: 2,
    text: 'Роет быстрее тебя: −1 к побегу.',
    bad: { text: 'Закопала заживо. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_dragon', 'Дракон из-под моста', 20, 5, {
    tags: ['fire'], art: { body: 'dragon', hue: 0 }, levels: 2, noPursue: 5,
    text: 'Не гонится за 5-м уровнем и ниже: мелочь не жуёт.',
    bad: { text: 'Поджарил. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_pit', 'Бездонная яма с зубами', 21, 5, {
    art: { body: 'pit', hue: 270 }, levels: 2,
    bad: { text: 'Дна действительно нет. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_philosopher', 'Сталагмит-философ', 21, 5, {
    tags: ['rock'], noPursue: 6, art: { body: 'spike', hue: 28, flip: true, props: ['beard', 'glasses'], eyes: 'sleepy' }, levels: 2,
    text: 'Не гонится за 6-м уровнем и ниже: им рано о вечном.',
    bad: { text: 'Объяснил смысл жизни. −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_molekron', 'Древний Кротокрон', 22, 5, {
    art: { body: 'round', hue: 25, crown: true, heads: 3, props: ['beard'] }, levels: 2, noPursue: 5,
    text: 'Не гонится за 5-м уровнем и ниже.',
    bad: { text: 'Закопал на тысячу лет. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_gorynych', 'Змей кольцевой линии', 22, 5, {
    tags: ['fire', 'metro'], art: { body: 'dragon', hue: 125, heads: 3 }, levels: 2, noPursue: 5,
    text: 'Три головы, три пересадки. Не гонится за 5-м уровнем и ниже.',
    bad: { text: 'Проехал по тебе всю кольцевую. Ты погибаешь.', fx: [{ k: 'death' }] } }),

  // ───────────── ИЗ СКАЗОК, МИФОВ И ЛЕГЕНД ─────────────
  M('m_kolobok', 'Колобок-беглец', 2, 1, {
    escapeMod: -1, art: { body: 'blob', hue: 42, eyes: 'happy', mouth: 'grin' },
    text: 'Сам от всех ушёл — и от него не уйдёшь: −1 к побегу.',
    bad: { text: 'Укатился с твоей обувкой. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_kikimora', 'Кикимора болотная', 4, 2, {
    tags: ['water'], noHelp: true, art: { body: 'blob', hue: 120, eyes: 'crazy', props: ['scarf', 'yarn'] },
    text: 'Путает дорогу всем, кто спешит на помощь.',
    bad: { text: 'Запутала. Сбрось 2 карты и потеряй обувку.', fx: [{ k: 'cards', n: 2 }, { k: 'slot', slot: 'feet' }] } }),
  M('m_likho', 'Лихо Одноглазое', 4, 2, {
    levelOnly: true, art: { body: 'humanoid', hue: 25, cyclops: true, props: ['beard'], eyes: 'angry' },
    text: 'Лихо вещами не обманешь.',
    bad: { text: 'Лихо привязалось. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_mimic', 'Мимик-сундук', 5, 3, {
    art: { body: 'box', hue: 35, mouth: 'fangs', props: ['coins'], eyes: 'angry' },
    ambush: { text: 'Засада! Притворялся кладом: сбрось случайную карту.', fx: [{ k: 'cards', n: 1 }] },
    bad: { text: 'Проглотил самую ценную вещь.', fx: [{ k: 'bestItems', n: 1 }] } }),
  M('m_medusa', 'Горгона-вахтёрша', 6, 2, {
    levelOnly: true, rarity: 'rare', art: { body: 'humanoid', hue: 140, props: ['snakes', 'glasses'], eyes: 'angry' },
    text: 'Взглянет на вещи и зелья — и те окаменеют.',
    bad: { text: 'Окаменел до утра. Теряешь броник и обувку.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'slot', slot: 'feet' }] } }),
  M('m_leshy', 'Леший-регулировщик', 7, 2, {
    escapeMod: -2, art: { body: 'spike', hue: 95, props: ['leaves', 'beard', 'whistle'], eyes: 'crazy' },
    text: 'Водит кругами: −2 к побегу.',
    bad: { text: 'Завёл в чащу. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_cyclops', 'Циклоп-сварщик', 7, 2, {
    levelOnly: true, rarity: 'rare', art: { body: 'golem', hue: 205, cyclops: true, props: ['visor'], eyes: 'angry' },
    text: 'Одним глазом видит только твой уровень.',
    bad: { text: 'Приварил к рельсам. −2 уровня и теряешь большую вещь.', fx: [{ k: 'levels', n: 2 }, { k: 'slot', slot: 'big' }] } }),
  M('m_solovey', 'Соловей-разбойник', 8, 2, {
    noHelp: true, art: { body: 'bird', hue: 25, props: ['soundwaves', 'bandana'], eyes: 'angry' },
    text: 'Свистит так, что помощники глохнут.',
    bad: { text: 'Сдул свистом шапку и уровень.', fx: [{ k: 'slot', slot: 'head' }, { k: 'levels', n: 1 }] } }),
  M('m_koschei', 'Кощей Бессмертный', 7, 3, {
    tags: ['undead'], levelOnly: true, noHelp: true, rarity: 'epic', art: { body: 'skull', hue: 140, crown: true, props: ['cape', 'sword'] },
    text: 'Смерть его в игле, а где игла — никто не знает.',
    bad: { text: 'Запер в темнице. −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_griffin', 'Грифон-почтальон', 9, 3, {
    tags: ['beast'],
    escape: false, art: { body: 'bird', hue: 40, props: ['wings', 'cap'], eyes: 'angry' },
    text: 'Летает быстрее всех: убежать нельзя.',
    bad: { text: 'Унёс в гнездо твой броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),
  M('m_vodyanoy', 'Водяной из коллектора', 9, 2, {
    tags: ['water'], escapeMod: -1, art: { body: 'blob', hue: 170, props: ['beard', 'crown'], eyes: 'sleepy' },
    text: 'В воде он хозяин: −1 к побегу.',
    bad: { text: 'Утащил на дно. Теряешь броник и 2 уровня.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'levels', n: 2 }] } }),
  M('m_genie', 'Джинн из лампы', 10, 3, {
    noHelp: true, art: { body: 'ghost', hue: 250, props: ['genielamp', 'mustache'], eyes: 'happy' },
    text: 'Исполняет желания строго по одному.',
    bad: { text: 'Исполнил твоё желание наоборот. −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_babayaga', 'Баба-Яга в ступе', 11, 3, {
    escapeMod: -1, art: { body: 'humanoid', hue: 30, props: ['scarf', 'broom'], eyes: 'crazy', mouth: 'fangs' },
    text: 'Ступа быстрее тебя: −1 к побегу.',
    bad: { text: 'Посадила на лопату — и в печь. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_basilisk', 'Василиск из шахты', 13, 3, {
    tags: ['rock', 'beast'], escapeMod: -1, art: { body: 'croc', hue: 95, crown: true, eyes: 'spiral' },
    text: 'Не смотри ему в глаза: −1 к побегу.',
    bad: { text: 'Взглянул — и ты окаменел. Теряешь все вещи.', fx: [{ k: 'allItems' }] } }),
  M('m_cerberus', 'Цербер-вахтёр', 13, 4, {
    tags: ['beast'],
    escapeMod: -2, art: { body: 'round', hue: 0, sat: 8, heads: 3, props: ['keys'], eyes: 'angry', mouth: 'fangs' },
    text: 'Три головы — шесть глаз: −2 к побегу.',
    bad: { text: 'Покусал в три пасти. −2 уровня и сбрось руку.', fx: [{ k: 'levels', n: 2 }, { k: 'hand' }] } }),
  M('m_manticore', 'Мантикора', 14, 4, {
    tags: ['beast'],
    noPursue: 4, art: { body: 'horned', hue: 28, props: ['stinger', 'fur'], eyes: 'angry', mouth: 'fangs' },
    text: 'Не гонится за 4-м уровнем и ниже.',
    bad: { text: 'Жало в хвосте. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_hydra', 'Гидра канализационная', 16, 4, {
    tags: ['water'], soloBonus: 4, levels: 2, art: { body: 'dragon', hue: 160, heads: 3 },
    text: 'Отрубишь голову — вырастут две: +4 против одиночки.',
    bad: { text: 'Головы договорились. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_kraken', 'Кракен из коллектора', 18, 5, {
    tags: ['water'], noHelp: true, escapeMod: -1, levels: 2, art: { body: 'blob', hue: 330, props: ['tentacles'], eyes: 'angry', mouth: 'fangs' },
    text: 'Щупалец хватит на всех. −1 к побегу.',
    bad: { text: 'Утащил в глубину. Ты погибаешь.', fx: [{ k: 'death' }] } }),

  // ───────────── НОВЫЕ ОБИТАТЕЛИ ─────────────
  // bribe — можно откупиться вещью; split — после победы делится и ждёт за следующей дверью; helperCut — помощник ослабляет
  // escapeOn — убежать можно только выбросив столько; perPlayer — сильнее за каждого игрока; slainBy — вещь, с которой он сдаётся
  // roundMod — сила на чётных и нечётных кругах; sleepsIn — в этой локации спит (сила 0)
  M('m_rusteater', 'Ржавник', 8, 2, {
    tags: ['beast'], bribe: true, art: { body: 'blob', hue: 25 },
    text: 'Жрёт железо. Брось ему любую свою вещь — уползёт жевать, бой окончен без наград.',
    bad: { text: 'Сожрал твою лучшую вещь.', fx: [{ k: 'bestItems', n: 1 }] } }),
  M('m_viy', 'Вий', 15, 4, {
    tags: ['undead'], soloBonus: 6, levels: 2, art: { body: 'blob', hue: 30 },
    text: '«Поднимите мне веки!» Одному не справиться: против одиночки +6.',
    bad: { text: 'Увидел тебя. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_chudo', 'Чудо-Юдо', 15, 4, {
    tags: ['beast', 'water'], helperCut: 5, levels: 2, art: { body: 'dragon', hue: 100, heads: 3 },
    text: 'Трёхглавое: помощник срубает одну голову — −5.',
    bad: { text: 'Все три головы недовольны. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_ghosttrain', 'Поезд-призрак', 12, 3, {
    tags: ['undead', 'metro', 'machine'], escapeOn: 6, art: { body: 'blob', hue: 190 },
    vs: [{ cls: 'engineer', n: -6, text: '−6 против механика: он знает, где стоп-кран' }],
    text: 'Убежать можно, только выбросив 6 — бонусы к побегу не помогают.',
    bad: { text: 'Переехал. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_ratking', 'Крысиный король', 4, 3, {
    tags: ['rat', 'beast'], perPlayer: 2, slainBy: 'i_trap', art: { body: 'round', hue: 20, crown: true },
    text: '+2 за каждого игрока за столом. Увидит Крысоловку у героя — сдаётся сразу (сила 0).',
    bad: { text: 'Подданные растащили: сбрось 2 карты.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_swarm', 'Рой', 10, 2, {
    tags: ['insect'], split: 2, art: { body: 'blob', hue: 60 },
    text: 'Победишь — рой разлетается и ждёт за следующей дверью: −4 уровня за каждое деление, после двух рассеивается.',
    bad: { text: 'Зажалили. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_mimicdoor', 'Мимик-дверь', 9, 3, {
    tags: ['machine'], art: { body: 'box', hue: 20, mouth: 'fangs' },
    ambush: { text: 'Засада! Дверь укусила за ногу: −1 уровень.', fx: [{ k: 'levels', n: 1 }] },
    bad: { text: 'Захлопнулась на ноге: теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_midnight', 'Полуночница', 9, 3, {
    tags: ['undead'], roundMod: { even: 5, odd: -3 }, art: { body: 'ghost', hue: 240 },
    text: 'На чётных кругах +5, на нечётных −3.',
    bad: { text: 'Не дала спать: −3 в следующем бою и −1 уровень.', fx: [{ k: 'nextCombat', n: -3 }, { k: 'levels', n: 1 }] } }),
  M('m_bannik', 'Банник', 8, 2, {
    tags: ['water'], sleepsIn: 'loc_tavern', art: { body: 'blob', hue: 15 },
    text: 'В таверне «Хмельной кабан» он парится и драться не станет: сила 0.',
    bad: { text: 'Отхлестал веником: теряешь броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),

  // ───────────── БОССЫ ─────────────
  // Одному не справиться: нужен помощник, зелья и разовые карты. Или убежать, бросить шашку, окаменить свитком, подставить питомца.
  BOSS('m_lucifer', 'Люцифер', { art: { boss: 'lucifer', hue: 0 }, quote: 'Ну здравствуй, герой. Присаживайся, у нас тепло.' }),
  BOSS('m_hades', 'Аид', { art: { boss: 'hades', hue: 160 }, quote: 'Добро пожаловать в моё подземелье. Обратно не провожаем.' }),
  BOSS('m_anubis', 'Анубис', { art: { boss: 'anubis', hue: 42 }, quote: 'Положи сердце на весы. Посмотрим, сколько ты весишь.' }),
  BOSS('m_morena', 'Морена', { art: { boss: 'morena', hue: 200 }, onAppear: 'freeze', quote: 'Зима пришла и под землю. Надолго.',
    more: 'Явившись, дышит стужей: у каждого героя за столом примерзает лучшая надетая вещь — её приходится снять.' }),
  BOSS('m_chernobog', 'Чернобог', { art: { boss: 'chernobog', hue: 280 }, onAppear: 'grab', quote: 'Всё, что во тьме, — моё. А ты давно во тьме.',
    more: 'Явившись, забирает у каждого игрока, кроме того, с кем бьётся, по случайной карте из руки.' }),

  // ───────────── ПРОКЛЯТИЯ ─────────────
  { id: 'k_draft', short: 'Жертва теряет головняк.', deck: 'door', type: 'curse', name: 'Проклятие: Сквозняк', copies: 2, art: 'wind',
    text: 'Сдуло шапку. Жертва теряет головняк.', fx: [{ k: 'slot', slot: 'head' }] },
  { id: 'k_cavein', deck: 'door', type: 'curse', name: 'Проклятие: Обвал свода', copies: 1, art: 'rocks',
    text: 'Жертва теряет броник.', fx: [{ k: 'slot', slot: 'armor' }] },
  { id: 'k_puddle', deck: 'door', type: 'curse', name: 'Проклятие: Лужа по колено', copies: 1, art: 'puddle',
    text: 'Жертва теряет обувку.', fx: [{ k: 'slot', slot: 'feet' }] },
  { id: 'k_rust', deck: 'door', type: 'curse', name: 'Проклятие: Ржавчина', copies: 1, art: 'rust',
    text: 'Жертва теряет случайную мелкую вещь.', fx: [{ k: 'smallItem' }] },
  { id: 'k_rusthands', deck: 'door', type: 'curse', name: 'Проклятие: Ржавые руки', copies: 1, art: 'rust',
    text: 'Жертва теряет всё, что держит в руках.', fx: [{ k: 'slot', slot: 'hands' }] },
  { id: 'k_tax', deck: 'door', type: 'curse', name: 'Проклятие: Налоговая проверка', copies: 2, art: 'paper',
    text: 'Жертва теряет уровень.', fx: [{ k: 'levels', n: 1 }] },
  { id: 'k_fever', deck: 'door', type: 'curse', name: 'Проклятие: Подземная лихорадка', copies: 1, art: 'drop',
    text: 'Жертва теряет уровень и получает −2 в следующем бою.', fx: [{ k: 'levels', n: 1 }, { k: 'nextCombat', n: -2 }] },
  { id: 'k_amnesia', deck: 'door', type: 'curse', name: 'Проклятие: Забыл, кто ты', copies: 1, art: 'question',
    text: 'Жертва теряет расу.', fx: [{ k: 'race' }] },
  { id: 'k_fired', deck: 'door', type: 'curse', name: 'Проклятие: Уволен', copies: 1, art: 'paper',
    text: 'Жертва теряет класс.', fx: [{ k: 'class' }] },
  { id: 'k_pickpocket', deck: 'door', type: 'curse', name: 'Проклятие: Карманники в метро', copies: 1, art: 'hand',
    text: 'Жертва сбрасывает 2 случайные карты с руки.', fx: [{ k: 'cards', n: 2 }] },
  { id: 'k_klepto', short: 'Лидер среди соперников крадёт у жертвы мелкую вещь.', deck: 'door', type: 'curse', name: 'Проклятие: Сосед-клептоман', copies: 1, art: 'hand',
    text: 'Самый прокачанный из остальных игроков забирает у жертвы случайную мелкую вещь.', fx: [{ k: 'giveToTop' }] },
  { id: 'k_flu', deck: 'door', type: 'curse', name: 'Проклятие: Подземный насморк', copies: 2, art: 'drop',
    text: 'Жертва получает −3 в следующем бою (или в текущем).', fx: [{ k: 'nextCombat', n: -3 }] },
  { id: 'k_backpack', deck: 'door', type: 'curse', name: 'Проклятие: Тяжёлый рюкзак', copies: 1, art: 'backpack',
    text: 'Жертва получает −2 к побегу в следующем бою.', fx: [{ k: 'nextEscape', n: -2 }] },
  { id: 'k_jinx', deck: 'door', type: 'curse', name: 'Проклятие: Сглаз на вещи', copies: 1, art: 'eye',
    text: 'Жертва теряет самую ценную вещь.', fx: [{ k: 'bestItems', n: 1 }] },

  // ───────────── УСИЛИТЕЛИ МОНСТРОВ ─────────────
  { id: 'e_seasoned', deck: 'door', type: 'enhancer', name: 'Матёрый', copies: 2, bonus: 5, treasureDelta: 1, art: 'up',
    text: '+5 к монстру и +1 клад.' },
  { id: 'e_armored', deck: 'door', type: 'enhancer', name: 'Бронированный', copies: 1, bonus: 7, treasureDelta: 1, art: 'shieldup', rarity: 'rare',
    text: '+7 к монстру и +1 клад.' },
  { id: 'e_hungry', deck: 'door', type: 'enhancer', name: 'Голодный', copies: 1, bonus: 10, treasureDelta: 2, art: 'up2', rarity: 'rare',
    text: '+10 к монстру и +2 клада.' },
  { id: 'e_pack', deck: 'door', type: 'enhancer', name: 'Стайный', copies: 1, bonus: 0, double: true, treasureDelta: 2, art: 'pack', rarity: 'epic',
    text: 'Монстр пришёл с роднёй: его уровень удваивается. +2 клада.' },
  { id: 'e_rabid', deck: 'door', type: 'enhancer', name: 'Бешеный', copies: 1, bonus: 5, treasureDelta: 1, noEscape: true, art: 'rabid', rarity: 'rare',
    text: '+5 к монстру и +1 клад. От бешеного не убежать.' },
  { id: 'e_morning', deck: 'door', type: 'enhancer', name: 'Злой с утра', copies: 2, bonus: 3, treasureDelta: 1, art: 'up',
    text: '+3 к монстру и +1 клад. Не выспался.' },
  { id: 'e_baby', deck: 'door', type: 'enhancer', name: 'Детёныш', copies: 2, bonus: -5, treasureDelta: -1, art: 'down',
    text: '−5 к монстру и −1 клад.' },
  { id: 'e_decrepit', deck: 'door', type: 'enhancer', name: 'Дряхлый', copies: 1, bonus: -7, treasureDelta: -2, art: 'down',
    text: '−7 к монстру и −2 клада. Ворчит, но еле ходит.' },
  { id: 'e_cold', deck: 'door', type: 'enhancer', name: 'Простуженный', copies: 1, bonus: -3, treasureDelta: -1, art: 'down',
    text: '−3 к монстру и −1 клад. Чихает.' },

  { id: 'w_wandering', deck: 'door', type: 'wandering', name: 'Из темноты вылезло…', copies: 4, art: 'eyes',
    text: 'Сыграй вместе с монстром из руки: он вступает в чужой бой на стороне подземелья.' },

  // ───────────── ЛОКАЦИИ ─────────────
  // Пока локация лежит на столе, её правила действуют на всех. Новая локация заменяет старую.
  // Арт — живописные сцены из /loc/v2: кадр на карте и фон всего стола (1920 px и 4K).
  { id: 'loc_tavern', deck: 'door', type: 'location', prices: { food: 0.5, level: 1.25 }, priceNote: 'Трактирщик наливает за полцены, а умных книжек тут не держат.', name: 'Таверна «Хмельной кабан»', copies: 2, art: 'loc_tavern', rarity: 'rare',
    handBonus: 2, helperBonus: 1,
    text: 'В руке можно держать на 2 карты больше. Помощник в бою получает ещё +1 клад.' },
  { id: 'loc_dungeon', deck: 'door', type: 'location', prices: { curse: 0.7, magic: 0.8, level: 1.2 }, priceNote: 'Скупщики краденого: проклятия и свитки дешевле, зато стража берёт мзду за каждый уровень.', name: 'Сокровищница темницы', copies: 2, art: 'loc_dungeon', rarity: 'epic',
    treasureBonus: 1, monsterTag: [{ tag: 'undead', n: 2 }, { tag: 'rat', n: 2 }], heroMod: [{ cls: 'rogue', n: 2 }],
    text: 'За каждую победу — ещё карта клада. Нежить и крысы +2. Плуты +2 к силе.' },
  { id: 'loc_glade', deck: 'door', type: 'location', prices: { potion: 0.6, food: 0.8, curse: 1.5 }, priceNote: 'Травы растут под ногами — зелья дешёвые. Тёмную магию на светлой поляне не любят.', name: 'Поляна светлячков', copies: 2, art: 'loc_glade', rarity: 'rare',
    heroAll: 1, lightBonus: 3, monsterTag: [{ tag: 'fungus', n: 3 }],
    text: 'Всем героям +1, светильники ещё +3. Грибы +3.' },
  { id: 'loc_forge', deck: 'door', type: 'location', prices: { gear: 0.6, food: 1.25, magic: 1.25 }, priceNote: 'Кузнецы отдают снаряжение почти даром, а еду и свитки везут издалека.', name: 'Кузня подгорного короля', copies: 2, art: 'loc_forge', rarity: 'epic',
    treasureBonus: 1, monsterTag: [{ tag: 'fire', n: 4 }], heroMod: [{ race: 'dwarf', n: 2 }, { cls: 'engineer', n: 2 }],
    text: 'За каждую победу — ещё карта клада. Огненные монстры +4. Гномы и механики +2.' },
  { id: 'loc_ice', deck: 'door', type: 'location', prices: { food: 1.5, potion: 1.25, curse: 0.8 }, priceNote: 'В мороз горячее на вес золота, зато проклятия во льду хорошо хранятся.', name: 'Ледяная цитадель', copies: 2, art: 'loc_ice', rarity: 'rare',
    escapeAll: -1, monsterTag: [{ tag: 'fire', n: -5 }, { tag: 'insect', n: -3 }], heroMod: [{ race: 'dwarf', n: 1 }, { race: 'molefolk', n: 1 }],
    text: 'Огненные монстры −5, насекомые −3. Гномы и кротолюды +1. Скользко: всем −1 к побегу.' },
  { id: 'loc_graveyard', deck: 'door', type: 'location', prices: { curse: 0.6, potion: 1.5 }, priceNote: 'Некроманты сбывают проклятия, а святая вода и зелья тут в дефиците.', name: 'Кладбище горгулий', copies: 2, art: 'loc_graveyard', rarity: 'rare',
    monsterTag: [{ tag: 'undead', n: 3 }], heroMod: [{ cls: 'cleric', n: 3 }, { cls: 'witcher', n: 2 }],
    text: 'Нежить +3. Жрецы +3, ведьмаки +2 к силе.' },
  { id: 'loc_sky', deck: 'door', type: 'location', prices: { level: 1.5, magic: 0.7 }, priceNote: 'Наверх подниматься дорого: уровни в полтора раза дороже. Небесные свитки — дешевле.', name: 'Небесная цитадель', copies: 2, art: 'loc_sky', rarity: 'epic',
    levelBonus: 1, monsterAll: 2,
    text: 'Каждая победа даёт ещё +1 уровень. Монстры в грозу злее: +2.' },
  { id: 'loc_cove', deck: 'door', type: 'location', prices: { food: 0.6, all: 0.85 }, priceNote: 'Пиратская контрабанда: всё дешевле, а ром почти даром.', name: 'Бухта гоблинов-пиратов', copies: 2, art: 'loc_cove', rarity: 'rare',
    escapeAll: 2, monsterTag: [{ tag: 'water', n: 2 }], heroMod: [{ race: 'goblin', n: 2 }],
    text: 'Всем +2 к побегу. Водные монстры +2. Гоблины +2 к силе.' },
  { id: 'loc_library', deck: 'door', type: 'location', prices: { level: 0.7, magic: 0.6, food: 1.5 }, priceNote: 'Знание — сила: уровни и свитки дешевле. Еду в читальном зале продают только из-под полы.', name: 'Звёздная библиотека', copies: 2, art: 'loc_library', rarity: 'epic',
    heroAll: 2, heroMod: [{ cls: 'mage', n: 2 }],
    text: 'Всем героям +2, магам ещё +2.' },
  { id: 'loc_oasis', deck: 'door', type: 'location', prices: { level: 0.7, curse: 0.5, food: 1.5 }, priceNote: 'Джинн исполняет желания — уровни дешевле. Проклятия здесь не действуют, их сбывают за бесценок. Вода в пустыне дорогая.', name: 'Оазис джинна', copies: 2, art: 'loc_oasis', rarity: 'rare',
    noCurses: true,
    text: 'Проклятия не действуют.' },
  { id: 'loc_flooded', deck: 'door', type: 'location', prices: { gear: 1.5, food: 1.25, potion: 0.8 }, priceNote: 'Все хотят выбраться: верёвки и дымовые шашки нарасхват, еда размокла.', name: 'Затопленная станция', copies: 2, art: 'loc_flooded', rarity: 'rare',
    escapeAll: -1, monsterTag: [{ tag: 'water', n: 3 }, { tag: 'metro', n: 2 }], itemTag: { tag: 'water', n: 2 },
    text: 'Вода по пояс: всем −1 к побегу. Водные монстры +3, жители метро +2. В непромокаемом +2 к силе.' },
  { id: 'loc_grove', deck: 'door', type: 'location', prices: { food: 0.6, potion: 0.7, magic: 1.25 }, priceNote: 'Грибы маринуют прямо здесь, алхимики варят зелья — дёшево. Свитки отсыревают.', name: 'Грибная роща', copies: 2, art: 'loc_grove', rarity: 'rare',
    handBonus: 1, monsterTag: [{ tag: 'fungus', n: 4 }], heroMod: [{ cls: 'alchemist', n: 2 }, { race: 'halfling', n: 1 }],
    text: 'Грибов полно: в руке на карту больше. Грибные монстры +4. Алхимики +2, полурослики +1.' },
  { id: 'loc_koschei', deck: 'door', type: 'location', prices: { level: 0.8, curse: 0.7, all: 1.25 }, priceNote: 'Кощей чахнет над златом и дерёт втридорога, но уровни и проклятия у него дешевле.', name: 'Логово Кощея', copies: 2, art: 'loc_koschei', rarity: 'epic',
    treasureBonus: 1, monsterTag: [{ tag: 'undead', n: 2 }],
    text: 'Кощей чахнет над златом: за победу ещё карта клада. Нежить +2.' },

  // ───────────── СОБЫТИЯ ─────────────
  // Срабатывают сразу, если их вытащили, выбив дверь. Из руки играются в свой ход вне боя.
  { id: 'ev_quake', deck: 'door', type: 'event', event: 'quake', name: 'Подземный толчок', copies: 1, art: 'ev_quake',
    text: 'Все сбрасывают по случайной карте с руки.' },
  { id: 'ev_light', deck: 'door', type: 'event', event: 'light', name: 'Свет в конце тоннеля', copies: 1, art: 'ev_light', rarity: 'rare',
    text: 'Все жрецы и барды получают уровень (не {win}-й).' },
  { id: 'ev_fair', deck: 'door', type: 'event', event: 'fair', name: 'Ярмарка в переходе', copies: 1, art: 'ev_fair',
    text: 'Все берут по карте клада.' },
  { id: 'ev_draft', deck: 'door', type: 'event', event: 'draft', name: 'Сквозняк перемен', copies: 1, art: 'wind',
    text: 'Все передают случайную карту с руки соседу слева.' },
  { id: 'ev_rollcall', deck: 'door', type: 'event', event: 'rollcall', name: 'Перекличка', copies: 1, art: 'ev_rollcall',
    text: 'Отстающие с самым низким уровнем получают уровень.' },
  { id: 'ev_luxtax', deck: 'door', type: 'event', event: 'luxtax', name: 'Налог на роскошь', copies: 1, art: 'paper',
    text: 'Все игроки {lux}-го уровня и выше теряют уровень.' },
  { id: 'ev_shift', deck: 'door', type: 'event', event: 'shift', name: 'Пересменка', copies: 1, art: 'ev_shift',
    text: 'Все передают всю руку соседу слева. На Поверхности не играется.' },
  { id: 'ev_union', deck: 'door', type: 'event', event: 'union', name: 'Профсоюзное собрание', copies: 1, art: 'ev_union',
    text: 'Голосуют все, кто ниже лидера: если их больше половины стола, лидеры теряют уровень.' },
  { id: 'ev_flood', deck: 'door', type: 'event', event: 'flood', name: 'Затопление', copies: 1, art: 'ev_flood',
    text: 'Все, кто не в непромокаемой обувке, теряют обувку.' },

  // ───────────── ВЫЗОВ ─────────────
  // Дуэль героев: сила против силы (уровень, вещи, «в следующем бою»). Остальные могут подкинуть разовые бонусы любой стороне.
  // При равенстве побеждает вызванный (воин-зачинщик побеждает и при равенстве). Проигравший отдаёт лучшую вещь со стола.
  { id: 'd_duel', short: 'Вызови соперника: сила против силы. Проигравший отдаёт лучшую вещь.', deck: 'door', type: 'duel', name: 'Вызов на поединок', copies: 3, art: 'duel', price: 700,
    text: 'Сыграй в свой ход вне боя: вызови соперника. Сила против силы, остальные могут подкинуть бонусы. Проигравший отдаёт победителю лучшую вещь.' },
  { id: 'd_femme', short: 'Стравит двух соперников. Проигравший: −2 уровня и большая вещь.', deck: 'door', type: 'duel', femme: true, name: 'Роковая женщина', copies: 3, art: 'femme', price: 1000, rarity: 'epic',
    text: 'Сыграй в свой ход вне боя на двух соперников: из-за неё они будут биться. Сила против силы, остальные могут подкинуть бонусы. Проигравший теряет большую вещь и 2 уровня. Ничья — оба уходят целыми.' },

  // ───────────── ЛОВУШКИ ─────────────
  // Выбил дверь — попался. Обезвредить: кубик 4+ (плуту и механику +2) — ловушка уходит в руку, её можно подложить сопернику.
  // Сорвалась при обезвреживании — расплата и ещё −1 уровень. Можно и не рисковать: просто принять расплату.
  // Подложенную ловушку соперник обезвреживает тем же броском, без лишнего штрафа и без трофея.
  { id: 't_tripwire', deck: 'door', type: 'trap', name: 'Растяжка', copies: 1, art: 'tripwire', fx: [{ k: 'slot', slot: 'feet' }],
    text: 'Расплата: теряешь обувку.' },
  { id: 't_pit', deck: 'door', type: 'trap', name: 'Волчья яма', copies: 1, art: 'pit', fx: [{ k: 'levels', n: 1 }],
    text: 'Расплата: теряешь уровень.' },
  { id: 't_net', deck: 'door', type: 'trap', name: 'Сеть под сводом', copies: 1, art: 'net', fx: [{ k: 'nextCombat', n: -3 }, { k: 'nextEscape', n: -1 }],
    text: 'Расплата: запутался — −3 в следующем бою и −1 к побегу.' },
  { id: 't_gas', deck: 'door', type: 'trap', name: 'Газовый карман', copies: 1, art: 'gas', tags: ['gas'], fx: [{ k: 'cards', n: 2 }],
    text: 'Расплата: сбрось 2 случайные карты с руки. Противогаз и канарейка спасают.' },
  { id: 't_rocks', deck: 'door', type: 'trap', name: 'Сыпучий свод', copies: 1, art: 'rocks', fx: [{ k: 'slot', slot: 'head' }],
    text: 'Расплата: камнем по голове — теряешь головняк.' },
  { id: 't_plate', deck: 'door', type: 'trap', name: 'Нажимная плита', copies: 1, art: 'plate', fx: [{ k: 'smallItem' }],
    text: 'Расплата: из стены вылетает лезвие — теряешь мелкую вещь.' },

  // ───────────── КЛАД: ВЕЩИ ─────────────
  // slot: head | armor | feet | hand | none | pet ; hands: 1|2|3 ; big ; tags: ['light','water'] ; vsTag ; clsBonus
  // immune: [метки] — расплата и засады таких монстров не действуют; calm: [метки] — такие монстры не гонятся
  // foeMod: {tag, n} — монстры с меткой слабее/сильнее против героя; noAmbush — засады не срабатывают
  // locBonus: {loc, n} — бонус в локации; noWandering — «Из темноты вылезло…» в бой героя не подкинуть
  // minFoe — вещь не помогает против монстров ниже этого уровня; peek — видно верхнюю карту проходов
  { id: 'i_helmet', deck: 'treasure', type: 'item', name: 'Каска шахтёра', slot: 'head', bonus: 1, value: 200, copies: 2, art: 'helmet', set: 'miner',
    text: 'Комплект «Шахтёрский».' },
  { id: 'i_headlamp', deck: 'treasure', type: 'item', name: 'Налобный фонарь', slot: 'head', bonus: 2, value: 400, art: 'lamp', tags: ['light'],
    text: 'Светит в глаза монстрам. Источник света.' },
  { id: 'i_hardlamp', deck: 'treasure', type: 'item', name: 'Каска с прожектором', slot: 'head', bonus: 2, value: 500, art: 'hardlamp', tags: ['light'], rarity: 'rare',
    text: 'Источник света.' },
  { id: 'i_barrel', deck: 'treasure', type: 'item', name: 'Шлем-бочонок', slot: 'head', bonus: 2, value: 400, art: 'barrel' },
  { id: 'i_gasmask', deck: 'treasure', type: 'item', name: 'Противогаз', slot: 'head', bonus: 2, value: 400, art: 'gasmask', immune: ['fungus', 'gas'],
    text: 'Грибы, споры и газ тебе не страшны: засады и расплата грибных монстров и газовые ловушки не действуют.' },
  { id: 'i_canary', deck: 'treasure', type: 'item', name: 'Каска с канарейкой', slot: 'head', bonus: 1, value: 400, art: 'canary', noAmbush: true,
    text: 'Канарейка чует неладное: засады монстров и газовые ловушки на тебя не срабатывают.' },
  { id: 'i_ushanka', deck: 'treasure', type: 'item', name: 'Ушанка-невидимка', slot: 'head', bonus: 1, value: 400, art: 'ushanka', runBonus: 2,
    text: 'Опустил уши — и тебя не видно. +2 к побегу.' },
  { id: 'i_crown', deck: 'treasure', type: 'item', name: 'Корона из пробок', slot: 'head', bonus: 3, value: 600, art: 'crown', rarity: 'rare',
    req: { notRace: 'dwarf' }, text: 'Не для гномов — давит на бороду.' },
  { id: 'i_quilt', deck: 'treasure', type: 'item', name: 'Ватник бронированный', slot: 'armor', bonus: 1, value: 200, copies: 2, art: 'jacket' },
  { id: 'i_tokens', deck: 'treasure', type: 'item', name: 'Кольчуга из жетонов', slot: 'armor', bonus: 2, value: 400, art: 'mail' },
  { id: 'i_diver', deck: 'treasure', type: 'item', name: 'Скафандр водолаза', slot: 'armor', bonus: 3, value: 600, big: true, art: 'diver', tags: ['water'],
    runBonus: -1, text: '−1 к побегу: в нём не побегаешь.' },
  { id: 'i_godarmor', deck: 'treasure', type: 'item', name: 'Доспехи Бога', slot: 'armor', bonus: 10, value: 0, art: 'godarmor',
    rarity: 'legendary', noSteal: true, req: { race: 'human', mix: true }, set: 'legend',
    text: 'Только человеку или со «Смешанной кровью». Не крадётся. Комплект «Легендарный».' },
  { id: 'i_ares', deck: 'treasure', type: 'item', name: 'Шлем Ареса', slot: 'head', bonus: 7, value: 0, art: 'ares',
    rarity: 'legendary', noSteal: true, req: { race: 'human', mix: true }, set: 'legend',
    text: 'Только человеку или со «Смешанной кровью». Не крадётся. Комплект «Легендарный».' },
  { id: 'i_overalls', deck: 'treasure', type: 'item', name: 'Роба шахтёра', slot: 'armor', bonus: 2, value: 400, art: 'overalls', set: 'miner',
    text: 'Брезент, лямки, карманы для всего. Комплект «Шахтёрский».' },
  { id: 'i_kingmail', deck: 'treasure', type: 'item', name: 'Кольчуга подгорного короля', slot: 'armor', bonus: 3, value: 600, art: 'kingmail', rarity: 'rare', set: 'king',
    text: 'Кольца выкованы в лаве. Комплект «Подгорного короля».' },
  { id: 'i_kingcrown', deck: 'treasure', type: 'item', name: 'Венец подгорного короля', slot: 'head', bonus: 3, value: 600, art: 'kingcrown', rarity: 'rare', set: 'king',
    text: 'Тяжёлый, как корона, и надёжный, как каска. Комплект «Подгорного короля».' },
  { id: 'i_ratcloak', deck: 'treasure', type: 'item', name: 'Плащ из крысиных шкур', slot: 'armor', bonus: 1, value: 400, art: 'ratcloak', calm: ['rat'],
    text: 'Пахнешь своим: крысы за тобой не гонятся.' },
  { id: 'i_firesuit', deck: 'treasure', type: 'item', name: 'Спецовка пожарного', slot: 'armor', bonus: 2, value: 500, art: 'firesuit', foeMod: { tag: 'fire', n: -4 },
    text: 'Огненные монстры против тебя −4.' },
  { id: 'i_trays', deck: 'treasure', type: 'item', name: 'Бронежилет из противней', slot: 'armor', bonus: 3, value: 400, art: 'trays', runBonus: -1,
    text: 'Гремит на всю штольню. −1 к побегу.' },
  { id: 'i_robe', deck: 'treasure', type: 'item', name: 'Мантия архивариуса', slot: 'armor', bonus: 3, value: 600, art: 'robe', rarity: 'rare',
    req: { cls: 'mage' }, text: 'Только для магов.' },
  { id: 'i_boots', deck: 'treasure', type: 'item', name: 'Резиновые сапоги', slot: 'feet', bonus: 1, value: 200, art: 'boots', tags: ['water'],
    text: 'Непромокаемые.' },
  { id: 'i_runners', deck: 'treasure', type: 'item', name: 'Кеды-драпалки', slot: 'feet', bonus: 0, value: 400, art: 'sneakers',
    runBonus: 2, text: '+2 к побегу.' },
  { id: 'i_slippers', deck: 'treasure', type: 'item', name: 'Тапки бесшумные', slot: 'feet', bonus: 1, value: 300, art: 'slippers',
    runBonus: 1, text: '+1 к побегу.' },
  { id: 'i_rollers', deck: 'treasure', type: 'item', name: 'Ролики с эскалатора', slot: 'feet', bonus: -1, value: 300, art: 'rollers', runBonus: 3,
    text: '−1 к силе, зато +3 к побегу.' },
  { id: 'i_valenki', deck: 'treasure', type: 'item', name: 'Валенки', slot: 'feet', bonus: 1, value: 200, art: 'valenki', locBonus: { loc: 'loc_ice', n: 3 },
    text: 'В Ледяной цитадели ещё +3.' },
  { id: 'i_waders', deck: 'treasure', type: 'item', name: 'Болотные сапоги', slot: 'feet', bonus: 1, value: 300, art: 'waders', foeMod: { tag: 'water', n: -3 }, tags: ['water'],
    text: 'Непромокаемые. Водные монстры против тебя −3.' },
  { id: 'i_epochboots', deck: 'treasure', type: 'item', name: 'Сапоги эпохи', slot: 'feet', bonus: 5, value: 0, art: 'epochboots',
    rarity: 'legendary', noSteal: true, req: { race: 'human', mix: true }, set: 'legend',
    text: 'Только человеку или со «Смешанной кровью». Не крадутся. Комплект «Легендарный».' },
  { id: 'i_shovel', deck: 'treasure', type: 'item', name: 'Совковая лопата', slot: 'hand', hands: 1, bonus: 2, value: 200, copies: 2, art: 'shovel' },
  { id: 'i_pick', deck: 'treasure', type: 'item', name: 'Кирка ударника', slot: 'hand', hands: 2, bonus: 3, value: 400, art: 'pick', set: 'miner',
    text: 'Комплект «Шахтёрский».' },
  { id: 'i_excalibur', deck: 'treasure', type: 'item', name: 'Меч Экскалибур', slot: 'hand', hands: 2, bonus: 7, value: 0, art: 'excalibur',
    rarity: 'legendary', noSteal: true, req: { race: 'human', mix: true }, set: 'legend',
    text: 'Только человеку или со «Смешанной кровью». Не крадётся. Комплект «Легендарный».' },
  { id: 'i_kinghammer', deck: 'treasure', type: 'item', name: 'Молот подгорного короля', slot: 'hand', hands: 1, bonus: 3, value: 600, art: 'kinghammer', rarity: 'rare', set: 'king',
    text: 'Бьёт, как обвал. Комплект «Подгорного короля».' },
  { id: 'i_jackhammer', deck: 'treasure', type: 'item', name: 'Отбойный молоток', slot: 'hand', hands: 2, bonus: 5, value: 800, big: true, art: 'hammer', rarity: 'rare' },
  { id: 'i_drill', deck: 'treasure', type: 'item', name: 'Перфоратор механика', slot: 'hand', hands: 3, bonus: 6, value: 800, big: true, art: 'drill', rarity: 'epic',
    req: { cls: 'engineer' }, text: 'Держится тремя руками — только для механиков.' },
  { id: 'i_hatch', deck: 'treasure', type: 'item', name: 'Щит из крышки люка', slot: 'hand', hands: 1, bonus: 2, value: 400, art: 'shield' },
  { id: 'i_stapler', deck: 'treasure', type: 'item', name: 'Арбалет-степлер', slot: 'hand', hands: 1, bonus: 3, value: 400, art: 'crossbow',
    req: { cls: 'rogue' }, text: 'Только для плутов.' },
  { id: 'i_censer', deck: 'treasure', type: 'item', name: 'Кадило с дымком', slot: 'hand', hands: 1, bonus: 3, value: 400, art: 'censer',
    req: { cls: 'cleric' }, text: 'Только для жрецов.' },
  { id: 'i_lute', deck: 'treasure', type: 'item', name: 'Лютня из таза', slot: 'hand', hands: 1, bonus: 3, value: 400, art: 'lute',
    req: { cls: 'bard' }, text: 'Только для бардов. Звенит на всю штольню.' },
  { id: 'i_rail', deck: 'treasure', type: 'item', name: 'Двуручная рельса', slot: 'hand', hands: 2, bonus: 4, value: 600, big: true, art: 'rail',
    req: { cls: 'warrior' }, text: 'Только для воинов.' },
  { id: 'i_staff', deck: 'treasure', type: 'item', name: 'Посох с фонариком', slot: 'hand', hands: 2, bonus: 4, value: 600, art: 'staff', tags: ['light'],
    req: { cls: 'mage' }, text: 'Только для магов. Источник света.' },
  { id: 'i_bow', deck: 'treasure', type: 'item', name: 'Лук с гирляндой', slot: 'hand', hands: 2, bonus: 4, value: 600, art: 'bow', tags: ['light'],
    req: { race: 'elf' }, text: 'Только для эльфов. Гирлянда светит.' },
  { id: 'i_knuckles', deck: 'treasure', type: 'item', name: 'Орочий кастет', slot: 'hand', hands: 1, bonus: 3, value: 400, art: 'knuckles',
    req: { race: 'orc' }, text: 'Только для орков.' },
  { id: 'i_claws', deck: 'treasure', type: 'item', name: 'Кротовые когти', slot: 'hand', hands: 2, bonus: 4, value: 600, art: 'claws',
    req: { race: 'molefolk' }, text: 'Только для кротолюдов.' },
  { id: 'i_samovar', deck: 'treasure', type: 'item', name: 'Огнемёт из самовара', slot: 'hand', hands: 2, bonus: 4, value: 600, big: true, art: 'samovar', rarity: 'rare',
    vsTag: { tag: 'insect', n: 3 }, text: 'Большая. Против насекомых ещё +3.' },
  { id: 'i_turnshield', deck: 'treasure', type: 'item', name: 'Щит-турникет', slot: 'hand', hands: 1, bonus: 3, value: 500, art: 'turnshield', noWandering: true,
    text: 'Пропускает строго по одному: в твой бой нельзя подкинуть монстра картой «Из темноты вылезло…».' },
  { id: 'i_kladenets', deck: 'treasure', type: 'item', name: 'Меч-кладенец с гонором', slot: 'hand', hands: 1, bonus: 6, value: 600, art: 'kladenets', rarity: 'rare', minFoe: 5,
    text: 'Проклятый: +6, но против монстров ниже 5-го уровня не помогает — гордый.' },
  { id: 'i_crowbar', deck: 'treasure', type: 'item', name: 'Фомка универсальная', slot: 'hand', hands: 1, bonus: 2, value: 300, art: 'crowbar' },
  { id: 'i_wrench', deck: 'treasure', type: 'item', name: 'Разводной ключ', slot: 'hand', hands: 1, bonus: 2, value: 300, art: 'wrench',
    clsBonus: { cls: 'engineer', n: 2 }, text: 'У механика +2 сверху.' },
  { id: 'i_extinguisher', deck: 'treasure', type: 'item', name: 'Огнетушитель', slot: 'hand', hands: 1, bonus: 2, value: 400, art: 'extinguisher', tags: ['water'],
    text: 'Тушит огненных монстров.' },
  { id: 'i_trap', deck: 'treasure', type: 'item', name: 'Крысоловка', slot: 'hand', hands: 1, bonus: 1, value: 300, art: 'trap',
    vsTag: { tag: 'rat', n: 5 }, text: 'Против крыс ещё +5.' },
  { id: 'i_flashlight', deck: 'treasure', type: 'item', name: 'Фонарик-жучок', slot: 'hand', hands: 1, bonus: 1, value: 200, art: 'flashlight', tags: ['light'],
    text: 'Источник света. Жужжит, если нажимать.' },
  { id: 'i_taser', deck: 'treasure', type: 'item', name: 'Шокер на батарейках', slot: 'hand', hands: 1, bonus: 3, value: 500, art: 'taser',
    req: { notRace: 'dwarf' }, text: 'Не для гномов — борода искрит.' },
  { id: 'i_ladle', deck: 'treasure', type: 'item', name: 'Боевой половник', slot: 'hand', hands: 1, bonus: 1, value: 100, art: 'ladle' },
  { id: 'i_charm', deck: 'treasure', type: 'item', name: 'Брелок на удачу', slot: 'none', bonus: 1, value: 300, art: 'charm' },
  { id: 'i_flasks', deck: 'treasure', type: 'item', name: 'Пояс с колбами', slot: 'none', bonus: 2, value: 400, art: 'flasks',
    req: { cls: 'alchemist' }, text: 'Только для алхимиков.' },
  { id: 'i_sack', deck: 'treasure', type: 'item', name: 'Гоблинский мешок', slot: 'none', bonus: 2, value: 300, art: 'sack',
    req: { race: 'goblin' }, text: 'Только для гоблинов. Внутри что-то шевелится.' },
  { id: 'i_trolley', deck: 'treasure', type: 'item', name: 'Тележка с булыжниками', slot: 'none', bonus: 3, value: 500, big: true, art: 'trolley',
    text: 'Большая. Возить можно, носить — нет.' },
  { id: 'i_ring', deck: 'treasure', type: 'item', name: 'Перстень гномьей силы', slot: 'none', bonus: 2, value: 400, art: 'ring',
    req: { race: 'dwarf' }, text: 'Только для гномов.' },

  // ───────────── КЛАД: ПИТОМЦЫ ─────────────
  // Один питомец. Если не убежали — питомец бросается на монстра и пропадает, а расплата вас не трогает.
  { id: 'p_rat', deck: 'treasure', type: 'item', slot: 'pet', name: 'Ручная крыса Шуша', bonus: 1, value: 200, art: 'pet_rat',
    text: 'Питомец. Спасёт от одной расплаты.' },
  { id: 'p_firefly', deck: 'treasure', type: 'item', slot: 'pet', name: 'Светлячок в банке', bonus: 1, value: 300, art: 'pet_firefly', tags: ['light'],
    text: 'Питомец и источник света. Спасёт от одной расплаты.' },
  { id: 'p_hamster', deck: 'treasure', type: 'item', slot: 'pet', name: 'Бойцовый хомяк', bonus: 2, value: 300, art: 'pet_hamster',
    text: 'Питомец. Спасёт от одной расплаты.' },
  { id: 'p_golddragon', deck: 'treasure', type: 'item', slot: 'pet', name: 'Золотой Дракон', bonus: 7, value: 0, art: 'pet_dragon',
    rarity: 'legendary', noSteal: true, petSave: false,
    text: 'Легендарный питомец. Плут его не украдёт. Драконы не жертвуют собой: от расплаты не спасает, зато и не улетает.' },
  { id: 'p_raven', deck: 'treasure', type: 'item', slot: 'pet', name: 'Ворон-разведчик', bonus: 1, value: 400, art: 'pet_raven', peek: true,
    text: 'Питомец. В твой ход ты видишь, что лежит за следующей дверью. Спасёт от одной расплаты.' },
  { id: 'p_owl', deck: 'treasure', type: 'item', slot: 'pet', name: 'Сова-проводница', bonus: 1, value: 300, art: 'pet_owl', runBonus: 2,
    text: 'Питомец. Знает обходные пути: +2 к побегу. Спасёт от одной расплаты.' },
  { id: 'p_roach', deck: 'treasure', type: 'item', slot: 'pet', name: 'Конь Плотва', bonus: 4, value: 600, art: 'pet_roach', rarity: 'epic',
    clsBonus: { cls: 'witcher', n: 2 }, text: 'Питомец. +4 к силе, а у ведьмака ещё +2. Спасёт от одной расплаты.' },
  { id: 'p_cat', deck: 'treasure', type: 'item', slot: 'pet', name: 'Кот-диггер', bonus: 2, value: 400, art: 'pet_cat', rarity: 'rare',
    vsTag: { tag: 'rat', n: 3 }, text: 'Питомец. Против крыс ещё +3. Спасёт от одной расплаты.' },

  // ───────────── КЛАД: СПУТНИКИ ─────────────
  // Спутник один: новый прогоняет старого. Играется в свой ход вне боя. Плут может сманить чужого.
  // handBonus — к пределу руки, bigBonus — ещё большие вещи, runBonus — к побегу, bonus — к силе, fee — плата в начале хода.
  { id: 'a_porter', deck: 'treasure', type: 'ally', name: 'Носильщик Савелий', value: 300, art: 'porter', handBonus: 2, bigBonus: 1,
    text: 'Спутник. +2 к пределу руки и ещё одна большая вещь. Носит за тебя вещи: оружие и броник, а повезёт — ещё и головняк. Их бонусы идут тебе.' },
  { id: 'a_guide', deck: 'treasure', type: 'ally', name: 'Проводник Митрич', value: 300, art: 'guide', runBonus: 2,
    text: 'Спутник. Знает все лазы: +2 к побегу. Носит за тебя вещи: оружие и броник, а повезёт — ещё и головняк. Их бонусы идут тебе.' },
  { id: 'a_merc', deck: 'treasure', type: 'ally', name: 'Наёмник Кондрат', value: 400, art: 'merc', bonus: 3, fee: 200, rarity: 'rare',
    text: 'Спутник. +3 к силе. Носит за тебя вещи: оружие и броник, а повезёт — ещё и головняк. В начале твоего хода плати 200 голдов из кошелька, а если их нет — карту ценой от 200 голдов из руки или запаса. Нечем платить — уходит, а вещи, что он носил, вернутся тебе.' },

  // ───────────── КЛАД: РАЗОВЫЕ ─────────────
  { id: 'o_pickles', deck: 'treasure', shop: 'food', type: 'oneshot', effect: 'bonus', bonus: 3, value: 100, copies: 2, art: 'jar',
    name: 'Банка маринованных грибов', text: 'Разовая. В любом бою: +3 любой стороне.' },
  { id: 'o_kvass', deck: 'treasure', shop: 'food', type: 'oneshot', effect: 'bonus', bonus: 2, value: 100, copies: 2, art: 'bottle',
    name: 'Квас «Богатырский»', text: 'Разовая. В любом бою: +2 любой стороне.' },
  { id: 'o_shawarma', deck: 'treasure', shop: 'food', type: 'oneshot', effect: 'bonus', bonus: 5, value: 300, art: 'wrap', rarity: 'rare',
    name: 'Огненная шаурма', text: 'Разовая. В любом бою: +5 любой стороне.' },
  { id: 'o_cola', deck: 'treasure', shop: 'food', type: 'oneshot', effect: 'bonus', bonus: 3, value: 200, art: 'can',
    name: 'Ледяная газировка', text: 'Разовая. В любом бою: +3 любой стороне.' },
  { id: 'o_firecracker', deck: 'treasure', shop: 'gear', type: 'oneshot', effect: 'bonus', bonus: 4, value: 300, art: 'boom',
    name: 'Петарда «Ракета»', text: 'Разовая. В любом бою: +4 любой стороне.' },
  { id: 'o_holywater', short: 'В бою +2 любой стороне, героям против нежити +8.', deck: 'treasure', shop: 'potion', type: 'oneshot', effect: 'bonus', bonus: 2, value: 300, copies: 2, art: 'holywater',
    tagBonus: { tag: 'undead', n: 6 },
    name: 'Святая вода', text: 'Разовая. +2 любой стороне, а героям против нежити — +8.' },
  { id: 'o_rope', short: 'Участнику боя +3 к побегу в этом бою.', deck: 'treasure', shop: 'gear', type: 'oneshot', effect: 'escapeBonus', bonus: 3, value: 200, art: 'rope',
    name: 'Верёвка с кошкой', text: 'Разовая. Участник боя: +3 к побегу в этом бою.' },
  { id: 'o_smoke', short: 'В бою: все герои сбегают без расплаты и без наград.', deck: 'treasure', shop: 'gear', type: 'oneshot', effect: 'escape', value: 200, copies: 2, art: 'smoke',
    name: 'Дымовая шашка', text: 'Разовая. Участник боя: все герои сбегают без расплаты и без наград.' },
  { id: 'o_petrify', short: 'В бою убирает одного монстра. Ни уровня, ни клада за него.', deck: 'treasure', shop: 'magic', type: 'oneshot', effect: 'remove', value: 300, copies: 2, art: 'scroll', rarity: 'rare',
    name: 'Свиток окаменения', text: 'Разовая. В любом бою: убери одного монстра. Ни уровня, ни клада за него.' },
  { id: 'o_slave', short: 'В своём бою: любой игрок обязан тебе помогать, без доли клада.', deck: 'treasure', shop: 'magic', type: 'oneshot', effect: 'enslave', value: 300, price: 1000, copies: 3, art: 'shackles', rarity: 'rare',
    name: 'Ты мой раб', text: 'Сыграй в своём бою: выбери любого игрока — он обязан вступить в бой на твоей стороне. Отказаться нельзя, клада ему не положено.' },
  { id: 'o_ward', short: 'Лежит в руке и гасит первое проклятие на тебя.', deck: 'treasure', shop: 'magic', type: 'oneshot', effect: 'ward', value: 300, copies: 2, art: 'amulet',
    name: 'Куриный бог', text: 'Держи в руке: первое проклятие на тебя срабатывает впустую, а камушек уходит в сброс.' },

  // ───────────── КЛАД: БАФФЫ ─────────────
  // Играются когда угодно на себя: сила добавляется в текущем бою или в следующем.
  { id: 'b_courage', deck: 'treasure', shop: 'potion', type: 'buff', name: 'Зелье храбрости', bonus: 3, value: 200, art: 'potion',
    text: '+3 к силе в этом или следующем бою.' },
  { id: 'b_energy', deck: 'treasure', shop: 'food', type: 'buff', name: 'Энергетик «Забой»', bonus: 2, value: 100, copies: 2, art: 'energy',
    text: '+2 к силе в этом или следующем бою.' },
  { id: 'b_pies', short: '+4 к силе в этом или следующем бою.', deck: 'treasure', shop: 'food', type: 'buff', name: 'Бабушкины пирожки', bonus: 4, value: 300, art: 'pies', rarity: 'rare',
    text: '+4 к силе в этом или следующем бою. С капустой.' },

  // ───────────── КЛАД: УРОВНИ И ПРОЧЕЕ ─────────────
  { id: 'l_stash', deck: 'treasure', type: 'levelup', name: 'Нашёл заначку', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_bribe', deck: 'treasure', type: 'levelup', name: 'Подкупил смотрителя', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_manual', deck: 'treasure', type: 'levelup', name: 'Прочитал инструкцию', art: 'up', text: 'Получи уровень. Не {win}-й. Никто так не делает.' },
  { id: 'l_sleep', deck: 'treasure', type: 'levelup', name: 'Выспался', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_exam', deck: 'treasure', type: 'levelup', name: 'Сдал зачёт по спелеологии', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_friend', deck: 'treasure', type: 'levelup', name: 'Знакомый диггер', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_map', deck: 'treasure', type: 'levelup', name: 'Карта с крестиком', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_bonus', deck: 'treasure', type: 'levelup', name: 'Премия за вредность', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'l_shortcut', deck: 'treasure', type: 'levelup', name: 'Короткий путь', art: 'up', text: 'Получи уровень. Не {win}-й.' },
  { id: 'g_atlantis', deck: 'treasure', type: 'jackpot', name: 'Сокровища Атлантиды', gold: 3000, art: 'atlantis', rarity: 'legendary', emoji: '🔱',
    text: 'Открой в любой момент: +3000 голдов в кошелёк.' },
  { id: 'g_deadchest', deck: 'treasure', type: 'jackpot', name: 'Сундук мертвеца', gold: 3000, art: 'deadchest', rarity: 'epic', emoji: '☠️',
    text: 'Открой в любой момент: +3000 голдов в кошелёк.' },
  { id: 'h_hoard', deck: 'treasure', type: 'hoard', name: 'Схрон!', copies: 2, art: 'chest', rarity: 'rare',
    text: 'Сыграй в свой ход вне боя: возьми 2 карты клада. Не больше одного схрона за ход.' },
];

for (const d of CARD_DEFS) if (d.type === 'location' && d.prices) d.text = `${d.text} ${priceSummary(d.prices)}`;
// Убранные из игры карты: в колоду, на рынок и в справочник не попадают, но их помнят старые сохранения.
// «Прощай навсегда» убрана 2026-10-28.
const RETIRED_DEFS = [
  // была: жертва выбывает из партии, пока кто-нибудь не откроет Ящик Пандоры. Из двери не срабатывает на того,
  // кто её выбил, — такое проклятие слишком ценно: оно уходит в руку. На рынке — около 3000 голдов (цену меняет локация).
  { id: 'k_farewell', short: 'Жертва теряет всё и выбывает. Вернёт только Ящик Пандоры.', deck: 'door', type: 'curse', name: 'Проклятие: Прощай навсегда', copies: 1, art: 'farewell', rarity: 'epic', bg: 'dark',
    price: 3000, keep: true, fx: [{ k: 'farewell' }],
    text: 'Жертва погибает: теряет все вещи, карты, питомца, спутника и уровни (остаётся 1-й) и выбывает из партии. Вернуть её может только открытый Ящик Пандоры.' },
];
export const DEFS = Object.fromEntries([...CARD_DEFS, ...RETIRED_DEFS].map(d => [d.id, d]));
// что продаётся на рынке: разовые, зелья, проклятия и «Получи уровень»
export const SHOP_IDS = CARD_DEFS.filter(d => shopCat(d)).map(d => d.id);

// Тексты некоторых карт зависят от длины партии: {win} — уровень победы, {lux} — порог «налога на роскошь».
// В браузере идёт одна партия, поэтому значения хранятся глобально; сервер подставляет их сам для каждой партии.
export const RULE_VARS = { win: 10, lux: 7 };
export const setRuleVars = v => Object.assign(RULE_VARS, v);
export const ruleText = (t, vars = RULE_VARS) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

export function def(uid) {
  const d = DEFS[String(uid).split('#')[0]];
  if (!d) throw new Error('Unknown card ' + uid);
  return d;
}

export function allUids(deck) {
  const out = [];
  for (const d of CARD_DEFS) {
    if (d.deck !== deck) continue;
    for (let i = 0; i < (d.copies || 1); i++) out.push(`${d.id}#${i}`);
  }
  return out;
}

export const RACE_NAMES = { elf: 'Эльф', dwarf: 'Гном', halfling: 'Полурослик', orc: 'Орк', goblin: 'Гоблин', molefolk: 'Кротолюд', human: 'Человек' };
export const CLASS_NAMES = { warrior: 'Воин', mage: 'Маг', cleric: 'Жрец', rogue: 'Плут', bard: 'Бард', alchemist: 'Алхимик', engineer: 'Механик', witcher: 'Ведьмак', warlock: 'Чернокнижник' };
export const SLOT_NAMES = { head: 'Головняк', armor: 'Броник', feet: 'Обувка', hand: 'В руки', none: 'Прочее', pet: 'Питомец' };
export const TAG_NAMES = { undead: 'нежить', rat: 'крыса', fungus: 'гриб', water: 'водный', fire: 'огненный', insect: 'насекомое', metro: 'житель метро', rock: 'каменный',
  beast: 'зверь', machine: 'механизм', gas: 'газ' };
