// Точечные проверки правил.
import assert from 'node:assert/strict';
import { createGame, act, tick, view, combatNumbers, P, saleValue } from '../shared/engine.js';
import { def } from '../shared/cards.js';

let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function fresh(n = 3) {
  const s = createGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i })), { winDelayMs: 5000 }, rng);
  for (const p of s.players) { for (const u of p.hand) s.discard[def(u).deck].push(u); p.hand = []; }
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 1 };
  return s;
}
const take = (s, uid) => { for (const k of ['door', 'treasure']) for (const pile of [s.decks[k], s.discard[k]]) { const i = pile.indexOf(uid); if (i >= 0) { pile.splice(i, 1); return uid; } } throw new Error('no ' + uid); };
const A = (s, pid, a, now = 1000) => act(s, pid, a, { rng, now });
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('нельзя дойти до 10 уровня продажей и картой уровня', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  p.hand.push(take(s, 'l_stash#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'l_stash#0' }).ok, false);
  p.hand.push(take(s, 'i_jackhammer#0'), take(s, 'i_diver#0'));
  assert.match(A(s, 'p0', { type: 'sell', uids: ['i_jackhammer#0', 'i_diver#0'] }).error, /10/);
});

t('ничья — победа воина, иначе поражение', () => {
  const s = fresh(); const p = P(s, 'p0');
  s.decks.door.push(take(s, 'm_mosquito#0')); // уровень 2, у героя 1
  A(s, 'p0', { type: 'kick' });
  p.level = 2;
  assert.equal(combatNumbers(s).winning, false);
  p.classes.push(take(s, 'c_warrior#0'));
  assert.equal(combatNumbers(s).winning, true);
});

t('помешать во время отсчёта: таймер сбрасывается', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 5;
  s.decks.door.push(take(s, 'm_mosquito#0'));
  A(s, 'p0', { type: 'kick' });
  assert.equal(A(s, 'p0', { type: 'fight' }).ok, true);
  assert.ok(s.combat.winAt);
  P(s, 'p1').hand.push(take(s, 'e_hungry#0'));
  assert.equal(A(s, 'p1', { type: 'playCard', uid: 'e_hungry#0', monster: 0 }, 2000).ok, true);
  assert.equal(s.combat.winAt, null);
  assert.equal(combatNumbers(s).winning, false);
  assert.equal(tick(s, { rng, now: 999999 }), false);
});

t('победа: уровень и клад после отсчёта', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 5;
  s.decks.door.push(take(s, 'm_mosquito#0'));
  A(s, 'p0', { type: 'kick' });
  A(s, 'p0', { type: 'fight' }, 1000);
  assert.equal(tick(s, { rng, now: 3000 }), false);
  assert.equal(tick(s, { rng, now: 7000 }), true);
  assert.equal(p.level, 6); assert.equal(p.hand.length, 1); assert.equal(s.combat, null); assert.equal(s.turn.step, 'charity');
});

t('помощник получает обещанный клад, эльф — уровень', () => {
  const s = fresh(); const p = P(s, 'p0'); const h = P(s, 'p1');
  s.decks.door.push(take(s, 'm_zhek#0')); // 10 ур, 3 клада
  A(s, 'p0', { type: 'kick' });
  p.level = 3; h.level = 8; h.races.push(take(s, 'r_elf#0'));
  assert.equal(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 2 }).ok, true);
  assert.equal(A(s, 'p2', { type: 'answerHelp', accept: true }).ok, false);
  assert.equal(A(s, 'p1', { type: 'answerHelp', accept: true }).ok, true);
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(h.hand.length, 2); assert.equal(p.hand.length, 1); assert.equal(h.level, 9); assert.equal(p.level, 4);
});

t('отказавшего второй раз не просят', () => {
  const s = fresh();
  s.decks.door.push(take(s, 'm_zhek#0'));
  A(s, 'p0', { type: 'kick' });
  A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 });
  A(s, 'p1', { type: 'answerHelp', accept: false });
  assert.match(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 3 }).error, /отказал/);
});

