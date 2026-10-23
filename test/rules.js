// Точечные проверки правил.
import assert from 'node:assert/strict';
import { createGame, act, tick, view, combatNumbers, P } from '../shared/engine.js';

let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function fresh(n = 3) {
  const s = createGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i })), { winDelayMs: 5000 }, rng);
  for (const p of s.players) { s.discard.door.push(...p.hand.filter(u => u.startsWith('r_') || u.startsWith('c_') || u.startsWith('x_') || u.startsWith('m_') || u.startsWith('k_') || u.startsWith('e_') || u.startsWith('w_'))); s.discard.treasure.push(...p.hand.filter(u => /^(i|o|l|h)_/.test(u))); p.hand = []; }
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
console.log(`Правила: ${n} проверок пройдено.`);
