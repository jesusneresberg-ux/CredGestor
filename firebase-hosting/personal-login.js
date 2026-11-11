(function(){
  'use strict';
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1',ORG='org_'+OWNER,KEY='credigestor_single_owner_v25';
  let epoch=0,started=false,auth,loadedUid=null;
  const walletKey=uid=>uid===OWNER?KEY:'credigestor_wallet:'+uid;
  const allowed=user=>!!user&&!user.isAnonymous&&(user.uid!==OWNER||user.emailVerified);
  const sameUser=uid=>allowed(auth.currentUser)&&auth.currentUser.uid===uid;
  document.getElementById('v261Boot')?.remove();
  const gate=document.createElement('div');gate.className='v26-auth-overlay';gate.id='personalLogin';document.body.append(gate);
  const account=document.createElement('dialog');account.id='v26Account';document.body.append(account);
  let unlocked=false,busy=false,creating=false;
  const BIO='credigestor_biometric_owner';
  const biometric=window.Capacitor?.isPluginAvailable?.('CrediBiometric')?window.Capacitor.registerPlugin('CrediBiometric'):null;
  function errorText(e){return ({'auth/email-already-in-use':'Este e-mail já possui uma conta. Entre ou recupere sua senha.','auth/weak-password':'Use uma senha com pelo menos 8 caracteres.','auth/invalid-email':'Informe um e-mail válido.','auth/operation-not-allowed':'Ative E-mail/senha no Firebase Authentication para usar esta opção.','auth/invalid-credential':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/too-many-requests':'Muitas tentativas. Aguarde antes de tentar novamente.','auth/requires-recent-login':'Entre novamente na conta para definir a senha.','auth/popup-closed-by-user':'O login foi fechado. Tente novamente.'})[e.code]||e.message||'Não foi possível entrar. Tente novamente.';}
  function lock(text,error=false){
    unlocked=false;
    const app=document.getElementById('app');app.style.display='none';app.inert=true;document.getElementById('modal').close();document.getElementById('modal').inert=true;account.close();document.body.dataset.v26Locked='true';gate.style.display='grid';
    gate.innerHTML='<section class="v26-auth-card"><h2>CrediGestor</h2><p>Entre com sua conta.</p><form id="personalForm"><label>E-mail<input id="loginEmail" type="email" autocomplete="username" required></label><label>Senha<input id="loginPassword" type="password" autocomplete="current-password" required></label><button type="submit">Entrar</button></form><button id="personalCreate" type="button">Criar conta</button><button id="personalReset" type="button">Esqueci minha senha</button><button id="personalBio" type="button" hidden>Desbloquear com biometria</button><button id="personalGoogle" type="button">Entrar com Google</button><p id="personalMessage" role="status" aria-live="polite"></p></section>';
    const message=gate.querySelector('#personalMessage');message.textContent=text;message.style.color=error?'#991b1b':'';
    const action=async(fn)=>{if(busy)return;busy=true;gate.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){lock(errorText(e),true);}finally{busy=false;gate.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    gate.querySelector('#personalForm').onsubmit=e=>{e.preventDefault();action(async()=>{const email=gate.querySelector('#loginEmail').value.trim(),password=gate.querySelector('#loginPassword').value;gate.querySelector('#loginPassword').value='';const result=await auth.signInWithEmailAndPassword(email,password);await enter(result.user,true);});};
    gate.querySelector('#personalGoogle').onclick=()=>action(async()=>{const result=await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());await enter(result.user,true);});
    gate.querySelector('#personalCreate').onclick=()=>showRegistration();
    gate.querySelector('#personalReset').onclick=()=>action(async()=>{const input=gate.querySelector('#loginEmail');if(!input.reportValidity()||!input.value)return;await auth.sendPasswordResetEmail(input.value.trim());message.textContent='Se houver uma conta para esse e-mail, você receberá as instruções de recuperação.';});
    const bioButton=gate.querySelector('#personalBio');bioButton.hidden=!(biometric&&allowed(auth?.currentUser)&&localStorage.getItem(BIO)===auth.currentUser.uid);bioButton.onclick=()=>action(async()=>{await biometric.authenticate();await enter(auth.currentUser,true);});
  }
  function showRegistration(){
    gate.innerHTML='<section class="v26-auth-card"><h2>Criar conta</h2><p>Comece com uma carteira vazia, só sua.</p><form id="registerForm"><label>E-mail<input id="registerEmail" type="email" autocomplete="username" required></label><label>Senha<input id="registerPassword" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirmar senha<input id="registerConfirm" type="password" autocomplete="new-password" minlength="8" required></label><button type="submit">Criar minha conta</button></form><button id="registerBack" type="button">Já tenho conta — Entrar</button><p id="registerMessage" role="status" aria-live="polite"></p></section>';
    gate.querySelector('#registerBack').onclick=()=>{if(!busy)lock('Entre com sua conta.');};
    gate.querySelector('#registerForm').onsubmit=async e=>{
      e.preventDefault();if(busy)return;
      const email=gate.querySelector('#registerEmail').value.trim(),password=gate.querySelector('#registerPassword').value;
      const message=gate.querySelector('#registerMessage');
      if(password!==gate.querySelector('#registerConfirm').value){message.textContent='As senhas não coincidem.';return;}
      if(password.length<8){message.textContent='Use uma senha com pelo menos 8 caracteres.';return;}
      busy=true;creating=true;gate.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{const result=await auth.createUserWithEmailAndPassword(email,password);creating=false;await enter(result.user,true);}
      catch(error){creating=false;if(gate.querySelector('#registerMessage'))message.textContent=errorText(error);else lock(errorText(error),true);}
      finally{busy=false;creating=false;gate.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
  }
  async function enter(user,explicit=false){
    if(!allowed(user)){lock('Verifique o e-mail da conta para continuar.',true);return;}
    if(loadedUid&&loadedUid!==user.uid){lock('Trocando de conta…');location.reload();return;}
    const token=++epoch;
    if(!explicit&&!unlocked){lock('Entre com e-mail e senha para continuar.');return;}
    lock('Preparando sua carteira…');
    try{await seed(user,token);if(token!==epoch)return;if(!started){loadedUid=user.uid;window.CREDIGESTOR_WALLET_SESSION=Object.freeze({uid:user.uid,key:walletKey(user.uid)});await launch();started=true;}if(token!==epoch||!sameUser(user.uid))return;if(document.hidden){lock('Aplicativo bloqueado. Entre novamente ou use a biometria.');return;}unlocked=true;document.body.dataset.v26Locked='false';document.body.dataset.v26Role='administrador';document.getElementById('app').style.display='';document.getElementById('app').inert=false;document.getElementById('modal').inert=false;gate.style.display='none';}catch(e){if(token===epoch)lock(errorText(e),true);}
  }
  function archive(value,key){return new Promise((resolve,reject)=>{const r=indexedDB.open('credigestor-individual-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>reject(Error('Não foi possível criar a cópia de recuperação no aparelho.'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(Error('Não foi possível preservar a cópia de recuperação.'));};};});}
  async function seed(user,token){
    const key=walletKey(user.uid);
    if(user.uid!==OWNER){if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({clients:[],settings:{appName:'CrediGestor',theme:'aurora',notifyDays:[7,3,1,0]},goals:{monthlyReceipt:0,maxDelinquency:10}}));return;}
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
    // Start every download together, but execute in dependency order.
    // No application code runs before the authenticated wallet is selected.
    await Promise.all(window.CREDIGESTOR_PERSONAL_SCRIPTS.map(name=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.async=false;s.src=name+'?v=public-signup-fast-2';s.onload=resolve;s.onerror=()=>reject(Error('Não foi possível carregar a tela. Recarregue a página.'));document.body.append(s);})));
    const reversed=loadedUid===OWNER?window.CrediGestorCapitalization.reverseAutomatic():null;
    if(reversed)openModal('<h2>Juros automáticos retirados</h2><p>Foram retirados '+brl(reversed.total)+' de '+reversed.contracts+' contrato(s), referentes à atualização automática anterior.</p><p>Pagamentos e movimentos manuais foram preservados. Uma cópia anterior foi guardada neste aparelho. Novos juros de atraso devem ser lançados em Pagamentos → Inserir juros de atraso.</p>');
    document.getElementById('accountQuickBtn').onclick=openAccount;
    const original=renderSettings;renderSettings=function(){const out=original();const section=document.createElement('div');section.className='card';section.innerHTML='<h2>Minha conta</h2><p>Acesso por e-mail, senha e biometria.</p><button id="personalSettingsAccount" class="soft-btn" type="button">Minha conta e backup</button>';document.getElementById('view').prepend(section);section.querySelector('button').onclick=openAccount;return out;};
    if(currentView==='settings')renderSettings();
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  function download(raw,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function oldDraft(){const key='credigestor_v261_draft:'+OWNER+':'+ORG;try{const text=sessionStorage.getItem(key);if(text)return Promise.resolve(text);}catch(_){}return new Promise(resolve=>{const r=indexedDB.open('credigestor-wallet-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('backups');r.onerror=()=>resolve(null);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('backups')){db.close();resolve(null);return;}const tx=db.transaction('backups','readonly'),q=tx.objectStore('backups').get(key);tx.oncomplete=()=>{db.close();resolve(q.result||null);};tx.onerror=()=>{db.close();resolve(null);};};});}
  async function openAccount(){
    if(!allowed(auth.currentUser)||!unlocked)return;
    const accountUid=auth.currentUser.uid;
    account.innerHTML='<div class="v26-actions"><button id="personalClose">Fechar</button><button id="personalLogout">Sair da conta</button></div><h2>Minha conta</h2><p id="personalEmail"></p><p>Use e-mail e senha para entrar. Ative a biometria neste aparelho para desbloquear sua sessão.</p><p>As alterações são salvas neste navegador. Exporte um backup para guardar uma cópia ou transferir para outro aparelho.</p><div class="v26-actions"><button id="personalBackup">Baixar backup atual</button><button id="personalDraft" hidden>Recuperar alterações pendentes da versão anterior</button></div><p id="personalRecoveryMessage" role="status"></p>';
    account.querySelector('#personalEmail').textContent=auth.currentUser.email;account.querySelector('#personalClose').onclick=()=>account.close();
    account.querySelector('#personalLogout').onclick=async()=>{account.close();lock('Saindo da conta…');try{localStorage.removeItem(BIO);await auth.signOut();}catch(e){lock(e.message,true);}};
    const security=document.createElement('section');security.innerHTML='<h3>Segurança</h3><form id="setPasswordForm"><label>Definir senha da conta<input id="newAccountPassword" type="password" autocomplete="new-password" minlength="8" required></label><button>Salvar senha</button></form><button id="enableBio" type="button">Ativar biometria neste aparelho</button><button id="disableBio" type="button">Desativar biometria</button><p id="securityMessage" role="status"></p>';account.append(security);
    const msg=security.querySelector('#securityMessage');
    security.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=security.querySelector('input'),password=input.value;input.value='';try{const user=auth.currentUser;if(!sameUser(accountUid))throw Error('Entre novamente na sua conta.');if(user.providerData.some(p=>p.providerId==='password'))await user.updatePassword(password);else await user.linkWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,password));msg.textContent='Senha salva. Use o e-mail da sua conta para entrar.';}catch(e){msg.textContent=errorText(e);}};
    security.querySelector('#enableBio').disabled=!biometric;
    if(!biometric)msg.textContent='A biometria requer o APK atualizado com suporte nativo.';
    security.querySelector('#enableBio').onclick=async()=>{try{await biometric.authenticate();if(!sameUser(accountUid))return;localStorage.setItem(BIO,accountUid);msg.textContent='Biometria ativada neste aparelho.';}catch(e){msg.textContent=errorText(e);}};
    security.querySelector('#disableBio').onclick=()=>{localStorage.removeItem(BIO);msg.textContent='Biometria desativada.';};
    account.querySelector('#personalBackup').onclick=()=>download(JSON.stringify(state,null,2),'credigestor-backup-'+todayISO()+'.json');account.showModal();
    if(accountUid!==OWNER)return;
    const raw=await oldDraft();if(!raw||!account.open)return;
    try{const draft=JSON.parse(raw);if(draft.uid!==OWNER||draft.organizationId!==ORG)return;CrediGestorCore.validate(draft.state);const button=account.querySelector('#personalDraft');button.hidden=false;button.onclick=async()=>{if(!confirm('Recuperar as alterações pendentes? A carteira atual será preservada em uma cópia de recuperação neste aparelho.'))return;try{button.disabled=true;await archive(JSON.stringify(state),'before-draft-recovery-'+Date.now());Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),CrediGestorCore.clone(draft.state));saveState();account.close();applySettings();render();}catch(e){account.querySelector('#personalRecoveryMessage').textContent=e.message;button.disabled=false;}};}catch(_){account.querySelector('#personalRecoveryMessage').textContent='O rascunho anterior foi mantido. Baixe uma cópia antes de tentar importá-lo.';}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&unlocked){++epoch;lock('Aplicativo bloqueado. Entre novamente ou use a biometria.');}});
  lock('Preparando o acesso…');
  try{firebase.initializeApp(window.CREDIGESTOR_FIREBASE_CONFIG);auth=firebase.auth();
    (async()=>{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);auth.onAuthStateChanged(async user=>{if(creating||(busy&&allowed(user)&&(!loadedUid||loadedUid===user.uid)))return;++epoch;if(!user){lock('Entre com sua conta para continuar.');return;}if(!allowed(user)){lock('Verifique o e-mail da conta para continuar.',true);return;}if(loadedUid&&loadedUid!==user.uid){lock('Trocando de conta…');location.reload();return;}if(!unlocked)lock('Entre com e-mail e senha ou desbloqueie com biometria.');});})().catch(e=>lock(errorText(e),true));
  }catch(e){lock(errorText(e),true);}
})();
