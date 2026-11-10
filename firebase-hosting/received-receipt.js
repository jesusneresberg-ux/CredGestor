(function(){
  'use strict';
  const clientsRender=renderClients;
  renderClients=function(){
    const out=clientsRender(),view=document.getElementById('view');
    document.getElementById('addClientFab')?.remove();
    const button=document.createElement('button');button.type='button';button.className='primary-btn';button.id='addClientQuick';button.textContent='+ Adicionar cliente';button.onclick=()=>openClientModal();
    view.querySelector('.section-title')?.after(button);return out;
  };  function attach(clientId,contractId,ref){
    const client=state.clients.find(x=>x.id===clientId),contract=client?.contracts.find(x=>x.id===contractId);if(!contract||isPaidContract(contract))return;
    const reference=ref||window.pendingCollectionCharges(client,contract)[0]?.ref||monthRef(),[y,m]=reference.split('-').map(Number),charge=chargeFor(client,contract,y,m-1);if(charge.remaining<=0||charge.status==='not_due'){alert('Esta parcela não possui valor em aberto.');return;}
    const collectionText=`📩 *Mensagem de cobrança*\n\n👤 Olá, ${client.name}!\n\n📄 Seu débito referente ao contrato ${contract.loanCode||contract.title||contract.id} está em aberto.\n\n💰 Valor total para quitação (capital + juros atuais): ${brl(window.collectionPayoffQuote(contract).total)}\n\n\n💵 Valor da parcela em aberto: ${brl(charge.remaining)}\n🗓️ Referência: ${reference}\n📅 Vencimento: ${charge.due.toLocaleDateString('pt-BR')}\n\n🤝 Por favor, entre em contato para regularizar o pagamento.\n🧾 Caso já tenha pago, envie o comprovante para conferência.`;
    let phone=String(client.phone||'').replace(/\D/g,'');if(phone.length===10||phone.length===11)phone='55'+phone;const valid=/^55\d{10,11}$/.test(phone);
    const key=String(state.settings.pixKey||'').trim();
    const bankText=key?`\n\n💳 *Dados para pagamento via Pix*\n👤 Favorecido: ${String(state.settings.pixName||'').trim()||'Não informado'}\n🏦 Banco: ${String(state.settings.pixBank||'').trim()||'Não informado'}\n🔖 Tipo de chave: ${String(state.settings.pixType||'').trim()||'Não informado'}\n\n🔑 *Chave Pix*\n`:'';
    const text=collectionText+bankText+key;
    openModal(`<h2>Mensagem de cobrança</h2><p class="muted">Cobrança e dados para pagamento em uma única mensagem.</p><div class="field"><label>Confira antes de enviar</label><div id="collectionText" role="textbox" aria-readonly="true" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;padding:12px 14px;border:1px solid var(--line,rgba(16,32,51,.12));border-radius:14px;background:var(--surface-solid,#fff);color:var(--text,#102033)">${esc(collectionText+bankText)}${key?`<u id="collectionPixKey" style="text-underline-offset:3px;user-select:all">${esc(key)}</u>`:''}</div></div><div class="actions">${valid?`<a class="primary-btn" id="sendCollection" href="https://wa.me/${phone}?text=${encodeURIComponent(text)}" target="_self">Abrir WhatsApp</a>`:''}<button type="button" class="soft-btn" id="copyCollection">Copiar mensagem completa</button>${key?'<button type="button" class="soft-btn" id="copyCollectionPixKey">Copiar chave Pix</button>':''}</div><p class="muted" id="collectionStatus" role="status">${valid?'Confirme o envio no WhatsApp.':'Cadastre um telefone com DDD para abrir o WhatsApp. Você pode copiar a mensagem.'}</p>${key?'<p class="muted">No WhatsApp, o cliente pode pressionar o balão e copiar a mensagem. O botão Copiar chave e o sublinhado aparecem apenas nesta prévia.</p>':'<p class="muted">Nenhuma chave Pix cadastrada. Cadastre em Configurações → PIX e WhatsApp.</p>'}`,()=>{
      async function copy(value,message,fieldId){
        const status=document.getElementById('collectionStatus');
        try{await navigator.clipboard.writeText(value);status.textContent=message;}
        catch(_){
          const tmp=document.createElement('textarea');tmp.value=value;tmp.setAttribute('readonly','');tmp.style.position='fixed';tmp.style.opacity='0';document.body.append(tmp);tmp.focus();tmp.select();
          const ok=document.execCommand('copy');tmp.remove();
          if(ok){status.textContent=message;return;}
          const range=document.createRange();range.selectNodeContents(document.getElementById(fieldId));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='Texto selecionado. Copie manualmente.';
        }
      }
      document.getElementById('copyCollection').onclick=()=>copy(text,'Mensagem completa copiada.','collectionText');
      if(key)document.getElementById('copyCollectionPixKey').onclick=()=>copy(key,'Chave Pix copiada.','collectionPixKey');
    });
  }

  function decorate(root,clientId){
    root?.querySelectorAll('.loan-card,.contract-card,.list-item').forEach(card=>{
      if(card.querySelector('.received-attach'))return;
      const edit=card.querySelector('.edit-loan2,.edit-contract,[data-v21-client]');if(!edit)return;
      const c=clientId||edit.dataset.client||edit.dataset.v21Client,k=edit.dataset.loan||edit.dataset.id||edit.dataset.v21Loan;
      if(!c||!k)return;
      const contract=state.clients.find(x=>x.id===c)?.contracts.find(x=>x.id===k);if(!contract||contract.active===false)return;
      const button=document.createElement('button');button.type='button';button.className='small-btn received-attach';button.textContent='💬 Mensagem de cobrança';button.onclick=()=>attach(c,k,edit.dataset.v21Ref);(card.querySelector('.inline-actions')||card).append(button);
    });
  }
  const baseRender=render;render=function(){const out=baseRender();if(currentView==='charges')decorate(document.getElementById('view'));return out};
  const detail=openClientDetail;openClientDetail=function(id){const out=detail(id);const root=document.getElementById('modalContent');decorate(root,id);
    const client=state.clients.find(c=>c.id===id);
    for(const k of client?.contracts||[])for(const p of k.payments||[]){if(!p.receivedReceipt)continue;
      const b=document.createElement('button');b.type='button';b.className='soft-btn';b.textContent=`📎 ${p.reference} · ${brl(p.amount)} · ${p.receivedReceipt.name}`;
      b.onclick=()=>{const a=document.createElement('a');a.href=p.receivedReceipt.data;a.download=p.receivedReceipt.name;a.click()};root.append(b);
    }return out;
  };
  render();
})();








