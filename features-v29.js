// CrediGestor v29 — Encerramento de contrato com juros proporcionais e acerto de contas.
(function(){
  'use strict';

  const VERSION='29.0';
  const DAY=86400000;

  function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function money(v){try{return brl(v)}catch(_){return num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}}
  function dateOnly(value){
    if(value instanceof Date){const d=new Date(value);d.setHours(0,0,0,0);return d}
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    const d=new Date(value||'');if(Number.isNaN(d.getTime()))return null;d.setHours(0,0,0,0);return d;
  }
  function fmtDate(value){
    const d=dateOnly(value);return d?d.toLocaleDateString('pt-BR'):'—';
  }
  function daysInMonth(value){const d=dateOnly(value)||new Date();return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}

  // Reutiliza cálculo proporcional da v28 se disponível, senão usa implementação local.
  const proportionalInterestFn=window.CrediGestorInterestV28||function(base,monthlyRatePercent,start,end){
    const principal=Math.max(0,num(base)),rate=Math.max(0,num(monthlyRatePercent))/100;
    const from=dateOnly(start),to=dateOnly(end);
    if(!principal||!rate||!from||!to||to<=from)return {interest:0,days:0,segments:[]};
    let cursor=from,interest=0,days=0;const segments=[];
    while(cursor<to){
      const monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
      const segmentEnd=monthEnd<to?monthEnd:to;
      const segmentDays=Math.max(0,Math.round((segmentEnd-cursor)/DAY));
      const monthDays=daysInMonth(cursor),value=principal*rate*(segmentDays/monthDays);
      interest+=value;days+=segmentDays;
      segments.push({month:`${String(cursor.getMonth()+1).padStart(2,'0')}/${cursor.getFullYear()}`,days:segmentDays,monthDays,value});
      cursor=segmentEnd;
    }
    return {interest,days,segments};
  };

  function balance(k){
    try{return Math.max(0,num(contractBalance(k)))}catch(_){return Math.max(0,num(k?.currentPrincipal)||num(k?.initialPrincipal))}
  }
  function rate(k){return Math.max(0,num(k?.interestRate))}

  // Calcula juros proporcionais desde o último vencimento até a data de encerramento.
  function calculateSettlement(cl,k,settlementDate){
    const principal=balance(k);
    const monthlyRate=rate(k);
    const at=dateOnly(settlementDate)||new Date();

    // Encontra o último vencimento não pago ou parcialmente pago para calcular juros de atraso.
    let lastDue=null;
    let outstandingAmount=0;

    if(typeof chargeFor==='function'){
      for(let off=-12;off<=0;off++){
        const d=new Date(at.getFullYear(),at.getMonth()+off,1);
        const x=chargeFor(cl,k,d.getFullYear(),d.getMonth());
        if(x&&x.status!=='not_due'&&dateOnly(x.due)<=at&&num(x.remaining)>0){
          if(!lastDue||dateOnly(x.due)>dateOnly(lastDue)){
            lastDue=x;
          }
        }
      }
    }

    // Se há cobrança em aberto, calcula juros proporcionais desde o vencimento.
    let lateInterest={interest:0,days:0,segments:[]};
    if(lastDue&&lastDue.due){
      const due=dateOnly(lastDue.due);
      if(due&&at>due){
        lateInterest=proportionalInterestFn(principal,monthlyRate,due,at);
      }
    }

    // Total devido = saldo principal + juros proporcionais de atraso.
    const totalDue=principal+lateInterest.interest;

    return {
      principal,
      monthlyRate,
      lateInterest:lateInterest.interest,
      lateDays:lateInterest.days,
      lateSegments:lateInterest.segments,
      totalDue,
      settlementDate:at
    };
  }

  // Gera extrato de encerramento formatado para compartilhamento.
  function settlementStatement(cl,k,settlement,receivedAmount){
    const received=num(receivedAmount);
    const remaining=Math.max(0,settlement.totalDue-received);
    const lines=[
      `🏦 *ENCERRAMENTO DE CONTRATO*`,
      ``,
      `👤 Cliente: ${cl?.name||'Cliente'}`,
      `📄 Contrato: ${k?.title||'Contrato'}`,
      `📅 Data do encerramento: ${fmtDate(settlement.settlementDate)}`,
      ``,
      `💰 *Resumo financeiro:*`,
      `• Saldo principal: ${money(settlement.principal)}`,
    ];

    if(settlement.lateDays>0){
      lines.push(`• Juros proporcionais (${settlement.lateDays} dias): ${money(settlement.lateInterest)}`);
      if(settlement.lateSegments.length){
        const segText=settlement.lateSegments.map(s=>`${s.days} dia(s) em ${s.month}`).join('; ');
        lines.push(`  Memória: ${segText}`);
      }
    }

    lines.push(`• *Total devido: ${money(settlement.totalDue)}*`);
    lines.push(``);
    lines.push(`💳 *Acerto de contas:*`);
    lines.push(`• Valor recebido: ${money(received)}`);
    lines.push(`• Restante (amortizado): ${money(remaining)}`);
    lines.push(``);
    lines.push(`✅ Contrato encerrado.`);

    return lines.join('\n');
  }

  // Modal de encerramento de contrato.
  function openSettlementModal(clientId,contractId){
    const c=state.clients.find(x=>x.id===clientId);
    const k=c?.contracts?.find(x=>x.id===contractId);
    if(!c||!k){alert('Contrato não encontrado.');return}

    const settlement=calculateSettlement(c,k,todayISO());

    openModal(`
      <h2>Encerrar contrato</h2>
      <div class="card">
        <div class="muted">Saldo principal atual</div>
        <strong style="font-size:28px">${money(settlement.principal)}</strong>
      </div>
      ${settlement.lateDays>0?`
      <div class="card" style="margin-top:12px;border-left:4px solid var(--accent)">
        <div class="muted">Juros proporcionais (${settlement.lateDays} dias)</div>
        <strong style="font-size:22px;color:var(--accent)">${money(settlement.lateInterest)}</strong>
        <div class="muted" style="margin-top:6px;font-size:12px">
          ${settlement.lateSegments.map(s=>`${s.days} dia(s) em ${s.month}`).join('; ')}
        </div>
      </div>`:''}
      <div class="card" style="margin-top:12px;background:rgba(var(--accent-rgb,37,99,235),0.08)">
        <div class="muted">Total devido no encerramento</div>
        <strong style="font-size:32px">${money(settlement.totalDue)}</strong>
      </div>
      <div class="field" style="margin-top:16px">
        <label>Data do encerramento</label>
        <input id="settleDate" type="date" value="${todayISO()}">
      </div>
      <div class="field">
        <label>Valor recebido do cliente</label>
        <input id="settleReceived" type="number" step="0.01" placeholder="0,00">
        <div class="muted" style="margin-top:4px">O restante será registrado como desconto/amortização.</div>
      </div>
      <div class="actions">
        <button type="button" class="primary-btn" id="confirmSettlementBtn">Confirmar encerramento</button>
        <button type="button" class="soft-btn" id="previewSettlementBtn">Ver extrato</button>
      </div>
      <div class="rule-note" style="margin-top:12px">
        Ao confirmar, o contrato será marcado como encerrado. O valor recebido será registrado como pagamento
        e o restante como amortização do principal, zerando o saldo.
      </div>
    `,()=>{
      const dateInput=document.getElementById('settleDate');
      const receivedInput=document.getElementById('settleReceived');

      // Recalcula quando a data muda.
      dateInput.onchange=()=>{
        const newSettlement=calculateSettlement(c,k,dateInput.value);
        // Atualiza valores exibidos sem fechar o modal.
        const cards=document.querySelectorAll('.card strong');
        if(cards.length>=3){
          cards[0].textContent=money(newSettlement.principal);
          if(newSettlement.lateDays>0&&cards.length>=4){
            cards[1].textContent=money(newSettlement.lateInterest);
            cards[2].textContent=money(newSettlement.totalDue);
          }else{
            cards[1].textContent=money(newSettlement.totalDue);
          }
        }
      };

      document.getElementById('previewSettlementBtn').onclick=()=>{
        const received=num(receivedInput.value);
        const currentSettlement=calculateSettlement(c,k,dateInput.value);
        const text=settlementStatement(c,k,currentSettlement,received);

        openModal(`
          <h2>Extrato de encerramento</h2>
          <textarea readonly rows="18" style="width:100%;font-family:monospace;font-size:13px">${esc(text)}</textarea>
          <div class="actions">
            <button type="button" class="soft-btn" id="copySettlementBtn">Copiar</button>
            <button type="button" class="ghost-btn" onclick="closeModal()">Voltar</button>
          </div>
        `,()=>{
          document.getElementById('copySettlementBtn').onclick=async()=>{
            try{await navigator.clipboard.writeText(text);alert('Extrato copiado.')}
            catch(_){alert('Não foi possível copiar automaticamente. Selecione e copie manualmente.')}
          };
        });
      };

      document.getElementById('confirmSettlementBtn').onclick=()=>{
        const received=num(receivedInput.value);
        const settleDate=dateInput.value||todayISO();
        const currentSettlement=calculateSettlement(c,k,settleDate);
        const remaining=Math.max(0,currentSettlement.totalDue-received);

        if(!confirm(`Confirmar encerramento do contrato?\n\nTotal devido: ${money(currentSettlement.totalDue)}\nRecebido: ${money(received)}\nRestante (desconto): ${money(remaining)}`)){
          return;
        }

        // Registra pagamento do valor recebido.
        if(received>0){
          k.payments=k.payments||[];
          k.payments.push({
            id:uid('py'),
            amount:received,
            paidAt:settleDate,
            reference:monthRef(dateOnly(settleDate)),
            type:'payoff',
            note:'Pagamento no encerramento',
            createdAt:new Date().toISOString()
          });
        }

        // Registra amortização do restante (desconto concedido).
        if(remaining>0){
          k.movements=k.movements||[];
          const beforeBal=balance(k);
          k.movements.push({
            id:uid('mv'),
            type:'amortization',
            amount:remaining,
            date:settleDate,
            note:'Desconto no encerramento do contrato',
            balanceBefore:beforeBal,
            balanceAfter:Math.max(0,Math.round((beforeBal-remaining)*100)/100),
            createdAt:new Date().toISOString()
          });
        }

        // Marca contrato como encerrado.
        k.active=false;
        k.closedAt=settleDate;
        k.updatedAt=new Date().toISOString();

        saveState();
        closeModal();

        // Compartilha extrato de encerramento.
        const statement=settlementStatement(c,k,currentSettlement,received);
        const shareFn=window.prepareReceiptV25||window.prepareReceiptV24;
        if(typeof shareFn==='function'){
          shareFn(c,statement,'Contrato encerrado. Confira o extrato antes de compartilhar.');
        }else{
          openModal(`
            <h2>Contrato encerrado</h2>
            <p>O contrato foi encerrado com sucesso.</p>
            <textarea readonly rows="14" style="width:100%;font-family:monospace">${esc(statement)}</textarea>
            <div class="actions"><button type="button" class="primary-btn" onclick="closeModal()">Fechar</button></div>
          `);
        }

        render();
      };
    });
  }

  window.openSettlementModal=openSettlementModal;

  // Intercepta o modal de detalhes do cliente para adicionar botão de encerramento.
  if(typeof openClientDetail==='function'){
    const baseOpenClientDetail=openClientDetail;
    openClientDetail=function(id){
      const result=baseOpenClientDetail(id);

      // Adiciona botões de encerramento nos contratos ativos após renderização.
      setTimeout(()=>{
        const contractCards=document.querySelectorAll('.contract-card');
        contractCards.forEach(card=>{
          const statusSpan=card.querySelector('.status');
          if(statusSpan&&statusSpan.textContent==='ATIVO'){
            const actionsDiv=card.querySelector('.inline-actions');
            if(actionsDiv&&!actionsDiv.querySelector('.settle-contract')){
              const editBtn=actionsDiv.querySelector('.edit-contract');
              const contractId=editBtn?.dataset?.id;
              if(contractId){
                const settleBtn=document.createElement('button');
                settleBtn.type='button';
                settleBtn.className='small-btn settle-contract';
                settleBtn.dataset.id=contractId;
                settleBtn.textContent='Encerrar';
                settleBtn.style.marginLeft='8px';
                settleBtn.onclick=()=>{closeModal();openSettlementModal(id,contractId)};
                actionsDiv.appendChild(settleBtn);
              }
            }
          }
        });
      },50);

      return result;
    };
  }

  window.__credigestorV29={version:VERSION,settlement:true,proportionalInterestOnClose:true};
})();