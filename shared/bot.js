// Простой ИИ для ботов «Под Землёй». Возвращает одно действие или null.
import { def } from './cards.js';
import {
  P, check, combatNumbers, playOptions, handLimit, hasClass, hasRace, cardWorth,
  equipError, participants, heroStrength, winLevel, luxLevel, saleValue, monsterBaseLevel, powerOf, locationOf,
} from './engine.js';

const byWorth = list => [...list].sort((a, b) => cardWorth(a) - cardWorth(b));

function greedyBonus(p) {
  const all = [...p.equipped, ...p.carried].sort((a, b) => (def(b).bonus || 0) - (def(a).bonus || 0) || (def(b).runBonus || 0) - (def(a).runBonus || 0));
  const fake = { ...p, equipped: [], carried: [] };
  let bonus = 0, run = 0;
  for (const u of all) if (!equipError(fake, u)) { fake.equipped.push(u); bonus += def(u).bonus || 0; run += def(u).runBonus || 0; }
  return bonus * 10 + run;
}
const curBonus = p => p.equipped.reduce((a, u) => a + (def(u).bonus || 0) * 10 + (def(u).runBonus || 0), 0);

function leader(s, exceptId) {
  return s.players.filter(x => x.id !== exceptId).sort((a, b) => b.level - a.level)[0];
}

function dangerous(uid) {
  const fx = def(uid).bad?.fx || [];
  return fx.some(f => f.k === 'death' || f.k === 'allItems' || (f.k === 'levels' && f.n >= 2));
}
// монстр не тронет героя такого уровня — тратить на него карты незачем
const calmFor = (p, uid) => !!def(uid).noPursue && p.level <= def(uid).noPursue;

export function botDecide(s, pid, { rng = Math.random, now = Date.now() } = {}) {
  if (s.phase !== 'playing') return null;
  const p = P(s, pid);
  if (!p) return null;
  const c = s.combat;
  const ok = a => !check(s, pid, a);

  // 1. Нас позвали на помощь
  if (c?.helpReq?.to === pid) {
    const f = P(s, c.fighter);
    const n = combatNumbers(s);
    const mine = heroStrength(s, p);
    const wouldWin = n.heroes + mine > n.monsters || (hasClass(p, 'warrior') && n.heroes + mine === n.monsters);
    const givesGame = f.level + n.levels >= winLevel(s);
    const worth = c.helpReq.offer > 0 || hasRace(p, 'elf');
    return { type: 'answerHelp', accept: !!(wouldWin && !givesGame && worth) };
  }
  if (p.dead) return s.turn.pid === pid && !c && s.turn.step === 'charity' ? { type: 'endTurn', give: [] } : null;

  if (c && c.fighter === pid) return fighterMove(s, p, rng, now);
  if (c && c.helper === pid) return helperMove(s, p);
  if (c) return interfere(s, p);
  if (s.turn.pid === pid) return turnMove(s, p, rng);
  return null;
}

