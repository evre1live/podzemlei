// «Под Землёй» — клиент.
import { def, RACE_NAMES, CLASS_NAMES, SETS, ALLY_SLOT_NAMES, ALLY_SLOT_TEXT, FEMME_LEVELS, REGULAR_DISCOUNT, setRuleVars, ruleText, BOSS_FLOOR, TROUBLE_BONUS, LULLABY_PENALTY, MUTAGEN_BONUS, DISTILL_COST,
  PERSONAS, GHOST_BONUS, DEATH_LEVELS, DEPTH, DEPTH_TREASURE_EVERY, TRADE_TIMEOUT_MS, TAME_MARGIN, WARLOCK_TAME, PANDORA_COST, PANDORA_MULT, PANDORA_ESCAPE, tameBonus, TRAP_FAIL_LEVELS, SHOP_CATS, dailyOf, dailyDate } from '/shared/cards.js';
import { esc, cardHTML, chipHTML, avatarSVG, iconSVG, cardBackSVG, locationSVG, cardIcon, cardText, locImg } from '/art.js';
import { fx, preloadDice } from '/fx.js';
import { sfx } from '/sfx.js';
import { setWorld, worldMood } from '/world.js';
import { cine, growlKind } from '/cine.js';
import { AVATAR_PARTS, avatarFromSeed, cleanAvatar, avatarInGame, gameRaces, pickCode } from '/shared/avatar.js';
import { AV_LABELS, LIGHTS, lookNote, portraitThumb, setAvatarLocation, sceneOf, lightOf, frameExt } from '/art-avatar.js';
import { FRAMES } from '/avatar-art.js';
import { createVoice } from '/voice.js';
import { ico } from '/icons.js';
import { initDepth, depthOn, applyDepth } from '/depth.js';
import { NEWS, NEWS_LATEST } from '/news.js';

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
  cid: LS.get('cid', null) || (() => { const c = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join(''); LS.set('cid', c); return c; })(),
  rooms: [],
  room: null, game: null,
  skew: 0,
  screen: null,
  pendingRoom: new URLSearchParams(location.search).get('room')?.toUpperCase() || null,
  // режим зрителя: какую комнату смотрим и с каким паролем (пароль живёт только до закрытия вкладки)
  watch: null,
  pendingWatch: new URLSearchParams(location.search).get('watch')?.toUpperCase() || null,
  ui: { tab: 'log', mode: null, chatSeen: 0, lastFx: null, lastReveal: 0, sideOpen: false, helpAsked: null, overlay: null, dieQueue: [], dieBusy: false, prevHand: null, slam: null, lastLoc: undefined },
};

// ───────────────────────── утилиты ─────────────────────────
function toast(text, ok = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (ok ? ' ok' : '');
  if (!ok) sfx.play('error');
  el.textContent = text;
  $('#toasts').append(el);
  // длинное сообщение висит дольше, чтобы его успели прочитать
  setTimeout(() => el.remove(), Math.min(9000, Math.max(3200, String(text || '').length * 60)));
}
const call = (ev, p) => new Promise(res => socket.emit(ev, p, r => res(r || { ok: false, error: 'Нет ответа от сервера' })));
async function act(a) {
  const r = await call('game:act', a);
  if (!r.ok) toast(r.error || 'Не получилось');
  return r;
}
const me = () => S.game?.players.find(p => p.id === S.room?.me);
const pl = id => S.game?.players.find(p => p.id === id);
// портрет героя в партии: раса — по его картам расы
const raceKeysOf = p => (p?.races || []).map(u => def(u).race);
const gAva = p => avatarInGame(p.avatar, raceKeysOf(p));
const pname = id => pl(id)?.name || S.room?.members.find(m => m.id === id)?.name || '—';
const hints = () => S.game?.hints || {};
const winLvl = () => S.game?.opts?.winLevel || S.room?.settings?.winLevel || 10;
// испытание дня: одна колода на всех и условие дня (по московской дате)
const dailyNote = on => { const d = dailyOf(dailyDate()); return on ? `Сегодня — «${d.name}»: ${d.text} Колода сегодня у всех одна.` : `Каждый день одна колода на всех и особое условие. Сегодня — «${d.name}».`; };
const WIN_NOTE = {
  5: 'Быстрая партия: примерно вдвое короче обычной, на старте у всех по 6 карт каждой колоды.',
  10: 'Обычная партия.',
  15: 'Длинная партия: примерно в полтора раза дольше обычной.',
  20: 'Очень длинная партия: почти вдвое дольше обычной.',
};
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
function setUrl(code, watching = false) {
  const u = new URL(location.href);
  u.searchParams.delete('room'); u.searchParams.delete('watch');
  if (code) u.searchParams.set(watching ? 'watch' : 'room', code);
  history.replaceState(null, '', u);
}
const inviteLink = () => `${location.origin}/?room=${S.room?.id}`;
const watchLink = () => `${location.origin}/?watch=${S.room?.id}`;
const spectating = () => !!S.room?.spectator;

// ───────────────────────── связь ─────────────────────────
socket.on('connect', async () => {
  // смотрим комнату, где у нас есть своё место, — возвращаемся за стол, а не на трибуну
  if (S.watch && S.tokens[S.watch.id]) {
    const j = await call('room:join', { roomId: S.watch.id, token: S.tokens[S.watch.id] });
    if (j.ok) { S.watch = null; return; }
    dropToken(S.watch.id);
  }
  if (S.watch) {
    const r = await call('room:watch', { roomId: S.watch.id, password: S.watch.pw, name: S.name, cid: S.cid });
    if (r.ok) return;
    S.watch = null; S.room = null; S.game = null; setUrl(null); render(); toast(r.error);
  }
  const code = S.room?.id || S.pendingRoom;
  if (code && S.tokens[code]) {
    const r = await call('room:join', { roomId: code, token: S.tokens[code] });
    if (r.ok) { S.pendingRoom = null; return; }
    dropToken(code);
    if (S.room) { S.room = null; S.game = null; render(); toast(r.error); }
  }
  // игру свернули, а ссылка потерялась (телефон перезапустил вкладку, ярлык на главном экране):
  // своё место за столом не потеряно, пока есть жетон — возвращаемся сами
  if (!S.room && !S.pendingRoom && !S.pendingWatch) {
    for (const id of Object.keys(S.tokens).slice(-5)) {
      const j = await call('room:join', { roomId: id, token: S.tokens[id] });
      if (j.ok) { toast('Вы снова за своим столом'); return; }
      dropToken(id);
    }
  }
  const lst = await call('lobby:watch');
  if (lst.ok) { S.rooms = lst.rooms; if (S.screen === 'home') renderRooms(); }
  if (S.pendingRoom && !S.room) {
    const pk = await call('room:peek', { roomId: S.pendingRoom });
    if (pk.ok && !pk.exists) roomGone(S.pendingRoom);
    else if (S.pendingRoom && !S.room) openJoinModal(S.pendingRoom);
  } else if (S.pendingWatch && !S.room) tryWatch(S.pendingWatch);
});
socket.on('watch:end', ({ reason }) => {
  vc.leave();
  S.watch = null; S.room = null; S.game = null; S.trick = null; setUrl(null);
  toast(reason || 'Комната закрылась');
  closeOverlay(); render();
  call('lobby:watch').then(l => { if (l.ok) { S.rooms = l.rooms; renderRooms(); } });
});
socket.on('disconnect', () => { if (S.room) toast('Связь потеряна. Переподключаемся…'); });
socket.on('rooms', list => { S.rooms = list; if (S.screen === 'home') renderRooms(); });
socket.on('kicked', ({ reason }) => {
  vc.leave();
  if (S.room) dropToken(S.room.id);
  S.room = null; S.game = null; setUrl(null);
  toast(reason || 'Вы вышли из комнаты');
  closeOverlay(); render();
});
// зритель за столом: игроки отдали ему место бота или автопилота — входим с жетоном этого места
socket.on('seat:granted', async ({ roomId, token }) => {
  saveToken(roomId, token);
  const r = await call('room:join', { roomId, token });
  if (!r.ok) return toast(r.error || 'Не получилось сесть за стол');
  S.watch = null; S.trick = null; S.ui.seatAsk = null;
  closeOverlay();
  sfx.play('yourTurn', { always: true });
  toast('Вы за столом! Герой, вещи и карты теперь ваши');
});
socket.on('seat:result', ({ reason }) => {
  S.ui.seatAsk = null;
  if ($('#seatModal')) closeOverlay();
  if (reason) toast(reason);
});
// режим пакостника (/IAMGOD у зрителя): свой кошелёк и рукав, видит их только он
socket.on('trick:state', t => {
  if (!S.room?.spectator || t.room !== S.room.id) return;
  S.trick = t.live ? t : null;
  if (S.screen === 'game') { render(); if ($('#shopModal')) openMarketModal(); if ($('#trickPop')) refreshTrickPop(); }
});
socket.on('room:state', ({ room, game, serverTime }) => {
  const first = !S.room || S.room.id !== room.id || S.room.me !== room.me;
  if (S.trick && (S.trick.room !== room.id || !room.spectator || game?.phase !== 'playing')) S.trick = null;
  // копия панели боя до перерисовки: на ней доиграет развязка, если бой сейчас закончится
  const snap = !first && S.game?.combat && cine.on ? cine.snapStage() : null;
  if (serverTime) S.skew = serverTime - Date.now();
  S.room = room; S.game = game;
  if (!room.spectator) S.watch = null;
  { const w = game?.opts?.winLevel || room.settings?.winLevel || 10; setRuleVars({ win: w, lux: Math.round(w * 0.7) }); }
  if (first) { setUrl(room.id, room.spectator); S.ui.lastFx = null; S.ui.watchPid = null; S.ui.mode = null; S.ui.prevHand = new Set(); S.ui.legReady = false; }
  // звук: начало моего хода и чужие сообщения в чате
  const tk = game?.phase === 'playing' ? `${game.turn.n}:${game.turn.pid}` : '';
  if (!first && tk && tk !== S.ui.turnKey && game.turn.pid === room.me) { sfx.play('yourTurn', { always: true, delay: 0.25 }); cine.turn(); }
  if (!first && tk && tk !== S.ui.turnKey) { worldMood('flare', { n: 1 }); setTimeout(() => turnSweep(game.turn.pid), 60); }
  S.ui.turnKey = tk;
  const lastMsg = room.chat.at(-1);
  if (!first && lastMsg && lastMsg.id !== S.ui.lastMsg && !lastMsg.sys && lastMsg.from !== room.me) sfx.play('pop', { always: true });
  S.ui.lastMsg = lastMsg?.id;
  vc.sync(room.voice?.peers);
  const fresh = handleFx(first);
  render();
  if ($('#shopModal')) openMarketModal();
  if ($('#contractModal')) openContractModal();
  if ($('#trickPop')) refreshTrickPop();
  if ($('#seatModal')) openSeatModal();
  if ($('#seatVoteModal')) openSeatVote();
  { const reg = !!game?.players?.find(x => x.id === room.me)?.regular;
    if (S.ui.regular === false && reg) requestAnimationFrame(shopaholicFx);
    S.ui.regular = game ? reg : undefined; }
  renderVoice();
  if (fresh.length) requestAnimationFrame(() => runFx(fresh, snap));
});

// ───────────────────────── маршрутизация экранов ─────────────────────────
function render() {
  const scr = !S.room ? 'home' : S.game ? 'game' : 'lobby';
  // сцена «Локация партии»: за портретами — текущая локация стола
  const locArt = scr === 'game' && S.game.location ? def(S.game.location).art : null;
  setAvatarLocation(locArt);
  // музыка локации: играет, пока идёт партия
  sfx.music(scr === 'game' && S.game.phase === 'playing' ? locArt || 'default' : null);
  if (scr !== S.screen) { S.screen = scr; mount[scr](); soundIcons(); }
  setWorld($('#world'), scr === 'home' ? null : scr === 'game' && S.game.location ? def(S.game.location).art : 'default');
  // фон откликается на бой: края кадра наливаются тревожным светом, у босса — лиловым
  { const g = scr === 'game' ? S.game : null, c = g?.phase === 'playing' ? g.combat : null;
    if (c) worldMood('combat', { boss: c.monsters.some(m => def(m.uid).boss), losing: !c.numbers?.winning });
    else if (g?.phase === 'playing' && g.duel) worldMood('combat', {});
    else worldMood('calm'); }
  // стекло интерфейса ловит свет сцены: мой ход, бой, локация
  { const b = document.body, g = scr === 'game' ? S.game : null, c = g?.phase === 'playing' ? g.combat : null;
    b.classList.toggle('my-turn', !!g && g.phase === 'playing' && g.turn.pid === S.room.me);
    const mood = c ? (c.monsters.some(m => def(m.uid).boss) ? 'boss' : c.numbers?.winning ? 'fight' : 'danger') : '';
    if ((b.dataset.mood || '') !== mood) b.dataset.mood = mood;
    const loc = g?.location ? def(g.location).art : '';
    if ((b.dataset.loc || '') !== loc) b.dataset.loc = loc; }
  update[scr]();
  if (scr !== 'home') renderVoice();
}
const mount = {}, update = {};

// ───────────────────────── главная ─────────────────────────
const HATCH = ico('dungeon-gate', 'hatch');
// главное меню: объёмное название (art/logo.py, Blender) и цикличное видео подземного города за воротами
// (ролик Higgsfield, петля — art/menu-loop.py). Пока видео грузится — его первый кадр картинкой.
const MENU = {
  title: '/ui/v4/title.webp?v=f7196a8c', title2x: '/ui/v4/title@2x.webp?v=063c5828',
  poster: '/ui/v4/menu-poster.webp?v=8fe4b431', poster720: '/ui/v4/menu-poster-720.webp?v=3660a312',
  mp4: { 1080: '/ui/v4/menu-1080.mp4?v=bdb35828', 720: '/ui/v4/menu-720.mp4?v=0c0487cb' },
  webm: { 1080: '/ui/v4/menu-1080.webm?v=51718e40', 720: '/ui/v4/menu-720.webm?v=bb4fb95b' },
};
// видео — только при «Живом фоне», без «уменьшить движение» и режима экономии трафика; на телефоне — 720p
function homeVideo() {
  const v = document.querySelector('.home-video');
  if (!v) return;
  const ok = liveBg() && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;
  if (!ok) { v.pause(); v.classList.remove('on'); if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } return; }
  const boxW = Math.max(innerWidth, innerHeight * 1.4) * Math.min(2, devicePixelRatio || 1);
  // VP9 легче вдвое; где его нет (Safari), — H.264
  const set = v.canPlayType('video/webm; codecs="vp9"') ? MENU.webm : MENU.mp4;
  const src = set[matchMedia('(max-width: 700px)').matches || boxW <= 1500 ? 720 : 1080];
  if (v.getAttribute('src') !== src) { v.src = src; v.addEventListener('playing', () => v.classList.add('on'), { once: true }); }
  v.play().catch(() => {});
}

