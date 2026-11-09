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
  function accruedLateInterest(k,row,untilValue){
    const until=day(untilValue),due=day(row.originalDue||row.due),base=cents(row.amount),rate=Number(k.interestRate)||0;
    if(!until||!due||ordinal(until)<=ordinal(due)||base<=0||rate<=0||isPaidContract(k))return {cents:0,days:0};
    const paid=(k.payments||[]).filter(p=>matching(p,row.ref)&&cents(p.amount)>0&&day(p.paidAt||p.date))
      .map(p=>({when:ordinal(day(p.paidAt||p.date)),amount:cents(p.amount)})).sort((a,b)=>a.when-b.when);
    const theoretical=k.billingType==='interest'?base:cents(contractBalance(k)*rate/100);
    let index=0,paidBase=0,interest=0,days=0;
    const start=ordinal(due)+1,end=ordinal(until);
    // Juros simples, por dia civil e pela quantidade de dias do mês, sobre a
    // fração do valor-base ainda não paga; nunca capitaliza juros vencidos.
    for(let n=start;n<=end;n++){
      while(index<paid.length&&paid[index].when<n)paidBase+=paid[index++].amount;
      const pending=Math.max(0,base-paidBase);
      if(!pending)break;
      const civil=new Date(n*MS),monthDays=new Date(civil.getUTCFullYear(),civil.getUTCMonth()+1,0).getDate();
      interest+=theoretical*(pending/base)/monthDays;
      days++;
    }
    return {cents:Math.max(0,Math.round(interest)),days};
  }
  const previousCharge=chargeFor;
  chargeFor=function(cl,k,year,monthIndex,asOfValue){
    const row=previousCharge(cl,k,year,monthIndex),asOf=day(asOfValue);
    if(!asOf||row.status==='not_due'||isPaidContract(k))return {...row,baseAmount:row.amount,lateInterest:0,lateDays:0};
    const base=cents(row.amount),extra=accruedLateInterest(k,row,asOf);
    // Historicamente os pagamentos são datados; não usar lançamentos futuros
    // para abater o saldo de uma consulta retroativa.
    const paid=cents((k.payments||[]).filter(p=>matching(p,row.ref)&&ordinal(day(p.paidAt||p.date)||asOf)<=ordinal(asOf))
      .reduce((total,p)=>total+Math.max(0,Number(p.amount)||0),0));
    const due=day(row.originalDue||row.due),remaining=Math.max(0,base+extra.cents-paid);
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
      if(row.status!=='not_due'&&row.remaining>0&&ordinal(day(row.originalDue||row.due))<=ordinal(end))rows.push(row);
    }
    return rows;
  }
  function statement(cl,k,asOf){
    const when=day(asOf),rows=monthRows(cl,k,when),total=rows.reduce((n,r)=>n+cents(r.remaining),0);
    const late=rows.reduce((n,r)=>n+cents(r.lateInterest),0);
    const text=[`*EXTRATO DE COBRANÇA — CREDIGESTOR*`,`Cliente: ${cl.name}`,`Contrato: ${k.loanCode||k.title||'Contrato'}`,`Atualizado em: ${when.toLocaleDateString('pt-BR')}`,`Capital ativo (informativo): ${brl(contractBalance(k))}`,``];
    if(!rows.length)text.push('Nenhuma cobrança vencida permanece em aberto nesta data.');
    rows.forEach(r=>text.push(`Referência ${r.ref} · vence em ${day(r.originalDue||r.due).toLocaleDateString('pt-BR')}`,
      `Cobrança original: ${brl(r.baseAmount)}`,`Juros proporcionais por atraso: ${brl(r.lateInterest)} (${r.lateDays} dia(s) calculado(s))`,
      `Valores já registrados: ${brl(r.paid)}`,`Saldo desta referência: ${brl(r.remaining)}`,``));
    text.push(`Juros de atraso nas referências abertas: ${brl(money(late))}`,
      `*TOTAL DAS COBRANÇAS EM ABERTO: ${brl(money(total))}*`,
      `O capital informado acima não integra este total de parcelas/juros. Para quitação integral, solicite o extrato de encerramento.`);
    return text.join('\n');
  }
  window.CrediGestorOverdueV29.statement=statement;
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
  function decorateHub(){
    const grid=document.querySelector('#modalContent .v21-choice-grid'),pair=getContext();
    if(!grid||!pair||document.getElementById('v29Adjust'))return;
    const selected=document.getElementById('v21ChargeRef');if(selected&&context)context.ref=selected.value;
    const inc=document.createElement('button');inc.type='button';inc.className='v21-choice';inc.id='v29Adjust';
    inc.innerHTML='<span class="ico">↕</span><span><b>Aumentar / diminuir valor</b><small>Acrescentar capital ou iniciar amortização na aba Pagamentos.</small></span>';
    inc.onclick=openAdjustment;
    const st=document.createElement('button');st.type='button';st.className='v21-choice';st.id='v29Statement';
    st.innerHTML='<span class="ico">▤</span><span><b>Enviar extrato ao cliente</b><small>Cobranças em aberto com juros proporcionais desde o 1º dia de atraso.</small></span>';
    st.onclick=()=>{
      const {cl,k}=getContext();const msg=statement(cl,k,new Date());
      if(typeof window.prepareReceiptV25==='function')window.prepareReceiptV25(cl,msg,'Extrato preparado. Nenhum pagamento foi registrado e a mensagem ainda precisa ser enviada.');
      else openModal(`<h2>Extrato para copiar</h2><textarea readonly rows="14" id="v29StatementText">${esc(msg)}</textarea>`,()=>{
        document.getElementById('v29StatementText').select();
      });
    };
    grid.append(inc,st);
    const [y,m]=String(context?.ref||'').split('-').map(Number);
    if(y&&m){const r=chargeFor(pair.cl,pair.k,y,m-1);
      if(r.lateInterest>0){
        const note=document.createElement('p');note.className='rule-note';note.id='v29LateNote';
        note.textContent=`Atraso: ${r.lateDays} dia(s) com juros proporcionais de ${brl(r.lateInterest)}; total pendente nesta referência: ${brl(r.remaining)}.`;
        grid.before(note);
      }
    }
  }
  function decorateParcel(){
    const container=document.getElementById('v21ConfirmParcel')?.closest('#modalContent'),pair=getContext();
    if(!container||!pair||document.getElementById('v29ParcelLate'))return;
    const field=document.createElement('div');field.className='rule-note';field.id='v29ParcelLate';
    const first=container.querySelector('.card');if(first)first.after(field);
    const refresh=()=>{
      const ref=document.getElementById('v21Ref')?.value,at=document.getElementById('v21Date')?.value;
      const [y,m]=String(ref||'').split('-').map(Number);
      if(!y||!m||m<1||m>12){field.textContent='Selecione uma referência válida.';return;}
      const r=chargeFor(pair.cl,pair.k,y,m-1,at);
      field.textContent=r.lateInterest>0?`Juros proporcionais de atraso: ${brl(r.lateInterest)} (${r.lateDays} dia(s)). Total para a referência na data escolhida: ${brl(r.remaining)}.`:
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
        note.textContent=`Inclui ${brl(r.lateInterest)} de juros proporcionais por atraso (${r.lateDays} dia(s)).`;
        card.append(note);
      });
      return result;
    };
  }
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
