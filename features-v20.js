// CrediGestor v20 — quitação antecipada com baixa imediata do contrato.
(function(){
  'use strict';

  function normalizePhoneV20(phone=''){
    let d=String(phone||'').replace(/\D/g,'');
    if(!d)return '';
    if(d.startsWith('00'))d=d.slice(2);
    if(!d.startsWith('55'))d='55'+d;
    return d;
  }
  function formatDateV20(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:(value||'—');
  }
  function loanCodeV20(k){return k?.loanCode||k?.title||'EMPRÉSTIMO'}
  function currentBalanceV20(k){
    try{return Math.max(0,Number(contractBalance(k))||0)}
    catch(_){return Math.max(0,Number(k?.currentPrincipal)||Number(k?.initialPrincipal)||0)}
  }
  function sendWhatsAppV20(cl,text,successMessage='Registro realizado.'){
    const phone=normalizePhoneV20(cl?.phone||'');
    if(phone.length<12){
      alert(`${successMessage} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar o comprovante pelo WhatsApp.`);
      return false;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
    return true;
  }
  function firstDueDateV20(k){
    const start=String(k?.startDate||todayISO());
    const m=start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '';
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0);
    d.setMonth(d.getMonth()+1);
    return ymd(dueDateFor(d.getFullYear(),d.getMonth(),k?.baseDueDay||Number(m[3])));
  }
  function payoffReceiptTextV20(cl,k,payment){
    return `🏦 *Quitação do Empréstimo - ${loanCodeV20(k)}*\n`+
      `👤 Cliente: ${cl?.name||'Cliente'}\n`+
      `💰 Valor Emprestado: ${brl(k?.initialPrincipal||0)}\n`+
      `💵 Valor da Quitação: ${brl(payment?.amount||0)}\n`+
      `📅 Data do Empréstimo: ${formatDateV20(k?.startDate)}\n`+
      `📅 Primeiro Vencimento: ${formatDateV20(firstDueDateV20(k))}\n`+
      `✅ Quitado${k?.paidOffEarly?' antecipadamente':''} em: ${formatDateV20(payment?.paidAt)}\n`+
      `💳 Saldo restante: ${brl(0)}\n`+
      `📌 Status: *QUITADO*`;
  }
  window.payoffReceiptTextV20=payoffReceiptTextV20;

  function settleLoanV20(cl,k,opts={}){
    const paidAt=opts.paidAt||todayISO();
    const amount=Math.max(0,Number(opts.amount)||0);
    const ref=String(opts.reference||monthRef());
    const balance=currentBalanceV20(k);
    const firstDue=firstDueDateV20(k);
    const early=!!firstDue && paidAt<firstDue;

    const existing=(k.payments||[]).find(p=>p.reference===ref && p.type==='payoff');
    const payment={
      id:existing?.id||uid('py'),reference:ref,amount,paidAt,
      method:opts.method||'PIX',note:opts.note||'',status:'paid',type:'payoff',
      payoff:true,createdAt:existing?.createdAt||new Date().toISOString()
    };
    k.payments=k.payments||[];
    if(existing)Object.assign(existing,payment);else k.payments.push(payment);

    if(balance>0){
      k.movements=k.movements||[];
      k.movements.push({
        id:uid('mv'),type:'amortization',amount:balance,date:paidAt,
        note:'Quitação total do empréstimo',balanceBefore:balance,balanceAfter:0,
        payoff:true,createdAt:new Date().toISOString()
      });
    }

    k.currentPrincipal=0;
    k.active=false;
    k.status='paid';
    k.loanStatus='paid';
    k.closed=true;
    k.closedAt=paidAt;
    k.paidOffAt=paidAt;
    k.paidOffEarly=early;
    k.closedReason=early?'Quitação antecipada':'Quitação total';
    k.lastBalanceUpdate=paidAt;
    k.nextDueDate='';
    k.notificationsDisabled=true;
    k.updatedAt=new Date().toISOString();

    saveState();
    return payment;
  }
  window.settleLoanV20=settleLoanV20;

  openPaymentModal=function(clientId,contractId,ref){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const useRef=String(ref||monthRef());
    const [y,m]=useRef.split('-').map(Number),x=chargeFor(cl,k,y,m-1),existing=getPayment(k,useRef);
    const balance=currentBalanceV20(k);
    const suggestedPayoff=Math.max(balance, balance + Math.max(0,Number(x?.amount)||0));
    openModal(`
      <h2>Pagar</h2>
      <div class="card"><div class="muted">${esc(cl.name)} • referência ${esc(useRef)}</div><strong style="font-size:26px">${brl(x.amount)}</strong><div class="muted">Saldo atual do principal: ${brl(balance)}</div><div class="muted">Vencimento ${x.due.toLocaleDateString('pt-BR')}</div></div>
      <div class="field"><label>Mês de referência</label><input id="pRef" value="${esc(useRef)}" pattern="\\d{4}-\\d{2}"></div>
      <div class="field"><label>Valor pago</label><input id="pAmount" type="number" step="0.01" value="${Number(existing?.amount||x.amount).toFixed(2)}"></div>
      <div class="field"><label>Data do pagamento</label><input id="pDate" type="date" value="${esc(existing?.paidAt||todayISO())}"></div>
      <div class="field"><label>Forma de pagamento</label><select id="pMethod"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></div>
      <div class="field"><label>Observação</label><textarea id="pNote">${esc(existing?.note||'')}</textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="savePaymentBtn">Confirmar pagamento e enviar comprovante</button></div>

      <div class="section-title"><h2>Quitação total</h2></div>
      <div class="card">
        <div class="muted">Use esta opção quando o empréstimo for encerrado por completo, inclusive antes do primeiro vencimento.</div>
        <div class="field" style="margin-top:10px"><label>Valor recebido na quitação</label><input id="payoffAmountV20" type="number" step="0.01" min="0" value="${suggestedPayoff.toFixed(2)}"></div>
        <button type="button" class="primary-btn" id="payoffBtnV20" style="width:100%">Quitar empréstimo e dar baixa</button>
      </div>
      <div class="rule-note">Ao quitar, o contrato fica inativo, o saldo passa a R$ 0,00 e não gera novas cobranças nem notificações.</div>
    `,()=>{
      const method=document.getElementById('pMethod');if(method&&existing?.method)method.value=existing.method;
      document.getElementById('savePaymentBtn').onclick=()=>{
        const pRef=(document.getElementById('pRef')?.value||useRef).trim(),amount=Number(document.getElementById('pAmount')?.value)||0;
        if(amount<=0){alert('Informe um valor de pagamento maior que zero.');return}
        const old=getPayment(k,pRef),payment={id:old?.id||uid('py'),reference:pRef,amount,paidAt:document.getElementById('pDate')?.value||todayISO(),method:document.getElementById('pMethod')?.value||'PIX',note:(document.getElementById('pNote')?.value||'').trim(),status:'paid'};
        if(old)Object.assign(old,payment);else{k.payments=k.payments||[];k.payments.push(payment)}
        saveState();closeModal();render();
        if(typeof sendWhatsAppV19==='function')sendWhatsAppV19(cl,paymentReceiptTextV19(cl,k,payment),'Pagamento registrado como pago.');
        else sendWhatsAppV20(cl,`✅ *Pagamento recebido*\n👤 Cliente: ${cl.name}\n💰 Valor pago: ${brl(amount)}\n📅 Data: ${formatDateV20(payment.paidAt)}\n📄 Contrato: ${loanCodeV20(k)}`,'Pagamento registrado como pago.');
      };
      document.getElementById('payoffBtnV20').onclick=()=>{
        const amount=Number(document.getElementById('payoffAmountV20')?.value)||0;
        const paidAt=document.getElementById('pDate')?.value||todayISO();
        if(amount<=0){alert('Informe o valor recebido na quitação.');return}
        if(!confirm(`Confirmar quitação total de ${loanCodeV20(k)}? O contrato será encerrado e o saldo ficará zerado.`))return;
        const payment=settleLoanV20(cl,k,{reference:(document.getElementById('pRef')?.value||useRef).trim(),amount,paidAt,method:document.getElementById('pMethod')?.value||'PIX',note:(document.getElementById('pNote')?.value||'').trim()});
        closeModal();render();
        sendWhatsAppV20(cl,payoffReceiptTextV20(cl,k,payment),'Empréstimo quitado e baixado no sistema.');
      };
    });
  };

  let changed=false;
  (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>{
    const payoff=(k.payments||[]).find(p=>p?.payoff||p?.type==='payoff');
    if(payoff && k.active!==false){
      k.active=false;k.status='paid';k.loanStatus='paid';k.closed=true;k.closedAt=payoff.paidAt||todayISO();k.paidOffAt=k.closedAt;k.currentPrincipal=0;k.notificationsDisabled=true;changed=true;
    }
  }));
  if(changed)saveState();
})();