mount.home = () => {
  app.innerHTML = `
  <div class="home">
    <div class="home-bg" aria-hidden="true"><img class="home-poster" src="${MENU.poster}" srcset="${MENU.poster720} 1280w, ${MENU.poster} 1920w" sizes="max(100vw, 140vh)" alt="" decoding="async"><video class="home-video" muted loop playsinline preload="none" disablepictureinpicture></video></div>
    <header class="band b-surface"><div class="grassline"></div>
      <div class="home-top"><div class="logo-row">${HATCH}<span class="spacer"></span><a class="btn ghost small" href="/guide">Справочник</a><button class="btn ghost small news-btn" data-act="news" title="Новые механики и карты по датам">Что нового${newsUnseen() ? '<i class="news-dot" aria-label="есть новое"></i>' : ''}</button><button class="btn ghost small" data-act="rules">Как играть</button></div></div>
    </header>
    <section class="band b-clay pebbles title-wrap">
      <h1 class="title has-img"><img class="title-img" src="${MENU.title}" srcset="${MENU.title} 1000w, ${MENU.title2x} 2000w" sizes="(max-width: 1100px) 92vw, 1000px" width="1000" height="155" alt="Под Землёй"></h1>
      <p class="subtitle">Карточная игра для компании от двух до шести человек. Выбивайте двери, побеждайте монстров из подвалов и тоннелей, собирайте клад и не стесняйтесь подставлять друзей. Кто первым дойдёт до 10-го уровня, тот и победил. Хозяин комнаты может выбрать быструю партию до 5-го или долгую — до 15 или 20.</p>
    </section>
    <section class="band b-rock home-main">
      <div class="panel">
        <h2>Новая комната</h2>
        <form class="form" id="createForm" autocomplete="off">
          <div class="hero-row"><button type="button" class="hero-ava" id="homeAva" data-act="avatar" aria-label="Настроить облик героя">${avatarSVG(S.avatar, '#3a3a42')}</button>
            <div><div class="muted" style="font-size:14px;margin-bottom:6px">Ваш герой</div><button type="button" class="btn small" data-act="avatar">Настроить облик</button></div></div>
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
          <button class="btn ghost" type="button" data-act="watchCode" title="Смотреть партию, не садясь за стол">Смотреть</button>
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
  $('#codeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = await typedCode();
    if (code) tryJoin(code);
  });
  homeVideo();
  renderRooms();
};
update.home = () => {};

// код из поля «Код» на главной: сразу говорим, если такой комнаты нет
async function typedCode() {
  const inp = $('#codeInput');
  const code = inp.value.trim().toUpperCase();
  if (code.length < 4) { toast('Введите код комнаты из ссылки'); return null; }
  const pk = await call('room:peek', { roomId: code, typed: true });
  if (pk.closed !== undefined) {
    inp.value = '';
    toast(pk.closed ? `Закрыто комнат: ${pk.closed}` : 'Открытых комнат не было');
    return null;
  }
  if (pk.ok && !pk.exists) { toast(`Комнаты ${code} нет. Проверьте код или попросите у друзей свежую ссылку.`); return null; }
  return code;
}

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
  // в собирающуюся комнату заходят игроком, на идущую партию — смотрят
  el.innerHTML = S.rooms.map(r => {
    const mine = !!S.tokens[r.id];
    const live = r.status !== 'lobby' && !mine;
    return `
    <div class="room-row${live ? ' live' : ''}${mine ? ' mine' : ''}">
      <button class="room-main" ${live ? `data-watch="${esc(r.id)}"` : `data-join="${esc(r.id)}"`} data-locked="${r.locked}" aria-label="${mine ? 'Вернуться за стол' : live ? 'Смотреть' : 'Войти'}: ${esc(r.name)}">
        <span class="lock">${iconSVG(r.locked ? 'amulet' : 'chest')}</span>
        <span><span class="rname">${esc(r.name)}</span><br><span class="rmeta">${r.locked ? 'с паролем' : 'без пароля'}, хозяин ${esc(r.host)}${r.watchers ? ` · ${EYE}${r.watchers}` : ''}</span></span>
        <span class="rmeta">${r.players} из ${r.max}</span>
        <span class="status ${r.status}">${mine && r.status !== 'lobby' ? 'ваше место' : st[r.status]}</span>
      </button>
      <button class="btn small ${live ? 'primary' : 'ghost'} watch-btn" data-watch="${esc(r.id)}" data-locked="${r.locked}" title="Смотреть, не садясь за стол">${EYE}Смотреть</button>
    </div>`;
  }).join('');
}

const EYE = `<svg class="eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12 C5 6.5 8.5 4.5 12 4.5 C15.5 4.5 19 6.5 22 12 C19 17.5 15.5 19.5 12 19.5 C8.5 19.5 5 17.5 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/></svg>`;

// смотреть партию: место за столом не занимается, чужие руки не видны
async function tryWatch(code, password) {
  if (S.room && !S.room.spectator) return toast('Сначала выйдите из своей комнаты');
  if (S.tokens[code]) {
    const j = await call('room:join', { roomId: code, token: S.tokens[code] });
    if (j.ok) { S.pendingWatch = null; S.watch = null; closeOverlay(); return; }
    dropToken(code);
  }
  const row = S.rooms.find(r => r.id === code);
  if (password === undefined && row?.locked) return openWatchModal(code, row);
  const r = await call('room:watch', { roomId: code, password: password || '', name: S.name, cid: S.cid });
  if (!r.ok) {
    if (r.needPassword && !$('#watchModal')) return openWatchModal(code, row);
    S.pendingWatch = null;
    return toast(r.error);
  }
  S.watch = { id: r.roomId, pw: password || '' };
  S.pendingWatch = null;
  closeOverlay();
}
function openWatchModal(code, row) {
  showOverlay(`
    <form class="modal" id="watchModal" autocomplete="off">
      <h2>Смотреть комнату ${esc(code)}</h2>
      ${row ? `<p class="muted" style="margin:0">«${esc(row.name)}», ${row.players} из ${row.max} за столом</p>` : ''}
      <p class="muted" style="margin:0">Комната закрыта паролем: смотреть игру можно, только если знаете его.</p>
      <label>Пароль комнаты<input type="password" name="password" maxlength="64" required></label>
      <div class="row"><button class="btn primary" type="submit">Смотреть</button><button class="btn ghost" type="button" data-act="closeOverlay">Отмена</button></div>
    </form>`);
  const f = $('#watchModal');
  f.password.focus();
  f.addEventListener('submit', e => { e.preventDefault(); tryWatch(code, f.password.value); });
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

// ссылка ведёт в комнату, которой уже нет (закрыли или сервер перезапускался)
function roomGone(code) {
  S.pendingRoom = null; setUrl(null);
  showOverlay(`
    <div class="modal" role="dialog" aria-label="Комната не найдена">
      <h2>Комната ${esc(code)} не найдена</h2>
      <p class="muted" style="margin:0">Её закрыли или сервер перезапускался. Создайте новую комнату и отправьте друзьям свежую ссылку.</p>
      <div class="row"><button class="btn primary" type="button" data-act="closeOverlay">Понятно</button></div>
    </div>`);
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
        <span class="voice-ctl"></span>
        <button class="btn ghost small" data-act="guide">Справочник</button>
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
  const cp = app.querySelector('.topbar [data-act="copy"]');
  if (cp) cp.textContent = r.spectator ? 'Ссылка для зрителей' : 'Скопировать приглашение';
  const seats = r.members.map(m => `
    <div class="seat ${m.id === r.me ? 'me' : ''}" style="--seat:${m.color}" data-vmember="${m.id}">
      ${isHost && m.id !== r.me ? `<button class="btn ghost small kick" data-kick="${m.id}" title="Убрать из-за стола" aria-label="Убрать ${esc(m.name)}">${ico('cross-mark')}</button>` : ''}
      ${m.id === r.me ? `<button class="ava ava-edit" data-act="avatar" aria-label="Настроить облик" title="Настроить облик">${avatarSVG(m.avatar, m.color)}<i>${ico('quill-ink')}</i></button>` : `<div class="ava">${avatarSVG(m.avatar, m.color)}</div>`}
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
      <div><div class="muted" style="font-size:14px;margin-bottom:6px">До какого уровня играем</div>
        <div class="seg" role="group" aria-label="Уровень победы">${[5, 10, 15, 20].map(v => `<button type="button" data-win="${v}" aria-pressed="${(r.settings.winLevel || 10) === v}">${v === 5 ? `${ico('stopwatch')}5` : v}</button>`).join('')}</div>
        <div class="muted" style="font-size:13px;margin-top:6px">${WIN_NOTE[r.settings.winLevel || 10] || WIN_NOTE[10]}</div></div>
      <div><div class="muted" style="font-size:14px;margin-bottom:6px">Испытание дня</div>
        <div class="seg" role="group" aria-label="Испытание дня"><button type="button" data-daily="0" aria-pressed="${!r.settings.daily}">Обычная</button><button type="button" data-daily="1" aria-pressed="${!!r.settings.daily}">${ico('calendar')}Испытание дня</button></div>
        <div class="muted" style="font-size:13px;margin-top:6px">${dailyNote(!!r.settings.daily)}</div></div>
      <div><div class="muted" style="font-size:14px;margin-bottom:6px">Сколько секунд даётся, чтобы помешать добить монстра</div>
        <div class="seg" role="group">${[10000, 20000, 30000].map(v => `<button type="button" data-delay="${v}" aria-pressed="${r.settings.winDelayMs === v}">${v / 1000} с</button>`).join('')}</div></div>
      <div><div class="muted" style="font-size:14px;margin-bottom:6px">Мест за столом</div>
        <div class="seg" role="group">${[2, 3, 4, 5, 6].map(v => `<button type="button" data-max="${v}" aria-pressed="${r.maxPlayers === v}">${v}</button>`).join('')}</div></div>
      <div class="row"><button class="btn small" data-act="setPassword">${r.locked ? 'Сменить пароль' : 'Поставить пароль'}</button>${r.locked ? '<button class="btn ghost small" data-act="clearPassword">Убрать пароль</button>' : ''}</div>
    </div>` : `<p class="muted" style="margin-top:24px">Играем до ${r.settings.winLevel || 10}-го уровня.${r.settings.daily ? ' ' + dailyNote(true) : ''} Настройки и старт — у хозяина комнаты. ${r.locked ? 'Комната закрыта паролем.' : ''}</p>`;
  const enough = r.members.length >= 2;
  if (r.spectator) {
    const free = r.status === 'lobby' && r.members.length < r.maxPlayers;
    $('#startbar').innerHTML = `<span class="watch-pill on">${EYE}Вы зритель</span>${free ? '<button class="btn primary" data-act="sitDown">Сесть за стол</button>' : ''}<span class="muted">${free ? 'Пока партия не началась, можно занять свободное место.' : 'Свободных мест нет — смотрите, как играют другие.'}</span>`;
    renderChat();
    return;
  }
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
    else if (r.trick) trickFx(r.note);
    else if (r.note) toast(r.note);
  });
}
function renderChat() {
  const el = $('#chatfeed');
  if (!el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  el.innerHTML = S.room.chat.map(m => m.sys
    ? `<div class="sys">${esc(m.text)}</div>`
    : `<div class="msg${m.spectator ? ' spec' : ''}"><b style="color:${esc(m.color)}">${esc(m.name)}</b>${m.spectator && m.name !== 'Зритель' ? ' <small>зритель</small>' : ''}<b style="color:${esc(m.color)}">:</b> ${esc(m.text)}</div>`).join('') || '<div class="sys">Здесь пока тихо.</div>';
  if (near) el.scrollTop = el.scrollHeight;
}

// ───────────────────────── игра ─────────────────────────
mount.game = () => {
  app.innerHTML = `
  <div class="game">
    <div class="band b-surface"><div class="grassline"></div>
      <div class="g-head">
        <div class="hud-chips">
          <span id="locpill" class="locpill"></span>
          <span class="turninfo" id="turninfo"></span>
          <span class="goal-pill" id="goalpill" title="Уровень победы"></span>
          <span id="depthpill"></span>
          <span id="marketpill"></span>
          <span id="contractpill"></span>
          <span id="dailypill"></span>
          <span id="watchpill"></span>
        </div>
        <span class="spacer"></span>
        <span class="voice-ctl"></span>
        <button class="btn ghost small side-toggle" data-act="sideToggle"><span class="long-label">Летопись и чат</span><span class="short">Чат</span></button>
        <button class="btn ghost small icon-btn sound-btn" data-act="sound" aria-label="Звук" title="Звук"></button>
        <button class="btn ghost small hud-btn" data-act="rules" title="Правила" aria-label="Правила">${ico('rule-book')}<span class="lbl">Правила</span></button>
        <button class="btn ghost small hud-btn" data-act="menu" title="Меню" aria-label="Меню">${ico('hamburger-menu')}<span class="lbl">Меню</span></button>
      </div>
    </div>
    <div class="band b-clay pebbles"><div class="opps" id="opps"></div></div>
    <div class="band b-rock cave" id="cave">
      <div class="table-bg" id="tableBg" aria-hidden="true"><div class="tb-mat"></div><div class="tb-glow"></div><div class="tb-frame"></div><div class="tb-props" id="tableProps"></div></div>
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
  preloadDice();
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
  document.title = `${r.name} — Под Землёй`;
  const tp = pl(g.turn.pid);
  { const ti = $('#turninfo');
    ti.textContent = g.phase === 'ended' ? 'Партия окончена' : tp ? (tp.id === r.me ? 'Ваш ход' : `Ходит ${tp.name}`) : '';
    ti.style.setProperty('--who', tp?.color || '#d6a85a');
    ti.classList.toggle('mine', g.phase === 'playing' && tp?.id === r.me);
    ti.classList.toggle('over', g.phase === 'ended'); }
  $('#goalpill').innerHTML = `${ico('flag-objective')}<span><span class="lbl">Цель: </span>${winLvl()}<span class="lbl"> ур.</span></span>`;
  $('#depthpill').innerHTML = depthPill(g.depth);
  const dl = g.opts?.daily ? dailyOf(g.opts.daily) : null;
  $('#dailypill').innerHTML = dl ? `<span class="daily-pill" title="${esc(`Испытание дня ${g.opts.daily}: ${dl.text} Колода сегодня у всех одна.`)}">${ico('calendar')}<span class="lbl">${esc(dl.name)}</span></span>` : '';
  { const mp = me(), tr = trickOn();
    $('#marketpill').innerHTML = !g.shop || g.phase !== 'playing' ? ''
      : tr ? `<button class="market-pill trick" data-act="market" title="Рынок пакостника: купленные карты лягут в ваш рукав">${ico('double-face-mask')}<span><span class="lbl">Рынок · </span>${tr.gold} г</span></button>`
      : `<button class="market-pill${mp?.regular ? ' regular' : ''}" data-act="market" title="${mp?.regular ? `Подземный рынок: вы Шопоголик — цены на ${Math.round(REGULAR_DISCOUNT * 100)}% ниже, покупать можно в любой момент` : 'Подземный рынок: разовые, зелья, проклятия и уровни из колоды за голды из кошелька'}">${ico(mp?.regular ? 'laurels' : 'shop')}<span><span class="lbl">Рынок${mp ? ' · ' : ''}</span>${mp ? `${mp.gold} г` : ''}</span></button>`; }
  // контракт — значком в шапке, по нажатию открывается окошко
  { const k = me()?.contract;
    $('#contractpill').innerHTML = k && g.phase === 'playing' ? `<button class="contract-pill${k.progress >= k.need ? ' ready' : ''}" data-act="contract" title="${esc(`Контракт «${k.name}»: ${k.progress} из ${k.need}. Нажмите, чтобы посмотреть условие и награду`)}" aria-label="Контракт ${esc(k.name)}, ${k.progress} из ${k.need}">${ico('scroll-quill')}<span>${k.progress}/${k.need}</span></button>` : ''; }
  const wn = r.watchers || 0;
  const sv = r.seats?.vote;
  const votePill = sv?.canVote && !sv.mine ? `<button class="seat-pill" data-act="seatVote" title="Зритель просится за стол — выберите, за кого из ботов он сядет">${ico('shaking-hands')}<span>${esc(sv.name)} просится за стол</span></button>` : '';
  $('#watchpill').innerHTML = votePill + (r.spectator && trickOn() ? `<span class="watch-pill on trick" title="Это видите только вы: карты из рукава сыграют игроки, и в летописи будут их имена">${ico('double-face-mask')}Вы пакостник</span>`
    : r.spectator ? `<span class="watch-pill on" title="Вы видите стол, бои и летопись, но не чужие карты на руках">${EYE}Вы зритель${wn > 1 ? ` · ещё ${wn - 1}` : ''}</span>`
    : wn ? `<span class="watch-pill" title="Столько людей смотрят партию со стороны">${EYE}${wn}</span>` : '');
  renderOpps();
  renderStage();
  renderMine();
  renderLog();
  renderChat();
  if (S.ui.tab === 'chat') S.ui.chatSeen = r.chat.length;
  renderTabs();
  $('#sidepanel').classList.toggle('open', S.ui.sideOpen);
  maybeHelpPrompt();
  maybeTradePrompt();
  maybeSeatVote();
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
  if (p.banished) t.push('<span class="badge warn" title="«Прощай навсегда»: выбыл из партии, пока кто-нибудь не откроет Ящик Пандоры">выбыл</span>');
  else if (p.dead) t.push('<span class="badge warn">погиб</span>');
  else if (p.ghost) t.push(`<span class="badge ghost" title="Погиб и ждёт своего хода. Раз за ход может подкинуть +${GHOST_BONUS} героям или монстрам в чужом бою">призрак</span>`);
  if (p.isBot) t.push(`<span class="badge bot"${p.persona ? ` title="${esc(personaTip(p.persona))}"` : ''}>бот${p.persona ? ' · ' + esc(PERSONAS[p.persona] || '') : ''}</span>`);
  else if (mem?.autopilot) t.push('<span class="badge">автопилот</span>');
  else if (mem && !mem.connected) t.push('<span class="badge">нет связи</span>');
  return t.join('');
}
function oppHTML(p) {
  const g = S.game;
  const botTip = p.isBot ? ` title="${esc(`${p.name} — бот.${p.persona ? ' ' + personaTip(p.persona) : ''}`)}"` : '';
  // соперник сидит за дальним краем стола: медальон с уровнем и силой на кольце, имя на табличке, рядом — раса, класс и карты в руке
  const a = gAva(p), rc = reactOf(p.id);
  return `<button class="opp ${g.turn.pid === p.id ? 'turn' : ''} ${p.dead ? 'dead' : ''} ${p.ghost && !p.dead ? 'ghost' : ''}${rc.cls}" data-opp="${p.id}" data-vmember="${p.id}" style="--seat:${p.color};--fext:${frameExt(a)};${rc.st}" aria-label="${esc(p.name)}, уровень ${p.level}"${botTip}>
    <span class="hero-pill medal om${a.frame ? ' framed' : ''}"><span class="ring"><span class="ava">${avatarSVG(a, p.color)}</span>
      <b class="hm-lvl" title="Уровень">${p.level}</b><b class="hm-str" title="Сила: уровень и надетые вещи">${ico('crossed-swords')}<span>${p.power}</span></b></span>
      <span class="hp-plate"><b class="oname">${esc(p.name)}</b></span></span>
    <span class="om-info"><span class="ometa"><span>${esc(raceText(p))}</span><span>${esc(classText(p))}</span></span>
      <span class="ostats">${p.gold != null ? `<span class="gold" title="Кошелёк: голды за проданные вещи и контракты, тратятся на рынке">${ico('two-coins')}${p.gold}</span>` : ''}<span class="handcount" title="Карт в руке"><i></i>${p.handCount}</span>${statusTags(p)}</span></span>
  </button>`;
}

// геральдический щит: золотая кайма, эмаль стороны (герои — патина, монстры — кровь), заклёпки и блик
// герой в бою — медальон: портрет в кованом золотом кольце, слева на кольце — уровень, справа — сила;
// под кольцом имя на шестигранной табличке (как названия на картах)
function heroMedal(p, { str, sub = '', vmember = false, foe = false } = {}) {
  const a = gAva(p);
  return `<div class="hero-pill medal${a.frame ? ' framed' : ''}${foe ? ' foe' : ''}" data-pid="${p.id}"${vmember ? ` data-vmember="${p.id}"` : ''} style="--seat:${p.color};--fext:${frameExt(a)}">
    <span class="ring"><span class="ava">${avatarSVG(a, p.color)}</span>
      <b class="hm-lvl" title="Уровень ${p.level}">${p.level}</b>
      <b class="hm-str" title="Сила ${str}">${ico('crossed-swords')}<span>${str}</span></b></span>
    <span class="hp-plate"><b>${esc(p.name)}</b></span>${sub ? `<small class="hp-sub">${sub}</small>` : ''}</div>`;
}
const SHIELD = side => {
  const [a, b, c] = side === 'mon' ? ['#c2412f', '#6e160e', '#2a0503'] : ['#4f9a84', '#1f5545', '#081d17'];
  return `<svg viewBox="0 0 100 116" aria-hidden="true"><defs>
    <linearGradient id="sh-rim-${side}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f2ee"/><stop offset=".45" stop-color="#a9a6a0"/><stop offset=".55" stop-color="#55535a"/><stop offset="1" stop-color="#b9b6b0"/></linearGradient>
    <radialGradient id="sh-en-${side}" cx="42%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>
    <path d="M50 3 L95 17 C95 64 81 93 50 113 C19 93 5 64 5 17 Z" fill="#050403"/>
    <path d="M50 6 L92 19 C92 63 79 90 50 109 C21 90 8 63 8 19 Z" fill="url(#sh-rim-${side})"/>
    <path d="M50 13 L85 24 C85 61 74 84 50 101 C26 84 15 61 15 24 Z" fill="url(#sh-en-${side})" stroke="#050403" stroke-width="1.6"/>
    <path d="M50 13 L85 24 C85 40 83 52 79 62 C64 48 40 34 15 30 L15 24 Z" fill="#fff" opacity=".07"/>
    <path d="M50 18 L80 27" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" fill="none"/>
    ${[[50, 9.5], [12, 21], [88, 21], [50, 105]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#e8e6e2" stroke="#202024" stroke-width=".8"/>`).join('')}
  </svg>`;
};

// ───────────────────────── стол-диорама ─────────────────────────
// Стол отрендерен в Blender (art/table.py): кожаное поле с тиснением, дубовая рама с коваными уголками и предметы.
// Набор предметов и цвет света — свои у каждой локации. Слой стола лежит под сценой и не перерисовывается с ней.
const TABLE_V = 'v1';
const TP = (n, slot, flip = false) => ({ n, slot, flip });
const TABLE_PROPS = {
  default: [TP('candles', 'tl'), TP('dice', 'tr'), TP('coins', 'br'), TP('goblet', 'r'), TP('dagger', 'b')],
  loc_tavern: [TP('candles', 'tl'), TP('mug', 'tr'), TP('coins', 'br'), TP('dice', 'r'), TP('scroll', 'b')],
  loc_dungeon: [TP('candles', 'tl'), TP('keys', 'tr'), TP('coins', 'br'), TP('goblet', 'r'), TP('dagger', 'b')],
  loc_glade: [TP('candles', 'tl'), TP('mushrooms', 'tr'), TP('coins', 'br'), TP('potion', 'r'), TP('scroll', 'b')],
  loc_forge: [TP('coals', 'tl'), TP('hammer', 'tr'), TP('coins', 'br'), TP('goblet', 'r'), TP('dagger', 'b')],
  loc_ice: [TP('candles', 'tl'), TP('crystals', 'tr'), TP('coins', 'br'), TP('potion', 'r'), TP('dagger', 'b')],
  loc_graveyard: [TP('candles', 'tl'), TP('candles', 'tr', true), TP('keys', 'br'), TP('book', 'r'), TP('dagger', 'b')],
  loc_sky: [TP('candles', 'tl'), TP('crystals', 'tr'), TP('coins', 'br'), TP('goblet', 'r'), TP('scroll', 'b')],
  loc_cove: [TP('candles', 'tl'), TP('mug', 'tr'), TP('coins', 'br'), TP('dice', 'r'), TP('dagger', 'b')],
  loc_library: [TP('candles', 'tl'), TP('book', 'tr'), TP('coins', 'br'), TP('potion', 'r'), TP('scroll', 'b')],
  loc_oasis: [TP('lamp', 'tl'), TP('goblet', 'tr'), TP('coins', 'br'), TP('dice', 'r'), TP('dagger', 'b')],
  loc_flooded: [TP('candles', 'tl'), TP('keys', 'tr'), TP('coins', 'br'), TP('potion', 'r'), TP('scroll', 'b')],
  loc_grove: [TP('candles', 'tl'), TP('mushrooms', 'tr'), TP('coins', 'br'), TP('potion', 'r'), TP('dagger', 'b')],
  loc_koschei: [TP('candles', 'tl'), TP('egg', 'tr'), TP('coins', 'br'), TP('goblet', 'r'), TP('keys', 'b')],
};
// у свечей и лампы — живое пламя; координаты фитилей — в долях спрайта (art/table.py печатает их)
const TABLE_FLAMES = { candles: [[0.284, 0.077, 1], [0.581, 0.156, 0.85], [0.448, 0.496, 0.75]], lamp: [[0.95, 0.145, 0.9]] };
function syncTable(art) {
  const box = $('#tableProps');
  if (!box || box.dataset.loc === art) return;
  box.dataset.loc = art;
  box.innerHTML = (TABLE_PROPS[art] || TABLE_PROPS.default).map(({ n, slot, flip }) => {
    const fl = (TABLE_FLAMES[n] || []).map(([x, y, k]) => `<i class="tb-flame" style="left:${((flip ? 1 - x : x) * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;--k:${k}"></i>`).join('');
    return `<span class="tb-prop tp-${slot} p-${n}${fl ? ' lit' : ''}"><img src="/ui/table/${TABLE_V}/${n}.webp" alt="" decoding="async"${flip ? ' style="transform:scaleX(-1)"' : ''}>${fl}</span>`;
  }).join('');
}
// толщина колоды по числу карт: слой — около дюжины карт
const deckStack = n => {
  const k = Math.max(1, Math.min(9, Math.round(n / 12)));
  let sh = '';
  for (let i = 1; i <= k; i++) sh += `${(i * 0.45).toFixed(2)}px ${(i * 1.1).toFixed(2)}px 0 ${i % 2 ? '#2c2117' : '#100b07'}, `;
  return `box-shadow:${sh}${(k * 0.45 + 3).toFixed(1)}px ${(k * 1.1 + 8).toFixed(1)}px 14px rgba(0,0,0,.6)`;
};

function renderStage() {
  const g = S.game;
  const el = $('#stage');
  const h = hints();
  const loc = g.location ? def(g.location) : null;
  $('#cave').dataset.loc = loc ? loc.art : '';
  syncTable(loc ? loc.art : 'default');
  const decks = `<div class="decks"><div class="deck door" id="deckDoor" style="${deckStack(g.decks.door)}" title="Колода проходов" aria-label="Колода проходов: ${g.decks.door}">${cardBackSVG('door')}<span>${g.decks.door}</span></div><div class="deck treasure" id="deckTreasure" style="${deckStack(g.decks.treasure)}" title="Колода клада" aria-label="Колода клада: ${g.decks.treasure}">${cardBackSVG('treasure')}<span>${g.decks.treasure}</span></div></div>`;
  const lp = $('#locpill');
  const key = loc ? g.location : '';
  if (lp.dataset.key !== key) {
    lp.dataset.key = key;
    lp.innerHTML = loc ? `<button class="loc-banner" id="locBanner" data-uid="${esc(g.location)}" data-zone="view" title="${esc(loc.text)}">${locationSVG(loc.art)}<span><small>Локация</small><b>${esc(loc.name)}</b></span></button>`
      : `<span class="loc-banner is-default" title="Подземелье: особых правил нет. Карта локации перенесёт весь стол в новое место."><img src="/loc/v2/default-card.webp" alt="" decoding="async"><span><small>Локация</small><b>Подземелье</b></span></span>`;
  }
  // на телефоне Ящик Пандоры стоит в углу сцены рядом с колодами — вне общего потока боя
  if (g.combat) { el.innerHTML = decks + pandoraHTML(g.combat, h, 'pb-corner') + `<div class="stage-inner">${fightHTML()}</div>`; afterStage(); return; }
  if (g.duel && g.phase === 'playing') { el.innerHTML = decks + `<div class="stage-inner">${duelHTML()}</div>`; afterStage(); return; }
  const tp = pl(g.turn.pid);
  const mine = tp?.id === S.room.me;
  let title = '', text = '';
  const step = g.turn.step;
  if (g.phase === 'ended') { title = 'Партия окончена'; text = ''; }
  else if (mine) {
    if (step === 'pre') {
      title = 'Ваш ход'; text = 'Разложите вещи и выбейте дверь — посмотрим, кто за ней.';
      // ворон-разведчик подсмотрел, что за следующей дверью
      if (g.peek) text += ` <span class="peek-note">${ico('all-seeing-eye')}Ворон подсмотрел: за дверью <button class="linkish" data-uid="${esc(g.peek)}" data-zone="view">${esc(def(g.peek).name)}</button></span>`;
    }
    else if (step === 'post') {
      title = 'За дверью никого';
      const mons = me().hand.filter(u => def(u).type === 'monster').length;
      text = mons
        ? `У вас на руке ${mons === 1 ? 'есть монстр' : 'есть монстры'} — можно позвать ${mons === 1 ? 'его' : 'любого из них'} на бой: нажмите на карту в руке. Или обшарьте комнату и возьмите карту втёмную.`
        : `Можно поискать неприятности — выйдет случайный монстр по глубине подземелья, разбуженный (+${TROUBLE_BONUS} к силе), — или обшарить комнату и взять карту втёмную.`;
    }
    else if (step === 'trap' && h.trap) {
      const d = def(h.trap.uid);
      title = 'Ловушка!';
      text = `Обезвредить: ${h.trap.need}+ на кубике — и ловушка ваша, её можно подложить сопернику. Сорвётся — расплата и ещё −${TRAP_FAIL_LEVELS} ур. Не рисковать — ${esc(d.text.replace(/^Расплата:\s*/, '').replace(/\.$/, ''))}.`;
    }
    else {
      title = 'Ход почти закончен'; text = h.mustGive ? `В руке на ${cardsWord(h.mustGive)} больше нормы — лишнее уйдёт ${h.giveToLowest ? 'самому слабому игроку' : 'в сброс'}.` : 'Наведите порядок в вещах и передайте ход.';
      if (h.tame) text += ` ${esc(def(h.tame).name)} признал вашу силу — приручите его до конца хода (питомец +${tameBonus(def(h.tame))}).`;
    }
  } else if (tp) {
    title = `Ходит ${esc(tp.name)}`;
    text = step === 'pre' ? 'Готовится выбить дверь.' : step === 'post' ? 'Решает: драться с монстром из руки или обшарить комнату.' : step === 'trap' ? 'Попал в ловушку и решает, рискнуть ли её обезвредить.' : 'Заканчивает ход.';
  }
  const rv = g.tame && g.tame.pid === g.turn.pid ? { uid: g.tame.uid, seq: S.ui.lastReveal } : g.reveal;
  let reveal = '';
  if (rv && g.phase === 'playing') {
    const fresh = rv.seq !== S.ui.lastReveal;
    S.ui.lastReveal = rv.seq;
    reveal = `<div class="reveal-slot ${fresh && !cine.on ? 'reveal-in' : ''}">${cardHTML(rv.uid, { size: 'md', full: true, attrs: 'data-zone="view"' })}</div>`;
  }
  el.innerHTML = decks + `<div class="stage-inner${reveal ? ' with-reveal' : ''}"><div class="stage-msg"><h2>${title}</h2><p class="muted" style="margin:0">${text}</p></div>${reveal}<div class="act-bar">${actionButtons()}</div></div>`;
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
  if (h.trap) {
    b.push(`<button class="btn primary big" data-act="disarm" title="Кубик ${h.trap.need}+: ловушка ваша; иначе расплата и −${TRAP_FAIL_LEVELS} ур.">Обезвредить (${h.trap.need}+)</button>`);
    b.push(`<button class="btn" data-act="takeTrap">Принять расплату</button>`);
  }
  if (h.tame) b.push(`<button class="btn hero" data-act="tame" title="Зверь займёт место питомца; питомец-вещь уйдёт в запас">${ico('heavy-collar')}Приручить: +${tameBonus(def(h.tame))}</button>`);
  if (h.lookForTrouble) b.push(`<button class="btn danger" data-act="trouble" title="Бой со случайным монстром по глубине подземелья: он разбужен (+${TROUBLE_BONUS} к силе), а в самой глубине можно нарваться и на босса">Искать неприятности</button>`);
  if (h.loot) b.push(`<button class="btn" data-act="loot">Обшарить комнату</button>`);
  if (h.endTurn) b.push(`<button class="btn primary big" data-act="endTurn">${h.mustGive ? `Отдать ${cardsWord(h.mustGive)} и закончить ход` : 'Закончить ход'}</button>`);
  if (h.autoEquip && h.manage) b.push(`<button class="btn ghost small" data-act="autoEquip">Надеть лучшее</button>`);
  return b.join('');
}

const SWORDS = ico('crossed-swords');
// Ящик Пандоры: шкатулка чёрно-красного дерева в золотой оковке с аметистом, из-под крышки сочится лиловый дым;
// открытая — из неё рвутся тени в столбе лилового света (art/cut.py pandora; фон прозрачный)
function pandoraArt(open = false) {
  return `<img class="pb-img${open ? ' open' : ''}" src="/ui/v3/pandora-${open ? 'open' : 'closed'}.webp" alt="" width="300" height="${open ? 293 : 194}" decoding="async" draggable="false">`;
}
// шкатулка в бою: закрытая — кнопка (кто может заплатить), открытая — кто её открыл
function pandoraHTML(c, h, at = 'pb-top') {
  if (c.pandora) return `<div class="pandora open ${at}" title="Ящик Пандоры открыт: сила монстров ×${PANDORA_MULT}, героям −${PANDORA_ESCAPE} к побегу. Кто не убежит — лишится всех вещей и питомца">${pandoraArt(true)}<span class="pb-cap">Открыл ${esc(pname(c.pandora.by))}</span></div>`;
  const p = me();
  if (!p || p.banished) return `<div class="pandora ${at}" title="Ящик Пандоры: открыть может любой игрок за ${PANDORA_COST} г">${pandoraArt()}<span class="pb-cap">${PANDORA_COST} г</span></div>`;
  return `<button type="button" class="pandora ${at}${h?.pandora ? ' ready' : ''}" data-act="pandora" title="Ящик Пандоры: открыть за ${PANDORA_COST} г">${pandoraArt()}<span class="pb-cap">${PANDORA_COST} г</span></button>`;
}
function openPandoraModal() {
  const c = S.game?.combat, h = hints(), p = me();
  if (!c || !p) return;
  const why = c.pandora ? 'В этом бою ящик уже открыт.' : p.dead ? 'Мёртвые ящики не открывают.' : p.gold < PANDORA_COST ? `Нужно ${PANDORA_COST} г, а в кошельке ${p.gold} г.` : '';
  popOpts = [{ fn: async () => { const r = await act({ type: 'pandora' }); if (r.ok) closeOverlay(); } }];
  const self = c.fighter === p.id || c.helper === p.id;
  showOverlay(`<div class="modal pandora-modal" role="dialog" aria-label="Ящик Пандоры">
    <div class="pb-big">${pandoraArt()}</div>
    <h2>Ящик Пандоры</h2>
    <p>Откройте его за <b>${PANDORA_COST} голдов</b> — и в этом бою вся сила монстров <b>удваивается</b> (сейчас ${c.numbers?.monsters ?? '?'} → ${(c.numbers?.monsters ?? 0) * PANDORA_MULT}), а героям <b>−${PANDORA_ESCAPE} к побегу</b>. Кто из героев не убежит, лишится <b>всех вещей и питомца</b>: их раздадут другим игрокам наугад. Чернокнижник уходит тенью и ничего не теряет. В одном бою — один ящик.</p>
    ${self ? `<p class="warn-note">Это ваш собственный бой — ящик ударит по вам.</p>` : ''}
    ${why ? `<p class="muted">${esc(why)}</p>` : ''}
    <div class="row"><button class="btn danger" data-popopt="0" ${h?.pandora ? '' : 'disabled'}>Открыть за ${PANDORA_COST} г</button><button class="btn ghost" data-act="closeOverlay">Не трогать</button></div>
  </div>`);
}
// в летописи эмодзи из движка заменяются гравированными значками
const LOG_ICON = { '💀': 'skull-crossed-bones', '⛏': 'stairs', '📜': 'scroll-quill', '👹': 'horned-skull', '⚔️': 'crossed-swords', '⚔': 'crossed-swords', '🏆': 'trophy', '🤝': 'shaking-hands', '👻': 'ghost', '🛒': 'shop', '📅': 'calendar' };
const logText = t => esc(t).replace(/💀|⛏|📜|👹|⚔️|⚔|🏆|🤝|👻|🛒|📅/g, m => ico(LOG_ICON[m], 'li'));
// пометки под монстром: босс, «не убежать», «без помощи»; босс подсказывает, тронет ли он участников боя
function monFlags(m, c) {
  const d = def(m.uid), f = [];
  if (d.boss) {
    const calm = [c.fighter, c.helper].filter(Boolean).every(id => (pl(id)?.level || 1) <= d.noPursue);
    f.push('<span class="flag hell">босс</span>', calm ? `<span class="flag calm">не гонится ниже ${d.noPursue + 1}-го ур.</span>` : '<span class="flag">не убежал — −5 ур. и смерть</span>');
  }
  if (m.noEscape) f.push('<span class="flag">не убежать</span>');
  if (d.noHelp) f.push('<span class="flag">без помощи</span>');
  if (d.levelOnly) f.push('<span class="flag" title="Вещи, зелья, способности и разовые бонусы героям не помогают">только уровень</span>');
  return f.length ? `<div class="mon-flags">${f.join('')}</div>` : '';
}
const tierClass = str => (str >= 16 ? 'boss' : str >= 12 ? 'high' : str >= 6 ? 'mid' : 'low');

function fightHTML() {
  const g = S.game, c = g.combat, n = c.numbers, h = hints();
  // прошлые числа этого же боя: от них «докручиваются» щиты и шкала перевеса
  const fk = `${g.turn.n}:${c.fighter}`;
  const prev = S.ui.fightNums?.key === fk ? S.ui.fightNums : null;
  const tk = n.heroes + n.monsters > 0 ? Math.max(0.04, Math.min(0.96, n.heroes / (n.heroes + n.monsters))) : 0.5;
  S.ui.fightNums = { key: fk, heroes: n.heroes, monsters: n.monsters, k: tk, win: n.winning };
  const heroes = [c.fighter, c.helper].filter(Boolean).map(id => heroMedal(pl(id), { str: c.heroStrengths[id], vmember: true })).join('');
  const pm = [];
  for (const m of c.mods) pm.push({ side: m.side, t: `${m.anon ? '' : esc(pname(m.by)) + ': '}${esc(m.uid ? def(m.uid).name : m.label || 'эффект')} ${m.n > 0 ? '+' : '−'}${Math.abs(m.n)}` });
  for (const id of [c.fighter, c.helper].filter(Boolean)) { const v = pl(id)?.nextCombat; if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: ${v > 0 ? 'зелье +' + v : 'слабость −' + Math.abs(v)}` }); }
  for (const [id, v] of Object.entries(c.rage || {})) if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: ярость +${v}` });
  for (const [id, v] of Object.entries(c.turnUndead || {})) if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: изгнание +${v}` });
  for (const bs of c.backstabs) pm.push({ side: 'monster', t: `${esc(pname(bs.by))} бьёт в спину ${esc(pname(bs.on))}: −2` });
  for (const [id, v] of Object.entries(c.escape || {})) if (v) pm.push({ side: 'player', t: `${esc(pname(id))}: левитация, побег +${v}` });
  if (c.pandora) pm.push({ side: 'player', t: `Ящик Пандоры: побег −${PANDORA_ESCAPE}` }, { side: 'monster', t: `${esc(pname(c.pandora.by))}: Ящик Пандоры ×${PANDORA_MULT}` });
  const mods = side => pm.filter(x => x.side === side).map(x => `<span class="mod ${side === 'player' ? 'p' : 'm'}">${x.t}</span>`).join('');
  const monsters = c.monsters.map((m, i) => `
    <div class="mon-wrap">
      <div class="mon-body ${def(m.uid).boss ? 'boss hell' : tierClass(m.strength)}">${cardHTML(m.uid, { size: 'sm', attrs: `data-zone="view"` })}</div>
      <span class="mon-str">сила ${m.strength}${def(m.uid).mirror != null ? ` <small>(лидер ${m.level - def(m.uid).mirror} + ${def(m.uid).mirror})</small>` : ''}${def(m.uid).boss ? ` <small>(вдвое больше силы ${esc(pname(c.fighter))}, но не меньше ${BOSS_FLOOR})</small>` : ''}${!def(m.uid).boss && S.game.depth?.bonus ? ` <small title="Подземелье уходит глубже — монстры злее">(глубина +${S.game.depth.bonus})</small>` : ''}</span>
      ${monFlags(m, c)}
      ${m.enh.length ? `<div class="enh-list">${m.enh.map(u => `<span class="mod m" data-uid="${u}" data-zone="view">${esc(def(u).name)} ${def(u).double ? '×2' : (def(u).bonus > 0 ? '+' : '') + def(u).bonus}</span>`).join('')}</div>` : ''}
    </div>`).join('');
  let center;
  if (c.winAt) {
    center = `<div class="countdown" data-until="${c.winAt}" data-total="${g.opts.winDelayMs}"><svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="32" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle class="ring" cx="37" cy="37" r="32" fill="none" stroke="#e8e4dc" stroke-width="5" stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="0"/></svg><b>…</b></div>`;
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
    if (h.bribe?.length) b.push(`<button class="btn" data-act="bribe" title="Монстр уползёт жевать вещь — бой без наград">Бросить вещь</button>`);
    if (h.runAway) b.push(`<button class="btn danger" data-act="runAway">Бежать</button>`);
  } else {
    const canMeddle = Object.values(h.cards || {}).some(o => o.some(a => a.side || Number.isInteger(a.monster) || a.with));
    const who = c.helper === S.room.me ? 'Вы помогаете в этом бою.' : `${esc(pname(c.fighter))} в бою.`;
    b.push(`<span class="hint">${who} ${canMeddle ? 'Карты, которыми можно вмешаться, подсвечены в руке.' : ''}</span>`);
    if (h.haunt?.player) b.push(`<button class="btn spook" data-act="haunt" data-side="player" title="Вы призрак: раз за ход можно подкинуть +${GHOST_BONUS} одной стороне">${ico('ghost')} +${GHOST_BONUS} героям</button>`);
    if (h.haunt?.monster) b.push(`<button class="btn spook" data-act="haunt" data-side="monster" title="Вы призрак: раз за ход можно подкинуть +${GHOST_BONUS} одной стороне">${ico('ghost')} +${GHOST_BONUS} монстрам</button>`);
    if (h.pass) b.push(`<button class="btn ghost" data-act="pass">Не мешаю</button>`);
  }
  if (c.winAt && c.passed?.length) b.push(`<span class="hint passed">Не мешают: ${c.passed.map(id => esc(pname(id))).join(', ')}</span>`);
  return `
    <div class="fight" style="--ha:${n.winning ? 0.34 : 0.12};--ma:${n.winning ? 0.12 : 0.36}">
      <div class="side-col hero"><div class="side-main"><div class="shield hero${n.winning ? ' lead' : ''}" id="shieldHero" title="Сила героев">${SHIELD('hero')}<b data-roll="${n.heroes}">${prev ? prev.heroes : n.heroes}</b></div><div class="heroes-row${c.helper ? ' duo' : ''}">${heroes}</div></div><div class="mods">${mods('player')}</div></div>
      <div class="versus">${pandoraHTML(c, h)}${center}${verdict}</div>
      <div class="side-col mon"><div class="side-main"><div class="shield mon${n.winning ? '' : ' lead'}" id="shieldMon" title="Сила монстров">${SHIELD('mon')}<b data-roll="${n.monsters}">${prev ? prev.monsters : n.monsters}</b></div><div class="monsters-row">${monsters}</div></div><div class="mods">${mods('monster')}</div></div>
    </div>
    <div class="tug" style="--k:${(prev ? prev.k : tk).toFixed(3)}" data-k="${tk.toFixed(3)}" title="Перевес сил: ${n.heroes} против ${n.monsters}"><i class="tug-fill"></i><i class="tug-mark"></i></div>
    <div class="reward">За победу: +${n.levels} ${plural(n.levels, 'уровень', 'уровня', 'уровней')} и ${n.treasures} ${plural(n.treasures, 'карта', 'карты', 'карт')} клада${c.helper ? `: ${esc(pname(c.fighter))} — ${n.treasures - n.helperShare}, ${esc(pname(c.helper))} — ${n.helperShare}${n.helperExtra ? ` (обещано ${c.helpOffer}, ещё ${n.helperExtra} сверху из колоды)` : ''}` : ''}</div>
    <div class="act-bar">${b.join('')}</div>`;
}

