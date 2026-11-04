const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../firebase-hosting');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.join(root,p==='/'?'index.html':p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,data)=>{if(e)res.writeHead(404).end();else{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}});
});
const loan=id=>({id:id+'-loan',title:id+'-loan',active:true,initialPrincipal:10000,interestRate:10,billingType:'interest',fixedAmount:0,startDate:'2026-09-15',baseDueDay:15,payments:[],movements:[]});
const fixtures=['partial','payoff','ui'].map(id=>({id,name:'Cliente '+id,phone:'11999999999',level:'Bronze',creditLimit:20000,guarantees:[],crm:[],contracts:[loan(id)]}));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});const results=[],errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>r.abort());
  await context.route('**/personal-login.js*',r=>r.fulfill({contentType:'application/javascript',body:
    '(async()=>{document.getElementById("app").style.display="";document.body.dataset.v26Locked="false";document.getElementById("v261Boot").remove();for(const name of window.CREDIGESTOR_PERSONAL_SCRIPTS)await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=name;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});window.testBooted=true;})()'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date('2026-11-04T15:00:00Z')});
  await page.addInitScript(clients=>{
    if(!localStorage.getItem('credigestor_single_owner_v25'))localStorage.setItem('credigestor_single_owner_v25',JSON.stringify({clients,settings:{appName:"CrediGestor",theme:"aurora",font:"Arial",notifyDays:[7,3,1,0]},goals:{monthlyReceipt:0,maxDelinquency:10}}));
    window.open=()=>null;
  },fixtures);
  async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}finally{await page.evaluate(()=>document.getElementById('modal').close())}}
  const info=id=>page.evaluate(id=>{const cl=state.clients.find(c=>c.id===id),k=cl.contracts[0];return {k,balance:contractBalance(k),nov:chargeFor(cl,k,2026,10),oct:chargeFor(cl,k,2026,9)}},id);
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.testBooted);
    await check('Extrato: capital, atraso e juros proporcionais (20 de 31 dias)',async()=>{
      const s=await page.evaluate(()=>earlyCloseStatement('partial','partial-loan','2026-11-04'));
      assert.equal(s.principal,1000000);assert.equal(s.overdueTotal,100000);assert.equal(s.elapsed,20);assert.equal(s.periodDays,31);assert.equal(s.proportional,64516);assert.equal(s.total,1164516);
    });
    await check('Valor parcial paga juros e abate o restante do capital',async()=>{
      await page.evaluate(()=>registerEarlyClose('partial','partial-loan','2026-11-04',6645.16,'PIX',''));
      const x=await info('partial');
      assert.equal(x.balance,5000);assert.equal(x.k.active,true);assert.equal(x.oct.status,'paid');
      assert.equal(x.nov.remaining,177.42,'restante do mês = 500 x 11/31');
      assert.equal(x.k.movements.length,1);assert.equal(x.k.movements[0].amount,5000);
    });
    await check('Valor total quita e encerra o contrato',async()=>{
      await page.evaluate(()=>registerEarlyClose('payoff','payoff-loan','2026-11-04',11645.16,'PIX',''));
      const x=await info('payoff');assert.equal(x.k.active,false);assert.equal(x.balance,0);assert.equal(x.k.payments[0].interestAmount,1645.16);
      assert.equal(await page.evaluate(()=>activeContracts().some(a=>a.c.id==='payoff-loan')),false);
    });
    await check('Valor acima do total é recusado sem gravar',async()=>{
      await assert.rejects(page.evaluate(()=>registerEarlyClose('ui','ui-loan','2026-11-04',20000,'PIX','')));
      assert.equal((await info('ui')).k.payments.length,0);
    });
    await check('Botão na central de pagamentos abre o extrato e registra pela tela',async()=>{
      await page.evaluate(()=>window.openPaymentsHubV21('ui','ui-loan'));
      await page.locator('#v28EarlyClose').click();
      assert.match(await page.locator('#ecStatement').innerText(),/11\.645,16/);
      await page.locator('#ecAmount').fill('3000');
      assert.match(await page.locator('#ecPreview').innerText(),/1\.354,84/);
      await page.locator('#ecConfirm').click();
      await page.waitForSelector('#receiptTextV25');
      const t=await page.locator('#receiptTextV25').inputValue();assert.match(t,/Capital abatido: R\$\s*1\.354,84/);assert.match(t,/Capital restante: R\$\s*8\.645,16/);
      assert.equal((await info('ui')).balance,8645.16);
    });
  }finally{
    console.log(JSON.stringify({results,errors},null,2));await browser.close();server.close();
    if(errors.length||results.some(r=>!r.passed))process.exit(1);
  }
})();
