(function v29Tests(){
  'use strict';
  const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../firebase-hosting/features-v29.js'),'utf8');
  const client={id:'client1',name:'Cliente Exemplo',phone:'',contracts:[]};
  const loan={id:'loan1',title:'Teste',initialPrincipal:1000,interestRate:10,billingType:'interest',baseDueDay:7,active:true,movements:[],payments:[],startDate:'2026-10-01'};
  client.contracts.push(loan);
  const dollars=n=>Math.round(n*100)/100;
  const context={
    uid:()=> 'manual1',saveState(){},window:{},state:{clients:[client]},Date,Math,console,document:{getElementById(){return null;}},
    openModal(){},isPaidContract:k=>k.active===false,contractBalance:k=>k.initialPrincipal,monthlyDue:k=>k.initialPrincipal*k.interestRate/100,
    firstPaymentDate(){return new Date(2026,10,7,12)},brl:n=>'R$ '+dollars(n).toFixed(2),
    ymd:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    chargeFor(cl,k,y,m){
      const ref=`${y}-${String(m+1).padStart(2,'0')}`,due=new Date(y,m,7,12);
      const paid=k.payments.filter(p=>p.reference===ref).reduce((sum,p)=>sum+p.amount,0);
      const amount=100;
      return {cl,c:k,ref,due,amount,paid,remaining:Math.max(0,amount-paid),status:'late'};
    }
  };
  vm.createContext(context);vm.runInContext(source,context,{filename:'features-v29.js'});
  const quote=at=>context.chargeFor(client,loan,2026,10,at);
  assert.equal(quote('2026-11-08').lateInterest,0);
  assert.equal(quote('2026-11-09').remaining,100,'atraso não aumenta automaticamente a cobrança');
  const before=JSON.stringify(loan);
  assert.throws(()=>context.window.CrediGestorOverdueV29.addManual(client,loan,'2026-11',-1,'2026-11-09'));
  assert.equal(JSON.stringify(loan),before);
  context.window.CrediGestorOverdueV29.addManual(client,loan,'2026-11',25,'2026-11-09','Atraso combinado');
  assert.equal(quote('2026-11-08').remaining,100,'consulta anterior preservada');
  assert.equal(quote('2026-11-09').remaining,125);
  assert.equal(quote('2026-11-20').remaining,125,'valor manual não cresce com os dias');
  assert.equal(loan.initialPrincipal,1000);assert.equal(loan.movements.length,0);
  loan.payments.push({reference:'2026-11',amount:50,paidAt:'2026-11-10'});
  assert.equal(quote('2026-11-20').remaining,75);
  loan.payments.push({reference:'2026-11',amount:75,paidAt:'2026-11-20'});
  assert.equal(quote('2026-11-20').status,'paid');
  assert.match(context.window.CrediGestorOverdueV29.statement(client,loan,'2026-11-09'),/Juros de atraso lançados manualmente: R\$ 25\.00/);
  const dates=context.window.CrediGestorOverdueV29.capitalStatementDates;
  const iso=d=>context.ymd(d);
  loan.lastBalanceUpdate='2026-11-07';
  assert.equal(iso(dates(loan,'2026-11-10').due),'2026-12-07','mesmo dia avança para próximo mês');
  loan.lastBalanceUpdate='2026-11-06';
  assert.equal(iso(dates(loan,'2026-11-10').due),'2026-11-07');
  loan.movements=[{type:'increase',amount:200,date:'2026-11-09'},{type:'increase',amount:100,date:'2026-12-10'}];
  loan.updatedAt='2027-01-01';
  const stable=JSON.stringify(loan);
  assert.equal(iso(dates(loan,'2026-11-10').due),'2026-12-07','ignora movimentos futuros e edição cadastral');
  const text=context.window.CrediGestorOverdueV29.statement(client,loan,'2026-11-09');
  assert.match(text,/Vencimento após atualização do capital: 07\/12\/2026/);
  assert.match(text,/vencimento original: 07\/11\/2026/);
  assert.equal(JSON.stringify(loan),stable,'extrato não altera contratos ou pagamentos');
  for(const [updated,base,expected] of [['2026-12-30',30,'2027-01-30'],['2027-01-30',31,'2027-02-28'],['2028-01-30',30,'2028-02-29']]){
    assert.equal(iso(dates({...loan,lastBalanceUpdate:updated,movements:[],baseDueDay:base},updated).due),expected);
  }
  assert.equal(dates({...loan,billingType:'amortization'},'2026-11-10'),null);
  assert.equal(dates({...loan,active:false},'2026-11-10'),null);
  loan.movements=[];delete loan.lastBalanceUpdate;delete loan.updatedAt;
  loan.payments=[];const snapshot=JSON.stringify(loan);context.saveState=()=>{throw Error('save failed')};
  assert.throws(()=>context.window.CrediGestorOverdueV29.addManual(client,loan,'2026-11',10,'2026-11-09'),/save failed/);
  assert.equal(JSON.stringify(loan),snapshot,'falha ao salvar desfaz o lançamento');
  console.log('PASS: sem juros automáticos; lançamento manual, datas, pagamentos e falha de gravação.');
})();
