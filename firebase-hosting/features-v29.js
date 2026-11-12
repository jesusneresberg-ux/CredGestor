(function crediGestorV29(){
  'use strict';
  if(typeof state==='undefined'||typeof chargeFor!=='function')return;
  const MS=86400000;
  const cents=n=>Math.round((Number(n)||0)*100);
  const money=n=>n/100;
  const day=v=>{
    if(v instanceof Date)return new Date(v.getFullYear(),v.getMonth(),v.getDate(),12);
    const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m){const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;}
    return v?null:day(new Date());
  };
  const dateISO=v=>{const d=day(v);return d?ymd(d):''};
  const ordinal=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/MS;
  const matching=(p,ref)=>String(p.reference||p.ref||'')===ref;
  // Encargos de atraso só existem após lançamento explícito do usuário.
  function accruedLateInterest(k,row,untilValue){
    const until=dateISO(untilValue);
    const total=(k.manualLateInterest||[]).filter(e=>e.reference===row.ref&&e.date<=until)
      .reduce((sum,e)=>sum+Math.max(0,cents(e.amount)),0);
    return {cents:total,days:0};
  }
  const previousCharge=chargeFor;
  chargeFor=function(cl,k,year,monthIndex,asOfValue){
    const row=previousCharge(cl,k,year,monthIndex),asOf=day(asOfValue);
    if(!asOf||row.status==='not_due'||isPaidContract(k))return {...row,baseAmount:row.amount,lateInterest:0,lateDays:0};
    const base=cents(row.amount),extra=accruedLateInterest(k,row,asOf);
    // Historicamente os pagamentos são datados; não usar lançamentos futuros
    // para abater o saldo de uma consulta retroativa.
    const paid=cents((k.payments||[]).filter(p=>matching(p,row.ref)&&ordinal(day(p.paidAt||p.date)||asOf)<=ordinal(asOf))
      .reduce((total,p)=>total+Math.max(0,Number(p.amount)||0)+Math.max(0,Number(p.discountAmount)||0),0));
    const due=day(row.due||row.originalDue),remaining=Math.max(0,base+extra.cents-paid);
    row.baseAmount=money(base);row.lateInterest=money(extra.cents);row.lateDays=extra.days;
    row.amount=money(base+extra.cents);row.paid=money(paid);row.remaining=money(remaining);
    row.status=remaining===0?'paid':due&&ordinal(due)<ordinal(asOf)?'late':'open';
    return row;
  };
  window.CrediGestorOverdueV29={accruedLateInterest,asOf:(cl,k,y,m,iso)=>chargeFor(cl,k,y,m,iso)};
  let context=null;
  function getContext(){
    if(!context)return null;
    const cl=(state.clients||[]).find(c=>c.id===context.clientId);
    const k=cl?.contracts?.find(c=>c.id===context.contractId);
    return cl&&k?{cl,k}:null;
  }
  function monthRows(cl,k,asOf){
    const first=firstPaymentDate(k),end=day(asOf),start=first&&day(first);
    if(!start||!end)return [];
    const from=start.getFullYear()*12+start.getMonth(),to=end.getFullYear()*12+end.getMonth();
    const rows=[];
    for(let i=from;i<=to&&i<from+1200;i++){
      const y=Math.floor(i/12),m=i%12,row=chargeFor(cl,k,y,m,end);
      if(row.status!=='not_due'&&row.remaining>0&&ordinal(day(row.due||row.originalDue))<=ordinal(end))rows.push(row);
    }
    return rows;
  }
  // Só datas financeiras alteram a referência; updatedAt também muda em edições cadastrais.
  function capitalStatementDates(k,asOf){
    const until=day(asOf),dates=[k.lastBalanceUpdate,...(k.movements||[])
      .filter(m=>['increase','amortization'].includes(m.type)&&Number(m.amount)>0).map(m=>m.date)]
      .filter(Boolean).map(day).filter(d=>d&&ordinal(d)<=ordinal(until));
    if(!dates.length||isPaidContract(k)||k.billingType==='amortization')return null;
    const updated=dates.sort((a,b)=>a-b).at(-1);
    const base=Math.min(30,Math.max(1,Number(k.baseDueDay)||1));
    const dueIn=m=>new Date(updated.getFullYear(),m,Math.min(base,new Date(updated.getFullYear(),m+1,0).getDate()),12);
    let due=dueIn(updated.getMonth());
    if(ordinal(due)<=ordinal(updated))due=dueIn(updated.getMonth()+1);
    const first=day(firstPaymentDate(k));
    if(first&&ordinal(first)>ordinal(due))due=first;
    return {updated,due};
  }
  function statement(cl,k,asOf){
    const when=day(asOf),rows=monthRows(cl,k,when),total=rows.reduce((n,r)=>n+cents(r.remaining),0);
    const late=rows.reduce((n,r)=>n+cents(r.lateInterest),0);
    const text=[`*EXTRATO DE COBRANÇA — CREDIGESTOR*`,`Cliente: ${cl.name}`,`Contrato: ${k.loanCode||k.title||'Contrato'}`,`Atualizado em: ${when.toLocaleDateString('pt-BR')}`,`Capital ativo (informativo): ${brl(contractBalance(k))}`,``];
    const capitalDates=capitalStatementDates(k,when);
    if(capitalDates)text.push(`Capital atualizado em: ${capitalDates.updated.toLocaleDateString('pt-BR')}`,`Vencimento após atualização do capital: ${capitalDates.due.toLocaleDateString('pt-BR')}`,``);
    if(!rows.length)text.push('Nenhuma cobrança vencida permanece em aberto nesta data.');
    rows.forEach(r=>text.push(`Referência ${r.ref} · vencimento original: ${day(r.originalDue||r.due).toLocaleDateString('pt-BR')}`,
      `Cobrança original: ${brl(r.baseAmount)}`,`Juros de atraso lançados manualmente: ${brl(r.lateInterest)}`,
      `Valores já registrados: ${brl(r.paid)}`,`Saldo desta referência: ${brl(r.remaining)}`,``));
    text.push(`Juros de atraso nas referências abertas: ${brl(money(late))}`,
      `*TOTAL DAS COBRANÇAS EM ABERTO: ${brl(money(total))}*`,
      `O capital informado acima não integra este total de parcelas/juros. Para quitação integral, solicite o extrato de encerramento.`);
    return text.join('\n');
  }
  window.CrediGestorOverdueV29.statement=statement;
  window.CrediGestorOverdueV29.capitalStatementDates=capitalStatementDates;
  if(typeof window.paymentReceiptV25==='function'){
    const receipt=window.paymentReceiptV25;
    window.paymentReceiptV25=function(cl,k,p){
      const body=receipt(cl,k,p);
      return Number(p?.lateInterestAccrued)>0?body+'\nJuros de atraso incluídos na cobrança: '+brl(p.lateInterestAccrued)+'.':body;
    };
  }
  function clearOldButtons(root){
    if(!root)return;
    root.querySelectorAll('.move-loan2,.move-contract,.edit-contract-date,#changeBalanceFromHistory2').forEach(el=>el.remove());
    root.querySelectorAll('.edit-loan2,.edit-contract').forEach(el=>{
      el.textContent='Editar';
      el.title='Editar contrato, data de início e dia-base do vencimento';
    });
  }
  function openAdjustment(){
    const pair=getContext();if(!pair)return;const {cl,k}=pair;
    if(k.active===false||isPaidContract(k)){alert('Este contrato está encerrado.');return;}
    const oldBalance=contractBalance(k),rate=Math.max(0,Number(k.interestRate)||0);
    openModal(`<h2>Aumentar / diminuir valor</h2><div class="muted">${esc(cl.name)} · ${esc(k.loanCode||k.title||'Contrato')}</div>
    <div class="card"><div class="muted">Capital atual</div><strong>${brl(oldBalance)}</strong></div>
    <div class="field"><label>Operação</label><select id="v29Kind"><option value="increase">Aumentar — novo valor liberado</option><option value="decrease">Diminuir — amortizar capital</option></select></div>
    <div class="field"><label>Valor (R$)</label><input id="v29Amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></div>
    <div class="field"><label>Data da operação</label><input id="v29Date" type="date" value="${dateISO(new Date())}" required></div>
    <div class="field"><label>Observação</label><textarea id="v29Note" placeholder="Motivo ou referência da operação"></textarea></div>
    <div class="card"><div class="muted">Novo capital previsto</div><strong id="v29Balance">${brl(oldBalance)}</strong><div class="muted" id="v29Interest"></div></div>
    <div class="actions"><button type="button" class="primary-btn" id="v29Continue">Continuar</button><button type="button" class="soft-btn" id="v29Back">Voltar</button></div>
    <div class="rule-note">Aumento libera novo capital. Diminuição abre a confirmação de amortização com forma de pagamento e comprovante. Nenhum valor é alterado antes da confirmação.</div>`,()=>{
      const amount=document.getElementById('v29Amount'),kind=document.getElementById('v29Kind');
      const refresh=()=>{
        const a=Number(amount.value)||0,newValue=oldBalance+(kind.value==='increase'?a:-a);
        document.getElementById('v29Balance').textContent=brl(Math.max(0,newValue));
        document.getElementById('v29Interest').textContent=k.billingType==='interest'?`Juros mensais sobre o saldo: ${brl(Math.max(0,newValue)*rate/100)}`:'Parcela fixa: '+brl(monthlyDue(k));
      };
      kind.onchange=refresh;amount.oninput=refresh;refresh();
      document.getElementById('v29Back').onclick=()=>window.openPaymentsHubV21(cl.id,k.id,context?.ref);
      document.getElementById('v29Continue').onclick=async e=>{
        const a=Number(amount.value),date=document.getElementById('v29Date').value,note=document.getElementById('v29Note').value.trim();
        if(!Number.isFinite(a)||a<=0||Math.round(a*100)!==a*100&&Math.abs(Math.round(a*100)-a*100)>1e-7){alert('Informe um valor positivo com até duas casas decimais.');return;}
        if(!day(date)){alert('Informe uma data válida.');return;}
        if(k.active===false||isPaidContract(k)){alert('O contrato já está encerrado.');return;}
        if(kind.value==='decrease'){
          if(a>=contractBalance(k)){alert('Para zerar o capital, use a opção de quitação na aba Pagamentos.');return;}
          window.openPaymentsHubV21(cl.id,k.id,context?.ref);
          document.getElementById('v21Amortize')?.click();
          const input=document.getElementById('v21Amount');
          if(!input){alert('Não foi possível abrir a amortização.');return;}
          input.value=String(a);input.dispatchEvent(new Event('input'));
          document.getElementById('v21Date').value=date;
          document.getElementById('v21Note').value=note;
          return;
        }
        if(!confirm(`Liberar mais ${brl(a)} para ${cl.name}? O novo capital será ${brl(contractBalance(k)+a)}.`))return;
        const button=e.currentTarget;if(button.disabled)return;button.disabled=true;
        const previous=JSON.parse(JSON.stringify(k));
        try{
          const amountValue=Math.round(a*100)/100,before=contractBalance(k);
          const movement={id:uid('mv'),type:'increase',amount:amountValue,date,note:note||'Acréscimo de capital / novo valor liberado',
            balanceBefore:before,balanceAfter:Math.round((before+amountValue)*100)/100,createdAt:new Date().toISOString()};
          k.movements=k.movements||[];k.movements.push(movement);
          k.lastBalanceUpdate=date;k.updatedAt=new Date().toISOString();
          saveState();
          if(window.CREDIGESTOR_MULTITENANT)await window.CrediGestorCloud.flush();
          closeModal();render();window.openPaymentsHubV21(cl.id,k.id,context?.ref);
        }catch(err){Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,previous);alert('O acréscimo não foi confirmado: '+err.message);}
        finally{button.disabled=false;}
      };
    });
  }
  function addManualLateInterest(cl,k,reference,amount,date,note=''){
    if(k.active===false||isPaidContract(k))throw Error('Este contrato está encerrado.');
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(reference))throw Error('Selecione uma referência válida.');
    if(!Number.isFinite(amount)||amount<=0||Math.abs(cents(amount)-amount*100)>1e-7)throw Error('Informe um valor positivo com até duas casas decimais.');
    if(!day(date)||date>dateISO(new Date()))throw Error('Informe uma data válida, até hoje.');
    const [y,m]=reference.split('-').map(Number),row=chargeFor(cl,k,y,m-1,date);
    if(row.status==='not_due'||row.status==='capitalized'||dateISO(row.due)>=date)throw Error('Escolha uma cobrança vencida e ainda não incorporada ao capital.');
    const before=JSON.parse(JSON.stringify(k));
    try{
      const entry={id:uid('late'),reference,amount:money(cents(amount)),date,note:String(note).trim(),createdAt:new Date().toISOString()};
      k.manualLateInterest=[...(k.manualLateInterest||[]),entry];k.updatedAt=entry.createdAt;
      saveState();return entry;
    }catch(error){Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,before);throw error;}
  }
  window.CrediGestorOverdueV29.addManual=addManualLateInterest;
  function openManualLateInterest(){
    const pair=getContext();if(!pair)return;const {cl,k}=pair;
    openModal(`<h2>Inserir juros de atraso</h2><p class="muted">${esc(cl.name)} · ${esc(k.loanCode||k.title||'Contrato')}</p>
      <div class="field"><label for="v29LateRef">Referência da cobrança</label><input id="v29LateRef" type="month" value="${esc(context.ref||dateISO(new Date()).slice(0,7))}" required></div>
      <div class="field"><label for="v29LateAmount">Juros de atraso (R$)</label><input id="v29LateAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required></div>
      <div class="field"><label for="v29LateDate">Data do lançamento</label><input id="v29LateDate" type="date" value="${dateISO(new Date())}" required></div>
      <div class="field"><label for="v29LateReason">Motivo / observação</label><textarea id="v29LateReason"></textarea></div>
      <p class="rule-note">O valor será acrescentado apenas à cobrança escolhida. O capital não muda. Os juros de atraso não são calculados automaticamente.</p>
      <div class="actions"><button type="button" class="primary-btn" id="v29SaveLate">Salvar juros</button><button type="button" class="soft-btn" id="v29CancelLate">Voltar</button></div>`,()=>{
        document.getElementById('v29CancelLate').onclick=()=>window.openPaymentsHubV21(cl.id,k.id,context.ref);
        document.getElementById('v29SaveLate').onclick=e=>{
          if(e.currentTarget.disabled)return;
          try{
            const ref=document.getElementById('v29LateRef').value;
            addManualLateInterest(cl,k,ref,Number(document.getElementById('v29LateAmount').value),document.getElementById('v29LateDate').value,document.getElementById('v29LateReason').value);
            e.currentTarget.disabled=true;closeModal();render();window.openPaymentsHubV21(cl.id,k.id,ref);
          }catch(error){alert(error.message);}
        };
      });
  }
  function decorateHub(){
    const grid=document.querySelector('#modalContent .v21-choice-grid'),pair=getContext();
    if(!grid||!pair||document.getElementById('v29Adjust'))return;
    const selected=document.getElementById('v21ChargeRef');if(selected&&context)context.ref=selected.value;
    // A opção de quitação usa o extrato completo (juros vencidos, juros diários
    // e proporcionais do período). A quitação antiga considerava só o mês atual.
    const payoff=document.getElementById('v21Payoff');
    if(payoff&&typeof window.openEarlyCloseV28==='function'){
      payoff.onclick=()=>window.openEarlyCloseV28(pair.cl.id,pair.k.id);
      const desc=payoff.querySelector('small');
      if(desc)desc.textContent='Verificar extrato integral, juros de atraso e saldo antes de quitar.';
      try{
        const closeQuote=window.earlyCloseStatement(pair.cl.id,pair.k.id,dateISO(new Date()));
        const values=document.querySelectorAll('#modalContent .v21-summary strong');
        if(values.length>=3){
          values[0].textContent=brl(closeQuote.principal/100);
          values[1].textContent=brl(closeQuote.interest/100);
          values[2].textContent=brl(closeQuote.total/100);
        }
      }catch(err){console.warn('Não foi possível atualizar a prévia de quitação.',err);}
    }
    const inc=document.createElement('button');inc.type='button';inc.className='v21-choice';inc.id='v29Adjust';
    inc.innerHTML='<span class="ico">↕</span><span><b>Aumentar / diminuir valor</b><small>Acrescentar capital ou iniciar amortização na aba Pagamentos.</small></span>';
    inc.onclick=openAdjustment;
    const st=document.createElement('button');st.type='button';st.className='v21-choice';st.id='v29Statement';
    st.innerHTML='<span class="ico">▤</span><span><b>Enviar extrato ao cliente</b><small>Cobranças em aberto e encargos de atraso lançados manualmente.</small></span>';
    st.onclick=()=>{
      const {cl,k}=getContext();const msg=statement(cl,k,new Date());
      const phone=String(cl.phone||'').replace(/\D/g,'');
      if(phone.length>=10&&typeof window.prepareReceiptV25==='function'){
        window.prepareReceiptV25(cl,msg,'Extrato preparado. Nenhum pagamento foi registrado e a mensagem ainda precisa ser enviada.');
      }else{
        openModal(`<h2>Extrato para copiar</h2><p class="muted">Cadastre um telefone com DDD para abrir o WhatsApp.</p><textarea readonly rows="14" id="v29StatementText">${esc(msg)}</textarea><div class="actions"><button type="button" class="soft-btn" id="v29CopyStatement">Copiar extrato</button></div>`,()=>{
          document.getElementById('v29CopyStatement').onclick=async()=>{
            const field=document.getElementById('v29StatementText');
            try{await navigator.clipboard.writeText(field.value)}
            catch(_){field.focus();field.select();}
          };
        });
      }
    };
    const manual=document.createElement('button');manual.type='button';manual.className='v21-choice';manual.id='v29ManualLate';
    manual.innerHTML='<span class="ico">✎</span><span><b>Inserir juros de atraso</b><small>Informar manualmente o valor e a referência da cobrança.</small></span>';
    manual.onclick=openManualLateInterest;
    grid.append(inc,manual,st);
    const [y,m]=String(context?.ref||'').split('-').map(Number);
    if(y&&m){const r=chargeFor(pair.cl,pair.k,y,m-1);
      if(r.lateInterest>0){
        const note=document.createElement('p');note.className='rule-note';note.id='v29LateNote';
        note.textContent=`Juros de atraso manuais: ${brl(r.lateInterest)}; total pendente nesta referência: ${brl(r.remaining)}.`;
        grid.before(note);
      }
    }
  }
  function decorateParcel(){
    const container=document.getElementById('v21ConfirmParcel')?.closest('#modalContent'),pair=getContext();
    if(!container||!pair||document.getElementById('v29ParcelLate'))return;
    const field=document.createElement('div');field.className='rule-note';field.id='v29ParcelLate';
    const first=container.querySelector('.card');if(first)first.after(field);
    let lastQuoted=null;
    const refresh=()=>{
      const ref=document.getElementById('v21Ref')?.value,at=document.getElementById('v21Date')?.value;
      const [y,m]=String(ref||'').split('-').map(Number);
      if(!y||!m||m<1||m>12){field.textContent='Selecione uma referência válida.';return;}
      const r=chargeFor(pair.cl,pair.k,y,m-1,at);
      const input=document.getElementById('v21Amount');
      if(input&&lastQuoted!==null&&cents(input.value)===lastQuoted)input.value=Number(r.remaining).toFixed(2);
      lastQuoted=cents(r.remaining);
      field.textContent=r.lateInterest>0?`Juros de atraso manuais: ${brl(r.lateInterest)}. Total para a referência na data escolhida: ${brl(r.remaining)}.`:
        'Sem juros adicionais de atraso na data informada.';
    };
    container.querySelector('#v21Date')?.addEventListener('change',refresh);
    container.querySelector('#v21Ref')?.addEventListener('change',refresh);
    refresh();
  }
  if(typeof window.openPaymentsHubV21==='function'){
    const hub=window.openPaymentsHubV21;
    window.openPaymentsHubV21=function(clientId,contractId,ref){
      context={clientId,contractId,ref};return hub(clientId,contractId,ref);
    };
    openPaymentModal=window.openPaymentsHubV21;
  }
  if(typeof renderLoans2==='function'){
    const previous=renderLoans2;renderLoans2=function(...args){const result=previous(...args);clearOldButtons(document.getElementById('view'));return result;};
  }
  if(typeof openClientDetail==='function'){
    const previous=openClientDetail;openClientDetail=function(...args){const result=previous(...args);clearOldButtons(document.getElementById('modalContent'));return result;};
  }
  if(typeof renderCharges==='function'){
    const previous=renderCharges;renderCharges=function(...args){
      const result=previous(...args);
      document.querySelectorAll('#view [data-v21-client]').forEach(button=>{
        const cl=(state.clients||[]).find(x=>x.id===button.dataset.v21Client),k=cl?.contracts?.find(x=>x.id===button.dataset.v21Loan);
        const [y,m]=String(button.dataset.v21Ref||'').split('-').map(Number),card=button.closest('.list-item');
        if(!cl||!k||!y||!m||!card||card.querySelector('.v29-charge-late'))return;
        const r=chargeFor(cl,k,y,m-1);if(!r.lateInterest)return;
        const note=document.createElement('small');note.className='v29-charge-late muted';note.style.display='block';
        note.textContent=`Inclui ${brl(r.lateInterest)} de juros de atraso lançados manualmente.`;
        card.append(note);
      });
      return result;
    };
  }
  clearOldButtons(document.getElementById('view'));
  clearOldButtons(document.getElementById('modalContent'));
  const previousModal=openModal;
  openModal=function(html,bind){
    return previousModal(html,()=>{
      if(typeof bind==='function')bind();
      clearOldButtons(document.getElementById('modalContent'));
      if(document.getElementById('v21Payoff'))decorateHub();
      if(document.getElementById('v21ConfirmParcel'))decorateParcel();
    });
  };
})();
