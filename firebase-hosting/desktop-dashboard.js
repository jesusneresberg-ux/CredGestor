// CrediGestor — Dashboard Web Redesenhada
// Sobrescreve as renderizações padrão em telas >= 900px com layout de painel administrativo.
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const mq=window.matchMedia('(min-width: 900px)');
  let active=mq.matches;
  mq.addEventListener('change',e=>{active=e.matches;if(typeof render==='function')render();});

  function isDesktop(){return active;}

  // ── Dashboard web ──
  const baseRenderDashboard=typeof renderDashboard==='function'?renderDashboard:null;
  window.renderDashboard=function(){
    if(!isDesktop()||!baseRenderDashboard)return baseRenderDashboard&&baseRenderDashboard();
    const ref=monthRef();
    const monthCharges=activeContracts().map(({cl,c})=>chargeFor(cl,c,new Date().getFullYear(),new Date().getMonth()));
    const portfolio=state.clients.reduce((t,c)=>t+clientBalance(c),0);
    const toReceive=monthCharges.filter(x=>x.status!=='paid').reduce((t,x)=>t+x.remaining,0);
    const received=monthCharges.reduce((t,x)=>t+x.paid,0);
    const late=monthCharges.filter(x=>x.status==='late').reduce((t,x)=>t+x.remaining,0);
    const lateCount=monthCharges.filter(x=>x.status==='late').length;
    const dueSoon=allChargesAround().filter(x=>x.status!=='paid'&&x.due>=new Date(Date.now()-86400000)).slice(0,5);
    const goal=Number(state.goals.monthlyReceipt)||0;
    const goalPct=goal?Math.min(100,(received/goal)*100):0;
    const guarantees=state.clients.reduce((t,c)=>t+(c.guarantees||[]).length,0);
    const goldPlus=state.clients.filter(c=>['ouro','diamante'].includes(c.level)).length;

    document.getElementById('view').innerHTML=`
      <div class="desktop-section-header">
        <div><h2>Dashboard</h2><small>Visão geral da carteira • ${esc(refLabel(ref))}</small></div>
        <div class="actions"><button class="small-btn" id="editGoalBtn">Editar metas</button></div>
      </div>

      <div class="desktop-dashboard-hero">
        <section class="hero">
          <div class="label">Carteira ativa</div>
          <div class="big money">${brl(portfolio)}</div>
          <div class="sub">${state.clients.length} cliente(s) • ${activeContracts().length} contrato(s) vigente(s)</div>
          <div class="hero-row">
            <div class="hero-mini"><b class="money">${brl(received)}</b><span>Recebido no mês</span></div>
            <div class="hero-mini"><b class="money">${brl(toReceive)}</b><span>A receber</span></div>
            <div class="hero-mini"><b class="money danger">${brl(late)}</b><span>Em atraso</span></div>
            <div class="hero-mini"><b>${delinquencyRate().toFixed(1)}%</b><span>Inadimplência</span></div>
          </div>
        </section>
      </div>

      <div class="desktop-metrics-grid">
        <div class="card metric"><div class="kicker">Em atraso</div><strong class="danger">${brl(late)}</strong><small>${lateCount} cobrança(s)</small></div>
        <div class="card metric"><div class="kicker">Clientes Ouro+</div><strong>${goldPlus}</strong><small>ouro e diamante</small></div>
        <div class="card metric"><div class="kicker">Garantias</div><strong>${guarantees}</strong><small>bens cadastrados</small></div>
        <div class="card metric"><div class="kicker">Contratos ativos</div><strong>${activeContracts().length}</strong><small>vigentes</small></div>
      </div>

      <div class="card desktop-goal-card">
        <div>
          <div class="title">${goal?brl(goal):'Sem meta definida'}</div>
          <div class="muted">${goal?`${goalPct.toFixed(0)}% da meta mensal atingida`:'Defina uma meta de recebimento mensal'}</div>
          <div class="progress"><i style="width:${goalPct}%"></i></div>
        </div>
        <div style="text-align:right"><strong class="money" style="font-size:24px">${brl(received)}</strong><div class="muted">recebido</div></div>
      </div>

      <div class="desktop-section-header">
        <div><h2>Próximas cobranças</h2><small>Vencimentos próximos</small></div>
        <div class="actions"><button class="small-btn" id="goChargesBtn">Ver todas</button></div>
      </div>
      <div class="list">${dueSoon.length?dueSoon.map(chargeItemHtml).join(''):'<div class="empty card">Nenhuma cobrança próxima.</div>'}</div>
    `;
    document.getElementById('goChargesBtn').onclick=()=>{currentView='charges';syncNav();render();};
    document.getElementById('editGoalBtn').onclick=openGoalModal;
    bindChargeButtons();
  };

  // ── Clientes: tabela horizontal ──
  const baseRenderClients=typeof renderClients==='function'?renderClients:null;
  window.renderClients=function(){
    if(!isDesktop()||!baseRenderClients)return baseRenderClients&&baseRenderClients();
    const q=clientSearch.trim().toLowerCase();
    const filtered=state.clients.filter(c=>!q||[c.name,c.phone,c.address,c.level].join(' ').toLowerCase().includes(q));

    document.getElementById('view').innerHTML=`
      <div class="desktop-section-header">
        <div><h2>Clientes</h2><small>${filtered.length} encontrado(s)</small></div>
        <div class="actions"><button class="desktop-fab-inline" id="addClientFab">+ Novo cliente</button></div>
      </div>
      <div class="desktop-search-bar">
        <input id="clientSearch" class="search" placeholder="Buscar por nome, telefone, nível..." value="${esc(clientSearch)}" autocomplete="off">
      </div>
      ${filtered.length?`
        <table class="desktop-clients-table">
          <thead><tr>
            <th>Cliente</th>
            <th>Nível</th>
            <th>Telefone</th>
            <th style="text-align:right">Saldo ativo</th>
            <th style="text-align:right">Limite livre</th>
          </tr></thead>
          <tbody>
            ${filtered.map(c=>{
              const bal=clientBalance(c),limit=Number(c.creditLimit)||0,avail=Math.max(0,limit-bal);
              return `<tr class="client-open" data-id="${c.id}">
                <td><div class="row" style="gap:10px"><div class="avatar">${esc(c.name.slice(0,2).toUpperCase())}</div><div><div class="title">${esc(c.name)}</div></div></div></td>
                <td><span class="level ${c.level}">${c.level}</span></td>
                <td class="muted">${esc(c.phone||'—')}</td>
                <td style="text-align:right"><strong class="money">${brl(bal)}</strong></td>
                <td style="text-align:right"><strong class="money">${brl(avail)}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `:'<div class="empty card">Cadastre seu primeiro cliente.</div>'}
    `;
    document.getElementById('clientSearch').oninput=e=>{clientSearch=e.target.value;renderClients();};
    document.getElementById('addClientFab').onclick=()=>openClientModal();
    document.querySelectorAll('.client-open').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.id));
  };

  // ── Cobranças: tabela com filtros pill ──
  const baseRenderCharges=typeof renderCharges==='function'?renderCharges:null;
  window.renderCharges=function(){
    if(!isDesktop()||!baseRenderCharges)return baseRenderCharges&&baseRenderCharges();
    const now=new Date();
    let charges=[];
    if(chargeFilter==='late')charges=allChargesAround().filter(x=>x.status==='late');
    else if(chargeFilter==='next'){const n=new Date(now.getFullYear(),now.getMonth()+1,1);charges=activeContracts().map(({cl,c})=>chargeFor(cl,c,n.getFullYear(),n.getMonth())).filter(x=>x.status!=='not_due');}
    else charges=activeContracts().map(({cl,c})=>chargeFor(cl,c,now.getFullYear(),now.getMonth())).filter(x=>x.status!=='not_due');

    document.getElementById('view').innerHTML=`
      <div class="desktop-section-header">
        <div><h2>Cobranças</h2><small>${charges.length} lançamento(s)</small></div>
      </div>
      <div class="desktop-tabs">
        <button class="tab ${chargeFilter==='month'?'active':''}" data-f="month">Este mês</button>
        <button class="tab ${chargeFilter==='late'?'active':''}" data-f="late">Atrasados</button>
        <button class="tab ${chargeFilter==='next'?'active':''}" data-f="next">Próximo mês</button>
      </div>
      ${charges.length?`
        <table class="desktop-charges-table">
          <thead><tr>
            <th>Cliente</th>
            <th>Vencimento</th>
            <th>Referência</th>
            <th>Status</th>
            <th style="text-align:right">Valor</th>
            <th>Ações</th>
          </tr></thead>
          <tbody>
            ${charges.map(x=>`<tr>
              <td><div class="row" style="gap:10px"><div class="avatar">${esc(x.cl.name.slice(0,2).toUpperCase())}</div><div class="title">${esc(x.cl.name)}</div></div></td>
              <td class="muted">${x.due.toLocaleDateString('pt-BR')}</td>
              <td class="muted">${esc(x.ref)}</td>
              <td><span class="status ${x.status}">${x.status==='paid'?'PAGO':x.status==='late'?'ATRASADO':'ABERTO'}</span></td>
              <td style="text-align:right"><strong class="money">${brl(x.remaining)}</strong></td>
              <td><div class="inline-actions">
                ${x.status!=='paid'?`<button class="small-btn pay-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Pagar</button>`:''}
                ${state.settings.googleCalendar?`<button class="small-btn cal-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Agenda</button>`:''}
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      `:'<div class="empty card">Nenhuma cobrança nesta visão.</div>'}
    `;
    document.querySelectorAll('.desktop-tabs .tab').forEach(t=>t.onclick=()=>{chargeFilter=t.dataset.f;renderCharges();});
    bindChargeButtons();
  };

  // ── CRM: duas colunas (scores + timeline) ──
  const baseRenderCRM=typeof renderCRM==='function'?renderCRM:null;
  window.renderCRM=function(){
    if(!isDesktop()||!baseRenderCRM)return baseRenderCRM&&baseRenderCRM();
    const events=state.clients.flatMap(c=>(c.interactions||[]).map(i=>({...i,client:c}))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const suggestions=state.clients.map(c=>{
      const contracts=c.contracts||[];
      const pays=contracts.flatMap(k=>k.payments||[]);
      const lateCount=contracts.reduce((n,k)=>n+(k.lateHistory||0),0);
      const score=Math.max(0,Math.min(100,50+pays.length*4-lateCount*8+(c.level==='prata'?8:c.level==='ouro'?16:c.level==='diamante'?20:0)));
      return {c,score};
    }).sort((a,b)=>b.score-a.score);

    document.getElementById('view').innerHTML=`
      <div class="desktop-section-header">
        <div><h2>Inteligência da carteira</h2><small>Apoio à decisão operacional</small></div>
      </div>
      <div class="card note" style="margin-bottom:24px">O score usa apenas histórico operacional do próprio cadastro (pagamentos, relacionamento e nível). Não considera atributos pessoais sensíveis e não aprova crédito automaticamente.</div>
      <div class="desktop-crm-layout">
        <div class="crm-scores">
          <h3>Score interno</h3>
          <div class="list">${suggestions.length?suggestions.slice(0,10).map(x=>`
            <div class="list-item">
              <div class="row space"><div><div class="title">${esc(x.c.name)}</div><div class="muted">${x.c.level.toUpperCase()} • saldo ${brl(clientBalance(x.c))}</div></div><div class="badge">${x.score}/100</div></div>
              <div class="progress"><i style="width:${x.score}%"></i></div>
            </div>`).join(''):'<div class="empty">Cadastre clientes para visualizar indicadores.</div>'}</div>
        </div>
        <div class="crm-timeline">
          <h3>Linha do tempo</h3>
          <div class="list">${events.length?events.slice(0,15).map(e=>`
            <div class="list-item">
              <div class="row space"><div><div class="title">${esc(e.client.name)}</div><div class="muted">${esc(e.type)} • ${new Date(e.date+'T12:00:00').toLocaleDateString('pt-BR')}</div></div></div>
              <div class="note" style="margin-top:6px">${esc(e.note||'')}</div>
            </div>`).join(''):'<div class="empty">As interações dos clientes aparecerão aqui.</div>'}</div>
        </div>
      </div>
    `;
  };

  // ── Configurações: grid de seções ──
  const baseRenderSettings=typeof renderSettings==='function'?renderSettings:null;
  window.renderSettings=function(){
    if(!isDesktop()||!baseRenderSettings)return baseRenderSettings&&baseRenderSettings();
    // Chama a versão original que monta o HTML base
    baseRenderSettings();
    // Reorganiza os cards em grid de 2 colunas
    const view=document.getElementById('view');
    const sectionTitles=[...view.querySelectorAll('.section-title')];
    if(sectionTitles.length<2)return; // nada para reorganizar

    const wrapper=document.createElement('div');
    wrapper.className='desktop-settings-grid';
    // Insere o wrapper antes do primeiro elemento
    view.prepend(wrapper);
    // Move cada par (título + card seguinte) para dentro do grid
    for(const title of sectionTitles){
      const card=title.nextElementSibling;
      if(card&&card.classList.contains('card')){
        const group=document.createElement('div');
        group.appendChild(title.cloneNode(true));
        group.appendChild(card.cloneNode(true));
        wrapper.appendChild(group);
        // Remove os originais
        title.remove();
        card.remove();
      }
    }
    // Re-bind dos eventos (os clones perdem os listeners)
    setTimeout(()=>{
      const appName=document.getElementById('appNameInput');
      if(appName)appName.onchange=e=>{state.settings.appName=e.target.value.trim()||'CrediGestor';saveState();};
      const themeSelect=document.getElementById('themeSelect');
      if(themeSelect)themeSelect.onchange=e=>{chooseTheme(e.target.value);renderSettings();};
      const fontSelect=document.getElementById('fontSelect');
      if(fontSelect)fontSelect.onchange=e=>{state.settings.font=e.target.value;saveState();};
      const calendarSwitch=document.getElementById('calendarSwitch');
      if(calendarSwitch)calendarSwitch.onclick=()=>{state.settings.googleCalendar=!state.settings.googleCalendar;saveState();renderSettings();};
      const notificationSwitch=document.getElementById('notificationSwitch');
      if(notificationSwitch)notificationSwitch.onclick=toggleNotifications;
      const exportBtn=document.getElementById('exportBtn');
      if(exportBtn)exportBtn.onclick=exportBackup;
      const importBtn=document.getElementById('importBtn');
      if(importBtn)importBtn.onclick=()=>document.getElementById('importInput')?.click();
      const logoInput=document.getElementById('logoColorInput');
      if(logoInput){
        logoInput.oninput=()=>{document.documentElement.style.setProperty('--logo-color',logoInput.value);document.getElementById('logoColorCode').textContent=logoInput.value.toUpperCase();document.getElementById('logoColorStatus').textContent='Prévia da cor personalizada.';};
        logoInput.onchange=()=>{const previous=state.settings.logoColor;state.settings.logoColor=logoInput.value;try{saveState();}catch(_){state.settings.logoColor=previous;applySettings();}};
      }
      const resetLogo=document.getElementById('resetLogoColor');
      if(resetLogo)resetLogo.onclick=()=>{const previous=state.settings.logoColor;state.settings.logoColor='';try{saveState();renderSettings();}catch(_){state.settings.logoColor=previous;applySettings();}};
      const wallpaper=document.getElementById('wallpaperInput');
      if(wallpaper)wallpaper.onchange=()=>{const f=wallpaper.files[0];if(!f)return;if(f.size>2000000){alert('Use uma imagem de até 2 MB.');return;}const r=new FileReader();r.onload=()=>{const key=appearanceKey();if(key){appearanceCache.set(key,'');try{localStorage.removeItem(key);}catch(_){}}state.settings.customWallpaper=r.result;saveState();renderSettings();};r.readAsDataURL(f);};
      const clearWp=document.getElementById('clearWallpaperBtn');
      if(clearWp)clearWp.onclick=()=>{state.settings.customWallpaper='';saveState();renderSettings();};
      const v26Acc=document.getElementById('v26SettingsAccount');
      if(v26Acc)v26Acc.onclick=()=>{const btn=document.getElementById('accountQuickBtn');if(btn)btn.click();};
    },0);
  };
})();