// Сетевой тест: два живых клиента, пароль, бот, переподключение, автопилот, рестарт сервера.
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { def } from '../shared/cards.js';

const PORT = 3900 + Math.floor(Math.random() * 90);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pz-'));
const URL = `http://127.0.0.1:${PORT}`;
let srv;
function startServer(env = {}) {
  srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, DATA_DIR, BOT_DELAY_MS: '30', AFK_MS: '300', ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise(res => srv.stdout.on('data', d => { if (String(d).includes('слушает')) res(); }));
}
const stopServer = () => new Promise(res => { srv.once('exit', res); srv.kill('SIGTERM'); });
const wait = ms => new Promise(r => setTimeout(r, ms));
function client() {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.lastState = null;
  s.on('room:state', st => { s.lastState = st; });
  s.call = (ev, p) => new Promise(r => s.emit(ev, p, r));
  return new Promise(r => s.on('connect', () => r(s)));
}
async function until(fn, ms = 15000, label = '') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return; await wait(50); }
  throw new Error('timeout: ' + label);
}
let n = 0; const ok = m => { n++; console.log('✓', m); };

await startServer();
const A = await client();
const res = await A.call('room:create', { name: 'Тест', password: 'кирка', playerName: 'Аня', maxPlayers: 4 });
assert.ok(res.ok); const code = res.roomId; ok('комната создана: ' + code);
{
  const P = await client();
  assert.equal((await P.call('room:peek', { roomId: code.toLowerCase() })).exists, true);
  const gone = await P.call('room:peek', { roomId: 'NOPE1' });
  assert.equal(gone.exists, false); assert.match(gone.gone, /свежую ссылку/);
  assert.match((await P.call('room:join', { roomId: 'NOPE1', playerName: 'Х' })).error, /перезапускался/);
  P.close();
  ok('старая ссылка: сразу видно, что комнаты больше нет');
}

const B = await client();
let r = await B.call('room:join', { roomId: code, password: 'лопата', playerName: 'Боря' });
assert.equal(r.ok, false); assert.equal(r.error, 'Неверный пароль'); ok('неверный пароль отклонён');
r = await B.call('room:join', { roomId: code.toLowerCase(), password: 'кирка', playerName: 'Боря' });
assert.ok(r.ok); const tokenB = r.token; ok('верный пароль принят (код без учёта регистра)');

const L = await client();
const lst = await L.call('lobby:watch');
const row = lst.rooms.find(x => x.id === code);
assert.equal(row.locked, true); assert.equal(row.players, 2); assert.equal(JSON.stringify(lst).includes('hash'), false);
ok('в списке комнат замок, хэш пароля не утекает');