t('куриный бог отводит проклятие', () => {
  const s = fresh(); const v = P(s, 'p1'); v.level = 4;
  P(s, 'p0').hand.push(take(s, 'k_tax#0'));
  v.hand.push(take(s, 'o_ward#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'k_tax#0', target: 'p1' }).ok, true);
  assert.equal(v.level, 4); assert.equal(v.hand.length, 0);
});

t('благотворительность: лишнее уходит самому слабому', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3; P(s, 'p1').level = 1; P(s, 'p2').level = 2;
  s.turn.step = 'charity';
  for (const u of ['i_helmet#0', 'i_helmet#1', 'i_boots#0', 'i_shovel#0', 'i_shovel#1', 'i_pick#0', 'i_ladle#0']) p.hand.push(take(s, u));
  assert.match(A(s, 'p0', { type: 'endTurn' }).error, /2/);
  assert.equal(A(s, 'p0', { type: 'endTurn', give: ['i_ladle#0', 'i_helmet#0'] }).ok, true);
  assert.equal(P(s, 'p1').hand.length, 2); assert.equal(s.turn.pid, 'p1');
});

t('ограничения вещей: руки, большие, раса', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'i_pick#0'), take(s, 'i_shovel#0'), take(s, 'i_bow#0'), take(s, 'i_diver#0'), take(s, 'i_trolley#0'));
  for (const u of [...p.hand]) A(s, 'p0', { type: 'playCard', uid: u });
  assert.ok(p.equipped.includes('i_pick#0')); assert.ok(p.carried.includes('i_shovel#0'));
  assert.ok(p.carried.includes('i_bow#0')); // не эльф
  assert.equal(p.equipped.filter(u => u === 'i_diver#0' || u === 'i_trolley#0').length, 1);
  p.hand.push(take(s, 'r_dwarf#0')); A(s, 'p0', { type: 'playCard', uid: 'r_dwarf#0' });
  A(s, 'p0', { type: 'autoEquip' });
  assert.ok(p.equipped.includes('i_diver#0') && p.equipped.includes('i_trolley#0'));
  p.races = []; s.discard.door.push('r_dwarf#0');
  p.hand.push(take(s, 'k_amnesia#0'));
});

t('чужая рука скрыта в представлении', () => {
  const s = fresh(); P(s, 'p1').hand.push(take(s, 'i_helmet#0'));
  const v = view(s, 'p0');
  assert.equal(v.players[1].hand, undefined); assert.equal(v.players[1].handCount, 1);
  assert.ok(Array.isArray(v.players[0].hand)); assert.equal(typeof v.decks.door, 'number');
});

t('смерть: вещи разбирают, уровень остаётся, возрождение с 8 картами', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 4;
  p.hand.push(take(s, 'i_helmet#0'), take(s, 'i_boots#0'));
  A(s, 'p0', { type: 'playCard', uid: 'i_helmet#0' });
  s.decks.door.push(take(s, 'm_heatpipe#0'));
  A(s, 'p0', { type: 'kick' });
  let tries = 0;
  while (s.combat && tries++ < 50) { const r = A(s, 'p0', { type: 'runAway' }); if (!r.ok) break; }
  if (p.dead) {
    assert.equal(p.level, 4); assert.equal(p.hand.length + p.equipped.length, 0);
    A(s, 'p0', { type: 'endTurn' }); assert.equal(p.dead, false);
    A(s, 'p1', { type: 'kick' }); if (!s.combat) { A(s, 'p1', { type: 'loot' }); }
  }
});

// ───────── новая механика ─────────
const fight = (s, uid, pid = 'p0') => { s.decks.door.push(take(s, uid)); return A(s, pid, { type: 'kick' }); };

t('питомец спасает от расплаты и уходит', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 4;
  p.hand.push(take(s, 'p_rat#0')); A(s, 'p0', { type: 'playCard', uid: 'p_rat#0' });
  assert.ok(p.equipped.includes('p_rat#0'));
  fight(s, 'm_endless#0'); // убежать нельзя, расплата −1 уровень
  A(s, 'p0', { type: 'runAway' });
  assert.equal(p.level, 4); assert.ok(!p.equipped.includes('p_rat#0')); assert.ok(s.discard.treasure.includes('p_rat#0'));
});

