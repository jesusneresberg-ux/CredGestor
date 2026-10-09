// CrediGestor v25 — sincronização imediata de acréscimos, saldo, juros e comprovantes.
(function(){
  'use strict';
  const VERSION='25.0';

  function numV25(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function moneyV25(v){try{return brl(v)}catch(_){return numV25(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}}
  function fmtDateV25(v){
    if(!v)return '—';
    if(v instanceof Date)return v.toLocaleDateString('pt-BR');
    const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return `${m[3]}/${m[2]}/${m[1]}`;
    const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('pt-BR');
  }
  function rateV25(k){return Math.max(0,numV25(k?.interestRate))}
  function balanceV25(k){
    try{return Math.max(0,numV25(contractBalance(k)))}catch(_){
      return Math.max(0,numV25(k?.currentPrincipal)||numV25(k?.initialPrincipal));
    }
  }
  function movementTotalsV25(k){
    return (k?.movements||[]).reduce((a,m)=>{
      const value=Math.max(0,numV25(m?.amount));
      if(m?.type==='increase')a.increases+=value;
      else a.reductions+=value;
      return a;
    },{increases:0,reductions:0});
  }
  function currentInterestV25(k){
    const principal=balanceV25(k),rate=rateV25(k);
    return Math.max(0,principal*rate/100);
  }
  function currentChargeV25(k){
    try{return Math.max(0,numV25(monthlyDue(k)))}catch(_){
      if(k?.billingType==='fixed')return Math.max(0,numV25(k?.fixedAmount));
      return currentInterestV25(k);
    }
  }
  function syncContractV25(k){
    if(!k)return;
    const principal=balanceV25(k);
    k.currentPrincipal=principal;
    k.currentInterest=currentInterestV25(k);
    k.currentCharge=currentChargeV25(k);
    k.currentTotal=principal+k.currentInterest;
    k.balanceCalculatedAt=new Date().toISOString();
  }
  function syncAllV25(){
    (state?.clients||[]).forEach(cl=>(cl?.contracts||[]).forEach(syncContractV25));
  }

  // Toda gravação passa a persistir também os valores derivados mais recentes.
  if(typeof saveState==='function'){
    const baseSaveV25=saveState;
    saveState=function(){
      syncAllV25();
      return baseSaveV25();
    };
  }

  function metaV25(k){
    const mv=movementTotalsV25(k);
    const original=Math.max(0,numV25(k?.initialPrincipal));
    const principal=balanceV25(k);
    const interest=currentInterestV25(k);
    const charge=currentChargeV25(k);
    return {
      code:k?.loanCode||k?.title||'EMPRÉSTIMO',
      original,
      increases:mv.increases,
      reductions:mv.reductions,
      principal,
      rate:rateV25(k),
      interest,
      charge,
      total:principal+interest,
      modality:k?.modality||'Padrão'
    };
  }

  function contractBlockV25(cl,k,title='Resumo do Empréstimo'){
    const m=metaV25(k);
    return `🏦 *${title} - ${m.code}*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Valor original: ${moneyV25(m.original)}\n`+
      (m.increases>0?`➕ Acréscimos/Novo valor liberado: ${moneyV25(m.increases)}\n`:'')+
      (m.reductions>0?`📉 Amortizações/Reduções: ${moneyV25(m.reductions)}\n`:'')+
      `💳 Saldo principal atualizado: *${moneyV25(m.principal)}*\n`+
      `📊 Taxa de juros: ${m.rate.toLocaleString('pt-BR',{maximumFractionDigits:2})}%\n`+
      `💵 Juros atuais: ${moneyV25(m.interest)}\n`+
      `🧾 Capital + juros atuais: *${moneyV25(m.total)}*\n`+
      `📅 Data de início: ${fmtDateV25(k?.startDate)}\n`+
      `📦 Modalidade: ${m.modality}`;
  }

  function paymentReceiptV25(cl,k,p){
    return contractBlockV25(cl,k,'Comprovante de Pagamento')+`\n\n`+
      `✅ Valor pago: ${moneyV25(p?.amount||0)}\n`+
      `📅 Data do pagamento: ${fmtDateV25(p?.paidAt)}\n`+
      `💳 Forma de pagamento: ${p?.method||'Não informada'}\n`+
      `🗓️ Referência: ${p?.reference||'—'}\n`+
      (p?.referenceDate&&p?.paidAt>p.referenceDate?`📌 Referência da cobrança em atraso (vencimento original): ${fmtDateV25(p.referenceDate)}\n`:'')+
      `✅ Status: Pago`+(p?.note?`\n📝 Observação: ${p.note}`:'');
  }

  function amortizationReceiptV25(cl,k,m){
    syncContractV25(k);
    return contractBlockV25(cl,k,'Comprovante de Amortização')+`\n\n`+
      `📉 Saldo anterior: ${moneyV25(m?.balanceBefore||0)}\n`+
      `💰 Valor amortizado: ${moneyV25(m?.amount||0)}\n`+
      `💳 Novo saldo: *${moneyV25(m?.balanceAfter ?? balanceV25(k))}*\n`+
      `📅 Data da amortização: ${fmtDateV25(m?.date)}\n`+
      `✅ Status: Amortização registrada`+(m?.note?`\n📝 Observação: ${m.note}`:'');
  }

  function payoffReceiptV25(cl,k,p){
    return `🏦 *Comprovante de Quitação - ${k?.loanCode||k?.title||'EMPRÉSTIMO'}*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Capital pago: ${moneyV25(p?.principalAmount||0)}\n`+
      `📊 Juros pagos: ${moneyV25(p?.interestAmount||0)}\n`+
      `💵 Total pago: *${moneyV25(p?.amount||0)}*\n`+
      `📅 Data da quitação: ${fmtDateV25(p?.paidAt)}\n`+
      `💳 Saldo final: ${moneyV25(0)}\n`+
      `✅ Status: *QUITADO*`+(p?.note?`\n📝 Observação: ${p.note}`:'');
  }

  function normalizePhoneV25(phone=''){
    let d=String(phone||'').replace(/\D/g,'');
    if(d.startsWith('00'))d=d.slice(2);
    if(d.length===10||d.length===11)d='55'+d;
    return d;
  }
  function sendReceiptV25(cl,text,success='Comprovante atualizado gerado.'){
    const phone=normalizePhoneV25(cl?.phone||'');
    if(phone.length<12){
      alert(`${success} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar pelo WhatsApp.`);
      return false;
    }
    if(!/^55\d{10,11}$/.test(phone)){
      alert('Confira o telefone do cliente: informe DDD e número, com ou sem o código 55.');
      return false;
    }
    const url=`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    openModal(`<h2>Comprovante pronto</h2><p>${esc(success)}</p><div class="field"><label for="receiptTextV25">Confira o texto antes de enviar</label><textarea id="receiptTextV25" readonly rows="10">${esc(text)}</textarea></div><div class="actions"><a class="primary-btn" href="${esc(url)}" target="_self">Abrir WhatsApp</a><button type="button" class="soft-btn" id="copyReceiptV25">Copiar comprovante</button></div><p class="muted" id="receiptStatusV25" role="status">O WhatsApp abrirá com o texto preenchido. Confirme o envio por lá.</p>`,()=>{
      document.getElementById('copyReceiptV25').onclick=async()=>{
        const field=document.getElementById('receiptTextV25');
        const status=document.getElementById('receiptStatusV25');
        try{
          if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
          await navigator.clipboard.writeText(text);
          status.textContent='Comprovante copiado. Cole na conversa do cliente.';
        }catch(_){
          field.focus();field.select();field.setSelectionRange(0,field.value.length);
          status.textContent='Texto selecionado. Toque e segure para copiar e cole no WhatsApp.';
        }
      };
    });
    return true;
  }
  window.prepareReceiptV25=sendReceiptV25;
  function openContractReceiptV25(clientId,loanId,kOverride=null){
    const cl=(state.clients||[]).find(x=>x.id===clientId);
    const k=kOverride||(cl?.contracts||[]).find(x=>x.id===loanId);
    if(!cl||!k)return false;
    const payoff=(k.payments||[]).filter(p=>p.payoff||p.type==='payoff').sort((a,b)=>String(b.paidAt||'').localeCompare(String(a.paidAt||'')))[0];
    if(isPaidContract(k)&&payoff)return sendReceiptV25(cl,payoffReceiptV25(cl,k,payoff),'Comprovante da quitação já registrada.');
    if(isPaidContract(k)){alert('Este contrato está quitado, mas não há registro de pagamento para emitir o comprovante.');return false;}
    return window.openPaymentsHubV21(clientId,loanId);
  }

  // Substitui o padrão anterior de comprovante para todas as rotas que usam v24/v21.
  window.contractReceiptBlockV25=contractBlockV25;
  window.paymentReceiptV25=paymentReceiptV25;
  window.amortizationReceiptV25=amortizationReceiptV25;
  window.payoffReceiptV25=payoffReceiptV25;
  window.openContractReceiptV25=openContractReceiptV25;

  window.contractReceiptBlockV24=contractBlockV25;
  window.paymentReceiptV24=paymentReceiptV25;
  window.amortizationReceiptV24=amortizationReceiptV25;
  window.payoffReceiptV24=payoffReceiptV25;
  window.openContractReceiptV24=openContractReceiptV25;
  window.openLoanReceiptV7=openContractReceiptV25;
  window.openLoanReceiptV14=openContractReceiptV25;

  const paidStyle=document.createElement('style');
  paidStyle.textContent=`
    .paid-contract-card{background:color-mix(in srgb,var(--surface,#fff) 85%,#cbd5e1);border:1px solid #cbd5e1}
    .paid-contract-card > :not(.paid-contract-seal){opacity:.72}
    .paid-contract-card .avatar{filter:grayscale(1)}
    .paid-contract-seal{display:flex;justify-content:center;margin-bottom:14px}
    .paid-contract-seal span{display:inline-flex;align-items:center;gap:6px;border:2px solid #166534;color:#166534;background:#f0fdf4;border-radius:6px;padding:5px 11px;font-size:clamp(26px,6vw,38px);font-weight:950;letter-spacing:.08em}
  `;
  document.head.appendChild(paidStyle);
  function markPaidContractsV25(root,clientId){
    if(!root)return;
    root.querySelectorAll('.loan-card,.contract-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2,.edit-contract');if(!ref)return;
      const client=(state.clients||[]).find(c=>c.id===(clientId||ref.dataset.client));
      const contract=(client?.contracts||[]).find(k=>k.id===(ref.dataset.loan||ref.dataset.id));
      const paid=isPaidContract(contract);
      card.classList.toggle('paid-contract-card',paid);card.querySelector('.paid-contract-seal')?.remove();card.querySelector('.paid-contract-history')?.remove();
      if(paid){const seal=document.createElement('div');seal.className='paid-contract-seal';seal.innerHTML='<span>✓ QUITADO</span>';card.prepend(seal);const history=document.createElement('div');history.className='paid-contract-history muted';history.textContent=`Valor original: ${brl(contract.initialPrincipal)} · Histórico de contrato quitado`;card.insertBefore(history,seal.nextSibling);const status=card.querySelector('.status');if(status)status.textContent='QUITADO'}
    });
  }

  function rebindReceiptsV25(root=document){
    root.querySelectorAll('.loan-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2');
      const btn=card.querySelector('.v7-receipt');
      if(ref&&btn)btn.onclick=()=>openContractReceiptV25(ref.dataset.client,ref.dataset.loan);
    });
    root.querySelectorAll('.v14-summary-btn').forEach(btn=>{
      btn.onclick=()=>openContractReceiptV25(btn.dataset.c,btn.dataset.k);
    });
    root.querySelectorAll('#modalContent .contract-card').forEach(card=>{
      const edit=card.querySelector('.edit-contract');
      const btn=card.querySelector('.v7-receipt');
      if(edit&&btn){
        const clientId=edit.dataset.client||edit.closest('[data-client]')?.dataset.client;
        if(clientId)btn.onclick=()=>openContractReceiptV25(clientId,edit.dataset.id);
      }
    });
  }

  if(typeof renderLoans2==='function'){
    const base=renderLoans2;
    renderLoans2=function(){
      const out=base();
      rebindReceiptsV25(document.getElementById('view'));
      markPaidContractsV25(document.getElementById('view'));
      return out;
    };
  }
  if(typeof renderCharges==='function'){
    const base=renderCharges;
    renderCharges=function(){
      const out=base();
      rebindReceiptsV25(document.getElementById('view'));
      markPaidContractsV25(document.getElementById('view'));
      return out;
    };
  }
  if(typeof openClientDetail==='function'){
    const base=openClientDetail;
    openClientDetail=function(id){
      const out=base(id);
      markPaidContractsV25(document.getElementById('modalContent'),id);
      document.querySelectorAll('#modalContent .contract-card').forEach(card=>{
        const edit=card.querySelector('.edit-contract');
        const btn=card.querySelector('.v7-receipt');
        if(edit&&btn)btn.onclick=()=>openContractReceiptV25(id,edit.dataset.id);
      });
      return out;
    };
  }
  if(typeof openContractModal==='function'){
    const base=openContractModal;
    openContractModal=function(clientId,contractId){
      const out=base(clientId,contractId);
      const btn=document.getElementById('sendReceiptModalV7');
      if(btn&&contractId){
        btn.onclick=()=>{
          const cl=(state.clients||[]).find(x=>x.id===clientId);
          const k=(cl?.contracts||[]).find(x=>x.id===contractId);
          if(!cl||!k)return;
          // Usa o saldo real já persistido; os campos visíveis do modal só complementam metadados.
          const temp={
            ...k,
            loanCode:(document.getElementById('kCodeV7')?.value||k.loanCode||k.title||'EMPRÉSTIMO').trim(),
            modality:(document.getElementById('kModalityV7')?.value||k.modality||'Padrão').trim(),
            interestRate:numV25(document.getElementById('kRate')?.value||k.interestRate),
            startDate:document.getElementById('kStart')?.value||k.startDate
          };
          openContractReceiptV25(clientId,contractId,temp);
        };
      }
      return out;
    };
  }

  // Sincronização inicial dos contratos já existentes.
  syncAllV25();
  if(!window.CREDIGESTOR_MULTITENANT){try{saveState()}catch(_){ }}

  // Atualiza a tela atual para refletir o novo saldo sem exigir reabrir o aplicativo.
  try{
    if(typeof currentView!=='undefined'){
      if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
      else if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();
      else if(typeof render==='function')render();
    }
  }catch(_){ }

  window.__credigestorV25={
    version:VERSION,
    immediateIncreaseSync:true,
    updatedBalanceReceipts:true,
    updatedInterestReceipts:true,
    noContractEndDate:true
  };
})();
