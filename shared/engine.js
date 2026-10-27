// «Под Землёй» — игровой движок. Чистые функции над JSON-состоянием.
// Сервер хранит состояние, вызывает act()/tick() и рассылает view() каждому игроку.
import { def, allUids, RACE_NAMES, CLASS_NAMES, ALLY_SLOT_TEXT, ruleText, BOSS_MULT, BOSS_MIN_LEVEL, BOSS_FLOOR, TROUBLE_BONUS, WITCHER_BONUS, MUTAGEN_BONUS, LULLABY_PENALTY, LULLABY_MAX, DISTILL_COST,
  DEPTH, DEPTH_TREASURE_EVERY, DEATH_LEVELS, GHOST_BONUS, CONTRACTS, CONTRACT_DEFS, SETS, rewardText,
  TAME_MARGIN, WARLOCK_TAME, FEMME_LEVELS, REGULAR_SPEND, REGULAR_DISCOUNT, PANDORA_COST, PANDORA_BONUS, PANDORA_ESCAPE, tameBonus, TRAP_ROLL, TRAP_SKILL, TRAP_FAIL_LEVELS, SHOP_IDS, shopCat, shopBase, roundPrice, dailyOf } from './cards.js';

export const WIN_LEVEL = 10;
// до какого уровня идёт партия: 10 по умолчанию, в лобби можно выбрать 15 или 20
export const WIN_LEVELS = [5, 10, 15, 20];
export const luxLevel = s => Math.round(winLevel(s) * 0.7);
export const fillText = (s, t) => ruleText(t, { win: winLevel(s), lux: luxLevel(s) });
export const winLevel = s => (WIN_LEVELS.includes(s?.opts?.winLevel) ? s.opts.winLevel : WIN_LEVEL);
// в быстрой партии (до 5-го) все начинают с картами побольше — чтобы было чем драться за последний уровень
export const startCards = s => (winLevel(s) <= 5 ? 6 : 4);
const d6 = rng => 1 + Math.floor(rng() * 6);

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const without = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); return i >= 0; };
const q = name => `«${name}»`;

// ───────────────────────── создание ─────────────────────────
export function createGame(seats, opts = {}, rng = Math.random) {
  const s = {
    phase: 'playing', version: 1, now: 0, logSeq: 0, fxSeq: 0, revealSeq: 0, log: [], fx: [],
    opts: { winDelayMs: 10000, winLevel: WIN_LEVEL, ...opts },
    players: seats.map((x, i) => ({
      id: x.id, name: x.name, color: x.color || null, avatar: x.avatar ?? i, isBot: !!x.isBot, seat: i,
      level: 1, races: [], classes: [], halfbreed: null, supermunch: null,
      equipped: [], carried: [], hand: [], nextCombat: 0, nextEscape: 0, dead: false, needsRevive: false, mutagenUsed: false,
      persona: x.isBot && x.persona ? x.persona : null, contract: null, contractsDone: 0, ally: null, allySlots: null, allyGear: [], beast: null, gold: 0,
    })),
    decks: { door: shuffle(allUids('door'), rng), treasure: shuffle(allUids('treasure'), rng) },
    discard: { door: [], treasure: [] },
    turn: { idx: 0, pid: null, step: 'pre', n: 0, halflingSold: false },
    combat: null, reveal: null, winners: [], location: null,
    round: 0, depth: 0, trades: [], tradeSeq: 0, grudges: {}, trap: null, tame: null, duel: null,
  };
  if (!WIN_LEVELS.includes(s.opts.winLevel)) s.opts.winLevel = WIN_LEVEL;
  for (const p of s.players) {
    for (let i = 0; i < startCards(s); i++) { give(p, draw(s, 'door', rng)); give(p, draw(s, 'treasure', rng)); }
  }
  for (const p of s.players) p.contract = newContract(s, p, rng);
  log(s, `Партия началась. Первым дошедший до ${s.opts.winLevel}-го уровня побеждает.`, 'sys');
  if (typeof s.opts.daily === 'string') applyDaily(s, rng); else delete s.opts.daily;
  beginTurn(s, Math.floor(rng() * s.players.length), rng);
  return s;
}

// ───────────────────────── испытание дня ─────────────────────────
// чернокнижник подчиняет зверя при меньшем перевесе
export const tameMargin = (s, p = null) => Math.min(s.opts?.dailyId === 'beasts' ? 5 : TAME_MARGIN, p && hasClass(p, 'warlock') ? WARLOCK_TAME : Infinity);
function applyDaily(s, rng) {
  const d = dailyOf(s.opts.daily);
  s.opts.dailyId = d.id;
  log(s, `📅 Испытание дня ${s.opts.daily}: «${d.name}». ${d.text} Колода сегодня у всех одна.`, 'sys');
  switch (d.id) {
    case 'deep': s.depth = 1; break;
    case 'rich': for (const p of s.players) { give(p, draw(s, 'treasure', rng)); give(p, draw(s, 'treasure', rng)); } break;
    case 'loc': {
      const locs = s.decks.door.filter(u => def(u).type === 'location');
      if (locs.length) { const u = pick(locs, rng); without(s.decks.door, u); s.location = u; log(s, `Партия начинается в локации ${q(def(u).name)}: ${fillText(s, def(u).text)}`, 'event'); }
      break;
    }
    case 'veteran': for (const p of s.players) p.level = 2; break;
    case 'fair': break; // цены на рынке ниже — считает shopPrice
  }
}

// ───────────────────────── утилиты ─────────────────────────
export const P = (s, pid) => s.players.find(p => p.id === pid);
function log(s, text, kind = 'info') {
  s.log.push({ id: ++s.logSeq, text, kind });
  if (s.log.length > 150) s.log.splice(0, s.log.length - 150);
}
function fx(s, o) {
  s.fx.push({ ...o, id: ++s.fxSeq }); // номер события всегда свой: поле id в данных события его не перебивает
  if (s.fx.length > 30) s.fx.splice(0, s.fx.length - 30);
}
function draw(s, deck, rng) {
  if (!s.decks[deck].length && s.discard[deck].length) {
    s.decks[deck] = shuffle(s.discard[deck], rng);
    s.discard[deck] = [];
    log(s, deck === 'door' ? 'Колода проходов перетасована заново.' : 'Колода клада перетасована заново.', 'sys');
  }
  return s.decks[deck].pop() || null;
}
function give(p, uid) { if (uid) p.hand.push(uid); }
const isLegend = uid => def(uid).rarity === 'legendary';

// ───────────────────────── заказ карты ─────────────────────────
// Сервер может тихо заказать герою карту: она придёт вместо ближайшей карты клада, если свободна
// (лежит в колоде или сбросе). Вещь, которая у кого-то из героев, заказать нельзя. Класс, «Смешанную кровь»,
// «Совместителя» и спутника можно всегда: если все копии разобраны, появится ещё одна. В летопись и в вид для игроков заказ не попадает.
const baseId = uid => String(uid).split('#')[0];
const ORDER_ANYWAY = new Set(['class', 'halfbreed', 'supermunch', 'ally']);
function freeUid(s, id) {
  const d = def(id);
  for (const pile of [s.decks[d.deck], s.discard[d.deck]]) { const u = pile.find(x => baseId(x) === id); if (u) return u; }
  return null;
}
export function orderCard(s, pid, id) {
  const p = P(s, pid);
  if (!p || !id || s.phase !== 'playing') return { ok: false, error: 'Только во время партии' };
  if (!ORDER_ANYWAY.has(def(id).type) && !freeUid(s, id)) return { ok: false, error: 'Сейчас не выйдет: эта карта уже у кого-то из героев' };
  if (!s.orders) s.orders = {};
  const q = s.orders[pid] || (s.orders[pid] = []);
  if (!q.includes(id)) q.push(id);
  return { ok: true };
}
// заказанная карта для героя (или null); вещь, которую успели забрать, тихо пропадает из заказа
function takeOrder(s, p) {
  const q = s.orders?.[p.id];
  let u = null;
  while (q?.length && !u) {
    const id = q.shift(), d = def(id);
    u = freeUid(s, id);
    if (u) without(s.decks[d.deck], u) || without(s.discard[d.deck], u);
    else if (ORDER_ANYWAY.has(d.type)) u = `${id}#${(d.copies || 1) + (s.orderSeq = (s.orderSeq || 0) + 1) - 1}`;
  }
  if (q && !q.length) delete s.orders[p.id];
  return u;
}
// тайная команда с NOW: карта сразу в руку. Соперники не видят, что карт в руке стало больше:
// такие карты не попадают в счёт руки, который видят другие, пока лежат в руке
export function grantCard(s, pid, id) {
  const p = P(s, pid);
  if (!p || !id || s.phase !== 'playing') return { ok: false, error: 'Только во время партии' };
  const d = def(id);
  let u = freeUid(s, id);
  if (u) without(s.decks[d.deck], u) || without(s.discard[d.deck], u);
  else if (ORDER_ANYWAY.has(d.type)) u = `${id}#${(d.copies || 1) + (s.orderSeq = (s.orderSeq || 0) + 1) - 1}`;
  else return { ok: false, error: 'Сейчас не выйдет: эта карта уже у кого-то из героев' };
  p.hand.push(u);
  p.secret = [...(p.secret || []).filter(x => p.hand.includes(x)), u];
  s.version++;
  return { ok: true, uid: u };
}
const pruneSecret = s => { for (const x of s.players) if (x.secret?.length) x.secret = x.secret.filter(u => x.hand.includes(u)); };
// сколько карт в руке видят другие: без тайно полученных
const shownHand = p => (p.secret?.length ? p.hand.filter(u => !p.secret.includes(u)).length : p.hand.length);
// карта клада конкретному герою: заказанная или верхняя из колоды
function drawFor(s, p, rng) { return takeOrder(s, p) || draw(s, 'treasure', rng); }
function toDiscard(s, uid) { if (!uid) return; s.discard[def(uid).deck].push(uid); if (s.splits?.[uid]) delete s.splits[uid]; }

// ───────────────────────── свойства героя ─────────────────────────
export const raceKeys = p => p.races.map(u => def(u).race);
export const classKeys = p => p.classes.map(u => def(u).cls);
export const hasRace = (p, r) => (r === 'human' ? p.races.length === 0 : raceKeys(p).includes(r));
export const hasClass = (p, c) => classKeys(p).includes(c);
// спутник героя (Носильщик, Проводник, Наёмник) и его свойство
const allyOf = p => (p.ally ? def(p.ally) : null);
const allyN = (p, key) => allyOf(p)?.[key] || 0;
// снаряжение спутника: места выпадают случайно, когда спутник приходит, — оружие и броник или оружие, броник и головняк.
// Вещи на спутнике дают бонус герою; ограничения по расе и классу спутник не снимает — такие вещи носит только сам герой.
export const ALLY_SLOT_SETS = [['hand', 'armor'], ['hand', 'armor', 'head']];
export const allySlotsOf = p => (p.ally ? p.allySlots || ALLY_SLOT_SETS[0] : []);
const rollAllySlots = rng => [...ALLY_SLOT_SETS[Math.floor(rng() * ALLY_SLOT_SETS.length) % ALLY_SLOT_SETS.length]];
// спутник уходит: его вещи возвращаются герою в «Не надето»
function releaseAlly(p) {
  if (p.allyGear?.length) p.carried.push(...p.allyGear);
  p.allyGear = []; p.allySlots = null;
}
export function allyWearError(p, uid) {
  if (!p.ally) return 'Спутника нет';
  const d = def(uid);
  if (d.type !== 'item') return 'Спутнику можно отдать только вещь';
  if (!allySlotsOf(p).includes(d.slot)) return `${def(p.ally).name} такое не носит`;
  if (d.req) return 'Эту вещь носит только сам герой';
  if (d.slot === 'hand' && (d.hands || 1) > 2) return 'Спутнику с такой вещью не управиться';
  if ((p.allyGear || []).some(u => def(u).slot === d.slot)) return 'У спутника это место уже занято';
  return null;
}
export const handLimit = (p, s = null) => (hasRace(p, 'dwarf') ? 6 : 5) + ((s && locationOf(s)?.handBonus) || 0) + allyN(p, 'handBonus');
const bigLimit = p => (hasRace(p, 'dwarf') ? 99 : 1 + allyN(p, 'bigBonus'));
const handsLimit = p => (hasClass(p, 'engineer') ? 3 : 2);
const inPlayItems = p => [...p.equipped, ...p.carried];
export const locationOf = s => (s.location ? def(s.location) : null);
const hasItemTag = (p, tag) => p.equipped.some(u => (def(u).tags || []).includes(tag));
// свойства надетых вещей: список значений поля (immune, calm) или флаг
const itemList = (p, key) => p.equipped.flatMap(u => def(u)[key] || []);
const itemFlag = (p, key) => p.equipped.some(u => def(u)[key]);
const monTags = uid => def(uid).tags || [];
const combatHasTag = (s, tag) => !!s.combat && s.combat.monsters.some(m => (def(m.uid).tags || []).includes(tag));

function reqError(p, d) {
  const r = d.req;
  if (!r) return null;
  // легендарный комплект: человеку, а со «Смешанной кровью» — любой расе
  if (r.race === 'human' && r.mix && !hasRace(p, 'human') && !p.halfbreed) return 'Только для человека или героя со «Смешанной кровью»';
  if (r.race === 'human' && !r.mix && !hasRace(p, 'human')) return 'Только для человека — сбросьте расу';
  if (r.race && r.race !== 'human' && !hasRace(p, r.race)) return `Только для: ${RACE_NAMES[r.race]}`;
  if (r.notRace && hasRace(p, r.notRace)) return `Не для: ${RACE_NAMES[r.notRace]}`;
  if (r.cls && !hasClass(p, r.cls)) return `Только для: ${CLASS_NAMES[r.cls]}`;
  return null;
}
function slotUse(p, except) {
  const u = { head: 0, armor: 0, feet: 0, hands: 0, big: 0, pet: 0 };
  for (const x of p.equipped) {
    if (x === except) continue;
    const d = def(x);
    if (d.slot === 'head') u.head++;
    else if (d.slot === 'armor') u.armor++;
    else if (d.slot === 'feet') u.feet++;
    else if (d.slot === 'hand') u.hands += d.hands || 1;
    else if (d.slot === 'pet') u.pet++;
    if (d.big) u.big++;
  }
  if (p.beast) u.pet++; // приручённый зверь занимает место питомца
  return u;
}
export function equipError(p, uid) {
  const d = def(uid);
  const re = reqError(p, d);
  if (re) return re;
  const u = slotUse(p, uid);
  if (d.slot === 'head' && u.head) return 'Головняк уже надет';
  if (d.slot === 'armor' && u.armor) return 'Броник уже надет';
  if (d.slot === 'feet' && u.feet) return 'Обувка уже надета';
  if (d.slot === 'hand' && u.hands + (d.hands || 1) > handsLimit(p)) return (d.hands || 1) > 2 ? 'Столько рук только у механика' : 'Руки заняты';
  if (d.slot === 'pet' && u.pet) return p.beast ? 'Место питомца занято приручённым зверем' : 'Питомец может быть только один';
  if (d.big && u.big >= bigLimit(p)) return 'Большая вещь может быть только одна (гномам — сколько угодно)';
  return null;
}
// бонус надетых вещей; в бою добавляются бонусы против тегов монстров
function gearBonus(p, s, u) {
  const d = def(u);
  // гордый клинок не помогает против мелочи
  if (s?.combat && d.minFoe && s.combat.monsters.length && s.combat.monsters.every(m => monsterBaseLevel(s, def(m.uid)) < d.minFoe)) return 0;
  let v = d.bonus || 0;
  if (d.clsBonus && hasClass(p, d.clsBonus.cls)) v += d.clsBonus.n;
  if (s && d.vsTag && combatHasTag(s, d.vsTag.tag)) v += d.vsTag.n;
  return v;
}
export function itemBonus(p, s = null) {
  let v = 0;
  for (const u of p.equipped) v += gearBonus(p, s, u);
  for (const u of p.allyGear || []) v += gearBonus(p, s, u);
  for (const k of setsOf(p)) {
    const st = SETS[k];
    v += st.bonus || 0;
    if (s && st.vsTag && combatHasTag(s, st.vsTag.tag)) v += st.vsTag.n;
  }
  v += allyN(p, 'bonus');
  if (p.beast) v += tameBonus(def(p.beast));
  return v;
}
// собранные комплекты: все вещи комплекта надеты
export function setsOf(p) {
  const have = new Set(p.equipped.map(u => def(u).id));
  return Object.keys(SETS).filter(k => SETS[k].items.every(id => have.has(id)));
}
// постоянные бонусы расы, класса и локации (без боевых)
export function passiveBonus(s, p) {
  let v = 0;
  if (hasRace(p, 'orc') && !p.equipped.some(u => def(u).slot === 'head')) v += 2;
  if (hasClass(p, 'engineer')) v += p.equipped.filter(u => def(u).big).length;
  if (hasClass(p, 'witcher')) v += WITCHER_BONUS;
  const L = locationOf(s);
  if (L) {
    v += L.heroAll || 0;
    for (const m of L.heroMod || []) if ((m.cls && hasClass(p, m.cls)) || (m.race && hasRace(p, m.race))) v += m.n;
    if (L.lightBonus && hasItemTag(p, 'light')) v += L.lightBonus;
    if (L.itemTag && hasItemTag(p, L.itemTag.tag)) v += L.itemTag.n;
  }
  for (const u of p.equipped) { const lb = def(u).locBonus; if (lb && s?.location && def(s.location).id === lb.loc) v += lb.n; }
  return v;
}
export const powerOf = (s, p) => p.level + itemBonus(p) + passiveBonus(s, p);
export function runBonusOf(s, p) {
  let b = (hasRace(p, 'elf') ? 1 : 0) + (hasRace(p, 'molefolk') ? 2 : 0) + (p.nextEscape || 0);
  for (const u of [...p.equipped, ...(p.allyGear || [])]) b += def(u).runBonus || 0;
  for (const k of setsOf(p)) b += SETS[k].run || 0;
  b += allyN(p, 'runBonus');
  b += locationOf(s)?.escapeAll || 0;
  return b;
}
function removeItem(p, uid) { return without(p.equipped, uid) || without(p.carried, uid); }

