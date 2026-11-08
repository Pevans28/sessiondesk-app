const CACHE='sessiondesk-static-v2';
const SHELL=['/','/index.html','/assets/app.css','/assets/app.js','/assets/icon.svg','/manifest.webmanifest','/cloud.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('/index.html')));return;
  }
  if(SHELL.includes(url.pathname)){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));return;
  }
});