(function(){
  'use strict';
  const colors=[['blue','Azul','#2563eb'],['green','Verde','#059669'],['purple','Roxo','#7c3aed'],['red','Vermelho','#dc2626'],['orange','Laranja','#ea580c'],['gold','Dourado','#a16207'],['cyan','Ciano','#0891b2'],['slate','Grafite','#334155']];
  const cap=window.Capacitor;
  // Capacitor injects native plugin proxies directly in APK pages without a JS bundle.
  let plugin=null;
  if(cap?.isNativePlatform?.()){
    plugin=cap.Plugins?.CrediAppIcon||null;
    if(!plugin&&typeof cap.registerPlugin==='function'&&cap.isPluginAvailable?.('CrediAppIcon'))plugin=cap.registerPlugin('CrediAppIcon');
  }
  const previous=renderSettings;
  renderSettings=function(){
    previous();
    const anchor=document.getElementById('logoAppearance');
    if(!anchor||document.getElementById('appIconAppearance'))return;
    const section=document.createElement('section');section.id='appIconAppearance';section.className='field';
    section.innerHTML='<label for="appIconColor">Ícone do aplicativo</label><p class="muted">Escolha uma das oito cores para o ícone da tela inicial e a logomarca do app.</p><div class="logo-color-controls"><svg id="appIconPreview" class="credigestor-logo" viewBox="0 0 64 64" role="img" aria-label="Prévia do ícone"><rect width="64" height="64" rx="18" fill="currentColor"/><path d="M44 19a20 20 0 1 0 0 26v-9a12 12 0 1 1 0-8Z" fill="#fff"/></svg><select id="appIconColor" aria-label="Cor do ícone">'+colors.map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('')+'</select><button type="button" id="applyAppIcon" class="soft-btn">Aplicar ao ícone e à logomarca</button></div><p id="appIconStatus" class="muted" role="status"></p>';
    anchor.after(section);
    const select=section.querySelector('select'),button=section.querySelector('button'),status=section.querySelector('#appIconStatus'),preview=section.querySelector('svg');
    function paint(){preview.style.color=colors.find(c=>c[0]===select.value)[2];}
    select.onchange=paint;paint();
    if(!plugin){select.disabled=true;button.disabled=true;status.textContent='Disponível no APK Android atualizado. A cor livre da logomarca continua disponível acima.';return;}
    button.disabled=true;status.textContent='Consultando o ícone deste aparelho…';
    plugin.getIcon().then(result=>{
      if(!section.isConnected)return;
      if(colors.some(c=>c[0]===result.color))select.value=result.color;
      paint();button.disabled=false;status.textContent='A escolha vale para este aparelho. O Android pode levar alguns segundos para mostrar a mudança.';
    }).catch(()=>{if(section.isConnected){status.textContent='Não foi possível consultar o ícone. Escolha uma cor para tentar atualizar.';button.disabled=false;}});
    button.onclick=async()=>{
      if(button.disabled)return;
      const selected=colors.find(c=>c[0]===select.value);
      button.disabled=true;select.disabled=true;status.textContent='Atualizando o ícone…';
      try{
        const result=await plugin.setIcon({color:selected[0]});
        if(result.color!==selected[0])throw Error('Ícone não confirmado.');
        const previousColor=state.settings.logoColor;
        state.settings.logoColor=selected[2];
        try{saveState();}
        catch(_){state.settings.logoColor=previousColor;applySettings();status.textContent='Ícone atualizado. Não foi possível salvar a cor da logomarca; tente novamente.';return;}
        if(section.isConnected){
          const input=document.getElementById('logoColorInput');if(input)input.value=selected[2];
          const code=document.getElementById('logoColorCode');if(code)code.textContent=selected[2].toUpperCase();
          const note=document.getElementById('logoColorStatus');if(note)note.textContent='Cor personalizada.';
          status.textContent='Ícone e logomarca atualizados. Aguarde alguns segundos para o Android exibir a mudança.';
        }
      }catch(_){status.textContent='Não foi possível alterar o ícone. Tente novamente.';}
      finally{button.disabled=false;select.disabled=false;}
    };
  };
})();

