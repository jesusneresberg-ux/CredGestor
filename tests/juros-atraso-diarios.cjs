(function v29Tests(){
  'use strict';
  const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../firebase-hosting/features-v29.js'),'utf8');
  const client={id:'client1',name:'Cliente Exemplo',phone:'',contracts:[]};
  const loan={id:'loan1',title:'Teste',initialPrincipal:1000,interestRate:10,billingType:'interest',baseDueDay:7,active:true,movements:[],payments:[],startDate:'2026-10-01'};
  client.contracts.push(loan);
  const dollars=n=>Math.round(n*100)/100;
  const context={
    window:{},state:{clients:[client]},Date,Math,console,
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
  assert.equal(quote('2026-11-07').lateInterest,0,'na data de vencimento não há juros adicionais');
  assert.equal(quote('2026-11-08').lateInterest,3.33,'primeiro dia vencido: R$100 / 30');
  assert.equal(quote('2026-11-09').lateInterest,6.67,'segundo dia vencido: proporcional simples sem capitalizar');
  assert.equal(quote('2026-11-08').remaining,103.33);
  loan.payments.push({reference:'2026-11',amount:50,paidAt:'2026-11-08'});
  assert.equal(quote('2026-11-09').lateInterest,5,'após pagamento parcial, juros só sobre base ainda pendente');
  assert.equal(quote('2026-11-09').remaining,55);
  loan.payments.push({reference:'2026-11',amount:55,paidAt:'2026-11-09'});
  assert.equal(quote('2026-11-20').lateInterest,5,'pagamento integral congela a cobrança de atraso');
  assert.equal(quote('2026-11-20').remaining,0);
  assert.equal(quote('2026-11-20').status,'paid');
  loan.payments=[];
  assert.equal(quote('2026-11-04').lateInterest,0,'não cobrar antes do vencimento');
  loan.interestRate=0;
  assert.equal(quote('2026-11-15').lateInterest,0,'sem taxa contratual não criar multa implícita');
  loan.interestRate=10;
  const statement=context.window.CrediGestorOverdueV29.statement(client,loan,'2026-11-08');
  assert.match(statement,/TOTAL DAS COBRANÇAS EM ABERTO/);
  assert.match(statement,/Juros proporcionais por atraso: R\$ 3\.33/);
  assert.match(statement,/O capital informado acima não integra este total/);
  assert.equal(quote('2026-11-08').daysLate,undefined,'a cobrança expõe lateDays e lateInterest');
  assert.equal(quote('2026-11-08').lateDays,1);
  console.log('PASS: cobrança diária a partir do 1º dia, pagamentos parciais, congelamento após baixa e extrato separado de capital');
})();
