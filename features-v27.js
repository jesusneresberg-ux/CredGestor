// CrediGestor v27 — baixas centralizadas, comprovantes e conciliação de registros anteriores.
// Instalar depois de features-v26.js. Nenhum comprovante de CONTRATO gera uma baixa.
(function(){
  'use strict';
  const VERSION='27.0';
  if(typeof state==='undefined'||!Array.isArray(state.clients)){
    console.warn('CrediGestor v27: estado dos contratos indisponível.');return;
  }
  const fmt=v=>typeof brl==='function'?brl(v):Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const safe=v=>typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const now=()=>new Date().toISOString();
  const month=()=>typeof monthRef==='function'?monthRef():today().slice(0,7);
  const refOK=r=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(r||''));
  const normalizeRef=r=>{const s=String(r||'').trim();const br=s.match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);return br?`${br[2]}-${String(br[1]).padStart(2,'0')}`:s.slice(0,7)};
  const cents=n=>Math.round((Number(n)||0)*100);
  const findCl=id=>state.clients.find(c=>String(c.id)===String(id));
  const findLoan=(cid,kid)=>findCl(cid)?.contracts?.find(k=>String(k.id)===String(kid));
  const validPayment=p=>p&&Number.isFinite(Number(p.amount))&&Number(p.amount)>0&&
    !['void','cancelled','canceled','refunded','estornado','excluido','excluído','pending','pendente','open','unpaid','draft','rascunho'].includes(String(p.status||'').toLowerCase());
  const paymentRef=p=>{
    const explicit=String(p?.reference||p?.ref||'').trim();
    if(explicit)return normalizeRef(explicit);
    // Não usar a data do PIX como competência: um pagamento feito em outubro pode ser de setembro.
    return '';
  };
  function payments(k,ref){
    const target=normalizeRef(ref),seen=new Set();
    return (k?.payments||[]).filter(p=>{
      if(!validPayment(p)||paymentRef(p)!==target)return false;
      if(p.id){const id=String(p.id);if(seen.has(id))return false;seen.add(id)}
      return true;
    });
  }
  function paid(k,ref){return payments(k,ref).reduce((t,p)=>t+cents(p.amount),0)/100}
  function charge(cid,kid,ref){
    const cl=findCl(cid),k=findLoan(cid,kid);if(!cl||!k||!refOK(ref))return null;
    let x=null;
    try{const [y,m]=ref.split('-').map(Number);x=chargeFor(cl,k,y,m-1)}catch(_){ }
    if(!x)return null;
    const amount=Math.max(0,Number(x.amount)||0),already=paid(k,ref),balance=Math.max(0,Math.round((amount-already)*100)/100);
    return {cl,k,x,ref,amount,paid:already,balance,closed:amount>0&&cents(already)>=cents(amount),notDue:x.status==='not_due'};
  }
  // Corrige o motor original: um pagamento parcial não é uma parcela quitada.
  if(typeof chargeFor==='function'){
    const baseCharge=chargeFor;
    chargeFor=function(cl,k,y,m){
      const x=baseCharge(cl,k,y,m);if(!x||x.status==='not_due')return x;
      const total=paid(k,x.ref),amount=Math.max(0,Number(x.amount)||0);
      const isPaid=amount>0&&cents(total)>=cents(amount);
      const past=x.due instanceof Date?x.due:new Date(x.due);
      const todayDate=new Date();todayDate.setHours(0,0,0,0);
      const late=Number.isFinite(past.getTime())&&new Date(past.getFullYear(),past.getMonth(),past.getDate())<todayDate;
      return {...x,payment:payments(k,x.ref)[0]||null,paidAmount:total,remainingAmount:Math.max(0,Math.round((amount-total)*100)/100),status:isPaid?'paid':(late?'late':(total>0?'partial':'open'))};
    };
  }
  function refresh(){try{if(typeof render==='function')render();else if(typeof renderCharges==='function')renderCharges()}catch(e){console.warn('Falha ao atualizar tela após a baixa',e)}}
  function persist(){if(typeof saveState!=='function')throw new Error('Armazenamento indisponível');saveState()}
  function receiptText(row,p){
    const ref=paymentRef(p),x=charge(row.cl.id,row.k.id,ref),total=x?.paid||Number(p.amount)||0,rest=x?.balance||0;
    const isFull=x?.closed||p.payoff===true;
    const name=row.cl.name||'Cliente',code=row.k.loanCode||row.k.title||'Empréstimo';
    const date=String(p.paidAt||today());
    return `🏦 *Comprovante de Pagamento — CrediGestor*\n\n`+
      `👤 Cliente: ${name}\n📄 Contrato: ${code}\n🗓️ Competência: ${ref}\n`+
      `💵 Recebido nesta operação: ${fmt(p.amount)}\n💳 Forma: ${p.method||'Não informada'}\n`+
      `📅 Data do recebimento: ${date.split('-').reverse().join('/')}\n`+
      `📊 Acumulado da competência: ${fmt(total)}\n`+
      `✅ Situação: ${isFull?'PAGO / QUITADO NA COMPETÊNCIA':'PAGAMENTO PARCIAL'}\n`+
      `${!isFull?`📌 Saldo pendente: ${fmt(rest)}\n`:''}`+
      (p.note?`📝 Observação: ${p.note}\n`:'')+
      `🔎 Identificador: ${p.id||'registro legado'}`;
  }
  function whatsapp(cl,text){
    let phone=String(cl?.phone||'').replace(/\D/g,'');
    if(phone.length===10||phone.length===11)phone='55'+phone;
    if(phone.length<12){alert('Baixa registrada. Cadastre o telefone do cliente com DDD para compartilhar o comprovante.');return false}
    // Abrir WhatsApp não confirma que a mensagem foi enviada; a baixa decorre do recebimento confirmado.
    const w=window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
    if(!w){alert('Baixa registrada, mas o navegador pode ter bloqueado o WhatsApp. Reenvie pelo histórico.');return false}
    return true;
  }
  function sendExisting(cid,kid,pid){
    const cl=findCl(cid),k=findLoan(cid,kid),p=k?.payments?.find(x=>String(x.id)===String(pid));
    if(!cl||!p||!validPayment(p)){alert('Pagamento não localizado. Nenhuma baixa adicional foi criada.');return}
    whatsapp(cl,receiptText({cl,k},p));
  }
  function register({clientId,contractId,reference,amount,paidAt,method='PIX',note='',operationId=null}){
    const cl=findCl(clientId),k=findLoan(clientId,contractId),ref=normalizeRef(reference);
    const value=Math.round(Number(amount)*100)/100;
    if(!cl||!k||!refOK(ref))throw new Error('Cliente, contrato ou mês de referência inválido');
    if(!Number.isFinite(value)||value<=0)throw new Error('Informe um valor recebido maior que zero');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(paidAt||'')))throw new Error('Informe uma data válida');
    if(operationId){const prev=k.payments?.find(p=>p.operationId===operationId);if(prev)return prev}
    const id=typeof uid==='function'?uid('py'):`py_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const p={id,reference:ref,amount:value,paidAt,method,note,status:'paid',type:'installment',
      operationId:operationId||id,source:'v27',createdAt:now()};
    k.payments=Array.isArray(k.payments)?k.payments:[];
    k.payments.push(p);k.updatedAt=now();
    try{persist()}catch(e){k.payments=k.payments.filter(x=>x!==p);throw e}
    return p;
  }
  const defaultRef=()=>month();
  function openUnified(cid=null,kid=null,ref=null,opts={}){
    const selectable=(state.clients||[]).filter(cl=>(cl.contracts||[]).some(k=>k.active!==false));
    if(!selectable.length){alert('Cadastre um cliente e um empréstimo antes de registrar pagamentos.');return}
    let cl=findCl(cid)||selectable[0],k=(cl.contracts||[]).find(x=>String(x.id)===String(kid))||cl.contracts?.find(x=>x.active!==false)||cl.contracts?.[0];
    if(!k)return;
    const chosenRef=refOK(ref)?ref:defaultRef();
    function renderForm(){
      const data=charge(cl.id,k.id,chosenRef);
      const loanList=(cl.contracts||[]).filter(x=>x.active!==false||x.id===k.id);
      const scheduled=Math.max(0,data?.amount||0),remaining=data?.balance??0;
      openModal(`<h2>Recebimento e comprovante</h2>
        <div class="field"><label>Cliente</label><select id="v27Client">${selectable.map(c=>`<option value="${safe(c.id)}" ${c.id===cl.id?'selected':''}>${safe(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Empréstimo</label><select id="v27Loan">${loanList.map(loan=>`<option value="${safe(loan.id)}" ${loan.id===k.id?'selected':''}>${safe(loan.loanCode||loan.title||'Empréstimo')} • ${safe(loan.startDate||'')}</option>`).join('')}</select></div>
        <div class="field"><label>Mês de referência (competência)</label><input id="v27Ref" type="month" value="${safe(chosenRef)}"></div>
        <div class="card"><div class="muted">Previsto: ${fmt(scheduled)} • Recebido: ${fmt(data?.paid||0)}</div><strong>${fmt(remaining)} pendente</strong></div>
        <div class="field"><label>Valor efetivamente recebido (R$)</label><input type="number" id="v27Amount" min="0.01" step="0.01" value="${remaining>0?remaining.toFixed(2):''}" placeholder="0,00"></div>
        <div class="field"><label>Data de recebimento</label><input type="date" id="v27Date" value="${today()}"></div>
        <div class="field"><label>Forma de pagamento</label><select id="v27Method"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></div>
        <div class="field"><label>Observação</label><textarea id="v27Note" placeholder="Ex.: comprovante recebido e conferido"></textarea></div>
        <div class="actions"><button type="button" class="primary-btn" id="v27Confirm">Confirmar recebimento e preparar comprovante</button><button type="button" class="soft-btn" id="v27History">Comprovantes já registrados</button></div>
        <div class="rule-note">A baixa ocorre após confirmar o dinheiro efetivamente recebido. Resumos de contrato e mensagens de cobrança nunca dão baixa. O WhatsApp abre com o comprovante pronto, mas o envio da mensagem depende de você.</div>`,()=>{
        document.getElementById('v27Client').onchange=e=>{cl=findCl(e.target.value);k=cl?.contracts?.find(x=>x.active!==false)||cl?.contracts?.[0];if(k)openUnified(cl.id,k.id,document.getElementById('v27Ref')?.value||chosenRef)};
        document.getElementById('v27Loan').onchange=e=>openUnified(cl.id,e.target.value,document.getElementById('v27Ref')?.value||chosenRef);
        document.getElementById('v27Ref').onchange=e=>openUnified(cl.id,k.id,e.target.value);
        document.getElementById('v27History').onclick=()=>openHistory(cl.id,k.id);
        let saving=false;
        document.getElementById('v27Confirm').onclick=()=>{
          if(saving)return;
          const r=document.getElementById('v27Ref').value,amount=Number(document.getElementById('v27Amount').value),
            date=document.getElementById('v27Date').value,method=document.getElementById('v27Method').value,
            note=document.getElementById('v27Note').value.trim();
          const data=charge(cl.id,k.id,r);
          if(!data||data.notDue){alert('Selecione uma competência válida já existente.');return}
          if(!Number.isFinite(amount)||amount<=0){alert('Informe o valor efetivamente recebido.');return}
          // Admite multa ou pagamento excedente, mas solicita confirmação explícita.
          if(amount>data.balance+0.009&&!confirm(`O valor ${fmt(amount)} supera o saldo ${fmt(data.balance)} da competência. Confirmar mesmo assim?`))return;
          if(data.balance<=0&&!confirm('Esta competência já consta como paga. Registrar um novo recebimento mesmo assim?'))return;
          saving=true;
          let p;
          try{p=register({clientId:cl.id,contractId:k.id,reference:r,amount,paidAt:date,method,note})}
          catch(e){saving=false;alert(`Não foi possível registrar a baixa: ${e.message}`);return}
          closeModal();refresh();whatsapp(cl,receiptText({cl,k},p));
        };
      });
    }
    renderForm();
  }
  function openHistory(cid,kid){
    const cl=findCl(cid),k=findLoan(cid,kid);if(!cl||!k)return;
    const list=(k.payments||[]).filter(validPayment).slice().sort((a,b)=>String(b.paidAt||'').localeCompare(String(a.paidAt||'')));
    openModal(`<h2>Comprovantes registrados</h2><div class="muted">${safe(cl.name)} • ${safe(k.loanCode||k.title||'Empréstimo')}</div>
      <div class="list">${list.length?list.map(p=>`<div class="list-item"><div class="row space"><div><b>${fmt(p.amount)}</b><div class="muted">${safe(paymentRef(p)||'Sem referência')} • ${safe(p.paidAt||'Sem data')}</div></div><div class="inline-actions"><button type="button" class="small-btn v27SendOld" data-p="${safe(p.id)}">Reenviar</button><button type="button" class="small-btn v27CorrectOld" data-p="${safe(p.id)}">Corrigir mês</button></div></div></div>`).join(''):'<div class="empty card">Nenhum recebimento registrado neste contrato.</div>'}</div>
      <div class="actions"><button type="button" class="primary-btn" id="v27NewFromHistory">+ Registrar recebimento antigo</button></div>
      <div class="rule-note">Reenviar comprovante não duplica o recebimento. Para comprovante antigo sem lançamento, cadastre o pagamento somente depois de conferir o recebimento.</div>`,()=>{
        document.querySelectorAll('.v27SendOld').forEach(b=>b.onclick=()=>sendExisting(cid,kid,b.dataset.p));
        document.querySelectorAll('.v27CorrectOld').forEach(b=>b.onclick=()=>editReference(cid,kid,b.dataset.p));
        document.getElementById('v27NewFromHistory').onclick=()=>openUnified(cid,kid);
      });
  }
  function editReference(cid,kid,pid){
    const cl=findCl(cid),k=findLoan(cid,kid),p=k?.payments?.find(x=>String(x.id)===String(pid));if(!cl||!p)return;
    openModal(`<h2>Conciliar comprovante anterior</h2><div class="card"><strong>${fmt(p.amount)}</strong><div class="muted">${safe(cl.name)} • recebido em ${safe(p.paidAt||'—')}</div></div>
      <div class="field"><label>Mês de competência correto</label><input type="month" id="v27CorrectRef" value="${safe(refOK(paymentRef(p))?paymentRef(p):month())}"></div>
      <div class="actions"><button type="button" class="primary-btn" id="v27SaveRef">Confirmar correção sem duplicar pagamento</button></div>
      <div class="rule-note">Esta operação altera somente a competência do registro já existente. Confira o comprovante original antes de corrigir.</div>`,()=>{
        document.getElementById('v27SaveRef').onclick=()=>{
          const ref=document.getElementById('v27CorrectRef').value;
          if(!refOK(ref)){alert('Informe uma competência válida.');return}
          const old=p.reference;p.reference=ref;p.updatedAt=now();
          try{persist()}catch(e){p.reference=old;alert(`Não foi possível salvar: ${e.message}`);return}
          closeModal();refresh();openHistory(cid,kid);
        };
      });
  }
  function openAudit(){
    const loans=(state.clients||[]).flatMap(cl=>(cl.contracts||[]).map(k=>({cl,k}))).filter(x=>x.k.payments?.length);
    const recent=loans.flatMap(({cl,k})=>(k.payments||[]).filter(validPayment).map(p=>({cl,k,p})))
      .sort((a,b)=>String(b.p.paidAt||'').localeCompare(String(a.p.paidAt||''))).slice(0,80);
    openModal(`<h2>Conciliação de comprovantes anteriores</h2>
      <div class="rule-note">Os comprovantes enviados em conversas antigas do WhatsApp não podem ser detectados automaticamente. Registros financeiros existentes são aproveitados sem gerar outra receita. Se não houver registro, confirme o pagamento antes de dar baixa.</div>
      <div class="list">${recent.length?recent.map(({cl,k,p})=>`<div class="list-item"><div class="row space"><div><b>${safe(cl.name)}</b><div class="muted">${safe(k.loanCode||k.title||'Empréstimo')} • ${fmt(p.amount)} • ${safe(paymentRef(p)||'sem ref.')} • ${safe(p.paidAt||'')}</div></div><button type="button" class="small-btn v27AuditGo" data-c="${safe(cl.id)}" data-k="${safe(k.id)}" data-p="${safe(p.id)}">Conferir</button></div></div>`).join(''):'<div class="empty card">Sem registros históricos de pagamentos.</div>'}</div>
      <div class="actions"><button type="button" id="v27AuditNew" class="primary-btn">+ Dar baixa em comprovante antigo conferido</button></div>`,()=>{
        document.querySelectorAll('.v27AuditGo').forEach(b=>b.onclick=()=>editReference(b.dataset.c,b.dataset.k,b.dataset.p));
        document.getElementById('v27AuditNew').onclick=()=>openUnified();
      });
  }
  // Ação única sempre visível: funciona no Dashboard, Clientes, Empréstimos, Cobranças, CRM e Configurações.
  function installGlobalButton(){
    const bar=document.querySelector('.topbar-actions');if(!bar||document.getElementById('v27ReceiptQuick'))return;
    const b=document.createElement('button');b.id='v27ReceiptQuick';b.type='button';b.className='small-btn';b.textContent='Receber / Comprovante';
    b.style.cssText='font-size:11px;padding:9px 7px;white-space:normal;line-height:1.15';b.onclick=()=>openUnified();
    bar.prepend(b);
  }
  function decorateLoans(){
    const view=document.getElementById('view');if(!view)return;
    view.querySelectorAll('.loan-card').forEach(card=>{
      const el=card.querySelector('.edit-loan2');if(!el||card.querySelector('.v27LoanPay'))return;
      const row=el.closest('.inline-actions')||el.parentElement;if(!row)return;
      const b=document.createElement('button');b.type='button';b.className='small-btn v27LoanPay';b.textContent='Receber / Comprovante';
      b.onclick=()=>openUnified(el.dataset.client,el.dataset.loan);row.appendChild(b);
    });
    view.querySelectorAll('.v7-receipt').forEach(b=>{if(/enviar comprovante/i.test(b.textContent))b.textContent='Enviar resumo do empréstimo'});
  }
  function decorateClient(){
    document.querySelectorAll('#modalContent .contract-card').forEach(card=>{
      const edit=card.querySelector('.edit-contract');if(!edit||card.querySelector('.v27ClientPay'))return;
      const c=card.querySelector('.v7-receipt');if(c&&/enviar comprovante/i.test(c.textContent))c.textContent='Enviar resumo do empréstimo';
      const b=document.createElement('button');b.type='button';b.className='small-btn v27ClientPay';b.textContent='Receber / Comprovante';
      b.onclick=()=>openUnified(card.dataset.client||currentClientIdV27||'',edit.dataset.id);
      (edit.closest('.inline-actions')||edit.parentElement).appendChild(b);
    });
  }
  let currentClientIdV27=null;
  function decorateCharges(){
    const root=document.getElementById('view');if(!root||document.getElementById('v27AuditButton'))return;
    const container=document.createElement('div');container.className='actions';container.style.margin='8px 0 12px';
    container.innerHTML='<button type="button" class="small-btn" id="v27AuditButton">Conferir comprovantes antigos</button>';
    container.querySelector('button').onclick=openAudit;
    root.insertBefore(container,root.children[1]||null);
  }
  if(typeof renderLoans2==='function'){
    const base=renderLoans2;renderLoans2=function(){const out=base();decorateLoans();return out};
  }
  if(typeof renderCharges==='function'){
    const base=renderCharges;renderCharges=function(){const out=base();decorateCharges();return out};
  }
  if(typeof openClientDetail==='function'){
    const base=openClientDetail;openClientDetail=function(id){currentClientIdV27=id;const out=base(id);decorateClient();return out};
  }
  if(typeof openContractModal==='function'){
    const base=openContractModal;openContractModal=function(cid,kid){const out=base(cid,kid);
      const place=document.querySelector('#modalContent .actions');if(kid&&place&&!document.getElementById('v27ContractPay')){
        const b=document.createElement('button');b.type='button';b.id='v27ContractPay';b.className='small-btn';b.textContent='Receber / Comprovante';b.onclick=()=>openUnified(cid,kid);place.appendChild(b);
      }
      return out;
    };
  }
  // API direta para qualquer módulo abrir o fluxo centralizado.
  window.openPaymentModal=function(cid,kid,ref){openUnified(cid,kid,ref)};
  // Intercepta os botões de baixa legados antes das rotinas antigas substituírem um pagamento parcial.
  document.addEventListener('click',event=>{
    const b=event.target?.closest?.('.v26-pay,.pay-btn,.v21-pay-btn');if(!b)return;
    const cid=b.dataset.c||b.dataset.v21Client,kid=b.dataset.k||b.dataset.v21Loan,ref=b.dataset.r||b.dataset.v21Ref;
    if(!cid||!kid||!refOK(ref))return;
    event.preventDefault();event.stopImmediatePropagation();openUnified(cid,kid,ref);
  },true);
  installGlobalButton();
  window.CrediGestorPaymentsV27={version:VERSION,paid,payments,charge,register,openUnified,openHistory,openAudit,sendExisting};
  try{if(typeof currentView!=='undefined'&&currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
    else if(currentView==='charges'&&typeof renderCharges==='function')renderCharges();}catch(_){ }
})();
