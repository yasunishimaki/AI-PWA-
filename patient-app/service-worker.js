// AI事前問診メモ Service Worker
// プロトタイプ用：最低限のキャッシュ機能

const CACHE_NAME = 'ai-prediagnosis-memo-v1.9-multilingual';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './clinic-template.js',
  './manifest.json',
  './vendor/lz-string.min.js',
  './vendor/qrcode.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// インストール時：キャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .catch(err => console.log('キャッシュエラー:', err))
  );
  self.skipWaiting();
});

// アクティベート時：古いキャッシュ削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// フェッチ時：静的アセットのみキャッシュ。API呼び出し（POST等）はそのままネットワークへ。
self.addEventListener('fetch', event => {
  // GET以外（音声送信・チャット等のPOST）はキャッシュ対象外。SWは一切介入しない。
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // OpenAI / プロキシ(Worker)へのAPI通信はキャッシュしない
  if (url.host.includes('openai.com') || url.host.includes('workers.dev')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }).catch(() => {
      return new Response('オフラインです', { status: 503 });
    })
  );
});
