// Сетевой тест: два живых клиента, пароль, бот, переподключение, автопилот, рестарт сервера.
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
}
{
  const D = await client();
  const rd = await D.call('room:create', { name: 'Внешность', playerName: 'Даша', avatar: { hair: 5, hat: 99, eyes: '3', evil: '<script>' } });
  await until(() => D.lastState?.room.members.length === 1, 3000, 'avatar room');
  let av = D.lastState.room.members[0].avatar;
  assert.equal(av.hair, 5); assert.equal(av.hat, 0); assert.equal(av.eyes, 3); assert.equal(av.evil, undefined);
  assert.ok((await D.call('me:avatar', { avatar: { ...av, hat: 4, bg: 2 } })).ok);
  await until(() => D.lastState.room.members[0].avatar.hat === 4, 3000, 'avatar update');
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

await stopServer();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log(`Сеть: ${n} проверок пройдено.`);
process.exit(0);
