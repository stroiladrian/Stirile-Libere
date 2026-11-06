# Știrile Libere

Agregator de știri independente (Biziday, Recorder, Snoop, Context, RISE Project, PressOne) într-un singur flux, în stil Flipboard.

## Pornire
```
npm install
npm start        # http://localhost:4321 (alt port: PORT=5000 npm start)
```
- Prima pornire descarcă știrile automat; apoi se actualizează zilnic la 07:00 și 13:00 (ora României) cât timp serverul rulează.
- Meniul ☰ (dreapta sus): Actualizează, Acasă, Setări. Actualizează = reîncărcare manuală. `npm run fetch` = doar descărcare.
- Sursele stau în folderul `feeds/` (un fișier `.json` pe sursă). Vezi „Surse” mai jos.
- Salvatele se țin în browser (localStorage).

## Pe telefon
Pune folderul pe un server (Render, Railway, Fly.io, VPS) și deschide adresa pe telefon. Ulterior poate deveni PWA sau aplicație nativă.

## Publicare pe GitHub Pages (actualizare automată)
1. Creezi un repo pe GitHub și urci proiectul (branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Gata: `.github/workflows/update.yml` descarcă știrile la 07, 09, 11, 14, 16, 19 și 22 (ora României) și publică site-ul **doar dacă a apărut ceva nou**. Rulare manuală: tab-ul Actions → „Actualizare stiri + publicare” → Run workflow.
Datele stau în `public/data/` (se commit-uiesc automat).

## Surse (adaugă / editează / șterge)
- În aplicație: **☰ → Setări → „+ Adaugă sursă”** (cu parolă). Scrii numele și adresa site-ului (sau a feed-ului RSS), alegi o culoare, apeși **Continuă pe GitHub**.
- Se deschide un *issue* pe GitHub, gata completat: apeși **Create** (telefon) / **Submit new issue** (PC). Robotul (`.github/workflows/sources.yml` + `scripts/apply-source.js`) creează fișierul în `feeds/`, pornește actualizarea știrilor și închide issue-ul cu un mesaj. După 1–3 minute sursa apare în aplicație.
- Robotul ascultă **doar** de issue-urile deschise de proprietarul repo-ului; restul sunt ignorate.
- Editează / Șterge: din aceeași listă, în aplicație (tot printr-un issue).
- Feed-ul se găsește singur din adresa site-ului (RSS sau Atom). Dacă nu se găsește, sursa apare cu „Nu am găsit feed-ul – verifică adresa”.
- Pentru sursele noi, dacă feed-ul are doar un rezumat, articolul complet se descarcă de pe site.
- Format fișier `feeds/<id>.json`: `{ "name": "...", "url": "https://...", "color": "#RRGGBB" }` (opțional: `feed`, `order`, `extract: false`, `body`, `skip`, `fallbackFeed`). Se poate edita și direct pe GitHub.

## Revenire la versiunea stabilă (dinainte de surse)
Versiunea dinainte de această schimbare are tag-ul `stable-v1`. Pentru revenire (păstrează știrile descărcate):
```
git checkout stable-v1 -- server.js sources.js public/app.js public/index.html public/style.css README.md
git rm -r -q feeds
git commit -m "Revenire la stable-v1"
git push
```
