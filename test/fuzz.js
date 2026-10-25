// Фаззинг: случайные и мусорные действия от всех игроков не должны ронять движок.
import { createGame, act, tick, view } from '../shared/engine.js';
import { botDecide } from '../shared/bot.js';
import { allUids, def } from '../shared/cards.js';

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const TYPES = ['kick', 'loot', 'lookForTrouble', 'endTurn', 'playCard', 'equip', 'unequip', 'autoEquip', 'discardInPlay', 'sell', 'gift', 'askHelp', 'answerHelp', 'cancelHelp', 'fight', 'runAway', 'ability', 'haunt', 'offerTrade', 'answerTrade', 'cancelTrade', 'bribe', 'trap', 'tame', '__proto__', 'toString', 'constructor', 'nope'];
const ABIL = ['rage', 'turn', 'levitate', 'charm', 'backstab', 'steal', 'lullaby', 'distill', 'mutagen', 'lure', 'x'];
const ALL = [...allUids('door'), ...allUids('treasure')];
const junk = rng => [null, 1, -1, 'x', {}, [], [1], ['a#0'], NaN, '__proto__', 99999][Math.floor(rng() * 11)];
const TOTAL = ALL.length;
function count(s) {
  const all = [...s.decks.door, ...s.decks.treasure, ...s.discard.door, ...s.discard.treasure];
  for (const p of s.players) all.push(...p.hand, ...p.equipped, ...p.carried, ...p.races, ...p.classes, ...[p.halfbreed, p.supermunch, p.ally, p.beast].filter(Boolean));
  if (s.trap) all.push(s.trap.uid);
  if (s.tame) all.push(s.tame.uid);
  if (s.combat) { for (const m of s.combat.monsters) all.push(m.uid, ...m.enh); all.push(...s.combat.used); }
  if (s.location) all.push(s.location);
  if (s.rig) all.push(...s.rig.queue);
  return all.length === TOTAL && new Set(all).size === TOTAL;
}
const N = Number(process.argv[2] || 300);
let ok = 0, rejected = 0, games = 0;
for (let g = 0; g < N; g++) {
  const rng = mulberry32(1000 + g);
  const ids = ['a', 'b', 'c', 'd'].slice(0, 3 + (g % 2));
  const s = createGame(ids.map(id => ({ id, name: id })), { winDelayMs: 1000 }, rng);
  let now = 0;
  for (let i = 0; i < 1500 && s.phase === 'playing'; i++) {
    now += 400;
    const pid = ids[Math.floor(rng() * ids.length)];
    let a;
    if (rng() < 0.55) a = botDecide(s, pid, { rng, now }) || { type: 'kick' };
    else {
      const p = s.players.find(x => x.id === pid);
      const pool = [...p.hand, ...p.equipped, ...p.carried, ...s.players.flatMap(x => [x.ally, x.beast].filter(Boolean))];
      const pickU = () => (rng() < 0.7 && pool.length ? pool[Math.floor(rng() * pool.length)] : ALL[Math.floor(rng() * ALL.length)]);
      a = { type: TYPES[Math.floor(rng() * TYPES.length)], uid: pickU(), target: ids[Math.floor(rng() * ids.length)], to: ids[Math.floor(rng() * ids.length)],
        side: rng() < 0.5 ? 'player' : 'monster', monster: Math.floor(rng() * 3) - (rng() < 0.1 ? 5 : 0), with: pickU(), uids: [pickU(), pickU()], give: [pickU()],
        cards: [pickU()], name: ABIL[Math.floor(rng() * ABIL.length)], item: pickU(), offer: Math.floor(rng() * 4), accept: rng() < 0.5,
        want: rng() < 0.5 ? [pickU()] : [], id: Math.floor(rng() * 6), disarm: rng() < 0.5 ? true : junk(rng) };
      if (rng() < 0.3) { const k = Object.keys(a)[Math.floor(rng() * 12)]; a[k] = junk(rng); }
    }
    // иногда — честное предложение обмена, чтобы проверить перенос вещей
    if (rng() < 0.08) {
      const me = s.players.find(x => x.id === pid), to = s.players[Math.floor(rng() * s.players.length)];
      const some = list => list.filter(() => rng() < 0.4);
      a = { type: 'offerTrade', to: to.id, give: some([...me.equipped, ...me.carried, ...me.hand.filter(u => def(u).type === 'item')]), want: some([...to.equipped, ...to.carried]) };
    }
    const r = act(s, pid, a, { rng, now });
    r.ok ? ok++ : rejected++;
    tick(s, { rng, now });
    if (!count(s)) { console.log('CARD LEAK', g, i, JSON.stringify(a)); process.exit(1); }
    if (i % 50 === 0) for (const id of ids) JSON.stringify(view(s, id));
  }
  games++;
}
console.log(`Фаззинг: ${games} партий, принято ${ok}, отклонено ${rejected} — движок не упал.`);
