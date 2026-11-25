// Dois aparelhos com a mesma conta: alterações aparecem no outro em tempo real.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../firebase-hosting/realtime-sync.js'),'utf8');
const tick=(ms=20)=>new Promise(r=>setTimeout(r,ms));
// Firestore em memória com a parte da API usada pela sincronização.
function fakeFirestore(){
  const docs=new Map(),listeners=[];
  const notify=changed=>setTimeout(()=>{for(const l of listeners)l(changed)},0);
  const snapDoc=p=>({id:p.split('/').pop(),exists:docs.has(p),data:()=>docs.has(p)?JSON.parse(JSON.stringify(docs.get(p))):undefined,metadata:{hasPendingWrites:false}});
  const docRef=p=>({id:p.split('/').pop(),path:p,collection:n=>colRef(p+'/'+n),
    get:async()=>snapDoc(p),set:async d=>{docs.set(p,resolve(d));notify([p])},
    onSnapshot(cb){setTimeout(()=>cb(snapDoc(p)),0);listeners.push(ch=>{if(ch.includes(p))cb(snapDoc(p))});return()=>{}}});
  const inCol=(c,p)=>p.startsWith(c+'/')&&!p.slice(c.length+1).includes('/');
  const colRef=c=>({path:c,doc:id=>docRef(c+'/'+id),parent:null,
    get:async()=>({docs:[...docs.keys()].filter(p=>inCol(c,p)).map(snapDoc)}),
    onSnapshot(cb){const emit=paths=>{const ch=paths.filter(p=>inCol(c,p)).map(p=>({type:'modified',doc:snapDoc(p)}));if(ch.length)cb({metadata:{hasPendingWrites:false},docChanges:()=>ch})};
      setTimeout(()=>emit([...docs.keys()]),0);listeners.push(emit);return()=>{}}});
  const resolve=d=>JSON.parse(JSON.stringify(d,(k,v)=>v==='__ts__'?Date.now():v));
  const db={collection:colRef,batch(){const ops=[];return{set:(r,d)=>ops.push([r.path,d]),commit:async()=>{for(const [p,d] of ops)docs.set(p,resolve(d));notify(ops.map(o=>o[0]))}}}};
  return {db,docs};
}
function device(name,shared,clients){
  const storage=new Map();
  const c={console,JSON,Math,Date,Map,Set,Promise,Object,Array,String,Number,setTimeout,clearTimeout,
    navigator:{onLine:true},addEventListener(){},confirm:()=>true,
    localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))},
    indexedDB:{open(){const r={result:{createObjectStore(){},transaction(){const tx={objectStore:()=>({put(){}})};setTimeout(()=>tx.oncomplete());return tx},close(){}}};setTimeout(()=>r.onsuccess());return r}},
    document:{body:{appendChild(){}},createElement:()=>({style:{}}),getElementById:id=>c.modalButtons[id]},
    state:{clients,settings:{theme:'dark'},goals:{}},renders:0,saves:0,modalButtons:{},choice:null};
  c.window=c;c.saveState=()=>{c.saves++;storage.set('wallet',JSON.stringify(c.state));};
  c.render=()=>c.renders++;c.applySettings=()=>{};c.closeModal=()=>{};
  c.openModal=(html,bind)=>{c.modalButtons={rtUseCloud:{},rtUseLocal:{}};bind();c.modalButtons[c.choice==='local'?'rtUseLocal':'rtUseCloud'].onclick();};
  c.firebase={auth:()=>({currentUser:{uid:'owner'}}),firestore:Object.assign(()=>shared.db,{FieldValue:{serverTimestamp:()=>'__ts__'}})};
  vm.createContext(c);c.boot=()=>vm.runInContext(code,c,{filename:name});return c;
}
(async()=>{
  const shared=fakeFirestore();
  // Aparelho A tem a carteira; a nuvem está vazia: A envia tudo.
  const A=device('A',shared,[{id:'c1',name:'Ana',contracts:[]},{id:'c2',name:'Bruno',contracts:[]}]);A.boot();await tick(60);
  assert.equal([...shared.docs.keys()].filter(k=>k.includes('/clients/')).length,2);
  // Aparelho B novo, sem dados: recebe tudo da nuvem.
  const B=device('B',shared,[]);B.boot();await tick(60);
  assert.deepEqual([...B.state.clients].map(c=>c.name),['Ana','Bruno']);assert.equal(B.state.settings.theme,'dark');
  // Pagamento lançado em A aparece em B.
  A.state.clients[0].contracts.push({id:'k1',payments:[{reference:'2026-11',amount:100}]});A.saveState();await tick(900);
  assert.equal(B.state.clients[0].contracts[0].payments[0].amount,100);assert.ok(B.renders>0);
  // Cliente novo em B aparece em A; exclusão em A some em B; ordem preservada.
  B.state.clients.push({id:'c3',name:'Carla',contracts:[]});B.saveState();await tick(900);
  assert.deepEqual([...A.state.clients].map(c=>c.name),['Ana','Bruno','Carla']);
  A.state.clients=A.state.clients.filter(c=>c.id!=='c2');A.saveState();await tick(900);
  assert.deepEqual([...B.state.clients].map(c=>c.name),['Ana','Carla']);
  // Configuração alterada em B chega em A.
  B.state.settings.theme='light';B.saveState();await tick(900);assert.equal(A.state.settings.theme,'light');
  // Aparelho C com dados próprios escolhe usar a nuvem: fica igual aos demais.
  const C=device('C',shared,[{id:'old',name:'Antigo',contracts:[]}]);C.choice='cloud';C.boot();await tick(80);
  assert.deepEqual([...C.state.clients].map(c=>c.name),['Ana','Carla']);
  // Aparelho D escolhe enviar os seus dados: substitui a nuvem e os outros recebem.
  const D=device('D',shared,[{id:'d1',name:'Diego',contracts:[]}]);D.choice='local';D.boot();await tick(900);
  assert.deepEqual([...A.state.clients].map(c=>c.name),['Diego']);assert.deepEqual([...B.state.clients].map(c=>c.name),['Diego']);
  console.log('PASS: dados iguais e simultâneos entre aparelhos (lançamentos, clientes, exclusões, configurações e primeira conexão).');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
