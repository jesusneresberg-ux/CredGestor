const {chromium}=require('playwright');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const page=await browser.newPage();
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto('http://credigestor.test');
 await page.evaluate(()=>{
  document.body.innerHTML='<div id="app"></div><dialog id="modal"></dialog>';
  window.CREDIGESTOR_PERSONAL_SCRIPTS=[];
  window.CREDIGESTOR_FIREBASE_CONFIG={};
  window.CrediGestorCore={validate:x=>x};
  localStorage.setItem('credigestor_single_owner_v25','{}');
  window.calls=[];
  const owner={uid:'r7XvaVZzBhglpaMAuMlBXuipBBt1',email:'owner@example.com',emailVerified:true};
  const auth={currentUser:owner,setPersistence:async()=>{},onAuthStateChanged:fn=>{window.listener=fn;fn(owner)},signInWithEmailAndPassword:async(e,p)=>{calls.push([e,p]);return {user:auth.currentUser}},sendPasswordResetEmail:async e=>calls.push(['reset',e])};
  window.firebase={initializeApp:()=>{},auth:Object.assign(()=>auth,{Auth:{Persistence:{LOCAL:'local'}}})};
  window.renderSettings=()=>{};window.currentView='dashboard';window.CrediGestorCapitalization={reverseAutomatic:()=>0};window.render=()=>{};
  const b=document.createElement('button');b.id='accountQuickBtn';document.body.append(b);
 });
 await page.addScriptTag({content:fs.readFileSync('firebase-hosting/personal-login.js','utf8')});
 await page.waitForSelector('#personalForm');
 // Both requests must start before either finishes; execution must still be ordered.
 const requested=new Set();let bothRequested=false;
 await page.route('**/boot-*.js*',async route=>{
  const first=route.request().url().includes('boot-first');requested.add(first?'first':'second');
  await new Promise(resolve=>setTimeout(resolve,first?150:20));
  bothRequested=bothRequested||requested.size===2;
  await route.fulfill({contentType:'application/javascript',body:`window.bootOrder.push('${first?'first':'second'}')`});
 });
 await page.evaluate(()=>{window.bootOrder=[];window.CREDIGESTOR_PERSONAL_SCRIPTS=['boot-first.js','boot-second.js']});
 assert.equal(await page.locator('#app').evaluate(e=>e.inert),true,'persisted session must remain locked');
 assert.equal(await page.locator('#personalBio').isHidden(),true,'no fake biometric fallback');
 await page.fill('#loginEmail','owner@example.com');await page.fill('#loginPassword','secret123');await page.click('#personalForm button');
 await page.waitForFunction(()=>document.body.dataset.v26Locked==='false');
 assert.equal(bothRequested,true,'script downloads should overlap');
 assert.deepEqual(await page.evaluate(()=>bootOrder),['first','second'],'dependencies execute in order');
 assert.deepEqual(await page.evaluate(()=>calls[0]),['owner@example.com','secret123']);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
 assert.equal(await page.locator('#app').evaluate(e=>e.inert),true);
 await page.evaluate(()=>{firebase.auth().currentUser=null;listener(null)});
 assert.match(await page.locator('#personalMessage').innerText(),/Entre com sua conta/);
 assert.equal(await page.locator('#app').isVisible(),false);
 // Public signup starts empty even when this device contains the owner's wallet.
 const fresh=await browser.newContext();const signup=await fresh.newPage();
 await signup.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await signup.goto('http://credigestor.test');
 await signup.evaluate(()=>{
  document.body.innerHTML='<div id="app"></div><dialog id="modal"></dialog><button id="accountQuickBtn"></button>';
  window.CREDIGESTOR_PERSONAL_SCRIPTS=[];window.CREDIGESTOR_FIREBASE_CONFIG={};window.CREDIGESTOR_SINGLE_USER=true;
  localStorage.setItem('credigestor_single_owner_v25',JSON.stringify({clients:[{name:'Privado'}]}));
  window.CrediGestorCore={validate:x=>x};window.renderSettings=()=>{};window.currentView='dashboard';
  window.applySettings=()=>{};window.render=()=>{};
  window.CrediGestorCapitalization={reverseAutomatic:()=>{throw Error('New user must not run owner migration')}};
  window.calls=[];
  const auth={currentUser:null,setPersistence:async()=>{},onAuthStateChanged:fn=>{window.listener=fn;fn(null)},
   createUserWithEmailAndPassword:async(email,password)=>{calls.push(['signup',email,password]);auth.currentUser={uid:'new-user',email,emailVerified:false,providerData:[{providerId:'password'}]};listener(auth.currentUser);return {user:auth.currentUser}},
   signOut:async()=>{auth.currentUser=null;listener(null)}};
  window.firebase={initializeApp:()=>{},auth:Object.assign(()=>auth,{Auth:{Persistence:{LOCAL:'local'}}}),firestore:()=>{throw Error('Must not read owner cloud')}};
 });
 await signup.addScriptTag({content:fs.readFileSync('firebase-hosting/personal-login.js','utf8')});
 await signup.click('#personalCreate');await signup.fill('#registerEmail','new@example.com');
 await signup.fill('#registerPassword','secret123');await signup.fill('#registerConfirm','different');
 await signup.click('#registerForm button');assert.match(await signup.locator('#registerMessage').innerText(),/não coincidem/);
 assert.equal(await signup.evaluate(()=>calls.length),0);
 await signup.fill('#registerConfirm','secret123');await signup.click('#registerForm button');
 await signup.waitForFunction(()=>document.body.dataset.v26Locked==='false');
 assert.deepEqual(await signup.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_wallet:new-user')).clients),[]);
 assert.equal(await signup.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_single_owner_v25')).clients[0].name),'Privado');
 assert.deepEqual(await signup.evaluate(()=>calls[0]),['signup','new@example.com','secret123']);
 // Exercise the real app storage functions, including a late save after an account switch.
 const appPrefix=fs.readFileSync('firebase-hosting/app.js','utf8').split("function uid(prefix='id')")[0];
 await signup.addScriptTag({content:appPrefix});
 await signup.evaluate(()=>{state.clients.push({name:'Só minha conta'});saveState()});
 assert.equal(await signup.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_wallet:new-user')).clients.length),1);
 assert.equal(await signup.evaluate(()=>JSON.parse(localStorage.getItem('credigestor_single_owner_v25')).clients[0].name),'Privado');
 assert.equal(await signup.evaluate(()=>{firebase.auth().currentUser={uid:'different-user'};try{saveState();return false}catch{return true}}),true);
 await fresh.close();
 await browser.close();console.log('PASS: locked persisted session, password login, background lock, logout lock, no biometric bypass, public signup, empty isolated wallet, stale-save guard');
})().catch(e=>{console.error(e);process.exit(1)});