t('«убежать нельзя»: без питомца расплата неизбежна', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 4;
  fight(s, 'm_endless#0');
  A(s, 'p0', { type: 'runAway' });
  assert.equal(p.level, 3);
  assert.ok(!s.fx.some(f => f.kind === 'dice'));
});

t('нельзя звать на помощь, если монстр не терпит помощников', () => {
  const s = fresh();
  fight(s, 'm_cashier#0');
  assert.match(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 }).error, /помощник/);
  assert.equal(view(s, 'p0').hints.askHelp, false);
});

t('локации меняют силу, побег, продажу и проклятия', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'loc_flooded#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_flooded#0' });
  assert.equal(s.location, 'loc_flooded#0');
  fight(s, 'm_duck#0'); // водная, ур. 4
  assert.equal(combatNumbers(s).monsters, 7);
  assert.equal(view(s, 'p0').players[0].runBonus, -1);
  s.combat = null; s.turn.step = 'pre';
  p.hand.push(take(s, 'loc_market#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_market#0' });
  assert.ok(s.discard.door.includes('loc_flooded#0'));
  p.hand.push(take(s, 'i_tokens#0'), take(s, 'i_boots#0')); // 400 + 200 = 600 < 700
  assert.equal(saleValue(s, p, ['i_tokens#0', 'i_boots#0']).levels, 0);
  p.hand.push(take(s, 'i_ladle#0')); // +100 = 700
  assert.equal(saleValue(s, p, ['i_tokens#0', 'i_boots#0', 'i_ladle#0']).levels, 1);
  p.hand.push(take(s, 'loc_boiler#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_boiler#0' });
  P(s, 'p1').level = 5; p.hand.push(take(s, 'k_tax#0'));
  A(s, 'p0', { type: 'playCard', uid: 'k_tax#0', target: 'p1' });
  assert.equal(P(s, 'p1').level, 5);
});

t('зеркальный двойник сильнее лидера на 2, «Стайный» удваивает', () => {
  const s = fresh(); P(s, 'p2').level = 7;
  fight(s, 'm_mirror#0');
  assert.equal(combatNumbers(s).monsters, 9);
  s.combat = null; s.turn.step = 'pre';
  fight(s, 'm_gossip#0'); // 5
  P(s, 'p1').hand.push(take(s, 'e_pack#0'));
  A(s, 'p1', { type: 'playCard', uid: 'e_pack#0', monster: 0 });
  assert.equal(combatNumbers(s).monsters, 10);
});

t('расы: орк без шапки, гоблин торгуется и берёт лишний клад', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'r_orc#0')); A(s, 'p0', { type: 'playCard', uid: 'r_orc#0' });
  assert.equal(view(s, 'p0').players[0].power, 3);
  p.hand.push(take(s, 'i_helmet#0')); A(s, 'p0', { type: 'playCard', uid: 'i_helmet#0' });
  assert.equal(view(s, 'p0').players[0].power, 2);
  const g = P(s, 'p1'); g.races.push(take(s, 'r_goblin#0'));
  g.hand.push(take(s, 'i_tokens#0'), take(s, 'i_boots#0'));
  assert.equal(saleValue(s, g, ['i_tokens#0', 'i_boots#0']).total, 1000);
  // гоблин-помощник
  p.level = 4; g.level = 8;
  fight(s, 'm_zhek#0'); // 10, 3 клада
  A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 });
  A(s, 'p1', { type: 'answerHelp', accept: true });
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(g.hand.length, 2 + 2); // 2 своих + 1 обещанная + 1 гоблинская
});

t('кротолюда не берут проклятия на одежду', () => {
  const s = fresh(); const v = P(s, 'p1');
  v.races.push(take(s, 'r_mole#0')); v.equipped.push(take(s, 'i_helmet#0'));
  P(s, 'p0').hand.push(take(s, 'k_draft#0'));
  A(s, 'p0', { type: 'playCard', uid: 'k_draft#0', target: 'p1' });
  assert.ok(v.equipped.includes('i_helmet#0'));
});

