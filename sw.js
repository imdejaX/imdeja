const CACHE = 'kral-v32';
const ASSETS = [
  './', './menu.html', './game.html',
  './map.css', './menu-style.css',
  './harita.png',
  './js/main.js',
  './js/core/game.js', './js/core/renderer.js', './js/core/mapRenderer.js',
  './js/core/modalRenderer.js', './js/core/attackAnimator.js',
  './js/core/combat.js', './js/core/economy.js', './js/core/diplomacy.js',
  './js/core/technology.js', './js/core/combatCalculator.js',
  './js/core/bot.js', './js/core/soundManager.js', './js/core/soundIntegration.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Socket.io ve API isteklerini cache'leme
  if (e.request.url.includes('/socket.io') || e.request.url.includes('/api/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
