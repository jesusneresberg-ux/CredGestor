(function(){
  'use strict';
  document.getElementById('v261Boot')?.remove();
  const cloud=window.CrediGestorCloud,config=window.CREDIGESTOR_FIREBASE_CONFIG||{};
  const roles={administrador:'Administrador',gerente:'Gerente',cobrador:'Cobrador',consulta:'Consulta'};
  const configured=['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k]&&!/COLE_AQUI/.test(config[k]));
  window.CREDIGESTOR_FIREBASE_READY=configured;
  let auth=null,authGeneration=0,signingOut=false;
  const overlay=document.createElement('div');overlay.id='v26Auth';overlay.className='v26-auth-overlay';document.body.append(overlay);
  const banner=document.createElement('div');banner.className='v26-banner';banner.hidden=true;document.body.prepend(banner);
  const account=document.createElement('dialog');account.id='v26Account';document.body.append(account);
  function showLogin(message='',error=false){
    overlay.hidden=false;overlay.style.display='grid';
    overlay.innerHTML=`<section class="v26-auth-card"><h2>CrediGestor 26.1</h2><p>Entre para acessar somente os dados da sua organização.</p><div class="v26-auth-status ${error?'error':''}" role="status">${esc(message||'Seus dados antigos não serão importados sem sua confirmação.')}</div>${configured?'<button id="v26Google" type="button">Entrar com Google</button>':'<p>Falta configurar o Firebase. Esta tela não acessa nem altera a carteira antiga.</p>'}</section>`;
    document.getElementById('v26Google')?.addEventListener('click',async()=>{
      if(!auth){showLogin('A conexão não foi iniciada. Confira a internet e recarregue.',true);return;}
      const b=document.getElementById('v26Google');b.disabled=true;
      try{const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await auth.signInWithPopup(provider);}
      catch(e){showLogin(friendly(e),true);}
    });
  }
  function friendly(e){
    const messages={'auth/popup-blocked':'Permita a janela de login e tente novamente.','auth/popup-closed-by-user':'O login foi fechado. Tente novamente.','auth/unauthorized-domain':'Este endereço precisa ser autorizado no Firebase Authentication.','auth/operation-not-allowed':'Ative o provedor Google no Firebase Authentication.','permission-denied':'Acesso negado. Confira as regras e o seu perfil com o administrador.','unavailable':'Sem conexão com o Firebase. Nenhuma gravação foi confirmada.'};
    return messages[e?.code]||e?.message||'Não foi possível concluir a operação.';
  }
  function paint(s=cloud.session()){
    const unlocked=s.connected;
    document.body.dataset.v26Locked=String(!unlocked);document.body.dataset.v26Role=s.role;
    document.getElementById('app').inert=!unlocked||s.status!=='ready';
    document.getElementById('modal').inert=!unlocked||s.status!=='ready';
    if(['conflict','error'].includes(s.status))document.getElementById('modal').close();
    banner.hidden=!unlocked;banner.style.display=unlocked?'flex':'none';banner.dataset.status=s.status;
    const status={ready:'Conectado',saving:'Aguardando confirmação da nuvem — não feche esta página',conflict:'Alteração de outra sessão: seu rascunho foi preservado',error:'A gravação não foi confirmada. Abra Minha conta.'};
    banner.innerHTML=`<span>${esc(s.organizationName)} · ${esc(roles[s.role]||'')} · ${esc(status[s.status]||'Conectando…')}${s.hasDraft&&s.status==='ready'?' · Há um rascunho para recuperar':''}</span><button type="button">Minha conta</button>`;
    banner.querySelector('button').onclick=openAccount;
    if(s.receiptWarnings)banner.querySelector('span').append(document.createTextNode(` · ${s.receiptWarnings} recebimento(s) divergente(s): confira Minha conta`));
    if(unlocked){overlay.hidden=true;overlay.style.display='none';}
    else {account.close();showLogin(s.error||'Entre com sua Conta Google.',!!s.error);if(s.status==='connecting')showLogin('Conectando à sua organização…');}
  }
  function message(text,error=false){const el=account.querySelector('#v26Message');if(el){el.textContent=text;el.style.color=error?'#991b1b':'#166534';}}
  async function task(fn,success){try{await fn();message(success||'Concluído.');}catch(e){message(friendly(e),true);}}
  function openAccount(){
    const s=cloud.session();if(!s.connected)return;
    account.innerHTML=`<div class="v26-actions"><button id="v26Close">Fechar</button><button id="v26Logout">Sair da conta</button></div><h2>Minha conta</h2><p>${esc(s.user.email)}<br>${esc(s.organizationName)}<br>${esc(roles[s.role])}</p><p id="v26Message" class="v26-message" role="status">${esc(s.error||'')}</p><div class="v26-actions"><button id="v26Reload">Carregar versão da nuvem</button>${s.hasDraft?'<button id="v26Draft">Baixar rascunho preservado</button>':''}</div>${['administrador','gerente','cobrador'].includes(s.role)?'<section class="v26-section"><h3>Recebimento</h3><p>Registre uma parcela. Correções e quitação total ficam com o gerente ou administrador.</p><button id="v26Receipt">Registrar parcela</button><div id="v26ReceiptForm"></div></section>':''}${s.role==='administrador'?'<section class="v26-section"><h3>Equipe</h3><label>E-mail Google do convidado<input id="v26InviteEmail" type="email"></label><label>Perfil<select id="v26InviteRole"><option value="consulta">Consulta</option><option value="cobrador">Cobrador</option><option value="gerente">Gerente</option></select></label><button id="v26Invite">Criar convite</button><p>Válido por 6 dias. O convite é reconhecido no primeiro login; não é enviado e-mail. Uma conta pertence a uma organização nesta versão.</p><button id="v26Members">Ver usuários</button><div id="v26MembersList"></div></section>':''}${s.owner&&s.role==='administrador'?'<section class="v26-section"><h3>Trazer a carteira antiga</h3><p>Somente para uma organização vazia, sem alterações. O original será mantido.</p><button id="v26Legacy">1. Baixar backup deste navegador</button><label>Ou selecione um backup JSON salvo no aparelho original<input id="v26Import" type="file" accept=".json,application/json"></label><div id="v26Migration"></div></section>':''}`;
    if(!account.open)account.showModal();
    if(s.receiptWarnings){const warning=document.createElement('section');warning.className='v26-section';warning.innerHTML='<h3>Recebimentos divergentes</h3><p>Há registros diferentes para a mesma parcela. Os dois foram preservados na nuvem. O total da carteira mantém o registro principal até a revisão do administrador.</p><button>Baixar as duas versões para revisão</button>';warning.querySelector('button').onclick=()=>task(()=>cloud.downloadReceiptWarnings(),'Relatório de divergências disponibilizado. Não o importe sobre a carteira.');account.append(warning);}
    account.querySelector('#v26Close').onclick=()=>account.close();
    account.querySelector('#v26Logout').onclick=async()=>{
      if(cloud.session().status==='saving'){message('Aguarde a confirmação da gravação antes de sair.',true);return;}
      signingOut=true;++authGeneration;cloud.disconnect();
      try{await auth.signOut();}catch(e){showLogin(friendly(e),true);}finally{signingOut=false;}
    };
    account.querySelector('#v26Reload').onclick=()=>{if(confirm('Carregar a versão confirmada na nuvem? Seu rascunho separado será mantido para download.'))task(()=>cloud.reloadCloud(),'Versão da nuvem carregada.');};
    account.querySelector('#v26Draft')?.addEventListener('click',()=>task(()=>cloud.downloadDraft(),'Rascunho disponibilizado para download. Ele não foi enviado à nuvem.'));
    account.querySelector('#v26Receipt')?.addEventListener('click',receiptForm);
    account.querySelector('#v26Invite')?.addEventListener('click',()=>task(()=>cloud.createInvitation(account.querySelector('#v26InviteEmail').value,account.querySelector('#v26InviteRole').value),'Convite criado. Peça ao convidado para entrar com esse e-mail.'));
    account.querySelector('#v26Members')?.addEventListener('click',()=>task(showMembers,''));
    account.querySelector('#v26Legacy')?.addEventListener('click',()=>task(()=>prepareMigration(cloud.legacyBackup()),'Backup disponibilizado. Confira o download antes de confirmar a migração.'));
    account.querySelector('#v26Import')?.addEventListener('change',e=>task(async()=>{
      const file=e.target.files[0];if(!file)return;if(file.size>800000)throw Error('Backup maior que o limite desta versão (800 KB). O original permanece intacto.');
      prepareMigration(await file.text());
    },'Backup selecionado. Mantenha esse arquivo salvo antes de continuar.'));
  }
  function prepareMigration(raw){
    const data=CrediGestorCore.validate(JSON.parse(raw)),s=cloud.session();
    account.querySelector('#v26Migration').innerHTML=`<p>${data.clients.length} clientes para <b>${esc(s.organizationName)}</b> (${esc(s.user.email)}).</p><label><span><input id="v26ConfirmBackup" type="checkbox"> Confirmei o backup salvo e esta é a organização correta.</span></label><button id="v26Migrate">2. Migrar para esta organização</button>`;
    account.querySelector('#v26Migrate').onclick=()=>task(async()=>{
      if(!account.querySelector('#v26ConfirmBackup').checked)throw Error('Confirme o backup e o destino primeiro.');
      if(cloud.session().organizationId!==s.organizationId)throw Error('A conta mudou. Selecione o backup novamente.');
      if(!confirm(`Migrar ${data.clients.length} clientes para ${s.organizationName}?`))return;
      await cloud.migrate(raw,true);account.querySelector('#v26Migration').innerHTML='<p>Migração confirmada na nuvem. O conteúdo antigo foi preservado.</p>';
    },'Operação concluída.');
  }
  async function showMembers(){
    const members=await cloud.listMembers(),s=cloud.session(),target=account.querySelector('#v26MembersList');target.replaceChildren();
    members.forEach(m=>{
      const row=document.createElement('div');row.className='v26-member';
      row.innerHTML=`<span>${esc(m.name)}<br>${esc(m.email)} · ${m.active?'ativo':'desativado'}</span>`;
      if(m.uid!==s.user.uid){
        const sel=document.createElement('select');Object.entries(roles).forEach(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;sel.append(o);});sel.value=m.role;
        const b=document.createElement('button');b.textContent='Salvar perfil';b.onclick=()=>task(()=>cloud.setMember(m.uid,sel.value,m.active),'Perfil atualizado.');
        const toggle=document.createElement('button');toggle.textContent=m.active?'Desativar':'Reativar';toggle.onclick=()=>{if(confirm(`${toggle.textContent} acesso de ${m.email}?`))task(()=>cloud.setMember(m.uid,m.role,!m.active),'Acesso atualizado.');};
        row.append(sel,b,toggle);
      }else row.append(document.createTextNode(' Seu acesso (não alterável aqui)'));
      target.append(row);
    });
  }
  function receiptForm(){
    const target=account.querySelector('#v26ReceiptForm');
    const contracts=[];state.clients.forEach(c=>(c.contracts||[]).filter(k=>k.active!==false&&!k.closed).forEach(k=>contracts.push({c,k})));
    target.innerHTML=`<label>Cliente / contrato<select id="v26Contract">${contracts.map(({c,k},i)=>`<option value="${i}">${esc(c.name)} — ${esc(k.id)}</option>`).join('')}</select></label><label>Mês de referência<input id="v26Reference" type="month" value="${monthRef()}"></label><label>Valor recebido<input id="v26Amount" type="number" min="0.01" step="0.01"></label><label>Data<input id="v26Date" type="date" value="${todayISO()}"></label><label>Forma<select id="v26Method"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></label><label>Observação<input id="v26Note" maxlength="2000"></label><button id="v26Receive">Confirmar recebimento</button>`;
    target.querySelector('#v26Receive').onclick=()=>task(async()=>{
      const item=contracts[Number(target.querySelector('#v26Contract').value)];if(!item)throw Error('Nenhum contrato ativo disponível.');
      const b=target.querySelector('#v26Receive');b.disabled=true;
      try{await cloud.recordReceipt(item.c.id,item.k.id,{reference:target.querySelector('#v26Reference').value,amount:Number(target.querySelector('#v26Amount').value),paidAt:target.querySelector('#v26Date').value,method:target.querySelector('#v26Method').value,note:target.querySelector('#v26Note').value});target.replaceChildren();}finally{b.disabled=false;}
    },'Recebimento confirmado na nuvem.');
  }
  document.getElementById('accountQuickBtn').onclick=openAccount;
  window.addEventListener('credigestor:v26-session',e=>paint(e.detail));
  window.addEventListener('beforeunload',e=>{if(cloud.session().hasDraft||['saving','conflict','error'].includes(cloud.session().status)){e.preventDefault();e.returnValue='';}});
  // Intercept legacy imports: in cloud mode, restore is explicit, owner-only and empty-target only.
  document.addEventListener('click',e=>{
    if(cloud.session().role==='cobrador'&&e.target.closest('.v21-pay-btn,.v13-pay,.pay-btn')){e.preventDefault();e.stopImmediatePropagation();document.getElementById('modal').close();openAccount();receiptForm();return;}
    if(e.target.closest('#importBtn')){e.preventDefault();e.stopImmediatePropagation();openAccount();message('Use Trazer a carteira antiga. A importação direta está desativada para proteger os dados.',true);}
  },true);
  paint();showLogin(configured?'Iniciando conexão…':'Configure o Firebase para iniciar.');
  if(!configured)return;
  (async()=>{
    try{
      if(!window.firebase)throw Error('Não foi possível carregar o Firebase. Confira a conexão e recarregue.');
      firebase.initializeApp(config);auth=firebase.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
      auth.onAuthStateChanged(async user=>{
        const token=++authGeneration;if(signingOut)return;
        cloud.disconnect();if(!user){showLogin();return;}
        showLogin('Conectando à sua organização…');
        try{await cloud.connect(user);if(token!==authGeneration)return;paint();}
        catch(e){if(token===authGeneration){cloud.disconnect();showLogin(friendly(e),true);}}
      });
    }catch(e){cloud.disconnect();showLogin(friendly(e),true);}
  })();
})();
