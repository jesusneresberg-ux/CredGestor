/* Compatibilidade histórica e estorno da atualização automática, sem registrar recebimentos. */
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
  // Mantém o histórico já incorporado, sem executar novas capitalizações.
  function plan(){return {entries:[],skipped:[]};}
  function apply(){return null;}
  function reverseAutomatic(){
    const reversalId='estorno-'+BATCH;
    if(state.automaticInterestReversals?.[reversalId])return null;
    const previous=clone(state),entries=[];
    for(const cl of state.clients||[])for(const k of cl.contracts||[]){
      const movements=(k.movements||[]).filter(v=>v.batchId===BATCH&&v.kind==='interest_capitalization');
      if(movements.length)entries.push({cl,k,movements});
    }
    if(!entries.length)return null;
    // Cópia antes de remover apenas movimentos identificados da atualização.
    const recoveryKey='credigestor_recovery_'+reversalId;
    if(!localStorage.getItem(recoveryKey))localStorage.setItem(recoveryKey,JSON.stringify(previous));
    try{
      let total=0;
      for(const {k,movements} of entries){
        k.movements=k.movements.filter(v=>!movements.includes(v));
        for(const [ref,snapshot] of Object.entries(k.capitalizedCharges||{}))if(snapshot.date===DATE)delete k.capitalizedCharges[ref];
        total+=movements.reduce((sum,v)=>sum+cents(v.amount),0);
        k.currentPrincipal=contractBalance(k);k.updatedAt=new Date().toISOString();
      }
      const summary={date:todayISO(),contracts:entries.length,total:total/100,
        removed:entries.map(({cl,k,movements})=>({clientId:cl.id,contractId:k.id,movements:clone(movements)}))};
      state.automaticInterestReversals={...state.automaticInterestReversals,[reversalId]:summary};
      saveState();render();return summary;
    }catch(error){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,previous);throw error;}
  }
  window.CrediGestorCapitalization={plan,apply,reverseAutomatic,batchId:BATCH};
})();