function normalize(s, p) {
  if (!p.ally && p.allyGear?.length) releaseAlly(p);
  if (!p.ally) p.allySlots = null;
  const rcap = p.halfbreed ? 2 : 1;
  while (p.races.length > rcap) toDiscard(s, p.races.pop());
  const ccap = p.supermunch ? 2 : 1;
  while (p.classes.length > ccap) toDiscard(s, p.classes.pop());
  for (const u of [...p.equipped]) {
    if (reqError(p, def(u))) { without(p.equipped, u); p.carried.push(u); }
  }
  let bigs = p.equipped.filter(u => def(u).big);
  while (bigs.length > bigLimit(p)) {
    bigs.sort((a, b) => (def(a).bonus || 0) - (def(b).bonus || 0));
    const u = bigs.shift();
    without(p.equipped, u); p.carried.push(u);
  }
  const handItems = () => p.equipped.filter(u => def(u).slot === 'hand');
  while (handItems().reduce((a, u) => a + (def(u).hands || 1), 0) > handsLimit(p)) {
    const u = handItems().sort((a, b) => (def(a).bonus || 0) - (def(b).bonus || 0))[0];
    without(p.equipped, u); p.carried.push(u);
  }
  const pets = p.equipped.filter(u => def(u).slot === 'pet');
  while (pets.length > (p.beast ? 0 : 1)) { const u = pets.pop(); without(p.equipped, u); p.carried.push(u); }
}

function setLevel(s, p, lvl, { canWin = false } = {}) {
  const W = winLevel(s);
  const cap = canWin ? W : W - 1;
  const nl = Math.max(1, Math.min(lvl, Math.max(cap, p.level)));
  if (nl !== p.level) fx(s, { kind: nl > p.level ? 'levelUp' : 'levelDown', pid: p.id, from: p.level, to: nl });
  p.level = Math.min(nl, W);
}

// ───────────────────────── эффекты (расплата и проклятия) ─────────────────────────
function applyFx(s, p, list, rng) {
  for (const f of list) {
    if (p.dead) break;
    switch (f.k) {
      case 'nothing': break;
      case 'levels': {
        const before = p.level;
        setLevel(s, p, p.level - f.n);
        log(s, `${p.name} теряет ${before - p.level} ур. (теперь ${p.level}).`, 'bad');
        break;
      }
      case 'slot': {
        let lost = [];
        if (f.slot === 'big') {
          const bigs = inPlayItems(p).filter(u => def(u).big).sort((a, b) => (def(b).bonus || 0) - (def(a).bonus || 0));
          if (bigs[0]) lost = [bigs[0]];
        } else if (f.slot === 'hands') lost = p.equipped.filter(u => def(u).slot === 'hand');
        else lost = p.equipped.filter(u => def(u).slot === f.slot);
        for (const u of lost) { removeItem(p, u); toDiscard(s, u); }
        log(s, lost.length ? `${p.name} теряет ${lost.map(u => q(def(u).name)).join(', ')}.` : `${p.name} нечего терять — повезло.`, 'bad');
        break;
      }
      case 'smallItem': {
        const pool = inPlayItems(p).filter(u => !def(u).big);
        if (!pool.length) { log(s, `У ${p.name} нет мелких вещей — повезло.`, 'bad'); break; }
        const u = pick(pool, rng); removeItem(p, u); toDiscard(s, u);
        log(s, `${p.name} теряет ${q(def(u).name)}.`, 'bad');
        break;
      }
      case 'bestItems': {
        const pool = inPlayItems(p).sort((a, b) => (def(b).value || 0) - (def(a).value || 0)).slice(0, f.n);
        for (const u of pool) { removeItem(p, u); toDiscard(s, u); }
        log(s, pool.length ? `${p.name} теряет ${pool.map(u => q(def(u).name)).join(', ')}.` : `${p.name} нечего терять.`, 'bad');
        break;
      }
      case 'allItems': {
        const pool = [...inPlayItems(p), ...(p.allyGear || [])];
        for (const u of pool) toDiscard(s, u);
        p.equipped = []; p.carried = []; p.allyGear = [];
        log(s, pool.length ? `${p.name} лишается всех вещей (${pool.length}).` : `${p.name} и так гол как сокол.`, 'bad');
        break;
      }
      case 'hand': {
        const n = p.hand.length;
        for (const u of p.hand) toDiscard(s, u);
        p.hand = [];
        log(s, `${p.name} сбрасывает всю руку (${n}).`, 'bad');
        break;
      }
      case 'cards': {
        let n = 0;
        for (let i = 0; i < f.n && p.hand.length; i++) {
          const u = pick(p.hand, rng); without(p.hand, u); toDiscard(s, u); n++;
        }
        log(s, `${p.name} сбрасывает ${n} карт(ы) с руки.`, 'bad');
        break;
      }
      case 'race': {
        if (!p.races.length) { log(s, `${p.name} и так человек — терять нечего.`, 'bad'); break; }
        const u = p.races.pop(); toDiscard(s, u);
        log(s, `${p.name} перестаёт быть: ${def(u).name}.`, 'bad');
        break;
      }
      case 'class': {
        if (!p.classes.length) { log(s, `У ${p.name} нет класса — терять нечего.`, 'bad'); break; }
        const u = p.classes.pop(); toDiscard(s, u);
        log(s, `${p.name} теряет класс: ${def(u).name}.`, 'bad');
        break;
      }
      case 'nextCombat':
        p.nextCombat += f.n;
        log(s, `${p.name}: ${f.n} в следующем бою.`, 'bad');
        break;
      case 'nextEscape':
        p.nextEscape = (p.nextEscape || 0) + f.n;
        log(s, `${p.name}: ${f.n} к побегу в следующем бою.`, 'bad');
        break;
      case 'giveToTop': {
        const top = s.players.filter(x => x !== p && !x.dead).sort((a, b) => b.level - a.level)[0];
        const pool = inPlayItems(p).filter(u => !def(u).big && !def(u).noSteal);
        if (!top || !pool.length) { log(s, `У ${p.name} нечего утащить.`, 'bad'); break; }
        const u = pick(pool, rng); removeItem(p, u); top.carried.push(u);
        log(s, `${top.name} прибирает к рукам ${q(def(u).name)} у ${p.name}.`, 'curse');
        break;
      }
      case 'death': kill(s, p, rng); break;
      case 'farewell': banish(s, p, rng); break;
    }
  }
  normalize(s, p);
}

function kill(s, p, rng) {
  const pool = [...p.equipped, ...p.carried, ...p.hand, ...(p.ally ? [p.ally] : []), ...(p.allyGear || [])];
  p.equipped = []; p.carried = []; p.hand = []; p.ally = null; p.allyGear = []; p.allySlots = null;
  // приручённый зверь дичает и убегает; несработавшая ловушка остаётся лежать
  if (p.beast) { toDiscard(s, p.beast); p.beast = null; }
  if (s.trap?.pid === p.id) { toDiscard(s, s.trap.uid); s.trap = null; if (s.turn.step === 'trap') s.turn.step = 'post'; }
  const looters = s.players.filter(x => x !== p && !x.dead).sort((a, b) => b.level - a.level);
  const taken = [];
  for (const x of looters) {
    if (!pool.length) break;
    const u = pick(pool, rng); without(pool, u); x.hand.push(u);
    taken.push(x.name);
  }
  for (const u of pool) toDiscard(s, u);
  const before = p.level;
  if (DEATH_LEVELS) setLevel(s, p, p.level - DEATH_LEVELS);
  p.dead = true; p.needsRevive = true;
  fx(s, { kind: 'death', pid: p.id });
  log(s, `💀 ${p.name} погибает${before > p.level ? ` и теряет ${before - p.level} ур. (теперь ${p.level})` : ''}. Раса и класс остаются.${taken.length ? ' Труп обшарили: ' + taken.join(', ') + '.' : ''} До своего хода — призрак.`, 'bad');
}

// «Прощай навсегда»: всё имущество и уровни — в сброс, герой выбывает из партии до открытия Ящика Пандоры
function banish(s, p, rng) {
  for (const u of [...p.equipped, ...p.carried, ...p.hand, ...(p.ally ? [p.ally] : []), ...(p.allyGear || []), ...(p.beast ? [p.beast] : [])]) toDiscard(s, u);
  p.equipped = []; p.carried = []; p.hand = []; p.ally = null; p.allyGear = []; p.allySlots = null; p.beast = null;
  if (p.level !== 1) fx(s, { kind: 'levelDown', pid: p.id, from: p.level, to: 1 });
  p.level = 1; p.nextCombat = 0; p.nextEscape = 0;
  p.banished = true; p.dead = true; p.needsRevive = false;
  // выбывший больше ни в чём не участвует
  s.trades = (s.trades || []).filter(x => x.from !== p.id && x.to !== p.id);
  if (s.trap?.pid === p.id) { toDiscard(s, s.trap.uid); s.trap = null; if (s.turn.step === 'trap') s.turn.step = 'post'; }
  if (s.tame?.pid === p.id) { toDiscard(s, s.tame.uid); s.tame = null; }
  if (s.duel && (s.duel.from === p.id || s.duel.to === p.id)) { toDiscard(s, s.duel.card); s.duel.used.forEach(u => toDiscard(s, u)); s.duel = null; }
  const c = s.combat;
  if (c) {
    if (c.helpReq?.to === p.id) c.helpReq = null;
    if (c.helper === p.id) { c.helper = null; c.helpOffer = 0; c.forced = false; }
    if (c.fighter === p.id) endCombat(s);
  }
  fx(s, { kind: 'farewell', pid: p.id });
  log(s, `⚰ ${p.name} получает «Прощай навсегда»: все вещи, карты и уровни пропали, герой выбывает из партии. Вернуть его может только Ящик Пандоры.`, 'bad');
  if (s.turn.pid === p.id && s.phase === 'playing') nextTurn(s, rng);
}
// открытый Ящик Пандоры возвращает всех выбывших: с 1-го уровня и со стартовыми картами
function unbanish(s, rng) {
  for (const x of s.players) {
    if (!x.banished) continue;
    x.banished = false; x.dead = false;
    for (let i = 0; i < startCards(s); i++) { give(x, draw(s, 'door', rng)); give(x, drawFor(s, x, rng)); }
    fx(s, { kind: 'reborn', pid: x.id });
    log(s, `📦 Ящик Пандоры выпускает ${x.name} из небытия: снова в игре с 1-го уровня и с новыми картами.`, 'good');
  }
}

function resolveCurse(s, target, uid, rng, byName, byId = null) {
  const d = def(uid);
  toDiscard(s, uid);
  const ward = target.hand.find(u => def(u).effect === 'ward');
  log(s, `${byName ? byName + ' насылает' : 'Сработало'} ${q(d.name)} на ${target.name}.`, 'curse');
  fx(s, { kind: 'curse', pid: target.id, card: uid, by: byId });
  if (locationOf(s)?.noCurses) { fx(s, { kind: 'ward', pid: target.id }); log(s, 'В тёплой котельной проклятие растаяло.', 'good'); return; }
  if (hasRace(target, 'molefolk') && d.fx.every(f => f.k === 'slot' && ['head', 'armor', 'feet'].includes(f.slot))) {
    fx(s, { kind: 'ward', pid: target.id });
    log(s, `Толстая шкура кротолюда ${target.name} не пропустила проклятие.`, 'good');
    return;
  }
  if (ward) {
    without(target.hand, ward); toDiscard(s, ward);
    fx(s, { kind: 'ward', pid: target.id });
    log(s, `Куриный бог ${target.name} отвёл проклятие.`, 'good');
    return;
  }
  if (hasClass(target, 'cleric')) {
    const r = d6(rng);
    fx(s, { kind: 'dice', pid: target.id, value: r, ok: r >= 5, label: 'Жрец отмаливает проклятие' });
    if (r >= 5) { fx(s, { kind: 'ward', pid: target.id }); log(s, `${target.name} отмолил проклятие (выпало ${r}).`, 'good'); return; }
  }
  applyFx(s, target, d.fx, rng);
}

// ───────────────────────── локации и события ─────────────────────────
function setLocation(s, p, uid) {
  if (s.location) toDiscard(s, s.location);
  s.location = uid;
  const d = def(uid);
  fx(s, { kind: 'location', pid: p.id, card: uid });
  log(s, `${p.name} открывает локацию ${q(d.name)}: ${fillText(s, d.text)}`, 'event');
  for (const x of s.players) normalize(s, x);
}

function resolveEvent(s, p, uid, rng) {
  const d = def(uid);
  const alive = s.players.filter(x => !x.dead);
  fx(s, { kind: 'event', pid: p.id, card: uid });
  log(s, `Событие ${q(d.name)}: ${fillText(s, d.text)}`, 'event');
  switch (d.event) {
    case 'quake':
      for (const x of alive) if (x.hand.length) { const u = pick(x.hand, rng); without(x.hand, u); toDiscard(s, u); }
      break;
    case 'light':
      for (const x of alive) if (hasClass(x, 'cleric') || hasClass(x, 'bard')) { setLevel(s, x, x.level + 1); log(s, `${x.name} получает уровень.`, 'good'); }
      break;
    case 'fair':
      for (const x of alive) give(x, drawFor(s, x, rng));
      break;
    case 'draft': {
      const picks = alive.map(x => (x.hand.length ? pick(x.hand, rng) : null));
      picks.forEach((u, i) => { if (u) without(alive[i].hand, u); });
      picks.forEach((u, i) => { if (u) alive[(i + 1) % alive.length].hand.push(u); });
      break;
    }
    case 'rollcall': {
      const min = Math.min(...alive.map(x => x.level));
      for (const x of alive) if (x.level === min) { setLevel(s, x, x.level + 1); log(s, `${x.name} догоняет: +1 уровень.`, 'good'); }
      break;
    }
    case 'luxtax':
      for (const x of alive) if (x.level >= luxLevel(s)) { setLevel(s, x, x.level - 1); log(s, `${x.name} платит налог: −1 уровень.`, 'bad'); }
      break;
    case 'shift': {
      // вся рука уходит соседу слева
      const hands = alive.map(x => x.hand);
      alive.forEach((x, i) => { x.hand = hands[(i - 1 + alive.length) % alive.length]; });
      break;
    }
    case 'union': {
      const top = Math.max(...alive.map(x => x.level));
      const leaders = alive.filter(x => x.level === top), votes = alive.length - leaders.length;
      if (votes * 2 > alive.length) {
        for (const x of leaders) setLevel(s, x, x.level - 1);
        log(s, `За — ${votes} из ${alive.length}: ${leaders.map(x => x.name).join(', ')} ${leaders.length > 1 ? 'теряют' : 'теряет'} уровень.`, 'bad');
      } else log(s, `За — ${votes} из ${alive.length}: большинства нет, лидеры остаются при своих.`, 'info');
      break;
    }
    case 'flood':
      for (const x of alive) {
        const shoes = x.equipped.filter(u => def(u).slot === 'feet' && !(def(u).tags || []).includes('water'));
        for (const u of shoes) { without(x.equipped, u); toDiscard(s, u); }
        if (shoes.length) log(s, `${x.name} теряет ${shoes.map(u => q(def(u).name)).join(', ')}.`, 'bad');
      }
      break;
  }
  toDiscard(s, uid);
}

// ───────────────────────── глубина ─────────────────────────
// Каждые несколько кругов подземелье уходит глубже: монстры (кроме боссов) злее, а с каждой третьей глубины — богаче.
const depthRule = s => DEPTH[winLevel(s)] || DEPTH[10];
export const depthEvery = s => depthRule(s).every;
export const depthMax = s => depthRule(s).max;
export const depthBonus = s => s.depth || 0;
export const depthTreasure = s => Math.floor((s.depth || 0) / DEPTH_TREASURE_EVERY);
function newRound(s, rng) {
  s.round = (s.round || 0) + 1;
  if (s.round % depthEvery(s) || (s.depth || 0) >= depthMax(s)) return;
  s.depth = (s.depth || 0) + 1;
  fx(s, { kind: 'depth', depth: s.depth, treasure: depthTreasure(s) });
  log(s, `⛏ Подземелье уходит глубже: глубина ${s.depth}${s.depth >= depthMax(s) ? ' — это дно' : ''}, монстры +${depthBonus(s)}${depthTreasure(s) ? `, за победу +${depthTreasure(s)} клада` : ''}.`, 'event');
}

