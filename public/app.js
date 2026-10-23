// «Под Землёй» — клиент.
import { def, RACE_NAMES, CLASS_NAMES } from '/shared/cards.js';
import { esc, cardHTML, chipHTML, avatarSVG, iconSVG, cardBackSVG, locationSVG } from '/art.js';
import { fx } from '/fx.js';
import { sfx } from '/sfx.js';
import { setWorld } from '/world.js';
import { cine } from '/cine.js';
import { AVATAR_PARTS, avatarFromSeed, cleanAvatar } from '/shared/avatar.js';
import { AV_LABELS, SKIN, HAIRC, CLOTH, BGC } from '/art-avatar.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const layer = $('#layer');
const socket = io({ transports: ['websocket', 'polling'] });

const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('pz.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pz.' + k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};

const S = {
  name: LS.get('name', ''),
  avatar: (() => {
    const a = LS.get('avatar', null);
    const v = a && typeof a === 'object' ? cleanAvatar(a) : avatarFromSeed(Math.floor(Math.random() * 100000));
    LS.set('avatar', v);
    return v;
  })(),
  tokens: LS.get('tokens', {}),
  rooms: [],
  room: null, game: null,
  skew: 0,
  screen: null,
  pendingRoom: new URLSearchParams(location.search).get('room')?.toUpperCase() || null,
  ui: { tab: 'log', mode: null, chatSeen: 0, lastFx: null, lastReveal: 0, sideOpen: false, helpAsked: null, overlay: null, dieQueue: [], dieBusy: false, prevHand: null, slam: null, lastLoc: undefined },
};

// ───────────────────────── утилиты ─────────────────────────
function toast(text, ok = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (ok ? ' ok' : '');
  if (!ok) sfx.play('error');
  el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}
const call = (ev, p) => new Promise(res => socket.emit(ev, p, r => res(r || { ok: false, error: 'Нет ответа от сервера' })));
async function act(a) {
  const r = await call('game:act', a);
  if (!r.ok) toast(r.error || 'Не получилось');
  return r;
}
const me = () => S.game?.players.find(p => p.id === S.room?.me);
const pl = id => S.game?.players.find(p => p.id === id);
const pname = id => pl(id)?.name || S.room?.members.find(m => m.id === id)?.name || '—';
const hints = () => S.game?.hints || {};
const serverNow = () => Date.now() + S.skew;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const cardsWord = n => `${n} ${plural(n, 'карту', 'карты', 'карт')}`;
const cardsNom = n => `${n} ${plural(n, 'карта', 'карты', 'карт')}`;

function raceText(p) {
  const r = p.races.map(u => def(u).name);
  return r.length ? r.join(' и ') : 'Человек';
}
function classText(p) {
  const c = p.classes.map(u => def(u).name);
  return c.length ? c.join(' и ') : 'без класса';
}
function saveToken(roomId, token) { S.tokens[roomId] = token; LS.set('tokens', S.tokens); }
function dropToken(roomId) { delete S.tokens[roomId]; LS.set('tokens', S.tokens); }
function setUrl(code) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('room', code); else u.searchParams.delete('room');
  history.replaceState(null, '', u);
}
const inviteLink = () => `${location.origin}/?room=${S.room?.id}`;

// ───────────────────────── связь ─────────────────────────
socket.on('connect', async () => {
  const code = S.room?.id || S.pendingRoom;
  if (code && S.tokens[code]) {
    const r = await call('room:join', { roomId: code, token: S.tokens[code] });
    if (r.ok) { S.pendingRoom = null; return; }
    dropToken(code);
    if (S.room) { S.room = null; S.game = null; render(); toast(r.error); }
  }
  const lst = await call('lobby:watch');
  if (lst.ok) { S.rooms = lst.rooms; if (S.screen === 'home') renderRooms(); }
  if (S.pendingRoom && !S.room) openJoinModal(S.pendingRoom);
});
socket.on('disconnect', () => { if (S.room) toast('Связь потеряна. Переподключаемся…'); });
socket.on('rooms', list => { S.rooms = list; if (S.screen === 'home') renderRooms(); });
socket.on('kicked', ({ reason }) => {
  if (S.room) dropToken(S.room.id);
  S.room = null; S.game = null; setUrl(null);
  toast(reason || 'Вы вышли из комнаты');
  closeOverlay(); render();
});
socket.on('room:state', ({ room, game, serverTime }) => {
  const first = !S.room || S.room.id !== room.id;
  // копия панели боя до перерисовки: на ней доиграет развязка, если бой сейчас закончится
  const snap = !first && S.game?.combat && cine.on ? cine.snapStage() : null;
  if (serverTime) S.skew = serverTime - Date.now();
  S.room = room; S.game = game;
  if (first) { setUrl(room.id); S.ui.lastFx = null; S.ui.mode = null; S.ui.prevHand = new Set(); }
  // звук: начало моего хода и чужие сообщения в чате
  const tk = game?.phase === 'playing' ? `${game.turn.n}:${game.turn.pid}` : '';
  if (!first && tk && tk !== S.ui.turnKey && game.turn.pid === room.me) { sfx.play('yourTurn', { always: true, delay: 0.25 }); cine.turn(); }
  S.ui.turnKey = tk;
  const lastMsg = room.chat.at(-1);
  if (!first && lastMsg && lastMsg.id !== S.ui.lastMsg && !lastMsg.sys && lastMsg.from !== room.me) sfx.play('pop', { always: true });
  S.ui.lastMsg = lastMsg?.id;
  const fresh = handleFx(first);
  render();
  if (fresh.length) requestAnimationFrame(() => runFx(fresh, snap));
});

// ───────────────────────── маршрутизация экранов ─────────────────────────
function render() {
  const scr = !S.room ? 'home' : S.game ? 'game' : 'lobby';
  if (scr !== S.screen) { S.screen = scr; mount[scr](); soundIcons(); }
  setWorld($('#world'), scr === 'home' ? null : scr === 'game' && S.game.location ? def(S.game.location).art : 'default');
  update[scr]();
}
const mount = {}, update = {};

// ───────────────────────── главная ─────────────────────────
const HATCH = `<svg class="hatch" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="34" rx="28" ry="14" fill="#3b3540" stroke="#231a26" stroke-width="3"/><ellipse cx="32" cy="32" rx="22" ry="10" fill="#57505e" stroke="#231a26" stroke-width="2.5"/><path d="M14 32 h36 M20 26 l24 12 M44 26 l-24 12" stroke="#231a26" stroke-width="2"/></svg>`;

