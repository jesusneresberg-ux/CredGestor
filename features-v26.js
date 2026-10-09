// CrediGestor v26 — cobranças por situação, navegação de empréstimos e selo "Em dia".
(function(){
  'use strict';

  const VERSION='26.0';
  let chargeTabV26='today';
  let renderedDayV26=dateKeyV26(new Date());

  const style=document.createElement('style');
  style.textContent=`
    .v26-charge-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    .v26-charge-tab{border:1px solid var(--line);border-radius:14px;background:var(--card,#fff);padding:10px 8px;cursor:pointer;font-weight:850;color:var(--muted)}
    .v26-charge-tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
    .v26-charge-tab small{display:block;font-size:10px;font-weight:700;margin-top:3px;opacity:.86}
    .v26-charge-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}
    .v26-charge-kpi{border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(148,163,184,.06);text-align:center;min-width:0}
    .v26-charge-kpi b{display:block;font-size:16px;overflow:hidden;text-overflow:ellipsis}
    .v26-charge-kpi span{font-size:10px;color:var(--muted)}
    .v26-client-link{border:0;background:none;padding:0;margin:0;color:var(--accent);font:inherit;font-weight:900;cursor:pointer;text-align:left}
    .v26-client-link:hover{text-decoration:underline}
    .v26-current-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 9px;background:rgba(22,163,74,.12);color:#15803d;font-size:10px;font-weight:900;white-space:nowrap}
    .v26-status-wrap{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
    .v26-new-loan{margin-left:auto}
    .v26-charge-client{display:flex;align-items:center;gap:9px;min-width:0}
    .v26-charge-client .avatar{flex:0 0 auto}
    .v26-charge-card .inline-actions{flex-wrap:wrap}
    @media(max-width:520px){
      .v26-charge-tabs{grid-template-columns:1fr}
      .v26-charge-summary{grid-template-columns:1fr 1fr 1fr}
      .v26-charge-kpi{padding:8px 4px}.v26-charge-kpi b{font-size:13px}
    }
  `;
  document.head.appendChild(style);

  function escV26(v=''){
    try{return typeof esc==='function'?esc(v):String(v)}
    catch(_){return String(v)}
  }
  function brlV26(v){
    try{return typeof brl==='function'?brl(Number(v)||0):Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
    catch(_){return `R$ ${Number(v||0).toFixed(2)}`}
  }
  function dateKeyV26(d){
    const x=d instanceof Date?d:new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  }
  function monthRefV26(y,m){return `${y}-${String(m+1).padStart(2,'0')}`}
  function atNoonV26(d){const x=new Date(d);x.setHours(12,0,0,0);return x}
  function cssEscapeV26(v){
    if(window.CSS&&typeof CSS.escape==='function')return CSS.escape(String(v));
    return String(v).replace(/["\\]/g,'\\$&');
  }
  function activeLoansV26(){
    return (state?.clients||[]).flatMap(cl=>(cl?.contracts||[]).filter(k=>k?.active!==false).map(k=>({cl,k})));
  }
  function paymentTotalV26(k,ref){
    if(window.CrediGestorPaymentsV27?.paid)return window.CrediGestorPaymentsV27.paid(k,ref);
    const shortRef=String(ref).slice(5);
    return (k?.payments||[]).reduce((sum,p)=>{
      const pr=String(p?.reference||p?.ref||'');
      const paidAt=String(p?.paidAt||p?.date||'');
      const same=pr===ref||pr===shortRef||(!pr&&paidAt.slice(0,7)===ref);
      return same?sum+Math.max(0,Number(p?.amount)||0):sum;
    },0);
  }
  function obligationV26(cl,k,year,monthIndex){
    let x=null;
    try{x=typeof chargeFor==='function'?chargeFor(cl,k,year,monthIndex):null}catch(_){ }
    if(!x||x.status==='not_due')return null;

    const due=x.due instanceof Date?atNoonV26(x.due):atNoonV26(new Date(x.due));
    if(Number.isNaN(due.getTime()))return null;

    const ref=String(x.ref||monthRefV26(year,monthIndex));
    let amount=Math.max(0,Number(x.amount)||0);
    if(amount<=0){
      try{amount=Math.max(0,Number(monthlyDue(k))||0)}catch(_){amount=0}
    }
    if(amount<=0)return null;

    const paid=paymentTotalV26(k,ref);
    const remaining=Math.max(0,amount-paid);
    if(remaining<=0.009)return null;
    return {cl,k,due,ref,amount,paid,remaining};
  }
  function buildChargeGroupsV26(){
    const now=atNoonV26(new Date());
    const today=dateKeyV26(now);
    const groups={today:[],late:[],next:[]};
    const future=[];
    const seen=new Set();

    for(let off=-2;off<=2;off++){
      const d=new Date(now.getFullYear(),now.getMonth()+off,1,12,0,0,0);
      activeLoansV26().forEach(({cl,k})=>{
        const item=obligationV26(cl,k,d.getFullYear(),d.getMonth());
        if(!item)return;
        const key=`${cl.id}|${k.id}|${item.ref}`;
        if(seen.has(key))return;
        seen.add(key);

        const dk=dateKeyV26(item.due);
        item.days=Math.round((item.due-now)/86400000);
        if(dk<today)groups.late.push(item);
        else if(dk===today)groups.today.push(item);
        else future.push(item);
      });
    }

    future.sort((a,b)=>a.due-b.due||String(a.cl?.name||'').localeCompare(String(b.cl?.name||''),'pt-BR'));
    const nextSeen=new Set();
    for(const item of future){
      const key=`${item.cl.id}|${item.k.id}`;
      if(nextSeen.has(key))continue;
      nextSeen.add(key);
      groups.next.push(item);
    }

    groups.late.sort((a,b)=>a.due-b.due||String(a.cl?.name||'').localeCompare(String(b.cl?.name||''),'pt-BR'));
    groups.today.sort((a,b)=>String(a.cl?.name||'').localeCompare(String(b.cl?.name||''),'pt-BR'));
    return groups;
  }

  function originalHostV26(){
    let host=document.getElementById('v26OriginalChargesHost');
    if(!host){
      host=document.createElement('div');
      host.id='v26OriginalChargesHost';
      host.hidden=true;
      document.body.appendChild(host);
    }
    return host;
  }
  function moveViewToHostV26(tag){
    const view=document.getElementById('view'),host=originalHostV26();
    if(!view)return;
    const box=document.createElement('div');
    box.dataset.v26Source=tag;
    while(view.firstChild)box.appendChild(view.firstChild);
    host.appendChild(box);
  }
  function refreshOriginalChargeActionsV26(base){
    const host=originalHostV26();
    host.innerHTML='';
    const old=typeof chargeFilter!=='undefined'?chargeFilter:'month';

    for(const f of ['month','late','next']){
      try{
        if(typeof chargeFilter!=='undefined')chargeFilter=f;
        base();
        moveViewToHostV26(f);
      }catch(err){console.warn('CrediGestor v26: visão original de cobranças indisponível.',err)}
    }
    try{if(typeof chargeFilter!=='undefined')chargeFilter=old}catch(_){ }
  }
  function hiddenPayV26(c,k,r){
    return originalHostV26().querySelector(`.pay-btn[data-c="${cssEscapeV26(c)}"][data-k="${cssEscapeV26(k)}"][data-r="${cssEscapeV26(r)}"]`);
  }
  function hiddenAssistantV26(c,k,r){
    const pay=hiddenPayV26(c,k,r);
    return pay?.closest('.inline-actions')?.querySelector('.v22-assistant-btn')||null;
  }
  function chargeCardV26(x){
    const initials=String(x.cl?.name||'C').trim().slice(0,2).toUpperCase();
    const assistant=hiddenAssistantV26(x.cl.id,x.k.id,x.ref)
      ? `<button type="button" class="small-btn v26-assistant" data-c="${escV26(x.cl.id)}" data-k="${escV26(x.k.id)}" data-r="${escV26(x.ref)}">🤖 Assistente WhatsApp</button>`
      : '';
    return `<article class="list-item v26-charge-card">
      <div class="row space">
        <div class="v26-charge-client"><div class="avatar">${escV26(initials)}</div><div>
          <button type="button" class="v26-client-link" data-v26-client="${escV26(x.cl.id)}">${escV26(x.cl?.name||'Cliente')}</button>
          <div class="muted">${x.due.toLocaleDateString('pt-BR')} • ref. ${escV26(x.ref)}</div>
        </div></div>
        <span class="status ${x.days<0?'late':'open'}">${x.days<0?'ATRASADO':x.days===0?'HOJE':'ABERTO'}</span>
      </div>
      <div class="row space" style="margin-top:11px;gap:12px">
        <div><div class="muted">Saldo da cobrança</div><strong class="money">${brlV26(x.remaining)}</strong>${x.paid>0?`<div class="muted">Pago: ${brlV26(x.paid)} de ${brlV26(x.amount)}</div>`:''}</div>
        <div class="inline-actions" style="margin:0">
          <button type="button" class="small-btn v26-pay" data-c="${escV26(x.cl.id)}" data-k="${escV26(x.k.id)}" data-r="${escV26(x.ref)}">Registrar pagamento</button>
          <button type="button" class="small-btn v26-open-loan" data-c="${escV26(x.cl.id)}" data-k="${escV26(x.k.id)}">Abrir empréstimo</button>
          ${assistant}
        </div>
      </div>
    </article>`;
  }
  function renderChargeHubV26(){
    const view=document.getElementById('view');
    if(!view)return;
    const groups=buildChargeGroupsV26();
    const list=groups[chargeTabV26]||[];
    const total=list.reduce((s,x)=>s+x.remaining,0);
    const title=chargeTabV26==='today'?'Cobranças de hoje':chargeTabV26==='late'?'Atrasados':'Próximos vencimentos';

    view.innerHTML=`
      <section class="hero"><div class="label">COBRANÇAS</div><div class="big">${title}</div><div class="muted">A lista é atualizada automaticamente conforme a data e os pagamentos registrados.</div></section>
      <div class="v26-charge-tabs">
        <button type="button" class="v26-charge-tab ${chargeTabV26==='today'?'active':''}" data-v26-tab="today">Hoje<small>${groups.today.length} cobrança(s)</small></button>
        <button type="button" class="v26-charge-tab ${chargeTabV26==='late'?'active':''}" data-v26-tab="late">Atrasados<small>${groups.late.length} cobrança(s)</small></button>
        <button type="button" class="v26-charge-tab ${chargeTabV26==='next'?'active':''}" data-v26-tab="next">Próximos<small>${groups.next.length} cobrança(s)</small></button>
      </div>
      <div class="v26-charge-summary">
        <div class="v26-charge-kpi"><b>${list.length}</b><span>cobranças</span></div>
        <div class="v26-charge-kpi"><b>${brlV26(total)}</b><span>a cobrar</span></div>
        <div class="v26-charge-kpi"><b>${new Date().toLocaleDateString('pt-BR')}</b><span>hoje</span></div>
      </div>
      <div class="list">${list.length?list.map(chargeCardV26).join(''):'<div class="empty card">Nenhuma cobrança nesta categoria.</div>'}</div>
    `;

    view.querySelectorAll('[data-v26-tab]').forEach(b=>b.onclick=()=>{chargeTabV26=b.dataset.v26Tab;renderCharges()});
    view.querySelectorAll('[data-v26-client]').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.v26Client));
    view.querySelectorAll('.v26-open-loan').forEach(b=>b.onclick=()=>openContractModal(b.dataset.c,b.dataset.k));
    view.querySelectorAll('.v26-pay').forEach(b=>b.onclick=()=>{
      const hidden=hiddenPayV26(b.dataset.c,b.dataset.k,b.dataset.r);
      if(hidden)hidden.click();
      else if(typeof openPaymentModal==='function')openPaymentModal(b.dataset.c,b.dataset.k,b.dataset.r);
    });
    view.querySelectorAll('.v26-assistant').forEach(b=>b.onclick=()=>{
      const hidden=hiddenAssistantV26(b.dataset.c,b.dataset.k,b.dataset.r);
      if(hidden)hidden.click();
    });
  }

  if(typeof renderCharges==='function'){
    const baseChargesV26=renderCharges;
    renderCharges=function(){
      refreshOriginalChargeActionsV26(baseChargesV26);
      renderChargeHubV26();
    };
  }

  function clientHasDueProblemV26(cl){
    const groups=buildChargeGroupsV26();
    return groups.late.some(x=>x.cl.id===cl.id)||groups.today.some(x=>x.cl.id===cl.id);
  }
  function decorateLoansV26(){
    const view=document.getElementById('view');
    if(!view)return;

    const title=[...view.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Empréstimos');
    const titleRow=title?.closest('.section-title');
    if(titleRow&&!titleRow.querySelector('.v26-new-loan')){
      const b=document.createElement('button');
      b.type='button';b.className='small-btn v26-new-loan';b.textContent='+ Novo empréstimo';
      b.onclick=()=>{
        if(typeof selectClientForLoan2==='function')selectClientForLoan2();
        else document.getElementById('addLoanFab2')?.click();
      };
      titleRow.appendChild(b);
    }

    view.querySelectorAll('.loan-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2');
      if(!ref)return;
      const cl=(state.clients||[]).find(x=>x.id===ref.dataset.client);
      const k=(cl?.contracts||[]).find(x=>x.id===ref.dataset.loan);
      if(!cl||!k)return;

      const info=card.querySelector('.loan-main-row .muted');
      if(info&&!info.querySelector('.v26-client-link')){
        info.innerHTML=`<button type="button" class="v26-client-link" data-v26-client="${escV26(cl.id)}">${escV26(cl.name)}</button>${cl.cpf?` <span>• CPF ${escV26(cl.cpf)}</span>`:''}`;
      }

      if(k.active!==false&&!clientHasDueProblemV26(cl)&&!card.querySelector('.v26-current-badge')){
        const top=card.querySelector('.row.space');
        const status=top?.querySelector('.status');
        if(top){
          let wrap=top.querySelector('.v26-status-wrap');
          if(!wrap){
            wrap=document.createElement('div');wrap.className='v26-status-wrap';
            if(status){status.replaceWith(wrap);wrap.appendChild(status)}else top.appendChild(wrap);
          }
          const badge=document.createElement('span');
          badge.className='v26-current-badge';
          badge.textContent='✓ Em dia';
          wrap.insertBefore(badge,wrap.firstChild);
        }
      }
    });

    view.querySelectorAll('.v26-client-link[data-v26-client]').forEach(b=>b.onclick=e=>{
      e.preventDefault();e.stopPropagation();openClientDetail(b.dataset.v26Client);
    });
  }

  if(typeof renderLoans2==='function'){
    const baseLoansV26=renderLoans2;
    renderLoans2=function(){const out=baseLoansV26();decorateLoansV26();return out};
  }

  function refreshOnDayChangeV26(){
    const key=dateKeyV26(new Date());
    if(key===renderedDayV26)return;
    renderedDayV26=key;
    try{
      if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();
      else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
    }catch(_){ }
  }
  setInterval(refreshOnDayChangeV26,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOnDayChangeV26()});

  try{
    if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();
    else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
  }catch(err){console.warn('CrediGestor v26 carregado com aviso.',err)}

  window.__credigestorV26={
    version:VERSION,
    chargeTabs:true,
    clickableLoanClients:true,
    newLoanShortcut:true,
    currentBadge:true,
    automaticDayRefresh:true
  };
})();
