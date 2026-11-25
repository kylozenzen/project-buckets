// BUCKETS service worker: network-first so tuning changes show up immediately,
// with a cached copy so the game still opens offline.
var CACHE="buckets-v0.4";
var CORE=["./","./index.html","./game-1.js","./game-2.js","./game-3.js","./game-4.js","./shell.js","./manifest.webmanifest","./icons/icon-192.png","./icons/favicon.svg"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  var req=e.request;if(req.method!=="GET")return;
  var url=new URL(req.url);
  if(url.origin!==location.origin&&url.hostname.indexOf("fonts.")!==0)return;
  e.respondWith(fetch(req).then(function(res){
    if(res&&res.ok){var copy=res.clone();caches.open(CACHE).then(function(c){c.put(req,copy)})}
    return res;
  }).catch(function(){return caches.match(req).then(function(hit){return hit||caches.match("./index.html")})}));
});
