// «Под Землёй» — оригинальная колода.
// Все названия, тексты и шутки придуманы для этой игры.
// Поля:
//  deck: 'door' (Проходы) | 'treasure' (Клад)
//  type: monster | curse | race | class | halfbreed | supermunch | enhancer | wandering | location | event
//        item | oneshot | buff | levelup | hoard
//  copies: сколько экземпляров в колоде
//  rarity: common | rare | epic — влияет только на рамку и блеск карты
//
// Особенности монстров:
//  tags: ['undead','rat','fungus','water','fire','insect','metro','rock']
//  vs: [{cls|race, n, text}] — бонус против класса или расы
//  vsItem: [{tag, n, text}] — бонус/штраф, если у героя надета вещь с тегом (свет, вода)
//  soloBonus — сильнее против одиночки; noHelp — звать на помощь нельзя
//  escape:false — убежать нельзя; escapeMod — поправка к побегу; noPursue — не гонится за низкими уровнями
//  ambush — эффект при встрече; mirror — сила = уровень лидера + mirror
//  art — параметры рисунка: body, hue, props, eyes, mouth, pattern, heads, crown

const M = (id, name, level, treasures, extra = {}) => ({
  id, deck: 'door', type: 'monster', name, level, treasures, levels: 1, copies: 1,
  rarity: level >= 15 ? 'epic' : level >= 10 ? 'rare' : 'common', ...extra,
});
const RACE = (id, race, name, copies, text) => ({ id, deck: 'door', type: 'race', race, name, copies, art: race, text, rarity: 'rare' });
const CLS = (id, cls, name, copies, text) => ({ id, deck: 'door', type: 'class', cls, name, copies, art: cls, text, rarity: 'rare' });

