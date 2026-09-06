// CrediGestor v2 — cadastro completo de clientes + área própria de empréstimos.
// Usa o mesmo banco local (credigestor_v1), preservando os dados existentes.

let loanSearch2='';
let loanFilter2='active';

function onlyDigits2(value=''){return String(value).replace(/\D/g,'')}
function formatCPF2(value=''){
  const d=onlyDigits2(value).slice(0,11);
  return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function validCPF2(value=''){
  const cpf=onlyDigits2(value);
  if(!cpf)return true;
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
  const digit=(base,factor)=>{let total=0;for(const n of base)total+=Number(n)*factor--;const r=(total*10)%11;return r===10?0:r};
  return digit(cpf.slice(0,9),10)===Number(cpf[9])&&digit(cpf.slice(0,10),11)===Number(cpf[10]);
}
function formatCEP2(value=''){
  const d=onlyDigits2(value).slice(0,8);
  return d.replace(/(\d{5})(\d)/,'$1-$2');
}
function norm2(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function fullAddress2(c){
  if(!(c.street||c.number||c.neighborhood||c.city||c.uf||c.cep))return c.address||'';
  const line1=[c.street,c.number].filter(Boolean).join(', ')+(c.complement?` - ${c.complement}`:'');
  const line2=[c.neighborhood,[c.city,c.uf].filter(Boolean).join(' - ')].filter(Boolean).join(' • ');
  return [line1,line2,c.cep?`CEP ${formatCEP2(c.cep)}`:''].filter(Boolean).join(' • ');
}
function clientSearchText2(c){return [c.name,c.cpf,c.phone,c.email,fullAddress2(c),c.level].filter(Boolean).join(' ')}
function allLoans2(){return state.clients.flatMap(cl=>(cl.contracts||[]).map(k=>({cl,k})))}

// ---------- CLIENTES ----------
openClientModal=function(existingId){
  const c=existingId?state.clients.find(x=>x.id===existingId):null;
  openModal(`
    <h2>${c?'Editar cliente':'Novo cliente'}</h2>
    <div class="field"><label>Nome completo</label><input id="fName" value="${esc(c?.name||'')}" autocomplete="name" required></div>
    <div class="two">
      <div class="field"><label>CPF</label><input id="fCpf" inputmode="numeric" maxlength="14" value="${esc(formatCPF2(c?.cpf||''))}" placeholder="000.000.000-00"></div>
      <div class="field"><label>Telefone</label><input id="fPhone" inputmode="tel" value="${esc(c?.phone||'')}" autocomplete="tel"></div>
    </div>
    <div class="field"><label>E-mail</label><input id="fEmail" type="email" value="${esc(c?.email||'')}" autocomplete="email" placeholder="cliente@exemplo.com"></div>
    <div class="two">
      <div class="field"><label>Nível</label><select id="fLevel">${['bronze','prata','ouro','diamante'].map(x=>`<option ${c?.level===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Limite de crédito</label><input id="fLimit" type="number" inputmode="decimal" step="0.01" min="0" value="${c?.creditLimit||''}"></div>
    </div>
    <div class="section-title compact-title"><h2>Endereço</h2></div>
    <div class="field"><label>Rua / avenida</label><input id="fStreet" value="${esc(c?.street||c?.address||'')}"></div>
    <div class="two">
      <div class="field"><label>Número</label><input id="fNumber" value="${esc(c?.number||'')}"></div>
      <div class="field"><label>Complemento</label><input id="fComplement" value="${esc(c?.complement||'')}"></div>
    </div>
    <div class="field"><label>Bairro</label><input id="fNeighborhood" value="${esc(c?.neighborhood||'')}"></div>
    <div class="two">
      <div class="field"><label>Cidade</label><input id="fCity" value="${esc(c?.city||'')}"></div>
      <div class="field"><label>UF</label><input id="fUf" maxlength="2" value="${esc(c?.uf||'')}" placeholder="PA"></div>
    </div>
    <div class="field"><label>CEP</label><input id="fCep" inputmode="numeric" maxlength="9" value="${esc(formatCEP2(c?.cep||''))}" placeholder="00000-000"></div>
    <div class="field"><label>Observações</label><textarea id="fNotes">${esc(c?.notes||'')}</textarea></div>
    <div class="rule-note">Nesta versão, os dados dos clientes ficam salvos no navegador deste aparelho. Eles não são enviados para o repositório público do GitHub.</div>
    <div class="actions"><button type="button" class="primary-btn" id="saveClientBtn">Salvar cliente</button>${c?'<button type="button" class="danger-btn" id="deleteClientBtn">Excluir</button>':''}</div>
  `,()=>{
    const cpf=document.getElementById('fCpf'),cep=document.getElementById('fCep'),uf=document.getElementById('fUf');
    cpf.oninput=()=>cpf.value=formatCPF2(cpf.value);
    cep.oninput=()=>cep.value=formatCEP2(cep.value);
    uf.oninput=()=>uf.value=uf.value.replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,2);
    document.getElementById('saveClientBtn').onclick=()=>{
      const name=document.getElementById('fName').value.trim();
      const cpfValue=formatCPF2(cpf.value);
      if(!name){alert('Informe o nome do cliente.');return}
      if(cpfValue&&!validCPF2(cpfValue)){alert('CPF inválido. Confira os números informados.');return}
      if(cpfValue&&state.clients.some(x=>x.id!==c?.id&&onlyDigits2(x.cpf)===onlyDigits2(cpfValue))){alert('Já existe um cliente cadastrado com este CPF.');return}
      const obj=c||{id:uid('cl'),contracts:[],guarantees:[],interactions:[],createdAt:new Date().toISOString()};
      Object.assign(obj,{
        name,cpf:cpfValue,phone:document.getElementById('fPhone').value.trim(),email:document.getElementById('fEmail').value.trim(),
        level:document.getElementById('fLevel').value,creditLimit:Number(document.getElementById('fLimit').value)||0,
        street:document.getElementById('fStreet').value.trim(),number:document.getElementById('fNumber').value.trim(),
        complement:document.getElementById('fComplement').value.trim(),neighborhood:document.getElementById('fNeighborhood').value.trim(),
        city:document.getElementById('fCity').value.trim(),uf:uf.value.trim(),cep:formatCEP2(cep.value),
        notes:document.getElementById('fNotes').value.trim()
      });
      obj.address=[obj.street,obj.number].filter(Boolean).join(', ');
      if(!c)state.clients.push(obj);
      saveState();closeModal();render();
    };
    if(c)document.getElementById('deleteClientBtn').onclick=()=>{
      if(confirm(`Excluir ${c.name} e todos os dados vinculados?`)){state.clients=state.clients.filter(x=>x.id!==c.id);saveState();closeModal();render()}
    };
  });
};

clientItemHtml=function(c){
  const bal=clientBalance(c),limit=Number(c.creditLimit)||0,avail=Math.max(0,limit-bal);
  const idLine=[c.cpf?`CPF ${formatCPF2(c.cpf)}`:'',c.phone||''].filter(Boolean).join(' • ');
  return `<div class="list-item client-open" data-id="${c.id}">
    <div class="row space"><div class="row"><div class="avatar">${esc(c.name.slice(0,2).toUpperCase())}</div><div><div class="title">${esc(c.name)}</div><div class="muted">${esc(idLine||'Sem CPF/telefone')}</div></div></div><span class="level ${c.level}">${c.level}</span></div>
    ${fullAddress2(c)?`<div class="muted client-address">📍 ${esc(fullAddress2(c))}</div>`:''}
    <div class="row space" style="margin-top:11px"><div><div class="muted">Saldo ativo</div><strong class="money">${brl(bal)}</strong></div><div style="text-align:right"><div class="muted">Limite disponível</div><strong class="money">${brl(avail)}</strong></div></div>
  </div>`;
};

renderClients=function(){
  const q=norm2(clientSearch.trim());
  const filtered=state.clients.filter(c=>!q||norm2(clientSearchText2(c)).includes(q));
  document.getElementById('view').innerHTML=`
    <input id="clientSearch" class="search" placeholder="Buscar por nome, CPF, telefone ou endereço" value="${esc(clientSearch)}">
    <div class="section-title"><h2>Clientes</h2><small>${filtered.length} encontrado(s)</small></div>
    <div class="list">${filtered.length?filtered.map(clientItemHtml).join(''):'<div class="empty card">Cadastre seu primeiro cliente.</div>'}</div>
    <button class="fab" id="addClientFab" aria-label="Novo cliente">+</button>`;
  document.getElementById('clientSearch').oninput=e=>{clientSearch=e.target.value;renderClients()};
  document.getElementById('addClientFab').onclick=()=>openClientModal();
  document.querySelectorAll('.client-open').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.id));
};

openClientDetail=function(id){
  const c=state.clients.find(x=>x.id===id);if(!c)return;
  const bal=clientBalance(c),lim=Number(c.creditLimit)||0;
  openModal(`
    <div class="client-head"><div><span class="level ${c.level}">${c.level}</span><h2 style="margin-top:10px">${esc(c.name)}</h2></div><button type="button" class="small-btn" id="editClientBtn">Editar</button></div>
    <div class="client-extra muted">
      ${c.cpf?`<div>CPF: ${esc(formatCPF2(c.cpf))}</div>`:''}
      ${c.phone?`<div>Telefone: ${esc(c.phone)}</div>`:''}
      ${c.email?`<div>E-mail: ${esc(c.email)}</div>`:''}
      ${fullAddress2(c)?`<div>Endereço: ${esc(fullAddress2(c))}</div>`:''}
    </div>
    <div class="grid" style="margin-top:16px"><div class="card metric"><div class="kicker">SALDO ATIVO</div><strong>${brl(bal)}</strong></div><div class="card metric"><div class="kicker">LIMITE LIVRE</div><strong>${brl(Math.max(0,lim-bal))}</strong></div></div>
    <div class="section-title"><h2>Empréstimos</h2><button type="button" class="small-btn" id="addContractBtn">+ Empréstimo</button></div>
    ${(c.contracts||[]).length?(c.contracts||[]).map(k=>contractHtml(c,k)).join(''):'<div class="empty card">Nenhum empréstimo cadastrado.</div>'}
    <div class="section-title"><h2>Garantias</h2><button type="button" class="small-btn" id="addGuaranteeBtn">+ Garantia</button></div>
    ${(c.guarantees||[]).length?(c.guarantees||[]).map(g=>`<div class="contract-card"><div class="row space"><div><div class="title">${esc(g.type)}</div><div class="muted">${esc(g.description||'')} • ${brl(g.estimatedValue)}</div></div><button type="button" class="small-btn edit-guarantee" data-id="${g.id}">Editar</button></div></div>`).join(''):'<div class="empty card">Nenhuma garantia cadastrada.</div>'}
    <div class="section-title"><h2>CRM / Interações</h2><button type="button" class="small-btn" id="addInteractionBtn">+ Registro</button></div>
    ${(c.interactions||[]).length?(c.interactions||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(i=>`<div class="contract-card"><div class="row space"><div class="title">${esc(i.type)}</div><div class="muted">${new Date(i.date+'T12:00').toLocaleDateString('pt-BR')}</div></div><div class="note" style="margin-top:6px">${esc(i.note||'')}</div></div>`).join(''):'<div class="empty card">Sem interações registradas.</div>'}
  `,()=>{
    document.getElementById('editClientBtn').onclick=()=>{closeModal();openClientModal(c.id)};
    document.getElementById('addContractBtn').onclick=()=>{closeModal();openContractModal(c.id)};
    document.getElementById('addGuaranteeBtn').onclick=()=>{closeModal();openGuaranteeModal(c.id)};
    document.getElementById('addInteractionBtn').onclick=()=>{closeModal();openInteractionModal(c.id)};
    document.querySelectorAll('.edit-contract').forEach(b=>b.onclick=()=>{closeModal();openContractModal(c.id,b.dataset.id)});
    document.querySelectorAll('.move-contract').forEach(b=>b.onclick=()=>{closeModal();openMovementModal(c.id,b.dataset.id)});
    document.querySelectorAll('.edit-guarantee').forEach(b=>b.onclick=()=>{closeModal();openGuaranteeModal(c.id,b.dataset.id)});
  });
};

// ---------- EMPRÉSTIMOS ----------
function loanCard2({cl,k}){
  const active=k.active!==false;
  const mode=k.billingType==='fixed'?`Parcela ${brl(k.fixedAmount)}`:`${Number(k.interestRate)||0}% a.m.`;
  return `<div class="list-item loan-card">
    <div class="row space"><div class="row loan-main-row"><div class="avatar">💰</div><div><div class="title">${esc(k.title||'Empréstimo')}</div><div class="muted">${esc(cl.name)}${cl.cpf?` • CPF ${esc(formatCPF2(cl.cpf))}`:''}</div></div></div><span class="status ${active?'paid':'late'}">${active?'ATIVO':'ENCERRADO'}</span></div>
    <div class="loan-numbers"><div><span>Saldo atual</span><strong>${brl(contractBalance(k))}</strong></div><div><span>Cobrança mensal</span><strong>${brl(monthlyDue(k))}</strong></div></div>
    <div class="muted loan-meta">Vencimento: dia ${k.baseDueDay||1} • ${esc(mode)} • Início ${k.startDate?new Date(k.startDate+'T12:00').toLocaleDateString('pt-BR'):'—'}</div>
    <div class="inline-actions">
      <button type="button" class="small-btn edit-loan2" data-client="${cl.id}" data-loan="${k.id}">Editar</button>
      <button type="button" class="small-btn move-loan2" data-client="${cl.id}" data-loan="${k.id}">Aumentar / diminuir valor</button>
      <button type="button" class="small-btn history-loan2" data-client="${cl.id}" data-loan="${k.id}">Histórico</button>
    </div>
  </div>`;
}

function renderLoans2(){
  let loans=allLoans2();
  const q=norm2(loanSearch2.trim());
  if(loanFilter2==='active')loans=loans.filter(x=>x.k.active!==false);
  if(loanFilter2==='closed')loans=loans.filter(x=>x.k.active===false);
  if(q)loans=loans.filter(({cl,k})=>norm2([cl.name,cl.cpf,k.title,k.interestRate,k.fixedAmount,k.baseDueDay].join(' ')).includes(q));
  const activeAll=allLoans2().filter(x=>x.k.active!==false);
  const balance=activeAll.reduce((t,x)=>t+contractBalance(x.k),0);
  const monthly=activeAll.reduce((t,x)=>t+monthlyDue(x.k),0);
  document.getElementById('view').innerHTML=`
    <section class="hero"><div class="label">Empréstimos ativos</div><div class="big money">${brl(balance)}</div><div class="sub">${activeAll.length} empréstimo(s) • cobrança mensal estimada ${brl(monthly)}</div></section>
    <input id="loanSearch2" class="search loan-search" placeholder="Buscar empréstimo ou cliente" value="${esc(loanSearch2)}">
    <div class="tabs"><button class="tab ${loanFilter2==='active'?'active':''}" data-loan-filter="active">Ativos</button><button class="tab ${loanFilter2==='closed'?'active':''}" data-loan-filter="closed">Encerrados</button><button class="tab ${loanFilter2==='all'?'active':''}" data-loan-filter="all">Todos</button></div>
    <div class="section-title"><h2>Empréstimos</h2><small>${loans.length} registro(s)</small></div>
    <div class="list">${loans.length?loans.map(loanCard2).join(''):`<div class="empty card">${state.clients.length?'Nenhum empréstimo nesta visão.':'Cadastre um cliente antes de criar o primeiro empréstimo.'}</div>`}</div>
    <button class="fab" id="addLoanFab2" aria-label="Novo empréstimo">+</button>`;
  document.getElementById('loanSearch2').oninput=e=>{loanSearch2=e.target.value;renderLoans2()};
  document.querySelectorAll('[data-loan-filter]').forEach(b=>b.onclick=()=>{loanFilter2=b.dataset.loanFilter;renderLoans2()});
  document.getElementById('addLoanFab2').onclick=selectClientForLoan2;
  document.querySelectorAll('.edit-loan2').forEach(b=>b.onclick=()=>openContractModal(b.dataset.client,b.dataset.loan));
  document.querySelectorAll('.move-loan2').forEach(b=>b.onclick=()=>openMovementModal(b.dataset.client,b.dataset.loan));
  document.querySelectorAll('.history-loan2').forEach(b=>b.onclick=()=>openLoanHistory2(b.dataset.client,b.dataset.loan));
}

function selectClientForLoan2(){
  if(!state.clients.length){
    openModal('<h2>Primeiro cadastre um cliente</h2><div class="card note">Todo empréstimo precisa ficar vinculado a um cliente.</div><div class="actions"><button type="button" class="primary-btn" id="newClientFromLoan2">Cadastrar cliente</button></div>',()=>{
      document.getElementById('newClientFromLoan2').onclick=()=>{closeModal();currentView='clients';syncNav();render();openClientModal()};
    });return;
  }
  openModal(`<h2>Novo empréstimo</h2><div class="field"><label>Selecione o cliente</label><select id="loanClientSelect2">${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}${c.cpf?` — ${esc(formatCPF2(c.cpf))}`:''}</option>`).join('')}</select></div><div class="actions"><button type="button" class="primary-btn" id="continueLoan2">Continuar</button></div>`,()=>{
    document.getElementById('continueLoan2').onclick=()=>{const id=document.getElementById('loanClientSelect2').value;closeModal();openContractModal(id)};
  });
}

function openLoanHistory2(clientId,loanId){
  const cl=state.clients.find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===loanId);if(!cl||!k)return;
  const movements=(k.movements||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  openModal(`
    <h2>Histórico do empréstimo</h2>
    <div class="card"><div class="muted">${esc(cl.name)} • ${esc(k.title||'Empréstimo')}</div><div class="summary-strip2"><div><div class="muted">Valor inicial</div><strong>${brl(k.initialPrincipal)}</strong></div><div><div class="muted">Saldo atual</div><strong>${brl(contractBalance(k))}</strong></div></div></div>
    <div class="section-title"><h2>Alterações de saldo</h2><small>${movements.length}</small></div>
    <div class="card">${movements.length?movements.map(m=>`<div class="history-row2"><div class="row space"><strong class="${m.type==='increase'?'success':'danger'}">${m.type==='increase'?'+':'−'} ${brl(m.amount)}</strong><span class="muted">${m.date?new Date(m.date+'T12:00').toLocaleDateString('pt-BR'):'—'}</span></div><div class="muted" style="margin-top:5px">${m.type==='increase'?'Aumento do valor':'Redução / amortização'}${m.note?` • ${esc(m.note)}`:''}</div></div>`).join(''):'<div class="empty">Nenhuma alteração registrada.</div>'}</div>
    <div class="actions"><button type="button" class="primary-btn" id="changeBalanceFromHistory2">Aumentar / diminuir valor</button></div>
  `,()=>{document.getElementById('changeBalanceFromHistory2').onclick=()=>{closeModal();openMovementModal(clientId,loanId)}});
}

// ---------- NAVEGAÇÃO ----------
const originalRender2=render;
render=function(){if(currentView==='loans')return renderLoans2();return originalRender2()};

const moreBtn2=document.getElementById('moreBtn');
if(moreBtn2){
  moreBtn2.addEventListener('click',()=>{
    openModal(`<h2>Mais opções</h2><div class="quick-menu2">
      <button type="button" class="quick-card2" data-more-view="charges"><span>✓</span><div><b>Cobranças</b><small>Pagamentos, atrasos e próximos vencimentos</small></div></button>
      <button type="button" class="quick-card2" data-more-view="crm"><span>☷</span><div><b>CRM</b><small>Relacionamento e histórico dos clientes</small></div></button>
      <button type="button" class="quick-card2" data-more-view="settings"><span>⚙</span><div><b>Ajustes</b><small>Temas, agenda, notificações e backup</small></div></button>
    </div>`,()=>document.querySelectorAll('[data-more-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.moreView;closeModal();syncNav();render()}));
  });
}

// Reexibe a dashboard usando as funções atualizadas.
syncNav();
render();
