// CrediGestor — Cópia automática da carteira na nuvem (Firebase).
// Somente a conta principal. A nuvem nunca é sobrescrita às cegas:
// cada envio confere a revisão; se outro aparelho salvou antes, o app pergunta.
(function(){
  'use strict';
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1',ORG='org_'+OWNER;
  const META='credigestor_cloud_sync:'+OWNER,DEVICE='credigestor_cloud_device';
  const DELAY=4000,RETRY=60000;
  const C=window.CrediGestorCore;
  const session=window.CREDIGESTOR_WALLET_SESSION;
  if(!C||!session||session.uid!==OWNER||typeof firebase==='undefined'||!firebase.firestore)return;

  let status={mode:'idle',at:null,error:''},timer=null,busy=false,again=false,conflict=null,asked=-1;
  const listeners=new Set();

  function readMeta(){try{return JSON.parse(localStorage.getItem(META))||null}catch(_){return null}}
  function writeMeta(m){localStorage.setItem(META,JSON.stringify(m))}
  function device(){let id=localStorage.getItem(DEVICE);if(!id){id='dev_'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));localStorage.setItem(DEVICE,id)}return id}
  function ref(){return firebase.firestore().collection('organizations').doc(ORG).collection('appData').doc('main')}
  function root(){return firebase.firestore().collection('organizations').doc(ORG)}
  function signedIn(){return firebase.auth().currentUser?.uid===OWNER}
  function guard(){if(!signedIn())throw Object.assign(Error('A conta mudou. Envio cancelado.'),{code:'cancelled'})}
  // Envios deste recurso usam writerId "dev_…"; a migração antiga usava outro formato.
  function synced(cloud){return /^dev_/.test(cloud.writerId||'')&&cloud.writerId!==device()}
  function stamp(){return firebase.firestore.FieldValue.serverTimestamp()}
  function snapshot(){return C.validate(JSON.parse(JSON.stringify(state)))}
  async function digest(value){return C.hash(C.stable(value))}
  function set(mode,extra={}){status={...status,mode,...extra};listeners.forEach(fn=>{try{fn(status)}catch(_){}});paint()}
  function when(d){try{return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return ''}}
  function archive(value,key){return new Promise((resolve,reject)=>{const r=indexedDB.open('credigestor-individual-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>reject(Error('Não foi possível guardar a cópia de segurança no aparelho.'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(Error('Não foi possível guardar a cópia de segurança no aparelho.'))}}})}

  function label(){
    const s=status;
    if(s.mode==='saving')return 'Nuvem: enviando…';
    if(s.mode==='saved')return 'Nuvem: salvo '+when(s.at);
    if(s.mode==='pending')return 'Nuvem: alterações aguardando internet';
    if(s.mode==='conflict')return 'Nuvem: outro aparelho salvou uma versão diferente';
    if(s.mode==='error')return 'Nuvem: erro — '+s.error;
    return 'Nuvem: verificando…';
  }
  function paint(){
    document.querySelectorAll('[data-cloud-status]').forEach(el=>{el.textContent=label();el.dataset.mode=status.mode});
    document.querySelectorAll('[data-cloud-resolve]').forEach(el=>{el.hidden=status.mode!=='conflict'});
  }

  async function loadCloud(){
    const snap=await ref().get({source:'server'});guard();
    if(!snap.exists)return null;
    const data=snap.data();
    const [head,receipts]=await Promise.all([C.hydrate(ref(),data,guard),root().collection('paymentEvents').get({source:'server'})]);guard();
    const projection=C.materialize(head,new Map(receipts.docs.map(d=>[d.id,d.data()])));
    return {revision:data.revision,writerId:data.writerId||'',updatedAt:data.updatedAt?.toDate?.()||null,applied:data.storage?{}:(data.appliedEvents||{}),state:C.validate(projection.state),raw:data};
  }

  // Envia a carteira local. expected = revisão que este aparelho conhece.
  async function push(force=false){
    if(busy){again=true;return}
    if(!signedIn())return;
    if(!navigator.onLine){set('pending');return}
    busy=true;set('saving');
    try{
      const local=snapshot(),hash=await digest(local),meta=readMeta();
      const cloud=await loadCloud();
      const revision=cloud?cloud.revision:-1;
      if(meta&&meta.hash===hash&&meta.revision===revision){set('saved',{at:meta.at,error:''});return}
      if(cloud&&!force&&((meta&&meta.revision!==revision)||(!meta&&synced(cloud)))){
        // Outro aparelho enviou depois do último envio deste aparelho.
        conflict=cloud;set('conflict');if(asked!==cloud.revision){asked=cloud.revision;resolveDialog()}return;
      }
      if(cloud&&(!meta||force))await archive({revision:cloud.revision,writerId:cloud.writerId,state:cloud.state,savedAt:new Date().toISOString()},'cloud-before-sync-'+cloud.revision);
      if(!cloud)throw Error('Carteira da nuvem não encontrada. Nada foi alterado.');
      const next=await C.commit(firebase.firestore(),ref(),revision,local,cloud.applied,OWNER,device(),stamp,guard);
      const at=new Date().toISOString();
      writeMeta({revision:next,hash,at});conflict=null;set('saved',{at,error:''});
    }catch(e){
      if(e.code==='cancelled'){set('idle');return}
      if(e.code==='conflict'){try{conflict=await loadCloud()}catch(_){}set('conflict');return}
      if(!navigator.onLine||e.code==='unavailable'){set('pending');return}
      set('error',{error:e.code==='permission-denied'?'o Firebase recusou a gravação (permissão).':(e.message||'falha desconhecida')});
    }finally{
      busy=false;
      if(again){again=false;schedule()}
    }
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>push(),DELAY)}

  // Ao abrir: se a nuvem for mais nova e este aparelho não tiver alterações, carrega a nuvem.
  async function check(){
    if(!signedIn())return;
    if(!navigator.onLine){set('pending');return}
    try{
      const meta=readMeta(),cloud=await loadCloud();if(!cloud)return;
      const localHash=await digest(snapshot());
      if(!meta){
        if(localHash===await digest(cloud.state)){writeMeta({revision:cloud.revision,hash:localHash,at:new Date().toISOString()});set('saved',{at:new Date().toISOString()});return}
        // Nuvem já recebeu envio de outro aparelho: perguntar antes de substituir.
        if(synced(cloud)){conflict=cloud;set('conflict');if(asked!==cloud.revision){asked=cloud.revision;resolveDialog()}return}
        schedule();return;
      }
      if(cloud.revision===meta.revision){if(localHash!==meta.hash)schedule();else set('saved',{at:meta.at});return}
      if(localHash===meta.hash){await adopt(cloud,true);return}
      conflict=cloud;set('conflict');if(asked!==cloud.revision){asked=cloud.revision;resolveDialog()}
    }catch(e){if(e.code!=='cancelled')set(navigator.onLine?'error':'pending',{error:e.message||''})}
  }

  // Troca a carteira local pela da nuvem, guardando a local antes.
  async function adopt(cloud,silent=false){
    await archive({state:snapshot(),savedAt:new Date().toISOString()},'local-before-cloud-'+cloud.revision+'-'+Date.now());
    Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),C.clone(cloud.state));
    localStorage.setItem(session.key,JSON.stringify(state));
    writeMeta({revision:cloud.revision,hash:await digest(snapshot()),at:new Date().toISOString()});
    conflict=null;
    try{applySettings();render()}catch(_){}
    set('saved',{at:new Date().toISOString(),error:''});
    if(!silent)alert('Carteira da nuvem carregada. A versão anterior deste aparelho foi guardada como cópia de segurança.');
  }

  function resolveDialog(){
    if(!conflict)return;
    const c=conflict,clients=c.state.clients.length,localClients=(state.clients||[]).length;
    openModal(`<h2>Duas versões da carteira</h2>
      <p>Outro aparelho salvou a carteira na nuvem${c.updatedAt?' em '+when(c.updatedAt):''}, e este aparelho também tem alterações ainda não enviadas.</p>
      <p><b>Nuvem:</b> ${clients} cliente(s). <b>Este aparelho:</b> ${localClients} cliente(s).</p>
      <p>A versão que não for escolhida fica guardada como cópia de segurança neste aparelho.</p>
      <div class="v26-actions"><button type="button" id="cloudUseRemote" class="soft-btn">Usar a versão da nuvem</button>
      <button type="button" id="cloudUseLocal" class="soft-btn">Manter a deste aparelho e enviar</button></div>`,()=>{
      document.getElementById('cloudUseRemote').onclick=async()=>{try{closeModal();await adopt(c)}catch(e){alert(e.message)}};
      document.getElementById('cloudUseLocal').onclick=async()=>{if(!confirm('Substituir a versão da nuvem pela deste aparelho?'))return;closeModal();await push(true)};
    });
  }

  function card(){
    const el=document.createElement('div');el.className='card';el.id='cloudBackupCard';
    el.innerHTML=`<h2>Cópia na nuvem</h2><p>A carteira é enviada automaticamente para sua conta no Firebase a cada alteração. Ao abrir em outro aparelho, a versão mais recente é carregada.</p>
      <p data-cloud-status role="status"></p>
      <div class="v26-actions"><button type="button" class="soft-btn" id="cloudNow">Enviar agora</button><button type="button" class="soft-btn" data-cloud-resolve hidden id="cloudResolve">Resolver versões</button></div>`;
    el.querySelector('#cloudNow').onclick=()=>push();
    el.querySelector('#cloudResolve').onclick=()=>resolveDialog();
    return el;
  }

  // Salvar local continua igual; depois agenda o envio.
  const baseSave=saveState;
  saveState=function(){const out=baseSave.apply(this,arguments);schedule();return out};
  const baseSettings=renderSettings;
  renderSettings=function(){const out=baseSettings.apply(this,arguments);const view=document.getElementById('view');if(view&&!view.querySelector('#cloudBackupCard')){const first=view.querySelector('.card');const c=card();if(first&&first.nextSibling)view.insertBefore(c,first.nextSibling);else view.append(c)}paint();return out};
  if(typeof currentView!=='undefined'&&currentView==='settings')renderSettings();

  window.addEventListener('online',()=>push());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){clearTimeout(timer);timer=null;push()}else if(!document.hidden)check()});
  setInterval(()=>{if(status.mode==='pending'||status.mode==='error')push()},RETRY);

  window.CrediGestorCloudBackup=Object.freeze({push,check,status:()=>({...status}),label,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},resolve:resolveDialog});
  check();
})();
