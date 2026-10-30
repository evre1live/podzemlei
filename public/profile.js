// «Под Землёй» — профиль героя на этом устройстве: партии, победы, монстры и боссы, медали номинаций, любимые раса
// и класс, встреченные карты (бестиарий-коллекция), золотые карты и рубашки колод. Учётных записей в игре нет,
// поэтому всё хранится в браузере (localStorage): на другом устройстве — свой профиль.
import { CARD_DEFS } from '/shared/cards.js';

const KEY = 'pz.profile';
const BACK_KEY = 'pz.back';
// золотая карта: столько раз победили этого монстра (сами или в помощниках)
export const GOLD_AT = 5;
const base = uid => String(uid || '').split('#')[0];

let cache = null;
function load() {
  if (cache) return cache;
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { p = {}; }
  p.games ||= 0; p.wins ||= 0; p.kills ||= 0; p.bosses ||= 0;
  p.medals ||= { gold: 0, silver: 0, bronze: 0 };
  p.races ||= {}; p.classes ||= {}; p.slain ||= {}; p.seen ||= []; p.done ||= [];
  p.best ||= 0;
  cache = p;
  return p;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* приватный режим */ } }
export const profile = () => load();

// ───── встреченные карты ─────
let seenSet = null;
const seen = () => (seenSet ||= new Set(load().seen));
export const isSeen = id => seen().has(base(id));
export function noteSeen(uids) {
  const s = seen();
  let fresh = 0;
  for (const u of uids) { const id = base(u); if (id && !s.has(id)) { s.add(id); fresh++; } }
  if (!fresh) return 0;
  load().seen = [...s];
  save();
  return fresh;
}
export const collectible = () => CARD_DEFS.length;

// ───── победы над монстрами и золотые карты ─────
export const slainOf = id => load().slain[base(id)] || 0;
export const isGolden = id => slainOf(id) >= GOLD_AT;
// возвращает базовые id карт, которые только что стали золотыми
export function noteKills(uids, boss) {
  const p = load(), gold = [];
  for (const u of uids) {
    const id = base(u);
    if (!id) continue;
    p.slain[id] = (p.slain[id] || 0) + 1;
    if (p.slain[id] === GOLD_AT) gold.push(id);
  }
  p.kills += uids.length;
  if (boss) p.bosses++;
  save();
  return gold;
}
export const goldenCount = () => Object.values(load().slain).filter(n => n >= GOLD_AT).length;

// ───── итог партии ─────
// key — чтобы одну и ту же партию не посчитать дважды (перезагрузка страницы на итогах)
export function noteGame({ key, won, medals = [], races = [], classes = [], level = 0 }) {
  const p = load();
  if (p.done.includes(key)) return false;
  p.done = [...p.done.slice(-40), key];
  p.games++;
  if (won) p.wins++;
  for (const m of medals) if (p.medals[m] !== undefined) p.medals[m]++;
  for (const r of races) p.races[r] = (p.races[r] || 0) + 1;
  for (const c of classes) p.classes[c] = (p.classes[c] || 0) + 1;
  p.best = Math.max(p.best, level);
  save();
  return true;
}
export const favorite = map => Object.entries(map || {}).sort((a, b) => b[1] - a[1])[0] || null;
// звание по числу побед
export function rankOf(wins) {
  return wins >= 25 ? 'Легенда подземелья' : wins >= 10 ? 'Ветеран' : wins >= 3 ? 'Бывалый' : wins >= 1 ? 'Искатель приключений' : 'Новичок подземелья';
}

// ───── рубашки колод ─────
// Открываются за подвиги из профиля. Рисунок у всех один, меняется отделка: огонь, лёд, золото, королевский пурпур.
export const BACKS = [
  { id: 'classic', name: 'Подземная', text: 'есть с самого начала' },
  { id: 'ember', name: 'Огненная', need: p => p.wins >= 3, text: '3 победы', prog: p => [p.wins, 3] },
  { id: 'ice', name: 'Ледяная', need: p => p.games >= 10, text: '10 партий', prog: p => [p.games, 10] },
  { id: 'gold', name: 'Золотая', need: p => p.kills >= 50, text: '50 побеждённых монстров', prog: p => [p.kills, 50] },
  { id: 'royal', name: 'Королевская', need: p => p.medals.gold >= 5, text: '5 золотых медалей', prog: p => [p.medals.gold, 5] },
];
export const backOpen = b => !b.need || b.need(load());
export function getBack() {
  let id = 'classic';
  try { id = localStorage.getItem(BACK_KEY) || 'classic'; } catch { /* нет хранилища */ }
  const b = BACKS.find(x => x.id === id);
  return b && backOpen(b) ? b.id : 'classic';
}
export function setBack(id) {
  const b = BACKS.find(x => x.id === id);
  if (!b || !backOpen(b)) return false;
  try { localStorage.setItem(BACK_KEY, id); } catch { /* нет хранилища */ }
  applyBack();
  return true;
}
// hasArt(id) — есть ли у рубашки свой рисунок: тогда CSS-отделка (фильтры) не нужна
export function applyBack(hasArt = () => false) {
  const id = getBack();
  for (const b of BACKS) document.body.classList.toggle('back-' + b.id, b.id === id && id !== 'classic');
  document.body.classList.toggle('back-art', id !== 'classic' && hasArt(id));
}
