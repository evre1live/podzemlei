// Точечные проверки правил.
import assert from 'node:assert/strict';
import { createGame, act, tick, view, combatNumbers, P, saleValue, fillText } from '../shared/engine.js';
import { def } from '../shared/cards.js';
import { AVATAR_PARTS, cleanAvatar, avatarFromSeed, withGender } from '../shared/avatar.js';

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
  s.decks.door.push(take(s, 'm_zhek#0')); // 12 ур, 3 клада
  A(s, 'p0', { type: 'kick' });
  p.level = 5; h.level = 8; h.races.push(take(s, 'r_elf#0'));
  assert.equal(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 2 }).ok, true);
  assert.equal(A(s, 'p2', { type: 'answerHelp', accept: true }).ok, false);
  assert.equal(A(s, 'p1', { type: 'answerHelp', accept: true }).ok, true);
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(h.hand.length, 2); assert.equal(p.hand.length, 1); assert.equal(h.level, 9); assert.equal(p.level, 6);
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
  fight(s, 'm_gossip#0'); // 6
  P(s, 'p1').hand.push(take(s, 'e_pack#0'));
  A(s, 'p1', { type: 'playCard', uid: 'e_pack#0', monster: 0 });
  assert.equal(combatNumbers(s).monsters, 12);
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
  p.level = 5; g.level = 8;
  fight(s, 'm_zhek#0'); // 12, 3 клада (+1 орку за крупного монстра)
  const base = combatNumbers(s).treasures;
  A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 });
  A(s, 'p1', { type: 'answerHelp', accept: true });
  const before = p.hand.length;
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(g.hand.length, 2 + 2); // 2 своих + 1 обещанная + 1 гоблинская сверху
  assert.equal(p.hand.length - before, base - 1); // бойцу — всё, что не обещал
});

t('обещал 1 из 2 — себе 1, даже если помощник гоблин или дело в таверне', () => {
  for (const extra of ['goblin', 'tavern', 'both', 'none']) {
    const s = fresh(); const p = P(s, 'p0'); const h = P(s, 'p1');
    if (extra === 'goblin' || extra === 'both') h.races.push(take(s, 'r_goblin#0'));
    if (extra === 'tavern' || extra === 'both') s.location = take(s, 'loc_tavern#0');
    p.level = 1; h.level = 9;
    s.decks.door.push(take(s, 'm_robovac#0'));
    A(s, 'p0', { type: 'kick' });
    const base = combatNumbers(s).treasures;
    assert.ok(base >= 2, 'монстр с двумя кладами');
    assert.equal(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 }).ok, true);
    A(s, 'p1', { type: 'answerHelp', accept: true });
    const bonus = (extra === 'none' ? 0 : extra === 'both' ? 2 : 1);
    const n = combatNumbers(s);
    assert.equal(n.helperShare, 1 + bonus);
    assert.equal(n.treasures - n.helperShare, base - 1);
    const hp = h.hand.length, pp = p.hand.length;
    A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
    assert.equal(s.combat, null, extra);
    assert.equal(h.hand.length - hp, 1 + bonus, extra);
    assert.equal(p.hand.length - pp, base - 1, extra);
  }
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
  fight(s, 'm_gossip#0'); // 6
  p.hand.push(take(s, 'i_ladle#0'));
  A(s, 'p0', { type: 'ability', name: 'lullaby', cards: ['i_ladle#0'] });
  assert.equal(combatNumbers(s).monsters, 3);
  assert.equal(combatNumbers(s).treasures, 3);
  const al = P(s, 'p1'); al.classes.push(take(s, 'c_alchemist#0'));
  al.hand.push(take(s, 'o_kvass#0'));
  A(s, 'p1', { type: 'playCard', uid: 'o_kvass#0', side: 'monster' });
  assert.equal(combatNumbers(s).monsters, 7);
});

