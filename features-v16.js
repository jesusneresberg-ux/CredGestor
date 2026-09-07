// CrediGestor v16 — desbloqueio por biometria/passkey do aparelho e foto da garantia no empréstimo.
(function(){
  'use strict';

  const BIOMETRIC_KEY='credigestor-biometric-v16';
  const GOOGLE_SESSION_KEY='credigestor-google-session-v11';

  const style=document.createElement('style');
  style.textContent=`
    .v16-biometric-btn{display:flex!important;align-items:center;justify-content:center;gap:9px;background:linear-gradient(135deg,#0f766e,#059669)!important;color:#fff!important;border:0!important}
    .v16-biometric-card{margin-bottom:14px}
    .v16-biometric-status{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(5,150,105,.08);margin:10px 0 12px}
    .v16-biometric-dot{width:10px;height:10px;border-radius:50%;background:#059669;box-shadow:0 0 0 5px rgba(5,150,105,.10);flex:0 0 auto}
    .v16-guarantee-box{margin:12px 0;padding:12px;border:1px dashed color-mix(in srgb,var(--accent) 36%,var(--line));border-radius:18px;background:color-mix(in srgb,var(--accent) 4%,white)}
    .v16-guarantee-box .field{margin-bottom:10px}
    .v16-photo-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .v16-photo-preview{display:block;width:100%;max-height:260px;object-fit:cover;border-radius:16px;border:1px solid var(--line);margin-top:10px;background:#eef2f7}
    .v16-photo-empty{padding:18px 12px;text-align:center;color:var(--muted);font-size:11px;border-radius:14px;background:rgba(100,116,139,.06);margin-top:8px}
    .v16-loan-guarantee{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;align-items:center;margin-top:10px;padding:9px;border-radius:14px;background:rgba(5,150,105,.07);border:1px solid rgba(5,150,105,.12)}
    .v16-loan-guarantee img{width:64px;height:64px;border-radius:12px;object-fit:cover;background:#e2e8f0}
    .v16-loan-guarantee strong{font-size:11px;display:block}.v16-loan-guarantee small{display:block;color:var(--muted);font-size:9px;line-height:1.35;margin-top:3px}
    .v16-guarantee-thumb{width:70px;height:70px;object-fit:cover;border-radius:13px;border:1px solid var(--line);margin-top:8px}
    @media(max-width:420px){.v16-photo-actions>*{flex:1 1 auto}.v16-loan-guarantee{grid-template-columns:54px minmax(0,1fr)}.v16-loan-guarantee img{width:54px;height:54px}}
  `;
  document.head.appendChild(style);

  function getLocalJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function setLocalJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function getGoogleSessionV16(){try{return JSON.parse(sessionStorage.getItem(GOOGLE_SESSION_KEY)||'null')}catch{return null}}
  function setGoogleSessionV16(profile){
    sessionStorage.setItem(GOOGLE_SESSION_KEY,JSON.stringify(profile||null));
    document.getElementById('v11LoginOverlay')?.remove();
    document.body.classList.remove('v11-locked');
    const b=document.getElementById('accountQuickBtn');
    if(b){const label=String(profile?.name||profile?.email||'').trim();b.textContent=label?label.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase():'👤';b.title=`${profile?.name||profile?.email||'Conta'} — biometria`}
    window.dispatchEvent(new CustomEvent('credigestor:biometric-auth',{detail:profile||{}}));
    if(typeof render==='function')render();
  }
  function b64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function fromB64url(text){const s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');const p=s+'='.repeat((4-s.length%4)%4),raw=atob(p);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
  function randomBytes(n=32){const a=new Uint8Array(n);crypto.getRandomValues(a);return a}
  async function biometricSupportedV16(){
    if(!window.isSecureContext||!window.PublicKeyCredential||!navigator.credentials)return false;
    try{return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()}catch{return false}
  }
  function biometricRecordV16(){return getLocalJson(BIOMETRIC_KEY)}
  async function registerBiometricV16(){
    if(!(await biometricSupportedV16())){alert('Este navegador/aparelho não disponibiliza biometria ou passkey para este site. Use o login Google neste dispositivo.');return false}
    const profile=getGoogleSessionV16();
    if(!profile){alert('Entre primeiro com sua Conta Google. Depois ative a biometria para vincular este aparelho à sua conta.');return false}
    try{
      const userId=randomBytes(32),challenge=randomBytes(32);
      const cred=await navigator.credentials.create({publicKey:{
        challenge,
        rp:{name:state.settings?.appName||'CrediGestor'},
        user:{id:userId,name:profile.email||profile.name||'credigestor',displayName:profile.name||profile.email||'CrediGestor'},
        pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
        authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',requireResidentKey:false,userVerification:'required'},
        timeout:60000,attestation:'none'
      }});
      if(!cred)throw new Error('A biometria não foi cadastrada.');
      const rec={credentialId:b64url(cred.rawId),userId:b64url(userId),profile:{email:profile.email||'',name:profile.name||profile.email||'Conta Google',picture:profile.picture||'',sub:profile.sub||'',at:Date.now()},createdAt:new Date().toISOString()};
      setLocalJson(BIOMETRIC_KEY,rec);
      state.settings=state.settings||{};state.settings.requireGoogleLoginV11=true;saveState();
      alert('Biometria ativada neste aparelho. Na próxima abertura você poderá entrar pela impressão digital, rosto ou desbloqueio seguro do celular.');
      if(currentView==='settings'&&typeof renderSettings==='function')renderSettings();
      return true;
    }catch(err){
      if(err?.name!=='NotAllowedError')alert(err?.message||'Não foi possível cadastrar a biometria.');
      return false;
    }
  }
  async function authenticateBiometricV16(){
    const rec=biometricRecordV16();
    if(!rec?.credentialId){alert('A biometria ainda não foi cadastrada neste aparelho. Entre com Google e ative em Configurações > Conta e acesso.');return false}
    if(!(await biometricSupportedV16())){alert('A biometria não está disponível neste navegador. Use o login Google.');return false}
    try{
      const cred=await navigator.credentials.get({publicKey:{
        challenge:randomBytes(32),timeout:60000,userVerification:'required',
        allowCredentials:[{type:'public-key',id:fromB64url(rec.credentialId),transports:['internal']}]
      }});
      if(!cred||b64url(cred.rawId)!==rec.credentialId)throw new Error('A credencial biométrica não corresponde a este aparelho.');
      setGoogleSessionV16({...rec.profile,at:Date.now(),via:'biometric'});
      return true;
    }catch(err){
      if(err?.name!=='NotAllowedError')alert(err?.message||'Não foi possível validar a biometria.');
      return false;
    }
  }
  function removeBiometricV16(){
    if(!confirm('Remover o acesso por biometria deste aparelho? O login Google continuará disponível.'))return;
    localStorage.removeItem(BIOMETRIC_KEY);
    if(currentView==='settings'&&typeof renderSettings==='function')renderSettings();
  }
  window.registerBiometricV16=registerBiometricV16;
  window.authenticateBiometricV16=authenticateBiometricV16;

  function injectBiometricOverlayV16(){
    const overlay=document.getElementById('v11LoginOverlay'),rec=biometricRecordV16();
    if(!overlay||!rec?.credentialId||overlay.querySelector('#biometricLoginV16'))return;
    let actions=overlay.querySelector('.v11-login-actions');
    if(!actions){actions=document.createElement('div');actions.className='v11-login-actions';overlay.querySelector('.v11-login-card')?.appendChild(actions)}
    if(!actions)return;
    const b=document.createElement('button');b.type='button';b.id='biometricLoginV16';b.className='primary-btn v16-biometric-btn';b.innerHTML='<span>🔐</span> Entrar com biometria';b.onclick=authenticateBiometricV16;
    actions.insertBefore(b,actions.firstChild);
  }
  const observer=new MutationObserver(injectBiometricOverlayV16);observer.observe(document.documentElement,{childList:true,subtree:true});injectBiometricOverlayV16();

  function injectBiometricSettingsV16(){
    if(document.getElementById('biometricSettingsV16'))return;
    const account=document.getElementById('accountSettingsV11');if(!account)return;
    const rec=biometricRecordV16();
    const el=document.createElement('div');el.id='biometricSettingsV16';el.className='v16-biometric-card';
    el.innerHTML=`<div class="section-title"><h2>Biometria do celular</h2><small>Passkey</small></div><div class="card">
      ${rec?`<div class="v16-biometric-status"><span class="v16-biometric-dot"></span><div><div class="title">Biometria ativa neste aparelho</div><div class="muted">Vinculada a ${esc(rec.profile?.email||rec.profile?.name||'sua conta')}.</div></div></div>`:`<div class="muted">Use impressão digital, reconhecimento facial ou o desbloqueio seguro configurado no celular para abrir o CrediGestor.</div>`}
      <div class="actions">${rec?`<button type="button" class="primary-btn" id="testBiometricV16">🔐 Testar biometria</button><button type="button" class="ghost-btn" id="removeBiometricV16">Remover deste aparelho</button>`:`<button type="button" class="primary-btn" id="registerBiometricV16">🔐 Ativar biometria</button>`}</div>
      <div class="rule-note">A biometria fica registrada somente neste aparelho. O CrediGestor não recebe nem armazena sua impressão digital ou seu rosto. Em caso de troca de celular, entre com Google e cadastre a biometria novamente.</div>
    </div>`;
    account.insertAdjacentElement('afterend',el);
    document.getElementById('registerBiometricV16')?.addEventListener('click',registerBiometricV16);
    document.getElementById('testBiometricV16')?.addEventListener('click',authenticateBiometricV16);
    document.getElementById('removeBiometricV16')?.addEventListener('click',removeBiometricV16);
  }
  if(typeof renderSettings==='function'){
    const beforeSettingsV16=renderSettings;
    renderSettings=function(){const out=beforeSettingsV16();injectBiometricSettingsV16();return out};
  }

  function guaranteeLabelV16(c,k){
    const g=(c?.guarantees||[]).find(x=>x.id===k?.guaranteeIdV16);
    if(g)return `${g.type||'Garantia'}${g.description?` — ${g.description}`:''}`;
    return k?.guaranteeLabelV16||'Bem em garantia';
  }
  function dataUrlBytesV16(data=''){return Math.ceil(String(data).length*0.75)}
  async function compressPhotoV16(file){
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Selecione uma foto válida.');
    const source=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Não foi possível abrir a foto.'));i.src=source});
      async function make(max,quality){
        const scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
        const w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(img,0,0,w,h);return canvas.toDataURL('image/jpeg',quality);
      }
      let data=await make(1024,.70);
      if(dataUrlBytesV16(data)>380000)data=await make(800,.58);
      if(dataUrlBytesV16(data)>430000)throw new Error('A foto continua muito grande mesmo após a compactação. Tire uma foto com resolução menor.');
      return data;
    }finally{URL.revokeObjectURL(source)}
  }
  function photoEditorHtmlV16(photo,guarantees=[],selected=''){
    return `<div class="v16-guarantee-box" id="guaranteePhotoBoxV16"><div class="title">📷 Garantia / bem penhorado</div><div class="muted" style="margin:3px 0 10px">Fotografe o bem no momento do empréstimo. A imagem será compactada e ficará junto do contrato.</div>
      ${guarantees.length?`<div class="field"><label>Garantia vinculada</label><select id="kGuaranteeIdV16"><option value="">Sem vínculo específico</option>${guarantees.map(g=>`<option value="${esc(g.id)}" ${selected===g.id?'selected':''}>${esc((g.type||'Garantia')+(g.description?' — '+g.description:''))}</option>`).join('')}</select></div>`:''}
      <input id="guaranteeCameraV16" type="file" accept="image/*" capture="environment" hidden>
      <div id="guaranteePhotoPreviewV16">${photo?`<img class="v16-photo-preview" src="${photo}" alt="Foto da garantia">`:`<div class="v16-photo-empty">Nenhuma foto registrada.</div>`}</div>
      <div class="v16-photo-actions"><button type="button" class="small-btn" id="takeGuaranteePhotoV16">📷 ${photo?'Trocar foto':'Fotografar garantia'}</button>${photo?`<button type="button" class="ghost-btn" id="removeGuaranteePhotoV16">Remover foto</button>`:''}</div>
    </div>`;
  }
  function attachPhotoEditorV16(clientId,contractId){
    const c=(state.clients||[]).find(x=>x.id===clientId),k=contractId?(c?.contracts||[]).find(x=>x.id===contractId):null;if(!c)return;
    const content=document.getElementById('modalContent'),save=document.getElementById('saveContractBtn');if(!content||!save||content.querySelector('#guaranteePhotoBoxV16'))return;
    let pendingPhoto=k?.guaranteePhotoV16||'';
    let pendingGuarantee=k?.guaranteeIdV16||'';
    const anchor=content.querySelector('.rule-note')||save.closest('.actions');
    anchor?.insertAdjacentHTML('beforebegin',photoEditorHtmlV16(pendingPhoto,c.guarantees||[],pendingGuarantee));
    const input=document.getElementById('guaranteeCameraV16'),preview=document.getElementById('guaranteePhotoPreviewV16'),take=document.getElementById('takeGuaranteePhotoV16');
    if(take&&input)take.onclick=()=>input.click();
    if(input)input.onchange=async()=>{
      const f=input.files?.[0];if(!f)return;
      try{take.disabled=true;take.textContent='Compactando foto...';pendingPhoto=await compressPhotoV16(f);preview.innerHTML=`<img class="v16-photo-preview" src="${pendingPhoto}" alt="Foto da garantia">`;take.textContent='📷 Trocar foto';
        if(!document.getElementById('removeGuaranteePhotoV16')){const r=document.createElement('button');r.type='button';r.className='ghost-btn';r.id='removeGuaranteePhotoV16';r.textContent='Remover foto';take.parentElement.appendChild(r);r.onclick=()=>{pendingPhoto='';preview.innerHTML='<div class="v16-photo-empty">Nenhuma foto registrada.</div>';r.remove();take.textContent='📷 Fotografar garantia'}}
      }catch(e){alert(e.message||'Não foi possível processar a foto.')}finally{take.disabled=false;input.value=''}
    };
    document.getElementById('removeGuaranteePhotoV16')?.addEventListener('click',e=>{pendingPhoto='';preview.innerHTML='<div class="v16-photo-empty">Nenhuma foto registrada.</div>';e.currentTarget.remove();take.textContent='📷 Fotografar garantia'});
    const original=save.onclick;
    const idsBefore=new Set((c.contracts||[]).map(x=>x.id));
    save.onclick=()=>{
      pendingGuarantee=document.getElementById('kGuaranteeIdV16')?.value||'';
      if(k){k.guaranteePhotoV16=pendingPhoto;k.guaranteeIdV16=pendingGuarantee;const g=(c.guarantees||[]).find(x=>x.id===pendingGuarantee);if(g&&pendingPhoto)g.photoV16=pendingPhoto}
      original?.();
      if(!k){const created=(c.contracts||[]).slice().reverse().find(x=>!idsBefore.has(x.id));if(created){created.guaranteePhotoV16=pendingPhoto;created.guaranteeIdV16=pendingGuarantee;const g=(c.guarantees||[]).find(x=>x.id===pendingGuarantee);if(g&&pendingPhoto)g.photoV16=pendingPhoto;saveState()}}
    };
  }

  if(typeof openContractModal==='function'){
    const beforeContractV16=openContractModal;
    openContractModal=function(clientId,contractId){const out=beforeContractV16(clientId,contractId);attachPhotoEditorV16(clientId,contractId);return out};
  }

  function decorateLoanGuaranteesV16(){
    document.querySelectorAll('#view .loan-card').forEach(card=>{
      if(card.querySelector('.v16-loan-guarantee'))return;
      const ref=card.querySelector('.edit-loan2');if(!ref)return;
      const c=(state.clients||[]).find(x=>x.id===ref.dataset.client),k=(c?.contracts||[]).find(x=>x.id===ref.dataset.loan);if(!c||!k||!k.guaranteePhotoV16)return;
      const div=document.createElement('div');div.className='v16-loan-guarantee';div.innerHTML=`<img src="${k.guaranteePhotoV16}" alt="Garantia"><div><strong>📷 Garantia registrada</strong><small>${esc(guaranteeLabelV16(c,k))}</small><small>Toque em Editar para trocar a foto.</small></div>`;
      card.appendChild(div);
    });
  }
  if(typeof renderLoans2==='function'){
    const beforeLoansV16=renderLoans2;
    renderLoans2=function(){const out=beforeLoansV16();decorateLoanGuaranteesV16();return out};
  }

  function decorateGuaranteesV16(clientId){
    const c=(state.clients||[]).find(x=>x.id===clientId);if(!c)return;
    document.querySelectorAll('#modalContent .edit-guarantee').forEach(btn=>{
      const g=(c.guarantees||[]).find(x=>x.id===btn.dataset.id);if(!g?.photoV16)return;
      const card=btn.closest('.contract-card');if(card&&!card.querySelector('.v16-guarantee-thumb')){const img=document.createElement('img');img.className='v16-guarantee-thumb';img.src=g.photoV16;img.alt='Foto da garantia';card.appendChild(img)}
    });
  }
  if(typeof openClientDetail==='function'){
    const beforeClientV16=openClientDetail;
    openClientDetail=function(id){const out=beforeClientV16(id);decorateGuaranteesV16(id);return out};
  }

  function attachGuaranteeModalPhotoV16(clientId,guaranteeId){
    const c=(state.clients||[]).find(x=>x.id===clientId),g=guaranteeId?(c?.guarantees||[]).find(x=>x.id===guaranteeId):null;if(!c)return;
    const content=document.getElementById('modalContent'),save=document.getElementById('saveGuaranteeBtn');if(!content||!save||content.querySelector('#guaranteePhotoBoxV16'))return;
    let pendingPhoto=g?.photoV16||'';
    const actions=save.closest('.actions');actions?.insertAdjacentHTML('beforebegin',photoEditorHtmlV16(pendingPhoto,[],''));
    const input=document.getElementById('guaranteeCameraV16'),preview=document.getElementById('guaranteePhotoPreviewV16'),take=document.getElementById('takeGuaranteePhotoV16');
    take.onclick=()=>input.click();
    input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{take.disabled=true;take.textContent='Compactando foto...';pendingPhoto=await compressPhotoV16(f);preview.innerHTML=`<img class="v16-photo-preview" src="${pendingPhoto}" alt="Foto da garantia">`;take.textContent='📷 Trocar foto'}catch(e){alert(e.message||'Não foi possível processar a foto.')}finally{take.disabled=false;input.value=''}};
    document.getElementById('removeGuaranteePhotoV16')?.addEventListener('click',e=>{pendingPhoto='';preview.innerHTML='<div class="v16-photo-empty">Nenhuma foto registrada.</div>';e.currentTarget.remove();take.textContent='📷 Fotografar garantia'});
    const original=save.onclick,idsBefore=new Set((c.guarantees||[]).map(x=>x.id));
    save.onclick=()=>{if(g)g.photoV16=pendingPhoto;original?.();if(!g){const created=(c.guarantees||[]).slice().reverse().find(x=>!idsBefore.has(x.id));if(created){created.photoV16=pendingPhoto;saveState()}}};
  }
  if(typeof openGuaranteeModal==='function'){
    const beforeGuaranteeV16=openGuaranteeModal;
    openGuaranteeModal=function(clientId,guaranteeId){const out=beforeGuaranteeV16(clientId,guaranteeId);attachGuaranteeModalPhotoV16(clientId,guaranteeId);return out};
  }

  if(currentView==='settings')injectBiometricSettingsV16();
  if(currentView==='loans')decorateLoanGuaranteesV16();
})();