// поединок двух героев: щиты силы, бонусы сторон, отсчёт и что отдаст проигравший
function duelHTML() {
  const g = S.game, d = g.duel, n = d.numbers, h = hints();
  const k = n.from + n.to > 0 ? Math.max(0.04, Math.min(0.96, n.from / (n.from + n.to))) : 0.5;
  const side = key => {
    const id = d[key], p = pl(id), hero = key === 'from', prize = d.prize[key];
    const ms = d.mods.filter(m => m.side === key).map(m => `<span class="mod ${hero ? 'p' : 'm'}">${esc(pname(m.by))}: ${esc(def(m.uid).name)} +${m.n}</span>`);
    if (p.nextCombat) ms.push(`<span class="mod ${hero ? 'p' : 'm'}">${p.nextCombat > 0 ? 'зелье +' + p.nextCombat : 'слабость −' + Math.abs(p.nextCombat)}</span>`);
    return `<div class="side-col ${hero ? 'hero' : 'mon'}"><div class="side-main">
      <div class="shield ${hero ? 'hero' : 'mon'}${n.winner === id ? ' lead' : ''}" id="${hero ? 'shieldHero' : 'shieldMon'}" title="Сила ${esc(p.name)}">${SHIELD(hero ? 'hero' : 'mon')}<b>${n[key]}</b></div>
      <div class="heroes-row">${heroMedal(p, { str: n[key], sub: d.femme ? 'бьётся из-за неё' : hero ? 'вызывает' : 'принимает вызов', foe: !hero })}</div></div>
      <div class="mods">${ms.join('')}</div>
      <div class="duel-prize">${d.femme
        ? `Проиграет — потеряет ${prize ? `<b data-uid="${esc(prize)}" data-zone="view">«${esc(def(prize).name)}»</b> и ` : ''}${FEMME_LEVELS} уровня`
        : prize ? `Проиграет — отдаст <b data-uid="${esc(prize)}" data-zone="view">«${esc(def(prize).name)}»</b>` : 'Отдать нечего'}</div></div>`;
  };
  const tie = n.from === n.to;
  const center = `<div class="countdown" data-until="${d.winAt}" data-total="${g.opts.winDelayMs}"><svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="32" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle class="ring" cx="37" cy="37" r="32" fill="none" stroke="#e8e4dc" stroke-width="5" stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="0"/></svg><b>…</b></div>`;
  const verdict = !n.winner ? `<span class="verdict lose">Ничья — оба уйдут целыми</span>`
    : `<span class="verdict ${n.winner === d.from ? 'win' : 'lose'}">${esc(pname(n.winner))} сильнее${tie ? (n.winner === d.to ? ' (ничья — за вызванным)' : ' (ничья — за воином)') : ''}</span>`;
  const b = [];
  const canBoost = Object.values(h.cards || {}).some(o => o.some(a => a.side === 'from' || a.side === 'to'));
  b.push(d.femme
    ? `<span class="hint">«Роковая женщина» от ${esc(pname(d.by))}: ${esc(pname(d.from))} и ${esc(pname(d.to))} бьются из-за неё. ${canBoost ? 'Разовые бонусы в руке можно подкинуть любой стороне.' : 'Когда отсчёт кончится, слабейший потеряет большую вещь и уровни.'}</span>`
    : `<span class="hint">Поединок: ${esc(pname(d.from))} против ${esc(pname(d.to))}. ${canBoost ? 'Разовые бонусы в руке можно подкинуть любой стороне.' : 'Когда отсчёт кончится, сильнейший забирает вещь.'}</span>`);
  if (h.pass) b.push(`<button class="btn ghost" data-act="pass">Не мешаю</button>`);
  if (d.passed.length) b.push(`<span class="hint passed">Не мешают: ${d.passed.map(id => esc(pname(id))).join(', ')}</span>`);
  return `
    <div class="fight duel" style="--ha:${n.winner === d.from ? 0.34 : 0.12};--ma:${n.winner === d.to ? 0.34 : 0.12}">
      ${side('from')}
      <div class="versus">${center}${verdict}</div>
      ${side('to')}
    </div>
    <div class="tug" style="--k:${k.toFixed(3)}" data-k="${k.toFixed(3)}" title="Перевес: ${n.from} против ${n.to}"><i class="tug-fill"></i><i class="tug-mark"></i></div>
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
// приручённый зверь и спутник: отдельные места на столе героя
const beastChip = (u, zone = 'ally') => `<button class="chip tamed" data-uid="${esc(u)}" data-zone="${zone}" title="Приручённый зверь: спасёт от одной расплаты">${ico('heavy-collar', 'chip-ico')}<span class="chip-name">${esc(def(u).name)}</span><b>+${tameBonus(def(u))}</b></button>`;
const allyChip = (u, zone = 'ally') => { const d = def(u); const v = d.bonus ? `+${d.bonus}` : d.runBonus ? `бег +${d.runBonus}` : d.handBonus ? `рука +${d.handBonus}` : ''; return `<button class="chip ally" data-uid="${esc(u)}" data-zone="${zone}" title="${esc(d.text)}">${ico(cardIcon(d), 'chip-ico')}<span class="chip-name">${esc(d.name)}</span>${v ? `<b>${v}</b>` : ''}</button>`; };
const hasPetSlot = p => p.beast || p.equipped.some(u => def(u).slot === 'pet');
const slotItems = (p, key, chip, zone) => p.equipped.filter(u => def(u).slot === key).map(chip).join('') + (key === 'pet' && p.beast ? beastChip(p.beast, zone) : '');
// место на столе героя: вместо подписи — значок, подпись во всплывающей подсказке
const SLOT_ICON = { head: 'crested-helmet', armor: 'breastplate', feet: 'boots', hand: 'mailed-fist', pet: 'paw-print', none: 'diamond-ring', ally: 'person', bag: 'knapsack' };
const slotBox = (key, label, inner, extra = '', icon = SLOT_ICON[key]) => `<div class="slot${inner ? '' : ' vacant'}${key.startsWith('ally-') ? ' ally-gear' : ''}" data-slot="${key}"><small title="${esc(label)}">${ico(icon, '', label)}${extra}</small>${inner}</div>`;
// спутник и под ним — его места: оружие, броник и, если повезло, головняк
const ALLY_GEAR_ICON = { hand: 'broadsword', armor: 'breastplate', head: 'crested-helmet' };
const allySlot = (p, zone, picked = new Set()) => {
  if (!p.ally) return '';
  const slots = p.allySlots || [];
  const gear = slots.map(k => {
    const u = (p.allyGear || []).find(x => def(x).slot === k);
    return slotBox(`ally-${k}`, `Спутник: ${ALLY_SLOT_NAMES[k]}`, u ? chipHTML(u, { zone: zone === 'view' ? 'view' : 'allygear', cls: picked.has(u) ? 'picked' : '' }) : '', '', ALLY_GEAR_ICON[k]);
  }).join('');
  return slotBox('ally', `Спутник: ${ALLY_SLOT_TEXT(slots)}`, allyChip(p.ally, zone)) + gear;
};
// комплекты снаряжения: собранные и начатые (надета хоть одна вещь)
function setsHTML(p) {
  const have = new Set(p.equipped.map(u => def(u).id));
  const rows = Object.entries(SETS).map(([k, st]) => {
    const n = st.items.filter(id => have.has(id)).length;
    if (!n) return '';
    const done = (p.sets || []).includes(k);
    const missing = st.items.filter(id => !have.has(id)).map(id => def(id).name).join(', ');
    // коротко: название и счёт; чего не хватает — во всплывающей подсказке
    return `<div class="set-row${done ? ' done' : ''}" title="${esc(done ? st.text : `${st.text} Не хватает: ${missing}.`)}">${ico(done ? 'crown' : 'armor-upgrade')}<b>${esc(st.name)}</b><span>${done ? esc(st.text.split(': ').pop()) : `${n}/${st.items.length}`}</span></div>`;
  }).join('');
  return rows ? `<div class="sets">${rows}</div>` : '';
}
const ABIL = {
  rage: { cls: 'warrior', label: 'Ярость', tip: 'Сбросьте до 3 карт: +1 к силе за каждую' },
  turn: { cls: 'cleric', label: 'Изгнание', tip: 'Против нежити: до 3 карт, +3 за каждую' },
  levitate: { cls: 'mage', label: 'Левитация', tip: 'До 3 карт: +1 к побегу за каждую' },
  charm: { cls: 'mage', label: 'Чары', tip: 'Сбросьте всю руку (от 3 карт) и усыпите монстра' },
  backstab: { cls: 'rogue', label: 'Удар в спину', tip: 'Сбросьте карту: участник боя получает −2' },
  steal: { cls: 'rogue', label: 'Кража', tip: 'Сбросьте карту и бросьте кубик: 4+ — вещь ваша' },
  lure: { cls: 'rogue', label: 'Сманить', tip: 'Сбросьте карту и бросьте кубик: 4+ — чужой спутник или приручённый зверь уходит к вам' },
  lullaby: { cls: 'bard', label: 'Колыбельная', tip: `Сбросьте карту: монстры −${LULLABY_PENALTY} в этом бою (раз за бой)`, need: 1 },
  distill: { cls: 'alchemist', label: 'Перегонка', tip: `Сбросьте ${DISTILL_COST} карты и возьмите карту клада (раз в ход)`, need: DISTILL_COST },
  mutagen: { cls: 'witcher', label: 'Мутаген', tip: `Один раз за партию: сбросьте 2 карты в бою — ещё +${MUTAGEN_BONUS} к силе`, need: 2 },
};
const abilNeed = name => ABIL[name]?.need || (name === 'backstab' || name === 'steal' || name === 'lure' ? 1 : 0);

function renderMine() {
  const p = me();
  const el = $('#mecard');
  if (!p) return renderWatcher();
  if ((p.sets || []).includes('legend')) unlock('legend');
  const h = hints();
  const mode = S.ui.mode;
  const picked = new Set(mode?.picked || []);
  const traits = [];
  p.races.forEach(u => traits.push(`<button class="trait" data-uid="${u}" data-zone="trait">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`));
  if (!p.races.length) traits.push(`<span class="trait none">Человек</span>`);
  p.classes.forEach(u => traits.push(`<button class="trait" data-uid="${u}" data-zone="trait">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`));
  if (!p.classes.length) traits.push(`<span class="trait none">Без класса</span>`);
  [p.halfbreed, p.supermunch].filter(Boolean).forEach(u => traits.push(`<button class="trait" data-uid="${u}" data-zone="trait">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`));

  const slot = key => slotItems(p, key, u => chipHTML(u, { cls: picked.has(u) ? 'picked' : '' }), 'ally');
  const slots = SLOT_ORDER.filter(([k]) => k !== 'pet' || hasPetSlot(p)).map(([k, label]) => k === 'hand' && p.handsLimit > 2 ? slotBox(k, `${label}: ${p.handsLimit} руки`, slot(k), `<i>${p.handsLimit}</i>`) : slotBox(k, label, slot(k))).join('')
    + allySlot(p, 'ally', picked)
    + slotBox('bag', 'Не надето', p.carried.map(u => chipHTML(u, { cls: 'off' + (picked.has(u) ? ' picked' : '') })).join(''));

  const abil = Object.entries(ABIL).filter(([k, a]) => p.classes.some(u => def(u).cls === a.cls)).map(([k, a]) => {
    const v = h.abilities?.[k];
    const on = Array.isArray(v) ? v.length > 0 : !!v;
    return `<button class="btn small ${on ? 'hero' : 'ghost'}" data-ability="${k}" ${on ? '' : 'disabled'} title="${esc(a.tip)}">${a.label}</button>`;
  }).join('');
  const run = 5 - p.runBonus;
  el.innerHTML = `
    <div class="me-top" style="--seat:${p.color}" data-vmember="${p.id}">
      <div class="me-ava${reactOf(p.id).cls}" id="meava" style="${reactOf(p.id).st}" data-act="avatar" role="button" tabindex="0" title="Сменить портрет" aria-label="Сменить портрет">${avatarSVG(gAva(p), p.color)}</div>
      <div><div class="me-name">${esc(p.name)}</div>
        <div class="me-stats"><span class="lvl" title="Уровень">${p.level}</span><span class="pow" title="Сила: уровень и надетые вещи">${ico('crossed-swords')}${p.power}</span><span class="gold" data-act="market" role="button" title="Кошелёк: голды за проданные вещи и контракты, тратятся на рынке">${ico('two-coins')}${p.gold || 0}</span>
        <span class="badge" title="Сколько нужно выбросить на кубике, чтобы убежать">${p.classes.some(u => def(u).cls === 'warlock') ? 'побег всегда' : `побег ${run <= 1 ? 'всегда' : run > 6 ? 'никогда' : run + '+'}`}</span>
        ${p.nextCombat > 0 ? `<span class="badge good">+${p.nextCombat} в бою</span>` : p.nextCombat < 0 ? `<span class="badge warn">${p.nextCombat} в бою</span>` : ''}${p.nextEscape < 0 ? `<span class="badge warn">побег ${p.nextEscape}</span>` : ''}${p.banished ? '<span class="badge warn">вы выбыли из партии</span>' : p.dead ? '<span class="badge warn">вы погибли до следующего хода</span>' : ''}</div>
      </div>
    </div>
    <div class="traits">${traits.join('')}${abil ? `<span class="abilities">${abil}</span>` : ''}</div>
    ${p.banished ? `<div class="ghost-note banished">${ico('tombstone')} Вас настигло «Прощай навсегда»: вы выбыли из партии. Вернуть вас может только Ящик Пандоры — его можно открыть в любом бою за ${PANDORA_COST} г.</div>` : ''}
    ${p.ghost ? `<div class="ghost-note">${ico('ghost')} Вы призрак до своего хода: раз за ход можно подкинуть +${GHOST_BONUS} героям или монстрам в чужом бою.</div>` : ''}
    <div class="slots">${slots}</div>
    ${setsHTML(p)}
    ${tradeWaitHTML()}`;

  const over = p.hand.length - p.handLimit;
  $('#handhead').innerHTML = `<span>В руке ${cardsNom(p.hand.length)}${over > 0 ? `. К концу хода можно оставить ${p.handLimit}, лишние уйдут` : ''}</span>${h.manage ? `<button class="btn ghost small" data-act="sellMode">Продать вещи</button>` : ''}`;
  $('#modebar').innerHTML = mode ? modeBarHTML() : '';
  const handEl = $('#hand');
  handEl.classList.toggle('has-play', !mode && p.hand.some(u => (h.cards?.[u] || []).length));
  const prev = S.ui.prevHand;
  const legNew = [];
  let k = 0;
  handEl.innerHTML = p.hand.length ? p.hand.map(u => {
    let playable = (h.cards?.[u] || []).length > 0;
    let dim = false;
    if (mode) { playable = false; dim = !modeAccepts(u, 'hand'); }
    const isNew = prev && !prev.has(u);
    // легендарка приходит не раздачей, а своей сценой
    if (isNew && def(u).rarity === 'legendary') { legNew.push(u); return cardHTML(u, { playable, selected: picked.has(u), dim, attrs: 'data-zone="hand"' }); }
    return cardHTML(u, { playable, selected: picked.has(u), dim, cls: isNew ? 'deal-in' : '', attrs: `data-zone="hand"${isNew ? ` style="animation-delay:${(k++) * 90}ms"` : ''}` });
  }).join('') : `<p class="muted">Рука пуста.</p>`;
  if (S.ui.legReady) legNew.forEach(legendArrive);
  S.ui.legReady = true;
  S.ui.prevHand = new Set(p.hand);
  for (let i = 0; i < Math.min(k, 6); i++) sfx.play('deal', { delay: i * 0.09, gap: 0 });
  fitHand();
}
// смена хода: по фишке того, кто ходит, пробегает полоса света, портрет вспыхивает кольцом
function turnSweep(pid) {
  const el = pid === S.room?.me ? $('#mecard .me-top') : document.querySelector(`[data-opp="${CSS.escape(pid)}"]`);
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const i = document.createElement('i');
  i.className = 'turn-sweep';
  el.append(i);
  setTimeout(() => i.remove(), 1300);
  const ava = el.querySelector('.ava, .me-ava');
  if (ava) { fx.ring(ava, { n: 2, size: 26, grow: 180, width: 3, color: 'rgba(255,214,140,.85)', life: 0.7 }); fx.sparkle(ava, { n: 8 }); }
}

// живой бой: вокруг монстров всё время что-то происходит — по их природе: огонь, нежить, вода, грибы, механизмы
const AMBIENT = {
  boss: el => { fx.spray(el, { n: 7, spreadX: 1, spreadY: 0.2, dy: 0.45, speed: [40, 120], angle: [-2.3, -0.85], size: [2, 3.6], colors: ['#ff8a3d', '#ff4a1a', '#ffd27a', '#d96bff'], shape: 'spark', life: [0.6, 1.2], g: -70 });
    if (Math.random() < 0.3) fx.ring(el, { size: 34, grow: 240, width: 3, color: 'rgba(220,80,255,.75)', life: 0.8 }); },
  fire: el => fx.spray(el, { n: 6, spreadX: 0.9, spreadY: 0.1, dy: 0.45, speed: [30, 90], angle: [-2.1, -1.05], size: [1.8, 3.2], colors: ['#ffd27a', '#ff8a3d', '#ff5a1a'], shape: 'spark', life: [0.7, 1.3], g: -90 }),
  undead: el => fx.spray(el, { n: 3, spreadX: 0.8, spreadY: 0.3, dy: 0.3, speed: [10, 30], angle: [-2, -1.1], size: [10, 18], grow: [14, 24], colors: ['rgba(120,255,180,.28)', 'rgba(170,140,255,.22)'], shape: 'smoke', add: false, life: [1.4, 2.2], fadeIn: true, wob: [1, 2] }),
  water: el => fx.spray(el, { n: 4, spreadX: 0.9, spreadY: 0.1, dy: -0.35, speed: [10, 40], angle: [1.2, 1.9], size: [2, 3], colors: ['#cfefff', '#9fd8e8'], shape: 'drop', add: false, life: [0.6, 0.9], g: 520 }),
  fungus: el => fx.spray(el, { n: 5, spreadX: 0.9, spreadY: 0.4, speed: [8, 26], angle: [-2.4, -0.7], size: [1.6, 3], colors: ['#c4ef86', '#8ff0d2', '#fff3b0'], shape: 'dot', life: [1.4, 2.4], fadeIn: true, wob: [2, 4], g: -12 }),
  machine: el => { if (Math.random() < 0.6) fx.spray(el, { n: 6, spreadX: 0.7, spreadY: 0.5, speed: [120, 260], size: [1.2, 2], colors: ['#bcd8ff', '#ffffff', '#7fb0ff'], shape: 'spark', life: [0.18, 0.35], g: 300 }); },
  insect: el => fx.spray(el, { n: 4, spreadX: 0.8, spreadY: 0.6, speed: [40, 90], size: [1.2, 1.8], colors: ['rgba(30,24,20,.85)', 'rgba(70,60,40,.8)'], shape: 'dot', add: false, life: [0.8, 1.4], wob: [6, 10] }),
  dust: el => fx.spray(el, { n: 3, spreadX: 1, spreadY: 0.05, dy: 0.5, speed: [10, 40], angle: [-2.6, -0.5], size: [6, 10], grow: [8, 14], colors: ['rgba(214,190,160,.3)', 'rgba(170,140,110,.28)'], shape: 'smoke', add: false, life: [0.9, 1.5] }),
};
function combatAmbient() {
  const g = S.game;
  if (!g?.combat || g.phase !== 'playing' || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || (cine.on && !cine.idle)) return;
  for (const m of g.combat.monsters) {
    const el = document.querySelector(`#stage .mon-wrap .card[data-uid="${CSS.escape(m.uid)}"]`);
    if (!el) continue;
    const d = def(m.uid), t = d.tags || [];
    const k = d.boss ? 'boss' : t.includes('fire') ? 'fire' : t.includes('undead') ? 'undead' : t.includes('water') ? 'water' : t.includes('fungus') ? 'fungus'
      : t.includes('machine') ? 'machine' : t.includes('insect') ? 'insect' : 'dust';
    AMBIENT[k](el);
  }
  // герой в легендарном снаряжении искрится у своего щита
  const heroes = [g.combat.fighter, g.combat.helper].filter(Boolean).map(pl);
  if (heroes.some(p => p?.equipped.some(u => def(u).rarity === 'legendary'))) fx.sparkle($('#shieldHero'), { n: 3, colors: ['#fff3b0', '#ffd56a', '#ffffff'] });
}
setInterval(combatAmbient, 850);