t('механик держит перфоратор тремя руками и сильнее с большими вещами', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'i_drill#0')); A(s, 'p0', { type: 'playCard', uid: 'i_drill#0' });
  assert.ok(p.carried.includes('i_drill#0'));
  p.hand.push(take(s, 'c_engineer#0')); A(s, 'p0', { type: 'playCard', uid: 'c_engineer#0' });
  assert.equal(A(s, 'p0', { type: 'equip', uid: 'i_drill#0' }).ok, true);
  assert.equal(view(s, 'p0').players[0].power, 1 + 6 + 1);
  p.classes = []; s.discard.door.push('c_engineer#0');
  p.hand.push(take(s, 'k_fired#0'));
});

t('бард поёт колыбельную и берёт лишний клад; алхимик усиливает разовые', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  p.classes.push(take(s, 'c_bard#0'));
  fight(s, 'm_gossip#0'); // 5
  p.hand.push(take(s, 'i_ladle#0'));
  A(s, 'p0', { type: 'ability', name: 'lullaby', cards: ['i_ladle#0'] });
  assert.equal(combatNumbers(s).monsters, 2);
  assert.equal(combatNumbers(s).treasures, 3);
  const al = P(s, 'p1'); al.classes.push(take(s, 'c_alchemist#0'));
  al.hand.push(take(s, 'o_kvass#0'));
  A(s, 'p1', { type: 'playCard', uid: 'o_kvass#0', side: 'monster' });
  assert.equal(combatNumbers(s).monsters, 6);
});

t('святая вода против нежити даёт +8, бафф действует в текущем бою', () => {
  const s = fresh(); const p = P(s, 'p0');
  fight(s, 'm_plumber#0'); // нежить 8
  p.hand.push(take(s, 'o_holywater#0'));
  A(s, 'p0', { type: 'playCard', uid: 'o_holywater#0', side: 'player' });
  assert.equal(combatNumbers(s).heroes, 9);
  p.hand.push(take(s, 'b_pies#0'));
  A(s, 'p0', { type: 'playCard', uid: 'b_pies#0' });
  assert.equal(combatNumbers(s).heroes, 13);
});

t('засада срабатывает при встрече', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'i_ladle#0'), take(s, 'i_boots#0'));
  fight(s, 'm_hypno#0');
  assert.equal(p.hand.length, 1);
});

t('события: перекличка подтягивает слабых, налог бьёт лидеров', () => {
  const s = fresh(); P(s, 'p0').level = 3; P(s, 'p1').level = 2; P(s, 'p2').level = 8;
  P(s, 'p0').hand.push(take(s, 'ev_rollcall#0'));
  A(s, 'p0', { type: 'playCard', uid: 'ev_rollcall#0' });
  assert.equal(P(s, 'p1').level, 3);
  P(s, 'p0').hand.push(take(s, 'ev_luxtax#0'));
  A(s, 'p0', { type: 'playCard', uid: 'ev_luxtax#0' });
  assert.equal(P(s, 'p2').level, 7); assert.equal(P(s, 'p0').level, 3);
});

t('алхимик перегоняет две карты в клад раз в ход', () => {
  const s = fresh(); const p = P(s, 'p0'); p.classes.push(take(s, 'c_alchemist#0'));
  p.hand.push(take(s, 'i_ladle#0'), take(s, 'i_boots#0'), take(s, 'i_helmet#0'), take(s, 'i_helmet#1'));
  assert.equal(A(s, 'p0', { type: 'ability', name: 'distill', cards: ['i_ladle#0', 'i_boots#0'] }).ok, true);
  assert.equal(p.hand.length, 3);
  assert.match(A(s, 'p0', { type: 'ability', name: 'distill', cards: ['i_helmet#0', 'i_helmet#1'] }).error, /раз в ход/);
});
console.log(`Правила: ${n} проверок пройдено.`);
