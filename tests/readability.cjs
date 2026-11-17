const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../firebase-hosting');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,name==='/'?'index.html':name);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'});
 await context.route(/https:\/\//,r=>r.abort());
 await context.route('**/personal-login.js*',r=>r.fulfill({contentType:'application/javascript',body:'(async()=>{document.getElementById("app").style.display="";document.body.dataset.v26Locked="false";document.getElementById("v261Boot").remove();for(const name of window.CREDIGESTOR_PERSONAL_SCRIPTS)await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=name;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});window.testBooted=true;})()'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.testBooted);
 // Dashboard and charges share the currency/action row. Exercise real generated rows.
 for(const width of [320,360,390,768,1280]){
  await page.setViewportSize({width,height:800});
  for(const scale of [1,1.5]){
   await page.evaluate(scale=>{
    document.documentElement.style.setProperty('--app-font-scale',scale);
    const host=document.getElementById('view');
    host.innerHTML=chargeItemHtml({cl:{id:'test',name:'Cliente de teste'},c:{id:'loan'},due:new Date(2026,10,18),ref:'2026-11',status:'open',remaining:1234567.89});
    host.querySelector('.inline-actions').innerHTML='<button class="small-btn">💳 Pagamentos</button><button class="small-btn">📤 Resumo</button><button class="small-btn">Agenda</button><button class="small-btn">WhatsApp + PIX</button><button class="small-btn">🤖 Assistente WhatsApp</button>';
   },scale);
   const layout=await page.evaluate(()=>{
    const money=document.querySelector('#view .money'),actions=document.querySelector('#view .inline-actions');
    const range=document.createRange();range.selectNodeContents(money);
    return {lines:range.getClientRects().length,money:money.getBoundingClientRect().toJSON(),actions:actions.getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(layout.lines,1,JSON.stringify({width,scale,layout}));
   assert.ok(layout.money.right<=width,JSON.stringify(layout));
   assert.ok(!layout.overflow,JSON.stringify(layout));
   if(width<=600)assert.ok(layout.actions.top>=layout.money.bottom,JSON.stringify(layout));
  }
 }
 await page.setViewportSize({width:360,height:800});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--app-font-scale','1');});
 await page.click('[data-view="settings"]');await page.waitForSelector('#fontSizeSelect');
 assert.equal(await page.locator('#fontSizeSelect').inputValue(),'100');
 await page.selectOption('#fontSizeSelect','150');
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('fontSizePreview')).fontSize==='24px');
 assert.equal(await page.evaluate(()=>state.settings.fontScale),150);
 const frame=await page.evaluate(()=>{
  const nav=document.querySelector('#app>.bottom-nav'),header=document.querySelector('#app>.topbar'),view=document.getElementById('view');
  return {nav:nav.getBoundingClientRect().bottom,header:header.getBoundingClientRect().top,viewOverflow:getComputedStyle(view).overflowY,width:document.documentElement.scrollWidth,height:innerHeight,viewport:innerWidth,pageScroll:document.documentElement.scrollHeight};
 });
 assert.ok(Math.abs(frame.nav-800)<2,JSON.stringify(frame));assert.equal(frame.header,0);assert.equal(frame.viewOverflow,'auto');assert.equal(frame.width,frame.viewport);assert.ok(frame.pageScroll<=frame.height);
 await page.evaluate(()=>{const style=document.createElement('style');style.textContent='.new-test-text{font-size:20px}';document.head.append(style);const p=document.createElement('p');p.id='newTestText';p.className='new-test-text';p.textContent='Texto novo';document.getElementById('view').append(p);});
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('newTestText')).fontSize==='30px');
 await page.reload();await page.waitForFunction(()=>window.testBooted);await page.click('[data-view="settings"]');
 assert.equal(await page.locator('#fontSizeSelect').inputValue(),'150');
 await page.selectOption('#themeSelect','noite');await page.waitForSelector('#fontSizeSelect');assert.equal(await page.locator('#fontSizeSelect').inputValue(),'150');
 await page.selectOption('#fontSizeSelect','85');await page.waitForFunction(()=>getComputedStyle(document.getElementById('fontSizePreview')).fontSize==='13.6px');
 await page.evaluate(()=>openModal('<h2>Teste de página</h2><p style="font-size:20px">Texto</p>'));
 const modal=await page.locator('#modal').boundingBox();assert.equal(modal.x,0);assert.equal(modal.y,0);assert.equal(modal.width,360);assert.equal(modal.height,800);
 assert.deepEqual(errors,[]);console.log('OK: full app boot, native icon fallback, saved font sizes, new content, themes, fixed frame and full-screen dialogs');
 await browser.close();server.close();
})().catch(error=>{console.error(error);server.close();process.exit(1)});