t('святая вода против нежити даёт +8, бафф действует в текущем бою', () => {
  const s = fresh(); const p = P(s, 'p0');
  fight(s, 'm_plumber#0'); // нежить 9
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

t('«Не мешаю»: отказ всех соседей не сбрасывает отсчёт, вмешательство обнуляет отказы', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 5;
  fight(s, 'm_mosquito#0');
  A(s, 'p0', { type: 'fight' });
  const at = s.combat.winAt;
  assert.equal(A(s, 'p1', { type: 'pass' }).ok, true);
  assert.equal(s.combat.winAt, at);
  assert.deepEqual(s.combat.passed, ['p1']);
  assert.match(A(s, 'p0', { type: 'pass' }).error, /сами/);
  P(s, 'p2').hand.push(take(s, 'e_baby#0'));
  A(s, 'p2', { type: 'playCard', uid: 'e_baby#0', monster: 0 });
  assert.deepEqual(s.combat.passed, []);
});

t('ведьмак: +5 всегда, мутаген +10 один раз за партию', () => {
  const s = fresh(); const p = P(s, 'p0'); p.classes.push(take(s, 'c_witcher#0'));
  fight(s, 'm_zhek#0'); // 12 ур
  assert.equal(combatNumbers(s).heroes, 6);
  p.hand.push(take(s, 'i_ladle#0'), take(s, 'i_boots#0'), take(s, 'i_helmet#0'), take(s, 'i_helmet#1'));
  assert.equal(A(s, 'p0', { type: 'ability', name: 'mutagen', cards: ['i_ladle#0', 'i_boots#0'] }).ok, true);
  assert.equal(combatNumbers(s).heroes, 16);
  assert.match(A(s, 'p0', { type: 'ability', name: 'mutagen', cards: ['i_helmet#0', 'i_helmet#1'] }).error, /раз за партию/);
});

t('Доспехи Бога: +15 только человеку, плут не крадёт', () => {
  const s = fresh(); const p = P(s, 'p0'); const r = P(s, 'p1');
  p.hand.push(take(s, 'i_godarmor#0'));
  A(s, 'p0', { type: 'playCard', uid: 'i_godarmor#0' });
  assert.ok(p.equipped.includes('i_godarmor#0'));
  assert.equal(combatNumbers(s), null);
  assert.ok(s.fx.some(f => f.kind === 'legendary'));
  p.races.push(take(s, 'r_elf#0'));
  A(s, 'p0', { type: 'autoEquip' });
  assert.ok(p.carried.includes('i_godarmor#0'), 'эльфу не надеть');
  p.races = [];
  A(s, 'p0', { type: 'autoEquip' });
  assert.ok(p.equipped.includes('i_godarmor#0'));
  r.classes.push(take(s, 'c_rogue#0')); r.hand.push(take(s, 'i_ladle#0'));
  s.turn = { idx: 1, pid: 'p1', step: 'pre', n: 2 };
  assert.match(A(s, 'p1', { type: 'ability', name: 'steal', target: 'p0', item: 'i_godarmor#0', cards: ['i_ladle#0'] }).error, /не украсть/);
});

t('Золотой Дракон: +10, не крадётся и не улетает при расплате', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 2;
  p.hand.push(take(s, 'p_golddragon#0'));
  A(s, 'p0', { type: 'playCard', uid: 'p_golddragon#0' });
  fight(s, 'm_endless#0'); // 12 ур, убежать нельзя
  assert.equal(combatNumbers(s).heroes, 12);
  s.combat.monsters[0].enh.push(take(s, 'e_hungry#0')); // +10: проигрываем
  A(s, 'p0', { type: 'runAway' });
  assert.ok(p.equipped.includes('p_golddragon#0'));
});

t('новые локации: кристаллы, гроза, таверна', () => {
  const s = fresh(); const p = P(s, 'p0'); const h = P(s, 'p1');
  p.hand.push(take(s, 'loc_crystal#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_crystal#0' });
  fight(s, 'm_mosquito#0');
  assert.equal(combatNumbers(s).heroes, 3);
  s.combat = null; s.turn.step = 'pre';
  p.hand.push(take(s, 'loc_storm#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_storm#0' });
  fight(s, 'm_slime#0');
  assert.equal(combatNumbers(s).levels, 2);
  assert.equal(combatNumbers(s).monsters, 3);
  s.combat = null; s.turn.step = 'pre';
  p.hand.push(take(s, 'loc_tavern#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_tavern#0' });
  assert.equal(view(s, 'p0').players[0].handLimit, 7);
  h.level = 9; p.level = 1;
  fight(s, 'm_zhek#0');
  A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 });
  A(s, 'p1', { type: 'answerHelp', accept: true });
  assert.equal(combatNumbers(s).treasures, 4);
});