function boostSelf(s, p, gap) {
  const c = s.combat;
  const hand = p.hand;
  const alch = hasClass(p, 'alchemist') ? 2 : 0;
  const undead = c.monsters.some(m => (def(m.uid).tags || []).includes('undead'));
  const val = u => {
    const d = def(u);
    if (d.type === 'buff') return d.bonus;
    return d.bonus + alch + (d.tagBonus && undead && d.tagBonus.tag === 'undead' ? d.tagBonus.n : 0);
  };
  const isBoost = u => (def(u).type === 'oneshot' && def(u).effect === 'bonus') || def(u).type === 'buff';
  const bonusCards = hand.filter(isBoost).sort((a, b) => val(b) - val(a));
  const cheap = byWorth(hand.filter(u => !isBoost(u) && def(u).type !== 'levelup'));
  const turnLeft = hasClass(p, 'cleric') && undead ? 3 - (c.turnCount[p.id] || 0) : 0;
  const rageLeft = hasClass(p, 'warrior') ? 3 - (c.rageCount[p.id] || 0) : 0;
  const songLeft = hasClass(p, 'bard') ? 2 - (c.lullaby[p.id] || 0) : 0;
  const mutagen = hasClass(p, 'witcher') && !p.mutagenUsed && cheap.length >= 2;
  const potential = bonusCards.reduce((a, u) => a + val(u), 0)
    + Math.min(turnLeft, cheap.length) * 3 + Math.min(songLeft, cheap.length) * 3
    + Math.min(rageLeft, Math.max(0, cheap.length - turnLeft)) + (mutagen ? 10 : 0);
  if (potential < gap) return null;
  // мутаген — раз за партию: пьём, когда без него не хватает много
  if (mutagen && gap > Math.max(3, potential - 10)) return { type: 'ability', name: 'mutagen', cards: cheap.slice(0, 2) };
  if (songLeft > 0 && cheap.length && gap <= 3 * songLeft) return { type: 'ability', name: 'lullaby', cards: [cheap[0]] };
  if (turnLeft > 0 && cheap.length) {
    const k = Math.min(turnLeft, cheap.length, Math.ceil(gap / 3));
    return { type: 'ability', name: 'turn', cards: cheap.slice(0, k) };
  }
  if (bonusCards.length) {
    const fit = [...bonusCards].reverse().find(u => val(u) >= gap) || bonusCards[0];
    return def(fit).type === 'buff' ? { type: 'playCard', uid: fit } : { type: 'playCard', uid: fit, side: 'player' };
  }
  if (rageLeft > 0 && cheap.length) {
    return { type: 'ability', name: 'rage', cards: cheap.slice(0, Math.min(rageLeft, gap, cheap.length)) };
  }
  return null;
}

function fighterMove(s, p, rng, now) {
  const c = s.combat;
  const n = combatNumbers(s);
  if (n.winning) return c.winAt ? null : { type: 'fight' };
  const gap = n.monsters - n.heroes + (n.warrior ? 0 : 1);

  if (c.helpReq) return now - (c.helpReq.at || 0) > 15000 ? { type: 'cancelHelp' } : null;

  const boost = boostSelf(s, p, gap);
  if (boost) return boost;

  const danger = c.monsters.some(m => dangerous(m.uid) && !calmFor(p, m.uid));
  // окаменить самого сильного, если без него побеждаем
  const petrify = p.hand.find(u => def(u).effect === 'remove');
  if (petrify && c.monsters.length) {
    const idx = n.perMonster.indexOf(Math.max(...n.perMonster));
    if (c.monsters.length > 1 || danger) return { type: 'playCard', uid: petrify, monster: idx };
  }
  if (hasClass(p, 'mage') && p.hand.length >= 3 && c.monsters.length === 1 && danger && !def(c.monsters[0].uid).boss) {
    return { type: 'ability', name: 'charm', cards: [], monster: 0 };
  }
  // попросить помощи
  if (!c.helper && !c.monsters.some(m => def(m.uid).noHelp)) {
    const cands = s.players.filter(x => x.id !== p.id && !x.dead && !c.declined.includes(x.id))
      .map(x => ({ x, str: powerOf(s, x) }))
      .filter(o => o.str >= gap)
      .sort((a, b) => a.str - b.str);
    if (cands.length && n.treasures >= 0) {
      const offer = Math.min(n.treasures, Math.max(1, Math.ceil(n.treasures / 2)));
      const a = { type: 'askHelp', to: cands[0].x.id, offer };
      if (!check(s, p.id, a)) return a;
    }
  }
  const smoke = p.hand.find(u => def(u).effect === 'escape');
  const trapped = c.monsters.some(m => def(m.uid).escape === false || m.enh.some(u => def(u).noEscape));
  const hasPet = p.equipped.some(u => def(u).slot === 'pet');
  if (smoke && (danger || (trapped && !hasPet))) return { type: 'playCard', uid: smoke };
  const rope = p.hand.find(u => def(u).effect === 'escapeBonus');
  if (rope && danger && !trapped && !c.escape[p.id]) return { type: 'playCard', uid: rope };
  if (hasClass(p, 'mage') && danger) {
    const left = 3 - (c.escapeCount[p.id] || 0);
    const cheap = byWorth(p.hand).slice(0, Math.min(left, 2));
    if (left > 0 && cheap.length) return { type: 'ability', name: 'levitate', cards: cheap };
  }
  return { type: 'runAway' };
}

