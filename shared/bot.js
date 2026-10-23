// Простой ИИ для ботов «Под Землёй». Возвращает одно действие или null.
import { def } from './cards.js';
import {
  P, check, combatNumbers, playOptions, handLimit, hasClass, hasRace, cardWorth,
  equipError, participants, heroStrength, WIN_LEVEL,
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
    const givesGame = f.level + n.levels >= WIN_LEVEL;
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
  const bonusCards = hand.filter(u => def(u).type === 'oneshot' && def(u).effect === 'bonus')
    .sort((a, b) => def(b).bonus - def(a).bonus);
  const cheap = byWorth(hand.filter(u => !(def(u).type === 'oneshot' && def(u).effect === 'bonus') && def(u).type !== 'levelup'));
  const undead = c.monsters.some(m => def(m.uid).undead);
  const turnLeft = hasClass(p, 'cleric') && undead ? 3 - (c.turnCount[p.id] || 0) : 0;
  const rageLeft = hasClass(p, 'warrior') ? 3 - (c.rageCount[p.id] || 0) : 0;
  const potential = bonusCards.reduce((a, u) => a + def(u).bonus, 0)
    + Math.min(turnLeft, cheap.length) * 3 + Math.min(rageLeft, Math.max(0, cheap.length - turnLeft));
  if (potential < gap) return null;
  if (turnLeft > 0 && cheap.length) {
    const k = Math.min(turnLeft, cheap.length, Math.ceil(gap / 3));
    return { type: 'ability', name: 'turn', cards: cheap.slice(0, k) };
  }
  if (bonusCards.length) {
    const fit = [...bonusCards].reverse().find(u => def(u).bonus >= gap) || bonusCards[0];
    return { type: 'playCard', uid: fit, side: 'player' };
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

  const danger = c.monsters.some(m => dangerous(m.uid));
  // окаменить самого сильного, если без него побеждаем
  const petrify = p.hand.find(u => def(u).effect === 'remove');
  if (petrify && c.monsters.length) {
    const idx = n.perMonster.indexOf(Math.max(...n.perMonster));
    if (c.monsters.length > 1 || danger) return { type: 'playCard', uid: petrify, monster: idx };
  }
  if (hasClass(p, 'mage') && p.hand.length >= 3 && c.monsters.length === 1 && danger) {
    return { type: 'ability', name: 'charm', cards: [], monster: 0 };
  }
  // попросить помощи
  if (!c.helper) {
    const cands = s.players.filter(x => x.id !== p.id && !x.dead && !c.declined.includes(x.id))
      .map(x => ({ x, str: x.level + x.equipped.reduce((a, u) => a + (def(u).bonus || 0), 0) }))
      .filter(o => o.str >= gap)
      .sort((a, b) => a.str - b.str);
    if (cands.length && n.treasures >= 0) {
      const offer = Math.min(n.treasures, Math.max(1, Math.ceil(n.treasures / 2)));
      const a = { type: 'askHelp', to: cands[0].x.id, offer };
      if (!check(s, p.id, a)) return a;
    }
  }
  const smoke = p.hand.find(u => def(u).effect === 'escape');
  if (smoke && danger) return { type: 'playCard', uid: smoke };
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
  const forGame = f.level + n.levels >= WIN_LEVEL;
  const top = leader(s, null);
  const isLeader = f.level >= 6 && f.level >= top.level && f.id !== p.id;
  if (!forGame && !isLeader) return null;
  const margin = n.heroes - n.monsters + (n.warrior ? 1 : 0); // сколько добавить монстрам
  const opts = [];
  for (const u of p.hand) {
    const d = def(u);
    if (d.type === 'enhancer' && d.bonus > 0) opts.push({ v: d.bonus, a: { type: 'playCard', uid: u, monster: 0 } });
    if (d.type === 'oneshot' && d.effect === 'bonus') opts.push({ v: d.bonus, a: { type: 'playCard', uid: u, side: 'monster' } });
    if (d.type === 'wandering') {
      const m = p.hand.filter(x => def(x).type === 'monster').sort((a, b) => def(b).level - def(a).level)[0];
      if (m) opts.push({ v: def(m).level, a: { type: 'playCard', uid: u, with: m } });
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
    // проклясть лидера
    const curse = p.hand.find(u => def(u).type === 'curse');
    if (curse && step === 'pre') {
      const top = leader(s, id);
      if (top && top.level >= p.level && ok({ type: 'playCard', uid: curse, target: top.id })) return { type: 'playCard', uid: curse, target: top.id };
    }
    // продать ненужное
    const sellable = byWorth([...p.carried, ...p.hand.filter(u => def(u).type === 'item')]).filter(u => def(u).value);
    let sum = 0; const pickSell = [];
    for (const u of sellable) { pickSell.push(u); sum += def(u).value; if (sum >= 1000) break; }
    if (sum >= 1000 && ok({ type: 'sell', uids: pickSell })) return { type: 'sell', uids: pickSell };
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
    const power = p.level + p.equipped.reduce((a, u) => a + (def(u).bonus || 0), 0);
    const easy = p.hand.filter(u => def(u).type === 'monster' && def(u).level + 1 < power)
      .sort((a, b) => def(b).level - def(a).level)[0];
    if (easy) return { type: 'lookForTrouble', uid: easy };
    return { type: 'loot' };
  }
  if (step === 'charity') {
    const excess = Math.max(0, p.hand.length - handLimit(p));
    return { type: 'endTurn', give: byWorth(p.hand).slice(0, excess) };
  }
  return null;
}
