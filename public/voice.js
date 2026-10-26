// «Под Землёй» — голосовой чат за столом. Звук идёт напрямую между браузерами (WebRTC, сетка «каждый с каждым»),
// сервер передаёт приглашения. Если напрямую связаться не вышло (строгая сеть, мобильный интернет), включается
// ретранслятор: голос режется на кусочки по 40 мс, сжимается (16 кГц, μ-закон) и идёт через сервер игры тем же
// соединением, что и сама игра. Сервер может выдать и настоящий TURN — тогда прямая связь находится чаще.
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const SPEAK_LEVEL = 0.035;
const GATE_LEVEL = 0.012;       // тише этого в ретранслятор не шлём (с «хвостом» 0,5 с, чтобы не рвать слова)
const RELAY_RATE = 16000;
const CONNECT_WAIT_MS = 12000;  // столько ждём прямую связь, потом — ретранслятор
// для проверки: localStorage pz.voiceRelay = 'always' — сразу через сервер
const forceRelay = () => { try { return localStorage.getItem('pz.voiceRelay') === 'always'; } catch { return false; } };

// обработчики звука: сбор кусочков с микрофона и проигрывание с небольшим запасом против рывков сети
const WORKLET = `
class PzCap extends AudioWorkletProcessor {
  constructor() { super(); this.size = Math.round(sampleRate * 0.04); this.buf = new Float32Array(this.size); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) { this.buf[this.n++] = ch[i]; if (this.n === this.size) { this.port.postMessage(this.buf.slice(0)); this.n = 0; } }
    return true;
  }
}
registerProcessor('pz-cap', PzCap);
class PzPlay extends AudioWorkletProcessor {
  constructor() {
    super(); this.q = new Float32Array(32000); this.r = 0; this.w = 0; this.len = 0; this.pos = 0; this.on = false; this.step = ${RELAY_RATE} / sampleRate;
    this.port.onmessage = e => {
      const d = e.data, Q = this.q.length;
      for (let i = 0; i < d.length; i++) { this.q[this.w] = d[i]; this.w = (this.w + 1) % Q; if (this.len < Q) this.len++; else this.r = (this.r + 1) % Q; }
      if (this.len > 12000) { const drop = this.len - 4000; this.r = (this.r + drop) % Q; this.len -= drop; }
    };
  }
  process(_, outputs) {
    const out = outputs[0][0], Q = this.q.length;
    if (!this.on && this.len >= 2400) this.on = true;
    for (let i = 0; i < out.length; i++) {
      if (!this.on || this.len < 2) { out[i] = 0; this.on = false; continue; }
      const a = this.q[this.r], b = this.q[(this.r + 1) % Q];
      out[i] = a + (b - a) * this.pos;
      this.pos += this.step;
      while (this.pos >= 1) { this.pos -= 1; this.r = (this.r + 1) % Q; this.len--; }
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}
registerProcessor('pz-play', PzPlay);`;
// μ-закон (G.711): 8 бит на отсчёт вместо 16
function muEnc(x) {
  let s = Math.max(-1, Math.min(1, x)) * 32767;
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  s = Math.min(32635, s + 132);
  let exp = 7;
  for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xff;
}
const MU = new Float32Array(256);
for (let i = 0; i < 256; i++) { const u = ~i & 0xff, t = (((u & 0x0f) << 3) + 132) << ((u & 0x70) >> 4); MU[i] = ((u & 0x80) ? 132 - t : t - 132) / 32768; }
// кусок с микрофона → 16 кГц, μ-закон (усреднение по окну заодно срезает высокие частоты)
function pack(buf, rate) {
  const k = rate / RELAY_RATE, n = Math.floor(buf.length / k), out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * k), b = Math.max(a + 1, Math.min(buf.length, Math.floor((i + 1) * k)));
    let s = 0; for (let j = a; j < b; j++) s += buf[j];
    out[i] = muEnc(s / (b - a));
  }
  return out;
}

