// CrediGestor v5 — busca de pessoas, empréstimo rápido em Clientes,
// integração OAuth com Google Drive e importação CSV compatível com formatos legados.

(function(){
  'use strict';

  const style=document.createElement('style');
  style.textContent=`
    .person-input-v5{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px;align-items:center}
    .person-input-v5 input,.person-input-v5 select{min-width:0}
    .loupe-btn-v5{height:44px;border:1px solid rgba(148,163,184,.45);background:rgba(255,255,255,.78);border-radius:12px;font-size:19px;display:grid;place-items:center;cursor:pointer}
    .client-actions-v5{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid rgba(148,163,184,.20)}
    .finder-results-v5{display:grid;gap:8px;max-height:50vh;overflow:auto;margin-top:10px}
    .finder-person-v5{width:100%;text-align:left;border:1px solid rgba(148,163,184,.25);background:rgba(255,255,255,.72);border-radius:14px;padding:12px;cursor:pointer}
    .finder-person-v5 b{display:block;font-size:15px}.finder-person-v5 small{display:block;margin-top:4px;color:var(--muted,#64748b)}
    .drive-status-v5{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 12px}.drive-dot-v5{width:9px;height:9px;border-radius:50%;background:#94a3b8}.drive-dot-v5.on{background:#16a34a}
    .drive-grid-v5{display:grid;gap:10px}.drive-grid-v5 .actions{margin:0}
  `;
  document.head.appendChild(style);

  function personSearchTextV5(c){
    const fullAddr=(typeof fullAddress2==='function'?fullAddress2(c):c.address)||'';
    return [c.name,c.cpf,c.phone,c.email,fullAddr,c.level].filter(Boolean).join(' ');
  }
  function openPersonFinderV5(onSelect,title='Localizar pessoa'){
    if(!state.clients.length){
      openModal(`<h2>${esc(title)}</h2><div class="empty card">Nenhum cliente cadastrado ainda.</div><div class="actions"><button type="button" class="primary-btn" id="finderNewClientV5">Cadastrar cliente</button></div>`,()=>{
        document.getElementById('finderNewClientV5').onclick=()=>{closeModal();currentView='clients';syncNav();render();openClientModal()};
      });
      return;
    }
    openModal(`<h2>${esc(title)}</h2>
      <div class="person-input-v5"><input id="finderInputV5" class="search" data-no-person-loupe="1" placeholder="Nome, CPF, telefone ou endereço" autocomplete="off"><button type="button" class="loupe-btn-v5" id="finderSearchBtnV5" aria-label="Pesquisar">🔍</button></div>
      <div class="finder-results-v5" id="finderResultsV5"></div>`,()=>{
      const input=document.getElementById('finderInputV5'),box=document.getElementById('finderResultsV5');
      const draw=()=>{
        const q=(typeof norm2==='function'?norm2(input.value):String(input.value).toLowerCase());
        const arr=state.clients.filter(c=>!q||(typeof norm2==='function'?norm2(personSearchTextV5(c)):personSearchTextV5(c).toLowerCase()).includes(q)).slice(0,80);
        box.innerHTML=arr.length?arr.map(c=>`<button type="button" class="finder-person-v5" data-person-v5="${c.id}"><b>${esc(c.name||'Sem nome')}</b><small>${esc([c.cpf?`CPF ${c.cpf}`:'',c.phone||'',typeof fullAddress2==='function'?fullAddress2(c):c.address||''].filter(Boolean).join(' • '))}</small></button>`).join(''):'<div class="empty">Nenhuma pessoa encontrada.</div>';
        box.querySelectorAll('[data-person-v5]').forEach(b=>b.onclick=()=>{const c=state.clients.find(x=>x.id===b.dataset.personV5);if(c){closeModal();onSelect(c)}});
      };
      input.oninput=draw;document.getElementById('finderSearchBtnV5').onclick=draw;draw();setTimeout(()=>input.focus(),80);
    });
  }
  window.openPersonFinderV5=openPersonFinderV5;

  function enhancePersonInputsV5(root){
    if(!root)return;
    root.querySelectorAll('.field').forEach(field=>{
      const label=field.querySelector('label');if(!label||!/\b(nome|cliente|pessoa)\b/i.test(label.textContent||''))return;
      const control=field.querySelector('input:not([type="hidden"]),select');if(!control||control.dataset.noPersonLoupe||field.querySelector('.loupe-btn-v5'))return;
      const wrap=document.createElement('div');wrap.className='person-input-v5';control.parentNode.insertBefore(wrap,control);wrap.appendChild(control);
      const btn=document.createElement('button');btn.type='button';btn.className='loupe-btn-v5';btn.textContent='🔍';btn.title='Localizar pessoa cadastrada';wrap.appendChild(btn);
      btn.onclick=()=>{
        closeModal();
        openPersonFinderV5(c=>{
          if(control.id==='fName'){openClientModal(c.id);return;}
          if(control.tagName==='SELECT'&&control.id==='loanClientSelect2'){openContractModal(c.id);return;}
          if(c?.id)openClientDetail(c.id);
        },'Localizar pessoa');
      };
    });
  }

  const openModalBeforeV5=openModal;
  openModal=function(html,bind){
    openModalBeforeV5(html,()=>{if(bind)bind();setTimeout(()=>enhancePersonInputsV5(document.getElementById('modalContent')),0)});
  };

  const openClientModalBeforeV5=openClientModal;
  openClientModal=function(existingId){
    openClientModalBeforeV5(existingId);
    setTimeout(()=>enhancePersonInputsV5(document.getElementById('modalContent')),0);
  };

  if(typeof selectClientForLoan2==='function'){
    selectClientForLoan2=function(){
      if(!state.clients.length){
        openPersonFinderV5(()=>{},'Escolher cliente para o empréstimo');return;
      }
      openPersonFinderV5(c=>openContractModal(c.id),'Escolher cliente para o empréstimo');
    };
  }

  const renderClientsBeforeV5=renderClients;
  renderClients=function(){
    renderClientsBeforeV5();
    const title=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Clientes');
    const titleRow=title?.closest('.section-title');
    if(titleRow&&!titleRow.querySelector('#newLoanFromClientsV5')){
      const b=document.createElement('button');b.id='newLoanFromClientsV5';b.type='button';b.className='small-btn';b.textContent='+ Empréstimo';
      b.onclick=()=>selectClientForLoan2();titleRow.appendChild(b);
    }
    const search=document.getElementById('clientSearch');
    if(search&&!search.parentElement.classList.contains('person-input-v5')){
      const wrap=document.createElement('div');wrap.className='person-input-v5';search.parentNode.insertBefore(wrap,search);wrap.appendChild(search);
      const b=document.createElement('button');b.type='button';b.className='loupe-btn-v5';b.textContent='🔍';b.onclick=()=>openPersonFinderV5(c=>openClientDetail(c.id),'Localizar cliente');wrap.appendChild(b);
    }
    document.querySelectorAll('.client-open').forEach(card=>{
      if(card.querySelector('.client-actions-v5'))return;
      const id=card.dataset.id;if(!id)return;
      const row=document.createElement('div');row.className='client-actions-v5';row.innerHTML='<button type="button" class="small-btn">+ Adicionar empréstimo</button>';
      row.querySelector('button').onclick=e=>{e.stopPropagation();openContractModal(id)};
      row.onclick=e=>e.stopPropagation();card.appendChild(row);
    });
  };

  if(typeof renderLoans2==='function'){
    const renderLoansBeforeV5=renderLoans2;
    renderLoans2=function(){
      renderLoansBeforeV5();
      const search=document.getElementById('loanSearch2');
      if(search&&!search.parentElement.classList.contains('person-input-v5')){
        const wrap=document.createElement('div');wrap.className='person-input-v5';search.parentNode.insertBefore(wrap,search);wrap.appendChild(search);
        const b=document.createElement('button');b.type='button';b.className='loupe-btn-v5';b.textContent='🔍';b.onclick=()=>openPersonFinderV5(c=>{loanSearch2=c.name;renderLoans2()},'Localizar pessoa');wrap.appendChild(b);
      }
    };
  }

  function decodeCSVBufferV5(buf){
    const utf8=new TextDecoder('utf-8').decode(buf);
    let win='';try{win=new TextDecoder('windows-1252').decode(buf)}catch(_){win=utf8}
    const score=s=>(s.match(/�/g)||[]).length*10+(s.match(/Ã.|â€|Â/g)||[]).length;
    return score(win)<score(utf8)?win:utf8;
  }
  function countDelimiterV5(line,ch){
    let q=false,n=0;
    for(let i=0;i<line.length;i++){
      if(line[i]==='"'){if(q&&line[i+1]==='"')i++;else q=!q}
      else if(!q&&line[i]===ch)n++;
    }
    return n;
  }
  function parseCSVV5(text){
    const src=String(text||'').replace(/^\uFEFF/,'');
    const samples=src.split(/\r?\n/).filter(x=>x.trim()).slice(0,30);
    const candidates=[';',',','\t'];
    const totals=Object.fromEntries(candidates.map(d=>[d,samples.reduce((t,l)=>t+countDelimiterV5(l,d),0)]));
    let delimiter=candidates.sort((a,b)=>totals[b]-totals[a])[0];
    if(!totals[delimiter])delimiter=',';
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<src.length;i++){
      const ch=src[i];
      if(ch==='"'){
        if(quoted&&src[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){row.push(cell);cell='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&src[i+1]==='\n')i++;
        row.push(cell);cell='';
        if(row.some(v=>String(v).trim()!==''))rows.push(row);
        row=[];
      }else cell+=ch;
    }
    row.push(cell);if(row.some(v=>String(v).trim()!==''))rows.push(row);
    return rows;
  }
  function cleanTextV5(s=''){
    return String(s??'').replace(/\u00a0/g,' ').replace(/â€¢|Ã¢â‚¬Â¢/g,'•').replace(/\s+/g,' ').trim();
  }
  function nV5(s=''){return typeof normHeader3==='function'?normHeader3(cleanTextV5(s)):cleanTextV5(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
  function moneyV5(v){
    if(typeof v==='number')return Number.isFinite(v)?v:0;
    let s=cleanTextV5(v).replace(/R\$/gi,'').replace(/\s/g,'').replace(/[^0-9,.\-]/g,'');
    if(!s)return 0;
    const neg=s.startsWith('-');s=s.replace(/-/g,'');
    let n=0;
    if(s.includes(',')&&s.includes('.')){
      if(s.lastIndexOf(',')>s.lastIndexOf('.'))n=Number(s.replaceAll('.','').replace(',','.'));
      else n=Number(s.replaceAll(',',''));
    }else if(s.includes(',')){
      if(/^\d{1,3}(?:,\d{3})+$/.test(s))n=Number(s.replaceAll(',',''));
      else n=Number(s.replace(',','.'));
    }else if(s.includes('.')){
      if(/^\d{1,3}(?:\.\d{3})+$/.test(s))n=Number(s.replaceAll('.',''));
      else n=Number(s);
    }else n=Number(s);
    return (neg?-1:1)*(Number.isFinite(n)?n:0);
  }
  function isoDateV5(v=''){
    const s=cleanTextV5(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);if(!m)return '';
    let y=Number(m[3]);if(y<100)y=y>=70?1900+y:2000+y;
    return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  }
  function refV5(v,date=''){
    const s=cleanTextV5(v);
    let m=s.match(/^(\d{4})[-\/]?(\d{1,2})$/);if(m)return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[\/\-](\d{4})$/);if(m)return `${m[2]}-${String(Number(m[1])).padStart(2,'0')}`;
    m=s.match(/^\d{1,2}$/);if(m&&date){const d=isoDateV5(date);if(d)return `${d.slice(0,4)}-${String(Number(s)).padStart(2,'0')}`;}
    return '';
  }
  function aliasValueV5(obj,names){for(const k of names){if(obj[k]!==undefined&&cleanTextV5(obj[k])!=='')return cleanTextV5(obj[k])}return ''}
  function findHeaderRowV5(rows){
    const words=new Set(['tipo_registro','cliente','cliente_nome','nome','nome_cliente','contrato','contrato_id','id_contrato','emprestimo_id','valor','valor_inicial','valor_emprestimo','taxa','taxa_juros','juros','vencimento','dia_vencimento','lancamento','tipo_lancamento','movimento','tipo_movimento','pagamento','valor_pago','mes_referencia','data','data_inicio']);
    let best={idx:0,score:-1};
    rows.slice(0,25).forEach((r,i)=>{const hs=r.map(nV5);const score=hs.reduce((t,h)=>t+(words.has(h)?2:([...words].some(w=>h.includes(w))?1:0)),0);if(score>best.score)best={idx:i,score}});
    return best.score>=2?best.idx:-1;
  }
  function rowObjectV5(headers,row){const o={};headers.forEach((h,i)=>{if(h)o[h]=row[i]??''});return o}
  function findContractBySourceV5(sourceId){
    if(!sourceId)return null;
    for(const c of state.clients){for(const k of (c.contracts||[])){if(String(k.legacySourceId||'')===String(sourceId)||String(k.id)===String(sourceId))return {c,k}}}
    return null;
  }
  function legacyKeyV5(parts){return 'csvv5:'+parts.map(x=>nV5(x)).join('|')}
  function mapMovementTypeV5(s=''){
    const x=nV5(s);
    if(/pag|receb|parcela|juros/.test(x))return 'payment';
    if(/amort|redu|abat|diminu|baixa|debito/.test(x))return 'amortization';
    if(/aument|acresc|liber|novo_valor|credito|adicao|emprest/.test(x))return 'increase';
    return '';
  }
  function parseLegacyBlockV5(rows){
    let loans=0,updated=0,reminders=0,blocks=0;
    const dayRe=/^\s*DIA\s*0?(\d{1,2})\s*(?:[•·\-–—:|]|â€¢|Ã¢â‚¬Â¢)?\s*(.+?)\s*$/i;
    for(let i=0;i<rows.length;i++){
      let header=null;
      for(const raw of rows[i]){const m=cleanTextV5(raw).match(dayRe);if(m&&m[2]){header={day:Number(m[1]),name:cleanTextV5(m[2])};break}}
      if(!header)continue;blocks++;
      let j=i+1,note='',status='',month='';
      while(j<rows.length){
        if(rows[j].some(v=>dayRe.test(cleanTextV5(v))))break;
        const vals=rows[j].map(cleanTextV5).filter(Boolean);
        for(let p=0;p<vals.length;p++){
          const v=vals[p];
          if(/^(pendente|pago|paga|negociado|negociada|cancelado|cancelada|aberto|atrasado|encerrado)$/i.test(v)){status=v;const next=vals.slice(p+1).find(x=>/^\d{1,2}$/.test(x));if(next!==undefined)month=String(Number(next)).padStart(2,'0');}
        }
        if(!note){
          const candidate=vals.find(v=>!/^\d+$/.test(v)&&!/^status$/i.test(v)&&!/^m[eê]s\s+de\s+refer[eê]ncia$/i.test(v)&&!/^(pendente|pago|paga|negociado|negociada|cancelado|cancelada|aberto|atrasado|encerrado)$/i.test(v));
          if(candidate)note=candidate;
        }
        j++;
      }
      const name=header.name.replace(/^[-•:]+/,'').trim();
      if(!name||/^sem nome/i.test(name)){i=j-1;continue;}
      const key=legacyKeyV5([name,header.day,note]);
      if(/^LEMBRETE\s*:/i.test(note)){
        const c=getOrCreateClient3('',name);if(!(c.interactions||[]).some(x=>x.legacyKey===key)){
          c.interactions.push({id:uid('in'),type:'Observação',date:todayISO(),note:`Importado do CSV: ${note}${status?` • Status: ${status}`:''}${month?` • Mês ref.: ${month}`:''}`,legacyKey:key});reminders++;
        }
        i=j-1;continue;
      }
      const amountMatch=note.match(/^\s*(?:R\$\s*)?([\d.]+(?:,\d+)?)/i);const amount=moneyV5(amountMatch?.[1]||'');
      if(amount>0){
        const c=getOrCreateClient3('',name);let k=(c.contracts||[]).find(x=>x.legacyKey===key);
        const rateMatch=note.match(/(?:\ba\s+|juros?\s*[:=]?\s*)([\d.,]+)\s*%/i);const rate=rateMatch?moneyV5(rateMatch[1]):0;
        const fixedMatch=note.match(/\(([\d.]+(?:,\d+)?)\)/);const fixed=fixedMatch?moneyV5(fixedMatch[1]):0;
        const dateMatch=note.match(/\b\d{1,2}[\/]\d{1,2}[\/]\d{2,4}\b/);const countMatch=note.match(/\b(\d+)\s*x\b/i)||note.match(/\b(\d+)\s*parcelas?\b/i);const refMatch=note.match(/m[eê]s\s*(\d{1,2})/i);
        if(!k){
          k={id:uid('ct'),title:'Empréstimo importado',initialPrincipal:amount,baseDueDay:Math.max(1,Math.min(31,header.day)),billingType:rate?'percent':'fixed',interestRate:rate,fixedAmount:rate?0:fixed,startDate:dateMatch?isoDateV5(dateMatch[0]):'',active:!/(cancelad|encerrad)/i.test(status),movements:[],payments:[],lateHistory:0,legacyInstallmentCount:countMatch?Number(countMatch[1]):'',legacyStatus:status||'Pendente',legacyReferenceMonth:month||(refMatch?String(Number(refMatch[1])).padStart(2,'0'):''),legacyRaw:note,legacyKey:key,createdAt:new Date().toISOString()};
          c.contracts.push(k);loans++;
        }else{k.legacyStatus=status||k.legacyStatus;k.legacyReferenceMonth=month||k.legacyReferenceMonth;k.legacyRaw=note||k.legacyRaw;updated++;}
      }
      i=j-1;
    }
    return {kind:'legacy',blocks,loans,updated,reminders};
  }

  const A={
    name:['cliente_nome','nome_cliente','cliente','nome','pessoa','devedor','mutuario','tomador'],
    clientId:['cliente_id','id_cliente','customer_id','pessoa_id'],
    cpf:['cpf','documento','cpf_cliente'],phone:['telefone','fone','celular','whatsapp'],email:['email','e_mail'],
    contractId:['emprestimo_id','contrato_id','id_contrato','id_emprestimo','loan_id','codigo_contrato','contrato','emprestimo'],
    type:['tipo_registro','tipo','registro','categoria','natureza'],title:['titulo','descricao_contrato','descricao','nome_contrato'],
    principal:['valor_inicial','valor_emprestimo','valor_contrato','principal','capital','valor_principal','montante'],balance:['saldo_atual','saldo','saldo_devedor'],
    rate:['taxa_juros','taxa','juros','percentual','percentual_juros','juros_percentual'],fixed:['parcela_fixa','valor_parcela','prestacao','valor_prestacao','parcela'],
    due:['dia_vencimento','vencimento_dia','dia_cobranca','dia','vencimento'],start:['data_inicio','data_contrato','data_emprestimo','inicio','data_inicio_contrato'],status:['status','situacao','estado'],
    ref:['mes_referencia','referencia','mes_ref','competencia','mes'],moveType:['tipo_movimento','tipo_lancamento','lancamento','movimento','natureza_lancamento'],
    moveAmount:['valor_movimento','valor_lancamento','valor_pago','pagamento','valor_recebido','valor'],moveDate:['data_movimento','data_lancamento','data_pagamento','data_recebimento','data'],
    note:['observacao','observacoes','obs','nota','historico','descricao_lancamento','anotacao']
  };
  function importGenericTableV5(rows,opts={}){
    const hi=findHeaderRowV5(rows);if(hi<0)return {kind:'unknown',rows:rows.length,clients:0,loans:0,movements:0,payments:0,skipped:rows.length};
    const headers=rows[hi].map(nV5);const movementSchema=!!opts.hintMovement||headers.some(h=>['tipo_movimento','tipo_lancamento','valor_movimento','valor_lancamento','valor_pago','data_pagamento','data_lancamento'].includes(h));const contractSchema=!!opts.hintContract||headers.some(h=>['valor_inicial','valor_emprestimo','valor_contrato','principal','taxa_juros','dia_vencimento'].includes(h));let clients=0,loans=0,movements=0,payments=0,skipped=0,updated=0;
    for(const row of rows.slice(hi+1)){
      if(!row.some(v=>cleanTextV5(v)))continue;
      const o=rowObjectV5(headers,row);const get=names=>aliasValueV5(o,names);
      const name=get(A.name),clientSourceId=get(A.clientId),sourceId=get(A.contractId),rawType=get(A.type),moveRaw=get(A.moveType),status=get(A.status),note=get(A.note);
      let found=findContractBySourceV5(sourceId);let c=found?.c||null,k=found?.k||null;
      if(!c&&clientSourceId)c=state.clients.find(x=>String(x.legacySourceId||'')===String(clientSourceId)||String(x.id)===String(clientSourceId))||null;
      if(!c&&(name||clientSourceId)){const before=state.clients.length;c=getOrCreateClient3('',name||`Cliente ${clientSourceId}`);if(state.clients.length>before)clients++;}
      if(c){if(clientSourceId)c.legacySourceId=clientSourceId;const cpf=get(A.cpf),phone=get(A.phone),email=get(A.email);if(cpf)c.cpf=cpf;if(phone)c.phone=phone;if(email)c.email=email;}
      const explicit=nV5(rawType);const moveKind=mapMovementTypeV5(moveRaw||rawType);
      const moveAmountCandidate=moneyV5(get(A.moveAmount));
      const looksMovement=!!moveRaw||!!moveKind||/(lancamento|movimento|pagamento|recebimento|amortizacao)/.test(explicit)||(movementSchema&&moveAmountCandidate>0);
      const genericValue=moneyV5(aliasValueV5(o,['valor','valor_total','montante']));
      const principal=moneyV5(get(A.principal))||(!looksMovement&&(contractSchema||/(emprestimo|contrato)/.test(explicit))?genericValue:0),balance=moneyV5(get(A.balance)),rate=moneyV5(get(A.rate)),fixed=moneyV5(get(A.fixed));
      const date=get(A.start)||get(A.moveDate),dueRaw=get(A.due);const dueDay=Math.max(1,Math.min(31,Number(String(dueRaw).match(/\d{1,2}/)?.[0])||Number(String(isoDateV5(date)).slice(8,10))||1));
      const looksLoan=principal>0||rate>0||fixed>0||/(emprestimo|contrato)/.test(explicit)||(contractSchema&&!looksMovement&&genericValue>0);
      if(!k&&c&&looksLoan){
        const key=legacyKeyV5([sourceId||name,date,principal,dueDay,get(A.title)]);k=(c.contracts||[]).find(x=>x.legacyKey===key||(sourceId&&String(x.legacySourceId||'')===String(sourceId)));
        if(!k){k={id:uid('ct'),title:get(A.title)||'Empréstimo importado',initialPrincipal:principal||balance||0,baseDueDay:dueDay,billingType:rate?'percent':'fixed',interestRate:rate,fixedAmount:rate?0:fixed,startDate:isoDateV5(date),active:!/(cancelad|encerrad|inativ)/.test(nV5(status)),movements:[],payments:[],lateHistory:0,legacyStatus:status||'',legacyRaw:note||'',legacySourceId:sourceId||'',legacyKey:key,createdAt:new Date().toISOString()};c.contracts.push(k);loans++;}
        else updated++;
      }
      if(looksMovement){
        if(!k&&sourceId)found=findContractBySourceV5(sourceId),c=found?.c,k=found?.k;
        if(!k&&c&&(c.contracts||[]).filter(x=>x.active!==false).length===1)k=c.contracts.filter(x=>x.active!==false)[0];
        if(!k){skipped++;continue;}
        const amount=moveAmountCandidate;if(amount<=0){skipped++;continue;}
        const moveDate=isoDateV5(get(A.moveDate)||date)||todayISO();const key=legacyKeyV5([sourceId,k.id,moveRaw||rawType,amount,moveDate,get(A.ref),note]);
        if(moveKind==='payment'){
          const reference=refV5(get(A.ref),moveDate);if(!reference){
            if(!(k.movements||[]).some(x=>x.legacyKey===key)){k.movements.push({id:uid('mv'),type:'amortization',amount:0,date:moveDate,note:`Lançamento importado (referência não determinada): ${amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}${note?` • ${note}`:''}`,legacyKey:key,createdAt:new Date().toISOString()});movements++;}
          }else if(!(k.payments||[]).some(x=>x.legacyKey===key||(x.reference===reference&&Number(x.amount)===amount&&x.paidAt===moveDate))){
            k.payments.push({id:uid('py'),reference,amount,paidAt:moveDate,note:note||'Importado do CSV anterior',legacyKey:key});payments++;
          }
        }else{
          const t=moveKind||(/^(saida|debito)/i.test(nV5(moveRaw))?'amortization':'increase');
          if(!(k.movements||[]).some(x=>x.legacyKey===key)){k.movements.push({id:uid('mv'),type:t==='amortization'?'amortization':'increase',amount,date:moveDate,note:note||`Importado: ${moveRaw||rawType||'lançamento'}`,legacyKey:key,createdAt:new Date().toISOString()});movements++;}
        }
      }else if(!looksLoan&&c){
        if(note){const key=legacyKeyV5([name,date,note]);if(!(c.interactions||[]).some(x=>x.legacyKey===key)){c.interactions.push({id:uid('in'),type:'Observação',date:isoDateV5(date)||todayISO(),note:`Importado do CSV: ${note}`,legacyKey:key});}}
        else skipped++;
      }else if(!c)skipped++;
    }
    return {kind:'generic',rows:rows.length-hi-1,clients,loans,movements,payments,updated,skipped};
  }
  function importCSVV5(text,fileName=''){
    const rows=parseCSVV5(text);if(!rows.length)throw new Error('CSV vazio');
    const anyDay=rows.some(r=>r.some(v=>/^\s*DIA\s*0?\d{1,2}/i.test(cleanTextV5(v))));
    let result;
    if(anyDay)result=parseLegacyBlockV5(rows);
    else{
      const hi=findHeaderRowV5(rows);const headers=hi>=0?rows[hi].map(nV5):rows[0].map(nV5);
      if(headers.includes('tipo_registro')&&typeof importStructuredCSV3==='function')result={kind:'structured',...importStructuredCSV3(hi===0?rows:rows.slice(hi))};
      else result=importGenericTableV5(rows,{hintMovement:/lanc|moviment|pagament|receb/.test(nV5(fileName)),hintContract:/contrat|emprest/.test(nV5(fileName))});
    }
    saveState();render();return result;
  }

  async function handleImportFileV5(file){
    const name=file.name.toLowerCase();
    if(name.endsWith('.csv')||String(file.type).includes('csv')||name.endsWith('.txt')){
      const buf=await file.arrayBuffer();const text=decodeCSVBufferV5(buf);const r=importCSVV5(text,file.name);
      let msg='CSV importado com sucesso.';
      if(r.kind==='legacy')msg+=`\nEmpréstimos: ${r.loans||0}\nAtualizados: ${r.updated||0}\nLembretes para CRM: ${r.reminders||0}`;
      else if(r.kind==='structured')msg+=`\nRegistros criados: ${r.created||0}\nAtualizados: ${r.updated||0}`;
      else if(r.kind==='generic')msg+=`\nClientes novos: ${r.clients||0}\nEmpréstimos: ${r.loans||0}\nMovimentos: ${r.movements||0}\nPagamentos: ${r.payments||0}\nLinhas não vinculadas: ${r.skipped||0}`;
      else msg='O arquivo foi lido, mas as colunas não foram reconhecidas. Exporte o CSV com os nomes das colunas na primeira linha.';
      alert(msg);return;
    }
    const text=await file.text();if(restoreJSON3(text))alert('Backup restaurado com sucesso.');
  }

  const importOldV5=document.getElementById('importInput');
  if(importOldV5){
    const input=importOldV5.cloneNode(true);input.accept='.json,.csv,text/csv,application/json,text/plain';importOldV5.replaceWith(input);
    input.addEventListener('change',async e=>{
      const f=e.target.files?.[0];if(!f)return;
      try{await handleImportFileV5(f)}catch(err){console.error(err);alert(`Não foi possível importar o arquivo. ${err?.message||'Confira o formato do CSV.'}`)}finally{e.target.value=''}
    });
  }

  let driveTokenV5='';let driveTokenExpiresV5=0;let driveTokenClientV5=null;
  function driveConfiguredV5(){return !!String(state.settings?.driveClientId||'').trim()}
  function driveConnectedV5(){return !!driveTokenV5&&Date.now()<driveTokenExpiresV5-30000}
  function driveOriginV5(){return location.origin}
  function saveDriveConfigV5(clientId){state.settings.driveClientId=String(clientId||'').trim();saveState()}
  async function fetchDriveProfileV5(token){
    try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${token}`}});if(r.ok){const p=await r.json();if(state.settings.driveEmail&&p.email&&state.settings.driveEmail!==p.email)state.settings.driveFolderId='';state.settings.driveEmail=p.email||'';state.settings.driveName=p.name||'';saveState();}}
    catch(_){}
  }
  function connectDriveV5(){
    const id=String(state.settings?.driveClientId||'').trim();if(!id){openDriveSetupV5();return;}
    if(!window.google?.accounts?.oauth2){alert('A biblioteca do Google ainda não carregou. Verifique a internet e tente novamente.');return;}
    driveTokenClientV5=google.accounts.oauth2.initTokenClient({
      client_id:id,
      scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      callback:async resp=>{
        if(resp.error){alert(`Google Drive: ${resp.error}`);return;}
        driveTokenV5=resp.access_token;driveTokenExpiresV5=Date.now()+(Number(resp.expires_in)||3600)*1000;await fetchDriveProfileV5(driveTokenV5);renderSettings();
      }
    });
    driveTokenClientV5.requestAccessToken({prompt:'consent'});
  }
  function disconnectDriveV5(){
    const token=driveTokenV5;driveTokenV5='';driveTokenExpiresV5=0;
    if(token&&window.google?.accounts?.oauth2?.revoke)google.accounts.oauth2.revoke(token,()=>{});
    renderSettings();
  }
  async function ensureDriveFolderV5(){
    if(state.settings.driveFolderId)return state.settings.driveFolderId;
    const r=await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{Authorization:`Bearer ${driveTokenV5}`,'Content-Type':'application/json'},body:JSON.stringify({name:'CrediGestor Backups',mimeType:'application/vnd.google-apps.folder'})});
    if(!r.ok)throw new Error(`Não foi possível criar a pasta de backup (${r.status}).`);
    const data=await r.json();state.settings.driveFolderId=data.id;saveState();return data.id;
  }
  async function uploadDriveFileV5(file){
    if(!driveConnectedV5()){connectDriveV5();throw new Error('Conecte a conta do Google Drive e toque novamente em enviar backup.');}
    const folderId=await ensureDriveFolderV5();const boundary='credigestor_'+Math.random().toString(36).slice(2);
    const metadata={name:file.name,parents:[folderId]};
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: ${file.type||'application/octet-stream'}\r\n\r\n`,file,`\r\n--${boundary}--`]);
    const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{Authorization:`Bearer ${driveTokenV5}`,'Content-Type':`multipart/related; boundary=${boundary}`},body});
    if(!r.ok){if(r.status===401){driveTokenV5='';driveTokenExpiresV5=0}throw new Error(`Falha ao enviar ao Drive (${r.status}).`)}
    return r.json();
  }
  function csvFileV5(){
    const lines=[CSV_HEADERS3.join(';'),...csvRows3().map(r=>CSV_HEADERS3.map(h=>csvEscape3(r[h]??'')).join(';'))];
    return new File(['\uFEFF'+lines.join('\r\n')],`credigestor-completo-${todayISO()}.csv`,{type:'text/csv;charset=utf-8'});
  }
  async function backupToDriveV5(kind='json'){
    try{const file=kind==='csv'?csvFileV5():backupFile3();const out=await uploadDriveFileV5(file);alert(`Backup enviado ao Google Drive: ${out.name}`)}
    catch(err){if(!/Conecte a conta/.test(err?.message||''))alert(err?.message||'Falha ao enviar backup ao Drive.')}
  }
  function openDriveSetupV5(){
    const id=state.settings.driveClientId||'';
    openModal(`<h2>Integrar Google Drive</h2>
      <div class="card note">A senha da sua Conta Google nunca é digitada no CrediGestor. A conexão é feita pela tela oficial do Google.</div>
      <div class="field"><label>ID do cliente OAuth do Google</label><input id="driveClientInputV5" data-no-person-loupe="1" value="${esc(id)}" placeholder="...apps.googleusercontent.com"></div>
      <div class="rule-note">No Google Cloud, crie uma credencial OAuth do tipo <b>Aplicativo da Web</b>, ative a Google Drive API e adicione esta origem JavaScript autorizada:<br><b>${esc(driveOriginV5())}</b></div>
      <div class="actions"><button type="button" class="primary-btn" id="saveDriveConfigBtnV5">Salvar integração</button><button type="button" class="ghost-btn" id="openGoogleCloudV5">Abrir Google Cloud</button></div>`,()=>{
      document.getElementById('saveDriveConfigBtnV5').onclick=()=>{const v=document.getElementById('driveClientInputV5').value.trim();if(!/\.apps\.googleusercontent\.com$/i.test(v)){alert('Informe um ID de cliente OAuth válido, terminado em .apps.googleusercontent.com.');return}saveDriveConfigV5(v);closeModal();renderSettings()};
      document.getElementById('openGoogleCloudV5').onclick=()=>window.open('https://console.cloud.google.com/apis/credentials','_blank');
    });
  }
  window.connectDriveV5=connectDriveV5;window.backupToDriveV5=backupToDriveV5;

  window.__credigestorV5={parseCSVV5,importCSVV5,parseLegacyBlockV5,importGenericTableV5,moneyV5};

  const renderSettingsBeforeV5=renderSettings;
  renderSettings=function(){
    renderSettingsBeforeV5();
    const card=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Dados e backup')?.closest('.section-title')?.nextElementSibling;
    if(!card)return;
    const oldDrive=document.getElementById('driveBackupBtn3');
    if(oldDrive){const actions=oldDrive.closest('.actions');const note=actions?.nextElementSibling;actions?.remove();if(note?.classList.contains('rule-note'))note.remove();}
    if(card.querySelector('#driveIntegrationV5'))return;
    const email=state.settings.driveEmail||'';const connected=driveConnectedV5();
    card.insertAdjacentHTML('beforeend',`<div id="driveIntegrationV5" style="margin-top:14px"><div class="section-title compact-title"><h2>Google Drive</h2><small>${driveConfiguredV5()?'integração cadastrada':'não configurado'}</small></div><div class="drive-status-v5"><span class="drive-dot-v5 ${connected?'on':''}"></span><b>${connected?'Conta conectada':driveConfiguredV5()?'Integração pronta para conectar':'Integração não cadastrada'}</b>${email?`<span class="muted">${esc(email)}</span>`:''}</div><div class="drive-grid-v5"><div class="actions"><button type="button" class="soft-btn" id="driveSetupBtnV5">${driveConfiguredV5()?'Editar integração':'Cadastrar integração'}</button><button type="button" class="${connected?'ghost-btn':'primary-btn'}" id="driveConnectBtnV5">${connected?'Reconectar conta':'Conectar conta do Drive'}</button>${connected?'<button type="button" class="ghost-btn" id="driveDisconnectBtnV5">Desconectar</button>':''}</div><div class="actions"><button type="button" class="primary-btn" id="driveJsonBtnV5" ${connected?'':'disabled'}>Backup JSON no Drive</button><button type="button" class="soft-btn" id="driveCsvBtnV5" ${connected?'':'disabled'}>CSV no Drive</button></div></div></div>`);
    document.getElementById('driveSetupBtnV5').onclick=openDriveSetupV5;document.getElementById('driveConnectBtnV5').onclick=connectDriveV5;
    const dis=document.getElementById('driveDisconnectBtnV5');if(dis)dis.onclick=disconnectDriveV5;
    document.getElementById('driveJsonBtnV5').onclick=()=>backupToDriveV5('json');document.getElementById('driveCsvBtnV5').onclick=()=>backupToDriveV5('csv');
    const importBtn=document.getElementById('importBtn');if(importBtn){importBtn.textContent='Importar JSON / CSV';importBtn.onclick=()=>document.getElementById('importInput')?.click();}
  };

  if(currentView==='clients')renderClients();else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();else render();
})();