{
  const C = await client();
  const rc = await C.call('room:create', { name: 'Пустая', playerName: 'Вика', maxPlayers: 3 });
  assert.ok((await C.call('room:addBot')).ok);
  assert.ok((await C.call('room:leave')).ok);
  const after = await L.call('lobby:watch');
  assert.equal(after.rooms.some(x => x.id === rc.roomId), false);
  C.close();
  ok('ушёл последний человек — комната с одними ботами удалена');
  const E = await client();
  const re = await E.call('room:create', { name: 'Брошенная', playerName: 'Ева', maxPlayers: 3 });
  assert.ok((await E.call('room:addBot')).ok);
  assert.ok((await E.call('room:start')).ok);
  assert.ok((await E.call('room:leave')).ok);
  const after2 = await L.call('lobby:watch');
  assert.equal(after2.rooms.some(x => x.id === re.roomId), false);
  E.close();
  ok('последний человек вышел посреди партии — комната не висит в списке');
}
{
  const D = await client();
  const rd = await D.call('room:create', { name: 'Внешность', playerName: 'Даша', avatar: { race: 5, look: 99, gender: '1', evil: '<script>' } });
  await until(() => D.lastState?.room.members.length === 1, 3000, 'avatar room');
  let av = D.lastState.room.members[0].avatar;
  assert.equal(av.race, 5); assert.equal(av.look, 0); assert.equal(av.gender, 1); assert.equal(av.evil, undefined);
  assert.ok((await D.call('me:avatar', { avatar: { ...av, look: 4, frame: 2 } })).ok);
  await until(() => D.lastState.room.members[0].avatar.frame === 2, 3000, 'avatar update');
  assert.equal(D.lastState.room.members[0].avatar.look, 4);
  assert.equal((await D.call('room:settings', { winDelayMs: 5000 })).ok, true);
  assert.equal(D.lastState.room.settings.winDelayMs, 10000);
  await D.call('room:settings', { winDelayMs: 30000 });
  await until(() => D.lastState.room.settings.winDelayMs === 30000, 3000, 'delay 30');
  assert.equal(D.lastState.room.settings.winLevel, 10);
  await D.call('room:settings', { winLevel: 12 });
  assert.equal(D.lastState.room.settings.winLevel, 10);
  await D.call('room:settings', { winLevel: 20 });
  await until(() => D.lastState.room.settings.winLevel === 20, 3000, 'win 20');
  assert.ok((await D.call('room:addBot')).ok);
  await until(() => D.lastState.room.members.length === 2, 3000, 'bot seated');
  const botAv = D.lastState.room.members.find(m => m.isBot).avatar;
  assert.deepEqual(Object.keys(botAv).sort(), ['alt', 'frame', 'gender', 'light', 'look', 'pref', 'race', 'scene']);
  assert.ok((await D.call('room:start')).ok);
  await until(() => D.lastState?.game, 3000, 'game 20');
  assert.equal(D.lastState.game.opts.winLevel, 20);
  await D.call('room:abort'); await D.call('room:leave'); D.close();
  ok('внешность героя сохраняется и чистится, таймер 10/20/30 с, партия до 20 уровня');
}
assert.equal((await B.call('room:start')).error, 'Это может только хозяин комнаты'); ok('стартовать может только хозяин');
assert.ok((await A.call('room:addBot')).ok);
await until(() => A.lastState?.room.members.length === 3, 3000, 'bot added');
ok('бот добавлен');
assert.ok((await A.call('room:start')).ok);
await until(() => A.lastState?.game && B.lastState?.game, 3000, 'game');
const gA = A.lastState.game, idA = A.lastState.room.me, idB = B.lastState.room.me;
assert.ok(Array.isArray(gA.players.find(p => p.id === idA).hand));
assert.equal(gA.players.find(p => p.id === idB).hand, undefined);
assert.equal(gA.players.find(p => p.id === idB).handCount, 8);
ok('партия началась, чужие руки скрыты (у всех по 8 карт)');

// тайная команда: ответ видит только автор, в чат и летопись она не попадает
{
  const chatLen = A.lastState.room.chat.length;
  const rc = await B.call('chat', { text: '/witcher' });
  assert.equal(rc.ok, true); assert.match(rc.note, /Принято/);
  assert.ok((await B.call('chat', { text: 'привет' })).ok);
  await until(() => A.lastState.room.chat.some(m => m.text === 'привет'), 3000, 'chat after cheat');
  assert.equal(A.lastState.room.chat.length, chatLen + 1);
  assert.ok(!A.lastState.room.chat.some(m => /witcher/i.test(m.text)));
  assert.ok(!A.lastState.game.log.some(l => /witcher/i.test(l.text || l)));
  assert.equal(JSON.stringify(A.lastState.game).includes('orders'), false);
  ok('тайная команда: в чате и летописи не видна, отвечает только автору');
}

const C = await client();
r = await C.call('room:join', { roomId: code, password: 'кирка', playerName: 'Вася' });
assert.equal(r.ok, false); assert.match(r.error, /идёт/); ok('во время партии новых не пускают');

// зритель: без пароля не пускают, с паролем видит стол без рук, не ходит, пишет в чат, место не занимает
{
  const V = await client();
  let rv = await V.call('room:watch', { roomId: code, password: 'лопата', name: 'Зоя' });
  assert.equal(rv.ok, false); assert.equal(rv.needPassword, true);
  rv = await V.call('room:watch', { roomId: code.toLowerCase(), password: 'кирка', name: 'Зоя' });
  assert.ok(rv.ok);
  await until(() => V.lastState?.game, 3000, 'watch state');
  assert.equal(V.lastState.room.me, null); assert.equal(V.lastState.room.spectator, true);
  assert.ok(V.lastState.game.players.every(p => p.hand === undefined && p.handCount >= 0));
  assert.equal(V.lastState.game.hints, null);
  await until(() => A.lastState.room.watchers === 1, 3000, 'watchers count');
  const lw = await L.call('lobby:watch');
  assert.equal(lw.rooms.find(x => x.id === code).watchers, 1);
  assert.equal((await V.call('game:act', { type: 'kick' })).ok, false);
  assert.ok((await V.call('chat', { text: 'Удачи!' })).ok);
  await until(() => A.lastState.room.chat.some(m => m.spectator && m.name === 'Зоя' && m.text === 'Удачи!'), 3000, 'spectator chat');
  assert.equal(A.lastState.room.members.length, 3);
  assert.ok((await V.call('room:unwatch')).ok);
  await until(() => A.lastState.room.watchers === 0, 3000, 'unwatch');
  V.close();
  ok('зритель: нужен пароль, видит стол без чужих рук, не ходит, пишет в чат, место не занимает');
}