mount.home = () => {
  app.innerHTML = `
  <div class="home">
    <header class="band b-surface"><div class="grassline"></div>
      <div class="home-top"><div class="logo-row">${HATCH}<span class="spacer"></span><button class="btn ghost small" data-act="rules">Как играть</button></div></div>
    </header>
    <section class="band b-clay pebbles title-wrap">
      <h1 class="title">Под Землёй</h1>
      <p class="subtitle">Карточная игра для компании от двух до шести человек. Выбивайте двери, побеждайте монстров из подвалов и тоннелей, собирайте клад и не стесняйтесь подставлять друзей. Кто первым дойдёт до 10-го уровня, тот и победил.</p>
    </section>
    <section class="band b-rock home-main">
      <div class="panel">
        <h2>Новая комната</h2>
        <form class="form" id="createForm" autocomplete="off">
          <div class="hero-row"><button type="button" class="hero-ava" id="homeAva" data-act="avatar" aria-label="Настроить внешность героя">${avatarSVG(S.avatar, '#f5b83d')}</button>
            <div><div class="muted" style="font-size:14px;margin-bottom:6px">Ваш герой</div><button type="button" class="btn small" data-act="avatar">Настроить внешность</button></div></div>
          <label>Ваше имя<input type="text" id="nameInput" maxlength="20" placeholder="Например, Джамшид" required></label>
          <label>Название комнаты<input type="text" name="rname" maxlength="20" placeholder="Пятничный подвал"></label>
          <label>Пароль, чтобы зашли только свои<input type="password" name="password" maxlength="64" placeholder="Можно оставить пустым"></label>
          <div><div class="muted" style="font-size:14px;margin-bottom:6px">Мест за столом</div>
            <div class="seg" role="group" aria-label="Мест за столом">${[3, 4, 5, 6].map(n => `<button type="button" data-seats="${n}" aria-pressed="${n === 6}">${n}</button>`).join('')}</div></div>
          <label class="check"><input type="checkbox" name="hidden"> Не показывать в общем списке — только по ссылке</label>
          <button class="btn primary big" type="submit">Создать комнату</button>
        </form>
      </div>
      <div class="panel">
        <h2>Войти в комнату</h2>
        <form class="joincode" id="codeForm" autocomplete="off">
          <input type="text" id="codeInput" maxlength="6" placeholder="Код" aria-label="Код комнаты">
          <button class="btn" type="submit">Войти по коду</button>
        </form>
        <div class="rooms" id="roomlist"></div>
      </div>
    </section>
  </div>`;
  const name = $('#nameInput');
  name.value = S.name;
  name.addEventListener('input', () => { S.name = name.value; LS.set('name', S.name); });
  let seats = 6;
  app.querySelectorAll('[data-seats]').forEach(b => b.addEventListener('click', () => {
    seats = Number(b.dataset.seats);
    app.querySelectorAll('[data-seats]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('#createForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!needName()) return;
    const f = new FormData(e.target);
    const r = await call('room:create', { name: f.get('rname') || `Подвал ${S.name}`, password: f.get('password'), maxPlayers: seats, hidden: !!f.get('hidden'), playerName: S.name, avatar: S.avatar });
    if (!r.ok) return toast(r.error);
    saveToken(r.roomId, r.token);
  });
  $('#codeForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('#codeInput').value.trim().toUpperCase();
    if (code.length < 4) return toast('Введите код комнаты из ссылки');
    tryJoin(code);
  });
  renderRooms();
};
update.home = () => {};

function needName() {
  if (S.name.trim()) return true;
  toast('Сначала введите своё имя');
  $('#nameInput')?.focus();
  return false;
}

function renderRooms() {
  const el = $('#roomlist');
  if (!el) return;
  if (!S.rooms.length) {
    el.innerHTML = `<div class="empty">Открытых комнат пока нет. Создайте свою и отправьте друзьям ссылку.</div>`;
    return;
  }
  const st = { lobby: 'собираются', playing: 'идёт игра', ended: 'партия окончена' };
  el.innerHTML = S.rooms.map(r => `
    <button class="room-row" data-join="${esc(r.id)}" data-locked="${r.locked}">
      <span class="lock">${iconSVG(r.locked ? 'amulet' : 'chest')}</span>
      <span><span class="rname">${esc(r.name)}</span><br><span class="rmeta">${r.locked ? 'с паролем' : 'без пароля'}, хозяин ${esc(r.host)}</span></span>
      <span class="rmeta">${r.players} из ${r.max}</span>
      <span class="status ${r.status}">${st[r.status]}</span>
    </button>`).join('');
}

async function tryJoin(code, password) {
  if (S.tokens[code]) {
    const r = await call('room:join', { roomId: code, token: S.tokens[code] });
    if (r.ok) return closeOverlay();
    dropToken(code);
  }
  const row = S.rooms.find(r => r.id === code);
  if (password === undefined && (!row || row.locked || !S.name.trim())) return openJoinModal(code, row);
  if (!S.name.trim()) return openJoinModal(code, row);
  const r = await call('room:join', { roomId: code, password: password || '', playerName: S.name, avatar: S.avatar });
  if (!r.ok) {
    if (r.needPassword && !$('#joinModal')) return openJoinModal(code, row);
    return toast(r.error);
  }
  saveToken(r.roomId, r.token);
  S.pendingRoom = null;
  closeOverlay();
}

function openJoinModal(code, row) {
  showOverlay(`
    <form class="modal" id="joinModal" autocomplete="off">
      <h2>Вход в комнату ${esc(code)}</h2>
      ${row ? `<p class="muted" style="margin:0">«${esc(row.name)}», ${row.players} из ${row.max} за столом</p>` : ''}
      <label>Ваше имя<input type="text" name="name" maxlength="20" required value="${esc(S.name)}"></label>
      <label>Пароль комнаты<input type="password" name="password" maxlength="64" placeholder="Если хозяин его задал"></label>
      <div class="row"><button class="btn primary" type="submit">Войти</button><button class="btn ghost" type="button" data-act="closeOverlay">Отмена</button></div>
    </form>`);
  const f = $('#joinModal');
  (S.name ? f.password : f.name).focus();
  f.addEventListener('submit', e => {
    e.preventDefault();
    S.name = f.name.value.trim(); LS.set('name', S.name);
    if (!S.name) return toast('Введите имя');
    tryJoin(code, f.password.value);
  });
}

// ───────────────────────── лобби ─────────────────────────
mount.lobby = () => {
  app.innerHTML = `
  <div class="lobby">
    <header class="band b-surface"><div class="grassline"></div>
      <div class="topbar">
        <span class="rtitle" id="rtitle"></span>
        <span class="code-pill" id="rcode" title="Код комнаты"></span>
        <button class="btn small" data-act="copy">Скопировать приглашение</button>
        <span class="spacer"></span>
        <button class="btn ghost small" data-act="rules">Как играть</button>
        <button class="btn ghost small icon-btn sound-btn" data-act="sound" aria-label="Звук" title="Звук"></button>
        <button class="btn ghost small" data-act="leave">Выйти</button>
      </div>
    </header>
    <section class="band b-clay pebbles">
      <div class="lobby-body">
        <div>
          <div class="seats" id="seats"></div>
          <div id="settings"></div>
          <div class="startbar" id="startbar"></div>
        </div>
        <aside class="side" style="min-height:420px">
          <div class="tabs"><button aria-selected="true">Чат комнаты</button></div>
          <div class="feed" id="chatfeed"></div>
          ${chatFormHTML()}
        </aside>
      </div>
    </section>
    <section class="band b-deep" style="min-height:80px"></section>
  </div>`;
  bindChat();
};
update.lobby = () => {
  const r = S.room;
  const isHost = r.hostId === r.me;
  $('#rtitle').textContent = r.name;
  $('#rcode').textContent = r.id;
  const seats = r.members.map(m => `
    <div class="seat ${m.id === r.me ? 'me' : ''}" style="--seat:${m.color}">
      ${isHost && m.id !== r.me ? `<button class="btn ghost small kick" data-kick="${m.id}" title="Убрать из-за стола" aria-label="Убрать ${esc(m.name)}">✕</button>` : ''}
      ${m.id === r.me ? `<button class="ava ava-edit" data-act="avatar" aria-label="Настроить внешность" title="Настроить внешность">${avatarSVG(m.avatar, m.color)}<i>✎</i></button>` : `<div class="ava">${avatarSVG(m.avatar, m.color)}</div>`}
      <div class="sname">${esc(m.name)}</div>
      <div class="stag">${m.id === r.hostId ? 'хозяин' : m.isBot ? 'бот' : m.connected ? 'готов' : 'нет связи'}${m.id === r.me ? ', это вы' : ''}</div>
    </div>`);
  for (let i = r.members.length; i < r.maxPlayers; i++) {
    seats.push(`<div class="seat emptyseat">${isHost ? `<button class="btn small" data-act="addBot">Посадить бота</button>` : 'свободно'}</div>`);
  }
  $('#seats').innerHTML = seats.join('');
  $('#settings').innerHTML = isHost ? `
    <div class="settings">
      <h3>Настройки</h3>
      <div><div class="muted" style="font-size:14px;margin-bottom:6px">Сколько секунд даётся, чтобы помешать добить монстра</div>
        <div class="seg" role="group">${[10000, 20000, 30000].map(v => `<button type="button" data-delay="${v}" aria-pressed="${r.settings.winDelayMs === v}">${v / 1000} с</button>`).join('')}</div></div>
      <div><div class="muted" style="font-size:14px;margin-bottom:6px">Мест за столом</div>
        <div class="seg" role="group">${[2, 3, 4, 5, 6].map(v => `<button type="button" data-max="${v}" aria-pressed="${r.maxPlayers === v}">${v}</button>`).join('')}</div></div>
      <div class="row"><button class="btn small" data-act="setPassword">${r.locked ? 'Сменить пароль' : 'Поставить пароль'}</button>${r.locked ? '<button class="btn ghost small" data-act="clearPassword">Убрать пароль</button>' : ''}</div>
    </div>` : `<p class="muted" style="margin-top:24px">Настройки и старт — у хозяина комнаты. ${r.locked ? 'Комната закрыта паролем.' : ''}</p>`;
  const enough = r.members.length >= 2;
  $('#startbar').innerHTML = isHost
    ? `<button class="btn primary big" data-act="start" ${enough ? '' : 'disabled'}>Начать партию</button><span class="muted">${enough ? (r.members.length < 3 ? 'Веселее от трёх: посадите бота.' : 'Все в сборе?') : 'Нужен хотя бы ещё один игрок или бот.'}</span>`
    : `<span class="muted">Ждём, пока хозяин начнёт партию.</span>`;
  renderChat();
};

function chatFormHTML() {
  return `<form class="chatform" id="chatform" autocomplete="off"><input type="text" id="chatinput" maxlength="300" placeholder="Написать за столом" aria-label="Сообщение"><button class="btn small" type="submit">Отправить</button></form>`;
}
function bindChat() {
  $('#chatform').addEventListener('submit', async e => {
    e.preventDefault();
    const i = $('#chatinput');
    const text = i.value.trim();
    if (!text) return;
    i.value = '';
    const r = await call('chat', { text });
    if (!r.ok && r.error) toast(r.error);
  });
}
function renderChat() {
  const el = $('#chatfeed');
  if (!el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  el.innerHTML = S.room.chat.map(m => m.sys
    ? `<div class="sys">${esc(m.text)}</div>`
    : `<div class="msg"><b style="color:${esc(m.color)}">${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('') || '<div class="sys">Здесь пока тихо.</div>';
  if (near) el.scrollTop = el.scrollHeight;
}

// ───────────────────────── игра ─────────────────────────
mount.game = () => {
  app.innerHTML = `
  <div class="game">
    <div class="band b-surface"><div class="grassline"></div>
      <div class="g-head">
        <span class="rtitle" id="rtitle"></span>
        <span class="turninfo" id="turninfo"></span>
        <span id="locpill" class="locpill"></span>
        <span class="spacer"></span>
        <button class="btn ghost small side-toggle" data-act="sideToggle"><span class="long-label">Летопись и чат</span><span class="short">Чат</span></button>
        <button class="btn ghost small icon-btn sound-btn" data-act="sound" aria-label="Звук" title="Звук"></button>
        <button class="btn ghost small" data-act="rules">Правила</button>
        <button class="btn ghost small" data-act="menu">Меню</button>
      </div>
    </div>
    <div class="band b-clay pebbles"><div class="opps" id="opps"></div></div>
    <div class="band b-rock cave" id="cave">
      <div class="cave-stage" id="stage"></div>
      <div class="motes" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
      <div class="sidepanel side" id="sidepanel">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="log">Летопись</button>
          <button role="tab" data-tab="chat">Чат</button>
        </div>
        <div class="feed" id="logfeed"></div>
        <div class="feed" id="chatfeed" hidden></div>
        ${chatFormHTML()}
      </div>
    </div>
    <div class="band b-deep mine">
      <div class="me-card" id="mecard"></div>
      <div class="handzone">
        <div class="handhead" id="handhead"></div>
        <div id="modebar"></div>
        <div class="hand" id="hand"></div>
      </div>
    </div>
  </div>`;
  bindChat();
  setTab(S.ui.tab);
};

function setTab(t) {
  S.ui.tab = t;
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $('#logfeed').hidden = t !== 'log';
  $('#chatfeed').hidden = t !== 'chat';
  if (t === 'chat') { S.ui.chatSeen = S.room.chat.length; renderTabs(); }
}
function renderTabs() {
  const unread = S.ui.tab !== 'chat' && S.room.chat.filter(m => !m.sys).length > S.room.chat.slice(0, S.ui.chatSeen).filter(m => !m.sys).length;
  const b = document.querySelector('[data-tab="chat"]');
  if (b) b.innerHTML = 'Чат' + (unread ? '<span class="dot" aria-label="новые сообщения"></span>' : '');
}

update.game = () => {
  const g = S.game;
  const r = S.room;
  $('#rtitle').textContent = r.name;
  const tp = pl(g.turn.pid);
  $('#turninfo').textContent = g.phase === 'ended' ? 'Партия окончена' : tp ? (tp.id === r.me ? 'Ваш ход' : `Ходит ${tp.name}`) : '';
  renderOpps();
  renderStage();
  renderMine();
  renderLog();
  renderChat();
  if (S.ui.tab === 'chat') S.ui.chatSeen = r.chat.length;
  renderTabs();
  $('#sidepanel').classList.toggle('open', S.ui.sideOpen);
  maybeHelpPrompt();
  maybeEndScreen();
};

function renderOpps() {
  const g = S.game;
  const mine = me();
  const start = mine ? mine.seat : 0;
  const order = [...g.players].sort((a, b) => ((a.seat - start + 99) % g.players.length) - ((b.seat - start + 99) % g.players.length)).filter(p => p.id !== S.room.me);
  $('#opps').innerHTML = order.map(oppHTML).join('');
}
function statusTags(p) {
  const g = S.game, c = g.combat;
  const mem = S.room.members.find(m => m.id === p.id);
  const t = [];
  if (g.turn.pid === p.id && g.phase === 'playing') t.push('<span class="badge lamp">ходит</span>');
  if (c?.fighter === p.id) t.push('<span class="badge warn">в бою</span>');
  if (c?.helper === p.id) t.push('<span class="badge">помогает</span>');
  if (p.dead) t.push('<span class="badge warn">погиб</span>');
  if (p.isBot) t.push('<span class="badge">бот</span>');
  else if (mem?.autopilot) t.push('<span class="badge">автопилот</span>');
  else if (mem && !mem.connected) t.push('<span class="badge">нет связи</span>');
  return t.join('');
}
function oppHTML(p) {
  const g = S.game;
  return `<button class="opp ${g.turn.pid === p.id ? 'turn' : ''} ${p.dead ? 'dead' : ''}" data-opp="${p.id}" style="--seat:${p.color}" aria-label="${esc(p.name)}, уровень ${p.level}">
    <div class="ava">${avatarSVG(p.avatar, p.color)}</div>
    <div class="oname">${esc(p.name)}</div>
    <div class="ometa"><span>${esc(raceText(p))}</span><span>${esc(classText(p))}</span></div>
    <div class="ostats"><span class="lvl" title="Уровень">${p.level}</span><span class="pow" title="Сила: уровень и надетые вещи">⚔ ${p.power}</span><span class="handcount" title="Карт в руке"><i></i>${p.handCount}</span>${statusTags(p)}</div>
  </button>`;
}

const SHIELD = color => `<svg viewBox="0 0 100 116" aria-hidden="true"><path d="M50 4 L94 18 C94 64 80 92 50 112 C20 92 6 64 6 18 Z" fill="${color}" stroke="#231a26" stroke-width="5" stroke-linejoin="round"/><path d="M50 14 L84 25 C84 62 73 84 50 100" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="4" stroke-linecap="round"/></svg>`;

function renderStage() {
  const g = S.game;
  const el = $('#stage');
  const h = hints();
  const loc = g.location ? def(g.location) : null;
  $('#cave').dataset.loc = loc ? loc.art : '';
  const decks = `<div class="decks"><div class="deck door" id="deckDoor" title="Колода проходов" aria-label="Колода проходов: ${g.decks.door}">${cardBackSVG('door')}<span>${g.decks.door}</span></div><div class="deck treasure" id="deckTreasure" title="Колода клада" aria-label="Колода клада: ${g.decks.treasure}">${cardBackSVG('treasure')}<span>${g.decks.treasure}</span></div></div>`;
  const lp = $('#locpill');
  const key = loc ? g.location : '';
  if (lp.dataset.key !== key) {
    lp.dataset.key = key;
    lp.innerHTML = loc ? `<button class="loc-banner" id="locBanner" data-uid="${esc(g.location)}" data-zone="view" title="${esc(loc.text)}">${locationSVG(loc.art)}<span><small>Локация</small><b>${esc(loc.name)}</b></span></button>` : '';
  }
  if (g.combat) { el.innerHTML = decks + `<div class="stage-inner">${fightHTML()}</div>`; afterStage(); return; }
  const tp = pl(g.turn.pid);
  const mine = tp?.id === S.room.me;
  let title = '', text = '';
  const step = g.turn.step;
  if (g.phase === 'ended') { title = 'Партия окончена'; text = ''; }
  else if (mine) {
    if (step === 'pre') { title = 'Ваш ход'; text = 'Разложите вещи и выбейте дверь — посмотрим, кто за ней.'; }
    else if (step === 'post') { title = 'За дверью никого'; text = 'Можно сразиться с монстром из своей руки или обшарить комнату и взять карту втёмную.'; }
    else { title = 'Ход почти закончен'; text = h.mustGive ? `В руке на ${cardsWord(h.mustGive)} больше нормы — лишнее уйдёт ${h.giveToLowest ? 'самому слабому игроку' : 'в сброс'}.` : 'Наведите порядок в вещах и передайте ход.'; }
  } else if (tp) {
    title = `Ходит ${esc(tp.name)}`;
    text = step === 'pre' ? 'Готовится выбить дверь.' : step === 'post' ? 'Решает: драться с монстром из руки или обшарить комнату.' : 'Заканчивает ход.';
  }
  const rv = g.reveal;
  let reveal = '';
  if (rv && g.phase === 'playing') {
    const fresh = rv.seq !== S.ui.lastReveal;
    S.ui.lastReveal = rv.seq;
    reveal = `<div class="reveal-slot ${fresh && !cine.on ? 'reveal-in' : ''}">${cardHTML(rv.uid, { size: 'md', attrs: 'data-zone="view"' })}</div>`;
  }
  el.innerHTML = decks + `<div class="stage-inner"><div class="stage-msg"><h2>${title}</h2><p class="muted" style="margin:0">${text}</p></div>${reveal}<div class="act-bar">${actionButtons()}</div></div>`;
  if (reveal.includes('reveal-in')) requestAnimationFrame(() => { const r = $('#stage .reveal-in'); if (r) { fx.dust(r, { n: 18 }); fx.burst(r, { n: 16, speed: 200, g: 200 }); } });
  afterStage();
}
// эффекты, которые нужно запустить после перерисовки сцены
function afterStage() {
  liveFight();
  if (cine.on) { S.ui.slam = null; cine.decorate(); return; }
  const slam = S.ui.slam;
  if (!slam) return;
  S.ui.slam = null;
  requestAnimationFrame(() => {
    const c = document.querySelector(`#stage .mon-wrap .card[data-uid="${CSS.escape(slam.uid)}"]`);
    if (!c) return;
    c.classList.add('slam-in');
    setTimeout(() => { fx.dust(c, { n: 30, rocks: 8 }); fx.shake($('#stage'), 'quake'); }, 260);
    if (slam.ambush) setTimeout(() => { fx.vignette(); fx.banner('Засада!', def(slam.uid).name, 'bad'); }, 420);
  });
}

// числа на щитах докручиваются, шкала перевеса плавно съезжает, при смене перевеса — вспышка
function liveFight() {
  const st = $('#stage');
  if (!st) return;
  st.querySelectorAll('.shield b[data-roll]').forEach(b => rollNum(b, Number(b.textContent), Number(b.dataset.roll)));
  const t = st.querySelector('.tug[data-k]');
  if (t && t.style.getPropertyValue('--k') !== t.dataset.k) requestAnimationFrame(() => requestAnimationFrame(() => t.style.setProperty('--k', t.dataset.k)));
  const v = st.querySelector('.verdict.flip');
  if (v) requestAnimationFrame(() => fx.burst(v, { n: 18, speed: 220, colors: v.classList.contains('win') ? ['#8ff0d2', '#3fa38c', '#fff'] : ['#ff8a66', '#d2502f', '#fff'] }));
}
function rollNum(el, from, to) {
  if (!Number.isFinite(from) || from === to) { el.textContent = to; return; }
  el.classList.add(to > from ? 'num-up' : 'num-down');
  const t0 = performance.now(), D = 700;
  const step = t => {
    if (!el.isConnected) return;
    const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function actionButtons() {
  const h = hints();
  const g = S.game;
  if (!h || g.phase !== 'playing') return '';
  const b = [];
  if (h.kick) b.push(`<button class="btn primary big" data-act="kick">Выбить дверь</button>`);
  if (h.lookForTrouble) {
    const monsters = me().hand.filter(u => def(u).type === 'monster');
    b.push(`<button class="btn danger" data-act="trouble" ${monsters.length ? '' : 'disabled title="В руке нет монстров"'}>Искать неприятности</button>`);
  }
  if (h.loot) b.push(`<button class="btn" data-act="loot">Обшарить комнату</button>`);
  if (h.endTurn) b.push(`<button class="btn primary big" data-act="endTurn">${h.mustGive ? `Отдать ${cardsWord(h.mustGive)} и закончить ход` : 'Закончить ход'}</button>`);
  if (h.autoEquip && h.manage) b.push(`<button class="btn ghost small" data-act="autoEquip">Надеть лучшее</button>`);
  return b.join('');
}

const SWORDS = (() => {
  const sw = `<path d="M32 3 L36 10 L36 40 L28 40 L28 10 Z" fill="#e9eef5"/><path d="M32 9 V38" stroke="#b9c3cf" stroke-width="1.6"/><rect x="21" y="39" width="22" height="5" rx="2" fill="#e8c15a"/><rect x="29.5" y="44" width="5" height="11" rx="2" fill="#7a4b2c"/><circle cx="32" cy="57.5" r="3.2" fill="#e8c15a"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#231a26" stroke-width="2.6" stroke-linejoin="round"><g transform="rotate(42 32 32)">${sw}</g><g transform="rotate(-42 32 32)">${sw}</g></g></svg>`;
})();
const tierClass = str => (str >= 16 ? 'boss' : str >= 12 ? 'high' : str >= 6 ? 'mid' : 'low');

function fightHTML() {
  const g = S.game, c = g.combat, n = c.numbers, h = hints();
  // прошлые числа этого же боя: от них «докручиваются» щиты и шкала перевеса
  const fk = `${g.turn.n}:${c.fighter}`;
  const prev = S.ui.fightNums?.key === fk ? S.ui.fightNums : null;
  const tk = n.heroes + n.monsters > 0 ? Math.max(0.04, Math.min(0.96, n.heroes / (n.heroes + n.monsters))) : 0.5;
  S.ui.fightNums = { key: fk, heroes: n.heroes, monsters: n.monsters, k: tk, win: n.winning };
  const heroes = [c.fighter, c.helper].filter(Boolean).map(id => {
    const p = pl(id);
    return `<div class="hero-pill" data-pid="${p.id}" style="--seat:${p.color}"><span class="ava">${avatarSVG(p.avatar, p.color)}</span><span><b>${esc(p.name)}</b><br><small>сила ${c.heroStrengths[id]}</small></span></div>`;
  }).join('');
  const pm = [];
  for (const m of c.mods) pm.push({ side: m.side, t: `${esc(pname(m.by))}: ${esc(m.uid ? def(m.uid).name : m.label || 'эффект')} ${m.n > 0 ? '+' : '−'}${Math.abs(m.n)}` });
  for (const id of [c.fighter, c.helper].filter(Boolean)) { const v = pl(id)?.nextCombat; if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: ${v > 0 ? 'зелье +' + v : 'слабость −' + Math.abs(v)}` }); }
  for (const [id, v] of Object.entries(c.rage || {})) if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: ярость +${v}` });
  for (const [id, v] of Object.entries(c.turnUndead || {})) if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: изгнание +${v}` });
  for (const bs of c.backstabs) pm.push({ side: 'monster', t: `${esc(pname(bs.by))} бьёт в спину ${esc(pname(bs.on))}: −2` });
  for (const [id, v] of Object.entries(c.escape || {})) if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: левитация, побег +${v}` });
  const mods = side => pm.filter(x => x.side === side).map(x => `<span class="mod ${side === 'player' ? 'p' : 'm'}">${x.t}</span>`).join('');
  const monsters = c.monsters.map((m, i) => `
    <div class="mon-wrap">
      <div class="mon-body ${tierClass(m.strength)}">${cardHTML(m.uid, { size: 'sm', attrs: `data-zone="view"` })}</div>
      <span class="mon-str">сила ${m.strength}${def(m.uid).mirror != null ? ` <small>(лидер ${m.level - def(m.uid).mirror} + ${def(m.uid).mirror})</small>` : ''}</span>
      ${m.noEscape || def(m.uid).noHelp ? `<div class="mon-flags">${m.noEscape ? '<span class="flag">не убежать</span>' : ''}${def(m.uid).noHelp ? '<span class="flag">без помощи</span>' : ''}</div>` : ''}
      ${m.enh.length ? `<div class="enh-list">${m.enh.map(u => `<span class="mod m" data-uid="${u}" data-zone="view">${esc(def(u).name)} ${def(u).double ? '×2' : (def(u).bonus > 0 ? '+' : '') + def(u).bonus}</span>`).join('')}</div>` : ''}
    </div>`).join('');
  let center;
  if (c.winAt) {
    center = `<div class="countdown" data-until="${c.winAt}" data-total="${g.opts.winDelayMs}"><svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="32" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/><circle class="ring" cx="37" cy="37" r="32" fill="none" stroke="#f5b83d" stroke-width="6" stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="0"/></svg><b>…</b></div>`;
  } else center = `<span class="vs-emblem">${SWORDS}<span class="vs-word">против</span></span>`;
  const flip = prev && prev.win !== n.winning ? ' flip' : '';
  const verdict = n.winning ? `<span class="verdict win${flip}">Герои сильнее${n.warrior && n.heroes === n.monsters ? ' (ничья — за воином)' : ''}</span>` : `<span class="verdict lose${flip}">Монстры сильнее</span>`;

  // кнопки
  const b = [];
  const mineFight = c.fighter === S.room.me;
  if (mineFight) {
    if (c.helpReq) b.push(`<span class="helpwait">Ждём ответа от ${esc(pname(c.helpReq.to))}…</span><button class="btn ghost small" data-act="cancelHelp">Отменить просьбу</button>`);
    if (h.fight) b.push(`<button class="btn primary big" data-act="fight">Добить!</button>`);
    if (c.winAt) b.push(`<span class="hint">Остальные ещё могут помешать</span>`);
    if (h.askHelp && h.helpTargets?.length) b.push(`<button class="btn hero" data-act="askHelp">Позвать на помощь</button>`);
    else if (h.noHelp && !c.helper && !n.winning) b.push(`<span class="hint">Этот монстр не терпит помощников</span>`);
    if (h.runAway) b.push(`<button class="btn danger" data-act="runAway">Бежать</button>`);
  } else {
    const canMeddle = Object.values(h.cards || {}).some(o => o.some(a => a.side || Number.isInteger(a.monster) || a.with));
    const who = c.helper === S.room.me ? 'Вы помогаете в этом бою.' : `${esc(pname(c.fighter))} в бою.`;
    b.push(`<span class="hint">${who} ${canMeddle ? 'Карты, которыми можно вмешаться, подсвечены в руке.' : ''}</span>`);
    if (h.pass) b.push(`<button class="btn ghost" data-act="pass">Не мешаю</button>`);
  }
  if (c.winAt && c.passed?.length) b.push(`<span class="hint passed">Не мешают: ${c.passed.map(id => esc(pname(id))).join(', ')}</span>`);
  return `
    <div class="fight">
      <div class="side-col hero"><div class="side-main"><div class="shield hero${n.winning ? ' lead' : ''}" id="shieldHero" title="Сила героев">${SHIELD('#3fa38c')}<b data-roll="${n.heroes}">${prev ? prev.heroes : n.heroes}</b></div><div class="heroes-row">${heroes}</div></div><div class="mods">${mods('player')}</div></div>
      <div class="versus">${center}${verdict}</div>
      <div class="side-col mon"><div class="side-main"><div class="shield mon${n.winning ? '' : ' lead'}" id="shieldMon" title="Сила монстров">${SHIELD('#d2502f')}<b data-roll="${n.monsters}">${prev ? prev.monsters : n.monsters}</b></div><div class="monsters-row">${monsters}</div></div><div class="mods">${mods('monster')}</div></div>
    </div>
    <div class="tug" style="--k:${(prev ? prev.k : tk).toFixed(3)}" data-k="${tk.toFixed(3)}" title="Перевес сил: ${n.heroes} против ${n.monsters}"><i class="tug-fill"></i><i class="tug-mark"></i></div>
    <div class="reward">За победу: +${n.levels} ${plural(n.levels, 'уровень', 'уровня', 'уровней')} и ${n.treasures} ${plural(n.treasures, 'карта', 'карты', 'карт')} клада${c.helper ? `, помощнику обещано ${c.helpOffer}` : ''}</div>
    <div class="act-bar">${b.join('')}</div>`;
}

