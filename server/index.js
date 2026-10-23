// «Под Землёй» — сервер: комнаты с паролем, лобби, чат, игра, переподключение.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createGame, act, tick, view, P } from '../shared/engine.js';
import { botDecide } from '../shared/bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'rooms.json');
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 300);
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS || 1100);
const AFK_MS = Number(process.env.AFK_MS || 45000);
const IDLE_TURN_MS = Number(process.env.IDLE_TURN_MS || 180000);

const rng = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;
const now = () => Date.now();

// ───────────────────────── пароли ─────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, rec) {
  if (!rec) return true;
  const h = crypto.scryptSync(String(pw || ''), rec.salt, 32);
  return crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
}

// ───────────────────────── комнаты ─────────────────────────
const rooms = new Map();
let dirty = false;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(c)); return c; };
const newId = () => crypto.randomBytes(6).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
const BOT_NAMES = ['Кротыч', 'Диггер Петя', 'Шахтёрка Зоя', 'Сталактитыч', 'Гоша из подвала', 'Тётя Вагонетка', 'Дед Фонарь', 'Крыса Лариса'];
const COLORS = ['#e8604c', '#f2b134', '#58b368', '#4aa3df', '#a46ad6', '#e86fb1'];

const cleanName = (n, fb = 'Игрок') => (String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || fb);

function roomSummary(r) {
  return {
    id: r.id, name: r.name, locked: !!r.pass, players: r.members.filter(m => !m.left).length, max: r.maxPlayers,
    status: r.game ? (r.game.phase === 'ended' ? 'ended' : 'playing') : 'lobby',
    host: r.members.find(m => m.id === r.hostId)?.name || '',
  };
}

function lobbyInfo(r, meId) {
  return {
    id: r.id, name: r.name, locked: !!r.pass, hostId: r.hostId, maxPlayers: r.maxPlayers,
    settings: r.settings, status: roomSummary(r).status, me: meId,
    members: r.members.filter(m => !m.left).map((m, i) => ({
      id: m.id, name: m.name, isBot: m.isBot, connected: m.isBot || m.connected, ready: m.ready, color: m.color, avatar: m.avatar,
      autopilot: !!m.autopilot,
    })),
    chat: r.chat.slice(-60),
  };
}

function broadcastRoom(r) {
  dirty = true;
  for (const m of r.members) {
    if (m.isBot || !m.socketId) continue;
    const sock = io.sockets.sockets.get(m.socketId);
    if (!sock) continue;
    sock.emit('room:state', { room: lobbyInfo(r, m.id), game: r.game ? view(r.game, m.id) : null, serverTime: now() });
  }
  pushLobby();
}

let lobbyTimer = null;
function pushLobby() {
  if (lobbyTimer) return;
  lobbyTimer = setTimeout(() => {
    lobbyTimer = null;
    io.to('lobby').emit('rooms', listRooms());
  }, 300);
}
function listRooms() {
  return [...rooms.values()].filter(r => !r.hidden).map(roomSummary).sort((a, b) => (a.status === 'lobby' ? -1 : 1) - (b.status === 'lobby' ? -1 : 1));
}

function sysChat(r, text) {
  r.chat.push({ id: newId(), sys: true, text, t: now() });
  if (r.chat.length > 120) r.chat.splice(0, r.chat.length - 120);
}

function addMember(r, { name, isBot = false }) {
  const used = new Set(r.members.filter(m => !m.left).map(m => m.color));
  const color = COLORS.find(c => !used.has(c)) || COLORS[r.members.length % COLORS.length];
  const usedAv = new Set(r.members.filter(m => !m.left).map(m => m.avatar));
  let avatar = crypto.randomInt(12); for (let i = 0; i < 12 && usedAv.has(avatar); i++) avatar = (avatar + 1) % 12;
  const m = { id: newId(), token: isBot ? null : newToken(), name, isBot, connected: false, socketId: null, ready: isBot, color, avatar, joinedAt: now(), lastSeen: now() };
  r.members.push(m);
  return m;
}

function activeMembers(r) { return r.members.filter(m => !m.left); }

// ───────────────────────── сохранение ─────────────────────────
function save() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = [...rooms.values()].map(r => ({ ...r, members: r.members.map(m => ({ ...m, socketId: null, connected: false })) }));
    fs.writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(data));
    fs.renameSync(SAVE_FILE + '.tmp', SAVE_FILE);
  } catch (e) { console.error('save failed', e.message); }
}
function load() {
  try {
    const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
    for (const r of data) {
      r.members.forEach(m => { m.socketId = null; m.connected = false; m.lastSeen = now(); });
      if (r.game?.combat) r.game.combat.winAt = null;
      rooms.set(r.id, r);
    }
    console.log(`Восстановлено комнат: ${rooms.size}`);
  } catch { /* первый запуск */ }
}

