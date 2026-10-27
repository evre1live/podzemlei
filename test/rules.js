// Точечные проверки правил.
import assert from 'node:assert/strict';
import { createGame, act, tick, view, combatNumbers, P, saleValue, fillText, orderCard, grantCard, playOptions, troubleBand, shopPrice, trickStart, trickBuy, trickPlay, trickOptions, trickOf } from '../shared/engine.js';
import { cheatCard, cheatCardNow, cheatGold } from '../server/cheats.js';
import { botDecide } from '../shared/bot.js';
import { def, dailyOf, SHOP_IDS } from '../shared/cards.js';
import { AVATAR_PARTS, cleanAvatar, avatarFromSeed, portraitId, pickCode, avatarInGame, gameRaces } from '../shared/avatar.js';

let seed = 7; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function fresh(n = 3) {
  const s = createGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'И' + i })), { winDelayMs: 5000 }, rng);
  for (const p of s.players) { for (const u of p.hand) s.discard[def(u).deck].push(u); p.hand = []; p.contract = null; }
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 1 };
  return s;
}
const take = (s, uid) => { for (const k of ['door', 'treasure']) for (const pile of [s.decks[k], s.discard[k]]) { const i = pile.indexOf(uid); if (i >= 0) { pile.splice(i, 1); return uid; } } throw new Error('no ' + uid); };
const A = (s, pid, a, now = 1000) => act(s, pid, a, { rng, now });
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('нельзя дойти до 10 уровня картой уровня; продажа даёт голды в кошелёк, а не уровни', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  p.hand.push(take(s, 'l_stash#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'l_stash#0' }).ok, false);
  p.hand.push(take(s, 'i_jackhammer#0'), take(s, 'i_diver#0'));
  assert.equal(A(s, 'p0', { type: 'sell', uids: ['i_jackhammer#0', 'i_diver#0'] }).ok, true);
  assert.equal(p.level, 9); assert.equal(p.gold, 800 + 600);
  assert.equal(view(s, 'p0').players[0].gold, 1400); assert.equal(view(s, 'p1').players[0].gold, null, 'чужой кошелёк скрыт');
  // мелочь тоже продаётся: порога в 1000 больше нет
  p.carried.push(take(s, 'i_ladle#0'));
  assert.equal(A(s, 'p0', { type: 'sell', uids: ['i_ladle#0'] }).ok, true);
  assert.equal(p.gold, 1500);
  assert.match(A(s, 'p0', { type: 'sell', uids: ['l_stash#0'] }).error, /ничего не стоит/);
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

t('смерть: вещи разбирают, −1 уровень, возрождение с 8 картами', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 4;
  p.hand.push(take(s, 'i_helmet#0'), take(s, 'i_boots#0'));
  A(s, 'p0', { type: 'playCard', uid: 'i_helmet#0' });
  s.decks.door.push(take(s, 'm_heatpipe#0'));
  A(s, 'p0', { type: 'kick' });
  let tries = 0;
  while (s.combat && tries++ < 50) { const r = A(s, 'p0', { type: 'runAway' }); if (!r.ok) break; }
  if (p.dead) {
    assert.equal(p.level, 3); assert.equal(p.hand.length + p.equipped.length, 0);
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
  p.hand.push(take(s, 'loc_cove#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_cove#0' });
  assert.equal(s.location, 'loc_cove#0');
  fight(s, 'm_duck#0'); // водная, ур. 4
  assert.equal(combatNumbers(s).monsters, 6);
  assert.equal(view(s, 'p0').players[0].runBonus, 2);
  s.combat = null; s.turn.step = 'pre';
  p.hand.push(take(s, 'loc_oasis#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_oasis#0' });
  assert.ok(s.discard.door.includes('loc_cove#0'));
  // у джинна уровни на рынке дешевле, проклятия за бесценок, вода дорогая
  const price = id => view(s, 'p0').shop.items.find(x => x.id === id).price;
  assert.equal(price('l_stash'), 700); assert.equal(price('k_tax'), 300); assert.equal(price('o_kvass'), 300);
  P(s, 'p1').level = 5; p.hand.push(take(s, 'k_tax#0'));
  A(s, 'p0', { type: 'playCard', uid: 'k_tax#0', target: 'p1' });
  assert.equal(P(s, 'p1').level, 5, 'у оазиса проклятия не действуют');
  // ледяная цитадель: огненные слабее, на льду скользко
  s.turn.step = 'pre'; p.hand.push(take(s, 'loc_ice#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_ice#0' });
  assert.equal(view(s, 'p0').players[0].runBonus, -1);
  // кузня: гномам +2, огненным +4, лишний клад
  p.hand.push(take(s, 'loc_forge#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_forge#0' });
  p.races.push(take(s, 'r_dwarf#0'));
  fight(s, 'm_salamander#0');
  assert.equal(combatNumbers(s).heroes, 1 + 2);
  assert.equal(combatNumbers(s).monsters, def('m_salamander#0').level + 4);
  assert.equal(combatNumbers(s).treasures, def('m_salamander#0').treasures + 1);
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
  g.hand.push(take(s, 'o_kvass#0'));
  assert.equal(saleValue(s, g, ['o_kvass#0']).total, 100, 'гоблинская надбавка — только за вещи');
  g.hand.splice(g.hand.indexOf('o_kvass#0'), 1); s.discard.treasure.push('o_kvass#0');
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
  assert.equal(combatNumbers(s).monsters, 4);
  assert.equal(combatNumbers(s).treasures, 3);
  // колыбельная — раз за бой
  p.hand.push(take(s, 'i_boots#0'));
  assert.match(A(s, 'p0', { type: 'ability', name: 'lullaby', cards: ['i_boots#0'] }).error, /раз за бой/);
  const al = P(s, 'p1'); al.classes.push(take(s, 'c_alchemist#0'));
  al.hand.push(take(s, 'o_kvass#0'));
  A(s, 'p1', { type: 'playCard', uid: 'o_kvass#0', side: 'monster' });
  assert.equal(combatNumbers(s).monsters, 8);
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

t('алхимик перегоняет три карты в клад раз в ход', () => {
  const s = fresh(); const p = P(s, 'p0'); p.classes.push(take(s, 'c_alchemist#0'));
  p.hand.push(take(s, 'i_ladle#0'), take(s, 'i_boots#0'), take(s, 'i_helmet#0'), take(s, 'i_helmet#1'), take(s, 'i_flashlight#0'));
  assert.match(A(s, 'p0', { type: 'ability', name: 'distill', cards: ['i_ladle#0', 'i_boots#0'] }).error, /3 карты/);
  assert.equal(A(s, 'p0', { type: 'ability', name: 'distill', cards: ['i_ladle#0', 'i_boots#0', 'i_flashlight#0'] }).ok, true);
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

t('ведьмак: +3 всегда, мутаген +6 один раз за партию', () => {
  const s = fresh(); const p = P(s, 'p0'); p.classes.push(take(s, 'c_witcher#0'));
  fight(s, 'm_zhek#0'); // 12 ур
  assert.equal(combatNumbers(s).heroes, 4);
  p.hand.push(take(s, 'i_ladle#0'), take(s, 'i_boots#0'), take(s, 'i_helmet#0'), take(s, 'i_helmet#1'));
  assert.equal(A(s, 'p0', { type: 'ability', name: 'mutagen', cards: ['i_ladle#0', 'i_boots#0'] }).ok, true);
  assert.equal(combatNumbers(s).heroes, 10);
  assert.match(A(s, 'p0', { type: 'ability', name: 'mutagen', cards: ['i_helmet#0', 'i_helmet#1'] }).error, /раз за партию/);
});

t('Доспехи Бога: +10 только человеку, плут не крадёт', () => {
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

t('Легендарный комплект: только человеку, со «Смешанной кровью» — любой расе', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.races.push(take(s, 'r_elf#0'));
  for (const id of ['i_ares', 'i_godarmor', 'i_epochboots', 'i_excalibur']) {
    p.hand.push(take(s, id + '#0'));
    assert.equal(A(s, 'p0', { type: 'playCard', uid: id + '#0' }).ok, true);
    assert.ok(p.carried.includes(id + '#0'), id + ': эльфу без Смешанной крови не надеть — лежит в запасе');
  }
  assert.match(A(s, 'p0', { type: 'equip', uid: 'i_ares#0' }).error || '', /Смешанной кровью/);
  // «Смешанная кровь» открывает комплект любой расе
  p.hand.push(take(s, 'x_halfbreed#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'x_halfbreed#0' }).ok, true);
  A(s, 'p0', { type: 'autoEquip' });
  assert.ok(['i_ares#0', 'i_godarmor#0', 'i_epochboots#0', 'i_excalibur#0'].every(u => p.equipped.includes(u)));
  assert.deepEqual(view(s, 'p0').players[0].sets, ['legend']);
  // потерял «Смешанную кровь» — части комплекта снимаются
  assert.equal(A(s, 'p0', { type: 'discardInPlay', uid: 'x_halfbreed#0' }).ok, true);
  assert.ok(['i_ares#0', 'i_godarmor#0', 'i_epochboots#0', 'i_excalibur#0'].every(u => p.carried.includes(u)));
  // человеку (без расы) можно и так
  const s2 = fresh(); const h = P(s2, 'p0');
  h.hand.push(take(s2, 'i_epochboots#0'));
  A(s2, 'p0', { type: 'playCard', uid: 'i_epochboots#0' });
  assert.ok(h.equipped.includes('i_epochboots#0'));
});

t('тайные команды /MIXBLOOD и /2CL: «Смешанная кровь» и «Совместитель» приходят всегда', () => {
  const s = fresh(); const p = P(s, 'p0'); const o = P(s, 'p1');
  // все копии у соперника — всё равно придёт ещё одна
  o.hand.push(take(s, 'x_halfbreed#0'), take(s, 'x_halfbreed#1'), take(s, 'x_super#0'), take(s, 'x_super#1'));
  assert.equal(orderCard(s, 'p0', cheatCard('/MIXBLOOD')).ok, true);
  assert.equal(orderCard(s, 'p0', cheatCard('/2CL')).ok, true);
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 3, hoardPlayed: false };
  p.hand.push(take(s, 'h_hoard#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'h_hoard#0' }).ok, true);
  const mix = p.hand.find(u => def(u).type === 'halfbreed'), sup = p.hand.find(u => def(u).type === 'supermunch');
  assert.ok(mix && sup, 'обе карты пришли со схроном');
  assert.equal(A(s, 'p0', { type: 'playCard', uid: mix }).ok, true);
  assert.equal(A(s, 'p0', { type: 'playCard', uid: sup }).ok, true);
  assert.equal(p.halfbreed, mix); assert.equal(p.supermunch, sup);
});

t('тайные команды: карта приходит вместо ближайшей карты клада и никому не видна', () => {
  assert.equal(cheatCard('/GODMODE'), 'i_godarmor');
  assert.equal(cheatCard(' /ageboots '), 'i_epochboots');
  assert.equal(cheatCard('/WITCHER'), 'c_witcher');
  assert.equal(cheatCard('/EXC'), 'i_excalibur');
  assert.equal(cheatCard('/GOLDENDRAGON'), 'p_golddragon');
  assert.equal(cheatCard('/ARES'), 'i_ares');
  assert.equal(cheatCard('/MIXBLOOD'), 'x_halfbreed');
  assert.equal(cheatCard('/2CL'), 'x_super');
  assert.equal(cheatCard('/2cl'), 'x_super');
  assert.equal(cheatCard('/WARLOCK'), 'c_warlock');
  assert.equal(cheatCard('/PLOTVA'), 'p_roach');
  assert.equal(cheatCard('/hello'), null);
  assert.equal(cheatCard('привет /ARES'), null);
  const s = fresh(); const p = P(s, 'p0'); const o = P(s, 'p1');
  const ownerOf = id => s.players.find(x => [...x.hand, ...x.equipped, ...x.carried].some(u => u.startsWith(id + '#')));
  // сначала все легендарки — в колоду
  for (const x of s.players) for (const z of ['hand', 'equipped', 'carried']) { const keep = x[z].filter(u => def(u).rarity !== 'legendary'); s.decks.treasure.push(...x[z].filter(u => def(u).rarity === 'legendary')); x[z] = keep; }
  const logLen = s.log.length;
  assert.equal(orderCard(s, 'p0', cheatCard('/GODMODE')).ok, true);
  assert.equal(s.log.length, logLen, 'в летописи ничего');
  assert.equal(JSON.stringify(view(s, 'p1')).includes('orders'), false, 'соперникам не видно');
  const before = p.hand.length;
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 3, hoardPlayed: false };
  p.hand.push(take(s, 'h_hoard#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'h_hoard#0' }).ok, true);
  assert.equal(p.hand.length, before + 2, 'карт столько же, сколько обычно');
  assert.ok(p.hand.includes('i_godarmor#0'));
  assert.equal(s.orders?.p0, undefined);
  // вещь на руке у другого героя — не выйдет
  o.hand.push(take(s, 'i_ares#0'));
  assert.match(orderCard(s, 'p0', cheatCard('/ARES')).error, /уже у кого-то/);
  // класс — в любом случае: обе копии Ведьмака у соперника, приходит ещё одна
  o.hand.push(take(s, 'c_witcher#0'), take(s, 'c_witcher#1'));
  assert.equal(orderCard(s, 'p0', cheatCard('/WITCHER')).ok, true);
  assert.equal(orderCard(s, 'p0', cheatCard('/EXC')).ok, true);
  // победа в бою: обе заказанные карты подменяют клад
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 4 };
  p.level = 5;
  fight(s, 'm_roach#0');
  s.combat.winAt = 1; tick(s, { rng, now: 2 });
  assert.equal(s.combat, null);
  const w = p.hand.find(u => u.startsWith('c_witcher#'));
  assert.ok(w && !['c_witcher#0', 'c_witcher#1'].includes(w) && def(w).cls === 'witcher', 'новая копия Ведьмака');
  // таракан даёт одну карту клада — Экскалибур ждёт следующей
  assert.ok(!p.hand.includes('i_excalibur#0'));
  assert.deepEqual(s.orders.p0, ['i_excalibur']);
  s.turn = { idx: 0, pid: 'p0', step: 'pre', n: 5, hoardPlayed: false };
  p.hand.push(take(s, 'h_hoard#1'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'h_hoard#1' }).ok, true);
  assert.ok(p.hand.includes('i_excalibur#0'));
  assert.equal(ownerOf('i_excalibur'), p);
  assert.equal(s.orders?.p0, undefined);
});

t('пустая дверь: монстр с руки вместо неприятностей, неприятности — по глубине', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  s.turn = { idx: 0, pid: 'p0', step: 'post', n: 2 };
  p.hand.push(take(s, 'm_roach#0'));
  // монстр на руке — искать неприятности нельзя, зато можно позвать его
  assert.match(A(s, 'p0', { type: 'lookForTrouble' }).error, /На руке есть монстры/);
  assert.deepEqual(playOptions(s, 'p0', 'm_roach#0'), [{ type: 'playCard', uid: 'm_roach#0' }]);
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'm_roach#0' }).ok, true);
  assert.equal(s.combat.monsters[0].uid, 'm_roach#0');
  assert.equal(s.combat.mods.length, 0, 'свой монстр не разбужен');
  assert.equal(s.combat.trouble, true);
  assert.ok(!p.hand.includes('m_roach#0'));
  // до двери и в чужой ход свой монстр в бой не идёт
  const s2 = fresh(); const q = P(s2, 'p0');
  q.hand.push(take(s2, 'm_roach#0'));
  assert.match(A(s2, 'p0', { type: 'playCard', uid: 'm_roach#0' }).error, /за дверью никого/);
  // монстров на руке нет — неприятности: у поверхности мелочь (до 6-го уровня), без боссов
  for (let i = 0; i < 25; i++) {
    const s3 = fresh(); const r = P(s3, 'p0'); r.level = 3;
    for (const x of s3.players) { s3.discard.door.push(...x.hand.filter(u => def(u).type === 'monster')); x.hand = x.hand.filter(u => def(u).type !== 'monster'); }
    s3.turn = { idx: 0, pid: 'p0', step: 'post', n: 2 };
    assert.equal(A(s3, 'p0', { type: 'lookForTrouble' }).ok, true);
    const d = def(s3.combat.monsters[0].uid);
    assert.ok(!d.boss && d.level <= 6, 'у поверхности ' + d.name + ' ур. ' + d.level);
    assert.ok(s3.combat.mods.some(m => m.label === 'Разбуженный монстр'));
  }
  // на дне окно уровней сдвигается вниз-вверх и пускает боссов
  const s4 = fresh(); s4.depth = 3;
  const b = troubleBand(s4);
  assert.ok(b.boss && b.min >= 8 && b.max >= 22);
  const s5 = fresh(); s5.depth = 1;
  const b1 = troubleBand(s5);
  assert.ok(!b1.boss && b1.min > 0 && b1.max > 6 && b1.max < 22);
});

t('обмен и контракт не ломают номера событий: анимации не повторяются', () => {
  const s = fresh(); const a = P(s, 'p0'), b = P(s, 'p1');
  a.contract = { id: 'q_trade', progress: 0 }; a.level = 5; // «Купец» выполнится прямо на обмене
  // клиент: помнит последний номер и играет только новые события — как handleFx
  let last = null; const played = [];
  const client = () => {
    const list = view(s, 'p1').fx;
    const maxId = list.reduce((m, f) => Math.max(m, f.id || 0), 0);
    if (last === null) { last = maxId; return; }
    for (const f of list.filter(f => f.id > last)) played.push(f.id);
    last = Math.max(last, maxId);
  };
  client();
  fight(s, 'm_roach#0'); s.combat.winAt = 1; tick(s, { rng, now: 2 }); client(); // пара обычных событий в журнале
  assert.equal(s.combat, null);
  s.turn.step = 'charity';
  a.carried.push(take(s, 'i_shovel#0')); b.carried.push(take(s, 'i_ladle#0'));
  assert.equal(A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_shovel#0'], want: ['i_ladle#0'] }).ok, true); client();
  const o = s.trades[0];
  assert.equal(A(s, 'p1', { type: 'answerTrade', id: o.id, accept: true }).ok, true); client();
  fight(s, 'm_roach#1', 'p0'); client();
  const ids = s.fx.map(f => f.id);
  assert.ok(ids.every((x, i) => typeof x === 'number' && (i === 0 || x > ids[i - 1])), 'номера событий растут: ' + ids.join(','));
  assert.equal(new Set(played).size, played.length, 'ни одно событие не сыграно дважды');
  assert.ok(s.fx.some(f => f.kind === 'tradeOffer' && f.trade === o.id));
  assert.ok(s.fx.some(f => f.kind === 'trade'));
  assert.ok(!s.fx.some(f => f.kind === 'contract') || s.fx.filter(f => f.kind === 'contract').every(f => typeof f.id === 'number'));
});

t('Золотой Дракон: +7, не крадётся и не улетает при расплате', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 2;
  p.hand.push(take(s, 'p_golddragon#0'));
  A(s, 'p0', { type: 'playCard', uid: 'p_golddragon#0' });
  fight(s, 'm_endless#0'); // 12 ур, убежать нельзя
  assert.equal(combatNumbers(s).heroes, 9);
  s.combat.monsters[0].enh.push(take(s, 'e_hungry#0')); // +10: проигрываем
  A(s, 'p0', { type: 'runAway' });
  assert.ok(p.equipped.includes('p_golddragon#0'));
});

t('локации: библиотека, небесная цитадель, таверна', () => {
  const s = fresh(); const p = P(s, 'p0'); const h = P(s, 'p1');
  p.hand.push(take(s, 'loc_library#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_library#0' });
  fight(s, 'm_mosquito#0');
  assert.equal(combatNumbers(s).heroes, 3);
  s.combat = null; s.turn.step = 'pre';
  p.hand.push(take(s, 'loc_sky#0'));
  A(s, 'p0', { type: 'playCard', uid: 'loc_sky#0' });
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

t('легендарки лежат в общей колоде при любом нике', () => {
  for (const nick of ['Еврей', 'EVRE1', 'Боря']) {
    const s = createGame([{ id: 'a', name: 'Аня' }, { id: 'b', name: nick }, { id: 'c', name: 'Вова' }], {}, rng);
    assert.equal(s.rig, undefined);
    const all = [...s.decks.treasure, ...s.players.flatMap(p => p.hand)];
    assert.ok(['i_godarmor#0', 'i_ares#0', 'i_epochboots#0', 'i_excalibur#0', 'p_golddragon#0'].every(u => all.includes(u)));
  }
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
  assert.equal(A(s, 'p0', { type: 'sell', uids: ['i_jackhammer#0', 'i_diver#0'] }).ok, true);
  assert.equal(p.level, 14); // продажа — голды, а не уровни
  p.gold = 5000; s.decks.treasure.push(take(s, 'l_map#0'));
  assert.match(A(s, 'p0', { type: 'buy', id: 'l_map' }).error, /Последний уровень/);
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

t('облик: пол, раса, образ и рамка; аватары прошлых версий не ломаются', () => {
  assert.deepEqual(AVATAR_PARTS, { gender: 2, race: 7, look: 6, frame: 13, pref: 7 });
  const Z = [0, 0, 0, 0, 0, 0, 0];
  const a = cleanAvatar({ gender: 1, race: 6, look: 5, frame: 12 });
  assert.deepEqual(a, { gender: 1, race: 6, look: 5, frame: 12, pref: 0, alt: Z });
  assert.equal(portraitId(a), 'p_mole_f_6');
  assert.equal(portraitId(cleanAvatar({})), 'p_human_m_1');
  // облик прошлой версии: пол и раса остаются, детали лица и одежды отбрасываются
  assert.deepEqual(cleanAvatar({ gender: 1, race: 2, hair: 9, outfit: 12, jewel: 4 }), { gender: 1, race: 2, look: 0, frame: 0, pref: 0, alt: Z });
  assert.deepEqual(cleanAvatar({ gender: 5, race: -1, look: 'маг', frame: 1.5, alt: 'x' }), { gender: 0, race: 0, look: 0, frame: 0, pref: 0, alt: Z });
  assert.deepEqual(cleanAvatar({ alt: [3, 13, -1, '12', 1.5, 0, 7, 9] }).alt, [3, 0, 0, 12, 0, 0, 7]);
  const seen = new Set();
  for (let i = 0; i < 400; i++) { const r = avatarFromSeed(i); assert.deepEqual(cleanAvatar(r), r); seen.add(portraitId(r)); }
  assert.ok(seen.size > 60, 'случайные облики разнообразны');
});

t('облик в партии: портрет следует за расой героя, у каждой расы свой выбор', () => {
  // основной облик — эльфийка-маг; за орка выбран орк-воин (мужчина)
  const a = cleanAvatar({ gender: 1, race: 1, look: 1, alt: [0, 0, 0, 0, pickCode(0, 0), 0, 0] });
  assert.deepEqual(gameRaces([]), [0]);
  const human = avatarInGame(a, []);          // без карты расы — человек того же пола и образа
  assert.equal(portraitId(human), 'p_human_f_2');
  assert.equal(portraitId(avatarInGame(a, ['orc'])), 'p_orc_m_1');      // запомненный выбор
  assert.equal(portraitId(avatarInGame(a, ['dwarf'])), 'p_dwarf_f_2');  // без выбора — пол и образ основного
  // полукровка: показывается основная раса, а после выбора в партии — выбранная
  assert.equal(avatarInGame(a, ['orc', 'elf']).race, 1);
  assert.equal(avatarInGame({ ...a, pref: 4 }, ['orc', 'elf']).race, 4);
  assert.equal(avatarInGame({ ...a, pref: 4 }, ['goblin']).race, 5);
});

// кубик всегда показывает 1 или 6 — чтобы побег точно провалился или удался
const lowDie = () => 0, highDie = () => 0.99;
const runWith = (s, pid, die) => act(s, pid, { type: 'runAway' }, { rng: die, now: 1000 });

t('боссы: уровень 666, сила вдвое больше силы героя, усилители и чары не действуют', () => {
  const bosses = ['m_lucifer', 'm_hades', 'm_anubis'].map(id => def(id + '#0'));
  assert.deepEqual(bosses.map(d => [d.boss, d.level, d.noPursue]), [[true, 666, 8], [true, 666, 8], [true, 666, 8]]);
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  for (const u of ['i_jackhammer#0', 'p_golddragon#0']) { p.hand.push(take(s, u)); A(s, 'p0', { type: 'playCard', uid: u }); } // сила 9 + 5 + 7 = 21
  s.location = take(s, 'loc_sky#0'); // монстрам +2 — боссу всё равно
  fight(s, 'm_lucifer#0');
  assert.equal(combatNumbers(s).heroes, 21);
  assert.equal(combatNumbers(s).monsters, 42);
  // сила запомнилась при выходе: зелье героя её не поднимает
  p.hand.push(take(s, 'b_pies#0')); A(s, 'p0', { type: 'playCard', uid: 'b_pies#0' });
  assert.equal(combatNumbers(s).heroes, 25); assert.equal(combatNumbers(s).monsters, 42);
  const o = P(s, 'p1'); o.hand.push(take(s, 'e_hungry#0'), take(s, 'e_baby#0'));
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'e_hungry#0', monster: 0 }).error, /усилители/);
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'e_baby#0', monster: 0 }).error, /усилители/);
  p.classes.push(take(s, 'c_mage#0')); p.hand.push(take(s, 'o_kvass#0'), take(s, 'o_cola#0'), take(s, 'b_energy#0'));
  assert.match(A(s, 'p0', { type: 'ability', name: 'charm', cards: [], monster: 0 }).error, /чарами/);
  // колыбельная барда и разовые карты действуют как обычно
  o.classes.push(take(s, 'c_bard#0')); o.hand.push(take(s, 'i_ladle#0'));
  assert.equal(A(s, 'p1', { type: 'ability', name: 'lullaby', cards: ['i_ladle#0'] }).ok, true);
  assert.equal(combatNumbers(s).monsters, 40);
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

t('босс догнал героя 9-го уровня: −5 уровней и смерть (ещё −1), раса и класс остаются', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 9;
  p.races.push(take(s, 'r_elf#0')); p.classes.push(take(s, 'c_warrior#0'));
  p.equipped.push(take(s, 'i_helmet#0')); p.hand.push(take(s, 'l_stash#0'));
  fight(s, 'm_anubis#0');
  assert.equal(runWith(s, 'p0', lowDie).ok, true);
  assert.equal(s.combat, null);
  assert.equal(p.level, 3); assert.equal(p.dead, true);
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
  const h = P(s, 'p1'); h.level = 8; h.equipped.push(take(s, 'p_golddragon#0'), take(s, 'i_rail#0')); // 19
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

t('«Искать неприятности»: только без монстров на руке, монстр — случайный из колоды', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  s.turn.step = 'post';
  const handMon = take(s, 'm_troll#0'); p.hand.push(handMon);
  assert.match(A(s, 'p0', { type: 'lookForTrouble' }).error, /На руке есть монстры/);
  s.discard.door.push(handMon); p.hand = p.hand.filter(u => u !== handMon);
  // монстры с засадой могут выбить карты из руки — для этой проверки уберём их в сброс
  for (let i = s.decks.door.length - 1; i >= 0; i--) if (def(s.decks.door[i]).ambush) s.discard.door.push(...s.decks.door.splice(i, 1));
  const deckMons = s.decks.door.filter(u => def(u).type === 'monster').length;
  assert.equal(A(s, 'p0', { type: 'lookForTrouble' }).ok, true);
  assert.ok(s.combat);
  assert.equal(s.decks.door.filter(u => def(u).type === 'monster').length, deckMons - 1);
});

t('«Искать неприятности»: монстр разбужен, +4 к силе; боссу бонус не нужен', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  s.turn.step = 'post';
  // простой монстр: без поправок по кругу, классу и расе
  const m = s.decks.door.find(u => def(u).type === 'monster' && !def(u).boss && !def(u).mirror && !def(u).roundMod && !def(u).vs);
  s.decks.door.splice(s.decks.door.indexOf(m), 1);
  s.decks.door.push(m);
  const pool = s.decks.door.filter(u => def(u).type === 'monster' && u !== m);
  for (const u of pool) s.decks.door.splice(s.decks.door.indexOf(u), 1);
  s.discard.door.push(...pool);
  assert.equal(A(s, 'p0', { type: 'lookForTrouble' }).ok, true);
  assert.equal(s.combat.monsters[0].uid, m);
  assert.deepEqual(s.combat.mods.map(x => [x.side, x.n]), [['monster', 4]]);
  assert.equal(combatNumbers(s).monsters, def(m).level + 4);
  assert.ok(s.log.some(l => /Разбуженный монстр/.test(l.text)));
  // обычная дверь монстра не будит
  const s2 = fresh(); s2.decks.door.push(take(s2, 'm_roach#0'));
  A(s2, 'p0', { type: 'kick' });
  assert.equal(s2.combat.mods.length, 0);
  // боссу прибавки нет
  const s3 = fresh(); s3.turn.step = 'post';
  for (const pile of [s3.decks.door, s3.discard.door]) for (let i = pile.length - 1; i >= 0; i--) if (def(pile[i]).type === 'monster' && pile[i] !== 'm_lucifer#0') pile.splice(i, 1);
  s3.decks.door.push('m_lucifer#0');
  if (!s3.decks.door.includes('m_lucifer#0')) throw new Error('нет босса в колоде');
  A(s3, 'p0', { type: 'lookForTrouble' });
  assert.equal(s3.combat.mods.length, 0);
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

// ───────────────────────── глубина ─────────────────────────
t('глубина: в партии до 10 — каждые 3 круга монстры +1, дно на 3; с 3-й глубины — лишний клад; боссов не касается', () => {
  const s = fresh(); const p = P(s, 'p0');
  s.round = 2; s.turn = { idx: 2, pid: 'p2', step: 'charity', n: 9 };
  assert.equal(A(s, 'p2', { type: 'endTurn' }).ok, true); // начинается 4-й круг
  assert.equal(s.round, 3); assert.equal(s.depth, 1);
  assert.ok(s.log.some(l => /глубже: глубина 1/.test(l.text)));
  assert.equal(view(s, 'p0').depth.level, 1); assert.equal(view(s, 'p0').depth.bonus, 1);
  fight(s, 'm_roach#0'); // ур. 2
  assert.equal(combatNumbers(s).monsters, 3);
  assert.equal(combatNumbers(s).treasures, def('m_roach#0').treasures);
  s.depth = 3;
  assert.equal(combatNumbers(s).monsters, 5);
  assert.equal(combatNumbers(s).treasures, def('m_roach#0').treasures + 1);
  // дно: глубже третьей в партии до 10 не спускаемся
  const d = fresh(); d.depth = 3; d.round = 8; d.turn = { idx: 2, pid: 'p2', step: 'charity', n: 27 };
  A(d, 'p2', { type: 'endTurn' });
  assert.equal(d.round, 9); assert.equal(d.depth, 3);
  const b = fresh(); P(b, 'p0').level = 9; b.depth = 5;
  fight(b, 'm_lucifer#0');
  assert.equal(combatNumbers(b).monsters, 30, 'босс: только вдвое против героя или 30');
});

// ───────────────────────── смерть и призрак ─────────────────────────
t('смерть стоит уровня, но не ниже первого', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 1;
  fight(s, 'm_kraken#0');
  runWith(s, 'p0', lowDie);
  assert.equal(p.dead, true); assert.equal(p.level, 1);
});

t('призрак: раз за ход ±2 в чужом бою; живым нельзя', () => {
  const s = fresh(); const p = P(s, 'p0'); const g = P(s, 'p1'); p.level = 3;
  g.needsRevive = true; // погиб и ждёт своего хода
  fight(s, 'm_roach#0'); // 2
  const before = combatNumbers(s).monsters;
  assert.equal(A(s, 'p1', { type: 'haunt', side: 'monster' }).ok, true);
  assert.equal(combatNumbers(s).monsters, before + 2);
  assert.ok(s.fx.some(f => f.kind === 'haunt' && f.pid === 'p1'));
  assert.match(A(s, 'p1', { type: 'haunt', side: 'player' }).error, /раз за ход/);
  assert.match(A(s, 'p2', { type: 'haunt', side: 'player' }).error, /погибший/);
  assert.match(A(s, 'p0', { type: 'haunt', side: 'player' }).error, /погибший/);
  assert.equal(view(s, 'p0').players[1].ghost, true);
  assert.equal(view(s, 'p0').hints === null, false);
  // против «только уровня» героям призрак не поможет
  const s2 = fresh(); P(s2, 'p1').needsRevive = true; fight(s2, 'm_likho#0');
  assert.match(A(s2, 'p1', { type: 'haunt', side: 'player' }).error, /только уровень/);
});

// ───────────────────────── контракты ─────────────────────────
t('контракт: «Сталкер» — три обыска, награда и новый контракт', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 4; P(s, 'p1').level = 2;
  p.contract = { id: 'q_loot', progress: 0 };
  for (let i = 0; i < 3; i++) {
    s.turn = { idx: 0, pid: 'p0', step: 'post', n: 1 };
    assert.equal(A(s, 'p0', { type: 'loot' }).ok, true);
  }
  assert.equal(p.contractsDone, 1);
  assert.notEqual(p.contract.id, 'q_loot'); assert.equal(p.contract.progress, 0);
  assert.equal(p.hand.length, 3); // три карты обыска
  assert.equal(p.gold, 600); // награда — голды в кошелёк
  assert.ok(s.log.some(l => /контракт «Сталкер»/.test(l.text)));
  assert.ok(s.fx.some(f => f.kind === 'contract' && f.pid === 'p0'));
  // свой контракт виден только себе
  assert.ok(view(s, 'p0').players[0].contract.name);
  assert.equal(view(s, 'p1').players[0].contract, undefined);
  assert.equal(view(s, 'p1').players[0].contractsDone, 1);
});

t('контракт: голды в кошелёк, отстающему ещё карта клада', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 1; P(s, 'p1').level = 3; P(s, 'p2').level = 3;
  p.contract = { id: 'q_trouble', progress: 0 };
  s.turn.step = 'post';
  for (let i = s.decks.door.length - 1; i >= 0; i--) if (def(s.decks.door[i]).type === 'monster') s.discard.door.push(...s.decks.door.splice(i, 1));
  s.decks.door.push(take(s, 'm_floorboard#0'));
  p.equipped.push(take(s, 'i_jackhammer#0'));
  assert.equal(A(s, 'p0', { type: 'lookForTrouble' }).ok, true);
  A(s, 'p0', { type: 'fight' }, 1000); tick(s, { rng, now: 9000 });
  assert.equal(p.level, 2); // +1 за монстра
  assert.equal(p.gold, 1000); // награда по контракту
  assert.ok(s.log.some(l => /отстающему/.test(l.text)));
  const w = fresh(); const q = P(w, 'p0'); q.level = 8;
  q.contract = { id: 'q_big', progress: 0 };
  q.equipped.push(take(w, 'i_jackhammer#0'), take(w, 'p_golddragon#0'));
  fight(w, 'm_zhek#0'); // 12 ур.
  A(w, 'p0', { type: 'fight' }, 1000); tick(w, { rng, now: 9000 });
  assert.equal(q.level, 9); assert.equal(q.gold, 1000);
  assert.ok(w.log.some(l => /«Крупная дичь».*1000 голдов/.test(l.text)));
});

// ───────────────────────── обмен ─────────────────────────
t('обмен: предложение, согласие, отказ и устаревшее предложение', () => {
  const s = fresh(); const a = P(s, 'p0'); const b = P(s, 'p1');
  a.equipped.push(take(s, 'i_helmet#0')); a.hand.push(take(s, 'i_boots#0'));
  b.carried.push(take(s, 'i_ladle#0')); b.equipped.push(take(s, 'i_pick#0'));
  assert.match(A(s, 'p0', { type: 'offerTrade', to: 'p1', give: [], want: [] }).error, /Выберите/);
  assert.match(A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_helmet#0'], want: ['i_boots#0'] }).error, /со стола соперника/);
  assert.equal(A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_helmet#0', 'i_boots#0'], want: ['i_ladle#0'] }).ok, true);
  const id = s.trades[0].id;
  assert.equal(view(s, 'p2').trades.length, 0, 'чужие сделки не видны');
  assert.equal(view(s, 'p1').trades.length, 1);
  assert.match(A(s, 'p2', { type: 'answerTrade', id, accept: true }).error, /нет/);
  assert.equal(A(s, 'p1', { type: 'answerTrade', id, accept: true }).ok, true);
  assert.deepEqual(b.carried.sort(), ['i_boots#0', 'i_helmet#0']);
  assert.ok(a.carried.includes('i_ladle#0'));
  assert.equal(s.trades.length, 0);
  // отказ
  A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_ladle#0'], want: ['i_pick#0'] });
  A(s, 'p1', { type: 'answerTrade', id: s.trades[0].id, accept: false });
  assert.ok(a.carried.includes('i_ladle#0')); assert.ok(b.equipped.includes('i_pick#0'));
  // вещь продали — предложение устарело
  A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_ladle#0'], want: ['i_pick#0'] });
  A(s, 'p0', { type: 'discardInPlay', uid: 'i_ladle#0' });
  assert.match(A(s, 'p1', { type: 'answerTrade', id: s.trades[0].id, accept: true }).error, /устарело/);
  // в бою не меняются
  const c = fresh(); P(c, 'p0').equipped.push(take(c, 'i_helmet#0')); fight(c, 'm_roach#0');
  assert.match(A(c, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_helmet#0'], want: [] }).error, /боя/);
});

t('обмен засчитывается в контракт «Купец»', () => {
  const s = fresh(); const a = P(s, 'p0'); const b = P(s, 'p1');
  a.contract = { id: 'q_trade', progress: 0 }; b.contract = { id: 'q_trade', progress: 0 };
  a.carried.push(take(s, 'i_helmet#0'));
  A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_helmet#0'], want: [] });
  A(s, 'p1', { type: 'answerTrade', id: s.trades[0].id, accept: true });
  assert.equal(a.contractsDone, 1); assert.equal(b.contractsDone, 1);
});

// ───────────────────────── боты ─────────────────────────
t('бот играет «Детёныша» на своего монстра, когда не хватает силы', () => {
  const s = fresh(); const p = P(s, 'p0'); p.isBot = true; p.level = 3;
  p.hand.push(take(s, 'e_baby#0'));
  fight(s, 'm_gossip#0'); // 6 против 3
  const a = botDecide(s, 'p0', { rng, now: 1000 });
  assert.deepEqual(a, { type: 'playCard', uid: 'e_baby#0', monster: 0 });
  assert.equal(A(s, 'p0', a).ok, true);
  assert.equal(combatNumbers(s).winning, true);
});

t('мстительный бот проклинает обидчика, а не лидера', () => {
  const s = fresh(); const p = P(s, 'p0'); p.isBot = true; p.persona = 'vengeful';
  P(s, 'p1').level = 6; P(s, 'p2').level = 2;
  s.grudges = { p0: { p2: 2 } };
  p.hand.push(take(s, 'k_flu#0'));
  const a = botDecide(s, 'p0', { rng, now: 1000 });
  assert.equal(a.type, 'playCard'); assert.equal(a.target, 'p2');
  // обычный бот бьёт лидера
  p.persona = null;
  assert.equal(botDecide(s, 'p0', { rng, now: 1000 }).target, 'p1');
});

t('бот принимает выгодный обмен и отклоняет грабительский', () => {
  const s = fresh(); const b = P(s, 'p1'); b.isBot = true; const a = P(s, 'p0');
  b.equipped.push(take(s, 'i_ladle#0')); a.carried.push(take(s, 'i_jackhammer#0'), take(s, 'i_helmet#0'));
  A(s, 'p0', { type: 'offerTrade', to: 'p1', give: ['i_jackhammer#0'], want: ['i_ladle#0'] });
  let d = botDecide(s, 'p1', { rng, now: 1000 });
  assert.equal(d.type, 'answerTrade'); assert.equal(d.accept, true);
  A(s, 'p1', d);
  A(s, 'p0', { type: 'offerTrade', to: 'p1', give: [], want: ['i_jackhammer#0'] });
  d = botDecide(s, 'p1', { rng, now: 1000 });
  assert.equal(d.accept, false);
});

t('бот-призрак мешает тому, кто вот-вот победит', () => {
  const s = fresh(); const f = P(s, 'p0'); const g = P(s, 'p1'); g.isBot = true; g.needsRevive = true;
  f.level = 9;
  fight(s, 'm_roach#0'); // 2 против 9 — не перебить
  assert.equal(botDecide(s, 'p1', { rng, now: 1000 }), null);
  const s2 = fresh(); const f2 = P(s2, 'p0'); const g2 = P(s2, 'p1'); g2.isBot = true; g2.needsRevive = true;
  f2.level = 9; fight(s2, 'm_watchman#0'); // ур. 9 против 9 — ничья, а с +2 монстрам проигрыш
  f2.level = 9; s2.combat.mods.push({ side: 'player', n: 1, by: 'p0', uid: null, label: 'тест' });
  assert.deepEqual(botDecide(s2, 'p1', { rng, now: 1000 }), { type: 'haunt', side: 'monster' });
});

t('бот выкладывает выгодную локацию', () => {
  const s = fresh(); const p = P(s, 'p0'); p.isBot = true;
  p.hand.push(take(s, 'loc_library#0')); // всем героям +2
  s.turn.step = 'post';
  const a = botDecide(s, 'p0', { rng, now: 1000 });
  assert.deepEqual(a, { type: 'playCard', uid: 'loc_library#0' });
});

t('комплекты: легендарный +7 сверху, шахтёрский +3 и побег, подгорного короля против огненных', () => {
  const s = fresh(); const p = P(s, 'p0'); p.level = 3;
  const eq = id => { p.hand.push(take(s, id + '#0')); assert.equal(A(s, 'p0', { type: 'playCard', uid: id + '#0' }).ok, true); };
  eq('i_godarmor'); eq('i_ares'); eq('i_epochboots');
  assert.deepEqual(p.equipped, ['i_godarmor#0', 'i_ares#0', 'i_epochboots#0']);
  assert.deepEqual(view(s, 'p0').players[0].sets, [], 'без Экскалибура комплект не собран');
  assert.equal(view(s, 'p0').players[0].power, 3 + 10 + 7 + 5);
  eq('i_excalibur');
  assert.deepEqual(view(s, 'p0').players[0].sets, ['legend']);
  assert.equal(view(s, 'p0').players[0].power, 3 + 10 + 7 + 5 + 7 + 7);
  assert.equal(def('i_excalibur#0').hands, 2);
  assert.ok(['i_ares', 'i_godarmor', 'i_epochboots', 'i_excalibur'].every(id => def(id).noSteal && def(id).rarity === 'legendary' && def(id).set === 'legend'));
  assert.equal(def('i_epochboots').slot, 'feet');
  // снял одну вещь — комплект распался
  s.turn.step = 'pre';
  A(s, 'p0', { type: 'unequip', uid: 'i_ares#0' });
  assert.deepEqual(view(s, 'p0').players[0].sets, []);
  assert.equal(view(s, 'p0').players[0].power, 3 + 10 + 5 + 7);

  const s2 = fresh(); const q = P(s2, 'p0');
  for (const id of ['i_helmet', 'i_overalls', 'i_pick']) { q.hand.push(take(s2, id + '#0')); A(s2, 'p0', { type: 'playCard', uid: id + '#0' }); }
  const v = view(s2, 'p0').players[0];
  assert.deepEqual(v.sets, ['miner']);
  assert.equal(v.power, 1 + 1 + 2 + 3 + 3);
  assert.equal(v.runBonus, 1);

  const s3 = fresh(); const r = P(s3, 'p0'); r.level = 5;
  for (const id of ['i_kingcrown', 'i_kingmail', 'i_kinghammer']) { r.hand.push(take(s3, id + '#0')); A(s3, 'p0', { type: 'playCard', uid: id + '#0' }); }
  assert.equal(view(s3, 'p0').players[0].power, 5 + 9 + 3);
  s3.decks.door.push(take(s3, 'm_salamander#0'));
  A(s3, 'p0', { type: 'kick' });
  assert.equal(combatNumbers(s3).heroes, 5 + 9 + 3 + 5);
});

t('новые шмотки: противогаз, канарейка, крысиный плащ, спецовка, валенки, турникет, кладенец, ворон', () => {
  const lowDie = () => 0;
  const wear = (s, p, id) => { p.hand.push(take(s, id + '#0')); assert.equal(A(s, p.id, { type: 'playCard', uid: id + '#0' }).ok, true); };
  // противогаз: засада грибного монстра не срабатывает, и расплата его не трогает
  let s = fresh(); let p = P(s, 'p0'); wear(s, p, 'i_gasmask'); p.hand.push(take(s, 'o_kvass#0'));
  s.decks.door.push(take(s, 'm_hypno#0'));
  A(s, 'p0', { type: 'kick' });
  assert.equal(p.hand.length, 1, 'засада не забрала карту');
  act(s, 'p0', { type: 'runAway' }, { rng: lowDie, now: 1000 });
  assert.equal(p.level, 1); assert.ok(p.equipped.includes('i_gasmask#0'));
  // канарейка: засада мимика не срабатывает
  s = fresh(); p = P(s, 'p0'); wear(s, p, 'i_canary'); p.hand.push(take(s, 'o_kvass#0'));
  s.decks.door.push(take(s, 'm_mimic#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(p.hand.length, 1);
  // крысиный плащ: крысы не гонятся
  s = fresh(); p = P(s, 'p0'); p.level = 4; wear(s, p, 'i_ratcloak');
  s.decks.door.push(take(s, 'm_ratunion#0')); A(s, 'p0', { type: 'kick' });
  act(s, 'p0', { type: 'runAway' }, { rng: lowDie, now: 1000 });
  assert.equal(p.level, 4); assert.ok(p.equipped.includes('i_ratcloak#0'));
  // спецовка: огненный монстр −4
  s = fresh(); p = P(s, 'p0'); s.decks.door.push(take(s, 'm_salamander#0')); A(s, 'p0', { type: 'kick' });
  const before = combatNumbers(s).monsters;
  p.equipped.push(take(s, 'i_firesuit#0'));
  assert.equal(combatNumbers(s).monsters, before - 4);
  // валенки: в Ледяной цитадели +3
  s = fresh(); p = P(s, 'p0'); wear(s, p, 'i_valenki');
  const pw = view(s, 'p0').players[0].power;
  p.hand.push(take(s, 'loc_ice#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_ice#0' });
  assert.equal(view(s, 'p0').players[0].power - pw, 3 + (def('loc_ice').heroAll || 0));
  // турникет: «Из темноты вылезло…» не подкинуть
  s = fresh(); p = P(s, 'p0'); p.level = 9; wear(s, p, 'i_turnshield');
  s.decks.door.push(take(s, 'm_mosquito#0')); A(s, 'p0', { type: 'kick' });
  const q = P(s, 'p1'); q.hand.push(take(s, 'w_wandering#0'), take(s, 'm_slime#0'));
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'w_wandering#0', with: 'm_slime#0' }).error, /турникет/);
  // кладенец не помогает против мелочи
  s = fresh(); p = P(s, 'p0'); wear(s, p, 'i_kladenets');
  assert.equal(view(s, 'p0').players[0].power, 1 + 6);
  s.decks.door.push(take(s, 'm_mosquito#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(combatNumbers(s).heroes, 1);
  // ворон: в свой ход видно верхнюю дверь
  s = fresh(); p = P(s, 'p0'); wear(s, p, 'p_raven');
  assert.equal(view(s, 'p0').peek, s.decks.door.at(-1));
  assert.equal(view(s, 'p1').peek, null);
});

t('новые монстры: ржавник, вий, чудо-юдо, поезд-призрак, крысиный король, рой, полуночница, банник', () => {
  const fight = (s, uid) => { s.decks.door.push(take(s, uid)); s.turn.step = 'pre'; s.combat = null; assert.equal(A(s, 'p0', { type: 'kick' }).ok, true); };
  // ржавник: откупиться вещью — бой окончен без наград
  let s = fresh(); let p = P(s, 'p0'); p.equipped.push(take(s, 'i_ladle#0'));
  fight(s, 'm_rusteater#0');
  assert.deepEqual(view(s, 'p0').hints.bribe, ['i_ladle#0']);
  assert.equal(A(s, 'p0', { type: 'bribe', item: 'i_ladle#0' }).ok, true);
  assert.equal(s.combat, null); assert.equal(p.level, 1); assert.equal(p.equipped.length, 0);
  // вий: одному +6, с помощником — нет
  s = fresh(); p = P(s, 'p0'); fight(s, 'm_viy#0');
  assert.equal(combatNumbers(s).monsters, 15 + 6);
  A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 0 }); A(s, 'p1', { type: 'answerHelp', accept: true });
  assert.equal(combatNumbers(s).monsters, 15);
  // чудо-юдо: помощник срубает голову
  s = fresh(); fight(s, 'm_chudo#0');
  assert.equal(combatNumbers(s).monsters, 15);
  A(s, 'p0', { type: 'askHelp', to: 'p1', offer: 0 }); A(s, 'p1', { type: 'answerHelp', accept: true });
  assert.equal(combatNumbers(s).monsters, 10);
  // поезд-призрак: на 5 с бонусами не убежать, на 6 — да; механик его тормозит
  s = fresh(); p = P(s, 'p0'); p.equipped.push(take(s, 'i_runners#0')); fight(s, 'm_ghosttrain#0');
  act(s, 'p0', { type: 'runAway' }, { rng: () => 0.7, now: 1000 }); // выпало 5
  assert.equal(p.level, 1); assert.ok(s.log.some(l => l.text.includes('не убежал от «Поезд-призрак»')));
  s = fresh(); p = P(s, 'p0'); p.classes.push(take(s, 'c_engineer#0')); fight(s, 'm_ghosttrain#0');
  assert.equal(combatNumbers(s).monsters, 12 - 6);
  assert.equal(combatNumbers(s).heroes, 1 + 3, 'механик против механизма +3');
  // крысиный король: +2 за игрока, крысоловка — сдаётся
  s = fresh(4); fight(s, 'm_ratking#0');
  assert.equal(combatNumbers(s).monsters, 4 + 8);
  P(s, 'p0').equipped.push(take(s, 'i_trap#0'));
  assert.equal(combatNumbers(s).monsters, 0);
  // рой: после победы ждёт за следующей дверью слабее, после двух делений рассеивается
  s = fresh(); p = P(s, 'p0'); p.level = 3; p.nextCombat = 10; fight(s, 'm_swarm#0');
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.equal(s.decks.door.at(-1), 'm_swarm#0');
  assert.equal(s.splits['m_swarm#0'], 1);
  s.turn.step = 'pre'; p.nextCombat = 10; A(s, 'p0', { type: 'kick' });
  assert.equal(combatNumbers(s).monsters, 10 - 4);
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  s.turn.step = 'pre'; p.nextCombat = 10; A(s, 'p0', { type: 'kick' });
  assert.equal(combatNumbers(s).monsters, 10 - 8);
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.ok(s.discard.door.includes('m_swarm#0')); assert.equal(s.splits['m_swarm#0'], undefined);
  // полуночница: чётный круг +5, нечётный −3
  s = fresh(); s.round = 2; fight(s, 'm_midnight#0');
  assert.equal(combatNumbers(s).monsters, 9 + 5);
  s.round = 3; assert.equal(combatNumbers(s).monsters, 9 - 3);
  // банник: в таверне сила 0
  s = fresh(); p = P(s, 'p0'); p.hand.push(take(s, 'loc_tavern#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_tavern#0' });
  fight(s, 'm_bannik#0');
  assert.equal(combatNumbers(s).monsters, def('loc_tavern').monsterAll || 0);
});

t('боссы Морена и Чернобог: стужа снимает лучшую вещь у всех, тьма отнимает по карте', () => {
  let s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.level = 9; p.equipped.push(take(s, 'i_jackhammer#0')); q.equipped.push(take(s, 'i_shovel#0'), take(s, 'i_crowbar#0'));
  s.decks.door.push(take(s, 'm_morena#0')); A(s, 'p0', { type: 'kick' });
  assert.deepEqual(p.equipped, []); assert.ok(p.carried.includes('i_jackhammer#0'));
  assert.equal(q.equipped.length, 1);
  s = fresh(); const a = P(s, 'p0'), b = P(s, 'p1'), c = P(s, 'p2');
  a.hand.push(take(s, 'o_kvass#0')); b.hand.push(take(s, 'o_kvass#1')); c.hand.push(take(s, 'o_cola#0'));
  s.decks.door.push(take(s, 'm_chernobog#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(a.hand.length, 1); assert.equal(b.hand.length, 0); assert.equal(c.hand.length, 0);
});

// кубик под контролем: 0.99 — шестёрка, 0 — единица
const dice = (s, pid, a, v) => act(s, pid, a, { rng: () => v, now: 1000 });

t('приручение: зверь, побитый с перевесом 10+, становится питомцем до конца хода', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.level = 5; p.nextCombat = 10; // 15 против крота-бухгалтера (3)
  p.equipped.push(take(s, 'p_hamster#0'));
  s.decks.door.push(take(s, 'm_mole#0')); A(s, 'p0', { type: 'kick' });
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.equal(s.tame?.uid, 'm_mole#0');
  assert.equal(view(s, 'p0').hints.tame, 'm_mole#0');
  assert.equal(A(s, 'p1', { type: 'tame' }).ok, false);
  const before = view(s, 'p0').players[0].power;
  assert.equal(A(s, 'p0', { type: 'tame' }).ok, true);
  assert.equal(p.beast, 'm_mole#0'); assert.equal(s.tame, null);
  assert.ok(p.carried.includes('p_hamster#0')); // хомяк уступил место
  assert.equal(view(s, 'p0').players[0].power, before - 2 + 1);
  assert.match(A(s, 'p0', { type: 'equip', uid: 'p_hamster#0' }).error, /приручённым/);
});

t('приручение: слабая победа или не зверь — нельзя; неприрученный уходит в начале следующего хода', () => {
  let s = fresh(); let p = P(s, 'p0');
  p.level = 5; // 5 против 3: перевес мал
  s.decks.door.push(take(s, 'm_mole#0')); A(s, 'p0', { type: 'kick' });
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.equal(s.tame, null); assert.ok(s.discard.door.includes('m_mole#0'));
  s = fresh(); p = P(s, 'p0'); p.level = 5; p.nextCombat = 10;
  s.decks.door.push(take(s, 'm_mosquito#0')); A(s, 'p0', { type: 'kick' }); // насекомое, не зверь
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.equal(s.tame, null);
  s = fresh(); p = P(s, 'p0'); p.level = 5; p.nextCombat = 10;
  s.decks.door.push(take(s, 'm_duck#0')); A(s, 'p0', { type: 'kick' });
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.equal(s.tame?.uid, 'm_duck#0');
  assert.equal(A(s, 'p0', { type: 'endTurn' }).ok, true);
  assert.equal(s.tame, null); assert.ok(s.discard.door.includes('m_duck#0'));
});

t('приручённый зверь спасает от расплаты, как питомец', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.beast = take(s, 'm_croc#0');
  s.decks.door.push(take(s, 'm_minotaur#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(dice(s, 'p0', { type: 'runAway' }, 0).ok, true);
  assert.equal(p.beast, null); assert.ok(s.discard.door.includes('m_croc#0'));
  assert.equal(p.level, 1);
});

t('спутники: носильщик, проводник, наёмник с платой', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'a_porter#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'a_porter#0' }).ok, true);
  assert.equal(view(s, 'p0').players[0].handLimit, 7);
  p.equipped.push(take(s, 'i_jackhammer#0'));
  p.carried.push(take(s, 'i_trolley#0'));
  assert.equal(A(s, 'p0', { type: 'equip', uid: 'i_trolley#0' }).ok, true); // вторая большая вещь
  // новый спутник прогоняет носильщика — вторая большая вещь снимается
  p.hand.push(take(s, 'a_guide#0'));
  const run0 = view(s, 'p0').players[0].runBonus;
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'a_guide#0' }).ok, true);
  assert.ok(s.discard.treasure.includes('a_porter#0'));
  assert.equal(p.equipped.filter(u => def(u).big).length, 1);
  assert.equal(view(s, 'p0').players[0].runBonus, run0 + 2);
  // наёмник: +3, в начале хода берёт карту ценой от 200, а без платы уходит
  p.hand.push(take(s, 'a_merc#0'));
  const pow = view(s, 'p0').players[0].power;
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'a_merc#0' }).ok, true);
  assert.equal(view(s, 'p0').players[0].power, pow + 3);
  p.hand.push(take(s, 'o_kvass#0'), take(s, 'o_cola#0'));
  s.turn.step = 'charity'; A(s, 'p0', { type: 'endTurn' });
  s.turn.step = 'charity'; A(s, 'p1', { type: 'endTurn' });
  s.turn.step = 'charity'; A(s, 'p2', { type: 'endTurn' });
  assert.equal(s.turn.pid, 'p0');
  assert.deepEqual(p.hand, ['o_kvass#0']); assert.equal(p.ally, 'a_merc#0');
  // есть голды в кошельке — платит из него
  p.gold = 250;
  s.turn.step = 'charity'; A(s, 'p0', { type: 'endTurn' });
  s.turn.step = 'charity'; A(s, 'p1', { type: 'endTurn' });
  s.turn.step = 'charity'; A(s, 'p2', { type: 'endTurn' });
  assert.equal(p.gold, 50); assert.deepEqual(p.hand, ['o_kvass#0']); assert.equal(p.ally, 'a_merc#0');
  for (const u of p.carried) s.discard.treasure.push(u); p.carried = []; // 50 голдов и квас дешевле 200 — платить нечем
  s.turn.step = 'charity'; A(s, 'p0', { type: 'endTurn' });
  s.turn.step = 'charity'; A(s, 'p1', { type: 'endTurn' });
  s.turn.step = 'charity'; A(s, 'p2', { type: 'endTurn' });
  assert.equal(p.ally, null); assert.ok(s.discard.treasure.includes('a_merc#0'));
});

t('плут сманивает чужого спутника на 4+', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.classes.push(take(s, 'c_rogue#0'));
  q.ally = take(s, 'a_guide#0');
  p.hand.push(take(s, 'o_kvass#0'), take(s, 'o_cola#0'));
  assert.deepEqual(view(s, 'p0').hints.abilities.lure, [{ target: 'p1', item: 'a_guide#0' }]);
  assert.equal(dice(s, 'p0', { type: 'ability', name: 'lure', target: 'p1', item: 'a_guide#0', cards: ['o_kvass#0'] }, 0).ok, true);
  assert.equal(q.ally, 'a_guide#0'); assert.equal(p.level, 1);
  assert.equal(dice(s, 'p0', { type: 'ability', name: 'lure', target: 'p1', item: 'a_guide#0', cards: ['o_cola#0'] }, 0.99).ok, true);
  assert.equal(q.ally, null); assert.equal(p.ally, 'a_guide#0');
});

t('ловушка за дверью: обезвредить, сорваться или принять расплату', () => {
  let s = fresh(); let p = P(s, 'p0');
  s.decks.door.push(take(s, 't_pit#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(s.turn.step, 'trap');
  assert.deepEqual(view(s, 'p0').hints.trap, { uid: 't_pit#0', need: 4 });
  assert.equal(A(s, 'p0', { type: 'loot' }).ok, false);
  assert.equal(dice(s, 'p0', { type: 'trap', disarm: true }, 0.99).ok, true);
  assert.ok(p.hand.includes('t_pit#0')); assert.equal(s.turn.step, 'post'); assert.equal(s.trap, null);
  // сорвалась: расплата и ещё уровень
  s = fresh(); p = P(s, 'p0'); p.level = 5;
  s.decks.door.push(take(s, 't_pit#0')); A(s, 'p0', { type: 'kick' });
  dice(s, 'p0', { type: 'trap', disarm: true }, 0);
  assert.equal(p.level, 3); assert.ok(s.discard.door.includes('t_pit#0'));
  // приняли расплату
  s = fresh(); p = P(s, 'p0'); p.level = 5;
  s.decks.door.push(take(s, 't_pit#0')); A(s, 'p0', { type: 'kick' });
  A(s, 'p0', { type: 'trap', disarm: false });
  assert.equal(p.level, 4);
  // механику легче: 2+
  s = fresh(); p = P(s, 'p0'); p.classes.push(take(s, 'c_engineer#0'));
  s.decks.door.push(take(s, 't_net#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(view(s, 'p0').hints.trap.need, 2);
  // противогаз: газовая ловушка не срабатывает и достаётся герою
  s = fresh(); p = P(s, 'p0'); p.equipped.push(take(s, 'i_gasmask#0'));
  s.decks.door.push(take(s, 't_gas#0')); A(s, 'p0', { type: 'kick' });
  assert.equal(s.turn.step, 'post'); assert.ok(p.hand.includes('t_gas#0'));
});

t('ловушку из руки подкладывают сопернику: он бросает кубик сам', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  q.equipped.push(take(s, 'i_boots#0'));
  p.hand.push(take(s, 't_tripwire#0'));
  assert.deepEqual(view(s, 'p0').hints.cards['t_tripwire#0'].map(x => x.target), ['p1', 'p2']);
  assert.equal(dice(s, 'p0', { type: 'playCard', uid: 't_tripwire#0', target: 'p1' }, 0).ok, true);
  assert.deepEqual(q.equipped, []);
  q.equipped.push(take(s, 'i_runners#0'));
  p.hand.push(take(s, 't_rocks#0'));
  dice(s, 'p0', { type: 'playCard', uid: 't_rocks#0', target: 'p1' }, 0.99); // шестёрка — заметил
  assert.deepEqual(q.equipped, ['i_runners#0']);
});

t('смерть: спутник уходит к мародёрам', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.ally = take(s, 'a_porter#0');
  s.decks.door.push(take(s, 'm_dragon#0')); p.level = 6; A(s, 'p0', { type: 'kick' });
  assert.equal(dice(s, 'p0', { type: 'runAway' }, 0).ok, true);
  assert.equal(p.needsRevive, true); assert.equal(p.ally, null);
  assert.ok(['p1', 'p2'].some(id => P(s, id).hand.includes('a_porter#0')));
});

t('боты: приручают сильного зверя, берут спутника, решают с ловушкой', () => {
  let s = fresh(); let p = P(s, 'p0');
  s.tame = { pid: 'p0', uid: take(s, 'm_croc#0') }; s.turn.step = 'charity';
  assert.deepEqual(botDecide(s, 'p0', { rng, now: 1000 }), { type: 'tame' });
  s = fresh(); p = P(s, 'p0'); p.hand.push(take(s, 'a_guide#0')); s.turn.step = 'pre';
  assert.deepEqual(botDecide(s, 'p0', { rng, now: 1000 }), { type: 'playCard', uid: 'a_guide#0' });
  s = fresh(); p = P(s, 'p0'); p.level = 6;
  s.decks.door.push(take(s, 't_pit#0')); A(s, 'p0', { type: 'kick' });
  const a = botDecide(s, 'p0', { rng, now: 1000 });
  assert.equal(a.type, 'trap'); assert.equal(A(s, 'p0', a).ok, true);
});

t('поединок: сила против силы, соседи подкидывают бонусы, проигравший отдаёт лучшую вещь', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1'), r = P(s, 'p2');
  p.level = 3; q.level = 2;
  q.equipped.push(take(s, 'i_pick#0'), take(s, 'i_slippers#0'));
  p.hand.push(take(s, 'd_duel#0'));
  assert.deepEqual(view(s, 'p0').hints.cards['d_duel#0'].map(a => a.target), ['p1', 'p2']);
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'd_duel#0', target: 'p1' }).ok, true);
  assert.ok(s.duel); assert.equal(A(s, 'p0', { type: 'kick' }).ok, false); // пока идёт поединок — ни шагу
  const n0 = view(s, 'p2').duel.numbers;
  assert.equal(n0.from, 3); assert.equal(n0.to, 2 + 3 + 1);
  // третий подкидывает бонус вызвавшему: 3 + 4 = 7 > 6
  r.hand.push(take(s, 'o_firecracker#0'));
  assert.deepEqual(view(s, 'p2').hints.cards['o_firecracker#0'].map(a => a.side), ['from', 'to']);
  assert.equal(A(s, 'p2', { type: 'playCard', uid: 'o_firecracker#0', side: 'from' }, 2000).ok, true);
  assert.equal(s.duel.winAt, 2000 + 5000); // вмешались — отсчёт заново
  assert.equal(tick(s, { rng, now: 3000 }), false);
  assert.equal(tick(s, { rng, now: 8000 }), true);
  assert.equal(s.duel, null);
  assert.ok(p.carried.includes('i_pick#0')); // кирка (+3) — лучшая вещь вызванного
  assert.ok(s.discard.door.includes('d_duel#0')); assert.ok(s.discard.treasure.includes('o_firecracker#0'));
});

