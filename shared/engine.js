// «Под Землёй» — игровой движок. Чистые функции над JSON-состоянием.
// Сервер хранит состояние, вызывает act()/tick() и рассылает view() каждому игроку.
import { def, allUids, RACE_NAMES, CLASS_NAMES, ruleText, BOSS_MULT, BOSS_MIN_LEVEL, BOSS_FLOOR, TROUBLE_BONUS, WITCHER_BONUS, MUTAGEN_BONUS, LULLABY_PENALTY, LULLABY_MAX, DISTILL_COST,
  DEPTH, DEPTH_TREASURE_EVERY, DEATH_LEVELS, GHOST_BONUS, CONTRACTS, CONTRACT_DEFS, SETS, rewardText } from './cards.js';

export const WIN_LEVEL = 10;
// до какого уровня идёт партия: 10 по умолчанию, в лобби можно выбрать 15 или 20
export const WIN_LEVELS = [10, 15, 20];
export const luxLevel = s => Math.round(winLevel(s) * 0.7);
export const fillText = (s, t) => ruleText(t, { win: winLevel(s), lux: luxLevel(s) });
export const winLevel = s => (WIN_LEVELS.includes(s?.opts?.winLevel) ? s.opts.winLevel : WIN_LEVEL);
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
      persona: x.isBot && x.persona ? x.persona : null, contract: null, contractsDone: 0,
    })),
    decks: { door: shuffle(allUids('door'), rng), treasure: shuffle(allUids('treasure'), rng) },
    discard: { door: [], treasure: [] },
    turn: { idx: 0, pid: null, step: 'pre', n: 0, halflingSold: false },
    combat: null, reveal: null, winners: [], location: null,
    round: 0, depth: 0, trades: [], tradeSeq: 0, grudges: {},
  };
  setupRig(s, rng);
  for (const p of s.players) {
    for (let i = 0; i < 4; i++) { give(p, draw(s, 'door', rng)); give(p, draw(s, 'treasure', rng)); }
  }
  if (!WIN_LEVELS.includes(s.opts.winLevel)) s.opts.winLevel = WIN_LEVEL;
  for (const p of s.players) p.contract = newContract(s, p, rng);
  log(s, `Партия началась. Первым дошедший до ${s.opts.winLevel}-го уровня побеждает.`, 'sys');
  beginTurn(s, Math.floor(rng() * s.players.length), rng);
  return s;
}

