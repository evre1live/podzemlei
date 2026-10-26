// Прогон тысяч партий одними ботами: проверка инвариантов и зависаний.
import { createGame, act, tick, check } from '../shared/engine.js';
import { botDecide } from '../shared/bot.js';
import { allUids, def } from '../shared/cards.js';

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const TOTAL = allUids('door').length + allUids('treasure').length;

function countCards(s) {
  const all = [...s.decks.door, ...s.decks.treasure, ...s.discard.door, ...s.discard.treasure];
  for (const p of s.players) all.push(...p.hand, ...p.equipped, ...p.carried, ...p.races, ...p.classes, ...[p.halfbreed, p.supermunch, p.ally, p.beast].filter(Boolean));
  if (s.trap) all.push(s.trap.uid);
  if (s.tame) all.push(s.tame.uid);
  if (s.duel) all.push(s.duel.card, ...s.duel.used);
  if (s.market) all.push(...s.market.cards);
  if (s.combat) { for (const m of s.combat.monsters) all.push(m.uid, ...m.enh); all.push(...s.combat.used); }
  if (s.location) all.push(s.location);
  return all;
}

const N = Number(process.argv[2] || 2000);
// журнал партии обрезается, поэтому считаем события по ходу игры
function scan(s) {
  for (const l of s.log) {
    if (l.id <= (s._seen || 0)) continue;
    if (l.text.includes('погибает')) stats.deaths++;
    if (l.text.startsWith('👹')) stats.bossMeet++;
    if (/(Люцифер|Аид|Анубис|Морена|Чернобог)» не стал гнаться/.test(l.text)) stats.bossCalm++;
    if (/удирает от «(Люцифер|Аид|Анубис|Морена|Чернобог)»/.test(l.text)) stats.bossEscaped++;
    if (/побежда(ют|ет) .*«(Люцифер|Аид|Анубис|Морена|Чернобог)»/.test(l.text)) stats.bossKilled++;
    if (/не убежал от «(Люцифер|Аид|Анубис|Морена|Чернобог)»/.test(l.text)) stats.bossCaught++;
    if (l.text.includes(' приручает ')) stats.tamed++;
    if (l.text.includes(' берёт в спутники ')) stats.allies++;
    if (l.text.startsWith('Платить нечем')) stats.mercLeft++;
    if (l.text.includes(' прячет её в карман')) stats.trapsDisarmed++;
    if (l.text.includes(' срабатывает прямо в руках')) stats.trapsFailed++;
    if (l.text.includes(' принимает расплату ')) stats.trapsTaken++;
    if (l.text.includes(' подкладывает ')) stats.trapsPlanted++;
    if (l.text.includes(' сманивает ')) stats.lures++;
    if (l.text.startsWith('⚔ Поединок:')) { stats.duels++; if (l.kind === 'good') stats.duelsWonByChallenger++; }
    if (l.text.startsWith('🛒 Открылся')) stats.markets++;
    if (l.text.includes(' покупает на рынке ')) stats.buys++;
  }
  s._seen = s.logSeq;
}
let ended = 0, stuck = 0, turnsTotal = 0, actions = 0, maxTurns = 0, errs = 0;
const stats = { deaths: 0, wins: {} , help: 0, interfere: 0, steals: 0, bossMeet: 0, bossCalm: 0, bossEscaped: 0, bossKilled: 0, bossCaught: 0,
  tamed: 0, allies: 0, mercLeft: 0, trapsDisarmed: 0, trapsFailed: 0, trapsTaken: 0, trapsPlanted: 0, lures: 0,
  duels: 0, duelsWonByChallenger: 0, markets: 0, buys: 0 };
for (let g = 0; g < N; g++) {
  const rng = mulberry32(g + 1);
  const n = 3 + (g % 4);
  const daily = process.env.DAILY ? `2026-10-${String(1 + (g % 28)).padStart(2, '0')}` : undefined;
  const s = createGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Бот' + i, isBot: true })), { winDelayMs: 3000, winLevel: Number(process.env.WIN || 10), daily }, rng);
  let now = 1000, guard = 0;
  while (s.phase === 'playing' && guard++ < 20000) {
    now += 500;
    let did = false;
    const order = [...s.players].sort((a, b) => (a.id === s.turn.pid ? -1 : 0));
    for (const p of order) {
      const a = botDecide(s, p.id, { rng, now });
      if (!a) continue;
      const r = act(s, p.id, a, { rng, now });
      if (!r.ok) { errs++; if (errs < 15) console.log('ERR', p.id, JSON.stringify(a), r.error, 'step', s.turn.step); continue; }
      actions++; did = true;
      if (a.type === 'answerHelp' && a.accept) stats.help++;
      if (a.name === 'steal') stats.steals++;
      if (s.combat && p.id !== s.combat.fighter && p.id !== s.combat.helper && a.type === 'playCard') stats.interfere++;
      break;
    }
    if (!did) { now += 4000; if (!tick(s, { rng, now })) { stuck++; console.log('STUCK game', g, 'step', s.turn.step, 'combat', !!s.combat, JSON.stringify(s.combat?.helpReq)); break; } }
    scan(s);
    const cnt = countCards(s);
    if (cnt.length !== TOTAL || new Set(cnt).size !== TOTAL) { console.log('CARD LEAK game', g, cnt.length, TOTAL, new Set(cnt).size); process.exit(1); }
    for (const p of s.players) if (p.level < 1 || p.level > s.opts.winLevel) { console.log('BAD LEVEL', p.level); process.exit(1); }
  }
  if (s.phase === 'ended') { ended++; turnsTotal += s.turn.n; maxTurns = Math.max(maxTurns, s.turn.n); }
  scan(s);
}
console.log({ games: N, ended, stuck, errs, avgTurns: (turnsTotal / ended).toFixed(1), maxTurns, actionsPerGame: (actions / N).toFixed(0), ...stats });
if (ended !== N || stuck || errs) process.exit(1);
