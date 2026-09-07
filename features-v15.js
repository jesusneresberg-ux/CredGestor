// CrediGestor v15 — mantém os recursos da v14 e acrescenta o valor dos juros em reais
// aos resumos e comprovantes, entre o valor emprestado e o valor total.
(function(){
  'use strict';

  let chargeSearchV14='';
  const LETTER_COLORS_V14=[
    '#2563eb','#7c3aed','#db2777','#dc2626','#ea580c','#ca8a04','#65a30d',
    '#16a34a','#059669','#0d9488','#0891b2','#0284c7','#4f46e5','#9333ea',
    '#c026d3','#be123c','#b45309','#4d7c0f','#15803d','#047857','#0f766e',
    '#0369a1','#1d4ed8','#4338ca','#6d28d9','#a21caf'
  ];

  const style=document.createElement('style');
  style.textContent=`
    .v14-search-wrap{position:relative;margin-bottom:12px}
    .v14-search-wrap .search{padding-left:42px;margin:0;width:100%}
    .v14-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:17px;pointer-events:none;opacity:.72}
    .v14-today{border:1px solid color-mix(in srgb,var(--accent) 28%,var(--line));background:color-mix(in srgb,var(--accent) 6%,white);border-radius:20px;padding:12px;margin-bottom:14px}
    .v14-today .section-title{margin-top:0}
    .v14-late-details{border:1px solid color-mix(in srgb,#dc2626 22%,var(--line));background:color-mix(in srgb,#dc2626 4%,white);border-radius:20px;margin-top:14px;overflow:hidden}
    .v14-late-details>summary{list-style:none;cursor:pointer;padding:14px 15px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:900}
    .v14-late-details>summary::-webkit-details-marker{display:none}
    .v14-late-details[open]>summary{border-bottom:1px solid var(--line)}
    .v14-late-body{padding:12px}
    .v14-late-count{font-size:10px;color:var(--danger);font-weight:850;background:rgba(220,38,38,.08);padding:5px 8px;border-radius:999px;white-space:nowrap}
    .v14-letter-divider{display:flex;align-items:center;gap:9px;margin:15px 0 7px;font-weight:950;font-size:13px;letter-spacing:.04em}
    .v14-letter-divider span{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:white;background:var(--v14-letter-color);box-shadow:0 5px 14px color-mix(in srgb,var(--v14-letter-color) 28%,transparent)}
    .v14-letter-divider i{height:2px;flex:1;border-radius:999px;background:linear-gradient(90deg,var(--v14-letter-color),transparent);opacity:.6}
    .v14-summary-btn{background:rgba(22,163,74,.10)!important;color:#15803d!important}
    .v14-client-pay{background:rgba(37,99,235,.10)!important;color:#1d4ed8!important}
    .v14-payment-note{margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(37,99,235,.07);color:var(--muted);font-size:11px;line-height:1.45}
    .v14-charge-card[hidden]{display:none!important}
    @media(max-width:420px){.v14-late-details>summary{align-items:flex-start;flex-direction:column}.v14-late-count{white-space:normal}}
  `;
  document.head.appendChild(style);

  function normalizeTextV14(v=''){
    return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }
  function normalizePhoneV14(phone=''){
    let d=String(phone).replace(/\D/g,'');
    if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;
    return d;
  }
  function formatDateV14(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return `${m[3]}/${m[2]}/${m[1]}`;
    const d=value instanceof Date?value:new Date(value);
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR');
  }
  function parseISODateV14(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0);
    return Number.isNaN(d.getTime())?null:d;
  }
  function addMonthsV14(iso,months){
    const d=parseISODateV14(iso);if(!d)return '';
    const raw=d.getMonth()+Math.max(1,Number(months)||1);
    const y=d.getFullYear()+Math.floor(raw/12),m=((raw%12)+12)%12,last=new Date(y,m+1,0).getDate();
    return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(d.getDate(),last)).padStart(2,'0')}`;
  }
  function loanMetaV14(k){
    const principal=Number(k.initialPrincipal)||0;
    const installments=Math.max(1,Number(k.installments)||1);
    let total=Number(k.summaryTotal)||0;
    if(total<=0){
      if(k.billingType==='fixed'&&Number(k.fixedAmount)>0)total=Number(k.fixedAmount)*installments;
      else total=principal+(principal*(Number(k.interestRate)||0)/100*installments);
    }
    return {
      code:k.loanCode||'EMPRÉSTIMO',
      principal,total,installments,
      installmentValue:installments?total/installments:total,
      end:k.endDate||addMonthsV14(k.startDate,installments),
      modality:k.modality||'Padrão'
    };
  }
  function rateLabelV14(v){return (Number(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}

  function loanReceiptTextV14(cl,k){
    const m=loanMetaV14(k);
    return `🏦 *Resumo do Empréstimo - ${m.code}*\n`+
      `👤 Cliente: ${cl.name||'Cliente'}\n`+
      `💰 Valor Emprestado: ${brl(m.principal)}\n`+
      `💸 Juros: ${brl(Math.max(0,m.total-m.principal))}\n`+
      `💵 Valor Total: ${brl(m.total)}\n`+
      `📊 Taxa de Juros: ${rateLabelV14(k.interestRate)}%\n`+
      `📅 Data do Início: ${formatDateV14(k.startDate)}\n`+
      `📅 Data do Término: ${formatDateV14(m.end)}\n`+
      `📦 Modalidade: ${m.modality}\n`+
      `🔢 Parcelas: ${m.installments}x de ${brl(m.installmentValue)}`;
  }
  function paymentReceiptTextV14(cl,k,payment){
    const m=loanMetaV14(k);
    return `🏦 *Comprovante de Pagamento - ${m.code}*\n`+
      `👤 Cliente: ${cl.name||'Cliente'}\n`+
      `💰 Valor Emprestado: ${brl(m.principal)}\n`+
      `💸 Juros: ${brl(Math.max(0,m.total-m.principal))}\n`+
      `💵 Valor Total: ${brl(m.total)}\n`+
      `📊 Taxa de Juros: ${rateLabelV14(k.interestRate)}%\n`+
      `📅 Data do Início: ${formatDateV14(k.startDate)}\n`+
      `📅 Data do Término: ${formatDateV14(m.end)}\n`+
      `📦 Modalidade: ${m.modality}\n`+
      `🔢 Parcelas: ${m.installments}x de ${brl(m.installmentValue)}\n`+
      `✅ Valor Pago: ${brl(payment.amount)}\n`+
      `📅 Data do Pagamento: ${formatDateV14(payment.paidAt)}\n`+
      `💳 Forma de Pagamento: ${payment.method||'Não informada'}\n`+
      `✅ Status: Pago`+
      (payment.note?`\n📝 Observação: ${payment.note}`:'');
  }
  function openWhatsAppV14(cl,text,successMessage='Comprovante pronto para envio.'){
    const phone=normalizePhoneV14(cl?.phone||'');
    if(phone.length<12){alert(`${successMessage} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar pelo WhatsApp.`);return false}
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
    return true;
  }
  function openLoanReceiptV14(clientId,loanId,kOverride=null){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=kOverride||(cl?.contracts||[]).find(x=>x.id===loanId);if(!cl||!k)return false;
    return openWhatsAppV14(cl,loanReceiptTextV14(cl,k),'Resumo gerado.');
  }
  window.loanReceiptTextV14=loanReceiptTextV14;
  window.paymentReceiptTextV14=paymentReceiptTextV14;
  window.openLoanReceiptV14=openLoanReceiptV14;

  function nextRefV14(ref){
    const [y,m]=String(ref||'').split('-').map(Number),d=new Date(y||new Date().getFullYear(),Math.max(0,(m||1)-1)+1,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function nextUnpaidRefV14(k){
    let ref=monthRef();
    for(let i=0;i<60;i++){
      if(!(k.payments||[]).some(p=>p.reference===ref))return ref;
      ref=nextRefV14(ref);
    }
    return monthRef();
  }

  openPaymentModal=function(clientId,contractId,ref){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const [y,m]=String(ref||monthRef()).split('-').map(Number),x=chargeFor(cl,k,y,m-1);
    const existing=getPayment(k,ref);
    openModal(`
      <h2>Pagar</h2>
      <div class="card"><div class="muted">${esc(cl.name)} • referência ${esc(ref)}</div><strong style="font-size:26px">${brl(x.amount)}</strong><div class="muted">Vencimento ${x.due.toLocaleDateString('pt-BR')}</div></div>
      <div class="field"><label>Mês de referência</label><input id="pRef" value="${esc(ref)}" pattern="\\d{4}-\\d{2}"></div>
      <div class="field"><label>Valor pago</label><input id="pAmount" type="number" step="0.01" value="${Number(existing?.amount||x.amount).toFixed(2)}"></div>
      <div class="field"><label>Data do pagamento</label><input id="pDate" type="date" value="${esc(existing?.paidAt||todayISO())}"></div>
      <div class="field"><label>Forma de pagamento</label><select id="pMethod"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></div>
      <div class="field"><label>Observação</label><textarea id="pNote">${esc(existing?.note||'')}</textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="savePaymentBtn">Confirmar pagamento e enviar comprovante</button></div>
      <div class="v14-payment-note">Ao confirmar, a cobrança passa imediatamente para <b>Pago</b>. Em seguida, o WhatsApp abre com o comprovante preenchido e os emojis padronizados.</div>
    `,()=>{
      const method=document.getElementById('pMethod');if(method&&existing?.method)method.value=existing.method;
      document.getElementById('savePaymentBtn').onclick=()=>{
        const pRef=(document.getElementById('pRef')?.value||ref).trim();
        const amount=Number(document.getElementById('pAmount')?.value)||0;
        if(amount<=0){alert('Informe um valor de pagamento maior que zero.');return}
        const old=getPayment(k,pRef);
        const payment={
          id:old?.id||uid('py'),reference:pRef,amount,
          paidAt:document.getElementById('pDate')?.value||todayISO(),
          method:document.getElementById('pMethod')?.value||'PIX',
          note:(document.getElementById('pNote')?.value||'').trim(),
          status:'paid'
        };
        if(old)Object.assign(old,payment);else{k.payments=k.payments||[];k.payments.push(payment)}
        saveState();closeModal();render();
        openWhatsAppV14(cl,paymentReceiptTextV14(cl,k,payment),'Pagamento registrado como pago.');
      };
    });
  };

  chargeItemHtml=function(x){
    const search=[x.cl.name,x.cl.phone,x.c.loanCode,x.c.title,x.ref,brl(x.amount)].join(' ');
    return `<div class="list-item v14-charge-card" data-v14-search="${esc(normalizeTextV14(search))}">
      <div class="row space">
        <div class="row">
          <div class="avatar">${esc(x.cl.name.slice(0,2).toUpperCase())}</div>
          <div><div class="title">${esc(x.cl.name)}</div><div class="muted">${x.due.toLocaleDateString('pt-BR')} • ${esc(x.c.loanCode||x.c.title||'Contrato')} • ref. ${esc(x.ref)}</div></div>
        </div>
        <span class="status ${x.status}">${x.status==='paid'?'PAGO':x.status==='late'?'ATRASADO':'ABERTO'}</span>
      </div>
      <div class="row space" style="margin-top:11px">
        <strong class="money">${brl(x.amount)}</strong>
        <div class="inline-actions" style="margin:0">
          ${x.status!=='paid'?`<button class="small-btn pay-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Pagar</button>`:''}
          <button class="small-btn v14-summary-btn" data-c="${x.cl.id}" data-k="${x.c.id}">📤 Resumo</button>
          ${state.settings.googleCalendar?`<button class="small-btn cal-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Agenda</button>`:''}
        </div>
      </div>
    </div>`;
  };
  const bindChargeBeforeV14=bindChargeButtons;
  bindChargeButtons=function(){
    bindChargeBeforeV14();
    document.querySelectorAll('.v14-summary-btn').forEach(b=>b.onclick=()=>openLoanReceiptV14(b.dataset.c,b.dataset.k));
  };

  function historicalLateV14(){
    const today=new Date();today.setHours(0,0,0,0);const out=[];
    activeContracts().forEach(({cl,c})=>{
      const start=parseISODateV14(c.startDate)||new Date(today.getFullYear(),today.getMonth(),1);
      let y=start.getFullYear(),m=start.getMonth(),guard=0;
      while((y<today.getFullYear()||(y===today.getFullYear()&&m<=today.getMonth()))&&guard<120){
        const x=chargeFor(cl,c,y,m);if(x.status==='late')out.push(x);
        m++;if(m>11){m=0;y++}guard++;
      }
    });
    return out.sort((a,b)=>a.due-b.due||a.cl.name.localeCompare(b.cl.name,'pt-BR'));
  }
  function upcomingV14(){
    const today=new Date();today.setHours(0,0,0,0);const out=[];
    for(let off=0;off<=2;off++){
      const d=new Date(today.getFullYear(),today.getMonth()+off,1);
      activeContracts().forEach(({cl,c})=>{
        const x=chargeFor(cl,c,d.getFullYear(),d.getMonth());
        const due=new Date(x.due);due.setHours(0,0,0,0);
        if(x.status!=='paid'&&due>today)out.push(x);
      });
    }
    return out.sort((a,b)=>a.due-b.due||a.cl.name.localeCompare(b.cl.name,'pt-BR'));
  }
  function todayChargesV14(){
    const now=new Date(),key=ymd(now);
    return activeContracts().map(({cl,c})=>chargeFor(cl,c,now.getFullYear(),now.getMonth()))
      .filter(x=>ymd(x.due)===key)
      .sort((a,b)=>a.cl.name.localeCompare(b.cl.name,'pt-BR'));
  }
  function visibleTotalV14(rows){return rows.reduce((t,x)=>t+(Number(x.amount)||0),0)}
  function cardsHtmlV14(rows,empty){return rows.length?rows.map(chargeItemHtml).join(''):`<div class="empty card">${esc(empty)}</div>`}
  function applyChargeSearchV14(){
    const q=normalizeTextV14(chargeSearchV14);
    document.querySelectorAll('.v14-charge-card').forEach(card=>{card.hidden=!!q&&!String(card.dataset.v14Search||'').includes(q)});
    const late=document.getElementById('lateDetailsV14');if(late&&q)late.open=true;
    document.querySelectorAll('[data-v14-count]').forEach(el=>{
      const host=document.getElementById(el.dataset.v14Count);if(!host)return;
      const visible=[...host.querySelectorAll('.v14-charge-card')].filter(c=>!c.hidden).length;
      el.textContent=`${visible} cobrança(s)`;
    });
  }

  renderCharges=function(){
    const today=todayChargesV14(),upcoming=upcomingV14(),late=historicalLateV14();
    const todayLabel=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
    document.getElementById('view').innerHTML=`
      <div class="v14-search-wrap"><span class="v14-search-icon">🔎</span><input id="chargeSearchV14" class="search" placeholder="Pesquisar cliente, contrato, código ou valor..." value="${esc(chargeSearchV14)}"></div>
      <section class="v14-today">
        <div class="section-title"><div><h2>📅 Cobranças de hoje</h2><small>${esc(todayLabel)}</small></div><small data-v14-count="todayListV14">${today.length} cobrança(s)</small></div>
        <div class="list" id="todayListV14">${cardsHtmlV14(today,'Nenhuma cobrança vence hoje.')}</div>
      </section>
      <div class="section-title"><h2>Próximas cobranças</h2><small data-v14-count="upcomingListV14">${upcoming.length} cobrança(s)</small></div>
      <div class="list" id="upcomingListV14">${cardsHtmlV14(upcoming,'Nenhuma cobrança futura nos próximos meses.')}</div>
      <details class="v14-late-details" id="lateDetailsV14">
        <summary><span>⚠️ Atrasados</span><span class="v14-late-count">${late.length} cobrança(s) • ${brl(visibleTotalV14(late))}</span></summary>
        <div class="v14-late-body"><div class="list" id="lateListV14">${cardsHtmlV14(late,'Nenhuma cobrança atrasada.')}</div></div>
      </details>
    `;
    const input=document.getElementById('chargeSearchV14');
    input.oninput=e=>{chargeSearchV14=e.target.value;applyChargeSearchV14()};
    bindChargeButtons();applyChargeSearchV14();
  };

  function firstLetterV14(name=''){
    const c=String(name).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();
    return /^[A-Z]$/.test(c)?c:'#';
  }
  function letterColorV14(letter){const i=letter==='#'?0:Math.max(0,letter.charCodeAt(0)-65);return LETTER_COLORS_V14[i%LETTER_COLORS_V14.length]}
  function groupCardsV14(cards,nameFn){
    if(!cards.length)return;
    const parent=cards[0].parentElement;if(!parent)return;
    parent.querySelectorAll(':scope > .v14-letter-divider').forEach(x=>x.remove());
    const sorted=cards.slice().sort((a,b)=>nameFn(a).localeCompare(nameFn(b),'pt-BR',{sensitivity:'base'}));
    sorted.forEach(card=>parent.appendChild(card));
    let last='';
    sorted.forEach(card=>{
      const letter=firstLetterV14(nameFn(card)),color=letterColorV14(letter);
      card.style.setProperty('--v14-letter-color',color);
      const avatar=card.querySelector('.avatar');if(avatar){avatar.style.background=color;avatar.style.color='#fff'}
      if(letter!==last){
        const d=document.createElement('div');d.className='v14-letter-divider';d.style.setProperty('--v14-letter-color',color);d.innerHTML=`<span>${esc(letter)}</span><i></i>`;
        parent.insertBefore(d,card);last=letter;
      }
    });
  }
  function sortClientsV14(){
    const cards=[...document.querySelectorAll('#view .client-open')];
    groupCardsV14(cards,card=>(state.clients||[]).find(x=>x.id===card.dataset.id)?.name||'');
  }
  function sortLoansV14(){
    const cards=[...document.querySelectorAll('#view .loan-card')];
    groupCardsV14(cards,card=>{
      const ref=card.querySelector('.edit-loan2');return (state.clients||[]).find(x=>x.id===ref?.dataset.client)?.name||'';
    });
  }

  function bindLoanReceiptButtonsV14(){
    document.querySelectorAll('#view .loan-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2'),btn=card.querySelector('.v7-receipt');if(!ref||!btn)return;
      btn.onclick=()=>openLoanReceiptV14(ref.dataset.client,ref.dataset.loan);
    });
  }
  function bindClientContractButtonsV14(clientId){
    const cl=(state.clients||[]).find(x=>x.id===clientId);if(!cl)return;
    document.querySelectorAll('#modalContent .contract-card').forEach(card=>{
      const edit=card.querySelector('.edit-contract');if(!edit)return;
      const loanId=edit.dataset.id,k=(cl.contracts||[]).find(x=>x.id===loanId);if(!k)return;
      const receipt=card.querySelector('.v7-receipt');if(receipt)receipt.onclick=()=>openLoanReceiptV14(clientId,loanId);
      let row=edit.closest('.inline-actions');
      if(row&&k.active!==false&&!row.querySelector('.v14-client-pay')){
        const b=document.createElement('button');b.type='button';b.className='small-btn v14-client-pay';b.textContent='💳 Pagar';b.onclick=()=>openPaymentModal(clientId,loanId,nextUnpaidRefV14(k));row.insertBefore(b,row.firstChild);
      }
    });
  }

  if(typeof renderClients==='function'){
    const beforeClientsV14=renderClients;
    renderClients=function(){const out=beforeClientsV14();sortClientsV14();return out};
  }
  if(typeof renderLoans2==='function'){
    const beforeLoansV14=renderLoans2;
    renderLoans2=function(){const out=beforeLoansV14();sortLoansV14();bindLoanReceiptButtonsV14();return out};
  }
  if(typeof openClientDetail==='function'){
    const beforeClientDetailV14=openClientDetail;
    openClientDetail=function(id){const out=beforeClientDetailV14(id);bindClientContractButtonsV14(id);return out};
  }
  if(typeof openContractModal==='function'){
    const beforeContractV14=openContractModal;
    openContractModal=function(clientId,contractId){
      const out=beforeContractV14(clientId,contractId);
      const btn=document.getElementById('sendReceiptModalV7');
      if(btn&&contractId){
        btn.onclick=()=>{
          const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
          const temp={...k,
            loanCode:(document.getElementById('kCodeV7')?.value||k.loanCode||'EMPRÉSTIMO').trim(),
            modality:(document.getElementById('kModalityV7')?.value||k.modality||'Padrão').trim(),
            installments:Math.max(1,Number(document.getElementById('kInstallmentsV7')?.value)||Number(k.installments)||1),
            summaryTotal:Math.max(0,Number(document.getElementById('kTotalV7')?.value)||Number(k.summaryTotal)||0),
            endDate:document.getElementById('kEndV7')?.value||k.endDate||'',
            interestRate:Number(document.getElementById('kRate')?.value)||Number(k.interestRate)||0,
            fixedAmount:Number(document.getElementById('kFixed')?.value)||Number(k.fixedAmount)||0,
            billingType:document.getElementById('kType')?.value||k.billingType,
            startDate:document.getElementById('kStart')?.value||k.startDate
          };
          openLoanReceiptV14(clientId,contractId,temp);
        };
      }
      return out;
    };
  }

  if(currentView==='clients')renderClients();
  else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
  else if(currentView==='charges')renderCharges();
})();