export function createVoice(socket, { onChange = () => {}, onError = () => {}, getVolume = () => 1 } = {}) {
  const V = {
    joined: false, joining: false, me: null, muted: false, forced: false,
    stream: null, peers: new Map(), // id → { pc, audio, analyser, level, speaking, gain }
    speaking: new Set(), selfSpeaking: false, roster: [],
  };
  let ac = null, selfAnalyser = null, meterTimer = null;
  let ice = ICE;
  // ретранслятор: кому шлём голос через сервер, готовность обработчиков, сбор с микрофона
  const relayTo = new Set();
  let workletReady = null, cap = null, loudAt = 0;

  const call = (ev, p) => new Promise(res => socket.emit(ev, p, r => res(r || { ok: false, error: 'Нет ответа от сервера' })));
  const signal = (to, data) => socket.emit('voice:signal', { to, data });
  const audioCtx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());

  function meter(stream) {
    try {
      const a = audioCtx().createAnalyser();
      a.fftSize = 512;
      audioCtx().createMediaStreamSource(stream).connect(a);
      return a;
    } catch { return null; }
  }
  const levelOf = a => {
    if (!a) return 0;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += v * v;
    return Math.sqrt(sum / buf.length);
  };
  // каждые 120 мс решаем, кто сейчас говорит, — для подсветки аватарок
  function tickMeters() {
    let changed = false;
    const was = V.selfSpeaking;
    V.selfSpeaking = !V.muted && levelOf(selfAnalyser) > SPEAK_LEVEL;
    if (was !== V.selfSpeaking) changed = true;
    const t = performance.now();
    for (const [id, p] of V.peers) {
      const on = !p.silenced && (p.relay ? t - (p.heardAt || 0) < 300 : levelOf(p.analyser) > SPEAK_LEVEL);
      if (on !== V.speaking.has(id)) { on ? V.speaking.add(id) : V.speaking.delete(id); changed = true; }
    }
    if (changed) onChange('speaking');
  }

  function peer(id) {
    let p = V.peers.get(id);
    if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: ice });
    p = { pc, audio: null, analyser: null, silenced: false, pending: [], relay: false };
    V.peers.set(id, p);
    // прямая связь не поднялась за отведённое время — переходим на ретранслятор
    p.waitTimer = setTimeout(() => { if (forceRelay() || pc.connectionState !== 'connected') useRelay(id); }, forceRelay() ? 300 : CONNECT_WAIT_MS);
    V.stream?.getTracks().forEach(t => pc.addTrack(t, V.stream));
    pc.onicecandidate = e => { if (e.candidate) signal(id, { candidate: e.candidate.toJSON() }); };
    pc.ontrack = e => {
      const s = e.streams[0] || new MediaStream([e.track]);
      if (!p.audio) {
        p.audio = new Audio();
        p.audio.autoplay = true;
        p.audio.setAttribute('playsinline', '');
        p.audio.dataset.voicePeer = id;
        document.body.append(p.audio);
      }
      p.audio.srcObject = s;
      p.audio.muted = p.relay; // если уже идём через сервер, прямой звук не дублирует
      applyVolume(id);
      p.audio.play().catch(() => {});
      p.analyser = meter(s);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (!p.relay) p.state = st;
      if (st === 'connected' && !forceRelay()) clearTimeout(p.waitTimer);
      if (st === 'failed') useRelay(id);
      // связь оборвалась и не вернулась за 6 секунд — тоже через сервер
      if (st === 'disconnected') { clearTimeout(p.waitTimer); p.waitTimer = setTimeout(() => { if (pc.connectionState !== 'connected') useRelay(id); }, 6000); }
      onChange('state');
    };
    return p;
  }
  function dropPeer(id) {
    const p = V.peers.get(id);
    if (!p) return;
    clearTimeout(p.waitTimer);
    try { p.pc.close(); } catch { /* уже закрыт */ }
    p.audio?.remove();
    try { p.player?.disconnect(); p.gain?.disconnect(); } catch { /* уже отключён */ }
    V.peers.delete(id);
    V.speaking.delete(id);
    relayTo.delete(id);
    if (!relayTo.size) stopCapture();
  }
  function applyVolume(id) {
    const p = V.peers.get(id);
    if (!p) return;
    // кому хозяин выключил микрофон, тот не звучит у всех, даже если обошёл запрет у себя
    const vol = p.silenced ? 0 : Math.max(0, Math.min(1, getVolume(id)));
    if (p.audio) p.audio.volume = vol;
    if (p.gain) p.gain.gain.value = vol;
  }

  // ───── ретранслятор через сервер игры ─────
  function loadWorklet() {
    if (workletReady) return workletReady;
    const ctx = audioCtx();
    if (!ctx.audioWorklet) return (workletReady = Promise.resolve(false));
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    workletReady = ctx.audioWorklet.addModule(url).then(() => true, e => { console.warn('voice relay', e); return false; });
    return workletReady;
  }
  async function useRelay(id, notify = true) {
    const p = V.peers.get(id);
    if (!p || p.relay || !V.joined) return;
    p.relay = true; p.state = 'relay';
    clearTimeout(p.waitTimer);
    if (p.audio) p.audio.muted = true;
    relayTo.add(id);
    if (notify) signal(id, { relay: true }); // пусть и собеседник шлёт нам через сервер
    if (!(await loadWorklet())) { p.state = 'failed'; onError('Этот браузер не умеет передавать голос через сервер. Попробуйте Chrome, Edge, Firefox или Safari поновее.'); }
    else startCapture();
    onChange('state');
  }
  function startCapture() {
    if (cap || !V.stream || !relayTo.size) return;
    try {
      const ctx = audioCtx();
      const src = ctx.createMediaStreamSource(V.stream);
      const node = new AudioWorkletNode(ctx, 'pz-cap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      const sink = ctx.createGain(); sink.gain.value = 0; // узел должен быть подключён к выходу, иначе браузер его не крутит
      src.connect(node); node.connect(sink); sink.connect(ctx.destination);
      node.port.onmessage = e => sendChunk(e.data, ctx.sampleRate);
      cap = { src, node, sink };
    } catch (e) { console.warn('voice relay capture', e); }
  }
  function stopCapture() {
    if (!cap) return;
    try { cap.src.disconnect(); cap.node.disconnect(); cap.sink.disconnect(); cap.node.port.onmessage = null; } catch { /* уже отключён */ }
    cap = null;
  }
  function sendChunk(buf, rate) {
    if (!relayTo.size || !V.joined || V.muted || V.forced) return;
    let sum = 0; for (let i = 0; i < buf.length; i += 4) sum += buf[i] * buf[i];
    const t = performance.now();
    if (Math.sqrt(sum / (buf.length / 4)) > GATE_LEVEL) loudAt = t;
    if (t - loudAt > 500) return; // тишину не гоняем по сети
    const d = pack(buf, rate);
    socket.emit('voice:frame', { to: [...relayTo], d: d.buffer });
  }
  async function playChunk(from, d) {
    const p = V.peers.get(from);
    if (!p || !V.joined) return;
    if (!p.relay) useRelay(from, false); // собеседник уже говорит через сервер — отвечаем тем же
    if (!(await loadWorklet())) return;
    const ctx = audioCtx();
    if (!p.player) {
      try {
        p.player = new AudioWorkletNode(ctx, 'pz-play', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        p.gain = ctx.createGain();
        p.player.connect(p.gain); p.gain.connect(ctx.destination);
        applyVolume(from);
      } catch (e) { console.warn('voice relay player', e); return; }
    }
    if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
    const u8 = new Uint8Array(d), f = new Float32Array(u8.length);
    let sum = 0;
    for (let i = 0; i < u8.length; i++) { const v = MU[u8[i]]; f[i] = v; sum += v * v; }
    if (Math.sqrt(sum / Math.max(1, u8.length)) > SPEAK_LEVEL) p.heardAt = performance.now();
    p.player.port.postMessage(f, [f.buffer]);
  }
  socket.on('voice:frame', ({ from, d } = {}) => { if (d) playChunk(from, d); });

  socket.on('voice:signal', async ({ from, data }) => {
    if (!V.joined) return;
    const p = peer(from);
    try {
      if (data.relay) { useRelay(from, false); return; }
      if (data.sdp) {
        await p.pc.setRemoteDescription(data.sdp);
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
        if (data.sdp.type === 'offer') {
          const ans = await p.pc.createAnswer();
          await p.pc.setLocalDescription(ans);
          signal(from, { sdp: p.pc.localDescription.toJSON() });
        }
      } else if (data.candidate) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate).catch(() => {});
        else p.pending.push(data.candidate);
      }
    } catch (e) { console.warn('voice signal', e); }
  });
  socket.on('voice:peer-left', ({ id }) => { dropPeer(id); onChange('peers'); });
  socket.on('voice:forced', ({ on }) => {
    V.forced = !!on;
    if (on) setMuted(true, true);
    onChange('forced');
  });
  socket.on('voice:kicked', ({ reason }) => { cleanup(); onError(reason || 'Вас убрали из голосового чата'); onChange('left'); });
  // после обрыва связи сервер забыл нас — заходим снова
  socket.on('connect', () => { if (V.joined) rejoin(); });
  // сервер нас забыл (переподключение, пересели из зрителей за стол) — заходим заново с тем же микрофоном
  function rejoin() {
    const s = V.stream;
    for (const id of [...V.peers.keys()]) dropPeer(id);
    V.joined = false;
    join(s);
  }

  async function join(existing = null) {
    if (V.joined || V.joining) return { ok: true };
    V.joining = true; onChange('state');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Браузер не даёт доступ к микрофону');
      V.stream = existing || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      audioCtx().resume?.();
      selfAnalyser = meter(V.stream);
      const r = await call('voice:join', { muted: V.muted });
      if (!r.ok) { stopStream(); throw new Error(r.error); }
      if (Array.isArray(r.ice) && r.ice.length) ice = r.ice;
      V.joined = true; V.me = r.me; V.forced = !!r.forced;
      loadWorklet(); // заранее, пока есть разрешение на звук от нажатия
      if (V.forced) V.muted = true;
      V.stream.getAudioTracks().forEach(t => { t.enabled = !V.muted; });
      // новичок сам предлагает связь всем, кто уже в чате
      for (const id of r.peers) {
        const p = peer(id);
        const offer = await p.pc.createOffer();
        await p.pc.setLocalDescription(offer);
        signal(id, { sdp: p.pc.localDescription.toJSON() });
      }
      meterTimer ||= setInterval(tickMeters, 120);
      return { ok: true };
    } catch (e) {
      const msg = e?.name === 'NotAllowedError' ? 'Без разрешения на микрофон голосовой чат не включится. Разрешите его в настройках браузера.' : e?.message || 'Не удалось включить голосовой чат';
      onError(msg);
      return { ok: false, error: msg };
    } finally { V.joining = false; onChange('state'); }
  }
  function stopStream() { stopCapture(); V.stream?.getTracks().forEach(t => t.stop()); V.stream = null; selfAnalyser = null; }
  function cleanup() {
    for (const id of [...V.peers.keys()]) dropPeer(id);
    relayTo.clear(); stopCapture();
    stopStream();
    clearInterval(meterTimer); meterTimer = null;
    V.joined = false; V.me = null; V.selfSpeaking = false; V.forced = false;
  }
  async function leave() {
    if (!V.joined) return;
    await call('voice:leave');
    cleanup();
    onChange('left');
  }
  async function setMuted(m, local = false) {
    if (!m && V.forced) { onError('Хозяин комнаты выключил вам микрофон'); return; }
    V.muted = !!m;
    V.stream?.getAudioTracks().forEach(t => { t.enabled = !V.muted; });
    if (!local && V.joined) await call('voice:mute', { muted: V.muted });
    onChange('mute');
  }
  // состав чата приходит вместе с состоянием комнаты
  function sync(roster) {
    V.roster = roster || [];
    if (!V.joined) return;
    const ids = new Set(V.roster.map(p => p.id));
    for (const id of [...V.peers.keys()]) if (!ids.has(id)) dropPeer(id);
    for (const r of V.roster) {
      const p = V.peers.get(r.id);
      if (p) { p.silenced = !!r.forced; applyVolume(r.id); }
    }
    const me = V.roster.find(p => p.id === V.me);
    if (!me && !V.joining) return rejoin();
    if (me.forced !== V.forced) { V.forced = me.forced; if (V.forced) setMuted(true, true); }
  }
  return { state: V, join, leave, setMuted, sync, applyVolume, isSpeaking: id => (id === V.me ? V.selfSpeaking : V.speaking.has(id)), viaRelay: id => !!V.peers.get(id)?.relay };
}
