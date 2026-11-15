(function(){
  'use strict';
  const sizes=[[85,'Pequena (85%)'],[100,'Padrão (100%)'],[115,'Grande (115%)'],[130,'Muito grande (130%)'],[150,'Máxima (150%)']];
  function current(){const value=Number(state.settings.fontScale);return sizes.some(s=>s[0]===value)?value:100;}
  function applyFontScale(){
    const value=current(),root=document.documentElement;
    root.style.setProperty('--app-font-scale',String(value/100));
    root.dataset.fontScale=String(value);root.dataset.largeFont=String(value>=130);
  }
  // Existing screens use pixel font sizes. Scale the declarations, not the page geometry.
  function scaleStyle(style){
    const value=style?.getPropertyValue('font-size');
    if(!value||value.includes('--app-font-scale')||!/[\d.]px/.test(value))return;
    const scaled=value.replace(/(\d*\.?\d+)px/g,'calc($1px * var(--app-font-scale, 1))');
    style.setProperty('font-size',scaled,style.getPropertyPriority('font-size'));
  }
  function scaleRules(rules){
    for(const rule of rules){scaleStyle(rule.style);if(rule.cssRules)scaleRules(rule.cssRules);}
  }
  function scaleSheets(){for(const sheet of document.styleSheets){try{scaleRules(sheet.cssRules);}catch(_){/* External fonts may use an unreadable stylesheet. */}}}
  function scaleTree(root){
    if(root.nodeType!==1)return;
    scaleStyle(root.style);
    root.querySelectorAll('[style]').forEach(el=>scaleStyle(el.style));
  }
  const previousApply=applySettings;
  applySettings=function(){const result=previousApply();applyFontScale();return result;};
  applyFontScale();scaleSheets();scaleTree(document.documentElement);
  const observer=new MutationObserver(records=>{
    let sheetsChanged=false;
    for(const record of records){
      if(record.type==='attributes'){scaleStyle(record.target.style);continue;}
      for(const node of record.addedNodes){
        scaleTree(node);
        if(node.nodeName==='STYLE'||node.nodeName==='LINK'||node.parentElement?.nodeName==='STYLE'||node.querySelector?.('style,link[rel="stylesheet"]'))sheetsChanged=true;
      }
    }
    if(sheetsChanged)scaleSheets();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  document.addEventListener('load',event=>{if(event.target.tagName==='LINK')scaleSheets();},true);
  const previousRender=renderSettings;
  renderSettings=function(){
    const result=previousRender(),font=document.getElementById('fontSelect');
    if(!font||document.getElementById('fontSizeSelect'))return result;
    const section=document.createElement('div');section.className='field';
    section.innerHTML='<label for="fontSizeSelect">Tamanho das fontes</label><select id="fontSizeSelect">'+sizes.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select><p id="fontSizePreview" class="readability-preview">Prévia: Cliente — R$ 1.250,00</p><small id="fontSizeStatus" class="muted" role="status">O tamanho é aplicado aos textos, campos e botões e salvo para sua conta neste aparelho.</small>';
    font.closest('.field').after(section);
    const select=section.querySelector('select');select.value=String(current());
    select.onchange=()=>{
      const previous=state.settings.fontScale;state.settings.fontScale=Number(select.value);
      try{saveState();section.querySelector('#fontSizeStatus').textContent='Tamanho das fontes salvo.';}
      catch(_){state.settings.fontScale=previous;applyFontScale();select.value=String(current());section.querySelector('#fontSizeStatus').textContent='Não foi possível salvar. Tente novamente.';}
    };
    scaleTree(section);return result;
  };
})();