t('ник «Еврей»: обе легендарки приходят ему по ходу игры', () => {
  for (const nick of ['Еврей', 'EVRE1', ' evre1 ']) {
    const s = createGame([{ id: 'a', name: 'Аня' }, { id: 'b', name: nick }, { id: 'c', name: 'Вова' }], {}, rng);
    assert.ok(s.rig && s.rig.pid === 'b');
    assert.equal(s.decks.treasure.some(u => def(u).rarity === 'legendary'), false);
    assert.equal(view(s, 'a').rig, undefined);
    for (const p of s.players) { for (const u of p.hand) s.discard[def(u).deck].push(u); p.hand = []; }
    const b = P(s, 'b');
    const owned = () => [...b.hand, ...b.equipped, ...b.carried].filter(u => def(u).rarity === 'legendary');
    for (let i = 0; i < 20 && owned().length < 2; i++) {
      s.turn = { idx: 1, pid: 'b', step: 'pre', n: i + 1, hoardPlayed: false };
      b.hand.push(take(s, 'h_hoard#' + (i % 2)));
      A(s, 'b', { type: 'playCard', uid: 'h_hoard#' + (i % 2) });
      s.discard.treasure.push(...b.hand.filter(u => def(u).rarity !== 'legendary'));
      b.hand = b.hand.filter(u => def(u).rarity === 'legendary');
    }
    assert.deepEqual(owned().map(u => def(u).id).sort(), ['i_godarmor', 'p_golddragon']);
  }
  const s = createGame([{ id: 'a', name: 'Аня' }, { id: 'b', name: 'Боря' }], {}, rng);
  assert.equal(s.rig, undefined);
  const all = [...s.decks.treasure, ...s.players.flatMap(p => p.hand)];
  assert.ok(all.includes('i_godarmor#0') && all.includes('p_golddragon#0'));
});

