/* CrediGestor 28 — lupa para pesquisar clientes na aba Cobranças. */
(function(){
  'use strict';
  const VERSION='28-charge-search';
  let queryV28='';

  function normV28(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}

  function installStyleV28(){
    if(document.getElementById('chargeSearchStyleV28'))return;
    const st=document.createElement('style');st.id='chargeSearchStyleV28';
    st.textContent=`
      .v28-search{display:flex;align-items:center;gap:8px;margin:10px 0 12px;padding:0 12px;border:1px solid var(--line,rgba(16,32,51,.12));border-radius:16px;background:var(--surface-solid,#fff);box-shadow:var(--shadow,none)}
      .v28-search:focus-within{border-color:var(--accent,#2563eb)}
      .v28-search .v28-icon{font-size:18px;line-height:1;opacity:.75}
      .v28-search input{flex:1;min-width:0;width:auto;margin:0;border:0!important;outline:0;box-shadow:none!important;border-radius:0;background:transparent!important;color:var(--text,#102033);padding:13px 0;font-size:16px;-webkit-appearance:none;appearance:none}
      .v28-search input::-webkit-search-cancel-button{display:none}
      .v28-search .v28-clear{border:0;background:transparent;color:var(--muted,#667085);font-size:22px;line-height:1;padding:4px 2px;cursor:pointer}
      .v28-search-info{margin:-4px 2px 10px;font-size:12px;color:var(--muted,#667085)}
    `;
    document.head.appendChild(st);
  }

  function chargeListV28(view){return view.querySelector('#chargeListV27')||view.querySelector('.list')}
  function clientNameV28(item){
    const el=item.querySelector('.v26-client-link,.title');
    return el?el.textContent:'';
  }

  function applyFilterV28(view){
    const list=chargeListV28(view);if(!list)return;
    const items=[...list.querySelectorAll(':scope > .list-item')];
    const q=normV28(queryV28);
    let shown=0;
    items.forEach(item=>{const ok=!q||normV28(clientNameV28(item)).includes(q);item.hidden=!ok;if(ok)shown++});
    const info=view.querySelector('.v28-search-info');
    if(info){
      if(!q)info.textContent='';
      else if(shown)info.textContent=`${shown} de ${items.length} cobrança(s) para “${queryV28.trim()}”`;
      else info.textContent=`Nenhum cliente encontrado para “${queryV28.trim()}” nesta lista. Confira as outras abas.`;
    }
    const clear=view.querySelector('.v28-clear');if(clear)clear.hidden=!queryV28;
  }

  function decorateChargesV28(){
    const view=document.getElementById('view');if(!view)return;
    const list=chargeListV28(view);if(!list||view.querySelector('.v28-search'))return;
    installStyleV28();
    const bar=document.createElement('label');bar.className='v28-search';
    bar.innerHTML='<span class="v28-icon" aria-hidden="true">🔍</span><input type="search" id="chargeSearchV28" placeholder="Pesquisar cliente" autocomplete="off" enterkeyhint="search" aria-label="Pesquisar cliente nas cobranças"><button type="button" class="v28-clear" aria-label="Limpar pesquisa" hidden>×</button>';
    const info=document.createElement('div');info.className='v28-search-info';info.setAttribute('aria-live','polite');
    list.before(bar,info);
    const input=bar.querySelector('input');input.value=queryV28;
    input.addEventListener('input',()=>{queryV28=input.value;applyFilterV28(view)});
    bar.querySelector('.v28-clear').onclick=e=>{e.preventDefault();queryV28='';input.value='';applyFilterV28(view);input.focus()};
    // "Mostrar mais" (versão Firebase) acrescenta itens depois do filtro.
    new MutationObserver(()=>applyFilterV28(view)).observe(list,{childList:true});
    applyFilterV28(view);
  }

  if(typeof renderCharges==='function'){
    const base=renderCharges;
    renderCharges=function(){const out=base.apply(this,arguments);decorateChargesV28();return out};
  }

  window.CrediGestorChargeSearchV28={version:VERSION,setQuery(q){queryV28=String(q||'');const v=document.getElementById('view');const i=v?.querySelector('#chargeSearchV28');if(i)i.value=queryV28;if(v)applyFilterV28(v)}};
  try{if(typeof currentView!=='undefined'&&currentView==='charges')decorateChargesV28()}catch(_){ }
})();