function helperMove(s, p) {
  const n = combatNumbers(s);
  if (n.winning) return null;
  return boostSelf(s, p, n.monsters - n.heroes + (n.warrior ? 0 : 1));
}

function interfere(s, p) {
  const c = s.combat;
  const f = P(s, c.fighter);
  const n = combatNumbers(s);
  if (!n.winning) return null;
  const forGame = f.level + n.levels >= winLevel(s);
  const top = leader(s, null);
  const isLeader = f.level >= winLevel(s) - 4 && f.level >= top.level && f.id !== p.id;
  if (!forGame && !isLeader) return null;
  const margin = n.heroes - n.monsters + (n.warrior ? 1 : 0); // сколько добавить монстрам
  const opts = [];
  for (const u of p.hand) {
    const d = def(u);
    if (d.type === 'enhancer' && (d.bonus > 0 || d.double)) {
      const v = d.double ? monsterBaseLevel(s, def(c.monsters[0].uid)) : d.bonus;
      opts.push({ v, a: { type: 'playCard', uid: u, monster: 0 } });
    }
    if (d.type === 'oneshot' && d.effect === 'bonus') opts.push({ v: d.bonus, a: { type: 'playCard', uid: u, side: 'monster' } });
    if (d.type === 'wandering') {
      const m = p.hand.filter(x => def(x).type === 'monster').sort((a, b) => (def(b).boss ? 1e4 : monsterBaseLevel(s, def(b))) - (def(a).boss ? 1e4 : monsterBaseLevel(s, def(a))))[0];
      // босс из темноты встанет с силой вдвое больше силы бойца
      if (m) opts.push({ v: def(m).boss ? 2 * heroStrength(s, f) : monsterBaseLevel(s, def(m)), a: { type: 'playCard', uid: u, with: m } });
    }
  }
  if (hasClass(p, 'rogue') && p.hand.length) {
    for (const t of participants(s)) {
      if (!c.backstabs.some(b => b.by === p.id && b.on === t)) {
        const cheap = byWorth(p.hand.filter(u => def(u).type !== 'enhancer'))[0];
        if (cheap) opts.push({ v: 2, a: { type: 'ability', name: 'backstab', target: t, cards: [cheap] } });
      }
    }
  }
  const valid = opts.filter(o => !check(s, p.id, o.a));
  if (!valid.length) return null;
  valid.sort((a, b) => a.v - b.v);
  const enough = valid.find(o => o.v >= margin);
  if (enough) return enough.a;
  return forGame ? valid[valid.length - 1].a : null;
}