t('ник «Еврей»: если клада нет, легендарка находится сама в начале хода', () => {
  const s = createGame([{ id: 'a', name: 'Аня' }, { id: 'b', name: 'Еврей' }], {}, rng);
  const b = P(s, 'b');
  for (let i = 0; i < 16; i++) {
    s.turn.step = 'charity'; s.combat = null;
    for (const p of s.players) { s.discard.door.push(...p.hand.filter(u => def(u).deck === 'door')); s.discard.treasure.push(...p.hand.filter(u => def(u).deck === 'treasure' && def(u).rarity !== 'legendary')); p.hand = p.hand.filter(u => def(u).rarity === 'legendary'); }
    A(s, s.turn.pid, { type: 'endTurn', give: [] });
  }
  assert.equal(b.hand.filter(u => def(u).rarity === 'legendary').length, 2);
});
t('партия до 15 уровня: карты уровня и продажа не берут последний, победа — на 15-м', () => {
  const s = createGame(Array.from({ length: 3 }, (_, i) => ({ id: 'p' + i, name: 'И' + i })), { winDelayMs: 5000, winLevel: 15 }, rng);
  for (const p of s.players) { for (const u of p.hand) s.discard[def(u).deck].push(u); p.hand = []; }
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 1 };
  const p = P(s, 'p0'); p.level = 13;
  p.hand.push(take(s, 'l_stash#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'l_stash#0' }).ok, true);
  assert.equal(p.level, 14);
  p.hand.push(take(s, 'l_bribe#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'l_bribe#0' }).ok, false);
  p.hand.push(take(s, 'i_jackhammer#0'), take(s, 'i_diver#0'));
  assert.match(A(s, 'p0', { type: 'sell', uids: ['i_jackhammer#0', 'i_diver#0'] }).error, /15/);
  assert.equal(fillText(s, 'Не {win}-й, с {lux}-го'), 'Не 15-й, с 11-го');
  assert.equal(view(s, 'p0').opts.winLevel, 15);
  // уровень 14 и бой с монстром: 10-й уровень больше не победа, а 15-й — да
  p.hand = []; s.decks.door.push(take(s, 'm_mosquito#0'));
  A(s, 'p0', { type: 'kick' }); A(s, 'p0', { type: 'fight' }, 1000);
  tick(s, { rng, now: 9000 });
  assert.equal(p.level, 15); assert.equal(s.phase, 'ended'); assert.deepEqual(s.winners, ['p0']);
});

t('по умолчанию и при мусоре в настройках — 10 уровней', () => {
  assert.equal(createGame([{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }], {}, rng).opts.winLevel, 10);
  assert.equal(createGame([{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }], { winLevel: 99 }, rng).opts.winLevel, 10);
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  s.decks.door.push(take(s, 'm_mosquito#0'));
  A(s, 'p0', { type: 'kick' }); A(s, 'p0', { type: 'fight' }, 1000);
  tick(s, { rng, now: 9000 });
  assert.equal(s.phase, 'ended');
});

t('внешность: пол, телосложение и 10 видов одежды; старые аватары не ломаются', () => {
  assert.equal(AVATAR_PARTS.gender, 2); assert.equal(AVATAR_PARTS.body, 4); assert.equal(AVATAR_PARTS.outfit, 10); assert.equal(AVATAR_PARTS.hair, 20);
  const a = cleanAvatar({ skin: 2, hair: 3, gender: 1, body: 3, outfit: 9 });
  assert.deepEqual([a.gender, a.body, a.outfit], [1, 3, 9]);
  const old = cleanAvatar({ skin: 2, hair: 3 });
  assert.deepEqual([old.gender, old.body, old.outfit], [0, 0, 0]);
  const junk = cleanAvatar({ gender: 5, body: -1, outfit: 'кожанка' });
  assert.deepEqual([junk.gender, junk.body, junk.outfit], [0, 0, 0]);
  for (let i = 0; i < 300; i++) { const r = avatarFromSeed(i); if (r.gender) assert.equal(r.facial, 0); }
  const w = withGender({ ...old, hair: 1, facial: 4 }, 1);
  assert.equal(w.facial, 0); assert.notEqual(w.hair, 1);
});

// кубик всегда показывает 1 или 6 — чтобы побег точно провалился или удался
const lowDie = () => 0, highDie = () => 0.99;
const runWith = (s, pid, die) => act(s, pid, { type: 'runAway' }, { rng: die, now: 1000 });

t('боссы: уровень 666, сила вдвое больше силы героя, усилители и чары не действуют', () => {
  const bosses = ['m_lucifer', 'm_hades', 'm_anubis'].map(id => def(id + '#0'));
  assert.deepEqual(bosses.map(d => [d.boss, d.level, d.noPursue]), [[true, 666, 8], [true, 666, 8], [true, 666, 8]]);
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  for (const u of ['i_jackhammer#0', 'p_golddragon#0']) { p.hand.push(take(s, u)); A(s, 'p0', { type: 'playCard', uid: u }); } // сила 9 + 5 + 10 = 24
  s.location = take(s, 'loc_storm#0'); // монстрам +2 — боссу всё равно
  fight(s, 'm_lucifer#0');
  assert.equal(combatNumbers(s).heroes, 24);
  assert.equal(combatNumbers(s).monsters, 48);
  // сила запомнилась при выходе: зелье героя её не поднимает
  p.hand.push(take(s, 'b_pies#0')); A(s, 'p0', { type: 'playCard', uid: 'b_pies#0' });
  assert.equal(combatNumbers(s).heroes, 28); assert.equal(combatNumbers(s).monsters, 48);
  const o = P(s, 'p1'); o.hand.push(take(s, 'e_hungry#0'), take(s, 'e_baby#0'));
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'e_hungry#0', monster: 0 }).error, /усилители/);
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'e_baby#0', monster: 0 }).error, /усилители/);
  p.classes.push(take(s, 'c_mage#0')); p.hand.push(take(s, 'o_kvass#0'), take(s, 'o_cola#0'), take(s, 'b_energy#0'));
  assert.match(A(s, 'p0', { type: 'ability', name: 'charm', cards: [], monster: 0 }).error, /чарами/);
  // колыбельная барда и разовые карты действуют как обычно
  o.classes.push(take(s, 'c_bard#0')); o.hand.push(take(s, 'i_ladle#0'));
  assert.equal(A(s, 'p1', { type: 'ability', name: 'lullaby', cards: ['i_ladle#0'] }).ok, true);
  assert.equal(combatNumbers(s).monsters, 45);
});

t('босс слабее 30 не бывает: лёгкой добычей для новичка он не станет', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  fight(s, 'm_anubis#0');
  assert.equal(combatNumbers(s).monsters, 30);
  assert.ok(s.log.some(l => l.text.includes('слабее 30')));
});

t('босс не гонится за героями ниже 9-го уровня', () => {
  for (const lvl of [1, 6, 8]) {
    const s = fresh(); const p = P(s, 'p0'); p.level = lvl;
    p.hand.push(take(s, 'i_helmet#0')); A(s, 'p0', { type: 'playCard', uid: 'i_helmet#0' });
    fight(s, 'm_hades#0');
    assert.equal(combatNumbers(s).monsters, Math.max(30, 2 * (lvl + 1)));
    assert.equal(runWith(s, 'p0', lowDie).ok, true);
    assert.equal(s.combat, null);
    assert.equal(p.level, lvl); assert.equal(p.dead, false); assert.ok(p.equipped.includes('i_helmet#0'));
    assert.ok(s.log.some(l => l.text.includes('не стал гнаться')));
  }
});

