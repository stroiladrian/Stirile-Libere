const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const cheerio = require('cheerio');
const SOURCES = require('./sources');

const PORT = process.env.PORT || 4321;
const DATA_DIR = path.join(__dirname, 'public', 'data');
const LIST_FILE = path.join(DATA_DIR, 'articles.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json'); // vechi, doar pentru migrare
const CONTENT_DIR = path.join(DATA_DIR, 'content');        // un fisier pe zi: content/AAAA-LL-ZZ.json
const KEEP_DAYS = 14;
const MAX_ARTICLES = 1000;
const MIN_PER_SOURCE = 10;
const MAX_PER_SOURCE = 40;
const UA = 'Mozilla/5.0 (compatible; StirileLibere/1.0; +rss-reader)';
const GENERIC_CATS = ['necategorizat', 'uncategorized', 'fara categorie'];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: false,
  processEntities: true,
  trimValues: true,
});

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => {
  if (x == null) return '';
  if (typeof x === 'object') return String(x['#text'] ?? '');
  return String(x);
};

function stripHtml(html) {
  return cheerio.load(`<div>${html || ''}</div>`)('div').text().replace(/\s+/g, ' ').trim();
}

function cleanLink(link) {
  try {
    link = String(link).replace(/&#0?38;|&amp;/g, '&').replace(/#038;.*$/, '').replace(/#$/, '');
    const u = new URL(link);
    u.hash = '';
    [...u.searchParams.keys()].forEach((k) => { if (/^utm_|^fbclid$/i.test(k)) u.searchParams.delete(k); });
    return u.toString();
  } catch { return link; }
}

function firstImg(html) {
  if (!html) return null;
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

const ALLOWED = new Set(['p','h2','h3','h4','blockquote','ul','ol','li','a','strong','b','em','i','br','figure','figcaption','img','hr']);
function sanitize(html, base) {
  if (!html) return '';
  const $ = cheerio.load(`<div id="r">${html}</div>`, null, false);
  const root = $('#r');
  root.find('script,style,iframe,form,noscript,svg,button,nav,aside,.sharedaddy,.jp-relatedposts,.wp-block-embed,[class*="share"],[class*="newsletter"],[class*="related"],[class*="advert"]').remove();
  root.find('*').each((_, el) => {
    const tag = el.tagName;
    if (!ALLOWED.has(tag)) { $(el).replaceWith($(el).contents()); return; }
    const keep = {};
    if (tag === 'a') { try { keep.href = new URL($(el).attr('href') || '', base).toString(); } catch {} keep.target = '_blank'; keep.rel = 'noopener'; }
    if (tag === 'img') {
      const src = $(el).attr('src') || ($(el).attr('data-src')) || (($(el).attr('srcset') || '').split(',')[0] || '').trim().split(' ')[0];
      if (!src) { $(el).remove(); return; }
      try { keep.src = new URL(src, base).toString(); } catch { $(el).remove(); return; }
      keep.loading = 'lazy';
    }
    Object.keys(el.attribs).forEach((k) => $(el).removeAttr(k));
    Object.entries(keep).forEach(([k, v]) => $(el).attr(k, v));
  });
  root.find('p,li,blockquote,h2,h3,h4,figcaption').each((_, el) => { if (!$(el).text().trim() && !$(el).find('img').length) $(el).remove(); });
  return root.html().replace(/\n{2,}/g, '\n').trim();
}

async function pageBody(url, sel, skip) {
  try {
    const html = await fetchText(url, 15000);
    const $ = cheerio.load(html);
    const box = $(sel);
    if (!box.length) return '';
    const parts = box.find('p,h2,h3,h4,blockquote,ul,ol,figure').addBack('p,h2,h3,h4,blockquote,ul,ol,figure').filter((_, el) => (!$(el).parents('blockquote,figure,ul,ol').length || el.tagName === 'figure') && !(skip && $(el).closest(skip).length)).map((_, el) => $.html(el)).get();
    return sanitize(parts.join('\n'), url);
  } catch { return ''; }
}

function truncate(s, n = 280) {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

function normalize(item, src) {
  const title = stripHtml(text(item.title));
  const link = cleanLink(text(item.link) || text(item.guid));
  if (!title || !link) return null;
  const desc = text(item.description);
  const content = text(item['content:encoded']);

  const mcs = arr(item['media:content']);
  const thumbUrl = (x) => arr(x && x['media:thumbnail'])[0]?.['@_url'];
  const isImg = (u, m) => m === 'image' || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u || '');
  const enc = arr(item.enclosure).find((e) => (e['@_type'] || '').startsWith('image'));
  const image =
    arr(item['media:thumbnail'])[0]?.['@_url'] ||
    mcs.map(thumbUrl).find(Boolean) ||
    mcs.find((m) => isImg(m['@_url'], m['@_medium']))?.['@_url'] ||
    (enc && enc['@_url']) || firstImg(content) || firstImg(desc) || null;

  let summary = stripHtml(desc || content);
  summary = summary.replace(/(The post .* appeared first on .*|Citește mai departe.*|Read more.*)$/i, '').trim();

  const cats = arr(item.category).map((c) => stripHtml(text(c))).filter((c) => c && !GENERIC_CATS.includes(c.toLowerCase()));
  const d = new Date(text(item.pubDate) || text(item['dc:date']));

  return {
    id: link,
    title,
    link,
    date: isNaN(d) ? new Date().toISOString() : d.toISOString(),
    summary: truncate(summary),
    image,
    author: stripHtml(text(item['dc:creator'])) || null,
    tag: cats[0] || null,
    content: sanitize(content, link),
    source: src.id,
    sourceName: src.name,
  };
}

async function fetchText(url, timeout = 20000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, text/xml, */*' }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchSource(src) {
  let xml;
  try { xml = await fetchText(src.feed); }
  catch (e) {
    if (!src.fallbackFeed) throw e;
    xml = await fetchText(src.fallbackFeed);
  }
  const doc = parser.parse(xml);
  const items = arr(doc?.rss?.channel?.item);
  return items.slice(0, MAX_PER_SOURCE).map((i) => normalize(i, src)).filter(Boolean);
}

async function ogImage(url) {
  try {
    const html = await fetchText(url, 12000);
    const $ = cheerio.load(html);
    return $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || null;
  } catch { return null; }
}

function loadCache() {
  try {
    const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
    let content = {};
    try { content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')); } catch {}
    try {
      for (const f of fs.readdirSync(CONTENT_DIR)) {
        try { Object.assign(content, JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'))); } catch {}
      }
    } catch {}
    list.articles.forEach((a) => { a.content = content[a.id] || ''; });
    return list;
  } catch { return { updatedAt: null, articles: [], status: {} }; }
}

let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  console.log(`[${new Date().toISOString()}] Actualizare stiri...`);
  const old = loadCache();
  const oldById = new Map(old.articles.map((a) => [a.id, a]));
  const status = {};
  let all = [];

  await Promise.all(SOURCES.map(async (src) => {
    try {
      const list = await fetchSource(src);
      status[src.id] = { ok: true, count: list.length };
      all = all.concat(list);
    } catch (e) {
      status[src.id] = { ok: false, error: e.message };
      console.warn(`  ! ${src.name}: ${e.message}`);
    }
  }));

  // istoric: pastreaza articolele vechi (de la orice sursa); cele proaspete le inlocuiesc pe cele cu acelasi id
  const freshIds = new Set(all.map((a) => a.id));
  all = all.concat(old.articles.filter((a) => !freshIds.has(a.id)));

  // reutilizeaza imaginile deja gasite; og:image pentru cele fara imagine
  const missing = [];
  for (const a of all) {
    const prev = oldById.get(a.id);
    if (!a.image && prev && prev.image) a.image = prev.image;
    if (!a.image && !(prev && prev.ogTried)) missing.push(a);
    else if (prev && prev.ogTried) a.ogTried = true;
  }
  for (let i = 0; i < missing.length; i += 5) {
    await Promise.all(missing.slice(i, i + 5).map(async (a) => {
      a.image = await ogImage(a.link);
      a.ogTried = true;
    }));
  }

  // corp complet pentru articolele fara continut in RSS (Context, PressOne)
  const srcById = Object.fromEntries(SOURCES.map((x) => [x.id, x]));
  const needBody = [];
  for (const a of all) {
    const prev = oldById.get(a.id);
    if ((!a.content || a.content.length < 400) && prev && prev.content && prev.content.length >= 400) a.content = prev.content;
    else if ((!a.content || a.content.length < 400) && srcById[a.source].body) needBody.push(a);
  }
  for (let i = 0; i < needBody.length; i += 5) {
    await Promise.all(needBody.slice(i, i + 5).map(async (a) => {
      const b = await pageBody(a.link, srcById[a.source].body, srcById[a.source].skip);
      if (b) a.content = b;
    }));
  }

  const seen = new Set();
  const articles = all
    .filter((a) => (seen.has(a.id) ? false : seen.add(a.id)))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // taie ce e mai vechi de KEEP_DAYS, apoi scrie doar daca s-a schimbat ceva
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  // pastreaza ce e mai nou de KEEP_DAYS + minim MIN_PER_SOURCE de la fiecare sursa (ca sursele rare sa nu dispara)
  const perSource = {};
  const kept = articles.filter((a) => {
    perSource[a.source] = (perSource[a.source] || 0) + 1;
    return new Date(a.date).getTime() >= cutoff || perSource[a.source] <= MIN_PER_SOURCE;
  }).slice(0, MAX_ARTICLES);
  const strip = (list) => JSON.stringify(list.map(({ content, ...a }) => a));
  const changed = strip(kept) !== strip(old.articles) || fs.existsSync(CONTENT_FILE); // content.json vechi => migreaza la fisiere pe zile
  if (!changed) {
    console.log('  nimic nou, nu se scrie nimic');
  } else {
    // continutul, pe zile (sub 1 MB fiecare), ca telefonul sa descarce doar ce deschide
    const shards = {};
    kept.forEach((a) => { if (a.content) (shards[a.date.slice(0, 10)] ||= {})[a.id] = a.content; });
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
    for (const [day, obj] of Object.entries(shards)) fs.writeFileSync(path.join(CONTENT_DIR, `${day}.json`), JSON.stringify(obj));
    for (const f of fs.readdirSync(CONTENT_DIR)) if (!shards[f.replace('.json', '')]) fs.unlinkSync(path.join(CONTENT_DIR, f));
    try { fs.unlinkSync(CONTENT_FILE); } catch {}
    fs.writeFileSync(LIST_FILE, JSON.stringify({
      updatedAt: new Date().toISOString(),
      sources: SOURCES.map((x) => ({ id: x.id, name: x.name, url: x.url })),
      articles: kept.map(({ content, ...a }) => a),
    }));
    console.log(`  gata: ${kept.length} articole (actualizat)`);
  }
  refreshing = false;
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/refresh', async (req, res) => {
  await refresh();
  res.json({ ok: true });
});

if (process.argv.includes('--fetch-only')) {
  refresh().then(() => process.exit(0));
} else {
  app.listen(PORT, () => console.log(`Stirile Libere: http://localhost:${PORT}`));
  cron.schedule('0 7,9,11,14,16,19,22 * * *', refresh, { timezone: 'Europe/Bucharest' });
  if (!loadCache().updatedAt) refresh();
}
