const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 async function setup(native){
  const page=await browser.newPage({viewport:{width:360,height:800}});
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="view"></div>'}));
  await page.goto('http://credigestor.test');
  await page.evaluate(native=>{
   window.state={settings:{logoColor:'#2563eb'},clients:[{name:'Preservado'}]};
   window.applySettings=()=>{};window.saveState=()=>localStorage.setItem('test-wallet',JSON.stringify(state));
   window.renderSettings=()=>document.getElementById('view').innerHTML='<div id="logoAppearance"><input type="color" id="logoColorInput"><output id="logoColorCode"></output><small id="logoColorStatus"></small></div>';
   window.icon='blue';window.fail=false;window.calls=[];
   if(native)window.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>true,registerPlugin:()=>({getIcon:async()=>({color:icon}),setIcon:async({color})=>{calls.push(color);if(fail)throw Error('device error');icon=color;return {color}}})};
  },native);
  await page.addScriptTag({content:fs.readFileSync('firebase-hosting/app-icon.js','utf8')});
  await page.evaluate(()=>renderSettings());return page;
 }
 const web=await setup(false);assert.equal(await web.locator('#applyAppIcon').isDisabled(),true);assert.match(await web.locator('#appIconStatus').innerText(),/APK Android atualizado/);
 const page=await setup(true);await page.waitForFunction(()=>!document.getElementById('applyAppIcon').disabled);
 assert.equal(await page.locator('#appIconColor option').count(),8);
 await page.selectOption('#appIconColor','green');await page.click('#applyAppIcon');await page.waitForFunction(()=>document.getElementById('appIconStatus').textContent.includes('Ícone e logomarca atualizados'));
 assert.equal(await page.evaluate(()=>state.settings.logoColor),'#059669');assert.equal(await page.inputValue('#logoColorInput'),'#059669');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-wallet')).clients[0].name),'Preservado');
 await page.evaluate(()=>renderSettings());await page.waitForFunction(()=>!document.getElementById('applyAppIcon').disabled);assert.equal(await page.inputValue('#appIconColor'),'green');
 await page.evaluate(()=>fail=true);await page.selectOption('#appIconColor','red');await page.click('#applyAppIcon');await page.waitForFunction(()=>document.getElementById('appIconStatus').textContent.includes('Não foi possível alterar'));
 assert.equal(await page.evaluate(()=>state.settings.logoColor),'#059669');assert.equal(await page.locator('#applyAppIcon').isDisabled(),false);
 console.log('OK: Android icon choices, persistence, matching logo, failed native changes and unsupported APK/browser');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
