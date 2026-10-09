// CrediGestor v18 — amortização com saldo atualizado e comprovantes resumidos.
(function(){
  'use strict';

  function normalizePhoneV18(phone=''){
    let d=String(phone||'').replace(/\D/g,'');
    if(!d)return '';
    if(d.startsWith('00'))d=d.slice(2);
    if(!d.startsWith('55'))d='55'+d;
    return d;
  }
  function formatDateV18(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return value||'—';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  function loanCodeV18(k){return k?.loanCode||k?.title||'EMPRÉSTIMO'}
  function sendWhatsAppV18(cl,text,successMessage='Registro realizado.'){
    const phone=normalizePhoneV18(cl?.phone||'');
    if(phone.length<12){
      alert(`${successMessage} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar o comprovante pelo WhatsApp.`);
      return false;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
    return true;
  }

  function paymentReceiptTextV18(cl,k,payment){
    return `✅ *Pagamento recebido*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Valor pago: ${brl(payment?.amount)}\n`+
      `📅 Data: ${formatDateV18(payment?.paidAt)}\n`+
      `📄 Contrato: ${loanCodeV18(k)}\n`+
      `✅ Situação: Pago`;
  }

  function amortizationReceiptTextV18(cl,k,movement,newBalance){
    return `📉 *Amortização realizada*\n\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Valor amortizado: ${brl(movement?.amount)}\n`+
      `💳 Novo saldo: ${brl(newBalance)}\n`+
      `📅 Data: ${formatDateV18(movement?.date)}\n`+
      `📄 Contrato: ${loanCodeV18(k)}`;
  }

  window.paymentReceiptTextV18=paymentReceiptTextV18;
  window.amortizationReceiptTextV18=amortizationReceiptTextV18;

  // Pagamento: mantém o fluxo existente, mas usa comprovante curto.
  openPaymentModal=function(clientId,contractId,ref){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const useRef=String(ref||monthRef());
    const [y,m]=useRef.split('-').map(Number),x=chargeFor(cl,k,y,m-1);
    const existing=getPayment(k,useRef);
    openModal(`
      <h2>Pagar</h2>
      <div class="card"><div class="muted">${esc(cl.name)} • referência ${esc(useRef)}</div><strong style="font-size:26px">${brl(x.amount)}</strong><div class="muted">Vencimento ${x.due.toLocaleDateString('pt-BR')}</div></div>
      <div class="field"><label>Mês de referência</label><input id="pRef" value="${esc(useRef)}" pattern="\\d{4}-\\d{2}"></div>
      <div class="field"><label>Valor pago</label><input id="pAmount" type="number" step="0.01" value="${Number(existing?.amount||x.amount).toFixed(2)}"></div>
      <div class="field"><label>Data do pagamento</label><input id="pDate" type="date" value="${esc(existing?.paidAt||todayISO())}"></div>
      <div class="field"><label>Forma de pagamento</label><select id="pMethod"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></div>
      <div class="field"><label>Observação</label><textarea id="pNote">${esc(existing?.note||'')}</textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="savePaymentBtn">Confirmar pagamento e enviar comprovante</button></div>
      <div class="rule-note">O comprovante enviado será resumido: cliente, valor pago, data, contrato e situação.</div>
    `,()=>{
      const method=document.getElementById('pMethod');if(method&&existing?.method)method.value=existing.method;
      document.getElementById('savePaymentBtn').onclick=()=>{
        const pRef=(document.getElementById('pRef')?.value||useRef).trim();
        const amount=Number(document.getElementById('pAmount')?.value)||0;
        if(amount<=0){alert('Informe um valor de pagamento maior que zero.');return}
        const old=getPayment(k,pRef);
        const payment={
          id:old?.id||uid('py'),reference:pRef,amount,
          paidAt:document.getElementById('pDate')?.value||todayISO(),
          method:document.getElementById('pMethod')?.value||'PIX',
          note:(document.getElementById('pNote')?.value||'').trim(),status:'paid'
        };
        if(old)Object.assign(old,payment);else{k.payments=k.payments||[];k.payments.push(payment)}
        saveState();closeModal();render();
        sendWhatsAppV18(cl,paymentReceiptTextV18(cl,k,payment),'Pagamento registrado como pago.');
      };
    });
  };

  // Acréscimo/amortização: recalcula o saldo imediatamente e envia recibo curto nas amortizações.
  openMovementModal=function(clientId,contractId){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const balanceBefore=contractBalance(k);
    openModal(`
      <h2>Alterar saldo do contrato</h2>
      <div class="card"><div class="muted">Saldo atual</div><strong style="font-size:26px">${brl(balanceBefore)}</strong></div>
      <div class="field"><label>Tipo</label><select id="mType"><option value="increase">Acréscimo / novo valor liberado</option><option value="amortization">Amortização do principal</option></select></div>
      <div class="field"><label>Valor</label><input id="mAmount" type="number" step="0.01" min="0.01"></div>
      <div class="card" id="mPreviewV18"><div class="muted">Novo saldo após a alteração</div><strong style="font-size:24px">${brl(balanceBefore)}</strong></div>
      <div class="field"><label>Data</label><input id="mDate" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Observação</label><textarea id="mNote" placeholder="Ex.: amortização parcial do principal"></textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="saveMovementBtn">Registrar alteração</button></div>
      <div class="rule-note">Na amortização, o saldo do contrato é reduzido imediatamente. As próximas cobranças de juros passam a usar o novo saldo.</div>
      <div class="section-title"><h2>Histórico</h2></div>
      ${(k.movements||[]).length?k.movements.slice().reverse().map(m=>`<div class="contract-card"><div class="row space"><div class="title">${m.type==='increase'?'Acréscimo':'Amortização'}</div><strong>${m.type==='increase'?'+':'-'} ${brl(m.amount)}</strong></div><div class="muted">${new Date(m.date+'T12:00').toLocaleDateString('pt-BR')} • ${esc(m.note||'')}</div></div>`).join(''):`<div class="empty">Nenhuma alteração de principal.</div>`}
    `,()=>{
      const typeEl=document.getElementById('mType'),amountEl=document.getElementById('mAmount'),preview=document.querySelector('#mPreviewV18 strong'),save=document.getElementById('saveMovementBtn');
      const updatePreview=()=>{
        const amount=Math.max(0,Number(amountEl.value)||0),next=typeEl.value==='increase'?balanceBefore+amount:Math.max(0,balanceBefore-amount);
        preview.textContent=brl(next);
        save.textContent=typeEl.value==='amortization'?'Confirmar amortização e enviar comprovante':'Registrar acréscimo';
      };
      typeEl.onchange=updatePreview;amountEl.oninput=updatePreview;updatePreview();
      save.onclick=()=>{
        const type=typeEl.value,amount=Number(amountEl.value)||0;
        if(amount<=0){alert('Informe um valor maior que zero.');return}
        if(type==='amortization'&&amount>balanceBefore){alert(`A amortização não pode ser maior que o saldo atual de ${brl(balanceBefore)}.`);return}
        const movement={id:uid('mv'),type,amount,date:document.getElementById('mDate').value||todayISO(),note:document.getElementById('mNote').value.trim(),createdAt:new Date().toISOString()};
        k.movements=k.movements||[];k.movements.push(movement);
        const newBalance=contractBalance(k);
        // Campo explícito auxiliar para integrações/relatórios futuros; contractBalance continua sendo a fonte de verdade.
        k.currentPrincipal=newBalance;
        k.lastBalanceUpdate=movement.date;
        saveState();closeModal();render();
        if(type==='amortization')sendWhatsAppV18(cl,amortizationReceiptTextV18(cl,k,movement,newBalance),'Amortização registrada.');
        else openClientDetail(clientId);
      };
    });
  };

  // Recalcula o saldo auxiliar dos contratos já existentes ao carregar a versão.
  let changed=false;
  (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>{
    const bal=contractBalance(k);
    if(Number(k.currentPrincipal)!==bal){k.currentPrincipal=bal;changed=true}
  }));
  if(changed)saveState();
})();
