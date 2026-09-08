// CrediGestor v19 — comprovantes sincronizados com o saldo após amortizações.
(function(){
  'use strict';

  function normalizePhoneV19(phone=''){
    let d=String(phone||'').replace(/\D/g,'');
    if(!d)return '';
    if(d.startsWith('00'))d=d.slice(2);
    if(!d.startsWith('55'))d='55'+d;
    return d;
  }
  function formatDateV19(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:(value||'—');
  }
  function loanCodeV19(k){return k?.loanCode||k?.title||'EMPRÉSTIMO'}
  function currentBalanceV19(k){
    try{return Math.max(0,Number(contractBalance(k))||0)}catch(_){return Math.max(0,Number(k?.currentPrincipal)||Number(k?.initialPrincipal)||0)}
  }
  function balanceAfterMovementV19(k,movement){
    if(Number.isFinite(Number(movement?.balanceAfter)))return Math.max(0,Number(movement.balanceAfter));
    let bal=Math.max(0,Number(k?.initialPrincipal)||0);
    for(const m of (k?.movements||[])){
      const amount=Math.max(0,Number(m?.amount)||0);
      bal=m?.type==='increase'?bal+amount:Math.max(0,bal-amount);
      if(m?.id===movement?.id)break;
    }
    return bal;
  }
  function balanceBeforeMovementV19(k,movement){
    if(Number.isFinite(Number(movement?.balanceBefore)))return Math.max(0,Number(movement.balanceBefore));
    const after=balanceAfterMovementV19(k,movement),amount=Math.max(0,Number(movement?.amount)||0);
    return movement?.type==='increase'?Math.max(0,after-amount):after+amount;
  }
  function sendWhatsAppV19(cl,text,successMessage='Registro realizado.'){
    const phone=normalizePhoneV19(cl?.phone||'');
    if(phone.length<12){
      alert(`${successMessage} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar o comprovante pelo WhatsApp.`);
      return false;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
    return true;
  }

  function paymentReceiptTextV19(cl,k,payment){
    const balance=currentBalanceV19(k);
    return `✅ *Pagamento recebido*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Valor pago: ${brl(payment?.amount)}\n`+
      `💳 Saldo atual: ${brl(balance)}\n`+
      `📅 Data: ${formatDateV19(payment?.paidAt)}\n`+
      `📄 Contrato: ${loanCodeV19(k)}\n`+
      `✅ Situação: Pago`;
  }

  function amortizationReceiptTextV19(cl,k,movement){
    const before=balanceBeforeMovementV19(k,movement),after=balanceAfterMovementV19(k,movement);
    return `📉 *Amortização realizada*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💳 Saldo anterior: ${brl(before)}\n`+
      `💰 Valor amortizado: ${brl(movement?.amount)}\n`+
      `💳 Novo saldo: ${brl(after)}\n`+
      `📅 Data: ${formatDateV19(movement?.date)}\n`+
      `📄 Contrato: ${loanCodeV19(k)}`;
  }

  window.paymentReceiptTextV19=paymentReceiptTextV19;
  window.amortizationReceiptTextV19=amortizationReceiptTextV19;
  // Mantém nomes da v18 apontando para a regra corrigida, para qualquer integração já existente.
  window.paymentReceiptTextV18=paymentReceiptTextV19;
  window.amortizationReceiptTextV18=(cl,k,movement)=>amortizationReceiptTextV19(cl,k,movement);

  // Pagamento sempre consulta o saldo vigente no momento do envio do comprovante.
  openPaymentModal=function(clientId,contractId,ref){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const useRef=String(ref||monthRef());
    const [y,m]=useRef.split('-').map(Number),x=chargeFor(cl,k,y,m-1),existing=getPayment(k,useRef);
    openModal(`
      <h2>Pagar</h2>
      <div class="card"><div class="muted">${esc(cl.name)} • referência ${esc(useRef)}</div><strong style="font-size:26px">${brl(x.amount)}</strong><div class="muted">Saldo atual do principal: ${brl(currentBalanceV19(k))}</div><div class="muted">Vencimento ${x.due.toLocaleDateString('pt-BR')}</div></div>
      <div class="field"><label>Mês de referência</label><input id="pRef" value="${esc(useRef)}" pattern="\\d{4}-\\d{2}"></div>
      <div class="field"><label>Valor pago</label><input id="pAmount" type="number" step="0.01" value="${Number(existing?.amount||x.amount).toFixed(2)}"></div>
      <div class="field"><label>Data do pagamento</label><input id="pDate" type="date" value="${esc(existing?.paidAt||todayISO())}"></div>
      <div class="field"><label>Forma de pagamento</label><select id="pMethod"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></div>
      <div class="field"><label>Observação</label><textarea id="pNote">${esc(existing?.note||'')}</textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="savePaymentBtn">Confirmar pagamento e enviar comprovante</button></div>
      <div class="rule-note">O comprovante usa o saldo atual do contrato, já considerando todas as amortizações registradas.</div>
    `,()=>{
      const method=document.getElementById('pMethod');if(method&&existing?.method)method.value=existing.method;
      document.getElementById('savePaymentBtn').onclick=()=>{
        const pRef=(document.getElementById('pRef')?.value||useRef).trim(),amount=Number(document.getElementById('pAmount')?.value)||0;
        if(amount<=0){alert('Informe um valor de pagamento maior que zero.');return}
        const old=getPayment(k,pRef),payment={id:old?.id||uid('py'),reference:pRef,amount,paidAt:document.getElementById('pDate')?.value||todayISO(),method:document.getElementById('pMethod')?.value||'PIX',note:(document.getElementById('pNote')?.value||'').trim(),status:'paid'};
        if(old)Object.assign(old,payment);else{k.payments=k.payments||[];k.payments.push(payment)}
        saveState();closeModal();render();
        sendWhatsAppV19(cl,paymentReceiptTextV19(cl,k,payment),'Pagamento registrado como pago.');
      };
    });
  };

  // Amortização persiste saldo anterior e posterior para que o comprovante permaneça correto no histórico.
  openMovementModal=function(clientId,contractId){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const balanceBefore=currentBalanceV19(k);
    openModal(`
      <h2>Alterar saldo do contrato</h2>
      <div class="card"><div class="muted">Saldo atual</div><strong style="font-size:26px">${brl(balanceBefore)}</strong></div>
      <div class="field"><label>Tipo</label><select id="mType"><option value="increase">Acréscimo / novo valor liberado</option><option value="amortization">Amortização do principal</option></select></div>
      <div class="field"><label>Valor</label><input id="mAmount" type="number" step="0.01" min="0.01"></div>
      <div class="card" id="mPreviewV19"><div class="muted">Novo saldo após a alteração</div><strong style="font-size:24px">${brl(balanceBefore)}</strong></div>
      <div class="field"><label>Data</label><input id="mDate" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Observação</label><textarea id="mNote" placeholder="Ex.: amortização parcial do principal"></textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="saveMovementBtn">Registrar alteração</button></div>
      <div class="rule-note">A amortização atualiza imediatamente o saldo do contrato e os comprovantes seguintes.</div>
      <div class="section-title"><h2>Histórico</h2></div>
      ${(k.movements||[]).length?k.movements.slice().reverse().map(m=>`<div class="contract-card"><div class="row space"><div class="title">${m.type==='increase'?'Acréscimo':'Amortização'}</div><strong>${m.type==='increase'?'+':'-'} ${brl(m.amount)}</strong></div><div class="muted">${new Date(m.date+'T12:00').toLocaleDateString('pt-BR')} • ${esc(m.note||'')}</div>${m.type==='amortization'?`<div class="muted" style="margin-top:5px">Saldo após: <b>${brl(balanceAfterMovementV19(k,m))}</b></div>`:''}</div>`).join(''):`<div class="empty">Nenhuma alteração de principal.</div>`}
    `,()=>{
      const typeEl=document.getElementById('mType'),amountEl=document.getElementById('mAmount'),preview=document.querySelector('#mPreviewV19 strong'),save=document.getElementById('saveMovementBtn');
      const updatePreview=()=>{const amount=Math.max(0,Number(amountEl.value)||0),next=typeEl.value==='increase'?balanceBefore+amount:Math.max(0,balanceBefore-amount);preview.textContent=brl(next);save.textContent=typeEl.value==='amortization'?'Confirmar amortização e enviar comprovante':'Registrar acréscimo'};
      typeEl.onchange=updatePreview;amountEl.oninput=updatePreview;updatePreview();
      save.onclick=()=>{
        const type=typeEl.value,amount=Number(amountEl.value)||0;
        if(amount<=0){alert('Informe um valor maior que zero.');return}
        if(type==='amortization'&&amount>balanceBefore){alert(`A amortização não pode ser maior que o saldo atual de ${brl(balanceBefore)}.`);return}
        const newBalance=type==='increase'?balanceBefore+amount:Math.max(0,balanceBefore-amount);
        const movement={id:uid('mv'),type,amount,date:document.getElementById('mDate').value||todayISO(),note:document.getElementById('mNote').value.trim(),balanceBefore,balanceAfter:newBalance,createdAt:new Date().toISOString()};
        k.movements=k.movements||[];k.movements.push(movement);k.currentPrincipal=newBalance;k.lastBalanceUpdate=movement.date;
        saveState();closeModal();render();
        if(type==='amortization')sendWhatsAppV19(cl,amortizationReceiptTextV19(cl,k,movement),'Amortização registrada.');
        else openClientDetail(clientId);
      };
    });
  };

  // Preenche metadados ausentes das amortizações antigas sem alterar o saldo calculado.
  let changed=false;
  (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>{
    let bal=Math.max(0,Number(k.initialPrincipal)||0);
    (k.movements||[]).forEach(m=>{
      const before=bal,amount=Math.max(0,Number(m.amount)||0);
      bal=m.type==='increase'?bal+amount:Math.max(0,bal-amount);
      if(!Number.isFinite(Number(m.balanceBefore))){m.balanceBefore=before;changed=true}
      if(!Number.isFinite(Number(m.balanceAfter))){m.balanceAfter=bal;changed=true}
    });
    if(Number(k.currentPrincipal)!==bal){k.currentPrincipal=bal;changed=true}
  }));
  if(changed)saveState();
})();
