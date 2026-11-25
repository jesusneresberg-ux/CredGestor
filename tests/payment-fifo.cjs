// Regra: com parcela atrasada, a baixa vai para o mês atrasado mais antigo.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../firebase-hosting',file),'utf8');
let serial=0;const client={id:'c',name:'Cliente',contracts:[]};
const RealDate=Date;class FixedDate extends RealDate{constructor(...a){super(...(a.length?a:['2026-11-25T12:00:00']))}static now(){return new RealDate('2026-11-25T12:00:00').getTime()}}
const c={console,Date:FixedDate,Math,JSON,Number,String,Set,Map,Error,Promise,Object,window:{},document:{getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}}},
 state:{clients:[client]},DB_KEY:'test',uid:()=>String(++serial),alert(){},openModal(){},render(){},
 todayISO:()=>'2026-11-25',monthRef:()=>'2026-11',isPaidContract:k=>k.active===false,brl:n=>`R$ ${n}`,
 PaymentMethods:{details:()=>({})},saveState(){c.saved=JSON.stringify(c.state)},localStorage:{getItem:()=>c.saved},indexedDB:{open(){const r={result:{createObjectStore(){},transaction(){const tx={objectStore:()=>({put(){}})};setTimeout(()=>tx.oncomplete());return tx},close(){}}};setTimeout(()=>r.onsuccess());return r}}};
c.window=c;vm.createContext(c);
const app=read('app.js');vm.runInContext(app.slice(app.indexOf('function dueDateFor('),app.indexOf('function compactDate('))+app.slice(app.indexOf('function contractBalance('),app.indexOf('function allChargesAround(')),c);
const v21=read('features-v21.js');vm.runInContext(v21.slice(0,v21.indexOf('  function advanceReceiptV21('))+'window.registerReceivedPayment=registerParcelV21;})();',c);
vm.runInContext(read('features-v29.js'),c);
const loan=payments=>{const k={id:String(++serial),active:true,initialPrincipal:1000,interestRate:10,billingType:'interest',startDate:'2026-09-05',baseDueDay:5,payments,movements:[]};client.contracts.push(k);return k};
const row=(k,m)=>c.chargeFor(client,k,2026,m);
// 1) Pagamento novo escolhido para novembro com outubro atrasado baixa outubro.
let k=loan([]);let p=c.registerReceivedPayment(client,k,'2026-11',100,'2026-11-20','PIX','');
assert.equal(p.reference,'2026-10');assert.equal(row(k,9).status,'paid');assert.equal(row(k,10).status,'late');
// 2) Sem atraso, a referência escolhida é mantida.
k=loan([{id:'a',reference:'2026-10',amount:100,paidAt:'2026-10-05',type:'installment'}]);p=c.registerReceivedPayment(client,k,'2026-11',100,'2026-11-05','PIX','');assert.equal(p.reference,'2026-11');
// 3) Correção única: parcela de outubro paga em novembro e marcada como novembro volta para outubro; nada vai para frente.
const late=loan([{id:'x',reference:'2026-11',amount:100,paidAt:'2026-11-08',type:'installment'}]);
const ok=loan([{id:'y',reference:'2026-10',amount:100,paidAt:'2026-10-05',type:'installment'},{id:'z',reference:'2026-11',amount:100,paidAt:'2026-10-06',type:'installment'}]);
vm.runInContext(read('payment-fifo.js'),c);
setTimeout(()=>{
  assert.equal(late.payments[0].reference,'2026-10');assert.equal(late.payments[0].originalReference,'2026-11');
  assert.deepEqual(ok.payments.map(x=>x.reference),['2026-10','2026-11']);
  assert.equal(c.state.paymentReferenceFixes.fifoV1.payments,1);
  const again=c.CrediGestorPaymentFifo.plan();assert.equal(again.length,0,'idempotente');
  console.log('PASS: baixa no mês atrasado mais antigo, referência mantida sem atraso, correção única sem mover para frente.');
},50);
