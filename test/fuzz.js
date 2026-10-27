// Фаззинг: случайные и мусорные действия от всех игроков не должны ронять движок.
import { createGame, act, tick, view, trickStart, trickBuy, trickOptions, trickPlay } from '../shared/engine.js';
import { botDecide } from '../shared/bot.js';
import { allUids, def, SHOP_IDS } from '../shared/cards.js';

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const TYPES = ['pandora', 'allyWear', 'allyTake', 'giveGold', 'kick', 'loot', 'lookForTrouble', 'endTurn', 'playCard', 'equip', 'unequip', 'autoEquip', 'discardInPlay', 'sell', 'gift', 'askHelp', 'answerHelp', 'cancelHelp', 'fight', 'runAway', 'ability', 'haunt', 'offerTrade', 'answerTrade', 'cancelTrade', 'bribe', 'trap', 'tame', 'buy', 'pass', '__proto__', 'toString', 'constructor', 'nope'];
const ABIL = ['rage', 'turn', 'levitate', 'charm', 'backstab', 'steal', 'lullaby', 'distill', 'mutagen', 'lure', 'x'];
const ALL = [...allUids('door'), ...allUids('treasure')];
const junk = rng => [null, 1, -1, 'x', {}, [], [1], ['a#0'], NaN, '__proto__', 99999][Math.floor(rng() * 11)];
const TOTAL = ALL.length;
function count(s) {
  const all = [...s.decks.door, ...s.decks.treasure, ...s.discard.door, ...s.discard.treasure];
  for (const p of s.players) all.push(...p.hand, ...p.equipped, ...p.carried, ...(p.allyGear || []), ...p.races, ...p.classes, ...[p.halfbreed, p.supermunch, p.ally, p.beast].filter(Boolean));
  if (s.trap) all.push(s.trap.uid);
  if (s.tame) all.push(s.tame.uid);
  if (s.duel) all.push(s.duel.card, ...s.duel.used);
  if (s.combat) { for (const m of s.combat.monsters) all.push(m.uid, ...m.enh); all.push(...s.combat.used); }
  if (s.location) all.push(s.location);
  for (const t of Object.values(s.tricksters || {})) all.push(...t.hand);
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
      const pool = [...p.hand, ...p.equipped, ...p.carried, ...(p.allyGear || []), ...s.players.flatMap(x => [x.ally, x.beast].filter(Boolean))];
      const pickU = () => (rng() < 0.7 && pool.length ? pool[Math.floor(rng() * pool.length)] : ALL[Math.floor(rng() * ALL.length)]);
      a = { type: TYPES[Math.floor(rng() * TYPES.length)], uid: pickU(), target: ids[Math.floor(rng() * ids.length)], to: ids[Math.floor(rng() * ids.length)],
        side: rng() < 0.5 ? 'player' : 'monster', monster: Math.floor(rng() * 3) - (rng() < 0.1 ? 5 : 0), with: pickU(), uids: [pickU(), pickU()], give: [pickU()],
        cards: [pickU()], name: ABIL[Math.floor(rng() * ABIL.length)], item: pickU(), offer: Math.floor(rng() * 4), accept: rng() < 0.5,
        want: rng() < 0.5 ? [pickU()] : [], id: Math.floor(rng() * 6), disarm: rng() < 0.5 ? true : junk(rng), pay: [pickU(), pickU()] };
      if (rng() < 0.2) a.side = ['from', 'to'][Math.floor(rng() * 2)];
      // рынок: настоящий товар (и кошелёк потолще, чтобы покупки случались) или мусор
      if (a.type === 'buy') { a.id = rng() < 0.7 ? SHOP_IDS[Math.floor(rng() * SHOP_IDS.length)] : junk(rng); if (rng() < 0.3) p.gold = (p.gold || 0) + 1000; }
      if (rng() < 0.1) a.into = rng() < 0.8 ? true : junk(rng);
      if (a.type === 'pandora') { a.n = rng() < 0.8 ? Math.floor(rng() * 3000) - 100 : junk(rng); if (rng() < 0.3) p.gold = (p.gold || 0) + 3000; }
      if (rng() < 0.3) { const k = Object.keys(a)[Math.floor(rng() * 12)]; a[k] = junk(rng); }
    }
    // иногда — честное предложение обмена, чтобы проверить перенос вещей
    if (rng() < 0.08) {
      const me = s.players.find(x => x.id === pid), to = s.players[Math.floor(rng() * s.players.length)];
      const some = list => list.filter(() => rng() < 0.4);
      a = { type: 'offerTrade', to: to.id, give: some([...me.equipped, ...me.carried, ...me.hand.filter(u => def(u).type === 'item')]), want: some([...to.equipped, ...to.carried]) };
    }
    // пакостник-зритель: покупает на рынке и подбрасывает карты от имени игроков (иногда — мусор)
    if (rng() < 0.06) {
      trickStart(s, 'w');
      if (rng() < 0.5) trickBuy(s, 'w', rng() < 0.8 ? SHOP_IDS[Math.floor(rng() * SHOP_IDS.length)] : junk(rng));
      const opts = trickOptions(s, 'w').flatMap(x => x.opts);
      const o = opts[Math.floor(rng() * opts.length)];
      const ta = o && rng() < 0.85 ? o.a : { uid: rng() < 0.5 ? junk(rng) : ALL[Math.floor(rng() * ALL.length)], target: junk(rng), with: junk(rng) };
      const pup = rng() < 0.5 ? null : rng() < 0.8 ? ids[Math.floor(rng() * ids.length)] : junk(rng);
      const tr = trickPlay(s, 'w', ta, typeof pup === 'string' ? pup : null, { rng, now });
      tr.ok ? ok++ : rejected++;
      if (!count(s)) { console.log('CARD LEAK (пакостник)', g, i, JSON.stringify(ta)); process.exit(1); }
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
