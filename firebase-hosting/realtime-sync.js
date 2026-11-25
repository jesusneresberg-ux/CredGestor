// Sincronização em tempo real entre aparelhos (Firestore).
// A carteira fica em personalWallets/{uid}: um documento por cliente em /clients e o restante
// (configurações, metas, ordem dos clientes) no documento principal. Cada alteração envia só os
// clientes que mudaram; os outros aparelhos recebem a mudança na hora e atualizam a tela.
// Um cliente com alteração local ainda não enviada não é substituído pela nuvem (a alteração
// local é enviada em seguida). Na primeira conexão de um aparelho, se a nuvem já tiver dados,
// o usuário escolhe qual versão manter; a outra fica guardada em cópia no aparelho.
(function(){
  if(typeof firebase==='undefined'||!firebase.firestore||!firebase.auth)return;
  const user=firebase.auth().currentUser;if(!user)return;
  const uid=user.uid,db=firebase.firestore(),root=db.collection('personalWallets').doc(uid),clientsRef=root.collection('clients');
  const META_KEY='credigestor-realtime-sync-v1:'+uid,DEVICE_KEY='credigestor-device-id';
  const deviceId=localStorage.getItem(DEVICE_KEY)||(()=>{const id='dev_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(DEVICE_KEY,id);return id;})();
  const hash=text=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (h2>>>0).toString(36)+(h1>>>0).toString(36);};
  const readMeta=()=>{try{return {clients:{},top:'',initialized:false,...JSON.parse(localStorage.getItem(META_KEY)||'{}')}}catch(_){return {clients:{},top:'',initialized:false}}};
  let meta=readMeta();const writeMeta=()=>localStorage.setItem(META_KEY,JSON.stringify(meta));
  const topOf=()=>{const top={};for(const k of Object.keys(state))if(k!=='clients')top[k]=state[k];return JSON.stringify(top);};
  const clientJson=c=>JSON.stringify(c);
  let ready=false,applying=false,pushTimer=null,pushing=null,renderTimer=null,unsubs=[];

  // Indicador discreto do estado da sincronização.
  const pill=document.createElement('div');pill.id='rtSyncPill';
  pill.style.cssText='position:fixed;left:10px;bottom:10px;z-index:9999;padding:4px 10px;border-radius:999px;font:600 12px system-ui,sans-serif;background:#1e293b;color:#e2e8f0;opacity:.85;pointer-events:none';
  document.body.appendChild(pill);
  const status=(text,color)=>{pill.textContent=text;pill.style.background=color||'#1e293b';};
  status('Conectando…');
  window.addEventListener('offline',()=>status('Sem internet — salvo no aparelho','#92400e'));
  window.addEventListener('online',()=>{status('Sincronizando…');if(!ready)begin();else schedulePush(200);});

  // A sincronização antiga pelo Google Drive substitui a carteira inteira; fica desligada aqui.
  try{const k='credigestor-sync-meta-v12',m=JSON.parse(localStorage.getItem(k)||'{}');if(m.auto!==false){m.auto=false;localStorage.setItem(k,JSON.stringify(m));}}catch(_){}

  function archive(value,key){return new Promise(resolve=>{try{const r=indexedDB.open('credigestor-individual-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>resolve(false);r.onsuccess=()=>{const d=r.result,tx=d.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>{d.close();resolve(true)};tx.onerror=()=>{d.close();resolve(false)};};}catch(_){resolve(false)}});}

  function persistLocal(){applying=true;try{saveState();}finally{applying=false;}}
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{try{if(typeof applySettings==='function')applySettings();if(typeof render==='function')render();}catch(e){console.warn(e)}},250);}

  // Envia somente o que mudou desde a última sincronização.
  async function push(full=false){
    if(!ready&&!full)return;
    const writes=[],ids=new Set(),stamp=firebase.firestore.FieldValue.serverTimestamp();
    for(const c of state.clients||[]){
      ids.add(c.id);const json=clientJson(c),h=hash(json);
      if(full||meta.clients[c.id]!==h)writes.push({ref:clientsRef.doc(c.id),data:{json,hash:h,deleted:false,device:deviceId,updatedAt:stamp},id:c.id,h});
    }
    for(const id of Object.keys(meta.clients))if(!ids.has(id))writes.push({ref:clientsRef.doc(id),data:{json:'',hash:'',deleted:true,device:deviceId,updatedAt:stamp},id,h:null});
    const top=topOf(),topHash=hash(top),order=(state.clients||[]).map(c=>c.id),orderHash=hash(order.join(','));
    const topChanged=full||meta.top!==topHash||meta.order!==orderHash;
    if(!writes.length&&!topChanged)return;
    status('Sincronizando…');
    for(let i=0;i<writes.length||(i===0&&topChanged);i+=400){
      const batch=db.batch(),slice=writes.slice(i,i+400);
      for(const w of slice)batch.set(w.ref,w.data);
      if(i+400>=writes.length&&topChanged)batch.set(root,{top,topHash,order,device:deviceId,updatedAt:stamp,schema:1});
      await batch.commit();
      for(const w of slice){if(w.h===null)delete meta.clients[w.id];else meta.clients[w.id]=w.h;}
      if(i+400>=writes.length&&topChanged){meta.top=topHash;meta.order=orderHash;}
      writeMeta();
    }
    status('Sincronizado','#166534');
  }
  function schedulePush(delay=700){
    if(!ready)return;clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{pushing=(pushing||Promise.resolve()).then(()=>push()).catch(e=>{console.warn('Sincronização',e);status(navigator.onLine?'Falha ao sincronizar — tentando de novo':'Sem internet — salvo no aparelho','#92400e');setTimeout(()=>schedulePush(),15000);});},delay);
  }
  const baseSave=window.saveState;
  window.saveState=function(){const result=baseSave.apply(this,arguments);if(!applying)schedulePush();return result;};

  // Aplica alterações vindas de outros aparelhos.
  function applyClient(id,data){
    const index=(state.clients||[]).findIndex(c=>c.id===id),local=index>=0?state.clients[index]:null;
    if(local&&meta.clients[id]&&hash(clientJson(local))!==meta.clients[id])return false; // edição local pendente
    if(data.deleted){if(index<0){delete meta.clients[id];return false;}state.clients.splice(index,1);delete meta.clients[id];return true;}
    if(meta.clients[id]===data.hash&&local)return false;
    const remote=JSON.parse(data.json);
    if(index>=0)state.clients[index]=remote;else state.clients.push(remote);
    meta.clients[id]=data.hash;return true;
  }
  function applyTop(data){
    if(!data)return false;let changed=false;
    if(data.topHash&&data.topHash!==meta.top&&hash(topOf())===meta.top){
      const top=JSON.parse(data.top);for(const k of Object.keys(state))if(k!=='clients'&&!(k in top))delete state[k];Object.assign(state,top);meta.top=data.topHash;changed=true;
    }
    if(Array.isArray(data.order)){
      const pos=new Map(data.order.map((id,i)=>[id,i])),before=state.clients.map(c=>c.id).join(',');
      state.clients.sort((a,b)=>(pos.has(a.id)?pos.get(a.id):1e9)-(pos.has(b.id)?pos.get(b.id):1e9));
      if(state.clients.map(c=>c.id).join(',')!==before)changed=true;
      meta.order=hash(state.clients.map(c=>c.id).join(','));
    }
    return changed;
  }
  function listen(){
    unsubs.push(clientsRef.onSnapshot(snap=>{
      if(snap.metadata.hasPendingWrites)return;
      let changed=false;
      for(const ch of snap.docChanges()){if(ch.type==='removed')continue;if(applyClient(ch.doc.id,ch.doc.data()))changed=true;}
      if(changed){writeMeta();persistLocal();scheduleRender();}
      status(navigator.onLine?'Sincronizado':'Sem internet — salvo no aparelho',navigator.onLine?'#166534':'#92400e');
      schedulePush(300); // envia edições locais que estavam pendentes
    },e=>{console.warn(e);status('Sincronização indisponível','#991b1b');}));
    unsubs.push(root.onSnapshot(doc=>{
      if(doc.metadata.hasPendingWrites||!doc.exists)return;
      if(applyTop(doc.data())){writeMeta();persistLocal();scheduleRender();}
    },e=>console.warn(e)));
  }

  async function replaceWithCloud(){
    const snap=await clientsRef.get({source:'server'}),head=await root.get({source:'server'});
    const clients=[];meta.clients={};
    for(const d of snap.docs){const x=d.data();if(x.deleted)continue;clients.push(JSON.parse(x.json));meta.clients[d.id]=x.hash;}
    const data=head.data()||{};
    if(data.top){const top=JSON.parse(data.top);for(const k of Object.keys(state))if(k!=='clients')delete state[k];Object.assign(state,top);meta.top=data.topHash;}
    state.clients=clients;applyTop({order:data.order});
    persistLocal();
  }
  function choose(){return new Promise(resolve=>{
    openModal(`<h2>Sincronizar aparelhos</h2><p>Já existem dados do CrediGestor na nuvem desta conta, e este aparelho também tem dados.</p><p>Escolha qual versão manter em todos os aparelhos. A outra fica guardada como cópia neste aparelho.</p><div class="form-actions" style="display:flex;flex-direction:column;gap:8px"><button type="button" class="primary-btn" id="rtUseCloud">Usar os dados da nuvem</button><button type="button" class="soft-btn" id="rtUseLocal">Enviar os dados deste aparelho</button></div>`,()=>{
      document.getElementById('rtUseCloud').onclick=()=>{closeModal();resolve('cloud')};
      document.getElementById('rtUseLocal').onclick=()=>{if(confirm('Os dados deste aparelho vão substituir os da nuvem em todos os aparelhos. Continuar?')){closeModal();resolve('local')}};
    });
  });}

  async function start(){
    if(!meta.initialized){
      const head=await root.get({source:'server'});
      const hasLocal=(state.clients||[]).length>0;
      if(!head.exists){
        await push(true);
      }else if(!hasLocal){
        await replaceWithCloud();scheduleRender();
      }else{
        const choice=await choose();
        await archive(JSON.stringify(state),'before-realtime-sync-'+choice+'-'+Date.now());
        if(choice==='cloud'){await replaceWithCloud();scheduleRender();}
        else{
          const existing=await clientsRef.get({source:'server'});meta.clients={};
          for(const d of existing.docs)if(!d.data().deleted)meta.clients[d.id]='x'; // marca para apagar o que não existe aqui
          await push(true);
        }
      }
      meta.initialized=true;writeMeta();
    }
    ready=true;listen();
  }
  window.CrediGestorRealtimeSync=Object.freeze({pushNow:()=>push(),status:()=>pill.textContent,deviceId});
  let starting=null;
  function begin(){if(ready||starting)return;starting=start().catch(e=>{console.warn('Sincronização em tempo real',e);status(e.code==='permission-denied'?'Sincronização sem permissão':navigator.onLine?'Sincronização indisponível':'Sem internet — salvo no aparelho','#991b1b');}).finally(()=>{starting=null;});}
  begin();
})();