// ───────────────────────── утилиты ─────────────────────────
export const P = (s, pid) => s.players.find(p => p.id === pid);
function log(s, text, kind = 'info') {
  s.log.push({ id: ++s.logSeq, text, kind });
  if (s.log.length > 150) s.log.splice(0, s.log.length - 150);
}
function fx(s, o) {
  s.fx.push({ id: ++s.fxSeq, ...o });
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

// Маленький секрет хозяина игры: героя с ником «Еврей» или «EVRE1» легендарки находят сами.
// Обе карты убираются из колоды и по ходу партии приходят ему среди обычного клада.
// Если такого героя за столом нет, легендарки лежат в колоде как все и достаются кому повезёт.
const RIG_NAMES = ['еврей', 'evre1'];
const normName = n => String(n || '').trim().toLowerCase().replace(/ё/g, 'е');
function setupRig(s, rng) {
  const lucky = s.players.find(p => RIG_NAMES.includes(normName(p.name)));
  const legend = s.decks.treasure.filter(isLegend);
  if (!lucky || !legend.length) return;
  s.decks.treasure = s.decks.treasure.filter(u => !isLegend(u));
  // сначала доспехи, потом шлем и меч — легендарный комплект собирается по порядку, дракон последним
  const order = u => ({ armor: 0, head: 1, hand: 2 }[def(u).slot] ?? 3);
  legend.sort((a, b) => order(a) - order(b));
  s.rig = { pid: lucky.id, queue: legend, got: 0, next: 2 + Math.floor(rng() * 3), turns: 0, dueTurn: 4 };
}
// карта клада для конкретного героя (с учётом секрета)
function drawT(s, p, rng) {
  const r = s.rig;
  if (r && p && r.pid === p.id && r.queue.length) {
    r.got++;
    if (r.got >= r.next) { r.next = r.got + 2 + Math.floor(rng() * 3); r.dueTurn = r.turns + 3; return r.queue.shift(); }
  }
  return draw(s, 'treasure', rng);
}
function toDiscard(s, uid) { if (uid) s.discard[def(uid).deck].push(uid); }

// ───────────────────────── свойства героя ─────────────────────────
export const raceKeys = p => p.races.map(u => def(u).race);
export const classKeys = p => p.classes.map(u => def(u).cls);
export const hasRace = (p, r) => (r === 'human' ? p.races.length === 0 : raceKeys(p).includes(r));
export const hasClass = (p, c) => classKeys(p).includes(c);
export const handLimit = (p, s = null) => (hasRace(p, 'dwarf') ? 6 : 5) + ((s && locationOf(s)?.handBonus) || 0);
const bigLimit = p => (hasRace(p, 'dwarf') ? 99 : 1);
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
  if (r.race === 'human' && !hasRace(p, 'human')) return 'Только для человека — сбросьте расу';
  if (r.race && !hasRace(p, r.race)) return `Только для: ${RACE_NAMES[r.race]}`;
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
  if (d.slot === 'pet' && u.pet) return 'Питомец может быть только один';
  if (d.big && u.big >= bigLimit(p)) return 'Большая вещь может быть только одна (гномам — сколько угодно)';
  return null;
}
// бонус надетых вещей; в бою добавляются бонусы против тегов монстров
export function itemBonus(p, s = null) {
  let v = 0;
  for (const u of p.equipped) {
    const d = def(u);
    // гордый клинок не помогает против мелочи
    if (s?.combat && d.minFoe && s.combat.monsters.length && s.combat.monsters.every(m => monsterBaseLevel(s, def(m.uid)) < d.minFoe)) continue;
    v += d.bonus || 0;
    if (d.clsBonus && hasClass(p, d.clsBonus.cls)) v += d.clsBonus.n;
    if (s && d.vsTag && combatHasTag(s, d.vsTag.tag)) v += d.vsTag.n;
  }
  for (const k of setsOf(p)) {
    const st = SETS[k];
    v += st.bonus || 0;
    if (s && st.vsTag && combatHasTag(s, st.vsTag.tag)) v += st.vsTag.n;
  }
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
  }
  for (const u of p.equipped) { const lb = def(u).locBonus; if (lb && s?.location && def(s.location).id === lb.loc) v += lb.n; }
  return v;
}
export const powerOf = (s, p) => p.level + itemBonus(p) + passiveBonus(s, p);
export function runBonusOf(s, p) {
  let b = (hasRace(p, 'elf') ? 1 : 0) + (hasRace(p, 'molefolk') ? 2 : 0) + (p.nextEscape || 0);
  for (const u of p.equipped) b += def(u).runBonus || 0;
  for (const k of setsOf(p)) b += SETS[k].run || 0;
  b += locationOf(s)?.escapeAll || 0;
  return b;
}
function removeItem(p, uid) { return without(p.equipped, uid) || without(p.carried, uid); }

function normalize(s, p) {
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
  while (pets.length > 1) { const u = pets.pop(); without(p.equipped, u); p.carried.push(u); }
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
        const pool = inPlayItems(p);
        for (const u of pool) toDiscard(s, u);
        p.equipped = []; p.carried = [];
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
    }
  }
  normalize(s, p);
}

