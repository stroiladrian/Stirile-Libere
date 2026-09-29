// Surse de stiri. Adauga o sursa noua = adauga un obiect aici.
module.exports = [
  { id: 'biziday',  name: 'Biziday',  url: 'https://www.biziday.ro/',   feed: 'https://www.biziday.ro/feed/' },
  { id: 'recorder', name: 'Recorder', url: 'https://recorder.ro/stirile-recorder/', feed: 'https://recorder.ro/stirile-recorder/feed/' },
  { id: 'snoop',    name: 'Snoop',    url: 'https://snoop.ro/category/stiri-si-reportaje/', feed: 'https://snoop.ro/category/stiri-si-reportaje/feed/' },
  { id: 'context',  name: 'Context',  url: 'https://context.ro/',       feed: 'https://context.ro/feed/', body: '.contentme' },
  { id: 'rise',     name: 'RISE Project', url: 'https://www.riseproject.ro/', feed: 'https://www.riseproject.ro/feed/' },
  { id: 'pressone', name: 'PressOne', url: 'https://pressone.ro/',      feed: 'https://pressone.ro/api/rss', fallbackFeed: 'https://pressone.ro/feed/', body: 'article .featured-content', skip: '.d-flex, .card, .nl-card, .pswp-gallery, .text-center' },
];