function turnMove(s, p, rng) {
  const id = p.id;
  const ok = a => !check(s, id, a);
  const step = s.turn.step;

  if (step === 'charity' || step === 'pre' || step === 'post') {
    // выложить расу/класс
    for (const u of p.hand) {
      const d = def(u);
      if (['halfbreed', 'supermunch'].includes(d.type) && ok({ type: 'playCard', uid: u })) return { type: 'playCard', uid: u };
      if (d.type === 'race' && (p.races.length === 0 || (p.halfbreed && p.races.length < 2)) && ok({ type: 'playCard', uid: u })) return { type: 'playCard', uid: u };
      if (d.type === 'class' && (p.classes.length === 0 || (p.supermunch && p.classes.length < 2)) && ok({ type: 'playCard', uid: u })) return { type: 'playCard', uid: u };
    }
    for (const u of p.hand) {
      const d = def(u);
      if ((d.type === 'item' || d.type === 'hoard') && ok({ type: 'playCard', uid: u })) return { type: 'playCard', uid: u };
      if (d.type === 'levelup' && ok({ type: 'playCard', uid: u })) return { type: 'playCard', uid: u };
    }
    if (greedyBonus(p) > curBonus(p) && ok({ type: 'autoEquip' })) return { type: 'autoEquip' };
    // локация: выкладываем, если она нам выгодна или стола пусто
    for (const u of p.hand) {
      const d = def(u);
      if (d.type !== 'location' || !ok({ type: 'playCard', uid: u })) continue;
      const mine = (d.heroMod || []).some(m => (m.cls && hasClass(p, m.cls)) || (m.race && hasRace(p, m.race)));
      if (mine || d.treasureBonus || d.heroAll > 0 || d.levelBonus || d.handBonus || (!s.location && step === 'pre')) return { type: 'playCard', uid: u };
    }
    // событие: играем, если оно нас не бьёт
    for (const u of p.hand) {
      const d = def(u);
      if (d.type !== 'event' || !ok({ type: 'playCard', uid: u })) continue;
      const lowest = p.level <= Math.min(...s.players.map(x => x.level));
      const good = d.event === 'fair' || d.event === 'quake' || d.event === 'draft'
        || (d.event === 'rollcall' && lowest)
        || (d.event === 'light' && (hasClass(p, 'cleric') || hasClass(p, 'bard')))
        || (d.event === 'luxtax' && p.level < luxLevel(s));
      if (good) return { type: 'playCard', uid: u };
    }
    // алхимик перегоняет лишнее
    if (hasClass(p, 'alchemist') && !s.turn.distilled && p.hand.length >= handLimit(p, s)) {
      const a = { type: 'ability', name: 'distill', cards: byWorth(p.hand).slice(0, 2) };
      if (ok(a)) return a;
    }
    // проклясть лидера
    const curse = p.hand.find(u => def(u).type === 'curse');
    if (curse && step === 'pre') {
      const top = leader(s, id);
      if (top && top.level >= p.level && ok({ type: 'playCard', uid: curse, target: top.id })) return { type: 'playCard', uid: curse, target: top.id };
    }
    // продать ненужное
    const sellable = byWorth([...p.carried, ...p.hand.filter(u => def(u).type === 'item')]).filter(u => def(u).value);
    const pickSell = [];
    for (const u of sellable) { pickSell.push(u); if (saleValue(s, p, pickSell).levels >= 1) break; }
    if (pickSell.length && saleValue(s, p, pickSell).levels >= 1 && ok({ type: 'sell', uids: pickSell })) return { type: 'sell', uids: pickSell };
    // плут ворует
    if (hasClass(p, 'rogue') && step === 'pre' && p.hand.length > 3 && rng() < 0.25) {
      const cheap = byWorth(p.hand)[0];
      const targets = [];
      for (const x of s.players) if (x.id !== id) for (const it of [...x.equipped, ...x.carried]) if (!def(it).big) targets.push({ x, it });
      targets.sort((a, b) => (def(b.it).value || 0) - (def(a.it).value || 0));
      const t = targets[0];
      if (t && (def(t.it).value || 0) >= 400) {
        const a = { type: 'ability', name: 'steal', target: t.x.id, item: t.it, cards: [cheap] };
        if (ok(a)) return a;
      }
    }
  }
  if (step === 'pre') return { type: 'kick' };
  if (step === 'post') {
    const power = powerOf(s, p) + (p.nextCombat || 0);
    const easy = p.hand.filter(u => def(u).type === 'monster' && !def(u).ambush && monsterBaseLevel(s, def(u)) + 1 < power)
      .sort((a, b) => monsterBaseLevel(s, def(b)) - monsterBaseLevel(s, def(a)))[0];
    if (easy) return { type: 'lookForTrouble', uid: easy };
    return { type: 'loot' };
  }
  if (step === 'charity') {
    const excess = Math.max(0, p.hand.length - handLimit(p, s));
    return { type: 'endTurn', give: byWorth(p.hand).slice(0, excess) };
  }
  return null;
}
