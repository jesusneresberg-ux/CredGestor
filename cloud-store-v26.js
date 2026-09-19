(function(){
  'use strict';
  const C=window.CrediGestorCore,LEGACY='credigestor_v1';
  let generation=0,ctx=null,mode='locked',base=null,visible=null,events=new Map(),applied={};
  let pending=null,timer=null,busy=false,lastError='',unsubs=[],latest=null,receiptWarnings=[];
  const copy=C.clone,stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
  const random=()=>crypto.randomUUID();
  function draftKey(c=ctx){return c?`credigestor_v261_draft:${c.uid}:${c.org}`:'';}
  function storedDrafts(){
    if(!ctx)return [];const prefix=draftKey(),keys=[];
    for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key===prefix||key.startsWith(prefix+':archive:'))keys.push(key);}
    return keys.map(key=>sessionStorage.getItem(key)).filter(Boolean);
  }
  function session(){let hasDraft=false;try{hasDraft=storedDrafts().length>0;}catch(_){}return {connected:!!ctx&&['ready','saving','conflict','error'].includes(mode),localMode:mode==='local',role:ctx?.role||'',organizationId:ctx?.org||'',organizationName:ctx?.name||'',owner:!!ctx&&ctx.owner===ctx.uid,user:ctx?.user||null,status:mode,error:lastError,hasDraft,receiptWarnings:receiptWarnings.length};}
  function notify(){window.dispatchEvent(new CustomEvent('credigestor:v26-session',{detail:session()}));}
  function guard(c){if(ctx!==c||c.generation!==generation)throw Object.assign(Error('A conta mudou. Esta operação foi cancelada.'),{code:'cancelled'});}
  function replace(next){
    Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),copy(next));
    applySettings();if(typeof render==='function')render();visible=copy(state);
  }
  function preserve(next,reason='draft'){
    if(!ctx)return;
    // A draft never uses the legacy key and is never automatically restored or uploaded.
    const previous=sessionStorage.getItem(draftKey());
    if(previous&&reason==='draft'&&JSON.parse(previous).reason!=='draft')sessionStorage.setItem(draftKey()+':archive:'+random(),previous);
    sessionStorage.setItem(draftKey(),JSON.stringify({uid:ctx.uid,organizationId:ctx.org,baseRevision:base?.revision??-1,reason,state:copy(next),savedAt:new Date().toISOString()}));
  }
  function fail(error){
    clearTimeout(timer);timer=null;
    if(error.code==='cancelled')return;
    mode=error.code==='conflict'?'conflict':'error';lastError=error.message;notify();
  }
  function disconnect(){
    ++generation;clearTimeout(timer);timer=null;
    unsubs.forEach(fn=>fn());unsubs=[];ctx=null;pending=null;busy=false;base=null;latest=null;
    events=new Map();applied={};receiptWarnings=[];mode='locked';lastError='';
    document.getElementById('modal')?.close();
    replace(defaultState());notify();
  }
  function setLocalMode(){
    if(window.CREDIGESTOR_FIREBASE_READY)throw Error('O modo local não está disponível com Firebase ativo.');
    disconnect();const raw=localStorage.getItem(LEGACY);mode='local';replace(raw?C.validate(JSON.parse(raw)):defaultState());notify();
  }
  async function ensureWorkspace(db,user,c){
    const address=user.email.toLowerCase(),profile=db.collection('users').doc(user.uid),invRef=db.collection('invitations').doc(address);
    await db.runTransaction(async tx=>{
      guard(c);const existing=await tx.get(profile);guard(c);if(existing.exists)return;
      const inv=await tx.get(invRef);guard(c);
      const data=inv.exists?inv.data():null;
      if(data && (data.acceptedBy||!data.active||data.expiresAt.toMillis()<=Date.now()))throw Error('Convite indisponível ou expirado. Solicite um novo acesso ao administrador.');
      const org=data?.organizationId||`org_${user.uid}`,root=db.collection('organizations').doc(org);
      const name=(user.displayName||address).slice(0,120),member=root.collection('members').doc(user.uid);
      if(!data)tx.set(root,{name:`Organização de ${name}`.slice(0,120),ownerUid:user.uid,plan:'inicial',active:true,createdAt:stamp()});
      tx.set(profile,{organizationId:org,name,email:address,createdAt:stamp()});
      tx.set(member,{uid:user.uid,name,email:address,role:data?.role||'administrador',active:true,joinedAt:stamp()});
      if(data)tx.update(invRef,{acceptedBy:user.uid,acceptedAt:stamp()});
    });
    guard(c);const p=await profile.get({source:'server'});guard(c);return p.data();
  }
  function acceptRemote(doc){
    if(!doc || doc.schemaVersion!==261){fail(Error('Formato de nuvem incompatível. Nenhum dado local foi substituído.'));return;}
    if(base&&doc.revision<base.revision)return;
    latest=doc;
    if(pending||busy||mode==='conflict'||mode==='error')return;
    // Do not replace objects referenced by an open editing form.
    if(document.getElementById('modal')?.open){notify();return;}
    base=doc;const projection=C.materialize(base,events);applied=projection.appliedEvents;receiptWarnings=projection.warnings;replace(projection.state);notify();
  }
  async function connect(user){
    disconnect();if(!user.emailVerified||!user.email)throw Error('Entre com uma Conta Google com e-mail verificado.');
    const c={generation,uid:user.uid,user:{uid:user.uid,email:user.email,displayName:user.displayName||'',photoURL:user.photoURL||''}};
    ctx=c;mode='connecting';notify();const db=firebase.firestore();c.db=db;
    try{
      const profile=await ensureWorkspace(db,user,c);guard(c);c.org=profile.organizationId;
      c.root=db.collection('organizations').doc(c.org);c.ref=c.root.collection('appData').doc('main');
      const member=await c.root.collection('members').doc(c.uid).get({source:'server'});guard(c);
      if(!member.exists||!member.data().active)throw Error('Acesso desativado. Fale com o administrador.');
      c.role=member.data().role;const org=await c.root.get({source:'server'});guard(c);c.name=org.data().name;c.owner=org.data().ownerUid;
      await db.runTransaction(async tx=>{
        guard(c);const main=await tx.get(c.ref);guard(c);
        if(!main.exists){if(c.role!=='administrador')throw Error('O administrador precisa abrir a organização primeiro.');
          tx.set(c.ref,{schemaVersion:261,state:C.validate(state),revision:0,appliedEvents:{},updatedBy:c.uid,writerId:random(),updatedAt:stamp()});}
      });
      guard(c);const initial=await c.ref.get({source:'server'});guard(c);
      if(initial.data().schemaVersion!==261)throw Error('A nuvem contém dados de outra versão. Faça backup e solicite migração assistida.');
      base=initial.data();latest=base;mode='ready';acceptRemote(base);
      // Firestore persistence is deliberately not enabled: no cross-account disk cache.
      unsubs.push(c.ref.onSnapshot(snap=>{if(ctx!==c||snap.metadata.hasPendingWrites||!snap.exists)return;acceptRemote(snap.data());},e=>{if(ctx===c){disconnect();fail(e);}}));
      unsubs.push(c.root.collection('paymentEvents').onSnapshot(snap=>{
        if(ctx!==c)return;events=new Map(snap.docs.filter(d=>!d.metadata.hasPendingWrites).map(d=>[d.id,d.data()]));
        if(!pending&&!busy&&mode==='ready')acceptRemote(latest||base);
      },e=>{if(ctx===c){disconnect();fail(e);}}));
      unsubs.push(c.root.collection('members').doc(c.uid).onSnapshot({includeMetadataChanges:true},async snap=>{
        if(ctx!==c||snap.metadata.hasPendingWrites||snap.metadata.fromCache)return;
        try{
          // A local rejected delete may emit a missing cache snapshot. Confirm ACL changes on the server.
          if(!snap.exists||!snap.data().active||c.role!==snap.data().role){
            const confirmed=await c.root.collection('members').doc(c.uid).get({source:'server'});if(ctx!==c)return;
            if(!confirmed.exists||!confirmed.data().active){disconnect();lastError='Acesso desativado pelo administrador.';notify();return;}
            if(c.role!==confirmed.data().role){c.role=confirmed.data().role;if(pending||busy)fail(Error('Seu perfil foi alterado. Recarregue os dados.'));notify();}
          }
        }catch(e){if(ctx===c){disconnect();fail(e);}}
      },e=>{if(ctx===c){disconnect();fail(e);}}));
      notify();return session();
    }catch(e){if(ctx===c)disconnect();throw e;}
  }
  function save(next){
    if(mode==='local'){C.validate(next);localStorage.setItem(LEGACY,JSON.stringify(next));visible=copy(next);return true;}
    if(!ctx||!['ready','saving'].includes(mode)||busy)throw Error('Aguarde a sincronização ou resolva o aviso em Minha conta antes de alterar dados.');
    if(!['administrador','gerente'].includes(ctx.role))throw Error('Seu perfil não permite alterar a carteira. Cobradores registram parcelas em Minha conta.');
    C.validate(next);
    if(ctx.role==='gerente'&&C.stable(next.settings)!==C.stable(base.state.settings))throw Error('Somente o Administrador altera as configurações.');
    preserve(next);pending=copy(next);mode='saving';clearTimeout(timer);
    timer=setTimeout(()=>flush().catch(()=>{}),120);notify();return true;
  }
  function rollback(){if(visible)replace(visible);}
  async function flush(){
    if(!pending||busy)return;
    const c=ctx,desired=pending,expected=base.revision,receiptIds=copy(applied),writerId=random();
    pending=null;busy=true;clearTimeout(timer);
    try{
      const revision=await C.commit(c.db,c.ref,expected,desired,receiptIds,c.uid,writerId,stamp,()=>guard(c));guard(c);
      base={schemaVersion:261,state:copy(desired),revision,appliedEvents:receiptIds,writerId,updatedBy:c.uid};
      sessionStorage.removeItem(draftKey(c));mode='ready';busy=false;
      if(latest?.revision>revision)acceptRemote(latest);else {latest=base;acceptRemote(base);}notify();
    }catch(e){if(ctx===c){busy=false;try{preserve(desired,e.code||'error');}catch(_){e.message+=' Baixe o rascunho existente antes de fechar.';}fail(e);}throw e;}
  }
  async function reloadCloud(){
    if(!ctx)throw Error('Entre novamente.');if(busy)throw Error('Aguarde a gravação atual.');
    const c=ctx;clearTimeout(timer);pending=null;const snap=await c.ref.get({source:'server'});guard(c);
    document.getElementById('modal')?.close();mode='ready';lastError='';acceptRemote(snap.data());notify();
  }
  function download(raw,filename){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function downloadDraft(){const drafts=storedDrafts();if(!drafts.length)throw Error('Nenhum rascunho pendente nesta conta.');download(JSON.stringify({format:'credigestor-recovery-v261',drafts:drafts.map(JSON.parse)},null,2),'credigestor-rascunho-recuperacao.json');}
  function downloadReceiptWarnings(){if(!ctx)throw Error('Entre novamente.');download(JSON.stringify({organizationId:ctx.org,divergences:receiptWarnings},null,2),'credigestor-recebimentos-divergentes.json');}
  function legacyBackup(){const raw=localStorage.getItem(LEGACY);if(!raw)throw Error('Não há dados antigos neste navegador. Importe o backup JSON do aparelho original.');download(raw,'credigestor-backup-antes-v261.json');return raw;}
  async function migrate(raw,confirmed){
    const c=ctx;if(!c||c.uid!==c.owner||c.role!=='administrador')throw Error('Somente o proprietário pode migrar a carteira.');
    if(confirmed!==true)throw Error('Confirme a organização de destino e salve o backup antes de migrar.');
    guard(c);const source=C.validate(JSON.parse(raw));
    // Only a deliberately selected JSON source is accepted. No automatic migration.
    if(base.revision!==0||base.state.clients.length)throw Error('A organização já contém alterações. A migração automática foi bloqueada para preservar os dois conjuntos.');
    const backupKey=`credigestor_v261_migration:${c.uid}:${c.org}:${random()}`;
    localStorage.setItem(backupKey,raw); // Quota failure aborts before a cloud write.
    save(source);await flush();guard(c);return true;
  }
  async function createInvitation(address,newRole){
    const c=ctx;if(!c||c.role!=='administrador')throw Error('Somente o Administrador cria convites.');
    address=String(address).trim().toLowerCase();if(!/^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(address)||address.length>254)throw Error('E-mail inválido.');
    if(!['gerente','cobrador','consulta'].includes(newRole))throw Error('Perfil inválido.');
    await c.db.collection('invitations').doc(address).set({email:address,organizationId:c.org,organizationName:c.name,role:newRole,active:true,invitedBy:c.uid,createdAt:stamp(),expiresAt:firebase.firestore.Timestamp.fromMillis(Date.now()+6*86400000),acceptedBy:'',acceptedAt:null});guard(c);
  }
  async function listMembers(){const c=ctx;if(!c||c.role!=='administrador')throw Error('Acesso restrito ao Administrador.');const result=await c.root.collection('members').get({source:'server'});guard(c);return result.docs.map(d=>d.data());}
  async function setMember(uid,role,active){const c=ctx;if(!c||c.role!=='administrador'||uid===c.uid||uid===c.owner)throw Error('Não é permitido alterar esse usuário.');await c.root.collection('members').doc(uid).update({role,active});guard(c);}
  async function recordReceipt(clientId,contractId,input){
    const c=ctx;if(!c||!['administrador','gerente','cobrador'].includes(c.role))throw Error('Seu perfil não registra pagamentos.');
    if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(input.reference)||!Number.isFinite(input.amount)||input.amount<=0||input.amount>1e9)throw Error('Confira referência e valor.');
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.paidAt)||new Date(input.paidAt+'T12:00:00Z').toISOString().slice(0,10)!==input.paidAt)throw Error('Data inválida.');
    const eventId=`${clientId}__${contractId}__${input.reference}`,ref=c.root.collection('paymentEvents').doc(eventId);
    await c.db.runTransaction(async tx=>{
      guard(c);const main=await tx.get(c.ref),existing=await tx.get(ref);guard(c);
      if(existing.exists)throw Error('Esta parcela já tem um registro. Peça a correção ao gerente.');
      const clients=main.data().state.clients,ci=clients.findIndex(x=>x.id===clientId),ki=clients[ci]?.contracts?.findIndex(x=>x.id===contractId);
      const contract=clients[ci]?.contracts?.[ki];if(!contract||contract.active===false||contract.closed)throw Error('Contrato indisponível.');
      if(contract.payments?.some(p=>p.reference===input.reference))throw Error('Esta parcela já foi registrada.');
      const payment={id:eventId,reference:input.reference,amount:input.amount,paidAt:input.paidAt,method:input.method,note:input.note||'',status:'paid',type:'installment'};
      tx.set(ref,{clientId,contractId,clientIndex:ci,contractIndex:ki,payment,createdBy:c.uid,createdAt:stamp()});
    });guard(c);
  }
  document.getElementById('modal')?.addEventListener('close',()=>{if(ctx&&mode==='ready'&&latest)acceptRemote(latest);});
  window.CrediGestorCloud={connect,disconnect,setLocalMode,session,save,rollback,flush,reloadCloud,downloadDraft,downloadReceiptWarnings,legacyBackup,migrate,createInvitation,listMembers,setMember,recordReceipt};
})();