// ───────────────────────── игровой цикл ─────────────────────────
function runRoom(r) {
  const g = r.game;
  if (!g || g.phase !== 'playing') return;
  const t = now();
  // если живых за столом нет, вмешиваться некому — не ждём полный отсчёт
  if (g.combat?.winAt && !r.members.some(m => !m.isBot && m.connected)) g.combat.winAt = Math.min(g.combat.winAt, t + 800);
  let changed = tick(g, { rng, now: t });
  if (!changed && t >= (r.nextBotAt || 0)) {
    // кто может ходить: боты, а также отключившиеся игроки (автопилот)
    const order = [...g.players].sort((a, b) => (a.id === g.turn.pid ? -1 : 0));
    for (const gp of order) {
      const m = r.members.find(x => x.id === gp.id);
      if (!m) continue;
      if (r.turnSeen?.n !== g.turn.n) r.turnSeen = { n: g.turn.n, at: t };
      const sleepy = gp.id === g.turn.pid && t - Math.max(m.lastSeen || 0, r.turnSeen.at) > IDLE_TURN_MS;
      const afk = !m.isBot && (((!m.connected || m.left) && t - (m.lastSeen || 0) > AFK_MS) || sleepy);
      if (!m.isBot && !afk) {
        // живому игроку, который не отвечает на просьбу о помощи 20 с, отвечаем «нет»
        if (g.combat?.helpReq?.to === gp.id && t - (g.combat.helpReq.at || 0) > 20000) {
          act(g, gp.id, { type: 'answerHelp', accept: false }, { rng, now: t });
          changed = true; break;
        }
        continue;
      }
      if (afk !== !!m.autopilot && !m.isBot) { m.autopilot = afk; }
      const a = botDecide(g, gp.id, { rng, now: t });
      if (!a) continue;
      const res = act(g, gp.id, a, { rng, now: t });
      if (res.ok) { changed = true; r.nextBotAt = t + BOT_DELAY_MS; break; }
    }
  }
  if (changed) { r.lastActive = t; broadcastRoom(r); }
}

// ───────────────────────── HTTP ─────────────────────────
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
// Код и стили браузер перепроверяет при каждой загрузке (дёшево: ответ 304 по ETag),
// чтобы после обновления игры ни у кого не смешались старые и новые файлы. Шрифты кэшируются надолго.
const fresh = { etag: true, lastModified: true, setHeaders(res, file) {
  res.setHeader('Cache-Control', /\.(woff2?|ttf)$/.test(file) ? 'public, max-age=2592000, immutable' : 'no-cache');
} };
app.use('/shared', express.static(path.join(ROOT, 'shared'), fresh));
app.use(express.static(path.join(ROOT, 'public'), { ...fresh, extensions: ['html'] }));
app.get('/healthz', (req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 64 * 1024, pingInterval: 20000, pingTimeout: 20000 });

