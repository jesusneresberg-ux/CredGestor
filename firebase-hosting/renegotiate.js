(function(){
  const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function parseDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return dateKey(d)===value?d:null;}
  const baseCharge=chargeFor;
  chargeFor=function(cl,k,y,m){
    const row=baseCharge(cl,k,y,m),override=k.dueDateOverrides?.[row.ref];
    if(override&&row.status!=='not_due'){
      const due=parseDate(override.dueDate);
      if(due){row.originalDue=parseDate(override.originalDue)||row.due;row.due=due;row.renegotiated=true;row.status=row.remaining===0?'paid':dateKey(due)<todayISO()?'late':'open';}
    }
    return row;
  };
  window.renegotiatedCharges=function(cl,k){return Object.keys(k.dueDateOverrides||{}).map(ref=>{const [y,m]=ref.split('-').map(Number);return chargeFor(cl,k,y,m-1);});};
  window.uniqueCharges=function(rows){const seen=new Set();return rows.filter(x=>{const key=x.cl.id+'|'+x.c.id+'|'+x.ref;if(seen.has(key))return false;seen.add(key);return true;});};
  if(typeof allChargesAround==='function'){
    const baseAround=allChargesAround;
    allChargesAround=function(){return window.uniqueCharges([...baseAround(),...activeContracts().flatMap(({cl,c})=>window.renegotiatedCharges(cl,c))]).sort((a,b)=>a.due-b.due);};
  }
  function lateRows(cl,k){
    const first=contractStartDate(k)||new Date(),now=new Date(),rows=[];
    for(let index=first.getFullYear()*12+first.getMonth();index<=now.getFullYear()*12+now.getMonth();index++){
      const row=chargeFor(cl,k,Math.floor(index/12),index%12);if(row.status==='late')rows.push(row);
    }
    return rows;
  }
  window.applyRenegotiation=function(k,rows,dates,note){
    if(!rows.length)throw Error('Não há cobranças atrasadas para renegociar.');
    rows.forEach((row,i)=>{if(row.status!=='late'||row.remaining===0)throw Error('A cobrança já mudou. Abra a renegociação novamente.');if(!parseDate(dates[i])||dates[i]<todayISO())throw Error('Escolha vencimentos a partir de hoje.');});
    const previous=JSON.parse(JSON.stringify(k));
    k.dueDateOverrides=k.dueDateOverrides||{};
    const changes=rows.map((row,i)=>{const original=k.dueDateOverrides[row.ref]?.originalDue||dateKey(row.originalDue||row.due);k.dueDateOverrides[row.ref]={originalDue:original,dueDate:dates[i]};return {reference:row.ref,originalDue:original,previousDue:dateKey(row.due),newDue:dates[i],amount:row.remaining};});
    k.renegotiations=k.renegotiations||[];k.renegotiations.push({id:uid('rn'),createdAt:new Date().toISOString(),note,changes});k.updatedAt=new Date().toISOString();
    try{saveState();}catch(error){Object.keys(k).forEach(key=>delete k[key]);Object.assign(k,previous);throw error;}
  };
  window.openRenegotiation=function(clientId,contractId){
    const cl=state.clients.find(x=>x.id===clientId),k=cl?.contracts?.find(x=>x.id===contractId);if(!k)return;
    const rows=lateRows(cl,k);closeModal();
    openModal('<h2>Renegociar vencimentos</h2><p>'+esc(cl.name)+'</p><p>Escolha uma nova data para cada cobrança atrasada. Os valores continuam em aberto. Nenhum pagamento será registrado.</p>'+rows.map((row,i)=>'<div class="field"><label>Referência '+esc(row.ref)+' · '+brl(row.remaining)+' · vencimento '+row.due.toLocaleDateString('pt-BR')+'</label><input type="date" data-renegotiation-index="'+i+'" min="'+todayISO()+'" value="'+todayISO()+'" required></div>').join('')+(rows.length?'<div class="field"><label>Observação da renegociação</label><textarea id="renegotiationNote"></textarea></div><button type="button" class="primary-btn" id="saveRenegotiation">Confirmar novos vencimentos</button>':'<p>Nenhuma cobrança atrasada neste contrato.</p>')+'<h3>Histórico de renegociações</h3>'+(k.renegotiations||[]).map(item=>'<div class="card"><p>'+new Date(item.createdAt).toLocaleString('pt-BR')+'</p>'+item.changes.map(change=>'<p>'+esc(change.reference)+': '+esc(change.previousDue.split('-').reverse().join('/'))+' → '+esc(change.newDue.split('-').reverse().join('/'))+'</p>').join('')+'<p>'+esc(item.note||'')+'</p></div>').join(''),()=>{
      const button=document.getElementById('saveRenegotiation');if(button)button.onclick=()=>{try{const dates=Array.from(document.querySelectorAll('[data-renegotiation-index]')).map(input=>input.value);window.applyRenegotiation(k,rows,dates,document.getElementById('renegotiationNote').value.trim());closeModal();render();alert('Novos vencimentos salvos. Nenhum pagamento registrado.');}catch(error){alert(error.message);}};
    });
  };
})();
