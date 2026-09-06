
const DB_KEY = 'credigestor_v1';
const THEMES = {
  aurora: {
    name:'Aurora',
    accent:'#2563eb', accent2:'#4f46e5',
    wallpaper:'radial-gradient(circle at 10% 0%, rgba(59,130,246,.16), transparent 36%),radial-gradient(circle at 100% 20%, rgba(99,102,241,.12), transparent 34%),linear-gradient(180deg,#f8fbff 0%,#eef3f9 100%)'
  },
  floresta: {
    name:'Floresta',
    accent:'#047857', accent2:'#0f766e',
    wallpaper:'radial-gradient(circle at 12% 10%, rgba(16,185,129,.18), transparent 32%),radial-gradient(circle at 90% 22%, rgba(20,184,166,.14), transparent 33%),linear-gradient(180deg,#f4fbf7,#e9f4ef)'
  },
  grafite: {
    name:'Grafite',
    accent:'#7c3aed', accent2:'#334155',
    wallpaper:'radial-gradient(circle at 10% 0%, rgba(124,58,237,.20), transparent 30%),linear-gradient(180deg,#e9eaf0,#dfe4ea)'
  },
  sunset: {
    name:'Sunset',
    accent:'#c2410c', accent2:'#be123c',
    wallpaper:'radial-gradient(circle at 10% 0%, rgba(251,146,60,.22), transparent 33%),radial-gradient(circle at 94% 20%, rgba(244,63,94,.16), transparent 30%),linear-gradient(180deg,#fff8f1,#f7ecea)'
  }
};

const state = loadState();
let currentView = 'dashboard';
let clientSearch = '';
let chargeFilter = 'month';

function defaultState(){
  return {
    clients:[],
    settings:{
      appName:'CrediGestor',
      theme:'aurora',
      font:'"Segoe UI", Arial, sans-serif',
      customWallpaper:'',
      googleCalendar:false,
      notifications:false,
      notifyDays:[7,3,1,0]
    },
    goals:{ monthlyReceipt:0, maxDelinquency:10 }
  };
}
function loadState(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    return raw ? {...defaultState(),...JSON.parse(raw)} : defaultState();
  }catch(e){ return defaultState(); }
}
function saveState(){
  localStorage.setItem(DB_KEY, JSON.stringify(state));
  applySettings();
}
function uid(prefix='id'){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
function brl(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function monthRef(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function refLabel(ref){ const [y,m]=ref.split('-'); return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); }
function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function dueDateFor(year, monthIndex, baseDay){
  const last = new Date(year, monthIndex+1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Number(baseDay)||1,last),12,0,0);
}
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function compactDate(d){ return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function contractBalance(c){
  return Math.max(0,(Number(c.initialPrincipal)||0)+(c.movements||[]).reduce((t,m)=>t+(m.type==='increase'?Number(m.amount):-Number(m.amount)),0));
}
function monthlyDue(c){
  const bal=contractBalance(c);
  if(c.billingType==='fixed') return Number(c.fixedAmount)||0;
  return bal*(Number(c.interestRate)||0)/100;
}
function clientBalance(cl){ return (cl.contracts||[]).filter(c=>c.active!==false).reduce((t,c)=>t+contractBalance(c),0); }
function clientMonthlyDue(cl){ return (cl.contracts||[]).filter(c=>c.active!==false).reduce((t,c)=>t+monthlyDue(c),0); }
function getPayment(c,ref){ return (c.payments||[]).find(p=>p.reference===ref); }
function activeContracts(){
  return state.clients.flatMap(cl=>(cl.contracts||[]).filter(c=>c.active!==false).map(c=>({cl,c})));
}
function chargeFor(cl,c,year,monthIndex){
  const ref=`${year}-${String(monthIndex+1).padStart(2,'0')}`;
  const due=dueDateFor(year,monthIndex,c.baseDueDay);
  const payment=getPayment(c,ref);
  const amount=monthlyDue(c);
  const now=new Date(); now.setHours(0,0,0,0);
  const d0=new Date(due); d0.setHours(0,0,0,0);
  let status=payment?'paid':(d0<now?'late':'open');
  return {cl,c,ref,due,payment,amount,status};
}
function allChargesAround(){
  const now=new Date(), arr=[];
  for(let off=-2;off<=2;off++){
    const d=new Date(now.getFullYear(),now.getMonth()+off,1);
    activeContracts().forEach(({cl,c})=>arr.push(chargeFor(cl,c,d.getFullYear(),d.getMonth())));
  }
  return arr.sort((a,b)=>a.due-b.due);
}
function delinquencyRate(){
  const arr=allChargesAround().filter(x=>x.due<=new Date());
  if(!arr.length) return 0;
  return 100*arr.filter(x=>x.status==='late').length/arr.length;
}
function applySettings(){
  const root=document.documentElement;
  const th=THEMES[state.settings.theme]||THEMES.aurora;
  root.style.setProperty('--accent',th.accent);
  root.style.setProperty('--accent-2',th.accent2);
  root.style.setProperty('--font',state.settings.font||'"Segoe UI", Arial, sans-serif');
  root.style.setProperty('--wallpaper', state.settings.customWallpaper ? `url("${state.settings.customWallpaper}") center/cover fixed` : th.wallpaper);
  document.getElementById('appTitle').textContent=state.settings.appName||'CrediGestor';
  document.title=(state.settings.appName||'CrediGestor')+' Mobile';
}
applySettings();

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  currentView=btn.dataset.view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b===btn));
  render();
}));
document.getElementById('themeQuickBtn').addEventListener('click',()=>{
  const keys=Object.keys(THEMES); const idx=keys.indexOf(state.settings.theme);
  state.settings.theme=keys[(idx+1)%keys.length]; saveState(); render();
});
const modal=document.getElementById('modal');
function openModal(html, bind){
  document.getElementById('modalContent').innerHTML=html;
  modal.showModal();
  if(bind) bind();
}
function closeModal(){ modal.close(); }