// чужое действие отклоняется
const turnPid = A.lastState.game.turn.pid;
const notMe = turnPid === idA ? B : A;
const bad = await notMe.call('game:act', { type: 'kick' });
assert.equal(bad.ok, false); ok('нельзя ходить не в свой ход: ' + bad.error);

// переподключение Б по токену
B.disconnect();
await wait(100);
const B2 = await client();
r = await B2.call('room:join', { roomId: code, token: tokenB });
assert.ok(r.ok); assert.equal(r.memberId, idB);
await until(() => B2.lastState?.game, 3000, 'rejoin state');
assert.ok(Array.isArray(B2.lastState.game.players.find(p => p.id === idB).hand)); ok('переподключение по токену возвращает руку');
{
  const goldOf = () => B2.lastState.game.players.find(p => p.id === idB).gold;
  const before = goldOf();
  const r5 = await B2.call('chat', { text: '/GET5000' });
  assert.ok(r5.ok); assert.match(r5.note, /5000/);
  await until(() => goldOf() === before + 5000, 3000, 'gold cheat');
  assert.ok(!B2.lastState.room.chat.some(m => /GET5000/i.test(m.text)));
  assert.equal(A.lastState?.game?.players?.find(p => p.id === idB)?.gold ?? null, null, 'чужой кошелёк не виден');
  ok('тайная команда /GET5000: +5000 в кошелёк, в чате не видно');
}
{
  const mineCount = () => B2.lastState.game.players.find(p => p.id === idB).hand.length;
  const before = mineCount();
  const r6 = await B2.call('chat', { text: '/warlocknow' });
  assert.ok(r6.ok, r6.error); assert.match(r6.note, /в руке/);
  await until(() => mineCount() === before + 1, 3000, 'now cheat');
  assert.ok(B2.lastState.game.players.find(p => p.id === idB).hand.some(u => u.startsWith('c_warlock')));
  assert.ok(!B2.lastState.room.chat.some(m => /warlock/i.test(m.text)));
  ok('тайная команда с NOW: карта сразу в руке, в чате не видно');
}
{
  const before = B2.lastState.room.chat.length;
  for (const text of ['/ARESNOWW', '/привет', '/', '/GET50000', '  /help9now']) {
    const r7 = await B2.call('chat', { text });
    assert.equal(r7.ok, false); assert.match(r7.error, /«\/»/);
  }
  assert.ok((await B2.call('chat', { text: 'обычное сообщение' })).ok);
  await until(() => B2.lastState.room.chat.length === before + 1, 3000, 'plain chat');
  assert.ok(!B2.lastState.room.chat.some(m => m.text?.startsWith('/')));
  ok('текст через «/» в чат не попадает, даже если команды нет');
}

