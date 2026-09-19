// CrediGestor v26 - Firebase Authentication, login Google e perfis de acesso.
(function(){
  'use strict';
  const cfg=window.CREDIGESTOR_FIREBASE_CONFIG||{};
  const configured=cfg.apiKey&&cfg.projectId&&!Object.values(cfg).some(v=>String(v).includes('COLE_AQUI'));
  const roleNames={administrador:'Administrador',gerente:'Gerente',cobrador:'Cobrador',consulta:'Consulta'};
  let auth=null,session=null;

  function removeLegacyLogin(){document.getElementById('v11LoginOverlay')?.remove();}
  function overlay(message='',kind=''){
    removeLegacyLogin();let el=document.getElementById('v26AuthOverlay');
    if(!el){el=document.createElement('div');el.id='v26AuthOverlay';el.className='v26-auth-overlay';document.body.appendChild(el);}
    el.innerHTML=`<div class="v26-auth-card"><div class="v26-auth-brand"><div class="v26-auth-logo">C</div><div><h2>CrediGestor v26</h2><p>Entre para acessar os dados da sua organização.</p></div></div>${message?`<div class="v26-auth-status ${kind}">${esc(message)}</div>`:''}<button type="button" class="primary-btn" id="v26GoogleLogin" ${configured?'':'disabled'}>Entrar com Google</button>${configured?'':'<p>O Firebase ainda não foi configurado. Preencha o arquivo <b>firebase-config.js</b> e publique novamente.</p><button type="button" class="ghost-btn" id="v26LocalMode">Continuar somente neste aparelho</button>'}<p style="font-size:11px">Seus dados atuais não são apagados. Na primeira migração, o sistema cria uma cópia de segurança antes de enviar os dados.</p></div>`;
    const login=document.getElementById('v26GoogleLogin');if(login&&!login.disabled)login.onclick=signIn;
    const local=document.getElementById('v26LocalMode');if(local)local.onclick=()=>{window.CrediGestorCloud.setLocalMode(true);el.remove();};
  }
  function hideOverlay(){document.getElementById('v26AuthOverlay')?.remove();}
  async function signIn(){
    try{overlay('Abrindo o login seguro do Google…');const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await auth.signInWithPopup(provider);}
    catch(error){console.error(error);overlay(error.code==='auth/popup-blocked'?'O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.':'Não foi possível entrar com Google. Confira a configuração do Firebase e tente novamente.','error');}
  }
  function applyRole(){
    document.body.dataset.v26Role=session?.role||'';
    const b=document.getElementById('accountQuickBtn');if(b&&session){const name=session.user?.displayName||session.user?.email||'Conta';b.textContent=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();b.title=`${name} — ${roleNames[session.role]||session.role}`;}
  }
  async function accountModal(){
    if(!session){overlay();return;}
    const s=window.CrediGestorCloud.session();const photo=s.user?.photoURL?`<img class="v26-avatar" src="${esc(s.user.photoURL)}" alt="">`:`<div class="v26-avatar">${esc((s.user?.displayName||s.user?.email||'U').slice(0,1).toUpperCase())}</div>`;
    const admin=s.role==='administrador';
    openModal(`<h2>Minha conta</h2><div class="card"><div class="v26-account-row">${photo}<div><b>${esc(s.user?.displayName||'Usuário')}</b><div class="muted">${esc(s.user?.email||'')}</div><span class="v26-role">${esc(roleNames[s.role]||s.role||'Modo local')}</span></div></div><div class="v26-sync">Organização: <b>${esc(s.organizationName||s.organizationId||'não conectada')}</b><br>Sincronização: ${s.connected?'ativa':'somente neste aparelho'}</div></div><div class="actions"><button type="button" class="soft-btn" id="v26BackupBtn">Baixar backup de segurança</button>${auth?'<button type="button" class="ghost-btn" id="v26LogoutBtn">Sair</button>':''}</div>${admin?'<div class="section-title"><h2>Usuários</h2><small>equipe</small></div><div class="card" id="v26Members">Carregando…</div><div class="field"><label>Convidar por e-mail</label><input id="v26InviteEmail" type="email" placeholder="nome@exemplo.com"></div><div class="field"><label>Perfil</label><select id="v26InviteRole"><option value="gerente">Gerente</option><option value="cobrador">Cobrador</option><option value="consulta">Consulta</option></select></div><div class="actions"><button type="button" class="primary-btn" id="v26InviteBtn">Criar convite</button></div>':''}` ,()=>{
      document.getElementById('v26BackupBtn').onclick=()=>window.CrediGestorCloud.downloadSafetyBackup();
      const logout=document.getElementById('v26LogoutBtn');if(logout)logout.onclick=()=>{closeModal();auth.signOut();};
      if(admin){
        window.CrediGestorCloud.listMembers().then(list=>{const box=document.getElementById('v26Members');if(box)box.innerHTML=list.map(m=>`<div class="v26-member"><div><b>${esc(m.name||m.email||'Usuário')}</b><div class="muted">${esc(m.email||'')}</div></div><span class="v26-role">${esc(roleNames[m.role]||m.role)}</span></div>`).join('')||'<div class="muted">Nenhum usuário cadastrado.</div>';});
        document.getElementById('v26InviteBtn').onclick=async()=>{try{await window.CrediGestorCloud.createInvitation(document.getElementById('v26InviteEmail').value,document.getElementById('v26InviteRole').value);alert('Convite criado. A pessoa deve entrar no CrediGestor com esse e-mail do Google.');document.getElementById('v26InviteEmail').value='';}catch(error){alert(error.message)}};
      }
    });
  }
  const accountBtn=document.getElementById('accountQuickBtn');
  if(accountBtn)accountBtn.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();accountModal();},true);
  window.addEventListener('credigestor:v26-session',event=>{session=event.detail;applyRole();});

  if(!configured){overlay('Configuração do Firebase pendente.');return;}
  try{if(!firebase.apps.length)firebase.initializeApp(cfg);auth=firebase.auth();auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);}
  catch(error){console.error(error);overlay('A configuração do Firebase não é válida.','error');return;}
  overlay('Verificando sua conta…');
  auth.onAuthStateChanged(async current=>{
    removeLegacyLogin();
    if(!current){window.CrediGestorCloud.disconnect();session=null;document.body.dataset.v26Role='';overlay();return;}
    try{overlay('Carregando sua organização e sincronizando os dados…');session=await window.CrediGestorCloud.connect(current);applyRole();hideOverlay();}
    catch(error){console.error(error);await auth.signOut();overlay(error.message||'Não foi possível abrir sua organização.','error');}
  });
})();
