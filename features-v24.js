// CrediGestor v24 — padrão único de comprovantes com emojis em todas as abas e operações.
(function(){
  'use strict';
  const VERSION='24.0';

  function fmtDateV24(v){
    if(!v)return '—';
    if(v instanceof Date)return v.toLocaleDateString('pt-BR');
    const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return `${m[3]}/${m[2]}/${m[1]}`;
    const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('pt-BR');
  }
  function addMonthsV24(iso,months){
    const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';
    const y=Number(m[1]),mon=Number(m[2])-1,day=Number(m[3]),raw=mon+Math.max(1,Number(months)||1);
    const yy=y+Math.floor(raw/12),mm=((raw%12)+12)%12,last=new Date(yy,mm+1,0).getDate();
    return `${yy}-${String(mm+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
  }
  function rateLabelV24(v){return (Number(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}
  function metaV24(k){
    const principal=Math.max(0,Number(k?.initialPrincipal)||0),installments=Math.max(1,Number(k?.installments)||1);
    let total=Math.max(0,Number(k?.summaryTotal)||0);
    if(total<=0){
      if(k?.billingType==='fixed'&&Number(k?.fixedAmount)>0)total=Number(k.fixedAmount)*installments;
      else total=principal+(principal*(Number(k?.interestRate)||0)/100*installments);
    }
    return {code:k?.loanCode||k?.title||'EMPRÉSTIMO',principal,total,installments,installmentValue:installments?total/installments:total,modality:k?.modality||'Padrão',end:addMonthsV24(k?.startDate,installments)};
  }
  function contractBlockV24(cl,k,title='Resumo do Contrato'){
    const m=metaV24(k);
    return `🏦 *${title} - ${m.code}*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Valor Emprestado: ${brl(m.principal)}\n`+
      `💵 Valor Total: ${brl(m.total)}\n`+
      `📊 Taxa de Juros: ${rateLabelV24(k?.interestRate)}%\n`+
      `📅 Data do Início: ${fmtDateV24(k?.startDate)}\n`+
      `📅 Data do Término: ${fmtDateV24(m.end)}\n`+
      `📦 Modalidade: ${m.modality}\n`+
      `🔢 Parcelas: ${m.installments}x de ${brl(m.installmentValue)}`;
  }
  function paymentReceiptV24(cl,k,p){
    return contractBlockV24(cl,k,'Comprovante de Pagamento')+`\n\n`+
      `✅ Valor Pago: ${brl(p?.amount||0)}\n`+
      `📅 Data do Pagamento: ${fmtDateV24(p?.paidAt)}\n`+
      `💳 Forma de Pagamento: ${p?.method||'Não informada'}\n`+
      `🗓️ Referência: ${p?.reference||'—'}\n`+
      `✅ Status: Pago`+(p?.note?`\n📝 Observação: ${p.note}`:'');
  }
  function amortizationReceiptV24(cl,k,m){
    return contractBlockV24(cl,k,'Comprovante de Amortização')+`\n\n`+
      `📉 Saldo Anterior: ${brl(m?.balanceBefore||0)}\n`+
      `💰 Valor Amortizado: ${brl(m?.amount||0)}\n`+
      `💳 Novo Saldo: ${brl(m?.balanceAfter||0)}\n`+
      `📅 Data da Amortização: ${fmtDateV24(m?.date)}\n`+
      `✅ Status: Amortização registrada`+(m?.note?`\n📝 Observação: ${m.note}`:'');
  }
  function payoffReceiptV24(cl,k,p){
    return contractBlockV24(cl,k,'Comprovante de Quitação')+`\n\n`+
      `💰 Capital Pago: ${brl(p?.principalAmount||0)}\n`+
      `📊 Juros Pagos: ${brl(p?.interestAmount||0)}\n`+
      `💵 Total Pago: ${brl(p?.amount||0)}\n`+
      `📅 Data da Quitação: ${fmtDateV24(p?.paidAt)}\n`+
      `💳 Saldo Final: ${brl(0)}\n`+
      `✅ Status: *QUITADO*`+(p?.note?`\n📝 Observação: ${p.note}`:'');
  }
  function normalizePhoneV24(phone=''){
    let d=String(phone||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;return d;
  }
  function sendReceiptV24(cl,text,success='Comprovante gerado.'){
    const phone=normalizePhoneV24(cl?.phone||'');
    if(phone.length<12){alert(`${success} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar pelo WhatsApp.`);return false}
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');return true;
  }
  function openContractReceiptV24(clientId,loanId,kOverride=null){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=kOverride||(cl?.contracts||[]).find(x=>x.id===loanId);if(!cl||!k)return false;
    return sendReceiptV24(cl,contractBlockV24(cl,k),'Resumo do contrato gerado.');
  }

  window.contractReceiptBlockV24=contractBlockV24;
  window.paymentReceiptV24=paymentReceiptV24;
  window.amortizationReceiptV24=amortizationReceiptV24;
  window.payoffReceiptV24=payoffReceiptV24;
  window.openContractReceiptV24=openContractReceiptV24;
  // Compatibilidade: criação automática de novo empréstimo (v8) usa este nome.
  window.openLoanReceiptV7=openContractReceiptV24;
  window.openLoanReceiptV14=openContractReceiptV24;

  function rebindReceiptButtonsV24(root=document){
    root.querySelectorAll('.loan-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2'),btn=card.querySelector('.v7-receipt');if(ref&&btn)btn.onclick=()=>openContractReceiptV24(ref.dataset.client,ref.dataset.loan);
    });
    root.querySelectorAll('.v14-summary-btn').forEach(btn=>{btn.onclick=()=>openContractReceiptV24(btn.dataset.c,btn.dataset.k)});
  }
  if(typeof renderLoans2==='function'){
    const base=renderLoans2;renderLoans2=function(){const out=base();rebindReceiptButtonsV24(document.getElementById('view'));return out};
  }
  if(typeof renderCharges==='function'){
    const base=renderCharges;renderCharges=function(){const out=base();rebindReceiptButtonsV24(document.getElementById('view'));return out};
  }
  if(typeof openClientDetail==='function'){
    const base=openClientDetail;openClientDetail=function(id){const out=base(id);const cl=(state.clients||[]).find(x=>x.id===id);document.querySelectorAll('#modalContent .contract-card').forEach(card=>{const edit=card.querySelector('.edit-contract'),btn=card.querySelector('.v7-receipt');if(edit&&btn)btn.onclick=()=>openContractReceiptV24(id,edit.dataset.id)});return out};
  }
  if(typeof openContractModal==='function'){
    const base=openContractModal;openContractModal=function(clientId,contractId){const out=base(clientId,contractId);const btn=document.getElementById('sendReceiptModalV7');if(btn&&contractId)btn.onclick=()=>{const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;const temp={...k,loanCode:(document.getElementById('kCodeV7')?.value||k.loanCode||'EMPRÉSTIMO').trim(),modality:(document.getElementById('kModalityV7')?.value||k.modality||'Padrão').trim(),installments:Math.max(1,Number(document.getElementById('kInstallmentsV7')?.value)||Number(k.installments)||1),summaryTotal:Math.max(0,Number(document.getElementById('kTotalV7')?.value)||Number(k.summaryTotal)||0),interestRate:Number(document.getElementById('kRate')?.value)||Number(k.interestRate)||0,startDate:document.getElementById('kStart')?.value||k.startDate};openContractReceiptV24(clientId,contractId,temp)};return out};
  }

  window.__credigestorV24={version:VERSION,unifiedEmojiReceipts:true,contractEndShownInReceipt:true};
  if(typeof currentView!=='undefined'){
    if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
    else if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();
  }
})();