// таймер отсчёта
function tickCountdowns() {
  document.querySelectorAll('.countdown[data-until]').forEach(el => {
    const left = Number(el.dataset.until) - serverNow();
    const total = Number(el.dataset.total) || 5000;
    const sec = left > 0 ? Math.ceil(left / 1000) : 0;
    el.querySelector('b').textContent = sec || '…';
    const key = `${el.dataset.until}:${sec}`;
    if (sec > 0 && key !== S.ui.lastTick) {
      if (S.ui.lastTick?.startsWith(el.dataset.until + ':')) { sfx.play('tick', { last: sec === 1, gap: 0 }); if (sec <= 3) sfx.play('heartbeat', { gap: 0, delay: 0.05 }); }
      S.ui.lastTick = key;
    }
    const urgent = sec > 0 && sec <= 3;
    if (el.classList.contains('urgent') !== urgent) { el.classList.toggle('urgent', urgent); $('#cave')?.classList.toggle('urgent', urgent); }
    el.querySelector('.ring').setAttribute('stroke-dashoffset', String(201 * (1 - Math.max(0, left) / total)));
  });
  const cave = $('#cave');
  if (cave?.classList.contains('urgent') && !document.querySelector('#stage .countdown.urgent')) cave.classList.remove('urgent');
  requestAnimationFrame(tickCountdowns);
}
requestAnimationFrame(tickCountdowns);

