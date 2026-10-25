// «Под Землёй» — сервер: комнаты с паролем, лобби, чат, игра, переподключение.
import express from 'express';
import compression from 'compression';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createGame, act, tick, view, P, WIN_LEVELS, WIN_LEVEL } from '../shared/engine.js';
import { botDecide } from '../shared/bot.js';
import { cleanAvatar, avatarFromSeed } from '../shared/avatar.js';
import { PERSONAS, TRADE_TIMEOUT_MS, dailyDate, dailyOf } from '../shared/cards.js';
const PERSONA_KEYS = Object.keys(PERSONAS);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'rooms.json');
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 300);
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS || 1100);
// Боты ждут, пока у живых игроков доиграет сцена: появление монстра, удар, кубик.
// В быстрых тестах (короткая задержка ботов) паузы не нужны.
const CINE_PAD = Number(process.env.CINE_PAD ?? (BOT_DELAY_MS >= 300 ? 1 : 0));
const CINE_MS = { combat: 1700, wandering: 1300, ambush: 500, victory: 1500, caught: 1100, escaped: 600, dice: 1700, legendary: 2100, curse: 900, death: 900, location: 1200, event: 1100, vanish: 800, helper: 600, pet: 600 };
function cinePad(g, fromId) {
  if (!CINE_PAD) return 0;
  let ms = 0;
  for (const f of g.fx || []) if (f.id > fromId) ms += CINE_MS[f.kind] || 0;
  return Math.min(4200, ms) * CINE_PAD;
}
const AFK_MS = Number(process.env.AFK_MS || 45000);
const IDLE_TURN_MS = Number(process.env.IDLE_TURN_MS || 180000);

