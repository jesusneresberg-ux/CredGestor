/* CrediGestor - Encerramento de contrato a qualquer momento (2026.11.04)
 * Extrato com capital, juros em atraso e juros proporcionais aos dias corridos
 * do período atual. O valor recebido paga primeiro os juros (atrasados e depois
 * proporcionais) e o restante abate o capital. Se cobrir tudo, o contrato é
 * quitado e encerrado; se não, continua ativo com o capital reduzido. */
(function(){
  'use strict';
  if(typeof state==='undefined'||typeof chargeFor!=='function')return;

  const DAY=86400000;
  const cents=v=>Math.round((Number(v)||0)*100);
  const money=c=>c/100;
  const refOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const noon=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0);
  const fmt=d=>d.toLocaleDateString('pt-BR');
  function parseDay(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12,0,0);return ymd(d)===v?d:null}
  function localToday(){return ymd(new Date())}
  function days(a,b){return Math.round((noon(b)-noon(a))/DAY)}
  function find(clientId,contractId){const cl=(state.clients||[]).find(x=>x.id===clientId),k=cl?.contracts?.find(x=>x.id===contractId);return {cl,k}}
  function code(k){return k?.loanCode||k?.title||'Contrato'}

  /* Ajuste de cobrança: após um abatimento de capital no meio do período, a
   * cobrança do mês corrente passa a valer juros proporcionais sobre o capital
   * antigo (já pagos) + juros proporcionais sobre o novo capital nos dias restantes. */
  const baseCharge=chargeFor;
  chargeFor=function(cl,k,y,m){
    const row=baseCharge(cl,k,y,m),adj=k?.chargeAdjustments?.[row.ref];
    if(!adj||row.status==='not_due'||isPaidContract(k))return row;
    row.amount=money(Math.max(0,cents(row.amount)+cents(adj.amount)));
    row.remaining=money(Math.max(0,cents(row.amount)-cents(row.paid)));
    const now=new Date();now.setHours(0,0,0,0);const due=new Date(row.due);due.setHours(0,0,0,0);
    row.status=row.remaining===0?'paid':due<now?'late':'open';row.adjusted=true;
    return row;
  };

  /* Período atual: do último vencimento (ou início do contrato) até o próximo vencimento. */
  function currentPeriod(k,closing){
    const first=firstPaymentDate(k),start=contractStartDate(k),idx=d=>d.getFullYear()*12+d.getMonth(),at=i=>dueDateFor(Math.floor(i/12),((i%12)+12)%12,k.baseDueDay);
    if(first&&ymd(closing)<ymd(first))return {from:start||at(idx(first)-1),to:first,ref:refOf(first)};
    const firstIdx=first?idx(first):null;let i=first?firstIdx:idx(closing)-1,prev=null;
    for(let guard=0;guard<1300;guard++,i++){
      const due=i===firstIdx?first:at(i);
      if(ymd(due)>ymd(closing))return {from:prev||at(i-1),to:due,ref:refOf(due)};
      prev=due;
    }
    throw Error('Não foi possível calcular o período de juros deste contrato.');
  }

  /* Cobranças ainda em aberto cujo vencimento (original) é até a data de encerramento. */
  function overdueCharges(cl,k,closing,currentRef){
    const first=firstPaymentDate(k);if(!first)return [];
    const refs=new Set(Object.keys(k.dueDateOverrides||{})),last=closing.getFullYear()*12+closing.getMonth();
    for(let i=first.getFullYear()*12+first.getMonth();i<=last;i++)refs.add(`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);
    return [...refs].filter(ref=>ref!==currentRef).map(ref=>{const [y,m]=ref.split('-').map(Number);return chargeFor(cl,k,y,m-1,closing)})
      .filter(x=>x.status!=='not_due'&&x.remaining>0&&ymd(x.due)<=ymd(closing))
      .sort((a,b)=>(a.originalDue||a.due)-(b.originalDue||b.due)||a.ref.localeCompare(b.ref));
  }

  function statement(cl,k,closingISO){
    const closing=parseDay(closingISO);if(!closing)throw Error('Informe uma data de encerramento válida.');
    const start=contractStartDate(k);if(start&&closing<start)throw Error('A data de encerramento não pode ser anterior ao início do contrato.');
    const period=currentPeriod(k,closing),periodDays=Math.max(1,days(period.from,period.to)),elapsed=Math.min(periodDays,Math.max(0,days(period.from,closing)));
    const capitalizedOn=(k.movements||[]).filter(v=>v.kind==='interest_capitalization'&&v.date<=closingISO).map(v=>v.date).sort().at(-1);
    const accrualFrom=capitalizedOn&&capitalizedOn>ymd(period.from)?parseDay(capitalizedOn):period.from;
    const effectiveElapsed=Math.min(periodDays,Math.max(0,days(accrualFrom,closing)));
    const monthly=cents(monthlyDue(k)),paidCurrent=cents(paymentTotalForMonth(k,period.ref));
    const accrued=Math.round(monthly*effectiveElapsed/periodDays),proportional=Math.max(0,accrued-paidCurrent);
    const overdue=overdueCharges(cl,k,closing,period.ref).map(x=>({ref:x.ref,due:x.due,remaining:cents(x.remaining),amount:cents(x.amount),paid:cents(x.paid)}));
    const overdueTotal=overdue.reduce((t,x)=>t+x.remaining,0),principal=cents(contractBalance(k));
    return {closing,closingISO,period,periodDays,elapsed:effectiveElapsed,monthly,paidCurrent,accrued,proportional,overdue,overdueTotal,principal,interest:overdueTotal+proportional,total:principal+overdueTotal+proportional,rate:Number(k.interestRate)||0,billingType:k.billingType};
  }
  window.earlyCloseStatement=(clientId,contractId,date)=>{const {cl,k}=find(clientId,contractId);return statement(cl,k,date||localToday())};

  /* Distribui o valor recebido: juros em atraso (mais antigos primeiro), juros proporcionais, capital. */
  function allocate(s,amount){
    let left=amount;const overdue=s.overdue.map(x=>{const pay=Math.min(x.remaining,left);left-=pay;return {...x,pay}}).filter(x=>x.pay>0);
    const proportional=Math.min(s.proportional,left);left-=proportional;
    const capital=Math.min(s.principal,left);left-=capital;
    return {overdue,proportional,capital,excess:left,overduePaid:overdue.reduce((t,x)=>t+x.pay,0),payoff:amount>=s.total};
  }
  window.earlyCloseAllocate=allocate;

  function persist(cl,k,previous){
    try{
      const canonical=state.clients.find(x=>x.id===cl.id)?.contracts?.find(x=>x.id===k.id);
      if(canonical!==k)throw Error('O contrato foi atualizado. Abra o encerramento novamente.');
      saveState();
      if(!window.CREDIGESTOR_MULTITENANT){
        const saved=JSON.parse(localStorage.getItem(DB_KEY)||'null'),stored=saved?.clients?.find(x=>x.id===cl.id)?.contracts?.find(x=>x.id===k.id);
        if(!stored||JSON.stringify(stored)!==JSON.stringify(k))throw Error('O registro não foi confirmado no armazenamento. Nada foi alterado.');
      }
    }catch(error){Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,previous);throw error}
  }

  function register(cl,k,s,amountCents,method,note,paymentDetails={}){
    const paymentMeta=PaymentMethods.details(method,paymentDetails.paymentDetails);
    if(k.active===false||isPaidContract(k))throw Error('Este contrato já está encerrado.');
    if(!Number.isFinite(amountCents)||amountCents<=0)throw Error('Informe o valor recebido.');
    if(amountCents>s.total)throw Error(`O valor recebido passa do total para quitação (${brl(money(s.total))}). Informe até esse valor.`);
    const a=allocate(s,amountCents),paidAt=s.closingISO,now=new Date().toISOString(),previous=JSON.parse(JSON.stringify(k));
    const detail={closingDate:paidAt,periodStart:ymd(s.period.from),periodEnd:ymd(s.period.to),daysElapsed:s.elapsed,periodDays:s.periodDays,principalBefore:money(s.principal),overdueInterest:money(a.overduePaid),proportionalInterest:money(a.proportional),capitalPaid:money(a.capital)};
    k.payments=k.payments||[];k.movements=k.movements||[];
    if(a.payoff){
      const payment={...paymentMeta,id:uid('py'),reference:s.period.ref,amount:money(amountCents),principalAmount:money(s.principal),interestAmount:money(s.interest),paidAt,method,note:note||'Encerramento antecipado com juros proporcionais',status:'paid',type:'payoff',payoff:true,earlyTermination:true,statement:detail,createdAt:now};
      k.payments.push(payment);
      if(s.principal>0)k.movements.push({...paymentMeta,method,id:uid('mv'),type:'amortization',amount:money(s.principal),date:paidAt,note:'Encerramento do contrato — capital quitado',balanceBefore:money(s.principal),balanceAfter:0,payoff:true,createdAt:now});
      Object.assign(k,{currentPrincipal:0,active:false,status:'paid',loanStatus:'paid',closed:true,closedAt:paidAt,paidOffAt:paidAt,paidOffEarly:true,closedReason:`Encerramento antecipado — capital + juros proporcionais (${s.elapsed}/${s.periodDays} dias)`,lastBalanceUpdate:paidAt,nextDueDate:'',notificationsDisabled:true,updatedAt:now});
      persist(cl,k,previous);return {type:'payoff',allocation:a,payment,detail};
    }
    const records=[];
    a.overdue.forEach(x=>{const after=x.remaining-x.pay;records.push({...paymentMeta,referenceDate:ymd(x.due),id:uid('py'),reference:x.ref,amount:money(x.pay),paidAt,method,note:'Juros em atraso',status:after>0?'partial':'paid',type:after>0?'partial':'installment',monthTotal:money(x.amount),paidForMonthAfter:money(x.paid+x.pay),remainingForMonth:money(after),dueDateAtPayment:ymd(x.due),createdAt:now})});
    if(a.proportional>0)records.push({...paymentMeta,referenceDate:ymd(s.period.to),id:uid('py'),reference:s.period.ref,amount:money(a.proportional),paidAt,method,note:`Juros proporcionais (${s.elapsed} de ${s.periodDays} dias)`,status:'partial',type:'partial',proportionalInterest:true,createdAt:now});
    const group=uid('ec');records.forEach(r=>{r.earlyCloseGroup=group;if(note)r.note+=` • ${note}`});
    k.payments.push(...records);
    let movement=null;
    if(a.capital>0){
      const before=s.principal,after=before-a.capital,monthlyBefore=s.monthly;
      movement={...paymentMeta,id:uid('mv'),type:'amortization',amount:money(a.capital),date:paidAt,note:note||'Abatimento de capital no registro de encerramento',balanceBefore:money(before),balanceAfter:money(after),method,earlyCloseGroup:group,createdAt:now};
      k.movements.push(movement);k.currentPrincipal=money(after);k.lastBalanceUpdate=paidAt;
      // Juros do período já quitados sobre o capital antigo: a cobrança do mês fica proporcional ao novo capital nos dias restantes.
      if(a.proportional===s.proportional){
        const monthlyAfter=cents(monthlyDue(k)),extra=Math.round((monthlyBefore-monthlyAfter)*s.elapsed/s.periodDays);
        if(extra>0){k.chargeAdjustments=k.chargeAdjustments||{};const cur=cents(k.chargeAdjustments[s.period.ref]?.amount);k.chargeAdjustments[s.period.ref]={amount:money(cur+extra),reason:'Juros proporcionais já pagos sobre o capital anterior',createdAt:now}}
      }
    }
    k.earlyCloseRecords=k.earlyCloseRecords||[];k.earlyCloseRecords.push({...paymentMeta,id:group,...detail,amountReceived:money(amountCents),principalAfter:money(s.principal-a.capital),method,note,createdAt:now});
    k.updatedAt=now;persist(cl,k,previous);
    return {type:'partial',allocation:a,records,movement,detail,principalAfter:s.principal-a.capital};
  }
  window.registerEarlyClose=(clientId,contractId,date,amount,method,note,paymentDetails={})=>{const {cl,k}=find(clientId,contractId);if(!k)throw Error('Contrato não encontrado.');return register(cl,k,statement(cl,k,date),cents(amount),method||'PIX',note||'',paymentDetails)};

  function statementText(cl,k,s){
    const lines=[`📄 *Extrato de encerramento*`,``,`👤 Cliente: ${cl.name}`,`📄 Contrato: ${code(k)}`,`📅 Data de encerramento: ${fmt(s.closing)}`,``,`💰 Capital atual: ${brl(money(s.principal))}`];
    if(s.overdue.length){lines.push(`⏳ Em atraso: ${brl(money(s.overdueTotal))}`);s.overdue.forEach(x=>lines.push(`   • ref. ${x.ref} (venc. ${fmt(x.due)}): ${brl(money(x.remaining))}`))}
    lines.push(`📆 Juros proporcionais: ${brl(money(s.proportional))}`,`   • ${s.elapsed} de ${s.periodDays} dias (${fmt(s.period.from)} a ${fmt(s.period.to)})`,`   • juros do período cheio: ${brl(money(s.monthly))}${s.paidCurrent?` • já pago: ${brl(money(s.paidCurrent))}`:''}`);
    lines.push(``,`✅ *TOTAL PARA QUITAÇÃO: ${brl(money(s.total))}*`);
    return lines.join('\n');
  }
  function resultText(cl,k,s,r,amountCents){
    const a=r.allocation;
    const paymentInfo=PaymentMethods.receipt(r.payment||r.movement||r.records?.[0]).trim();
    if(r.type==='payoff')return [`🏦 *Contrato encerrado - ${code(k)}*`,``,`👤 Cliente: ${cl.name}`,`📅 Data: ${fmt(s.closing)}`,`💰 Capital quitado: ${brl(money(s.principal))}`,...(s.overdueTotal?[`⏳ Juros em atraso: ${brl(money(s.overdueTotal))}`]:[]),`📆 Juros proporcionais: ${brl(money(s.proportional))} (${s.elapsed} de ${s.periodDays} dias)`,`💵 Total pago: ${brl(money(amountCents))}`,``,`✅ Status: *QUITADO*`,paymentInfo].join('\n');
    return [`🧾 *Pagamento com abatimento de capital*`,``,`👤 Cliente: ${cl.name}`,`📄 Contrato: ${code(k)}`,`📅 Data: ${fmt(s.closing)}`,`💵 Valor recebido: ${brl(money(amountCents))}`,``,...(a.overduePaid?[`⏳ Juros em atraso pagos: ${brl(money(a.overduePaid))}`]:[]),`📆 Juros proporcionais pagos: ${brl(money(a.proportional))} (${s.elapsed} de ${s.periodDays} dias)`,`📉 Capital abatido: ${brl(money(a.capital))}`,``,`💰 *Capital restante: ${brl(money(r.principalAfter))}*`,`🔁 Novo valor mensal: ${brl(monthlyDue(k))}`,paymentInfo].join('\n');
  }

  function row(label,value,cls=''){return `<div class="${cls}"><small>${label}</small><strong>${value}</strong></div>`}
  function openEarlyClose(clientId,contractId,date,amountValue){
    const {cl,k}=find(clientId,contractId);if(!k)return;
    if(k.active===false||isPaidContract(k)){alert('Este contrato já está encerrado.');return}
    const closingISO=date||localToday();let s;
    try{s=statement(cl,k,closingISO)}catch(e){alert(e.message);return}
    const overdueHtml=s.overdue.length?`<div class="card"><div class="muted">Cobranças em atraso até a data</div>${s.overdue.map(x=>`<div class="row space"><span>ref. ${esc(x.ref)} · venc. ${fmt(x.due)}</span><strong>${brl(money(x.remaining))}</strong></div>`).join('')}</div>`:'';
    openModal(`<h2>Encerrar contrato</h2><div class="muted">${esc(cl.name)} • ${esc(code(k))}</div>
      <div class="field"><label for="ecDate">Data de encerramento</label><input id="ecDate" type="date" value="${esc(closingISO)}"></div>
      <div class="card" id="ecStatement"><div class="muted">Extrato em ${fmt(s.closing)}</div><div class="v21-summary">
        ${row('Capital atual',brl(money(s.principal)))}${row('Juros em atraso',brl(money(s.overdueTotal)))}
        ${row(`Juros proporcionais (${s.elapsed}/${s.periodDays} dias)`,brl(money(s.proportional)))}${row('Juros do período cheio',brl(money(s.monthly)))}
        ${row('Total para quitação',brl(money(s.total)),'v21-total')}</div>
        <div class="muted" style="margin-top:8px">Período: ${fmt(s.period.from)} a ${fmt(s.period.to)} (ref. ${esc(s.period.ref)})${s.paidCurrent?` • já pago no período: ${brl(money(s.paidCurrent))}`:''}</div></div>
      ${overdueHtml}
      <div class="actions"><button type="button" class="soft-btn" id="ecSendStatement">📤 Enviar extrato ao cliente</button></div>
      <h3>Registrar valor recebido</h3>
      <div class="field"><label for="ecAmount">Valor recebido</label><input id="ecAmount" type="number" step="0.01" min="0.01" max="${money(s.total).toFixed(2)}" inputmode="decimal" value="${esc(amountValue??money(s.total).toFixed(2))}"></div>
      <div class="card"><div class="v21-summary" id="ecPreview"></div><div class="muted" id="ecOutcome" style="margin-top:8px"></div></div>
      ${PaymentMethods.fields('ec')}
      <div class="field"><label>Observação</label><textarea id="ecNote"></textarea></div>
      <div class="actions"><button type="button" class="primary-btn" id="ecConfirm">Confirmar registro</button><button type="button" class="soft-btn" id="ecBack">Voltar</button></div>
      <div class="rule-note">O valor recebido paga primeiro os juros em atraso, depois os juros proporcionais; o restante abate o capital. Se cobrir o total, o contrato é quitado e encerrado. Se não cobrir, o contrato continua ativo com o capital reduzido.</div>`,()=>{
      PaymentMethods.bind('ec');
      const amount=document.getElementById('ecAmount'),preview=document.getElementById('ecPreview'),outcome=document.getElementById('ecOutcome'),confirmBtn=document.getElementById('ecConfirm');
      function refresh(){
        const a=allocate(s,Math.max(0,cents(amount.value)));
        preview.innerHTML=row('Juros em atraso pagos',brl(money(a.overduePaid)))+row('Juros proporcionais pagos',brl(money(a.proportional)))+row('Capital abatido',brl(money(a.capital)))+row('Capital restante',brl(money(s.principal-a.capital)),'v21-total');
        outcome.textContent=cents(amount.value)>s.total?`Valor acima do total para quitação (${brl(money(s.total))}).`:a.payoff?'Quita tudo: o contrato será encerrado.':a.capital>0?'Contrato continua ativo com o capital reduzido.':'Valor cobre apenas juros: o capital não muda.';
        confirmBtn.textContent=a.payoff?'Quitar e encerrar contrato':'Registrar e abater capital';
      }
      amount.oninput=refresh;refresh();
      document.getElementById('ecDate').onchange=e=>{if(e.target.value){const method=document.getElementById('ecMethod').value,details=document.getElementById('ecPaymentDetails').value,note=document.getElementById('ecNote').value;openEarlyClose(clientId,contractId,e.target.value,amount.value);document.getElementById('ecMethod').value=method;document.getElementById('ecMethod').dispatchEvent(new Event('change'));document.getElementById('ecPaymentDetails').value=details;document.getElementById('ecNote').value=note;}};
      document.getElementById('ecBack').onclick=()=>window.openPaymentsHubV21?window.openPaymentsHubV21(clientId,contractId):closeModal();
      document.getElementById('ecSendStatement').onclick=()=>window.prepareReceiptV25?window.prepareReceiptV25(cl,statementText(cl,k,s),'Extrato de encerramento pronto. Nenhum pagamento foi registrado.'):alert(statementText(cl,k,s));
      confirmBtn.onclick=async()=>{
        if(confirmBtn.disabled)return;confirmBtn.disabled=true;
        try{
          const value=cents(amount.value),fresh=statement(cl,k,s.closingISO);
          if(fresh.total!==s.total)throw Error('Os valores do contrato mudaram. Abra o encerramento novamente.');
          const a=allocate(fresh,value);
          if(value>0&&value<=fresh.total&&!confirm(a.payoff?`Encerrar o contrato recebendo ${brl(money(value))}?`:`Registrar ${brl(money(value))}: ${brl(money(a.overduePaid+a.proportional))} de juros e ${brl(money(a.capital))} de capital?`))return;
          const r=register(cl,k,fresh,value,document.getElementById('ecMethod').value||'PIX',document.getElementById('ecNote').value.trim(),PaymentMethods.read('ec'));
          if(window.CREDIGESTOR_MULTITENANT)await window.CrediGestorCloud.flush();
          closeModal();render();
          const text=resultText(cl,k,fresh,r,value),msg=r.type==='payoff'?'Contrato encerrado e quitado.':'Pagamento registrado e capital abatido.';
          if(window.prepareReceiptV25)window.prepareReceiptV25(cl,text,msg);else alert(msg);
        }catch(e){alert(e.message)}finally{confirmBtn.disabled=false}
      };
    });
  }
  window.openEarlyCloseV28=openEarlyClose;

  /* Botão na central de pagamentos. */
  let lastClient='',lastContract='';
  if(typeof window.openPaymentsHubV21==='function'){
    const hub=window.openPaymentsHubV21;
    window.openPaymentsHubV21=function(clientId,contractId,ref){lastClient=clientId;lastContract=contractId;return hub(clientId,contractId,ref)};
    openPaymentModal=window.openPaymentsHubV21;
  }
  const baseOpen=openModal;
  openModal=function(html,bind){
    baseOpen(html,()=>{
      if(bind)bind();
      const payoff=document.getElementById('v21Payoff');
      if(!payoff||document.getElementById('v28EarlyClose')||!lastContract)return;
      const {k}=find(lastClient,lastContract);if(!k||k.active===false||isPaidContract(k))return;
      const b=document.createElement('button');b.type='button';b.className='v21-choice';b.id='v28EarlyClose';
      b.innerHTML='<span class="ico">🔚</span><span><b>Encerrar contrato</b><small>Extrato com juros proporcionais. Registre o valor recebido; o restante abate o capital.</small></span>';
      const c=lastClient,t=lastContract;b.onclick=()=>openEarlyClose(c,t);payoff.after(b);
    });
  };
})();