t('поединок: равенство — за вызванным; все сказали «не мешаю» — решается сразу', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.level = 3; p.equipped.push(take(s, 'i_slippers#0')); q.level = 3 + (def('i_slippers').bonus || 0);
  p.hand.push(take(s, 'd_duel#0'));
  A(s, 'p0', { type: 'playCard', uid: 'd_duel#0', target: 'p1' });
  assert.equal(view(s, 'p0').duel.numbers.winner, 'p1');
  for (const id of ['p0', 'p1', 'p2']) assert.equal(A(s, id, { type: 'pass' }).ok, true);
  assert.equal(s.duel, null);
  assert.ok(q.carried.includes('i_slippers#0'));
});

t('покупка на рынке — тайна: в летописи её нет, анимацию с картой видит только покупатель', () => {
  const s = fresh(); const p = P(s, 'p0');
  s.decks.door.push(take(s, 'k_tax#0'));
  p.gold = 5000;
  const logLen = s.log.length;
  assert.equal(A(s, 'p0', { type: 'buy', id: 'k_tax' }).ok, true);
  assert.equal(s.log.length, logLen, 'в летопись ничего не добавилось');
  const seen = pid => view(s, pid).fx.filter(f => f.kind === 'buy');
  assert.equal(seen('p0').length, 1); assert.equal(seen('p0')[0].card, 'k_tax#0');
  assert.equal(seen('p1').length, 0); assert.equal(seen(null).length, 0);
  assert.ok(!JSON.stringify(view(s, 'p1')).includes('k_tax#0'));
  assert.equal(view(s, 'p1').turn.boughtLevel, undefined);
});

