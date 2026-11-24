// Aviso: esta cópia (GitHub Pages) é a versão antiga. O app oficial fica no Firebase.
(function(){
  'use strict';
  if(sessionStorage.getItem('credigestor_legacy_notice_closed'))return;
  const bar=document.createElement('div');bar.id='legacyNotice';bar.setAttribute('role','note');
  bar.style.cssText='position:sticky;top:0;z-index:50;background:#fef3c7;color:#78350f;padding:8px 12px;font-size:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  bar.innerHTML='<span style="flex:1;min-width:200px">Versão antiga do CrediGestor. O app oficial (com login e cópia na nuvem) está em <a href="https://credigestor-testes.web.app/" style="color:inherit;font-weight:600">credigestor-testes.web.app</a>. Os dados salvos neste navegador continuam aqui; exporte um backup em Config. antes de migrar.</span><button type="button" aria-label="Fechar aviso" style="border:0;background:transparent;font-size:18px;cursor:pointer;color:inherit">×</button>';
  bar.querySelector('button').onclick=()=>{sessionStorage.setItem('credigestor_legacy_notice_closed','1');bar.remove()};
  document.body.prepend(bar);
})();
