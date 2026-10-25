// «Под Землёй» — справочник карт: все карты колоды с полным описанием, разбивкой по категориям, поиском и сортировкой.
// Используется и отдельной страницей /guide, и окном прямо в игре.
import { CARD_DEFS, RACE_NAMES, CLASS_NAMES, SLOT_NAMES, TAG_NAMES, ruleText, BOSS_MIN_LEVEL, BOSS_FLOOR, TROUBLE_BONUS, CONTRACTS, rewardText } from '/shared/cards.js';
import { esc, cardHTML } from '/art.js';

// категории в порядке показа; у каждой — проверка карты и пояснение
export const GUIDE_CATS = [
  { id: 'monster', label: 'Монстры', test: d => d.type === 'monster' && !d.boss, note: 'Выходят из колоды проходов или по кнопке «Искать неприятности» (такой монстр разбужен: +' + TROUBLE_BONUS + ' к силе). Сила монстра — его уровень плюс поправки; победа даёт уровни и клад, проваленный побег — расплату. Метка «только уровень» — против него считается лишь уровень героя; «без помощи» — звать на помощь нельзя.' },
  { id: 'boss', label: 'Боссы', test: d => d.boss, note: `Уровень 666, сила — вдвое больше силы героя, против которого босс вышел, но не меньше ${BOSS_FLOOR}. За героями ниже ${BOSS_MIN_LEVEL}-го уровня не гонятся.` },
  { id: 'curse', label: 'Проклятия', test: d => d.type === 'curse', note: 'Срабатывают сразу: на того, кто выбил дверь, или на жертву, которую выберет игрок.' },
  { id: 'enhancer', label: 'Усилители', test: d => d.type === 'enhancer' || d.type === 'wandering', note: 'Играются на монстра во время боя. «Из темноты вылезло…» добавляет в чужой бой монстра из руки.' },
  { id: 'race', label: 'Расы', test: d => d.type === 'race', note: 'Без расы герой — человек. Раса даёт постоянную способность.' },
  { id: 'class', label: 'Классы', test: d => d.type === 'class', note: 'Класс даёт способности — их кнопки появляются у вас на столе.' },
  { id: 'special', label: 'Особые', test: d => d.type === 'halfbreed' || d.type === 'supermunch', note: 'Позволяют держать две расы или два класса сразу.' },
  { id: 'location', label: 'Локации', test: d => d.type === 'location', note: 'Лежит на столе и меняет правила для всех, пока её не сменит другая локация.' },
  { id: 'event', label: 'События', test: d => d.type === 'event', note: 'Срабатывают сразу для всего стола.' },
  { id: 'item', label: 'Вещи', test: d => d.type === 'item' && d.slot !== 'pet', note: 'Надетые вещи прибавляют силу. Продаются: каждые 1000 голдов — уровень.' },
  { id: 'pet', label: 'Питомцы', test: d => d.type === 'item' && d.slot === 'pet', note: 'Один питомец на героя. Если побег не удался, питомец бросается на монстра и спасает от расплаты.' },
  { id: 'oneshot', label: 'Разовые', test: d => d.type === 'oneshot', note: 'Играются в бою и уходят в сброс.' },
  { id: 'buff', label: 'Зелья', test: d => d.type === 'buff', note: 'Играются на себя в любой момент: бонус к силе в этом или следующем бою.' },
  { id: 'level', label: 'Уровни и схроны', test: d => d.type === 'levelup' || d.type === 'hoard', note: 'Дают уровень или карты клада. Последний уровень берётся только победой над монстром.' },
];
const catOf = d => GUIDE_CATS.find(c => c.test(d))?.id || 'other';

const SORTS = [
  { id: 'cat', label: 'По категориям' },
  { id: 'name', label: 'По названию' },
  { id: 'power', label: 'По силе' },
  { id: 'value', label: 'По цене' },
];
const DECK = { door: 'Проходы', treasure: 'Клад' };
const RARITY = { common: 'обычная', rare: 'редкая', epic: 'эпическая', legendary: 'легендарная' };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const who = v => (v.cls ? CLASS_NAMES[v.cls] : RACE_NAMES[v.race]) || '';