t('подземный рынок: за голды из кошелька, только то, что ещё в колоде, уровень — один за ход', () => {
  const s = fresh(); const p = P(s, 'p0');
  const toDeck = (...l) => l.forEach(u => s.decks[def(u).deck].push(take(s, u)));
  toDeck('l_stash#0', 'l_bribe#0', 'k_tax#0', 'o_kvass#0', 'o_smoke#0');
  const item = id => view(s, 'p0').shop.items.find(x => x.id === id);
  assert.ok(view(s, 'p0').shop.items.every(x => ['oneshot', 'buff', 'curse', 'levelup', 'duel'].includes(def(x.id).type)));
  assert.equal(item('l_stash').price, 1000); assert.equal(item('l_stash').cat, 'level');
  assert.match(A(s, 'p0', { type: 'buy', id: 'l_stash' }).error, /Нужно 1000/);
  assert.deepEqual(view(s, 'p0').hints.shop, []);
  p.gold = 2500;
  assert.ok(view(s, 'p0').hints.shop.includes('l_stash'));
  assert.equal(A(s, 'p0', { type: 'buy', id: 'l_stash' }).ok, true);
  assert.ok(p.hand.includes('l_stash#0')); assert.equal(p.gold, 1500);
  assert.ok(!s.decks.treasure.includes('l_stash#0'));
  assert.match(A(s, 'p0', { type: 'buy', id: 'l_bribe' }).error, /один за ход/);
  // товар — только из колоды: всё, что в сбросе, не продаётся
  for (const u of ['o_smoke#0', 'o_smoke#1']) { take(s, u); s.discard.treasure.push(u); }
  assert.equal(item('o_smoke').stock, 0);
  assert.match(A(s, 'p0', { type: 'buy', id: 'o_smoke' }).error, /Распродано/);
  // проклятие покупается и насылается
  assert.equal(A(s, 'p0', { type: 'buy', id: 'k_tax' }).ok, true);
  assert.equal(p.gold, 900);
  P(s, 'p1').level = 4;
  const curse = p.hand.find(u => def(u).id === 'k_tax');
  assert.equal(A(s, 'p0', { type: 'playCard', uid: curse, target: 'p1' }).ok, true);
  assert.equal(P(s, 'p1').level, 3);
  // вещи на рынке не продают; в чужой ход и в бою не купить
  assert.match(A(s, 'p0', { type: 'buy', id: 'i_helmet' }).error, /не продают/);
  assert.match(A(s, 'p1', { type: 'buy', id: 'k_flu' }).error, /не ваш ход/);
  // в таверне еда за полцены (но не дешевле цены продажи + 50), уровни дороже
  p.hand.push(take(s, 'loc_tavern#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_tavern#0' });
  assert.equal(item('o_kvass').price, 150); assert.equal(item('l_bribe').price, 1250);
  assert.equal(shopPrice(s, def('o_shawarma#0')), 350); // 600 × 0,5 = 300, но не ниже цены продажи (300) + 50
  assert.match(view(s, 'p0').shop.note, /Трактирщик/);
  // новый ход — снова можно купить уровень
  for (let i = 0; i < 3; i++) { s.turn.step = 'charity'; A(s, s.turn.pid, { type: 'endTurn' }); }
  p.gold = 1300; s.turn.step = 'pre';
  assert.equal(A(s, 'p0', { type: 'buy', id: 'l_bribe' }).ok, true);
  assert.equal(p.gold, 50);
});

