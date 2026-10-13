const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, new URL(req.url, 'http://localhost').pathname === '/' ? 'index.html' : new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) res.writeHead(404).end(); else { res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(data); } });
});
const loan = (id, startDate, baseDueDay) => ({id, title:id, startDate, baseDueDay, initialPrincipal:1000, billingType:'fixed', fixedAmount:100, interestRate:10, active:true, payments:[], movements:[]});
const clients = [
  {id:'a', name:'Francisco Pereira', contracts:[loan('a-loan','2026-09-08',8)]},
  {id:'b', name:'Valéria Souza', contracts:[loan('b-loan','2026-09-08',8)]},
  {id:'c', name:'João Pedro', contracts:[loan('c-loan','2026-09-08',8)]}
].map(c=>({...c, phone:'', cpf:'', level:'Bronze', creditLimit:10000, guarantees:[], crm:[]}));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844}, timezoneId:'America/Sao_Paulo', serviceWorkers:'block'});
  await context.route(/https:\/\//, r=>r.abort());
  const page = await context.newPage(); const errors=[]; const results=[];
  page.setDefaultTimeout(5000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-08T15:00:00Z')});
  await page.addInitScript(data=>{if(!localStorage.getItem('credigestor_v1'))localStorage.setItem('credigestor_v1',JSON.stringify({clients:data}));},clients);
  async function check(name, fn) { try { await fn(); results.push({name,passed:true}); } catch(e) {results.push({name,passed:false,error:e.message});} }
  const visible = () => page.locator('.v26-charge-card:visible');
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-view="charges"]').click();
    await check('Lupa aparece acima da lista de cobranças',async()=>{assert.equal(await page.locator('.v28-search .v28-icon').innerText(),'🔍');assert.equal(await visible().count(),3);});
    await check('Filtra por parte do nome, sem diferenciar maiúsculas e acentos',async()=>{
      await page.fill('#chargeSearchV28','valeria');assert.equal(await visible().count(),1);assert.match(await visible().innerText(),/Valéria Souza/);
      await page.fill('#chargeSearchV28','PEREIRA');assert.equal(await visible().count(),1);assert.match(await visible().innerText(),/Francisco/);
    });
    await check('Mostra aviso quando nenhum cliente é encontrado',async()=>{await page.fill('#chargeSearchV28','zzz');assert.equal(await visible().count(),0);assert.match(await page.locator('.v28-search-info').innerText(),/Nenhum cliente encontrado/);});
    await check('Pesquisa continua ao trocar de aba e volta',async()=>{await page.fill('#chargeSearchV28','joao');await page.locator('[data-v26-tab="late"]').click();await page.locator('[data-v26-tab="today"]').click();assert.equal(await page.inputValue('#chargeSearchV28'),'joao');assert.equal(await visible().count(),1);});
    await check('Botão × limpa a pesquisa',async()=>{await page.locator('.v28-clear').click();assert.equal(await page.inputValue('#chargeSearchV28'),'');assert.equal(await visible().count(),3);});
    await check('Sem erros de JavaScript',async()=>assert.deepEqual(errors,[]));
  } finally { await browser.close(); server.close(); }
  for(const r of results)console.log(`${r.passed?'✓':'✗'} ${r.name}${r.error?` — ${r.error}`:''}`);
  if(results.some(r=>!r.passed))process.exit(1);
})();
