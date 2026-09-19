// CrediGestor v26 - camada de dados multiempresa no Cloud Firestore.
(function(){
  'use strict';
  const LOCAL_KEY='credigestor_v1';
  const BACKUP_PREFIX='credigestor_backup_before_v26_';
  let db=null,user=null,workspace=null,role=null,connected=false,localMode=false;
  let lastCloudState=null,pushTimer=null,appUnsub=null,paymentsUnsub=null,applyingRemote=false;

  const copy=value=>JSON.parse(JSON.stringify(value));
  const nowStamp=()=>firebase.firestore.FieldValue.serverTimestamp();
  const orgRef=id=>db.collection('organizations').doc(id);

  function publicSession(){
    return {connected,localMode,user:user?{uid:user.uid,email:user.email,displayName:user.displayName,photoURL:user.photoURL}:null,organizationId:workspace?.organizationId||'',organizationName:workspace?.organizationName||'',role:role||'',lastSyncAt:workspace?.lastSyncAt||''};
  }
  function notify(){window.dispatchEvent(new CustomEvent('credigestor:v26-session',{detail:publicSession()}));}
  function setLocalMode(value=true){localMode=!!value;connected=false;notify();}

  async function ensureWorkspace(firebaseUser){
    const userRef=db.collection('users').doc(firebaseUser.uid);
    let snap=await userRef.get();
    if(snap.exists){
      const data=snap.data();
      if(data.active===false)throw new Error('Este acesso foi desativado pelo administrador.');
      return data;
    }
    const email=(firebaseUser.email||'').trim().toLowerCase();
    const invitationRef=db.collection('invitations').doc(email);
    const invitation= email ? await invitationRef.get() : null;
    if(invitation?.exists && invitation.data().active!==false){
      const invite=invitation.data();
      const memberRef=orgRef(invite.organizationId).collection('members').doc(firebaseUser.uid);
      const batch=db.batch();
      batch.set(userRef,{organizationId:invite.organizationId,organizationName:invite.organizationName||'Organização',name:firebaseUser.displayName||email,email,role:invite.role||'consulta',active:true,createdAt:nowStamp()});
      batch.set(memberRef,{uid:firebaseUser.uid,name:firebaseUser.displayName||email,email,role:invite.role||'consulta',active:true,joinedAt:nowStamp()});
      batch.delete(invitationRef);
      await batch.commit();
      snap=await userRef.get();
      return snap.data();
    }
    const organizationId=`org_${firebaseUser.uid}`;
    const organizationName=`Organização de ${firebaseUser.displayName||email||'Administrador'}`;
    const batch=db.batch();
    batch.set(orgRef(organizationId),{name:organizationName,ownerUid:firebaseUser.uid,plan:'inicial',active:true,createdAt:nowStamp()});
    batch.set(orgRef(organizationId).collection('members').doc(firebaseUser.uid),{uid:firebaseUser.uid,name:firebaseUser.displayName||email,email,role:'administrador',active:true,joinedAt:nowStamp()});
    batch.set(userRef,{organizationId,organizationName,name:firebaseUser.displayName||email,email,role:'administrador',active:true,createdAt:nowStamp()});
    await batch.commit();
    return (await userRef.get()).data();
  }

  function makeMigrationBackup(){
    const raw=localStorage.getItem(LOCAL_KEY);
    if(!raw)return '';
    const key=BACKUP_PREFIX+new Date().toISOString().replace(/[:.]/g,'-');
    localStorage.setItem(key,raw);
    localStorage.setItem('credigestor_v26_last_backup_key',key);
    return key;
  }
  function applyState(next,{renderApp=true}={}){
    if(!next||typeof next!=='object')return;
    applyingRemote=true;
    Object.keys(state).forEach(k=>delete state[k]);
    Object.assign(state,defaultState(),copy(next));
    localStorage.setItem(LOCAL_KEY,JSON.stringify(state));
    lastCloudState=copy(state);
    applyingRemote=false;
    applySettings();
    if(renderApp&&typeof render==='function')render();
  }
  function strippedForCollector(value){
    const out=copy(value);
    (out.clients||[]).forEach(client=>(client.contracts||[]).forEach(contract=>{contract.payments=[];}));
    return out;
  }
  function paymentOnlyChange(before,after){
    if(!before)return false;
    return JSON.stringify(strippedForCollector(before))===JSON.stringify(strippedForCollector(after));
  }
  function collectPaymentChanges(before,after){
    const oldMap=new Map();
    (before?.clients||[]).forEach(c=>(c.contracts||[]).forEach(k=>(k.payments||[]).forEach(p=>oldMap.set(`${c.id}|${k.id}|${p.id||p.reference}`,JSON.stringify(p)))));
    const changes=[];
    (after?.clients||[]).forEach(c=>(c.contracts||[]).forEach(k=>(k.payments||[]).forEach(p=>{
      const key=`${c.id}|${k.id}|${p.id||p.reference}`;
      if(oldMap.get(key)!==JSON.stringify(p))changes.push({clientId:c.id,contractId:k.id,payment:copy(p)});
    })));
    return changes;
  }
  function canSave(next){
    if(localMode||!connected||applyingRemote)return true;
    if(role==='administrador'||role==='gerente')return true;
    if(role==='cobrador')return paymentOnlyChange(lastCloudState,next);
    return false;
  }
  function rejectChange(){
    const label=role==='consulta'?'Consulta':'Cobrador';
    setTimeout(()=>{if(lastCloudState)applyState(lastCloudState);alert(`${label}: seu perfil não permite esta alteração.`);},0);
  }
  async function pushState(snapshot){
    if(!connected||localMode||applyingRemote)return;
    if(role==='cobrador'){
      const changes=collectPaymentChanges(lastCloudState,snapshot);
      for(const change of changes){
        await orgRef(workspace.organizationId).collection('paymentEvents').add({...change,createdBy:user.uid,createdByName:user.displayName||user.email||'',createdAt:nowStamp()});
      }
      lastCloudState=copy(snapshot);workspace.lastSyncAt=new Date().toISOString();notify();return;
    }
    if(role!=='administrador'&&role!=='gerente')return;
    await orgRef(workspace.organizationId).collection('appData').doc('main').set({schemaVersion:26,state:copy(snapshot),updatedBy:user.uid,updatedAt:nowStamp()});
    lastCloudState=copy(snapshot);workspace.lastSyncAt=new Date().toISOString();notify();
  }
  function schedulePush(next){
    if(!connected||localMode||applyingRemote)return;
    clearTimeout(pushTimer);
    const snapshot=copy(next);
    pushTimer=setTimeout(()=>pushState(snapshot).catch(error=>{console.error('[CrediGestor v26]',error);alert('A alteração ficou salva neste aparelho, mas não foi sincronizada. Verifique a internet e tente novamente.');}),650);
  }
  function applyPaymentEvent(event){
    const client=state.clients.find(x=>x.id===event.clientId);if(!client)return false;
    const contract=(client.contracts||[]).find(x=>x.id===event.contractId);if(!contract)return false;
    contract.payments=contract.payments||[];
    const p=event.payment||{};const existing=contract.payments.find(x=>(p.id&&x.id===p.id)||(!p.id&&x.reference===p.reference));
    if(existing)Object.assign(existing,p);else contract.payments.push(copy(p));
    localStorage.setItem(LOCAL_KEY,JSON.stringify(state));lastCloudState=copy(state);return true;
  }
  function subscribe(){
    const root=orgRef(workspace.organizationId);
    appUnsub?.();paymentsUnsub?.();
    appUnsub=root.collection('appData').doc('main').onSnapshot(snap=>{
      if(!snap.exists)return;const data=snap.data();
      if(data.updatedBy===user.uid&&lastCloudState)return;
      applyState(data.state);workspace.lastSyncAt=new Date().toISOString();notify();
    },error=>console.error('[CrediGestor v26 snapshot]',error));
    paymentsUnsub=root.collection('paymentEvents').onSnapshot(snap=>{
      let changed=false;snap.docChanges().forEach(change=>{if(change.type==='added')changed=applyPaymentEvent(change.doc.data())||changed;});
      if(changed){if(typeof render==='function')render();if(role==='administrador'||role==='gerente')schedulePush(state);}
    },error=>console.error('[CrediGestor v26 payments]',error));
  }
  async function connect(firebaseUser){
    user=firebaseUser;localMode=false;db=firebase.firestore();
    try{await db.enablePersistence({synchronizeTabs:true});}catch(error){if(error.code!=='failed-precondition'&&error.code!=='unimplemented')console.warn(error);}
    workspace=await ensureWorkspace(firebaseUser);role=workspace.role||'consulta';
    const mainRef=orgRef(workspace.organizationId).collection('appData').doc('main');
    const main=await mainRef.get();
    if(main.exists)applyState(main.data().state);
    else if(role==='administrador'||role==='gerente'){
      const backupKey=makeMigrationBackup();
      await mainRef.set({schemaVersion:26,state:copy(state),migratedFromLocalStorage:!!backupKey,migrationBackupKey:backupKey,updatedBy:user.uid,updatedAt:nowStamp()});
      lastCloudState=copy(state);
    }else lastCloudState=copy(state);
    connected=true;subscribe();notify();return publicSession();
  }
  function disconnect(){clearTimeout(pushTimer);appUnsub?.();paymentsUnsub?.();appUnsub=null;paymentsUnsub=null;connected=false;user=null;workspace=null;role=null;notify();}
  async function createInvitation(email,newRole){
    if(role!=='administrador')throw new Error('Somente o Administrador pode convidar usuários.');
    const normalized=String(email||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))throw new Error('Informe um e-mail válido.');
    if(!['gerente','cobrador','consulta'].includes(newRole))throw new Error('Perfil inválido.');
    await db.collection('invitations').doc(normalized).set({email:normalized,organizationId:workspace.organizationId,organizationName:workspace.organizationName||'',role:newRole,active:true,invitedBy:user.uid,createdAt:nowStamp()});
  }
  async function listMembers(){
    if(!connected)return[];
    const snap=await orgRef(workspace.organizationId).collection('members').get();return snap.docs.map(d=>({id:d.id,...d.data()}));
  }
  async function setMemberRole(uid,newRole){
    if(role!=='administrador')throw new Error('Somente o Administrador pode alterar perfis.');
    if(!['administrador','gerente','cobrador','consulta'].includes(newRole))throw new Error('Perfil inválido.');
    const memberRef=orgRef(workspace.organizationId).collection('members').doc(uid);const member=await memberRef.get();if(!member.exists)throw new Error('Usuário não encontrado.');
    const batch=db.batch();batch.update(memberRef,{role:newRole});batch.update(db.collection('users').doc(uid),{role:newRole});await batch.commit();
  }
  function downloadSafetyBackup(){
    const key=localStorage.getItem('credigestor_v26_last_backup_key');const raw=(key&&localStorage.getItem(key))||localStorage.getItem(LOCAL_KEY);if(!raw)return false;
    const blob=new Blob([raw],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`credigestor-backup-seguranca-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true;
  }
  window.CrediGestorCloud={connect,disconnect,setLocalMode,canSave,rejectChange,schedulePush,createInvitation,listMembers,setMemberRole,downloadSafetyBackup,session:publicSession};
})();
