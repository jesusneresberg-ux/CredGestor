// CrediGestor v13 — dia-base automático, botão Pagar e comprovante de pagamento via WhatsApp.
(function(){
  'use strict';

  const style=document.createElement('style');
  style.textContent=`
    .v13-pay{background:rgba(37,99,235,.10)!important;color:#1d4ed8!important}
    .v13-base-auto{font-size:10px;color:var(--muted);margin-top:5px;line-height:1.35}
    .v13-payment-note{margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(37,99,235,.07);color:var(--muted);font-size:11px;line-height:1.45}
  `;
  document.head.appendChild(style);

  function normalizePhoneV13(phone=''){
    let d=String(phone).replace(/\D/g,'');
    if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;
    return d;
  }
  function formatDateV13(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '—';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  function startDayV13(value){
    const m=String(value||'').match(/^\d{4}-\d{2}-(\d{2})$/);
    const n=m?Number(m[1]):0;
    return n>=1&&n<=31?n:0;
  }
  function nextRefV13(ref){
    const [y,m]=String(ref||'').split('-').map(Number);
    const d=new Date(y||new Date().getFullYear(),Math.max(0,(m||1)-1)+1,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function nextUnpaidRefV13(k){
    let ref=monthRef();
    for(let i=0;i<36;i++){
      if(!(k.payments||[]).some(p=>p.reference===ref))return ref;
      ref=nextRefV13(ref);
    }
    return monthRef();
  }

  function syncLoanBaseDaysV13(){
    let changed=false;
    (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>{
      const day=startDayV13(k.startDate);
      if(day&&Number(k.baseDueDay)!==day){k.baseDueDay=day;changed=true}
    }));
    if(changed)saveState();
  }
  syncLoanBaseDaysV13();

  function makeBaseDayAutomaticV13(){
    const start=document.getElementById('kStart'),day=document.getElementById('kDay');
    if(!start||!day)return;
    const update=()=>{const d=startDayV13(start.value);if(d)day.value=String(d)};
    update();
    day.readOnly=true;
    day.setAttribute('aria-readonly','true');
    const label=day.closest('.field')?.querySelector('label');
    if(label)label.textContent='Dia-base do vencimento (automático)';
    if(!day.closest('.field')?.querySelector('.v13-base-auto')){
      day.insertAdjacentHTML('afterend','<div class="v13-base-auto">Definido automaticamente pelo dia da data do empréstimo. Ex.: início em 09/06 → dia-base 9.</div>');
    }
    start.addEventListener('change',update);
    start.addEventListener('input',update);
  }

  if(typeof openContractModal==='function'){
    const beforeContractV13=openContractModal;
    openContractModal=function(clientId,contractId){
      const out=beforeContractV13(clientId,contractId);
      makeBaseDayAutomaticV13();
      return out;
    };
  }

  function relabelPayButtonsV13(root=document){
    root.querySelectorAll('.pay-btn').forEach(b=>{b.textContent='Pagar'});
  }

  function paymentReceiptTextV13(cl,k,payment){
    let base='';
    if(typeof window.loanReceiptTextV7==='function')base=window.loanReceiptTextV7(cl,k);
    else{
      const principal=Number(k.initialPrincipal)||0;
      const installments=Math.max(1,Number(k.installments)||1);
      const total=Number(k.summaryTotal)>0?Number(k.summaryTotal):principal+(principal*(Number(k.interestRate)||0)/100*installments);
      const interest=Math.max(0,total-principal);
      base=`🏦 *Resumo do Empréstimo - ${k.loanCode||'EMPRÉSTIMO'}*\n\n`+
        `👤 Cliente: ${cl.name||'Cliente'}\n`+
        `💰 Valor Emprestado: ${brl(principal)}\n`+
        `💸 Valor dos Juros: ${brl(interest)}\n`+
        `💵 Valor Total: ${brl(total)}\n`+
        `📊 Taxa de Juros: ${Number(k.interestRate)||0}%`;
    }
    return `✅ *Pagamento confirmado*\n\n${base}\n\n`+
      `💳 Valor Pago: ${brl(payment.amount)}\n`+
      `📅 Data do Pagamento: ${formatDateV13(payment.paidAt)}\n`+
      `🗓️ Referência: ${payment.reference||'—'}`+
      (payment.note?`\n📝 Observação: ${payment.note}`:'');
  }

  function openPaymentReceiptV13(clientId,contractId,payment){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return false;
    const phone=normalizePhoneV13(cl.phone);
    if(phone.length<12){
      alert(`Pagamento registrado. Cadastre um telefone com DDD para ${cl.name} para enviar o comprovante pelo WhatsApp.`);
      return false;
    }
    const text=paymentReceiptTextV13(cl,k,payment);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
    return true;
  }
  window.openPaymentReceiptV13=openPaymentReceiptV13;
  window.paymentReceiptTextV13=paymentReceiptTextV13;

  if(typeof openPaymentModal==='function'){
    const beforePaymentV13=openPaymentModal;
    openPaymentModal=function(clientId,contractId,ref){
      const out=beforePaymentV13(clientId,contractId,ref);
      const title=document.querySelector('#modalContent h2');if(title)title.textContent='Pagar';
      const save=document.getElementById('savePaymentBtn');
      if(!save)return out;
      save.textContent='Confirmar pagamento e enviar comprovante';
      const actions=save.closest('.actions');
      if(actions&&!document.getElementById('paymentAutoReceiptHintV13'))actions.insertAdjacentHTML('afterend','<div class="v13-payment-note" id="paymentAutoReceiptHintV13">Após confirmar, o pagamento será salvo e o WhatsApp do cliente abrirá com o comprovante preenchido no mesmo formato do resumo do empréstimo.</div>');
      const original=save.onclick;
      save.onclick=()=>{
        const payment={
          reference:(document.getElementById('pRef')?.value||ref||'').trim(),
          amount:Number(document.getElementById('pAmount')?.value)||0,
          paidAt:document.getElementById('pDate')?.value||todayISO(),
          note:(document.getElementById('pNote')?.value||'').trim()
        };
        if(payment.amount<=0){alert('Informe um valor de pagamento maior que zero.');return}
        original?.();
        openPaymentReceiptV13(clientId,contractId,payment);
      };
      return out;
    };
  }

  function addPayButtonsLoansV13(){
    document.querySelectorAll('.loan-card').forEach(card=>{
      if(card.querySelector('.v13-pay'))return;
      const ref=card.querySelector('.edit-loan2');const row=card.querySelector('.inline-actions');if(!ref||!row)return;
      const cl=(state.clients||[]).find(x=>x.id===ref.dataset.client),k=(cl?.contracts||[]).find(x=>x.id===ref.dataset.loan);if(!k||k.active===false)return;
      const b=document.createElement('button');b.type='button';b.className='small-btn v13-pay';b.textContent='💳 Pagar';
      b.onclick=()=>openPaymentModal(ref.dataset.client,ref.dataset.loan,nextUnpaidRefV13(k));
      row.insertBefore(b,row.firstChild);
    });
  }

  if(typeof renderLoans2==='function'){
    const beforeLoansV13=renderLoans2;
    renderLoans2=function(){const out=beforeLoansV13();addPayButtonsLoansV13();return out};
  }
  if(typeof renderCharges==='function'){
    const beforeChargesV13=renderCharges;
    renderCharges=function(){const out=beforeChargesV13();relabelPayButtonsV13(document.getElementById('view'));return out};
  }
  if(typeof renderDashboard==='function'){
    const beforeDashboardV13=renderDashboard;
    renderDashboard=function(){const out=beforeDashboardV13();relabelPayButtonsV13(document.getElementById('view'));return out};
  }

  // Reaplica na tela já aberta quando a atualização carrega.
  if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
  else if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();
  else if(currentView==='dashboard'&&typeof renderDashboard==='function')renderDashboard();
})();