// ───────────────────────── подземный рынок ─────────────────────────
// Открыт всегда: в свой ход вне боя можно купить разовые карты, зелья, проклятия и «Получи уровень» за голды из кошелька.
// Товар — только карты, которые ещё лежат в колоде (не в сбросе и не на руках), поэтому его число ограничено.
// Цену меняет локация (у каждой своя политика по разделам рынка) и «Ярмарочный день».
// «Шопоголик» (постоянный клиент рынка): потратил на рынке REGULAR_SPEND голдов. Статус видит только он сам
export const isRegular = p => (p?.spent || 0) >= REGULAR_SPEND;
export function shopPrice(s, d, p = null) {
  const pr = locationOf(s)?.prices || {};
  let m = pr[shopCat(d)] ?? pr.all ?? 1;
  if (s.opts?.dailyId === 'fair') m *= 0.75;
  let v = roundPrice(shopBase(d) * m);
  if (isRegular(p)) v = roundPrice(v * (1 - REGULAR_DISCOUNT));
  // ниже цены продажи не опускается: купить и тут же продать с выгодой нельзя
  return Math.max(v, (d.value || 0) + 50);
}
// когда можно покупать: в свой ход вне боя, а Шопоголику — в любой момент, даже в бою
export const buyErr = (s, p) => (isRegular(p) ? (p.dead ? 'Мёртвым на рынок нельзя' : null) : manageErr(s, p));
const stockUid = (s, id) => s.decks[def(id).deck].find(u => baseId(u) === id) || null;
export const shopStock = (s, id) => s.decks[def(id).deck].reduce((n, u) => n + (baseId(u) === id ? 1 : 0), 0);
export const shopList = (s, p = null) => SHOP_IDS.map(id => { const d = def(id); return { id, cat: shopCat(d), price: shopPrice(s, d, p), base: shopBase(d), stock: shopStock(s, id) }; });

// ───────────────────────── поединок ─────────────────────────
// Сила в поединке: уровень, вещи, расовые и классовые бонусы и «в следующем бою».
export const duelStrength = (s, p) => powerOf(s, p) + (p.nextCombat || 0);
export function duelNumbers(s) {
  const d = s.duel;
  if (!d) return null;
  const A = P(s, d.from), B = P(s, d.to);
  const mod = side => d.mods.filter(m => m.side === side).reduce((a, m) => a + m.n, 0);
  const a = duelStrength(s, A) + mod('from'), b = duelStrength(s, B) + mod('to');
  // «Роковая женщина»: при равенстве никто не проигрывает
  if (d.femme) return { from: a, to: b, winner: a > b ? A.id : b > a ? B.id : null };
  // при равенстве побеждает вызванный, а воин-зачинщик — и при равенстве
  const fromWins = a > b || (a === b && hasClass(A, 'warrior') && !hasClass(B, 'warrior'));
  return { from: a, to: b, winner: fromWins ? A.id : B.id };
}
// что отдаст проигравший: самую полезную вещь со стола (легендарки не отдаются)
const prizeScore = u => (def(u).bonus || 0) * 100 + (def(u).runBonus || 0) * 40 + (def(u).value || 0) / 10;
export const duelPrize = p => [...p.equipped, ...p.carried].filter(u => !def(u).noSteal && !isLegend(u)).sort((a, b) => prizeScore(b) - prizeScore(a))[0] || null;
// что потеряет проигравший из-за «Роковой женщины»: самую ценную большую вещь (легендарки не теряются)
export const femmeLoss = p => [...p.equipped, ...p.carried, ...(p.allyGear || [])].filter(u => def(u).big && !isLegend(u)).sort((a, b) => prizeScore(b) - prizeScore(a))[0] || null;
function resolveFemme(s, d, n) {
  const A = P(s, d.from), B = P(s, d.to);
  A.nextCombat = 0; B.nextCombat = 0;
  if (!n.winner) {
    fx(s, { kind: 'duelEnd', pid: null, loser: null, femme: true, from: A.id, to: B.id });
    log(s, `💋 Ничья: ${A.name} и ${B.name} разошлись целыми (${n.from} против ${n.to}) — «Роковая женщина» осталась ни с чем.`, 'info');
    return;
  }
  const W = P(s, n.winner), L = W === A ? B : A;
  const lost = femmeLoss(L);
  if (lost) { if (!removeItem(L, lost)) without(L.allyGear, lost); toDiscard(s, lost); }
  const before = L.level;
  setLevel(s, L, L.level - FEMME_LEVELS);
  normalize(s, L);
  fx(s, { kind: 'duelEnd', pid: W.id, loser: L.id, card: lost, femme: true, levels: before - L.level });
  log(s, `💋 ${W.name} одолевает ${L.name} (${n[W === A ? 'from' : 'to']} против ${n[L === A ? 'from' : 'to']}). ${L.name} теряет ${[lost && q(def(lost).name), before > L.level && `${before - L.level} ур.`].filter(Boolean).join(' и ') || 'только гордость'}.`, 'curse');
}
function resolveDuel(s) {
  const d = s.duel, n = duelNumbers(s);
  if (d.femme) { s.duel = null; toDiscard(s, d.card); d.used.forEach(u => toDiscard(s, u)); return resolveFemme(s, d, n); }
  const W = P(s, n.winner), L = P(s, n.winner === d.from ? d.to : d.from);
  s.duel = null;
  toDiscard(s, d.card); d.used.forEach(u => toDiscard(s, u));
  W.nextCombat = 0; L.nextCombat = 0;
  const prize = duelPrize(L);
  if (prize) { removeItem(L, prize); W.carried.push(prize); normalize(s, L); }
  fx(s, { kind: 'duelEnd', pid: W.id, loser: L.id, card: prize });
  log(s, `⚔ Поединок: ${W.name} одолевает ${L.name} (${n[W.id === d.from ? 'from' : 'to']} против ${n[L.id === d.from ? 'from' : 'to']})${prize ? ` и забирает ${q(def(prize).name)}` : ', но забрать у проигравшего нечего'}.`, W.id === d.from ? 'good' : 'combat');
}

// ───────────────────────── контракты ─────────────────────────
function newContract(s, p, rng, except = null) {
  const taken = new Set(s.players.map(x => x.contract?.id).filter(Boolean));
  let pool = CONTRACTS.filter(k => k.id !== except && !taken.has(k.id));
  if (!pool.length) pool = CONTRACTS.filter(k => k.id !== except);
  return { id: pick(pool, rng).id, progress: 0 };
}
function contractHits(s, k, ev, data) {
  if (k.ev !== ev) return 0;
  if (ev === 'kill') {
    const d = def(data.uid);
    if (k.tag && !(d.tags || []).includes(k.tag)) return 0;
    if (k.tags && !(d.tags || []).some(t => k.tags.includes(t))) return 0;
    if (k.minLevel && !(d.boss || monsterBaseLevel(s, d) >= k.minLevel)) return 0;
    return 1;
  }
  return data.n || 1;
}
function contractEvent(s, p, ev, data, rng) {
  if (!p || !p.contract || s.phase !== 'playing') return;
  const k = CONTRACT_DEFS[p.contract.id];
  const n = k ? contractHits(s, k, ev, data) : 0;
  if (!n) return;
  p.contract.progress = Math.min(k.need, p.contract.progress + n);
  if (p.contract.progress < k.need) return;
  // награда: уровень (последний уровень — только боем, поэтому тогда клад), отстающему ещё карта
  const others = s.players.filter(x => x !== p);
  const lowest = others.length && p.level <= Math.min(...others.map(x => x.level));
  let got;
  if (k.reward.gold) { p.gold = (p.gold || 0) + k.reward.gold; got = rewardText(k.reward); }
  else if (k.reward.levels && p.level + k.reward.levels < winLevel(s)) { setLevel(s, p, p.level + k.reward.levels); got = rewardText(k.reward); }
  else { const t = k.reward.treasures || 2; for (let i = 0; i < t; i++) give(p, drawFor(s, p, rng)); got = rewardText({ treasures: t }); }
  if (lowest) { give(p, drawFor(s, p, rng)); got += ' и ещё карта клада отстающему'; }
  p.contractsDone = (p.contractsDone || 0) + 1;
  fx(s, { kind: 'contract', pid: p.id, contract: k.id, reward: got });
  log(s, `📜 ${p.name} выполняет контракт ${q(k.name)} (${k.text.replace(/\.$/, '').toLowerCase()}): ${got}.`, 'good');
  p.contract = newContract(s, p, rng, k.id);
}
function checkOutfit(s, p, rng) {
  const slots = new Set(p.equipped.map(u => def(u).slot));
  if (slots.has('head') && slots.has('armor') && slots.has('feet')) contractEvent(s, p, 'outfit', {}, rng);
}

// ───────────────────────── обиды ─────────────────────────
// кто кому мешал: мстительные боты это помнят
function grudge(s, victimId, byId) {
  if (!victimId || !byId || victimId === byId) return;
  const g = (s.grudges ||= {});
  const v = (g[victimId] ||= {});
  v[byId] = (v[byId] || 0) + 1;
}
export const grudgeOf = (s, victimId, byId) => s.grudges?.[victimId]?.[byId] || 0;

// ───────────────────────── ход ─────────────────────────
function beginTurn(s, idx, rng) {
  const p = s.players[idx];
  s.turn = { idx, pid: p.id, step: 'pre', n: (s.turn?.n || 0) + 1, halflingSold: false, hoardPlayed: false, distilled: false, haunted: [] };
  if (s.turn.n > 1 && (s.turn.n - 1) % s.players.length === 0) newRound(s, rng);
  s.reveal = null;
  for (const x of s.players) x.dead = !!x.banished; // выбывшие «Прощай навсегда» остаются вне игры
  // зверь, которого так и не приручили, уходит в темноту
  if (s.tame) { log(s, `${q(def(s.tame.uid).name)} не дождался хозяина и ушёл в темноту.`, 'info'); toDiscard(s, s.tame.uid); s.tame = null; }
  if (p.needsRevive) {
    for (let i = 0; i < 4; i++) { give(p, draw(s, 'door', rng)); give(p, drawFor(s, p, rng)); }
    p.needsRevive = false;
    log(s, `${p.name} возвращается из мёртвых с новыми картами.`, 'good');
  }
  if (allyN(p, 'fee')) payFee(s, p);
  log(s, `Ход: ${p.name}.`, 'turn');
}
// ход переходит к следующему, кто не выбыл из партии
function nextTurn(s, rng) {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) { const idx = (s.turn.idx + i) % n; if (!s.players[idx].banished) return beginTurn(s, idx, rng); }
  beginTurn(s, (s.turn.idx + 1) % n, rng);
}
// наёмнику платят в начале хода самой дешёвой картой ценой от fee (из руки или с запасных вещей), иначе он уходит
function payFee(s, p) {
  const d = allyOf(p);
  if ((p.gold || 0) >= d.fee) {
    p.gold -= d.fee;
    log(s, `${p.name} платит ${q(d.name)} ${d.fee} голдов из кошелька.`, 'info');
    return;
  }
  const pool = [...p.hand, ...p.carried].filter(u => (def(u).value || 0) >= d.fee && !isLegend(u))
    .sort((a, b) => (def(a).value - def(b).value) || (cardWorth(a) - cardWorth(b)));
  if (pool.length) {
    const u = pool[0];
    if (!without(p.hand, u)) without(p.carried, u);
    toDiscard(s, u);
    log(s, `${p.name} платит ${q(d.name)}: ${q(def(u).name)}.`, 'info');
    return;
  }
  toDiscard(s, p.ally); releaseAlly(p); p.ally = null; normalize(s, p);
  fx(s, { kind: 'allyGone', pid: p.id });
  log(s, `Платить нечем — ${q(d.name)} уходит от ${p.name}.`, 'bad');
}

// ───────────────────────── ловушки ─────────────────────────
const trapSkill = p => (hasClass(p, 'rogue') ? TRAP_SKILL : 0) + (hasClass(p, 'engineer') ? TRAP_SKILL : 0);
export const trapNeed = p => Math.max(1, TRAP_ROLL - trapSkill(p));
// противогаз не пускает газ, канарейка его чует
function trapGuard(p, d) {
  const tags = d.tags || [];
  if (tags.some(t => itemList(p, 'immune').includes(t))) return 'Противогаз не пропустил газ';
  if (tags.includes('gas') && itemFlag(p, 'noAmbush')) return 'Канарейка учуяла газ';
  return null;
}
function trapRoll(s, p, d, rng) {
  const r = d6(rng), ok = r >= trapNeed(p);
  fx(s, { kind: 'dice', pid: p.id, value: r, bonus: trapSkill(p), ok, label: `Обезвредить ${q(d.name)}` });
  return { r, ok };
}
// подложенная соперником ловушка: бросок на обезвреживание делается сразу, без штрафа за неудачу и без трофея
function trapOn(s, t, uid, rng, by) {
  const d = def(uid);
  toDiscard(s, uid);
  fx(s, { kind: 'trap', pid: t.id, card: uid, by: by.id });
  log(s, `${by.name} подкладывает ${q(d.name)} под ноги ${t.name}.`, 'curse');
  const guard = trapGuard(t, d);
  if (guard) { log(s, `${guard} — ${t.name} цел.`, 'good'); return; }
  const { r, ok } = trapRoll(s, t, d, rng);
  if (ok) { log(s, `${t.name} замечает ловушку и обезвреживает её (выпало ${r}).`, 'good'); return; }
  log(s, `${t.name} попадается (выпало ${r}). ${d.text}`, 'bad');
  applyFx(s, t, d.fx, rng);
}

// ───────────────────────── бой ─────────────────────────
export function participants(s) {
  const c = s.combat;
  return c ? [c.fighter, c.helper].filter(Boolean) : [];
}
const isParticipant = (s, pid) => participants(s).includes(pid);
function matchVs(p, vs) { return (vs.cls && hasClass(p, vs.cls)) || (vs.race && hasRace(p, vs.race)); }

// в бою есть монстр, против которого считается только уровень героя
export const levelOnlyFight = s => !!s.combat?.monsters.some(m => def(m.uid).levelOnly);
export function heroStrength(s, p) {
  const c = s.combat;
  if (c && levelOnlyFight(s)) return p.level;
  let v = p.level + itemBonus(p, s) + passiveBonus(s, p) + p.nextCombat;
  if (c && hasClass(p, 'engineer') && combatHasTag(s, 'machine')) v += ENGINEER_VS_MACHINE;
  if (c) {
    v += (c.rage[p.id] || 0) + (c.turnUndead[p.id] || 0);
    v -= c.backstabs.filter(b => b.on === p.id).length * 2;
  }
  return v;
}
export function monsterBaseLevel(s, d) {
  return d.mirror != null ? Math.max(...s.players.map(x => x.level)) + d.mirror : d.level;
}
export function bossPower(s, p) {
  return Math.max(BOSS_FLOOR, p ? BOSS_MULT * heroStrength(s, p) : 0);
}
export function monsterStrength(s, m) {
  const d = def(m.uid);
  // сила босса запоминается, когда он выходит в бой: вдвое больше силы героя; усилители и локации её не меняют
  if (d.boss) return m.power ?? bossPower(s, P(s, s.combat?.fighter));
  const parts = participants(s).map(id => P(s, id));
  // крысиный король сдаётся при виде крысоловки, банник в таверне парится
  if (d.slainBy && parts.some(p => p.equipped.some(u => def(u).id === d.slainBy))) return 0;
  if (d.sleepsIn && s.location && def(s.location).id === d.sleepsIn) return 0;
  let base = monsterBaseLevel(s, d) + (d.perPlayer || 0) * s.players.length - SPLIT_STEP * (s.splits?.[m.uid] || 0);
  if (m.enh.some(u => def(u).double)) base *= 2;
  let v = base + m.enh.reduce((a, u) => a + (def(u).bonus || 0), 0);
  if (d.helperCut && s.combat?.helper) v -= d.helperCut;
  if (d.roundMod) v += (s.round || 0) % 2 === 0 ? d.roundMod.even : d.roundMod.odd;
  for (const vs of d.vs || []) if (parts.some(p => matchVs(p, vs))) v += vs.n;
  for (const w of d.vsItem || []) if (parts.some(p => hasItemTag(p, w.tag))) v += w.n;
  for (const p of parts) for (const u of p.equipped) { const fm = def(u).foeMod; if (fm && (d.tags || []).includes(fm.tag)) v += fm.n; }
  if (d.soloBonus && s.combat && !s.combat.helper) v += d.soloBonus;
  v += depthBonus(s);
  const L = locationOf(s);
  if (L) {
    v += L.monsterAll || 0;
    for (const t of L.monsterTag || []) if ((d.tags || []).includes(t.tag)) v += t.n;
  }
  return v;
}
function monsterTreasure(s, m) {
  const d = def(m.uid);
  let t = d.treasures + m.enh.reduce((a, u) => a + (def(u).treasureDelta || 0), 0);
  const f = P(s, s.combat.fighter);
  if (d.bonusTreasureVs && matchVs(f, d.bonusTreasureVs)) t += d.bonusTreasureVs.n;
  return Math.max(0, t);
}
export function combatNumbers(s) {
  const c = s.combat;
  if (!c) return null;
  const parts = participants(s).map(id => P(s, id));
  const heroes = parts.reduce((a, p) => a + heroStrength(s, p), 0)
    + (levelOnlyFight(s) ? 0 : c.mods.filter(m => m.side === 'player').reduce((a, m) => a + m.n, 0));
  const perMonster = c.monsters.map(m => monsterStrength(s, m));
  const monsters = perMonster.reduce((a, b) => a + b, 0)
    + c.mods.filter(m => m.side === 'monster').reduce((a, m) => a + m.n, 0);
  const warrior = parts.some(p => hasClass(p, 'warrior'));
  const winning = c.monsters.length > 0 && (heroes > monsters || (warrior && heroes === monsters));
  const f = P(s, c.fighter);
  let bonusT = 0;
  if (c.monsters.length) {
    bonusT += locationOf(s)?.treasureBonus || 0;
    bonusT += depthTreasure(s);
    // бард берёт лишнюю карту, только когда побеждает сам
    if (hasClass(f, 'bard') && !c.helper) bonusT += 1;
    if (hasRace(f, 'orc') && c.monsters.some(m => monsterBaseLevel(s, def(m.uid)) >= 10)) bonusT += 1;
  }
  // Клад делится так: помощник получает ровно обещанное, остальное — тому, кто дрался.
  // Бонусы помощника (гоблин, таверна) — это лишние карты из колоды сверху, а не из доли бойца.
  const base = c.monsters.reduce((a, m) => a + monsterTreasure(s, m), 0) + (c.charmTreasure || 0) + bonusT;
  const extra = c.helper && c.monsters.length ? helperExtra(s, P(s, c.helper)) : 0;
  const treasures = base + extra;
  const helperShare = c.helper ? Math.min(c.helpOffer || 0, base) + extra : 0;
  const levels = c.monsters.reduce((a, m) => a + (def(m.uid).levels || 1), 0) + (c.monsters.length ? locationOf(s)?.levelBonus || 0 : 0);
  return { heroes, monsters, winning, warrior, perMonster, treasures, levels, helperShare, helperExtra: extra };
}

