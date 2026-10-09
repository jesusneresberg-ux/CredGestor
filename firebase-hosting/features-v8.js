// CrediGestor v8 — correção do foco das buscas, edição rápida de clientes
// e abertura automática do comprovante no WhatsApp após criar um contrato.

(function(){
  'use strict';

  const style=document.createElement('style');
  style.textContent=`
    .client-actions-v8{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .client-actions-v8 .small-btn{white-space:nowrap}
  `;
  document.head.appendChild(style);

  function normalizeTextV8(value=''){
    const s=String(value??'');
    if(typeof norm2==='function')return norm2(s);
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }

  // -------- Busca sem perder o cursor --------
  // As versões anteriores redesenhavam toda a aba a cada tecla digitada.
  // Isso recriava o <input> e fazia o foco/cursor desaparecer no celular.
  function clientSearchTextV8(c){
    let address='';
    try{address=typeof fullAddress2==='function'?fullAddress2(c):(c.address||'')}catch(_){address=c.address||''}
    return normalizeTextV8([c.name,c.cpf,c.phone,c.email,address,c.level].filter(Boolean).join(' '));
  }
  function filterClientCardsV8(){
    const input=document.getElementById('clientSearch');if(!input)return;
    const q=normalizeTextV8(input.value);let shown=0;
    document.querySelectorAll('.client-open').forEach(card=>{
      const c=(state.clients||[]).find(x=>x.id===card.dataset.id);
      const visible=!q||(c&&clientSearchTextV8(c).includes(q));
      card.hidden=!visible;if(visible)shown++;
    });
    const title=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Clientes');
    const small=title?.closest('.section-title')?.querySelector('small');if(small)small.textContent=`${shown} encontrado(s)`;
  }
  function bindClientSearchV8(){
    const input=document.getElementById('clientSearch');if(!input)return;
    input.value=clientSearch||'';
    input.oninput=e=>{clientSearch=e.target.value;filterClientCardsV8()};
    filterClientCardsV8();
  }

  function loanSearchTextV8(cl,k){
    return normalizeTextV8([cl?.name,cl?.cpf,cl?.phone,k?.title,k?.interestRate,k?.fixedAmount,k?.baseDueDay,k?.loanCode,k?.modality].filter(v=>v!==undefined&&v!==null&&v!=='').join(' '));
  }
  function filterLoanCardsV8(){
    const input=document.getElementById('loanSearch2');if(!input)return;
    const q=normalizeTextV8(input.value);let shown=0;
    document.querySelectorAll('.loan-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2');
      const cl=(state.clients||[]).find(x=>x.id===ref?.dataset.client);
      const k=(cl?.contracts||[]).find(x=>x.id===ref?.dataset.loan);
      const visible=!q||(cl&&k&&loanSearchTextV8(cl,k).includes(q));
      card.hidden=!visible;if(visible)shown++;
    });
    const title=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Empréstimos');
    const small=title?.closest('.section-title')?.querySelector('small');if(small)small.textContent=`${shown} registro(s)`;
  }
  function bindLoanSearchV8(){
    const input=document.getElementById('loanSearch2');if(!input)return;
    input.value=loanSearch2||'';
    input.oninput=e=>{loanSearch2=e.target.value;filterLoanCardsV8()};
    filterLoanCardsV8();
  }

  // Renderizamos a lista completa da aba e filtramos os cartões em memória.
  // Assim, apagar caracteres também volta a mostrar itens sem recriar o campo de busca.
  const renderClientsBeforeV8=renderClients;
  renderClients=function(){
    const query=clientSearch||'';
    clientSearch='';
    renderClientsBeforeV8();
    clientSearch=query;
    bindClientSearchV8();
    injectClientEditButtonsV8();
  };

  if(typeof renderLoans2==='function'){
    const renderLoansBeforeV8=renderLoans2;
    renderLoans2=function(){
      const query=loanSearch2||'';
      loanSearch2='';
      renderLoansBeforeV8();
      loanSearch2=query;
      bindLoanSearchV8();
    };
  }

  // -------- Editar cliente diretamente na aba Clientes --------
  function injectClientEditButtonsV8(){
    document.querySelectorAll('.client-open').forEach(card=>{
      const id=card.dataset.id;if(!id)return;
      let row=card.querySelector('.client-actions-v5');
      if(!row){row=document.createElement('div');row.className='client-actions-v5';card.appendChild(row)}
      row.classList.add('client-actions-v8');
      if(!row.querySelector('.edit-client-card-v8')){
        const b=document.createElement('button');
        b.type='button';b.className='small-btn edit-client-card-v8';b.textContent='✏️ Editar cliente';
        b.onclick=e=>{e.preventDefault();e.stopPropagation();openClientModal(id)};
        // Edição fica primeiro para ser encontrada rapidamente.
        row.insertBefore(b,row.firstChild);
      }
      row.onclick=e=>e.stopPropagation();
    });
  }

  // -------- Comprovante automático após NOVO contrato --------
  const openContractModalBeforeV8=openContractModal;
  openContractModal=function(clientId,contractId){
    const cl=(state.clients||[]).find(x=>x.id===clientId);
    const beforeIds=new Set((cl?.contracts||[]).map(x=>x.id));
    openContractModalBeforeV8(clientId,contractId);

    // Em edição o comprovante continua disponível manualmente; automatizamos apenas a criação.
    if(contractId)return;
    const saveBtn=document.getElementById('saveContractBtn');if(!saveBtn)return;
    const saveBeforeV8=saveBtn.onclick;
    saveBtn.onclick=()=>{
      saveBeforeV8?.();
      const c2=(state.clients||[]).find(x=>x.id===clientId);if(!c2)return;
      let created=(c2.contracts||[]).find(x=>!beforeIds.has(x.id));
      if(!created)return;
      // Abre o WhatsApp automaticamente com o comprovante pronto para o cliente.
      // O toque final em "Enviar" continua sendo feito no WhatsApp.
      if(typeof openLoanReceiptV7==='function'){
        setTimeout(()=>openLoanReceiptV7(clientId,created.id),0);
      }
    };
  };

  // Atualiza imediatamente a aba que estiver aberta.
  if(currentView==='clients')renderClients();
  else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
})();