t('полурослик вдвое дороже продаёт только вещь, а разовую — по цене', () => {
  const s = fresh(); const p = P(s, 'p0'); p.races.push(take(s, 'r_halfling#0'));
  p.hand.push(take(s, 'o_shawarma#0'));
  assert.equal(saleValue(s, p, ['o_shawarma#0']).total, 300);
  p.carried.push(take(s, 'i_tokens#0'));
  assert.equal(saleValue(s, p, ['o_shawarma#0', 'i_tokens#0']).total, 300 + 800);
  assert.equal(A(s, 'p0', { type: 'sell', uids: ['i_tokens#0'] }).ok, true);
  assert.equal(p.gold, 800);
});

t('чернокнижник: уходит от любого монстра без броска', () => {
  const s = fresh(); const p = P(s, 'p0'); p.classes.push(take(s, 'c_warlock#0')); p.level = 9;
  fight(s, 'm_lucifer#0'); // босс: не одолеть и не убежать — −5 уровней и смерть
  assert.equal(dice(s, 'p0', { type: 'runAway' }, 0).ok, true);
  assert.equal(p.level, 9); assert.equal(p.dead, false);
  assert.ok(s.log.some(l => /уходит тенью/.test(l.text)));
  s.turn.step = 'pre';
  fight(s, 'm_endless#0'); // от него не убежать
  assert.equal(dice(s, 'p0', { type: 'runAway' }, 0).ok, true);
  assert.equal(p.level, 9);
});

