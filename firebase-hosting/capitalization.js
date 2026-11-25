/* Incorporação de juros atrasados ao capital: somente manual, por contrato, com estorno.
   Também mantém a compatibilidade histórica e o estorno da atualização automática de 09/11/2026. */
(function(){
  'use strict';
  const BATCH='capitalizacao-atrasos-2026-11-09',DATE='2026-11-09',MANUAL='capitalizacao-manual-';
  const cents=v=>Math.round((Number(v)||0)*100);
  const money=v=>v/100;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const isoDate=v=>v instanceof Date?ymd(v):String(v||todayISO()).slice(0,10);
  const validDay=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return false;const d=new Date(+m[1],+m[2]-1,+m[3],12);return ymd(d)===v;};
  const isCap=v=>v&&v.kind==='interest_capitalization';
  const rawCharge=chargeFor;
  // Um registro de capitalização só vale enquanto o movimento correspondente existir.
  // Registros antigos (sem batchId) pertencem à atualização automática de 09/11/2026.
  function snapshotActive(k,snapshot){
    if(!snapshot)return false;
    const batch=snapshot.batchId||BATCH;
    return (k.movements||[]).some(v=>isCap(v)&&v.batchId===batch);
  }
  chargeFor=function(cl,k,y,m,asOf){
    const ref=`${y}-${String(m+1).padStart(2,'0')}`;
    const snapshot=k.capitalizedCharges?.[ref];
    const at=isoDate(asOf);
    if(snapshotActive(k,snapshot)&&at>=snapshot.date){
      return {...rawCharge(cl,k,y,m,asOf),...snapshot.quote,
        due:new Date(snapshot.due+'T12:00:00'),originalDue:new Date(snapshot.originalDue+'T12:00:00'),
        remaining:0,status:snapshot.incorporated>0?'capitalized':snapshot.quote.status,
        capitalizedAmount:snapshot.incorporated,capitalizedAt:snapshot.date};
    }
    const caps=(k.movements||[]).filter(isCap);
    if(!caps.length)return rawCharge(cl,k,y,m,asOf);
    // Juros incorporados só aumentam as cobranças que vencem depois da incorporação
    // (e só em consultas a partir da data dela). Cobranças anteriores mantêm o capital da época.
    const row=rawCharge(cl,k,y,m,asOf),due=row.due?ymd(row.due):'';
    const later=caps.filter(v=>String(v.date||'')>at||(due&&String(v.date||'')>=due));
    if(!later.length)return row;
    const historical={...k,movements:(k.movements||[]).filter(v=>!later.includes(v))};
    return {...rawCharge(cl,historical,y,m,asOf),c:k};
  };

  // ----- Incorporação manual -----
  function overdueRows(cl,k,date){
    const first=firstPaymentDate(k);
    if(!first)return [];
    const [yy,mm]=date.split('-').map(Number),from=first.getFullYear()*12+first.getMonth(),to=yy*12+mm-1,rows=[];
    for(let i=from;i<=to&&i<from+1200;i++){
      const q=chargeFor(cl,k,Math.floor(i/12),i%12,date);
      if(q.status==='not_due'||q.status==='capitalized'||!q.due||ymd(q.due)>=date||cents(q.remaining)<=0)continue;
      rows.push(q);
    }
    return rows;
  }
  function manualPlan(cl,k,date){
    if(!k||k.active===false||isPaidContract(k))throw Error('Este contrato está encerrado.');
    if(k.billingType==='amortization')throw Error('Contrato sem cobrança mensal de juros.');
    if(!validDay(date)||date>todayISO())throw Error('Informe uma data válida, até hoje.');
    const rows=overdueRows(cl,k,date);
    return {date,rows,total:money(rows.reduce((t,q)=>t+cents(q.remaining),0)),balance:contractBalance(k)};
  }
  function capitalizeManual(cl,k,{date,refs,note}={}){
    const plan=manualPlan(cl,k,date),wanted=new Set(refs||[]);
    if(!wanted.size)throw Error('Selecione ao menos uma cobrança atrasada.');
    const rows=plan.rows.filter(q=>wanted.has(q.ref));
    if(rows.length!==wanted.size)throw Error('Uma das cobranças mudou. Abra a incorporação novamente.');
    // Lançamentos posteriores à data escolhida ficariam fora do valor incorporado.
    for(const q of rows){
      if((k.payments||[]).some(p=>String(p.reference||p.ref||'')===q.ref&&String(p.paidAt||p.date||'').slice(0,10)>date))
        throw Error(`A referência ${q.ref} tem pagamento posterior a ${date.split('-').reverse().join('/')}. Escolha uma data igual ou posterior.`);
      if((k.manualLateInterest||[]).some(e=>e.reference===q.ref&&e.date>date))
        throw Error(`A referência ${q.ref} tem juros de atraso lançados depois dessa data. Escolha uma data igual ou posterior.`);
    }
    if((k.movements||[]).some(v=>isCap(v)&&String(v.date||'')>date))
      throw Error('Já existe incorporação com data posterior. Use uma data igual ou posterior a ela.');
    const amountCents=rows.reduce((t,q)=>t+cents(q.remaining),0);
    if(amountCents<=0)throw Error('Não há valor atrasado para incorporar.');
    const previous=clone(k),now=new Date().toISOString(),batchId=MANUAL+uid('cap');
    try{
      const before=contractBalance(k),snapshots={};
      for(const q of rows)snapshots[q.ref]={batchId,manual:true,date,due:ymd(q.due),originalDue:ymd(q.originalDue||q.due),incorporated:q.remaining,
        quote:{amount:q.amount,baseAmount:q.baseAmount??q.amount,lateInterest:q.lateInterest||0,lateDays:q.lateDays||0,paid:q.paid||0,status:q.status}};
      k.capitalizedCharges={...k.capitalizedCharges,...snapshots};
      k.movements=k.movements||[];
      const movement={id:batchId,batchId,type:'increase',kind:'interest_capitalization',nonCash:true,manual:true,
        amount:money(amountCents),date,references:rows.map(q=>q.ref),balanceBefore:before,balanceAfter:money(cents(before)+amountCents),
        note:String(note||'').trim()||`Juros atrasados incorporados ao capital (${rows.map(q=>q.ref).join(', ')}). Sem recebimento ou nova liberação.`,createdAt:now};
      k.movements.push(movement);
      k.currentPrincipal=contractBalance(k);k.lastBalanceUpdate=date;k.updatedAt=now;
      saveState();return movement;
    }catch(error){Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,previous);throw error;}
  }
  function manualEntries(k){return (k.movements||[]).filter(v=>isCap(v)&&String(v.batchId||'').startsWith(MANUAL));}
  function reverseManual(cl,k,batchId){
    const movement=manualEntries(k).find(v=>v.batchId===batchId);
    if(!movement)throw Error('Incorporação não encontrada.');
    const caps=(k.movements||[]).filter(isCap),last=caps.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))).at(-1);
    if(last!==movement)throw Error('Desfaça primeiro a incorporação mais recente.');
    if((k.movements||[]).some(v=>!isCap(v)&&String(v.date||'')>movement.date)||k.active===false||isPaidContract(k))
      throw Error('O contrato teve alterações de capital depois desta incorporação. Ajuste manualmente.');
    const previous=clone(k);
    try{
      k.movements=k.movements.filter(v=>v!==movement);
      for(const [ref,s] of Object.entries(k.capitalizedCharges||{}))if(s.batchId===batchId)delete k.capitalizedCharges[ref];
      k.currentPrincipal=contractBalance(k);k.updatedAt=new Date().toISOString();
      saveState();return movement;
    }catch(error){Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,previous);throw error;}
  }

  // ----- Tela (aba Pagamentos) -----
  const brDate=v=>String(v||'').split('-').reverse().join('/');
  function openManual(cl,k,date){
    date=date||todayISO();
    let plan;try{plan=manualPlan(cl,k,date);}catch(error){alert(error.message);return;}
    const history=manualEntries(k).slice().reverse();
    openModal(`<h2>Incorporar juros ao capital</h2><p class="muted">${esc(cl.name)} · ${esc(k.loanCode||k.title||'Contrato')}</p>
      <div class="field"><label for="capDate">Data da incorporação</label><input id="capDate" type="date" max="${todayISO()}" value="${esc(date)}" required></div>
      ${plan.rows.length?`<div class="card" id="capRows">${plan.rows.map(q=>`<label class="row space" style="gap:10px;padding:6px 0"><span><input type="checkbox" data-cap-ref="${esc(q.ref)}" data-cap-value="${cents(q.remaining)}" checked> ${esc(q.ref)} · venc. ${q.due.toLocaleDateString('pt-BR')}${q.lateInterest?` · inclui ${brl(q.lateInterest)} de atraso`:''}</span><strong>${brl(q.remaining)}</strong></label>`).join('')}</div>
      <div class="card"><div class="row space"><span class="muted">Capital atual</span><strong>${brl(plan.balance)}</strong></div>
      <div class="row space"><span class="muted">Juros a incorporar</span><strong id="capTotal">${brl(plan.total)}</strong></div>
      <div class="row space"><span class="muted">Novo capital</span><strong id="capNew">${brl(plan.balance+plan.total)}</strong></div>
      <div class="muted" id="capNext"></div></div>
      <div class="field"><label for="capNote">Observação</label><textarea id="capNote" placeholder="Ex.: combinado com o cliente"></textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="capConfirm">Incorporar ao capital</button><button type="button" class="soft-btn" id="capBack">Voltar</button></div>`
      :`<div class="empty">Nenhuma cobrança atrasada em aberto nesta data.</div><div class="actions"><button type="button" class="soft-btn" id="capBack">Voltar</button></div>`}
      <p class="rule-note">As cobranças marcadas saem da lista de atrasados e o valor passa a fazer parte do capital; os próximos juros mensais são calculados sobre o novo capital. Não registra recebimento nem dinheiro liberado.</p>
      ${history.length?`<h3>Incorporações feitas</h3>${history.map(v=>`<div class="card"><div class="row space"><span>${brDate(v.date)} · ${esc((v.references||[]).join(', '))}</span><strong>+ ${brl(v.amount)}</strong></div><div class="muted">${esc(v.note||'')}</div><button type="button" class="soft-btn" data-cap-undo="${esc(v.batchId)}" style="margin-top:6px">Desfazer</button></div>`).join('')}`:''}`,()=>{
      const back=()=>window.openPaymentsHubV21?window.openPaymentsHubV21(cl.id,k.id):closeModal();
      document.getElementById('capBack').onclick=back;
      document.getElementById('capDate').onchange=e=>openManual(cl,k,e.target.value);
      const boxes=[...document.querySelectorAll('[data-cap-ref]')];
      const refresh=()=>{
        const total=boxes.filter(b=>b.checked).reduce((t,b)=>t+Number(b.dataset.capValue),0),next=money(cents(plan.balance)+total);
        const t=document.getElementById('capTotal');if(!t)return;
        t.textContent=brl(money(total));document.getElementById('capNew').textContent=brl(next);
        document.getElementById('capNext').textContent=k.billingType==='fixed'?'Parcela fixa não muda.':`Juros mensais sobre o novo capital: ${brl(next*(Number(k.interestRate)||0)/100)}`;
      };
      boxes.forEach(b=>b.onchange=refresh);refresh();
      const confirmBtn=document.getElementById('capConfirm');
      if(confirmBtn)confirmBtn.onclick=async e=>{
        const button=e.currentTarget;if(button.disabled)return;
        const refs=boxes.filter(b=>b.checked).map(b=>b.dataset.capRef);
        if(!refs.length){alert('Selecione ao menos uma cobrança.');return;}
        const total=boxes.filter(b=>b.checked).reduce((t,b)=>t+Number(b.dataset.capValue),0);
        if(!confirm(`Incorporar ${brl(money(total))} ao capital de ${cl.name}? Novo capital: ${brl(money(cents(contractBalance(k))+total))}.`))return;
        button.disabled=true;
        try{
          capitalizeManual(cl,k,{date,refs,note:document.getElementById('capNote').value});
          if(window.CREDIGESTOR_MULTITENANT&&window.CrediGestorCloud?.flush)await window.CrediGestorCloud.flush();
          render();openManual(cl,k,date);
        }catch(error){alert('A incorporação não foi feita: '+error.message);button.disabled=false;}
      };
      document.querySelectorAll('[data-cap-undo]').forEach(b=>b.onclick=async()=>{
        if(!confirm('Desfazer esta incorporação? O capital volta ao valor anterior e as cobranças voltam para atrasadas.'))return;
        try{
          reverseManual(cl,k,b.dataset.capUndo);
          if(window.CREDIGESTOR_MULTITENANT&&window.CrediGestorCloud?.flush)await window.CrediGestorCloud.flush();
          render();openManual(cl,k,date);
        }catch(error){alert(error.message);}
      });
    });
  }
  function decorateHub(){
    const grid=document.querySelector('#modalContent .v21-choice-grid');
    if(!grid||document.getElementById('capManual'))return;
    const pair=window.CrediGestorOverdueV29?.hubContext?.();if(!pair)return;
    const {cl,k}=pair;if(k.active===false||isPaidContract(k)||k.billingType==='amortization')return;
    const button=document.createElement('button');button.type='button';button.className='v21-choice';button.id='capManual';
    button.innerHTML='<span class="ico">⤴</span><span><b>Incorporar juros ao capital</b><small>Somar juros atrasados ao capital, escolhendo as cobranças.</small></span>';
    button.onclick=()=>openManual(cl,k);
    grid.append(button);
  }
  if(typeof openModal==='function'){
    const previousModal=openModal;
    openModal=function(html,bind){
      return previousModal(html,()=>{
        if(typeof bind==='function')bind();
        if(document.getElementById('v21Payoff'))decorateHub();
      });
    };
  }

  // ----- Compatibilidade com a atualização automática de 09/11/2026 (desativada) -----
  function plan(){return {entries:[],skipped:[]};}
  function apply(){return null;}
  function reverseAutomatic(){
    const reversalId='estorno-'+BATCH;
    if(state.automaticInterestReversals?.[reversalId])return null;
    const previous=clone(state),entries=[];
    for(const cl of state.clients||[])for(const k of cl.contracts||[]){
      const movements=(k.movements||[]).filter(v=>v.batchId===BATCH&&v.kind==='interest_capitalization');
      if(movements.length)entries.push({cl,k,movements});
    }
    if(!entries.length)return null;
    // Cópia antes de remover apenas movimentos identificados da atualização.
    const recoveryKey='credigestor_recovery_'+reversalId;
    if(!localStorage.getItem(recoveryKey))localStorage.setItem(recoveryKey,JSON.stringify(previous));
    try{
      let total=0;
      for(const {k,movements} of entries){
        k.movements=k.movements.filter(v=>!movements.includes(v));
        for(const [ref,snapshot] of Object.entries(k.capitalizedCharges||{}))if(snapshot.date===DATE&&!snapshot.manual)delete k.capitalizedCharges[ref];
        total+=movements.reduce((sum,v)=>sum+cents(v.amount),0);
        k.currentPrincipal=contractBalance(k);k.updatedAt=new Date().toISOString();
      }
      const summary={date:todayISO(),contracts:entries.length,total:total/100,
        removed:entries.map(({cl,k,movements})=>({clientId:cl.id,contractId:k.id,movements:clone(movements)}))};
      state.automaticInterestReversals={...state.automaticInterestReversals,[reversalId]:summary};
      saveState();render();return summary;
    }catch(error){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,previous);throw error;}
  }
  window.CrediGestorCapitalization={plan,apply,reverseAutomatic,batchId:BATCH,
    manualPlan,capitalizeManual,reverseManual,openManual};
})();
