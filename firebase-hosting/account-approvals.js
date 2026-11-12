(function(){
  'use strict';
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1';
  let stop=null,approvedUid=null;
  const valid=user=>!!user&&!user.isAnonymous&&(user.uid!==OWNER||user.emailVerified);
  const approved=user=>valid(user)&&(user.uid===OWNER||approvedUid===user.uid);
  function clear(){if(stop)stop();stop=null;approvedUid=null;}
  async function authorize(user,onChange){
    clear();if(!valid(user))return false;if(user.uid===OWNER)return true;
    const ref=firebase.firestore().collection('accountApprovals').doc(user.uid);
    let snap=await ref.get({source:'server'});
    if(!snap.exists){
      try{await ref.set({uid:user.uid,email:user.email||'',status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()});}
      catch(error){snap=await ref.get({source:'server'});if(!snap.exists)throw error;}
      snap=await ref.get({source:'server'});
    }
    if(firebase.auth().currentUser?.uid!==user.uid)return false;
    let status=snap.data()?.status||'pending';approvedUid=status==='approved'?user.uid:null;
    stop=ref.onSnapshot({includeMetadataChanges:true},next=>{
      if(next.metadata.fromCache||firebase.auth().currentUser?.uid!==user.uid)return;
      const nextStatus=next.data()?.status||'pending';
      approvedUid=nextStatus==='approved'?user.uid:null;
      if(nextStatus!==status){status=nextStatus;onChange(status);}
    },()=>{approvedUid=null;onChange('unavailable');});
    return status;
  }
  async function renderAdmin(container){
    if(firebase.auth().currentUser?.uid!==OWNER)return;
    const section=document.createElement('section');
    section.innerHTML='<h3>Aprovação de contas</h3><p>Novas contas aguardam sua aprovação para entrar no app.</p><button type="button" id="reloadApprovals">Atualizar lista</button><p role="status" id="approvalAdminMessage"></p><div id="approvalList"></div>';
    container.append(section);
    const message=section.querySelector('#approvalAdminMessage'),list=section.querySelector('#approvalList');
    async function load(){
      message.textContent='Carregando solicitações…';list.replaceChildren();
      try{
        if(firebase.auth().currentUser?.uid!==OWNER)return;
        const result=await firebase.firestore().collection('accountApprovals').limit(200).get({source:'server'});
        if(firebase.auth().currentUser?.uid!==OWNER)return;
        const labels={pending:'Aguardando aprovação',approved:'Aprovada',rejected:'Recusada',blocked:'Bloqueada'};
        const docs=[...result.docs].sort((a,b)=>(a.data().status==='pending'?-1:1)-(b.data().status==='pending'?-1:1));
        for(const doc of docs){
          const data=doc.data(),row=document.createElement('div');row.className='card';
          const title=document.createElement('strong');title.textContent=data.email||doc.id;row.append(title);
          const status=document.createElement('p');status.textContent=labels[data.status]||'Pendente';row.append(status);
          for(const [value,label] of [['approved','Aprovar'],['rejected','Recusar'],['blocked','Bloquear']]){
            const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=data.status===value;
            button.onclick=async()=>{
              if(firebase.auth().currentUser?.uid!==OWNER)return;
              row.querySelectorAll('button').forEach(b=>b.disabled=true);
              try{await doc.ref.update({status:value,reviewedBy:OWNER,reviewedAt:firebase.firestore.FieldValue.serverTimestamp()});await load();}
              catch(_){message.textContent='Não foi possível alterar a aprovação. Atualize a lista e tente novamente.';row.querySelectorAll('button').forEach(b=>b.disabled=false);}
            };row.append(button);
          }list.append(row);
        }
        message.textContent=result.empty?'Nenhuma solicitação de conta.':result.size===200?'Exibindo até 200 contas.':`${result.size} conta(s).`;
      }catch(_){message.textContent='Não foi possível carregar as solicitações. Confira a conexão e tente novamente.';}
    }
    section.querySelector('#reloadApprovals').onclick=load;await load();
  }
  window.CrediGestorApprovals={valid,approved,authorize,clear,renderAdmin};
})();
