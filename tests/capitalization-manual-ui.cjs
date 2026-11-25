const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../firebase-hosting');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.join(root,p==='/'?'index.html':p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,data)=>{if(e)res.writeHead(404).end();else{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}});
});
const clients=[{id:'a',name:'Cliente Atrasado',phone:'11999999999',level:'Bronze',creditLimit:10000,guarantees:[],crm:[],contracts:[{id:'a-loan',title:'a-loan',active:true,initialPrincipal:1000,interestRate:10,billingType:'percent',startDate:'2026-08-07',baseDueDay:7,payments:[],movements:[]}]}];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true}),errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>r.abort());
  await context.route('**/personal-login.js*',r=>r.fulfill({contentType:'application/javascript',body:
    '(async()=>{document.getElementById("app").style.display="";document.body.dataset.v26Locked="false";document.getElementById("v261Boot").remove();for(const name of window.CREDIGESTOR_PERSONAL_SCRIPTS)await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=name;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});window.testBooted=true;})()'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date('2026-11-25T15:00:00Z')});
  await page.addInitScript(clients=>{if(!localStorage.getItem('credigestor_single_owner_v25'))localStorage.setItem('credigestor_single_owner_v25',JSON.stringify({clients,settings:{appName:"CrediGestor",theme:"aurora",font:"Arial",notifyDays:[7,3,1,0]},goals:{monthlyReceipt:0,maxDelinquency:10}}));},clients);
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.testBooted);
    await page.evaluate(()=>window.openPaymentsHubV21('a','a-loan'));
    await page.locator('#capManual').click();
    assert.equal(await page.locator('[data-cap-ref]').count(),3);
    await page.locator('[data-cap-ref="2026-09"]').uncheck();
    assert.match(await page.locator('#capTotal').innerText(),/200,00/);
    if(process.env.SHOT)await page.screenshot({path:process.env.SHOT,fullPage:true});
    await page.locator('#capConfirm').click();
    await page.waitForSelector('[data-cap-undo]');
    const r=await page.evaluate(()=>{const cl=state.clients[0],k=cl.contracts[0];return {bal:contractBalance(k),sep:chargeFor(cl,k,2026,8).remaining,nov:chargeFor(cl,k,2026,10).status,saved:JSON.parse(localStorage.getItem('credigestor_single_owner_v25')).clients[0].contracts[0].movements.length}});
    assert.equal(r.bal,1200);assert.equal(r.sep,100);assert.equal(r.nov,'capitalized');assert.equal(r.saved,1);
    await page.locator('[data-cap-undo]').click();await page.waitForFunction(()=>contractBalance(state.clients[0].contracts[0])===1000);
    assert.deepEqual(errors,[]);
    console.log('PASS: tela de incorporação manual de juros ao capital.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
