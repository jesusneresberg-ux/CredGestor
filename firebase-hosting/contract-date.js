(function(){
  function editDate(clientId,contractId){
    closeModal();openContractModal(clientId,contractId);
    const input=document.getElementById('kStart');
    if(input){input.focus();input.scrollIntoView({block:'center'});}
  }
  function addButtons(root,clientId){
    if(!root)return;
    root.querySelectorAll('.loan-card,.contract-card').forEach(card=>{
      const edit=card.querySelector('.edit-loan2,.edit-contract');
      const actions=card.querySelector('.inline-actions');
      if(!edit||!actions||card.querySelector('.edit-contract-date'))return;
      const client=clientId||edit.dataset.client;
      const contract=edit.dataset.loan||edit.dataset.id;
      if(!client||!contract)return;
      const button=document.createElement('button');button.type='button';
      button.className='small-btn edit-contract-date';button.textContent='📅 Editar data';
      button.onclick=()=>editDate(client,contract);actions.append(button);
      const renegotiate=document.createElement('button');renegotiate.type='button';renegotiate.className='small-btn';renegotiate.textContent='Renegociar vencimentos';renegotiate.onclick=()=>window.openRenegotiation(client,contract);actions.append(renegotiate);
    });
  }
  const loans=renderLoans2;
  renderLoans2=function(){const out=loans();addButtons(document.getElementById('view'));return out;};
  const detail=openClientDetail;
  openClientDetail=function(id){const out=detail(id);addButtons(document.getElementById('modalContent'),id);return out;};
  const contract=openContractModal;
  openContractModal=function(clientId,contractId){
    const out=contract(clientId,contractId),input=document.getElementById('kStart');
    if(input){input.required=true;const label=input.closest('.field')?.querySelector('label');if(label)label.textContent='Data de início do contrato';}
    return out;
  };
  if(currentView==='loans')renderLoans2();
})();
