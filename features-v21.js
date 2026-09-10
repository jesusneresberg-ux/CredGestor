// CrediGestor v21 — central de pagamentos, dashboard avançado, histórico completo e central de cobranças.
(function(){
  'use strict';

  const style=document.createElement('style');
  style.textContent=`
    .v21-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .v21-metric{padding:13px;border:1px solid var(--line);border-radius:17px;background:var(--surface,#fff)}
    .v21-metric span{display:block;font-size:10px;font-weight:850;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
    .v21-metric strong{display:block;margin-top:6px;font-size:18px;line-height:1.2}
    .v21-pay-btn{background:rgba(37,99,235,.11)!important;color:#1d4ed8!important;font-weight:850!important}
    .v21-choice-grid{display:grid;gap:9px;margin-top:12px}
    .v21-choice{width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:1px solid var(--line);background:var(--surface,#fff);padding:13px;border-radius:16px;color:var(--text)}
    .v21-choice:hover{border-color:color-mix(in srgb,var(--accent) 55%,var(--line))}
    .v21-choice .ico{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:rgba(37,99,235,.09);font-size:20px;flex:0 0 auto}
    .v21-choice b{display:block;font-size:13px}.v21-choice small{display:block;margin-top:2px;color:var(--muted);font-size:10px;line-height:1.35}
    .v21-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    .v21-summary>div{padding:10px;border-radius:13px;background:rgba(148,163,184,.08)}
    .v21-summary small{display:block;color:var(--muted);font-size:9px}.v21-summary strong{display:block;margin-top:4px;font-size:14px}
    .v21-total{grid-column:1/-1;background:rgba(37,99,235,.08)!important}.v21-total strong{font-size:20px!important;color:var(--accent)}
    .v21-history{margin-top:14px}.v21-history-row{padding:10px 0;border-bottom:1px solid var(--line)}.v21-history-row:last-child{border-bottom:0}
    .v21-history-row .top{display:flex;align-items:center;justify-content:space-between;gap:8px}.v21-history-row .top b{font-size:12px}.v21-history-row .top span{font-size:10px;color:var(--muted)}
    .v21-history-row p{margin:4px 0 0;font-size:10px;color:var(--muted);line-height:1.4}
    .v21-section-card{margin-bottom:12px}.v21-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 8px}
    .v21-section-head h3{font-size:14px;margin:0}.v21-count{font-size:10px;font-weight:850;padding:5px 8px;border-radius:999px;background:rgba(148,163,184,.12);color:var(--muted)}
    .v21-overdue details>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border-radius:15px;background:rgba(220,38,38,.07);font-weight:850;color:var(--danger,#b42318)}
    .v21-overdue details>summary::-webkit-details-marker{display:none}.v21-overdue details[open]>summary{margin-bottom:8px}
    .v21-zero{font-weight:900;color:#15803d}
    @media(min-width:720px){.v21-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.v21-choice-grid{grid-template-columns:repeat(3,1fr)}}
  `;
  document.head.appendChild(style);

  function nowDayV21(){const d=new Date();d.setHours(0,0,0,0);return d}
  function dateKeyV21(d){return ymd(d)}
  function fmtDateV21(v){
    if(v instanceof Date)return v.toLocaleDateString('pt-BR');
    const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:(v||'—');
  }
  function normalizePhoneV21(phone=''){
    let d=String(phone||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d&&!d.startsWith('55'))d='55'+d;return d;
  }
  function sendWhatsAppV21(cl,text,success='Registro realizado.'){
    const phone=normalizePhoneV21(cl?.phone||'');
    if(phone.length<12){alert(`${success} Cadastre um telefone com DDD para ${cl?.name||'o cliente'} para enviar o comprovante.`);return false}
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');return true;
  }
  function loanCodeV21(k){return k?.loanCode||k?.title||'EMPRÉSTIMO'}
  function firstDueV21(k){const m=String(k?.startDate||todayISO()).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';const base=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0);return ymd(dueDateFor(base.getFullYear(),base.getMonth()+1,k?.baseDueDay||Number(m[3])))}
  function currentBalanceV21(k){try{return Math.max(0,Number(contractBalance(k))||0)}catch(_){return Math.max(0,Number(k?.currentPrincipal)||Number(k?.initialPrincipal)||0)}}
  function currentInterestV21(k){
    const bal=currentBalanceV21(k);if(bal<=0)return 0;
    if(k?.billingType==='interest')return Math.max(0,bal*(Number(k?.interestRate)||0)/100);
    const initial=Math.max(0,Number(k?.initialPrincipal)||0),summary=Math.max(0,Number(k?.summaryTotal)||0);
    if(initial>0&&summary>initial)return Math.max(0,(summary-initial)*(bal/initial));
    return Math.max(0,Number(k?.fixedAmount)||0);
  }
  function payoffQuoteV21(k){const principal=currentBalanceV21(k),alreadyPaid=!!getPayment(k,monthRef()),interest=alreadyPaid?0:currentInterestV21(k);return {principal,interest,total:principal+interest}}
  function nextDueV21(k){
    const today=nowDayV21(),day=Number(k?.baseDueDay)||1;
    let due=dueDateFor(today.getFullYear(),today.getMonth(),day);due.setHours(0,0,0,0);
    const ref=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}`;
    if(due<today || getPayment(k,ref)){
      due=dueDateFor(today.getFullYear(),today.getMonth()+1,day);due.setHours(0,0,0,0);
    }
    return due;
  }
  function paymentReceiptV21(cl,k,p){
    return `✅ *Pagamento recebido*\n\n👤 Cliente: ${cl?.name||'Cliente'}\n💰 Valor pago: ${brl(p?.amount||0)}\n💳 Saldo de capital: ${brl(currentBalanceV21(k))}\n📅 Data: ${fmtDateV21(p?.paidAt)}\n📄 Contrato: ${loanCodeV21(k)}\n✅ Situação: Pago`;
  }
  function amortizationReceiptV21(cl,k,m){
    return `📉 *Amortização de Capital*\n\n👤 Cliente: ${cl?.name||'Cliente'}\n💳 Saldo anterior: ${brl(m?.balanceBefore||0)}\n💰 Capital amortizado: ${brl(m?.amount||0)}\n💳 Novo saldo: ${brl(m?.balanceAfter||0)}\n📅 Data: ${fmtDateV21(m?.date)}\n📄 Contrato: ${loanCodeV21(k)}`;
  }
  function payoffReceiptV21(cl,k,p){
    return `🏦 *Quitação Total - ${loanCodeV21(k)}*\n\n👤 Cliente: ${cl?.name||'Cliente'}\n💰 Capital pago: ${brl(p?.principalAmount||0)}\n📊 Juros pagos: ${brl(p?.interestAmount||0)}\n💵 Total pago: ${brl(p?.amount||0)}\n📅 Data: ${fmtDateV21(p?.paidAt)}\n💳 Saldo final: ${brl(0)}\n📌 Status: *QUITADO*`;
  }

  function registerParcelV21(cl,k,ref,amount,paidAt,method,note){
    const old=getPayment(k,ref),payment={id:old?.id||uid('py'),reference:ref,amount,paidAt,method,note,status:'paid',type:old?.type||'installment',createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    k.payments=k.payments||[];if(old)Object.assign(old,payment);else k.payments.push(payment);k.updatedAt=new Date().toISOString();saveState();return payment;
  }
  function registerAmortizationV21(cl,k,amount,date,note){
    const before=currentBalanceV21(k);if(amount<=0||amount>=before)return null;const after=Math.max(0,before-amount);
    const movement={id:uid('mv'),type:'amortization',amount,date,note:note||'Amortização de capital',balanceBefore:before,balanceAfter:after,createdAt:new Date().toISOString()};
    k.movements=k.movements||[];k.movements.push(movement);k.currentPrincipal=after;k.lastBalanceUpdate=date;k.updatedAt=new Date().toISOString();saveState();return movement;
  }
  function settleTotalV21(cl,k,paidAt,method,note){
    const q=payoffQuoteV21(k),ref=String(monthRef());if(q.total<=0)return null;
    const payment={id:uid('py'),reference:ref,amount:q.total,principalAmount:q.principal,interestAmount:q.interest,paidAt,method,note,status:'paid',type:'payoff',payoff:true,createdAt:new Date().toISOString()};
    k.payments=k.payments||[];k.payments.push(payment);
    if(q.principal>0){k.movements=k.movements||[];k.movements.push({id:uid('mv'),type:'amortization',amount:q.principal,date:paidAt,note:'Quitação total do capital',balanceBefore:q.principal,balanceAfter:0,payoff:true,createdAt:new Date().toISOString()})}
    const firstDue=firstDueV21(k);
    k.currentPrincipal=0;k.active=false;k.status='paid';k.loanStatus='paid';k.closed=true;k.closedAt=paidAt;k.paidOffAt=paidAt;k.paidOffEarly=!!firstDue&&paidAt<firstDue;k.closedReason=k.paidOffEarly?'Quitação antecipada — capital + juros':'Quitação total — capital + juros';k.lastBalanceUpdate=paidAt;k.nextDueDate='';k.notificationsDisabled=true;k.updatedAt=new Date().toISOString();
    saveState();return payment;
  }
  window.settleTotalV21=settleTotalV21;

  function basePaymentFieldsV21(existing={}){
    return `<div class="field"><label>Data</label><input id="v21Date" type="date" value="${esc(existing.paidAt||todayISO())}"></div><div class="field"><label>Forma de pagamento</label><select id="v21Method"><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Outro</option></select></div><div class="field"><label>Observação</label><textarea id="v21Note">${esc(existing.note||'')}</textarea></div>`;
  }
  function openPaymentsHubV21(clientId,contractId,ref){
    const cl=(state.clients||[]).find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    const useRef=String(ref||monthRef()),[y,m]=useRef.split('-').map(Number),charge=chargeFor(cl,k,y,m-1),existing=getPayment(k,useRef),q=payoffQuoteV21(k);
    openModal(`<h2>Pagamentos</h2><div class="card"><div class="muted">${esc(cl.name)} • ${esc(loanCodeV21(k))}</div><div class="v21-summary"><div><small>Capital atual</small><strong>${brl(q.principal)}</strong></div><div><small>Juros atuais</small><strong>${brl(q.interest)}</strong></div><div class="v21-total"><small>Quitação capital + juros</small><strong>${brl(q.total)}</strong></div></div></div><div class="v21-choice-grid"><button type="button" class="v21-choice" id="v21Parcel"><span class="ico">💵</span><span><b>Pagar Parcela</b><small>Registrar a cobrança do mês e gerar comprovante.</small></span></button><button type="button" class="v21-choice" id="v21Amortize"><span class="ico">📉</span><span><b>Amortizar Capital</b><small>Reduzir o principal e recalcular os juros futuros.</small></span></button><button type="button" class="v21-choice" id="v21Payoff"><span class="ico">✅</span><span><b>Quitar Capital + Juros</b><small>Receber tudo, zerar o saldo e encerrar o contrato.</small></span></button></div><div class="rule-note">Escolha uma opção. Nenhuma baixa é feita antes da confirmação final.</div>`,()=>{
      document.getElementById('v21Parcel').onclick=()=>openParcelV21(clientId,contractId,useRef,existing,charge);
      document.getElementById('v21Amortize').onclick=()=>openAmortizeV21(clientId,contractId,useRef);
      document.getElementById('v21Payoff').onclick=()=>openPayoffV21(clientId,contractId,useRef);
    });
  }
  window.openPaymentsHubV21=openPaymentsHubV21;
  openPaymentModal=openPaymentsHubV21;

  function openParcelV21(clientId,contractId,ref,existing,charge){
    const cl=state.clients.find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;
    openModal(`<h2>Pagar Parcela</h2><div class="card"><div class="muted">Referência ${esc(ref)} • vencimento ${charge.due.toLocaleDateString('pt-BR')}</div><strong style="font-size:26px">${brl(charge.amount)}</strong></div><div class="field"><label>Mês de referência</label><input id="v21Ref" value="${esc(ref)}" pattern="\\d{4}-\\d{2}"></div><div class="field"><label>Valor pago</label><input id="v21Amount" type="number" step="0.01" min="0.01" value="${Number(existing?.amount||charge.amount).toFixed(2)}"></div>${basePaymentFieldsV21(existing)}<div class="actions"><button type="button" class="primary-btn" id="v21ConfirmParcel">Confirmar e enviar comprovante</button><button type="button" class="soft-btn" id="v21Back">Voltar</button></div>`,()=>{
      if(existing?.method)document.getElementById('v21Method').value=existing.method;
      document.getElementById('v21Back').onclick=()=>openPaymentsHubV21(clientId,contractId,ref);
      document.getElementById('v21ConfirmParcel').onclick=()=>{const amount=Number(document.getElementById('v21Amount').value)||0;if(amount<=0){alert('Informe um valor maior que zero.');return}const p=registerParcelV21(cl,k,document.getElementById('v21Ref').value.trim()||ref,amount,document.getElementById('v21Date').value||todayISO(),document.getElementById('v21Method').value||'PIX',document.getElementById('v21Note').value.trim());closeModal();render();sendWhatsAppV21(cl,paymentReceiptV21(cl,k,p),'Pagamento registrado.');};
    });
  }
  function openAmortizeV21(clientId,contractId,ref){
    const cl=state.clients.find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;const before=currentBalanceV21(k);
    openModal(`<h2>Amortizar Capital</h2><div class="card"><div class="muted">Capital antes da amortização</div><strong style="font-size:26px">${brl(before)}</strong><div class="muted" style="margin-top:4px">Juros atuais: ${brl(currentInterestV21(k))}</div></div><div class="field"><label>Valor a amortizar</label><input id="v21Amount" type="number" step="0.01" min="0.01" max="${Math.max(0,before-0.01).toFixed(2)}"></div><div class="card"><div class="muted">Novo capital</div><strong id="v21NewBalance" style="font-size:24px">${brl(before)}</strong><div class="muted" id="v21NewInterest">Novos juros: ${brl(currentInterestV21(k))}</div></div>${basePaymentFieldsV21()}<div class="actions"><button type="button" class="primary-btn" id="v21ConfirmAmort">Confirmar amortização</button><button type="button" class="soft-btn" id="v21Back">Voltar</button></div><div class="rule-note">Após confirmar, o novo saldo será usado automaticamente nas próximas cobranças e comprovantes.</div>`,()=>{
      const amount=document.getElementById('v21Amount'),newBal=document.getElementById('v21NewBalance'),newInt=document.getElementById('v21NewInterest');
      amount.oninput=()=>{const a=Math.max(0,Number(amount.value)||0),b=Math.max(0,before-a),i=k.billingType==='interest'?b*(Number(k.interestRate)||0)/100:currentInterestV21({...k,currentPrincipal:b,initialPrincipal:b,movements:[]});newBal.textContent=brl(b);newInt.textContent=`Novos juros: ${brl(i)}`};
      document.getElementById('v21Back').onclick=()=>openPaymentsHubV21(clientId,contractId,ref);
      document.getElementById('v21ConfirmAmort').onclick=()=>{const a=Number(amount.value)||0;if(a<=0||a>=before){alert(`Para amortização, informe um valor menor que ${brl(before)}. Para zerar o contrato, use “Quitar Capital + Juros”.`);return}const mov=registerAmortizationV21(cl,k,a,document.getElementById('v21Date').value||todayISO(),document.getElementById('v21Note').value.trim());closeModal();render();sendWhatsAppV21(cl,amortizationReceiptV21(cl,k,mov),'Amortização registrada.');};
    });
  }
  function openPayoffV21(clientId,contractId,ref){
    const cl=state.clients.find(x=>x.id===clientId),k=(cl?.contracts||[]).find(x=>x.id===contractId);if(!cl||!k)return;const q=payoffQuoteV21(k);
    openModal(`<h2>Quitar Capital + Juros</h2><div class="card"><div class="muted">Confira os valores antes de confirmar.</div><div class="v21-summary"><div><small>Capital restante</small><strong>${brl(q.principal)}</strong></div><div><small>Juros</small><strong>${brl(q.interest)}</strong></div><div class="v21-total"><small>Total a pagar</small><strong>${brl(q.total)}</strong></div><div class="v21-total"><small>Saldo após a quitação</small><strong class="v21-zero">${brl(0)}</strong></div></div></div>${basePaymentFieldsV21()}<div class="actions"><button type="button" class="primary-btn" id="v21ConfirmPayoff">Quitar e dar baixa</button><button type="button" class="soft-btn" id="v21Back">Voltar</button></div><div class="rule-note">A confirmação encerra o contrato, zera o capital e impede novas cobranças e notificações deste empréstimo.</div>`,()=>{
      document.getElementById('v21Back').onclick=()=>openPaymentsHubV21(clientId,contractId,ref);
      document.getElementById('v21ConfirmPayoff').onclick=()=>{if(q.total<=0){alert('Este contrato já está sem saldo.');return}if(!confirm(`Confirmar pagamento total de ${brl(q.total)}?`))return;const p=settleTotalV21(cl,k,document.getElementById('v21Date').value||todayISO(),document.getElementById('v21Method').value||'PIX',document.getElementById('v21Note').value.trim());if(!p)return;closeModal();render();sendWhatsAppV21(cl,payoffReceiptV21(cl,k,p),'Empréstimo quitado e baixado.');};
    });
  }

  function decorateLoanPaymentsV21(root=document){
    root.querySelectorAll('.loan-card').forEach(card=>{const edit=card.querySelector('.edit-loan2'),row=card.querySelector('.inline-actions');if(!edit||!row)return;const legacy=row.querySelector('.v13-pay');if(legacy){legacy.classList.add('v21-pay-btn');legacy.textContent='💳 Pagamentos';legacy.onclick=()=>openPaymentsHubV21(edit.dataset.client,edit.dataset.loan);return}if(row.querySelector('.v21-pay-btn'))return;const b=document.createElement('button');b.type='button';b.className='small-btn v21-pay-btn';b.textContent='💳 Pagamentos';b.onclick=()=>openPaymentsHubV21(edit.dataset.client,edit.dataset.loan);row.insertBefore(b,row.firstChild)});
  }
  if(typeof renderLoans2==='function'){const before=renderLoans2;renderLoans2=function(){const out=before();decorateLoanPaymentsV21(document.getElementById('view'));return out}}

  if(typeof openClientDetail==='function'){
    const before=openClientDetail;openClientDetail=function(id){const out=before(id);const cl=state.clients.find(x=>x.id===id);if(!cl)return out;document.querySelectorAll('#modalContent .contract-card').forEach(card=>{const edit=card.querySelector('.edit-contract'),row=card.querySelector('.inline-actions');if(!edit||!row||row.querySelector('.v21-pay-btn'))return;const k=(cl.contracts||[]).find(x=>x.id===edit.dataset.id);if(!k||k.active===false)return;const b=document.createElement('button');b.type='button';b.className='small-btn v21-pay-btn';b.textContent='💳 Pagamentos';b.onclick=()=>openPaymentsHubV21(cl.id,k.id);row.insertBefore(b,row.firstChild)});injectClientHistoryV21(cl);return out};
  }

  function timelineV21(cl){
    const rows=[];(cl.contracts||[]).forEach(k=>{
      (k.payments||[]).forEach(p=>rows.push({date:p.paidAt||p.createdAt?.slice(0,10)||'',kind:p.payoff?'Quitação total':'Pagamento',amount:Number(p.amount)||0,text:`${loanCodeV21(k)}${p.reference?` • ref. ${p.reference}`:''}${p.payoff?` • capital ${brl(p.principalAmount||0)} + juros ${brl(p.interestAmount||0)}`:''}`}));
      (k.movements||[]).forEach(m=>rows.push({date:m.date||m.createdAt?.slice(0,10)||'',kind:m.type==='increase'?'Acréscimo':'Amortização',amount:Number(m.amount)||0,text:`${loanCodeV21(k)}${Number.isFinite(Number(m.balanceAfter))?` • saldo após ${brl(m.balanceAfter)}`:''}`}));
      if(k.closedAt)rows.push({date:k.closedAt,kind:'Contrato encerrado',amount:0,text:`${loanCodeV21(k)} • ${k.closedReason||'Encerrado'}`});
    });
    return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.kind).localeCompare(String(b.kind)));
  }
  function injectClientHistoryV21(cl){
    const root=document.getElementById('modalContent');if(!root||root.querySelector('#clientHistoryV21'))return;const rows=timelineV21(cl);const box=document.createElement('div');box.id='clientHistoryV21';box.className='v21-history';box.innerHTML=`<div class="section-title"><h2>Histórico completo</h2><small>${rows.length} evento(s)</small></div><div class="card">${rows.length?rows.slice(0,80).map(r=>`<div class="v21-history-row"><div class="top"><b>${esc(r.kind)}</b><span>${fmtDateV21(r.date)}</span></div><p>${esc(r.text)}${r.amount?` • ${brl(r.amount)}`:''}</p></div>`).join(''):'<div class="empty">Nenhum evento financeiro registrado.</div>'}</div>`;root.appendChild(box);
  }

  function monthStatsV21(){
    const ref=monthRef(),active=activeContracts(),portfolio=active.reduce((t,x)=>t+currentBalanceV21(x.c),0),interestExpected=active.reduce((t,x)=>t+currentInterestV21(x.c),0);let received=0,interestReceived=0,principalReceived=0,payoffs=0;
    (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>(k.payments||[]).forEach(p=>{if(String(p.reference||'')!==ref)return;const a=Number(p.amount)||0;received+=a;if(p.payoff){payoffs++;interestReceived+=Number(p.interestAmount)||0;principalReceived+=Number(p.principalAmount)||0}else if(k.billingType==='interest')interestReceived+=a})));
    const now=new Date(),monthCharges=active.map(({cl,c})=>chargeFor(cl,c,now.getFullYear(),now.getMonth())),late=monthCharges.filter(x=>x.status==='late').reduce((t,x)=>t+Number(x.amount||0),0);return {ref,portfolio,interestExpected,received,interestReceived,principalReceived,payoffs,late,activeCount:active.length};
  }
  if(typeof renderDashboard==='function'){
    const before=renderDashboard;renderDashboard=function(){const out=before();const view=document.getElementById('view');if(!view||view.querySelector('#dashboardAdvancedV21'))return out;const s=monthStatsV21(),hero=view.querySelector('.hero');const section=document.createElement('div');section.id='dashboardAdvancedV21';section.innerHTML=`<div class="section-title"><h2>Dashboard financeiro avançado</h2><small>${esc(refLabel(s.ref))}</small></div><div class="v21-grid"><div class="v21-metric"><span>Capital ativo</span><strong>${brl(s.portfolio)}</strong></div><div class="v21-metric"><span>Juros previstos</span><strong>${brl(s.interestExpected)}</strong></div><div class="v21-metric"><span>Recebido no mês</span><strong>${brl(s.received)}</strong></div><div class="v21-metric"><span>Juros recebidos</span><strong>${brl(s.interestReceived)}</strong></div><div class="v21-metric"><span>Capital recebido em quitações</span><strong>${brl(s.principalReceived)}</strong></div><div class="v21-metric"><span>Em atraso no mês</span><strong>${brl(s.late)}</strong></div><div class="v21-metric"><span>Contratos ativos</span><strong>${s.activeCount}</strong></div><div class="v21-metric"><span>Quitações no mês</span><strong>${s.payoffs}</strong></div></div>`;if(hero)hero.insertAdjacentElement('afterend',section);else view.prepend(section);decorateChargeButtonsV21(view);return out};
  }

  function historicalLateV21(){
    const out=[],today=nowDayV21();activeContracts().forEach(({cl,c})=>{const s=String(c.startDate||todayISO()).match(/^(\d{4})-(\d{2})-(\d{2})$/);let y=s?Number(s[1]):today.getFullYear(),m=s?Number(s[2])-1:today.getMonth(),guard=0;while(guard++<120&&(y<today.getFullYear()||(y===today.getFullYear()&&m<=today.getMonth()))){const x=chargeFor(cl,c,y,m);const due=new Date(x.due);due.setHours(0,0,0,0);if(due<today&&x.status==='late')out.push(x);m++;if(m>11){m=0;y++}}});const seen=new Set();return out.filter(x=>{const k=`${x.cl.id}|${x.c.id}|${x.ref}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a.due-b.due);
  }
  function todayChargesV21(){const today=nowDayV21();return activeContracts().map(({cl,c})=>chargeFor(cl,c,today.getFullYear(),today.getMonth())).filter(x=>dateKeyV21(x.due)===dateKeyV21(today)&&x.status!=='paid').sort((a,b)=>a.cl.name.localeCompare(b.cl.name,'pt-BR'))}
  function upcomingChargesV21(){const today=nowDayV21();return activeContracts().map(({cl,c})=>{const due=nextDueV21(c),ref=`${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}`;return chargeFor(cl,c,due.getFullYear(),due.getMonth())}).filter(x=>x.status!=='paid'&&x.due>today).sort((a,b)=>a.due-b.due||a.cl.name.localeCompare(b.cl.name,'pt-BR')).slice(0,40)}
  function chargeRowV21(x){return `<div class="list-item"><div class="row space"><div class="row"><div class="avatar">${esc((x.cl.name||'?').slice(0,2).toUpperCase())}</div><div><div class="title">${esc(x.cl.name)}</div><div class="muted">${x.due.toLocaleDateString('pt-BR')} • ref. ${esc(x.ref)} • ${esc(loanCodeV21(x.c))}</div></div></div><span class="status ${x.status}">${x.status==='late'?'ATRASADO':'ABERTO'}</span></div><div class="row space" style="margin-top:10px"><strong class="money">${brl(x.amount)}</strong><div class="inline-actions" style="margin:0"><button type="button" class="small-btn v21-pay-btn" data-v21-client="${x.cl.id}" data-v21-loan="${x.c.id}" data-v21-ref="${x.ref}">💳 Pagamentos</button>${state.settings.googleCalendar?`<button class="small-btn cal-btn" data-c="${x.cl.id}" data-k="${x.c.id}" data-r="${x.ref}">Agenda</button>`:''}</div></div></div>`}
  function bindChargesV21(root=document){root.querySelectorAll('[data-v21-client]').forEach(b=>b.onclick=()=>openPaymentsHubV21(b.dataset.v21Client,b.dataset.v21Loan,b.dataset.v21Ref));root.querySelectorAll('.cal-btn').forEach(b=>b.onclick=()=>openCalendar(b.dataset.c,b.dataset.k,b.dataset.r));if(typeof decorateChargeButtonsV17==='function')decorateChargeButtonsV17(root)}
  function decorateChargeButtonsV21(root=document){root.querySelectorAll('.pay-btn').forEach(b=>{b.textContent='💳 Pagamentos';b.classList.add('v21-pay-btn')})}

  renderCharges=function(){
    const today=todayChargesV21(),late=historicalLateV21(),next=upcomingChargesV21(),view=document.getElementById('view');
    view.innerHTML=`<div class="section-title"><h2>Central de cobranças</h2><small>hoje, atrasados e próximos</small></div><div class="v21-section-card"><div class="v21-section-head"><h3>📅 Cobranças de hoje</h3><span class="v21-count">${today.length}</span></div><div class="list">${today.length?today.map(chargeRowV21).join(''):'<div class="empty card">Nenhuma cobrança para hoje.</div>'}</div></div><div class="v21-section-card v21-overdue"><details ${late.length&&late.length<=4?'open':''}><summary><span>⚠️ Atrasados</span><span>${late.length} cobrança(s) • ${brl(late.reduce((t,x)=>t+Number(x.amount||0),0))}</span></summary><div class="list">${late.length?late.map(chargeRowV21).join(''):'<div class="empty card">Nenhuma cobrança atrasada.</div>'}</div></details></div><div class="v21-section-card"><div class="v21-section-head"><h3>⏭️ Próximos vencimentos</h3><span class="v21-count">${next.length}</span></div><div class="list">${next.length?next.map(chargeRowV21).join(''):'<div class="empty card">Nenhum próximo vencimento.</div>'}</div></div>`;bindChargesV21(view);
  };

  // Reaplica a tela atual já com os recursos da v21.
  try{if(currentView==='dashboard')renderDashboard();else if(currentView==='loans')renderLoans2();else if(currentView==='charges')renderCharges()}catch(err){console.warn('CrediGestor v21: renderização inicial parcial.',err)}
})();
