const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../firebase-hosting');
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname,file=path.join(root,p==='/'?'index.html':p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(e,data)=>{if(e)res.writeHead(404).end();else{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}});
});
const fixtures=[['today','Hoje','2026-09-08',100],['late','Atrasado','2026-09-01',100],['next','A vencer','2026-09-15',100],['cents','Centavos','2026-09-08',0.30]].map(([id,name,startDate,fixedAmount])=>({id,name,phone:'11999999999',level:'Bronze',creditLimit:10000,guarantees:[],crm:[],contracts:[{id:id+'-loan',title:id+'-loan',active:true,initialPrincipal:1000,interestRate:10,billingType:'fixed',fixedAmount,startDate,baseDueDay:Number(startDate.slice(-2)),payments:[],movements:[]}]}));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});const results=[],errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>process.env.BASE_URL&&r.request().url().startsWith(process.env.BASE_URL)?r.continue():r.abort());
  await context.route('**/personal-login.js*',r=>r.fulfill({contentType:'application/javascript',body:
    '(async()=>{document.getElementById("app").style.display="";document.body.dataset.v26Locked="false";document.getElementById("v261Boot").remove();for(const name of window.CREDIGESTOR_PERSONAL_SCRIPTS)await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=name;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});window.testBooted=true;})()'}));
  const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date('2026-10-08T15:00:00Z')});
  await page.addInitScript(clients=>{
    if(!localStorage.getItem('credigestor_single_owner_v25'))localStorage.setItem('credigestor_single_owner_v25',JSON.stringify({clients,settings:{appName:"CrediGestor",theme:"aurora",font:"Arial",notifyDays:[7,3,1,0]},goals:{monthlyReceipt:0,maxDelinquency:10}}));
    window.sentReceipts=[];window.open=url=>{window.sentReceipts.push(new URL(url).searchParams.get('text'));return null};
  },fixtures);
  const data=id=>page.evaluate(id=>{const k=state.clients.find(c=>c.id===id).contracts[0];return {payments:k.payments,balance:contractBalance(k),charge:chargeFor(state.clients.find(c=>c.id===id),k,2026,9)}},id);
  async function open(id,tab){
    await page.evaluate(()=>document.getElementById('modal').close());
    await page.locator('[data-view="charges"]').click(); await page.locator(`[data-charge-section="${tab}"]`).click(); await page.locator(`[data-v21-client="${id}"][data-v21-ref="2026-10"]`).click();
  }
  async function partial(id,tab,amount,ref){
    await open(id,tab);await page.locator('#v21Partial').click();if(ref)await page.locator('#v21PartialRef').fill(ref);
    await page.locator('#v21PartialAmount').fill(String(amount));await page.locator('#v21ConfirmPartial').click();
  }
  async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}finally{await page.evaluate(()=>document.getElementById('modal').close())}}
  try{
    await page.goto(process.env.BASE_URL||`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>window.testBooted);
    for(const id of ['today','late','next'])await check(`Adiantamento ${id}: comprovante resumido, saldo 80 e situação preservada`,async()=>{
      await partial(id,id,20);const receipt=await page.locator('#v21AdvanceReceipt').inputValue();
      assert.match(receipt,/Comprovante de Adiantamento/);assert.match(receipt,/Adiantamento recebido: R\$\s*20,00/);assert.match(receipt,/\*RESTANTE PARA QUITAR O MÊS: R\$\s*80,00\*/);assert.doesNotMatch(receipt,/Valor Emprestado|Taxa de juros|Status: Pago/);
      assert.equal(await page.evaluate(()=>window.sentReceipts.at(-1)),receipt);
      const k=await data(id);assert.equal(k.charge.remaining,80);assert.equal(k.charge.status,id==='late'?'late':'open');assert.equal(k.balance,1000);assert.equal(k.payments.length,1);
    });
    await check('Segundo adiantamento soma valores e preserva o primeiro registro',async()=>{
      await partial('today','today',30);const receipt=await page.locator('#v21AdvanceReceipt').inputValue();assert.match(receipt,/Total pago no mês: R\$\s*50,00/);assert.match(receipt,/RESTANTE PARA QUITAR O MÊS: R\$\s*50,00/);
      const k=await data('today');assert.deepEqual(k.payments.map(p=>p.amount),[20,30]);assert.equal(k.charge.remaining,50);
    });
    await check('Valores zero, negativos, acima do saldo e mês anterior não registram nem enviam',async()=>{
      await open('today','today');await page.locator('#v21Partial').click();
      const count=await page.evaluate(()=>window.sentReceipts.length);
      for(const amount of ['0','-1','51']){await page.locator('#v21PartialAmount').fill(amount);await page.locator('#v21ConfirmPartial').click();}
      await page.locator('#v21PartialRef').fill('2026-08');await page.locator('#v21PartialAmount').fill('10');await page.locator('#v21ConfirmPartial').click();
      assert.equal((await data('today')).payments.length,2);assert.equal(await page.evaluate(()=>window.sentReceipts.length),count);
    });
    await check('Adiantamento em outro mês preserva o saldo da referência original',async()=>{
      await partial('today','today',5,'2026-11');assert.match(await page.locator('#v21AdvanceReceipt').inputValue(),/RESTANTE PARA QUITAR O MÊS: R\$\s*95,00/);
      const k=await data('today');assert.equal(k.charge.remaining,50);assert.equal(k.payments.at(-1).reference,'2026-11');
    });
    await check('Pagar Parcela quita apenas o saldo e emite comprovante definitivo',async()=>{
      await open('today','today');await page.locator('#v21Parcel').click();assert.equal(await page.locator('#v21Amount').inputValue(),'50.00');await page.locator('#v21ConfirmParcel').click();
      const k=await data('today');assert.deepEqual(k.payments.map(p=>p.amount),[20,30,5,50]);assert.equal(k.charge.status,'paid');assert.equal(k.charge.remaining,0);assert.equal(k.balance,1000);
      assert.match(await page.locator('#receiptTextV25').inputValue(),/Comprovante de Pagamento/);
      assert.doesNotMatch(await page.locator('#receiptTextV25').inputValue(),/Comprovante de Adiantamento/);
    });
    await check('Centavos acumulam sem resíduos e último parcial quita o mês',async()=>{
      for(let i=0;i<3;i++)await partial('cents','today',0.10);
      assert.match(await page.locator('#v21AdvanceReceipt').inputValue(),/RESTANTE PARA QUITAR O MÊS: R\$\s*0,00/);
      const k=await data('cents');assert.equal(k.charge.paid,0.30);assert.equal(k.charge.remaining,0);assert.equal(k.charge.status,'paid');
    });
    await check('Histórico e saldo parcial sobrevivem ao recarregamento',async()=>{
      await page.reload();await page.waitForFunction(()=>window.testBooted);assert.equal((await data('today')).payments.length,4);assert.equal((await data('late')).charge.remaining,80);
      await page.evaluate(()=>openClientDetail('today'));assert.match(await page.locator('#clientHistoryV21').innerText(),/Adiantamento/);
    });
    await check('Quitação de capital mantém juros residuais após adiantamento',async()=>{
      await page.evaluate(()=>{state.clients.find(c=>c.id==='late').contracts[0].billingType='interest';saveState()});
      await open('late','late');assert.match(await page.locator('#modalContent').innerText(),/1\.080,00/);
    });
    await check('Sem telefone: adiantamento salvo e comprovante disponível para copiar',async()=>{
      await page.evaluate(()=>{state.clients.find(c=>c.id==='late').phone='';saveState()});
      const count=await page.evaluate(()=>window.sentReceipts.length);await partial('late','late',10);
      assert.equal((await data('late')).charge.remaining,70);assert.equal(await page.locator('#v21SendAdvance').isDisabled(),true);
      assert.equal(await page.locator('#v21CopyAdvance').count(),1);assert.match(await page.locator('#v21AdvanceReceipt').inputValue(),/RESTANTE PARA QUITAR O MÊS: R\$\s*70,00/);
      assert.equal(await page.evaluate(()=>window.sentReceipts.length),count);
    });
    await check('Falha ao salvar não registra nem emite comprovante',async()=>{
      const before=await data('late'),count=await page.evaluate(()=>window.sentReceipts.length);
      await page.evaluate(()=>{window.originalSave=saveState;saveState=()=>{throw Error('Falha simulada ao salvar')}});
      await open('late','late');await page.locator('#v21Partial').click();await page.locator('#v21PartialAmount').fill('5');await page.locator('#v21ConfirmPartial').click();
      assert.deepEqual((await data('late')).payments,before.payments);assert.equal(await page.evaluate(()=>window.sentReceipts.length),count);
      await page.evaluate(()=>saveState=window.originalSave);
    });
    await check('Renegociação preserva parcial e vencimento original',async()=>{
      await page.evaluate(()=>{const cl=state.clients.find(c=>c.id==='late'),k=cl.contracts[0];window.applyRenegotiation(k,[chargeFor(cl,k,2026,9)],['2026-10-20'],'teste');saveState()});
      const k=await data('late');assert.equal(k.charge.remaining,70);assert.equal(k.charge.status,'open');assert.equal(k.payments[0].referenceDate,'2026-10-01');
      await partial('late','next',10);const after=await data('late');assert.equal(after.charge.remaining,60);assert.equal(after.payments.at(-1).referenceDate,'2026-10-01');
    });
    await check('Nenhum erro JavaScript',async()=>assert.deepEqual(errors,[]));
    console.log(JSON.stringify({results,errors},null,2));if(results.some(x=>!x.passed))process.exitCode=1;
  }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});