// легендарная карта пришла в руку: сцена в кино-режиме, иначе — вспышка, лучи и искры прямо в руке
// почему вещь не надеть по требованию карты (null — требование выполнено)
function reqWhy(p, r) {
  if (!r) return null;
  const races = p.races.map(u => def(u).race), classes = p.classes.map(u => def(u).cls);
  if (r.race === 'human') return races.length && !(r.mix && p.halfbreed) ? (r.mix ? 'только человеку или герою со «Смешанной кровью»' : 'только человеку — сбросьте расу') : null;
  if (r.race && !races.includes(r.race)) return `только: ${RACE_NAMES[r.race]}`;
  if (r.notRace && races.includes(r.notRace)) return `не для: ${RACE_NAMES[r.notRace]}`;
  if (r.cls && !classes.includes(r.cls)) return `только: ${CLASS_NAMES[r.cls]}`;
  return null;
}
function legendArrive(uid) {
  shockAt(null, 1.2);
  worldMood('flash', { color: 0xffe08a, alpha: 0.3 });
  if (cine.legendDrop(uid)) return;
  const el = document.querySelector(`#hand .card[data-uid="${CSS.escape(uid)}"]`);
  if (!el) return;
  const dragon = def(uid).id === 'p_golddragon';
  el.classList.add('legend-arrive');
  sfx.play('legendary', { always: true });
  fx.banner('Легендарная находка!', def(uid).name, 'legend');
  setTimeout(() => {
    fx.rays(el, { color: dragon ? '255,150,60' : '255,214,120', dur: 2000 });
    fx.ring(el, { n: 2, color: dragon ? 'rgba(255,150,60,.9)' : 'rgba(255,230,160,.9)' });
    fx.burst(el, { n: 40, colors: dragon ? ['#ffe08a', '#ff8a3d', '#fff'] : ['#ffe08a', '#f5b83d', '#fff', '#d9b3ff'], speed: 340, g: 160 });
    fx.sparkle(el, { n: 24, colors: ['#fff3b0', '#ffd56a', '#ffffff', '#a6f2ff'] });
  }, 380);
}

// зритель следит за любым героем: по умолчанию — за тем, кто ходит
function renderWatcher() {
  const g = S.game;
  const p = pl(S.ui.watchPid) || pl(g.turn.pid) || g.players[0];
  const el = $('#mecard');
  if (!p) { el.innerHTML = ''; return; }
  const trait = u => `<button class="trait" data-uid="${u}" data-zone="view">${iconSVG(def(u).art)}${esc(def(u).name)}</button>`;
  const traits = [...p.races.map(trait), ...(p.races.length ? [] : ['<span class="trait none">Человек</span>']),
    ...p.classes.map(trait), ...(p.classes.length ? [] : ['<span class="trait none">Без класса</span>']), ...[p.halfbreed, p.supermunch].filter(Boolean).map(trait)];
  const slot = key => slotItems(p, key, u => chipHTML(u), 'view');
  const slots = SLOT_ORDER.filter(([k]) => k !== 'pet' || hasPetSlot(p)).map(([k, label]) => slotBox(k, label, slot(k))).join('')
    + allySlot(p, 'view')
    + slotBox('bag', 'Не надето', p.carried.map(u => chipHTML(u, { cls: 'off' })).join(''));
  const run = 5 - p.runBonus;
  const now = g.turn.pid === p.id && g.phase === 'playing';
  el.innerHTML = `
    <div class="me-top" style="--seat:${p.color}">
      <div class="me-ava">${avatarSVG(gAva(p), p.color)}</div>
      <div><div class="me-name">${esc(p.name)}${now ? ' <span class="badge lamp">ходит</span>' : ''}</div>
        <div class="me-stats"><span class="lvl" title="Уровень">${p.level}</span><span class="pow" title="Сила: уровень и надетые вещи">${ico('crossed-swords')}${p.power}</span>${p.gold != null ? `<span class="gold" title="Кошелёк: голды за проданные вещи и контракты, тратятся на рынке">${ico('two-coins')}${p.gold}</span>` : ''}
        <span class="badge" title="Сколько нужно выбросить на кубике, чтобы убежать">${p.classes.some(u => def(u).cls === 'warlock') ? 'побег всегда' : `побег ${run <= 1 ? 'всегда' : run > 6 ? 'никогда' : run + '+'}`}</span>${p.dead ? '<span class="badge warn">погиб до следующего хода</span>' : ''}</div>
      </div>
    </div>
    <div class="traits">${traits.join('')}</div>
    <div class="slots">${slots}</div>
    ${setsHTML(p)}`;
  const follow = `<span class="follow-row"><span>Следить за</span>${g.players.map(x => `<button class="follow${x.id === p.id ? ' on' : ''}" data-follow="${x.id}" style="--seat:${x.color}" title="${esc(x.name)}" aria-pressed="${x.id === p.id}"><span class="ava">${avatarSVG(gAva(x), x.color)}</span></button>`).join('')}</span>`;
  $('#modebar').innerHTML = '';
  const tr = trickOn();
  if (tr) {
    // рукав пакостника: карты, купленные на рынке; играются от имени игроков
    $('#handhead').innerHTML = `${follow}${seatBtnHTML()}<span class="trick-head">${ico('double-face-mask')}Рукав пакостника: ${cardsNom(tr.hand.length)}</span><button class="btn ghost small trick-wallet" data-act="market" title="Кошелёк пакостника — купить карты на рынке">${ico('two-coins')}${tr.gold} г</button>`;
    const prev = S.ui.prevTrick;
    $('#hand').innerHTML = tr.hand.length ? tr.hand.map(u => cardHTML(u, { playable: true, cls: prev && !prev.has(u) ? 'deal-in' : '', attrs: 'data-zone="trick"' })).join('')
      : '<p class="muted">Рукав пуст. Купите карты на рынке — и подбрасывайте их от имени игроков: в летописи будут их имена.</p>';
    S.ui.prevTrick = new Set(tr.hand);
  } else {
    $('#handhead').innerHTML = `${follow}${seatBtnHTML()}<span>У ${esc(p.name)} в руке ${cardsNom(p.handCount)} — их видит только сам игрок.</span>`;
    $('#hand').innerHTML = p.handCount ? Array.from({ length: p.handCount }, () => `<div class="card hand-back" aria-hidden="true">${cardBackSVG('door')}</div>`).join('') : '<p class="muted">Рука пуста.</p>';
    S.ui.prevTrick = null;
  }
  S.ui.prevHand = null;
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
  // на компьютере рука — пологая дуга: крайние карты чуть ниже и повёрнуты, при наведении карта выпрямляется и поднимается
  { const n = cards.length, mid = (n - 1) / 2, step = n > 1 ? Math.min(1.6, 9 / (n - 1)) : 0;
    cards.forEach((c, i) => { const t = i - mid; c.style.setProperty('--fr', (t * step).toFixed(2) + 'deg'); c.style.setProperty('--fy', (mid ? Math.pow(Math.abs(t) / mid, 2) * 8 : 0).toFixed(1) + 'px'); }); }
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
  if (m.kind === 'sell') return !!def(uid).value && (zone === 'hand' ? ['item', 'oneshot', 'buff', 'ally'].includes(def(uid).type) : zone === 'table');
  return false;
}
// та же арифметика, что в движке (saleValue): гоблин +200 за каждую вещь, полурослик одну вещь продаёт вдвое дороже
// (обе надбавки — только за вещи, не за разовые карты и зелья)
function saleTotal(picked) {
  const sale = S.game.sale || {};
  const isItem = u => def(u).type === 'item';
  const vals = picked.map(u => (def(u).value || 0) + (sale.goblin && isItem(u) ? 200 : 0));
  let total = vals.reduce((a, b) => a + b, 0);
  const best = Math.max(0, ...vals.filter((v, i) => isItem(picked[i])));
  const half = !!sale.halfling && best > 0;
  if (half) total += best;
  return { total, half, goblin: !!sale.goblin && picked.some(isItem) };
}
function modeBarHTML() {
  const m = S.ui.mode;
  const n = m.picked.length;
  if (m.kind === 'give') {
    return `<div class="modebar"><span>Выберите <b>${cardsWord(m.need)}</b>, которые ${hints().giveToLowest ? 'отдадите самому слабому' : 'сбросите'}: выбрано ${n}.</span><button class="btn primary small" data-act="modeOk" ${n === m.need ? '' : 'disabled'}>Готово</button><button class="btn ghost small" data-act="modeCancel">Отмена</button></div>`;
  }
  if (m.kind === 'sell') {
    const { total, half, goblin } = saleTotal(m.picked);
    const extra = [half && 'полурослик продаёт одну вещь вдвое дороже', goblin && 'гоблин выторговывает +200 за каждую вещь'].filter(Boolean).join(', ');
    return `<div class="modebar"><span>Отметьте вещи в руке и на столе. Выручка: <b>${total} г</b>${extra ? ` (${extra})` : ''} — в кошелёк, там сейчас ${me()?.gold || 0} г. Голды тратятся на рынке.</span><button class="btn primary small" data-act="modeOk" ${n >= 1 ? '' : 'disabled'}>Продать</button><button class="btn ghost small" data-act="modeCancel">Отмена</button></div>`;
  }
  if (m.kind === 'ability') {
    const a = ABIL[m.name];
    const fixed = abilNeed(m.name);
    const ok = fixed ? n === fixed : n >= 1 && n <= m.max;
    const what = m.name === 'steal' || m.name === 'lure' ? `, цель: «${esc(def(m.item).name)}» у ${esc(pname(m.target))}` : m.name === 'backstab' ? `, цель: ${esc(pname(m.target))}` : '';
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
  el.innerHTML = S.game.log.map(l => `<div class="l-${l.kind}">${logText(l.text)}</div>`).join('');
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
  if (d.femme && a.target && a.with) return `Стравить: ${pname(a.target)} и ${pname(a.with)}`;
  if (a.target) return d.effect === 'enslave' ? `Заставить помогать: ${pname(a.target)}` : d.type === 'trap' ? `Подложить: ${pname(a.target)}` : d.type === 'duel' ? `Вызвать: ${pname(a.target)}` : `Наслать на ${pname(a.target)}`;
  if (a.side === 'from' || a.side === 'to') return `За ${pname(S.game.duel?.[a.side])} +${d.bonus}`;
  if (a.side) return a.side === 'player' ? `Героям +${d.bonus}` : `Монстрам +${d.bonus}`;
  if (Number.isInteger(a.monster)) return `${d.type === 'enhancer' ? 'Усилить' : 'Окаменить'} «${def(S.game.combat.monsters[a.monster].uid).name}»`;
  if (a.with) return `Выпустить «${def(a.with).name}» (ур. ${def(a.with).level})`;
  if (d.type === 'monster' && a.into) return d.boss ? 'Призвать в этот бой — босса!' : `Призвать в этот бой (ур. ${d.level})`;
  if (d.type === 'monster') return d.boss ? 'Позвать на бой — это босс!' : `Позвать на бой (ур. ${d.level})`;
  switch (d.type) {
    case 'race': return me().races.length && !me().halfbreed ? `Стать: ${d.name} (вместо нынешней расы)` : `Стать: ${d.name}`;
    case 'class': return me().classes.length && !me().supermunch ? `Взять класс: ${d.name} (вместо нынешнего)` : `Взять класс: ${d.name}`;
    case 'item': return 'Выложить на стол';
    case 'ally': return me().ally ? `Взять в спутники (вместо «${def(me().ally).name}»)` : 'Взять в спутники';
    case 'levelup': return 'Получить уровень';
    case 'jackpot': return `Открыть: +${d.gold} г`;
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
    case 'monster': return 'Монстра можно позвать на бой в свой ход, если за дверью никого не было, или подбросить в чужой бой картой «Из темноты вылезло…». Чернокнижник раз за бой призывает его в любой бой и без неё.';
    case 'curse': return 'Насылается на любого игрока в любой момент.';
    case 'trap': return 'Подложите любому игроку в любой момент: он бросает кубик (4+, плуту и механику 2+). Не обезвредил — получает расплату.';
    case 'ally': return 'Берётся в свой ход вне боя. Спутник один: новый прогоняет прежнего.';
    case 'duel': return d.femme ? 'Играется в свой ход вне боя на двух соперников. Сила против силы, при равенстве оба уходят целыми.' : 'Играется в свой ход вне боя: выберите соперника. Сила против силы, при равенстве побеждает вызванный.';
    case 'race': case 'class': case 'halfbreed': case 'supermunch': case 'item': case 'hoard': return 'Играется в свой ход, когда нет боя.';
    case 'enhancer': return 'Играется на монстра в любом бою.';
    case 'wandering': return 'Играется в любом бою вместе с монстром из руки.';
    case 'oneshot': return d.effect === 'ward' ? 'Срабатывает сам, когда на вас насылают проклятие.' : 'Играется во время боя.';
    case 'levelup': return `Играется когда угодно, но ${winLvl()}-й уровень так не взять.`;
    case 'jackpot': return 'Откройте в любой момент — голды сразу лягут в кошелёк.';
    case 'location': return 'Играется в свой ход вне боя. Меняет правила для всех, пока кто-нибудь не сменит локацию.';
    case 'event': return d.event === 'shift' ? 'Играется в свой ход вне боя, но не на Поверхности — только с глубины 1. Срабатывает сразу для всего стола.' : 'Играется в свой ход вне боя и срабатывает сразу для всего стола.';
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
    if (p.carried.includes(uid) && h.manage && !h.equip?.[uid]) groups.push(`<p class="why">Сейчас не надеть: ${esc(reqWhy(p, d.req) || 'слот занят — снимите другую вещь')}.</p>`);
    if (p.equipped.includes(uid) && h.manage) popOpts.push({ label: 'Снять', action: { type: 'unequip', uid }, cls: '' });
    if (h.allyWear?.[uid]) popOpts.push({ label: `Отдать спутнику — ${def(p.ally).name}`, action: { type: 'allyWear', uid }, cls: '' });
    if (h.manage && d.value) popOpts.push({ label: 'Продать…', fn: () => startMode({ kind: 'sell', picked: [uid] }), cls: 'ghost' });
    const c = S.game.combat;
    const busy = c && (c.fighter === p.id || c.helper === p.id);
    if (!busy && !p.dead) S.game.players.filter(x => x.id !== p.id && !x.dead && !(c && (c.fighter === x.id || c.helper === x.id))).forEach(x => popOpts.push({ label: `Отдать: ${x.name}`, action: { type: 'gift', uid, to: x.id }, cls: 'ghost' }));
    if (h.manage) popOpts.push({ label: 'Сбросить', action: { type: 'discardInPlay', uid }, cls: 'ghost' });
  }
  if (zone === 'trait' && p && h.manage) popOpts.push({ label: 'Сбросить', action: { type: 'discardInPlay', uid }, cls: 'ghost' });
  if (zone === 'allygear' && p && (p.allyGear || []).includes(uid)) {
    groups.push(`<p class="why">Эту вещь носит ваш спутник — ${esc(def(p.ally).name)}: её бонус идёт вам в силу.</p>`);
    if (h.manage) popOpts.push({ label: 'Забрать у спутника', action: { type: 'allyTake', uid }, cls: '' });
  }
  if (zone === 'ally' && p && (p.ally === uid || p.beast === uid)) {
    if (p.beast === uid) groups.push(`<p class="why">Приручённый зверь: +${tameBonus(d)} к силе, занимает место питомца и спасёт от одной расплаты.</p>`);
    if (h.manage) popOpts.push({ label: 'Отпустить', action: { type: 'discardInPlay', uid }, cls: 'ghost' });
  }
  showOverlay(`<div class="pop" role="dialog" aria-label="${esc(d.name)}">
    ${cardHTML(uid, { size: 'lg', tab: false })}
    <div class="pop-actions">
      <div class="pop-info"><h3>${esc(d.name)}</h3><p class="pop-text">${cardText(d)}</p></div>
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
    for (const u of mine.hand) for (const a of h.cards?.[u] || []) if (def(u).femme && (a.target === pid || a.with === pid)) popOpts.push({ label: `«${def(u).name}»: ${pname(a.target)} и ${pname(a.with)}`, action: a, cls: 'danger' });
    for (const u of mine.hand) for (const a of h.cards?.[u] || []) if (a.target === pid && !def(u).femme) popOpts.push({ label: def(u).effect === 'enslave' ? `«${def(u).name}»: пусть помогает` : def(u).type === 'trap' ? `Подложить «${def(u).name}»` : def(u).type === 'duel' ? 'Вызвать на поединок' : `Наслать «${def(u).name}»`, action: a, cls: 'danger' });
    for (const s of h.abilities?.lure || []) if (s.target === pid) popOpts.push({ label: `Сманить «${def(s.item).name}»`, fn: () => startMode({ kind: 'ability', name: 'lure', target: pid, item: s.item, picked: [], max: 1 }), cls: 'ghost' });
    for (const s of h.abilities?.steal || []) if (s.target === pid) popOpts.push({ label: `Стащить «${def(s.item).name}»`, fn: () => startMode({ kind: 'ability', name: 'steal', target: pid, item: s.item, picked: [], max: 1 }), cls: 'ghost' });
    for (const t of h.abilities?.backstab || []) if (t === pid) popOpts.push({ label: 'Ударить в спину (−2)', fn: () => startMode({ kind: 'ability', name: 'backstab', target: pid, picked: [], max: 1 }), cls: 'danger' });
  }
  if (mine && h.tradeTargets?.includes(pid)) popOpts.push({ label: 'Предложить обмен', fn: () => openTrade(pid), cls: 'hero' });
  const items = [...p.equipped.map(u => chipHTML(u)), ...(p.beast ? [beastChip(p.beast, 'view')] : []), ...(p.ally ? [allyChip(p.ally, 'view')] : []), ...(p.allyGear || []).map(u => chipHTML(u, { cls: 'ally-worn', zone: 'view' })), ...p.carried.map(u => chipHTML(u, { cls: 'off' }))].join('') || '<p class="muted">Вещей нет.</p>';
  showOverlay(`<div class="modal" role="dialog" aria-label="${esc(p.name)}">
    <div class="row"><span class="me-ava" style="--seat:${p.color}">${avatarSVG(gAva(p), p.color)}</span><div><h2>${esc(p.name)}</h2><div class="me-stats"><span class="lvl">${p.level}</span><span class="pow">${ico('crossed-swords')}${p.power}</span>${p.gold != null ? `<span class="gold" title="Кошелёк: голды за проданные вещи и контракты, тратятся на рынке">${ico('two-coins')}${p.gold}</span>` : ''}<span class="badge">${esc(raceText(p))}, ${esc(classText(p))}</span><span class="handcount"><i></i>${p.handCount}</span></div></div></div>
    <div class="opp-items" data-zone-view>${items}</div>
    ${setsHTML(p)}
    ${popOpts.length ? `<div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div>` : ''}
    <button class="btn ghost" data-act="closeOverlay">Закрыть</button>
  </div>`);
}

// подземный рынок: всегда открыт; товар — карты, что ещё в колоде; платят голдами из кошелька, цены зависят от локации
const SHOP_ORDER = ['level', 'curse', 'duel', 'food', 'potion', 'gear', 'magic'];
// коротко под карточкой на рынке: что даёт и как работает (полный текст — в подсказке и по нажатию на карту)
function shopBlurb(d) {
  if (d.short) return d.short;
  if (d.type === 'levelup') return `Сразу +1 уровень. ${winLvl()}-й так не взять.`;
  return ruleText(d.text).replace(/^Разовая\.\s*/, '');
}
const lotDesc = id => { const d = def(id); return `<p class="lot-desc" title="${esc(`${ruleText(d.text)} ${whenText(d)}`.trim())}">${esc(shopBlurb(d))}</p>`; };
function shopLots() {
  const items = S.game.shop?.items || [];
  // все «Получи уровень» одинаковы — на прилавке это один товар
  const lv = items.filter(x => x.cat === 'level'), have = lv.filter(x => x.stock > 0);
  const lots = lv.length ? [{ cat: 'level', id: (have[0] || lv[0]).id, ids: have.map(x => x.id), price: lv[0].price, base: lv[0].base, stock: have.reduce((a, x) => a + x.stock, 0) }] : [];
  for (const x of items) if (x.cat !== 'level') lots.push({ ...x, ids: x.stock ? [x.id] : [] });
  return lots;
}
function openMarketModal() {
  const g = S.game, h = hints(), p = me(), tr = trickOn();
  if (!g?.shop) return closeOverlay();
  const scroll = $('#shopModal .shop-lots')?.scrollTop || 0;
  const lots = shopLots();
  const cats = SHOP_ORDER.filter(c => lots.some(l => l.cat === c));
  const tab = cats.includes(S.ui.shopTab) ? S.ui.shopTab : cats[0];
  const can = new Set(h?.shop || []);
  popOpts = [];
  const tabs = cats.map(c => {
    const i = popOpts.push({ fn: () => { S.ui.shopTab = c; openMarketModal(); } }) - 1;
    const n = lots.filter(l => l.cat === c).reduce((a, l) => a + l.stock, 0);
    return `<button type="button" data-popopt="${i}" aria-pressed="${c === tab}">${esc(SHOP_CATS[c])} <small>${n}</small></button>`;
  }).join('');
  const W = g.opts?.winLevel || 10;
  const list = lots.filter(l => l.cat === tab).sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.price - b.price);
  const lotHTML = list.map(l => {
    if (tr) {
      const i = popOpts.push({ fn: () => trickBuy(l.ids[0]) }) - 1;
      const short = tr.gold < l.price;
      return `<div class="lot${l.stock ? '' : ' out'}">${cardHTML(l.id, { size: 'sm', attrs: 'data-zone="view"', tab: false })}${lotDesc(l.id)}
      <div class="lot-price"><b>${l.price}</b> г</div>
      <div class="lot-stock">${l.stock ? `в колоде: ${l.stock}` : 'распродано'}</div>
      ${l.stock ? (short ? `<small class="lot-why">не хватает ${l.price - tr.gold} г</small>` : `<button class="btn primary small" data-popopt="${i}">Купить</button>`) : ''}</div>`;
    }
    const buyId = l.ids.find(id => can.has(id));
    const why = !l.stock || buyId || !h?.buy || !p ? ''
      : p.gold < l.price ? `не хватает ${l.price - p.gold} г`
      : l.cat === 'level' && p.level >= W - 1 ? 'последний уровень — только боем'
      : l.cat === 'level' ? 'уровень — один за ход' : '';
    const i = popOpts.push({ fn: () => buyLot(buyId) }) - 1;
    const tone = l.price < l.base ? 'cheap' : l.price > l.base ? 'dear' : '';
    return `<div class="lot${l.stock ? '' : ' out'}">${cardHTML(l.id, { size: 'sm', attrs: 'data-zone="view"', tab: false })}${lotDesc(l.id)}
      <div class="lot-price ${tone}">${l.price !== l.base ? `<s>${l.base}</s>` : ''}<b>${l.price}</b> г</div>
      <div class="lot-stock">${l.stock ? `в колоде: ${l.stock}` : 'распродано'}</div>
      ${h?.buy && l.stock ? (buyId ? `<button class="btn primary small" data-popopt="${i}">Купить</button>` : `<small class="lot-why">${esc(why)}</small>`) : ''}</div>`;
  }).join('') || '<p class="muted">Здесь пусто.</p>';
  const L = g.location ? def(g.location) : null;
  const policy = [g.shop.note && `<b>${esc(L?.name || '')}:</b> ${esc(g.shop.note)}`, g.shop.fair && '<b>Ярмарочный день:</b> всё на четверть дешевле.'].filter(Boolean).join(' ');
  const how = tr ? 'Вы пакостник: карта ляжет в ваш рукав, а сыграет её тот игрок, от чьего имени вы решите.'
    : !p ? 'Вы зритель: смотреть можно, покупать — нет.'
    : h?.buy ? 'Купленная карта ложится в руку. «Получи уровень» — не больше одного за ход.' : 'Покупать можно в свой ход, когда нет боя.';
  // «Шопоголик»: статус-сюрприз за покупки на 5000 голдов, видит только сам игрок; до него — ни слова
  const status = p?.regular ? `<p class="shop-regular">${ico('laurels')}<span><b>Вы — Шопоголик.</b> Цены для вас на ${Math.round(REGULAR_DISCOUNT * 100)}% ниже, а рынок открыт в любой момент — даже в бою. Этот статус видите только вы.</span></p>` : '';
  showOverlay(`<div class="modal shop" id="shopModal" role="dialog" aria-label="Подземный рынок">
    <div class="shop-head"><h2>${ico('shop')} Подземный рынок</h2>${tr ? `<span class="wallet trick" title="Кошелёк пакостника">${ico('double-face-mask')}<b>${tr.gold}</b> г</span>` : p ? `<span class="wallet" title="Голды за проданные вещи и контракты">${ico('two-coins')}<b>${p.gold}</b> г</span>` : ''}</div>
    <p class="muted shop-how">Продаётся только то, что ещё лежит в колоде. ${how}</p>
    ${status}
    ${policy ? `<p class="shop-policy">${policy}</p>` : '<p class="shop-policy muted">Подземелье: обычные цены. На других локациях цены другие.</p>'}
    <div class="seg shop-tabs" role="group">${tabs}</div>
    <div class="shop-lots" data-zone-view>${lotHTML}</div>
    <button class="btn ghost" data-act="closeOverlay">Закрыть</button></div>`);
  const box = $('#shopModal .shop-lots'); if (box) box.scrollTop = scroll;
}
async function buyLot(id) {
  if (!id) return;
  await act({ type: 'buy', id }); // окно обновится само, когда придёт новое состояние стола
}

// ───────────────────────── зритель за столом ─────────────────────────
// Свободные места — боты и отключившиеся игроки на автопилоте. Зритель просится, игроки голосуют, за кого он сядет.
const seatLeft = endsAt => Math.max(0, Math.ceil((endsAt - (Date.now() + (S.skew || 0))) / 1000));
setInterval(() => document.querySelectorAll('[data-seat-ends]').forEach(el => { el.textContent = seatLeft(Number(el.dataset.seatEnds)); }), 1000);
function seatLabel(id) {
  const m = S.room?.members.find(x => x.id === id), p = pl(id);
  return { name: p?.name || m?.name || '—', color: p?.color || m?.color || '#888', ava: p ? avatarSVG(gAva(p), p.color) : '', meta: `ур. ${p?.level ?? '?'} · ${m?.isBot ? 'бот' : 'автопилот'}` };
}
function seatBtnHTML() {
  const st = S.room?.seats;
  if (!st?.open.length) return '';
  const mine = st.vote && st.vote.id === S.ui.seatAsk;
  return `<button class="btn small seat-ask${mine ? ' waiting' : ''}" data-act="seatAsk" title="Сесть за стол вместо бота или автопилота">${ico('shaking-hands')}${mine ? `Голосуют: ${st.vote.voted} из ${st.voters}` : 'Сесть за стол'}</button>`;
}
function seatRow(id, inner) {
  const x = seatLabel(id);
  return `<span class="seat-who" style="--seat:${x.color}"><span class="ava">${x.ava}</span><span><b>${esc(x.name)}</b><small>${esc(x.meta)}</small></span>${inner || ''}</span>`;
}
function openSeatModal() {
  const st = S.room?.seats;
  popOpts = [];
  if (!S.room?.spectator || !st) return closeOverlay();
  const v = st.vote;
  let body;
  if (v && v.id === S.ui.seatAsk) {
    const i = popOpts.push({ fn: async () => { await call('seat:cancel'); S.ui.seatAsk = null; closeOverlay(); } }) - 1;
    body = `<p style="margin:0">Игроки голосуют, за кого из ботов вы сядете. Проголосовали <b>${v.voted} из ${st.voters}</b>, осталось <b data-seat-ends="${v.endsAt}">${seatLeft(v.endsAt)}</b> с.</p>
      <div class="seat-list">${st.open.map(id => seatRow(id, v.counts[id] ? `<em>${v.counts[id]}</em>` : '')).join('')}</div>
      <div class="row"><button class="btn ghost" data-popopt="${i}">Передумал</button><button class="btn ghost" data-act="closeOverlay">Свернуть</button></div>`;
  } else if (v) {
    body = `<p style="margin:0">Сейчас игроки решают, пускать ли за стол ${esc(v.name)}. Попробуйте через минуту.</p><button class="btn ghost" data-act="closeOverlay">Понятно</button>`;
  } else if (!st.open.length) {
    body = `<p style="margin:0">Свободных мест нет: за столом сейчас ни одного бота или автопилота.</p><button class="btn ghost" data-act="closeOverlay">Понятно</button>`;
  } else if (!st.voters) {
    // живых игроков нет — место выбирает сам зритель (так можно вернуться к своему герою)
    const btns = st.open.map(id => { const i = popOpts.push({ fn: () => askSeat(id) }) - 1; return `<button class="btn seat-btn" data-popopt="${i}">${seatRow(id)}</button>`; }).join('');
    body = `<p style="margin:0">Живых игроков за столом нет — выберите, за кого сесть. Герой, его вещи, карты и уровень станут вашими.</p><div class="seat-list">${btns}</div><button class="btn ghost" data-act="closeOverlay">Отмена</button>`;
  } else {
    const i = popOpts.push({ fn: () => askSeat(null) }) - 1;
    body = `<p style="margin:0">Свободные места — боты и игроки на автопилоте. Игроки за столом выберут голосованием, за кого вы сядете: герой, его вещи, карты и уровень станут вашими.</p>
      <div class="seat-list">${st.open.map(id => seatRow(id)).join('')}</div>
      <div class="row"><button class="btn primary" data-popopt="${i}">Попросить место</button><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`;
  }
  showOverlay(`<div class="modal seat-modal" id="seatModal" role="dialog" aria-label="Сесть за стол"><h2>${ico('shaking-hands')} Сесть за стол</h2>${body}</div>`);
}
async function askSeat(seat) {
  const r = await call('seat:ask', seat ? { seat } : {});
  if (!r.ok) return toast(r.error || 'Не получилось');
  if (r.granted) return;
  S.ui.seatAsk = r.id;
  toast('Просьба отправлена — игроки голосуют');
  openSeatModal();
}
// игроку за столом: зритель просится — за кого из ботов он сядет?
function maybeSeatVote() {
  const v = S.room?.seats?.vote;
  if (!v || !v.canVote || v.mine) { if ($('#seatVoteModal')) closeOverlay(); return; }
  if (S.ui.seatVoteSeen === v.id || S.ui.overlay) return;
  S.ui.seatVoteSeen = v.id;
  sfx.play('bell', { always: true });
  openSeatVote();
}
function openSeatVote() {
  const st = S.room?.seats, v = st?.vote;
  if (!v || !v.canVote || v.mine) return closeOverlay();
  popOpts = [];
  const vote = seat => async () => { const r = await call('seat:vote', { id: v.id, seat }); if (!r.ok) return toast(r.error || 'Не получилось'); closeOverlay(); toast('Голос принят'); };
  const btns = st.open.map(id => { const i = popOpts.push({ fn: vote(id) }) - 1; return `<button class="btn seat-btn" data-popopt="${i}">${seatRow(id, v.counts[id] ? `<em>${v.counts[id]}</em>` : '')}</button>`; }).join('');
  const no = popOpts.push({ fn: vote('no') }) - 1;
  showOverlay(`<div class="modal seat-modal" id="seatVoteModal" role="alertdialog" aria-label="Зритель просится за стол">
    <h2>${ico('shaking-hands')} ${esc(v.name)} просится за стол</h2>
    <p style="margin:0">За кого из ботов сядет зритель? Герой, его вещи, карты и уровень перейдут к нему. Решает большинство, проголосовали ${v.voted} из ${st.voters}, осталось <b data-seat-ends="${v.endsAt}">${seatLeft(v.endsAt)}</b> с.</p>
    <div class="seat-list">${btns}</div>
    <div class="row"><button class="btn ghost" data-popopt="${no}">Не пускать${v.counts.no ? ` (${v.counts.no})` : ''}</button><button class="btn ghost" data-act="closeOverlay">Позже</button></div>
  </div>`);
}

// ───────────────────────── пакостник ─────────────────────────
// Зритель ввёл /IAMGOD: у него 77 777 голдов и рукав. Карту из рукава играет «кукла» — один из игроков,
// и в летописи стоит её имя. Видит всё это только сам пакостник.
const trickOn = () => (S.trick && S.room?.spectator && S.trick.room === S.room.id && S.game?.phase === 'playing' ? S.trick : null);
function trickFx(note) {
  sfx.play('legendary', { always: true });
  fx.banner('Вы — пакостник', note || 'Покупайте карты на рынке и подбрасывайте их от имени игроков', 'curse');
  setTimeout(() => {
    const at = document.querySelector('.market-pill.trick') || $('#hand');
    if (!at) return;
    fx.ring(at, { n: 2, size: 26, grow: 300, color: 'rgba(196,140,255,.9)' });
    fx.sparkle(at, { n: 22, colors: ['#e7d0ff', '#b98cff', '#ffffff', '#ffd56a'] });
    fx.coins(at, at, { n: 16 });
  }, 450);
}
async function trickBuy(id) {
  if (!id) return;
  const r = await call('trick:buy', { id });
  if (!r.ok) return toast(r.error || 'Не получилось');
  sfx.play('coins', { always: true });
  toast(`«${def(r.uid).name}» — в рукаве`);
}
// что карта сделает «на куклу» (без цели): фраза как в летописи — «Вася получает уровень»
function trickSelfLabel(a, pid) {
  const d = def(a.uid), n = pname(pid);
  switch (d.type) {
    case 'monster': return d.boss ? `${n} зовёт на бой босса «${d.name}»` : `${n} зовёт на бой «${d.name}» (ур. ${d.level})`;
    case 'race': return `${n} становится: ${d.name}`;
    case 'class': return `${n} берёт класс «${d.name}»`;
    case 'halfbreed': case 'supermunch': return `${n} берёт «${d.name}»`;
    case 'item': return `${n} выкладывает «${d.name}» на стол`;
    case 'ally': return `${n} берёт в спутники «${d.name}»`;
    case 'levelup': return `${n} получает уровень`;
    case 'jackpot': return `${n} открывает: +${d.gold} г`;
    case 'hoard': return `${n} открывает схрон`;
    case 'location': return `${n} переносит всех сюда`;
    case 'event': return `${n} объявляет событие`;
    case 'buff': return `${n} выпивает: +${d.bonus} в бою`;
    case 'oneshot': return d.effect === 'escape' ? `${n} бросает шашку и сбегает` : d.effect === 'escapeBonus' ? `${n} закидывает верёвку: побег +${d.bonus}` : `${n} играет «${d.name}»`;
    default: return `${n} играет «${d.name}»`;
  }
}
const trickAimed = a => !!(a.target || a.with || a.side || Number.isInteger(a.monster) || a.into);
async function openTrickPop(uid) {
  const r = await call('trick:opts', { uid });
  if (!r.ok) return toast(r.error || 'Не получилось');
  if (S.ui.trickPop?.uid !== uid) S.ui.trickBy = '';
  // выбранный раньше бот или игрок мог уйти со стола
  if (S.ui.trickBy && !pl(S.ui.trickBy)) S.ui.trickBy = '';
  S.ui.trickPop = { uid, opts: r.opts };
  drawTrickPop();
}
// стол изменился, пока окно открыто: варианты пересчитываются (не чаще раза в 400 мс)
let trickRefresh = 0;
function refreshTrickPop() {
  clearTimeout(trickRefresh);
  trickRefresh = setTimeout(async () => {
    const tp = S.ui.trickPop;
    if (!tp || !$('#trickPop')) return;
    if (!trickOn()?.hand.includes(tp.uid)) return closeOverlay();
    const r = await call('trick:opts', { uid: tp.uid });
    if (r.ok && $('#trickPop') && S.ui.trickPop === tp) { tp.opts = r.opts; drawTrickPop(); }
  }, 400);
}
function drawTrickPop() {
  const { uid, opts } = S.ui.trickPop, d = def(uid);
  const aimed = opts.filter(o => trickAimed(o.a)), self = opts.filter(o => !trickAimed(o.a));
  // боты за столом есть — всё «делает» бот; нет ботов — пакостник сам выбирает, кого из игроков подставить
  const botIds = S.game.players.filter(p => p.isBot && !p.dead).map(p => p.id), hasBots = botIds.length > 0;
  const by = S.ui.trickBy || '';
  popOpts = [];
  const rows = [];
  if (aimed.length) {
    const pool = [...new Set(aimed.flatMap(o => o.puppets))].filter(id => !hasBots || botIds.includes(id));
    const seg = [['', hasBots ? 'Любой бот' : 'Кто-нибудь'], ...pool.map(id => [id, pname(id)])].map(([id, label]) => {
      const i = popOpts.push({ fn: () => { S.ui.trickBy = id; drawTrickPop(); } }) - 1;
      const x = id && pl(id);
      return `<button type="button" data-popopt="${i}" aria-pressed="${by === id}" ${x ? `style="--seat:${x.color}"` : ''}>${x ? `<span class="ava">${avatarSVG(gAva(x), x.color)}</span>` : ''}${esc(label)}</button>`;
    }).join('');
    if (pool.length) rows.push(`<div class="trick-by"><span class="muted">${hasBots ? 'Какой бот это сделает:' : 'Кого подставить:'}</span><div class="seg trick-seg" role="group">${seg}</div></div>`);
    for (const o of aimed) {
      const mine = hasBots ? o.puppets.filter(id => botIds.includes(id)) : o.puppets;
      if (mine.length) {
        const can = !by || mine.includes(by);
        const i = popOpts.push({ fn: () => trickDo(o.a, by || null) }) - 1;
        rows.push(`<button class="btn danger" data-popopt="${i}" ${can ? '' : `disabled title="${esc(`${pname(by)} так сейчас не может`)}"`}>${esc(optLabel(o.a))}</button>`);
        continue;
      }
      // ни один бот сейчас так не может — можно подставить игрока
      for (const pid of o.puppets) {
        const i = popOpts.push({ fn: () => trickDo(o.a, pid) }) - 1;
        rows.push(`<button class="btn danger" data-popopt="${i}" style="--seat:${pl(pid)?.color || '#888'}">${esc(`${optLabel(o.a)} — подставить ${pname(pid)}`)}</button>`);
      }
    }
  }
  for (const o of self) for (const pid of o.puppets) {
    const i = popOpts.push({ fn: () => trickDo(o.a, pid) }) - 1;
    rows.push(`<button class="btn primary" data-popopt="${i}" style="--seat:${pl(pid)?.color || '#888'}">${esc(trickSelfLabel(o.a, pid))}</button>`);
  }
  if (!opts.length) rows.push(`<p class="why">Сейчас эту карту никто из игроков сыграть не может. ${esc(whenText(d))}</p>`);
  const note = hasBots ? 'Карту сыграет бот — в летописи будет его имя, а о вас никто не узнает.' : 'Ботов за столом нет — выберите, кого из игроков подставить: в летописи будет его имя.';
  showOverlay(`<div class="pop" id="trickPop" role="dialog" aria-label="${esc(d.name)}">
    ${cardHTML(uid, { size: 'lg', tab: false })}
    <div class="pop-actions">
      <div class="pop-info"><h3>${esc(d.name)}</h3><p class="pop-text">${cardText(d)}</p></div>
      <p class="trick-note">${ico('double-face-mask')}${esc(note)}</p>
      ${rows.join('')}
      <button class="btn ghost" data-act="closeOverlay">Закрыть</button>
    </div></div>`);
}
async function trickDo(a, puppet) {
  const r = await call('trick:play', { a, puppet });
  if (!r.ok) return toast(r.error || 'Не получилось');
  closeOverlay(); S.ui.trickPop = null;
  toast(`Сыграно от имени: ${r.name}`);
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
      <div class="pick-list">${h.helpTargets.map(id => { const p = pl(id); return `<button class="pick" data-helpto="${id}" aria-pressed="${id === target}" style="--seat:${p.color}"><span class="ava">${avatarSVG(gAva(p), p.color)}</span><span><b>${esc(p.name)}</b><br><small class="muted">сила ${p.power}, ${esc(raceText(p))}</small></span></button>`; }).join('')}</div>
      <div><div class="muted" style="font-size:14px">Сколько карт клада отдать из ${n.treasures}</div><div class="stepper"><button class="btn small" data-offer="-1" aria-label="Меньше">−</button><b>${offer}</b><button class="btn small" data-offer="1" aria-label="Больше">+</button></div>
        <div class="muted" style="font-size:13.5px;margin-top:6px">Вам останется ${n.treasures - offer} из ${n.treasures}.${helpBonusNote(target)}</div></div>
      <div class="row"><button class="btn hero" data-act="sendHelp">Позвать</button><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>
    </div>`);
  };
  S.ui.helpForm = { get: () => ({ target, offer }), setT: t => { target = t; draw(); }, setO: d => { offer = Math.max(0, Math.min(n.treasures, offer + d)); draw(); } };
  draw();
}

