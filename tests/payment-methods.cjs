const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../firebase-hosting');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.join(root,p==='/'?'index.html':p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,data)=>{if(e)res.writeHead(404).end();else{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}});
});
const loan=id=>({id:id+'-loan',title:id+'-loan',active:true,initialPrincipal:10000,interestRate:10,billingType:'interest',fixedAmount:0,startDate:'2026-09-15',baseDueDay:15,payments:[],movements:[]});
const fixtures=['parcel','partial','payoff','amort','early','other','switch','only-parcel','only-partial','only-early'].map(id=>({id,name:'Cliente '+id,phone:'11999999999',level:'Bronze',creditLimit:20000,guarantees:[],crm:[],contracts:[loan(id)]}));
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

  async function open(id,button){await page.evaluate(id=>window.openPaymentsHubV21(id,id+'-loan','2026-11'),id);await page.locator(button).click()}
  async function penhora(prefix='v21',details='Chácara na zona rural — lote 15'){
    await page.locator('#'+prefix+'Method').selectOption('Penhora');
    assert.equal(await page.locator('#'+prefix+'PaymentDetails').isVisible(),true);
    await page.locator('#'+prefix+'PaymentDetails').fill(details);
  }
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.testBooted);
    await check('Parcela: descrição obrigatória, baixa, comprovante e histórico',async()=>{
      await open('parcel','#v21Parcel');await penhora('v21','');
      await page.locator('#v21ConfirmParcel').click();assert.equal((await info('parcel')).k.payments.length,0);
      await page.locator('#v21PaymentDetails').fill('Chácara na zona rural — lote 15');
      await page.locator('#v21ConfirmParcel').click();await page.waitForSelector('#receiptTextV25');
      assert.match(await page.locator('#receiptTextV25').inputValue(),/Pagamento com penhora[\s\S]*Chácara na zona rural/);
      const p=(await info('parcel')).k.payments[0];assert.equal(p.method,'Penhora');assert.equal(p.settlementInKind,true);
      await page.evaluate(()=>PaymentHistory.open('parcel'));await page.locator('#phMethod').selectOption('penhora');
      assert.match(await page.locator('.ph-list').innerText(),/Chácara na zona rural/);
    });
    await check('Parcial mantém restante e detalhes',async()=>{
      await open('partial','#v21Partial');await penhora();await page.locator('#v21PartialAmount').fill('300');await page.locator('#v21ConfirmPartial').click();
      assert.match(await page.locator('#v21AdvanceReceipt').inputValue(),/Bem recebido: Chácara/);
      const p=(await info('partial')).k.payments[0];assert.equal(p.remainingForMonth,700);assert.equal(p.settlementInKind,true);
    });
    await check('Quitação encerra contrato e identifica recebimento em bem',async()=>{
      await open('payoff','#v21Payoff');await penhora('ec');await page.locator('#ecConfirm').click();await page.waitForSelector('#receiptTextV25');
      assert.match(await page.locator('#receiptTextV25').inputValue(),/Pagamento com penhora[\s\S]*Bem recebido: Chácara/);
      const x=await info('payoff');assert.equal(x.balance,0);assert.equal(x.k.active,false);assert.equal(x.k.payments[0].settlementInKind,true);
    });
    await check('Amortização preserva forma e bem no movimento e no comprovante',async()=>{
      await open('amort','#v21Amortize');await penhora();await page.locator('#v21Amount').fill('5000');await page.locator('#v21ConfirmAmort').click();await page.waitForSelector('#receiptTextV25');
      assert.match(await page.locator('#receiptTextV25').inputValue(),/Pagamento com penhora[\s\S]*Chácara/);
      const x=await info('amort');assert.equal(x.balance,5000);assert.equal(x.k.movements[0].paymentDetails,'Chácara na zona rural — lote 15');
    });
    await check('Encerramento proporcional mantém detalhes após mudar a data',async()=>{
      await open('early','#v28EarlyClose');await penhora('ec');await page.locator('#ecDate').fill('2026-11-05');
      assert.equal(await page.locator('#ecMethod').inputValue(),'Penhora');assert.match(await page.locator('#ecPaymentDetails').inputValue(),/Chácara/);
      await page.locator('#ecConfirm').click();await page.waitForSelector('#receiptTextV25');
      assert.match(await page.locator('#receiptTextV25').inputValue(),/Pagamento com penhora[\s\S]*Chácara/);
      assert.equal((await info('early')).k.payments[0].settlementInKind,true);
    });
    await check('Outra forma exige descrição e aparece no filtro',async()=>{
      await open('other','#v21Parcel');await page.locator('#v21Method').selectOption('Outro');await page.locator('#v21ConfirmParcel').click();assert.equal((await info('other')).k.payments.length,0);
      await page.locator('#v21PaymentDetails').fill('Cheque 123');await page.locator('#v21ConfirmParcel').click();await page.waitForSelector('#receiptTextV25');
      assert.match(await page.locator('#receiptTextV25').inputValue(),/Outras formas de pagamento[\s\S]*Cheque 123/);
      await page.evaluate(()=>PaymentHistory.open('other'));await page.locator('#phMethod').selectOption('outro');assert.match(await page.locator('.ph-list').innerText(),/Cheque 123/);
    });
    await check('Trocar penhora por PIX não grava descrição de bem',async()=>{
      await open('switch','#v21Parcel');await penhora();await page.locator('#v21Method').selectOption('PIX');assert.equal(await page.locator('#v21PaymentDetails').isVisible(),false);
      await page.locator('#v21ConfirmParcel').click();await page.waitForSelector('#receiptTextV25');const p=(await info('switch')).k.payments[0];assert.equal(p.method,'PIX');assert.equal(p.paymentDetails,'');assert.equal(p.settlementInKind,false);
    });
    for(const [id,button,prefix,amountId] of [
      ['only-parcel','#v21Parcel','v21','v21Amount'],
      ['only-partial','#v21Partial','v21','v21PartialAmount'],
      ['only-early','#v28EarlyClose','ec','ecAmount']
    ])await check('Apenas amortização via forma de pagamento: '+id,async()=>{
      await open(id,button);
      await page.locator('#'+amountId).fill('500');
      await page.locator('#'+prefix+'Note').fill('Abater somente o capital');
      await page.locator('#'+prefix+'Method').selectOption('amortization-only');
      assert.match(await page.locator('#modalContent h2').innerText(),/Apenas amortização/);
      assert.equal(await page.locator('#v21Amount').inputValue(),'500');
      assert.equal(await page.locator('#v21Note').inputValue(),'Abater somente o capital');
      assert.equal((await info(id)).balance,10000,'seleção não registra baixa');
      await page.locator('#v21ConfirmAmort').click();await page.waitForSelector('#receiptTextV25');
      const x=await info(id);assert.equal(x.balance,9500);assert.equal(x.k.payments.length,0);
      assert.equal(x.k.movements.length,1);assert.equal(x.k.movements[0].type,'amortization');
      assert.equal(x.k.movements[0].method,'PIX');assert.equal(x.k.active,true);
      assert.match(await page.locator('#receiptTextV25').inputValue(),/500,00/);
    });
    await check('Dados sobrevivem ao recarregamento e ao backup JSON',async()=>{
      await page.reload();await page.waitForFunction(()=>window.testBooted);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(DB_KEY)));const p=saved.clients.find(x=>x.id==='parcel').contracts[0].payments[0];assert.equal(p.method,'Penhora');assert.match(p.paymentDetails,/Chácara/);assert.equal(p.settlementInKind,true);
    });
  }finally{
    console.log(JSON.stringify({results,errors},null,2));await browser.close();server.close();
    if(errors.length||results.some(r=>!r.passed))process.exit(1);
  }
})();
