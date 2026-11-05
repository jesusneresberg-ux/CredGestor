// CrediGestor v30 — Unifica botões Editar e Editar Data em um único botão na aba Empréstimos.
(function(){
  'use strict';

  const VERSION='30.0';

  // Remove botões duplicados de "Editar data" e mantém apenas o botão "Editar" original.
  function unifyEditButtons(root){
    if(!root) return;
    root.querySelectorAll('.edit-contract-date').forEach(btn=>{
      btn.remove();
    });
    // Garante que o botão Editar abra o modal completo (que já inclui campo de data).
    root.querySelectorAll('.edit-loan2, .edit-contract').forEach(btn=>{
      if(btn.dataset.v30Unified) return;
      btn.dataset.v30Unified='1';
      btn.textContent='Editar';
    });
  }

  // Intercepta renderLoans2 para limpar botões duplicados após cada renderização.
  if(typeof renderLoans2==='function'){
    const baseRenderLoans2=renderLoans2;
    renderLoans2=function(){
      const out=baseRenderLoans2();
      unifyEditButtons(document.getElementById('view'));
      return out;
    };
  }

  // Intercepta openClientDetail para limpar botões duplicados no modal de detalhes do cliente.
  if(typeof openClientDetail==='function'){
    const baseOpenClientDetail=openClientDetail;
    openClientDetail=function(id){
      const out=baseOpenClientDetail(id);
      setTimeout(()=>unifyEditButtons(document.getElementById('modalContent')),50);
      return out;
    };
  }

  // Aplica imediatamente se estiver na aba empréstimos.
  if(typeof currentView!=='undefined' && currentView==='loans' && typeof renderLoans2==='function'){
    renderLoans2();
  }

  window.__credigestorV30={version:VERSION,unifiedEditButton:true};
})();