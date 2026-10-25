// Простой ИИ для ботов «Под Землёй». Возвращает одно действие или null.
import { def, TROUBLE_BONUS, MUTAGEN_BONUS, LULLABY_PENALTY, LULLABY_MAX, DISTILL_COST, tameBonus, TRAP_FAIL_LEVELS, marketPrice } from './cards.js';
import {
  P, check, combatNumbers, playOptions, handLimit, hasClass, hasRace, cardWorth,
  equipError, participants, heroStrength, levelOnlyFight, winLevel, luxLevel, saleValue, monsterBaseLevel, powerOf, locationOf,
  isGhost, grudgeOf, trapNeed, duelNumbers, duelStrength, duelPrize,
} from './engine.js';
import { GHOST_BONUS } from './cards.js';

// Характеры: осторожный реже ищет неприятности и помогает только наверняка, жадный рискует и торгуется,
// мстительный помнит, кто ему мешал, и отвечает тем же.
const persona = p => p.persona || 'normal';
const TROUBLE_RATIO = { cautious: 0.8, greedy: 0.5, vengeful: 0.65, normal: 0.65 };
// кто больше всех насолил этому игроку (и насолил хоть раз)
function worstEnemy(s, p) {
  let best = null, n = 0;
  for (const x of s.players) { const g = grudgeOf(s, p.id, x.id); if (x !== p && g > n) { n = g; best = x; } }
  return best;
}

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
    const per = persona(p);
    const margin = n.heroes + mine - n.monsters;
    const worth = (per === 'greedy' ? c.helpReq.offer >= 2 : c.helpReq.offer > 0) || hasRace(p, 'elf');
    const sure = per !== 'cautious' || margin >= 2;
    const enemy = per === 'vengeful' && grudgeOf(s, p.id, f.id) > 0;
    return { type: 'answerHelp', accept: !!(wouldWin && !givesGame && worth && sure && !enemy) };
  }
  // нам предложили обмен
  const offer = (s.trades || []).find(o => o.to === pid);
  if (offer) {
    const yes = tradeWorth(s, p, offer) && ok({ type: 'answerTrade', id: offer.id, accept: true });
    return { type: 'answerTrade', id: offer.id, accept: yes };
  }
  if (s.duel && !c) return p.dead ? null : duelMove(s, p);
  if (p.dead) return s.turn.pid === pid && !c && s.turn.step === 'charity' ? { type: 'endTurn', give: [] } : null;
  if (c && isGhost(p) && !participants(s).includes(pid)) { const g = ghostMove(s, p); if (g) return g; }

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
  // против «только уровня» вещи, зелья и способности героев не работают — остаётся колыбельная барда
  const onlyLevel = levelOnlyFight(s);
  const isBoost = u => !onlyLevel && ((def(u).type === 'oneshot' && def(u).effect === 'bonus') || def(u).type === 'buff');
  const bonusCards = hand.filter(isBoost).sort((a, b) => val(b) - val(a));
  // «Детёныш», «Дряхлый», «Простуженный» — ослабить своего монстра (на боссов не действуют)
  const target = c.monsters.map((m, i) => ({ i, boss: def(m.uid).boss })).filter(x => !x.boss).map(x => x.i)[0];
  const debuffs = target === undefined ? [] : hand.filter(u => def(u).type === 'enhancer' && def(u).bonus < 0).sort((a, b) => def(a).bonus - def(b).bonus);
  const cheap = byWorth(hand.filter(u => !isBoost(u) && def(u).type !== 'levelup' && !debuffs.includes(u)));
  const turnLeft = !onlyLevel && hasClass(p, 'cleric') && undead ? 3 - (c.turnCount[p.id] || 0) : 0;
  const rageLeft = !onlyLevel && hasClass(p, 'warrior') ? 3 - (c.rageCount[p.id] || 0) : 0;
  const songLeft = hasClass(p, 'bard') ? LULLABY_MAX - (c.lullaby[p.id] || 0) : 0;
  const mutagen = !onlyLevel && hasClass(p, 'witcher') && !p.mutagenUsed && cheap.length >= 2;
  const potential = bonusCards.reduce((a, u) => a + val(u), 0)
    + Math.min(turnLeft, cheap.length) * 3 + Math.min(songLeft, cheap.length) * LULLABY_PENALTY
    + Math.min(rageLeft, Math.max(0, cheap.length - turnLeft)) + (mutagen ? MUTAGEN_BONUS : 0)
    + debuffs.reduce((a, u) => a - def(u).bonus, 0);
  if (potential < gap) return null;
  // мутаген — раз за партию: пьём, когда без него не хватает много
  if (mutagen && gap > Math.max(3, potential - MUTAGEN_BONUS)) return { type: 'ability', name: 'mutagen', cards: cheap.slice(0, 2) };
  if (songLeft > 0 && cheap.length && gap <= LULLABY_PENALTY * songLeft) return { type: 'ability', name: 'lullaby', cards: [cheap[0]] };
  if (turnLeft > 0 && cheap.length) {
    const k = Math.min(turnLeft, cheap.length, Math.ceil(gap / 3));
    return { type: 'ability', name: 'turn', cards: cheap.slice(0, k) };
  }
  if (bonusCards.length) {
    const fit = [...bonusCards].reverse().find(u => val(u) >= gap) || bonusCards[0];
    return def(fit).type === 'buff' ? { type: 'playCard', uid: fit } : { type: 'playCard', uid: fit, side: 'player' };
  }
  if (debuffs.length) {
    const fit = [...debuffs].reverse().find(u => -def(u).bonus >= gap) || debuffs[0];
    return { type: 'playCard', uid: fit, monster: target };
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
  // позвать на помощь: «Ты мой раб» — без торга и без доли, иначе просим за часть клада
  if (!c.helper && !c.monsters.some(m => def(m.uid).noHelp)) {
    const strOf = x => (levelOnlyFight(s) ? x.level : powerOf(s, x));
    const slave = p.hand.find(u => def(u).effect === 'enslave');
    if (slave) {
      const t = s.players.filter(x => x.id !== p.id && !x.dead).map(x => ({ x, str: strOf(x) })).filter(o => o.str >= gap).sort((a, b) => a.str - b.str)[0];
      if (t && !check(s, p.id, { type: 'playCard', uid: slave, target: t.x.id })) return { type: 'playCard', uid: slave, target: t.x.id };
    }
    const cands = s.players.filter(x => x.id !== p.id && !x.dead && !c.declined.includes(x.id))
      .map(x => ({ x, str: strOf(x) }))
      .filter(o => o.str >= gap)
      .sort((a, b) => a.str - b.str);
    if (cands.length && n.treasures >= 0) {
      const share = persona(p) === 'greedy' ? Math.floor(n.treasures / 3) : persona(p) === 'cautious' ? Math.ceil(n.treasures * 0.6) : Math.ceil(n.treasures / 2);
      const offer = Math.min(n.treasures, Math.max(1, share));
      const a = { type: 'askHelp', to: cands[0].x.id, offer };
      if (!check(s, p.id, a)) return a;
    }
  }
  // Ржавника проще задобрить самой дешёвой вещью, чем рисковать лучшей
  const feed = [...p.equipped, ...p.carried].filter(u => !check(s, p.id, { type: 'bribe', item: u })).sort((a, b) => cardWorth(a) - cardWorth(b))[0];
  if (feed && cardWorth(feed) < 900) return { type: 'bribe', item: feed };
  const smoke = p.hand.find(u => def(u).effect === 'escape');
  const trapped = c.monsters.some(m => def(m.uid).escape === false || m.enh.some(u => def(u).noEscape));
  const hasPet = p.equipped.some(u => def(u).slot === 'pet') || !!p.beast;
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
  const revenge = persona(p) === 'vengeful' && grudgeOf(s, p.id, f.id) > 0;
  if (persona(p) === 'cautious' && !forGame) return null;
  if (!forGame && !isLeader && !revenge) return null;
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
  if (step === 'trap') return { type: 'trap', disarm: disarmWorth(s, p) };
  // приручить зверя, если он сильнее нынешнего питомца
  if (s.tame?.pid === id && ok({ type: 'tame' }) && tameBonus(def(s.tame.uid)) > petScore(p)) return { type: 'tame' };

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
    // спутник: берём, если он лучше нынешнего
    const allies = p.hand.filter(u => def(u).type === 'ally' && ok({ type: 'playCard', uid: u })).map(u => ({ u, v: allyScore(p, def(u), u) })).sort((a, b) => b.v - a.v);
    if (allies[0] && allies[0].v > (p.ally ? allyScore(p, def(p.ally), p.ally) : 0)) return { type: 'playCard', uid: allies[0].u };
    if (greedyBonus(p) > curBonus(p) && ok({ type: 'autoEquip' })) return { type: 'autoEquip' };
    // локация: выкладываем, если она нам выгоднее той, что лежит на столе
    const cur = s.location ? locScore(p, def(s.location)) : 0;
    const locs = p.hand.filter(u => def(u).type === 'location' && ok({ type: 'playCard', uid: u }))
      .map(u => ({ u, v: locScore(p, def(u)) })).sort((a, b) => b.v - a.v);
    if (locs[0] && (locs[0].v > cur + 0.5 || (!s.location && locs[0].v >= 0))) return { type: 'playCard', uid: locs[0].u };
    // событие: играем, если оно нас не бьёт
    for (const u of p.hand) {
      const d = def(u);
      if (d.type !== 'event' || !ok({ type: 'playCard', uid: u })) continue;
      const lowest = p.level <= Math.min(...s.players.map(x => x.level));
      const top = Math.max(...s.players.map(x => x.level));
      const myShoes = p.equipped.filter(u => def(u).slot === 'feet');
      const good = d.event === 'fair' || d.event === 'quake' || d.event === 'draft'
        || (d.event === 'rollcall' && lowest)
        || (d.event === 'union' && p.level < top)
        || (d.event === 'flood' && myShoes.every(u => (def(u).tags || []).includes('water')))
        || (d.event === 'shift' && p.hand.length <= 2)
        || (d.event === 'light' && (hasClass(p, 'cleric') || hasClass(p, 'bard')))
        || (d.event === 'luxtax' && p.level < luxLevel(s));
      if (good) return { type: 'playCard', uid: u };
    }
    // алхимик перегоняет лишнее
    if (hasClass(p, 'alchemist') && !s.turn.distilled && p.hand.length >= handLimit(p, s)) {
      const a = { type: 'ability', name: 'distill', cards: byWorth(p.hand).slice(0, DISTILL_COST) };
      if (ok(a)) return a;
    }
    // рынок: покупаем, если отдаём барахло дешевле того, что берём
    if (s.market && !s.turn.bought) { const a = marketBuy(s, p); if (a && ok(a)) return a; }
    // вызвать на поединок того, у кого есть что забрать и кто заметно слабее
    const duelCard = p.hand.find(u => def(u).type === 'duel');
    if (duelCard && step !== 'charity') {
      const mine = duelStrength(s, p);
      const t = s.players.filter(x => x.id !== id && !x.dead && duelPrize(x) && mine >= duelStrength(s, x) + 3)
        .sort((a, b) => cardWorth(duelPrize(b)) - cardWorth(duelPrize(a)))[0];
      if (t && ok({ type: 'playCard', uid: duelCard, target: t.id })) return { type: 'playCard', uid: duelCard, target: t.id };
    }
    // проклясть лидера или подложить ему ловушку
    const curse = p.hand.find(u => def(u).type === 'curse' || def(u).type === 'trap');
    if (curse && step === 'pre') {
      const foe = persona(p) === 'vengeful' ? worstEnemy(s, p) : null;
      if (foe && !foe.dead && ok({ type: 'playCard', uid: curse, target: foe.id })) return { type: 'playCard', uid: curse, target: foe.id };
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
    // плут сманивает чужого спутника или зверя, если тот лучше своего
    if (hasClass(p, 'rogue') && step === 'pre' && p.hand.length > 3 && rng() < 0.3) {
      const cheap = byWorth(p.hand)[0];
      for (const x of s.players) {
        if (x.id === id) continue;
        if (x.ally && allyScore(p, def(x.ally), x.ally) > (p.ally ? allyScore(p, def(p.ally), p.ally) : 0) + 0.5) {
          const a = { type: 'ability', name: 'lure', target: x.id, item: x.ally, cards: [cheap] };
          if (ok(a)) return a;
        }
        if (x.beast && tameBonus(def(x.beast)) >= petScore(p) + 2) {
          const a = { type: 'ability', name: 'lure', target: x.id, item: x.beast, cards: [cheap] };
          if (ok(a)) return a;
        }
      }
    }
  }
  if (step === 'pre') return { type: 'kick' };
  if (step === 'post') {
    // неприятности — это случайный монстр из колоды: идём, только если большинство монстров там нам по силам
    const power = powerOf(s, p) + (p.nextCombat || 0);
    const pool = s.decks.door.filter(u => def(u).type === 'monster');
    const beatable = pool.filter(u => !def(u).boss && !def(u).levelOnly && monsterBaseLevel(s, def(u)) + 1 + TROUBLE_BONUS < power).length;
    if (pool.length >= 4 && beatable / pool.length >= TROUBLE_RATIO[persona(p)] && ok({ type: 'lookForTrouble' })) return { type: 'lookForTrouble' };
    return { type: 'loot' };
  }
  if (step === 'charity') {
    const excess = Math.max(0, p.hand.length - handLimit(p, s));
    return { type: 'endTurn', give: byWorth(p.hand).slice(0, excess) };
  }
  return null;
}