// ───────────────────────── мой стол ─────────────────────────
const SLOT_ORDER = [['head', 'Головняк'], ['armor', 'Броник'], ['feet', 'Обувка'], ['hand', 'В руках'], ['pet', 'Питомец'], ['none', 'Прочее']];
const ABIL = {
  rage: { cls: 'warrior', label: 'Ярость', tip: 'Сбросьте до 3 карт: +1 к силе за каждую' },
  turn: { cls: 'cleric', label: 'Изгнание', tip: 'Против нежити: до 3 карт, +3 за каждую' },
  levitate: { cls: 'mage', label: 'Левитация', tip: 'До 3 карт: +1 к побегу за каждую' },
  charm: { cls: 'mage', label: 'Чары', tip: 'Сбросьте всю руку (от 3 карт) и усыпите монстра' },
  backstab: { cls: 'rogue', label: 'Удар в спину', tip: 'Сбросьте карту: участник боя получает −2' },
  steal: { cls: 'rogue', label: 'Кража', tip: 'Сбросьте карту и бросьте кубик: 4+ — вещь ваша' },
  lullaby: { cls: 'bard', label: 'Колыбельная', tip: 'Сбросьте карту: монстры −3 в этом бою (до двух раз)', need: 1 },
  distill: { cls: 'alchemist', label: 'Перегонка', tip: 'Сбросьте 2 карты и возьмите карту клада (раз в ход)', need: 2 },
  mutagen: { cls: 'witcher', label: 'Мутаген', tip: 'Один раз за партию: сбросьте 2 карты в бою — ещё +10 к силе', need: 2 },
};
const abilNeed = name => ABIL[name]?.need || (name === 'backstab' || name === 'steal' ? 1 : 0);

function renderMine() {
  const p = me();
  const el = $('#mecard');
  if (!p) { el.innerHTML = '<p class="muted">Вы смотрите партию со стороны.</p>'; $('#hand').innerHTML = ''; $('#handhead').innerHTML = ''; $('#modebar').innerHTML = ''; return; }
  const h = hints();
  const mode = S.ui.mode;
  const picked = new Set(mode?.picked || []);
  const traits = [];
  p.races.forEach(u => traits.push(`<button class="trait" data-uid="${u}" data-zone="trait">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`));
  if (!p.races.length) traits.push(`<span class="trait none">Человек</span>`);
  p.classes.forEach(u => traits.push(`<button class="trait" data-uid="${u}" data-zone="trait">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`));
  if (!p.classes.length) traits.push(`<span class="trait none">Без класса</span>`);
  [p.halfbreed, p.supermunch].filter(Boolean).forEach(u => traits.push(`<button class="trait" data-uid="${u}" data-zone="trait">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`));

  const slot = key => p.equipped.filter(u => def(u).slot === key).map(u => chipHTML(u, { cls: picked.has(u) ? 'picked' : '' })).join('');
  const slots = SLOT_ORDER.filter(([k]) => k !== 'pet' || p.equipped.some(u => def(u).slot === 'pet')).map(([k, label]) => `<div class="slot"><small>${k === 'hand' && p.handsLimit > 2 ? `${label} (${p.handsLimit})` : label}</small>${slot(k)}</div>`).join('')
    + `<div class="slot"><small>Не надето</small>${p.carried.map(u => chipHTML(u, { cls: 'off' + (picked.has(u) ? ' picked' : '') })).join('')}</div>`;

  const abil = Object.entries(ABIL).filter(([k, a]) => p.classes.some(u => def(u).cls === a.cls)).map(([k, a]) => {
    const v = h.abilities?.[k];
    const on = Array.isArray(v) ? v.length > 0 : !!v;
    return `<button class="btn small ${on ? 'hero' : 'ghost'}" data-ability="${k}" ${on ? '' : 'disabled'} title="${esc(a.tip)}">${a.label}</button>`;
  }).join('');
  const run = 5 - p.runBonus;
  el.innerHTML = `
    <div class="me-top" style="--seat:${p.color}">
      <div class="me-ava" id="meava">${avatarSVG(p.avatar, p.color)}</div>
      <div><div class="me-name">${esc(p.name)}</div>
        <div class="me-stats"><span class="lvl" title="Уровень">${p.level}</span><span class="pow" title="Сила: уровень и надетые вещи">⚔ ${p.power}</span>
        <span class="badge" title="Сколько нужно выбросить на кубике, чтобы убежать">побег ${run <= 1 ? 'всегда' : run > 6 ? 'никогда' : run + '+'}</span>
        ${p.nextCombat > 0 ? `<span class="badge good">+${p.nextCombat} в бою</span>` : p.nextCombat < 0 ? `<span class="badge warn">${p.nextCombat} в бою</span>` : ''}${p.nextEscape < 0 ? `<span class="badge warn">побег ${p.nextEscape}</span>` : ''}${p.dead ? '<span class="badge warn">вы погибли до следующего хода</span>' : ''}</div>
      </div>
    </div>
    <div class="traits">${traits.join('')}</div>
    <div class="slots">${slots}</div>
    ${abil ? `<div class="abilities">${abil}</div>` : ''}`;

  const over = p.hand.length - p.handLimit;
  $('#handhead').innerHTML = `<span>В руке ${cardsNom(p.hand.length)}${over > 0 ? `. К концу хода можно оставить ${p.handLimit}, лишние уйдут` : ''}</span>${h.manage ? `<button class="btn ghost small" data-act="sellMode">Продать вещи</button>` : ''}`;
  $('#modebar').innerHTML = mode ? modeBarHTML() : '';
  const handEl = $('#hand');
  handEl.classList.toggle('has-play', !mode && p.hand.some(u => (h.cards?.[u] || []).length));
  const prev = S.ui.prevHand;
  let k = 0;
  handEl.innerHTML = p.hand.length ? p.hand.map(u => {
    let playable = (h.cards?.[u] || []).length > 0;
    let dim = false;
    if (mode) { playable = false; dim = !modeAccepts(u, 'hand'); }
    const isNew = prev && !prev.has(u);
    return cardHTML(u, { playable, selected: picked.has(u), dim, cls: isNew ? 'deal-in' : '', attrs: `data-zone="hand"${isNew ? ` style="animation-delay:${(k++) * 90}ms"` : ''}` });
  }).join('') : `<p class="muted">Рука пуста.</p>`;
  S.ui.prevHand = new Set(p.hand);
  for (let i = 0; i < Math.min(k, 6); i++) sfx.play('deal', { delay: i * 0.09, gap: 0 });
  fitHand();
}
const FAN = matchMedia('(max-width: 900px)');
function fitHand() {
  const el = $('#hand');
  if (!el) return;
  const cards = [...el.querySelectorAll('.card')];
  // на телефоне рука раскрывается веером внизу экрана: карты по дуге, внахлёст, с лёгким наклоном
  const fan = FAN.matches && cards.length > 0;
  el.classList.toggle('fan', fan);
  document.querySelector('.game')?.classList.toggle('has-fan', fan);
  if (fan) {
    const n = cards.length, w = cards[0].offsetWidth, W = document.documentElement.clientWidth;
    const mid = (n - 1) / 2;
    const spacing = n > 1 ? Math.min(w * 0.8, (W - w - 20) / (n - 1)) : 0;
    const step = n > 1 ? Math.min(6, 30 / (n - 1)) : 0;
    const dropMax = Math.min(24, 6 + n * 2);
    cards.forEach((c, i) => {
      const t = i - mid;
      c.style.setProperty('--fx', (t * spacing).toFixed(1) + 'px');
      c.style.setProperty('--fy', (mid ? Math.pow(Math.abs(t) / mid, 2) * dropMax : 0).toFixed(1) + 'px');
      c.style.setProperty('--fr', (t * step).toFixed(2) + 'deg');
      c.style.setProperty('--z', String(i + 1));
    });
    return;
  }
  if (cards.length < 2) return el.style.setProperty('--ov', '0px');
  const w = cards[0].offsetWidth;
  const avail = el.clientWidth - 12;
  const gap = 10;
  let ov = gap;
  // на телефоне рука листается пальцем, на широком экране — раскладывается веером
  if (window.innerWidth >= 760 && cards.length * (w + gap) > avail) ov = Math.max(-(w - 64), (avail - w) / (cards.length - 1) - w);
  el.style.setProperty('--ov', ov + 'px');
}
window.addEventListener('resize', () => fitHand());

