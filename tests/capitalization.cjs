'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const root=__dirname+'/../firebase-hosting/';
function setup(){
 const client={id:'c',name:'Teste',contracts:[]},storage=new Map();let saves=0,fail=false;
 const ctx={window:{},state:{clients:[client]},console,Date,Math,document:{getElementById:()=>null},openModal(){},render(){},
  saveState(){if(fail)throw Error('save failed');saves++},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 vm.createContext(ctx);
 const app=fs.readFileSync(root+'app.js','utf8');vm.runInContext(app.slice(app.indexOf('function uid('),app.indexOf('const appearanceCache')),ctx);
 for(const name of ['renegotiate.js','early-close.js','features-v29.js','capitalization.js'])vm.runInContext(fs.readFileSync(root+name,'utf8'),ctx);
 ctx.todayISO=()=> '2026-11-09';
 const loan=(id,overrides={})=>{const k={id,initialPrincipal:1000,interestRate:10,billingType:'percent',baseDueDay:7,startDate:'2026-10-01',active:true,movements:[],payments:[],...overrides};client.contracts.push(k);return k};
 return {ctx,client,loan,storage,saves:()=>saves,fail:()=>fail=true};
}
{
 const {ctx,client,loan,saves}=setup();const k=loan('normal');const before=JSON.stringify(ctx.state);
 assert.equal(ctx.window.CrediGestorCapitalization.apply(),null);
 assert.equal(ctx.window.CrediGestorCapitalization.plan().entries.length,0);
 assert.equal(JSON.stringify(ctx.state),before);assert.equal(saves(),0);
 ctx.window.CrediGestorOverdueV29.addManual(client,k,'2026-11',20,'2026-11-09','Atraso');
 const csv=fs.readFileSync(root+'backup-csv.js','utf8');vm.runInContext(csv.slice(0,csv.indexOf('function parseLegacyLoan3')),ctx);
 const rows=vm.runInContext('[CSV_HEADERS3,...csvRows3().map(row=>CSV_HEADERS3.map(key=>row[key]??""))]',ctx);
 ctx.state.clients=[];ctx.importStructuredCSV3(rows);
 const cl=ctx.state.clients[0],restored=cl.contracts[0];
 assert.equal(restored.manualLateInterest[0].amount,20);
 assert.equal(ctx.chargeFor(cl,restored,2026,10,'2026-11-10').remaining,120);
 // Capitalização passada permanece auditável e não volta à cobrança separada.
 restored.capitalizedCharges={'2026-11':{date:'2026-11-09',due:'2026-11-07',originalDue:'2026-11-07',incorporated:100,quote:{amount:100,baseAmount:100,paid:0,status:'late'}}};
 assert.equal(ctx.chargeFor(cl,restored,2026,10,'2026-11-10').remaining,0);
 assert.equal(ctx.chargeFor(cl,restored,2026,10,'2026-11-10').status,'capitalized');
}
{
 const {ctx,client,loan,storage}=setup();const k=loan('reversal');
 const payment={id:'p',reference:'2026-11',amount:25,paidAt:'2026-11-09'};k.payments=[payment];
 k.movements=[{id:'auto',batchId:ctx.window.CrediGestorCapitalization.batchId,kind:'interest_capitalization',type:'increase',amount:106.67,date:'2026-11-09'},
 {id:'manual',type:'increase',amount:200,date:'2026-11-09'}];
 k.capitalizedCharges={'2026-11':{date:'2026-11-09',incorporated:106.67}};
 const summary=ctx.window.CrediGestorCapitalization.reverseAutomatic();
 assert.equal(summary.total,106.67);assert.equal(ctx.contractBalance(k),1200);
 assert.equal(k.movements.length,1);assert.equal(k.movements[0].id,'manual');assert.equal(k.payments[0],payment);
 assert.equal(Object.keys(k.capitalizedCharges).length,0);assert.equal(storage.size,1);
 assert.equal(ctx.window.CrediGestorCapitalization.reverseAutomatic(),null);
}
{
 const {ctx,loan,fail}=setup();const k=loan('failure');
 k.movements=[{batchId:ctx.window.CrediGestorCapitalization.batchId,kind:'interest_capitalization',type:'increase',amount:100,date:'2026-11-09'}];
 const before=JSON.stringify(ctx.state);fail();assert.throws(()=>ctx.window.CrediGestorCapitalization.reverseAutomatic(),/save failed/);
 assert.equal(JSON.stringify(ctx.state),before);
}
console.log('PASS: sem capitalização automática, estorno específico, recuperação, idempotência e CSV.');
