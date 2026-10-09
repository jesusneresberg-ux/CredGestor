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
    return clone(value);
  }
  function parseBackup(raw,defaults={settings:{},goals:{monthlyReceipt:0,maxDelinquency:10}}){
    let value;
    try{value=JSON.parse(String(raw).replace(/^\uFEFF/,''));}catch(_){throw Error('Não foi possível ler este JSON. Selecione o arquivo de backup exportado pelo CrediGestor.');}
    if(!Array.isArray(value?.clients)&&Array.isArray(value?.state?.clients))value=value.state;
    if(!value||!Array.isArray(value.clients))throw Error('Este arquivo não contém uma carteira do CrediGestor (lista de clientes).');
    // Validate before merging so forbidden keys cannot be discarded or applied.
    validate({...value,settings:value.settings??{},goals:value.goals??{}});
    return validate({...value,settings:{...defaults.settings,...value.settings},goals:{...defaults.goals,...value.goals}});
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
    const stageError=(error,stage)=>{if(error.code==='permission-denied')error.message='O Firebase recusou '+stage+'. Seu rascunho foi preservado. Código: permission-denied.';return error;};
    const encoded=JSON.stringify(snapshot);
    let storage=null;
    guard();const before=await ref.get({source:'server'});guard();
    if(before.data()?.revision!==expected)throw Object.assign(Error('Outra sessão alterou a carteira. Recarregue antes de salvar.'),{code:'conflict'});
    if(before.data()?.storage||snapshot.clients.length>2000||Object.keys(applied).length>4000||new TextEncoder().encode(encoded).length>600000){
      const generation=writerId,parts=[];
      // Conservative UTF-16 slices keep even four-byte Unicode well below 1 MiB.
      for(let i=0;i<encoded.length;){let end=Math.min(i+100000,encoded.length);if(end<encoded.length&&encoded.charCodeAt(end-1)>=0xD800&&encoded.charCodeAt(end-1)<=0xDBFF)end--;parts.push(encoded.slice(i,end));i=end;}
      const digest=await hash(encoded),settingsDigest=await hash(stable(snapshot.settings));
      for(let offset=0;offset<parts.length;offset+=4){guard();await Promise.all(parts.slice(offset,offset+4).map((text,j)=>ref.parent.parent.collection('walletChunks').doc(generation+'_'+(offset+j)).set({generation,index:offset+j,text,createdBy:uid,createdAt:stamp()}))).catch(error=>{throw stageError(error,'a gravação das partes da carteira');});}
      for(const client of snapshot.clients)for(const contract of client.contracts||[]){
        guard();await ref.parent.parent.collection('walletContracts').doc(generation+'_'+client.id+'__'+contract.id).set({generation,clientId:client.id,contractId:contract.id,active:contract.active!==false,closed:!!contract.closed,createdBy:uid,createdAt:stamp()}).catch(error=>{throw stageError(error,'o cadastro de contratos da carteira');});
      }
      storage={generation,count:parts.length,digest,settingsDigest};
    }
    const conflict=()=>Object.assign(Error('Outra sessão alterou a carteira. Seu rascunho foi preservado. Baixe-o e carregue a versão da nuvem antes de reaplicar a alteração.'),{code:'conflict'});
    try{return await db.runTransaction(async tx=>{
      guard();const current=await tx.get(ref);guard();
      if(!current.exists||current.data().revision!==expected)throw conflict();
      const data={schemaVersion:261,state:storage?{clients:[],settings:{},goals:{}}:snapshot,revision:expected+1,appliedEvents:storage?{}:clone(applied),updatedBy:uid,updatedAt:stamp(),writerId};
      if(storage)data.storage=storage;
      tx.set(ref,data);
      return expected+1;
    });}catch(error){
      guard();
      // The revision rule can reject a competing commit before the SDK retries the transaction.
      if(['permission-denied','aborted'].includes(error.code)){
        let current;try{current=await ref.get({source:'server'});}catch(_){throw error;}
        guard();if(current.exists&&current.data().revision!==expected)throw conflict();
      }
      throw stageError(error,'a confirmação final da carteira');
    }
  }
  async function hash(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function hydrate(ref,doc,guard=()=>{}){
    if(!doc.storage)return doc;
    const parts=[];
    for(let offset=0;offset<doc.storage.count;offset+=4){guard();const group=await Promise.all(Array.from({length:Math.min(4,doc.storage.count-offset)},(_,j)=>ref.parent.parent.collection('walletChunks').doc(doc.storage.generation+'_'+(offset+j)).get({source:'server'})));guard();for(const part of group){if(!part.exists)throw Error('Carteira incompleta na nuvem. Nenhum dado foi substituído.');parts.push(part.data().text);}}
    const raw=parts.join('');if(await hash(raw)!==doc.storage.digest)throw Error('Falha na integridade da carteira. Nenhum dado foi substituído.');
    const state=validate(JSON.parse(raw));if(await hash(stable(state.settings))!==doc.storage.settingsDigest)throw Error('Configurações divergentes. Nenhum dado foi substituído.');
    return {...doc,state};
  }
  root.CrediGestorCore=Object.freeze({clone,stable,validate,parseBackup,materialize,commit,hash,hydrate});
})(typeof window!=='undefined'?window:globalThis);