function render(){
  if(currentView==='dashboard') renderDashboard();
  if(currentView==='clients') renderClients();
  if(currentView==='charges') renderCharges();
  if(currentView==='crm') renderCRM();
  if(currentView==='settings') renderSettings();
}
function renderDashboard(){
  const ref=monthRef();
  const monthCharges=activeContracts().map(({cl,c})=>{
    const n=new Date(); return chargeFor(cl,c,n.getFullYear(),n.getMonth());
  });
  const portfolio=state.clients.reduce((t,c)=>t+clientBalance(c),0);
  const toReceive=monthCharges.filter(x=>x.status!=='paid').reduce((t,x)=>t+x.amount,0);
  const received=monthCharges.filter(x=>x.status==='paid').reduce((t,x)=>t+Number(x.payment.amount||x.amount),0);
  const late=monthCharges.filter(x=>x.status==='late').reduce((t,x)=>t+x.amount,0);
  const dueSoon=allChargesAround().filter(x=>x.status!=='paid' && x.due>=new Date(Date.now()-86400000)).slice(0,5);
  const goal=Number(state.goals.monthlyReceipt)||0;
  const goalPct=goal?Math.min(100,(received/goal)*100):0;
  document.getElementById('view').innerHTML=`
    <section class="hero">
      <div class="label">Carteira ativa</div>
      <div class="big money">${brl(portfolio)}</div>
      <div class="sub">${state.clients.length} cliente(s) • ${activeContracts().length} contrato(s) vigente(s)</div>
      <div class="hero-row">
        <div class="hero-mini"><b>${brl(received)}</b><span>Recebido no mês</span></div>
        <div class="hero-mini"><b>${brl(toReceive)}</b><span>A receber</span></div>
      </div>
    </section>
    <div class="section-title"><h2>Resumo de ${esc(refLabel(ref))}</h2><small>Atualizado agora</small></div>
    <div class="grid">
      <div class="card metric"><div class="kicker">EM ATRASO</div><strong class="danger">${brl(late)}</strong><small>${monthCharges.filter(x=>x.status==='late').length} cobrança(s)</small></div>
      <div class="card metric"><div class="kicker">INADIMPLÊNCIA</div><strong>${delinquencyRate().toFixed(1)}%</strong><small>base recente</small></div>
      <div class="card metric"><div class="kicker">CLIENTES OURO+</div><strong>${state.clients.filter(c=>['ouro','diamante'].includes(c.level)).length}</strong><small>ouro e diamante</small></div>
      <div class="card metric"><div class="kicker">GARANTIAS</div><strong>${state.clients.reduce((t,c)=>t+(c.guarantees||[]).length,0)}</strong><small>bens cadastrados</small></div>
    </div>
    <div class="section-title"><h2>Meta mensal</h2><button class="small-btn" id="editGoalBtn">Editar</button></div>
    <div class="card">
      <div class="row space"><div><div class="title">${goal?brl(goal):'Sem meta definida'}</div><div class="muted">${goal?`${goalPct.toFixed(0)}% atingido`:'Defina uma meta de recebimento'}</div></div><div class="badge">${brl(received)}</div></div>
      <div class="progress" style="margin-top:12px"><i style="width:${goalPct}%"></i></div>
    </div>
    <div class="section-title"><h2>Próximas cobranças</h2><button class="small-btn" id="goChargesBtn">Ver todas</button></div>
    <div class="list">
      ${dueSoon.length?dueSoon.map(chargeItemHtml).join(''):`<div class="empty card">Nenhuma cobrança próxima.</div>`}
    </div>
  `;
  document.getElementById('goChargesBtn').onclick=()=>{currentView='charges';syncNav();render()};
  document.getElementById('editGoalBtn').onclick=openGoalModal;
  bindChargeButtons();
}
function syncNav(){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
}
function chargeItemHtml(x){
  return `<div class="list-item">
    <div class="row space">
      <div class="row">
        <div class="avatar">${esc(x.cl.name.slice(0,2).toUpperCase())}</div>
        <div><div class="title">${esc(x.cl.name)}</div><div class="muted">${x.due.toLocaleDateString('pt-BR')} • ref. ${esc(x.ref)}</div></div>
      </div>
      <span class="status ${x.status}">${x.status==='paid'?'PAGO':x.status==='late'?'ATRASADO':'ABERTO'}</span>
    </div>
    <div class="row space" style="margin-top:11px">
      <strong class="money">${brl(x.amount)}</strong>
      <div class="inline-actions" style="margin:0">
        ${x.status!=='paid'?`<button class="small-btn pay-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Marcar pago</button>`:''}
        ${state.settings.googleCalendar?`<button class="small-btn cal-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Agenda</button>`:''}
      </div>
    </div>
  </div>`;
}
function bindChargeButtons(){
  document.querySelectorAll('.pay-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.c,b.dataset.k,b.dataset.r));
  document.querySelectorAll('.cal-btn').forEach(b=>b.onclick=()=>openCalendar(b.dataset.c,b.dataset.k,b.dataset.r));
}
function renderClients(){
  const q=clientSearch.trim().toLowerCase();
  const filtered=state.clients.filter(c=>!q || [c.name,c.phone,c.address,c.level].join(' ').toLowerCase().includes(q));
  document.getElementById('view').innerHTML=`
    <input id="clientSearch" class="search" placeholder="Buscar cliente por nome, telefone..." value="${esc(clientSearch)}">
    <div class="section-title"><h2>Clientes</h2><small>${filtered.length} encontrado(s)</small></div>
    <div class="list">
      ${filtered.length?filtered.map(clientItemHtml).join(''):`<div class="empty card">Cadastre seu primeiro cliente.</div>`}
    </div>
    <button class="fab" id="addClientFab">+</button>`;
  document.getElementById('clientSearch').oninput=e=>{clientSearch=e.target.value;renderClients()};
  document.getElementById('addClientFab').onclick=()=>openClientModal();
  document.querySelectorAll('.client-open').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.id));
}
function clientItemHtml(c){
  const bal=clientBalance(c), limit=Number(c.creditLimit)||0, avail=Math.max(0,limit-bal);
  return `<div class="list-item client-open" data-id="${c.id}">
    <div class="row space">
      <div class="row">
        <div class="avatar">${esc(c.name.slice(0,2).toUpperCase())}</div>
        <div><div class="title">${esc(c.name)}</div><div class="muted">${esc(c.phone||'Sem telefone')}</div></div>
      </div>
      <span class="level ${c.level}">${c.level}</span>
    </div>
    <div class="row space" style="margin-top:11px">
      <div><div class="muted">Saldo ativo</div><strong class="money">${brl(bal)}</strong></div>
      <div style="text-align:right"><div class="muted">Limite disponível</div><strong class="money">${brl(avail)}</strong></div>
    </div>
  </div>`;
}
function renderCharges(){
  const now=new Date();
  let charges=[];
  if(chargeFilter==='late'){
    charges=allChargesAround().filter(x=>x.status==='late');
  }else if(chargeFilter==='next'){
    const n=new Date(now.getFullYear(),now.getMonth()+1,1);
    charges=activeContracts().map(({cl,c})=>chargeFor(cl,c,n.getFullYear(),n.getMonth()));
  }else{
    charges=activeContracts().map(({cl,c})=>chargeFor(cl,c,now.getFullYear(),now.getMonth()));
  }
  document.getElementById('view').innerHTML=`
    <div class="tabs">
      <button class="tab ${chargeFilter==='month'?'active':''}" data-f="month">Este mês</button>
      <button class="tab ${chargeFilter==='late'?'active':''}" data-f="late">Atrasados</button>
      <button class="tab ${chargeFilter==='next'?'active':''}" data-f="next">Próximo mês</button>
    </div>
    <div class="section-title"><h2>Cobranças</h2><small>${charges.length} lançamento(s)</small></div>
    <div class="list">${charges.length?charges.map(chargeItemHtml).join(''):`<div class="empty card">Nenhuma cobrança nesta visão.</div>`}</div>
  `;
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{chargeFilter=t.dataset.f;renderCharges()});
  bindChargeButtons();
}
function renderCRM(){
  const events=state.clients.flatMap(c=>(c.interactions||[]).map(i=>({...i,client:c}))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const suggestions=state.clients.map(c=>{
    const contracts=c.contracts||[];
    const pays=contracts.flatMap(k=>k.payments||[]);
    const lateCount=contracts.reduce((n,k)=>n+(k.lateHistory||0),0);
    const score=Math.max(0,Math.min(100,50+pays.length*4-lateCount*8+(c.level==='prata'?8:c.level==='ouro'?16:c.level==='diamante'?20:0)));
    return {c,score};
  }).sort((a,b)=>b.score-a.score);
  document.getElementById('view').innerHTML=`
    <div class="section-title"><h2>Inteligência da carteira</h2><small>apoio à decisão</small></div>
    <div class="card note">O score abaixo usa apenas histórico operacional do próprio cadastro (pagamentos, relacionamento e nível definido por você). Ele não considera atributos pessoais sensíveis e não aprova crédito automaticamente.</div>
    <div class="section-title"><h2>Score interno</h2></div>
    <div class="list">${suggestions.length?suggestions.slice(0,8).map(x=>`
      <div class="list-item">
        <div class="row space"><div><div class="title">${esc(x.c.name)}</div><div class="muted">${x.c.level.toUpperCase()} • saldo ${brl(clientBalance(x.c))}</div></div><div class="badge">${x.score}/100</div></div>
        <div class="progress" style="margin-top:10px"><i style="width:${x.score}%"></i></div>
      </div>`).join(''):`<div class="empty card">Cadastre clientes para visualizar indicadores.</div>`}</div>
    <div class="section-title"><h2>Linha do tempo</h2></div>
    <div class="list">${events.length?events.slice(0,20).map(e=>`<div class="list-item"><div class="row space"><div><div class="title">${esc(e.client.name)}</div><div class="muted">${esc(e.type)} • ${new Date(e.date+'T12:00:00').toLocaleDateString('pt-BR')}</div></div></div><div class="note" style="margin-top:8px">${esc(e.note||'')}</div></div>`).join(''):`<div class="empty card">As interações dos clientes aparecerão aqui.</div>`}</div>
  `;
}
function renderSettings(){
  const th=THEMES[state.settings.theme]||THEMES.aurora;
  document.getElementById('view').innerHTML=`
    <div class="section-title"><h2>Personalização</h2><small>visual do aplicativo</small></div>
    <div class="card">
      <div class="field"><label>Nome do aplicativo</label><input id="appNameInput" value="${esc(state.settings.appName)}"></div>
      <div class="field"><label>Tema</label>
        <select id="themeSelect">${Object.entries(THEMES).map(([k,v])=>`<option value="${k}" ${k===state.settings.theme?'selected':''}>${v.name}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Fonte</label>
        <select id="fontSelect">
          ${['"Segoe UI", Arial, sans-serif','Arial, sans-serif','Georgia, serif','Tahoma, sans-serif','Verdana, sans-serif','"Trebuchet MS", sans-serif'].map(f=>`<option value="${esc(f)}" ${f===state.settings.font?'selected':''}>${f.split(',')[0].replaceAll('"','')}</option>`).join('')}
        </select>
      </div>
      <div class="wallpaper-preview"></div>
      <div class="field"><label>Imagem de fundo personalizada</label><input id="wallpaperInput" type="file" accept="image/*"></div>
      ${state.settings.customWallpaper?`<button id="clearWallpaperBtn" class="ghost-btn" type="button">Remover imagem personalizada</button>`:''}
    </div>
    <div class="section-title"><h2>Integrações e alertas</h2></div>
    <div class="card">
      <div class="switch-row"><div><div class="title">Google Agenda</div><div class="muted">Exibe botão para adicionar vencimentos</div></div><button class="switch ${state.settings.googleCalendar?'on':''}" id="calendarSwitch" aria-label="Google Agenda"></button></div>
      <div class="switch-row"><div><div class="title">Notificações</div><div class="muted">Lembretes ao abrir o app</div></div><button class="switch ${state.settings.notifications?'on':''}" id="notificationSwitch" aria-label="Notificações"></button></div>
      <div class="rule-note">Regra de vencimento: o contrato guarda o dia-base. Se o mês não possuir esse dia, usa o último dia do mês. Ex.: dia 31 → 30 em setembro e 28/29 em fevereiro; no mês seguinte volta ao dia 31 quando existir.</div>
    </div>
    <div class="section-title"><h2>Dados e backup</h2></div>
    <div class="card">
      <div class="actions" style="margin:0"><button id="exportBtn" class="soft-btn" type="button">Exportar backup</button><button id="importBtn" class="ghost-btn" type="button">Importar</button></div>
      <div class="note" style="margin-top:10px">Nesta primeira versão os dados ficam no aparelho/navegador. O próximo passo é migrar para banco em nuvem com login, sincronização e backup automático.</div>
    </div>
  `;
  document.getElementById('appNameInput').onchange=e=>{state.settings.appName=e.target.value.trim()||'CrediGestor';saveState()};
  document.getElementById('themeSelect').onchange=e=>{state.settings.theme=e.target.value;state.settings.customWallpaper='';saveState();renderSettings()};
  document.getElementById('fontSelect').onchange=e=>{state.settings.font=e.target.value;saveState()};
  document.getElementById('calendarSwitch').onclick=()=>{state.settings.googleCalendar=!state.settings.googleCalendar;saveState();renderSettings()};
  document.getElementById('notificationSwitch').onclick=toggleNotifications;
  document.getElementById('exportBtn').onclick=exportBackup;
  document.getElementById('importBtn').onclick=()=>document.getElementById('importInput').click();
  const w=document.getElementById('wallpaperInput');
  w.onchange=()=>{
    const f=w.files[0]; if(!f)return;
    if(f.size>2_000_000){alert('Use uma imagem de até 2 MB nesta versão.');return}
    const r=new FileReader(); r.onload=()=>{state.settings.customWallpaper=r.result;saveState();renderSettings()}; r.readAsDataURL(f);
  };
  const clear=document.getElementById('clearWallpaperBtn');
  if(clear) clear.onclick=()=>{state.settings.customWallpaper='';saveState();renderSettings()};
}
function openClientModal(existingId){
  const c=existingId?state.clients.find(x=>x.id===existingId):null;
  openModal(`
    <h2>${c?'Editar cliente':'Novo cliente'}</h2>
    <div class="field"><label>Nome</label><input id="fName" value="${esc(c?.name||'')}" required></div>
    <div class="two">
      <div class="field"><label>Nível</label><select id="fLevel">${['bronze','prata','ouro','diamante'].map(x=>`<option ${c?.level===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Limite de crédito</label><input id="fLimit" type="number" step="0.01" value="${c?.creditLimit||''}"></div>
    </div>
    <div class="field"><label>Telefone</label><input id="fPhone" value="${esc(c?.phone||'')}"></div>
    <div class="field"><label>Endereço</label><input id="fAddress" value="${esc(c?.address||'')}"></div>
    <div class="field"><label>Observações</label><textarea id="fNotes">${esc(c?.notes||'')}</textarea></div>
    <div class="actions"><button type="button" class="primary-btn" id="saveClientBtn">Salvar</button>${c?`<button type="button" class="danger-btn" id="deleteClientBtn">Excluir</button>`:''}</div>
  `,()=>{
    document.getElementById('saveClientBtn').onclick=()=>{
      const name=document.getElementById('fName').value.trim(); if(!name){alert('Informe o nome.');return}
      const obj=c||{id:uid('cl'),contracts:[],guarantees:[],interactions:[],createdAt:new Date().toISOString()};
      Object.assign(obj,{
        name,level:document.getElementById('fLevel').value,
        creditLimit:Number(document.getElementById('fLimit').value)||0,
        phone:document.getElementById('fPhone').value.trim(),
        address:document.getElementById('fAddress').value.trim(),
        notes:document.getElementById('fNotes').value.trim()
      });
      if(!c)state.clients.push(obj); saveState();closeModal();render();
    };
    if(c)document.getElementById('deleteClientBtn').onclick=()=>{
      if(confirm(`Excluir ${c.name} e todos os dados vinculados?`)){state.clients=state.clients.filter(x=>x.id!==c.id);saveState();closeModal();render()}
    };
  });
}
function openClientDetail(id){
  const c=state.clients.find(x=>x.id===id); if(!c)return;
  const bal=clientBalance(c), lim=Number(c.creditLimit)||0;
  openModal(`
    <div class="client-head">
      <div><span class="level ${c.level}">${c.level}</span><h2 style="margin-top:10px">${esc(c.name)}</h2><div class="muted">${esc(c.phone||'Sem telefone')} • ${esc(c.address||'Sem endereço')}</div></div>
      <button type="button" class="small-btn" id="editClientBtn">Editar</button>
    </div>
    <div class="grid" style="margin-top:16px">
      <div class="card metric"><div class="kicker">SALDO ATIVO</div><strong>${brl(bal)}</strong></div>
      <div class="card metric"><div class="kicker">LIMITE LIVRE</div><strong>${brl(Math.max(0,lim-bal))}</strong></div>
    </div>
    <div class="section-title"><h2>Contratos</h2><button type="button" class="small-btn" id="addContractBtn">+ Contrato</button></div>
    ${(c.contracts||[]).length?(c.contracts||[]).map(k=>contractHtml(c,k)).join(''):`<div class="empty card">Nenhum contrato cadastrado.</div>`}
    <div class="section-title"><h2>Garantias</h2><button type="button" class="small-btn" id="addGuaranteeBtn">+ Garantia</button></div>
    ${(c.guarantees||[]).length?(c.guarantees||[]).map(g=>`<div class="contract-card"><div class="row space"><div><div class="title">${esc(g.type)}</div><div class="muted">${esc(g.description||'')} • ${brl(g.estimatedValue)}</div></div><button type="button" class="small-btn edit-guarantee" data-id="${g.id}">Editar</button></div></div>`).join(''):`<div class="empty card">Nenhuma garantia cadastrada.</div>`}
    <div class="section-title"><h2>CRM / Interações</h2><button type="button" class="small-btn" id="addInteractionBtn">+ Registro</button></div>
    ${(c.interactions||[]).length?(c.interactions||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(i=>`<div class="contract-card"><div class="row space"><div class="title">${esc(i.type)}</div><div class="muted">${new Date(i.date+'T12:00').toLocaleDateString('pt-BR')}</div></div><div class="note" style="margin-top:6px">${esc(i.note||'')}</div></div>`).join(''):`<div class="empty card">Sem interações registradas.</div>`}
  `,()=>{
    document.getElementById('editClientBtn').onclick=()=>{closeModal();openClientModal(c.id)};
    document.getElementById('addContractBtn').onclick=()=>{closeModal();openContractModal(c.id)};
    document.getElementById('addGuaranteeBtn').onclick=()=>{closeModal();openGuaranteeModal(c.id)};
    document.getElementById('addInteractionBtn').onclick=()=>{closeModal();openInteractionModal(c.id)};
    document.querySelectorAll('.edit-contract').forEach(b=>b.onclick=()=>{closeModal();openContractModal(c.id,b.dataset.id)});
    document.querySelectorAll('.move-contract').forEach(b=>b.onclick=()=>{closeModal();openMovementModal(c.id,b.dataset.id)});
    document.querySelectorAll('.edit-guarantee').forEach(b=>b.onclick=()=>{closeModal();openGuaranteeModal(c.id,b.dataset.id)});
  });
}
function contractHtml(c,k){
  return `<div class="contract-card">
    <div class="row space">
      <div><div class="title">${esc(k.title||'Contrato')}</div><div class="muted">Dia-base ${k.baseDueDay} • ${k.billingType==='fixed'?'parcela fixa':`${k.interestRate}% a.m. sobre saldo`}</div></div>
      <span class="status ${k.active===false?'late':'paid'}">${k.active===false?'ENCERRADO':'ATIVO'}</span>
    </div>
    <div class="row space" style="margin-top:10px">
      <div><div class="muted">Saldo atual</div><strong>${brl(contractBalance(k))}</strong></div>
      <div style="text-align:right"><div class="muted">Cobrança atual</div><strong>${brl(monthlyDue(k))}</strong></div>
    </div>
    <div class="inline-actions"><button type="button" class="small-btn edit-contract" data-id="${k.id}">Editar</button><button type="button" class="small-btn move-contract" data-id="${k.id}">Acréscimo / amortização</button></div>
  </div>`;
}
function openContractModal(clientId, contractId){
  const c=state.clients.find(x=>x.id===clientId); const k=contractId?(c.contracts||[]).find(x=>x.id===contractId):null;
  openModal(`
    <h2>${k?'Editar contrato':'Novo contrato'}</h2>
    <div class="field"><label>Identificação</label><input id="kTitle" value="${esc(k?.title||'Contrato principal')}"></div>
    <div class="two">
      <div class="field"><label>Capital inicial</label><input id="kPrincipal" type="number" step="0.01" value="${k?.initialPrincipal||''}" ${k?'disabled':''}></div>
      <div class="field"><label>Dia-base do vencimento</label><input id="kDay" type="number" min="1" max="31" value="${k?.baseDueDay||1}"></div>
    </div>
    <div class="field"><label>Forma de cobrança</label><select id="kType"><option value="interest" ${k?.billingType!=='fixed'?'selected':''}>Juros mensais sobre o saldo</option><option value="fixed" ${k?.billingType==='fixed'?'selected':''}>Parcela fixa</option></select></div>
    <div class="two">
      <div class="field"><label>Juros (% ao mês)</label><input id="kRate" type="number" step="0.01" value="${k?.interestRate||''}"></div>
      <div class="field"><label>Parcela fixa</label><input id="kFixed" type="number" step="0.01" value="${k?.fixedAmount||''}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Início</label><input id="kStart" type="date" value="${k?.startDate||todayISO()}"></div>
      <div class="field"><label>Status</label><select id="kActive"><option value="1" ${k?.active!==false?'selected':''}>Ativo</option><option value="0" ${k?.active===false?'selected':''}>Encerrado</option></select></div>
    </div>
    <div class="rule-note">O dia-base nunca é perdido. Se o contrato for dia 31, fevereiro vence em 28/29 e setembro em 30, mas volta ao dia 31 nos meses que o possuem.</div>
    <div class="actions"><button type="button" class="primary-btn" id="saveContractBtn">Salvar contrato</button></div>
  `,()=>{
    document.getElementById('saveContractBtn').onclick=()=>{
      const day=Math.max(1,Math.min(31,Number(document.getElementById('kDay').value)||1));
      if(k){
        Object.assign(k,{title:document.getElementById('kTitle').value.trim(),baseDueDay:day,billingType:document.getElementById('kType').value,interestRate:Number(document.getElementById('kRate').value)||0,fixedAmount:Number(document.getElementById('kFixed').value)||0,startDate:document.getElementById('kStart').value,active:document.getElementById('kActive').value==='1'});
      }else{
        const principal=Number(document.getElementById('kPrincipal').value)||0;
        c.contracts.push({id:uid('ct'),title:document.getElementById('kTitle').value.trim()||'Contrato',initialPrincipal:principal,baseDueDay:day,billingType:document.getElementById('kType').value,interestRate:Number(document.getElementById('kRate').value)||0,fixedAmount:Number(document.getElementById('kFixed').value)||0,startDate:document.getElementById('kStart').value,active:true,movements:[],payments:[],lateHistory:0,createdAt:new Date().toISOString()});
      }
      saveState();closeModal();openClientDetail(clientId);
    };
  });
}
function openMovementModal(clientId, contractId){
  const c=state.clients.find(x=>x.id===clientId); const k=c.contracts.find(x=>x.id===contractId);
  openModal(`
    <h2>Alterar saldo do contrato</h2>
    <div class="card"><div class="muted">Saldo atual</div><strong style="font-size:26px">${brl(contractBalance(k))}</strong></div>
    <div class="field"><label>Tipo</label><select id="mType"><option value="increase">Acréscimo / novo valor liberado</option><option value="amortization">Amortização do principal</option></select></div>
    <div class="field"><label>Valor</label><input id="mAmount" type="number" step="0.01"></div>
    <div class="field"><label>Data</label><input id="mDate" type="date" value="${todayISO()}"></div>
    <div class="field"><label>Observação</label><textarea id="mNote" placeholder="Ex.: cliente pediu mais R$ 500"></textarea></div>
    <div class="actions"><button type="button" class="primary-btn" id="saveMovementBtn">Registrar alteração</button></div>
    <div class="section-title"><h2>Histórico</h2></div>
    ${(k.movements||[]).length?k.movements.slice().reverse().map(m=>`<div class="contract-card"><div class="row space"><div class="title">${m.type==='increase'?'Acréscimo':'Amortização'}</div><strong>${m.type==='increase'?'+':'-'} ${brl(m.amount)}</strong></div><div class="muted">${new Date(m.date+'T12:00').toLocaleDateString('pt-BR')} • ${esc(m.note||'')}</div></div>`).join(''):`<div class="empty">Nenhuma alteração de principal.</div>`}
  `,()=>{
    document.getElementById('saveMovementBtn').onclick=()=>{
      const amount=Number(document.getElementById('mAmount').value)||0;if(amount<=0){alert('Informe um valor maior que zero.');return}
      k.movements.push({id:uid('mv'),type:document.getElementById('mType').value,amount,date:document.getElementById('mDate').value,note:document.getElementById('mNote').value.trim(),createdAt:new Date().toISOString()});
      saveState();closeModal();openClientDetail(clientId);
    };
  });
}
function openGuaranteeModal(clientId, guaranteeId){
  const c=state.clients.find(x=>x.id===clientId); const g=guaranteeId?(c.guarantees||[]).find(x=>x.id===guaranteeId):null;
  openModal(`
    <h2>${g?'Editar garantia':'Nova garantia'}</h2>
    <div class="field"><label>Tipo do bem</label><select id="gType">${['Veículo','Terreno','Chácara','Joia','Eletrodoméstico','Eletroportátil','Outro'].map(x=>`<option ${g?.type===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="field"><label>Descrição / identificação</label><input id="gDesc" value="${esc(g?.description||'')}" placeholder="Ex.: Toyota Corolla 2016, placa..."></div>
    <div class="two"><div class="field"><label>Valor estimado</label><input id="gValue" type="number" step="0.01" value="${g?.estimatedValue||''}"></div><div class="field"><label>Status</label><select id="gStatus">${['Em garantia','Liberado','Substituído'].map(x=>`<option ${g?.status===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="field"><label>Observações / documentos</label><textarea id="gNotes">${esc(g?.notes||'')}</textarea></div>
    <div class="actions"><button type="button" class="primary-btn" id="saveGuaranteeBtn">Salvar</button></div>
  `,()=>{
    document.getElementById('saveGuaranteeBtn').onclick=()=>{
      const obj=g||{id:uid('ga'),createdAt:new Date().toISOString()};
      Object.assign(obj,{type:document.getElementById('gType').value,description:document.getElementById('gDesc').value.trim(),estimatedValue:Number(document.getElementById('gValue').value)||0,status:document.getElementById('gStatus').value,notes:document.getElementById('gNotes').value.trim()});
      if(!g)c.guarantees.push(obj);saveState();closeModal();openClientDetail(clientId);
    };
  });
}
function openInteractionModal(clientId){
  const c=state.clients.find(x=>x.id===clientId);
  openModal(`
    <h2>Novo registro de CRM</h2>
    <div class="field"><label>Tipo</label><select id="iType">${['Ligação','WhatsApp','Visita','Acordo','Renovação','Observação'].map(x=>`<option>${x}</option>`).join('')}</select></div>
    <div class="field"><label>Data</label><input id="iDate" type="date" value="${todayISO()}"></div>
    <div class="field"><label>Registro</label><textarea id="iNote"></textarea></div>
    <div class="actions"><button type="button" class="primary-btn" id="saveInteractionBtn">Salvar</button></div>
  `,()=>{
    document.getElementById('saveInteractionBtn').onclick=()=>{
      c.interactions.push({id:uid('in'),type:document.getElementById('iType').value,date:document.getElementById('iDate').value,note:document.getElementById('iNote').value.trim()});
      saveState();closeModal();openClientDetail(clientId);
    };
  });
}
function openPaymentModal(clientId, contractId, ref){
  const cl=state.clients.find(x=>x.id===clientId), c=cl.contracts.find(x=>x.id===contractId);
  const [y,m]=ref.split('-').map(Number), x=chargeFor(cl,c,y,m-1);
  openModal(`
    <h2>Registrar pagamento</h2>
    <div class="card"><div class="muted">${esc(cl.name)} • referência ${esc(ref)}</div><strong style="font-size:26px">${brl(x.amount)}</strong><div class="muted">Vencimento ${x.due.toLocaleDateString('pt-BR')}</div></div>
    <div class="field"><label>Mês de referência</label><input id="pRef" value="${esc(ref)}" pattern="\\d{4}-\\d{2}"></div>
    <div class="field"><label>Valor pago</label><input id="pAmount" type="number" step="0.01" value="${x.amount.toFixed(2)}"></div>
    <div class="field"><label>Data do pagamento</label><input id="pDate" type="date" value="${todayISO()}"></div>
    <div class="field"><label>Observação</label><textarea id="pNote"></textarea></div>
    <div class="actions"><button type="button" class="primary-btn" id="savePaymentBtn">Confirmar pago</button></div>
  `,()=>{
    document.getElementById('savePaymentBtn').onclick=()=>{
      const pRef=document.getElementById('pRef').value.trim();
      const existing=getPayment(c,pRef);
      const obj={id:existing?.id||uid('py'),reference:pRef,amount:Number(document.getElementById('pAmount').value)||0,paidAt:document.getElementById('pDate').value,note:document.getElementById('pNote').value.trim()};
      if(existing)Object.assign(existing,obj);else c.payments.push(obj);
      saveState();closeModal();render();
    };
  });
}
function openGoalModal(){
  openModal(`
    <h2>Metas financeiras</h2>
    <div class="field"><label>Meta de recebimento mensal</label><input id="goalReceipt" type="number" step="0.01" value="${state.goals.monthlyReceipt||''}"></div>
    <div class="field"><label>Meta máxima de inadimplência (%)</label><input id="goalLate" type="number" step="0.1" value="${state.goals.maxDelinquency||10}"></div>
    <div class="actions"><button type="button" class="primary-btn" id="saveGoalBtn">Salvar metas</button></div>
  `,()=>{
    document.getElementById('saveGoalBtn').onclick=()=>{state.goals.monthlyReceipt=Number(document.getElementById('goalReceipt').value)||0;state.goals.maxDelinquency=Number(document.getElementById('goalLate').value)||0;saveState();closeModal();render()};
  });
}
function openCalendar(clientId, contractId, ref){
  const cl=state.clients.find(x=>x.id===clientId), c=cl.contracts.find(x=>x.id===contractId);
  const [y,m]=ref.split('-').map(Number), x=chargeFor(cl,c,y,m-1);
  const start=compactDate(x.due), end=compactDate(addDays(x.due,1));
  const title=encodeURIComponent(`Cobrança - ${cl.name}`);
  const details=encodeURIComponent(`Referência ${ref}. Valor: ${brl(x.amount)}. Contrato: ${c.title||'Contrato'}.`);
  const url=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
  window.open(url,'_blank');
}
async function toggleNotifications(){
  if(!('Notification' in window)){alert('Este navegador não oferece notificações web.');return}
  if(!state.settings.notifications){
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){alert('Permissão de notificação não concedida.');return}
    state.settings.notifications=true;
  }else state.settings.notifications=false;
  saveState();renderSettings();
}
function runDueNotifications(){
  if(!state.settings.notifications || !('Notification'in window) || Notification.permission!=='granted')return;
  const now=new Date(); now.setHours(12,0,0,0);
  const upcoming=allChargesAround().filter(x=>x.status!=='paid').filter(x=>{
    const diff=Math.round((x.due-now)/86400000); return state.settings.notifyDays.includes(diff);
  }).slice(0,5);
  upcoming.forEach(x=>new Notification(`${state.settings.appName}: cobrança ${x.cl.name}`,{body:`${brl(x.amount)} vence em ${x.due.toLocaleDateString('pt-BR')}.`}));
}
function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`credigestor-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);
}
document.getElementById('importInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const data=JSON.parse(r.result);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),data);saveState();render();alert('Backup importado com sucesso.')}catch(err){alert('Arquivo de backup inválido.')}};r.readAsText(f);
});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
render();
setTimeout(runDueNotifications,800);