// пакостник: зритель с /IAMGOD покупает карты и играет их от имени игроков; летопись называет игрока
{
  const T = await client();
  T.trick = null; T.on('trick:state', t => { T.trick = t; });
  assert.ok((await T.call('room:watch', { roomId: code, password: 'кирка', name: 'Тень', cid: 'trickster01' })).ok);
  await until(() => T.lastState?.game, 3000, 'trick watch');
  const no = await B2.call('chat', { text: '/IAMGOD' });
  assert.equal(no.ok, false); assert.match(no.error, /зрител/);
  assert.equal((await T.call('trick:buy', { id: 'l_map' })).ok, false, 'без команды не купить');
  const r1 = await T.call('chat', { text: '/iamgod' });
  assert.ok(r1.ok && r1.trick, r1.error);
  await until(() => T.trick?.gold === 77777, 3000, 'trick state');
  const lot = T.lastState.game.shop.items.find(x => x.cat === 'curse' && x.stock > 0);
  const b = await T.call('trick:buy', { id: lot.id });
  assert.ok(b.ok, b.error);
  await until(() => T.trick.hand.includes(b.uid) && T.trick.gold === 77777 - b.price, 3000, 'trick buy');
  const o = await T.call('trick:opts', { uid: b.uid });
  assert.ok(o.ok && o.opts.length, 'есть на кого наслать');
  const opt = o.opts[0];
  assert.ok(!opt.puppets.includes(opt.a.target));
  const pl = await T.call('trick:play', { a: opt.a });
  assert.ok(pl.ok, pl.error);
  await until(() => !T.trick.hand.includes(b.uid), 3000, 'trick played');
  const cardName = def(b.uid).name;
  await until(() => A.lastState.game.log.some(l => l.text.includes(cardName) && l.text.includes(pl.name)), 3000, 'log names the puppet');
  assert.ok(!A.lastState.game.log.some(l => /Тень|IAMGOD/i.test(l.text)));
  assert.ok(!A.lastState.room.chat.some(m => /IAMGOD/i.test(m.text)));
  assert.ok(!JSON.stringify(A.lastState).includes('77777') && !JSON.stringify(A.lastState).includes('trickster'));
  T.close();
  ok('пакостник: /IAMGOD у зрителя, покупка в рукав, карта сыграна от имени игрока');
}

// зритель садится за стол: игроки голосуют, за кого из ботов он сядет
{
  const H1 = await client(), H2 = await client();
  const rc = await H1.call('room:create', { name: 'Места', playerName: 'Хозяин', maxPlayers: 4 });
  assert.ok((await H2.call('room:join', { roomId: rc.roomId, password: '', playerName: 'Гость' })).ok);
  assert.ok((await H1.call('room:addBot')).ok); assert.ok((await H1.call('room:addBot')).ok);
  assert.ok((await H1.call('room:start')).ok);
  await until(() => H1.lastState?.game && H2.lastState?.game, 3000, 'seat game');
  const bots = H1.lastState.room.members.filter(m => m.isBot).map(m => m.id);
  const V = await client();
  V.granted = null; V.on('seat:granted', g => { V.granted = g; });
  assert.ok((await V.call('room:watch', { roomId: rc.roomId, password: '', name: 'Зоя', cid: 'seatwatch01' })).ok);
  await until(() => V.lastState?.room.seats?.open.length === 2 && V.lastState.room.seats.voters === 2, 3000, 'seats info');
  assert.equal((await H1.call('seat:ask')).ok, false, 'игрок за столом не просится');
  const ask = await V.call('seat:ask');
  assert.ok(ask.ok && ask.id, ask.error);
  await until(() => H1.lastState.room.seats?.vote?.canVote && H2.lastState.room.seats?.vote?.name === 'Зоя', 3000, 'vote shown');
  assert.equal((await H1.call('seat:vote', { id: ask.id, seat: H1.lastState.room.me })).ok, false, 'за живого игрока голосовать нельзя');
  assert.ok((await H1.call('seat:vote', { id: ask.id, seat: bots[1] })).ok);
  await until(() => H1.lastState.room.seats.vote?.voted === 1, 3000, 'one vote');
  assert.equal(V.granted, null, 'одного голоса из двух мало');
  assert.ok((await H2.call('seat:vote', { id: ask.id, seat: bots[1] })).ok);
  await until(() => V.granted, 3000, 'granted');
  const j = await V.call('room:join', { roomId: V.granted.roomId, token: V.granted.token });
  assert.ok(j.ok, j.error); assert.equal(j.memberId, bots[1]);
  await until(() => V.lastState.room.me === bots[1] && !V.lastState.room.spectator, 3000, 'seated');
  const meP = V.lastState.game.players.find(x => x.id === bots[1]);
  assert.equal(meP.name, 'Зоя'); assert.ok(Array.isArray(meP.hand), 'рука героя — своя');
  assert.ok(!H1.lastState.room.members.find(m => m.id === bots[1]).isBot);
  assert.ok(H1.lastState.game.log.some(l => l.text.includes('Зоя садится за стол вместо')));
  assert.equal(H1.lastState.room.seats.open.length, 1);
  // «не пускать» большинством
  const V2 = await client();
  V2.result = null; V2.on('seat:result', x => { V2.result = x; });
  await V2.call('room:watch', { roomId: rc.roomId, password: '', name: 'Тим', cid: 'seatwatch02' });
  const ask2 = await V2.call('seat:ask');
  assert.ok(ask2.ok);
  assert.match((await V2.call('seat:ask')).error || 'повтор', /повтор|подождите/);
  await H1.call('seat:vote', { id: ask2.id, seat: 'no' }); await H2.call('seat:vote', { id: ask2.id, seat: 'no' });
  await until(() => V2.result, 3000, 'rejected');
  assert.match(V2.result.reason, /не пускать/);
  // живых игроков нет — зритель выбирает место сам (так возвращаются к своему герою)
  H1.close(); H2.close(); V.close();
  await until(() => V2.lastState.room.seats?.voters === 0, 3000, 'no voters');
  const lastBot = V2.lastState.room.seats.open.find(id => bots.includes(id));
  const choose = await V2.call('seat:ask');
  assert.equal(choose.ok, false); assert.equal(choose.choose, true);
  V2.granted = null; V2.on('seat:granted', g => { V2.granted = g; });
  assert.ok((await V2.call('seat:ask', { seat: lastBot })).ok);
  await until(() => V2.granted?.memberId === lastBot, 3000, 'self seat');
  assert.ok((await V2.call('room:join', { roomId: rc.roomId, token: V2.granted.token })).ok);
  await V2.call('room:abort'); V2.close();
  ok('зритель за столом: голосование за бота, «не пускать», без живых игроков — место на выбор');
}

