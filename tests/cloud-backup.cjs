// Testa a cópia automática na nuvem com um Firestore simulado (sem rede real).
const {chromium}=require('playwright');
const fs=require('fs'),assert=require('node:assert/strict');
const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1';
const core=fs.readFileSync('firebase-hosting/v26-core.js','utf8');
const module_=fs.readFileSync('firebase-hosting/cloud-backup.js','utf8');

async function boot(browser,{cloud,local,meta,device,denied=false}){
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body><div id="view"></div></body>'}));
  await page.goto('https://credigestor.test');
  await page.evaluate(({cloud,local,meta,device,denied,OWNER})=>{
    const KEY='credigestor_single_owner_v25';
    localStorage.setItem(KEY,JSON.stringify(local));
    if(meta)localStorage.setItem('credigestor_cloud_sync:'+OWNER,JSON.stringify(meta));
    if(device)localStorage.setItem('credigestor_cloud_device',device);
    window.CREDIGESTOR_WALLET_SESSION={uid:OWNER,key:KEY};
    window.defaultState=()=>({clients:[],settings:{appName:'CrediGestor'},goals:{monthlyReceipt:0,maxDelinquency:10}});
    window.state=JSON.parse(localStorage.getItem(KEY));
    window.saveState=function(){localStorage.setItem(KEY,JSON.stringify(state));return true};
    window.renderSettings=function(){document.getElementById('view').innerHTML='<div class="card">Config</div>'};
    window.applySettings=()=>{};window.renders=0;window.render=()=>{renders++};window.currentView='dashboard';
    window.openModal=(html,bind)=>{document.getElementById('modal')?.remove();const m=document.createElement('div');m.id='modal';m.innerHTML=html;document.body.append(m);bind&&bind()};
    window.closeModal=()=>document.getElementById('modal')?.remove();
    window.confirm=()=>true;window.alerts=[];window.alert=m=>alerts.push(m);
    // Firestore simulado com conferência de revisão igual às regras.
    window.cloudDoc=cloud;window.writes=0;
    const ref={
      get:async()=>({exists:!!cloudDoc,data:()=>JSON.parse(JSON.stringify(cloudDoc))}),
      parent:{parent:{collection:()=>({doc:()=>({set:async()=>{throw Error('chunks not expected')}})})}}
    };
    const db={
      collection:()=>({doc:()=>({collection:name=>name==='paymentEvents'?{get:async()=>({docs:[]})}:{doc:()=>ref}})}),
      runTransaction:async fn=>fn({get:async()=>ref.get(),set:(_,data)=>{
        if(denied)throw Object.assign(Error('denied'),{code:'permission-denied'});
        if(data.revision!==cloudDoc.revision+1)throw Object.assign(Error('rev'),{code:'permission-denied'});
        writes++;cloudDoc={...data,updatedAt:null};
      }})
    };
    const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>'SERVER_TIME'};
    window.firebase={firestore,auth:()=>({currentUser:{uid:OWNER}})};
  },{cloud,local,meta,device,denied,OWNER});
  await page.addScriptTag({content:core});
  await page.addScriptTag({content:module_});
  page.errors=errors;
  return page;
}
const wallet=names=>({clients:names.map((n,i)=>({id:'c'+i,name:n,contracts:[]})),settings:{appName:'CrediGestor'},goals:{monthlyReceipt:0,maxDelinquency:10}});
const doc=(names,revision,writerId)=>({schemaVersion:261,state:wallet(names),revision,appliedEvents:{ev1:true},updatedBy:OWNER,writerId});
const settle=(page,mode)=>page.waitForFunction(m=>window.CrediGestorCloudBackup?.status().mode===m,mode,{timeout:15000});

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});

  // 1. Primeiro envio: carteira local substitui a cópia antiga da migração, que fica guardada.
  let p=await boot(browser,{cloud:doc(['Antigo'],7,'0f8c-uuid'),local:wallet(['Ana','Bruno'])});
  await settle(p,'saved');
  let r=await p.evaluate(()=>({cloud:cloudDoc,meta:JSON.parse(localStorage.getItem('credigestor_cloud_sync:r7XvaVZzBhglpaMAuMlBXuipBBt1'))}));
  assert.equal(r.cloud.revision,8);assert.deepEqual(r.cloud.state.clients.map(c=>c.name),['Ana','Bruno']);
  assert.deepEqual(r.cloud.appliedEvents,{ev1:true},'recibos já aplicados são preservados');
  assert.match(r.cloud.writerId,/^dev_/);assert.equal(r.meta.revision,8);
  const archived=await p.evaluate(()=>new Promise(res=>{const q=indexedDB.open('credigestor-individual-recovery',1);q.onsuccess=()=>{const g=q.result.transaction('snapshots').objectStore('snapshots').get('cloud-before-sync-7');g.onsuccess=()=>res(g.result)}}));
  assert.deepEqual(archived.state.clients.map(c=>c.name),['Antigo'],'versão antiga da nuvem guardada no aparelho');

  // 2. Cada gravação local agenda envio automático.
  await p.evaluate(()=>{state.clients.push({id:'c9',name:'Carla',contracts:[]});saveState()});
  await p.waitForFunction(()=>cloudDoc.revision===9,null,{timeout:15000});
  assert.equal(await p.evaluate(()=>cloudDoc.state.clients.length),3);

  // 3. Sem alterações, não grava de novo.
  await p.evaluate(()=>CrediGestorCloudBackup.push());await settle(p,'saved');
  assert.equal(await p.evaluate(()=>writes),2);

  // 4. Outro aparelho salva; este aparelho também altera: não sobrescreve, pergunta.
  await p.evaluate(()=>{cloudDoc={...cloudDoc,revision:10,writerId:'dev_outro',state:{...cloudDoc.state,clients:[...cloudDoc.state.clients,{id:'x',name:'Do celular',contracts:[]}]}};state.clients.push({id:'y',name:'Deste aparelho',contracts:[]});saveState()});
  await settle(p,'conflict');
  assert.equal(await p.evaluate(()=>cloudDoc.revision),10,'nuvem preservada no conflito');
  await p.evaluate(()=>CrediGestorCloudBackup.resolve());
  await p.click('#cloudUseRemote');
  await p.waitForFunction(()=>state.clients.some(c=>c.name==='Do celular'));
  assert.equal(await p.evaluate(()=>state.clients.some(c=>c.name==='Deste aparelho')),false);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_single_owner_v25')).clients.length),4);
  await p.evaluate(()=>{currentView='settings';renderSettings()});
  assert.match(await p.locator('[data-cloud-status]').innerText(),/salvo/);
  assert.deepEqual(p.errors,[]);await p.close();

  // 5. Ao abrir: nuvem mais nova e nenhuma alteração local → carrega a nuvem sozinho.
  const localW=wallet(['Ana']);
  const hash=await (async()=>{const b=await browser.newPage();await b.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await b.goto('https://credigestor.test');await b.addScriptTag({content:core});const h=await b.evaluate(w=>CrediGestorCore.hash(CrediGestorCore.stable(w)),localW);await b.close();return h})();
  p=await boot(browser,{cloud:doc(['Ana','Nova'],12,'dev_outro'),local:localW,meta:{revision:11,hash,at:'2026-11-24T10:00:00Z'},device:'dev_este'});
  await p.waitForFunction(()=>state.clients.length===2);
  assert.equal(await p.evaluate(()=>writes),0);assert.equal(await p.evaluate(()=>alerts.length),0);
  await p.close();

  // 6. Aparelho sem histórico e nuvem já usada por outro aparelho → pergunta, não sobrescreve.
  p=await boot(browser,{cloud:doc(['Do outro'],3,'dev_outro'),local:wallet(['Antigo local']),device:'dev_este'});
  await settle(p,'conflict');
  assert.equal(await p.locator('#cloudUseLocal').count(),1);
  assert.equal(await p.evaluate(()=>writes),0);
  await p.click('#cloudUseLocal');await settle(p,'saved');
  assert.equal(await p.evaluate(()=>cloudDoc.state.clients[0].name),'Antigo local','envio forçado só após confirmação');
  await p.close();

  // 7. Firebase recusa a gravação → erro visível, carteira local intacta.
  p=await boot(browser,{cloud:doc(['X'],1,'uuid'),local:wallet(['Local']),denied:true});
  await settle(p,'error');
  assert.match(await p.evaluate(()=>CrediGestorCloudBackup.label()),/permissão/);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_single_owner_v25')).clients[0].name),'Local');
  await p.close();

  // 8. Outras contas aprovadas não usam a nuvem do administrador.
  p=await browser.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await p.goto('https://credigestor.test');
  await p.evaluate(()=>{window.CREDIGESTOR_WALLET_SESSION={uid:'outra',key:'credigestor_wallet:outra'};window.firebase={firestore:()=>{throw Error('não deve acessar')}}});
  await p.addScriptTag({content:core});await p.addScriptTag({content:module_});
  assert.equal(await p.evaluate(()=>window.CrediGestorCloudBackup),undefined);

  await browser.close();
  console.log('PASS: primeiro envio com cópia da versão antiga, envio automático, sem regravação, conflito entre aparelhos, carga automática, aparelho novo, recusa do Firebase e isolamento de contas.');
})().catch(e=>{console.error(e);process.exit(1)});
