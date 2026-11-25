// Endereço antigo: este service worker apenas se remove e limpa o cache.
// O CrediGestor fica em https://credigestor-testes.web.app/
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({type:'window'}))c.navigate(c.url);
})()));
