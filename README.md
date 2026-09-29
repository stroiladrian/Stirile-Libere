# Știrile Libere

Agregator de știri independente (Biziday, Recorder, Snoop, Context, RISE Project, PressOne) într-un singur flux, în stil Flipboard.

## Pornire
```
npm install
npm start        # http://localhost:4321 (alt port: PORT=5000 npm start)
```
- Prima pornire descarcă știrile automat; apoi se actualizează zilnic la 07:00 și 13:00 (ora României) cât timp serverul rulează.
- Buton ⟳ din aplicație = actualizare manuală. `npm run fetch` = doar descărcare.
- Adaugi o sursă nouă în `sources.js` (URL-ul feed-ului RSS).
- Salvatele se țin în browser (localStorage).

## Pe telefon
Pune folderul pe un server (Render, Railway, Fly.io, VPS) și deschide adresa pe telefon. Ulterior poate deveni PWA sau aplicație nativă.

## Publicare pe GitHub Pages (actualizare automată)
1. Creezi un repo pe GitHub și urci proiectul (branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Gata: `.github/workflows/update.yml` descarcă știrile la 07, 09, 11, 14, 16, 19 și 22 (ora României) și publică site-ul **doar dacă a apărut ceva nou**. Rulare manuală: tab-ul Actions → „Actualizare stiri + publicare” → Run workflow.
Datele stau în `public/data/` (se commit-uiesc automat).
