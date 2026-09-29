const $ = (s) => document.querySelector(s);
const PAGE = 40;
const state = { articles: [], sources: [], updatedAt: null, source: 'all', page: 'home', q: '', limit: PAGE };


const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bg = (a) => (a.image ? `style="background-image:url('${esc(a.image)}')"` : '');

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'acum';
  if (m < 60) return `acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? 'oră' : 'ore'}`;
  const d = Math.round(h / 24);
  if (d < 7) return `acum ${d} ${d === 1 ? 'zi' : 'zile'}`;
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

const TZ = 'Europe/Bucharest';
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
function when(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('ro-RO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const k = dayKey(iso), today = dayKey(new Date().toISOString()), yest = dayKey(new Date(Date.now() - 864e5).toISOString());
  if (k === today) return `Azi, ${time}`;
  if (k === yest) return `Ieri, ${time}`;
  return d.toLocaleDateString('ro-RO', { timeZone: TZ, day: 'numeric', month: 'short' }) + `, ${time}`;
}

const byId = (id) => state.articles.find((a) => a.id === id);

function card(a, wide) {
  return `<button class="card ${wide ? 'wide' : ''}" data-open="${esc(a.id)}">
    <div class="img" ${bg(a)}></div>
    <div class="src">${esc(a.sourceName)}</div>
    <h3>${esc(a.title)}</h3>
    <div class="when">${when(a.date)}</div></button>`;
}

function renderTabs() {
  const tabs = [{ id: 'all', name: 'Toate' }, ...state.sources];
  $('#tabs').innerHTML = tabs.map((t) => `<button class="tab ${state.source === t.id ? 'on' : ''}" data-src="${t.id}">${esc(t.name)}</button>`).join('');
  $('#tabs').style.display = state.page === 'home' ? '' : 'none';
}

// Ordine strict după dată, de la cea mai nouă la cea mai veche, toate sursele împreună.
// Ca să nu apară blocuri de aceeași sursă, o știre poate ceda locul uneia de la altă sursă
// doar dacă diferența de timp dintre ele e mică (sub 45 de minute).
const MIX_WINDOW_MS = 45 * 60 * 1000;
function mixFeed(articles) {
  const rest = [...articles].sort((x, y) => new Date(y.date) - new Date(x.date));
  const out = [];
  while (rest.length) {
    let pick = 0;
    const last = out[out.length - 1];
    if (last && rest[0].source === last.source) {
      const t0 = new Date(rest[0].date).getTime();
      for (let i = 1; i < Math.min(rest.length, 8); i++) {
        if (t0 - new Date(rest[i].date).getTime() > MIX_WINDOW_MS) break;
        if (rest[i].source !== last.source) { pick = i; break; }
      }
    }
    out.push(rest.splice(pick, 1)[0]);
  }
  return out;
}

function renderHome() {
  const list = state.source === 'all' ? mixFeed(state.articles) : state.articles.filter((a) => a.source === state.source);
  if (!list.length) return `<div class="empty">Nu sunt încă știri. Se descarcă acum… apasă ⟳ dacă durează.</div>`;
  const [hero, ...rest] = list;
  const stamp = state.updatedAt ? `Actualizat ${ago(state.updatedAt)}` : '';
  return `<button class="hero" data-open="${esc(hero.id)}" ${bg(hero)}>
      <div class="cap"><span class="chip">${esc(hero.sourceName)}</span>
      <h2>${esc(hero.title)}</h2><div class="meta">${when(hero.date)}${hero.author ? ' · ' + esc(hero.author) : ''}</div></div></button>
    <div class="stamp">${stamp}</div>
    <div class="grid">${rest.slice(0, state.limit).map((a, i) => card(a, i % 7 === 3)).join('')}</div>${rest.length > state.limit ? '<button class="more" data-more>Încarcă mai multe</button>' : ''}`;
}

function renderExplore() {
  const q = state.q.trim().toLowerCase();
  let body;
  if (q) {
    const res = state.articles.filter((a) => (a.title + ' ' + a.summary).toLowerCase().includes(q));
    body = res.length ? `<div class="grid">${res.slice(0, state.limit).map((a) => card(a)).join('')}</div>${res.length > state.limit ? '<button class="more" data-more>Încarcă mai multe</button>' : ''}` : `<div class="empty">Niciun rezultat pentru „${esc(state.q)}”.</div>`;
  } else {
    body = `<div class="tiles">${state.sources.map((s) => {
      const items = state.articles.filter((a) => a.source === s.id);
      const cover = items.find((a) => a.image);
      return `<button class="tile" data-explore="${s.id}" ${cover ? bg(cover) : ''}><span>${esc(s.name)}<small>${items.length} articole</small></span></button>`;
    }).join('')}</div>`;
  }
  return `<div class="search"><span>🔍</span><input id="q" type="search" placeholder="Caută în știri" value="${esc(state.q)}"></div>${body}`;
}

function render(keepFocus) {
  renderTabs();
  const v = $('#view');
  v.innerHTML = state.page === 'home' ? renderHome() : renderExplore();
  document.querySelectorAll('.bottom button').forEach((b) => b.classList.toggle('on', b.dataset.page === state.page));
  if (keepFocus) { const i = $('#q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}

const contentCache = {};
const getContent = (iso) => {
  const day = iso.slice(0, 10);
  return (contentCache[day] ||= fetch(`data/content/${day}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => { delete contentCache[day]; return {}; }));
};

async function openStory(id) {
  const a = byId(id); if (!a) return;
  const r = $('#reader');
  r.hidden = false;
  document.body.style.overflow = 'hidden';
  const tag = (a.tag && !/^(știri|stiri|news)$/i.test(a.tag) ? a.tag : a.sourceName).replace(/\s+/g, '');
  r.innerHTML = `<div class="story" id="story">
    <button class="close" data-close aria-label="Închide">×</button>
    <div class="cover" ${bg(a)}><div class="cover-in">
      <span class="chip">#${esc(tag)}</span>
      <h1>${esc(a.title)}</h1>
      <div class="by">${esc(a.sourceName)}${a.author ? ' · ' + esc(a.author) : ''} · ${when(a.date)}</div>
    </div></div>
    <div class="sheet">
      <div class="actions">
        <button data-share="${esc(a.id)}" aria-label="Distribuie"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v8h14v-8"/></svg><span>Distribuie</span></button>
      </div>
      <article class="prose" id="prose"><p class="lead">${esc(a.summary)}</p><p class="loading">Se încarcă articolul…</p></article>
      <div class="credit">Sursa: <a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.sourceName)}</a></div>
    </div></div>`;
  try {
    const d = await getContent(a.date);
    const html = d[id];
    if ($('#prose') && html) {
      $('#prose').innerHTML = html;
      // scoate imaginea de copertă dacă e repetată la început
      const first = $('#prose').querySelector('figure, img');
      if (first && a.image) { const im = first.tagName === 'IMG' ? first : first.querySelector('img'); if (im && im.src.split('?')[0].replace(/-\d+x\d+(?=\.)/, '') === a.image.split('?')[0].replace(/-\d+x\d+(?=\.)/, '')) first.remove(); }
    } else if ($('#prose')) $('#prose .loading')?.remove();
  } catch { $('#prose .loading')?.remove(); }
}
const closeStory = () => { $('#reader').hidden = true; document.body.style.overflow = ''; };

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-open],[data-src],[data-page],[data-close],[data-share],[data-more],[data-explore],#refreshBtn');
  if (!t) return;
  if ('more' in t.dataset) { state.limit += PAGE; const y = window.scrollY; render(); window.scrollTo(0, y); }
  else if (t.dataset.open) openStory(t.dataset.open);
  else if (t.dataset.src) { state.source = t.dataset.src; state.limit = PAGE; render(); window.scrollTo(0, 0); }
  else if (t.dataset.page) { state.page = t.dataset.page; state.limit = PAGE; render(); window.scrollTo(0, 0); }
  else if (t.dataset.explore) { state.source = t.dataset.explore; state.page = 'home'; state.limit = PAGE; render(); window.scrollTo(0, 0); }
  else if ('close' in t.dataset) closeStory();
  else if (t.dataset.share) {
    const a = byId(t.dataset.share);
    if (navigator.share) navigator.share({ title: a.title, url: a.link }).catch(() => {});
    else navigator.clipboard?.writeText(a.link).then(() => { t.style.opacity = .5; setTimeout(() => (t.style.opacity = ''), 600); });
  } else if (t.id === 'refreshBtn') {
    t.classList.add('spin');
    Object.keys(contentCache).forEach((k) => delete contentCache[k]);
    await fetch('api/refresh', { method: 'POST' }).catch(() => {});
    await load();
    t.classList.remove('spin');
  }
});
document.addEventListener('input', (e) => { if (e.target.id === 'q') { state.q = e.target.value; state.limit = PAGE; render(true); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeStory(); });

async function load() {
  try {
    const d = await (await fetch('data/articles.json?_=' + Date.now())).json();
    Object.assign(state, { articles: d.articles, sources: d.sources, updatedAt: d.updatedAt });
  } catch {}
  render();
  if (!state.articles.length) setTimeout(load, 5000);
}
load();
setInterval(load, 10 * 60 * 1000);