export const CARD_DEFS = [
  // ───────────── РАСЫ ─────────────
  RACE('r_elf', 'elf', 'Эльф', 3, '+1 к побегу. Получаешь уровень за каждого монстра, которого помог убить другому.'),
  RACE('r_dwarf', 'dwarf', 'Гном', 3, 'Носишь сколько угодно больших вещей. В руке можно держать 6 карт.'),
  RACE('r_halfling', 'halfling', 'Полурослик', 2, 'Раз в ход продаёшь одну вещь вдвое дороже. Провалив побег, можешь сбросить карту и бросить ещё раз.'),
  RACE('r_orc', 'orc', 'Орк', 2, 'Крепкий лоб: +2 к силе, пока не надет головняк. За победу над монстром 10+ уровня — ещё карта клада.'),
  RACE('r_goblin', 'goblin', 'Гоблин', 2, 'Барахольщик: каждая проданная вещь стоит на 200 голдов дороже. Помогая в бою, забирает на карту клада больше обещанного.'),
  RACE('r_mole', 'molefolk', 'Кротолюд', 2, 'Подкоп: +2 к побегу. Проклятия на головняк, броник и обувку его не берут — шкура толстая.'),

  // ───────────── КЛАССЫ ─────────────
  CLS('c_warrior', 'warrior', 'Воин', 3, 'Ярость: в бою сбрось до 3 карт, +1 за каждую. Ничья в бою — твоя победа.'),
  CLS('c_mage', 'mage', 'Маг', 3, 'Чары: сбрось всю руку (от 3 карт) и усыпи монстра — его клад твой, но без уровня. Левитация: до 3 карт, +1 к побегу за каждую.'),
  CLS('c_cleric', 'cleric', 'Жрец', 2, 'Изгнание: против нежити сбрось до 3 карт, +3 за каждую. Проклятие на тебя срывается на броске 5–6.'),
  CLS('c_rogue', 'rogue', 'Плут', 3, 'Удар в спину: сбрось карту — участник боя получает −2. Карманник: сбрось карту и выброси 4+, чтобы стащить мелкую вещь. Провал — минус уровень.'),
  CLS('c_bard', 'bard', 'Бард', 2, 'Колыбельная: в любом бою сбрось карту — монстры −3 (до двух раз за бой). Слава: побеждая сам, берёт ещё карту клада.'),
  CLS('c_alchemist', 'alchemist', 'Алхимик', 2, 'Мастер зелий: твои разовые карты дают на 2 больше. Перегонка: раз в ход вне боя сбрось 2 карты и возьми карту клада.'),
  CLS('c_engineer', 'engineer', 'Механик', 2, 'Третья рука: можешь держать вещи на три руки. Наладчик: +1 к силе за каждую надетую большую вещь.'),

  { id: 'x_halfbreed', deck: 'door', type: 'halfbreed', name: 'Смешанная кровь', copies: 2, art: 'mix', rarity: 'rare',
    text: 'Можешь иметь две расы сразу и пользоваться обеими.' },
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
    art: { body: 'round', hue: 18, props: ['glasses', 'calculator'] }, vs: [{ cls: 'rogue', n: 3, text: '+3 против плутов — у него всё посчитано' }],
    bad: { text: 'Выставил счёт. Сбрось 2 карты с руки.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_leech', 'Пиявка-кредитор', 3, 1, {
    tags: ['water'], escapeMod: -1, art: { body: 'worm', hue: 115, props: ['monocle', 'coins'] },
    text: 'Не отстаёт: −1 к побегу.',
    bad: { text: 'Присосалась к кошельку. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_turnstile', 'Голодный турникет', 3, 1, {
    tags: ['metro'], art: { body: 'box', hue: 205, props: ['ticket'], eyes: 'angry', mouth: 'fangs' },
    bad: { text: 'Не пропустил и зажевал. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_ninjamole', 'Крот-ниндзя', 4, 1, {
    escapeMod: -2, art: { body: 'round', hue: 255, props: ['bandana', 'sword'], eyes: 'angry' },
    text: 'Быстрее тени: −2 к побегу.',
    bad: { text: 'Увёл ботинки прямо с ног. Теряешь обувку.', fx: [{ k: 'slot', slot: 'feet' }] } }),
  M('m_beggar', 'Попрошайка из перехода', 4, 2, {
    tags: ['metro'], noPursue: 3, art: { body: 'humanoid', hue: 30, props: ['hat', 'cup'], eyes: 'sad', mouth: 'smile' },
    text: 'Не гонится за 3-м уровнем и ниже: с них нечего взять.',
    bad: { text: 'Выклянчил. Сбрось 2 карты.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_robovac', 'Ржавый робот-пылесос', 4, 2, {
    art: { body: 'disc', hue: 190, props: ['antenna'] },
    bad: { text: 'Всосал всё мелкое. Теряешь мелкую вещь.', fx: [{ k: 'smallItem' }] } }),
  M('m_duck', 'Канализационная утка', 4, 2, {
    tags: ['water'], noPursue: 2, art: { body: 'bird', hue: 50, props: ['sailorcap'] },
    text: 'Не гонится за 2-м уровнем и ниже.',
    bad: { text: 'Утащила шапку в гнездо. Теряешь головняк.', fx: [{ k: 'slot', slot: 'head' }] } }),
  M('m_gossip', 'Сталактит-сплетник', 5, 2, {
    tags: ['rock'], art: { body: 'spike', hue: 262, props: ['phone'] },
    bad: { text: 'Рассказал всем твои секреты. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_mycel', 'Грибница-сплетница', 5, 2, {
    tags: ['fungus'], art: { body: 'shroom', hue: 300, props: ['scarf'], mouth: 'smile' }, vs: [{ race: 'elf', n: -2, text: '−2 против эльфов: они её не слушают' }],
    bad: { text: 'Опутала руку. Сбрось все карты с руки.', fx: [{ k: 'hand' }] } }),
  M('m_hypno', 'Гриб-гипнотизёр', 6, 2, {
    tags: ['fungus'], art: { body: 'shroom', hue: 200, eyes: 'spiral', props: ['pendulum'] },
    ambush: { text: 'Засада! Загипнотизировал: сбрось случайную карту.', fx: [{ k: 'cards', n: 1 }] },
    bad: { text: 'Ты забыл, кем работал. Теряешь класс.', fx: [{ k: 'class' }] } }),
  M('m_ratunion', 'Крысиный профсоюз', 6, 2, {
    tags: ['rat'], soloBonus: 3, art: { body: 'round', hue: 0, sat: 8, heads: 3, props: ['flag'] },
    text: 'Один в поле не воин: +3 против одиночки.',
    bad: { text: 'Объявили забастовку тебе. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_lasttrain', 'Призрак последней электрички', 6, 2, {
    tags: ['undead', 'metro'], art: { body: 'ghost', hue: 180, props: ['conductorcap', 'lantern'] },
    bad: { text: 'Увёз в депо. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_inspector', 'Скелет-контролёр', 6, 2, {
    tags: ['undead', 'metro'], art: { body: 'skull', hue: 45, props: ['conductorcap', 'ticket'] }, vs: [{ race: 'halfling', n: 3, text: '+3 против полуросликов — ловит безбилетников' }],
    bad: { text: 'Выписал штраф. Теряешь броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),
  M('m_slug', 'Слизень-коллектор', 7, 2, {
    art: { body: 'blob', hue: 108, props: ['briefcase', 'tie'], eyes: 'angry' }, vs: [{ race: 'dwarf', n: 4, text: '+4 против гномов — у них долги по ипотеке шахты' }],
    bad: { text: 'Взыскал. −1 уровень и сбрось 2 карты.', fx: [{ k: 'levels', n: 1 }, { k: 'cards', n: 2 }] } }),
  M('m_cart', 'Вагонетка-оборотень', 7, 2, {
    tags: ['metro'], art: { body: 'box', hue: 25, eyes: 'angry', mouth: 'fangs', props: ['fur'] },
    bad: { text: 'Переехала. Теряешь большую вещь.', fx: [{ k: 'slot', slot: 'big' }] } }),
  M('m_batchoir', 'Хор летучих мышей', 8, 2, {
    soloBonus: 4, art: { body: 'swarm', hue: 275, props: ['notes'] },
    text: 'Нападают стаей на одиночек: +4, если ты без помощника.',
    bad: { text: 'Перепели тебя. Сбрось 2 карты.', fx: [{ k: 'cards', n: 2 }] } }),
  M('m_watchman', 'Ночной сторож', 8, 2, {
    art: { body: 'humanoid', hue: 220, props: ['cap', 'keys', 'mustache'], eyes: 'sleepy' },
    vsItem: [{ tag: 'light', n: -5, text: '−5 против героя с фонарём: боится света' }],
    bad: { text: 'Выгнал до утра. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_dj', 'Двухголовая крыса-диджей', 8, 2, {
    tags: ['rat'], art: { body: 'round', hue: 330, heads: 2, props: ['headphones'] },
    bad: { text: 'Басы сорвали с тебя всё лишнее. Теряешь головняк и обувку.', fx: [{ k: 'slot', slot: 'head' }, { k: 'slot', slot: 'feet' }] } }),
  M('m_plumber', 'Мумия сантехника', 8, 2, {
    tags: ['undead', 'water'], art: { body: 'ghost', hue: 38, pattern: 'bandage', props: ['plunger'] },
    bad: { text: 'Перекрыла стояк. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_banshee', 'Банши из бойлерной', 9, 2, {
    tags: ['undead'], art: { body: 'ghost', hue: 285, mouth: 'o', props: ['soundwaves'] },
    bad: { text: 'Перекричала тебя. Теряешь класс.', fx: [{ k: 'class' }] } }),
  M('m_cashier', 'Кассир подземного банка', 9, 3, {
    noHelp: true, art: { body: 'humanoid', hue: 160, props: ['visor', 'glasses', 'coins'] },
    text: 'Обслуживание строго по одному: звать на помощь нельзя.',
    bad: { text: 'Списал комиссию. Теряешь самую ценную вещь.', fx: [{ k: 'bestItems', n: 1 }] } }),
  M('m_zhek', 'Подземный ЖЭК', 10, 3, {
    art: { body: 'box', hue: 210, props: ['stamp', 'tie'], eyes: 'sleepy' },
    bad: { text: 'Предписание об изъятии. Теряешь броник и 1 уровень.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'levels', n: 1 }] } }),
  M('m_minotaur', 'Минотавр-экскурсовод', 10, 3, {
    art: { body: 'horned', hue: 15, props: ['flag'] }, vs: [{ cls: 'mage', n: 5, text: '+5 против магов — он слышал все фокусы' }],
    bad: { text: 'Водил по лабиринту три часа. −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_endless', 'Червь-бесконечник', 10, 3, {
    tags: ['metro'], escape: false, art: { body: 'worm', hue: 258, props: ['hardhat'], eyes: 'sleepy' },
    text: 'Убежать нельзя: тоннель везде. Зато кусается небольно.',
    bad: { text: 'Укусил в пятку. −1 уровень.', fx: [{ k: 'levels', n: 1 }] } }),
  M('m_salamander', 'Саламандра из котельной', 10, 3, {
    tags: ['fire'], art: { body: 'croc', hue: 12, props: ['flames'] },
    vsItem: [{ tag: 'water', n: -5, text: '−5 против героя с огнетушителем' }],
    bad: { text: 'Прожгла одежду. Теряешь броник.', fx: [{ k: 'slot', slot: 'armor' }] } }),
  M('m_spider', 'Паук-вязальщица', 11, 3, {
    art: { body: 'spider', hue: 340, props: ['yarn'] },
    bad: { text: 'Связала тебе новую личность. Теряешь расу.', fx: [{ k: 'race' }] } }),
  M('m_croc', 'Канализационный аллигатор', 11, 3, {
    tags: ['water'], escapeMod: -2, art: { body: 'croc', hue: 135, props: ['sunglasses'] },
    text: 'Плавает быстрее тебя: −2 к побегу.',
    bad: { text: 'Откусил кусок броника. Теряешь броник и 1 уровень.', fx: [{ k: 'slot', slot: 'armor' }, { k: 'levels', n: 1 }] } }),
  M('m_paranoid', 'Бункерный параноик', 11, 3, {
    noHelp: true, art: { body: 'humanoid', hue: 90, props: ['foilhat'], eyes: 'crazy' }, vs: [{ cls: 'rogue', n: 4, text: '+4 против плутов — никому не верит' }],
    text: 'Посторонних не пускает: звать на помощь нельзя.',
    bad: { text: 'Конфисковал всё подозрительное. Сбрось руку.', fx: [{ k: 'hand' }] } }),
  M('m_golem', 'Каменный голем-вахтёр', 12, 3, {
    tags: ['rock'], art: { body: 'golem', hue: 30, sat: 6, props: ['cap', 'keys'] }, noPursue: 4,
    text: 'Не гонится за 4-м уровнем и ниже: «Детям можно».',
    bad: { text: '«Посторонним вход воспрещён!» −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_worm', 'Червь-метростроевец', 12, 3, {
    tags: ['metro'], art: { body: 'worm', hue: 350, props: ['hardhat'] },
    bad: { text: 'Прорыл тоннель через твою экипировку. Теряешь всё, что в руках.', fx: [{ k: 'slot', slot: 'hands' }] } }),
  M('m_ghostdriver', 'Призрак-машинист', 12, 3, {
    tags: ['undead', 'metro'], noPursue: 3, art: { body: 'ghost', hue: 195, props: ['conductorcap', 'whistle'] },
    text: 'Не гонится за 3-м уровнем и ниже.',
    bad: { text: '«Осторожно, двери закрываются!» −2 уровня.', fx: [{ k: 'levels', n: 2 }] } }),
  M('m_excavator', 'Экскаватор-мертвец', 13, 3, {
    tags: ['undead'], art: { body: 'excavator', hue: 45 },
    bad: { text: 'Зачерпнул ковшом. Теряешь большую вещь и 2 уровня.', fx: [{ k: 'slot', slot: 'big' }, { k: 'levels', n: 2 }] } }),
  M('m_mirror', 'Зеркальный двойник', 0, 3, {
    mirror: 2, rarity: 'epic', art: { body: 'ghost', hue: 200, props: ['mirrorframe'], eyes: 'angry' },
    text: 'Сила — уровень лидера партии плюс 2. Чем ты круче, тем он злее.',
    bad: { text: 'Поменялся с тобой местами. Теряешь расу и класс.', fx: [{ k: 'race' }, { k: 'class' }] } }),
  M('m_concrete', 'Бетонный голем', 14, 4, {
    tags: ['rock'], art: { body: 'golem', hue: 210, sat: 4, props: ['rebar'], eyes: 'angry' }, vs: [{ race: 'dwarf', n: -3, text: '−3 против гномов: знают, где трещины' }],
    bad: { text: 'Залил тебя бетоном. −2 уровня, теряешь броник.', fx: [{ k: 'levels', n: 2 }, { k: 'slot', slot: 'armor' }] } }),
  M('m_vampire', 'Вампир-ростовщик', 14, 4, {
    tags: ['undead'], art: { body: 'bat', hue: 340, props: ['monocle', 'coins'] },
    bad: { text: 'Проценты выросли. Теряешь 2 самые ценные вещи.', fx: [{ k: 'bestItems', n: 2 }] } }),
  M('m_heatpipe', 'Змей теплотрассы', 14, 4, {
    tags: ['fire'], art: { body: 'worm', hue: 18, props: ['steam'], eyes: 'angry' }, levels: 2,
    bad: { text: 'Горячий приём. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_lich', 'Лич из архива', 15, 4, {
    tags: ['undead'], art: { body: 'skull', hue: 150, props: ['book', 'glasses'] }, vs: [{ cls: 'cleric', n: 4, text: '+4 против жрецов — у него справка' }],
    bad: { text: 'Сдал тебя в архив. −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_moldking', 'Плесневой король', 15, 4, {
    tags: ['fungus'], art: { body: 'shroom', hue: 85, crown: true, pattern: 'spots', eyes: 'angry' },
    ambush: { text: 'Засада! Споры в лицо: сбрось случайную карту.', fx: [{ k: 'cards', n: 1 }] },
    bad: { text: 'Всё покрылось плесенью. Теряешь все вещи.', fx: [{ k: 'allItems' }] } }),
  M('m_ratqueen', 'Королева пещерных крыс', 16, 4, {
    tags: ['rat'], art: { body: 'round', hue: 300, crown: true, props: ['cape'] }, levels: 2,
    bad: { text: 'Свита отобрала всё. −2 уровня и сбрось руку.', fx: [{ k: 'levels', n: 2 }, { k: 'hand' }] } }),
  M('m_troll', 'Тролль-налоговик', 16, 4, {
    art: { body: 'horned', hue: 120, props: ['briefcase', 'tie'] }, levels: 2,
    bad: { text: 'Налог на всё. Теряешь все вещи.', fx: [{ k: 'allItems' }] } }),
  M('m_cricket', 'Медведка-великан', 17, 4, {
    tags: ['insect'], escapeMod: -1, art: { body: 'bug', hue: 30, props: ['claws'], eyes: 'angry', mouth: 'fangs' }, levels: 2,
    text: 'Роет быстрее тебя: −1 к побегу.',
    bad: { text: 'Закопала заживо. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_dragon', 'Дракон из-под моста', 18, 5, {
    tags: ['fire'], art: { body: 'dragon', hue: 0 }, levels: 2, noPursue: 5,
    text: 'Не гонится за 5-м уровнем и ниже: мелочь не жуёт.',
    bad: { text: 'Поджарил. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_pit', 'Бездонная яма с зубами', 19, 5, {
    art: { body: 'pit', hue: 270 }, levels: 2,
    bad: { text: 'Дна действительно нет. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_philosopher', 'Сталагмит-философ', 19, 5, {
    tags: ['rock'], noPursue: 6, art: { body: 'spike', hue: 28, flip: true, props: ['beard', 'glasses'], eyes: 'sleepy' }, levels: 2,
    text: 'Не гонится за 6-м уровнем и ниже: им рано о вечном.',
    bad: { text: 'Объяснил смысл жизни. −3 уровня.', fx: [{ k: 'levels', n: 3 }] } }),
  M('m_molekron', 'Древний Кротокрон', 20, 5, {
    art: { body: 'round', hue: 25, crown: true, heads: 3, props: ['beard'] }, levels: 2, noPursue: 5,
    text: 'Не гонится за 5-м уровнем и ниже.',
    bad: { text: 'Закопал на тысячу лет. Ты погибаешь.', fx: [{ k: 'death' }] } }),
  M('m_gorynych', 'Змей кольцевой линии', 20, 5, {
    tags: ['fire', 'metro'], art: { body: 'dragon', hue: 125, heads: 3 }, levels: 2, noPursue: 5,
    text: 'Три головы, три пересадки. Не гонится за 5-м уровнем и ниже.',
    bad: { text: 'Проехал по тебе всю кольцевую. Ты погибаешь.', fx: [{ k: 'death' }] } }),

  // ───────────── ПРОКЛЯТИЯ ─────────────
  { id: 'k_draft', deck: 'door', type: 'curse', name: 'Проклятие: Сквозняк', copies: 2, art: 'wind',
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
  { id: 'k_klepto', deck: 'door', type: 'curse', name: 'Проклятие: Сосед-клептоман', copies: 1, art: 'hand',
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
  { id: 'loc_flooded', deck: 'door', type: 'location', name: 'Затопленный тоннель', copies: 1, art: 'loc_water', rarity: 'rare',
    escapeAll: -1, monsterTag: [{ tag: 'water', n: 3 }],
    text: 'Всем −1 к побегу. Водные монстры +3.' },
  { id: 'loc_mushroom', deck: 'door', type: 'location', name: 'Грибная пещера', copies: 1, art: 'loc_mushroom', rarity: 'rare',
    monsterTag: [{ tag: 'fungus', n: 4 }], treasureBonus: 1,
    text: 'Грибы +4. За каждую победу — ещё карта клада.' },
  { id: 'loc_station', deck: 'door', type: 'location', name: 'Заброшенная станция', copies: 1, art: 'loc_station', rarity: 'rare',
    monsterTag: [{ tag: 'undead', n: 3 }, { tag: 'metro', n: 2 }], heroMod: [{ cls: 'cleric', n: 2 }],
    text: 'Нежить +3, жители метро +2. Жрецы +2 к силе.' },
  { id: 'loc_vault', deck: 'door', type: 'location', name: 'Сокровищница гномов', copies: 1, art: 'loc_vault', rarity: 'epic',
    treasureBonus: 1, heroMod: [{ race: 'dwarf', n: 2 }],
    text: 'За каждую победу — ещё карта клада. Гномы +2 к силе.' },
  { id: 'loc_boiler', deck: 'door', type: 'location', name: 'Тёплая котельная', copies: 1, art: 'loc_boiler', rarity: 'rare',
    noCurses: true, monsterTag: [{ tag: 'fire', n: 3 }],
    text: 'Проклятия тают в тепле и не действуют. Огненные монстры +3.' },
  { id: 'loc_market', deck: 'door', type: 'location', name: 'Рынок под мостом', copies: 1, art: 'loc_market', rarity: 'rare',
    saleRate: 700, heroMod: [{ race: 'goblin', n: 2 }],
    text: 'Уровень за каждые 700 голдов, а не 1000. Гоблины +2 к силе.' },
  { id: 'loc_rats', deck: 'door', type: 'location', name: 'Крысиные катакомбы', copies: 1, art: 'loc_rats', rarity: 'rare',
    monsterTag: [{ tag: 'rat', n: 3 }], heroMod: [{ cls: 'rogue', n: 2 }],
    text: 'Крысы +3. Плуты здесь свои: +2 к силе.' },
  { id: 'loc_dark', deck: 'door', type: 'location', name: 'Тёмный коллектор', copies: 1, art: 'loc_dark', rarity: 'rare',
    heroAll: -1, escapeAll: 1, lightBonus: 2,
    text: 'Всем героям −1 к силе, но в темноте легче удрать: +1 к побегу. Светильники дают ещё +2.' },
  { id: 'loc_echo', deck: 'door', type: 'location', name: 'Гулкая штольня', copies: 1, art: 'loc_echo', rarity: 'rare',
    monsterAll: -1, heroMod: [{ cls: 'bard', n: 3 }],
    text: 'Эхо пугает монстров: все −1. Барды +3 к силе.' },

  // ───────────── СОБЫТИЯ ─────────────
  // Срабатывают сразу, если их вытащили, выбив дверь. Из руки играются в свой ход вне боя.
  { id: 'ev_quake', deck: 'door', type: 'event', event: 'quake', name: 'Подземный толчок', copies: 1, art: 'ev_quake',
    text: 'Все сбрасывают по случайной карте с руки.' },
  { id: 'ev_light', deck: 'door', type: 'event', event: 'light', name: 'Свет в конце тоннеля', copies: 1, art: 'ev_light', rarity: 'rare',
    text: 'Все жрецы и барды получают уровень (не 10-й).' },
  { id: 'ev_fair', deck: 'door', type: 'event', event: 'fair', name: 'Ярмарка в переходе', copies: 1, art: 'ev_fair',
    text: 'Все берут по карте клада.' },
  { id: 'ev_draft', deck: 'door', type: 'event', event: 'draft', name: 'Сквозняк перемен', copies: 1, art: 'wind',
    text: 'Все передают случайную карту с руки соседу слева.' },
  { id: 'ev_rollcall', deck: 'door', type: 'event', event: 'rollcall', name: 'Перекличка', copies: 1, art: 'ev_rollcall',
    text: 'Отстающие с самым низким уровнем получают уровень.' },
  { id: 'ev_luxtax', deck: 'door', type: 'event', event: 'luxtax', name: 'Налог на роскошь', copies: 1, art: 'paper',
    text: 'Все игроки 7-го уровня и выше теряют уровень.' },

  // ───────────── КЛАД: ВЕЩИ ─────────────
  // slot: head | armor | feet | hand | none | pet ; hands: 1|2|3 ; big ; tags: ['light','water'] ; vsTag ; clsBonus
  { id: 'i_helmet', deck: 'treasure', type: 'item', name: 'Каска шахтёра', slot: 'head', bonus: 1, value: 200, copies: 2, art: 'helmet' },
  { id: 'i_headlamp', deck: 'treasure', type: 'item', name: 'Налобный фонарь', slot: 'head', bonus: 2, value: 400, art: 'lamp', tags: ['light'],
    text: 'Светит в глаза монстрам. Источник света.' },
  { id: 'i_hardlamp', deck: 'treasure', type: 'item', name: 'Каска с прожектором', slot: 'head', bonus: 2, value: 500, art: 'hardlamp', tags: ['light'], rarity: 'rare',
    text: 'Источник света.' },
  { id: 'i_barrel', deck: 'treasure', type: 'item', name: 'Шлем-бочонок', slot: 'head', bonus: 2, value: 400, art: 'barrel' },
  { id: 'i_crown', deck: 'treasure', type: 'item', name: 'Корона из пробок', slot: 'head', bonus: 3, value: 600, art: 'crown', rarity: 'rare',
    req: { notRace: 'dwarf' }, text: 'Не для гномов — давит на бороду.' },
  { id: 'i_quilt', deck: 'treasure', type: 'item', name: 'Ватник бронированный', slot: 'armor', bonus: 1, value: 200, copies: 2, art: 'jacket' },
  { id: 'i_tokens', deck: 'treasure', type: 'item', name: 'Кольчуга из жетонов', slot: 'armor', bonus: 2, value: 400, art: 'mail' },
  { id: 'i_diver', deck: 'treasure', type: 'item', name: 'Скафандр водолаза', slot: 'armor', bonus: 3, value: 600, big: true, art: 'diver', tags: ['water'],
    runBonus: -1, text: '−1 к побегу: в нём не побегаешь.' },
  { id: 'i_robe', deck: 'treasure', type: 'item', name: 'Мантия архивариуса', slot: 'armor', bonus: 3, value: 600, art: 'robe', rarity: 'rare',
    req: { cls: 'mage' }, text: 'Только для магов.' },
  { id: 'i_boots', deck: 'treasure', type: 'item', name: 'Резиновые сапоги', slot: 'feet', bonus: 1, value: 200, art: 'boots' },
  { id: 'i_runners', deck: 'treasure', type: 'item', name: 'Кеды-драпалки', slot: 'feet', bonus: 0, value: 400, art: 'sneakers',
    runBonus: 2, text: '+2 к побегу.' },
  { id: 'i_slippers', deck: 'treasure', type: 'item', name: 'Тапки бесшумные', slot: 'feet', bonus: 1, value: 300, art: 'slippers',
    runBonus: 1, text: '+1 к побегу.' },
  { id: 'i_shovel', deck: 'treasure', type: 'item', name: 'Совковая лопата', slot: 'hand', hands: 1, bonus: 2, value: 200, copies: 2, art: 'shovel' },
  { id: 'i_pick', deck: 'treasure', type: 'item', name: 'Кирка ударника', slot: 'hand', hands: 2, bonus: 3, value: 400, art: 'pick' },
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
  { id: 'p_cat', deck: 'treasure', type: 'item', slot: 'pet', name: 'Кот-диггер', bonus: 2, value: 400, art: 'pet_cat', rarity: 'rare',
    vsTag: { tag: 'rat', n: 3 }, text: 'Питомец. Против крыс ещё +3. Спасёт от одной расплаты.' },

  // ───────────── КЛАД: РАЗОВЫЕ ─────────────
  { id: 'o_pickles', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 3, value: 100, copies: 2, art: 'jar',
    name: 'Банка маринованных грибов', text: 'Разовая. В любом бою: +3 любой стороне.' },
  { id: 'o_kvass', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 2, value: 100, copies: 2, art: 'bottle',
    name: 'Квас «Богатырский»', text: 'Разовая. В любом бою: +2 любой стороне.' },
  { id: 'o_shawarma', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 5, value: 300, art: 'wrap', rarity: 'rare',
    name: 'Огненная шаурма', text: 'Разовая. В любом бою: +5 любой стороне.' },
  { id: 'o_cola', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 3, value: 200, art: 'can',
    name: 'Ледяная газировка', text: 'Разовая. В любом бою: +3 любой стороне.' },
  { id: 'o_firecracker', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 4, value: 300, art: 'boom',
    name: 'Петарда «Ракета»', text: 'Разовая. В любом бою: +4 любой стороне.' },
  { id: 'o_holywater', deck: 'treasure', type: 'oneshot', effect: 'bonus', bonus: 2, value: 300, copies: 2, art: 'holywater',
    tagBonus: { tag: 'undead', n: 6 },
    name: 'Святая вода', text: 'Разовая. +2 любой стороне, а героям против нежити — +8.' },
  { id: 'o_rope', deck: 'treasure', type: 'oneshot', effect: 'escapeBonus', bonus: 3, value: 200, art: 'rope',
    name: 'Верёвка с кошкой', text: 'Разовая. Участник боя: +3 к побегу в этом бою.' },
  { id: 'o_smoke', deck: 'treasure', type: 'oneshot', effect: 'escape', value: 200, copies: 2, art: 'smoke',
    name: 'Дымовая шашка', text: 'Разовая. Участник боя: все герои сбегают без расплаты и без наград.' },
  { id: 'o_petrify', deck: 'treasure', type: 'oneshot', effect: 'remove', value: 300, copies: 2, art: 'scroll', rarity: 'rare',
    name: 'Свиток окаменения', text: 'Разовая. В любом бою: убери одного монстра. Ни уровня, ни клада за него.' },
  { id: 'o_ward', deck: 'treasure', type: 'oneshot', effect: 'ward', value: 300, copies: 2, art: 'amulet',
    name: 'Куриный бог', text: 'Держи в руке: первое проклятие на тебя срабатывает впустую, а камушек уходит в сброс.' },

  // ───────────── КЛАД: БАФФЫ ─────────────
  // Играются когда угодно на себя: сила добавляется в текущем бою или в следующем.
  { id: 'b_courage', deck: 'treasure', type: 'buff', name: 'Зелье храбрости', bonus: 3, value: 200, art: 'potion',
    text: '+3 к силе в этом или следующем бою.' },
  { id: 'b_energy', deck: 'treasure', type: 'buff', name: 'Энергетик «Забой»', bonus: 2, value: 100, copies: 2, art: 'energy',
    text: '+2 к силе в этом или следующем бою.' },
  { id: 'b_pies', deck: 'treasure', type: 'buff', name: 'Бабушкины пирожки', bonus: 4, value: 300, art: 'pies', rarity: 'rare',
    text: '+4 к силе в этом или следующем бою. С капустой.' },

  // ───────────── КЛАД: УРОВНИ И ПРОЧЕЕ ─────────────
  { id: 'l_stash', deck: 'treasure', type: 'levelup', name: 'Нашёл заначку', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_bribe', deck: 'treasure', type: 'levelup', name: 'Подкупил смотрителя', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_manual', deck: 'treasure', type: 'levelup', name: 'Прочитал инструкцию', art: 'up', text: 'Получи уровень. Не 10-й. Никто так не делает.' },
  { id: 'l_sleep', deck: 'treasure', type: 'levelup', name: 'Выспался', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_exam', deck: 'treasure', type: 'levelup', name: 'Сдал зачёт по спелеологии', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_friend', deck: 'treasure', type: 'levelup', name: 'Знакомый диггер', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_map', deck: 'treasure', type: 'levelup', name: 'Карта с крестиком', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_bonus', deck: 'treasure', type: 'levelup', name: 'Премия за вредность', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'l_shortcut', deck: 'treasure', type: 'levelup', name: 'Короткий путь', art: 'up', text: 'Получи уровень. Не 10-й.' },
  { id: 'h_hoard', deck: 'treasure', type: 'hoard', name: 'Схрон!', copies: 2, art: 'chest', rarity: 'rare',
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

export const RACE_NAMES = { elf: 'Эльф', dwarf: 'Гном', halfling: 'Полурослик', orc: 'Орк', goblin: 'Гоблин', molefolk: 'Кротолюд', human: 'Человек' };
export const CLASS_NAMES = { warrior: 'Воин', mage: 'Маг', cleric: 'Жрец', rogue: 'Плут', bard: 'Бард', alchemist: 'Алхимик', engineer: 'Механик' };
export const SLOT_NAMES = { head: 'Головняк', armor: 'Броник', feet: 'Обувка', hand: 'В руки', none: 'Прочее', pet: 'Питомец' };
export const TAG_NAMES = { undead: 'нежить', rat: 'крыса', fungus: 'гриб', water: 'водный', fire: 'огненный', insect: 'насекомое', metro: 'житель метро', rock: 'каменный' };
