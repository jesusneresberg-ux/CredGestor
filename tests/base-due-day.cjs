const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
// No app o dia-base é sempre o dia da data de início (features-v13).
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../firebase-hosting');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.join(root,p==='/'?'index.html':p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,data)=>{if(e)res.writeHead(404).end();else{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}});
});
// Contratos cuja 1ª cobrança caía fora do dia-base com a regra antiga (início + 30 dias).
const fixtures=[['aug14','Início 14/08 dia 14','2026-08-14',14],['sep14','Início 14/09 dia 14','2026-09-14',14],['jul14','Início 14/07 dia 14','2026-07-14',14],['oct01','Início 01/10 dia 1','2026-10-01',1],['jan31','Início 31/01 dia 31','2026-01-31',31]]
  .map(([id,name,startDate,baseDueDay])=>({id,name,phone:'11999999999',level:'Bronze',creditLimit:10000,guarantees:[],crm:[],contracts:[{id:id+'-loan',title:id+'-loan',active:true,initialPrincipal:1000,interestRate:10,billingType:'fixed',fixedAmount:100,baseDueDay,startDate,payments:[],movements:[]}]}));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});const results=[],errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>r.abort());
  await context.route('**/personal-login.js*',r=>r.fulfill({contentType:'application/javascript',body:
    '(async()=>{document.getElementById("app").style.display="";document.body.dataset.v26Locked="false";document.getElementById("v261Boot").remove();for(const name of window.CREDIGESTOR_PERSONAL_SCRIPTS)await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=name;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});window.testBooted=true;})()'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-14T15:00:00Z')});
  await page.addInitScript(clients=>{localStorage.setItem('credigestor_single_owner_v25',JSON.stringify({clients,settings:{appName:"CrediGestor",theme:"aurora",font:"Arial",notifyDays:[7,3,1,0]},goals:{monthlyReceipt:0,maxDelinquency:10}}))},fixtures);
  async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.testBooted);
    const first=id=>page.evaluate(id=>ymd(firstPaymentDate(state.clients.find(c=>c.id===id).contracts[0])),id);
    await check('1ª cobrança cai no dia-base do mês seguinte',async()=>{
      assert.equal(await first('aug14'),'2026-09-14');assert.equal(await first('sep14'),'2026-10-14');assert.equal(await first('jul14'),'2026-08-14');
      assert.equal(await first('oct01'),'2026-11-01');assert.equal(await first('jan31'),'2026-02-28');
    });
    await check('Cobranças de hoje mostra todos os contratos com dia-base 14',async()=>{
      await page.locator('[data-view="charges"]').click();await page.locator('[data-charge-section="today"]').click();
      const ids=await page.locator('[data-v21-client]').evaluateAll(b=>b.map(x=>x.dataset.v21Client).sort());
      assert.deepEqual(ids,['aug14','jul14','sep14']);
    });
    await check('Atrasados usa o dia-base da 1ª cobrança',async()=>{
      const late=await page.evaluate(()=>state.clients.flatMap(cl=>{const k=cl.contracts[0],out=[];for(let m=0;m<=9;m++){const x=chargeFor(cl,k,2026,m);if(x.status==='late')out.push(cl.id+':'+ymd(x.due))}return out}));
      assert.ok(late.includes('aug14:2026-09-14'));assert.ok(late.includes('jul14:2026-08-14'));assert.ok(late.includes('jan31:2026-02-28'));
      assert.ok(!late.some(x=>x.startsWith('oct01')));
    });
    await check('Nenhum erro JavaScript',async()=>assert.deepEqual(errors,[]));
  }finally{await browser.close();server.close();}
  console.log(JSON.stringify({results,errors},null,2));if(results.some(r=>!r.passed))process.exitCode=1;
})();