t('чернокнижник приручает зверя при перевесе 5', () => {
  const s = fresh(); const p = P(s, 'p0'); p.classes.push(take(s, 'c_warlock#0'));
  p.level = 5; p.nextCombat = 3; // 8 против крота-бухгалтера (3): перевес 5
  fight(s, 'm_mole#0');
  A(s, 'p0', { type: 'fight' }); tick(s, { rng, now: 999999 });
  assert.equal(s.tame?.uid, 'm_mole#0');
  const q = fresh(); const o = P(q, 'p0'); o.level = 5; o.nextCombat = 3; // без класса — мало
  fight(q, 'm_mole#0');
  A(q, 'p0', { type: 'fight' }); tick(q, { rng, now: 999999 });
  assert.equal(q.tame, null);
});

t('чернокнижник подкидывает монстра с руки в чужой и свой бой — раз за бой, без «Из темноты…»', () => {
  const s = fresh(); const w = P(s, 'p1'); w.classes.push(take(s, 'c_warlock#0'));
  w.hand.push(take(s, 'm_mosquito#0'), take(s, 'm_roach#0'));
  P(s, 'p2').hand.push(take(s, 'm_duck#0'));
  P(s, 'p0').level = 6;
  fight(s, 'm_mole#0');
  assert.ok(playOptions(s, 'p1', 'm_mosquito#0').some(a => a.into));
  assert.equal(playOptions(s, 'p2', 'm_duck#0').length, 0, 'не чернокнижнику без карты бродячей твари нельзя');
  assert.equal(A(s, 'p1', { type: 'playCard', uid: 'm_mosquito#0', into: true }).ok, true);
  assert.equal(s.combat.monsters.length, 2);
  assert.match(A(s, 'p1', { type: 'playCard', uid: 'm_roach#0', into: true }).error, /раз за бой/);
  assert.match(A(s, 'p2', { type: 'playCard', uid: 'm_duck#0', into: true }).error, /только чернокнижник/);
  assert.ok(s.log.some(l => /призывает «.*» в чужой бой/.test(l.text)));
  // свой бой: лишний монстр — лишний уровень
  const t2 = fresh(); const v = P(t2, 'p0'); v.classes.push(take(t2, 'c_warlock#0')); v.level = 6;
  v.hand.push(take(t2, 'm_mosquito#0'));
  fight(t2, 'm_mole#0');
  assert.equal(A(t2, 'p0', { type: 'playCard', uid: 'm_mosquito#0', into: true }).ok, true);
  A(t2, 'p0', { type: 'fight' }); tick(t2, { rng, now: 999999 });
  assert.equal(v.level, 8);
  // щит-турникет не пускает и призыв
  const u = fresh(); P(u, 'p0').equipped.push(take(u, 'i_turnshield#0'));
  const x = P(u, 'p1'); x.classes.push(take(u, 'c_warlock#0')); x.hand.push(take(u, 'm_mosquito#0'));
  fight(u, 'm_mole#0');
  assert.match(A(u, 'p1', { type: 'playCard', uid: 'm_mosquito#0', into: true }).error, /турникет/);
});

