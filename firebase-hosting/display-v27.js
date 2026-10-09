(function(){
  const button=document.createElement('button');
  button.type='button';button.className='icon-btn';button.id='fullscreenBtn';
  document.querySelector('.topbar-actions').prepend(button);
  function update(){const active=!!document.fullscreenElement||document.documentElement.classList.contains('expanded-v27');button.textContent=active?'⤢ Sair':'⛶ Tela cheia';button.title=active?'Sair da tela cheia':'Ativar tela cheia';button.setAttribute('aria-pressed',String(active));}
  button.onclick=async()=>{
    const root=document.documentElement;
    if(document.fullscreenElement){await document.exitFullscreen();root.classList.remove('expanded-v27');}
    else if(root.classList.contains('expanded-v27'))root.classList.remove('expanded-v27');
    else {root.classList.add('expanded-v27');if(root.requestFullscreen){try{await root.requestFullscreen();}catch(_){/* Expanded layout remains available. */}}}
    update();
  };
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.documentElement.classList.remove('expanded-v27');update();});update();
})();