// бонусы помощника идут сверху из колоды и не уменьшают долю того, кто дерётся
function helpBonusNote(pid) {
  const p = pl(pid);
  const goblin = p?.races.some(u => def(u).race === 'goblin');
  const tavern = S.game.location && def(S.game.location).helperBonus;
  const parts = [];
  if (goblin) parts.push(`${esc(p.name)} — гоблин и возьмёт ещё карту`);
  if (tavern) parts.push('в таверне помощнику положена ещё карта');
  return parts.length ? ` ${parts.join(', ')} — она берётся из колоды сверху, вашу долю это не уменьшит.` : '';
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
    <p style="margin:0">Обещает <b>${req.offer}</b> ${plural(req.offer, 'карту', 'карты', 'карт')} клада${(() => { const x = (mine.races.some(u => def(u).race === 'goblin') ? 1 : 0) + ((S.game.location && def(S.game.location).helperBonus) || 0); return x ? ` и ещё ${x} сверху из колоды` : ''; })()}.${mine.races.some(u => def(u).race === 'elf') ? ' Вы эльф: за победу получите уровень.' : ''} Если проиграете, расплата достанется и вам.</p>
    <div class="row"><button class="btn hero" data-help="1">Помочь</button><button class="btn ghost" data-help="0">Отказаться</button></div>
  </div>`);
}

// ───────────────────────── глубина, контракты, призрак, обмен ─────────────────────────
const PERSONA_TIPS = {
  cautious: 'Осторожный: помогает только наверняка, редко ищет неприятности, мешает лишь тому, кто вот-вот победит',
  greedy: 'Жадный: часто ищет неприятности, за помощь хочет побольше клада, а сам делится скупо',
  vengeful: 'Мстительный: помнит, кто ему мешал или насылал проклятия, и отвечает тем же',
};
const personaTip = k => PERSONA_TIPS[k] || '';
function depthPill(dp) {
  if (!dp) return '';
  const bottom = dp.level >= dp.max;
  const next = bottom ? 'Глубже некуда — это дно.' : `До спуска ${dp.turnsLeft} ${plural(dp.turnsLeft, 'ход', 'хода', 'ходов')}.`;
  const tip = `Каждые ${dp.every} ${plural(dp.every, 'круг', 'круга', 'кругов')} подземелье уходит глубже: монстры +1 к силе (боссов это не касается), дно — глубина ${dp.max}. С каждой ${DEPTH_TREASURE_EVERY}-й глубины победа даёт лишнюю карту клада. ${next}`;
  return `<span class="depth-pill${dp.level ? ' deep' : ''}" title="${esc(tip)}">${ico('stairs')}${dp.level ? `<span><span class="lbl">Глубина </span>${dp.level}<span class="lbl"> · +${dp.bonus}${dp.treasure ? ` · клад +${dp.treasure}` : ''}</span></span>` : '<span class="lbl">Поверхность</span>'}</span>`;
}
function contractHTML(p) {
  const k = p.contract;
  if (!k) return '';
  const tip = 'Контракт — ваша тайная цель. Выполните его — получите награду и новый контракт. Самому отстающему — ещё карта клада.';
  return `<div class="contract" title="${esc(tip)}"><span class="c-ico" aria-hidden="true">${ico('scroll-quill')}</span><div class="c-body">
    <div class="c-head"><b>${esc(k.name)}</b><span class="c-prog">${k.progress}/${k.need}</span>${p.contractsDone ? `<span class="c-done" title="Выполнено контрактов">${ico('check-mark')}${p.contractsDone}</span>` : ''}</div>
    <div class="c-text">${esc(k.text)} Награда: ${esc(k.rewardText)}.</div></div></div>`;
}
// «Шопоголик»: праздник только у самого игрока — золотые лучи, монеты и искры у кошелька на рынке (или у кнопки рынка)
function shopaholicFx() {
  const at = $('#shopModal .wallet') || document.querySelector('.market-pill') || $('#mecard .gold');
  sfx.play('victory', { always: true }); sfx.play('coins', { delay: 0.35, always: true });
  fx.banner('Шопоголик!', `Новый статус: на рынке для вас −${Math.round(REGULAR_DISCOUNT * 100)}%, а покупать можно в любой момент — даже в бою`, 'legend');
  if (!at) return;
  fx.rays(at, { color: '255,214,120', size: 300, dur: 2400 });
  fx.ring(at, { n: 3, size: 28, grow: 340, color: 'rgba(242,207,120,.9)' });
  fx.sparkle(at, { n: 26, colors: ['#fff6c8', '#ffd56a', '#ffffff', '#f2cf78'] });
  fx.coins(at, at, { n: 22 });
  setTimeout(() => { const el = $('#shopModal .wallet') || document.querySelector('.market-pill'); if (el) fx.sparkle(el, { n: 14, colors: ['#fff6c8', '#ffd56a'] }); }, 900);
}
// окошко контракта: условие, ход выполнения, награда
function openContractModal() {
  const p = me();
  if (!p?.contract) return closeOverlay();
  showOverlay(`<div class="modal contract-modal" id="contractModal" role="dialog" aria-label="Контракт">
    <h2>Контракт</h2>
    ${contractHTML(p)}
    <p class="muted" style="margin:0">Это ваша тайная цель — соперники её не видят. Выполните — получите награду и сразу новый контракт. Самому отстающему за выполненный контракт ещё и карта клада.</p>
    <div class="row"><button class="btn" type="button" data-act="closeOverlay">Закрыть</button></div>
  </div>`);
}
function tradeWaitHTML() {
  const mine = (S.game.trades || []).filter(o => o.from === S.room.me);
  return mine.map(o => `<div class="trade-wait"><span>${ico('shaking-hands')} Обмен → ${esc(pname(o.to))}: ждём ответа…</span><button class="btn ghost small" data-act="cancelTrade" data-id="${o.id}">Отозвать</button></div>`).join('');
}
// фишка вещи для выбора в обмене: без data-uid, чтобы клик не открывал карту
function tradeChip(uid, attr, on, note = '') {
  const d = def(uid);
  const val = d.bonus ? `+${d.bonus}` : d.runBonus ? `бег +${d.runBonus}` : '';
  return `<button class="chip tpick${on ? ' picked' : ''}${d.rarity && d.rarity !== 'common' ? ' r-' + d.rarity : ''}" ${attr}="${esc(uid)}" aria-pressed="${on}" title="${esc(d.name + (d.text ? ' — ' + d.text : ''))}">${ico(cardIcon(d))}<span class="chip-name">${esc(d.name)}${note ? ` <small>${note}</small>` : ''}</span>${val ? `<b>${val}</b>` : ''}</button>`;
}
function openTrade(pid) {
  const give = new Set(), want = new Set();
  const draw = () => {
    const mine = me(), p = pl(pid);
    if (!mine || !p) return closeOverlay();
    const myItems = [...mine.equipped.map(u => [u, 'надето']), ...mine.carried.map(u => [u, '']), ...mine.hand.filter(u => def(u).type === 'item').map(u => [u, 'в руке'])];
    const theirs = [...p.equipped.map(u => [u, 'надето']), ...p.carried.map(u => [u, ''])];
    const none = '<p class="muted" style="margin:0">Вещей нет.</p>';
    showOverlay(`<div class="modal trade-modal" role="dialog" aria-label="Обмен с ${esc(p.name)}">
      <h2>Обмен с ${esc(p.name)}</h2>
      <p class="muted" style="margin:0">Отметьте, что отдаёте и что хотите взамен. ${esc(p.name)} увидит предложение и решит. Можно просто подарить или попросить.</p>
      <div class="trade-cols">
        <div><h3>Вы отдаёте</h3><div class="trade-list">${myItems.map(([u, n]) => tradeChip(u, 'data-tgive', give.has(u), n)).join('') || none}</div></div>
        <div><h3>Вы просите</h3><div class="trade-list">${theirs.map(([u, n]) => tradeChip(u, 'data-twant', want.has(u), n)).join('') || none}</div></div>
      </div>
      <div class="row"><button class="btn hero" data-act="sendTrade" ${give.size + want.size ? '' : 'disabled'}>Предложить</button><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>
    </div>`);
  };
  S.ui.tradeForm = {
    get: () => ({ to: pid, give: [...give], want: [...want] }),
    toggle: (side, uid) => { const set = side === 'give' ? give : want; set.has(uid) ? set.delete(uid) : set.add(uid); draw(); },
  };
  draw();
}
function maybeTradePrompt() {
  const g = S.game;
  const o = (g.trades || []).find(x => x.to === S.room.me);
  if (!o) { if (S.ui.tradeAsked && $('#tradePrompt')) closeOverlay(); S.ui.tradeAsked = null; return; }
  if ($('#helpPrompt')) return; // сначала — просьба о помощи
  if (S.ui.tradeAsked === o.id && $('#tradePrompt')) return;
  S.ui.tradeAsked = o.id;
  sfx.play('bell', { always: true });
  const chips = list => (list.length ? `<div class="opp-items trade-list" data-zone-view>${list.map(u => chipHTML(u)).join('')}</div>` : '<p class="muted" style="margin:0">ничего</p>');
  showOverlay(`<div class="modal trade-modal" id="tradePrompt" role="alertdialog" aria-label="Предложение обмена">
    <h2>${esc(pname(o.from))} предлагает обмен</h2>
    <div class="trade-cols"><div><h3>Вы получите</h3>${chips(o.give)}</div><div><h3>Вы отдадите</h3>${chips(o.want)}</div></div>
    <p class="muted" style="margin:0;font-size:13.5px">Не ответите за ${Math.round(TRADE_TIMEOUT_MS / 1000)} с — это будет отказ. Полученные вещи лягут в «Не надето».</p>
    <div class="row"><button class="btn hero" data-trade="1" data-id="${o.id}">Принять</button><button class="btn ghost" data-trade="0" data-id="${o.id}">Отказаться</button></div>
  </div>`);
}
// всплывающие знаки новых механик — поверх обычных эффектов и заставок
// фон отвечает вспышкой на важные события (в обоих режимах показа)
const MOOD_FX = {
  victory: [0xffd27a, 0.24, 1.2], caught: [0xff3020, 0.22, 0], death: [0x8fa8ff, 0.3, 0], legendary: [0xffe08a, 0.3, 1.2], depth: [0x9fb8ff, 0.25, 1],
  duelEnd: [0xffd27a, 0.18, 0.8], trap: [0xffa040, 0.12, 0], location: [0xffffff, 0.16, 1], levelUp: [0xffe6a0, 0.08, 0.6], tame: [0xc4ef86, 0.14, 0.6],
};
const SHOCK_AT = { victory: () => document.querySelector('#stage .mon-wrap .card') || $('#stage'), legendary: f => avaOf(f.pid), depth: () => null, duelEnd: () => $('#stage') };
function shockAt(el, power) { const r = el?.getBoundingClientRect?.(); worldMood('shock', r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, power } : { power }); }
function moodFx(fresh) {
  for (const f of fresh) {
    if (SHOCK_AT[f.kind]) shockAt(SHOCK_AT[f.kind](f), f.kind === 'depth' ? 0.7 : 1);
    if ((f.kind === 'combat' || f.kind === 'wandering') && def(f.card)?.boss) shockAt($('#stage'), 1.3);
    const m = MOOD_FX[f.kind] || (f.kind === 'combat' || f.kind === 'wandering' ? (def(f.card)?.boss ? [0xc23cff, 0.28, 0] : [0xff5a2a, 0.12, 0]) : null);
    if (!m) continue;
    worldMood('flash', { color: m[0], alpha: m[1] });
    if (m[2]) worldMood('flare', { n: m[2] });
  }
}

// портрет откликается на события: удар — трещины и красная вспышка, проклятие — лиловая дымка, уровень — золотой свет
const REACT = { levelUp: 'react-up', levelDown: 'react-hit', caught: 'react-hit', death: 'react-hit', curse: 'react-curse' };
// стол перерисовывается часто — отклик помнится 3 с и при перерисовке продолжается с того же места (--rd)
const reacts = new Map();
const reactOf = pid => { const r = reacts.get(pid); if (!r) return { cls: '', st: '' }; const t = performance.now() - r.t0; if (t > 3000) { reacts.delete(pid); return { cls: '', st: '' }; } return { cls: ' ' + r.cls, st: `--rd:-${Math.round(t)}ms;` }; };
function portraitReact(fresh) {
  for (const f of fresh) {
    const cls = REACT[f.kind];
    if (!cls || !f.pid) continue;
    setTimeout(() => {
      reacts.set(f.pid, { cls, t0: performance.now() });
      const el = f.pid === S.room?.me ? $('#meava') : document.querySelector(`[data-opp="${CSS.escape(f.pid)}"]`);
      if (!el) return;
      el.classList.remove(...Object.values(REACT)); el.style.removeProperty('--rd'); void el.offsetWidth; el.classList.add(cls);
    }, cine.on ? 900 : 60);
  }
}
function extraFx(fresh) {
  achFx(fresh);
  moodFx(fresh);
  portraitReact(fresh);
  for (const f of fresh) {
    const ava = avaOf(f.pid);
    switch (f.kind) {
      case 'depth':
        sfx.play('quake');
        fx.banner(`Глубина ${f.depth}`, `Подземелье уходит глубже: монстры +${f.depth}${f.treasure ? `, за победу +${f.treasure} клада` : ''}`, '');
        break;
      case 'contract':
        sfx.play('levelUp');
        if (f.pid === S.room.me) fx.banner('Контракт выполнен!', f.reward, 'win');
        else fx.float(ava, 'Контракт!', 'good');
        break;
      case 'haunt': {
        sfx.play(f.side === 'monster' ? 'modBad' : 'modGood');
        const el = $(f.side === 'monster' ? '#shieldMon' : '#shieldHero');
        fx.float(el || ava, `+${f.n}`, f.side === 'monster' ? 'bad' : 'good');
        fx.smoke(ava || el, { colors: ['rgba(190,210,255,.45)', 'rgba(150,170,230,.35)'], sparks: false });
        break;
      }
      case 'trade':
        sfx.play('buff');
        fx.float(ava, 'Обмен', 'good'); fx.float(avaOf(f.to), 'Обмен', 'good');
        break;
      case 'tradeNo':
        if (f.to === S.room.me) toast(`${pname(f.pid)} отказывается от обмена`);
        break;
      case 'gold':
        sfx.play('coins'); fx.float(ava, `+${f.n} г`, 'good'); fx.coins(ava, ava, { n: 5 });
        break;
      case 'jackpot':
        sfx.play('fanfare'); sfx.play('coins', { delay: 0.2 });
        fx.banner(`${def(f.card).name}!`, `${pname(f.pid)}: +${f.n} голдов в кошелёк`, 'legend');
        if (ava) { fx.coins(ava, ava, { n: 24 }); fx.sparkle(ava, { n: 18, colors: def(f.card).id === 'g_atlantis' ? ['#fff3b0', '#ffd56a', '#8fe8ff'] : ['#fff3b0', '#ffd56a', '#e8e2d4'] }); }
        break;
      case 'farewell':
        sfx.play('death'); sfx.play('bell', { delay: 0.4 });
        fx.banner('Прощай навсегда', `${pname(f.pid)} выбывает из партии — вернуть может только Ящик Пандоры`, 'bad');
        break;
      case 'reborn':
        sfx.play('portal');
        fx.banner('Возвращение', `${pname(f.pid)} снова в игре`, 'pandora');
        if (ava) fx.sparkle(ava, { n: 14, colors: ['#f3d9ff', '#c77dff', '#ffffff'] });
        break;
      case 'pandora': {
        sfx.play('portal'); sfx.play('bossRise', { delay: 0.25 });
        fx.banner('Ящик Пандоры открыт!', `${pname(f.pid)}: сила монстров ×${PANDORA_MULT}, героям −${PANDORA_ESCAPE} к побегу`, 'pandora');
        const box = [...document.querySelectorAll('#stage .pandora')].find(e => e.offsetParent); if (box) { fx.ring(box, { n: 3, size: 30, grow: 520, color: 'rgba(200,125,255,.9)' }); fx.sparkle(box, { n: 14, colors: ['#f3d9ff', '#c77dff', '#ffd56a'] }); }
        fx.shake($('#stage'), 'bump');
        break;
      }
      case 'pandoraLoss':
        sfx.play('shatter');
        if (f.n) fx.banner(`${pname(f.pid)} теряет всё`, `Ящик Пандоры раздал ${f.n} ${plural(f.n, 'вещь', 'вещи', 'вещей')} другим игрокам`, 'pandora');
        for (const id of f.to || []) fx.float(avaOf(id), 'Подарок ящика', 'good');
        break;
      case 'buy':
        sfx.play('coins'); fx.float(ava, def(f.card).name, 'good'); fx.coins(ava, ava, { n: 6 });
        break;
      case 'duel':
        sfx.play('shing');
        if (f.femme) fx.banner('Роковая женщина!', `${pname(f.by)} стравливает ${pname(f.pid)} и ${pname(f.to)}`, 'curse');
        else fx.banner('Вызов!', `${pname(f.pid)} вызывает ${pname(f.to)} на поединок`, '');
        break;
      case 'duelMod': {
        const el = $(f.side === 'from' ? '#shieldHero' : '#shieldMon');
        sfx.play('modGood'); fx.float(el || ava, `+${f.n}`, 'good'); if (el) fx.shake(el, 'bump');
        break;
      }
      case 'duelEnd':
        sfx.play(f.pid && f.pid === S.room.me ? 'victory' : f.loser && f.loser === S.room.me ? 'levelDown' : 'clang');
        if (f.femme && !f.pid) fx.banner('Ничья', `${pname(f.from)} и ${pname(f.to)} уходят целыми`, '');
        else if (f.femme) fx.banner(`${pname(f.pid)} побеждает`, `${pname(f.loser)} теряет ${[f.card && `«${def(f.card).name}»`, f.levels && `${f.levels} ур.`].filter(Boolean).join(' и ') || 'только гордость'}`, f.pid === S.room.me ? 'win' : '');
        else fx.banner(`${pname(f.pid)} побеждает`, f.card ? `и забирает «${def(f.card).name}» у ${pname(f.loser)}` : `${pname(f.loser)} нечего отдать`, f.pid === S.room.me ? 'win' : '');
        break;
      case 'trap':
        sfx.play('clang');
        fx.dust(ava, { n: 14, rocks: 4 }); fx.float(ava, 'Ловушка!', 'bad'); fx.shake(ava?.closest('.opp') || ava);
        break;
      case 'trapOk':
        sfx.play('diceOk'); fx.sparkle(ava, { n: 12 }); fx.float(ava, 'Обезврежено', 'good');
        break;
      case 'tamable':
        if (f.pid === S.room.me) fx.banner('Зверь покорён', `${def(f.card).name} признал вашу силу: приручите его до конца хода`, 'win');
        break;
      case 'tame':
        sfx.play('pet'); fx.hearts(ava); fx.float(ava, `Питомец +${tameBonus(def(f.card))}`, 'good');
        break;
      case 'ally':
        sfx.play('buff'); fx.sparkle(ava, { n: 14, colors: ['#d2e6ff', '#6f97c8', '#fff'] }); fx.float(ava, def(f.card).name.split(' ')[0], 'good');
        break;
      case 'allyGone':
        sfx.play('poof'); fx.smoke(ava, { sparks: false }); fx.float(ava, 'Наёмник ушёл', 'bad');
        break;
      case 'lure':
        sfx.play('dash'); fx.float(avaOf(f.from), 'Сманили!', 'bad'); fx.float(ava, def(f.card).name.split(' ')[0], 'good');
        break;
    }
  }
}

// ───────────────────────── подвиги: рамки за достижения ─────────────────────────
// Рамка (номер, как в AV_LABELS.frame) → подвиг, который её открывает; остальные рамки доступны сразу.
// Подвиги хранятся в этом браузере.
const FRAME_ACH = { 4: 'win', 8: 'boss', 9: 'duel', 10: 'tame', 11: 'contracts', 12: 'legend' };
const ACH = {
  win: ['Победите в партии', 'за победу в партии'],
  boss: ['Одолейте босса', 'за победу над боссом'],
  duel: ['Выиграйте поединок', 'за выигранный поединок'],
  tame: ['Приручите зверя', 'за приручённого зверя'],
  contracts: ['Выполните 5 контрактов', 'за пять выполненных контрактов'],
  legend: ['Соберите Легендарный комплект', 'за Легендарный комплект'],
};
const achDone = () => LS.get('ach', {});
const frameLocked = i => !!FRAME_ACH[i] && !achDone()[FRAME_ACH[i]];
function unlock(key) {
  if (spectating()) return;
  const a = achDone();
  if (a[key]) return;
  a[key] = true; LS.set('ach', a);
  const i = Object.keys(FRAME_ACH).find(k => FRAME_ACH[k] === key);
  if (i) { setTimeout(() => { fx.banner('Новая рамка!', `«${AV_LABELS.frame[i]}» — ${ACH[key][1]}. Наденьте её в облике героя.`, 'legend'); sfx.play('legendary', { always: true }); }, 1800); }
}
function achFx(fresh) {
  const me = S.room?.me;
  if (!me || spectating()) return;
  for (const f of fresh) {
    if (f.kind === 'victory' && (f.pid === me || f.helper === me) && (f.cards || []).some(u => def(u).boss)) unlock('boss');
    if (f.kind === 'tame' && f.pid === me) unlock('tame');
    if (f.kind === 'duelEnd' && f.pid === me) unlock('duel');
    if (f.kind === 'contract' && f.pid === me) { const a = achDone(); a.contractsN = (a.contractsN || 0) + 1; LS.set('ach', a); if (a.contractsN >= 5) unlock('contracts'); }
  }
}

function maybeEndScreen() {
  const g = S.game;
  if (g.phase !== 'ended') return;
  if ($('#endScreen')) return;
  const w = g.winners.map(pl).filter(Boolean);
  const isHost = S.room.hostId === S.room.me;
  const iWon = w.some(p => p.id === S.room.me);
  if (iWon) unlock('win');
  // испытание дня: запоминаем свой лучший результат за этот день
  let daily = '';
  if (g.opts?.daily && !spectating()) {
    const rec = LS.get('daily', {});
    const best = rec.date === g.opts.daily ? rec.turns : null;
    if (iWon && (!best || g.turn.n < best)) LS.set('daily', { date: g.opts.daily, turns: g.turn.n });
    daily = `<p class="daily-result">${ico('calendar')} Испытание дня «${esc(dailyOf(g.opts.daily).name)}»: ${iWon ? `победа за ${g.turn.n} ${plural(g.turn.n, 'ход', 'хода', 'ходов')}` : 'в этот раз без победы'}${best ? ` · ваш лучший сегодня — ${Math.min(best, iWon ? g.turn.n : best)}` : ''}</p>`;
  }
  setTimeout(() => { fx.confetti({ n: 180 }); fx.sparkle($('#endScreen .es-crown'), { n: 22 }); }, 80);
  setTimeout(() => cine.gameOver(), 500);
  sfx.play(w.some(p => p.id === S.room.me) ? 'fanfare' : 'victory', { always: true });
  // победитель — крупным портретом на фоне картины локации, где закончилась партия
  const loc = g.location ? def(g.location) : null;
  const bg = loc?.art ? `--bg:url('${locImg(loc.art, false)}')` : '';
  const heroes = w.map(p => { const a = gAva(p); return `<span class="es-ava${a.frame ? ' framed' : ''}" style="--seat:${p.color};--fext:${frameExt(a)}">${avatarSVG(a, p.color)}</span>`; }).join('');
  const places = [...g.players].sort((a, b) => (g.winners.includes(b.id) - g.winners.includes(a.id)) || b.level - a.level);
  showOverlay(`<div class="modal endscreen" id="endScreen" role="dialog" aria-label="Итоги партии">
    <div class="es-hero" style="${bg}">
      <div class="es-heroes${w.length > 1 ? ' two' : ''}">${iconSVG('crown', 'es-crown')}${heroes}</div>
      <h2>${w.map(p => esc(p.name)).join(' и ')} ${w.length > 1 ? 'побеждают' : 'побеждает'}!</h2>
      <p class="es-sub">${spectating() ? 'Партия окончена. Было что посмотреть.' : w.some(p => p.id === S.room.me) ? 'Подземелье покорено. Можно гордиться.' : 'В следующий раз подставляйте лидера раньше.'}${loc ? ` · ${esc(loc.name)}` : ''} · ${g.turn.n} ${plural(g.turn.n, 'ход', 'хода', 'ходов')}</p>
    </div>
    ${daily}
    ${endNominations(g)}
    <ol class="es-places">${places.map((p, i) => `<li class="${g.winners.includes(p.id) ? 'win' : ''}${p.id === S.room.me ? ' me' : ''}"><span class="es-n">${i + 1}</span><span class="es-mini" style="--seat:${p.color}">${avatarSVG({ ...gAva(p), frame: 0 }, p.color)}</span><b>${esc(p.name)}</b><span class="es-lv">${p.level} ур.</span></li>`).join('')}</ol>
    <div class="row" style="justify-content:center">${isHost ? '<button class="btn primary" data-act="toLobby">Новая партия</button>' : '<span class="muted">Новую партию запускает хозяин.</span>'}<button class="btn ghost" data-act="closeOverlay">Посмотреть стол</button></div>
  </div>`);
}
// Номинации партии по счёту, который вёл сервер (engine: tally): первые шесть, в которых кто-то отличился. Без счёта — ничего.
const NOMS = [
  ['kills', 'Мясник подземелья', 'crossed-swords', n => `${n} ${plural(n, 'монстр повержен', 'монстра повержено', 'монстров повержено')}`],
  ['dirty', 'Подставил больше всех', 'double-face-mask', n => `${n} ${plural(n, 'пакость', 'пакости', 'пакостей')} в чужих боях`],
  ['cursesIn', 'Самый проклятый', 'cursed-star', n => `${n} ${plural(n, 'проклятие', 'проклятия', 'проклятий')} на себе`],
  ['cursesOut', 'Злой колдун', 'pentacle', n => `наслал ${n} ${plural(n, 'проклятие', 'проклятия', 'проклятий')}`],
  ['spent', 'Транжира', 'coins-pile', n => `${n} ${plural(n, 'голд', 'голда', 'голдов')} спущено`],
  ['helps', 'Верный товарищ', 'shaking-hands', n => `помог в ${n} ${plural(n, 'бою', 'боях', 'боях')}`],
  ['earned', 'Барыга', 'two-coins', n => `наторговал ${n} ${plural(n, 'голд', 'голда', 'голдов')}`],
  ['deaths', 'Мученик', 'tombstone', n => `${n === 1 ? 'погиб однажды' : `погибал ${n} ${plural(n, 'раз', 'раза', 'раз')}`}`],
  ['escapes', 'Неуловимый', 'run', n => `${n} ${plural(n, 'удачный побег', 'удачных побега', 'удачных побегов')}`],
  ['duels', 'Дуэлянт', 'duel', n => `${n} ${plural(n, 'поединок выигран', 'поединка выиграно', 'поединков выиграно')}`],
];
function endNominations(g) {
  const st = g.stats;
  if (!st) return '';
  const cards = NOMS.map(([k, title, icon, text]) => {
    const best = Math.max(0, ...g.players.map(p => st[p.id]?.[k] || 0));
    if (!best) return '';
    const who = g.players.filter(p => (st[p.id]?.[k] || 0) === best);
    const names = who.length > 2 ? `${esc(who[0].name)}, ${esc(who[1].name)} и ещё ${who.length - 2}` : who.map(p => esc(p.name)).join(' и ');
    return `<div class="es-nom" style="--seat:${who[0].color}"><span class="es-pic"><span class="es-mini">${avatarSVG({ ...gAva(who[0]), frame: 0 }, who[0].color)}</span><i class="es-ico">${ico(icon)}</i></span>
      <div class="es-nt"><small>${esc(title)}</small><b>${names}</b><em>${esc(text(best))}</em></div></div>`;
  }).filter(Boolean).slice(0, 6);
  return cards.length ? `<section class="es-noms" aria-label="Номинации партии">${cards.join('')}</section>` : '';
}

// «Что нового»: изменения по датам; метка на кнопке гаснет, когда игрок открыл окно
function newsUnseen() { return LS.get('newsSeen', '') < NEWS_LATEST; }
const newsDate = d => new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
function openNews() {
  LS.set('newsSeen', NEWS_LATEST);
  document.querySelectorAll('.news-dot').forEach(e => e.remove());
  showOverlay(`<div class="modal rules news" role="dialog" aria-label="Что нового" style="max-width:640px">
    <h2>Что нового</h2>
    <p class="muted" style="margin:0">Новые механики и карты — самое свежее сверху.</p>
    ${NEWS.map((day, i) => `<section class="news-day"><h3>${esc(newsDate(day.date))}${i === 0 ? ' <span class="badge lamp">новое</span>' : ''}</h3>
      <ul>${day.items.map(x => `<li><b>${esc(x.t)}.</b> ${esc(x.d)}</li>`).join('')}</ul></section>`).join('')}
    <div class="row"><button class="btn primary" data-act="closeOverlay">Понятно</button><button class="btn ghost" data-act="rules">Как играть</button></div>
  </div>`);
}

const RULES = `<div class="modal rules" role="dialog" aria-label="Как играть" style="max-width:640px">
  <h2>Как играть</h2>
  <p>Каждый начинает человеком первого уровня с 4 картами проходов и 4 картами клада. Побеждает тот, кто первым дойдёт до <b>10-го уровня</b>; хозяин в лобби может выбрать быструю партию до 5-го (на старте по 6 карт каждой колоды) или долгую — до 15 или 20. Последний уровень берётся только победой над монстром.</p>
  <h3>Ход</h3>
  <p>1. Разложите расу, класс и вещи. 2. <b>Выбейте дверь</b>: монстр — бой, проклятие — сработает на вас, ловушка — обезвредить или принять расплату, остальное уходит в руку. 3. Если монстра не было — позовите на бой монстра с руки, а если монстров на руке нет — ищите неприятности (выйдет случайный монстр по глубине подземелья, разбуженный: +${TROUBLE_BONUS} к силе). Или просто обшарьте комнату. 4. Лишние карты сверх пяти отдаются самому слабому.</p>
  <h3>Бой</h3>
  <p>Ваша сила — уровень плюс надетые вещи. Если она больше силы монстров, жмите «Добить!». У остальных есть несколько секунд, чтобы помешать: усилить монстра, подбросить ещё одного, ударить в спину. За победу — уровень и клад. Не хватает сил — зовите на помощь, пообещав часть клада, или бегите: побег удаётся на 5–6 кубика. Карта «Ты мой раб» заставляет любого игрока вступить в ваш бой: отказаться он не может, а клада ему не положено. Не убежали — получите расплату с карты монстра.</p>
  <h3>Вещи и уровни</h3>
  <p>Один головняк, один броник, одна обувка, две руки и одна большая вещь (гномам — сколько угодно, механикам — три руки). Можно завести одного питомца: он даёт бонус и один раз спасает от расплаты. Вещи можно продать — голды идут в кошелёк и тратятся на рынке. Собрали все вещи комплекта — получаете бонус сверху: Легендарный (Шлем Ареса, Доспехи Бога, Сапоги эпохи и Меч Экскалибур) даёт ещё +7. Его части носит только человек — герой без расы, а со «Смешанной кровью» — герой любой расы.</p>
  <h3>Спутники и приручение</h3>
  <p>Спутник — карта клада, он один: Носильщик даёт +2 к пределу руки и ещё одну большую вещь, Проводник — +2 к побегу, Наёмник — +3 к силе, но в начале каждого вашего хода берёт плату: 200 голдов из кошелька, а если их нет — карту ценой от 200 голдов из руки или запаса, иначе уходит. Спутник носит за вас вещи: когда он приходит, ему выпадают места — оружие и броник, а повезёт — ещё и головняк. Откройте свою вещь и выберите «Отдать спутнику»: её бонус пойдёт вам в силу. Вещи с ограничением по расе или классу носит только сам герой. Уйдёт спутник — его вещи вернутся вам. Победили зверя с перевесом ${TAME_MARGIN} и больше (чернокнижник — ${WARLOCK_TAME}) — до конца хода его можно приручить: он займёт место питомца и даст силу по своему уровню. Плут может сманить чужого спутника или зверя: сбросить карту и выбросить 4+.</p>
  <h3>Поединок</h3>
  <p>Карта «Вызов на поединок» играется в свой ход вне боя: выберите соперника. Сравнивается сила — уровень, вещи и бонусы «в следующем бою»; остальные могут подкинуть разовые бонусы любой стороне, и тогда отсчёт начинается заново. При равенстве побеждает вызванный (а воин-зачинщик — и при равенстве). Проигравший отдаёт победителю свою лучшую вещь со стола, легендарки не отдаются.</p>
  <p>«Роковая женщина» тоже играется в свой ход вне боя, но на двух соперников: из-за неё они бьются между собой по тем же правилам, остальные могут подкинуть бонусы. Проигравший теряет свою самую ценную большую вещь (легендарки не теряются) и ${FEMME_LEVELS} уровня. Ничья — оба уходят целыми. Обе карты продаются на рынке в разделе «Поединки»: вызов — около 700 голдов, роковая женщина — около 1000.</p>
  <h3>Кошелёк и подземный рынок</h3>
  <p>У каждого есть кошелёк: голды в него приходят за проданные вещи и выполненные контракты. Сколько голдов у вас, видите только вы — чужие кошельки скрыты. Рынок открыт всегда — кнопка в шапке стола. В свой ход вне боя на голды можно купить разовые карты для боя, зелья, проклятия, чтобы наслать на соперников, и «Получи уровень» (не больше одного за ход, последний уровень так не взять). Продаётся только то, что ещё лежит в колоде, поэтому товар кончается. У каждой локации своя ценовая политика: в таверне еда за полцены, в Звёздной библиотеке дешевле уровни и свитки, на кладбище — проклятия, а в Небесной цитадели уровни в полтора раза дороже. Цены локации написаны на её карте. Карты «Сокровища Атлантиды» и «Сундук мертвеца» (по одной в колоде) сразу кладут в кошелёк по 3000 голдов, а единственное проклятие «Прощай навсегда» (на рынке — около 3000) отнимает у жертвы всё и выбивает её из партии, пока кто-нибудь не откроет Ящик Пандоры.</p>
  <h3>Ящик Пандоры</h3>
  <p>Во время любого боя — своего или чужого — на столе стоит резная шкатулка. Любой игрок может открыть её за ${PANDORA_COST} голдов: в этом бою вся сила монстров удваивается (и всё, что им подкинут после), героям −${PANDORA_ESCAPE} к побегу, а кто из героев не убежит, лишится всех вещей и питомца — их раздадут другим игрокам наугад. Спутник остаётся. Чернокнижник уходит тенью и ничего не теряет. В одном бою — один ящик.</p>
  <h3>Ловушки</h3>
  <p>Ловушка за дверью срабатывает на того, кто её открыл. Можно рискнуть и обезвредить — на кубике 4+ (плуту и механику 2+): тогда ловушка ваша и её можно подложить сопернику. Сорвалась — расплата и ещё −1 уровень. Можно не рисковать и просто принять расплату. Подложенную ловушку соперник обезвреживает тем же броском, но без лишнего штрафа. Противогаз и каска с канарейкой спасают от газа.</p>
  <h3>Расы и классы</h3>
  <p>Расы: эльф, гном, полурослик, орк, гоблин и кротолюд. Классы: воин, маг, жрец, плут, бард, алхимик, механик, ведьмак и чернокнижник — он уходит от любого монстра без броска и сам призывает монстров с руки в бои. У каждого свои способности — они написаны на картах, а кнопки способностей появляются у вас на столе.</p>
  <h3>Глубина</h3>
  <p>Каждые несколько кругов подземелье уходит глубже: все монстры, кроме боссов, получают +1 к силе за каждую глубину, а с каждой ${DEPTH_TREASURE_EVERY}-й глубины победа приносит лишнюю карту клада. В партии до 10 спуск — раз в ${DEPTH[10].every} круга, дно на глубине ${DEPTH[10].max}; в длинных партиях спуск чаще и глубже. Глубина видна в шапке стола.</p>
  <h3>Контракты</h3>
  <p>У каждого есть тайный контракт — небольшая цель вроде «победи двух нежитей» или «обшарь три комнаты». Выполнили — получаете голды в кошелёк (за трудные контракты — 1000, за простые — 600) и новый контракт. Самому отстающему за выполненный контракт положена ещё карта клада. Свой контракт видите только вы, остальные — сколько контрактов вы закрыли.</p>
  <h3>Обмен</h3>
  <p>Нажмите на соперника и выберите «Предложить обмен»: отметьте свои вещи (со стола или из руки) и вещи, которые хотите у него со стола. Он примет или откажется; молчание дольше ${Math.round(TRADE_TIMEOUT_MS / 1000)} с — отказ. Во время своего боя меняться нельзя. Боты тоже отвечают на обмен, но почти победителю не помогают.</p>
  <h3>Характеры ботов</h3>
  <p>Осторожный помогает только наверняка и редко лезет в неприятности. Жадный рискует, торгуется за клад и делится скупо. Мстительный помнит, кто ему мешал или насылал проклятия, и отвечает тем же. Характер виден на фишке бота.</p>
  <h3>Локации и события</h3>
  <p>Карта локации меняет правила для всех, пока кто-нибудь не сыграет другую, и переносит стол в новое место: в таверне держат больше карт, в Небесной цитадели за победу дают лишний уровень, у Оазиса джинна уровни на рынке дешевле, а проклятия не действуют, на Затопленной станции бегут по пояс в воде, в Логове Кощея за победу дают лишний клад. События срабатывают сразу для всего стола: «Пересменка» передаёт всю руку соседу слева (только не на Поверхности), «Профсоюзное собрание» снимает уровень с лидеров, если против них большинство, «Затопление» уносит обувь у всех, кто не в непромокаемой. Зелья дают бонус в текущем или следующем бою.</p>
  <h3>Особые монстры</h3>
  <p>Одни нападают из засады, едва вы открыли дверь, другие не терпят помощников (метка «без помощи»), от третьих не убежать. Против монстров с меткой «только уровень» — Лихо, Горгоны, Циклопа и Кощея — считается один уровень героя: вещи, зелья, способности и разовые бонусы не помогают. Зеркальный двойник всегда сильнее лидера партии. Читайте карту, прежде чем драться.</p>
  <h3>Боссы</h3>
  <p>В колоде пять боссов — Люцифер, Аид, Анубис, Морена и Чернобог. Морена при появлении морозит у каждого лучшую надетую вещь, Чернобог отнимает по карте у всех, кроме бойца. Уровень у боссов 666, а сила — вдвое больше силы героя, против которого босс вышел, но не меньше ${BOSS_FLOOR}. Усилители и чары на них не действуют, зато помощник, зелья и разовые карты помогают как обычно: вдвоём босса можно одолеть и получить 5 кладов и 2 уровня. За героями ниже 9-го уровня боссы не гонятся, а тех, кто постарше, при неудачном побеге убивают и отбрасывают на 5 уровней.</p>
  <h3>Испытание дня и рамки</h3>
  <p>Хозяин в лобби может включить испытание дня: в этот день колода у всех одна и та же, а партию меняет условие дня — например, старт с глубины или сразу в локации. Ваш лучший результат за день запоминается. Шесть рамок медальона открываются подвигами: победой в партии, победой над боссом, выигранным поединком, приручённым зверем, пятью контрактами и Легендарным комплектом.</p>
    <h3>Смерть и призраки</h3>
  <p>Погибший теряет вещи, руку и ${DEATH_LEVELS} уровень (ниже первого не опустится), но сохраняет расу и класс. В свой следующий ход он возвращается с новыми картами. А пока ждёт — он призрак: раз за ход может подкинуть +${GHOST_BONUS} героям или монстрам в чужом бою.</p>
  <div class="row"><button class="btn primary" data-act="closeOverlay">Понятно</button><button class="btn ghost" data-act="guide">Справочник карт</button></div>
</div>`;

// ───────────────────────── эффекты ─────────────────────────
// Сервер присылает короткий журнал событий (fx). Новые события проигрываются после перерисовки стола.
function handleFx(first) {
  const g = S.game;
  if (!g) return [];
  const list = g.fx || [];
  // по самому большому номеру, а не по последней записи: так одна кривая запись не заставит переиграть весь журнал
  const maxId = list.reduce((m, f) => Math.max(m, f.id || 0), 0);
  if (S.ui.lastFx === null || first) { S.ui.lastFx = maxId; S.ui.lastLoc = g.location; return []; }
  const fresh = list.filter(f => f.id > S.ui.lastFx);
  S.ui.lastFx = Math.max(S.ui.lastFx, maxId);
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
  lvlEl: pid => (pid === S.room?.me ? $('#mecard .lvl') : document.querySelector(`[data-opp="${pid}"] .hm-lvl`)),
  color: pid => pl(pid)?.color || '#f5b83d',
  avatar: pid => (pl(pid) ? gAva(pl(pid)) : null),
  winLevel: winLvl,
});
function soundFx(fresh) {
  const kinds = new Set(fresh.map(f => f.kind));
  for (const f of fresh) {
    switch (f.kind) {
      case 'reveal': sfx.play('door'); break;
      case 'combat': case 'wandering': {
        if (def(f.card)?.boss) sfx.play('bossRise');
        const lv = def(f.card)?.level ?? 5;
        sfx.play('growl', { delay: kinds.has('reveal') ? 0.4 : 0.1, pitch: 1.35 - Math.min(lv, 20) / 28, dur: 0.6 + Math.min(lv, 20) / 40, kind: growlKind(def(f.card)) });
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
  extraFx(fresh);
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
        if (f.pid === S.room.me) toast(`Вы погибли и потеряли уровень. Вернётесь в свой следующий ход с новыми картами, а пока вы призрак: раз за ход можно подкинуть +${GHOST_BONUS} в чужом бою.`);
        break;
      case 'pet':
        fx.hearts(ava); fx.float(ava, `${def(f.card).name} спасает!`, 'good');
        break;
      case 'buff':
        fx.sparkle(ava, { colors: ['#ffb0c8', '#ff7aa8', '#fff3b0'] }); fx.float(ava, `+${f.n} в бою`, 'good');
        break;
      case 'strike': {
        const mon = document.querySelector('#stage .mon-wrap .card');
        fx.slash(mon, { color: '255,236,200' }); fx.ring($('#shieldMon'), { size: 30, grow: 420, color: 'rgba(255,236,200,.9)' }); fx.shake($('#stage'), 'bump');
        break;
      }
      case 'caught':
        fx.vignette('rgba(200,30,20,.55)'); fx.slash(ava, { color: '255,90,60', angle: 32 }); fx.shake(ava?.closest('.opp') || ava);
        break;
      case 'escaped':
        fx.dust(ava, { n: 14 }); fx.float(ava, f.shadow ? 'Ушёл тенью' : 'Удрал!', 'good');
        break;
      case 'reveal': {
        const door = $('#deckDoor');
        fx.rays(door, { size: 220, dur: 900, color: '255,220,160' }); fx.dust(door, { n: 10 });
        break;
      }
      case 'victory': {
        const st = $('#stage');
        fx.rays(st, { size: Math.min(innerWidth, 900), dur: 1700 }); fx.ring($('#shieldHero'), { n: 3, size: 40, grow: 700, color: 'rgba(143,240,210,.85)' });
        fx.banner('Победа!', `${pname(f.pid)} одолевает монстров`, 'win');
        fx.confetti({ at: st, n: 90 });
        fx.coins(st, avaOf(f.pid), { n: 14 });
        break;
      }
      case 'location': {
        const d = def(f.card);
        fx.banner(d.name, ruleText(d.text), 'loc');
        const st = $('#stage');
        setTimeout(() => fx.ambient(st, d.art), 200);
        const b = $('#locBanner'); if (b) fx.shake(b, 'pop-in');
        break;
      }
      case 'event': {
        const d = def(f.card);
        fx.banner(d.name, ruleText(d.text), 'event');
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
        fx.float(el, `+${MUTAGEN_BONUS}`, 'good'); fx.burst(el, { n: 30, colors: ['#a6f2b7', '#3fa38c', '#e6fbff'], speed: 300 }); fx.shake(el, 'bump');
        fx.smoke(ava || el, { colors: ['rgba(120,255,170,.45)', 'rgba(60,200,140,.4)'], sparks: false });
        fx.banner('Мутаген!', `${pname(f.pid)}: +${MUTAGEN_BONUS} к силе`, 'win');
        break;
      }
      case 'legendary': {
        const d = def(f.card);
        fx.rays(ava, { color: d.id === 'p_golddragon' ? '255,150,60' : '255,214,120', size: 260, dur: 2000 });
        fx.ring(ava, { n: 3, size: 30, grow: 420, color: 'rgba(255,230,160,.9)' });
        fx.banner(d.name, `Легендарная вещь у ${pname(f.pid)}`, 'legend');
        fx.sparkle(ava, { n: 26, colors: ['#fff3b0', '#ffd56a', '#ffffff', '#a6f2ff'] });
        fx.burst(ava, { n: 34, colors: ['#ffe08a', '#f5b83d', '#fff'], speed: 320, g: 120 });
        break;
      }
      case 'lullaby': {
        const el = $('#shieldMon');
        fx.notes(ava || $('#shieldHero'), el);
        setTimeout(() => { fx.float(el, `−${LULLABY_PENALTY}`, 'good'); fx.shake(el, 'bump'); }, 500);
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
  else if (t.closest('.btn, .seg button, .tabs button, .opp, .pick, .room-row, .av-pick, .av-chip, .hero-ava')) sfx.play('click');
  if (t.matches('[data-backdrop]')) {
    if ($('#helpPrompt') || $('#tradePrompt')) return; // на просьбу о помощи и обмен нужно ответить
    return closeOverlay();
  }
  // внутри справочника свои обработчики: карты там только рассматривают
  if (t.closest('.guide')) return;
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
  const vf = t.closest('[data-vforce]');
  if (vf) { const r = await call('voice:force', { id: vf.dataset.vforce, on: vf.dataset.on === '1' }); if (!r.ok) toast(r.error); return; }
  const vk = t.closest('[data-vkick]');
  if (vk) { const r = await call('voice:kick', { id: vk.dataset.vkick }); if (!r.ok) toast(r.error); return; }
  const vu = t.closest('[data-vunban]');
  if (vu) { const r = await call('voice:unban', { key: vu.dataset.vunban }); if (!r.ok) toast(r.error); return; }
  const wk = t.closest('[data-wkick]');
  if (wk) { const r = await call('room:kickWatcher', { id: wk.dataset.wkick }); if (!r.ok) toast(r.error); return; }
  const watchBtn = t.closest('[data-watch]');
  if (watchBtn) return tryWatch(watchBtn.dataset.watch, watchBtn.dataset.locked === 'true' ? undefined : '');
  const follow = t.closest('[data-follow]');
  if (follow) { S.ui.watchPid = follow.dataset.follow; return renderMine(); }
  const join = t.closest('[data-join]');
  if (join) {
    if (!S.name.trim()) return openJoinModal(join.dataset.join, S.rooms.find(r => r.id === join.dataset.join));
    return tryJoin(join.dataset.join, join.dataset.locked === 'true' ? undefined : '');
  }
  const tg = t.closest('[data-tgive], [data-twant]');
  if (tg) return S.ui.tradeForm?.toggle(tg.dataset.tgive ? 'give' : 'want', tg.dataset.tgive || tg.dataset.twant);
  const trAns = t.closest('[data-trade]');
  if (trAns) { const r = await act({ type: 'answerTrade', id: Number(trAns.dataset.id), accept: trAns.dataset.trade === '1' }); if (r.ok) closeOverlay(); return; }
  const helpAns = t.closest('[data-help]');
  if (helpAns) { const r = await act({ type: 'answerHelp', accept: helpAns.dataset.help === '1' }); if (r.ok) closeOverlay(); return; }
  const helpTo = t.closest('[data-helpto]');
  if (helpTo) return S.ui.helpForm.setT(helpTo.dataset.helpto);
  const off = t.closest('[data-offer]');
  if (off) return S.ui.helpForm.setO(Number(off.dataset.offer));
  const kick = t.closest('[data-kick]');
  if (kick) { const r = await call('room:kick', { memberId: kick.dataset.kick }); if (!r.ok) toast(r.error); return; }
  const dailyBtn = t.closest('[data-daily]');
  if (dailyBtn) { const r = await call('room:settings', { daily: dailyBtn.dataset.daily === '1' }); if (!r.ok) toast(r.error); return; }
  const winBtn = t.closest('[data-win]');
  if (winBtn) { const r = await call('room:settings', { winLevel: Number(winBtn.dataset.win) }); if (!r.ok) toast(r.error); return; }
  const delay = t.closest('[data-delay]');
  if (delay) { const r = await call('room:settings', { winDelayMs: Number(delay.dataset.delay) }); if (!r.ok) toast(r.error); return; }
  const max = t.closest('[data-max]');
  if (max) { const r = await call('room:settings', { maxPlayers: Number(max.dataset.max) }); if (!r.ok) toast(r.error); return; }
  const tab = t.closest('[data-tab]');
  if (tab) return setTab(tab.dataset.tab);
  const avk = t.closest('[data-av-k]');
  if (avk && avk.dataset.avK === 'frame' && frameLocked(Number(avk.dataset.avV)) && S.ui.avEdit.cfg.frame !== Number(avk.dataset.avV)) return toast(`Рамка «${AV_LABELS.frame[avk.dataset.avV]}» откроется: ${ACH[FRAME_ACH[avk.dataset.avV]][0].toLowerCase()}`);
  if (avk) { S.ui.avEdit.cfg = { ...S.ui.avEdit.cfg, [avk.dataset.avK]: Number(avk.dataset.avV) }; return drawAvatarEditor(); }
  const avp = t.closest('[data-av-pick]');
  if (avp) { const [r, g, l] = avp.dataset.avPick.split('.').map(Number); return avPick(r, g, l); }
  const avf = t.closest('[data-av-f]');
  if (avf) { const [k, v] = avf.dataset.avF.split(':'); S.ui.avEdit.filter[k] = Number(v); if (!S.ui.avEdit.game) LS.set('avFilter', S.ui.avEdit.filter); return drawAvatarEditor(); }
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
    if (zone === 'trick') return openTrickPop(card.dataset.uid);
    return openCardPop(card.dataset.uid, zone);
  }

  const a = t.closest('[data-act]')?.dataset.act;
  if (!a) return;
  switch (a) {
    case 'closeOverlay': return closeOverlay();
    case 'seatAsk': return openSeatModal();
    case 'seatVote': S.ui.seatVoteSeen = S.room?.seats?.vote?.id; return openSeatVote();
    case 'sound': return openSoundModal();
    case 'avatar': return openAvatarEditor();
    case 'avatarRandom': return avRandom();
    case 'avatarSave': return saveAvatar();
    case 'soundTest': return sfx.play('victory', { gap: 0 });
    case 'rules': return showOverlay(RULES);
    case 'news': return openNews();
    case 'voicePanel': return openVoicePanel();
    case 'voiceJoin': await vc.join(); return drawVoicePanel();
    case 'voiceLeave': await vc.leave(); return drawVoicePanel();
    case 'voiceMute': return vc.setMuted(!vc.state.muted);
    case 'guide': {
      // справочник открывается окном прямо в игре, чтобы не уходить из комнаты
      e.preventDefault();
      showOverlay('<div class="modal guide-modal" id="guideModal"></div>');
      const { renderGuide } = await import('/guide.js');
      const host = $('#guideModal');
      if (host) renderGuide(host, { onClose: closeOverlay });
      return;
    }
    case 'copy': {
      if (spectating()) {
        const text = `Смотри партию в «Под Землёй»: ${watchLink()}${S.room.locked ? ' (нужен пароль комнаты)' : ''}`;
        try { await navigator.clipboard.writeText(text); toast('Ссылка для зрителей скопирована', true); } catch { prompt('Скопируйте ссылку', watchLink()); }
        return;
      }
      const text = `Заходи в «Под Землёй»: ${inviteLink()}${S.room.locked ? ' (пароль скажу отдельно)' : ''}`;
      try { await navigator.clipboard.writeText(text); toast('Приглашение скопировано', true); } catch { prompt('Скопируйте ссылку', inviteLink()); }
      return;
    }
    case 'copyWatch': {
      const text = `Смотри нашу партию в «Под Землёй»: ${watchLink()}${S.room.locked ? ' (пароль скажу отдельно)' : ''}`;
      try { await navigator.clipboard.writeText(text); toast('Ссылка для зрителей скопирована', true); } catch { prompt('Скопируйте ссылку', watchLink()); }
      return;
    }
    case 'watchCode': {
      return typedCode().then(code => code && tryWatch(code));
    }
    case 'sitDown': {
      if (!S.name.trim()) return openJoinModal(S.room.id, S.rooms.find(r => r.id === S.room.id));
      return tryJoin(S.room.id, S.watch?.pw ?? '');
    }
    case 'leave': {
      await vc.leave();
      if (spectating()) {
        const r = await call('room:unwatch');
        S.watch = null; S.room = null; S.game = null; setUrl(null); closeOverlay(); render();
        if (r.ok) { S.rooms = r.rooms; renderRooms(); }
        return;
      }
      const id = S.room.id;
      await call('room:leave');
      dropToken(id); S.room = null; S.game = null; setUrl(null); closeOverlay(); render();
      const lst = await call('lobby:watch'); if (lst.ok) { S.rooms = lst.rooms; renderRooms(); }
      return;
    }
    case 'menu': {
      const isHost = S.room.hostId === S.room.me;
      if (spectating()) {
        return showOverlay(`<div class="modal" role="dialog" aria-label="Меню"><h2>Вы зритель</h2>
          <p class="muted" style="margin:0">Вы видите стол, бои, летопись и чат, но не карты в чужих руках. Писать в чат можно — сообщения будут помечены «зритель».</p>
          <button class="btn" data-act="copyWatch">Ссылка для зрителей</button>
          <button class="btn" data-act="guide">Справочник карт</button>
          <button class="btn ghost" data-act="leave">Перестать смотреть</button>
          <button class="btn ghost" data-act="closeOverlay">Вернуться к столу</button></div>`);
      }
      return showOverlay(`<div class="modal" role="dialog" aria-label="Меню"><h2>Меню</h2>
        <button class="btn" data-act="avatar">Облик героя</button>
        <button class="btn" data-act="copy">Скопировать приглашение</button>
        <button class="btn" data-act="copyWatch">Ссылка для зрителей</button>
        <button class="btn" data-act="guide">Справочник карт</button>
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
    case 'kick': case 'loot': case 'fight': case 'runAway': case 'autoEquip': case 'cancelHelp': case 'pass': case 'tame':
      return act({ type: a });
    case 'disarm': return act({ type: 'trap', disarm: true });
    case 'market': return openMarketModal();
    case 'contract': return openContractModal();
    case 'pandora': return openPandoraModal();
    case 'takeTrap': return act({ type: 'trap', disarm: false });
    case 'bribe': {
      // какую вещь бросить монстру: любую со стола, кроме легендарных
      const list = hints().bribe || [];
      popOpts = list.map(u => ({ label: `Бросить «${def(u).name}»`, action: { type: 'bribe', item: u }, cls: 'ghost' }));
      return showOverlay(`<div class="modal" role="dialog" aria-label="Чем откупиться"><h2>Чем откупиться</h2>
        <p class="muted" style="margin:0">Монстр уползёт жевать вещь, бой закончится без наград.</p>
        <div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div>
        <button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`);
    }
    case 'endTurn': {
      const h = hints();
      if (h.mustGive) { S.ui.mode = { kind: 'give', need: h.mustGive, picked: [] }; return render(); }
      return act({ type: 'endTurn', give: [] });
    }
    case 'trouble': return act({ type: 'lookForTrouble' });
    case 'haunt': return act({ type: 'haunt', side: t.closest('[data-side]')?.dataset.side });
    case 'sendTrade': {
      const f = S.ui.tradeForm?.get();
      if (!f) return;
      const r = await act({ type: 'offerTrade', to: f.to, give: f.give, want: f.want });
      if (r.ok) { closeOverlay(); toast(`Предложение отправлено: ${pname(f.to)} ответит в течение ${Math.round(TRADE_TIMEOUT_MS / 1000)} с`, true); }
      return;
    }
    case 'cancelTrade': return act({ type: 'cancelTrade', id: Number(t.closest('[data-id]')?.dataset.id) });
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

// ───────────────────────── облик героя ─────────────────────────
// В меню — каталог всех портретов с отбором по полу, расе и образу. В партии портрет следует за расой героя,
// поэтому там можно выбрать только портреты своей расы (полукровке — двух).
const RACE_PL = ['Люди', 'Эльфы', 'Гномы', 'Полурослики', 'Орки', 'Гоблины', 'Кротолюды'];
const RACE_GEN = ['человека', 'эльфа', 'гнома', 'полурослика', 'орка', 'гоблина', 'кротолюда'];
const AV_TABS = [{ id: 'face', label: 'Портреты' }, { id: 'scene', label: 'Сцена и свет' }, { id: 'frame', label: 'Рамка' }];
const seatColor = () => S.room?.members.find(m => m.id === S.room.me)?.color || '#3a3a42';
// расы героя в идущей партии или null, если партии нет (или вы зритель)
const avGameRaces = () => { const p = S.game?.phase === 'playing' || S.game?.phase === 'ended' ? me() : null; return p ? gameRaces(raceKeysOf(p)) : null; };
// какой портрет (1 + пол × 6 + образ) будет у расы в партии
const avCode = (cfg, r) => cfg.alt[r] || pickCode(cfg.gender, cfg.look);
function openAvatarEditor() {
  // в партии портретов всего дюжина — отбор начинается с «все» и не трогает сохранённый отбор меню
  const game = !!avGameRaces(), f = game ? null : LS.get('avFilter', null);
  S.ui.avEdit = { cfg: cleanAvatar(S.avatar && typeof S.avatar === 'object' ? S.avatar : avatarFromSeed(Number(S.avatar) || 0)), tab: S.ui.avEdit?.tab || 'face', game,
    filter: f && typeof f === 'object' ? { g: f.g ?? -1, r: f.r ?? -1, l: f.l ?? -1 } : { g: -1, r: -1, l: -1 } };
  drawAvatarEditor();
}
// облик, который видно сейчас: в партии — по расе героя
const avShown = (cfg, races) => (races ? avatarInGame(cfg, races.map(r => ['human', 'elf', 'dwarf', 'halfling', 'orc', 'goblin', 'molefolk'][r])) : cfg);
function avChips(key, title, names, val) {
  return `<div class="av-chips" role="group" aria-label="${title}"><span class="av-chips-t">${title}</span>${[['Все', -1], ...names.map((n, i) => [n, i])].map(([n, i]) =>
    `<button type="button" class="av-chip" data-av-f="${key}:${i}" aria-pressed="${val === i}">${esc(n)}</button>`).join('')}</div>`;
}
function avGallery(cfg, races) {
  const F = S.ui.avEdit.filter, game = !!races;
  const list = game ? races : F.r >= 0 ? [F.r] : [0, 1, 2, 3, 4, 5, 6];
  const shown = avShown(cfg, races);
  const secs = list.map(r => {
    const items = [];
    for (const g of [0, 1]) if (F.g < 0 || F.g === g) for (let l = 0; l < 6; l++) if (F.l < 0 || F.l === l) items.push([g, l]);
    if (!items.length) return '';
    const inGame = avCode(cfg, r);
    return `<section class="av-sec"><h3>${RACE_PL[r]}</h3><div class="av-grid looks">${items.map(([g, l]) => {
      const v = { race: r, gender: g, look: l }, code = pickCode(g, l);
      const on = game ? r === shown.race && code === inGame : r === cfg.race && g === cfg.gender && l === cfg.look;
      const mark = !game && code === inGame;
      return `<button class="av-pick${on ? ' on' : ''}" data-av-pick="${r}.${g}.${l}" aria-pressed="${on}" title="${esc(lookNote(v))}">`
        + `<span class="c"><img src="${portraitThumb(v)}" alt="" loading="lazy" decoding="async" width="96" height="96"></span>`
        + `<small>${esc(AV_LABELS.look[l])}<em>${g ? 'женщина' : 'мужчина'}</em></small>${mark ? '<i class="av-mark" title="Этот портрет будет у вас в партии за эту расу">в игре</i>' : ''}</button>`;
    }).join('')}</div></section>`;
  }).join('');
  return secs || '<p class="muted">Таких портретов нет — снимите часть отбора.</p>';
}
function avFrames(cfg, races, sc) {
  const shown = avShown(cfg, races);
  const done = achDone();
  return `<div class="av-row"><div class="av-title">Рамка медальона: <b>${esc(AV_LABELS.frame[cfg.frame])}</b> <span class="muted">· рамки с замком открываются подвигами</span></div><div class="av-grid labeled">${AV_LABELS.frame.map((n, i) => {
    const lock = FRAME_ACH[i] && !done[FRAME_ACH[i]] && cfg.frame !== i ? ACH[FRAME_ACH[i]][0] : '';
    const k = i ? (FRAMES[i - 1][3] / 0.96 * 0.98).toFixed(3) : 1;
    return `<button class="av-pick${cfg.frame === i ? ' on' : ''}${lock ? ' locked' : ''}" data-av-k="frame" data-av-v="${i}" aria-pressed="${cfg.frame === i}"${lock ? ` title="${esc(lock)}"` : ''}><span class="c${i ? ' fit' : ''}" style="--k:${k}">${avatarSVG({ ...shown, frame: i }, sc)}${lock ? `<i class="lock">${ico('padlock')}</i>` : ''}</span><small>${esc(n)}${lock ? `<em>${esc(lock)}</em>` : FRAME_ACH[i] ? `<em>${esc(ACH[FRAME_ACH[i]][1])}</em>` : ''}</small></button>`;
  }).join('')}</div></div>`;
}
// сцена за портретом и свет: фон локации, ореол и кромка вокруг героя, тон картинки
function avScenes(cfg, races, sc) {
  const shown = { ...avShown(cfg, races), frame: 0 };
  const scenes = AV_LABELS.scene.map((n, i) => {
    const note = i === 0 ? 'как нарисован' : i === 1 ? (S.game?.location ? 'сейчас: ' + def(S.game.location).name : 'меняется с локацией') : '';
    return `<button class="av-pick${cfg.scene === i ? ' on' : ''}" data-av-k="scene" data-av-v="${i}" aria-pressed="${cfg.scene === i}"><span class="c">${avatarSVG({ ...shown, scene: i }, sc)}</span><small>${esc(n)}${note ? `<em>${esc(note)}</em>` : ''}</small></button>`;
  }).join('');
  const auto = (() => { const v = { ...shown, light: 0 }; const i = lightOf(v, sceneOf(v)); return i >= 0 ? LIGHTS[i].name.toLowerCase() : 'без подсветки'; })();
  const lights = AV_LABELS.light.map((n, i) => {
    const L = i ? LIGHTS[i - 1] : null;
    const dot = L?.halo ? `<i class="av-light-dot" style="--a:${L.halo};--b:${L.bottom}"></i>` : '';
    return `<button class="av-pick${cfg.light === i ? ' on' : ''}" data-av-k="light" data-av-v="${i}" aria-pressed="${cfg.light === i}"><span class="c">${avatarSVG({ ...shown, scene: cfg.scene, light: i }, sc)}</span><small>${dot}${esc(n)}${i === 0 ? `<em>${esc(auto)}</em>` : ''}</small></button>`;
  }).join('');
  return `<div class="av-row"><div class="av-title">Сцена: <b>${esc(AV_LABELS.scene[cfg.scene])}</b> <span class="muted">· фон за героем; «Локация партии» меняется вместе с локацией стола</span></div><div class="av-grid labeled">${scenes}</div></div>
    <div class="av-row"><div class="av-title">Свет: <b>${esc(AV_LABELS.light[cfg.light])}</b> <span class="muted">· ореол, кромка и тон портрета</span></div><div class="av-grid labeled">${lights}</div></div>`;
}
const avCaption = (cfg, races) => {
  const v = avShown(cfg, races);
  return `<b>${races ? 'В партии: ' : ''}${esc(AV_LABELS.race[v.race])} · ${esc(AV_LABELS.look[v.look])}</b><span>${esc(lookNote(v))}</span>`;
};
function avIntro(races) {
  if (races) {
    const names = races.map(r => AV_LABELS.race[r].toLowerCase()).join(' и ');
    return `Сейчас ваш герой — ${names}. В партии портрет совпадает с расой героя, поэтому здесь только портреты ${races.map(r => RACE_GEN[r]).join(' и ')}. Сыграете карту другой расы или потеряете её — портрет сменится сам, а выбранный здесь запомнится.`;
  }
  return 'Нажмите на портрет — он станет вашим в лобби и за свою расу в партии. В партии портрет меняется вместе с расой героя: без карты расы вы человек. Значок «в игре» показывает, какой портрет будет у вас за каждую расу.';
}
function drawAvatarEditor() {
  const E = S.ui.avEdit, cfg = E.cfg, sc = seatColor(), races = avGameRaces(), F = E.filter;
  const tab = AV_TABS.find(t => t.id === E.tab) || AV_TABS[0];
  const filters = tab.id === 'face'
    ? `<div class="av-filters">${avChips('g', 'Пол', ['Мужчины', 'Женщины'], F.g)}${races ? '' : avChips('r', 'Раса', RACE_PL, F.r)}${avChips('l', 'Образ', AV_LABELS.look, F.l)}</div>` : '';
  const body = tab.id === 'face' ? avGallery(cfg, races) : tab.id === 'scene' ? avScenes(cfg, races, sc) : avFrames(cfg, races, sc);
  const box = $('#avModal');
  // при выборе перерисовываем только содержимое, чтобы список не прыгал наверх
  if (box && box.dataset.avtab === tab.id) {
    const pv = box.querySelector('.av-preview');
    pv.innerHTML = avatarSVG(avShown(cfg, races), sc); pv.style.setProperty('--fext', frameExt(cfg));
    box.querySelector('.av-caption').innerHTML = avCaption(cfg, races);
    const fl = box.querySelector('.av-filters'); if (fl) fl.outerHTML = filters;
    box.querySelector('.av-rows').innerHTML = body;
    return avChipsInView(box);
  }
  showOverlay(`<div class="modal av-modal" role="dialog" aria-label="Облик героя" id="avModal" data-avtab="${tab.id}">
    <h2>Облик героя</h2>
    <div class="av-body">
      <div class="av-side">
        <div class="av-preview" style="--seat:${sc};--fext:${frameExt(cfg)}">${avatarSVG(avShown(cfg, races), sc)}</div>
        <p class="av-caption">${avCaption(cfg, races)}</p>
        <button class="btn small" data-act="avatarRandom">${ico('rolling-dices')}Случайно</button>
      </div>
      <div class="av-main">
        <div class="tabs av-tabs" role="tablist">${AV_TABS.map(t => `<button role="tab" data-av-tab="${t.id}" aria-selected="${t.id === tab.id}">${t.label}</button>`).join('')}</div>
        ${tab.id === 'face' ? `<p class="av-intro">${esc(avIntro(races))}</p>` : ''}
        ${filters}
        <div class="av-rows">${body}</div>
      </div>
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeOverlay">Отмена</button><button class="btn primary" data-act="avatarSave">Сохранить</button></div>
  </div>`);
  avChipsInView($('#avModal'));
}
// на телефоне ряды отбора листаются вбок — выбранный пункт держим на виду
function avChipsInView(box) {
  box?.querySelectorAll('.av-chips').forEach(row => {
    const b = row.querySelector('[aria-pressed="true"]');
    if (b && row.scrollWidth > row.clientWidth) row.scrollLeft = b.offsetLeft - row.offsetLeft - (row.clientWidth - b.offsetWidth) / 2;
  });
}
// выбор портрета: в меню — основной и за свою расу в партии; в партии — только за расу героя
function avPick(r, g, l) {
  const E = S.ui.avEdit, races = avGameRaces(), alt = [...E.cfg.alt];
  alt[r] = pickCode(g, l);
  E.cfg = races ? { ...E.cfg, alt, pref: r } : { ...E.cfg, race: r, gender: g, look: l, alt };
  drawAvatarEditor();
}
function avRandom() {
  const races = avGameRaces(), x = avatarFromSeed(Math.floor(Math.random() * 1e6));
  const r = races ? races[Math.floor(Math.random() * races.length)] : x.race;
  avPick(r, x.gender, x.look);
}
async function saveAvatar() {
  S.avatar = cleanAvatar(S.ui.avEdit.cfg);
  LS.set('avatar', S.avatar);
  closeOverlay();
  const home = $('#homeAva'); if (home) home.innerHTML = avatarSVG(S.avatar, '#3a3a42');
  if (S.room) { const r = await call('me:avatar', { avatar: S.avatar }); if (!r.ok) toast(r.error); else toast('Облик обновлён', true); }
  else toast('Облик сохранён', true);
}

// ───────────────────────── голосовой чат ─────────────────────────
const MIC = off => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>${off ? '<path d="M4 4l16 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' : ''}</svg>`;
// громкость каждого собеседника запоминается по игроку (или по имени зрителя)
const volKey = id => { const p = S.room?.voice?.peers.find(x => x.id === id); return p ? (p.memberId || 'name:' + p.name) : id; };
const volumeFor = id => LS.get('vvol', {})[volKey(id)] ?? 1;
const vc = createVoice(socket, { onChange: () => { renderVoice(); if ($('#voiceModal')) drawVoicePanel(); }, onError: msg => toast(msg), getVolume: volumeFor });
const voicePeers = () => S.room?.voice?.peers || [];
function renderVoice() {
  const V = vc.state;
  const n = voicePeers().length;
  document.querySelectorAll('.voice-ctl').forEach(el => {
    el.innerHTML = V.joined
      ? `<button class="btn small icon-btn voice-mic ${V.muted ? 'off' : 'on'}${V.selfSpeaking ? ' talking' : ''}" data-act="voiceMute" title="${V.forced ? 'Хозяин выключил вам микрофон' : V.muted ? 'Включить микрофон' : 'Выключить микрофон'}" aria-label="${V.muted ? 'Включить микрофон' : 'Выключить микрофон'}">${MIC(V.muted)}</button><button class="btn ghost small icon-btn voice-open" data-act="voicePanel" title="Голосовой чат: ${n} ${plural(n, 'человек', 'человека', 'человек')}" aria-label="Голосовой чат">${ico('talk')}<i class="vbadge">${n}</i></button>`
      : `<button class="btn ghost small icon-btn voice-open${V.joining ? ' joining' : ''}" data-act="voicePanel" title="${V.joining ? 'Подключаемся к голосовому чату…' : n ? `Голосовой чат: ${n} ${plural(n, 'человек', 'человека', 'человек')}` : 'Голосовой чат'}" aria-label="Голосовой чат">${MIC(false)}${n ? `<i class="vbadge">${n}</i>` : ''}</button>`;
  });
  // кто говорит — светится аватарка; кто в чате — значок микрофона
  const byMember = new Map(voicePeers().filter(p => p.memberId).map(p => [p.memberId, p]));
  document.querySelectorAll('[data-vmember]').forEach(el => {
    const p = byMember.get(el.dataset.vmember);
    el.classList.toggle('in-voice', !!p);
    el.classList.toggle('voice-muted', !!p?.muted);
    el.classList.toggle('speaking', !!p && vc.isSpeaking(p.id));
  });
  document.querySelectorAll('[data-vpeer]').forEach(el => el.classList.toggle('speaking', vc.isSpeaking(el.dataset.vpeer)));
}
function openVoicePanel() { showOverlay('<div class="modal voice-modal" id="voiceModal" role="dialog" aria-label="Голосовой чат"></div>'); drawVoicePanel(); }
function drawVoicePanel() {
  const host = $('#voiceModal');
  if (!host) return;
  const V = vc.state, isHost = S.room?.hostId === S.room?.me && !spectating();
  const peers = voicePeers();
  const bans = S.room?.voice?.bans || [];
  const row = p => {
    const me = p.id === V.me;
    const st = V.peers.get(p.id)?.state;
    const via = st === 'relay' ? ' · через сервер' : '';
    const status = p.forced ? 'микрофон выключил хозяин' : p.muted ? 'микрофон выключен' + via : st === 'failed' ? 'нет связи' : (vc.isSpeaking(p.id) ? 'говорит' : 'в чате') + via;
    return `<div class="v-row${vc.isSpeaking(p.id) ? ' speaking' : ''}" data-vpeer="${esc(p.id)}">
      <span class="v-dot" style="--c:${esc(p.color)}">${MIC(p.muted)}</span>
      <span class="v-who"><b>${esc(p.name)}</b>${me ? ' <small>это вы</small>' : ''}<br><small class="muted">${p.spectator ? 'зритель' : 'за столом'} · ${status}</small></span>
      ${!me && V.joined ? `<label class="v-vol" title="Громкость"><span class="sr">Громкость ${esc(p.name)}</span><input type="range" min="0" max="1" step="0.05" value="${volumeFor(p.id)}" data-vvol="${esc(p.id)}"></label>` : ''}
      ${isHost && !me && p.memberId !== S.room.me ? `<span class="v-host"><button class="btn small ${p.forced ? 'hero' : 'ghost'}" data-vforce="${esc(p.id)}" data-on="${p.forced ? 0 : 1}">${p.forced ? 'Вернуть микрофон' : 'Выключить микрофон'}</button><button class="btn small danger" data-vkick="${esc(p.id)}">Убрать из чата</button>${p.spectator ? `<button class="btn small ghost" data-wkick="${esc(p.id)}">Попросить уйти</button>` : ''}</span>` : ''}
    </div>`;
  };
  host.innerHTML = `<h2>Голосовой чат</h2>
    <p class="muted" style="margin:0">Слышат все, кто подключился: и игроки за столом, и зрители — до ${S.room?.voice?.max || 10} человек. Звук идёт напрямую между браузерами; в некоторых мобильных и рабочих сетях связь может не установиться.</p>
    ${V.joined
      ? `<div class="row"><button class="btn ${V.muted ? 'hero' : ''}" data-act="voiceMute" ${V.forced ? 'disabled' : ''}>${V.forced ? 'Хозяин выключил вам микрофон' : V.muted ? 'Включить микрофон' : 'Выключить микрофон'}</button><button class="btn ghost" data-act="voiceLeave">Отключиться</button></div>`
      : `<div class="row"><button class="btn primary" data-act="voiceJoin" ${V.joining ? 'disabled' : ''}>${V.joining ? 'Подключаемся…' : 'Подключиться к голосу'}</button></div>`}
    <div class="v-list">${peers.length ? peers.map(row).join('') : '<p class="muted" style="margin:0">Пока никого. Подключитесь первым — остальные увидят, что вы в голосовом чате.</p>'}</div>
    ${isHost && bans.length ? `<h3>Убраны из голосового чата</h3><div class="v-list">${bans.map(b => `<div class="v-row"><span class="v-who"><b>${esc(b.name)}</b></span><button class="btn small" data-vunban="${esc(b.key)}">Пустить снова</button></div>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeOverlay">Закрыть</button></div>`;
}
document.addEventListener('input', e => {
  const v = e.target.closest?.('[data-vvol]');
  if (!v) return;
  const all = LS.get('vvol', {}); all[volKey(v.dataset.vvol)] = Number(v.value); LS.set('vvol', all);
  vc.applyVolume(v.dataset.vvol);
});

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
const applyBg = () => { $('#world').classList.toggle('still', !liveBg()); homeVideo(); };
applyBg();
function openSoundModal() {
  const s = sfx.state;
  showOverlay(`<div class="modal" role="dialog" aria-label="Звук и эффекты" id="soundModal">
    <h2>Звук и эффекты</h2>
    <label class="check"><input type="checkbox" id="sndOn" ${s.on ? 'checked' : ''}> Звуки игры</label>
    <label>Громкость<input type="range" id="sndVol" min="0" max="1" step="0.05" value="${s.vol}"></label>
    <label class="check"><input type="checkbox" id="sndMus" ${s.mus ? 'checked' : ''}> Музыка локаций: своя тихая мелодия у каждой локации</label>
    <label>Громкость музыки<input type="range" id="sndMusVol" min="0" max="1" step="0.05" value="${s.musVol}"></label>
    <label class="check"><input type="checkbox" id="sndAmb" ${s.amb ? 'checked' : ''}> Атмосфера пещеры: гул, ветер и капли</label>
    <label class="check"><input type="checkbox" id="liveBg" ${liveBg() ? 'checked' : ''}> Живой фон: вода, снег, светлячки (на слабом телефоне лучше выключить)</label>
    <label class="check"><input type="checkbox" id="cineOn" ${cine.enabled ? 'checked' : ''}> Зрелищные сцены: двери, удары, разрубленные карты, салют</label>
    <label class="check"><input type="checkbox" id="depthOn" ${depthOn() ? 'checked' : ''}> Объёмные карты и портреты: рисунок «выходит» из рамки за курсором</label>
    <p class="muted" style="margin:0;font-size:13.5px">Звуки — записи из свободных библиотек Kenney и OpenGameArt (лицензия CC0), мелодии сыграны на пиццикато и стальных барабанах, музыка локаций сочиняется прямо в браузере. Значки — game-icons.net (CC BY 3.0, Lorc, Delapouite и другие). Если на телефоне тишина, проверьте беззвучный режим.</p>
    <div class="row"><button class="btn" data-act="soundTest">Послушать</button><button class="btn primary" data-act="closeOverlay">Готово</button></div>
  </div>`);
  $('#sndOn').addEventListener('change', e => { sfx.set({ on: e.target.checked }); soundIcons(); if (e.target.checked) sfx.play('yourTurn', { gap: 0 }); });
  $('#sndVol').addEventListener('input', e => { sfx.set({ vol: Number(e.target.value) }); soundIcons(); });
  $('#sndVol').addEventListener('change', () => sfx.play('coins', { n: 2, gap: 0 }));
  $('#sndAmb').addEventListener('change', e => sfx.set({ amb: e.target.checked }));
  $('#sndMus').addEventListener('change', e => sfx.set({ mus: e.target.checked }));
  $('#sndMusVol').addEventListener('input', e => sfx.set({ musVol: Number(e.target.value) }));
  $('#liveBg').addEventListener('change', e => { LS.set('liveBg', e.target.checked); applyBg(); });
  $('#cineOn').addEventListener('change', e => { cine.set(e.target.checked); render(); });
  $('#depthOn').addEventListener('change', e => { LS.set('depth3d', e.target.checked); applyDepth(); });
}

// ───────────────────────── полёт сыгранной карты ─────────────────────────
// ───────────────────────── карта крупно при наведении ─────────────────────────
// На компьютере: задержали курсор на карте в руке, на столе или на вещи — рядом всплывает крупная карта с полным текстом.
const PEEK_ZONES = '#hand .card[data-uid], #stage .card[data-uid], #mecard .chip[data-uid], .opp-items .chip[data-uid]';
let peekT = 0, peekEl = null, peekFor = null;
function peekHide() { clearTimeout(peekT); peekFor = null; if (peekEl) { peekEl.classList.remove('on'); } }
function peekShow(src) {
  if (drag?.on || document.body.classList.contains('is-dragging') || layer?.childElementCount) return;
  const uid = src.dataset.uid;
  if (!uid || !def(uid)) return;
  if (!peekEl) { peekEl = document.createElement('div'); peekEl.className = 'card-peek'; peekEl.setAttribute('aria-hidden', 'true'); document.body.append(peekEl); }
  peekEl.innerHTML = cardHTML(uid, { size: 'lg', tab: false });
  const r = src.getBoundingClientRect(), W = 236, H = 336, m = 12;
  // над картой в руке; если не помещается — сбоку
  let x = r.left + r.width / 2 - W / 2, y = r.top - H - 16;
  if (y < m) { y = Math.max(m, Math.min(innerHeight - H - m, r.top + r.height / 2 - H / 2)); x = r.right + 16 + W > innerWidth - m ? r.left - W - 16 : r.right + 16; }
  x = Math.max(m, Math.min(innerWidth - W - m, x));
  peekEl.style.left = x + 'px'; peekEl.style.top = y + 'px';
  requestAnimationFrame(() => peekEl.classList.add('on'));
}
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const src = e.target.closest?.(PEEK_ZONES);
  if (src === peekFor) return;
  peekHide();
  if (!src) return;
  peekFor = src;
  peekT = setTimeout(() => { if (peekFor === src && src.isConnected) peekShow(src); }, 420);
});
document.addEventListener('pointerdown', peekHide, { capture: true, passive: true });
addEventListener('scroll', peekHide, { capture: true, passive: true });

