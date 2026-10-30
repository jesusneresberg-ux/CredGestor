const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..',process.env.SITE_DIR||'');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.join(root,p==='/'?'index.html':p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,data)=>{if(e)res.writeHead(404).end();else{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}});
});
const clients=[{id:'ana',name:'Ana',phone:'11999999999',level:'Bronze',creditLimit:10000,guarantees:[],contracts:[{id:'ana-loan',title:'Empréstimo Ana',active:true,initialPrincipal:1000,interestRate:10,billingType:'fixed',fixedAmount:100,startDate:'2026-08-08',baseDueDay:8,movements:[],payments:[
  {id:'p1',reference:'2026-09',amount:100,paidAt:'2026-09-08',method:'PIX',note:'set'},
  {id:'p2',reference:'2026-10',amount:40,paidAt:'2026-10-05',method:'Dinheiro',type:'partial',status:'partial',remainingForMonth:60}]}]}];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});const results=[],errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>r.abort());
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date('2026-10-08T15:00:00Z')});
  await page.addInitScript(clients=>{
    if(!localStorage.getItem('credigestor_v1'))localStorage.setItem('credigestor_v1',JSON.stringify({clients}));
    window.sent=[];window.open=url=>{window.sent.push(url);return null};
  },clients);
  async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await check('Botão na ficha do cliente abre o histórico com totais',async()=>{
      await page.evaluate(()=>openClientDetail('ana'));
      await page.locator('#phOpenBtn').click();
      assert.equal(await page.locator('.ph-item').count(),2);
      const txt=await page.locator('.ph-stats').innerText();assert.match(txt,/140,00/);assert.match(txt,/\b2\b/);
    });
    await check('Filtro por tipo parcial',async()=>{
      await page.locator('#phType').selectOption('partial');
      assert.equal(await page.locator('.ph-item').count(),1);
      await page.locator('#phClear').click();assert.equal(await page.locator('.ph-item').count(),2);
    });
    await check('Comprovante por WhatsApp usa telefone com 55',async()=>{
      await page.locator('.ph-item[data-ph-id="p2"] .ph-send').click();
      const url=await page.evaluate(()=>window.sent.at(-1));
      assert.match(url,/^https:\/\/wa\.me\/5511999999999\?text=/);assert.match(decodeURIComponent(url),/Restante do mês: R\$\s*60,00/);
    });
    await check('Excluir pagamento remove do contrato e atualiza a lista',async()=>{
      await page.locator('.ph-item[data-ph-id="p1"] .ph-delete').click();
      assert.equal(await page.locator('.ph-item').count(),1);
      const ids=await page.evaluate(()=>state.clients[0].contracts[0].payments.map(p=>p.id));assert.deepEqual(ids,['p2']);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_v1')).clients[0].contracts[0].payments.length);assert.equal(saved,1);
    });
    await check('Sem erros de página',async()=>assert.deepEqual(errors,[]));
  }finally{await browser.close();server.close()}
  console.log(JSON.stringify({results},null,2));
  if(results.some(r=>!r.passed))process.exit(1);
})();
