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
 const {ctx,client,loan,storage,saves}=setup();const k=loan('normal'),partial=loan('partial',{payments:[{id:'p',reference:'2026-11',amount:50,paidAt:'2026-11-08'}]});
 const frozen=loan('frozen',{notes:'congelado'}),fixed=loan('fixed',{billingType:'fixed',fixedAmount:100}),paid=loan('paid',{active:false}),zero=loan('zero',{interestRate:0});
 const current=loan('current',{payments:[{reference:'2026-11',amount:100,paidAt:'2026-11-07'}]});
 const reneg=loan('reneg',{dueDateOverrides:{'2026-11':{dueDate:'2026-11-20',originalDue:'2026-11-07'}}});
 const before=JSON.stringify(partial.payments),summary=ctx.window.CrediGestorCapitalization.apply();
 assert.equal(summary.contracts,2);assert.equal(summary.total,161.67);
 assert.equal(ctx.contractBalance(k),1106.67);assert.equal(ctx.contractBalance(partial),1055);
 assert.equal(JSON.stringify(partial.payments),before,'real payments are preserved');
 for(const k of [frozen,fixed,paid,zero,current,reneg])assert.equal(k.movements.length,0);
 assert.equal(ctx.chargeFor(client,k,2026,10,'2026-11-10').remaining,0);
 assert.equal(ctx.chargeFor(client,k,2026,10,'2026-11-10').status,'capitalized');
 assert.equal(ctx.chargeFor(client,k,2026,10,'2026-11-08').remaining,103.33,'historical quote uses original principal');
 assert.equal(Math.round(ctx.chargeFor(client,k,2026,11,'2026-12-07').amount*100),11067,'next month uses new principal');
 assert.equal(ctx.window.earlyCloseStatement('c','normal','2026-11-09').interest,0,'no duplicated accrual before cut-off');
 assert.equal(ctx.window.earlyCloseStatement('c','normal','2026-11-10').elapsed,1);
 assert.equal(ctx.window.CrediGestorCapitalization.apply(),null);assert.equal(saves(),1);
 assert.ok(storage.size===1);assert.equal(JSON.parse([...storage.values()][0]).clients[0].contracts[0].movements.length,0);
 // JSON roundtrip keeps idempotency and snapshots.
 ctx.state=JSON.parse(JSON.stringify(ctx.state));assert.equal(ctx.window.CrediGestorCapitalization.apply(),null);
}
{
 const {ctx,loan,fail}=setup();loan('failure');const before=JSON.stringify(ctx.state);fail();
 assert.throws(()=>ctx.window.CrediGestorCapitalization.apply(),/save failed/);assert.equal(JSON.stringify(ctx.state),before);
}
{
 const {ctx,loan}=setup();loan('later',{payments:[{reference:'2026-11',amount:20,paidAt:'2026-11-10'}]});
 assert.equal(ctx.window.CrediGestorCapitalization.apply().contracts,0,'future payments prevent retrospective mutation');
}
console.log('PASS: capitalização única, saldo e próximos juros, AV, histórico, congelados, renegociação, recuperação e falha de gravação.');