function power(d) {
  if (d.boss) return 999;
  if (d.type === 'monster') return d.mirror != null ? 50 : d.level;
  if (d.type === 'enhancer') return d.double ? 30 : d.bonus;
  return (d.bonus || 0) + (d.runBonus || 0) * 0.5;
}

// по чему ищет поиск: название, текст, расплата и метки вроде «только уровень»
const searchCache = new Map();
function searchText(d) {
  if (!searchCache.has(d.id)) {
    const flags = [d.levelOnly && 'только уровень', d.noHelp && 'без помощи', d.escape === false && 'убежать нельзя', d.boss && 'босс', ...(d.tags || []).map(t => TAG_NAMES[t] || t)].filter(Boolean);
    searchCache.set(d.id, [d.name, ruleText(d.text || ''), d.bad?.text || '', ...flags].join(' ').toLowerCase());
  }
  return searchCache.get(d.id);
}

// факты о карте строками «что — значение»
function facts(d) {
  const f = [];
  f.push(['Колода', DECK[d.deck]]);
  f.push(['В колоде', `${d.copies || 1} ${plural(d.copies || 1, 'копия', 'копии', 'копий')}`]);
  if (d.rarity && d.rarity !== 'common') f.push(['Редкость', RARITY[d.rarity]]);
  if (d.type === 'monster') {
    if (d.boss) { f.push(['Уровень', String(d.level)]); f.push(['Сила', `вдвое больше силы героя, но не меньше ${BOSS_FLOOR}`]); }
    else if (d.mirror != null) f.push(['Сила', `уровень лидера ${sign(d.mirror)}`]);
    else f.push(['Уровень', String(d.level)]);
    f.push(['За победу', `${d.treasures} ${plural(d.treasures, 'карта', 'карты', 'карт')} клада, ${sign(d.levels || 1)} ур.`]);
    if (d.tags?.length) f.push(['Свойства', d.tags.map(t => TAG_NAMES[t] || t).join(', ')]);
    if (d.noPursue) f.push(['Не гонится', `за героями до ${d.noPursue}-го уровня включительно`]);
    if (d.escape === false) f.push(['Побег', 'невозможен']);
    else if (d.escapeMod) f.push(['Побег', `${sign(d.escapeMod)} к броску`]);
    if (d.noHelp) f.push(['Помощь', 'звать нельзя']);
    if (d.levelOnly) f.push(['Бой', 'только уровнем: вещи, зелья, способности и разовые карты героям не помогают']);
    if (d.soloBonus) f.push(['Против одиночки', sign(d.soloBonus)]);
  }
  if (d.type === 'item') {
    f.push(['Место', SLOT_NAMES[d.slot] + (d.hands ? `, ${d.hands} ${plural(d.hands, 'рука', 'руки', 'рук')}` : '')]);
    if (d.bonus) f.push(['Сила', sign(d.bonus)]);
    if (d.runBonus) f.push(['Побег', sign(d.runBonus)]);
    if (d.big) f.push(['Большая', 'да: одна на героя (гномам — сколько угодно)']);
    f.push(['Цена', d.value ? `${d.value} голдов` : 'не продаётся']);
    if (d.req) {
      const r = d.req;
      f.push(['Кому', r.race === 'human' ? 'только человеку (герою без расы)' : r.race ? `только: ${RACE_NAMES[r.race]}` : r.cls ? `только: ${CLASS_NAMES[r.cls]}` : r.notRace ? `всем, кроме: ${RACE_NAMES[r.notRace]}` : '']);
    }
    if (d.tags?.includes('light')) f.push(['Особое', 'источник света']);
    if (d.vsTag) f.push(['Против', `${TAG_NAMES[d.vsTag.tag]}: ещё ${sign(d.vsTag.n)}`]);
    if (d.clsBonus) f.push(['Классу', `${CLASS_NAMES[d.clsBonus.cls]}: ещё ${sign(d.clsBonus.n)}`]);
    if (d.noSteal) f.push(['Кража', 'украсть нельзя']);
  }
  if (d.type === 'oneshot') {
    if (d.effect === 'bonus') f.push(['Эффект', `${sign(d.bonus)} любой стороне боя (алхимику ещё +2)`]);
    if (d.effect === 'escapeBonus') f.push(['Эффект', `${sign(d.bonus)} к побегу`]);
    if (d.tagBonus) f.push(['Против', `${TAG_NAMES[d.tagBonus.tag]}: героям ещё ${sign(d.tagBonus.n)}`]);
    if (d.value) f.push(['Цена', `${d.value} голдов`]);
  }
  if (d.type === 'buff') { f.push(['Сила', sign(d.bonus)]); if (d.value) f.push(['Цена', `${d.value} голдов`]); }
  if (d.type === 'enhancer') {
    f.push(['Монстру', d.double ? 'уровень ×2' : sign(d.bonus)]);
    if (d.treasureDelta) f.push(['Клад', sign(d.treasureDelta)]);
    if (d.noEscape) f.push(['Побег', 'невозможен']);
  }
  return f;
}