// поединок: дуэлянт добавляет бонус, если проигрывает; сосед подыгрывает тому, кто против лидера или обидчика
function duelMove(s, p) {
  const d = s.duel, n = duelNumbers(s);
  const pass = () => (!check(s, p.id, { type: 'pass' }) ? { type: 'pass' } : null);
  const alch = hasClass(p, 'alchemist') ? 2 : 0;
  const bonus = p.hand.filter(u => def(u).type === 'oneshot' && def(u).effect === 'bonus').sort((a, b) => def(a).bonus - def(b).bonus);
  // сколько не хватает стороне, чтобы победить (при равенстве побеждает вызванный)
  const gapFor = side => (side === 'from' ? n.to - n.from + 1 : n.from - n.to);
  const boost = side => {
    const gap = gapFor(side);
    if (gap <= 0) return null;
    const fit = bonus.find(u => def(u).bonus + alch >= gap);
    return fit && !check(s, p.id, { type: 'playCard', uid: fit, side }) ? { type: 'playCard', uid: fit, side } : null;
  };
  const mine = p.id === d.from ? 'from' : p.id === d.to ? 'to' : null;
  if (mine) {
    if (n.winner !== p.id) {
      const a = boost(mine);
      if (a) return a;
      const buff = p.hand.filter(u => def(u).type === 'buff').sort((a, b) => def(a).bonus - def(b).bonus).find(u => def(u).bonus >= gapFor(mine));
      if (buff && !check(s, p.id, { type: 'playCard', uid: buff })) return { type: 'playCard', uid: buff };
    }
    return pass();
  }
  const W = P(s, n.winner);
  const top = leader(s, null);
  const threat = (W.level >= winLevel(s) - 3 && W.level >= top.level) || (persona(p) === 'vengeful' && grudgeOf(s, p.id, W.id) > 0);
  if (threat && persona(p) !== 'cautious') {
    const a = boost(n.winner === d.from ? 'to' : 'from');
    if (a) return a;
  }
  return pass();
}
// подземный рынок: самая ценная карта, за которую можно отдать барахло из запаса и руки
function marketBuy(s, p) {
  const pool = byWorth([...p.carried, ...p.hand.filter(u => def(u).type === 'item')]).filter(u => def(u).value && def(u).rarity !== 'legendary');
  const offers = [...s.market.cards].sort((a, b) => cardWorth(b) - cardWorth(a));
  for (const u of offers) {
    const price = marketPrice(def(u));
    const pay = [];
    let sum = 0;
    for (const x of pool) { if (sum >= price) break; pay.push(x); sum += def(x).value; }
    if (sum < price) continue;
    const give = pay.reduce((a, x) => a + cardWorth(x), 0);
    if (cardWorth(u) >= give * 0.8) return { type: 'buy', uid: u, pay };
  }
  return null;
}
// чего стоит питомец героя: зверь или вещь в слоте питомца
function petScore(p) {
  if (p.beast) return tameBonus(def(p.beast));
  const pet = p.equipped.find(u => def(u).slot === 'pet');
  return pet ? (def(pet).bonus || 0) + (def(pet).runBonus || 0) * 0.5 + (def(pet).peek ? 0.5 : 0) : 0;
}
// чего стоит спутник; наёмника берём, только если есть чем платить
function allyScore(p, d, uid) {
  if (d.fee) {
    const spare = [...p.hand, ...p.carried].filter(u => u !== uid && (def(u).value || 0) >= d.fee && def(u).type !== 'ally').length;
    if (spare < 2) return -1;
  }
  return (d.bonus || 0) + (d.runBonus || 0) * 0.6 + (d.handBonus || 0) * 0.4 + (d.bigBonus || 0) * 0.5;
}
// во что обойдётся расплата ловушки (в условных очках: уровень — 3, бонус вещи — 1)
function trapCost(p, fxList) {
  let v = 0;
  for (const f of fxList) {
    if (f.k === 'levels') v += 3 * Math.min(f.n, p.level - 1);
    else if (f.k === 'slot') v += p.equipped.filter(u => def(u).slot === f.slot).reduce((a, u) => a + (def(u).bonus || 0) + 0.5, 0);
    else if (f.k === 'smallItem') v += [...p.equipped, ...p.carried].some(u => !def(u).big) ? 1.5 : 0;
    else if (f.k === 'cards') v += Math.min(f.n, p.hand.length) * 0.8;
    else if (f.k === 'nextCombat') v += Math.abs(f.n) * 0.4;
    else if (f.k === 'nextEscape') v += Math.abs(f.n) * 0.5;
    else v += 2;
  }
  return v;
}
// рискнуть и обезвредить ловушку или спокойно принять расплату
function disarmWorth(s, p) {
  const d = def(s.trap.uid);
  const ch = (7 - trapNeed(p)) / 6;
  const accept = trapCost(p, d.fx);
  const fail = trapCost(p, [...d.fx, { k: 'levels', n: TRAP_FAIL_LEVELS }]) * (persona(p) === 'cautious' ? 1.3 : 1);
  return (1 - ch) * fail - ch * 1 < accept;
}

