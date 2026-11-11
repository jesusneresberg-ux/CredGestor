(function(){
  'use strict';
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1',ORG='org_'+OWNER,KEY='credigestor_single_owner_v25';
  let epoch=0,started=false,auth;
  document.getElementById('v261Boot')?.remove();
  const gate=document.createElement('div');gate.className='v26-auth-overlay';gate.id='personalLogin';document.body.append(gate);
  const account=document.createElement('dialog');account.id='v26Account';document.body.append(account);
  let unlocked=false,busy=false;
  const BIO='credigestor_biometric_owner';
  const biometric=window.Capacitor?.isPluginAvailable?.('CrediBiometric')?window.Capacitor.registerPlugin('CrediBiometric'):null;
  function errorText(e){return ({'auth/operation-not-allowed':'Ative E-mail/senha no Firebase Authentication para usar esta opção.','auth/invalid-credential':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/too-many-requests':'Muitas tentativas. Aguarde antes de tentar novamente.','auth/requires-recent-login':'Entre novamente na conta para definir a senha.','auth/popup-closed-by-user':'O login foi fechado. Tente novamente.'})[e.code]||e.message||'Não foi possível entrar. Tente novamente.';}
  function lock(text,error=false){
    unlocked=false;
    const app=document.getElementById('app');app.style.display='none';app.inert=true;document.getElementById('modal').close();document.getElementById('modal').inert=true;account.close();document.body.dataset.v26Locked='true';gate.style.display='grid';
    gate.innerHTML='<section class="v26-auth-card"><h2>CrediGestor</h2><p>Entre com sua conta.</p><form id="personalForm"><label>E-mail<input id="loginEmail" type="email" autocomplete="username" required></label><label>Senha<input id="loginPassword" type="password" autocomplete="current-password" required></label><button type="submit">Entrar</button></form><button id="personalReset" type="button">Esqueci minha senha</button><button id="personalBio" type="button" hidden>Desbloquear com biometria</button><button id="personalGoogle" type="button">Entrar com Google</button><p id="personalMessage" role="status" aria-live="polite"></p></section>';
    const message=gate.querySelector('#personalMessage');message.textContent=text;message.style.color=error?'#991b1b':'';
    const action=async(fn)=>{if(busy)return;busy=true;gate.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){lock(errorText(e),true);}finally{busy=false;gate.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    gate.querySelector('#personalForm').onsubmit=e=>{e.preventDefault();action(async()=>{const email=gate.querySelector('#loginEmail').value.trim(),password=gate.querySelector('#loginPassword').value;gate.querySelector('#loginPassword').value='';const result=await auth.signInWithEmailAndPassword(email,password);if(result.user.uid===OWNER&&result.user.emailVerified)await enter(result.user,true);});};
    gate.querySelector('#personalGoogle').onclick=()=>action(async()=>{const result=await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());if(result.user.uid===OWNER&&result.user.emailVerified)await enter(result.user,true);});
    gate.querySelector('#personalReset').onclick=()=>action(async()=>{const input=gate.querySelector('#loginEmail');if(!input.reportValidity()||!input.value)return;await auth.sendPasswordResetEmail(input.value.trim());message.textContent='Se houver uma conta para esse e-mail, você receberá as instruções de recuperação.';});
    const bioButton=gate.querySelector('#personalBio');bioButton.hidden=!(biometric&&auth?.currentUser?.uid===OWNER&&localStorage.getItem(BIO)===OWNER);bioButton.onclick=()=>action(async()=>{await biometric.authenticate();await enter(auth.currentUser,true);});
  }
  async function enter(user,explicit=false){
    if(!user||user.uid!==OWNER||!user.emailVerified)return;
    const token=++epoch;
    if(!explicit&&!unlocked){lock('Entre com e-mail e senha para continuar.');return;}
    lock('Preparando sua carteira…');
    try{await seed(user,token);if(token!==epoch)return;if(!started){await launch();started=true;}if(token!==epoch||auth.currentUser?.uid!==OWNER)return;if(document.hidden){lock('Aplicativo bloqueado. Entre novamente ou use a biometria.');return;}unlocked=true;document.body.dataset.v26Locked='false';document.body.dataset.v26Role='administrador';document.getElementById('app').style.display='';document.getElementById('app').inert=false;document.getElementById('modal').inert=false;gate.style.display='none';}catch(e){if(token===epoch)lock(errorText(e),true);}
  }
  function archive(value,key){return new Promise((resolve,reject)=>{const r=indexedDB.open('credigestor-individual-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>reject(Error('Não foi possível criar a cópia de recuperação no aparelho.'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(Error('Não foi possível preservar a cópia de recuperação.'));};};});}
  async function seed(user,token){
    const existing=localStorage.getItem(KEY);if(existing){CrediGestorCore.validate(JSON.parse(existing));return;}
    const guard=()=>{if(token!==epoch||auth.currentUser?.uid!==OWNER)throw Error('A conta mudou. Abra novamente com sua conta.');};
    const db=firebase.firestore(),root=db.collection('organizations').doc(ORG),ref=root.collection('appData').doc('main');
    const snap=await ref.get({source:'server'});guard();if(!snap.exists)throw Error('Não foi encontrada a carteira anterior. Nenhum dado foi substituído.');
    const [head,receipts]=await Promise.all([CrediGestorCore.hydrate(ref,snap.data(),guard),root.collection('paymentEvents').get({source:'server'})]);guard();
    const projection=CrediGestorCore.materialize(head,new Map(receipts.docs.map(d=>[d.id,d.data()])));
    const wallet=CrediGestorCore.validate(projection.state),raw=JSON.stringify(wallet);
    await archive({organizationId:ORG,revision:head.revision,state:wallet,receiptWarnings:projection.warnings},'cloud-before-personal');guard();
    const legacy=localStorage.getItem('credigestor_v1');if(legacy)await archive(legacy,'local-before-personal');guard();
    if(localStorage.getItem(KEY))return;
    try{localStorage.setItem(KEY,raw);}catch(_){throw Error('Falta espaço no aparelho para a carteira. A cópia original permanece na nuvem.');}
  }
  async function launch(){
    for(const name of window.CREDIGESTOR_PERSONAL_SCRIPTS){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=name+'?v=pix-mensagem-unica23';s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar a tela. Recarregue a página.'));document.body.append(s);});}
    const reversed=window.CrediGestorCapitalization.reverseAutomatic();
    if(reversed)openModal('<h2>Juros automáticos retirados</h2><p>Foram retirados '+brl(reversed.total)+' de '+reversed.contracts+' contrato(s), referentes à atualização automática anterior.</p><p>Pagamentos e movimentos manuais foram preservados. Uma cópia anterior foi guardada neste aparelho. Novos juros de atraso devem ser lançados em Pagamentos → Inserir juros de atraso.</p>');
    document.getElementById('accountQuickBtn').onclick=openAccount;
    const original=renderSettings;renderSettings=function(){const out=original();const section=document.createElement('div');section.className='card';section.innerHTML='<h2>Minha conta</h2><p>Acesso por e-mail, senha e biometria.</p><button id="personalSettingsAccount" class="soft-btn" type="button">Minha conta e backup</button>';document.getElementById('view').prepend(section);section.querySelector('button').onclick=openAccount;return out;};
    if(currentView==='settings')renderSettings();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  function download(raw,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function oldDraft(){const key='credigestor_v261_draft:'+OWNER+':'+ORG;try{const text=sessionStorage.getItem(key);if(text)return Promise.resolve(text);}catch(_){}return new Promise(resolve=>{const r=indexedDB.open('credigestor-wallet-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('backups');r.onerror=()=>resolve(null);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('backups')){db.close();resolve(null);return;}const tx=db.transaction('backups','readonly'),q=tx.objectStore('backups').get(key);tx.oncomplete=()=>{db.close();resolve(q.result||null);};tx.onerror=()=>{db.close();resolve(null);};};});}
  async function openAccount(){
    if(auth.currentUser?.uid!==OWNER)return;
    account.innerHTML='<div class="v26-actions"><button id="personalClose">Fechar</button><button id="personalLogout">Sair da conta</button></div><h2>Minha conta</h2><p id="personalEmail"></p><p>Use e-mail e senha para entrar. Ative a biometria neste aparelho para desbloquear sua sessão.</p><p>As alterações são salvas neste navegador. Exporte um backup para guardar uma cópia ou transferir para outro aparelho.</p><div class="v26-actions"><button id="personalBackup">Baixar backup atual</button><button id="personalDraft" hidden>Recuperar alterações pendentes da versão anterior</button></div><p id="personalRecoveryMessage" role="status"></p>';
    account.querySelector('#personalEmail').textContent=auth.currentUser.email;account.querySelector('#personalClose').onclick=()=>account.close();
    account.querySelector('#personalLogout').onclick=async()=>{account.close();lock('Saindo da conta…');try{localStorage.removeItem(BIO);await auth.signOut();}catch(e){lock(e.message,true);}};
    const security=document.createElement('section');security.innerHTML='<h3>Segurança</h3><form id="setPasswordForm"><label>Definir senha da conta<input id="newAccountPassword" type="password" autocomplete="new-password" minlength="8" required></label><button>Salvar senha</button></form><button id="enableBio" type="button">Ativar biometria neste aparelho</button><button id="disableBio" type="button">Desativar biometria</button><p id="securityMessage" role="status"></p>';account.append(security);
    const msg=security.querySelector('#securityMessage');
    security.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=security.querySelector('input'),password=input.value;input.value='';try{const user=auth.currentUser;if(user?.uid!==OWNER||!user.emailVerified)throw Error('Entre novamente na conta principal.');if(user.providerData.some(p=>p.providerId==='password'))await user.updatePassword(password);else await user.linkWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,password));msg.textContent='Senha salva. Use o e-mail da sua conta para entrar.';}catch(e){msg.textContent=errorText(e);}};
    security.querySelector('#enableBio').disabled=!biometric;
    if(!biometric)msg.textContent='A biometria requer o APK atualizado com suporte nativo.';
    security.querySelector('#enableBio').onclick=async()=>{try{await biometric.authenticate();if(auth.currentUser?.uid!==OWNER)return;localStorage.setItem(BIO,OWNER);msg.textContent='Biometria ativada neste aparelho.';}catch(e){msg.textContent=errorText(e);}};
    security.querySelector('#disableBio').onclick=()=>{localStorage.removeItem(BIO);msg.textContent='Biometria desativada.';};
    account.querySelector('#personalBackup').onclick=()=>download(JSON.stringify(state,null,2),'credigestor-backup-'+todayISO()+'.json');account.showModal();
    const raw=await oldDraft();if(!raw||!account.open)return;
    try{const draft=JSON.parse(raw);if(draft.uid!==OWNER||draft.organizationId!==ORG)return;CrediGestorCore.validate(draft.state);const button=account.querySelector('#personalDraft');button.hidden=false;button.onclick=async()=>{if(!confirm('Recuperar as alterações pendentes? A carteira atual será preservada em uma cópia de recuperação neste aparelho.'))return;try{button.disabled=true;await archive(JSON.stringify(state),'before-draft-recovery-'+Date.now());Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),CrediGestorCore.clone(draft.state));saveState();account.close();applySettings();render();}catch(e){account.querySelector('#personalRecoveryMessage').textContent=e.message;button.disabled=false;}};}catch(_){account.querySelector('#personalRecoveryMessage').textContent='O rascunho anterior foi mantido. Baixe uma cópia antes de tentar importá-lo.';}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&unlocked){++epoch;lock('Aplicativo bloqueado. Entre novamente ou use a biometria.');}});
  lock('Preparando o acesso…');
  try{firebase.initializeApp(window.CREDIGESTOR_FIREBASE_CONFIG);auth=firebase.auth();
    (async()=>{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);auth.onAuthStateChanged(async user=>{if(busy&&user?.uid===OWNER&&user.emailVerified)return;++epoch;if(!user){lock('Entre com sua conta para continuar.');return;}if(user.uid!==OWNER||!user.emailVerified){lock('Este CrediGestor permite somente o acesso da sua conta principal.',true);return;}if(!unlocked)lock('Entre com e-mail e senha ou desbloqueie com biometria.');});})().catch(e=>lock(errorText(e),true));
  }catch(e){lock(errorText(e),true);}
})();