// ───────────────────────── карту можно бросить на стол ─────────────────────────
// Карту из руки тянут пальцем или мышью: она следует за указателем и кренится по ходу движения, подходящие цели
// подсвечиваются (соперник, свой герой, сторона в бою, стол). Отпустили над целью с одним действием — карта
// шлёпается туда; если вариантов несколько — открывается окно карты. Просто нажатие открывает окно, как раньше.
const dropZone = a => {
  const d = def(a.uid);
  if (a.target) return a.target === S.room?.me ? 'me' : 'opp:' + a.target;
  if (a.side === 'player') return 'hero';
  if (a.side === 'monster' || Number.isInteger(a.monster)) return 'mon';
  if (['race', 'class', 'halfbreed', 'supermunch', 'item', 'buff', 'levelup', 'ally'].includes(d.type) || a.type === 'equip') return 'me';
  return 'table';
};
const zoneEls = z => z === 'me' ? [$('#mecard')] : z === 'hero' ? [document.querySelector('#stage .side-col.hero')] : z === 'mon' ? [document.querySelector('#stage .side-col.mon')]
  : z === 'table' ? [$('#stage')] : [document.querySelector(`[data-opp="${CSS.escape(z.slice(4))}"]`)];
let drag = null, dragEnd = 0;
function dragStart(st, e) {
  const p = me(), h = hints();
  if (!p || S.ui.mode) return false;
  const opts = (h.cards?.[st.uid] || []).map(a => ({ ...a, uid: a.uid || st.uid }));
  const zones = new Map();
  for (const a of opts) { const z = dropZone(a); if (!zones.has(z)) zones.set(z, []); zones.get(z).push(a); }
  const r = st.c.getBoundingClientRect();
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  const cl = st.c.cloneNode(true);
  cl.classList.remove('selected', 'deal-in', 'tilting', 'dim'); cl.removeAttribute('style'); cl.removeAttribute('id');
  g.append(cl);
  g.style.width = r.width + 'px'; g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
  document.body.append(g);
  st.c.classList.add('dragging');
  for (const z of zones.keys()) zoneEls(z).forEach(el => el?.classList.add('drop-ok'));
  document.body.classList.add('is-dragging');
  Object.assign(st, { on: true, g, zones, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(), rot: 0, hover: null });
  sfx.play('flip', { gap: 0 });
  return true;
}
function dragMove(st, e) {
  const t = performance.now(), dt = Math.max(8, t - st.lt);
  st.vx = st.vx * 0.6 + ((e.clientX - st.lx) / dt) * 0.4; st.vy = st.vy * 0.6 + ((e.clientY - st.ly) / dt) * 0.4;
  st.lx = e.clientX; st.ly = e.clientY; st.lt = t;
  // карта «плывёт» за указателем и кренится по ходу движения, как настоящая
  const rz = Math.max(-18, Math.min(18, st.vx * 9)), rx = Math.max(-16, Math.min(16, -st.vy * 7));
  st.g.style.transform = `translate(${e.clientX - st.ox - parseFloat(st.g.style.left)}px, ${e.clientY - st.oy - parseFloat(st.g.style.top)}px) perspective(900px) rotateZ(${rz.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg) scale(1.08)`;
  // над какой целью
  let hov = null;
  for (const z of st.zones.keys()) {
    for (const el of zoneEls(z)) {
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) { if (!hov || z !== 'table') hov = { z, el }; }
    }
  }
  if (st.hover?.el !== hov?.el) { st.hover?.el.classList.remove('drop-hover'); hov?.el.classList.add('drop-hover'); }
  st.hover = hov;
}
async function dragDrop(st) {
  const cleanup = () => {
    document.querySelectorAll('.drop-ok, .drop-hover').forEach(el => el.classList.remove('drop-ok', 'drop-hover'));
    document.body.classList.remove('is-dragging');
    st.c.classList.remove('dragging');
  };
  const back = () => {
    // мимо цели — карта возвращается в руку
    const r = st.c.getBoundingClientRect();
    st.g.style.transition = 'transform .28s cubic-bezier(.3,1.3,.5,1), opacity .28s';
    st.g.style.transform = `translate(${r.left - parseFloat(st.g.style.left)}px, ${r.top - parseFloat(st.g.style.top)}px)`;
    setTimeout(() => { st.g.remove(); st.c.classList.remove('dragging'); }, 290);
  };
  dragEnd = performance.now();
  const hov = st.hover;
  cleanup();
  if (!hov) { back(); return; }
  const acts = st.zones.get(hov.z) || [];
  if (acts.length !== 1) { back(); openCardPop(st.uid, 'hand'); return; }
  // шлепок: карта падает на цель, поднимает пыль
  st.g.style.transition = 'transform .16s cubic-bezier(.5,0,.9,.5), opacity .2s ease .12s';
  const cur = st.g.style.transform.replace(/scale\([^)]*\)/, '').replace(/rotate[XZ]\([^)]*\)/g, '').replace(/perspective\([^)]*\)/, '');
  st.g.style.transform = `${cur} scale(.92) rotateZ(${(Math.random() * 6 - 3).toFixed(1)}deg)`;
  st.g.style.opacity = '0';
  setTimeout(() => st.g.remove(), 360);
  sfx.play('place'); fx.dust({ x: st.lx, y: st.ly + st.h * 0.3, w: st.w, h: 8 }, { n: 10 });
  const r = await act(acts[0]);
  if (r.ok) fx.burst({ x: st.lx, y: st.ly }, { n: 10, speed: 160, g: 200 });
}
document.addEventListener('pointerdown', e => {
  if (e.button || drag) return;
  const c = e.target.closest('#hand .card[data-uid]');
  if (!c) return;
  drag = { c, uid: c.dataset.uid, x0: e.clientX, y0: e.clientY, on: false, id: e.pointerId };
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.on) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 12) return;
    if (!dragStart(drag, e)) { drag = null; return; }
  }
  e.preventDefault();
  dragMove(drag, e);
}, { passive: false });
const dragUp = e => { if (!drag || e.pointerId !== drag.id) return; const st = drag; drag = null; if (st.on) dragDrop(st); };
document.addEventListener('pointerup', dragUp);
document.addEventListener('pointercancel', e => { if (!drag || e.pointerId !== drag.id) return; const st = drag; drag = null; if (st.on) { st.hover = null; dragDrop(st); } });
// после броска не открываем окно карты от того же нажатия
document.addEventListener('click', e => { if (performance.now() - dragEnd < 350 && e.target.closest('#hand, #stage, #opps, #mecard')) { e.stopPropagation(); e.preventDefault(); } }, true);

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
  if (['equip', 'unequip', 'discardInPlay', 'allyWear', 'allyTake'].includes(a.type)) return;
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
  if (name === 'lure') {
    popOpts = (h.abilities.lure || []).map(s => ({ label: `${pname(s.target)}: «${def(s.item).name}»`, fn: () => startMode({ kind: 'ability', name, target: s.target, item: s.item, picked: [], max: 1 }), cls: 'ghost' }));
    return showOverlay(`<div class="modal" role="dialog" aria-label="Сманить"><h2>Кого сманить?</h2><p class="muted" style="margin:0">Сбросите карту и бросите кубик: на 4–6 спутник или зверь уходит к вам (ваш прежний уйдёт), иначе потеряете уровень.</p><div class="pop-actions">${popOpts.map((o, i) => `<button class="btn ${o.cls}" data-popopt="${i}">${esc(o.label)}</button>`).join('')}</div><button class="btn ghost" data-act="closeOverlay">Отмена</button></div>`);
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
    if (S.ui.overlay && !$('#helpPrompt') && !$('#tradePrompt')) closeOverlay();
    else if (S.ui.mode) { S.ui.mode = null; render(); }
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-uid]')) { e.preventDefault(); e.target.click(); }
});
setInterval(() => { if (S.room && document.visibilityState === 'visible') socket.emit('ping:me'); }, 20000);

initDepth();
render();
