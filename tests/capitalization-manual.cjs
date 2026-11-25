'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const root=__dirname+'/../firebase-hosting/';
function setup(){
 const client={id:'c',name:'Teste',contracts:[]};let saves=0,fail=false;
 const ctx={window:{},state:{clients:[client]},console,Date,Math,document:{getElementById:()=>null},openModal(){},render(){},
  saveState(){if(fail)throw Error('save failed');saves++},localStorage:{getItem:()=>null,setItem(){}}};
 vm.createContext(ctx);
 const app=fs.readFileSync(root+'app.js','utf8');vm.runInContext(app.slice(app.indexOf('function uid('),app.indexOf('const appearanceCache')),ctx);
 for(const name of ['renegotiate.js','early-close.js','features-v29.js','capitalization.js'])vm.runInContext(fs.readFileSync(root+name,'utf8'),ctx);
 ctx.todayISO=()=> '2026-11-25';
 const k={id:'k',initialPrincipal:1000,interestRate:10,billingType:'percent',baseDueDay:7,startDate:'2026-08-01',active:true,movements:[],payments:[]};
 client.contracts.push(k);
 return {ctx,client,k,saves:()=>saves,fail:()=>fail=true};
}

{
 const {ctx,client:cl,k}=setup(),cap=ctx.window.CrediGestorCapitalization;
 // Set, Out e Nov vencidos (100 cada); Set parcialmente pago; juros de atraso manual em Out.
 k.payments.push({id:'p',reference:'2026-09',amount:40,paidAt:'2026-09-10'});
 ctx.window.CrediGestorOverdueV29.addManual(cl,k,'2026-10',15,'2026-11-01','Atraso');
 const plan=cap.manualPlan(cl,k,'2026-11-25');
 assert.equal(plan.rows.map(r=>r.ref).join(),'2026-09,2026-10,2026-11');
 assert.equal(plan.total,60+115+100);
 // Nada muda antes da confirmação.
 assert.equal(ctx.contractBalance(k),1000);
 // Incorpora só Out e Nov.
 const mv=cap.capitalizeManual(cl,k,{date:'2026-11-25',refs:['2026-10','2026-11']});
 assert.equal(mv.amount,215);assert.equal(ctx.contractBalance(k),1215);
 assert.equal(ctx.chargeFor(cl,k,2026,9,'2026-11-25').status,'capitalized');
 assert.equal(ctx.chargeFor(cl,k,2026,9,'2026-11-25').remaining,0);
 assert.equal(ctx.chargeFor(cl,k,2026,10,'2026-11-25').remaining,0);
 // Setembro não selecionado continua atrasado com o valor original (capital da época).
 const set=ctx.chargeFor(cl,k,2026,8,'2026-11-25');
 assert.equal(set.status,'late');assert.equal(set.remaining,60);
 // Dezembro usa o novo capital.
 assert.equal(ctx.chargeFor(cl,k,2026,11,'2026-12-07').amount,121.5);
 // Consulta anterior à incorporação mostra a situação antiga.
 assert.equal(ctx.chargeFor(cl,k,2026,10,'2026-11-20').remaining,100);
 // Não é possível lançar juros de atraso em referência incorporada.
 assert.throws(()=>ctx.window.CrediGestorOverdueV29.addManual(cl,k,'2026-11',5,'2026-11-25'),/incorporada/);
 // Seleção inválida/repetida.
 assert.throws(()=>cap.capitalizeManual(cl,k,{date:'2026-11-25',refs:['2026-10']}),/mudou/);
 assert.throws(()=>cap.capitalizeManual(cl,k,{date:'2026-11-25',refs:[]}),/Selecione/);
 assert.throws(()=>cap.capitalizeManual(cl,k,{date:'2026-12-01',refs:['2026-09']}),/data válida/);
 // Desfazer volta tudo ao normal.
 cap.reverseManual(cl,k,mv.batchId);
 assert.equal(ctx.contractBalance(k),1000);
 assert.equal(ctx.chargeFor(cl,k,2026,9,'2026-11-25').remaining,115);
 assert.equal(ctx.chargeFor(cl,k,2026,10,'2026-11-25').status,'late');
 assert.equal(Object.keys(k.capitalizedCharges).length,0);
}
{
 // Pagamento posterior à data escolhida bloqueia; falha ao salvar não altera nada.
 const {ctx,client:cl,k,fail}=setup(),cap=ctx.window.CrediGestorCapitalization;
 k.payments.push({id:'p',reference:'2026-09',amount:40,paidAt:'2026-11-20'});
 assert.throws(()=>cap.capitalizeManual(cl,k,{date:'2026-11-10',refs:['2026-09']}),/pagamento posterior/);
 const before=JSON.stringify(k);fail();
 assert.throws(()=>cap.capitalizeManual(cl,k,{date:'2026-11-25',refs:['2026-09']}),/save failed/);
 assert.equal(JSON.stringify(k),before);
}
{
 // Só desfaz a mais recente.
 const {ctx,client:cl,k}=setup(),cap=ctx.window.CrediGestorCapitalization;
 const a=cap.capitalizeManual(cl,k,{date:'2026-10-20',refs:['2026-09','2026-10']});
 const b=cap.capitalizeManual(cl,k,{date:'2026-11-25',refs:['2026-11']});
 assert.equal(ctx.contractBalance(k),1000+200+120);
 assert.throws(()=>cap.reverseManual(cl,k,a.batchId),/mais recente/);
 assert.throws(()=>cap.capitalizeManual(cl,k,{date:'2026-11-01',refs:['2026-11']}),/./);
 cap.reverseManual(cl,k,b.batchId);cap.reverseManual(cl,k,a.batchId);
 assert.equal(ctx.contractBalance(k),1000);
}
console.log('PASS: incorporação manual de juros atrasados ao capital, seleção, histórico e desfazer.');