t('Ящик Пандоры: за 3000 голдов монстрам +10, героям −3 к побегу, раз за бой', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.level = 5; fight(s, 'm_mole#0'); // 5 против 3
  const before = combatNumbers(s).monsters;
  assert.equal(view(s, 'p1').hints.pandora, false);
  assert.match(A(s, 'p1', { type: 'pandora' }).error, /3000/);
  q.gold = 3500;
  assert.equal(view(s, 'p1').hints.pandora, true);
  assert.equal(A(s, 'p1', { type: 'pandora' }).ok, true);
  assert.equal(q.gold, 500);
  assert.equal(combatNumbers(s).monsters, before + 10);
  assert.ok(view(s, 'p0').combat.pandora);
  P(s, 'p2').gold = 5000;
  assert.match(A(s, 'p2', { type: 'pandora' }).error, /уже открыт/);
  assert.match(A(s, 'p0', { type: 'kick' }).error || '', /боя/);
  const t = fresh(); t.players[1].gold = 3000;
  assert.match(A(t, 'p1', { type: 'pandora' }).error, /во время боя/);
});

t('Ящик Пандоры: не убежал — все вещи и питомец разлетаются по другим игрокам', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.equipped.push(take(s, 'i_helmet#0'), take(s, 'p_rat#0')); p.carried.push(take(s, 'i_ladle#0')); p.ally = take(s, 'a_guide#0');
  fight(s, 'm_gossip#0'); // 6 против 1
  q.gold = 3000; A(s, 'p1', { type: 'pandora' });
  // выпало 5: без ящика побег удался бы (5 + 2 от проводника), с ящиком 5 + 2 − 3 = 4 — мимо
  assert.equal(dice(s, 'p0', { type: 'runAway' }, 0.7).ok, true);
  assert.deepEqual(p.equipped, []); assert.deepEqual(p.carried, []);
  assert.equal(p.ally, 'a_guide#0', 'спутник остаётся');
  const others = [P(s, 'p1'), P(s, 'p2')].flatMap(x => [...x.equipped, ...x.carried]);
  for (const u of ['i_helmet#0', 'p_rat#0', 'i_ladle#0']) assert.ok(others.includes(u), u + ' у кого-то из соперников');
  assert.ok(s.log.some(l => /Ящик Пандоры забирает у/.test(l.text)));
  assert.ok(s.fx.some(f => f.kind === 'pandoraLoss' && f.pid === 'p0'));
  // убежал — ничего не теряет
  const u = fresh(); const a = P(u, 'p0'); a.equipped.push(take(u, 'i_helmet#0'), take(u, 'i_runners#0'));
  fight(u, 'm_gossip#0'); P(u, 'p1').gold = 3000; A(u, 'p1', { type: 'pandora' });
  dice(u, 'p0', { type: 'runAway' }, 0.99); // 6 + 2 − 3 = 5
  assert.equal(a.equipped.length, 2);
  // приручённый зверь уходит к новому хозяину
  const w = fresh(); const b = P(w, 'p0'); b.beast = take(w, 'm_mole#0');
  fight(w, 'm_gossip#0'); P(w, 'p1').gold = 3000; A(w, 'p1', { type: 'pandora' });
  dice(w, 'p0', { type: 'runAway' }, 0);
  assert.equal(b.beast, null);
  assert.ok(w.players.some(x => x.beast === 'm_mole#0'));
  // чернокнижник уходит тенью и ничего не теряет
  const z = fresh(); const k = P(z, 'p0'); k.classes.push(take(z, 'c_warlock#0')); k.equipped.push(take(z, 'i_helmet#0'));
  fight(z, 'm_gossip#0'); P(z, 'p1').gold = 3000; A(z, 'p1', { type: 'pandora' });
  dice(z, 'p0', { type: 'runAway' }, 0);
  assert.deepEqual(k.equipped, ['i_helmet#0']);
});

t('«Прощай навсегда»: жертва теряет всё и выбывает, ходы её пропускают, вернуть может только Ящик Пандоры', () => {
  const s = fresh(); const p = P(s, 'p0'), v = P(s, 'p1'), w = P(s, 'p2');
  s.decks.door.push(take(s, 'k_farewell#0'));
  assert.equal(view(s, 'p0').shop.items.find(x => x.id === 'k_farewell').price, 3000);
  p.gold = 3000;
  assert.equal(A(s, 'p0', { type: 'buy', id: 'k_farewell' }).ok, true);
  v.level = 8; v.gold = 700;
  v.equipped.push(take(s, 'i_helmet#0'), take(s, 'p_rat#0')); v.carried.push(take(s, 'i_ladle#0')); v.hand.push(take(s, 'o_kvass#0')); v.ally = take(s, 'a_guide#0');
  v.classes.push(take(s, 'c_bard#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'k_farewell#0', target: 'p1' }).ok, true);
  assert.equal(v.banished, true); assert.equal(v.level, 1);
  assert.deepEqual([v.equipped, v.carried, v.hand], [[], [], []]); assert.equal(v.ally, null);
  assert.equal(v.gold, 700, 'кошелёк остаётся'); assert.equal(v.classes.length, 1, 'класс остаётся');
  assert.equal(view(s, 'p0').players[1].banished, true);
  assert.match(A(s, 'p1', { type: 'autoEquip' }).error, /выбыли/);
  // ход жертвы пропускается
  s.turn.step = 'charity'; A(s, 'p0', { type: 'endTurn' });
  assert.equal(s.turn.pid, 'p2');
  // на выбывшего ничего не насылают
  w.hand.push(take(s, 'k_tax#0'));
  assert.match(A(s, 'p2', { type: 'playCard', uid: 'k_tax#0', target: 'p1' }).error, /мертва/);
  // кто-то открыл Ящик Пандоры в бою — выбывший возвращается с 1-го уровня и стартовыми картами
  s.turn.step = 'pre'; fight(s, 'm_mole#0', 'p2');
  p.gold = 3000; A(s, 'p0', { type: 'pandora' });
  assert.equal(v.banished, false); assert.equal(v.dead, false); assert.equal(v.level, 1);
  assert.equal(v.hand.length, 8);
  assert.ok(s.log.some(l => /из небытия/.test(l.text)));
  assert.doesNotMatch(A(s, 'p1', { type: 'autoEquip' }).error || '', /выбыли/, 'снова в игре');
});

t('«Прощай навсегда»: из двери уходит в руку, на бойца — бой кончается и ход переходит, Куриный бог спасает', () => {
  const s = fresh(); const p = P(s, 'p0');
  s.decks.door.push(take(s, 'k_farewell#0'));
  assert.equal(A(s, 'p0', { type: 'kick' }).ok, true);
  assert.ok(p.hand.includes('k_farewell#0')); assert.ok(!p.banished);
  // соперник в бою и в свой ход
  s.turn = { idx: 1, pid: 'p1', step: 'pre', n: 2 };
  fight(s, 'm_mole#0', 'p1');
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'k_farewell#0', target: 'p1' }).ok, true);
  assert.equal(s.combat, null); assert.equal(s.turn.pid, 'p2');
  // Куриный бог отводит и это проклятие
  const t2 = fresh(); const a = P(t2, 'p0'), b = P(t2, 'p1');
  a.hand.push(take(t2, 'k_farewell#0')); b.hand.push(take(t2, 'o_ward#0'));
  A(t2, 'p0', { type: 'playCard', uid: 'k_farewell#0', target: 'p1' });
  assert.ok(!b.banished);
  // в Кладбище горгулий проклятия дешевле
  const t3 = fresh(); const c = P(t3, 'p0'); t3.decks.door.push(take(t3, 'k_farewell#0'));
  c.hand.push(take(t3, 'loc_graveyard#0')); A(t3, 'p0', { type: 'playCard', uid: 'loc_graveyard#0' });
  assert.equal(view(t3, 'p0').shop.items.find(x => x.id === 'k_farewell').price, 1800);
});

