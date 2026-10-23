// «Под Землёй» — игровой движок. Чистые функции над JSON-состоянием.
// Сервер хранит состояние, вызывает act()/tick() и рассылает view() каждому игроку.
import { def, allUids, RACE_NAMES, CLASS_NAMES } from './cards.js';

export const WIN_LEVEL = 10;
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
    opts: { winDelayMs: 5000, ...opts },
    players: seats.map((x, i) => ({
      id: x.id, name: x.name, color: x.color || null, avatar: x.avatar ?? i, isBot: !!x.isBot, seat: i,
      level: 1, races: [], classes: [], halfbreed: null, supermunch: null,
      equipped: [], carried: [], hand: [], nextCombat: 0, nextEscape: 0, dead: false, needsRevive: false,
    })),
    decks: { door: shuffle(allUids('door'), rng), treasure: shuffle(allUids('treasure'), rng) },
    discard: { door: [], treasure: [] },
    turn: { idx: 0, pid: null, step: 'pre', n: 0, halflingSold: false },
    combat: null, reveal: null, winners: [], location: null,
  };
  for (const p of s.players) {
    for (let i = 0; i < 4; i++) { give(p, draw(s, 'door', rng)); give(p, draw(s, 'treasure', rng)); }
  }
  log(s, 'Партия началась. Первым дошедший до 10-го уровня побеждает.', 'sys');
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
function toDiscard(s, uid) { if (uid) s.discard[def(uid).deck].push(uid); }

// ───────────────────────── свойства героя ─────────────────────────
export const raceKeys = p => p.races.map(u => def(u).race);
export const classKeys = p => p.classes.map(u => def(u).cls);
export const hasRace = (p, r) => (r === 'human' ? p.races.length === 0 : raceKeys(p).includes(r));
export const hasClass = (p, c) => classKeys(p).includes(c);
export const handLimit = p => (hasRace(p, 'dwarf') ? 6 : 5);
const bigLimit = p => (hasRace(p, 'dwarf') ? 99 : 1);
const handsLimit = p => (hasClass(p, 'engineer') ? 3 : 2);
const inPlayItems = p => [...p.equipped, ...p.carried];
export const locationOf = s => (s.location ? def(s.location) : null);
const hasItemTag = (p, tag) => p.equipped.some(u => (def(u).tags || []).includes(tag));
const combatHasTag = (s, tag) => !!s.combat && s.combat.monsters.some(m => (def(m.uid).tags || []).includes(tag));

function reqError(p, d) {
  const r = d.req;
  if (!r) return null;
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
    v += d.bonus || 0;
    if (d.clsBonus && hasClass(p, d.clsBonus.cls)) v += d.clsBonus.n;
    if (s && d.vsTag && combatHasTag(s, d.vsTag.tag)) v += d.vsTag.n;
  }
  return v;
}
// постоянные бонусы расы, класса и локации (без боевых)
export function passiveBonus(s, p) {
  let v = 0;
  if (hasRace(p, 'orc') && !p.equipped.some(u => def(u).slot === 'head')) v += 2;
  if (hasClass(p, 'engineer')) v += p.equipped.filter(u => def(u).big).length;
  const L = locationOf(s);
  if (L) {
    v += L.heroAll || 0;
    for (const m of L.heroMod || []) if ((m.cls && hasClass(p, m.cls)) || (m.race && hasRace(p, m.race))) v += m.n;
    if (L.lightBonus && hasItemTag(p, 'light')) v += L.lightBonus;
  }
  return v;
}
export const powerOf = (s, p) => p.level + itemBonus(p) + passiveBonus(s, p);
export function runBonusOf(s, p) {
  let b = (hasRace(p, 'elf') ? 1 : 0) + (hasRace(p, 'molefolk') ? 2 : 0) + (p.nextEscape || 0);
  for (const u of p.equipped) b += def(u).runBonus || 0;
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
  const cap = canWin ? WIN_LEVEL : WIN_LEVEL - 1;
  const nl = Math.max(1, Math.min(lvl, Math.max(cap, p.level)));
  if (nl !== p.level) fx(s, { kind: nl > p.level ? 'levelUp' : 'levelDown', pid: p.id, from: p.level, to: nl });
  p.level = Math.min(nl, WIN_LEVEL);
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
        const pool = inPlayItems(p).filter(u => !def(u).big);
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
  p.dead = true; p.needsRevive = true;
  fx(s, { kind: 'death', pid: p.id });
  log(s, `💀 ${p.name} погибает. Уровень, раса и класс остаются.${taken.length ? ' Труп обшарили: ' + taken.join(', ') + '.' : ''}`, 'bad');
}

