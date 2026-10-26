// Offline support: keeps a copy of Dial's files so it opens without internet. Online it always asks the network first,
// so updates show up straight away, and only falls back to the saved copy when the network can't be reached.
var CACHE = 'dial-v1';
var FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/state.js', 'js/preview.js', 'js/controls.js', 'js/drag.js', 'js/reference.js', 'js/synth.js', 'js/harmonics.js', 'js/files.js', 'js/history.js', 'js/theme.js', 'js/main.js'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function(res){
    if(res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); }
    return res;
  }).catch(function(){
    return caches.match(e.request, { ignoreSearch: true }).then(function(r){ return r || caches.match('index.html'); });
  }));
});