t('«Сокровища Атлантиды» и «Сундук мертвеца»: по +3000 голдов, тайная команда /ATLANTIS — если карта ни у кого не на руке', () => {
  const s = fresh(); const p = P(s, 'p0'), o = P(s, 'p1');
  assert.equal(cheatCard('/ATLANTIS'), 'g_atlantis');
  o.hand.push(take(s, 'g_atlantis#0'));
  assert.match(orderCard(s, 'p0', 'g_atlantis').error, /уже у кого-то/);
  assert.equal(A(s, 'p1', { type: 'playCard', uid: 'g_atlantis#0' }).ok, true, 'открыть можно в любой момент, даже не в свой ход');
  assert.equal(o.gold, 3000);
  o.hand.push(take(s, 'g_deadchest#0'));
  assert.equal(A(s, 'p1', { type: 'playCard', uid: 'g_deadchest#0' }).ok, true);
  assert.equal(o.gold, 6000);
  assert.ok(s.log.some(l => /Сундук мертвеца.*\+3000/.test(l.text)));
  assert.ok(s.discard.treasure.includes('g_atlantis#0'));
  assert.equal(orderCard(s, 'p0', 'g_atlantis').ok, true);
  p.hand.push(take(s, 'h_hoard#0')); A(s, 'p0', { type: 'playCard', uid: 'h_hoard#0' });
  assert.ok(p.hand.includes('g_atlantis#0'));
  assert.equal(A(s, 'p0', { type: 'sell', uids: ['g_atlantis#0'] }).ok, false, 'не продаётся');
});

t('чужой кошелёк скрыт: свои голды видно, чужие — нет; в летописи нет остатков', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.gold = 1200; q.gold = 4500;
  const v = view(s, 'p0');
  assert.equal(v.players.find(x => x.id === 'p0').gold, 1200);
  assert.equal(v.players.find(x => x.id === 'p1').gold, null);
  assert.ok(view(s, null).players.every(x => x.gold === null), 'зрители кошельков не видят');
  q.hand.push(take(s, 'g_deadchest#0'));
  A(s, 'p1', { type: 'playCard', uid: 'g_deadchest#0' });
  assert.ok(!s.log.some(l => /в кошельке/.test(l.text)));
});

t('рынок: «Вызов на поединок» — 700, «Роковая женщина» — 1000, «Ты мой раб» — 1000, раздел «Поединки»', () => {
  const s = fresh();
  const items = view(s, 'p0').shop.items;
  const it = id => items.find(x => x.id === id);
  assert.equal(it('d_duel').price, 700); assert.equal(it('d_duel').cat, 'duel');
  assert.equal(it('d_femme').price, 1000); assert.equal(it('d_femme').cat, 'duel');
  assert.equal(it('o_slave').price, 1000);
  const p = P(s, 'p0'); p.gold = 2000;
  assert.equal(A(s, 'p0', { type: 'buy', id: 'd_femme' }).ok, true);
  assert.ok(p.hand.some(u => u.startsWith('d_femme'))); assert.equal(p.gold, 1000);
});

t('«Роковая женщина»: двое соперников бьются, проигравший теряет большую вещь и 2 уровня; ничья — оба целы', () => {
  const s = fresh(4); const p = P(s, 'p0'), a = P(s, 'p1'), b = P(s, 'p2');
  a.level = 6; b.level = 3;
  b.equipped.push(take(s, 'i_jackhammer#0')); // большая, +5: сила 8 против 6
  b.carried.push(take(s, 'i_diver#0'));        // тоже большая, +3
  p.hand.push(take(s, 'd_femme#0'));
  const opts = view(s, 'p0').hints.cards['d_femme#0'];
  assert.equal(opts.length, 3, 'все пары соперников: из трёх — три пары');
  assert.ok(opts.every(o => o.target !== 'p0' && o.with !== 'p0'));
  assert.match(A(s, 'p0', { type: 'playCard', uid: 'd_femme#0', target: 'p0', with: 'p1' }).error, /двум соперникам/);
  assert.match(A(s, 'p0', { type: 'playCard', uid: 'd_femme#0', target: 'p1', with: 'p1' }).error, /двух соперников/);
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'd_femme#0', target: 'p1', with: 'p2' }).ok, true);
  const d = view(s, 'p3').duel;
  assert.equal(d.femme, true); assert.equal(d.by, 'p0');
  assert.deepEqual([d.numbers.from, d.numbers.to, d.numbers.winner], [6, 8, 'p2']);
  assert.equal(d.prize.from, null, 'у p1 больших вещей нет'); assert.equal(d.prize.to, 'i_jackhammer#0');
  assert.equal(tick(s, { rng, now: 1000 + 6000 }), true);
  assert.equal(s.duel, null);
  assert.equal(a.level, 4, 'проигравший теряет 2 уровня');
  assert.equal(b.level, 3);
  assert.ok(b.equipped.includes('i_jackhammer#0'), 'победитель ничего не теряет');
  assert.ok(s.discard.door.includes('d_femme#0'));
  assert.ok(s.log.some(l => /Роковую женщину|Роковая женщина/.test(l.text)));
  // проигравший с большой вещью: теряет самую ценную большую и 2 уровня
  const t2 = fresh(); const x = P(t2, 'p1'), y = P(t2, 'p2');
  x.level = 2; y.level = 9;
  x.equipped.push(take(t2, 'i_jackhammer#0')); x.carried.push(take(t2, 'i_diver#0'));
  P(t2, 'p0').hand.push(take(t2, 'd_femme#0'));
  A(t2, 'p0', { type: 'playCard', uid: 'd_femme#0', target: 'p1', with: 'p2' });
  tick(t2, { rng, now: 9000 });
  assert.ok(!x.equipped.includes('i_jackhammer#0') && t2.discard.treasure.includes('i_jackhammer#0'), 'отбойный молоток (+5) потерян');
  assert.ok(x.carried.includes('i_diver#0')); assert.equal(x.level, 1, 'не ниже первого уровня');
  // ничья — никто ничего не теряет
  const t3 = fresh(); const m = P(t3, 'p1'), k = P(t3, 'p2');
  m.level = 9; k.level = 4; k.equipped.push(take(t3, 'i_jackhammer#0'));
  P(t3, 'p0').hand.push(take(t3, 'd_femme#0'));
  A(t3, 'p0', { type: 'playCard', uid: 'd_femme#0', target: 'p1', with: 'p2' });
  const n3 = view(t3, 'p0').duel.numbers;
  assert.deepEqual([n3.from, n3.to, n3.winner], [9, 9, null]);
  tick(t3, { rng, now: 9000 });
  assert.equal(m.level, 9); assert.equal(k.level, 4); assert.ok(k.equipped.includes('i_jackhammer#0'));
  assert.ok(t3.log.some(l => /Ничья/.test(l.text)));
});

t('тайные команды с NOW: карта сразу в руку, соперники не видят, что карт стало больше; без NOW — со следующим кладом', () => {
  assert.equal(cheatCardNow('/ARESNOW'), 'i_ares'); assert.equal(cheatCardNow('/2clnow'), 'x_super'); assert.equal(cheatCardNow('/ATLANTISNOW'), 'g_atlantis');
  assert.equal(cheatCardNow('/ARES'), null); assert.equal(cheatCard('/ARESNOW'), null); assert.equal(cheatCard('/ARES'), 'i_ares');
  assert.deepEqual(['/HELP1', '/help2', '/HELP3'].map(cheatCard), ['a_porter', 'a_guide', 'a_merc']);
  assert.deepEqual(['/HELP1NOW', '/help2now', '/HELP3NOW'].map(cheatCardNow), ['a_porter', 'a_guide', 'a_merc']);
  const s = fresh(); const p = P(s, 'p0');
  const seen = (by = 'p1') => view(s, by).players.find(x => x.id === 'p0').handCount;
  const before = seen(), mine = p.hand.length;
  assert.equal(grantCard(s, 'p0', 'i_ares').ok, true);
  assert.ok(p.hand.includes('i_ares#0'));
  assert.equal(seen('p0'), mine + 1, 'сам видит новую карту');
  assert.equal(seen(), before, 'соперник видит прежнее число'); assert.equal(seen(null), before, 'зритель тоже');
  assert.match(grantCard(s, 'p1', 'i_ares').error, /уже у кого-то/);
  assert.equal(grantCard(s, 'p1', 'x_super').ok, true, 'совместитель — всегда');
  // спутник — тоже всегда: даже если он уже у кого-то, появится ещё один
  P(s, 'p2').ally = take(s, 'a_merc#0');
  const gm = grantCard(s, 'p1', 'a_merc');
  assert.equal(gm.ok, true); assert.ok(P(s, 'p1').hand.includes(gm.uid)); assert.notEqual(gm.uid, 'a_merc#0');
  // сыграл тайную карту — для соперников счёт так и не менялся
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'i_ares#0' }).ok, true);
  assert.equal(seen(), before); assert.deepEqual(p.secret, []);
  assert.ok(!s.log.some(l => /тайн|NOW/i.test(l.text)));
  // старая команда без NOW работает по-прежнему: карта придёт со следующим кладом
  assert.equal(orderCard(s, 'p0', 'p_roach').ok, true); assert.ok(!p.hand.some(u => u.startsWith('p_roach')));
});

t('пакостник: 77777 голдов, покупает на рынке и играет от имени игроков; игрокам его не видно', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1'), r = P(s, 'p2');
  assert.equal(trickStart(s, 'c:x').ok, true);
  assert.equal(trickOf(s, 'c:x').gold, 77777);
  assert.ok(!JSON.stringify(view(s, 'p0')).includes('77777') && !JSON.stringify(view(s, null)).includes('tricksters'));
  const cid = SHOP_IDS.find(id => def(id).type === 'curse' && def(id).fx.length === 1 && def(id).fx[0].k === 'levels' && def(id).fx[0].n === 1);
  const b = trickBuy(s, 'c:x', cid);
  assert.equal(b.ok, true); assert.equal(trickOf(s, 'c:x').gold, 77777 - b.price);
  assert.ok(!s.decks.door.includes(b.uid));
  q.level = 5;
  const o = trickOptions(s, 'c:x')[0].opts.find(x => x.a.target === 'p1');
  assert.ok(o.puppets.length && !o.puppets.includes('p1'), 'сама жертва куклой не бывает');
  const pr = trickPlay(s, 'c:x', o.a, null, { rng, now: 1000 });
  assert.equal(pr.ok, true); assert.notEqual(pr.puppet, 'p1');
  assert.equal(q.level, 4);
  assert.ok(s.log.some(l => l.text.includes(P(s, pr.puppet).name) && l.text.includes(def(cid).name)), 'в летописи — от имени игрока');
  assert.deepEqual(trickOf(s, 'c:x').hand, []);
  assert.ok(!P(s, pr.puppet).hand.includes(b.uid));
  // «Получи уровень» от имени выбранного игрока
  const lv = trickBuy(s, 'c:x', 'l_map');
  assert.equal(lv.ok, true);
  const lvl = r.level;
  assert.equal(trickPlay(s, 'c:x', { uid: lv.uid }, 'p2', { rng, now: 1000 }).ok, true);
  assert.equal(r.level, lvl + 1);
  assert.match(trickPlay(s, 'c:x', { uid: lv.uid }, null, { rng, now: 1000 }).error, /нет/);
  assert.match(trickBuy(s, 'c:нет', 'l_map').error, /не включён/);
});

t('тайная команда /GET5000: +5000 голдов', () => {
  assert.equal(cheatGold('/GET5000'), 5000); assert.equal(cheatGold('/get5000'), 5000);
  assert.equal(cheatGold('/GET500'), 0); assert.equal(cheatGold('GET5000'), 0); assert.equal(cheatCard('/GET5000'), null);
});