// сохранение и рестарт сервера
await stopServer();
await startServer({ AFK_MS: '200' });
const A2 = await client(); const B3 = await client();
const tokenA = res.token;
assert.ok((await A2.call('room:join', { roomId: code, token: tokenA })).ok);
assert.ok((await B3.call('room:join', { roomId: code, token: tokenB })).ok);
await until(() => A2.lastState?.game, 3000, 'restored');
ok('после перезапуска сервера партия восстановлена');

// оба уходят — автопилот доигрывает партию
A2.disconnect(); B3.disconnect();
const W = await client();
await W.call('lobby:watch');
let ended = false; W.on('rooms', rs => { if (rs.find(x => x.id === code)?.status === 'ended') ended = true; });
await until(() => ended, 90000, 'autopilot finish');
ok('автопилот довёл партию до победы');

// служебный код из главного меню закрывает все комнаты (в тесте — свой код через ADMIN_CODE)
await stopServer();
await startServer({ ADMIN_CODE: 'zz42zz' });
{
  const H = await client(), H2 = await client(), V = await client(), X = await client();
  const made = await H.call('room:create', { name: 'Закроют', playerName: 'Хозяин' });
  assert.ok(made.ok);
  assert.ok((await H2.call('room:create', { name: 'Тайная', playerName: 'Второй', hidden: true })).ok);
  await V.call('room:watch', { roomId: made.roomId, name: 'Зритель' });
  let kicked = null, watchEnd = null;
  H.on('kicked', e => { kicked = e.reason; }); V.on('watch:end', e => { watchEnd = e.reason; });
  assert.equal((await X.call('room:peek', { roomId: 'ZZ42ZZ' })).closed, undefined, 'без typed код не срабатывает');
  assert.equal((await X.call('room:peek', { roomId: '123456', typed: true })).closed, undefined);
  const before = (await X.call('lobby:watch')).rooms.length; // скрытая комната в список не попадает
  const res2 = await X.call('room:peek', { roomId: 'zz42zz', typed: true });
  assert.equal(res2.closed, before + 1, 'закрыты все комнаты, и скрытые тоже');
  await until(() => kicked && watchEnd, 3000, 'kicked');
  assert.match(kicked, /закрыты/);
  assert.equal((await X.call('lobby:watch')).rooms.length, 0);
  assert.equal((await H.call('room:peek', { roomId: made.roomId })).exists, false);
  H.close(); H2.close(); V.close(); X.close();
  ok('код из меню закрыл все комнаты: игроки и зрители вернулись на главную');
}

await stopServer();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log(`Сеть: ${n} проверок пройдено.`);
process.exit(0);