function startCombat(s, p, monsterUid, rng = Math.random) {
  s.combat = {
    fighter: p.id, helper: null, helpOffer: 0, helpReq: null,
    monsters: [{ uid: monsterUid, enh: [] }],
    mods: [], used: [], rage: {}, rageCount: {}, turnUndead: {}, turnCount: {}, escape: {}, escapeCount: {},
    backstabs: [], charmTreasure: 0, winAt: null, declined: [], lullaby: {},
  };
  s.turn.step = 'combat';
  const d = def(monsterUid);
  const m0 = s.combat.monsters[0];
  if (d.boss) m0.power = bossPower(s, p);
  log(s, `${p.name} встречает ${q(d.name)} (ур. ${monsterBaseLevel(s, d)}). Бой!`, 'combat');
  if (d.boss) log(s, `👹 Это босс! Его сила — ${m0.power}: ${m0.power > BOSS_FLOOR ? `вдвое больше силы ${p.name}` : `слабее ${BOSS_FLOOR} боссы не бывают`}. ${p.level < BOSS_MIN_LEVEL ? `За героями ниже ${BOSS_MIN_LEVEL}-го уровня он не гонится.` : 'Не одолеешь и не убежишь — −5 уровней и смерть.'}`, 'bad');
  fx(s, { kind: 'combat', pid: p.id, card: monsterUid, ...(d.boss ? { power: m0.power } : {}) });
  if (d.onAppear) bossAppear(s, d, p, rng);
  if (d.ambush) {
    const guard = itemFlag(p, 'noAmbush') ? 'Канарейка заранее подняла тревогу' : monTags(monsterUid).some(t => itemList(p, 'immune').includes(t)) ? 'Противогаз не пропустил споры' : null;
    if (guard) log(s, `${guard} — засада ${q(d.name)} не удалась.`, 'good');
    else {
      log(s, d.ambush.text, 'bad');
      fx(s, { kind: 'ambush', pid: p.id, card: monsterUid });
      applyFx(s, p, d.ambush.fx, rng);
    }
  }
}

// особые боссы при появлении: Морена морозит лучшую вещь каждого, Чернобог отнимает по карте у всех, кроме бойца
function bossAppear(s, d, fighter, rng) {
  if (d.onAppear === 'freeze') {
    const hit = [];
    for (const x of s.players) {
      const best = [...x.equipped].sort((a, b) => (def(b).bonus || 0) - (def(a).bonus || 0))[0];
      if (best) { without(x.equipped, best); x.carried.push(best); hit.push(`${x.name} — ${q(def(best).name)}`); }
    }
    log(s, `❄ ${q(d.name)} дышит стужей: ${hit.length ? 'примерзло и снято: ' + hit.join(', ') : 'снимать нечего'}.`, 'bad');
  }
  if (d.onAppear === 'grab') {
    const hit = [];
    for (const x of s.players) {
      if (x === fighter || !x.hand.length) continue;
      const u = pick(x.hand, rng); without(x.hand, u); toDiscard(s, u); hit.push(x.name);
    }
    log(s, `${q(d.name)} тянет руки из тьмы: ${hit.length ? 'по карте теряют ' + hit.join(', ') : 'отнимать не у кого'}.`, 'bad');
  }
}

function endCombat(s) {
  const c = s.combat;
  for (const m of c.monsters) { toDiscard(s, m.uid); m.enh.forEach(u => toDiscard(s, u)); if (s.splits) delete s.splits[m.uid]; }
  c.used.forEach(u => toDiscard(s, u));
  for (const pid of participants(s)) { const p = P(s, pid); if (p) { p.nextCombat = 0; p.nextEscape = 0; } }
  s.combat = null;
  s.turn.step = 'charity';
}

function removeMonster(s, idx) {
  const c = s.combat;
  const [m] = c.monsters.splice(idx, 1);
  toDiscard(s, m.uid); m.enh.forEach(u => toDiscard(s, u));
  return m;
}

// сколько лишних карт клада помощник берёт сверху обещанного
function helperExtra(s, h) {
  if (!h || s.combat?.forced) return 0;
  return (hasRace(h, 'goblin') ? 1 : 0) + (locationOf(s)?.helperBonus || 0);
}

function shareTreasure(s, count, rng, want = 0) {
  const c = s.combat;
  const f = P(s, c.fighter);
  const h = c.helper ? P(s, c.helper) : null;
  if (!h) want = 0;
  const drawn = [];
  for (let i = 0; i < count; i++) { const u = draw(s, 'treasure', rng); if (u) drawn.push(u); }
  shuffle(drawn, rng);
  const share = h ? Math.min(want, drawn.length) : 0;
  const hp = drawn.slice(0, share), fp = drawn.slice(share);
  // заказанная карта подменяет одну из своих карт клада, а та возвращается на верх колоды
  for (const [x, part] of [[f, fp], [h, hp]]) {
    for (let i = 0; x && i < part.length && s.orders?.[x.id]; i++) {
      const u = takeOrder(s, x);
      if (u) { s.decks.treasure.push(part[i]); part[i] = u; }
    }
  }
  if (h) h.hand.push(...hp);
  f.hand.push(...fp);
  return { total: drawn.length, share };
}

function afterMonstersGone(s, rng) {
  // все монстры убраны без убийства: только клад за усыплённых
  const c = s.combat;
  if (c.charmTreasure) {
    const r = shareTreasure(s, c.charmTreasure, rng, Math.min(c.helpOffer || 0, c.charmTreasure));
    log(s, `Бой окончен без убийства. Клад за усыплённых: ${r.total}.`, 'good');
  } else log(s, 'Монстров больше нет — бой окончен без наград.', 'info');
  endCombat(s);
}

function resolveVictory(s, rng) {
  const c = s.combat;
  const n = combatNumbers(s);
  const f = P(s, c.fighter);
  const h = c.helper ? P(s, c.helper) : null;
  const names = c.monsters.map(m => q(def(m.uid).name)).join(', ');
  setLevel(s, f, f.level + n.levels, { canWin: true });
  if (h && hasRace(h, 'elf')) setLevel(s, h, h.level + c.monsters.length, { canWin: true });
  const r = shareTreasure(s, n.treasures, rng, n.helperShare);
  fx(s, { kind: 'victory', pid: f.id, helper: c.helper || null, cards: c.monsters.map(m => m.uid), levels: n.levels, treasures: r.total });
  log(s, `⚔️ ${f.name}${h ? ' и ' + h.name : ''} ${h ? 'побеждают' : 'побеждает'} ${names}! ${f.name} получает +${n.levels} ур. и ${r.total - r.share} клада${h && r.share ? `, ${h.name} — ${r.share}` : ''}.`, 'good');
  for (const m of c.monsters) contractEvent(s, f, 'kill', { uid: m.uid }, rng);
  // рой не погибает, а разлетается и ждёт за следующей дверью — слабее
  for (const m of [...c.monsters]) {
    const d = def(m.uid), gen = (s.splits?.[m.uid] || 0) + 1;
    if (!d.split || gen > d.split) continue;
    c.monsters = c.monsters.filter(x => x !== m);
    m.enh.forEach(u => toDiscard(s, u));
    (s.splits ||= {})[m.uid] = gen;
    s.decks.door.push(m.uid);
    log(s, `${q(d.name)} разлетается — рой поменьше (−${SPLIT_STEP * gen}) ждёт за следующей дверью.`, 'event');
  }
  if (!h) contractEvent(s, f, 'killSolo', {}, rng);
  if (c.trouble) contractEvent(s, f, 'troubleWin', {}, rng);
  if (h) contractEvent(s, h, 'helpWin', {}, rng);
  // зверя, побеждённого с большим перевесом, можно приручить до конца хода
  const margin = n.heroes - n.monsters;
  const wild = margin >= tameMargin(s, f) ? c.monsters.filter(m => canTame(m.uid)).sort((a, b) => def(b.uid).level - def(a.uid).level)[0] : null;
  if (wild) {
    c.monsters = c.monsters.filter(x => x !== wild);
    wild.enh.forEach(u => toDiscard(s, u));
    if (s.tame) toDiscard(s, s.tame.uid);
    s.tame = { pid: f.id, uid: wild.uid };
    fx(s, { kind: 'tamable', pid: f.id, card: wild.uid });
    log(s, `${q(def(wild.uid).name)} побеждён с перевесом ${margin} и признаёт силу ${f.name}: его можно приручить до конца хода (питомец, +${tameBonus(def(wild.uid))}).`, 'event');
  }
  endCombat(s);
  const winners = [f, h].filter(x => x && x.level >= winLevel(s));
  if (winners.length) {
    s.phase = 'ended';
    s.winners = winners.map(x => x.id);
    log(s, `🏆 ${winners.map(x => x.name).join(' и ')} достигает ${winLevel(s)}-го уровня и побеждает!`, 'win');
  }
}

const canTame = uid => { const d = def(uid); return (d.tags || []).includes('beast') && !d.boss && !d.split; };

function resolveEscape(s, rng) {
  const c = s.combat;
  for (const pid of participants(s)) {
    const p = P(s, pid);
    for (const m of [...c.monsters]) {
      if (p.dead) break;
      const d = def(m.uid);
      if (d.noPursue && p.level <= d.noPursue) {
        fx(s, { kind: 'escaped', pid, card: m.uid, calm: true });
        log(s, `${q(d.name)} не стал гнаться за ${p.name}.`, 'good');
        continue;
      }
      if (monTags(m.uid).some(t => itemList(p, 'calm').includes(t))) {
        fx(s, { kind: 'escaped', pid, card: m.uid, calm: true });
        log(s, `${q(d.name)} принимает ${p.name} за своего и не гонится.`, 'good');
        continue;
      }
      if (hasClass(p, 'warlock')) {
        fx(s, { kind: 'escaped', pid, card: m.uid, shadow: true });
        log(s, `Чернокнижник ${p.name} уходит тенью от ${q(d.name)} — без броска.`, 'good');
        contractEvent(s, p, 'escape', {}, rng);
        continue;
      }
      const noEsc = d.escape === false || m.enh.some(u => def(u).noEscape);
      const bonus = runBonusOf(s, p) + (c.escape[pid] || 0) + (d.escapeMod || 0) - (c.pandora ? PANDORA_ESCAPE : 0);
      let r = 0, ok = false;
      if (noEsc) log(s, `От ${q(d.name)} не убежать!`, 'bad');
      else {
        // от поезда-призрака спасает только шестёрка: бонусы к побегу не помогают
        const pass = x => (d.escapeOn ? x >= d.escapeOn : x + bonus >= 5);
        r = d6(rng);
        ok = pass(r);
        fx(s, { kind: 'dice', pid, value: r, bonus: d.escapeOn ? 0 : bonus, ok, label: `Побег от ${q(d.name)}` });
        if (!ok && hasRace(p, 'halfling') && p.hand.length) {
          const u = cheapest(p.hand);
          without(p.hand, u); toDiscard(s, u);
          r = d6(rng); ok = pass(r);
          fx(s, { kind: 'dice', pid, value: r, bonus, ok, label: 'Полурослик перебрасывает' });
          log(s, `${p.name} сбрасывает карту и перебрасывает.`, 'info');
        }
      }
      const sign = bonus ? (bonus > 0 ? '+' : '') + bonus : '';
      if (ok) { fx(s, { kind: 'escaped', pid, card: m.uid }); log(s, `${p.name} удирает от ${q(d.name)} (${r}${sign}).`, 'good'); contractEvent(s, p, 'escape', {}, rng); continue; }
      // открытый Ящик Пандоры: не убежавший теряет все вещи и питомца (один раз за бой)
      if (c.pandora && !(c.pandoraHit ||= []).includes(pid)) { c.pandoraHit.push(pid); pandoraLoss(s, p, rng); }
      if (monTags(m.uid).some(t => itemList(p, 'immune').includes(t))) {
        fx(s, { kind: 'escaped', pid, card: m.uid, calm: true });
        log(s, `${p.name} не убежал от ${q(d.name)}, но противогаз спас от расплаты.`, 'good');
        continue;
      }
      const pet = p.equipped.find(u => def(u).slot === 'pet' && def(u).petSave !== false) || p.beast;
      if (pet) {
        if (pet === p.beast) p.beast = null; else removeItem(p, pet);
        toDiscard(s, pet);
        fx(s, { kind: 'pet', pid, card: pet, mon: m.uid });
        log(s, `${def(pet).type === 'monster' ? 'Приручённый ' : ''}${q(def(pet).name)} бросается на ${q(d.name)} и спасает ${p.name} от расплаты!`, 'good');
        continue;
      }
      fx(s, { kind: 'caught', pid, card: m.uid });
      log(s, `${p.name} не убежал от ${q(d.name)}${noEsc ? '' : ` (${r}${sign})`}. ${d.bad.text}`, 'bad');
      applyFx(s, p, d.bad.fx, rng);
    }
  }
  endCombat(s);
}

export function cardWorth(uid) {
  const d = def(uid);
  if (d.rarity === 'legendary') return 5000;
  if (d.type === 'levelup') return 900;
  if (d.type === 'monster') return d.boss ? 600 : 50 + (d.level || 10) * 10;
  if (d.type === 'buff') return 250 + d.bonus * 60;
  if (d.type === 'location' || d.type === 'event') return 250;
  return (d.value || 0) + (d.bonus || 0) * 50 + 100;
}
function cheapest(list) { return [...list].sort((a, b) => cardWorth(a) - cardWorth(b))[0]; }

// ───────────────────────── проверки ─────────────────────────
const myTurn = (s, p) => s.turn.pid === p.id;
const manageErr = (s, p) => (!myTurn(s, p) ? 'Сейчас не ваш ход'
  : s.combat ? 'Нельзя во время боя'
  : s.duel ? 'Идёт поединок'
  : p.dead ? 'Вы мертвы до начала следующего хода' : null);
const allInHand = (p, cards) => Array.isArray(cards) && cards.length > 0
  && new Set(cards).size === cards.length && cards.every(u => p.hand.includes(u));

const H = {};

H.kick = {
  check: (s, p) => manageErr(s, p) || (s.turn.step !== 'pre' ? 'Дверь в этот ход уже выбита' : null),
  run(s, p, a, rng) {
    const uid = draw(s, 'door', rng);
    if (!uid) { log(s, 'Проходы закончились.', 'sys'); s.turn.step = 'post'; return; }
    const d = def(uid);
    s.reveal = { uid, by: p.id, seq: ++s.revealSeq };
    fx(s, { kind: 'reveal', pid: p.id, card: uid });
    if (d.type === 'monster') { startCombat(s, p, uid, rng); return; }
    s.turn.step = 'post';
    if (d.type === 'curse' && d.keep) { p.hand.push(uid); log(s, `${p.name} находит за дверью ${q(d.name)} — такое проклятие на себя не срабатывает, оно уходит в руку.`, 'event'); return; }
    if (d.type === 'curse') { resolveCurse(s, p, uid, rng, null); return; }
    if (d.type === 'trap') {
      const guard = trapGuard(p, d);
      if (guard) { p.hand.push(uid); log(s, `${guard} — ${p.name} забирает ${q(d.name)} себе.`, 'good'); return; }
      s.trap = { pid: p.id, uid };
      s.turn.step = 'trap';
      fx(s, { kind: 'trap', pid: p.id, card: uid });
      log(s, `${p.name} попадает в ловушку ${q(d.name)}: обезвредить (${trapNeed(p)}+ на кубике) или принять расплату?`, 'bad');
      return;
    }
    if (d.type === 'location') { setLocation(s, p, uid); return; }
    if (d.type === 'event') { resolveEvent(s, p, uid, rng); return; }
    p.hand.push(uid);
    log(s, `${p.name} выбивает дверь: ${q(d.name)} — в руку.`, 'info');
  },
};

