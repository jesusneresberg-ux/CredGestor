const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('firebase-hosting/app.js','utf8');
const model=app.slice(app.indexOf('function ymd('),app.indexOf('function allChargesAround('));
const client={id:'c',name:'Cliente',contracts:[]};
const context={Date,Math,console,window:{},state:{clients:[client]},document:{getElementById:()=>null},openModal(){},saveState(){},uid:()=>String(Math.random()),DB_KEY:'test',
 PaymentMethods:{details:()=>({})},PaymentDiscount:{validate:()=>0},
 dueDateFor:(y,m,d)=>new Date(y,m,Math.min(Number(d)||1,30,new Date(y,m+1,0).getDate()),12)};
context.localStorage={getItem:()=>JSON.stringify(context.state)};
vm.createContext(context);vm.runInContext(model,context);
vm.runInContext(fs.readFileSync('firebase-hosting/early-close.js','utf8'),context);
const fresh=(date='2026-10-15',day=15)=>({id:'k',active:true,initialPrincipal:1000,interestRate:10,billingType:'interest',startDate:date,baseDueDay:day,payments:[],movements:[]});
const quote=date=>context.window.earlyCloseStatement('c','k',date);
let k=fresh();client.contracts=[k];
for(const date of ['2026-10-15','2026-10-16','2026-11-01','2026-11-14','2026-11-15']){
 const q=quote(date);assert.equal(q.currentInterest,10000,date);assert.equal(q.total,110000,date);
}
assert.equal(quote('2026-11-15').period.ref,'2026-11','vencimento não cobra antecipadamente a referência seguinte');
k.payments.push({reference:'2026-11',amount:25,paidAt:'2026-11-01'});
assert.equal(quote('2026-11-14').currentInterest,7500,'AV abate os juros mensais');
k.payments.push({reference:'2026-11',amount:75,paidAt:'2026-11-03'});
assert.equal(quote('2026-11-14').currentInterest,0,'mês quitado não é cobrado novamente');
const snapshot=JSON.stringify(k);quote('2026-11-14');assert.equal(JSON.stringify(k),snapshot,'consulta não altera histórico');
k=fresh('2026-01-30',30);client.contracts=[k];
for(const date of ['2026-02-01','2026-02-14','2026-02-28'])assert.equal(quote(date).total,110000,'fevereiro sem rateio');
k=fresh('2027-12-15');client.contracts=[k];assert.equal(quote('2028-01-01').total,110000,'virada do ano');
k=fresh('2028-01-30',30);client.contracts=[k];assert.equal(quote('2028-02-29').total,110000,'fevereiro bissexto');
k.billingType='fixed';k.fixedAmount=77;assert.equal(quote('2028-02-14').currentInterest,7700,'parcela fixa preservada');
k.billingType='amortization';assert.equal(quote('2028-02-14').currentInterest,0,'sem juros permanece sem juros');
k=fresh();k.chargeAdjustments={'2026-11':{amount:33,reason:'Juros proporcionais já pagos sobre o capital anterior'}};client.contracts=[k];
assert.equal(quote('2026-11-04').total,110000,'ajustes antigos por dias não entram nas novas cobranças');
const r=context.window.registerEarlyClose('c','k','2026-11-04',600,'PIX','');
assert.equal(r.principalAfter,50000);assert.equal(context.contractBalance(k),500);assert.equal(k.payments[0].amount,100);assert.equal(k.payments[0].status,'paid');
assert.equal(context.chargeFor(client,k,2026,10).remaining,0,'amortização não gera novo rateio');
assert.equal(k.chargeAdjustments['2026-11'].amount,33,'histórico anterior preservado');
assert.equal(k.payments[0].proportionalInterest,undefined);assert.equal(k.payments[0].monthlyInterest,true);
console.log('PASS: mês integral, AV, baixa, amortização, datas-base, fevereiro, virada do ano e histórico.');
