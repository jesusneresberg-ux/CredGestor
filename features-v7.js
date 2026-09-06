// CrediGestor v7 — comprovante/resumo do empréstimo por WhatsApp.
// Adiciona código EMP, modalidade, parcelas, valor total e término ao resumo.
(function(){
  'use strict';

  const style=document.createElement('style');
  style.textContent=`
    .v7-receipt{background:rgba(22,163,74,.10)!important;color:#15803d!important}
    .v7-summary-box{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(148,163,184,.06)}
    .v7-summary-box .section-title{margin-top:0}
    .v7-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .v7-code{font-weight:900;letter-spacing:.04em;color:var(--accent)}
    .v7-help{font-size:10px;line-height:1.45;color:var(--muted);margin-top:6px}
    @media(max-width:420px){.v7-summary-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function padLoanV7(n){return String(Math.max(1,Number(n)||1)).padStart(4,'0')}
  function loanNumberV7(code=''){
    const m=String(code).match(/EMP[-\s]?(\d+)/i);return m?Number(m[1])||0:0;
  }
  function allLoansV7(){
    return (state.clients||[]).flatMap(c=>(c.contracts||[]).map(k=>({c,k})));
  }
  function nextLoanCodeV7(){
    const max=allLoansV7().reduce((m,x)=>Math.max(m,loanNumberV7(x.k.loanCode)),0);
    return `EMP-${padLoanV7(max+1)}`;
  }
  function ensureLoanCodesV7(){
    let changed=false;
    const rows=allLoansV7().slice().sort((a,b)=>String(a.k.createdAt||a.k.startDate||'').localeCompare(String(b.k.createdAt||b.k.startDate||'')));
    let max=rows.reduce((m,x)=>Math.max(m,loanNumberV7(x.k.loanCode)),0);
    rows.forEach(({k})=>{
      if(!k.loanCode){k.loanCode=`EMP-${padLoanV7(++max)}`;changed=true}
      if(!k.modality){k.modality='Padrão';changed=true}
      if(!Number.isFinite(Number(k.installments))||Number(k.installments)<1){k.installments=1;changed=true}
    });
    return changed;
  }
  if(ensureLoanCodesV7())saveState();

  function parseISODateV7(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0);return Number.isNaN(d.getTime())?null:d;
  }
  function dateISOFromPartsV7(y,m,d){
    const last=new Date(y,m+1,0).getDate();
    return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
  }
  function addMonthsV7(iso,months){
    const d=parseISODateV7(iso);if(!d)return '';
    const raw=d.getMonth()+Math.max(1,Number(months)||1),y=d.getFullYear()+Math.floor(raw/12),m=((raw%12)+12)%12;
    return dateISOFromPartsV7(y,m,d.getDate());
  }
  function formatDateV7(value){
    const d=parseISODateV7(value);return d?d.toLocaleDateString('pt-BR'):'—';
  }
  function rateLabelV7(v){
    const n=Number(v)||0;return n.toLocaleString('pt-BR',{maximumFractionDigits:2});
  }
  function suggestedTotalV7(k,installments){
    const n=Math.max(1,Number(installments)||1),principal=Number(k.initialPrincipal)||0;
    if(k.billingType==='fixed'&&Number(k.fixedAmount)>0)return Number(k.fixedAmount)*n;
    return principal+(principal*(Number(k.interestRate)||0)/100*n);
  }
  function receiptMetaV7(k){
    const installments=Math.max(1,Number(k.installments)||1);
    const total=Number(k.summaryTotal)>0?Number(k.summaryTotal):suggestedTotalV7(k,installments);
    const end=k.endDate||addMonthsV7(k.startDate,installments);
    return {
      code:k.loanCode||nextLoanCodeV7(),
      modality:k.modality||'Padrão',
      installments,total,end,
      installmentValue:installments?total/installments:total
    };
  }
  function normalizePhoneV7(phone=''){
    let d=String(phone).replace(/\D/g,'');
    if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;
    return d;
  }
  function loanReceiptTextV7(cl,k){
    const m=receiptMetaV7(k);
    return `🏦 *Resumo do Empréstimo - ${m.code}*\n\n`+
      `👤 Cliente: ${cl.name||'Cliente'}\n`+
      `💰 Valor Emprestado: ${brl(k.initialPrincipal)}\n`+
      `💵 Valor Total: ${brl(m.total)}\n`+
      `📊 Taxa de Juros: ${rateLabelV7(k.interestRate)}%\n`+
      `📅 Data do Início: ${formatDateV7(k.startDate)}\n`+
      `📅 Data do Término: ${formatDateV7(m.end)}\n`+
      `📦 Modalidade: ${m.modality}\n`+
      `🔢 Parcelas: ${m.installments}x de ${brl(m.installmentValue)}`;
  }
  function openLoanReceiptV7(clientId,loanId){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===loanId);if(!cl||!k)return;
    if(!k.loanCode){k.loanCode=nextLoanCodeV7();saveState()}
    const phone=normalizePhoneV7(cl.phone);
    if(phone.length<12){alert(`Cadastre um telefone com DDD para ${cl.name} antes de enviar o comprovante pelo WhatsApp.`);return}
    const text=loanReceiptTextV7(cl,k);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
  }
  window.openLoanReceiptV7=openLoanReceiptV7;
  window.loanReceiptTextV7=loanReceiptTextV7;

  function addReceiptButtonToContractV7(clientId,card){
    if(!card||card.querySelector('.v7-receipt'))return;
    const edit=card.querySelector('.edit-contract');if(!edit)return;
    const row=edit.closest('.inline-actions');if(!row)return;
    const b=document.createElement('button');b.type='button';b.className='small-btn v7-receipt';b.textContent='📤 Enviar comprovante';
    b.onclick=()=>openLoanReceiptV7(clientId,edit.dataset.id);row.appendChild(b);
  }
  function addReceiptButtonsClientV7(clientId){
    document.querySelectorAll('#modalContent .contract-card').forEach(card=>addReceiptButtonToContractV7(clientId,card));
  }
  function addReceiptButtonsLoansV7(){
    document.querySelectorAll('.loan-card').forEach(card=>{
      if(card.querySelector('.v7-receipt'))return;
      const ref=card.querySelector('.edit-loan2');const row=card.querySelector('.inline-actions');if(!ref||!row)return;
      const b=document.createElement('button');b.type='button';b.className='small-btn v7-receipt';b.textContent='📤 Enviar comprovante';
      b.onclick=()=>openLoanReceiptV7(ref.dataset.client,ref.dataset.loan);row.appendChild(b);
    });
  }

  const openClientDetailBeforeV7=openClientDetail;
  openClientDetail=function(id){openClientDetailBeforeV7(id);addReceiptButtonsClientV7(id)};

  if(typeof renderLoans2==='function'){
    const renderLoansBeforeV7=renderLoans2;
    renderLoans2=function(){renderLoansBeforeV7();addReceiptButtonsLoansV7()};
  }

  function fieldValueV7(id,fallback=''){const el=document.getElementById(id);return el?el.value:fallback}
  function injectLoanSummaryFieldsV7(clientId,contractId){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=contractId?(cl?.contracts||[]).find(x=>x.id===contractId):null;if(!cl)return;
    const rule=document.querySelector('#modalContent .rule-note');const saveBtn=document.getElementById('saveContractBtn');if(!rule||!saveBtn||document.getElementById('loanSummaryFieldsV7'))return;
    const proposed=k?.loanCode||nextLoanCodeV7(),installments=Math.max(1,Number(k?.installments)||1);
    const total=Number(k?.summaryTotal)>0?Number(k.summaryTotal):suggestedTotalV7(k||{initialPrincipal:Number(fieldValueV7('kPrincipal'))||0,billingType:fieldValueV7('kType','interest'),fixedAmount:Number(fieldValueV7('kFixed'))||0,interestRate:Number(fieldValueV7('kRate'))||0},installments);
    const end=k?.endDate||addMonthsV7(k?.startDate||fieldValueV7('kStart',todayISO()),installments);
    rule.insertAdjacentHTML('beforebegin',`<div class="v7-summary-box" id="loanSummaryFieldsV7">
      <div class="section-title compact-title"><h2>Comprovante pelo WhatsApp</h2><small>resumo do empréstimo</small></div>
      <div class="v7-summary-grid">
        <div class="field"><label>Código</label><input id="kCodeV7" class="v7-code" value="${esc(proposed)}" maxlength="24"></div>
        <div class="field"><label>Modalidade</label><input id="kModalityV7" value="${esc(k?.modality||'Padrão')}" maxlength="40"></div>
        <div class="field"><label>Parcelas</label><input id="kInstallmentsV7" type="number" min="1" max="360" value="${installments}"></div>
        <div class="field"><label>Valor total do resumo</label><input id="kTotalV7" type="number" step="0.01" min="0" value="${Number(total||0).toFixed(2)}"></div>
        <div class="field"><label>Data do término</label><input id="kEndV7" type="date" value="${esc(end||'')}"></div>
      </div>
      <div class="actions"><button type="button" class="soft-btn" id="recalcSummaryV7">Recalcular total e término</button>${k?'<button type="button" class="small-btn v7-receipt" id="sendReceiptModalV7">📤 Enviar agora</button>':''}</div>
      <div class="v7-help">O comprovante usa estes dados para montar automaticamente o resumo e abrir o WhatsApp do telefone cadastrado no cliente.</div>
    </div>`);

    const recalc=()=>{
      const n=Math.max(1,Number(fieldValueV7('kInstallmentsV7'))||1),principal=Number(fieldValueV7('kPrincipal'))||Number(k?.initialPrincipal)||0;
      const temp={initialPrincipal:principal,billingType:fieldValueV7('kType',k?.billingType||'interest'),fixedAmount:Number(fieldValueV7('kFixed'))||0,interestRate:Number(fieldValueV7('kRate'))||0};
      document.getElementById('kTotalV7').value=suggestedTotalV7(temp,n).toFixed(2);
      document.getElementById('kEndV7').value=addMonthsV7(fieldValueV7('kStart',todayISO()),n);
    };
    document.getElementById('recalcSummaryV7').onclick=recalc;
    if(k)document.getElementById('sendReceiptModalV7').onclick=()=>{
      const temp={...k,
        loanCode:fieldValueV7('kCodeV7',proposed).trim()||proposed,
        modality:fieldValueV7('kModalityV7','Padrão').trim()||'Padrão',
        installments:Math.max(1,Number(fieldValueV7('kInstallmentsV7'))||1),
        summaryTotal:Math.max(0,Number(fieldValueV7('kTotalV7'))||0),
        endDate:fieldValueV7('kEndV7',''),
        billingType:fieldValueV7('kType',k.billingType||'interest'),
        interestRate:Number(fieldValueV7('kRate'))||0,
        fixedAmount:Number(fieldValueV7('kFixed'))||0,
        startDate:fieldValueV7('kStart',k.startDate||todayISO())
      };
      const phone=normalizePhoneV7(cl.phone);if(phone.length<12){alert(`Cadastre um telefone com DDD para ${cl.name} antes de enviar o comprovante pelo WhatsApp.`);return}
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(loanReceiptTextV7(cl,temp))}`,'_blank','noopener');
    };

    const beforeIds=new Set((cl.contracts||[]).map(x=>x.id)),baseSave=saveBtn.onclick;
    saveBtn.onclick=()=>{
      const meta={
        loanCode:fieldValueV7('kCodeV7',proposed).trim()||proposed,
        modality:fieldValueV7('kModalityV7','Padrão').trim()||'Padrão',
        installments:Math.max(1,Number(fieldValueV7('kInstallmentsV7'))||1),
        summaryTotal:Math.max(0,Number(fieldValueV7('kTotalV7'))||0),
        endDate:fieldValueV7('kEndV7','')
      };
      baseSave();
      const c2=(state.clients||[]).find(x=>x.id===clientId);if(!c2)return;
      let saved=contractId?(c2.contracts||[]).find(x=>x.id===contractId):(c2.contracts||[]).find(x=>!beforeIds.has(x.id));
      if(!saved)saved=(c2.contracts||[])[(c2.contracts||[]).length-1];
      if(saved){Object.assign(saved,meta);if(!saved.endDate)saved.endDate=addMonthsV7(saved.startDate,meta.installments);saveState()}
    };
  }

  const openContractModalBeforeV7=openContractModal;
  openContractModal=function(clientId,contractId){openContractModalBeforeV7(clientId,contractId);injectLoanSummaryFieldsV7(clientId,contractId)};

  // CSV completo também passa a preservar os campos do comprovante.
  try{
    if(typeof CSV_HEADERS3!=='undefined'&&Array.isArray(CSV_HEADERS3)){
      ['codigo_emprestimo','modalidade','parcelas_resumo','valor_total_resumo','data_termino'].forEach(h=>{if(!CSV_HEADERS3.includes(h))CSV_HEADERS3.push(h)});
    }
    if(typeof csvRows3==='function'){
      const csvRowsBeforeV7=csvRows3;
      csvRows3=function(){
        return csvRowsBeforeV7().map(r=>{
          if(String(r.tipo_registro||'').toUpperCase()!=='EMPRESTIMO')return r;
          const hit=allLoansV7().find(x=>x.k.id===r.emprestimo_id);if(!hit)return r;
          const m=receiptMetaV7(hit.k);
          return {...r,codigo_emprestimo:m.code,modalidade:m.modality,parcelas_resumo:m.installments,valor_total_resumo:m.total,data_termino:m.end};
        });
      };
    }
    if(typeof importStructuredCSV3==='function'){
      const importStructuredBeforeV7=importStructuredCSV3;
      importStructuredCSV3=function(rows){
        const result=importStructuredBeforeV7(rows);
        const headers=(rows[0]||[]).map(normHeader3),idx=Object.fromEntries(headers.map((h,i)=>[h,i]));
        const get=(row,key)=>String(row[idx[key]]??'').trim();
        for(const row of rows.slice(1)){
          if(get(row,'tipo_registro').toUpperCase()!=='EMPRESTIMO')continue;
          const loanId=get(row,'emprestimo_id');if(!loanId)continue;
          const hit=allLoansV7().find(x=>x.k.id===loanId);if(!hit)continue;
          const k=hit.k,installments=Math.max(1,Number(get(row,'parcelas_resumo'))||Number(k.installments)||1);
          k.loanCode=get(row,'codigo_emprestimo')||k.loanCode||nextLoanCodeV7();
          k.modality=get(row,'modalidade')||k.modality||'Padrão';
          k.installments=installments;
          const total=Number(String(get(row,'valor_total_resumo')).replace(',','.'));if(total>0)k.summaryTotal=total;
          k.endDate=get(row,'data_termino')||k.endDate||addMonthsV7(k.startDate,installments);
        }
        ensureLoanCodesV7();saveState();render();return result;
      };
    }
  }catch(err){console.warn('CrediGestor v7: extensão CSV não aplicada.',err)}

  if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
})();