function resolveCurse(s, target, uid, rng, byName) {
  const d = def(uid);
  toDiscard(s, uid);
  const ward = target.hand.find(u => def(u).effect === 'ward');
  log(s, `${byName ? byName + ' насылает' : 'Сработало'} ${q(d.name)} на ${target.name}.`, 'curse');
  fx(s, { kind: 'curse', pid: target.id, card: uid });
  if (locationOf(s)?.noCurses) { log(s, 'В тёплой котельной проклятие растаяло.', 'good'); return; }
  if (hasRace(target, 'molefolk') && d.fx.every(f => f.k === 'slot' && ['head', 'armor', 'feet'].includes(f.slot))) {
    log(s, `Толстая шкура кротолюда ${target.name} не пропустила проклятие.`, 'good');
    return;
  }
  if (ward) {
    without(target.hand, ward); toDiscard(s, ward);
    log(s, `Куриный бог ${target.name} отвёл проклятие.`, 'good');
    return;
  }
  if (hasClass(target, 'cleric')) {
    const r = d6(rng);
    fx(s, { kind: 'dice', pid: target.id, value: r, ok: r >= 5, label: 'Жрец отмаливает проклятие' });
    if (r >= 5) { log(s, `${target.name} отмолил проклятие (выпало ${r}).`, 'good'); return; }
  }
  applyFx(s, target, d.fx, rng);
}

// ───────────────────────── локации и события ─────────────────────────
function setLocation(s, p, uid) {
  if (s.location) toDiscard(s, s.location);
  s.location = uid;
  const d = def(uid);
  fx(s, { kind: 'location', pid: p.id, card: uid });
  log(s, `${p.name} открывает локацию ${q(d.name)}: ${d.text}`, 'event');
  for (const x of s.players) normalize(s, x);
}

function resolveEvent(s, p, uid, rng) {
  const d = def(uid);
  const alive = s.players.filter(x => !x.dead);
  fx(s, { kind: 'event', pid: p.id, card: uid });
  log(s, `Событие ${q(d.name)}: ${d.text}`, 'event');
  switch (d.event) {
    case 'quake':
      for (const x of alive) if (x.hand.length) { const u = pick(x.hand, rng); without(x.hand, u); toDiscard(s, u); }
      break;
    case 'light':
      for (const x of alive) if (hasClass(x, 'cleric') || hasClass(x, 'bard')) { setLevel(s, x, x.level + 1); log(s, `${x.name} получает уровень.`, 'good'); }
      break;
    case 'fair':
      for (const x of alive) give(x, draw(s, 'treasure', rng));
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
      for (const x of alive) if (x.level >= 7) { setLevel(s, x, x.level - 1); log(s, `${x.name} платит налог: −1 уровень.`, 'bad'); }
      break;
  }
  toDiscard(s, uid);
}

