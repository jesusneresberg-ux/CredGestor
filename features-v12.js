// CrediGestor v12 — sincronização automática entre dispositivos usando OAuth Google + Google Drive.
(function(){
  'use strict';

  const META_KEY='credigestor-sync-meta-v12';
  const SESSION_KEY='credigestor-google-session-v11';
  const SYNC_FOLDER='CrediGestor Sync';
  const SYNC_FILE='credigestor-sync.json';
  const SCOPE='openid email profile https://www.googleapis.com/auth/drive.file';
  const SYNC_DEBOUNCE=1800;
  let tokenClient=null;
  let accessToken='';
  let tokenExpiresAt=0;
  let profile=null;
  let syncing=false;
  let applyingRemote=false;
  let saveTimer=null;
  let remoteFileId='';
  let remoteFolderId='';
  let statusMessage='Aguardando conexão';
  let statusKind='idle';

  const style=document.createElement('style');
  style.textContent=`
    .v12-sync-status{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(148,163,184,.055);margin-top:12px}
    .v12-sync-dot{width:10px;height:10px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.13);margin-top:4px;flex:0 0 auto}
    .v12-sync-dot.on{background:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.13)}
    .v12-sync-dot.busy{background:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.13);animation:v12pulse 1.1s ease-in-out infinite}
    .v12-sync-dot.warn{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.13)}
    .v12-sync-dot.off{background:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.12)}
    .v12-sync-title{font-size:13px;font-weight:850}.v12-sync-sub{font-size:10px;color:var(--muted);line-height:1.45;margin-top:2px}
    .v12-sync-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    .v12-sync-grid button{width:100%}.v12-sync-account{font-size:10px;color:var(--muted);margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @keyframes v12pulse{50%{opacity:.45;transform:scale(.8)}}
    @media(max-width:480px){.v12-sync-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function now(){return Date.now()}
  function getMeta(){
    try{return {...{auto:true,localUpdatedAt:0,lastSyncedAt:0,lastRemoteUpdatedAt:0,accountSub:'',accountEmail:''},...JSON.parse(localStorage.getItem(META_KEY)||'{}')}}
    catch{return {auto:true,localUpdatedAt:0,lastSyncedAt:0,lastRemoteUpdatedAt:0,accountSub:'',accountEmail:''}}
  }
  function setMeta(patch){const m={...getMeta(),...patch};localStorage.setItem(META_KEY,JSON.stringify(m));return m}
  function getSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function isTokenValid(){return !!accessToken&&now()<tokenExpiresAt-30000}
  function meaningful(s=state){return !!((s.clients||[]).length||(s.legacyControls||[]).length||(s.auditTrail||[]).length)}
  function cloneForCloud(){return JSON.parse(JSON.stringify(state))}
  function fmtTime(ts){return ts?new Date(ts).toLocaleString('pt-BR'):'nunca'}
  function setStatus(kind,msg){statusKind=kind;statusMessage=msg;updateStatusDom()}
  function updateStatusDom(){
    const box=document.getElementById('syncStatusV12');if(!box)return;
    const dot=box.querySelector('.v12-sync-dot');if(dot)dot.className=`v12-sync-dot ${statusKind==='ok'?'on':statusKind==='busy'?'busy':statusKind==='warn'?'warn':statusKind==='error'?'off':''}`;
    const title=box.querySelector('.v12-sync-title');if(title)title.textContent=statusMessage;
    const m=getMeta();const sub=box.querySelector('.v12-sync-sub');if(sub)sub.textContent=`Última sincronização: ${fmtTime(m.lastSyncedAt)}. Alterações locais: ${fmtTime(m.localUpdatedAt)}.`;
  }

  function api(path,opts={}){
    if(!isTokenValid())return Promise.reject(new Error('A sessão Google expirou. Entre novamente para sincronizar.'));
    const headers=new Headers(opts.headers||{});headers.set('Authorization',`Bearer ${accessToken}`);
    return fetch(path,{...opts,headers}).then(async r=>{
      if(r.status===401){accessToken='';tokenExpiresAt=0;setStatus('warn','Sessão Google expirada');throw new Error('A sessão Google expirou. Entre novamente.');}
      if(!r.ok){let detail='';try{detail=(await r.json())?.error?.message||''}catch{}throw new Error(detail||`Google Drive respondeu com erro ${r.status}.`)}
      return r;
    });
  }
  function q(s){return encodeURIComponent(s)}
  async function fetchProfile(token){
    const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok)throw new Error('Não foi possível identificar a Conta Google.');
    return r.json();
  }

  async function requestGoogleToken({interactive=true}={}){
    const id=String(state.settings?.driveClientId||'').trim();
    if(!id){if(typeof openGoogleSetupV11==='function')openGoogleSetupV11();else alert('Cadastre primeiro o ID do cliente OAuth em Configurações > Conta e acesso.');throw new Error('OAuth não configurado.');}
    if(!window.google?.accounts?.oauth2)throw new Error('A biblioteca de login do Google ainda não carregou.');
    return new Promise((resolve,reject)=>{
      tokenClient=google.accounts.oauth2.initTokenClient({client_id:id,scope:SCOPE,callback:async resp=>{
        if(resp.error){reject(new Error(`Google OAuth: ${resp.error}`));return}
        try{
          accessToken=resp.access_token;tokenExpiresAt=now()+(Number(resp.expires_in)||3600)*1000;
          const p=await fetchProfile(accessToken);profile={email:p.email||'',name:p.name||p.email||'Conta Google',picture:p.picture||'',sub:p.sub||''};
          const old=getMeta();
          if(old.accountSub&&profile.sub&&old.accountSub!==profile.sub){remoteFileId='';remoteFolderId='';setMeta({lastSyncedAt:0,lastRemoteUpdatedAt:0,accountSub:profile.sub,accountEmail:profile.email});}
          else setMeta({accountSub:profile.sub||old.accountSub,accountEmail:profile.email||old.accountEmail});
          window.__credigestorGoogleAccessV12={token:accessToken,expiresAt:tokenExpiresAt,profile};
          window.dispatchEvent(new CustomEvent('credigestor:google-auth',{detail:window.__credigestorGoogleAccessV12}));
          setStatus('ok',`Google conectado — ${profile.email||'conta autorizada'}`);
          resolve(profile);
        }catch(e){reject(e)}
      }});
      tokenClient.requestAccessToken({prompt:interactive?'consent':''});
    });
  }

  async function ensureAuth(interactive=true){
    if(isTokenValid())return profile||getSession();
    const shared=window.__credigestorGoogleAccessV12;
    if(shared?.token&&now()<(shared.expiresAt||0)-30000){accessToken=shared.token;tokenExpiresAt=shared.expiresAt;profile=shared.profile||getSession();return profile}
    return requestGoogleToken({interactive});
  }

  async function findFolder(){
    if(remoteFolderId)return remoteFolderId;
    const query=`name='${SYNC_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r=await api(`https://www.googleapis.com/drive/v3/files?q=${q(query)}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=10`);
    const data=await r.json();
    if(data.files?.[0]){remoteFolderId=data.files[0].id;return remoteFolderId}
    const created=await api('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:SYNC_FOLDER,mimeType:'application/vnd.google-apps.folder'})});
    const out=await created.json();remoteFolderId=out.id;return remoteFolderId;
  }

  async function findRemoteFile(){
    if(remoteFileId)return remoteFileId;
    const folder=await findFolder();
    const query=`'${folder}' in parents and name='${SYNC_FILE}' and trashed=false`;
    const r=await api(`https://www.googleapis.com/drive/v3/files?q=${q(query)}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime%20desc&pageSize=10`);
    const data=await r.json();if(data.files?.[0])remoteFileId=data.files[0].id;return remoteFileId;
  }

  function envelope(updatedAt){
    const p=profile||getSession()||{};
    return {format:'credigestor-sync-v12',schema:12,updatedAt:Number(updatedAt)||now(),account:{sub:p.sub||'',email:p.email||''},state:cloneForCloud()};
  }

  async function createRemote(updatedAt){
    const folder=await findFolder();const boundary='credigestor_sync_'+Math.random().toString(36).slice(2);
    const payload=JSON.stringify(envelope(updatedAt));
    const metadata={name:SYNC_FILE,parents:[folder],mimeType:'application/json'};
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,payload,`\r\n--${boundary}--`]);
    const r=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
    const out=await r.json();remoteFileId=out.id;return out;
  }

  async function uploadRemote(updatedAt){
    const id=await findRemoteFile();if(!id)return createRemote(updatedAt);
    const r=await api(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=id,name,modifiedTime`,{method:'PATCH',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(envelope(updatedAt))});
    return r.json();
  }

  async function readRemote(){
    const id=await findRemoteFile();if(!id)return null;
    const r=await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
    const data=await r.json();
    if(data?.format!=='credigestor-sync-v12'||!data?.state)throw new Error('O arquivo de sincronização do Drive não está em um formato reconhecido.');
    return data;
  }

  function preserveDeviceSettings(remoteState){
    const local=state.settings||{};const rs=remoteState.settings||{};
    // Preferências de tela são próprias de cada dispositivo; OAuth também permanece local.
    for(const k of ['layoutV10','driveClientId','requireGoogleLoginV11'])if(local[k]!==undefined)rs[k]=local[k];
    remoteState.settings=rs;return remoteState;
  }

  function applyRemoteState(remote){
    applyingRemote=true;
    try{
      const incoming=preserveDeviceSettings(JSON.parse(JSON.stringify(remote.state)));
      Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,incoming);
      localStorage.setItem(DB_KEY,JSON.stringify(state));
      applySettings();
      if(typeof render==='function')render();
      setMeta({localUpdatedAt:Number(remote.updatedAt)||now(),lastRemoteUpdatedAt:Number(remote.updatedAt)||now(),lastSyncedAt:now()});
    }finally{applyingRemote=false}
  }

  function confirmInitialDirection(remote){
    return new Promise(resolve=>{
      openModal(`<h2>Primeira sincronização</h2><div class="card note">Já existem dados neste aparelho e também na sua nuvem Google. Escolha qual conjunto deve prevalecer nesta primeira sincronização.</div><div class="v12-sync-status"><span class="v12-sync-dot warn"></span><div><div class="v12-sync-title">Dados da nuvem</div><div class="v12-sync-sub">Atualizados em ${esc(fmtTime(remote.updatedAt))}. Esta opção substitui os dados locais por uma cópia da nuvem.</div></div></div><div class="actions"><button type="button" class="primary-btn" id="useCloudV12">Usar dados da nuvem</button><button type="button" class="soft-btn" id="useLocalV12">Enviar dados deste aparelho</button><button type="button" class="ghost-btn" id="cancelSyncV12">Cancelar</button></div>`,()=>{
        document.getElementById('useCloudV12').onclick=()=>{closeModal();resolve('remote')};
        document.getElementById('useLocalV12').onclick=()=>{closeModal();resolve('local')};
        document.getElementById('cancelSyncV12').onclick=()=>{closeModal();resolve('cancel')};
      });
    });
  }

  async function syncNow({interactive=true,forceDirection=''}={}){
    if(syncing)return false;syncing=true;setStatus('busy','Sincronizando com Google Drive…');
    try{
      await ensureAuth(interactive);
      const meta=getMeta();const remote=await readRemote();
      if(!remote){
        const stamp=meta.localUpdatedAt||now();await uploadRemote(stamp);setMeta({localUpdatedAt:stamp,lastRemoteUpdatedAt:stamp,lastSyncedAt:now()});setStatus('ok','Sincronização ativada');return true;
      }
      const remoteAt=Number(remote.updatedAt)||0;const localAt=Number(meta.localUpdatedAt)||0;
      let direction=forceDirection;
      const firstForAccount=!meta.lastSyncedAt||!meta.accountSub;
      if(!direction&&firstForAccount&&meaningful(state)&&meaningful(remote.state))direction=interactive?await confirmInitialDirection(remote):(remoteAt>=localAt?'remote':'local');
      if(direction==='cancel'){setStatus('warn','Sincronização cancelada');return false}
      if(direction==='remote'||(!direction&&remoteAt>localAt+1000)){
        applyRemoteState(remote);setStatus('ok','Dados atualizados pela nuvem');return true;
      }
      if(direction==='local'||(!direction&&localAt>remoteAt+1000)){
        const stamp=localAt||now();await uploadRemote(stamp);setMeta({lastRemoteUpdatedAt:stamp,lastSyncedAt:now()});setStatus('ok','Alterações enviadas para a nuvem');return true;
      }
      setMeta({lastRemoteUpdatedAt:remoteAt,lastSyncedAt:now()});setStatus('ok','Tudo sincronizado');return true;
    }catch(e){console.error('[CrediGestor Sync]',e);setStatus('error',e.message||'Falha na sincronização');if(interactive)alert(e.message||'Não foi possível sincronizar com o Google.');return false}
    finally{syncing=false;updateStatusDom()}
  }

  async function pullFromCloud(){return syncNow({interactive:true,forceDirection:'remote'})}
  async function pushToCloud(){return syncNow({interactive:true,forceDirection:'local'})}

  function queueAutoSync(){
    const m=getMeta();if(!m.auto||applyingRemote)return;
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(navigator.onLine)syncNow({interactive:false});},SYNC_DEBOUNCE);
  }

  // Toda alteração persistida passa a registrar um carimbo para reconciliação com a nuvem.
  if(typeof saveState==='function'){
    const baseSaveState=saveState;
    saveState=function(){
      const out=baseSaveState();
      if(!applyingRemote){setMeta({localUpdatedAt:now()});queueAutoSync();}
      return out;
    };
  }

  function injectSyncSettings(){
    if(document.getElementById('syncSettingsV12'))return;
    const account=document.getElementById('accountSettingsV11');if(!account)return;
    const m=getMeta();const session=profile||getSession();
    account.insertAdjacentHTML('afterend',`<div id="syncSettingsV12"><div class="section-title"><h2>Sincronização</h2><small>Google Drive</small></div><div class="card"><div class="switch-row"><div><div class="title">Sincronização automática</div><div class="muted">Mantém celular e computador alinhados quando a Conta Google estiver autorizada.</div></div><button class="switch ${m.auto?'on':''}" id="autoSyncSwitchV12" aria-label="Sincronização automática"></button></div><div id="syncStatusV12" class="v12-sync-status"><span class="v12-sync-dot ${statusKind==='ok'?'on':statusKind==='busy'?'busy':statusKind==='warn'?'warn':statusKind==='error'?'off':''}"></span><div style="min-width:0"><div class="v12-sync-title">${esc(statusMessage)}</div><div class="v12-sync-sub">Última sincronização: ${esc(fmtTime(m.lastSyncedAt))}. Alterações locais: ${esc(fmtTime(m.localUpdatedAt))}.</div>${session?.email?`<div class="v12-sync-account">Conta: ${esc(session.email)}</div>`:''}</div></div><div class="v12-sync-grid"><button type="button" class="primary-btn" id="syncNowV12">Sincronizar agora</button><button type="button" class="soft-btn" id="pullCloudV12">Baixar da nuvem</button><button type="button" class="soft-btn" id="pushCloudV12">Enviar este aparelho</button><button type="button" class="ghost-btn" id="reconnectSyncV12">Autorizar Google</button></div><div class="rule-note">A sincronização usa OAuth do Google e grava somente um arquivo <b>${SYNC_FILE}</b> dentro da pasta <b>${SYNC_FOLDER}</b> no seu Google Drive. A senha da Conta Google não passa pelo CrediGestor.</div></div></div>`);
    document.getElementById('autoSyncSwitchV12').onclick=()=>{const next=!getMeta().auto;setMeta({auto:next});renderSettings();if(next)syncNow({interactive:true})};
    document.getElementById('syncNowV12').onclick=()=>syncNow({interactive:true});
    document.getElementById('pullCloudV12').onclick=()=>{if(confirm('Baixar os dados da nuvem e substituir os dados deste aparelho?'))pullFromCloud()};
    document.getElementById('pushCloudV12').onclick=()=>{if(confirm('Enviar os dados deste aparelho e substituir a cópia sincronizada na nuvem?'))pushToCloud()};
    document.getElementById('reconnectSyncV12').onclick=()=>requestGoogleToken({interactive:true}).then(()=>syncNow({interactive:false})).catch(e=>alert(e.message));
  }

  if(typeof renderSettings==='function'){
    const beforeSettings=renderSettings;
    renderSettings=function(){const out=beforeSettings();injectSyncSettings();return out};
  }

  window.addEventListener('credigestor:google-auth',e=>{
    const d=e.detail||{};if(d.token){accessToken=d.token;tokenExpiresAt=d.expiresAt||now()+3500000;profile=d.profile||getSession();setStatus('ok',`Google conectado — ${profile?.email||'conta autorizada'}`);if(getMeta().auto)setTimeout(()=>syncNow({interactive:false}),250)}
  });
  window.addEventListener('credigestor:google-logout',()=>{accessToken='';tokenExpiresAt=0;profile=null;setStatus('warn','Conta Google desconectada')});
  window.addEventListener('online',()=>{if(getMeta().auto)setTimeout(()=>syncNow({interactive:false}),800)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&getMeta().auto&&isTokenValid())syncNow({interactive:false})});

  // Reaproveita uma autorização criada pelo login v11, se existir.
  const shared=window.__credigestorGoogleAccessV12;
  if(shared?.token){accessToken=shared.token;tokenExpiresAt=shared.expiresAt||0;profile=shared.profile||getSession();setStatus('ok',`Google conectado — ${profile?.email||'conta autorizada'}`)}
  else if(getSession())setStatus('warn','Conta identificada; autorize o Drive para sincronizar');

  window.CrediGestorSync={syncNow,pullFromCloud,pushToCloud,requestGoogleToken};
  if(currentView==='settings')renderSettings();
})();