// Неприятности ищут по глубине: у поверхности выходит мелочь, чем глубже — тем крупнее монстры,
// боссы — только в самой глубине. Окно уровней растёт от «0–6» наверху до «8 и выше» на дне.
export function troubleBand(s) {
  const f = Math.min(1, (s.depth || 0) / Math.max(1, depthMax(s)));
  return { min: Math.floor(8 * f), max: Math.round(6 + 16 * f) + (f >= 1 ? 99 : 0), boss: f >= 2 / 3 };
}
const troubleLevel = d => (d.boss ? 99 : d.level || 0);
// монстр наугад из колоды проходов (а если там пусто — из сброса) в окне глубины;
// если в окне никого, берётся ближайший к нему по уровню
function troubleMonster(s, rng) {
  const b = troubleBand(s);
  for (const pile of [s.decks.door, s.discard.door]) {
    const list = pile.filter(u => def(u).type === 'monster');
    if (!list.length) continue;
    const fit = list.filter(u => { const d = def(u); return d.boss ? b.boss : d.level >= b.min && d.level <= b.max; });
    const dist = u => { const L = troubleLevel(def(u)); return L < b.min ? b.min - L : L > b.max ? L - b.max : 0; };
    const near = fit.length ? fit : (() => { const m = Math.min(...list.map(dist)); return list.filter(u => dist(u) === m); })();
    const u = pick(near, rng); without(pile, u); return u;
  }
  return null;
}
const handMonsters = p => p.hand.filter(u => def(u).type === 'monster');
H.lookForTrouble = {
  check(s, p) {
    return manageErr(s, p) || (s.turn.step !== 'post' ? 'Искать неприятности можно после выбитой двери без монстра' : null)
      || (handMonsters(p).length ? 'На руке есть монстры — сразитесь с одним из них' : null)
      || (![...s.decks.door, ...s.discard.door].some(u => def(u).type === 'monster') ? 'Монстры в колоде кончились' : null);
  },
  run(s, p, a, rng) {
    const uid = troubleMonster(s, rng);
    s.reveal = { uid, by: p.id, seq: ++s.revealSeq };
    fx(s, { kind: 'reveal', pid: p.id, card: uid });
    log(s, `${p.name} ищет неприятности — и находит!`, 'combat');
    startCombat(s, p, uid, rng);
    // разбуженный монстр злее; боссов это не касается — их сила и так считается по герою
    if (s.combat) s.combat.trouble = true;
    if (s.combat && !def(uid).boss) {
      s.combat.mods.push({ side: 'monster', n: TROUBLE_BONUS, by: p.id, uid: null, label: 'Разбуженный монстр', anon: true });
      log(s, `Разбуженный монстр злее: +${TROUBLE_BONUS} к силе.`, 'bad');
    }
  },
};

H.loot = {
  check: (s, p) => manageErr(s, p) || (s.turn.step !== 'post' ? 'Обшарить комнату можно после выбитой двери без монстра' : null),
  run(s, p, a, rng) {
    give(p, draw(s, 'door', rng));
    s.turn.step = 'charity';
    log(s, `${p.name} обшаривает комнату и берёт карту прохода втёмную.`, 'info');
    contractEvent(s, p, 'loot', {}, rng);
  },
};

H.endTurn = {
  check(s, p, a) {
    if (!myTurn(s, p)) return 'Сейчас не ваш ход';
    if (s.combat) return 'Нельзя во время боя';
    if (s.duel) return 'Идёт поединок';
    if (s.turn.step !== 'charity') return s.turn.step === 'pre' ? 'Сначала выбейте дверь' : 'Сначала ищите неприятности или обшарьте комнату';
    const excess = Math.max(0, p.hand.length - handLimit(p, s));
    const g = a.give || [];
    if (excess === 0) return g.length ? 'Отдавать ничего не нужно' : null;
    if (g.length !== excess || !allInHand(p, g)) return `Нужно отдать ровно ${excess} карт(ы) из руки`;
    return null;
  },
  run(s, p, a, rng) {
    const g = a.give || [];
    if (g.length) {
      const others = s.players.filter(x => x !== p && !x.dead);
      const minLvl = Math.min(...others.map(x => x.level));
      if (!others.length || p.level <= minLvl) {
        g.forEach(u => { without(p.hand, u); toDiscard(s, u); });
        log(s, `${p.name} сбрасывает ${g.length} лишн. карт(ы).`, 'info');
      } else {
        const poor = others.filter(x => x.level === minLvl);
        g.forEach((u, i) => { without(p.hand, u); poor[i % poor.length].hand.push(u); });
        log(s, `Благотворительность: ${p.name} отдаёт ${g.length} карт(ы) — ${poor.map(x => x.name).join(', ')}.`, 'info');
      }
    }
    nextTurn(s, rng);
  },
};

function playCheck(s, p, a) {
  if (p.dead) return 'Вы мертвы до начала следующего хода';
  if (!p.hand.includes(a.uid)) return 'Карты нет в руке';
  const d = def(a.uid);
  const c = s.combat;
  switch (d.type) {
    case 'race': {
      const e = manageErr(s, p); if (e) return e;
      if (hasRace(p, d.race)) return 'Вы уже ' + d.name;
      return null;
    }
    case 'class': {
      const e = manageErr(s, p); if (e) return e;
      if (hasClass(p, d.cls)) return 'Вы уже ' + d.name;
      return null;
    }
    case 'halfbreed': return manageErr(s, p) || (p.halfbreed ? 'Уже есть' : null);
    case 'supermunch': return manageErr(s, p) || (p.supermunch ? 'Уже есть' : null);
    case 'item': return manageErr(s, p);
    case 'ally': return manageErr(s, p);
    case 'duel': {
      const e = manageErr(s, p); if (e) return e;
      if (s.turn.step === 'trap') return 'Сначала разберитесь с ловушкой';
      if (d.femme) {
        const t = P(s, a.target), w = P(s, a.with);
        if (!t || !w || t === w) return 'Выберите двух соперников';
        if (t === p || w === p) return 'Роковую женщину подсылают к двум соперникам';
        if (t.dead || w.dead) return 'Мёртвые не дерутся';
        return null;
      }
      const t = P(s, a.target);
      if (!t || t === p) return 'Кого вызвать?';
      if (t.dead) return 'Мёртвых на поединок не вызывают';
      return null;
    }
    case 'location': return manageErr(s, p);
    case 'event': return manageErr(s, p);
    case 'buff': return c && isParticipant(s, p.id) && levelOnlyFight(s) ? 'Против этого монстра считается только уровень — зелье пропадёт зря' : null;
    case 'hoard': return manageErr(s, p) || (s.turn.hoardPlayed ? 'Схрон можно открыть только один раз за ход' : null);
    case 'levelup': return p.level >= winLevel(s) - 1 ? 'Последний уровень — только убийством монстра' : null;
    case 'jackpot': return null;
    case 'curse': case 'trap': {
      const t = P(s, a.target);
      if (!t || t === p) return 'Выберите жертву';
      if (t.dead) return 'Жертва уже мертва';
      return null;
    }
    case 'enhancer':
      if (!c) return 'Только во время боя';
      if (!Number.isInteger(a.monster) || !c.monsters[a.monster]) return 'Выберите монстра';
      if (def(c.monsters[a.monster].uid).boss) return 'На босса усилители не действуют: его сила — вдвое больше силы героя';
      return null;
    case 'wandering':
      if (!c) return 'Только во время боя';
      if (participants(s).some(id => itemFlag(P(s, id), 'noWandering'))) return 'Щит-турникет: в этот бой монстров по одному';
      if (!a.with || a.with === a.uid || !p.hand.includes(a.with) || def(a.with).type !== 'monster') return 'Нужен монстр из руки';
      return null;
    case 'oneshot':
      if (d.effect === 'ward') return 'Срабатывает сам, когда на вас насылают проклятие';
      if (!c && s.duel && d.effect === 'bonus') return a.side === 'from' || a.side === 'to' ? null : 'Выберите, за кого в поединке';
      if (!c) return 'Только во время боя';
      if (d.effect === 'enslave') {
        if (c.fighter !== p.id) return 'Только в своём бою';
        if (c.helper) return 'Помощник уже есть';
        if (c.monsters.some(m => def(m.uid).noHelp)) return 'Против этого монстра никого не позвать';
        const t = P(s, a.target);
        if (!t || t === p) return 'Выберите, кого заставить помогать';
        if (t.dead) return 'Мёртвые не помогают';
        return null;
      }
      if (d.effect === 'bonus' && a.side === 'player' && levelOnlyFight(s)) return 'Против этого монстра считается только уровень';
      if (d.effect === 'bonus') return a.side === 'player' || a.side === 'monster' ? null : 'Выберите сторону';
      if (d.effect === 'escape' || d.effect === 'escapeBonus') return isParticipant(s, p.id) ? null : 'Только участник боя';
      if (d.effect === 'remove') return Number.isInteger(a.monster) && c.monsters[a.monster] ? null : 'Выберите монстра';
      return 'Нельзя';
    case 'monster': {
      // чернокнижник подкидывает монстра с руки в любой бой — свой или чужой — раз за бой
      if (a.into) {
        if (!hasClass(p, 'warlock')) return 'Без «Из темноты вылезло…» монстра в бой подкидывает только чернокнижник';
        if (!c) return 'Сейчас нет боя';
        if ((c.summoned || []).includes(p.id)) return 'Призыв — раз за бой';
        if (participants(s).some(id => itemFlag(P(s, id), 'noWandering'))) return 'Щит-турникет: в этот бой монстров по одному';
        return null;
      }
      // за дверью никого — можно позвать на бой своего монстра с руки
      if (!manageErr(s, p) && s.turn.step === 'post') return null;
      return 'Монстра с руки зовут на бой в свой ход, когда за дверью никого не было, или подбрасывают в чужой бой картой «Из темноты вылезло…»';
    }
    default: return 'Эту карту нельзя сыграть';
  }
}

H.playCard = {
  check: playCheck,
  run(s, p, a, rng) {
    const d = def(a.uid);
    const c = s.combat;
    without(p.hand, a.uid);
    switch (d.type) {
      case 'monster': {
        if (a.into) { summonMonster(s, p, a.uid, rng); return; }
        s.reveal = { uid: a.uid, by: p.id, seq: ++s.revealSeq };
        fx(s, { kind: 'reveal', pid: p.id, card: a.uid });
        log(s, `${p.name} зовёт на бой монстра с руки!`, 'combat');
        startCombat(s, p, a.uid, rng);
        if (s.combat) s.combat.trouble = true;
        return;
      }
      case 'race': {
        const cap = p.halfbreed ? 2 : 1;
        if (p.races.length >= cap) toDiscard(s, p.races.shift());
        p.races.push(a.uid); normalize(s, p);
        log(s, `${p.name} теперь ${d.name}.`, 'info');
        break;
      }
      case 'class': {
        const cap = p.supermunch ? 2 : 1;
        if (p.classes.length >= cap) toDiscard(s, p.classes.shift());
        p.classes.push(a.uid); normalize(s, p);
        log(s, `${p.name} берёт класс: ${d.name}.`, 'info');
        break;
      }
      case 'halfbreed': p.halfbreed = a.uid; log(s, `${p.name}: ${d.name}.`, 'info'); break;
      case 'supermunch': p.supermunch = a.uid; log(s, `${p.name}: ${d.name}.`, 'info'); break;
      case 'item':
        if (!equipError(p, a.uid)) { p.equipped.push(a.uid); legendFx(s, p, a.uid); } else p.carried.push(a.uid);
        checkOutfit(s, p, rng);
        log(s, `${p.name} выкладывает ${q(d.name)}${isLegend(a.uid) ? ' — легендарная вещь!' : '.'}`, isLegend(a.uid) ? 'win' : 'info');
        break;
      case 'ally':
        if (p.ally) { toDiscard(s, p.ally); releaseAlly(p); log(s, `${q(def(p.ally).name)} уходит от ${p.name}: место занято.`, 'info'); }
        p.ally = a.uid; p.allySlots = rollAllySlots(rng); p.allyGear = []; normalize(s, p);
        fx(s, { kind: 'ally', pid: p.id, card: a.uid });
        log(s, `${p.name} берёт в спутники ${q(d.name)} — ${ALLY_SLOT_TEXT(p.allySlots)}.`, 'good');
        break;
      case 'trap': grudge(s, a.target, p.id); trapOn(s, P(s, a.target), a.uid, rng, p); break;
      case 'duel': {
        if (d.femme) {
          const t = P(s, a.target), w = P(s, a.with);
          s.duel = { from: t.id, to: w.id, by: p.id, femme: true, card: a.uid, mods: [], used: [], passed: [], winStart: s.now, winAt: s.now + (s.opts.winDelayMs || 0) };
          grudge(s, t.id, p.id); grudge(s, w.id, p.id);
          const n = duelNumbers(s);
          fx(s, { kind: 'duel', pid: t.id, to: w.id, by: p.id, femme: true });
          log(s, `💋 ${p.name} подсылает «Роковую женщину»: ${t.name} и ${w.name} бьются из-за неё — сила ${n.from} против ${n.to}. Проигравший потеряет большую вещь и ${FEMME_LEVELS} уровня.`, 'curse');
          if ((s.opts.winDelayMs || 0) <= 0) resolveDuel(s);
          break;
        }
        const t = P(s, a.target);
        s.duel = { from: p.id, to: t.id, card: a.uid, mods: [], used: [], passed: [], winStart: s.now, winAt: s.now + (s.opts.winDelayMs || 0) };
        grudge(s, t.id, p.id);
        const n = duelNumbers(s);
        fx(s, { kind: 'duel', pid: p.id, to: t.id });
        log(s, `⚔ ${p.name} вызывает ${t.name} на поединок: сила ${n.from} против ${n.to}. Остальные могут подкинуть бонусы.`, 'combat');
        if ((s.opts.winDelayMs || 0) <= 0) resolveDuel(s);
        break;
      }
      case 'location': setLocation(s, p, a.uid); break;
      case 'event': resolveEvent(s, p, a.uid, rng); break;
      case 'buff':
        toDiscard(s, a.uid);
        p.nextCombat += d.bonus;
        contractEvent(s, p, 'oneshot', {}, rng);
        fx(s, { kind: 'buff', pid: p.id, card: a.uid, n: d.bonus });
        log(s, `${p.name}: ${q(d.name)} — +${d.bonus} к силе ${isParticipant(s, p.id) ? 'прямо сейчас' : 'в следующем бою'}.`, 'good');
        break;
      case 'hoard':
        give(p, drawFor(s, p, rng)); give(p, drawFor(s, p, rng));
        toDiscard(s, a.uid);
        s.turn.hoardPlayed = true;
        log(s, `${p.name} находит схрон: +2 карты клада.`, 'good');
        break;
      case 'jackpot':
        toDiscard(s, a.uid);
        p.gold = (p.gold || 0) + d.gold;
        fx(s, { kind: 'jackpot', pid: p.id, card: a.uid, n: d.gold });
        log(s, `${d.emoji || '💰'} ${p.name} открывает ${q(d.name)}: +${d.gold} голдов!`, 'win');
        break;
      case 'levelup':
        toDiscard(s, a.uid);
        setLevel(s, p, p.level + 1);
        log(s, `${p.name}: ${q(d.name)} — теперь ${p.level} ур.`, 'good');
        break;
      case 'curse': grudge(s, a.target, p.id); resolveCurse(s, P(s, a.target), a.uid, rng, p.name, p.id); contractEvent(s, p, 'curse', {}, rng); break;
      case 'enhancer': {
        const m = c.monsters[a.monster];
        m.enh.push(a.uid);
        if ((d.bonus > 0 || d.double) && !isParticipant(s, p.id)) grudge(s, c.fighter, p.id);
        fx(s, { kind: 'enhance', pid: p.id, card: a.uid, n: d.bonus });
        log(s, `${p.name} играет ${q(d.name)} на ${q(def(m.uid).name)}${d.double ? ' — уровень удваивается!' : ` (${d.bonus > 0 ? '+' : ''}${d.bonus})`}.`, 'combat');
        break;
      }
      case 'wandering':
        without(p.hand, a.with);
        c.used.push(a.uid);
        const wm = { uid: a.with, enh: [] };
        if (def(a.with).boss) wm.power = bossPower(s, P(s, c.fighter));
        c.monsters.push(wm);
        if (def(a.with).onAppear) bossAppear(s, def(a.with), P(s, c.fighter), rng);
        grudge(s, c.fighter, p.id);
        log(s, `${p.name}: из темноты вылезает ${q(def(a.with).name)} (${wm.power ? `босс, сила ${wm.power}` : `ур. ${def(a.with).level}`})!`, 'combat');
        fx(s, { kind: 'wandering', pid: p.id, card: a.with, ...(wm.power ? { power: wm.power } : {}) });
        break;
      case 'oneshot':
        if (!c && s.duel) {
          // бонус в поединок: за вызвавшего (from) или за вызванного (to)
          const n = d.bonus + (hasClass(p, 'alchemist') ? 2 : 0);
          s.duel.used.push(a.uid);
          s.duel.mods.push({ side: a.side, n, by: p.id, uid: a.uid });
          const helped = s.duel[a.side], other = s.duel[a.side === 'from' ? 'to' : 'from'];
          if (p.id !== helped && p.id !== other) grudge(s, other, p.id);
          contractEvent(s, p, 'oneshot', {}, rng);
          fx(s, { kind: 'duelMod', pid: p.id, side: a.side, n });
          log(s, `${p.name} использует ${q(d.name)}: +${n} за ${P(s, helped).name}.`, 'combat');
          break;
        }
        c.used.push(a.uid);
        contractEvent(s, p, 'oneshot', {}, rng);
        if (d.effect === 'bonus') {
          let n = d.bonus + (hasClass(p, 'alchemist') ? 2 : 0);
          if (d.tagBonus && a.side === 'player' && combatHasTag(s, d.tagBonus.tag)) n += d.tagBonus.n;
          c.mods.push({ side: a.side, n, by: p.id, uid: a.uid });
          if (a.side === 'monster' && !isParticipant(s, p.id)) grudge(s, c.fighter, p.id);
          fx(s, { kind: 'mod', pid: p.id, card: a.uid, side: a.side, n });
          log(s, `${p.name} использует ${q(d.name)}: +${n} ${a.side === 'player' ? 'героям' : 'монстрам'}.`, 'combat');
        } else if (d.effect === 'escapeBonus') {
          const n = d.bonus + (hasClass(p, 'alchemist') ? 2 : 0);
          c.escape[p.id] = (c.escape[p.id] || 0) + n;
          log(s, `${p.name} готовит ${q(d.name)}: +${n} к побегу.`, 'combat');
        } else if (d.effect === 'escape') {
          fx(s, { kind: 'vanish', pid: p.id, how: 'smoke', cards: c.monsters.map(m => m.uid) });
          log(s, `${p.name} бросает ${q(d.name)} — герои растворяются в дыму без наград.`, 'combat');
          endCombat(s);
        } else if (d.effect === 'enslave') {
          const t = P(s, a.target);
          c.helper = t.id; c.helpOffer = 0; c.helpReq = null; c.forced = true;
          fx(s, { kind: 'helper', pid: t.id, to: p.id, forced: true });
          log(s, `${p.name} играет ${q(d.name)}: ${t.name} обязан помогать в бою — и без доли в кладе.`, 'combat');
        } else if (d.effect === 'remove') {
          const m = removeMonster(s, a.monster);
          fx(s, { kind: 'vanish', pid: p.id, how: 'stone', cards: [m.uid] });
          log(s, `${p.name} читает ${q(d.name)}: ${q(def(m.uid).name)} каменеет.`, 'combat');
          if (!c.monsters.length) afterMonstersGone(s, rng);
        }
        break;
    }
  },
};

