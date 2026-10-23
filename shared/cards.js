// «Под Землёй» — оригинальная колода.
// Все названия, тексты и шутки придуманы для этой игры.
// Поля:
//  deck: 'door' (Проходы) | 'treasure' (Клад)
//  type: monster | curse | race | class | halfbreed | supermunch | enhancer | wandering
//        item | oneshot | levelup | hoard
//  copies: сколько экземпляров в колоде

const M = (id, name, level, treasures, extra = {}) => ({
  id, deck: 'door', type: 'monster', name, level, treasures, levels: 1, copies: 1, ...extra,
});

export const CARD_DEFS = [
  // ───────────── РАСЫ ─────────────
  { id: 'r_elf', deck: 'door', type: 'race', race: 'elf', name: 'Эльф', copies: 3, art: 'elf',
    text: '+1 к побегу. Получаешь уровень за каждого монстра, которого помог убить другому.' },
  { id: 'r_dwarf', deck: 'door', type: 'race', race: 'dwarf', name: 'Гном', copies: 3, art: 'dwarf',
    text: 'Носишь сколько угодно больших вещей. В руке можно держать 6 карт.' },
  { id: 'r_halfling', deck: 'door', type: 'race', race: 'halfling', name: 'Полурослик', copies: 3, art: 'halfling',
    text: 'Раз в ход продаёшь одну вещь вдвое дороже. Провалив побег, можешь сбросить карту и бросить ещё раз.' },

  // ───────────── КЛАССЫ ─────────────
  { id: 'c_warrior', deck: 'door', type: 'class', cls: 'warrior', name: 'Воин', copies: 3, art: 'warrior',
    text: 'Ярость: в бою сбрось до 3 карт, +1 за каждую. Ничья в бою — твоя победа.' },
  { id: 'c_mage', deck: 'door', type: 'class', cls: 'mage', name: 'Маг', copies: 3, art: 'mage',
    text: 'Чары: сбрось всю руку (от 3 карт) и усыпи монстра — его клад твой, но без уровня. Левитация: до 3 карт, +1 к побегу за каждую.' },
  { id: 'c_cleric', deck: 'door', type: 'class', cls: 'cleric', name: 'Жрец', copies: 3, art: 'cleric',
    text: 'Изгнание: против нежити сбрось до 3 карт, +3 за каждую. Проклятие на тебя срывается на броске 5–6.' },
  { id: 'c_rogue', deck: 'door', type: 'class', cls: 'rogue', name: 'Плут', copies: 3, art: 'rogue',
    text: 'Удар в спину: сбрось карту — участник боя получает −2. Карманник: сбрось карту и выброси 4+, чтобы стащить мелкую вещь. Провал — минус уровень.' },

  { id: 'x_halfbreed', deck: 'door', type: 'halfbreed', name: 'Смешанная кровь', copies: 2, art: 'mix',
    text: 'Можешь иметь две расы сразу и пользоваться обеими.' },
  { id: 'x_super', deck: 'door', type: 'supermunch', name: 'Совместитель', copies: 2, art: 'badge',
    text: 'Можешь иметь два класса сразу. Две зарплаты, одна жизнь.' },

  // ───────────── МОНСТРЫ ─────────────
  M('m_floorboard', 'Скрипучая половица', 1, 1, {
    copies: 2, art: { body: 'plank', hue: 30 },
    text: 'Эльфам +1 клад: они ступают так тихо, что половица теряется.', bonusTreasureVs: { race: 'elf', n: 1 },
    bad: { text: 'Скрипит так, что стыдно. Ничего не теряешь.', fx: [{ k: 'nothing' }] } }),
  M('m_mold', 'Сырная плесень', 1, 1, {
    art: { body: 'blob', hue: 70 },
    bad: { text: 'Въелась в подошвы. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_mosquito', 'Комар из вентиляции', 2, 1, {
    art: { body: 'bug', hue: 200 },
    bad: { text: 'Звенел всю ночь. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_roach', 'Таракан-качок', 2, 1, {
    copies: 2, art: { body: 'bug', hue: 20 },
    bad: { text: 'Отжал у тебя вещь. Теряешь мелкую вещь.', fx: [{ k: 'smallItem' }] } }),
  M('m_mole', 'Крот-бухгалтер', 3, 1, {
    art: { body: 'round', hue: 15 }, vs: [{ cls: 'rogue', n: 3, text: '+3 против плутов — у него всё посчитано' }],
    bad: { text: 'Выставил счёт. Сбрось 2 карты с руки.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_turnstile', 'Голодный турникет', 3, 1, {
    art: { body: 'box', hue: 0 },
    bad: { text: 'Не пропустил и зажевал. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_robovac', 'Ржавый робот-пылесос', 4, 2, {
    art: { body: 'disc', hue: 190 },
    bad: { text: 'Всосал всё мелкое. Теряешь мелкую вещь.', fx: [{ k: 'smallItem' }] } }),
  M('m_duck', 'Канализационная утка', 4, 2, {
    art: { body: 'bird', hue: 55 }, noPursue: 2,
    text: 'Не гонится за теми, у кого 2-й уровень или ниже.',
    bad: { text: 'Утащила шапку в гнездо. Теряешь головняк.', fx: [{ k: 'slot', slot: 'head' }] } }),
  M('m_gossip', 'Сталактит-сплетник', 5, 2, {
    art: { body: 'spike', hue: 260 },
    bad: { text: 'Рассказал всем твои секреты. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_mycel', 'Грибница-сплетница', 5, 2, {
    art: { body: 'shroom', hue: 300 }, vs: [{ race: 'elf', n: -2, text: '−2 против эльфов: они её не слушают' }],
    bad: { text: 'Опутала руку. Сбрось все карты с руки.', fx: [{ k: 'hand' }] } }),
  M('m_lasttrain', 'Призрак последней электрички', 6, 2, {
    art: { body: 'ghost', hue: 180 }, undead: true,
    bad: { text: 'Увёз в депо. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_inspector', 'Скелет-контролёр', 6, 2, {
    art: { body: 'skull', hue: 45 }, undead: true, vs: [{ race: 'halfling', n: 3, text: '+3 против полуросликов — ловит безбилетников' }],
    bad: { text: 'Выписал штраф. Теряешь броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),
  M('m_slug', 'Слизень-коллектор', 7, 2, {
    art: { body: 'blob', hue: 110 }, vs: [{ race: 'dwarf', n: 4, text: '+4 против гномов — у них долги по ипотеке шахты' }],
    bad: { text: 'Взыскал. −1 уровень и сбрось 2 карты.', fx: [{ k: 'levels', n: 1 }, { k: 'cards', n: 2 }] } }),
  M('m_cart', 'Вагонетка-оборотень', 7, 2, {
    art: { body: 'box', hue: 25 },
    bad: { text: 'Переехала. Теряешь большую вещь.', fx: [{ k: 'slot', slot: 'big' }] } }),
  M('m_dj', 'Двухголовая крыса-диджей', 8, 2, {
    art: { body: 'round', hue: 330, heads: 2 },
    bad: { text: 'Басы сорвали с тебя всё лишнее. Теряешь головняк и обувку.', fx: [{ k: 'slot', slot: 'head' }, { k: 'slot', slot: 'feet' }] } }),
  M('m_plumber', 'Мумия сантехника', 8, 2, {
    art: { body: 'ghost', hue: 40 }, undead: true,
    bad: { text: 'Перекрыла стояк. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_banshee', 'Банши из бойлерной', 9, 2, {
    art: { body: 'ghost', hue: 280 }, undead: true,
    bad: { text: 'Перекричала тебя. Теряешь класс.', fx: [{ k: 'class' }] } }),
  M('m_zhek', 'Подземный ЖЭК', 10, 3, {
    art: { body: 'box', hue: 210 },
    bad: { text: 'Предписание об изъятии. Теряешь броник и 1 уровень.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'levels', n: 1 }] } }),
  M('m_minotaur', 'Минотавр-экскурсовод', 10, 3, {
    art: { body: 'horned', hue: 15 }, vs: [{ cls: 'mage', n: 5, text: '+5 против магов — он слышал все фокусы' }],
    bad: { text: 'Водил по лабиринту три часа. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_spider', 'Паук-вязальщица', 11, 3, {
    art: { body: 'spider', hue: 0 },
    bad: { text: 'Связала тебе новую личность. Теряешь расу.', fx: [{ k: 'race' }] } }),
  M('m_golem', 'Каменный голем-вахтёр', 12, 3, {
    art: { body: 'box', hue: 0, sat: 5 }, noPursue: 4,
    text: 'Не гонится за 4-м уровнем и ниже: «Детям можно».',
    bad: { text: '«Посторонним вход воспрещён!» −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_worm', 'Червь-метростроевец', 12, 3, {
    art: { body: 'worm', hue: 350 },
    bad: { text: 'Прорыл тоннель через твою экипировку. Теряешь всё, что в руках.', fx: [{ k: 'slot', slot: 'hands' }] } }),
  M('m_vampire', 'Вампир-ростовщик', 14, 4, {
    art: { body: 'bat', hue: 340 }, undead: true,
    bad: { text: 'Проценты выросли. Теряешь 2 самые ценные вещи.', fx: [{ k: 'bestItems', n: 2 }] } }),
  M('m_heatpipe', 'Змей теплотрассы', 14, 4, {
    art: { body: 'worm', hue: 18 }, levels: 2,
    bad: { text: 'Горячий приём. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_lich', 'Лич из архива', 15, 4, {
    art: { body: 'skull', hue: 150 }, undead: true, vs: [{ cls: 'cleric', n: 4, text: '+4 против жрецов — у него справка' }],
    bad: { text: 'Сдал тебя в архив. −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_ratqueen', 'Королева пещерных крыс', 16, 4, {
    art: { body: 'round', hue: 300, crown: true }, levels: 2,
    bad: { text: 'Свита отобрала всё. −2 уровня и сбрось руку.', fx: [{ k: 'levels', n: 2 }, { k: 'hand' }] } }),
  M('m_troll', 'Тролль-налоговик', 16, 4, {
    art: { body: 'horned', hue: 120 }, levels: 2,
    bad: { text: 'Налог на всё. Теряешь все вещи.', fx: [{ k: 'allItems' }] } }),
  M('m_dragon', 'Дракон из-под моста', 18, 5, {
    art: { body: 'dragon', hue: 0 }, levels: 2, noPursue: 5,
    text: 'Не гонится за 5-м уровнем и ниже: мелочь не жуёт.',
    bad: { text: 'Поджарил. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_pit', 'Бездонная яма с зубами', 19, 5, {
    art: { body: 'pit', hue: 270 }, levels: 2,
    bad: { text: 'Дна действительно нет. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_molekron', 'Древний Кротокрон', 20, 5, {
    art: { body: 'round', hue: 25, crown: true, heads: 3 }, levels: 2, noPursue: 5,
    text: 'Не гонится за 5-м уровнем и ниже.',
    bad: { text: 'Закопал на тысячу лет. Ты погибаешь.', fx: [{ k: 'death' }] } }),

  // ───────────── ПРОКЛЯТИЯ ─────────────
  { id: 'k_draft', deck: 'door', type: 'curse', name: 'Проклятие: Сквозняк', copies: 2, art: 'wind',
    text: 'Сдуло шапку. Жертва теряет головняк.', fx: [{ k: 'slot', slot: 'head' }] },
  { id: 'k_cavein', deck: 'door', type: 'curse', name: 'Проклятие: Обвал свода', copies: 1, art: 'rocks',
    text: 'Жертва теряет броник.', fx: [{ k: 'slot', slot: 'armor' }] },
  { id: 'k_puddle', deck: 'door', type: 'curse', name: 'Проклятие: Лужа по колено', copies: 1, art: 'puddle',
    text: 'Жертва теряет обувку.', fx: [{ k: 'slot', slot: 'feet' }] },
  { id: 'k_rust', deck: 'door', type: 'curse', name: 'Проклятие: Ржавчина', copies: 1, art: 'rust',
    text: 'Жертва теряет случайную мелкую вещь.', fx: [{ k: 'smallItem' }] },
  { id: 'k_tax', deck: 'door', type: 'curse', name: 'Проклятие: Налоговая проверка', copies: 2, art: 'paper',
    text: 'Жертва теряет уровень.', fx: [{ k: 'levels', n: 1 }] },
  { id: 'k_amnesia', deck: 'door', type: 'curse', name: 'Проклятие: Забыл, кто ты', copies: 1, art: 'question',
    text: 'Жертва теряет расу.', fx: [{ k: 'race' }] },
  { id: 'k_fired', deck: 'door', type: 'curse', name: 'Проклятие: Уволен', copies: 1, art: 'paper',
    text: 'Жертва теряет класс.', fx: [{ k: 'class' }] },
  { id: 'k_pickpocket', deck: 'door', type: 'curse', name: 'Проклятие: Карманники в метро', copies: 1, art: 'hand',
    text: 'Жертва сбрасывает 2 случайные карты с руки.', fx: [{ k: 'cards', n: 2 }] },
  { id: 'k_flu', deck: 'door', type: 'curse', name: 'Проклятие: Подземный насморк', copies: 2, art: 'drop',
    text: 'Жертва получает −3 в следующем бою (или в текущем).', fx: [{ k: 'nextCombat', n: -3 }] },
  { id: 'k_jinx', deck: 'door', type: 'curse', name: 'Проклятие: Сглаз на вещи', copies: 1, art: 'eye',
    text: 'Жертва теряет самую ценную вещь.', fx: [{ k: 'bestItems', n: 1 }] },

  // ───────────── УСИЛИТЕЛИ МОНСТРОВ ─────────────
  { id: 'e_seasoned', deck: 'door', type: 'enhancer', name: 'Матёрый', copies: 2, bonus: 5, treasureDelta: 1, art: 'up',
    text: '+5 к монстру и +1 клад.' },
  { id: 'e_hungry', deck: 'door', type: 'enhancer', name: 'Голодный', copies: 1, bonus: 10, treasureDelta: 2, art: 'up2',
    text: '+10 к монстру и +2 клада.' },
  { id: 'e_morning', deck: 'door', type: 'enhancer', name: 'Злой с утра', copies: 2, bonus: 3, treasureDelta: 1, art: 'up',
    text: '+3 к монстру и +1 клад. Не выспался.' },
  { id: 'e_baby', deck: 'door', type: 'enhancer', name: 'Детёныш', copies: 2, bonus: -5, treasureDelta: -1, art: 'down',
    text: '−5 к монстру и −1 клад.' },
  { id: 'e_cold', deck: 'door', type: 'enhancer', name: 'Простуженный', copies: 1, bonus: -3, treasureDelta: -1, art: 'down',
    text: '−3 к монстру и −1 клад. Чихает.' },

  { id: 'w_wandering', deck: 'door', type: 'wandering', name: 'Из темноты вылезло…', copies: 3, art: 'eyes',
    text: 'Сыграй вместе с монстром из руки: он вступает в чужой бой на стороне подземелья.' },

  // ───────────── КЛАД: ВЕЩИ ─────────────
  // slot: head | armor | feet | hand | none ; hands: 1|2 ; big
  { id: 'i_helmet', deck: 'treasure', type: 'item', name: 'Каска шахтёра', slot: 'head', bonus: 1, value: 200, copies: 2, art: 'helmet' },
  { id: 'i_headlamp', deck: 'treasure', type: 'item', name: 'Налобный фонарь', slot: 'head', bonus: 2, value: 400, art: 'lamp',
    text: 'Светит в глаза монстрам.' },
  { id: 'i_crown', deck: 'treasure', type: 'item', name: 'Корона из пробок', slot: 'head', bonus: 3, value: 600, art: 'crown',
    req: { notRace: 'dwarf' }, text: 'Не для гномов — давит на бороду.' },
  { id: 'i_quilt', deck: 'treasure', type: 'item', name: 'Ватник бронированный', slot: 'armor', bonus: 1, value: 200, copies: 2, art: 'jacket' },
  { id: 'i_tokens', deck: 'treasure', type: 'item', name: 'Кольчуга из жетонов метро', slot: 'armor', bonus: 2, value: 400, art: 'mail' },
  { id: 'i_diver', deck: 'treasure', type: 'item', name: 'Скафандр водолаза', slot: 'armor', bonus: 3, value: 600, big: true, art: 'diver',
    runBonus: -1, text: '−1 к побегу: в нём не побегаешь.' },
  { id: 'i_robe', deck: 'treasure', type: 'item', name: 'Мантия архивариуса', slot: 'armor', bonus: 3, value: 600, art: 'robe',
    req: { cls: 'mage' }, text: 'Только для магов.' },
  { id: 'i_boots', deck: 'treasure', type: 'item', name: 'Резиновые сапоги', slot: 'feet', bonus: 1, value: 200, art: 'boots' },
  { id: 'i_runners', deck: 'treasure', type: 'item', name: 'Кеды-драпалки', slot: 'feet', bonus: 0, value: 400, art: 'sneakers',
    runBonus: 2, text: '+2 к побегу.' },
  { id: 'i_slippers', deck: 'treasure', type: 'item', name: 'Тапки бесшумные', slot: 'feet', bonus: 1, value: 300, art: 'slippers',
    runBonus: 1, text: '+1 к побегу.' },
  { id: 'i_shovel', deck: 'treasure', type: 'item', name: 'Совковая лопата', slot: 'hand', hands: 1, bonus: 2, value: 200, copies: 2, art: 'shovel' },
  { id: 'i_pick', deck: 'treasure', type: 'item', name: 'Кирка ударника', slot: 'hand', hands: 2, bonus: 3, value: 400, art: 'pick' },
  { id: 'i_jackhammer', deck: 'treasure', type: 'item', name: 'Отбойный молоток', slot: 'hand', hands: 2, bonus: 5, value: 800, big: true, art: 'hammer' },
  { id: 'i_hatch', deck: 'treasure', type: 'item', name: 'Щит из крышки люка', slot: 'hand', hands: 1, bonus: 2, value: 400, art: 'shield' },
  { id: 'i_stapler', deck: 'treasure', type: 'item', name: 'Арбалет-степлер', slot: 'hand', hands: 1, bonus: 3, value: 400, art: 'crossbow',
    req: { cls: 'rogue' }, text: 'Только для плутов.' },
  { id: 'i_censer', deck: 'treasure', type: 'item', name: 'Кадило с дымком', slot: 'hand', hands: 1, bonus: 3, value: 400, art: 'censer',
    req: { cls: 'cleric' }, text: 'Только для жрецов.' },
  { id: 'i_rail', deck: 'treasure', type: 'item', name: 'Двуручная рельса', slot: 'hand', hands: 2, bonus: 4, value: 600, big: true, art: 'rail',
    req: { cls: 'warrior' }, text: 'Только для воинов.' },
  { id: 'i_staff', deck: 'treasure', type: 'item', name: 'Посох с фонариком', slot: 'hand', hands: 2, bonus: 4, value: 600, art: 'staff',
    req: { cls: 'mage' }, text: 'Только для магов.' },
  { id: 'i_bow', deck: 'treasure', type: 'item', name: 'Лук с гирляндой', slot: 'hand', hands: 2, bonus: 4, value: 600, art: 'bow',
    req: { race: 'elf' }, text: 'Только для эльфов.' },
  { id: 'i_crowbar', deck: 'treasure', type: 'item', name: 'Фомка универсальная', slot: 'hand', hands: 1, bonus: 2, value: 300, art: 'crowbar' },
  { id: 'i_taser', deck: 'treasure', type: 'item', name: 'Шокер на батарейках', slot: 'hand', hands: 1, bonus: 3, value: 500, art: 'taser',
    req: { notRace: 'dwarf' }, text: 'Не для гномов — борода искрит.' },
  { id: 'i_ladle', deck: 'treasure', type: 'item', name: 'Боевой половник', slot: 'hand', hands: 1, bonus: 1, value: 100, art: 'ladle' },
  { id: 'i_charm', deck: 'treasure', type: 'item', name: 'Брелок на удачу', slot: 'none', bonus: 1, value: 300, art: 'charm' },
  { id: 'i_trolley', deck: 'treasure', type: 'item', name: 'Тележка с булыжниками', slot: 'none', bonus: 3, value: 500, big: true, art: 'trolley',
    text: 'Большая. Возить можно, носить — нет.' },
  { id: 'i_ring', deck: 'treasure', type: 'item', name: 'Перстень гномьей силы', slot: 'none', bonus: 2, value: 400, art: 'ring',
    req: { race: 'dwarf' }, text: 'Только для гномов.' },

  // ───────────── КЛАД: РАЗОВЫЕ ─────────────
  { id: 'o_pickles', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 3, value: 100, copies: 2, art: 'jar',
    name: 'Банка маринованных грибов', text: 'Разовая. В любом бою: +3 любой стороне.' },
  { id: 'o_kvass', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 2, value: 100, copies: 2, art: 'bottle',
    name: 'Квас «Богатырский»', text: 'Разовая. В любом бою: +2 любой стороне.' },
  { id: 'o_shawarma', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 5, value: 300, art: 'wrap',
    name: 'Огненная шаурма', text: 'Разовая. В любом бою: +5 любой стороне.' },
  { id: 'o_cola', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 3, value: 200, art: 'can',
    name: 'Ледяная газировка', text: 'Разовая. В любом бою: +3 любой стороне.' },
  { id: 'o_firecracker', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 4, value: 300, art: 'boom',
    name: 'Петарда «Ракета»', text: 'Разовая. В любом бою: +4 любой стороне.' },
  { id: 'o_smoke', deck: 'treasure', type: 'oneshot', effect: 'escape', value: 200, copies: 2, art: 'smoke',
    name: 'Дымовая шашка', text: 'Разовая. Участник боя: все герои сбегают без расплаты и без наград.' },
  { id: 'o_petrify', deck: 'treasure', type: 'oneshot', effect: 'remove', value: 300, copies: 2, art: 'scroll',
    name: 'Свиток окаменения', text: 'Разовая. В любом бою: убери одного монстра. Ни уровня, ни клада за него.' },
  { id: 'o_ward', deck: 'treasure', type: 'oneshot', effect: 'ward', value: 300, copies: 2, art: 'amulet',
    name: 'Куриный бог', text: 'Держи в руке: первое проклятие на тебя срабатывает впустую, а камушек уходит в сброс.' },

  // ───────────── КЛАД: УРОВНИ И ПРОЧЕЕ ─────────────
  { id: 'l_stash', deck: 'treasure', type: 'levelup', name: 'Нашёл заначку', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_bribe', deck: 'treasure', type: 'levelup', name: 'Подкупил смотрителя', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_manual', deck: 'treasure', type: 'levelup', name: 'Прочитал инструкцию', art: 'up', text: 'Получи уровень. Не 10-й. Никто так не делает.' },
  { id: 'l_sleep', deck: 'treasure', type: 'levelup', name: 'Выспался', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_exam', deck: 'treasure', type: 'levelup', name: 'Сдал зачёт по спелеологии', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_friend', deck: 'treasure', type: 'levelup', name: 'Знакомый диггер', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_map', deck: 'treasure', type: 'levelup', name: 'Карта с крестиком', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'h_hoard', deck: 'treasure', type: 'hoard', name: 'Схрон!', copies: 2, art: 'chest',
    text: 'Сыграй в свой ход вне боя: возьми 2 карты клада. Не больше одного схрона за ход.' },
];

export const DEFS = Object.fromEntries(CARD_DEFS.map(d => [d.id, d]));

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

export const RACE_NAMES = { elf: 'Эльф', dwarf: 'Гном', halfling: 'Полурослик', human: 'Человек' };
export const CLASS_NAMES = { warrior: 'Воин', mage: 'Маг', cleric: 'Жрец', rogue: 'Плут' };
export const SLOT_NAMES = { head: 'Головняк', armor: 'Броник', feet: 'Обувка', hand: 'В руки', none: 'Прочее' };