// полный текст: на карте он иногда обрезан, здесь — целиком
function fullText(d) {
  const p = [];
  if (d.type === 'monster') {
    if (d.text) p.push(esc(ruleText(d.text)));
    (d.vs || []).forEach(v => p.push(esc(v.text) + '.'));
    (d.vsItem || []).forEach(v => p.push(esc(v.text) + '.'));
    if (d.ambush) p.push(`<b class="amb">Засада!</b> ${esc(d.ambush.text.replace(/^Засада!\s*/, ''))} <span class="muted">— срабатывает сразу при встрече.</span>`);
    p.push(`<b class="bad">Расплата:</b> ${esc(d.bad.text)}`);
    if (d.boss) p.push(`<span class="muted">${esc(d.quote || '')}</span>`);
  } else if (d.text) p.push(esc(ruleText(d.text)));
  return p.map(x => `<p>${x}</p>`).join('');
}

function entryHTML(d) {
  return `<article class="g-entry" data-cat="${catOf(d)}">
    <button class="g-card" data-guide-card="${esc(d.id)}" aria-label="Показать карту «${esc(d.name)}» крупно">${cardHTML(d.id + '#0', { size: 'md', tab: false })}</button>
    <div class="g-info">
      <h3>${esc(d.name)}</h3>
      <div class="g-text">${fullText(d)}</div>
      <dl class="g-facts">${facts(d).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </div>
  </article>`;
}