// ───────────────────────── режимы выбора карт ─────────────────────────
function modeAccepts(uid, zone) {
  const m = S.ui.mode;
  if (!m) return false;
  if (m.kind === 'give' || m.kind === 'ability') return zone === 'hand';
  if (m.kind === 'sell') return !!def(uid).value && (zone === 'hand' ? ['item', 'oneshot', 'buff'].includes(def(uid).type) : true);
  return false;
}
// та же арифметика, что в движке (saleValue): гоблин +200 за вещь, полурослик удваивает самую дорогую, курс зависит от локации
function saleTotal(picked) {
  const sale = S.game.sale || { rate: 1000 };
  const vals = picked.map(u => (def(u).value || 0) + (sale.goblin ? 200 : 0));
  let total = vals.reduce((a, b) => a + b, 0);
  const half = !!sale.halfling && vals.length > 0;
  if (half) total += Math.max(...vals);
  return { total, half, rate: sale.rate, goblin: !!sale.goblin, levels: Math.floor(total / sale.rate) };
}
function modeBarHTML() {
  const m = S.ui.mode;
  const n = m.picked.length;
  if (m.kind === 'give') {
    return `<div class="modebar"><span>Выберите <b>${cardsWord(m.need)}</b>, которые ${hints().giveToLowest ? 'отдадите самому слабому' : 'сбросите'}: выбрано ${n}.</span><button class="btn primary small" data-act="modeOk" ${n === m.need ? '' : 'disabled'}>Готово</button><button class="btn ghost small" data-act="modeCancel">Отмена</button></div>`;
  }
  if (m.kind === 'sell') {
    const { total, half, rate, goblin, levels: lv } = saleTotal(m.picked);
    const extra = [half && 'полурослик продаёт одну вдвое дороже', goblin && 'гоблин выторговывает +200 за каждую'].filter(Boolean).join(', ');
    return `<div class="modebar"><span>Отметьте вещи в руке и на столе. Сумма: <b>${total} г</b>${extra ? ` (${extra})` : ''} — это ${lv} ${plural(lv, 'уровень', 'уровня', 'уровней')}. Каждые ${rate} голдов — уровень${rate !== 1000 ? ' (так считают на этой локации)' : ''}, сдача сгорает.</span><button class="btn primary small" data-act="modeOk" ${lv >= 1 ? '' : 'disabled'}>Продать</button><button class="btn ghost small" data-act="modeCancel">Отмена</button></div>`;
  }
  if (m.kind === 'ability') {
    const a = ABIL[m.name];
    const fixed = abilNeed(m.name);
    const ok = fixed ? n === fixed : n >= 1 && n <= m.max;
    const what = m.name === 'steal' ? `, цель: «${esc(def(m.item).name)}» у ${esc(pname(m.target))}` : m.name === 'backstab' ? `, цель: ${esc(pname(m.target))}` : '';
    return `<div class="modebar"><span><b>${a.label}</b>${what}. ${fixed === 1 ? 'Выберите карту для сброса.' : fixed ? `Выберите ${cardsWord(fixed)} для сброса: выбрано ${n}.` : `Выберите от 1 до ${m.max} карт для сброса: выбрано ${n}.`}</span><button class="btn primary small" data-act="modeOk" ${ok ? '' : 'disabled'}>Применить</button><button class="btn ghost small" data-act="modeCancel">Отмена</button></div>`;
  }
  return '';
}
function togglePick(uid, zone) {
  const m = S.ui.mode;
  if (!modeAccepts(uid, zone)) return;
  const i = m.picked.indexOf(uid);
  if (i >= 0) m.picked.splice(i, 1);
  else {
    const cap = m.kind === 'give' ? m.need : m.kind === 'ability' ? (abilNeed(m.name) || m.max) : 99;
    if (m.picked.length >= cap) m.picked.shift();
    m.picked.push(uid);
  }
  renderMine();
}
async function modeOk() {
  const m = S.ui.mode;
  let r;
  if (m.kind === 'give') r = await act({ type: 'endTurn', give: m.picked });
  if (m.kind === 'sell') r = await act({ type: 'sell', uids: m.picked });
  if (m.kind === 'ability') r = await act({ type: 'ability', name: m.name, cards: m.picked, target: m.target, item: m.item, monster: m.monster });
  if (r?.ok) { S.ui.mode = null; render(); }
}

// ───────────────────────── летопись ─────────────────────────
function renderLog() {
  const el = $('#logfeed');
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = S.game.log.map(l => `<div class="l-${l.kind}">${esc(l.text)}</div>`).join('');
  if (near || !el.dataset.init) { el.scrollTop = el.scrollHeight; el.dataset.init = '1'; }
}

// ───────────────────────── поповеры ─────────────────────────
let popOpts = [];
function showOverlay(html) {
  layer.innerHTML = `<div class="pop-back" data-backdrop>${html}</div>`;
  S.ui.overlay = true;
}
function closeOverlay() { layer.innerHTML = ''; S.ui.overlay = null; popOpts = []; }

function optLabel(a) {
  const d = def(a.uid);
  if (a.type === 'lookForTrouble') return 'Сразиться с ним';
  if (a.target) return `Наслать на ${pname(a.target)}`;
  if (a.side) return a.side === 'player' ? `Героям +${d.bonus}` : `Монстрам +${d.bonus}`;
  if (Number.isInteger(a.monster)) return `${d.type === 'enhancer' ? 'Усилить' : 'Окаменить'} «${def(S.game.combat.monsters[a.monster].uid).name}»`;
  if (a.with) return `Выпустить «${def(a.with).name}» (ур. ${def(a.with).level})`;
  switch (d.type) {
    case 'race': return me().races.length && !me().halfbreed ? `Стать: ${d.name} (вместо нынешней расы)` : `Стать: ${d.name}`;
    case 'class': return me().classes.length && !me().supermunch ? `Взять класс: ${d.name} (вместо нынешнего)` : `Взять класс: ${d.name}`;
    case 'item': return 'Выложить на стол';
    case 'levelup': return 'Получить уровень';
    case 'hoard': return 'Открыть схрон';
    case 'oneshot': return d.effect === 'escape' ? 'Бросить шашку и сбежать' : d.effect === 'escapeBonus' ? `Закинуть верёвку: побег +${d.bonus}` : 'Сыграть';
    case 'location': return S.game.location ? `Перенести всех сюда (вместо «${def(S.game.location).name}»)` : 'Перенести всех сюда';
    case 'event': return 'Объявить событие';
    case 'buff': return `Выпить: +${d.bonus} в бою`;
    default: return 'Сыграть';
  }
}
function whenText(d) {
  switch (d.type) {
    case 'monster': return 'Монстра можно позвать на бой в свой ход, если за дверью никого не было, или подбросить в чужой бой картой «Из темноты вылезло…».';
    case 'curse': return 'Насылается на любого игрока в любой момент.';
    case 'race': case 'class': case 'halfbreed': case 'supermunch': case 'item': case 'hoard': return 'Играется в свой ход, когда нет боя.';
    case 'enhancer': return 'Играется на монстра в любом бою.';
    case 'wandering': return 'Играется в любом бою вместе с монстром из руки.';
    case 'oneshot': return d.effect === 'ward' ? 'Срабатывает сам, когда на вас насылают проклятие.' : 'Играется во время боя.';
    case 'levelup': return 'Играется когда угодно, но 10-й уровень так не взять.';
    case 'location': return 'Играется в свой ход вне боя. Меняет правила для всех, пока кто-нибудь не сменит локацию.';
    case 'event': return 'Играется в свой ход вне боя и срабатывает сразу для всего стола.';
    case 'buff': return 'Выпейте в любой момент: бонус сработает в текущем или следующем вашем бою.';
    default: return '';
  }
}

function openCardPop(uid, zone) {
  const p = me();
  const h = hints();
  const d = def(uid);
  popOpts = [];
  const groups = [];
  if (zone === 'hand' && p) {
    const opts = h.cards?.[uid] || [];
    opts.forEach(a => popOpts.push({ label: optLabel(a), action: a, cls: a.side === 'monster' || a.target || (d.type === 'enhancer' && d.bonus > 0) || a.with ? 'danger' : 'primary' }));
    if (!opts.length) groups.push(`<p class="why">${esc(whenText(d))}</p>`);
    if (h.manage && d.value && ['item', 'oneshot'].includes(d.type)) popOpts.push({ label: 'Продать…', fn: () => startMode({ kind: 'sell', picked: [uid] }), cls: 'ghost' });
  }
  if (zone === 'table' && p) {
    if (p.carried.includes(uid) && h.equip?.[uid]) popOpts.push({ label: 'Надеть', action: { type: 'equip', uid }, cls: 'primary' });
    if (p.carried.includes(uid) && h.manage && !h.equip?.[uid]) groups.push(`<p class="why">Сейчас не надеть: ${esc(d.req ? (d.text || 'не подходит') : 'слот занят — снимите другую вещь')}.</p>`);
    if (p.equipped.includes(uid) && h.manage) popOpts.push({ label: 'Снять', action: { type: 'unequip', uid }, cls: '' });
    if (h.manage && d.value) popOpts.push({ label: 'Продать…', fn: () => startMode({ kind: 'sell', picked: [uid] }), cls: 'ghost' });
    const c = S.game.combat;
    const busy = c && (c.fighter === p.id || c.helper === p.id);
    if (!busy && !p.dead) S.game.players.filter(x => x.id !== p.id && !x.dead && !(c && (c.fighter === x.id || c.helper === x.id))).forEach(x => popOpts.push({ label: `Отдать: ${x.name}`, action: { type: 'gift', uid, to: x.id }, cls: 'ghost' }));
    if (h.manage) popOpts.push({ label: 'Сбросить', action: { type: 'discardInPlay', uid }, cls: 'ghost' });
  }
  if (zone === 'trait' && p && h.manage) popOpts.push({ label: 'Сбросить', action: { type: 'discardInPlay', uid }, cls: 'ghost' });
  showOverlay(`<div class="pop" role="dialog" aria-label="${esc(d.name)}">
    ${cardHTML(uid, { size: 'lg', tab: false })}
    <div class="pop-actions">
      ${groups.join('')}
      ${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}
      <button class="btn ghost" data-act="closeOverlay">Закрыть</button>
    </div></div>`);
  layer.querySelector('[data-popopt]')?.focus();
}

function openOppPop(pid) {
  const p = pl(pid);
  const h = hints();
  const mine = me();
  popOpts = [];
  if (mine) {
    for (const u of mine.hand) for (const a of h.cards?.[u] || []) if (a.target === pid) popOpts.push({ label: `Наслать «${def(u).name}»`, action: a, cls: 'danger' });
    for (const s of h.abilities?.steal || []) if (s.target === pid) popOpts.push({ label: `Стащить «${def(s.item).name}»`, fn: () => startMode({ kind: 'ability', name: 'steal', target: pid, item: s.item, picked: [], max: 1 }), cls: 'ghost' });
    for (const t of h.abilities?.backstab || []) if (t === pid) popOpts.push({ label: 'Ударить в спину (−2)', fn: () => startMode({ kind: 'ability', name: 'backstab', target: pid, picked: [], max: 1 }), cls: 'danger' });
  }
  const items = [...p.equipped.map(u => chipHTML(u)), ...p.carried.map(u => chipHTML(u, { cls: 'off' }))].join('') || '<p class="muted">Вещей нет.</p>';
  showOverlay(`<div class="modal" role="dialog" aria-label="${esc(p.name)}">
    <div class="row"><span class="me-ava" style="--seat:${p.color}">${avatarSVG(p.avatar, p.color)}</span><div><h2>${esc(p.name)}</h2><div class="me-stats"><span class="lvl">${p.level}</span><span class="pow">⚔ ${p.power}</span><span class="badge">${esc(raceText(p))}, ${esc(classText(p))}</span><span class="handcount"><i></i>${p.handCount}</span></div></div></div>
    <div class="opp-items" data-zone-view>${items}</div>
    ${popOpts.length ? `<div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div>` : ''}
    <button class="btn ghost" data-act="closeOverlay">Закрыть</button>
  </div>`);
}