// ───────────────────────── ход ─────────────────────────
function beginTurn(s, idx, rng) {
  const p = s.players[idx];
  s.turn = { idx, pid: p.id, step: 'pre', n: (s.turn?.n || 0) + 1, halflingSold: false, hoardPlayed: false, distilled: false };
  s.reveal = null;
  for (const x of s.players) x.dead = false;
  if (p.needsRevive) {
    for (let i = 0; i < 4; i++) { give(p, draw(s, 'door', rng)); give(p, draw(s, 'treasure', rng)); }
    p.needsRevive = false;
    log(s, `${p.name} возвращается из мёртвых с новыми картами.`, 'good');
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

export function heroStrength(s, p) {
  const c = s.combat;
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
export function monsterStrength(s, m) {
  const d = def(m.uid);
  let base = monsterBaseLevel(s, d);
  if (m.enh.some(u => def(u).double)) base *= 2;
  let v = base + m.enh.reduce((a, u) => a + (def(u).bonus || 0), 0);
  const parts = participants(s).map(id => P(s, id));
  for (const vs of d.vs || []) if (parts.some(p => matchVs(p, vs))) v += vs.n;
  for (const w of d.vsItem || []) if (parts.some(p => hasItemTag(p, w.tag))) v += w.n;
  if (d.soloBonus && s.combat && !s.combat.helper) v += d.soloBonus;
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
    + c.mods.filter(m => m.side === 'player').reduce((a, m) => a + m.n, 0);
  const perMonster = c.monsters.map(m => monsterStrength(s, m));
  const monsters = perMonster.reduce((a, b) => a + b, 0)
    + c.mods.filter(m => m.side === 'monster').reduce((a, m) => a + m.n, 0);
  const warrior = parts.some(p => hasClass(p, 'warrior'));
  const winning = c.monsters.length > 0 && (heroes > monsters || (warrior && heroes === monsters));
  const f = P(s, c.fighter);
  let bonusT = 0;
  if (c.monsters.length) {
    bonusT += locationOf(s)?.treasureBonus || 0;
    if (hasClass(f, 'bard')) bonusT += 1;
    if (hasRace(f, 'orc') && c.monsters.some(m => monsterBaseLevel(s, def(m.uid)) >= 10)) bonusT += 1;
  }
  const treasures = c.monsters.reduce((a, m) => a + monsterTreasure(s, m), 0) + (c.charmTreasure || 0) + bonusT;
  const levels = c.monsters.reduce((a, m) => a + (def(m.uid).levels || 1), 0);
  return { heroes, monsters, winning, warrior, perMonster, treasures, levels };
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
  log(s, `${p.name} встречает ${q(d.name)} (ур. ${monsterBaseLevel(s, d)}). Бой!`, 'combat');
  fx(s, { kind: 'combat', pid: p.id, card: monsterUid });
  if (d.ambush) {
    log(s, d.ambush.text, 'bad');
    fx(s, { kind: 'ambush', pid: p.id, card: monsterUid });
    applyFx(s, p, d.ambush.fx, rng);
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

function shareTreasure(s, count, rng) {
  const c = s.combat;
  const f = P(s, c.fighter);
  const h = c.helper ? P(s, c.helper) : null;
  const drawn = [];
  for (let i = 0; i < count; i++) { const u = draw(s, 'treasure', rng); if (u) drawn.push(u); }
  shuffle(drawn, rng);
  const share = h ? Math.min((c.helpOffer || 0) + (hasRace(h, 'goblin') ? 1 : 0), drawn.length) : 0;
  if (h) h.hand.push(...drawn.slice(0, share));
  f.hand.push(...drawn.slice(share));
  return { total: drawn.length, share };
}

function afterMonstersGone(s, rng) {
  // все монстры убраны без убийства: только клад за усыплённых
  const c = s.combat;
  if (c.charmTreasure) {
    const r = shareTreasure(s, c.charmTreasure, rng);
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
  const r = shareTreasure(s, n.treasures, rng);
  fx(s, { kind: 'victory', pid: f.id });
  log(s, `⚔️ ${f.name}${h ? ' и ' + h.name : ''} побеждают ${names}! ${f.name} получает +${n.levels} ур. и ${r.total - r.share} клада${h && r.share ? `, ${h.name} — ${r.share}` : ''}.`, 'good');
  endCombat(s);
  const winners = [f, h].filter(x => x && x.level >= WIN_LEVEL);
  if (winners.length) {
    s.phase = 'ended';
    s.winners = winners.map(x => x.id);
    log(s, `🏆 ${winners.map(x => x.name).join(' и ')} достигает 10-го уровня и побеждает!`, 'win');
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
        log(s, `${q(d.name)} не стал гнаться за ${p.name}.`, 'good');
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
      if (ok) { log(s, `${p.name} удирает от ${q(d.name)} (${r}${sign}).`, 'good'); continue; }
      const pet = p.equipped.find(u => def(u).slot === 'pet');
      if (pet) {
        removeItem(p, pet); toDiscard(s, pet);
        fx(s, { kind: 'pet', pid, card: pet });
        log(s, `${q(def(pet).name)} бросается на ${q(d.name)} и спасает ${p.name} от расплаты!`, 'good');
        continue;
      }
      log(s, `${p.name} не убежал от ${q(d.name)}${noEsc ? '' : ` (${r}${sign})`}. ${d.bad.text}`, 'bad');
      applyFx(s, p, d.bad.fx, rng);
    }
  }
  endCombat(s);
}

export function cardWorth(uid) {
  const d = def(uid);
  if (d.type === 'levelup') return 900;
  if (d.type === 'monster') return 50 + (d.level || 10) * 10;
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

H.lookForTrouble = {
  check(s, p, a) {
    return manageErr(s, p) || (s.turn.step !== 'post' ? 'Искать неприятности можно после выбитой двери без монстра' : null)
      || (!p.hand.includes(a.uid) || def(a.uid).type !== 'monster' ? 'Нужен монстр из руки' : null);
  },
  run(s, p, a, rng) { without(p.hand, a.uid); s.reveal = { uid: a.uid, by: p.id, seq: ++s.revealSeq }; startCombat(s, p, a.uid, rng); },
};

H.loot = {
  check: (s, p) => manageErr(s, p) || (s.turn.step !== 'post' ? 'Обшарить комнату можно после выбитой двери без монстра' : null),
  run(s, p, a, rng) {
    give(p, draw(s, 'door', rng));
    s.turn.step = 'charity';
    log(s, `${p.name} обшаривает комнату и берёт карту прохода втёмную.`, 'info');
  },
};

H.endTurn = {
  check(s, p, a) {
    if (!myTurn(s, p)) return 'Сейчас не ваш ход';
    if (s.combat) return 'Нельзя во время боя';
    if (s.turn.step !== 'charity') return s.turn.step === 'pre' ? 'Сначала выбейте дверь' : 'Сначала ищите неприятности или обшарьте комнату';
    const excess = Math.max(0, p.hand.length - handLimit(p));
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
    case 'buff': return null;
    case 'hoard': return manageErr(s, p) || (s.turn.hoardPlayed ? 'Схрон можно открыть только один раз за ход' : null);
    case 'levelup': return p.level >= WIN_LEVEL - 1 ? 'Последний уровень — только убийством монстра' : null;
    case 'curse': {
      const t = P(s, a.target);
      if (!t || t === p) return 'Выберите жертву';
      if (t.dead) return 'Жертва уже мертва';
      return null;
    }
    case 'enhancer':
      if (!c) return 'Только во время боя';
      if (!Number.isInteger(a.monster) || !c.monsters[a.monster]) return 'Выберите монстра';
      return null;
    case 'wandering':
      if (!c) return 'Только во время боя';
      if (!a.with || a.with === a.uid || !p.hand.includes(a.with) || def(a.with).type !== 'monster') return 'Нужен монстр из руки';
      return null;
    case 'oneshot':
      if (d.effect === 'ward') return 'Срабатывает сам, когда на вас насылают проклятие';
      if (!c) return 'Только во время боя';
      if (d.effect === 'bonus') return a.side === 'player' || a.side === 'monster' ? null : 'Выберите сторону';
      if (d.effect === 'escape' || d.effect === 'escapeBonus') return isParticipant(s, p.id) ? null : 'Только участник боя';
      if (d.effect === 'remove') return Number.isInteger(a.monster) && c.monsters[a.monster] ? null : 'Выберите монстра';
      return 'Нельзя';
    case 'monster':
      return 'Монстра играют через «Искать неприятности» или карту «Из темноты вылезло…»';
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
        if (!equipError(p, a.uid)) p.equipped.push(a.uid); else p.carried.push(a.uid);
        log(s, `${p.name} выкладывает ${q(d.name)}.`, 'info');
        break;
      case 'location': setLocation(s, p, a.uid); break;
      case 'event': resolveEvent(s, p, a.uid, rng); break;
      case 'buff':
        toDiscard(s, a.uid);
        p.nextCombat += d.bonus;
        fx(s, { kind: 'buff', pid: p.id, card: a.uid, n: d.bonus });
        log(s, `${p.name}: ${q(d.name)} — +${d.bonus} к силе ${isParticipant(s, p.id) ? 'прямо сейчас' : 'в следующем бою'}.`, 'good');
        break;
      case 'hoard':
        give(p, draw(s, 'treasure', rng)); give(p, draw(s, 'treasure', rng));
        toDiscard(s, a.uid);
        s.turn.hoardPlayed = true;
        log(s, `${p.name} находит схрон: +2 карты клада.`, 'good');
        break;
      case 'levelup':
        toDiscard(s, a.uid);
        setLevel(s, p, p.level + 1);
        log(s, `${p.name}: ${q(d.name)} — теперь ${p.level} ур.`, 'good');
        break;
      case 'curse': resolveCurse(s, P(s, a.target), a.uid, rng, p.name); break;
      case 'enhancer': {
        const m = c.monsters[a.monster];
        m.enh.push(a.uid);
        fx(s, { kind: 'enhance', pid: p.id, card: a.uid, n: d.bonus });
        log(s, `${p.name} играет ${q(d.name)} на ${q(def(m.uid).name)}${d.double ? ' — уровень удваивается!' : ` (${d.bonus > 0 ? '+' : ''}${d.bonus})`}.`, 'combat');
        break;
      }
      case 'wandering':
        without(p.hand, a.with);
        c.used.push(a.uid);
        c.monsters.push({ uid: a.with, enh: [] });
        log(s, `${p.name}: из темноты вылезает ${q(def(a.with).name)} (ур. ${def(a.with).level})!`, 'combat');
        fx(s, { kind: 'wandering', pid: p.id, card: a.with });
        break;
      case 'oneshot':
        c.used.push(a.uid);
        if (d.effect === 'bonus') {
          let n = d.bonus + (hasClass(p, 'alchemist') ? 2 : 0);
          if (d.tagBonus && a.side === 'player' && combatHasTag(s, d.tagBonus.tag)) n += d.tagBonus.n;
          c.mods.push({ side: a.side, n, by: p.id, uid: a.uid });
          fx(s, { kind: 'mod', pid: p.id, card: a.uid, side: a.side, n });
          log(s, `${p.name} использует ${q(d.name)}: +${n} ${a.side === 'player' ? 'героям' : 'монстрам'}.`, 'combat');
        } else if (d.effect === 'escapeBonus') {
          const n = d.bonus + (hasClass(p, 'alchemist') ? 2 : 0);
          c.escape[p.id] = (c.escape[p.id] || 0) + n;
          log(s, `${p.name} готовит ${q(d.name)}: +${n} к побегу.`, 'combat');
        } else if (d.effect === 'escape') {
          log(s, `${p.name} бросает ${q(d.name)} — герои растворяются в дыму без наград.`, 'combat');
          endCombat(s);
        } else if (d.effect === 'remove') {
          const m = removeMonster(s, a.monster);
          log(s, `${p.name} читает ${q(d.name)}: ${q(def(m.uid).name)} каменеет.`, 'combat');
          if (!c.monsters.length) afterMonstersGone(s, rng);
        }
        break;
    }
  },
};

H.equip = {
  check(s, p, a) { return manageErr(s, p) || (!p.carried.includes(a.uid) ? 'Вещи нет среди носимых' : equipError(p, a.uid)); },
  run(s, p, a) { without(p.carried, a.uid); p.equipped.push(a.uid); },
};
H.unequip = {
  check(s, p, a) { return manageErr(s, p) || (!p.equipped.includes(a.uid) ? 'Вещь не надета' : null); },
  run(s, p, a) { without(p.equipped, a.uid); p.carried.push(a.uid); },
};
H.autoEquip = {
  check(s, p) { return manageErr(s, p) || (!inPlayItems(p).length ? 'Нет вещей' : null); },
  run(s, p) {
    const all = inPlayItems(p).sort((a, b) => (def(b).bonus || 0) - (def(a).bonus || 0) || (def(b).runBonus || 0) - (def(a).runBonus || 0));
    p.equipped = []; p.carried = [];
    for (const u of all) { if (!equipError(p, u)) p.equipped.push(u); else p.carried.push(u); }
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
    if (p.level + lv >= WIN_LEVEL) return 'Продажей нельзя дойти до 10-го уровня';
    return null;
  },
  run(s, p, a) {
    const { total, doubled, levels: lv } = saleValue(s, p, a.uids);
    for (const x of a.uids) { if (!without(p.hand, x)) removeItem(p, x); toDiscard(s, x); }
    if (doubled) s.turn.halflingSold = true;
    setLevel(s, p, p.level + lv);
    log(s, `${p.name} продаёт ${a.uids.length} вещ. за ${total} голдов${doubled ? ' (полурослик торгуется вдвое)' : ''}: +${lv} ур.`, 'good');
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
    log(s, `${p.name} заносит оружие! Есть ${Math.round(s.opts.winDelayMs / 1000)} с, чтобы помешать.`, 'combat');
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
        if (cards.length !== 1 || !allInHand(p, cards)) return 'Сбросьте одну карту';
        return null;
      }
      case 'lullaby': {
        if (!hasClass(p, 'bard')) return 'Только бард';
        if (!c) return 'Только во время боя';
        if ((c.lullaby[p.id] || 0) >= 2) return 'Две колыбельные за бой — предел';
        if (cards.length !== 1 || !allInHand(p, cards)) return 'Сбросьте одну карту';
        return null;
      }
      case 'distill': {
        if (!hasClass(p, 'alchemist')) return 'Только алхимик';
        const e = manageErr(s, p); if (e) return e;
        if (s.turn.distilled) return 'Перегонка — раз в ход';
        if (cards.length !== 2 || !allInHand(p, cards)) return 'Сбросьте две карты';
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
        log(s, `${p.name} впадает в ярость: +${cards.length}.`, 'combat');
        break;
      case 'turn':
        c.turnCount[p.id] = (c.turnCount[p.id] || 0) + cards.length;
        c.turnUndead[p.id] = (c.turnUndead[p.id] || 0) + cards.length * 3;
        log(s, `${p.name} изгоняет нежить: +${cards.length * 3}.`, 'combat');
        break;
      case 'levitate':
        c.escapeCount[p.id] = (c.escapeCount[p.id] || 0) + cards.length;
        c.escape[p.id] = (c.escape[p.id] || 0) + cards.length;
        log(s, `${p.name} готовит левитацию: +${cards.length} к побегу.`, 'combat');
        break;
      case 'charm': {
        const all = [...p.hand]; p.hand = []; all.forEach(u => toDiscard(s, u));
        const m = c.monsters[a.monster];
        c.charmTreasure = (c.charmTreasure || 0) + monsterTreasure(s, m);
        removeMonster(s, a.monster);
        log(s, `${p.name} сбрасывает руку (${all.length}) и усыпляет ${q(def(m.uid).name)}.`, 'combat');
        if (!c.monsters.length) afterMonstersGone(s, rng);
        break;
      }
      case 'backstab': {
        c.backstabs.push({ by: p.id, on: a.target });
        log(s, `${p.name} бьёт в спину ${P(s, a.target).name}: −2.`, 'combat');
        fx(s, { kind: 'backstab', pid: a.target, by: p.id });
        break;
      }
      case 'lullaby':
        c.lullaby[p.id] = (c.lullaby[p.id] || 0) + 1;
        c.mods.push({ side: 'monster', n: -3, by: p.id, uid: null, label: 'Колыбельная' });
        fx(s, { kind: 'lullaby', pid: p.id });
        log(s, `${p.name} поёт колыбельную: монстры −3.`, 'combat');
        break;
      case 'distill':
        s.turn.distilled = true;
        give(p, draw(s, 'treasure', rng));
        log(s, `${p.name} перегоняет две карты в карту клада.`, 'good');
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
  if (hadCombat && s.combat && a.type !== 'fight') s.combat.winAt = null;
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
  if (d.type === 'monster') {
    tryA({ type: 'lookForTrouble', uid });
    return out;
  }
  if (d.type === 'curse') { s.players.forEach(x => tryA({ type: 'playCard', uid, target: x.id })); return out; }
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
    lookForTrouble: myTurn(s, p) && !s.combat && s.turn.step === 'post',
    endTurn: myTurn(s, p) && !s.combat && s.turn.step === 'charity',
    mustGive: Math.max(0, p.hand.length - handLimit(p)),
    giveToLowest: (() => { const o = s.players.filter(x => x !== p && !x.dead); return o.length && p.level > Math.min(...o.map(x => x.level)); })(),
    fight: ok({ type: 'fight' }),
    runAway: ok({ type: 'runAway' }),
    askHelp: !!(s.combat && s.combat.fighter === pid && !s.combat.helper && !s.combat.helpReq && !combatNumbers(s).winning
      && !s.combat.monsters.some(m => def(m.uid).noHelp)),
    noHelp: !!s.combat?.monsters.some(m => def(m.uid).noHelp),
    helpTargets: s.combat && s.combat.fighter === pid ? s.players.filter(x => ok({ type: 'askHelp', to: x.id, offer: 0 })).map(x => x.id) : [],
    cancelHelp: ok({ type: 'cancelHelp' }),
    answerHelp: s.combat?.helpReq?.to === pid,
    autoEquip: ok({ type: 'autoEquip' }),
    manage: !manageErr(s, p),
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
  if (hasClass(p, 'alchemist')) h.abilities.distill = ok({ type: 'ability', name: 'distill', cards: p.hand.slice(0, 2) });
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
    reveal: s.reveal, opts: { winDelayMs: s.opts.winDelayMs }, location: s.location,
    log: s.log.slice(-80), fx: s.fx.slice(-20),
    decks: { door: s.decks.door.length, treasure: s.decks.treasure.length },
    discard: {
      door: { count: s.discard.door.length, top: s.discard.door.at(-1) || null },
      treasure: { count: s.discard.treasure.length, top: s.discard.treasure.at(-1) || null },
    },
    players: s.players.map(p => ({
      id: p.id, name: p.name, color: p.color, avatar: p.avatar, isBot: p.isBot, seat: p.seat,
      level: p.level, races: [...p.races], classes: [...p.classes], halfbreed: p.halfbreed, supermunch: p.supermunch,
      equipped: [...p.equipped], carried: [...p.carried], nextCombat: p.nextCombat, nextEscape: p.nextEscape || 0,
      dead: p.dead, handCount: p.hand.length, handLimit: handLimit(p), handsLimit: handsLimit(p),
      power: powerOf(s, p), runBonus: runBonusOf(s, p),
      hand: p.id === pid ? [...p.hand] : undefined,
    })),
    combat: c ? {
      fighter: c.fighter, helper: c.helper, helpOffer: c.helpOffer, helpReq: c.helpReq,
      monsters: c.monsters.map(m => ({ uid: m.uid, enh: [...m.enh], strength: monsterStrength(s, m), treasure: monsterTreasure(s, m),
        level: monsterBaseLevel(s, def(m.uid)), noEscape: def(m.uid).escape === false || m.enh.some(u => def(u).noEscape) })),
      mods: c.mods, backstabs: c.backstabs, rage: c.rage, turnUndead: c.turnUndead, escape: c.escape,
      winAt: c.winAt, numbers: combatNumbers(s),
      heroStrengths: Object.fromEntries(participants(s).map(id => [id, heroStrength(s, P(s, id))])),
    } : null,
    me: me ? pid : null,
    hints: me ? hints(s, pid) : null,
    sale: me && s.phase === 'playing' ? { rate: locationOf(s)?.saleRate || 1000, goblin: hasRace(me, 'goblin'), halfling: hasRace(me, 'halfling') && !s.turn.halflingSold } : null,
  };
}