// state: { cat, sort, q }
export function renderGuide(root, { onClose = null, standalone = false } = {}) {
  const st = { cat: 'all', sort: 'cat', q: '' };
  const counts = Object.fromEntries(GUIDE_CATS.map(c => [c.id, CARD_DEFS.filter(c.test).length]));
  const doors = CARD_DEFS.filter(d => d.deck === 'door').reduce((a, d) => a + (d.copies || 1), 0);
  const treas = CARD_DEFS.filter(d => d.deck === 'treasure').reduce((a, d) => a + (d.copies || 1), 0);
  root.innerHTML = `<div class="guide${standalone ? ' standalone' : ''}" role="${standalone ? 'main' : 'dialog'}" aria-label="Справочник карт">
    <header class="g-head">
      <div><h2>Справочник карт</h2><p class="muted">Все ${CARD_DEFS.length} разных карт: ${doors} в колоде проходов и ${treas} в колоде клада. Нажмите на карту, чтобы рассмотреть её крупно.</p></div>
      ${onClose ? '<button class="btn ghost small g-close" data-guide-close>Закрыть</button>' : ''}
    </header>
    <div class="g-tools">
      <input type="search" class="g-search" placeholder="Поиск по названию и тексту" aria-label="Поиск карт">
      <label class="g-sort">Порядок <select aria-label="Порядок карт">${SORTS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
    </div>
    <div class="g-cats" role="tablist" aria-label="Категории">
      <button role="tab" data-gcat="all" aria-selected="true">Все <small>${CARD_DEFS.length}</small></button>
      ${GUIDE_CATS.map(c => `<button role="tab" data-gcat="${c.id}" aria-selected="false">${c.label} <small>${counts[c.id]}</small></button>`).join('')}
      <button role="tab" data-gcat="contracts" aria-selected="false">Контракты <small>${CONTRACTS.length}</small></button>
    </div>
    <div class="g-list"></div>
  </div>`;
  const list = root.querySelector('.g-list');
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    if (st.cat === 'contracts') {
      const ks = CONTRACTS.filter(k => !q || `${k.name} ${k.text} ${rewardText(k.reward)}`.toLowerCase().includes(q));
      list.innerHTML = `<h3 class="g-sec">Контракты</h3><p class="g-note">Тайные цели: у каждого игрока по одной. Выполнил — награда и новый контракт; самому отстающему ещё карта клада. Уровень по контракту не бывает последним — тогда вместо него клад.</p>`
        + (ks.map(k => `<div class="g-contract"><span aria-hidden="true">📜</span><div><b>${esc(k.name)}</b><p>${esc(k.text)}</p><small>Награда: ${esc(rewardText(k.reward))}</small></div></div>`).join('') || '<p class="muted">Ничего не нашлось.</p>');
      return;
    }
    let defs = CARD_DEFS.filter(d => (st.cat === 'all' || catOf(d) === st.cat)
      && (!q || searchText(d).includes(q)));
    const order = Object.fromEntries(GUIDE_CATS.map((c, i) => [c.id, i]));
    const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
    if (st.sort === 'name') defs.sort(byName);
    else if (st.sort === 'power') defs.sort((a, b) => power(b) - power(a) || byName(a, b));
    else if (st.sort === 'value') defs.sort((a, b) => (b.value || 0) - (a.value || 0) || byName(a, b));
    else defs.sort((a, b) => order[catOf(a)] - order[catOf(b)] || (catOf(a) === 'monster' ? power(a) - power(b) : 0));
    // при сортировке по категориям — заголовки разделов с пояснением
    let html = '', last = null;
    for (const d of defs) {
      const c = catOf(d);
      if (st.sort === 'cat' && c !== last) {
        const cat = GUIDE_CATS.find(x => x.id === c);
        html += `<h3 class="g-sec">${esc(cat?.label || 'Прочее')}</h3>${cat?.note ? `<p class="g-note">${esc(cat.note)}</p>` : ''}`;
        last = c;
      }
      html += entryHTML(d);
    }
    list.innerHTML = html || '<p class="muted">Ничего не нашлось.</p>';
  };
  root.querySelector('.g-search').addEventListener('input', e => { st.q = e.target.value; draw(); });
  root.querySelector('.g-sort select').addEventListener('change', e => { st.sort = e.target.value; draw(); });
  root.querySelector('.g-cats').addEventListener('click', e => {
    const b = e.target.closest('[data-gcat]');
    if (!b) return;
    st.cat = b.dataset.gcat;
    root.querySelectorAll('[data-gcat]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    draw();
    list.scrollTop = 0;
  });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-guide-close]')) return onClose?.();
    const card = e.target.closest('[data-guide-card]');
    if (card) return zoom(root, card.dataset.guideCard);
    const z = e.target.closest('.g-zoom');
    if (z && (e.target === z || e.target.closest('[data-zoom-close]'))) z.remove();
  });
  draw();
}

// крупный вид карты поверх справочника
function zoom(root, id) {
  const d = CARD_DEFS.find(x => x.id === id);
  if (!d) return;
  root.querySelector('.g-zoom')?.remove();
  const z = document.createElement('div');
  z.className = 'g-zoom';
  z.innerHTML = `<div class="g-zoom-in" role="dialog" aria-label="${esc(d.name)}">${cardHTML(d.id + '#0', { size: 'lg', tab: false })}<div class="g-info"><h3>${esc(d.name)}</h3>${fullText(d)}<dl class="g-facts">${facts(d).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><button class="btn primary small" data-zoom-close>Закрыть</button></div></div>`;
  root.querySelector('.guide').append(z);
  z.querySelector('[data-zoom-close]').focus();
}
