// CrediGestor v23 — regra de 30 dias para o primeiro pagamento, comprovantes com emojis e sem data de término.
(function(){
  'use strict';
  const VERSION='23.0';
  function sanitizeContractsV23(){
    (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>{if(Object.prototype.hasOwnProperty.call(k,'endDate'))delete k.endDate}));
    if(typeof CSV_HEADERS3!=='undefined'&&Array.isArray(CSV_HEADERS3)){
      let i;while((i=CSV_HEADERS3.indexOf('data_termino'))>=0)CSV_HEADERS3.splice(i,1);
    }
  }
  sanitizeContractsV23();
  if(typeof saveState==='function'){
    const baseSaveV23=saveState;
    saveState=function(){sanitizeContractsV23();return baseSaveV23()};
  }
  if(typeof csvRows3==='function'){
    const baseRowsV23=csvRows3;
    csvRows3=function(){return baseRowsV23().map(r=>{if(r&&typeof r==='object')delete r.data_termino;return r})};
  }
  // Todos os comprovantes ativos usam marcadores visuais/emoji; mantém compatibilidade com módulos antigos.
  window.__credigestorV23={version:VERSION,firstPaymentDays:30,noContractEndDate:true,emojiReceipts:true};
  if(!window.CREDIGESTOR_MULTITENANT){try{saveState()}catch(_){ }}
})();