t('босс догнал героя 9-го уровня: −5 уровней и смерть, раса и класс остаются', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  p.races.push(take(s, 'r_elf#0')); p.classes.push(take(s, 'c_warrior#0'));
  p.equipped.push(take(s, 'i_helmet#0')); p.hand.push(take(s, 'l_stash#0'));
  fight(s, 'm_anubis#0');
  assert.equal(runWith(s, 'p0', lowDie).ok, true);
  assert.equal(s.combat, null);
  assert.equal(p.level, 4); assert.equal(p.dead, true);
  assert.deepEqual([p.races, p.classes, p.equipped, p.hand], [['r_elf#0'], ['c_warrior#0'], [], []]);
  assert.ok(s.fx.some(f => f.kind === 'levelDown' && f.pid === 'p0' && f.from === 9 && f.to === 4));
  assert.ok(s.fx.some(f => f.kind === 'death' && f.pid === 'p0'));
});

t('босса можно одолеть вдвоём: +2 уровня и 5 кладов', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 7;
  for (const u of ['i_helmet#0', 'i_jackhammer#0', 'i_pick#0']) { p.hand.push(take(s, u)); A(s, 'p0', { type: 'playCard', uid: u }); }
  const str = view(s, 'p0').players[0].power;
  fight(s, 'm_lucifer#0');
  assert.equal(combatNumbers(s).monsters, Math.max(30, 2 * str));
  const h = P(s, 'p1'); h.level = 8; h.equipped.push(take(s, 'p_golddragon#0')); // 18
  assert.equal(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 2 }).ok, true);
  A(s, 'p1', { type: 'answerHelp', accept: true });
  assert.equal(combatNumbers(s).monsters, Math.max(30, 2 * str), 'помощник не делает босса сильнее');
  assert.equal(combatNumbers(s).winning, true);
  const before = p.hand.length;
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(s.combat, null);
  assert.equal(p.level, 9);
  assert.equal(p.hand.length - before + h.hand.length, 5);
});

t('от босса можно удрать кубиком, дымовой шашкой, свитком или питомцем', () => {
  { const s = fresh(); const p = P(s, 'p0'); p.level = 9; fight(s, 'm_lucifer#0');
    assert.equal(runWith(s, 'p0', highDie).ok, true); assert.equal(p.level, 9); assert.equal(p.dead, false); }
  { const s = fresh(); const p = P(s, 'p0'); p.level = 9; fight(s, 'm_lucifer#0');
    p.hand.push(take(s, 'o_smoke#0')); assert.equal(A(s, 'p0', { type: 'playCard', uid: 'o_smoke#0' }).ok, true);
    assert.equal(s.combat, null); assert.equal(p.level, 9); }
  { const s = fresh(); const p = P(s, 'p0'); p.level = 9; fight(s, 'm_lucifer#0');
    p.hand.push(take(s, 'o_petrify#0')); assert.equal(A(s, 'p0', { type: 'playCard', uid: 'o_petrify#0', monster: 0 }).ok, true);
    assert.equal(s.combat, null); assert.equal(p.level, 9); }
  { const s = fresh(); const p = P(s, 'p0'); p.level = 9; p.equipped.push(take(s, 'p_hamster#0')); fight(s, 'm_lucifer#0');
    assert.equal(runWith(s, 'p0', lowDie).ok, true); assert.equal(p.level, 9); assert.equal(p.dead, false); assert.ok(!p.equipped.includes('p_hamster#0')); }
});

t('босс из темноты встаёт с силой вдвое больше силы бойца', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  p.hand.push(take(s, 'i_jackhammer#0')); A(s, 'p0', { type: 'playCard', uid: 'i_jackhammer#0' });
  fight(s, 'm_mosquito#0');
  assert.equal(combatNumbers(s).winning, true);
  const o = P(s, 'p1'); o.hand.push(take(s, 'w_wandering#0'), take(s, 'm_hades#0'));
  assert.equal(A(s, 'p1', { type: 'playCard', uid: 'w_wandering#0', with: 'm_hades#0' }).ok, true);
  assert.equal(combatNumbers(s).winning, false);
  assert.equal(combatNumbers(s).monsters, 2 + 30);
});