function startMode(m) {
  closeOverlay();
  S.ui.mode = m;
  if (m.kind === 'ability') toast('Выберите карты для сброса в руке', true);
  render();
}

function openHelpModal() {
  const h = hints();
  const c = S.game.combat;
  const n = c.numbers;
  let target = h.helpTargets[0];
  let offer = Math.min(n.treasures, Math.max(1, Math.ceil(n.treasures / 2)));
  const draw = () => {
    showOverlay(`<div class="modal" role="dialog" aria-label="Позвать на помощь">
      <h2>Позвать на помощь</h2>
      <p class="muted" style="margin:0">Не хватает ${n.monsters - n.heroes + (n.warrior ? 0 : 1)} силы. Помощник добавит свою силу, а вы пообещаете ему часть клада.</p>
      <div class="pick-list">${h.helpTargets.map(id => { const p = pl(id); return `<button class="pick" data-helpto="${id}" aria-pressed="${id === target}" style="--seat:${p.color}"><span class="ava">${avatarSVG(p.avatar, p.color)}</span><span><b>${esc(p.name)}</b><br><small class="muted">сила ${p.power}, ${esc(raceText(p))}</small></span></button>`; }).join('')}</div>
      <div><div class="muted" style="font-size:14px">Сколько карт клада отдать из ${n.treasures}</div><div class="stepper"><button class="btn small" data-offer="-1" aria-label="Меньше">−</button><b>${offer}</b><button class="btn small" data-offer="1" aria-label="Больше">+</button></div></div>
      <div class="row"><button class="btn hero" data-act="sendHelp">Позвать</button><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>
    </div>`);
  };
  S.ui.helpForm = { get: () => ({ target, offer }), setT: t => { target = t; draw(); }, setO: d => { offer = Math.max(0, Math.min(n.treasures, offer + d)); draw(); } };
  draw();
}

function maybeHelpPrompt() {
  const g = S.game;
  const req = g.combat?.helpReq;
  if (!req || req.to !== S.room.me) { if (S.ui.helpAsked && $('#helpPrompt')) closeOverlay(); S.ui.helpAsked = null; return; }
  if (S.ui.helpAsked === req.at && $('#helpPrompt')) return;
  S.ui.helpAsked = req.at;
  sfx.play('bell', { always: true });
  const n = g.combat.numbers;
  const mine = me();
  const myStr = mine.power + (mine.nextCombat || 0);
  showOverlay(`<div class="modal" id="helpPrompt" role="alertdialog" aria-label="Просьба о помощи">
    <h2>${esc(pname(req.from))} зовёт на помощь</h2>
    <p style="margin:0">Бой против ${g.combat.monsters.map(m => '«' + esc(def(m.uid).name) + '»').join(', ')}. Сейчас ${n.heroes} против ${n.monsters}, с вами будет около ${n.heroes + myStr}.</p>
    <p style="margin:0">Обещает <b>${req.offer}</b> ${plural(req.offer, 'карту', 'карты', 'карт')} клада.${mine.races.some(u => def(u).race === 'elf') ? ' Вы эльф: за победу получите уровень.' : ''} Если проиграете, расплата достанется и вам.</p>
    <div class="row"><button class="btn hero" data-help="1">Помочь</button><button class="btn ghost" data-help="0">Отказаться</button></div>
  </div>`);
}

function maybeEndScreen() {
  const g = S.game;
  if (g.phase !== 'ended') return;
  if ($('#endScreen')) return;
  const w = g.winners.map(pl).filter(Boolean);
  const isHost = S.room.hostId === S.room.me;
  setTimeout(() => { fx.confetti({ n: 180 }); fx.sparkle($('#endScreen .crownbig'), { n: 22 }); }, 80);
  setTimeout(() => cine.gameOver(), 500);
  sfx.play(w.some(p => p.id === S.room.me) ? 'fanfare' : 'victory', { always: true });
  showOverlay(`<div class="modal endscreen" id="endScreen" role="dialog" aria-label="Итоги партии">
    ${iconSVG('crown', 'crownbig')}
    <h2>${w.map(p => esc(p.name)).join(' и ')} ${w.length > 1 ? 'побеждают' : 'побеждает'}!</h2>
    <p class="muted" style="margin:0">${w.some(p => p.id === S.room.me) ? 'Подземелье покорено. Можно гордиться.' : 'В следующий раз подставляйте лидера раньше.'}</p>
    <div class="row" style="justify-content:center">${isHost ? '<button class="btn primary" data-act="toLobby">Новая партия</button>' : '<span class="muted">Новую партию запускает хозяин.</span>'}<button class="btn ghost" data-act="closeOverlay">Посмотреть стол</button></div>
  </div>`);
}

const RULES = `<div class="modal rules" role="dialog" aria-label="Как играть" style="max-width:640px">
  <h2>Как играть</h2>
  <p>Каждый начинает человеком первого уровня с 4 картами проходов и 4 картами клада. Побеждает тот, кто первым дойдёт до <b>10-го уровня</b>. Последний уровень берётся только победой над монстром.</p>
  <h3>Ход</h3>
  <p>1. Разложите расу, класс и вещи. 2. <b>Выбейте дверь</b>: монстр — бой, проклятие — сработает на вас, остальное уходит в руку. 3. Если монстра не было — сразитесь с монстром из руки или обшарьте комнату. 4. Лишние карты сверх пяти отдаются самому слабому.</p>
  <h3>Бой</h3>
  <p>Ваша сила — уровень плюс надетые вещи. Если она больше силы монстров, жмите «Добить!». У остальных есть несколько секунд, чтобы помешать: усилить монстра, подбросить ещё одного, ударить в спину. За победу — уровень и клад. Не хватает сил — зовите на помощь, пообещав часть клада, или бегите: побег удаётся на 5–6 кубика. Не убежали — получите расплату с карты монстра.</p>
  <h3>Вещи и уровни</h3>
  <p>Один головняк, один броник, одна обувка, две руки и одна большая вещь (гномам — сколько угодно, механикам — три руки). Можно завести одного питомца: он даёт бонус и один раз спасает от расплаты. Вещи можно продать: каждые 1000 голдов — уровень.</p>
  <h3>Расы и классы</h3>
  <p>Расы: эльф, гном, полурослик, орк, гоблин и кротолюд. Классы: воин, маг, жрец, плут, бард, алхимик и механик. У каждого свои способности — они написаны на картах, а кнопки способностей появляются у вас на столе.</p>
  <h3>Локации и события</h3>
  <p>Карта локации меняет правила для всех, пока кто-нибудь не сыграет другую: в затопленном тоннеле труднее убежать, на рынке вещи дороже, в котельной проклятия тают. События срабатывают сразу для всего стола. Зелья дают бонус в текущем или следующем бою.</p>
  <h3>Особые монстры</h3>
  <p>Одни нападают из засады, едва вы открыли дверь, другие не терпят помощников, от третьих не убежать. Зеркальный двойник всегда сильнее лидера партии. Читайте карту, прежде чем драться.</p>
  <h3>Смерть</h3>
  <p>Погибший теряет вещи и руку, но сохраняет уровень, расу и класс. В свой следующий ход он возвращается с новыми картами.</p>
  <button class="btn primary" data-act="closeOverlay">Понятно</button>
</div>`;

