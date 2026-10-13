(function(){
  'use strict';
  const topbar=document.querySelector('.topbar'),heading=topbar.firstElementChild;
  const group=document.createElement('div');group.style.cssText='display:flex;align-items:center;gap:10px;min-width:0';
  const button=document.createElement('button');button.type='button';button.id='dashboardBack';button.className='icon-btn dashboard-back';button.title='Voltar ao Dashboard';button.setAttribute('aria-label','Voltar ao Dashboard');button.innerHTML='<span aria-hidden="true">←</span>';
  const style=document.createElement('style');style.textContent='.dashboard-back{flex-shrink:0;font-size:26px;min-width:44px;min-height:44px}.dashboard-back[hidden]{display:none}';document.head.append(style);
  topbar.prepend(group);group.append(button,heading);
  button.onclick=()=>{currentView='dashboard';syncNav();render();window.scrollTo({top:0,behavior:'smooth'})};
  const base=render;render=function(){const out=base();button.hidden=currentView==='dashboard';return out};
  button.hidden=currentView==='dashboard';
})();
