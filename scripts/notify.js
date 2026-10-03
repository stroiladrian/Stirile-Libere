// Trimite o notificare pe telefon prin ntfy.sh (gratuit) cand apar stiri noi.
// Topicul vine din variabila NTFY_TOPIC (secret in GitHub). Fara topic sau fara stiri noi, nu face nimic.
const fs = require('fs');
const path = require('path');

const topic = process.env.NTFY_TOPIC;
const file = path.join(__dirname, '..', '.new-articles.json');
const SITE = 'https://stroiladrian.github.io/Stirile-Libere/';

(async () => {
  if (!topic) return console.log('NTFY_TOPIC lipseste, nu trimit notificare.');
  if (!fs.existsSync(file)) return console.log('Nicio stire noua, nu trimit notificare.');
  const items = JSON.parse(fs.readFileSync(file, 'utf8'))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!items.length) return;

  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const lines = items.slice(0, 4).map((a) => `• ${a.source}: ${cut(a.title, 110)}`);
  if (items.length > 4) lines.push(`…și încă ${items.length - 4}`);

  const res = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      title: items.length === 1 ? 'O știre nouă' : `${items.length} știri noi`,
      message: lines.join('\n'),
      click: SITE,
      icon: SITE + 'icon-192.png',
      tags: ['newspaper'],
    }),
  });
  console.log('ntfy:', res.status);
  if (!res.ok) process.exitCode = 1;
})();
