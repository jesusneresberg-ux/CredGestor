(function(){
  'use strict';
  let modalClient='',modalContract='';
  function summary(clientId,contractId){
    const client=state.clients.find(c=>c.id===clientId),contract=client?.contracts?.find(k=>k.id===contractId);if(!contract)return;
    const text=window.contractReceiptBlockV25(client,contract,'Comprovante do Contrato');
    if(String(client.phone||'').replace(/\D/g,'').length>=10)return window.prepareReceiptV25(client,text,'Comprovante do contrato.');
    openModal(`<h2>Comprovante do contrato</h2><div class="field"><label>Comprovante</label><textarea id="contractSummaryText" readonly rows="12">${esc(text)}</textarea></div><button type="button" class="soft-btn" id="copyContractSummary">Copiar comprovante</button><p class="muted">Cadastre o telefone do cliente para enviar pelo WhatsApp.</p>`,()=>{
      document.getElementById('copyContractSummary').onclick=async()=>{const field=document.getElementById('contractSummaryText');try{await navigator.clipboard.writeText(field.value)}catch(_){field.select();document.execCommand('copy')}};
    });
  }
  window.openLoanReceiptV7=summary;window.openLoanReceiptV14=summary;window.openContractSummary=summary;
  function labelReceipts(root){root?.querySelectorAll('.v7-receipt,.v14-summary-btn').forEach(b=>b.textContent='📤 Enviar comprovante do contrato')}
  const loans=renderLoans2;renderLoans2=function(){const out=loans();labelReceipts(document.getElementById('view'));return out};
  const detail=openClientDetail;
  openClientDetail=function(id){modalClient=id;modalContract='';const out=detail(id);labelReceipts(document.getElementById('modalContent'));return out};
  const edit=openContractModal;
  openContractModal=function(clientId,contractId){modalClient=clientId;modalContract=contractId||'';const out=edit(clientId,contractId);
    const button=document.getElementById('sendReceiptModalV7');if(button)button.textContent='📤 Enviar comprovante do contrato';return out;
  };
  function route(clientId,contractId,ref){
    const client=state.clients.find(c=>c.id===clientId),contract=client?.contracts?.find(k=>k.id===contractId);
    if(!contract)return;
    if(isPaidContract(contract))return window.openContractReceiptV25(clientId,contractId);
    closeModal();return window.openPaymentsHubV21(clientId,contractId,ref);
  }
  // Captura o clique antes dos manipuladores legados de cada aba.
  document.addEventListener('click',event=>{
    const button=event.target.closest('.v7-receipt,.v14-summary-btn,.v13-pay,.v21-pay-btn,.pay-btn');
    if(!button||button.disabled)return;
    const card=button.closest('.loan-card,.contract-card,.list-item'),edit=card?.querySelector('.edit-loan2,.edit-contract');
    const clientId=button.dataset.v21Client||button.dataset.c||edit?.dataset.client||(button.closest('#modalContent')?modalClient:'');
    const contractId=button.dataset.v21Loan||button.dataset.k||edit?.dataset.loan||edit?.dataset.id||(button.id==='sendReceiptModalV7'?modalContract:'');
    if(!clientId||!contractId)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.matches('.v7-receipt,.v14-summary-btn'))return summary(clientId,contractId);
    route(clientId,contractId,button.dataset.v21Ref||button.dataset.r);
  },true);
  // O antigo formulário de alterações também encaminha amortizações ao registro único.
  const movement=openMovementModal;
  openMovementModal=function(clientId,contractId){
    const out=movement(clientId,contractId),button=document.getElementById('saveMovementBtn');if(!button)return out;
    const old=button.onclick;
    button.onclick=event=>{
      if(document.getElementById('mType')?.value!=='amortization')return old.call(button,event);
      const amount=document.getElementById('mAmount')?.value,date=document.getElementById('mDate')?.value,note=document.getElementById('mNote')?.value||'';
      route(clientId,contractId);document.getElementById('v21Amortize')?.click();
      const input=document.getElementById('v21Amount');if(!input)return;
      input.value=amount;input.dispatchEvent(new Event('input'));document.getElementById('v21Date').value=date;document.getElementById('v21Note').value=note;
      document.getElementById('v21ConfirmAmort').click();
    };return out;
  };
  // Compatibilidade: chamadas antigas de comprovante não podem declarar uma baixa inexistente.
  window.openPaymentReceiptV13=function(clientId,contractId,payment){
    const client=state.clients.find(c=>c.id===clientId),contract=client?.contracts?.find(k=>k.id===contractId);
    const saved=contract?.payments?.find(p=>p.id===payment?.id);
    if(!saved)return route(clientId,contractId,payment?.reference);
    const stored=JSON.parse(localStorage.getItem(DB_KEY)||'null')?.clients?.find(c=>c.id===clientId)?.contracts?.find(k=>k.id===contractId)?.payments?.find(p=>p.id===saved.id);
    if(!stored){alert('Este pagamento ainda não tem baixa salva. Registre o pagamento para emitir o comprovante.');return;}
    return window.prepareReceiptV25(client,window.paymentReceiptV25(client,contract,saved),'Comprovante de pagamento já registrado.');
  };
})();
