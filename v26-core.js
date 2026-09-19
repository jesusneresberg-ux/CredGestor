(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  function stable(x){
    if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
    if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
    return JSON.stringify(x);
  }
  function validate(value){
    if(!value || !Array.isArray(value.clients) || !value.settings || !value.goals)throw Error('Backup sem estrutura válida.');
    function walk(x,depth=0){
      if(depth>30)throw Error('Dados muito profundos.');
      if(typeof x==='number'&&!Number.isFinite(x))throw Error('Valor numérico inválido.');
      if(x&&typeof x==='object')for(const k of Object.keys(x)){
        if(['__proto__','prototype','constructor'].includes(k))throw Error('Campo não permitido no backup.');
        walk(x[k],depth+1);
      }
    }
    walk(value);
    if(new TextEncoder().encode(JSON.stringify(value)).length>800000)throw Error('Esta carteira ultrapassa 800 KB. O original foi preservado. É necessário ampliar o armazenamento antes de migrar.');
    if(value.clients.length>2000)throw Error('Limite de clientes desta versão excedido.');
    return clone(value);
  }
  function materialize(doc,events){
    const next=clone(doc.state),applied={...doc.appliedEvents},warnings=[];
    for(const [eventId,event] of [...events].sort((a,b)=>a[0].localeCompare(b[0]))){
      if(applied[eventId])continue;
      const c=next.clients.find(c=>c.id===event.clientId),k=c?.contracts?.find(k=>k.id===event.contractId);
      if(!k)continue;
      k.payments=k.payments||[];
      const existing=k.payments.find(p=>p.reference===event.payment.reference);
      if(existing&&existing.id!==event.payment.id&&['amount','paidAt','method','type','note'].some(key=>(existing[key]||'')!==(event.payment[key]||''))){
        warnings.push({eventId,clientId:event.clientId,contractId:event.contractId,existing:clone(existing),receipt:clone(event.payment)});continue;
      }
      if(!existing)k.payments.push(clone(event.payment));
      applied[eventId]=true;
    }
    return {state:next,appliedEvents:applied,warnings};
  }
  async function commit(db,ref,expected,next,applied,uid,writerId,stamp,guard=()=>{}){
    const snapshot=validate(next);
    const conflict=()=>Object.assign(Error('Outra sessão alterou a carteira. Seu rascunho foi preservado. Baixe-o e carregue a versão da nuvem antes de reaplicar a alteração.'),{code:'conflict'});
    try{return await db.runTransaction(async tx=>{
      guard();const current=await tx.get(ref);guard();
      if(!current.exists||current.data().revision!==expected)throw conflict();
      tx.set(ref,{schemaVersion:261,state:snapshot,revision:expected+1,appliedEvents:clone(applied),updatedBy:uid,updatedAt:stamp(),writerId});
      return expected+1;
    });}catch(error){
      guard();
      // The revision rule can reject a competing commit before the SDK retries the transaction.
      if(['permission-denied','aborted'].includes(error.code)){
        let current;try{current=await ref.get({source:'server'});}catch(_){throw error;}
        guard();if(current.exists&&current.data().revision!==expected)throw conflict();
      }
      throw error;
    }
  }
  root.CrediGestorCore=Object.freeze({clone,stable,validate,materialize,commit});
})(typeof window!=='undefined'?window:globalThis);