const rng = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;
// испытание дня: колода тасуется от даты — в этот день она у всех одна
function seeded(str) {
  let a = 7; for (const ch of String(str)) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
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
// у каждого бота свой портрет и рамка: раса, пол, образ (0 воин … 5 знать), рамка
const BOT_LOOKS = {
  'Кротыч': { race: 6, gender: 0, look: 4, frame: 10 }, 'Диггер Петя': { race: 0, gender: 0, look: 2, frame: 1 },
  'Шахтёрка Зоя': { race: 2, gender: 1, look: 4, frame: 2 }, 'Сталактитыч': { race: 2, gender: 0, look: 1, frame: 9 },
  'Гоша из подвала': { race: 5, gender: 0, look: 4, frame: 7 }, 'Тётя Вагонетка': { race: 3, gender: 1, look: 4, frame: 6 },
  'Дед Фонарь': { race: 6, gender: 0, look: 3, frame: 11 }, 'Крыса Лариса': { race: 5, gender: 1, look: 2, frame: 5 },
};
const COLORS = ['#b5432f', '#c4773a', '#4f8f5c', '#3f7fb0', '#8a5cb0', '#b0587f']; // цвета мест: приглушённые геральдические

const DELAYS = [10000, 20000, 30000];
const cleanDelay = v => (DELAYS.includes(Number(v)) ? Number(v) : DELAYS[0]);
const cleanWin = v => (WIN_LEVELS.includes(Number(v)) ? Number(v) : WIN_LEVEL);
const cleanName = (n, fb = 'Игрок') => (String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || fb);

// ───────────────────────── голосовой чат ─────────────────────────
// Звук идёт напрямую между браузерами (WebRTC), сервер только передаёт приглашения и следит за правами.
// Состояние живёт в памяти: после перезапуска сервера участники просто подключаются заново.
const VOICE_MAX = 10;
const voice = new Map();        // код комнаты → Map(сокет → участник)
const voiceBans = new Map();    // код комнаты → Map(ключ → имя): кого хозяин выгнал из голосового чата
const voiceForced = new Map();  // код комнаты → Set(ключ): кому хозяин выключил микрофон
const bag = (m, id, make) => { let v = m.get(id); if (!v) m.set(id, v = make()); return v; };
// убрать сокет из голосового чата его комнаты и предупредить остальных
function voiceLeave(sock) {
  const id = sock.data.voiceRoom;
  if (!id) return;
  sock.data.voiceRoom = null;
  sock.leave('voice:' + id);
  const vm = voice.get(id);
  if (vm?.delete(sock.id)) {
    io.to('voice:' + id).emit('voice:peer-left', { id: sock.id });
    if (!vm.size) voice.delete(id);
    const r = rooms.get(id);
    if (r) broadcastRoom(r);
  }
}
const watchBans = new Map(); // код комнаты → Set(номер браузера): кого хозяин попросил не смотреть
function voiceInfo(r) {
  const vm = voice.get(r.id);
  return {
    peers: vm ? [...vm.values()].map(p => ({ id: p.id, name: p.name, color: p.color, memberId: p.memberId, spectator: p.spectator, muted: p.muted, forced: p.forced })) : [],
    bans: [...(voiceBans.get(r.id) || new Map())].map(([key, name]) => ({ key, name })),
    max: VOICE_MAX,
  };
}

// зрители — просто сокеты в комнате socket.io «watch:КОД»: место за столом они не занимают
const watchCount = r => io.sockets.adapter.rooms.get('watch:' + r.id)?.size || 0;

function roomSummary(r) {
  return {
    id: r.id, name: r.name, locked: !!r.pass, players: r.members.filter(m => !m.left).length, max: r.maxPlayers, watchers: watchCount(r),
    status: r.game ? (r.game.phase === 'ended' ? 'ended' : 'playing') : 'lobby',
    host: r.members.find(m => m.id === r.hostId)?.name || '',
  };
}

function lobbyInfo(r, meId) {
  return {
    id: r.id, name: r.name, locked: !!r.pass, hostId: r.hostId, maxPlayers: r.maxPlayers,
    settings: r.settings, status: roomSummary(r).status, me: meId, spectator: !meId, watchers: watchCount(r), voice: voiceInfo(r),
    members: r.members.filter(m => !m.left).map((m, i) => ({
      id: m.id, name: m.name, isBot: m.isBot, connected: m.isBot || m.connected, ready: m.ready, color: m.color, avatar: m.avatar,
      autopilot: !!m.autopilot, persona: m.isBot ? m.persona || null : null,
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
  // зрители видят стол, бои и летопись, но ни одной чужой руки
  if (watchCount(r)) io.to('watch:' + r.id).emit('room:state', { room: lobbyInfo(r, null), game: r.game ? view(r.game, null) : null, serverTime: now() });
  pushLobby();
}
// комната закрывается: зрителей вежливо выпроваживаем
function dropRoom(r, reason = 'Комната закрылась') {
  io.to('watch:' + r.id).emit('watch:end', { reason });
  io.in('watch:' + r.id).socketsLeave('watch:' + r.id);
  io.to('voice:' + r.id).emit('voice:kicked', { reason });
  io.in('voice:' + r.id).socketsLeave('voice:' + r.id);
  voice.delete(r.id); voiceBans.delete(r.id); voiceForced.delete(r.id); watchBans.delete(r.id);
  rooms.delete(r.id); dirty = true; pushLobby();
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

function addMember(r, { name, isBot = false, persona = null, avatar: look = null }) {
  const used = new Set(r.members.filter(m => !m.left).map(m => m.color));
  const color = COLORS.find(c => !used.has(c)) || COLORS[r.members.length % COLORS.length];
  // своя внешность, если игрок её собрал; иначе — случайная по номеру
  const avatar = look && typeof look === 'object' ? cleanAvatar(look) : crypto.randomInt(100000);
  const m = { id: newId(), token: isBot ? null : newToken(), name, isBot, connected: false, socketId: null, ready: isBot, color, avatar, joinedAt: now(), lastSeen: now(), ...(isBot && persona ? { persona } : {}) };
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
      // поединок после перезапуска досчитывается заново
      if (r.game?.duel) { r.game.duel.winStart = now(); r.game.duel.winAt = Math.max(r.game.duel.winAt || 0, now() + (r.game.opts?.winDelayMs || 10000)); r.game.duel.passed = []; }
      r.settings = { ...(r.settings || {}), winDelayMs: cleanDelay(r.settings?.winDelayMs), winLevel: cleanWin(r.settings?.winLevel), daily: !!r.settings?.daily };
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
  // Отсчёт «помешать» ждёт только живых соседей. Когда все они нажали «Не мешаю»
  // (или живых за столом нет), бой заканчивается через пару секунд — ботам хватает, чтобы вмешаться.
  const c = g.combat;
  if (c?.winAt) {
    const parts = [c.fighter, c.helper].filter(Boolean);
    const watchers = r.members.filter(m => !m.isBot && !m.left && m.connected && !m.autopilot && !parts.includes(m.id) && P(g, m.id) && !P(g, m.id).dead);
    if (watchers.every(m => (c.passed || []).includes(m.id))) {
      const soon = Math.max(t + 400, (c.winStart || t) + Math.max(600, BOT_DELAY_MS * 2 + 300));
      if (soon < c.winAt) c.winAt = soon;
    }
  }
  const fx0 = g.fx?.at(-1)?.id || 0;
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
        // живому игроку, который 30 с молчит на предложение обмена, отвечаем «нет»
        const late = (g.trades || []).find(o => o.to === gp.id && t - (o.at || 0) > TRADE_TIMEOUT_MS);
        if (late) { act(g, gp.id, { type: 'answerTrade', id: late.id, accept: false }, { rng, now: t }); changed = true; break; }
        // живому игроку, который не отвечает на просьбу о помощи 20 с, отвечаем «нет»
        if (g.combat?.helpReq?.to === gp.id && t - (g.combat.helpReq.at || 0) > 20000) {
          act(g, gp.id, { type: 'answerHelp', accept: false }, { rng, now: t });
          changed = true; break;
        }
        continue;
      }
      if (afk !== !!m.autopilot && !m.isBot) { m.autopilot = afk; }
      // за отошедшего человека автопилот сделок не заключает
      const offer = !m.isBot && (g.trades || []).find(o => o.to === gp.id);
      if (offer) { act(g, gp.id, { type: 'answerTrade', id: offer.id, accept: false }, { rng, now: t }); changed = true; break; }
      const a = botDecide(g, gp.id, { rng, now: t });
      if (!a) continue;
      const res = act(g, gp.id, a, { rng, now: t });
      if (res.ok) { changed = true; r.nextBotAt = t + BOT_DELAY_MS; break; }
    }
  }
  if (changed) {
    const pad = cinePad(g, fx0);
    if (pad) r.nextBotAt = Math.max(r.nextBotAt || 0, t + BOT_DELAY_MS + pad);
    r.lastActive = t; broadcastRoom(r);
  }
}

// ───────────────────────── HTTP ─────────────────────────
const app = express();
app.disable('x-powered-by');
// код, стили и страницы отдаём сжатыми — звуки, картинки и шрифты уже сжаты сами
app.use(compression({ filter: (req, res) => !/\.(mp3|png|webp|jpe?g|woff2?)$/.test(req.path) && compression.filter(req, res) }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
// Код и стили браузер перепроверяет при каждой загрузке (дёшево: ответ 304 по ETag),
// чтобы после обновления игры ни у кого не смешались старые и новые файлы. Шрифты кэшируются надолго.
const fresh = { etag: true, lastModified: true, setHeaders(res, file) {
  // шрифты, звуки, картинки и сторонние библиотеки (в имени — номер версии) кэшируются надолго, остальное перепроверяется
  res.setHeader('Cache-Control', /\.(woff2?|ttf|mp3|webp)$/.test(file) || /[\\/]vendor[\\/]/.test(file) ? 'public, max-age=2592000, immutable' : 'no-cache');
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
    leaveVoice();
    unwatch();
    if (socket.data.roomId && socket.data.roomId !== r.id) detach();
    if (m.socketId && m.socketId !== socket.id) io.sockets.sockets.get(m.socketId)?.emit('kicked', { reason: 'Вы открыли игру в другой вкладке' });
    m.socketId = socket.id; m.connected = true; m.lastSeen = now(); m.autopilot = false;
    socket.data.roomId = r.id; socket.data.memberId = m.id;
    socket.leave('lobby');
    socket.join('room:' + r.id);
  }
  function detach() {
    leaveVoice();
    const { r, m } = ctx();
    if (m && m.socketId === socket.id) { m.connected = false; m.socketId = null; m.lastSeen = now(); }
    if (r) { socket.leave('room:' + r.id); broadcastRoom(r); }
    socket.data.roomId = null; socket.data.memberId = null;
  }

  socket.on('lobby:watch', (_, cb) => { socket.join('lobby'); cbOf(cb)({ ok: true, rooms: listRooms() }); });

  // ───── режим зрителя ─────
  function unwatch() {
    const id = socket.data.watchId;
    if (!id) return;
    leaveVoice();
    socket.leave('watch:' + id);
    socket.data.watchId = null;
    const r = rooms.get(id);
    if (r) broadcastRoom(r);
  }
  socket.on('room:watch', (p = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    const r = rooms.get(String(p.roomId || '').toUpperCase().trim());
    if (!r) return cb({ ok: false, error: 'Комната не найдена' });
    if (ctx().m) return cb({ ok: false, error: 'Сначала выйдите из своей комнаты' });
    const t = now();
    badPw = badPw.filter(x => t - x < 60000);
    if (badPw.length >= 6) return cb({ ok: false, error: 'Слишком много попыток. Подождите минуту.' });
    if (!checkPassword(p.password, r.pass)) { badPw.push(t); return cb({ ok: false, error: 'Неверный пароль', needPassword: true }); }
    if (p.cid && watchBans.get(r.id)?.has(String(p.cid))) return cb({ ok: false, error: 'Хозяин комнаты попросил вас не смотреть эту игру' });
    if (socket.data.watchId !== r.id) unwatch();
    socket.data.watchId = r.id;
    socket.data.watchName = cleanName(p.name, 'Зритель');
    socket.data.cid = /^[a-z0-9]{8,32}$/.test(String(p.cid || '')) ? String(p.cid) : null;
    socket.leave('lobby');
    socket.join('watch:' + r.id);
    cb({ ok: true, roomId: r.id });
    broadcastRoom(r);
  });
  // ───── голосовой чат ─────
  // где сейчас сокет: игрок за столом или зритель; ключ нужен, чтобы запреты хозяина переживали переподключение
  function seat() {
    const { r, m } = ctx();
    if (r && m) return { room: r, m, key: 'm:' + m.id };
    const w = rooms.get(socket.data.watchId);
    return w ? { room: w, m: null, key: 's:' + (socket.data.cid || socket.id) } : {};
  }
  const leaveVoice = () => voiceLeave(socket);
  let sigBucket = 400, sigLast = now();
  socket.on('voice:join', (p = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    const { room, m, key } = seat();
    if (!room) return cb({ ok: false, error: 'Сначала зайдите в комнату' });
    if (voiceBans.get(room.id)?.has(key)) return cb({ ok: false, error: 'Хозяин комнаты не пускает вас в голосовой чат' });
    const vm = bag(voice, room.id, () => new Map());
    if (vm.size >= VOICE_MAX && !vm.has(socket.id)) return cb({ ok: false, error: `В голосовом чате уже ${VOICE_MAX} человек` });
    if (socket.data.voiceRoom && socket.data.voiceRoom !== room.id) leaveVoice();
    const forced = !!voiceForced.get(room.id)?.has(key);
    vm.set(socket.id, { id: socket.id, key, name: m ? m.name : (socket.data.watchName || 'Зритель'), color: m ? m.color : '#a9b2c3', memberId: m?.id || null, spectator: !m, muted: forced || !!p.muted, forced });
    socket.data.voiceRoom = room.id;
    socket.join('voice:' + room.id);
    // новичок сам зовёт тех, кто уже в чате: так у каждой пары ровно один зачинщик
    cb({ ok: true, me: socket.id, peers: [...vm.keys()].filter(id => id !== socket.id), forced });
    broadcastRoom(room);
  });
  socket.on('voice:leave', (_, cb) => { leaveVoice(); cbOf(cb)({ ok: true }); });
  socket.on('voice:signal', (p = {}) => {
    const t = now(); sigBucket = Math.min(400, sigBucket + (t - sigLast) / 25); sigLast = t;
    if (sigBucket < 1) return; sigBucket -= 1;
    const vm = voice.get(socket.data.voiceRoom);
    const to = String(p.to || '');
    if (!vm?.has(socket.id) || !vm.has(to) || !p.data || typeof p.data !== 'object') return;
    io.to(to).emit('voice:signal', { from: socket.id, data: p.data });
  });
  socket.on('voice:mute', (p = {}, cb) => {
    cb = cbOf(cb);
    const vm = voice.get(socket.data.voiceRoom);
    const me = vm?.get(socket.id);
    if (!me) return cb({ ok: false });
    if (me.forced && !p.muted) return cb({ ok: false, error: 'Хозяин комнаты выключил вам микрофон' });
    me.muted = !!p.muted;
    cb({ ok: true });
    const r = rooms.get(socket.data.voiceRoom); if (r) broadcastRoom(r);
  });
  // хозяин: выключить микрофон, вернуть его, выгнать из голосового чата и пустить обратно
  const hostVoice = (cb, fn) => hostOnly(cb, (r, me) => {
    const vm = voice.get(r.id) || new Map();
    return fn(r, me, vm);
  });
  socket.on('voice:force', (p = {}, cb) => hostVoice(cb, (r, me, vm) => {
    const t = vm.get(String(p.id || ''));
    if (!t) return 'Этого участника нет в голосовом чате';
    if (t.memberId === me.id) return 'Свой микрофон выключайте кнопкой у себя';
    const set = bag(voiceForced, r.id, () => new Set());
    if (p.on) { set.add(t.key); t.forced = true; t.muted = true; } else { set.delete(t.key); t.forced = false; }
    io.to(t.id).emit('voice:forced', { on: !!p.on });
    sysChat(r, p.on ? `Хозяин выключил микрофон: ${t.name}.` : `Хозяин вернул микрофон: ${t.name}.`);
  }));
  socket.on('voice:kick', (p = {}, cb) => hostVoice(cb, (r, me, vm) => {
    const t = vm.get(String(p.id || ''));
    if (!t) return 'Этого участника нет в голосовом чате';
    if (t.memberId === me.id) return 'Себя выгнать нельзя';
    bag(voiceBans, r.id, () => new Map()).set(t.key, t.name);
    const sock = io.sockets.sockets.get(t.id);
    vm.delete(t.id);
    if (sock) { sock.leave('voice:' + r.id); sock.data.voiceRoom = null; sock.emit('voice:kicked', { reason: 'Хозяин убрал вас из голосового чата' }); }
    io.to('voice:' + r.id).emit('voice:peer-left', { id: t.id });
    sysChat(r, `Хозяин убрал из голосового чата: ${t.name}.`);
  }));
  socket.on('voice:unban', (p = {}, cb) => hostVoice(cb, r => {
    const bans = voiceBans.get(r.id);
    const name = bans?.get(String(p.key || ''));
    if (!name) return 'Такого запрета нет';
    bans.delete(String(p.key));
    sysChat(r, `Хозяин снова пускает в голосовой чат: ${name}.`);
  }));
  // хозяин может попросить зрителя уйти
  socket.on('room:kickWatcher', (p = {}, cb) => hostOnly(cb, r => {
    const sock = io.sockets.sockets.get(String(p.id || ''));
    if (!sock || sock.data.watchId !== r.id) return 'Этого зрителя уже нет';
    if (sock.data.cid) bag(watchBans, r.id, () => new Set()).add(sock.data.cid);
    voiceLeave(sock);
    sock.leave('watch:' + r.id);
    sock.data.watchId = null;
    sock.join('lobby');
    sock.emit('watch:end', { reason: 'Хозяин комнаты попросил вас уйти' });
    sysChat(r, `Хозяин попросил уйти зрителя ${sock.data.watchName || ''}.`.replace(' .', '.'));
  }));

  socket.on('room:unwatch', (_, cb) => {
    unwatch();
    socket.join('lobby');
    cbOf(cb)({ ok: true, rooms: listRooms() });
  });

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
      settings: { winDelayMs: cleanDelay(p.winDelayMs), winLevel: cleanWin(p.winLevel), daily: false },
      members: [], chat: [], game: null, createdAt: now(), lastActive: now(),
    };
    const m = addMember(r, { name: cleanName(p.playerName), avatar: p.avatar });
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
        m.quit = false;
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
    const m = addMember(r, { name: cleanName(p.playerName), avatar: p.avatar });
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
        // ушёл последний живой человек — комната с одними ботами никому не нужна
        if (!activeMembers(r).some(x => !x.isBot)) dropRoom(r);
      } else {
        m.quit = true;
        sysChat(r, `${m.name} выходит из игры — за него ходит автопилот.`);
        // за столом не осталось ни одного человека — доигрывать партию одним ботам незачем, а в списке она бы висела часами
        if (!r.members.some(x => !x.isBot && !x.left && !x.quit)) dropRoom(r);
      }
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

  // свою внешность можно поменять в любой момент — и в лобби, и посреди партии
  socket.on('me:avatar', (p = {}, cb) => {
    cb = cbOf(cb);
    if (limited()) return cb({ ok: false, error: 'Слишком часто' });
    const { r, m } = ctx();
    if (!r || !m) return cb({ ok: false, error: 'Вы не в комнате' });
    if (!p.avatar || typeof p.avatar !== 'object') return cb({ ok: false, error: 'Плохие данные' });
    m.avatar = cleanAvatar(p.avatar);
    const gp = r.game && P(r.game, m.id);
    if (gp) gp.avatar = m.avatar;
    cb({ ok: true });
    broadcastRoom(r);
  });

  socket.on('room:addBot', (_, cb) => hostOnly(cb, r => {
    if (r.game && r.game.phase === 'playing') return 'Игра уже идёт';
    if (activeMembers(r).length >= r.maxPlayers) return 'Мест нет';
    const used = new Set(activeMembers(r).map(m => m.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || 'Бот';
    // у ботов внешность под стать имени: Зоя и Лариса — женщины, Кротыч и Дед Фонарь — мужчины
    const persona = PERSONA_KEYS[crypto.randomInt(PERSONA_KEYS.length)];
    addMember(r, { name, isBot: true, persona, avatar: cleanAvatar(BOT_LOOKS[name] || avatarFromSeed(crypto.randomInt(100000))) });
    sysChat(r, `За стол садится бот ${name} — характер ${PERSONAS[persona]}.`);
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
    if (DELAYS.includes(Number(p.winDelayMs))) r.settings.winDelayMs = Number(p.winDelayMs);
    if (WIN_LEVELS.includes(Number(p.winLevel)) && Number(p.winLevel) !== r.settings.winLevel) {
      r.settings.winLevel = Number(p.winLevel);
      sysChat(r, `Играем до ${r.settings.winLevel}-го уровня.`);
    }
    if (typeof p.daily === 'boolean' && p.daily !== !!r.settings.daily) {
      r.settings.daily = p.daily;
      sysChat(r, p.daily ? `Играем испытание дня: «${dailyOf(dailyDate()).name}».` : 'Обычная партия, без испытания дня.');
    }
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
    const day = r.settings.daily ? dailyDate() : undefined;
    r.game = createGame(seats.map(m => ({ id: m.id, name: m.name, isBot: m.isBot, persona: m.persona, color: m.color, avatar: m.avatar })), { winDelayMs: r.settings.winDelayMs, winLevel: cleanWin(r.settings.winLevel), daily: day }, day ? seeded(day) : rng);
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
    const { r: own, m } = ctx();
    // зрители тоже могут писать в чат стола — их сообщения помечены
    const r = own && m ? own : rooms.get(socket.data.watchId);
    if (!r) return cb({ ok: false });
    const text = String(p.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    if (!text) return cb({ ok: false });
    if (m && own) r.chat.push({ id: newId(), from: m.id, name: m.name, color: m.color, text, t: now() });
    else r.chat.push({ id: newId(), from: null, spectator: true, name: socket.data.watchName || 'Зритель', color: '#a9b2c3', text, t: now() });
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
      const fx0 = r.game.fx?.at(-1)?.id || 0;
      const res = act(r.game, m.id, action, { rng, now: now() });
      cb(res);
      if (res.ok) { r.lastActive = now(); r.nextBotAt = Math.max(r.nextBotAt || 0, now() + 600 + cinePad(r.game, fx0)); broadcastRoom(r); }
    } catch (e) {
      console.error('act error', e);
      cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  socket.on('ping:me', () => { const { m } = ctx(); if (m) m.lastSeen = now(); });

  socket.on('disconnect', () => { leaveVoice(); detach(); unwatch(); });
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
    if (idle > (r.game ? 6 : 1) * 60 * 60 * 1000) dropRoom(r);
  }
  save();
}, 15000);

function shutdown() { dirty = true; save(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

load();
server.listen(PORT, () => console.log(`«Под Землёй» слушает порт ${PORT}`));