// призыв чернокнижника: монстр с руки встаёт в бой на стороне подземелья
function summonMonster(s, p, uid, rng) {
  const c = s.combat, d = def(uid);
  (c.summoned ||= []).push(p.id);
  const wm = { uid, enh: [] };
  if (d.boss) wm.power = bossPower(s, P(s, c.fighter));
  c.monsters.push(wm);
  if (d.onAppear) bossAppear(s, d, P(s, c.fighter), rng);
  const own = isParticipant(s, p.id);
  if (!own) grudge(s, c.fighter, p.id);
  log(s, `Чернокнижник ${p.name} призывает ${q(d.name)} в ${own ? 'свой' : 'чужой'} бой (${wm.power ? `босс, сила ${wm.power}` : `ур. ${monsterBaseLevel(s, d)}`})!`, 'combat');
  fx(s, { kind: 'wandering', pid: p.id, card: uid, summon: true, ...(wm.power ? { power: wm.power } : {}) });
}

function legendFx(s, p, uid) {
  if (!isLegend(uid)) return;
  p.legendSeen = p.legendSeen || [];
  if (p.legendSeen.includes(uid)) return;
  p.legendSeen.push(uid);
  fx(s, { kind: 'legendary', pid: p.id, card: uid });
}
H.equip = {
  check(s, p, a) { return manageErr(s, p) || (!p.carried.includes(a.uid) ? 'Вещи нет среди носимых' : equipError(p, a.uid)); },
  run(s, p, a, rng) { without(p.carried, a.uid); p.equipped.push(a.uid); legendFx(s, p, a.uid); checkOutfit(s, p, rng); },
};
H.unequip = {
  check(s, p, a) { return manageErr(s, p) || (!p.equipped.includes(a.uid) ? 'Вещь не надета' : null); },
  run(s, p, a) { without(p.equipped, a.uid); p.carried.push(a.uid); },
};
H.allyWear = {
  check(s, p, a) { return manageErr(s, p) || (!inPlayItems(p).includes(a.uid) ? 'Вещи нет у вас на столе' : allyWearError(p, a.uid)); },
  run(s, p, a) {
    removeItem(p, a.uid); (p.allyGear ||= []).push(a.uid); normalize(s, p);
    log(s, `${p.name} отдаёт ${q(def(a.uid).name)} спутнику — ${q(def(p.ally).name)}.`, 'info');
  },
};
H.allyTake = {
  check(s, p, a) { return manageErr(s, p) || (!(p.allyGear || []).includes(a.uid) ? 'Этой вещи у спутника нет' : null); },
  run(s, p, a) { without(p.allyGear, a.uid); p.carried.push(a.uid); },
};
H.autoEquip = {
  check(s, p) { return manageErr(s, p) || (!inPlayItems(p).length ? 'Нет вещей' : null); },
  run(s, p, a, rng) {
    const all = inPlayItems(p).sort((a, b) => (def(b).bonus || 0) - (def(a).bonus || 0) || (def(b).runBonus || 0) - (def(a).runBonus || 0));
    p.equipped = []; p.carried = [];
    for (const u of all) { if (!equipError(p, u)) { p.equipped.push(u); legendFx(s, p, u); } else p.carried.push(u); }
    checkOutfit(s, p, rng);
  },
};
H.discardInPlay = {
  check(s, p, a) {
    const e = manageErr(s, p); if (e) return e;
    const ok = !!a.uid && [...p.races, ...p.classes, p.halfbreed, p.supermunch, p.ally, p.beast, ...inPlayItems(p)].filter(Boolean).includes(a.uid);
    return ok ? null : 'Такой карты у вас на столе нет';
  },
  run(s, p, a) {
    if (p.halfbreed === a.uid) p.halfbreed = null;
    else if (p.ally === a.uid) { releaseAlly(p); p.ally = null; }
    else if (p.beast === a.uid) p.beast = null;
    else if (p.supermunch === a.uid) p.supermunch = null;
    else if (!without(p.races, a.uid) && !without(p.classes, a.uid)) removeItem(p, a.uid);
    toDiscard(s, a.uid);
    normalize(s, p);
    log(s, `${p.name} сбрасывает ${q(def(a.uid).name)}.`, 'info');
  },
};

// продажа: голды идут в кошелёк. Гоблин выторговывает +200 за каждую вещь, полурослик раз в ход продаёт одну вещь вдвое дороже
// (обе скидки — только на вещи, не на разовые карты и зелья)
export function saleValue(s, p, uids) {
  const isItem = u => def(u).type === 'item';
  const vals = uids.map(u => (def(u).value || 0) + (hasRace(p, 'goblin') && isItem(u) ? 200 : 0));
  let total = vals.reduce((a, b) => a + b, 0);
  let doubled = false;
  const best = Math.max(0, ...vals.filter((v, i) => isItem(uids[i])));
  if (hasRace(p, 'halfling') && !s.turn.halflingSold && best > 0) { total += best; doubled = true; }
  return { total, doubled };
}
H.sell = {
  check(s, p, a) {
    const e = manageErr(s, p); if (e) return e;
    const u = a.uids || [];
    if (!u.length || new Set(u).size !== u.length) return 'Выберите вещи на продажу';
    for (const x of u) {
      if (!p.hand.includes(x) && !inPlayItems(p).includes(x)) return 'Можно продавать только свои вещи';
      if (!def(x).value) return `${q(def(x).name)} ничего не стоит`;
    }
    return null;
  },
  run(s, p, a, rng) {
    const { total, doubled } = saleValue(s, p, a.uids);
    for (const x of a.uids) { if (!without(p.hand, x)) removeItem(p, x); toDiscard(s, x); }
    normalize(s, p);
    if (doubled) s.turn.halflingSold = true;
    p.gold = (p.gold || 0) + total;
    fx(s, { kind: 'gold', pid: p.id, n: total });
    log(s, `${p.name} продаёт ${a.uids.length === 1 ? q(def(a.uids[0]).name) : `${a.uids.length} вещ.`} за ${total} голдов${doubled ? ' (полурослик торгуется вдвое)' : ''}.`, 'good');
    contractEvent(s, p, 'sellItem', { n: a.uids.length }, rng);
  },
};

H.gift = {
  check(s, p, a) {
    const t = P(s, a.to);
    if (!t || t === p) return 'Кому передать?';
    if (p.dead || t.dead) return 'Мёртвым ничего не нужно';
    if (isParticipant(s, p.id) || isParticipant(s, t.id)) return 'Во время своего боя меняться нельзя';
    if (!inPlayItems(p).includes(a.uid)) return 'Передавать можно вещи со стола';
    return null;
  },
  run(s, p, a) {
    const t = P(s, a.to);
    removeItem(p, a.uid); t.carried.push(a.uid);
    log(s, `${p.name} передаёт ${q(def(a.uid).name)} → ${t.name}.`, 'info');
  },
};

// ───────────────────────── обмен ─────────────────────────
// Предложение: свои вещи (со стола или из руки) за вещи соперника со стола. Тот принимает или отказывается.
const MAX_TRADE = 6;
const tradeCards = (p, list) => Array.isArray(list) && list.length <= MAX_TRADE && new Set(list).size === list.length;
function tradeError(s, p, t, give, want) {
  if (!t || t === p) return 'С кем меняемся?';
  if (p.dead || t.dead) return 'Мёртвым ничего не нужно';
  if (isParticipant(s, p.id) || isParticipant(s, t.id)) return 'Во время своего боя меняться нельзя';
  if (!tradeCards(p, give) || !tradeCards(t, want)) return 'Выберите вещи для обмена';
  if (!give.length && !want.length) return 'Выберите вещи для обмена';
  for (const u of give) {
    if (!inPlayItems(p).includes(u) && !(p.hand.includes(u) && def(u).type === 'item')) return 'Отдавать можно свои вещи — со стола или из руки';
  }
  for (const u of want) if (!inPlayItems(t).includes(u)) return 'Просить можно только вещи со стола соперника';
  return null;
}
export const tradeById = (s, id) => (s.trades || []).find(x => x.id === id);
H.offerTrade = {
  check(s, p, a) { return tradeError(s, p, P(s, a.to), a.give || [], a.want || []); },
  run(s, p, a) {
    s.trades = (s.trades || []).filter(x => x.from !== p.id);
    s.tradeSeq = (s.tradeSeq || 0) + 1; // в партиях, сохранённых до обновления, счётчика ещё нет
    const o = { id: s.tradeSeq, from: p.id, to: a.to, give: [...(a.give || [])], want: [...(a.want || [])], at: s.now };
    s.trades.push(o);
    fx(s, { kind: 'tradeOffer', pid: p.id, to: a.to, trade: o.id });
    log(s, `${p.name} предлагает обмен ${P(s, a.to).name}.`, 'info');
  },
};
H.answerTrade = {
  check(s, p, a) {
    const o = tradeById(s, a.id);
    if (!o || o.to !== p.id) return 'Такого предложения нет';
    if (a.accept) return tradeError(s, P(s, o.from), p, o.give, o.want) ? 'Предложение устарело: вещи уже не те' : null;
    return null;
  },
  run(s, p, a, rng) {
    const o = tradeById(s, a.id);
    s.trades = s.trades.filter(x => x !== o);
    const f = P(s, o.from);
    if (!a.accept) { log(s, `${p.name} отказывается от обмена с ${f.name}.`, 'info'); fx(s, { kind: 'tradeNo', pid: p.id, to: f.id }); return; }
    for (const u of o.give) { if (!without(f.hand, u)) removeItem(f, u); p.carried.push(u); }
    for (const u of o.want) { removeItem(p, u); f.carried.push(u); }
    normalize(s, f); normalize(s, p);
    // встречные предложения с отданными вещами больше не годятся
    const moved = new Set([...o.give, ...o.want]);
    s.trades = s.trades.filter(x => ![...x.give, ...x.want].some(u => moved.has(u)));
    const names = list => (list.length ? list.map(u => q(def(u).name)).join(', ') : 'ничего');
    fx(s, { kind: 'trade', pid: f.id, to: p.id, give: o.give, want: o.want });
    log(s, `🤝 Обмен: ${f.name} отдаёт ${names(o.give)}, ${p.name} — ${names(o.want)}.`, 'good');
    contractEvent(s, f, 'trade', {}, rng);
    contractEvent(s, p, 'trade', {}, rng);
  },
};
H.cancelTrade = {
  check(s, p, a) { const o = tradeById(s, a.id); return o && o.from === p.id ? null : 'Нечего отменять'; },
  run(s, p, a) { s.trades = s.trades.filter(x => x.id !== a.id); log(s, `${p.name} отзывает предложение обмена.`, 'info'); },
};

// ───────────────────────── призрак ─────────────────────────
// Погибший до своего хода — призрак: раз за ход может подкинуть ±2 в чужой бой.
export const isGhost = p => !!p?.needsRevive;
export const SPLIT_STEP = 4;          // рой после каждого деления слабее на столько
export const ENGINEER_VS_MACHINE = 3; // механик против механизмов
H.haunt = {
  check(s, p, a) {
    if (!isGhost(p)) return 'Подкидывать из-за грани может только погибший, пока ждёт своего хода';
    const c = s.combat;
    if (!c) return 'Сейчас нет боя';
    if (isParticipant(s, p.id)) return 'Вы сами в этом бою';
    if ((s.turn.haunted || []).includes(p.id)) return 'Призрак вмешивается раз за ход';
    if (a.side !== 'player' && a.side !== 'monster') return 'Выберите сторону';
    if (a.side === 'player' && levelOnlyFight(s)) return 'Против этого монстра считается только уровень';
    return null;
  },
  run(s, p, a) {
    const c = s.combat;
    (s.turn.haunted ||= []).push(p.id);
    c.mods.push({ side: a.side, n: GHOST_BONUS, by: p.id, uid: null, label: 'Призрак' });
    if (a.side === 'monster') grudge(s, c.fighter, p.id);
    fx(s, { kind: 'haunt', pid: p.id, side: a.side, n: GHOST_BONUS });
    log(s, `👻 Призрак ${p.name} подкидывает +${GHOST_BONUS} ${a.side === 'player' ? 'героям' : 'монстрам'}.`, 'combat');
  },
};

// ───────────────────────── Ящик Пандоры ─────────────────────────
// В любом бою любой живой игрок может открыть ящик за голды: монстрам +10, героям −3 к побегу.
// Кто из героев не убежит — теряет все вещи и питомца, их раздают другим игрокам наугад.
H.pandora = {
  check(s, p) {
    if (p.dead) return 'Вы мертвы до начала следующего хода';
    const c = s.combat;
    if (!c) return 'Ящик Пандоры открывают только во время боя';
    if (c.pandora) return 'Ящик Пандоры в этом бою уже открыт';
    return (p.gold || 0) < PANDORA_COST ? `Нужно ${PANDORA_COST} голдов, в кошельке ${p.gold || 0}` : null;
  },
  run(s, p, a, rng) {
    const c = s.combat;
    p.gold -= PANDORA_COST;
    c.pandora = { by: p.id };
    c.mods.push({ side: 'monster', n: PANDORA_BONUS, by: p.id, uid: null, label: 'Ящик Пандоры' });
    if (!isParticipant(s, p.id)) grudge(s, c.fighter, p.id);
    fx(s, { kind: 'pandora', pid: p.id, to: c.fighter });
    unbanish(s, rng);
    log(s, `📦 ${p.name} открывает Ящик Пандоры за ${PANDORA_COST} голдов: монстрам +${PANDORA_BONUS}, героям −${PANDORA_ESCAPE} к побегу. Кто не убежит — лишится всех вещей и питомца!`, 'curse');
  },
};
function pandoraLoss(s, p, rng) {
  const lost = [...p.equipped, ...p.carried, ...(p.allyGear || []), ...(p.beast ? [p.beast] : [])];
  p.equipped = []; p.carried = []; p.allyGear = []; p.beast = null;
  let to = s.players.filter(x => x !== p && !x.dead);
  if (!to.length) to = s.players.filter(x => x !== p);
  const got = {};
  for (const u of lost) {
    const x = to.length ? pick(to, rng) : null;
    if (!x) { toDiscard(s, u); continue; }
    if (def(u).type === 'monster') {
      // приручённый зверь идёт к новому хозяину, а если у того уже есть свой — убегает
      if (x.beast) { toDiscard(s, u); continue; }
      for (const v of x.equipped.filter(y => def(y).slot === 'pet')) { without(x.equipped, v); x.carried.push(v); }
      x.beast = u;
    } else x.carried.push(u);
    (got[x.id] ||= []).push(u);
  }
  for (const x of s.players) normalize(s, x);
  fx(s, { kind: 'pandoraLoss', pid: p.id, n: lost.length, to: Object.keys(got) });
  log(s, lost.length
    ? `📦 Ящик Пандоры забирает у ${p.name} всё: ${Object.entries(got).map(([id, l]) => `${P(s, id).name} — ${l.map(u => q(def(u).name)).join(', ')}`).join('; ')}.`
    : `📦 Ящик Пандоры ищет у ${p.name} вещи — но там пусто.`, 'bad');
}

