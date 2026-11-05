// Sursele de stiri stau in folderul feeds/: un fisier .json pe sursa (numele fisierului = id-ul sursei).
// Adaugi o sursa = adaugi un fisier (din aplicatie: Explorează → „+ Adaugă sursă”, sau direct pe GitHub).
// Campuri: name (obligatoriu), url (site-ul sau feed-ul), feed (optional; daca lipseste, se detecteaza singur),
//          color (#RRGGBB, optional), order (optional), extract (false = doar ce e in feed),
//          fallbackFeed / body / skip (optional, pentru cazuri speciale).
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'feeds');
const PALETTE = ['#F5A524', '#E5484D', '#3E9BFF', '#30A46C', '#A06BFF', '#12A594', '#F76B15', '#E93D82', '#8E9BFF', '#B5A000'];
const isUrl = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim());
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function load() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')); } catch {}
  const list = [];
  for (const f of files) {
    const id = f.replace(/\.json$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!id) continue;
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
    catch (e) { console.warn(`  ! feeds/${f}: JSON invalid, sursa e ignorata (${e.message})`); continue; }
    const url = isUrl(d.url) ? d.url.trim() : isUrl(d.feed) ? d.feed.trim() : null;
    const name = typeof d.name === 'string' ? d.name.trim().slice(0, 40) : '';
    if (!name || !url) { console.warn(`  ! feeds/${f}: lipseste "name" sau "url", sursa e ignorata`); continue; }
    if (d.enabled === false) continue;
    list.push({
      id,
      name,
      url,
      feed: isUrl(d.feed) ? d.feed.trim() : null,
      fallbackFeed: isUrl(d.fallbackFeed) ? d.fallbackFeed.trim() : null,
      body: typeof d.body === 'string' ? d.body : null,
      skip: typeof d.skip === 'string' ? d.skip : null,
      extract: d.extract !== false, // false = nu incerca sa descarci articolul complet de pe site
      color: /^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color.toUpperCase() : PALETTE[hash(id) % PALETTE.length],
      order: Number.isFinite(d.order) ? d.order : 1000,
    });
  }
  return list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ro'));
}

module.exports = load;
