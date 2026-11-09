/* Incorporação única autorizada em 09/11/2026. Não registra recebimento nem liberação. */
(function(){
  'use strict';
  const BATCH='capitalizacao-atrasos-2026-11-09',DATE='2026-11-09';
  const cents=v=>Math.round((Number(v)||0)*100);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const rawCharge=chargeFor;
  chargeFor=function(cl,k,y,m,asOf){
    const ref=`${y}-${String(m+1).padStart(2,'0')}`;
    const snapshot=k.capitalizedCharges?.[ref];
    const at=asOf instanceof Date?ymd(asOf):String(asOf||todayISO()).slice(0,10);
    if(snapshot&&at>=snapshot.date){
      return {...rawCharge(cl,k,y,m,asOf),...snapshot.quote,
        due:new Date(snapshot.due+'T12:00:00'),originalDue:new Date(snapshot.originalDue+'T12:00:00'),
        remaining:0,status:snapshot.incorporated>0?'capitalized':snapshot.quote.status,
        capitalizedAmount:snapshot.incorporated,capitalizedAt:snapshot.date};
    }
    if(snapshot){
      // Consulta anterior à incorporação usa o capital anterior e o histórico real.
      const historical=clone(k);
      historical.movements=(historical.movements||[]).filter(v=>v.batchId!==BATCH);
      delete historical.capitalizedCharges;
      return rawCharge(cl,historical,y,m,asOf);
    }
    return rawCharge(cl,k,y,m,asOf);
  };
  function plan(){
    const entries=[],skipped=[];
    for(const cl of state.clients||[])for(const k of cl.contracts||[]){
      if(k.active===false||isPaidContract(k)||contractBalance(k)<=0||!(Number(k.interestRate)>0))continue;
      if((k.movements||[]).some(v=>v.batchId===BATCH))continue;
      const first=firstPaymentDate(k);
      const uncertain=/congelad|congelamento|suspenso|sem juros/i.test([cl.notes,k.notes,k.legacyRaw,k.legacyStatus].filter(Boolean).join(' '))||k.frozen||k.interestFrozen||k.suspended||!['interest','percent'].includes(k.billingType)||!first||!contractStartDate(k)||
        !Number.isInteger(Number(k.baseDueDay))||Number(k.baseDueDay)<1||Number(k.baseDueDay)>31||
        (k.movements||[]).some(v=>String(v.date||'')>DATE)||
        (k.payments||[]).some(v=>String(v.paidAt||v.date||'').slice(0,10)>DATE);
      if(uncertain){skipped.push({clientId:cl.id,contractId:k.id,reason:'Conferir modalidade, datas, congelamento ou movimentos posteriores à data-base.'});continue;}
      const from=first.getFullYear()*12+first.getMonth(),to=2026*12+10;
      if(to-from>1200){skipped.push({clientId:cl.id,contractId:k.id,reason:'Histórico acima do limite de cálculo.'});continue;}
      let total=0;const snapshots={};
      for(let i=from;i<=to;i++){
        const q=chargeFor(cl,k,Math.floor(i/12),i%12,DATE);
        if(q.status==='not_due'||!q.due||ymd(q.due)>=DATE)continue;
        const incorporated=cents(q.remaining);
        snapshots[q.ref]={date:DATE,due:ymd(q.due),originalDue:ymd(q.originalDue||q.due),incorporated:incorporated/100,
          quote:{amount:q.amount,baseAmount:q.baseAmount,lateInterest:q.lateInterest,lateDays:q.lateDays,paid:q.paid,status:q.status}};
        total+=incorporated;
      }
      if(total>0)entries.push({cl,k,amount:total/100,before:contractBalance(k),snapshots});
    }
    return {entries,skipped};
  }
  function apply(){
    if(todayISO()<DATE||state.capitalizationBatches?.[BATCH])return null;
    const {entries,skipped}=plan(),previous=clone(state);
    // Cópia integral persistida antes da primeira alteração; falha de espaço impede a operação.
    const recoveryKey='credigestor_recovery_'+BATCH;
    if(!localStorage.getItem(recoveryKey))localStorage.setItem(recoveryKey,JSON.stringify(previous));
    try{
      for(const {k,amount,before,snapshots} of entries){
        k.capitalizedCharges={...k.capitalizedCharges,...snapshots};
        k.movements=k.movements||[];
        k.movements.push({id:BATCH+'_'+k.id,batchId:BATCH,type:'increase',kind:'interest_capitalization',nonCash:true,
          amount,date:DATE,balanceBefore:before,balanceAfter:(cents(before)+cents(amount))/100,
          note:'Juros vencidos e proporcionais incorporados ao capital em 09/11/2026. Sem recebimento ou nova liberação.',createdAt:new Date().toISOString()});
        k.currentPrincipal=contractBalance(k);k.lastBalanceUpdate=DATE;k.updatedAt=new Date().toISOString();
      }
      const summary={date:DATE,contracts:entries.length,total:entries.reduce((s,v)=>s+cents(v.amount),0)/100,skipped};
      state.capitalizationBatches={...state.capitalizationBatches,[BATCH]:summary};
      saveState();render();return summary;
    }catch(error){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,previous);throw error;}
  }
  window.CrediGestorCapitalization={plan,apply,batchId:BATCH};
})();