// Ржавник: брось ему вещь — уползёт жевать, бой без наград
H.bribe = {
  check(s, p, a) {
    const c = s.combat;
    if (!c || c.fighter !== p.id) return 'Откупиться может тот, кто дерётся';
    if (!c.monsters.some(m => def(m.uid).bribe)) return 'Этого монстра вещью не задобрить';
    if (!a.item || !inPlayItems(p).includes(a.item)) return 'Выберите свою вещь со стола';
    if (def(a.item).noSteal) return 'Легендарную вещь не отдают';
    return null;
  },
  run(s, p, a, rng) {
    const c = s.combat;
    removeItem(p, a.item); toDiscard(s, a.item); normalize(s, p);
    const idx = c.monsters.findIndex(m => def(m.uid).bribe);
    const m = removeMonster(s, idx);
    fx(s, { kind: 'vanish', pid: p.id, how: 'smoke', cards: [m.uid] });
    log(s, `${p.name} бросает ${q(def(a.item).name)} — ${q(def(m.uid).name)} уползает жевать.`, 'combat');
    if (!c.monsters.length) afterMonstersGone(s, rng);
  },
};

// ловушка за дверью: рискнуть и обезвредить (тогда она ваша) или принять расплату
H.trap = {
  check(s, p) {
    if (!s.trap || s.trap.pid !== p.id) return 'Вы не в ловушке';
    return p.dead ? 'Вы мертвы' : null;
  },
  run(s, p, a, rng) {
    const uid = s.trap.uid, d = def(uid);
    s.trap = null;
    s.turn.step = 'post';
    if (a.disarm === true) {
      const { r, ok } = trapRoll(s, p, d, rng);
      if (ok) {
        p.hand.push(uid);
        fx(s, { kind: 'trapOk', pid: p.id, card: uid });
        log(s, `${p.name} обезвреживает ${q(d.name)} (выпало ${r}) и прячет её в карман — пригодится для соперника.`, 'good');
        return;
      }
      toDiscard(s, uid);
      log(s, `${p.name} не справился с ${q(d.name)} (выпало ${r}) — ловушка срабатывает прямо в руках. ${d.text} И ещё −${TRAP_FAIL_LEVELS} ур.`, 'bad');
      applyFx(s, p, [...d.fx, { k: 'levels', n: TRAP_FAIL_LEVELS }], rng);
      return;
    }
    toDiscard(s, uid);
    log(s, `${p.name} не рискует и принимает расплату ${q(d.name)}.`, 'bad');
    applyFx(s, p, d.fx, rng);
  },
};

// подземный рынок: купить карту из колоды за голды из кошелька
H.buy = {
  check(s, p, a) {
    const e = buyErr(s, p); if (e) return e;
    if (!SHOP_IDS.includes(a.id)) return 'Такого на рынке не продают';
    const d = def(a.id);
    if (!stockUid(s, a.id)) return 'Распродано: в колоде таких больше нет';
    if (d.type === 'levelup') {
      if (p.levelTurn === s.turn.n || (s.turn.boughtLevel && s.turn.pid === p.id && p.levelTurn === undefined)) return 'Уровень на рынке — один за ход';
      if (p.level >= winLevel(s) - 1) return 'Последний уровень — только убийством монстра';
    }
    const price = shopPrice(s, d, p);
    return (p.gold || 0) < price ? `Нужно ${price} голдов, в кошельке ${p.gold || 0}` : null;
  },
  run(s, p, a) {
    const d = def(a.id), price = shopPrice(s, d, p), u = stockUid(s, a.id);
    without(s.decks[d.deck], u);
    p.gold -= price;
    p.spent = (p.spent || 0) + price; // копится к статусу «Шопоголик»; в летопись не пишется
    p.hand.push(u);
    if (d.type === 'levelup') { s.turn.boughtLevel = true; p.levelTurn = s.turn.n; }
    fx(s, { kind: 'buy', pid: p.id, card: u, price });
    log(s, `🛒 ${p.name} покупает на рынке ${q(d.name)} за ${price} голдов.`, 'good');
  },
};

// приручить зверя, побеждённого в этот ход: он занимает место питомца
H.tame = {
  check(s, p) { return manageErr(s, p) || (s.tame?.pid !== p.id ? 'Приручать некого' : null); },
  run(s, p) {
    const uid = s.tame.uid;
    s.tame = null;
    if (p.beast) { toDiscard(s, p.beast); log(s, `${p.name} отпускает ${q(def(p.beast).name)}.`, 'info'); }
    for (const u of p.equipped.filter(x => def(x).slot === 'pet')) { without(p.equipped, u); p.carried.push(u); }
    p.beast = uid;
    fx(s, { kind: 'tame', pid: p.id, card: uid });
    log(s, `${p.name} приручает ${q(def(uid).name)}: теперь это питомец, +${tameBonus(def(uid))} к силе.`, 'good');
  },
};

H.askHelp = {
  check(s, p, a) {
    const c = s.combat;
    if (!c || c.fighter !== p.id) return 'Помощь просит только тот, кто дерётся';
    if (c.helper) return 'Помощник уже есть';
    if (c.helpReq) return 'Уже ждём ответа';
    if (combatNumbers(s).winning) return 'Вы и так побеждаете';
    const nh = c.monsters.find(m => def(m.uid).noHelp);
    if (nh) return `${def(nh.uid).name} не терпит помощников`;
    const t = P(s, a.to);
    if (!t || t === p || t.dead) return 'Выберите помощника';
    if (c.declined.includes(t.id)) return `${t.name} уже отказал в этом бою`;
    const n = combatNumbers(s).treasures;
    if (!Number.isInteger(a.offer) || a.offer < 0 || a.offer > n) return `Предложите от 0 до ${n} клада`;
    return null;
  },
  run(s, p, a) {
    s.combat.helpReq = { from: p.id, to: a.to, offer: a.offer, at: s.now };
    log(s, `${p.name} просит помощи у ${P(s, a.to).name} за ${a.offer} клада.`, 'combat');
  },
};
H.answerHelp = {
  check(s, p) { return s.combat?.helpReq?.to === p.id ? null : 'Вас не звали'; },
  run(s, p, a) {
    const c = s.combat;
    if (a.accept) {
      c.helper = p.id; c.helpOffer = c.helpReq.offer;
      fx(s, { kind: 'helper', pid: p.id, to: c.fighter });
      log(s, `${p.name} вступает в бой на стороне ${P(s, c.fighter).name}!`, 'combat');
    } else { c.declined.push(p.id); log(s, `${p.name} отказывается помогать.`, 'combat'); }
    c.helpReq = null;
  },
};
H.cancelHelp = {
  check(s, p) { return s.combat?.helpReq && s.combat.fighter === p.id ? null : 'Нечего отменять'; },
  run(s) { s.combat.helpReq = null; },
};

H.fight = {
  check(s, p) {
    const c = s.combat;
    if (!c || c.fighter !== p.id) return 'Добивать может только тот, кто дерётся';
    if (!combatNumbers(s).winning) return 'Сил пока не хватает';
    if (c.winAt) return 'Уже добиваем';
    return null;
  },
  run(s, p, a, rng) {
    if ((s.opts.winDelayMs || 0) <= 0) { resolveVictory(s, rng); return; }
    s.combat.winAt = s.now + s.opts.winDelayMs;
    s.combat.winStart = s.now;
    s.combat.passed = [];
    fx(s, { kind: 'strike', pid: p.id });
    log(s, `${p.name} заносит оружие! Есть ${Math.round(s.opts.winDelayMs / 1000)} с, чтобы помешать.`, 'combat');
  },
};

// «Не мешаю»: сосед по столу отказывается вмешиваться. Когда отказались все живые, бой заканчивается сразу.
H.pass = {
  check(s, p) {
    if (s.duel && !s.combat) {
      if (p.dead) return 'Вы мертвы';
      return s.duel.passed.includes(p.id) ? 'Вы уже сказали, что не мешаете' : null;
    }
    const c = s.combat;
    if (!c || !c.winAt) return 'Сейчас нечему мешать';
    if (isParticipant(s, p.id)) return 'Вы сами в этом бою';
    if ((c.passed || []).includes(p.id)) return 'Вы уже сказали, что не мешаете';
    return null;
  },
  run(s, p) {
    if (s.duel && !s.combat) {
      // все живые сказали «не мешаю» (и сами дуэлянты) — поединок решается сразу
      s.duel.passed.push(p.id);
      if (s.players.filter(x => !x.dead && !x.needsRevive).every(x => s.duel.passed.includes(x.id))) resolveDuel(s);
      return;
    }
    s.combat.passed = [...(s.combat.passed || []), p.id];
    log(s, `${p.name} не вмешивается.`, 'info');
  },
};

H.runAway = {
  check(s, p) {
    const c = s.combat;
    if (!c || c.fighter !== p.id) return 'Сбежать решает тот, кто дерётся';
    if (combatNumbers(s).winning) return 'Вы побеждаете — бежать стыдно';
    return null;
  },
  run(s, p, a, rng) {
    s.combat.helpReq = null;
    log(s, `${p.name} командует отступление!`, 'combat');
    resolveEscape(s, rng);
  },
};

H.ability = {
  check(s, p, a) {
    if (p.dead) return 'Вы мертвы';
    const c = s.combat;
    const cards = a.cards || [];
    // способности, которые прибавляют силу, против «только уровня» бесполезны
    if (['rage', 'turn', 'mutagen'].includes(a.name) && c && isParticipant(s, p.id) && levelOnlyFight(s)) return 'Против этого монстра считается только уровень';
    switch (a.name) {
      case 'rage': {
        if (!hasClass(p, 'warrior')) return 'Только воин';
        if (!c || !isParticipant(s, p.id)) return 'Только в своём бою';
        const left = 3 - (c.rageCount[p.id] || 0);
        if (left <= 0) return 'Ярость уже на пределе';
        if (!allInHand(p, cards) || cards.length > left) return `Сбросьте от 1 до ${left} карт`;
        return null;
      }
      case 'turn': {
        if (!hasClass(p, 'cleric')) return 'Только жрец';
        if (!c || !isParticipant(s, p.id)) return 'Только в своём бою';
        if (!combatHasTag(s, 'undead')) return 'Здесь нет нежити';
        const left = 3 - (c.turnCount[p.id] || 0);
        if (left <= 0) return 'Изгнание уже на пределе';
        if (!allInHand(p, cards) || cards.length > left) return `Сбросьте от 1 до ${left} карт`;
        return null;
      }
      case 'levitate': {
        if (!hasClass(p, 'mage')) return 'Только маг';
        if (!c || !isParticipant(s, p.id)) return 'Только в своём бою';
        const left = 3 - (c.escapeCount[p.id] || 0);
        if (left <= 0) return 'Левитация уже на пределе';
        if (!allInHand(p, cards) || cards.length > left) return `Сбросьте от 1 до ${left} карт`;
        return null;
      }
      case 'charm': {
        if (!hasClass(p, 'mage')) return 'Только маг';
        if (!c || !isParticipant(s, p.id)) return 'Только в своём бою';
        if (p.hand.length < 3) return 'Нужно минимум 3 карты в руке';
        if (!Number.isInteger(a.monster) || !c.monsters[a.monster]) return 'Выберите монстра';
        if (def(c.monsters[a.monster].uid).boss) return 'Босса чарами не усыпить';
        return null;
      }
      case 'backstab': {
        if (!hasClass(p, 'rogue')) return 'Только плут';
        if (!c) return 'Только во время боя';
        const t = P(s, a.target);
        if (!t || t === p || !isParticipant(s, t.id)) return 'Бить в спину можно участника боя';
        if (c.backstabs.some(b => b.by === p.id && b.on === t.id)) return 'Этого уже били в спину';
        if (cards.length !== 1 || !allInHand(p, cards)) return 'Сбросьте одну карту';
        return null;
      }
      case 'steal': {
        if (!hasClass(p, 'rogue')) return 'Только плут';
        const t = P(s, a.target);
        if (!t || t === p || t.dead) return 'У кого красть?';
        if (isParticipant(s, p.id) || isParticipant(s, t.id)) return 'Во время боя красть нельзя';
        if (!inPlayItems(t).includes(a.item) || def(a.item).big) return 'Можно стащить только мелкую вещь со стола';
        if (def(a.item).noSteal) return `${def(a.item).name} не украсть: легендарная вещь`;
        if (cards.length !== 1 || !allInHand(p, cards)) return 'Сбросьте одну карту';
        return null;
      }
      case 'lure': {
        if (!hasClass(p, 'rogue')) return 'Только плут';
        const t = P(s, a.target);
        if (!t || t === p || t.dead) return 'Кого сманить?';
        if (isParticipant(s, p.id) || isParticipant(s, t.id)) return 'Во время боя не до уговоров';
        if (!a.item || (a.item !== t.ally && a.item !== t.beast)) return 'Сманить можно спутника или приручённого зверя';
        if (cards.length !== 1 || !allInHand(p, cards)) return 'Сбросьте одну карту';
        return null;
      }
      case 'lullaby': {
        if (!hasClass(p, 'bard')) return 'Только бард';
        if (!c) return 'Только во время боя';
        if ((c.lullaby[p.id] || 0) >= LULLABY_MAX) return 'Колыбельная — раз за бой';
        if (cards.length !== 1 || !allInHand(p, cards)) return 'Сбросьте одну карту';
        return null;
      }
      case 'mutagen': {
        if (!hasClass(p, 'witcher')) return 'Только ведьмак';
        if (p.mutagenUsed) return 'Мутаген можно выпить только раз за партию';
        if (!c || !isParticipant(s, p.id)) return 'Только в своём бою';
        if (cards.length !== 2 || !allInHand(p, cards)) return 'Сбросьте две карты';
        return null;
      }
      case 'distill': {
        if (!hasClass(p, 'alchemist')) return 'Только алхимик';
        const e = manageErr(s, p); if (e) return e;
        if (s.turn.distilled) return 'Перегонка — раз в ход';
        if (cards.length !== DISTILL_COST || !allInHand(p, cards)) return `Сбросьте ${DISTILL_COST} карты`;
        return null;
      }
      default: return 'Неизвестная способность';
    }
  },
  run(s, p, a, rng) {
    const c = s.combat;
    // чары сбрасывают всю руку сами; для остальных способностей список карт уже проверен
    const cards = a.name === 'charm' ? [] : (a.cards || []);
    cards.forEach(u => { if (without(p.hand, u)) toDiscard(s, u); });
    switch (a.name) {
      case 'rage':
        c.rageCount[p.id] = (c.rageCount[p.id] || 0) + cards.length;
        c.rage[p.id] = (c.rage[p.id] || 0) + cards.length;
        fx(s, { kind: 'power', pid: p.id, ab: 'rage', n: cards.length });
        log(s, `${p.name} впадает в ярость: +${cards.length}.`, 'combat');
        break;
      case 'turn':
        c.turnCount[p.id] = (c.turnCount[p.id] || 0) + cards.length;
        c.turnUndead[p.id] = (c.turnUndead[p.id] || 0) + cards.length * 3;
        fx(s, { kind: 'power', pid: p.id, ab: 'turn', n: cards.length * 3 });
        log(s, `${p.name} изгоняет нежить: +${cards.length * 3}.`, 'combat');
        break;
      case 'levitate':
        c.escapeCount[p.id] = (c.escapeCount[p.id] || 0) + cards.length;
        c.escape[p.id] = (c.escape[p.id] || 0) + cards.length;
        fx(s, { kind: 'power', pid: p.id, ab: 'levitate', n: cards.length });
        log(s, `${p.name} готовит левитацию: +${cards.length} к побегу.`, 'combat');
        break;
      case 'charm': {
        const all = [...p.hand]; p.hand = []; all.forEach(u => toDiscard(s, u));
        const m = c.monsters[a.monster];
        c.charmTreasure = (c.charmTreasure || 0) + monsterTreasure(s, m);
        removeMonster(s, a.monster);
        fx(s, { kind: 'vanish', pid: p.id, how: 'sleep', cards: [m.uid] });
        log(s, `${p.name} сбрасывает руку (${all.length}) и усыпляет ${q(def(m.uid).name)}.`, 'combat');
        if (!c.monsters.length) afterMonstersGone(s, rng);
        break;
      }
      case 'backstab': {
        c.backstabs.push({ by: p.id, on: a.target });
        grudge(s, a.target, p.id);
        log(s, `${p.name} бьёт в спину ${P(s, a.target).name}: −2.`, 'combat');
        fx(s, { kind: 'backstab', pid: a.target, by: p.id });
        break;
      }
      case 'lullaby':
        c.lullaby[p.id] = (c.lullaby[p.id] || 0) + 1;
        c.mods.push({ side: 'monster', n: -LULLABY_PENALTY, by: p.id, uid: null, label: 'Колыбельная' });
        fx(s, { kind: 'lullaby', pid: p.id });
        log(s, `${p.name} поёт колыбельную: монстры −${LULLABY_PENALTY}.`, 'combat');
        break;
      case 'mutagen':
        p.mutagenUsed = true;
        c.mods.push({ side: 'player', n: MUTAGEN_BONUS, by: p.id, uid: null, label: 'Мутаген' });
        fx(s, { kind: 'mutagen', pid: p.id });
        log(s, `${p.name} выпивает мутаген: глаза светятся, +${MUTAGEN_BONUS} к силе!`, 'combat');
        break;
      case 'distill':
        s.turn.distilled = true;
        give(p, drawFor(s, p, rng));
        log(s, `${p.name} перегоняет ${DISTILL_COST} карты в карту клада.`, 'good');
        break;
      case 'lure': {
        const t = P(s, a.target);
        const beast = a.item === t.beast;
        const r = d6(rng);
        fx(s, { kind: 'dice', pid: p.id, value: r, ok: r >= 4, label: 'Сманить' });
        if (r >= 4) {
          if (beast) {
            t.beast = null;
            if (p.beast) toDiscard(s, p.beast);
            for (const u of p.equipped.filter(x => def(x).slot === 'pet')) { without(p.equipped, u); p.carried.push(u); }
            p.beast = a.item;
          } else {
            const slots = t.allySlots;
            releaseAlly(t); t.ally = null;
            if (p.ally) { toDiscard(s, p.ally); releaseAlly(p); }
            p.ally = a.item; p.allySlots = slots || rollAllySlots(rng); p.allyGear = [];
          }
          normalize(s, t); normalize(s, p);
          grudge(s, t.id, p.id);
          fx(s, { kind: 'lure', pid: p.id, from: t.id, card: a.item });
          log(s, `${p.name} сманивает ${q(def(a.item).name)} у ${t.name} (выпало ${r}).`, 'curse');
        } else {
          setLevel(s, p, p.level - 1);
          log(s, `${q(def(a.item).name)} остаётся с ${t.name}, а ${p.name} теряет уровень (выпало ${r}).`, 'bad');
        }
        break;
      }
      case 'steal': {
        const t = P(s, a.target);
        const r = d6(rng);
        fx(s, { kind: 'dice', pid: p.id, value: r, ok: r >= 4, label: 'Карманная кража' });
        if (r >= 4) {
          removeItem(t, a.item); p.carried.push(a.item); normalize(s, t);
          log(s, `${p.name} ловко тащит ${q(def(a.item).name)} у ${t.name} (выпало ${r}).`, 'curse');
        } else {
          setLevel(s, p, p.level - 1);
          log(s, `${p.name} попался на краже у ${t.name} (выпало ${r}) и теряет уровень.`, 'bad');
        }
        break;
      }
    }
  },
};

