// «Под Землёй» — голосовой чат за столом. Звук идёт напрямую между браузерами (WebRTC, сетка «каждый с каждым»),
// сервер только передаёт приглашения. Ретранслятора (TURN) пока нет: в строгих сетях связь может не установиться.
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const SPEAK_LEVEL = 0.035;

export function createVoice(socket, { onChange = () => {}, onError = () => {}, getVolume = () => 1 } = {}) {
  const V = {
    joined: false, joining: false, me: null, muted: false, forced: false,
    stream: null, peers: new Map(), // id → { pc, audio, analyser, level, speaking, gain }
    speaking: new Set(), selfSpeaking: false, roster: [],
  };
  let ac = null, selfAnalyser = null, meterTimer = null;

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
    for (const [id, p] of V.peers) {
      const on = !p.silenced && levelOf(p.analyser) > SPEAK_LEVEL;
      if (on !== V.speaking.has(id)) { on ? V.speaking.add(id) : V.speaking.delete(id); changed = true; }
    }
    if (changed) onChange('speaking');
  }

  function peer(id) {
    let p = V.peers.get(id);
    if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    p = { pc, audio: null, analyser: null, silenced: false, pending: [] };
    V.peers.set(id, p);
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
      applyVolume(id);
      p.audio.play().catch(() => {});
      p.analyser = meter(s);
    };
    pc.onconnectionstatechange = () => {
      p.state = pc.connectionState;
      if (pc.connectionState === 'failed') onError(`Не удалось связаться по голосу с участником: в сети нужен ретранслятор.`);
      onChange('state');
    };
    return p;
  }
  function dropPeer(id) {
    const p = V.peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch { /* уже закрыт */ }
    p.audio?.remove();
    V.peers.delete(id);
    V.speaking.delete(id);
  }
  function applyVolume(id) {
    const p = V.peers.get(id);
    if (!p?.audio) return;
    // кому хозяин выключил микрофон, тот не звучит у всех, даже если обошёл запрет у себя
    p.audio.volume = p.silenced ? 0 : Math.max(0, Math.min(1, getVolume(id)));
  }

  socket.on('voice:signal', async ({ from, data }) => {
    if (!V.joined) return;
    const p = peer(from);
    try {
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
      V.joined = true; V.me = r.me; V.forced = !!r.forced;
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
  function stopStream() { V.stream?.getTracks().forEach(t => t.stop()); V.stream = null; selfAnalyser = null; }
  function cleanup() {
    for (const id of [...V.peers.keys()]) dropPeer(id);
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
  return { state: V, join, leave, setMuted, sync, applyVolume, isSpeaking: id => (id === V.me ? V.selfSpeaking : V.speaking.has(id)) };
}