// ───────────────────────── эффекты ─────────────────────────
// Сервер присылает короткий журнал событий (fx). Новые события проигрываются после перерисовки стола.
function handleFx(first) {
  const g = S.game;
  if (!g) return [];
  const list = g.fx || [];
  const maxId = list.length ? list[list.length - 1].id : 0;
  if (S.ui.lastFx === null || first) { S.ui.lastFx = maxId; S.ui.lastLoc = g.location; return []; }
  const fresh = list.filter(f => f.id > S.ui.lastFx);
  S.ui.lastFx = maxId;
  if (cine.on) { cine.prehide(fresh); return fresh; }
  for (const f of fresh) {
    if (f.kind === 'dice') S.ui.dieQueue.push(f);
    if (f.kind === 'combat' || f.kind === 'wandering') S.ui.slam = { uid: f.card, ambush: false };
    if (f.kind === 'ambush' && S.ui.slam) S.ui.slam.ambush = true;
  }
  return fresh;
}
const avaOf = pid => pid === S.room?.me ? $('#meava') : document.querySelector(`[data-opp="${pid}"] .ava`);
cine.init({
  meId: () => S.room?.me,
  pname,
  avaOf,
  heroAva: pid => document.querySelector(`#stage .hero-pill[data-pid="${CSS.escape(pid)}"] .ava`),
  lvlEl: pid => (pid === S.room?.me ? $('#mecard .lvl') : document.querySelector(`[data-opp="${pid}"] .lvl`)),
  color: pid => pl(pid)?.color || '#f5b83d',
  avatar: pid => pl(pid)?.avatar,
});
function soundFx(fresh) {
  const kinds = new Set(fresh.map(f => f.kind));
  for (const f of fresh) {
    switch (f.kind) {
      case 'reveal': sfx.play('door'); break;
      case 'combat': case 'wandering': {
        const lv = def(f.card)?.level ?? 5;
        sfx.play('growl', { delay: kinds.has('reveal') ? 0.4 : 0.1, pitch: 1.35 - Math.min(lv, 20) / 28, dur: 0.6 + Math.min(lv, 20) / 40 });
        break;
      }
      case 'ambush': sfx.play('ambush', { delay: 0.42 }); break;
      case 'curse': sfx.play('curse'); break;
      case 'death': sfx.play('death', { delay: 0.1 }); break;
      case 'levelUp': sfx.play('levelUp', { delay: kinds.has('victory') ? 0.75 : 0 }); break;
      case 'levelDown': sfx.play('levelDown'); break;
      case 'victory': sfx.play('victory'); break;
      case 'pet': sfx.play('pet'); break;
      case 'buff': sfx.play('buff'); break;
      case 'location': sfx.play('location'); break;
      case 'event': sfx.play('event'); if (def(f.card)?.event === 'quake') sfx.play('quake', { delay: 0.1 }); break;
      case 'mod': sfx.play(f.side === 'monster' ? 'modBad' : 'modGood'); break;
      case 'enhance': sfx.play(def(f.card)?.bonus < 0 ? 'modGood' : 'enhance'); break;
      case 'backstab': sfx.play('backstab'); break;
      case 'lullaby': sfx.play('lullaby'); break;
      case 'mutagen': sfx.play('mutagen'); break;
      case 'legendary': sfx.play('legendary', { always: true }); break;
    }
  }
}
function runFx(fresh, snap) {
  if (cine.on) return cine.play(fresh, snap);
  soundFx(fresh);
  for (const f of fresh) {
    const ava = avaOf(f.pid);
    switch (f.kind) {
      case 'levelUp':
        fx.rise(ava); fx.float(ava, `+${f.to - f.from} ур.`, 'good'); fx.shake(ava?.closest('.opp') || ava, 'flash-up');
        break;
      case 'levelDown':
        fx.drops(ava); fx.float(ava, `−${f.from - f.to} ур.`, 'bad'); fx.shake(ava?.closest('.opp') || ava);
        break;
      case 'curse':
        fx.smoke(ava); fx.float(ava, 'Проклятие!', 'curse'); fx.shake(ava?.closest('.opp') || ava);
        break;
      case 'death':
        fx.dust(ava, { n: 22 }); fx.float(ava, 'Погиб!', 'bad');
        if (f.pid === S.room.me) toast('Вы погибли. Вернётесь в свой следующий ход с новыми картами.');
        break;
      case 'pet':
        fx.hearts(ava); fx.float(ava, `${def(f.card).name} спасает!`, 'good');
        break;
      case 'buff':
        fx.sparkle(ava, { colors: ['#ffb0c8', '#ff7aa8', '#fff3b0'] }); fx.float(ava, `+${f.n} в бою`, 'good');
        break;
      case 'victory': {
        const st = $('#stage');
        fx.banner('Победа!', `${pname(f.pid)} одолевает монстров`, 'win');
        fx.confetti({ at: st, n: 90 });
        fx.coins(st, avaOf(f.pid), { n: 14 });
        break;
      }
      case 'location': {
        const d = def(f.card);
        fx.banner(d.name, d.text, 'loc');
        const st = $('#stage');
        setTimeout(() => fx.ambient(st, d.art), 200);
        const b = $('#locBanner'); if (b) fx.shake(b, 'pop-in');
        break;
      }
      case 'event': {
        const d = def(f.card);
        fx.banner(d.name, d.text, 'event');
        fx.burst($('#stage'), { n: 30, speed: 340, g: 160 });
        if (d.event === 'quake') { fx.shake(document.querySelector('.game'), 'quake'); fx.dust($('#stage'), { n: 30, rocks: 14 }); }
        break;
      }
      case 'mod': {
        const el = f.side === 'monster' ? $('#shieldMon') : $('#shieldHero');
        fx.float(el, `${f.n > 0 ? '+' : '−'}${Math.abs(f.n)}`, f.side === 'monster' ? 'bad' : 'good');
        fx.burst(el, { n: 16, colors: f.side === 'monster' ? undefined : ['#8ff0d2', '#3fa38c', '#fff'], speed: 220 });
        fx.shake(el, 'bump');
        break;
      }
      case 'enhance': {
        const el = $('#shieldMon');
        const d = def(f.card);
        fx.float(el, d.double ? '×2' : `${d.bonus > 0 ? '+' : '−'}${Math.abs(d.bonus)}`, d.bonus < 0 ? 'good' : 'bad');
        fx.burst(el, { n: 20, colors: ['#ff8a66', '#d2502f', '#ffd27a'], speed: 260 });
        fx.shake(el, 'bump');
        break;
      }
      case 'backstab': {
        const el = $('#shieldHero');
        fx.float(el, '−2', 'bad'); fx.burst(el, { n: 14, colors: ['#ff8a66', '#d2502f'], speed: 260 }); fx.shake(el, 'bump');
        break;
      }
      case 'mutagen': {
        const el = $('#shieldHero');
        fx.float(el, '+10', 'good'); fx.burst(el, { n: 30, colors: ['#a6f2b7', '#3fa38c', '#e6fbff'], speed: 300 }); fx.shake(el, 'bump');
        fx.smoke(ava || el, { colors: ['rgba(120,255,170,.45)', 'rgba(60,200,140,.4)'], sparks: false });
        fx.banner('Мутаген!', `${pname(f.pid)}: +10 к силе`, 'win');
        break;
      }
      case 'legendary': {
        const d = def(f.card);
        fx.banner(d.name, `Легендарная вещь у ${pname(f.pid)}`, 'legend');
        fx.sparkle(ava, { n: 26, colors: ['#fff3b0', '#ffd56a', '#ffffff', '#a6f2ff'] });
        fx.burst(ava, { n: 34, colors: ['#ffe08a', '#f5b83d', '#fff'], speed: 320, g: 120 });
        break;
      }
      case 'lullaby': {
        const el = $('#shieldMon');
        fx.notes(ava || $('#shieldHero'), el);
        setTimeout(() => { fx.float(el, '−3', 'good'); fx.shake(el, 'bump'); }, 500);
        break;
      }
    }
  }
  playDice();
}
function playDice() {
  if (S.ui.dieBusy || !S.ui.dieQueue.length) return;
  const f = S.ui.dieQueue.shift();
  S.ui.dieBusy = true;
  const label = `${pname(f.pid)}: ${f.label || 'бросок'}${f.bonus ? ` (${f.bonus > 0 ? '+' : ''}${f.bonus})` : ''} — ${f.ok ? 'успех' : 'неудача'}`;
  fx.dice($('#fx'), f.value, f.ok, label);
  sfx.play('dice', { always: true });
  setTimeout(() => sfx.play(f.ok ? 'diceOk' : 'diceFail', { always: true }), 900);
  setTimeout(() => { $('#fx').innerHTML = ''; S.ui.dieBusy = false; playDice(); }, 2100);
}

// ───────────────────────── обработка кликов ─────────────────────────
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('[data-uid]')) sfx.play(S.ui.mode ? 'click' : 'flip');
  else if (t.closest('.btn, .seg button, .tabs button, .opp, .pick, .room-row, .av-opt, .av-sw, .hero-ava')) sfx.play('click');
  if (t.matches('[data-backdrop]')) {
    if ($('#helpPrompt')) return; // на просьбу о помощи нужно ответить
    return closeOverlay();
  }
  const opt = t.closest('[data-popopt]');
  if (opt) {
    const o = popOpts[Number(opt.dataset.popopt)];
    if (!o) return;
    if (o.fn) return o.fn();
    const fly = flySource(o.action);
    const r = await act(o.action);
    if (r.ok) { closeOverlay(); flyCard(fly, o.action); }
    return;
  }
  const join = t.closest('[data-join]');
  if (join) {
    if (!S.name.trim()) return openJoinModal(join.dataset.join, S.rooms.find(r => r.id === join.dataset.join));
    return tryJoin(join.dataset.join, join.dataset.locked === 'true' ? undefined : '');
  }
  const helpAns = t.closest('[data-help]');
  if (helpAns) { const r = await act({ type: 'answerHelp', accept: helpAns.dataset.help === '1' }); if (r.ok) closeOverlay(); return; }
  const helpTo = t.closest('[data-helpto]');
  if (helpTo) return S.ui.helpForm.setT(helpTo.dataset.helpto);
  const off = t.closest('[data-offer]');
  if (off) return S.ui.helpForm.setO(Number(off.dataset.offer));
  const kick = t.closest('[data-kick]');
  if (kick) { const r = await call('room:kick', { memberId: kick.dataset.kick }); if (!r.ok) toast(r.error); return; }
  const delay = t.closest('[data-delay]');
  if (delay) { const r = await call('room:settings', { winDelayMs: Number(delay.dataset.delay) }); if (!r.ok) toast(r.error); return; }
  const max = t.closest('[data-max]');
  if (max) { const r = await call('room:settings', { maxPlayers: Number(max.dataset.max) }); if (!r.ok) toast(r.error); return; }
  const tab = t.closest('[data-tab]');
  if (tab) return setTab(tab.dataset.tab);
  const avk = t.closest('[data-av-k]');
  if (avk) { S.ui.avEdit.cfg[avk.dataset.avK] = Number(avk.dataset.avV); return drawAvatarEditor(); }
  const avt = t.closest('[data-av-tab]');
  if (avt) { S.ui.avEdit.tab = avt.dataset.avTab; return drawAvatarEditor(); }
  const ab = t.closest('[data-ability]');
  if (ab) return startAbility(ab.dataset.ability);
  const opp = t.closest('[data-opp]');
  if (opp) return openOppPop(opp.dataset.opp);

  const card = t.closest('[data-uid]');
  if (card && !t.closest('.pop') && !t.closest('[data-zone-view]')) {
    const zone = card.dataset.zone || (card.classList.contains('chip') ? 'table' : 'view');
    if (S.ui.mode && (zone === 'hand' || zone === 'table')) return togglePick(card.dataset.uid, zone);
    return openCardPop(card.dataset.uid, zone);
  }

  const a = t.closest('[data-act]')?.dataset.act;
  if (!a) return;
  switch (a) {
    case 'closeOverlay': return closeOverlay();
    case 'sound': return openSoundModal();
    case 'avatar': return openAvatarEditor();
    case 'avatarRandom': S.ui.avEdit.cfg = avatarFromSeed(Math.floor(Math.random() * 1e6)); return drawAvatarEditor();
    case 'avatarSave': return saveAvatar();
    case 'soundTest': return sfx.play('victory', { gap: 0 });
    case 'rules': return showOverlay(RULES);
    case 'copy': {
      const text = `Заходи в «Под Землёй»: ${inviteLink()}${S.room.locked ? ' (пароль скажу отдельно)' : ''}`;
      try { await navigator.clipboard.writeText(text); toast('Приглашение скопировано', true); } catch { prompt('Скопируйте ссылку', inviteLink()); }
      return;
    }
    case 'leave': {
      const id = S.room.id;
      await call('room:leave');
      dropToken(id); S.room = null; S.game = null; setUrl(null); closeOverlay(); render();
      const lst = await call('lobby:watch'); if (lst.ok) { S.rooms = lst.rooms; renderRooms(); }
      return;
    }
    case 'menu': {
      const isHost = S.room.hostId === S.room.me;
      return showOverlay(`<div class="modal" role="dialog" aria-label="Меню"><h2>Меню</h2>
        <button class="btn" data-act="avatar">Внешность героя</button>
        <button class="btn" data-act="copy">Скопировать приглашение</button>
        ${isHost && S.game.phase === 'playing' ? '<button class="btn danger" data-act="abort">Завершить партию для всех</button>' : ''}
        ${isHost && S.game.phase === 'ended' ? '<button class="btn primary" data-act="toLobby">Новая партия</button>' : ''}
        <button class="btn ghost" data-act="leave">${S.game.phase === 'playing' ? 'Выйти (за вас доиграет автопилот)' : 'Выйти из комнаты'}</button>
        <button class="btn ghost" data-act="closeOverlay">Вернуться к игре</button></div>`);
    }
    case 'sideToggle': S.ui.sideOpen = !S.ui.sideOpen; $('#sidepanel').classList.toggle('open', S.ui.sideOpen); return;
    case 'addBot': { const r = await call('room:addBot'); if (!r.ok) toast(r.error); return; }
    case 'start': { const r = await call('room:start'); if (!r.ok) toast(r.error); return; }
    case 'toLobby': { closeOverlay(); const r = await call('room:toLobby'); if (!r.ok) toast(r.error); return; }
    case 'abort': { if (!confirm('Завершить партию для всех?')) return; closeOverlay(); const r = await call('room:abort'); if (!r.ok) toast(r.error); return; }
    case 'setPassword': {
      const pw = prompt('Новый пароль комнаты');
      if (pw === null) return;
      const r = await call('room:settings', { password: pw }); if (!r.ok) toast(r.error); else toast(pw ? 'Пароль сохранён' : 'Пароль убран', true);
      return;
    }
    case 'clearPassword': { const r = await call('room:settings', { password: '' }); if (!r.ok) toast(r.error); return; }
    case 'kick': case 'loot': case 'fight': case 'runAway': case 'autoEquip': case 'cancelHelp': case 'pass':
      return act({ type: a });
    case 'endTurn': {
      const h = hints();
      if (h.mustGive) { S.ui.mode = { kind: 'give', need: h.mustGive, picked: [] }; return render(); }
      return act({ type: 'endTurn', give: [] });
    }
    case 'trouble': {
      const monsters = me().hand.filter(u => def(u).type === 'monster');
      if (monsters.length === 1) return act({ type: 'lookForTrouble', uid: monsters[0] });
      popOpts = monsters.map(u => ({ label: `${def(u).name} (ур. ${def(u).level})`, action: { type: 'lookForTrouble', uid: u }, cls: 'danger' }));
      return showOverlay(`<div class="modal" role="dialog" aria-label="Выбор монстра"><h2>С кем драться?</h2><div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`);
    }
    case 'askHelp': return openHelpModal();
    case 'sendHelp': {
      const { target, offer } = S.ui.helpForm.get();
      const r = await act({ type: 'askHelp', to: target, offer });
      if (r.ok) closeOverlay();
      return;
    }
    case 'sellMode': S.ui.mode = { kind: 'sell', picked: [] }; return render();
    case 'modeOk': return modeOk();
    case 'modeCancel': S.ui.mode = null; return render();
  }
});