t('«Искать неприятности»: бой со случайным монстром из колоды, а не с руки', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  s.turn.step = 'post';
  const handMon = take(s, 'm_troll#0'); p.hand.push(handMon);
  const deckMons = s.decks.door.filter(u => def(u).type === 'monster').length;
  assert.equal(A(s, 'p0', { type: 'lookForTrouble' }).ok, true);
  assert.ok(s.combat);
  assert.notEqual(s.combat.monsters[0].uid, handMon);
  assert.ok(p.hand.includes(handMon));
  assert.equal(s.decks.door.filter(u => def(u).type === 'monster').length, deckMons - 1);
});

t('«Искать неприятности»: только после двери и пока в колоде есть монстры', () => {
  const s = fresh();
  assert.equal(A(s, 'p0', { type: 'lookForTrouble' }).ok, false); // шаг «до двери»
  s.turn.step = 'post';
  for (const pile of [s.decks.door, s.discard.door]) for (let i = pile.length - 1; i >= 0; i--) if (def(pile[i]).type === 'monster') pile.splice(i, 1);
  assert.match(A(s, 'p0', { type: 'lookForTrouble' }).error, /Монстр/);
});

t('монстр «только уровень»: вещи, зелья и бонусы героям не считаются', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  p.hand.push(take(s, 'i_jackhammer#0')); A(s, 'p0', { type: 'playCard', uid: 'i_jackhammer#0' });
  fight(s, 'm_likho#0'); // ур. 4
  const n0 = combatNumbers(s);
  assert.equal(n0.heroes, 3); assert.equal(n0.monsters, 4); assert.equal(n0.winning, false);
  const bonus = s.decks.treasure.concat(s.discard.treasure).find(u => def(u).type === 'oneshot' && def(u).effect === 'bonus');
  p.hand.push(take(s, bonus));
  assert.match(A(s, 'p0', { type: 'playCard', uid: bonus, side: 'player' }).error, /только уровень/);
  // монстру помогать по-прежнему можно
  assert.equal(A(s, 'p0', { type: 'playCard', uid: bonus, side: 'monster' }).ok, true);
  p.level = 9;
  assert.equal(combatNumbers(s).heroes, 9);
});

t('монстр «только уровень»: ярость воина не прибавляет', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 4;
  p.classes.push(take(s, 'c_warrior#0'));
  p.hand.push(take(s, 'i_jackhammer#0'));
  fight(s, 'm_cyclops#0');
  assert.match(A(s, 'p0', { type: 'ability', name: 'rage', cards: ['i_jackhammer#0'] }).error, /только уровень/);
});

t('монстр «без помощи»: позвать нельзя ни просьбой, ни «Ты мой раб»', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 2;
  fight(s, 'm_kikimora#0');
  assert.match(A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 1 }).error, /помощник/);
  p.hand.push(take(s, 'o_slave#0'));
  assert.match(A(s, 'p0', { type: 'playCard', uid: 'o_slave#0', target: 'p1' }).error, /никого не позвать/);
});

t('«Ты мой раб»: помощник обязан драться и не получает клада', () => {
  const s = fresh(); const p = P(s, 'p0'); const h = P(s, 'p1');
  p.level = 5; h.level = 8;
  fight(s, 'm_zhek#0'); // 12 ур, 3 клада
  assert.equal(combatNumbers(s).winning, false);
  p.hand.push(take(s, 'o_slave#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'o_slave#0', target: 'p0' }).ok, false);
  assert.equal(A(s, 'p2', { type: 'playCard', uid: 'o_slave#0', target: 'p1' }).ok, false);
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'o_slave#0', target: 'p1' }).ok, true);
  assert.equal(s.combat.helper, 'p1'); assert.equal(s.combat.forced, true);
  assert.equal(combatNumbers(s).winning, true);
  assert.equal(A(s, 'p0', { type: 'askHelp', to: 'p2', offer: 1 }).ok, false);
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(h.hand.length, 0); assert.equal(p.hand.length, 3); assert.equal(p.level, 6);
});

t('«Ты мой раб» вне своего боя не играется', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'o_slave#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'o_slave#0', target: 'p1' }).ok, false);
  fight(s, 'm_mosquito#0', 'p0');
  const o = P(s, 'p1'); o.hand.push(take(s, 'o_slave#1'));
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'o_slave#1', target: 'p2' }).error, /своём бою/);
});

console.log(`Правила: ${n} проверок пройдено.`);
