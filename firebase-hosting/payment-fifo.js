// Regra de baixa: com parcela atrasada, o pagamento baixa o mês atrasado mais antigo,
// mesmo que tenha sido pago no mês seguinte.
// Correção única (fifo-v1): pagamentos lançados num mês posterior enquanto um mês
// anterior estava atrasado (ex.: parcela de outubro paga em novembro e marcada como
// novembro) passam para o mês atrasado mais antigo. Nenhum pagamento é movido para frente. A carteira anterior fica guardada no aparelho e cada alteração é registrada
// em state.paymentReferenceFixes.fifoV1 (com a referência original no próprio pagamento).
(function(){
  const RULE='fifo-v1';
  const ELIGIBLE=new Set([undefined,null,'','installment','partial']);
  const refOf=i=>`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
  const cents=v=>Math.max(0,Math.round((Number(v)||0)*100));

  function planContract(cl,k){
    if(k.active===false||isPaidContract(k)||k.closed||k.billingType==='amortization')return [];
    if(Object.keys(k.dueDateOverrides||{}).length||Object.keys(k.capitalizedCharges||{}).length)return [];
    const first=firstPaymentDate(k),due=cents(monthlyDue(k));
    if(!first||due<=0)return [];
    const idxOf=ref=>{const [y,m]=ref.split('-').map(Number);return y*12+m-1;},firstIdx=first.getFullYear()*12+first.getMonth();
    const valid=p=>/^\d{4}-\d{2}$/.test(String(p.reference||''));
    const filled=new Map();
    for(const p of k.payments||[])if(valid(p)){const i=idxOf(p.reference);filled.set(i,(filled.get(i)||0)+cents(p.amount)+cents(p.discountAmount));}
    const payments=(k.payments||[]).filter(p=>ELIGIBLE.has(p.type)&&!p.payoff&&valid(p)&&/^\d{4}-\d{2}-\d{2}/.test(String(p.paidAt||'')));
    payments.sort((a,b)=>String(a.paidAt).localeCompare(String(b.paidAt))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    const changes=[];
    for(const p of payments){
      const from=idxOf(p.reference),paid=String(p.paidAt).slice(0,10),value=cents(p.amount)+cents(p.discountAmount);
      // Só move para trás: o mês atrasado mais antigo (vencido antes do pagamento e ainda sem baixa completa).
      for(let i=firstIdx;i<from;i++){
        const dueDate=i===firstIdx?first:dueDateFor(Math.floor(i/12),i%12,k.baseDueDay);
        if(ymd(dueDate)<paid&&(filled.get(i)||0)<due){
          filled.set(from,(filled.get(from)||0)-value);filled.set(i,(filled.get(i)||0)+value);
          changes.push({p,from:p.reference,to:refOf(i)});break;
        }
      }
    }
    return changes;
  }

  function plan(){
    const out=[];
    for(const cl of state.clients||[])for(const k of cl.contracts||[]){
      const changes=planContract(cl,k);if(changes.length)out.push({cl,k,changes});
    }
    return out;
  }

  function archive(value,key){return new Promise((resolve,reject)=>{try{const r=indexedDB.open('credigestor-individual-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};}catch(e){reject(e)}});}

  async function migrate(){
    state.paymentReferenceFixes=state.paymentReferenceFixes||{};
    if(state.paymentReferenceFixes.fifoV1)return null;
    const work=plan(),at=todayISO();
    if(work.length){
      await archive(JSON.stringify(state),'before-payment-fifo-v1-'+Date.now());
      for(const {cl,k,changes} of work)for(const c of changes){
        const [y,m]=c.to.split('-').map(Number),charge=chargeFor(cl,k,y,m-1);
        if(c.p.originalReference===undefined)c.p.originalReference=c.from;
        c.p.reference=c.to;c.p.referenceDate=ymd(charge.originalDue||charge.due);
        c.p.referenceFixedAt=at;c.p.referenceFixRule=RULE;
      }
    }
    state.paymentReferenceFixes.fifoV1={at,contracts:work.length,payments:work.reduce((t,w)=>t+w.changes.length,0),
      changes:work.flatMap(({cl,k,changes})=>changes.map(c=>({clientId:cl.id,contractId:k.id,paymentId:c.p.id,from:c.from,to:c.to})))};
    saveState();
    if(typeof render==='function')render();
    return state.paymentReferenceFixes.fifoV1;
  }

  window.CrediGestorPaymentFifo=Object.freeze({plan,planContract,migrate});
  migrate().catch(error=>console.warn('Correção de referências de pagamento não aplicada.',error));
})();