t('постоянный клиент: после покупок на 5000 — цены −20% и рынок открыт в любой момент, даже в бою; видит только он', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  const price = id => view(s, 'p0').shop.items.find(x => x.id === id).price;
  assert.equal(price('d_femme'), 1000);
  // не в свой ход обычному покупателю нельзя
  q.gold = 9000;
  assert.match(A(s, 'p1', { type: 'buy', id: 'd_duel' }).error, /не ваш ход/);
  p.gold = 9000;
  assert.equal(A(s, 'p0', { type: 'buy', id: 'l_stash' }).ok, true); // уровень — 1000
  assert.match(A(s, 'p0', { type: 'buy', id: 'l_map' }).error, /один за ход/);
  for (const id of ['d_femme', 'd_femme', 'o_slave']) assert.equal(A(s, 'p0', { type: 'buy', id }).ok, true);
  assert.equal(p.spent, 4000); assert.equal(view(s, 'p0').players[0].regular, false);
  assert.equal(A(s, 'p0', { type: 'buy', id: 'd_duel' }).ok, true); // 700 → 4700
  assert.equal(view(s, 'p0').players[0].regular, false);
  assert.equal(A(s, 'p0', { type: 'buy', id: 'd_duel' }).ok, true); // 5400
  const v = view(s, 'p0').players[0];
  assert.equal(v.regular, true); assert.equal(v.spent, 5400);
  assert.equal(view(s, 'p1').players[0].regular, null, 'чужой статус не виден'); assert.equal(view(s, 'p1').players[0].spent, null);
  assert.ok(!s.log.some(l => /постоянн/i.test(l.text)), 'в летописи о статусе ни слова');
  assert.equal(price('o_slave'), 800, '1000 − 20%');
  assert.equal(view(s, 'p1').shop.items.find(x => x.id === 'o_slave').price, 1000, 'остальным — обычная цена');
  // постоянный клиент покупает не в свой ход и в бою
  s.turn = { idx: 1, pid: 'p1', step: 'pre', n: 5 };
  fight(s, 'm_mole#0', 'p1');
  const g0 = p.gold;
  assert.equal(view(s, 'p0').hints.buy, true);
  assert.equal(A(s, 'p0', { type: 'buy', id: 'o_slave' }).ok, true);
  assert.equal(p.gold, g0 - 800);
  assert.equal(A(s, 'p0', { type: 'buy', id: 'l_map' }).ok, true, 'уровень — один за ход: этот ход новый');
  assert.match(A(s, 'p0', { type: 'buy', id: 'l_friend' }).error, /один за ход/);
  assert.match(A(s, 'p1', { type: 'buy', id: 'o_slave' }).error, /не ваш ход|во время боя/i, 'обычный покупатель в бою не покупает');
});

t('голды друг другу передать нельзя', () => {
  const s = fresh(); const q = P(s, 'p1');
  q.gold = 700;
  assert.equal(A(s, 'p1', { type: 'giveGold', to: 'p0', n: 100 }).error, 'Неизвестное действие');
  assert.equal(q.gold, 700); assert.equal(P(s, 'p0').gold, 0);
});

t('спутник носит вещи: места выпадают случайно, бонус идёт герою, ограниченные вещи — только герою', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'a_guide#0'));
  assert.equal(act(s, 'p0', { type: 'playCard', uid: 'a_guide#0' }, { rng: () => 0.1, now: 1000 }).ok, true);
  assert.deepEqual(p.allySlots, ['hand', 'armor']);
  assert.ok(s.log.some(l => /носит оружие и броник/.test(l.text)));
  p.carried.push(take(s, 'i_helmet#0'), take(s, 'i_shovel#0'), take(s, 'i_quilt#0'), take(s, 'i_pick#0'), take(s, 'i_excalibur#0'));
  const before = view(s, 'p0').players[0].power;
  assert.match(A(s, 'p0', { type: 'allyWear', uid: 'i_helmet#0' }).error, /не носит/);
  assert.equal(view(s, 'p0').hints.allyWear['i_shovel#0'], true);
  assert.equal(A(s, 'p0', { type: 'allyWear', uid: 'i_shovel#0' }).ok, true);
  assert.equal(A(s, 'p0', { type: 'allyWear', uid: 'i_quilt#0' }).ok, true);
  assert.deepEqual(p.allyGear, ['i_shovel#0', 'i_quilt#0']);
  assert.equal(view(s, 'p0').players[0].power, before + 2 + 1, 'бонусы вещей спутника — герою');
  assert.deepEqual(view(s, 'p1').players[0].allyGear, ['i_shovel#0', 'i_quilt#0'], 'вещи спутника видят все');
  assert.match(A(s, 'p0', { type: 'allyWear', uid: 'i_pick#0' }).error, /занято/);
  assert.equal(A(s, 'p0', { type: 'allyTake', uid: 'i_shovel#0' }).ok, true);
  assert.ok(p.carried.includes('i_shovel#0'));
  assert.match(A(s, 'p0', { type: 'allyWear', uid: 'i_excalibur#0' }).error, /только сам герой/);
  assert.equal(A(s, 'p0', { type: 'allyWear', uid: 'i_pick#0' }).ok, true, 'двуручное оружие спутнику можно');
  // в бою снаряжение не меняют
  fight(s, 'm_mole#0');
  assert.ok(A(s, 'p0', { type: 'allyTake', uid: 'i_pick#0' }).error);
});

t('спутник с головняком; отпустили или ушёл наёмник — вещи вернулись герою; «все вещи» забирают и вещи спутника', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'a_merc#0'));
  act(s, 'p0', { type: 'playCard', uid: 'a_merc#0' }, { rng: () => 0.9, now: 1000 });
  assert.deepEqual(p.allySlots, ['hand', 'armor', 'head']);
  p.carried.push(take(s, 'i_helmet#0'), take(s, 'i_shovel#0'));
  assert.equal(A(s, 'p0', { type: 'allyWear', uid: 'i_helmet#0' }).ok, true);
  assert.equal(A(s, 'p0', { type: 'discardInPlay', uid: 'a_merc#0' }).ok, true);
  assert.equal(p.ally, null); assert.deepEqual(p.allyGear, []); assert.equal(p.allySlots, null);
  assert.ok(p.carried.includes('i_helmet#0'), 'шлем вернулся герою');
  // новый спутник прогоняет прежнего — вещи прежнего тоже возвращаются
  p.hand.push(take(s, 'a_guide#0'), take(s, 'a_porter#0'));
  act(s, 'p0', { type: 'playCard', uid: 'a_guide#0' }, { rng: () => 0.9, now: 1000 });
  assert.equal(A(s, 'p0', { type: 'allyWear', uid: 'i_shovel#0' }).ok, true);
  act(s, 'p0', { type: 'playCard', uid: 'a_porter#0' }, { rng: () => 0.1, now: 1000 });
  assert.equal(p.ally, 'a_porter#0'); assert.deepEqual(p.allyGear, []); assert.ok(p.carried.includes('i_shovel#0'));
});
t('Конь Плотва: +4, у ведьмака ещё +2, спасает от расплаты', () => {
  const s = fresh(); const p = P(s, 'p0');
  p.hand.push(take(s, 'p_roach#0'));
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'p_roach#0' }).ok, true);
  assert.equal(view(s, 'p0').players[0].power, 1 + 4);
  p.classes.push(take(s, 'c_witcher#0'));
  assert.equal(view(s, 'p0').players[0].power, 1 + 4 + 2 + 3); // +3 — сам ведьмак
  fight(s, 'm_endless#0');
  dice(s, 'p0', { type: 'runAway' }, 0);
  assert.ok(!p.equipped.includes('p_roach#0')); assert.equal(p.level, 1);
});

t('боты: вызывают слабого на поединок и подкидывают бонус, когда проигрывают', () => {
  let s = fresh(); let p = P(s, 'p0'), q = P(s, 'p1');
  p.level = 7; q.level = 1; q.equipped.push(take(s, 'i_pick#0')); // 7 против 4
  P(s, 'p2').level = 8;
  p.hand.push(take(s, 'd_duel#0'));
  assert.deepEqual(botDecide(s, 'p0', { rng, now: 1000 }), { type: 'playCard', uid: 'd_duel#0', target: 'p1' });
  A(s, 'p0', { type: 'playCard', uid: 'd_duel#0', target: 'p1' });
  q.hand.push(take(s, 'o_kvass#0'));
  assert.deepEqual(botDecide(s, 'p1', { rng, now: 1000 }), { type: 'pass' }); // квасу (+2) не перебить 3 — бережёт карту
  q.hand.push(take(s, 'o_shawarma#0'));
  assert.deepEqual(botDecide(s, 'p1', { rng, now: 1000 }), { type: 'playCard', uid: 'o_shawarma#0', side: 'to' });
});

t('«Пересменка» из двери на Поверхности уходит в руку, а в глубине срабатывает', () => {
  let s = fresh(); let [a, b] = s.players;
  s.decks.door.push(take(s, 'ev_shift#0'));
  const bh = [...b.hand];
  assert.equal(A(s, 'p0', { type: 'kick' }).ok, true);
  assert.ok(a.hand.includes('ev_shift#0')); assert.deepEqual(b.hand, bh);
  assert.ok(s.log.at(-1).text.includes('Поверхности'));
  s = fresh(); [a, b] = s.players; s.depth = 2;
  a.hand.push(take(s, 'o_kvass#0'));
  s.decks.door.push(take(s, 'ev_shift#0'));
  assert.equal(A(s, 'p0', { type: 'kick' }).ok, true);
  assert.ok(b.hand.includes('o_kvass#0') && !a.hand.includes('ev_shift#0'));
});

t('события: пересменка, профсоюзное собрание, затопление', () => {
  let s = fresh(); const [a, b, c] = s.players;
  a.hand.push(take(s, 'o_kvass#0')); b.hand.push(take(s, 'o_cola#0'), take(s, 'b_energy#0'));
  a.hand.push(take(s, 'ev_shift#0'));
  // на Поверхности (глубина 0) «Пересменку» не объявить
  assert.match(A(s, 'p0', { type: 'playCard', uid: 'ev_shift#0' }).error, /Поверхност/);
  assert.ok(a.hand.includes('ev_shift#0'));
  s.depth = 1;
  assert.equal(A(s, 'p0', { type: 'playCard', uid: 'ev_shift#0' }).ok, true);
  assert.deepEqual(b.hand, ['o_kvass#0']); assert.deepEqual(c.hand, ['o_cola#0', 'b_energy#0']); assert.deepEqual(a.hand, []);
  s = fresh(); let [x, y, z] = s.players;
  x.level = 5; y.level = 2; z.level = 2;
  x.hand.push(take(s, 'ev_union#0')); A(s, 'p0', { type: 'playCard', uid: 'ev_union#0' });
  assert.equal(x.level, 4);
  s = fresh(); [x, y, z] = s.players;
  x.level = 5; y.level = 5; z.level = 2;
  x.hand.push(take(s, 'ev_union#0')); A(s, 'p0', { type: 'playCard', uid: 'ev_union#0' });
  assert.equal(x.level, 5); assert.equal(y.level, 5);
  s = fresh(); [x, y] = s.players;
  x.equipped.push(take(s, 'i_boots#0')); y.equipped.push(take(s, 'i_slippers#0'));
  x.hand.push(take(s, 'ev_flood#0')); A(s, 'p0', { type: 'playCard', uid: 'ev_flood#0' });
  assert.deepEqual(x.equipped, ['i_boots#0']); assert.deepEqual(y.equipped, []);
});

t('новые локации: затопленная станция, грибная роща, логово Кощея', () => {
  const s = fresh(); const p = P(s, 'p0'), q = P(s, 'p1');
  p.equipped.push(take(s, 'i_boots#0'));
  const pw = view(s, 'p0').players.map(x => x.power), run = view(s, 'p0').players.map(x => x.runBonus);
  p.hand.push(take(s, 'loc_flooded#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_flooded#0' });
  let v = view(s, 'p0').players;
  assert.equal(v[0].power, pw[0] + 2); assert.equal(v[1].power, pw[1]);
  assert.equal(v[0].runBonus, run[0] - 1);
  p.hand.push(take(s, 'loc_grove#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_grove#0' });
  assert.equal(view(s, 'p0').players[0].handLimit, 6);
  p.hand.push(take(s, 'loc_koschei#0')); A(s, 'p0', { type: 'playCard', uid: 'loc_koschei#0' });
  const price = id => view(s, 'p0').shop.items.find(x => x.id === id).price;
  assert.equal(price('l_stash'), 800); assert.equal(price('k_tax'), 400); assert.equal(price('o_rope'), 500); // −20%, −30%, +25%
});

t('быстрая партия до 5-го: по 6 карт каждой колоды на старте', () => {
  const s = createGame([{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }], { winLevel: 5 }, rng);
  assert.equal(s.opts.winLevel, 5);
  for (const p of s.players) assert.equal(p.hand.length, 12);
  assert.ok(view(s, 'a').depth.every > 0);
});

t('испытание дня: одна колода на всех и условие дня', () => {
  const seat = [{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }, { id: 'c', name: 'В' }];
  const dateFor = id => { for (let d = 1; d < 400; d++) { const x = `2027-01-${String(d).padStart(3, '0')}`; if (dailyOf(x).id === id) return x; } throw new Error(id); };
  const mk = (date, seed = 5) => { let a = seed; const r = () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; return createGame(seat, { daily: date }, r); };
  // одна дата — одна колода (при одном и том же генераторе)
  assert.deepEqual(mk('2027-01-001').decks.door, mk('2027-01-001').decks.door);
  assert.equal(mk(dateFor('deep')).depth, 1);
  assert.ok(mk(dateFor('rich')).players.every(p => p.hand.length === 10));
  assert.equal(def(mk(dateFor('loc')).location).type, 'location');
  assert.ok(mk(dateFor('veteran')).players.every(p => p.level === 2));
  const f = mk(dateFor('fair'));
  assert.equal(view(f, 'a').shop.items.find(x => x.id === 'l_stash').price, 750);
  assert.equal(view(f, 'a').shop.fair, true);
  const b = mk(dateFor('beasts'));
  assert.equal(view(b, 'a').opts.dailyId, 'beasts');
  assert.equal(createGame(seat, {}, rng).opts.daily, undefined);
});

console.log(`Правила: ${n} проверок пройдено.`);