// ───────────────────────── публичный API ─────────────────────────
function badShape(a) {
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return true;
  for (const k of ['cards', 'uids', 'give', 'pay']) {
    if (a[k] !== undefined && (!Array.isArray(a[k]) || a[k].length > 40 || a[k].some(x => typeof x !== 'string'))) return true;
  }
  if (a.into !== undefined && typeof a.into !== 'boolean') return true;
  for (const k of ['uid', 'target', 'with', 'to', 'item', 'name']) {
    if (a[k] !== undefined && a[k] !== null && typeof a[k] !== 'string') return true;
  }
  if (a.monster !== undefined && !Number.isInteger(a.monster)) return true;
  if (a.offer !== undefined && !Number.isInteger(a.offer)) return true;
  if (a.n !== undefined && !Number.isInteger(a.n)) return true;
  return false;
}

export function check(s, pid, a) {
  if (badShape(a)) return 'Плохие данные';
  if (s.phase !== 'playing') return 'Партия окончена';
  const p = P(s, pid);
  if (!p) return 'Вы не в игре';
  if (p.banished) return 'Вы выбыли: «Прощай навсегда». Вернуть в игру может только открытый Ящик Пандоры';
  const h = Object.hasOwn(H, a.type) ? H[a.type] : null;
  if (!h) return 'Неизвестное действие';
  return h.check(s, p, a) || null;
}

export function act(s, pid, a, { rng = Math.random, now = Date.now() } = {}) {
  s.now = now;
  const err = check(s, pid, a);
  if (err) return { ok: false, error: err };
  const hadCombat = !!s.combat, hadDuel = !!s.duel;
  H[a.type].run(s, P(s, pid), a, rng);
  pruneSecret(s);
  // покупка на рынке сама по себе в бой не вмешивается — отсчёт не сбрасывает
  const quiet = a.type === 'pass' || a.type === 'buy';
  if (hadCombat && s.combat && a.type !== 'fight' && !quiet) { s.combat.winAt = null; s.combat.passed = []; }
  // в поединок вмешались — отсчёт начинается заново
  if (hadDuel && s.duel && !quiet) { s.duel.winStart = s.now; s.duel.winAt = s.now + (s.opts.winDelayMs || 0); s.duel.passed = []; }
  s.version++;
  return { ok: true };
}

export function tick(s, { rng = Math.random, now = Date.now() } = {}) {
  s.now = now;
  if (s.phase === 'playing' && s.duel && now >= s.duel.winAt) { resolveDuel(s); s.version++; return true; }
  const c = s.combat;
  if (s.phase !== 'playing' || !c || !c.winAt || now < c.winAt) return false;
  if (combatNumbers(s).winning) resolveVictory(s, rng);
  else c.winAt = null;
  s.version++;
  return true;
}

// Какие варианты розыгрыша есть у карты из руки.
export function playOptions(s, pid, uid) {
  const out = [];
  const tryA = a => { if (!check(s, pid, a)) out.push(a); };
  const d = def(uid);
  // свой бой после пустой двери; в чужой — с «Из темноты вылезло…», а чернокнижник подкидывает и без неё
  if (d.type === 'monster') { tryA({ type: 'playCard', uid }); tryA({ type: 'playCard', uid, into: true }); return out; }
  if (d.type === 'duel' && d.femme) {
    const xs = s.players.filter(x => x.id !== pid);
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) tryA({ type: 'playCard', uid, target: xs[i].id, with: xs[j].id });
    return out;
  }
  if (d.type === 'curse' || d.type === 'trap' || d.type === 'duel' || (d.type === 'oneshot' && d.effect === 'enslave')) { s.players.forEach(x => tryA({ type: 'playCard', uid, target: x.id })); return out; }
  if (d.type === 'enhancer' || (d.type === 'oneshot' && d.effect === 'remove')) {
    (s.combat?.monsters || []).forEach((m, i) => tryA({ type: 'playCard', uid, monster: i }));
    return out;
  }
  if (d.type === 'oneshot' && d.effect === 'bonus') {
    for (const side of s.duel && !s.combat ? ['from', 'to'] : ['player', 'monster']) tryA({ type: 'playCard', uid, side });
    return out;
  }
  if (d.type === 'wandering') {
    const p = P(s, pid);
    p.hand.filter(u => def(u).type === 'monster').forEach(m => tryA({ type: 'playCard', uid, with: m }));
    return out;
  }
  tryA({ type: 'playCard', uid });
  return out;
}

export function hints(s, pid) {
  const p = P(s, pid);
  if (!p || s.phase !== 'playing') return null;
  const ok = a => !check(s, pid, a);
  const h = {
    kick: ok({ type: 'kick' }),
    loot: ok({ type: 'loot' }),
    lookForTrouble: ok({ type: 'lookForTrouble' }),
    endTurn: myTurn(s, p) && !s.combat && s.turn.step === 'charity',
    mustGive: Math.max(0, p.hand.length - handLimit(p, s)),
    giveToLowest: (() => { const o = s.players.filter(x => x !== p && !x.dead); return o.length && p.level > Math.min(...o.map(x => x.level)); })(),
    fight: ok({ type: 'fight' }),
    pass: ok({ type: 'pass' }),
    runAway: ok({ type: 'runAway' }),
    askHelp: !!(s.combat && s.combat.fighter === pid && !s.combat.helper && !s.combat.helpReq && !combatNumbers(s).winning
      && !s.combat.monsters.some(m => def(m.uid).noHelp)),
    noHelp: !!s.combat?.monsters.some(m => def(m.uid).noHelp),
    helpTargets: s.combat && s.combat.fighter === pid ? s.players.filter(x => ok({ type: 'askHelp', to: x.id, offer: 0 })).map(x => x.id) : [],
    cancelHelp: ok({ type: 'cancelHelp' }),
    answerHelp: s.combat?.helpReq?.to === pid,
    autoEquip: ok({ type: 'autoEquip' }),
    bribe: s.combat?.fighter === pid && s.combat.monsters.some(m => def(m.uid).bribe) ? inPlayItems(p).filter(u => ok({ type: 'bribe', item: u })) : [],
    tame: ok({ type: 'tame' }) ? s.tame.uid : null,
    pandora: ok({ type: 'pandora' }),
    buy: !buyErr(s, p),
    shop: SHOP_IDS.filter(id => ok({ type: 'buy', id })),
    trap: ok({ type: 'trap' }) ? { uid: s.trap.uid, need: trapNeed(p) } : null,
    manage: !manageErr(s, p),
    haunt: { player: ok({ type: 'haunt', side: 'player' }), monster: ok({ type: 'haunt', side: 'monster' }) },
    trade: !p.dead && !isParticipant(s, p.id),
    tradeTargets: s.players.filter(x => x !== p && !x.dead && !isParticipant(s, x.id) && !isParticipant(s, p.id) && !p.dead).map(x => x.id),
    cards: {}, equip: {}, allyWear: {}, abilities: {},
  };
  for (const u of p.hand) h.cards[u] = playOptions(s, pid, u);
  for (const u of p.carried) h.equip[u] = ok({ type: 'equip', uid: u });
  if (p.ally) for (const u of inPlayItems(p)) h.allyWear[u] = ok({ type: 'allyWear', uid: u });
  const one = p.hand.slice(0, 1);
  const c = s.combat;
  if (hasClass(p, 'warrior')) h.abilities.rage = ok({ type: 'ability', name: 'rage', cards: one });
  if (hasClass(p, 'cleric')) h.abilities.turn = ok({ type: 'ability', name: 'turn', cards: one });
  if (hasClass(p, 'mage')) {
    h.abilities.levitate = ok({ type: 'ability', name: 'levitate', cards: one });
    h.abilities.charm = !!c && ok({ type: 'ability', name: 'charm', monster: 0 });
  }
  if (hasClass(p, 'bard')) h.abilities.lullaby = ok({ type: 'ability', name: 'lullaby', cards: one });
  if (hasClass(p, 'alchemist')) h.abilities.distill = ok({ type: 'ability', name: 'distill', cards: p.hand.slice(0, DISTILL_COST) });
  if (hasClass(p, 'witcher')) h.abilities.mutagen = ok({ type: 'ability', name: 'mutagen', cards: p.hand.slice(0, 2) });
  if (hasClass(p, 'rogue')) {
    h.abilities.backstab = s.players.filter(x => ok({ type: 'ability', name: 'backstab', target: x.id, cards: one })).map(x => x.id);
    const steal = [];
    for (const x of s.players) for (const it of inPlayItems(x)) if (ok({ type: 'ability', name: 'steal', target: x.id, item: it, cards: one })) steal.push({ target: x.id, item: it });
    h.abilities.steal = steal;
    const lure = [];
    for (const x of s.players) for (const it of [x.ally, x.beast].filter(Boolean)) if (ok({ type: 'ability', name: 'lure', target: x.id, item: it, cards: one })) lure.push({ target: x.id, item: it });
    h.abilities.lure = lure;
  }
  return h;
}

// Персональный вид состояния: чужие руки и колоды скрыты.
export function view(s, pid) {
  const me = P(s, pid);
  const c = s.combat;
  return {
    phase: s.phase, version: s.version, turn: { ...s.turn }, winners: [...s.winners],
    reveal: s.reveal, opts: { winDelayMs: s.opts.winDelayMs, winLevel: winLevel(s), daily: s.opts.daily || null, dailyId: s.opts.dailyId || null }, location: s.location,
    trap: s.trap ? { ...s.trap } : null, tame: s.tame ? { ...s.tame } : null,
    shop: { items: shopList(s, me), note: locationOf(s)?.priceNote || null, fair: s.opts?.dailyId === 'fair' },
    duel: s.duel ? { from: s.duel.from, to: s.duel.to, card: s.duel.card, mods: s.duel.mods.map(m => ({ ...m })), passed: [...s.duel.passed], winAt: s.duel.winAt, winStart: s.duel.winStart,
      femme: !!s.duel.femme, by: s.duel.by || null,
      numbers: duelNumbers(s), prize: s.duel.femme ? { from: femmeLoss(P(s, s.duel.from)), to: femmeLoss(P(s, s.duel.to)) } : { from: duelPrize(P(s, s.duel.from)), to: duelPrize(P(s, s.duel.to)) } } : null,
    log: s.log.slice(-80), fx: s.fx.slice(-20),
    decks: { door: s.decks.door.length, treasure: s.decks.treasure.length },
    depth: { level: s.depth || 0, bonus: depthBonus(s), treasure: depthTreasure(s), round: s.round || 0, every: depthEvery(s), max: depthMax(s),
      turnsLeft: 1 + ((s.round || 0) + depthEvery(s) - ((s.round || 0) % depthEvery(s))) * s.players.length - s.turn.n },
    trades: (s.trades || []).filter(x => x.from === pid || x.to === pid).map(x => ({ ...x, give: [...x.give], want: [...x.want] })),
    discard: {
      door: { count: s.discard.door.length, top: s.discard.door.at(-1) || null },
      treasure: { count: s.discard.treasure.length, top: s.discard.treasure.at(-1) || null },
    },
    players: s.players.map(p => ({
      id: p.id, name: p.name, color: p.color, avatar: p.avatar, isBot: p.isBot, seat: p.seat,
      level: p.level, races: [...p.races], classes: [...p.classes], halfbreed: p.halfbreed, supermunch: p.supermunch,
      equipped: [...p.equipped], carried: [...p.carried], nextCombat: p.nextCombat, nextEscape: p.nextEscape || 0,
      dead: p.dead, handCount: p.id === pid ? p.hand.length : shownHand(p), handLimit: handLimit(p, s), handsLimit: handsLimit(p), mutagenUsed: !!p.mutagenUsed,
      power: powerOf(s, p), runBonus: runBonusOf(s, p), gold: p.id === pid ? p.gold || 0 : null, spent: p.id === pid ? p.spent || 0 : null, regular: p.id === pid ? isRegular(p) : null, banished: !!p.banished, sets: setsOf(p), ghost: isGhost(p), ally: p.ally || null, allySlots: allySlotsOf(p), allyGear: p.allyGear || [], beast: p.beast || null, persona: p.persona || null, contractsDone: p.contractsDone || 0,
      hand: p.id === pid ? [...p.hand] : undefined,
      contract: p.id === pid && p.contract && CONTRACT_DEFS[p.contract.id] ? { ...CONTRACT_DEFS[p.contract.id], progress: p.contract.progress, rewardText: rewardText(CONTRACT_DEFS[p.contract.id].reward) } : undefined,
    })),
    combat: c ? {
      fighter: c.fighter, helper: c.helper, helpOffer: c.helpOffer, helpReq: c.helpReq,
      monsters: c.monsters.map(m => ({ uid: m.uid, enh: [...m.enh], strength: monsterStrength(s, m), treasure: monsterTreasure(s, m),
        level: monsterBaseLevel(s, def(m.uid)) - SPLIT_STEP * (s.splits?.[m.uid] || 0), noEscape: def(m.uid).escape === false || m.enh.some(u => def(u).noEscape) })),
      pandora: c.pandora ? { ...c.pandora } : null, pandoraCost: PANDORA_COST,
      mods: c.mods, backstabs: c.backstabs, rage: c.rage, turnUndead: c.turnUndead, escape: c.escape,
      winAt: c.winAt, winStart: c.winStart || null, passed: [...(c.passed || [])], numbers: combatNumbers(s),
      heroStrengths: Object.fromEntries(participants(s).map(id => [id, heroStrength(s, P(s, id))])),
    } : null,
    me: me ? pid : null,
    hints: me ? hints(s, pid) : null,
    peek: me && myTurn(s, me) && !s.combat && s.turn.step === 'pre' && itemFlag(me, 'peek') ? s.decks.door.at(-1) || null : null,
    sale: me && s.phase === 'playing' ? { goblin: hasRace(me, 'goblin'), halfling: hasRace(me, 'halfling') && !s.turn.halflingSold } : null,
  };
}
