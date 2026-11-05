const $ = (s) => document.querySelector(s);
const PAGE = 40;
const state = { articles: [], sources: [], updatedAt: null, source: 'all', page: 'home', q: '', limit: PAGE };


// Repo-ul GitHub unde stau sursele (folderul feeds/). „Adaugă sursă” deschide aici pagina de fișier nou.
const REPO = 'stroiladrian/Stirile-Libere';
const BRANCH = 'main';
const PALETTE = ['#F5A524', '#E5484D', '#3E9BFF', '#30A46C', '#A06BFF', '#12A594', '#F76B15', '#E93D82', '#8E9BFF', '#B5A000'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const colorOf = (id) => {
  const s = state.sources.find((x) => x.id === id);
  return (s && /^#[0-9a-f]{6}$/i.test(s.color || '') && s.color) || PALETTE[hash(id) % PALETTE.length];
};

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
    <div class="src" style="color:${colorOf(a.source)}">${esc(a.sourceName)}</div>
    <h3>${esc(a.title)}</h3>
    <div class="when">${when(a.date)}</div></button>`;
}

function renderTabs() {
  const tabs = [{ id: 'all', name: 'Toate' }, ...state.sources];
  $('#tabs').innerHTML = tabs.map((t) => `<button class="tab ${state.source === t.id ? 'on' : ''}" data-src="${t.id}">${t.id === 'all' ? '' : `<i class="dot" style="background:${colorOf(t.id)}"></i>`}${esc(t.name)}</button>`).join('');
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
    body = `<div class="tiles"><button class="tile add" data-sources><span class="plus">+</span><span>Adaugă sursă<small>${unlocked() ? 'RSS sau adresa unui site' : '🔒 Protejat cu parolă'}</small></span></button>${state.sources.map((s) => {
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
// ---------- Surse: adaugă / editează / șterge (prin GitHub, fără conturi sau chei în aplicație) ----------
const gh = (kind, file) => `https://github.com/${REPO}/${kind}/${BRANCH}/feeds/${file}.json`;
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const store = {
  get() { try { return JSON.parse(localStorage.getItem('sl-pending') || '[]'); } catch { return []; } },
  set(v) { try { localStorage.setItem('sl-pending', JSON.stringify(v)); } catch {} },
};
let pickColor = null;

// Parolă pentru „Surse”: în cod e doar amprenta SHA-256 a parolei, nu parola. Deblocarea se ține minte pe acest dispozitiv.
const PASS_HASH = '5111ab2b2a07c63f9161f4b363e82ab848d5b5e9f6d87c080f14ee64943af726';
const unlocked = () => { try { return localStorage.getItem('sl-unlock') === PASS_HASH; } catch { return false; } };
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function renderLock(err) {
  $('#sources').innerHTML = `<div class="panel" role="dialog" aria-label="Surse">
    <div class="ph"><h2>Surse</h2><button class="x" data-close-sources aria-label="Închide">×</button></div>
    <form id="lockForm" autocomplete="off">
      <label>Parola<input name="pass" type="password" required autocomplete="current-password" placeholder="Introdu parola"></label>
      ${err ? '<p class="err">Parolă greșită.</p>' : ''}
      <button type="submit" class="primary">Deblochează</button>
      <p class="hint">Adăugarea, editarea și ștergerea surselor sunt disponibile doar cu parolă.</p>
    </form></div>`;
  setTimeout(() => $('#lockForm [name=pass]')?.focus(), 50);
}

function renderSources() {
  const known = new Set(state.sources.map((s) => s.id));
  const pending = store.get().filter((p) => !known.has(p.id) && Date.now() - p.at < 864e5);
  store.set(pending);
  const used = new Set(state.sources.map((s) => colorOf(s.id)));
  pickColor ||= PALETTE.find((c) => !used.has(c)) || PALETTE[0];
  const rows = state.sources.map((s) => `<li>
      <i class="dot" style="background:${colorOf(s.id)}"></i>
      <span class="nm">${esc(s.name)}${s.ok === false ? '<small class="warn">Nu am găsit feed-ul – verifică adresa</small>' : `<small>${esc((s.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</small>`}</span>
      <a href="${gh('edit', s.id)}" target="_blank" rel="noopener">Editează</a>
      <a href="${gh('delete', s.id)}" target="_blank" rel="noopener" class="del">Șterge</a></li>`).join('')
    + pending.map((p) => `<li class="pend"><i class="dot" style="background:${esc(p.color)}"></i><span class="nm">${esc(p.name)}<small>Se adaugă… apare după publicare (1–3 min)</small></span></li>`).join('');
  $('#sources').innerHTML = `<div class="panel" role="dialog" aria-label="Surse">
    <div class="ph"><h2>Surse</h2><button class="x" data-close-sources aria-label="Închide">×</button></div>
    <form id="addForm" autocomplete="off">
      <h3>Adaugă sursă</h3>
      <label>Nume<input name="name" required maxlength="40" placeholder="ex. G4Media"></label>
      <label>Adresa site-ului sau a feed-ului RSS<input name="url" required inputmode="url" autocapitalize="off" spellcheck="false" placeholder="g4media.ro sau https://…/feed/"></label>
      <div class="sw" role="radiogroup" aria-label="Culoare">${PALETTE.map((c) => `<button type="button" role="radio" aria-checked="${c === pickColor}" aria-label="Culoare ${c}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
      <button type="submit" class="primary">Continuă pe GitHub</button>
      <p class="hint">Se deschide GitHub cu sursa gata completată: apasă <b>Commit changes</b>. Feed-ul se găsește singur din adresa site-ului, iar știrile apar în aplicație după 1–3 minute.</p>
    </form>
    <h3>Sursele tale</h3>
    <ul class="srcs">${rows}</ul>
    <p class="hint">Editarea și ștergerea se fac tot pe GitHub (Commit changes). O sursă ștearsă dispare cu tot cu știrile ei.</p>
    <button class="lock" data-lock>🔒 Blochează pe acest dispozitiv</button>
  </div>`;
}
function openSources() { unlocked() ? renderSources() : renderLock(); $('#sources').hidden = false; document.body.style.overflow = 'hidden'; }
const closeSources = () => { $('#sources').hidden = true; document.body.style.overflow = ''; };

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'lockForm') {
    e.preventDefault();
    const ok = (await sha256(e.target.elements.pass.value)) === PASS_HASH;
    if (ok) { try { localStorage.setItem('sl-unlock', PASS_HASH); } catch {} renderSources(); render(); }
    else renderLock(true);
    return;
  }
  if (e.target.id !== 'addForm') return;
  e.preventDefault();
  if (!unlocked()) { renderLock(); return; }
  const f = e.target.elements;
  const name = f.name.value.trim();
  let url = f.url.value.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { url = new URL(url).toString(); } catch { f.url.setCustomValidity('Adresă invalidă'); f.url.reportValidity(); f.url.setCustomValidity(''); return; }
  let base = slug(name) || slug(new URL(url).hostname.replace(/^www\./, '')) || 'sursa';
  const ids = new Set([...state.sources.map((s) => s.id), ...store.get().map((p) => p.id)]);
  let id = base, n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;
  const value = JSON.stringify({ name, url, color: pickColor }, null, 2) + '\n';
  const link = `https://github.com/${REPO}/new/${BRANCH}?filename=${encodeURIComponent(`feeds/${id}.json`)}&value=${encodeURIComponent(value)}&message=${encodeURIComponent(`Sursă nouă: ${name}`)}`;
  window.open(link, '_blank', 'noopener');
  store.set([...store.get(), { id, name, color: pickColor, at: Date.now() }]);
  pickColor = null;
  renderSources();
});

const closeStory = () => { $('#reader').hidden = true; document.body.style.overflow = ''; };

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-open],[data-src],[data-page],[data-close],[data-share],[data-more],[data-explore],[data-sources],[data-close-sources],[data-lock],[data-color],#sources,#refreshBtn');
  if (!t) return;
  if (t.id === 'sources') { if (e.target === t) closeSources(); return; }
  if (t.dataset.color) { pickColor = t.dataset.color; t.parentNode.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-checked', b === t)); return; }
  if ('sources' in t.dataset) { openSources(); return; }
  if ('closeSources' in t.dataset) { closeSources(); return; }
  if ('lock' in t.dataset) { try { localStorage.removeItem('sl-unlock'); } catch {} closeSources(); render(); return; }
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeStory(); closeSources(); } });
// la revenirea în aplicație (ex. după GitHub) reîncarcă știrile și sursele
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });

async function load() {
  try {
    const d = await (await fetch('data/articles.json?_=' + Date.now())).json();
    Object.assign(state, { articles: d.articles, sources: d.sources, updatedAt: d.updatedAt });
  } catch {}
  if (state.source !== 'all' && !state.sources.some((s) => s.id === state.source)) state.source = 'all';
  render();
  if (!$('#sources').hidden && unlocked()) renderSources();
  if (!state.articles.length) setTimeout(load, 5000);
}
load();
setInterval(load, 10 * 60 * 1000);
