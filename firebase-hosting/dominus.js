(function(){
'use strict';
const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1';
const button=document.createElement('button');button.type='button';button.className='soft-btn';button.textContent='Dominus';button.id='dominusOpen';
document.getElementById('accountQuickBtn').insertAdjacentElement('afterend',button);
const dialog=document.createElement('dialog');dialog.className='dominus-dialog';dialog.innerHTML='<header><h2>Dominus · Cobranças</h2><button type="button" data-close>Fechar</button></header><p>Consulte cobranças e prepare lembretes. Pagamentos e contratos são alterados no CrediGestor.</p><div class="dominus-actions"><button type="button" data-share>Compartilhar cópia para o WhatsApp</button><button type="button" data-link>Vincular WhatsApp</button><button type="button" data-remove>Remover cópia compartilhada</button></div><p class="dominus-status" role="status"></p><div class="dominus-chat" aria-live="polite"></div><form><label>Como posso ajudar?<textarea name="prompt" maxlength="2000" rows="3" required placeholder="Quais cobranças estão vencidas?"></textarea></label><button>Consultar</button></form>';document.body.append(dialog);
const status=dialog.querySelector('[role=status]'),chat=dialog.querySelector('.dominus-chat');
function owner(){const user=firebase.auth().currentUser;if(user?.uid!==OWNER)throw Error('Entre com sua Conta Google para usar o Dominus.');return user;}
function snapshot(){
 owner();const rows=allChargesAround().filter(x=>['open','late','paid'].includes(x.status)).map(x=>({client:String(x.cl.name||''),contract:String(x.c.id||''),reference:x.ref,due:[x.due.getFullYear(),String(x.due.getMonth()+1).padStart(2,'0'),String(x.due.getDate()).padStart(2,'0')].join('-'),amount:x.status==='paid'?Number(x.payment.amount??x.amount):Number(x.amount),status:x.status}));
 return {coverage:'Contratos ativos; dois meses anteriores, mês atual e dois meses seguintes. Histórico anterior não incluído.',charges:rows};
}
async function api(path,body,method='POST'){
 const endpoint=window.CREDIGESTOR_DOMINUS_ENDPOINT;if(!endpoint)throw Error('A conexão do servidor do Dominus ainda precisa ser ativada.');
 let url;try{url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error();}catch{throw Error('Endereço do servidor inválido.');}
 const user=owner(),token=await user.getIdToken(),id=user.uid;
 const response=await fetch(url.origin+'/api/credigestor/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='DELETE'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
 const result=await response.json();if(firebase.auth().currentUser?.uid!==id)throw Error('A conta mudou. Entre novamente.');if(!response.ok)throw Error(result.error||'Não foi possível consultar o Dominus.');return result;
}
function message(text,role){const article=document.createElement('article');article.className=role;article.textContent=text;chat.append(article);article.scrollIntoView({block:'nearest'});}
async function action(job){const buttons=dialog.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{status.textContent='Conectando…';await job();}catch(e){status.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}}
button.onclick=()=>{try{owner();status.textContent=window.CREDIGESTOR_DOMINUS_ENDPOINT?'Pronto para consultar as cobranças deste aparelho.':'A interface está preparada. A conexão do servidor ainda não foi ativada.';dialog.showModal();}catch(e){alert(e.message);}};
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const input=dialog.querySelector('textarea'),prompt=input.value.trim();if(!prompt)return;action(async()=>{const result=await api('chat',{prompt,snapshot:snapshot()});message(prompt,'dominus-question');message(result.reply,'dominus-answer');input.value='';status.textContent='Resposta baseada nas cobranças deste aparelho.';});};
dialog.querySelector('[data-share]').onclick=()=>action(async()=>{const result=await api('snapshot',snapshot());status.textContent='Cópia compartilhada. Expira em 24 horas; compartilhe novamente após registrar pagamentos.';});
dialog.querySelector('[data-link]').onclick=()=>action(async()=>{await api('snapshot',snapshot());const result=await api('link',{});message('No WhatsApp do Dominus, envie:\n'+result.command+'\nO código expira em cinco minutos.','dominus-answer');status.textContent='Código de vinculação gerado.';});
dialog.querySelector('[data-remove]').onclick=()=>action(async()=>{await api('snapshot',{},'DELETE');status.textContent='Cópia removida. O WhatsApp não poderá consultar estas cobranças.';});
firebase.auth().onAuthStateChanged(user=>{if(user?.uid!==OWNER){chat.replaceChildren();status.textContent='';dialog.close();}});
})();
