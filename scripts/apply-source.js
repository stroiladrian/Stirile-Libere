// Aplică o cerere din aplicație (Setări → Surse): adaugă, editează sau șterge un fișier din feeds/.
// Cererea vine ca un „issue” pe GitHub, deschis doar de proprietarul repo-ului (verificat în workflow),
// cu un bloc JSON: {"action":"add|edit|delete","id":"...","name":"...","url":"...","color":"#RRGGBB"}.
// Rezultat: fișierul din feeds/ modificat + .reply.txt (comentariul pentru issue) + output-uri pentru workflow.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'feeds');
const out = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const reply = (msg) => fs.writeFileSync(path.join(__dirname, '..', '.reply.txt'), msg);
const fail = (msg) => { console.log('Eroare:', msg); reply(`⚠️ ${msg}`); out('ok', 'false'); process.exit(0); };

let body = '';
try { body = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).issue.body || ''; }
catch { fail('Nu am putut citi cererea.'); }

const m = body.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || body.match(/(\{[\s\S]*\})/);
let req;
try { req = JSON.parse(m && m[1]); } catch {}
if (!req || typeof req !== 'object') fail('Blocul JSON din cerere nu e valid.');

const action = req.action;
const id = String(req.id || '');
if (!['add', 'edit', 'delete'].includes(action)) fail('Acțiune necunoscută.');
if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(id)) fail('Id de sursă invalid.');
const file = path.join(DIR, `${id}.json`);
const exists = fs.existsSync(file);

if (action === 'delete') {
  if (!exists) fail(`Sursa „${id}” nu există.`);
  const name = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')).name; } catch { return id; } })();
  fs.unlinkSync(file);
  reply(`✅ Sursa **${name}** a fost ștearsă. Aplicația se actualizează în 1–3 minute.`);
  out('ok', 'true');
  out('msg', `Sursa stearsa: ${String(name).replace(/[\r\n]+/g, ' ')}`);
  process.exit(0);
}

const name = typeof req.name === 'string' ? req.name.replace(/[\r\n]+/g, ' ').trim().slice(0, 40) : '';
let url = typeof req.url === 'string' ? req.url.trim() : '';
if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
try { url = new URL(url).toString(); } catch { url = ''; }
const color = /^#[0-9a-f]{6}$/i.test(req.color || '') ? req.color.toUpperCase() : null;
if (!name) fail('Lipsește numele sursei.');
if (!/^https?:\/\/[^\s]+$/i.test(url)) fail('Adresa sursei nu e validă.');

if (action === 'add' && exists) fail(`Există deja o sursă cu id-ul „${id}”.`);
if (action === 'edit' && !exists) fail(`Sursa „${id}” nu există.`);

let data = {};
if (action === 'edit') {
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  // adresă nouă → feed-ul vechi nu mai e valabil, se detectează din nou
  if (data.url !== url) { delete data.feed; delete data.fallbackFeed; delete data.body; delete data.skip; delete data.extract; }
}
data.name = name;
data.url = url;
if (color) data.color = color;

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
reply(action === 'add'
  ? `✅ Sursa **${name}** a fost adăugată (${url}). Știrile apar în aplicație în 1–3 minute.`
  : `✅ Sursa **${name}** a fost actualizată. Aplicația se actualizează în 1–3 minute.`);
out('ok', 'true');
out('msg', `${action === 'add' ? 'Sursa noua' : 'Sursa editata'}: ${name}`);