// насколько локация хороша для этого героя
function locScore(p, d) {
  let v = (d.heroAll || 0) - (d.monsterAll || 0);
  for (const m of d.heroMod || []) if ((m.cls && hasClass(p, m.cls)) || (m.race && hasRace(p, m.race))) v += m.n;
  if (d.lightBonus && p.equipped.some(u => (def(u).tags || []).includes('light'))) v += d.lightBonus;
  if (d.itemTag && p.equipped.some(u => (def(u).tags || []).includes(d.itemTag.tag))) v += d.itemTag.n;
  v += (d.treasureBonus || 0) * 0.8 + (d.levelBonus || 0) * 2 + (d.handBonus ? 0.5 : 0) + (d.escapeAll || 0) * 0.5 + (d.helperBonus ? 0.3 : 0);
  if (d.saleRate && d.saleRate < 1000) v += 1;
  if (d.noCurses) v += 0.5;
  for (const t of d.monsterTag || []) v -= t.n * 0.15;
  return v;
}

// выгоден ли обмен: считаем, как изменится лучший набор надетых вещей и цена барахла
function tradeWorth(s, p, o) {
  const f = P(s, o.from);
  if (!f || f.dead || p.dead) return false;
  if (persona(p) === 'vengeful' && grudgeOf(s, p.id, f.id) > 0) return false;
  const swap = (x, out, inn) => ({ ...x, equipped: x.equipped.filter(u => !out.includes(u)), carried: [...x.carried.filter(u => !out.includes(u)), ...inn] });
  const val = list => list.reduce((a, u) => a + (def(u).value || 0), 0);
  const mine = greedyBonus(swap(p, o.want, o.give)) - greedyBonus(p) + (val(o.give) - val(o.want)) / 200;
  // почти победителю не помогаем
  const theirs = greedyBonus(swap({ ...f, carried: [...f.carried, ...f.hand.filter(u => o.give.includes(u))] }, o.give, o.want)) - greedyBonus({ ...f, carried: [...f.carried, ...f.hand.filter(u => o.give.includes(u))] });
  if (f.level >= winLevel(s) - 2 && theirs > 0) return false;
  const need = persona(p) === 'greedy' ? 6 : 1;
  return mine >= need;
}

// погибший герой-призрак: мешает тому, кто вот-вот победит, или выручает самого отстающего
function ghostMove(s, p) {
  const c = s.combat;
  if ((s.turn.haunted || []).includes(p.id)) return null;
  const n = combatNumbers(s);
  const f = P(s, c.fighter);
  const W = winLevel(s);
  const top = leader(s, null);
  const forGame = f.level + n.levels >= W;
  const threat = forGame || (f.level >= W - 3 && f.level >= top.level) || (persona(p) === 'vengeful' && grudgeOf(s, p.id, f.id) > 0);
  const margin = n.heroes - n.monsters + (n.warrior ? 1 : 0);
  if (n.winning && threat && margin <= GHOST_BONUS && !check(s, p.id, { type: 'haunt', side: 'monster' })) return { type: 'haunt', side: 'monster' };
  const others = s.players.filter(x => x !== p);
  const low = f.level <= Math.min(...others.map(x => x.level));
  const gap = n.monsters - n.heroes + (n.warrior ? 0 : 1);
  if (!n.winning && !forGame && low && gap <= GHOST_BONUS && !check(s, p.id, { type: 'haunt', side: 'player' })) return { type: 'haunt', side: 'player' };
  return null;
}