function kill(s, p, rng) {
  const pool = [...p.equipped, ...p.carried, ...p.hand];
  p.equipped = []; p.carried = []; p.hand = [];
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
      for (const x of alive) give(x, drawT(s, x, rng));
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
function newRound(s) {
  s.round = (s.round || 0) + 1;
  if (s.round % depthEvery(s) || (s.depth || 0) >= depthMax(s)) return;
  s.depth = (s.depth || 0) + 1;
  fx(s, { kind: 'depth', depth: s.depth, treasure: depthTreasure(s) });
  log(s, `⛏ Подземелье уходит глубже: глубина ${s.depth}${s.depth >= depthMax(s) ? ' — это дно' : ''}, монстры +${depthBonus(s)}${depthTreasure(s) ? `, за победу +${depthTreasure(s)} клада` : ''}.`, 'event');
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
  if (k.reward.levels && p.level + k.reward.levels < winLevel(s)) { setLevel(s, p, p.level + k.reward.levels); got = rewardText(k.reward); }
  else { const t = k.reward.treasures || 2; for (let i = 0; i < t; i++) give(p, drawT(s, p, rng)); got = rewardText({ treasures: t }); }
  if (lowest) { give(p, drawT(s, p, rng)); got += ' и ещё карта клада отстающему'; }
  p.contractsDone = (p.contractsDone || 0) + 1;
  fx(s, { kind: 'contract', pid: p.id, id: k.id, reward: got });
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
  if (s.turn.n > 1 && (s.turn.n - 1) % s.players.length === 0) newRound(s);
  s.reveal = null;
  for (const x of s.players) x.dead = false;
  if (p.needsRevive) {
    for (let i = 0; i < 4; i++) { give(p, draw(s, 'door', rng)); give(p, drawT(s, p, rng)); }
    p.needsRevive = false;
    log(s, `${p.name} возвращается из мёртвых с новыми картами.`, 'good');
  }
  if (s.rig && s.rig.pid === p.id && s.rig.queue.length) {
    s.rig.turns++;
    // если клад долго не идёт, легендарка тихо находится сама в начале хода
    if (s.rig.turns >= s.rig.dueTurn) { give(p, s.rig.queue.shift()); s.rig.dueTurn = s.rig.turns + 3; s.rig.next = s.rig.got + 2 + Math.floor(rng() * 3); }
  }
  log(s, `Ход: ${p.name}.`, 'turn');
}
function nextTurn(s, rng) { beginTurn(s, (s.turn.idx + 1) % s.players.length, rng); }

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
  let base = monsterBaseLevel(s, d);
  if (m.enh.some(u => def(u).double)) base *= 2;
  let v = base + m.enh.reduce((a, u) => a + (def(u).bonus || 0), 0);
  const parts = participants(s).map(id => P(s, id));
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

function endCombat(s) {
  const c = s.combat;
  for (const m of c.monsters) { toDiscard(s, m.uid); m.enh.forEach(u => toDiscard(s, u)); }
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
  let rigP = s.rig ? [f, h].find(x => x && x.id === s.rig.pid) : null;
  if (rigP && rigP === h && Math.min(want, count) === 0) rigP = null;
  const drawn = [];
  for (let i = 0; i < count; i++) { const u = rigP ? drawT(s, rigP, rng) : draw(s, 'treasure', rng); if (u) drawn.push(u); }
  shuffle(drawn, rng);
  const share = h ? Math.min(want, drawn.length) : 0;
  const hp = drawn.slice(0, share), fp = drawn.slice(share);
  if (rigP) {
    // легендарка остаётся у того, кому предназначена
    const mine = rigP === f ? fp : hp, other = rigP === f ? hp : fp;
    for (let i = 0; i < other.length; i++) {
      if (!isLegend(other[i])) continue;
      const j = mine.findIndex(u => !isLegend(u));
      if (j >= 0) [other[i], mine[j]] = [mine[j], other[i]];
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
  if (!h) contractEvent(s, f, 'killSolo', {}, rng);
  if (c.trouble) contractEvent(s, f, 'troubleWin', {}, rng);
  if (h) contractEvent(s, h, 'helpWin', {}, rng);
  endCombat(s);
  const winners = [f, h].filter(x => x && x.level >= winLevel(s));
  if (winners.length) {
    s.phase = 'ended';
    s.winners = winners.map(x => x.id);
    log(s, `🏆 ${winners.map(x => x.name).join(' и ')} достигает ${winLevel(s)}-го уровня и побеждает!`, 'win');
  }
}

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
      const noEsc = d.escape === false || m.enh.some(u => def(u).noEscape);
      const bonus = runBonusOf(s, p) + (c.escape[pid] || 0) + (d.escapeMod || 0);
      let r = 0, ok = false;
      if (noEsc) log(s, `От ${q(d.name)} не убежать!`, 'bad');
      else {
        r = d6(rng);
        ok = r + bonus >= 5;
        fx(s, { kind: 'dice', pid, value: r, bonus, ok, label: `Побег от ${q(d.name)}` });
        if (!ok && hasRace(p, 'halfling') && p.hand.length) {
          const u = cheapest(p.hand);
          without(p.hand, u); toDiscard(s, u);
          r = d6(rng); ok = r + bonus >= 5;
          fx(s, { kind: 'dice', pid, value: r, bonus, ok, label: 'Полурослик перебрасывает' });
          log(s, `${p.name} сбрасывает карту и перебрасывает.`, 'info');
        }
      }
      const sign = bonus ? (bonus > 0 ? '+' : '') + bonus : '';
      if (ok) { fx(s, { kind: 'escaped', pid, card: m.uid }); log(s, `${p.name} удирает от ${q(d.name)} (${r}${sign}).`, 'good'); contractEvent(s, p, 'escape', {}, rng); continue; }
      if (monTags(m.uid).some(t => itemList(p, 'immune').includes(t))) {
        fx(s, { kind: 'escaped', pid, card: m.uid, calm: true });
        log(s, `${p.name} не убежал от ${q(d.name)}, но противогаз спас от расплаты.`, 'good');
        continue;
      }
      const pet = p.equipped.find(u => def(u).slot === 'pet' && def(u).petSave !== false);
      if (pet) {
        removeItem(p, pet); toDiscard(s, pet);
        fx(s, { kind: 'pet', pid, card: pet, mon: m.uid });
        log(s, `${q(def(pet).name)} бросается на ${q(d.name)} и спасает ${p.name} от расплаты!`, 'good');
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
    if (d.type === 'curse') { resolveCurse(s, p, uid, rng, null); return; }
    if (d.type === 'location') { setLocation(s, p, uid); return; }
    if (d.type === 'event') { resolveEvent(s, p, uid, rng); return; }
    p.hand.push(uid);
    log(s, `${p.name} выбивает дверь: ${q(d.name)} — в руку.`, 'info');
  },
};

// монстр наугад из колоды проходов, а если там пусто — из сброса
function randomMonster(s, rng) {
  for (const pile of [s.decks.door, s.discard.door]) {
    const list = pile.filter(u => def(u).type === 'monster');
    if (list.length) { const u = pick(list, rng); without(pile, u); return u; }
  }
  return null;
}
H.lookForTrouble = {
  check(s, p) {
    return manageErr(s, p) || (s.turn.step !== 'post' ? 'Искать неприятности можно после выбитой двери без монстра' : null)
      || (![...s.decks.door, ...s.discard.door].some(u => def(u).type === 'monster') ? 'Монстры в колоде кончились' : null);
  },
  run(s, p, a, rng) {
    const uid = randomMonster(s, rng);
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
    case 'location': return manageErr(s, p);
    case 'event': return manageErr(s, p);
    case 'buff': return c && isParticipant(s, p.id) && levelOnlyFight(s) ? 'Против этого монстра считается только уровень — зелье пропадёт зря' : null;
    case 'hoard': return manageErr(s, p) || (s.turn.hoardPlayed ? 'Схрон можно открыть только один раз за ход' : null);
    case 'levelup': return p.level >= winLevel(s) - 1 ? 'Последний уровень — только убийством монстра' : null;
    case 'curse': {
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
    case 'monster':
      return 'Монстра из руки подбрасывают в чужой бой картой «Из темноты вылезло…»';
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
        log(s, `${p.name} выкладывает ${q(d.name)}${isLegend(a.uid) ? ' — легендарная вещь!' : ''}.`, isLegend(a.uid) ? 'win' : 'info');
        break;
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
        give(p, drawT(s, p, rng)); give(p, drawT(s, p, rng));
        toDiscard(s, a.uid);
        s.turn.hoardPlayed = true;
        log(s, `${p.name} находит схрон: +2 карты клада.`, 'good');
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
        grudge(s, c.fighter, p.id);
        log(s, `${p.name}: из темноты вылезает ${q(def(a.with).name)} (${wm.power ? `босс, сила ${wm.power}` : `ур. ${def(a.with).level}`})!`, 'combat');
        fx(s, { kind: 'wandering', pid: p.id, card: a.with, ...(wm.power ? { power: wm.power } : {}) });
        break;
      case 'oneshot':
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
    const ok = !!a.uid && [...p.races, ...p.classes, p.halfbreed, p.supermunch, ...inPlayItems(p)].filter(Boolean).includes(a.uid);
    return ok ? null : 'Такой карты у вас на столе нет';
  },
  run(s, p, a) {
    if (p.halfbreed === a.uid) p.halfbreed = null;
    else if (p.supermunch === a.uid) p.supermunch = null;
    else if (!without(p.races, a.uid) && !without(p.classes, a.uid)) removeItem(p, a.uid);
    toDiscard(s, a.uid);
    normalize(s, p);
    log(s, `${p.name} сбрасывает ${q(def(a.uid).name)}.`, 'info');
  },
};

export function saleValue(s, p, uids) {
  const vals = uids.map(u => (def(u).value || 0) + (hasRace(p, 'goblin') ? 200 : 0));
  let total = vals.reduce((a, b) => a + b, 0);
  let doubled = false;
  if (hasRace(p, 'halfling') && !s.turn.halflingSold && vals.length) { total += Math.max(...vals); doubled = true; }
  const rate = locationOf(s)?.saleRate || 1000;
  return { total, doubled, rate, levels: Math.floor(total / rate) };
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
    const { total, rate, levels: lv } = saleValue(s, p, u);
    if (lv < 1) return `Нужно минимум ${rate} голдов, у вас ${total}`;
    if (p.level + lv >= winLevel(s)) return `Продажей нельзя дойти до ${winLevel(s)}-го уровня`;
    return null;
  },
  run(s, p, a, rng) {
    const { total, doubled, levels: lv } = saleValue(s, p, a.uids);
    for (const x of a.uids) { if (!without(p.hand, x)) removeItem(p, x); toDiscard(s, x); }
    if (doubled) s.turn.halflingSold = true;
    setLevel(s, p, p.level + lv);
    log(s, `${p.name} продаёт ${a.uids.length} вещ. за ${total} голдов${doubled ? ' (полурослик торгуется вдвое)' : ''}: +${lv} ур.`, 'good');
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
    fx(s, { kind: 'tradeOffer', pid: p.id, to: a.to, id: o.id });
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
    const c = s.combat;
    if (!c || !c.winAt) return 'Сейчас нечему мешать';
    if (isParticipant(s, p.id)) return 'Вы сами в этом бою';
    if ((c.passed || []).includes(p.id)) return 'Вы уже сказали, что не мешаете';
    return null;
  },
  run(s, p) {
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
        give(p, drawT(s, p, rng));
        log(s, `${p.name} перегоняет ${DISTILL_COST} карты в карту клада.`, 'good');
        break;
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
  for (const k of ['cards', 'uids', 'give']) {
    if (a[k] !== undefined && (!Array.isArray(a[k]) || a[k].length > 40 || a[k].some(x => typeof x !== 'string'))) return true;
  }
  for (const k of ['uid', 'target', 'with', 'to', 'item', 'name']) {
    if (a[k] !== undefined && a[k] !== null && typeof a[k] !== 'string') return true;
  }
  if (a.monster !== undefined && !Number.isInteger(a.monster)) return true;
  if (a.offer !== undefined && !Number.isInteger(a.offer)) return true;
  return false;
}

export function check(s, pid, a) {
  if (badShape(a)) return 'Плохие данные';
  if (s.phase !== 'playing') return 'Партия окончена';
  const p = P(s, pid);
  if (!p) return 'Вы не в игре';
  const h = Object.hasOwn(H, a.type) ? H[a.type] : null;
  if (!h) return 'Неизвестное действие';
  return h.check(s, p, a) || null;
}

export function act(s, pid, a, { rng = Math.random, now = Date.now() } = {}) {
  s.now = now;
  const err = check(s, pid, a);
  if (err) return { ok: false, error: err };
  const hadCombat = !!s.combat;
  H[a.type].run(s, P(s, pid), a, rng);
  if (hadCombat && s.combat && a.type !== 'fight' && a.type !== 'pass') { s.combat.winAt = null; s.combat.passed = []; }
  s.version++;
  return { ok: true };
}

export function tick(s, { rng = Math.random, now = Date.now() } = {}) {
  s.now = now;
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
  if (d.type === 'monster') return out; // монстр из руки идёт в бой только с картой «Из темноты вылезло…»
  if (d.type === 'curse' || (d.type === 'oneshot' && d.effect === 'enslave')) { s.players.forEach(x => tryA({ type: 'playCard', uid, target: x.id })); return out; }
  if (d.type === 'enhancer' || (d.type === 'oneshot' && d.effect === 'remove')) {
    (s.combat?.monsters || []).forEach((m, i) => tryA({ type: 'playCard', uid, monster: i }));
    return out;
  }
  if (d.type === 'oneshot' && d.effect === 'bonus') {
    tryA({ type: 'playCard', uid, side: 'player' });
    tryA({ type: 'playCard', uid, side: 'monster' });
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
    manage: !manageErr(s, p),
    haunt: { player: ok({ type: 'haunt', side: 'player' }), monster: ok({ type: 'haunt', side: 'monster' }) },
    trade: !p.dead && !isParticipant(s, p.id),
    tradeTargets: s.players.filter(x => x !== p && !x.dead && !isParticipant(s, x.id) && !isParticipant(s, p.id) && !p.dead).map(x => x.id),
    cards: {}, equip: {}, abilities: {},
  };
  for (const u of p.hand) h.cards[u] = playOptions(s, pid, u);
  for (const u of p.carried) h.equip[u] = ok({ type: 'equip', uid: u });
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
  }
  return h;
}

// Персональный вид состояния: чужие руки и колоды скрыты.
export function view(s, pid) {
  const me = P(s, pid);
  const c = s.combat;
  return {
    phase: s.phase, version: s.version, turn: { ...s.turn }, winners: [...s.winners],
    reveal: s.reveal, opts: { winDelayMs: s.opts.winDelayMs, winLevel: winLevel(s) }, location: s.location,
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
      dead: p.dead, handCount: p.hand.length, handLimit: handLimit(p, s), handsLimit: handsLimit(p), mutagenUsed: !!p.mutagenUsed,
      power: powerOf(s, p), runBonus: runBonusOf(s, p), sets: setsOf(p), ghost: isGhost(p), persona: p.persona || null, contractsDone: p.contractsDone || 0,
      hand: p.id === pid ? [...p.hand] : undefined,
      contract: p.id === pid && p.contract && CONTRACT_DEFS[p.contract.id] ? { ...CONTRACT_DEFS[p.contract.id], progress: p.contract.progress, rewardText: rewardText(CONTRACT_DEFS[p.contract.id].reward) } : undefined,
    })),
    combat: c ? {
      fighter: c.fighter, helper: c.helper, helpOffer: c.helpOffer, helpReq: c.helpReq,
      monsters: c.monsters.map(m => ({ uid: m.uid, enh: [...m.enh], strength: monsterStrength(s, m), treasure: monsterTreasure(s, m),
        level: monsterBaseLevel(s, def(m.uid)), noEscape: def(m.uid).escape === false || m.enh.some(u => def(u).noEscape) })),
      mods: c.mods, backstabs: c.backstabs, rage: c.rage, turnUndead: c.turnUndead, escape: c.escape,
      winAt: c.winAt, winStart: c.winStart || null, passed: [...(c.passed || [])], numbers: combatNumbers(s),
      heroStrengths: Object.fromEntries(participants(s).map(id => [id, heroStrength(s, P(s, id))])),
    } : null,
    me: me ? pid : null,
    hints: me ? hints(s, pid) : null,
    peek: me && myTurn(s, me) && !s.combat && s.turn.step === 'pre' && itemFlag(me, 'peek') ? s.decks.door.at(-1) || null : null,
    sale: me && s.phase === 'playing' ? { rate: locationOf(s)?.saleRate || 1000, goblin: hasRace(me, 'goblin'), halfling: hasRace(me, 'halfling') && !s.turn.halflingSold } : null,
  };
}
