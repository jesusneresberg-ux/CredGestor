// CrediGestor v11 — navegação lateral no web, engrenagem direta e login Google.
(function(){
  'use strict';
  const SESSION_KEY='credigestor-google-session-v11';
  let loginTokenClient=null;

  const style=document.createElement('style');
  style.textContent=`
    .topbar-actions{display:flex;align-items:center;gap:8px}
    .bottom-nav-v2{grid-template-columns:repeat(6,1fr)!important}
    .v11-account-card{display:flex;align-items:center;gap:12px}
    .v11-account-avatar{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:rgba(37,99,235,.10);color:var(--accent);font-weight:900;font-size:15px;flex:0 0 auto;overflow:hidden}
    .v11-account-avatar img{width:100%;height:100%;object-fit:cover}
    .v11-login-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.66);backdrop-filter:blur(15px)}
    .v11-login-card{width:min(430px,100%);background:var(--surface-solid,#fff);border-radius:28px;padding:22px;box-shadow:0 28px 90px rgba(15,23,42,.38)}
    .v11-login-brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}
    .v11-login-logo{width:50px;height:50px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;font-size:24px;font-weight:900}
    .v11-login-card h2{margin:0;font-size:21px}.v11-login-card p{margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.45}
    .v11-login-actions{display:grid;gap:9px;margin-top:16px}.v11-login-actions button{width:100%}
    .v11-google-btn{display:flex;align-items:center;justify-content:center;gap:9px}
    .v11-google-g{font-weight:900;font-size:18px}
    .v11-auth-note{font-size:10px;color:var(--muted);line-height:1.45;margin-top:12px}
    body.v11-locked{overflow:hidden}
    @media(max-width:420px){.bottom-nav .nav-btn small{font-size:8px}.bottom-nav .nav-btn{padding-left:1px;padding-right:1px}}
    @media(min-width:900px){
      body[data-v10-layout="auto"] .app-shell,body[data-v10-layout="wide"] .app-shell{position:relative;padding-right:94px;padding-bottom:26px}
      body[data-v10-layout="auto"] .bottom-nav,body[data-v10-layout="wide"] .bottom-nav{left:auto!important;right:max(18px,calc((100vw - var(--v10-app-max))/2 + 10px));top:50%;bottom:auto!important;transform:translateY(-50%)!important;width:76px!important;display:flex!important;flex-direction:column;gap:5px;padding:10px 7px!important;border:1px solid var(--line);border-radius:24px;background:rgba(255,255,255,.90);box-shadow:0 18px 55px rgba(15,23,42,.13)}
      body[data-v10-layout="auto"] .bottom-nav .nav-btn,body[data-v10-layout="wide"] .bottom-nav .nav-btn{min-height:58px;justify-content:center;padding:7px 2px}
      body[data-v10-layout="auto"] .bottom-nav .nav-btn span,body[data-v10-layout="wide"] .bottom-nav .nav-btn span{font-size:20px}
      body[data-v10-layout="auto"] .bottom-nav .nav-btn small,body[data-v10-layout="wide"] .bottom-nav .nav-btn small{font-size:8px;line-height:1.1;text-align:center}
      body[data-v10-layout="auto"] .fab,body[data-v10-layout="wide"] .fab{right:max(112px,calc((100vw - var(--v10-app-max))/2 + 106px))!important;bottom:28px!important}
    }
  `;
  document.head.appendChild(style);

  function ensureV11(){
    if(!state.settings||typeof state.settings!=='object')state.settings={};
    if(typeof state.settings.requireGoogleLoginV11!=='boolean')state.settings.requireGoogleLoginV11=!!String(state.settings.driveClientId||'').trim();
  }
  ensureV11();

  function titleV11(){document.title=state.settings.appName||'CrediGestor'}
  titleV11();
  if(typeof applySettings==='function'){
    const before=applySettings;
    applySettings=function(){const out=before();titleV11();return out};
  }

  function getSession(){
    try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}
  }
  function setSession(profile){sessionStorage.setItem(SESSION_KEY,JSON.stringify(profile||null));updateAccountButton()}
  function clearSession(){sessionStorage.removeItem(SESSION_KEY);updateAccountButton()}
  function initials(name=''){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'👤'}
  function updateAccountButton(){
    const b=document.getElementById('accountQuickBtn');if(!b)return;
    const s=getSession();b.textContent=s?initials(s.name||s.email):'👤';b.title=s?`${s.name||s.email} — conta`:'Entrar com Conta Google';
  }

  function googleReady(){return !!window.google?.accounts?.oauth2}
  function waitGoogle(){return new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(googleReady()){clearInterval(t);resolve()}else if(++n>40){clearInterval(t);reject(new Error('Não foi possível carregar o login do Google. Verifique a internet.'))}},200)})}
  async function loginGoogleV11(){
    ensureV11();
    const clientId=String(state.settings.driveClientId||'').trim();
    if(!clientId){openGoogleSetupV11();return}
    try{await waitGoogle()}catch(e){alert(e.message);return}
    loginTokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'openid email profile',prompt:'select_account',callback:async resp=>{
      if(resp.error){alert(`Login Google: ${resp.error}`);return}
      try{
        const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${resp.access_token}`}});
        if(!r.ok)throw new Error('Não foi possível obter os dados da conta Google.');
        const p=await r.json();
        setSession({email:p.email||'',name:p.name||p.email||'Conta Google',picture:p.picture||'',sub:p.sub||'',at:Date.now()});
        removeLoginOverlayV11();
        if(currentView==='settings')renderSettings();
      }catch(e){alert(e.message||'Falha no login Google.')}
    }});
    loginTokenClient.requestAccessToken();
  }

  function openGoogleSetupV11(){
    openModal(`<h2>Configurar login Google</h2><div class="card note">O login usa o mesmo ID OAuth do Google já utilizado pela integração com o Drive. A senha é digitada apenas na tela oficial do Google.</div><div class="field"><label>ID do cliente OAuth do Google</label><input id="loginClientIdV11" data-no-person-loupe="1" value="${esc(state.settings.driveClientId||'')}" placeholder="...apps.googleusercontent.com"></div><div class="rule-note">No Google Cloud, a credencial deve ser do tipo <b>Aplicativo da Web</b> e a origem deste site precisa estar autorizada.</div><div class="actions"><button type="button" class="primary-btn" id="saveLoginClientV11">Salvar</button><button type="button" class="ghost-btn" id="cancelLoginClientV11">Cancelar</button></div>`,()=>{
      document.getElementById('saveLoginClientV11').onclick=()=>{const v=document.getElementById('loginClientIdV11').value.trim();if(!/\.apps\.googleusercontent\.com$/i.test(v)){alert('Informe um ID OAuth válido, terminado em .apps.googleusercontent.com.');return}state.settings.driveClientId=v;state.settings.requireGoogleLoginV11=true;saveState();closeModal();loginGoogleV11()};
      document.getElementById('cancelLoginClientV11').onclick=closeModal;
    });
  }

  function removeLoginOverlayV11(){document.getElementById('v11LoginOverlay')?.remove();document.body.classList.remove('v11-locked')}
  function showLoginOverlayV11(){
    if(getSession()||!state.settings.requireGoogleLoginV11){removeLoginOverlayV11();return}
    if(document.getElementById('v11LoginOverlay'))return;
    const el=document.createElement('div');el.id='v11LoginOverlay';el.className='v11-login-overlay';
    const configured=!!String(state.settings.driveClientId||'').trim();
    el.innerHTML=`<div class="v11-login-card"><div class="v11-login-brand"><div class="v11-login-logo">C</div><div><h2>${esc(state.settings.appName||'CrediGestor')}</h2><p>Acesso ao sistema de gestão.</p></div></div>${configured?`<div class="v11-login-actions"><button type="button" class="primary-btn v11-google-btn" id="overlayGoogleLoginV11"><span class="v11-google-g">G</span> Entrar com Conta Google</button></div>`:`<div class="card note">Para ativar o login por Conta Google, primeiro cadastre o ID OAuth do seu aplicativo.</div><div class="field"><label>ID do cliente OAuth</label><input id="overlayClientIdV11" data-no-person-loupe="1" placeholder="...apps.googleusercontent.com"></div><div class="v11-login-actions"><button type="button" class="primary-btn" id="overlaySaveClientV11">Configurar e entrar</button></div>`}<div class="v11-auth-note">O login identifica quem abriu o CrediGestor. Nesta versão, os dados financeiros continuam armazenados neste navegador; sincronização entre celular e computador exige banco em nuvem.</div></div>`;
    document.body.appendChild(el);document.body.classList.add('v11-locked');
    if(configured)document.getElementById('overlayGoogleLoginV11').onclick=loginGoogleV11;
    else document.getElementById('overlaySaveClientV11').onclick=()=>{const v=document.getElementById('overlayClientIdV11').value.trim();if(!/\.apps\.googleusercontent\.com$/i.test(v)){alert('Informe um ID OAuth válido.');return}state.settings.driveClientId=v;saveState();loginGoogleV11()};
  }

  function injectAccountSettingsV11(){
    if(document.getElementById('accountSettingsV11'))return;
    const s=getSession();
    const target=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Integrações e alertas')?.closest('.section-title');
    if(!target)return;
    target.insertAdjacentHTML('beforebegin',`<div id="accountSettingsV11"><div class="section-title"><h2>Conta e acesso</h2><small>Google</small></div><div class="card"><div class="v11-account-card"><div class="v11-account-avatar">${s?.picture?`<img src="${esc(s.picture)}" alt="">`:initials(s?.name||s?.email||'')}</div><div style="min-width:0;flex:1"><div class="title">${s?esc(s.name||'Conta Google'):'Nenhuma conta conectada'}</div><div class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s?esc(s.email||''):'Entre com sua Conta Google para identificar o acesso.'}</div></div></div><div class="switch-row"><div><div class="title">Exigir login ao abrir</div><div class="muted">Usa o mesmo ID OAuth configurado para o Google Drive.</div></div><button class="switch ${state.settings.requireGoogleLoginV11?'on':''}" id="requireLoginSwitchV11" aria-label="Exigir login"></button></div><div class="actions">${s?`<button type="button" class="ghost-btn" id="logoutGoogleV11">Sair da conta</button>`:`<button type="button" class="primary-btn" id="loginGoogleV11">Entrar com Google</button>`}<button type="button" class="soft-btn" id="configureLoginV11">Configurar OAuth</button></div><div class="v11-setting-help">O login protege a abertura por identidade Google, mas não transforma o armazenamento local em nuvem.</div></div></div>`);
    document.getElementById('requireLoginSwitchV11').onclick=()=>{if(!state.settings.requireGoogleLoginV11&&!String(state.settings.driveClientId||'').trim()){openGoogleSetupV11();return}state.settings.requireGoogleLoginV11=!state.settings.requireGoogleLoginV11;saveState();renderSettings();if(state.settings.requireGoogleLoginV11)showLoginOverlayV11()};
    document.getElementById('configureLoginV11').onclick=openGoogleSetupV11;
    const login=document.getElementById('loginGoogleV11');if(login)login.onclick=loginGoogleV11;
    const logout=document.getElementById('logoutGoogleV11');if(logout)logout.onclick=()=>{clearSession();renderSettings();if(state.settings.requireGoogleLoginV11)showLoginOverlayV11()};
    document.querySelectorAll('.card .note').forEach(n=>{if(n.textContent.includes('próximo passo é migrar para banco em nuvem com login'))n.textContent='Os dados continuam armazenados neste navegador. O login identifica o acesso, e o backup pode ser enviado ao Google Drive.'});
  }

  if(typeof renderSettings==='function'){
    const before=renderSettings;
    renderSettings=function(){const out=before();injectAccountSettingsV11();return out};
  }

  const accountBtn=document.getElementById('accountQuickBtn');
  if(accountBtn)accountBtn.addEventListener('click',()=>{const s=getSession();if(s){currentView='settings';syncNav();renderSettings()}else loginGoogleV11()});

  // A navegação v11 já traz Configurações com engrenagem e atalhos diretos.
  updateAccountButton();
  if(state.settings.requireGoogleLoginV11)showLoginOverlayV11();
  if(currentView==='settings')renderSettings();
})();
