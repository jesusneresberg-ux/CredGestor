// CrediGestor v22 — Assistente de Cobrança via WhatsApp + juros proporcionais por dias do mês.
(function(){
  'use strict';

  const VERSION='22';
  const DEFAULTS={
    enabled:true,
    interestMode:'calendar_days',
    assistantDefault:'due_today',
    includePix:true,
    includeBreakdown:true,
    templates:{
      due_today:'Olá, {nome}. Passando para lembrar que sua cobrança de {valor_atualizado}, referente a {referencia}, vence hoje ({vencimento}).{juros_bloco}{pix_bloco}',
      upcoming:'Olá, {nome}. Sua cobrança de {valor_atualizado}, referente a {referencia}, vence em {vencimento}.{juros_bloco}{pix_bloco}',
      overdue:'Olá, {nome}. Consta em aberto a cobrança referente a {referencia}, vencida em {vencimento}. Valor atualizado até {data_atual}: {valor_atualizado}.{juros_bloco}{pix_bloco}',
      negotiate:'Olá, {nome}. Estou entrando em contato sobre a cobrança referente a {referencia}. O valor atualizado até {data_atual} é {valor_atualizado}. Se precisar, podemos alinhar a melhor forma de regularização.{juros_bloco}{pix_bloco}',
      paid:'Olá, {nome}. Pagamento recebido com sucesso. Obrigado! Referência: {referencia}. Valor registrado: {valor_atualizado}.'
    }
  };

  const style=document.createElement('style');
  style.textContent=`
    .v22-assistant-btn{background:rgba(37,99,235,.10)!important;color:var(--accent)!important}
    .v22-assistant-card{border:1px solid var(--line);border-radius:18px;padding:14px;background:rgba(148,163,184,.055);margin-top:10px}
    .v22-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .v22-preview{white-space:pre-wrap;line-height:1.5;font-size:12px;border:1px dashed var(--line);border-radius:14px;padding:12px;background:rgba(255,255,255,.68);margin-top:10px}
    .v22-calc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
    .v22-kpi{border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(148,163,184,.05)}
    .v22-kpi small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;font-weight:800}
    .v22-kpi strong{display:block;margin-top:4px;font-size:13px}
    .v22-tag{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:rgba(37,99,235,.09);color:var(--accent);font-size:10px;font-weight:850}
    .v22-settings textarea{min-height:90px}
    @media(max-width:430px){.v22-grid,.v22-calc{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function esc22(v=''){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function brl22(v){return typeof brl==='function'?brl(v):Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function dateBR22(v){const d=v instanceof Date?v:new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR')}
  function dateKey22(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function daysInMonth22(d){return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
  function clamp22(n,min,max){return Math.max(min,Math.min(max,n))}

  function ensureSettings22(){
    state.settings=state.settings||{};
    if(!state.settings.collectionAssistant22||typeof state.settings.collectionAssistant22!=='object')state.settings.collectionAssistant22={};
    const s=state.settings.collectionAssistant22;
    if(typeof s.enabled!=='boolean')s.enabled=DEFAULTS.enabled;
    if(!s.interestMode)s.interestMode=DEFAULTS.interestMode;
    if(!s.assistantDefault)s.assistantDefault=DEFAULTS.assistantDefault;
    if(typeof s.includePix!=='boolean')s.includePix=DEFAULTS.includePix;
    if(typeof s.includeBreakdown!=='boolean')s.includeBreakdown=DEFAULTS.includeBreakdown;
    s.templates=s.templates||{};
    Object.entries(DEFAULTS.templates).forEach(([k,v])=>{if(!s.templates[k])s.templates[k]=v});
    return s;
  }
  ensureSettings22();

  function normalizePhone22(phone=''){
    let d=String(phone||'').replace(/\D/g,'');
    if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;
    return d;
  }

  function findCharge22(clientId,contractId,ref){
    const cl=(state.clients||[]).find(x=>String(x.id)===String(clientId));
    const k=(cl?.contracts||[]).find(x=>String(x.id)===String(contractId));
    if(!cl||!k)return null;
    let x=null;
    try{
      const [y,m]=String(ref||'').split('-').map(Number);
      if(typeof chargeFor==='function'&&y&&m)x=chargeFor(cl,k,y,m-1);
    }catch(_){ }
    return {cl,k,x,ref:String(ref||'')};
  }

  function principal22(k,x){
    const candidates=[x?.principal,x?.basePrincipal,k.currentPrincipal,k.principal,k.initialPrincipal,k.amount,k.value];
    for(const v of candidates){const n=Number(v);if(Number.isFinite(n)&&n>0)return n}
    return 0;
  }
  function monthlyRate22(k,x){
    const candidates=[x?.rate,k.interestRate,k.rate,k.monthlyRate,k.interest];
    for(const v of candidates){const n=Number(v);if(Number.isFinite(n)&&n>=0)return n>1?n/100:n}
    return 0;
  }
  function dueDate22(k,x,ref){
    if(x?.due instanceof Date&&!Number.isNaN(x.due.getTime()))return new Date(x.due);
    if(x?.due){const d=new Date(x.due);if(!Number.isNaN(d.getTime()))return d}
    const [y,m]=String(ref||'').split('-').map(Number);
    if(y&&m){
      const preferred=Number(k.dueDay||k.paymentDay||new Date(k.startDate||k.createdAt||Date.now()).getDate())||1;
      const last=new Date(y,m,0).getDate();return new Date(y,m-1,Math.min(preferred,last));
    }
    return new Date();
  }

  // Juros simples proporcionais pelo número real de dias de cada mês atravessado.
  // Ex.: 20% a.m. em mês de 30 dias = 20/30 por dia naquele mês.
  function proportionalInterest22(base,monthlyRate,start,end){
    base=Number(base)||0; monthlyRate=Number(monthlyRate)||0;
    const s=new Date(start),e=new Date(end);
    if(!base||!monthlyRate||Number.isNaN(s.getTime())||Number.isNaN(e.getTime())||e<=s)return {interest:0,days:0,segments:[]};
    let cursor=new Date(s.getFullYear(),s.getMonth(),s.getDate());
    const finish=new Date(e.getFullYear(),e.getMonth(),e.getDate());
    let interest=0,days=0; const segments=[];
    while(cursor<finish){
      const dim=daysInMonth22(cursor);
      const nextMonth=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
      const segmentEnd=nextMonth<finish?nextMonth:finish;
      const segDays=Math.max(0,Math.round((segmentEnd-cursor)/86400000));
      const ratePerDay=monthlyRate/dim;
      const value=base*ratePerDay*segDays;
      interest+=value; days+=segDays;
      segments.push({month:`${String(cursor.getMonth()+1).padStart(2,'0')}/${cursor.getFullYear()}`,days:segDays,monthDays:dim,ratePerDay,value});
      cursor=segmentEnd;
    }
    return {interest,days,segments};
  }
  window.CrediGestorInterestV22=proportionalInterest22;

  function calculation22(hit,asOf=new Date()){
    const {k,x,ref}=hit;
    const due=dueDate22(k,x,ref);
    const base=principal22(k,x);
    const rate=monthlyRate22(k,x);
    const scheduled=Number(x?.amount)||Number(k.installmentAmount)||Number(k.summaryTotal)||base*(1+rate);
    const overdue=asOf>due;
    const calc=overdue?proportionalInterest22(base,rate,due,asOf):{interest:0,days:0,segments:[]};
    const updated=overdue?Math.max(scheduled,base+calc.interest):scheduled;
    return {due,base,rate,scheduled,updated,overdue,...calc};
  }

  function pixBlock22(){
    const cfg=state.settings||{};
    const key=cfg.pixKey||'',type=cfg.pixType||'',name=cfg.pixName||'';
    if(!key)return '';
    return `\n\n💳 *Pagamento via PIX*\nTipo: ${type}\nChave: ${key}${name?`\nFavorecido: ${name}`:''}`;
  }
  function interestBlock22(c){
    if(!c.overdue||c.interest<=0)return '';
    const pctDay=c.rate?((c.rate/(c.segments[0]?.monthDays||30))*100):0;
    return `\n\n📊 Atualização proporcional\nCapital-base: ${brl22(c.base)}\nDias considerados: ${c.days}\nJuros calculados: ${brl22(c.interest)}${pctDay?`\nTaxa diária inicial: ${pctDay.toLocaleString('pt-BR',{maximumFractionDigits:4})}%`:''}`;
  }
  function message22(hit,type,asOf=new Date()){
    const s=ensureSettings22(),c=calculation22(hit,asOf),{cl,ref}=hit;
    const vals={
      nome:cl.name||'cliente',
      referencia:ref,
      vencimento:dateBR22(c.due),
      data_atual:dateBR22(asOf),
      valor_atualizado:brl22(c.updated),
      valor_original:brl22(c.scheduled),
      juros:brl22(c.interest),
      dias:String(c.days),
      juros_bloco:s.includeBreakdown?interestBlock22(c):'',
      pix_bloco:s.includePix?pixBlock22():''
    };
    return String(s.templates[type]||s.templates.upcoming||DEFAULTS.templates.upcoming).replace(/\{(nome|referencia|vencimento|data_atual|valor_atualizado|valor_original|juros|dias|juros_bloco|pix_bloco)\}/g,(_,k)=>vals[k]??'');
  }

  function openAssistant22(clientId,contractId,ref){
    const hit=findCharge22(clientId,contractId,ref);if(!hit)return alert('Não foi possível localizar esta cobrança.');
    const phone=normalizePhone22(hit.cl.phone);
    const s=ensureSettings22(),c=calculation22(hit,new Date());
    const suggested=c.overdue?'overdue':(dateKey22(c.due)===dateKey22(new Date())?'due_today':'upcoming');
    const initial=s.assistantDefault==='auto'?suggested:(s.assistantDefault||suggested);
    if(typeof openModal!=='function')return alert('Assistente indisponível nesta tela.');
    openModal(`
      <div class="section-title"><h2>Assistente de Cobrança</h2><small>WhatsApp • v${VERSION}</small></div>
      <div class="v22-assistant-card">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><strong>${esc22(hit.cl.name||'Cliente')}</strong><div class="muted">${esc22(ref)}</div></div><span class="v22-tag">${c.overdue?'Atrasada':dateKey22(c.due)===dateKey22(new Date())?'Vence hoje':'Próxima'}</span></div>
        <div class="v22-calc">
          <div class="v22-kpi"><small>Valor original</small><strong>${brl22(c.scheduled)}</strong></div>
          <div class="v22-kpi"><small>Valor atualizado</small><strong id="v22Updated">${brl22(c.updated)}</strong></div>
          <div class="v22-kpi"><small>Juros proporcionais</small><strong id="v22Interest">${brl22(c.interest)}</strong></div>
          <div class="v22-kpi"><small>Dias considerados</small><strong id="v22Days">${c.days}</strong></div>
        </div>
        <div class="v22-grid" style="margin-top:12px">
          <div class="field"><label>Tipo de mensagem</label><select id="v22Type"><option value="due_today">Vencimento hoje</option><option value="upcoming">Próximo vencimento</option><option value="overdue">Cobrança em atraso</option><option value="negotiate">Negociação</option><option value="paid">Confirmação de pagamento</option></select></div>
          <div class="field"><label>Atualizar valor até</label><input type="date" id="v22AsOf" value="${dateKey22(new Date())}"></div>
        </div>
        <div class="field"><label>Mensagem</label><textarea id="v22Message" style="min-height:170px"></textarea></div>
        <div class="v22-preview" id="v22Preview"></div>
        <div class="actions"><button type="button" class="primary-btn" id="v22Send">Enviar pelo WhatsApp</button><button type="button" class="soft-btn" id="v22Copy">Copiar mensagem</button></div>
        ${phone.length<12?'<div class="muted" style="margin-top:8px">⚠️ Cadastre o telefone do cliente com DDD para abrir o WhatsApp diretamente.</div>':''}
      </div>`);
    const typeEl=document.getElementById('v22Type'),dateEl=document.getElementById('v22AsOf'),msgEl=document.getElementById('v22Message'),prev=document.getElementById('v22Preview');
    typeEl.value=initial;
    function refresh(){
      const d=dateEl.value?new Date(dateEl.value+'T12:00:00'):new Date();
      const cc=calculation22(hit,d),m=message22(hit,typeEl.value,d);
      document.getElementById('v22Updated').textContent=brl22(cc.updated);document.getElementById('v22Interest').textContent=brl22(cc.interest);document.getElementById('v22Days').textContent=cc.days;
      msgEl.value=m;prev.textContent=m;
    }
    typeEl.onchange=refresh;dateEl.onchange=refresh;msgEl.oninput=()=>{prev.textContent=msgEl.value};refresh();
    document.getElementById('v22Copy').onclick=async()=>{try{await navigator.clipboard.writeText(msgEl.value);alert('Mensagem copiada.')}catch(_){msgEl.select();document.execCommand('copy');alert('Mensagem copiada.')}};
    document.getElementById('v22Send').onclick=()=>{if(phone.length<12){alert('Cadastre o telefone do cliente com DDD antes de enviar.');return}window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgEl.value)}`,'_blank','noopener')};
  }
  window.openCollectionAssistantV22=openAssistant22;

  function addAssistantButtons22(root=document){
    ensureSettings22();if(!state.settings.collectionAssistant22.enabled)return;
    root.querySelectorAll('.pay-btn').forEach(pay=>{
      const row=pay.closest('.inline-actions');if(!row||row.querySelector('.v22-assistant-btn'))return;
      const b=document.createElement('button');b.type='button';b.className='small-btn v22-assistant-btn';b.textContent='🤖 Assistente WhatsApp';
      b.onclick=()=>openAssistant22(pay.dataset.c,pay.dataset.k,pay.dataset.r);row.appendChild(b);
    });
  }

  function injectSettings22(){
    if(document.getElementById('assistantSettingsV22'))return;
    const s=ensureSettings22();
    const dataTitle=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Dados e backup');
    const anchor=dataTitle?.closest('.section-title')||document.getElementById('view')?.lastElementChild;if(!anchor)return;
    anchor.insertAdjacentHTML('beforebegin',`<div id="assistantSettingsV22" class="v22-settings"><div class="section-title"><h2>Assistente de Cobrança</h2><small>WhatsApp + juros por dia</small></div><div class="card">
      <div class="v22-grid"><div class="field"><label>Status</label><select id="v22Enabled"><option value="1" ${s.enabled?'selected':''}>Ativado</option><option value="0" ${!s.enabled?'selected':''}>Desativado</option></select></div><div class="field"><label>Mensagem padrão</label><select id="v22Default"><option value="auto" ${s.assistantDefault==='auto'?'selected':''}>Automática pela situação</option><option value="due_today" ${s.assistantDefault==='due_today'?'selected':''}>Vencimento hoje</option><option value="upcoming" ${s.assistantDefault==='upcoming'?'selected':''}>Próximo vencimento</option><option value="overdue" ${s.assistantDefault==='overdue'?'selected':''}>Atraso</option></select></div></div>
      <label class="check"><input type="checkbox" id="v22Pix" ${s.includePix?'checked':''}> Incluir PIX automaticamente</label>
      <label class="check"><input type="checkbox" id="v22Breakdown" ${s.includeBreakdown?'checked':''}> Mostrar memória de cálculo dos juros</label>
      <div class="v22-assistant-card"><strong>Regra de juros proporcional</strong><div class="muted" style="margin-top:5px">A taxa mensal é dividida pela quantidade real de dias de cada mês. Em períodos que atravessam meses diferentes, cada trecho usa 28, 29, 30 ou 31 dias conforme o calendário.</div></div>
      <div class="field"><label>Modelo — cobrança em atraso</label><textarea id="v22TplOverdue">${esc22(s.templates.overdue)}</textarea><div class="muted">Campos: {nome}, {referencia}, {vencimento}, {data_atual}, {valor_atualizado}, {valor_original}, {juros}, {dias}, {juros_bloco}, {pix_bloco}</div></div>
      <div class="actions"><button type="button" class="primary-btn" id="v22SaveSettings">Salvar assistente</button></div>
    </div></div>`);
    document.getElementById('v22SaveSettings').onclick=()=>{
      const ss=ensureSettings22();ss.enabled=document.getElementById('v22Enabled').value==='1';ss.assistantDefault=document.getElementById('v22Default').value;ss.includePix=document.getElementById('v22Pix').checked;ss.includeBreakdown=document.getElementById('v22Breakdown').checked;ss.templates.overdue=document.getElementById('v22TplOverdue').value.trim()||DEFAULTS.templates.overdue;saveState();alert('Assistente de Cobrança atualizado.');
    };
  }

  if(typeof renderCharges==='function'){
    const before=renderCharges;renderCharges=function(){const out=before();addAssistantButtons22(document.getElementById('view'));return out};
  }
  if(typeof renderDashboard==='function'){
    const before=renderDashboard;renderDashboard=function(){const out=before();addAssistantButtons22(document.getElementById('view'));return out};
  }
  if(typeof renderSettings==='function'){
    const before=renderSettings;renderSettings=function(){const out=before();injectSettings22();return out};
  }

  // Aplica na tela que estiver aberta sem alterar cadastros existentes.
  try{
    if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();
    else if(currentView==='dashboard'&&typeof renderDashboard==='function')renderDashboard();
    else if(currentView==='settings'&&typeof renderSettings==='function')renderSettings();
  }catch(err){console.warn('CrediGestor v22: módulo carregado com aviso.',err)}
})();