// ───────────────────────── сокеты ─────────────────────────
io.on('connection', socket => {
  socket.data.roomId = null;
  socket.data.memberId = null;
  let bucket = 30, last = now(), badPw = [];
  const limited = () => {
    const t = now(); bucket = Math.min(30, bucket + (t - last) / 100); last = t;
    if (bucket < 1) return true; bucket -= 1; return false;
  };
  const cbOf = cb => (typeof cb === 'function' ? cb : () => {});
  const ctx = () => {
    const r = rooms.get(socket.data.roomId);
    const m = r?.members.find(x => x.id === socket.data.memberId && !x.left);
    return { r, m };
  };

  function attach(r, m) {
    if (socket.data.roomId && socket.data.roomId !== r.id) detach();
    if (m.socketId && m.socketId !== socket.id) io.sockets.sockets.get(m.socketId)?.emit('kicked', { reason: 'Вы открыли игру в другой вкладке' });
    m.socketId = socket.id; m.connected = true; m.lastSeen = now(); m.autopilot = false;
    socket.data.roomId = r.id; socket.data.memberId = m.id;
    socket.leave('lobby');
    socket.join('room:' + r.id);
  }
  function detach() {
    const { r, m } = ctx();
    if (m && m.socketId === socket.id) { m.connected = false; m.socketId = null; m.lastSeen = now(); }
    if (r) { socket.leave('room:' + r.id); broadcastRoom(r); }
    socket.data.roomId = null; socket.data.memberId = null;
  }

  socket.on('lobby:watch', (_, cb) => { socket.join('lobby'); cbOf(cb)({ ok: true, rooms: listRooms() }); });

  socket.on('room:create', (p = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    if (rooms.size >= MAX_ROOMS) return cb({ ok: false, error: 'Сервер переполнен, попробуйте позже' });
    const name = cleanName(p.name, 'Подземелье');
    const pw = String(p.password || '');
    if (pw.length > 64) return cb({ ok: false, error: 'Пароль слишком длинный' });
    const r = {
      id: newCode(), name, pass: pw ? hashPassword(pw) : null, hidden: !!p.hidden, hostId: null,
      maxPlayers: Math.min(6, Math.max(2, Number(p.maxPlayers) || 6)),
      settings: { winDelayMs: [3000, 5000, 8000].includes(Number(p.winDelayMs)) ? Number(p.winDelayMs) : 5000 },
      members: [], chat: [], game: null, createdAt: now(), lastActive: now(),
    };
    const m = addMember(r, { name: cleanName(p.playerName) });
    r.hostId = m.id;
    rooms.set(r.id, r);
    sysChat(r, `${m.name} создаёт комнату.`);
    attach(r, m);
    cb({ ok: true, roomId: r.id, memberId: m.id, token: m.token });
    broadcastRoom(r);
  });

  socket.on('room:join', (p = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    const r = rooms.get(String(p.roomId || '').toUpperCase().trim());
    if (!r) return cb({ ok: false, error: 'Комната не найдена' });
    // переподключение по токену
    if (p.token) {
      const m = r.members.find(x => x.token && x.token === p.token);
      if (m) {
        if (m.left) {
          if (r.game && r.game.phase === 'playing' && !P(r.game, m.id)) return cb({ ok: false, error: 'Игра уже идёт' });
          m.left = false; sysChat(r, `${m.name} возвращается.`);
        }
        attach(r, m);
        cb({ ok: true, roomId: r.id, memberId: m.id, token: m.token });
        return broadcastRoom(r);
      }
    }
    const t = now();
    badPw = badPw.filter(x => t - x < 60000);
    if (badPw.length >= 6) return cb({ ok: false, error: 'Слишком много попыток. Подождите минуту.' });
    if (!checkPassword(p.password, r.pass)) { badPw.push(t); return cb({ ok: false, error: 'Неверный пароль', needPassword: true }); }
    if (r.game && r.game.phase === 'playing') return cb({ ok: false, error: 'Игра уже идёт — дождитесь конца партии' });
    if (activeMembers(r).length >= r.maxPlayers) {
      const bot = activeMembers(r).find(x => x.isBot);
      if (!bot) return cb({ ok: false, error: 'Комната заполнена' });
      bot.left = true; // освобождаем место живому игроку
    }
    const m = addMember(r, { name: cleanName(p.playerName) });
    sysChat(r, `${m.name} заходит в комнату.`);
    attach(r, m);
    cb({ ok: true, roomId: r.id, memberId: m.id, token: m.token });
    broadcastRoom(r);
  });

  socket.on('room:leave', (_, cb) => {
    const { r, m } = ctx();
    if (r && m) {
      if (!r.game || r.game.phase !== 'playing') {
        m.left = true;
        sysChat(r, `${m.name} уходит.`);
        if (r.hostId === m.id) {
          const next = activeMembers(r).find(x => !x.isBot);
          if (next) { r.hostId = next.id; sysChat(r, `Хозяин комнаты теперь ${next.name}.`); }
        }
      } else sysChat(r, `${m.name} выходит из игры — за него ходит автопилот.`);
    }
    detach();
    socket.join('lobby');
    cbOf(cb)({ ok: true });
  });

  const hostOnly = (cb, fn) => {
    cb = cbOf(cb);
    const { r, m } = ctx();
    if (!r || !m) return cb({ ok: false, error: 'Вы не в комнате' });
    if (r.hostId !== m.id) return cb({ ok: false, error: 'Это может только хозяин комнаты' });
    const err = fn(r, m);
    if (err) return cb({ ok: false, error: err });
    cb({ ok: true });
    broadcastRoom(r);
  };

  socket.on('room:addBot', (_, cb) => hostOnly(cb, r => {
    if (r.game && r.game.phase === 'playing') return 'Игра уже идёт';
    if (activeMembers(r).length >= r.maxPlayers) return 'Мест нет';
    const used = new Set(activeMembers(r).map(m => m.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || 'Бот';
    addMember(r, { name, isBot: true });
    sysChat(r, `За стол садится бот ${name}.`);
  }));

  socket.on('room:kick', (p = {}, cb) => hostOnly(cb, (r, me) => {
    const t = r.members.find(x => x.id === p.memberId && !x.left);
    if (!t || t.id === me.id) return 'Некого убирать';
    if (r.game && r.game.phase === 'playing') return 'Во время игры нельзя';
    t.left = true;
    if (t.socketId) io.sockets.sockets.get(t.socketId)?.emit('kicked', { reason: 'Хозяин убрал вас из комнаты' });
    sysChat(r, `${t.name} покидает стол.`);
  }));

  socket.on('room:settings', (p = {}, cb) => hostOnly(cb, r => {
    if (r.game && r.game.phase === 'playing') return 'Во время игры нельзя';
    if (p.maxPlayers) r.maxPlayers = Math.min(6, Math.max(Math.max(2, activeMembers(r).length), Number(p.maxPlayers) || 6));
    if ([3000, 5000, 8000].includes(Number(p.winDelayMs))) r.settings.winDelayMs = Number(p.winDelayMs);
    if (typeof p.password === 'string') {
      if (p.password.length > 64) return 'Пароль слишком длинный';
      r.pass = p.password ? hashPassword(p.password) : null;
      sysChat(r, p.password ? 'Хозяин поменял пароль комнаты.' : 'Хозяин убрал пароль.');
    }
    if (typeof p.name === 'string') r.name = cleanName(p.name, r.name);
  }));

  socket.on('room:start', (_, cb) => hostOnly(cb, r => {
    if (r.game && r.game.phase === 'playing') return 'Игра уже идёт';
    const seats = activeMembers(r);
    if (seats.length < 2) return 'Нужно минимум 2 участника (можно добавить ботов)';
    r.game = createGame(seats.map(m => ({ id: m.id, name: m.name, isBot: m.isBot, color: m.color, avatar: m.avatar })), { winDelayMs: r.settings.winDelayMs }, rng);
    r.game.now = now();
    r.nextBotAt = now() + 1500;
    sysChat(r, 'Партия началась! Удачи под землёй.');
  }));

  socket.on('room:toLobby', (_, cb) => hostOnly(cb, r => {
    if (r.game && r.game.phase === 'playing') return 'Сначала доиграйте партию';
    r.game = null;
    r.members.forEach(m => { if (!m.isBot && !m.connected) m.left = true; });
  }));

  socket.on('room:abort', (_, cb) => hostOnly(cb, r => {
    if (!r.game) return 'Игра не идёт';
    r.game = null;
    sysChat(r, 'Хозяин досрочно завершил партию.');
  }));

  socket.on('chat', (p = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    const { r, m } = ctx();
    if (!r || !m) return cb({ ok: false });
    const text = String(p.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    if (!text) return cb({ ok: false });
    r.chat.push({ id: newId(), from: m.id, name: m.name, color: m.color, text, t: now() });
    if (r.chat.length > 120) r.chat.splice(0, r.chat.length - 120);
    cb({ ok: true });
    broadcastRoom(r);
  });

  socket.on('game:act', (a = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    const { r, m } = ctx();
    if (!r || !m || !r.game) return cb({ ok: false, error: 'Игры нет' });
    m.lastSeen = now(); m.autopilot = false;
    let action;
    try { action = JSON.parse(JSON.stringify(a)); } catch { return cb({ ok: false, error: 'Плохие данные' }); }
    if (!action || typeof action.type !== 'string') return cb({ ok: false, error: 'Плохие данные' });
    try {
      const res = act(r.game, m.id, action, { rng, now: now() });
      cb(res);
      if (res.ok) { r.lastActive = now(); r.nextBotAt = Math.max(r.nextBotAt || 0, now() + 600); broadcastRoom(r); }
    } catch (e) {
      console.error('act error', e);
      cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  socket.on('ping:me', () => { const { m } = ctx(); if (m) m.lastSeen = now(); });

  socket.on('disconnect', () => detach());
});

// ───────────────────────── таймеры ─────────────────────────
setInterval(() => {
  for (const r of rooms.values()) {
    try { runRoom(r); } catch (e) { console.error('room loop error', r.id, e); }
  }
}, 250);

setInterval(() => {
  const t = now();
  for (const r of rooms.values()) {
    const host = r.members.find(m => m.id === r.hostId);
    if (!host || host.left || (!host.connected && t - (host.lastSeen || 0) > 120000)) {
      const next = r.members.find(m => !m.isBot && !m.left && m.connected);
      if (next && next.id !== r.hostId) { r.hostId = next.id; sysChat(r, `Хозяин комнаты теперь ${next.name}.`); broadcastRoom(r); }
    }
    const humansOnline = r.members.some(m => !m.isBot && m.connected);
    if (humansOnline) { r.lastActive = Math.max(r.lastActive, t - 1); continue; }
    const idle = t - (r.lastActive || r.createdAt);
    if (idle > (r.game ? 6 : 1) * 60 * 60 * 1000) { rooms.delete(r.id); dirty = true; pushLobby(); }
  }
  save();
}, 15000);

function shutdown() { dirty = true; save(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

load();
server.listen(PORT, () => console.log(`«Под Землёй» слушает порт ${PORT}`));