// ───────────────────────── внешность героя ─────────────────────────
const AV_TABS = [
  { id: 'face', label: 'Лицо', rows: [['skin', 'Кожа', SKIN.map(c => c[1])], ['eyes', 'Глаза'], ['brows', 'Брови'], ['mouth', 'Рот']] },
  { id: 'hair', label: 'Волосы', rows: [['hair', 'Причёска'], ['hairColor', 'Цвет волос', HAIRC], ['facial', 'Борода и усы']] },
  { id: 'hat', label: 'Шапка', rows: [['hat', 'Головной убор'], ['hatColor', 'Цвет', CLOTH]] },
  { id: 'acc', label: 'Аксессуары', rows: [['glasses', 'Очки'], ['extra', 'Приметы'], ['shirt', 'Одежда', CLOTH]] },
  { id: 'bg', label: 'Фон', rows: [['bg', 'Цвет фона', BGC]] },
];
const seatColor = () => S.room?.members.find(m => m.id === S.room.me)?.color || '#f5b83d';
function openAvatarEditor() {
  S.ui.avEdit = { cfg: { ...S.avatar }, tab: S.ui.avEdit?.tab || 'face' };
  drawAvatarEditor();
}
function drawAvatarEditor() {
  const E = S.ui.avEdit, cfg = E.cfg, sc = seatColor();
  const tab = AV_TABS.find(t => t.id === E.tab) || AV_TABS[0];
  const row = ([k, title, colors]) => {
    const n = AVATAR_PARTS[k];
    const items = Array.from({ length: n }, (_, i) => colors
      ? `<button class="av-sw${cfg[k] === i ? ' on' : ''}" data-av-k="${k}" data-av-v="${i}" style="--c:${colors[i] || sc}" aria-pressed="${cfg[k] === i}" aria-label="${title} ${i + 1}" title="${k === 'bg' && i === 0 ? 'Цвет вашего места' : ''}">${k === 'bg' && i === 0 ? '<i>место</i>' : ''}</button>`
      : `<button class="av-opt${cfg[k] === i ? ' on' : ''}" data-av-k="${k}" data-av-v="${i}" aria-pressed="${cfg[k] === i}" title="${esc(AV_LABELS[k]?.[i] || '')}" aria-label="${esc(AV_LABELS[k]?.[i] || title)}">${avatarSVG({ ...cfg, [k]: i }, sc)}</button>`).join('');
    return `<div class="av-row"><div class="av-title">${title}${!colors && AV_LABELS[k] ? `: <b>${esc(AV_LABELS[k][cfg[k]])}</b>` : ''}</div><div class="${colors ? 'av-swatches' : 'av-grid'}">${items}</div></div>`;
  };
  showOverlay(`<div class="modal av-modal" role="dialog" aria-label="Внешность героя" id="avModal">
    <h2>Внешность героя</h2>
    <div class="av-body">
      <div class="av-side">
        <div class="av-preview" style="--seat:${sc}">${avatarSVG(cfg, sc)}</div>
        <button class="btn small" data-act="avatarRandom">Случайно</button>
      </div>
      <div class="av-main">
        <div class="tabs av-tabs" role="tablist">${AV_TABS.map(t => `<button role="tab" data-av-tab="${t.id}" aria-selected="${t.id === tab.id}">${t.label}</button>`).join('')}</div>
        <div class="av-rows">${tab.rows.map(row).join('')}</div>
      </div>
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeOverlay">Отмена</button><button class="btn primary" data-act="avatarSave">Сохранить</button></div>
  </div>`);
}
async function saveAvatar() {
  S.avatar = cleanAvatar(S.ui.avEdit.cfg);
  LS.set('avatar', S.avatar);
  closeOverlay();
  const home = $('#homeAva'); if (home) home.innerHTML = avatarSVG(S.avatar, '#f5b83d');
  if (S.room) { const r = await call('me:avatar', { avatar: S.avatar }); if (!r.ok) toast(r.error); else toast('Внешность обновлена', true); }
  else toast('Внешность сохранена', true);
}

// ───────────────────────── настройки звука ─────────────────────────
const SPEAKER = on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${on
  ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  : '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
function soundIcons() {
  const on = sfx.state.on && sfx.state.vol > 0;
  document.querySelectorAll('.sound-btn').forEach(b => { b.innerHTML = SPEAKER(on); b.setAttribute('aria-label', on ? 'Звук включён' : 'Звук выключен'); });
}
// живой фон: на слабых устройствах и при «уменьшить движение» по умолчанию неподвижный
const liveBg = () => LS.get('liveBg', !(matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.hardwareConcurrency || 4) <= 2));
const applyBg = () => $('#world').classList.toggle('still', !liveBg());
applyBg();
function openSoundModal() {
  const s = sfx.state;
  showOverlay(`<div class="modal" role="dialog" aria-label="Звук и эффекты" id="soundModal">
    <h2>Звук и эффекты</h2>
    <label class="check"><input type="checkbox" id="sndOn" ${s.on ? 'checked' : ''}> Звуки игры</label>
    <label>Громкость<input type="range" id="sndVol" min="0" max="1" step="0.05" value="${s.vol}"></label>
    <label class="check"><input type="checkbox" id="sndAmb" ${s.amb ? 'checked' : ''}> Атмосфера пещеры: гул, ветер и капли</label>
    <label class="check"><input type="checkbox" id="liveBg" ${liveBg() ? 'checked' : ''}> Живой фон: вода, снег, светлячки (на слабом телефоне лучше выключить)</label>
    <label class="check"><input type="checkbox" id="cineOn" ${cine.enabled ? 'checked' : ''}> Зрелищные сцены: двери, удары, разрубленные карты, салют</label>
    <p class="muted" style="margin:0;font-size:13.5px">Все звуки создаются прямо в браузере. Если на телефоне тишина, проверьте беззвучный режим.</p>
    <div class="row"><button class="btn" data-act="soundTest">Послушать</button><button class="btn primary" data-act="closeOverlay">Готово</button></div>
  </div>`);
  $('#sndOn').addEventListener('change', e => { sfx.set({ on: e.target.checked }); soundIcons(); if (e.target.checked) sfx.play('yourTurn', { gap: 0 }); });
  $('#sndVol').addEventListener('input', e => { sfx.set({ vol: Number(e.target.value) }); soundIcons(); });
  $('#sndVol').addEventListener('change', () => sfx.play('coins', { n: 2, gap: 0 }));
  $('#sndAmb').addEventListener('change', e => sfx.set({ amb: e.target.checked }));
  $('#liveBg').addEventListener('change', e => { LS.set('liveBg', e.target.checked); applyBg(); });
  $('#cineOn').addEventListener('change', e => { cine.set(e.target.checked); render(); });
}

// ───────────────────────── полёт сыгранной карты ─────────────────────────
function flySource(a) {
  const uid = a?.uid;
  if (!uid) return null;
  const el = document.querySelector(`#hand .card[data-uid="${CSS.escape(uid)}"]`) || document.querySelector(`.chip[data-uid="${CSS.escape(uid)}"]`);
  if (!el) return null;
  return { uid, rect: el.getBoundingClientRect(), html: cardHTML(uid, { size: 'md', tab: false }) };
}
function flyCard(src, a) {
  if (!src) return;
  const d = def(src.uid);
  if (['equip', 'unequip', 'discardInPlay'].includes(a.type)) return;
  let to = $('#stage');
  if (a.target) to = a.target === S.room.me ? $('#meava') : document.querySelector(`[data-opp="${a.target}"] .ava`);
  else if (a.type === 'gift') to = document.querySelector(`[data-opp="${a.to}"] .ava`);
  else if (a.side === 'player') to = $('#shieldHero');
  else if (a.side === 'monster' || Number.isInteger(a.monster)) to = $('#shieldMon');
  else if (['race', 'class', 'halfbreed', 'supermunch', 'item', 'buff', 'levelup'].includes(d.type)) to = $('#meava');
  else if (d.type === 'location') to = $('#stage');
  sfx.play('whoosh');
  fx.fly(src.html, src.rect, to || $('#stage'), { onArrive: () => {
    sfx.play('place');
    const target = to || $('#stage');
    if (d.type === 'curse') fx.smoke(target, { n: 14 });
    else if (d.type === 'item' || d.type === 'race' || d.type === 'class') fx.sparkle(target, { n: 12 });
    else fx.burst(target, { n: 14, speed: 180, g: 120 });
  } });
}

function startAbility(name) {
  const h = hints();
  const g = S.game;
  const p = me();
  if (name === 'charm') {
    const ms = g.combat?.monsters || [];
    popOpts = ms.map((m, i) => ({ label: `Усыпить «${def(m.uid).name}»`, action: { type: 'ability', name: 'charm', monster: i, cards: [] }, cls: 'hero' }));
    return showOverlay(`<div class="modal" role="dialog" aria-label="Чары"><h2>Чары</h2><p style="margin:0">Сбросится вся рука: ${cardsWord(p.hand.length)}. Клад монстра достанется вам, уровня не будет.</p><div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`);
  }
  if (name === 'backstab') {
    const ts = h.abilities.backstab || [];
    if (ts.length === 1) return startMode({ kind: 'ability', name, target: ts[0], picked: [], max: 1 });
    popOpts = ts.map(id => ({ label: `Ударить ${pname(id)}`, fn: () => startMode({ kind: 'ability', name, target: id, picked: [], max: 1 }), cls: 'danger' }));
    return showOverlay(`<div class="modal" role="dialog" aria-label="Удар в спину"><h2>Кого ударить в спину?</h2><div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`);
  }
  if (name === 'steal') {
    popOpts = (h.abilities.steal || []).map(s => ({ label: `${pname(s.target)}: «${def(s.item).name}» (${def(s.item).value} г)`, fn: () => startMode({ kind: 'ability', name, target: s.target, item: s.item, picked: [], max: 1 }), cls: 'ghost' }));
    return showOverlay(`<div class="modal" role="dialog" aria-label="Кража"><h2>Что стащить?</h2><p class="muted" style="margin:0">Сбросите карту и бросите кубик: на 4–6 вещь ваша, иначе потеряете уровень.</p><div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`);
  }
  if (abilNeed(name)) return startMode({ kind: 'ability', name, picked: [], max: abilNeed(name) });
  const used = name === 'rage' ? 'rage' : name === 'turn' ? 'turnUndead' : 'escape';
  const done = g.combat?.[used]?.[p.id] || 0;
  const max = 3 - (name === 'turn' ? done / 3 : done);
  startMode({ kind: 'ability', name, picked: [], max: Math.max(1, Math.min(max, p.hand.length)) });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (S.ui.overlay && !$('#helpPrompt')) closeOverlay();
    else if (S.ui.mode) { S.ui.mode = null; render(); }
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-uid]')) { e.preventDefault(); e.target.click(); }
});
setInterval(() => { if (S.room && document.visibilityState === 'visible') socket.emit('ping:me'); }, 20000);

render();
