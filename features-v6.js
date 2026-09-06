// CrediGestor v6 — exclusões protegidas, mix de 4 cores, gráficos financeiros,
// maiores pagadores e cobrança por WhatsApp com PIX editável.
(function(){
  'use strict';

  const V6_DEFAULT_MESSAGE='Olá, {nome}. Sua cobrança de {valor}, referente a {referencia}, vence em {vencimento}.\n\nPagamento via PIX:\nTipo: {tipo_pix}\nChave: {chave_pix}\nFavorecido: {favorecido}\n\nApós o pagamento, por favor envie o comprovante.';

  const V6_THEME_DEFAULTS={
    aurora:{c1:'#2563eb',c2:'#4f46e5',c3:'#60a5fa',c4:'#c7d2fe'},
    floresta:{c1:'#047857',c2:'#0f766e',c3:'#34d399',c4:'#99f6e4'},
    grafite:{c1:'#7c3aed',c2:'#334155',c3:'#8b5cf6',c4:'#cbd5e1'},
    sunset:{c1:'#c2410c',c2:'#be123c',c3:'#fb923c',c4:'#fda4af'}
  };

  const style=document.createElement('style');
  style.textContent=`
    .v6-delete{background:rgba(180,35,24,.09)!important;color:var(--danger)!important}
    .v6-client-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .v6-color-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
    .v6-color-field{border:1px solid var(--line);border-radius:16px;padding:10px;background:rgba(255,255,255,.72)}
    .v6-color-field label{display:block;font-size:11px;font-weight:800;margin-bottom:7px;color:var(--muted)}
    .v6-color-field input[type=color]{width:100%;height:42px;border:0;padding:0;background:transparent;border-radius:12px;overflow:hidden}
    .v6-theme-preview{height:76px;border-radius:18px;margin-top:10px;border:1px solid rgba(255,255,255,.55);box-shadow:var(--shadow)}
    .v6-status-line{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
    .v6-chart-card{overflow:hidden}
    .v6-bars{height:160px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));align-items:end;gap:7px;padding:12px 2px 0}
    .v6-bar-col{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0}
    .v6-bar-value{font-size:9px;color:var(--muted);margin-bottom:5px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .v6-bar-track{height:112px;width:100%;max-width:34px;display:flex;align-items:flex-end;border-radius:10px;background:rgba(148,163,184,.12);overflow:hidden}
    .v6-bar{width:100%;min-height:2px;border-radius:9px 9px 4px 4px;background:linear-gradient(180deg,var(--accent),var(--accent-2));transition:.2s}
    .v6-bar.out{background:linear-gradient(180deg,var(--accent-2),var(--accent))}
    .v6-bar-label{font-size:9px;font-weight:800;color:var(--muted);margin-top:6px;white-space:nowrap;text-transform:uppercase}
    .v6-payer{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
    .v6-payer:last-child{border-bottom:0}.v6-rank{width:28px;height:28px;border-radius:10px;display:grid;place-items:center;background:rgba(37,99,235,.09);color:var(--accent);font-weight:900;font-size:11px}
    .v6-whatsapp{background:rgba(22,163,74,.10)!important;color:#15803d!important}
    .v6-pix-card{margin-top:12px}
    .v6-placeholder{font-size:10px;color:var(--muted);line-height:1.45;margin-top:6px}
    @media(max-width:380px){.v6-bars{gap:4px}.v6-bar-value{font-size:8px}.v6-color-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function themeDefaultsV6(name){return {...(V6_THEME_DEFAULTS[name]||V6_THEME_DEFAULTS.aurora)}}
  function validHexV6(v){return /^#[0-9a-f]{6}$/i.test(String(v||''))}
  function ensureSettingsV6(){
    state.settings=state.settings||{};
    if(!state.settings.themeMix||typeof state.settings.themeMix!=='object')state.settings.themeMix=themeDefaultsV6(state.settings.theme||'aurora');
    const d=themeDefaultsV6(state.settings.theme||'aurora');
    ['c1','c2','c3','c4'].forEach(k=>{if(!validHexV6(state.settings.themeMix[k]))state.settings.themeMix[k]=d[k]});
    if(typeof state.settings.themeMixActive!=='boolean')state.settings.themeMixActive=false;
    if(!state.settings.pixType)state.settings.pixType='CNPJ';
    if(!state.settings.pixKey)state.settings.pixKey='48379018000172';
    if(!state.settings.pixName)state.settings.pixName='RJOTA';
    if(!state.settings.whatsappMessage)state.settings.whatsappMessage=V6_DEFAULT_MESSAGE;
  }
  ensureSettingsV6();

  const applySettingsBeforeV6=applySettings;
  applySettings=function(){
    applySettingsBeforeV6();
    ensureSettingsV6();
    if(!state.settings.themeMixActive)return;
    const m=state.settings.themeMix,root=document.documentElement;
    root.style.setProperty('--accent',m.c1);
    root.style.setProperty('--accent-2',m.c2);
    if(!state.settings.customWallpaper){
      root.style.setProperty('--wallpaper',`radial-gradient(circle at 10% 0%, color-mix(in srgb, ${m.c1} 22%, transparent), transparent 38%),radial-gradient(circle at 92% 18%, color-mix(in srgb, ${m.c2} 18%, transparent), transparent 36%),linear-gradient(155deg,color-mix(in srgb, ${m.c3} 18%, white),color-mix(in srgb, ${m.c4} 18%, white))`);
    }
  };
  applySettings();

  const quickTheme=document.getElementById('themeQuickBtn');
  if(quickTheme)quickTheme.addEventListener('click',()=>{state.settings.themeMixActive=false},true);

  function clearLegacyLoanLinkV6(clientId,loanId){
    if(!Array.isArray(state.legacyControls))return;
    state.legacyControls.forEach(x=>{if(x.clientId===clientId&&x.contractId===loanId)x.contractId=''});
  }
  function deleteLoanV6(clientId,loanId,after){
    const cl=state.clients.find(x=>x.id===clientId),loan=(cl?.contracts||[]).find(x=>x.id===loanId);if(!cl||!loan)return;
    const extra=(loan.payments||[]).length+(loan.movements||[]).length;
    const msg=`Excluir o empréstimo “${loan.title||'Empréstimo'}” de ${cl.name}?${extra?`\n\nTambém serão excluídos ${extra} registro(s) de pagamentos/alterações vinculados.`:''}`;
    if(!confirm(msg))return;
    cl.contracts=(cl.contracts||[]).filter(x=>x.id!==loanId);clearLegacyLoanLinkV6(clientId,loanId);saveState();
    if(typeof after==='function')after();else render();
  }
  function deleteClientV6(clientId,after){
    const cl=state.clients.find(x=>x.id===clientId);if(!cl)return;
    const loans=(cl.contracts||[]).length,pays=(cl.contracts||[]).reduce((t,k)=>t+(k.payments||[]).length,0);
    const msg=`Excluir o cliente ${cl.name}?\n\nSerão excluídos também ${loans} empréstimo(s), ${pays} pagamento(s), garantias e registros de CRM vinculados. Esta ação não pode ser desfeita.`;
    if(!confirm(msg))return;
    state.clients=state.clients.filter(x=>x.id!==clientId);
    if(Array.isArray(state.legacyControls))state.legacyControls.forEach(x=>{if(x.clientId===clientId){x.clientId='';x.contractId=''}});
    saveState();closeModal();if(typeof after==='function')after();else render();
  }
  window.deleteLoanV6=deleteLoanV6;window.deleteClientV6=deleteClientV6;

  const contractHtmlBeforeV6=contractHtml;
  contractHtml=function(c,k){
    let html=contractHtmlBeforeV6(c,k);
    html=html.replace('</div></div>','</div></div>');
    return html.replace(/<\/div>\s*$/,'<div class="inline-actions"><button type="button" class="small-btn v6-delete delete-contract-v6" data-client="'+esc(c.id)+'" data-loan="'+esc(k.id)+'">Excluir empréstimo</button></div></div>');
  };

  const openClientDetailBeforeV6=openClientDetail;
  openClientDetail=function(id){
    openClientDetailBeforeV6(id);
    const head=document.querySelector('#modalContent .client-head');
    if(head&&!head.querySelector('.delete-client-v6')){
      const actions=document.createElement('div');actions.className='v6-client-actions';
      const del=document.createElement('button');del.type='button';del.className='small-btn v6-delete delete-client-v6';del.textContent='Excluir cliente';
      const edit=head.querySelector('#editClientBtn');if(edit){actions.appendChild(edit);actions.appendChild(del);head.appendChild(actions)}else head.appendChild(del);
      del.onclick=()=>deleteClientV6(id,()=>{currentView='clients';syncNav();render()});
    }
    document.querySelectorAll('#modalContent .delete-contract-v6').forEach(b=>b.onclick=()=>deleteLoanV6(b.dataset.client,b.dataset.loan,()=>{closeModal();openClientDetail(id)}));
  };

  const openContractModalBeforeV6=openContractModal;
  openContractModal=function(clientId,contractId){
    openContractModalBeforeV6(clientId,contractId);
    if(!contractId)return;
    const actions=document.querySelector('#modalContent #saveContractBtn')?.closest('.actions');
    if(actions&&!actions.querySelector('.delete-loan-modal-v6')){
      const b=document.createElement('button');b.type='button';b.className='danger-btn delete-loan-modal-v6';b.textContent='Excluir empréstimo';actions.appendChild(b);
      b.onclick=()=>deleteLoanV6(clientId,contractId,()=>{closeModal();if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();else openClientDetail(clientId)});
    }
  };

  const renderClientsBeforeV6=renderClients;
  renderClients=function(){
    renderClientsBeforeV6();
    document.querySelectorAll('.client-open').forEach(card=>{
      const id=card.dataset.id;if(!id)return;
      let row=card.querySelector('.client-actions-v5');
      if(!row){row=document.createElement('div');row.className='client-actions-v5';card.appendChild(row)}
      if(!row.querySelector('.delete-client-card-v6')){
        const b=document.createElement('button');b.type='button';b.className='small-btn v6-delete delete-client-card-v6';b.textContent='Excluir cliente';
        b.onclick=e=>{e.stopPropagation();deleteClientV6(id,()=>renderClients())};row.appendChild(b);
      }
    });
  };

  if(typeof renderLoans2==='function'){
    const renderLoansBeforeV6=renderLoans2;
    renderLoans2=function(){
      renderLoansBeforeV6();
      document.querySelectorAll('.loan-card').forEach(card=>{
        const ref=card.querySelector('.edit-loan2');if(!ref)return;
        const row=card.querySelector('.inline-actions');if(!row||row.querySelector('.delete-loan-card-v6'))return;
        const b=document.createElement('button');b.type='button';b.className='small-btn v6-delete delete-loan-card-v6';b.textContent='Excluir';
        b.onclick=()=>deleteLoanV6(ref.dataset.client,ref.dataset.loan,()=>renderLoans2());row.appendChild(b);
      });
    };
  }

  function monthKeyV6(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function dateKeyV6(value){
    if(!value)return '';
    const s=String(value);if(/^\d{4}-\d{2}/.test(s))return s.slice(0,7);
    const d=new Date(s);return Number.isNaN(d.getTime())?'':monthKeyV6(d);
  }
  function lastMonthsV6(n=6){
    const now=new Date(),out=[];
    for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push({key:monthKeyV6(d),label:d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')})}
    return out;
  }
  function receivedSeriesV6(months){
    const map=Object.fromEntries(months.map(m=>[m.key,0]));
    state.clients.forEach(cl=>(cl.contracts||[]).forEach(k=>(k.payments||[]).forEach(p=>{const key=dateKeyV6(p.paidAt)||String(p.reference||'').slice(0,7);if(Object.hasOwn(map,key))map[key]+=Number(p.amount)||0})));
    return months.map(m=>({...m,value:map[m.key]||0}));
  }
  function outflowSeriesV6(months){
    const map=Object.fromEntries(months.map(m=>[m.key,0]));
    state.clients.forEach(cl=>(cl.contracts||[]).forEach(k=>{
      const baseKey=dateKeyV6(k.startDate)||dateKeyV6(k.createdAt);if(Object.hasOwn(map,baseKey))map[baseKey]+=Number(k.initialPrincipal)||0;
      (k.movements||[]).filter(m=>m.type==='increase').forEach(m=>{const key=dateKeyV6(m.date)||dateKeyV6(m.createdAt);if(Object.hasOwn(map,key))map[key]+=Number(m.amount)||0});
    }));
    return months.map(m=>({...m,value:map[m.key]||0}));
  }
  function compactMoneyV6(v){
    const n=Number(v)||0;if(n>=1000000)return `R$ ${(n/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mi`;
    if(n>=1000)return `R$ ${(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`;
    return `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
  }
  function chartHtmlV6(title,subtitle,series,kind){
    const max=Math.max(1,...series.map(x=>x.value));
    return `<div class="section-title"><h2>${esc(title)}</h2><small>últimos 6 meses</small></div><div class="card v6-chart-card"><div class="muted">${esc(subtitle)}</div><div class="v6-bars">${series.map(x=>{const pct=x.value?Math.max(4,(x.value/max)*100):2;return `<div class="v6-bar-col" title="${esc(x.label)}: ${esc(brl(x.value))}"><div class="v6-bar-value">${esc(compactMoneyV6(x.value))}</div><div class="v6-bar-track"><div class="v6-bar ${kind==='out'?'out':''}" style="height:${pct.toFixed(1)}%"></div></div><div class="v6-bar-label">${esc(x.label)}</div></div>`}).join('')}</div></div>`;
  }
  function topPayersV6(limit=5){
    return state.clients.map(c=>({c,total:(c.contracts||[]).reduce((sum,k)=>sum+(k.payments||[]).reduce((t,p)=>t+(Number(p.amount)||0),0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,limit);
  }
  function dashboardExtrasV6(){
    const view=document.getElementById('view');if(!view||document.getElementById('financeChartsV6'))return;
    const months=lastMonthsV6(),received=receivedSeriesV6(months),outflow=outflowSeriesV6(months),payers=topPayersV6();
    view.insertAdjacentHTML('beforeend',`<div id="financeChartsV6">${chartHtmlV6('Gráfico de recebimentos','Pagamentos registrados pela data de recebimento.',received,'in')}${chartHtmlV6('Gráfico de saídas','Capital liberado em novos empréstimos e acréscimos de saldo.',outflow,'out')}<div class="section-title"><h2>Maiores pagadores</h2><small>histórico total</small></div><div class="card">${payers.length?payers.map((x,i)=>`<div class="v6-payer"><div class="v6-rank">${i+1}</div><div><div class="title">${esc(x.c.name)}</div><div class="muted">Total de pagamentos registrados</div></div><strong class="money">${brl(x.total)}</strong></div>`).join(''):'<div class="empty">Os maiores pagadores aparecerão após registrar pagamentos.</div>'}</div></div>`);
  }

  function normalizePhoneV6(phone=''){
    let d=String(phone).replace(/\D/g,'');
    if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;
    return d;
  }
  function pixMessageV6(cl,x){
    ensureSettingsV6();const s=state.settings;
    const vals={
      nome:cl.name||'cliente',valor:brl(x.amount),referencia:x.ref||'',vencimento:x.due.toLocaleDateString('pt-BR'),
      tipo_pix:s.pixType||'',chave_pix:s.pixKey||'',favorecido:s.pixName||''
    };
    return String(s.whatsappMessage||V6_DEFAULT_MESSAGE).replace(/\{(nome|valor|referencia|vencimento|tipo_pix|chave_pix|favorecido)\}/g,(_,k)=>vals[k]??'');
  }
  function openWhatsAppV6(clientId,contractId,ref){
    const cl=state.clients.find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const phone=normalizePhoneV6(cl.phone);if(phone.length<12){alert(`Cadastre um telefone com DDD para ${cl.name} antes de enviar a cobrança pelo WhatsApp.`);return}
    const [y,m]=String(ref).split('-').map(Number),x=chargeFor(cl,k,y,m-1);const msg=pixMessageV6(cl,x);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
  }
  window.openWhatsAppV6=openWhatsAppV6;

  function addWhatsAppButtonsV6(root=document){
    root.querySelectorAll('.pay-btn').forEach(pay=>{
      const row=pay.closest('.inline-actions');if(!row||row.querySelector('.v6-whatsapp'))return;
      const b=document.createElement('button');b.type='button';b.className='small-btn v6-whatsapp';b.textContent='WhatsApp + PIX';
      b.onclick=()=>openWhatsAppV6(pay.dataset.c,pay.dataset.k,pay.dataset.r);row.appendChild(b);
    });
  }

  const renderDashboardBeforeV6=renderDashboard;
  renderDashboard=function(){renderDashboardBeforeV6();addWhatsAppButtonsV6(document.getElementById('view'));dashboardExtrasV6()};
  const renderChargesBeforeV6=renderCharges;
  renderCharges=function(){renderChargesBeforeV6();addWhatsAppButtonsV6(document.getElementById('view'))};

  function themePreviewV6(m){return `radial-gradient(circle at 10% 10%, ${m.c1}66, transparent 36%),radial-gradient(circle at 90% 18%, ${m.c2}55, transparent 34%),linear-gradient(145deg,${m.c3},${m.c4})`}
  function injectThemeMixV6(){
    const title=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Personalização');const card=title?.closest('.section-title')?.nextElementSibling;if(!card||card.querySelector('#themeMixV6'))return;
    ensureSettingsV6();const m=state.settings.themeMix;
    card.insertAdjacentHTML('beforeend',`<div id="themeMixV6"><div class="section-title compact-title"><h2>Mix de 4 cores</h2><small>${state.settings.themeMixActive?'personalizado ativo':'tema pronto ativo'}</small></div><div class="v6-color-grid">${[['c1','Cor 1 — principal'],['c2','Cor 2 — secundária'],['c3','Cor 3 — fundo A'],['c4','Cor 4 — fundo B']].map(([k,l])=>`<div class="v6-color-field"><label>${l}</label><input type="color" data-v6-color="${k}" value="${m[k]}"></div>`).join('')}</div><div class="v6-theme-preview" id="themePreviewV6" style="background:${themePreviewV6(m)}"></div><div class="v6-status-line"><div class="muted">Ao alterar qualquer cor, o mix personalizado é ativado.</div><button type="button" class="small-btn" id="resetThemeMixV6">Usar tema pronto</button></div></div>`);
    const select=document.getElementById('themeSelect');if(select)select.addEventListener('change',()=>{state.settings.themeMixActive=false;state.settings.themeMix=themeDefaultsV6(select.value)},true);
    card.querySelectorAll('[data-v6-color]').forEach(inp=>{
      inp.oninput=()=>{state.settings.themeMix[inp.dataset.v6Color]=inp.value;state.settings.themeMixActive=true;applySettings();document.getElementById('themePreviewV6').style.background=themePreviewV6(state.settings.themeMix)};
      inp.onchange=()=>{saveState();renderSettings()};
    });
    document.getElementById('resetThemeMixV6').onclick=()=>{state.settings.themeMixActive=false;state.settings.themeMix=themeDefaultsV6(state.settings.theme||'aurora');saveState();renderSettings()};
  }

  function injectPixSettingsV6(){
    if(document.getElementById('pixSettingsV6'))return;ensureSettingsV6();
    const dataTitle=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Dados e backup');const anchor=dataTitle?.closest('.section-title');if(!anchor)return;
    const s=state.settings;
    anchor.insertAdjacentHTML('beforebegin',`<div id="pixSettingsV6"><div class="section-title"><h2>PIX e WhatsApp</h2><small>cobranças</small></div><div class="card v6-pix-card"><div class="two"><div class="field"><label>Tipo da chave PIX</label><select id="pixTypeV6">${['CNPJ','CPF','Telefone','E-mail','Chave aleatória'].map(x=>`<option ${s.pixType===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Favorecido</label><input id="pixNameV6" value="${esc(s.pixName||'')}"></div></div><div class="field"><label>Chave PIX</label><input id="pixKeyV6" value="${esc(s.pixKey||'')}" autocomplete="off"></div><div class="field"><label>Mensagem do WhatsApp</label><textarea id="whatsappMessageV6">${esc(s.whatsappMessage||V6_DEFAULT_MESSAGE)}</textarea><div class="v6-placeholder">Campos automáticos: {nome}, {valor}, {referencia}, {vencimento}, {tipo_pix}, {chave_pix}, {favorecido}</div></div><div class="actions"><button type="button" class="primary-btn" id="savePixV6">Salvar PIX e mensagem</button><button type="button" class="soft-btn" id="copyPixV6">Copiar chave</button></div></div></div>`);
    document.getElementById('savePixV6').onclick=()=>{const key=document.getElementById('pixKeyV6').value.trim();if(!key){alert('Informe a chave PIX.');return}state.settings.pixType=document.getElementById('pixTypeV6').value;state.settings.pixKey=key;state.settings.pixName=document.getElementById('pixNameV6').value.trim();state.settings.whatsappMessage=document.getElementById('whatsappMessageV6').value.trim()||V6_DEFAULT_MESSAGE;saveState();alert('Dados do PIX e mensagem salvos.')};
    document.getElementById('copyPixV6').onclick=async()=>{const key=document.getElementById('pixKeyV6').value.trim();try{await navigator.clipboard.writeText(key);alert('Chave PIX copiada.')}catch(_){document.getElementById('pixKeyV6').select();document.execCommand('copy');alert('Chave PIX copiada.')}};
  }

  const renderSettingsBeforeV6=renderSettings;
  renderSettings=function(){renderSettingsBeforeV6();injectThemeMixV6();injectPixSettingsV6()};

  // Re-renderiza a visão atual para aplicar imediatamente os novos controles.
  if(currentView==='dashboard')renderDashboard();
  else if(currentView==='clients')renderClients();
  else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
  else if(currentView==='charges')renderCharges();
})();
