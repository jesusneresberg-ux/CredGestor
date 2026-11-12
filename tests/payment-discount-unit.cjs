const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../firebase-hosting',file),'utf8');
let serial=0,saved=null,failSave=false;
const client={id:'c',name:'Cliente',contracts:[]};
const c={console,Date,Math,JSON,Number,String,Set,Error,window:{},document:{getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}}},
 state:{clients:[client]},DB_KEY:'test',uid:()=>String(++serial),alert(){},openModal(){},
 ymd:d=>d.toISOString().slice(0,10),todayISO:()=> '2026-11-12',monthRef:()=> '2026-11',
 dueDateFor:(y,m,d)=>new Date(y,m,d,12),isPaidContract:k=>k.active===false,brl:n=>`R$ ${n}`,
 PaymentMethods:{details:()=>({})},saveState(){if(failSave)throw Error('Falha simulada');saved=JSON.stringify(c.state)},localStorage:{getItem:()=>saved}};
c.window=c;vm.createContext(c);
const app=read('app.js');vm.runInContext(app.slice(app.indexOf('function contractBalance('),app.indexOf('function allChargesAround(')),c);
const v21=read('features-v21.js');vm.runInContext(v21.slice(0,v21.indexOf('  function advanceReceiptV21('))+'window.registerReceivedPayment=registerParcelV21;})();',c);
const early=read('early-close.js');vm.runInContext(early.slice(0,early.indexOf('  function statementText('))+'})();',c);
vm.runInContext(read('features-v29.js'),c);
function loan(){const k={id:String(++serial),active:true,initialPrincipal:1000,interestRate:10,billingType:'interest',startDate:'2026-10-12',baseDueDay:12,payments:[],movements:[]};client.contracts.push(k);return k}
const row=(k,at='2026-11-12')=>c.chargeFor(client,k,2026,10,at);
const pay=(k,a,d,date='2026-11-12')=>c.registerReceivedPayment(client,k,'2026-11',a,date,'PIX','',undefined,false,null,{discountAmount:d});
let k=loan(),p=pay(k,90,10);assert.equal(p.amount,90);assert.equal(p.discountAmount,10);assert.equal(row(k).remaining,0);assert.equal(row(k).status,'paid');assert.equal(c.contractBalance(k),1000);
assert.equal(row(k,'2026-11-11').remaining,100,'desconto futuro não reduz consulta anterior');
k=loan();pay(k,30,5);assert.equal(row(k).remaining,65);pay(k,60,5);assert.equal(row(k).remaining,0);assert.equal(k.payments.reduce((s,p)=>s+p.amount,0),90,'caixa não inclui desconto');
k.payments.pop();assert.equal(row(k).remaining,65,'excluir pagamento remove também o desconto');
k=loan();for(const d of [-1,NaN,Infinity,0.001,100,200])assert.throws(()=>pay(k,1,d));assert.equal(k.payments.length,0);
assert.equal(pay(k,95,10),null);assert.equal(k.payments.length,0,'excesso não altera contrato');
k=loan();failSave=true;assert.throws(()=>pay(k,90,10),/Falha/);assert.equal(k.payments.length,0);failSave=false;
k=loan();p=pay(k,100,0);assert.equal(p.discountAmount,0);assert.equal(row(k).remaining,0,'sem desconto mantém comportamento');
k=loan();const quote=c.earlyCloseStatement('c',k.id,'2026-11-12');let r=c.registerEarlyClose('c',k.id,'2026-11-12',quote.total/100-150,'PIX','',{discountAmount:150});assert.equal(r.type,'payoff');assert.equal(r.payment.amount,quote.total/100-150);assert.equal(r.payment.discountAmount,150);assert.equal(r.payment.principalDiscount,50);assert.equal(r.payment.interestDiscount,100);assert.equal(r.payment.principalAmount+r.payment.interestAmount,r.payment.amount);assert.equal(c.contractBalance(k),0);assert.equal(k.active,false);
k=loan();assert.throws(()=>c.registerEarlyClose('c',k.id,'2026-11-12',20,'PIX','',{discountAmount:10}),/quitação/);assert.equal(k.payments.length,0);
const restored=JSON.parse(saved);assert.ok(restored.clients[0].contracts.some(k=>k.payments.some(p=>p.discountAmount===150)));
console.log('Desconto manual: parcela, parcial, consulta retroativa, exclusão, validação, caixa, rollback, quitação e persistência OK.');
