(function(){
  'use strict';
  const clientsRender=renderClients;
  renderClients=function(){
    const out=clientsRender(),view=document.getElementById('view');
    document.getElementById('addClientFab')?.remove();
    const button=document.createElement('button');button.type='button';button.className='primary-btn';button.id='addClientQuick';button.textContent='+ Adicionar cliente';button.onclick=()=>openClientModal();
    view.querySelector('.section-title')?.after(button);return out;
  };
  // Pix Copia e Cola estático (BR Code / EMV do Banco Central), com valor.
  function pixField(id,value){return id+String(value.length).padStart(2,'0')+value}
  function pixPlain(s,max){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9 .\-]/g,'').replace(/\s+/g,' ').trim().toUpperCase().slice(0,max)}
  function pixKeyNormalized(key,type){
    const k=String(key||'').trim(),t=String(type||'').toLowerCase(),digits=k.replace(/\D/g,'');
    if(t==='cpf'||t==='cnpj')return digits;
    if(t==='telefone')return k.startsWith('+')?'+'+digits:'+'+(digits.length<=11?'55'+digits:digits);
    if(t==='e-mail')return k.toLowerCase();
    return k;
  }
  function pixCrc16(s){let crc=0xFFFF;for(const ch of new TextEncoder().encode(s)){crc^=ch<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xFFFF:(crc<<1)&0xFFFF}return crc.toString(16).toUpperCase().padStart(4,'0')}
  function pixCopiaECola(key,type,name,city,amount){
    const account=pixField('00','br.gov.bcb.pix')+pixField('01',pixKeyNormalized(key,type));
    const value=Number(amount)>0?pixField('54',(Math.round(Number(amount)*100)/100).toFixed(2)):'';
    const payload=pixField('00','01')+pixField('26',account)+pixField('52','0000')+pixField('53','986')+value+pixField('58','BR')+pixField('59',pixPlain(name,25)||'FAVORECIDO')+pixField('60',pixPlain(city,15))+pixField('62',pixField('05','***'))+'6304';
    return payload+pixCrc16(payload);
  }
  window.pixCopiaECola=pixCopiaECola;
  function attach(clientId,contractId,ref){
    const client=state.clients.find(x=>x.id===clientId),contract=client?.contracts.find(x=>x.id===contractId);if(!contract||isPaidContract(contract))return;
    const reference=ref||window.pendingCollectionCharges(client,contract)[0]?.ref||monthRef(),[y,m]=reference.split('-').map(Number),charge=chargeFor(client,contract,y,m-1);if(charge.remaining<=0||charge.status==='not_due'){alert('Esta parcela não possui valor em aberto.');return;}
    const text=`📩 *Mensagem de cobrança*\n\n👤 Olá, ${client.name}!\n\n📄 Seu débito referente ao contrato ${contract.loanCode||contract.title||contract.id} está em aberto.\n\n💰 Valor total para quitação (capital + juros atuais): ${brl(window.collectionPayoffQuote(contract).total)}\n\n\n💵 Valor da parcela em aberto: ${brl(charge.remaining)}\n🗓️ Referência: ${reference}\n📅 Vencimento: ${charge.due.toLocaleDateString('pt-BR')}\n\n🤝 Por favor, entre em contato para regularizar o pagamento.\n🧾 Caso já tenha pago, envie o comprovante para conferência.`;
    let phone=String(client.phone||'').replace(/\D/g,'');if(phone.length===10||phone.length===11)phone='55'+phone;const valid=/^55\d{10,11}$/.test(phone);
    openModal(`<h2>Mensagem de cobrança</h2><div class="field"><label>Confira a mensagem antes de enviar</label><textarea id="collectionText" readonly rows="16">${esc(text)}</textarea></div><div class="actions">${valid?`<a class="primary-btn" href="https://wa.me/${phone}?text=${encodeURIComponent(text)}" target="_self">Abrir WhatsApp</a>`:''}<button type="button" class="soft-btn" id="copyCollection">Copiar mensagem</button></div><p class="muted" id="collectionStatus" role="status">${valid?'Confirme o envio no WhatsApp.':'Cadastre um telefone com DDD para abrir o WhatsApp. Você pode copiar a mensagem.'}</p>`,()=>{
      const key=String(state.settings.pixKey||'').trim();
      const pixText=`💳 *Pagamento via Pix*\n👤 Favorecido: ${String(state.settings.pixName||'').trim()||'Não informado'}${String(state.settings.pixBank||'').trim()?`\n🏦 Banco: ${String(state.settings.pixBank).trim()}`:''}\n🔖 Tipo de chave: ${String(state.settings.pixType||'').trim()||'Não informado'}\n🔑 Chave Pix: ${key}`;
      const pixSection=document.createElement('section');pixSection.style.marginTop='24px';
      pixSection.innerHTML=key?`<h3>2ª mensagem · Chave Pix</h3><p class="muted">Envie os dados do Pix em uma mensagem separada da cobrança.</p><div class="field"><div id="collectionPixText" role="textbox" aria-readonly="true" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;padding:12px 14px;border:1px solid var(--line,rgba(16,32,51,.12));border-radius:14px;background:var(--surface-solid,#fff);color:var(--text,#102033)">${esc(pixText.slice(0,pixText.lastIndexOf('\n🔑')))}<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px"><span style="flex:1;min-width:0">🔑 Chave Pix: <b id="collectionPixKey">${esc(key)}</b></span><button type="button" class="small-btn" id="copyCollectionPixKey">📋 Copiar chave</button></div></div></div><div class="actions">${valid?`<a class="primary-btn" id="sendCollectionPix" href="https://wa.me/${phone}?text=${encodeURIComponent(pixText)}" target="_self">Abrir WhatsApp com a chave Pix</a>`:''}<button type="button" class="soft-btn" id="copyCollectionPix">Copiar dados do Pix</button></div><p class="muted" id="collectionPixStatus" role="status"></p>`:'<h3>2ª mensagem · Chave Pix</h3><p class="muted">Nenhuma chave Pix cadastrada. Cadastre em Configurações → PIX e WhatsApp.</p>';
      document.getElementById('modalContent').append(pixSection);
      if(key){
        const city=String(state.settings.pixCity||'').trim(),code=city?pixCopiaECola(key,state.settings.pixType,state.settings.pixName,city,charge.remaining):'';
        const ccSection=document.createElement('section');ccSection.style.marginTop='24px';
        ccSection.innerHTML=code?`<h3>3ª mensagem · Pix Copia e Cola</h3><p class="muted">O cliente segura o dedo na mensagem, toca em “Copiar” e cola em “Pix Copia e Cola” no banco: favorecido e valor (${esc(brl(charge.remaining))}) já vêm preenchidos.</p><div class="field"><div id="collectionPixCode" style="white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.45;padding:12px 14px;border:1px solid var(--line,rgba(16,32,51,.12));border-radius:14px;background:var(--surface-solid,#fff);color:var(--text,#102033)">${esc(code)}</div></div><div class="actions">${valid?`<a class="primary-btn" id="sendCollectionPixCode" href="https://wa.me/${phone}?text=${encodeURIComponent(code)}" target="_self">Abrir WhatsApp com o Pix Copia e Cola</a>`:''}<button type="button" class="soft-btn" id="copyCollectionPixCode">Copiar código</button></div><p class="muted" id="collectionPixCodeStatus" role="status"></p>`:'<h3>3ª mensagem · Pix Copia e Cola</h3><p class="muted">Para gerar o código Pix Copia e Cola, cadastre a cidade do favorecido em Configurações → PIX e WhatsApp.</p>';
        document.getElementById('modalContent').append(ccSection);
        if(code)document.getElementById('copyCollectionPixCode').onclick=async()=>{const status=document.getElementById('collectionPixCodeStatus');try{await navigator.clipboard.writeText(code);status.textContent='Código Pix Copia e Cola copiado.';}catch(_){const range=document.createRange();range.selectNodeContents(document.getElementById('collectionPixCode'));const sel=getSelection();sel.removeAllRanges();sel.addRange(range);status.textContent='Código selecionado. Copie e envie como mensagem separada.';}};
      }
      if(key)document.getElementById('copyCollectionPixKey').onclick=async()=>{const status=document.getElementById('collectionPixStatus');try{await navigator.clipboard.writeText(key);status.textContent='Chave Pix copiada.';}catch(_){const tmp=document.createElement('textarea');tmp.value=key;tmp.setAttribute('readonly','');tmp.style.position='fixed';tmp.style.opacity='0';document.body.append(tmp);tmp.select();const ok=document.execCommand('copy');tmp.remove();status.textContent=ok?'Chave Pix copiada.':'Não foi possível copiar. Selecione a chave e copie manualmente.';}};
      if(key)document.getElementById('copyCollectionPix').onclick=async()=>{const field=document.getElementById('collectionPixText'),status=document.getElementById('collectionPixStatus');try{await navigator.clipboard.writeText(pixText);status.textContent='Dados do Pix copiados. Cole como uma mensagem separada.';}catch(_){const range=document.createRange();range.selectNodeContents(field);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);status.textContent='Dados selecionados. Copie e envie separadamente.';}};
      document.getElementById('copyCollection').onclick=async()=>{const field=document.getElementById('collectionText'),status=document.getElementById('collectionStatus');try{await navigator.clipboard.writeText(text);status.textContent='Mensagem copiada.';}catch(_){field.focus();field.select();status.textContent='Texto selecionado. Copie e cole na conversa do cliente.';}};
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








