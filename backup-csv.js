// CrediGestor v3.1 — backup para Drive + importação/exportação CSV.
// Sem área separada de "controle anterior": o CSV é a ponte de migração.

function csvEscape3(value=''){
  const s=String(value??'');
  return /[;"\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}
function normHeader3(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}
function parseCSV3(text){
  const src=String(text||'').replace(/^\uFEFF/,'');
  const sample=(src.split(/\r?\n/).find(x=>x.trim())||'');
  const count=(ch)=>{let q=false,n=0;for(let i=0;i<sample.length;i++){if(sample[i]==='"'){if(q&&sample[i+1]==='"')i++;else q=!q}else if(!q&&sample[i]===ch)n++;}return n};
  const delimiter=[';',',','\t'].sort((a,b)=>count(b)-count(a))[0];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(ch==='"'){
      if(quoted&&src[i+1]==='"'){cell+='"';i++;}
      else quoted=!quoted;
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
function brNumber3(value){
  if(typeof value==='number')return value;
  let s=String(value??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
  if(!s)return 0;
  if(s.includes(',')&&s.includes('.'))s=s.replaceAll('.','').replace(',','.');
  else if(s.includes(','))s=s.replace(',','.');
  return Number(s.replace(/[^0-9.\-]/g,''))||0;
}
function dateBRtoISO3(value=''){
  const m=String(value).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return '';
  let y=Number(m[3]);if(y<100)y=y>=70?1900+y:2000+y;
  return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
}
function downloadFile3(file){
  const a=document.createElement('a');
  const url=URL.createObjectURL(file);a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backupFile3(){return new File([JSON.stringify(state,null,2)],`credigestor-backup-${todayISO()}.json`,{type:'application/json'});}
function exportBackup3(){downloadFile3(backupFile3())}
exportBackup=exportBackup3;

async function shareBackupDrive3(){
  const file=backupFile3();
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({title:'Backup CrediGestor',text:'Selecione Google Drive para salvar este backup.',files:[file]});
      return;
    }
    downloadFile3(file);
    window.open('https://drive.google.com/drive/my-drive','_blank');
    alert('O backup foi baixado. No Google Drive, envie o arquivo credigestor-backup da pasta Downloads.');
  }catch(err){
    if(err?.name!=='AbortError')alert('Não foi possível abrir o compartilhamento. Use “Backup no aparelho” e envie o arquivo ao Google Drive.');
  }
}

const CSV_HEADERS3=[
  'tipo_registro','id','cliente_id','cliente_nome','cpf','telefone','email','rua','numero','complemento','bairro','cidade','uf','cep','nivel','limite_credito','observacoes',
  'emprestimo_id','titulo','valor_inicial','saldo_atual','tipo_cobranca','taxa_juros','parcela_fixa','dia_vencimento','data_inicio','ativo','parcelas_anteriores','status_anterior','mes_referencia_anterior','anotacao_anterior',
  'movimento_id','tipo_movimento','valor_movimento','data_movimento','observacao_movimento',
  'pagamento_id','mes_referencia','valor_pago','data_pagamento','observacao_pagamento',
  'garantia_id','tipo_garantia','descricao_garantia','valor_estimado','status_garantia','observacao_garantia',
  'crm_id','tipo_crm','data_crm','observacao_crm'
];
function csvRows3(){
  const rows=[];
  const baseClient=(c)=>({cliente_id:c.id,cliente_nome:c.name||'',cpf:c.cpf||'',telefone:c.phone||'',email:c.email||'',rua:c.street||c.address||'',numero:c.number||'',complemento:c.complement||'',bairro:c.neighborhood||'',cidade:c.city||'',uf:c.uf||'',cep:c.cep||'',nivel:c.level||'bronze',limite_credito:Number(c.creditLimit)||0,observacoes:c.notes||''});
  state.clients.forEach(c=>{
    rows.push({tipo_registro:'CLIENTE',id:c.id,...baseClient(c)});
    (c.contracts||[]).forEach(k=>{
      rows.push({tipo_registro:'EMPRESTIMO',id:k.id,...baseClient(c),emprestimo_id:k.id,titulo:k.title||'',valor_inicial:Number(k.initialPrincipal)||0,saldo_atual:contractBalance(k),tipo_cobranca:k.billingType||'percent',taxa_juros:Number(k.interestRate)||0,parcela_fixa:Number(k.fixedAmount)||0,dia_vencimento:Number(k.baseDueDay)||1,data_inicio:k.startDate||'',ativo:k.active===false?0:1,parcelas_anteriores:k.legacyInstallmentCount??'',status_anterior:k.legacyStatus||'',mes_referencia_anterior:k.legacyReferenceMonth||'',anotacao_anterior:k.legacyRaw||''});
      (k.movements||[]).forEach(m=>rows.push({tipo_registro:'MOVIMENTO',id:m.id,...baseClient(c),emprestimo_id:k.id,movimento_id:m.id,tipo_movimento:m.type||'',valor_movimento:Number(m.amount)||0,data_movimento:m.date||'',observacao_movimento:m.note||''}));
      (k.payments||[]).forEach(p=>rows.push({tipo_registro:'PAGAMENTO',id:p.id,...baseClient(c),emprestimo_id:k.id,pagamento_id:p.id,mes_referencia:p.reference||'',valor_pago:Number(p.amount)||0,data_pagamento:p.paidAt||'',observacao_pagamento:p.note||''}));
    });
    (c.guarantees||[]).forEach(g=>rows.push({tipo_registro:'GARANTIA',id:g.id,...baseClient(c),garantia_id:g.id,tipo_garantia:g.type||'',descricao_garantia:g.description||'',valor_estimado:Number(g.estimatedValue)||0,status_garantia:g.status||'',observacao_garantia:g.notes||''}));
    (c.interactions||[]).forEach(i=>rows.push({tipo_registro:'CRM',id:i.id,...baseClient(c),crm_id:i.id,tipo_crm:i.type||'',data_crm:i.date||'',observacao_crm:i.note||''}));
  });
  return rows;
}
function exportCSV3(){
  const lines=[CSV_HEADERS3.join(';'),...csvRows3().map(r=>CSV_HEADERS3.map(h=>csvEscape3(r[h]??'')).join(';'))];
  downloadFile3(new File(['\uFEFF'+lines.join('\r\n')],`credigestor-completo-${todayISO()}.csv`,{type:'text/csv;charset=utf-8'}));
}

function getOrCreateClient3(id,name){
  let c=(id&&state.clients.find(x=>x.id===id))||state.clients.find(x=>norm2(x.name||'')===norm2(name||''));
  if(!c){
    c={id:id||uid('cl'),name:name||'Cliente importado',cpf:'',phone:'',email:'',level:'bronze',creditLimit:0,address:'',street:'',number:'',complement:'',neighborhood:'',city:'',uf:'',cep:'',notes:'',contracts:[],guarantees:[],interactions:[],createdAt:new Date().toISOString()};
    state.clients.push(c);
  }
  c.contracts=c.contracts||[];c.guarantees=c.guarantees||[];c.interactions=c.interactions||[];return c;
}
function getLoan3(c,id){return (c.contracts||[]).find(k=>k.id===id)}
function setClientFields3(c,get){
  const cpf=get('cpf');if(cpf)c.cpf=cpf;
  c.name=get('cliente_nome')||c.name;c.phone=get('telefone')||c.phone||'';c.email=get('email')||c.email||'';
  c.street=get('rua')||c.street||'';c.address=c.street||c.address||'';c.number=get('numero')||c.number||'';c.complement=get('complemento')||c.complement||'';
  c.neighborhood=get('bairro')||c.neighborhood||'';c.city=get('cidade')||c.city||'';c.uf=(get('uf')||c.uf||'').toUpperCase();c.cep=get('cep')||c.cep||'';
  c.level=get('nivel')||c.level||'bronze';if(get('limite_credito')!=='')c.creditLimit=brNumber3(get('limite_credito'));c.notes=get('observacoes')||c.notes||'';
}
function importStructuredCSV3(rows){
  const headers=rows[0].map(normHeader3);const idx=Object.fromEntries(headers.map((h,i)=>[h,i]));
  const get=(row,key)=>String(row[idx[key]]??'').trim();let created=0,updated=0;
  for(const row of rows.slice(1)){
    const type=get(row,'tipo_registro').toUpperCase();if(!type)continue;
    const c=getOrCreateClient3(get(row,'cliente_id'),get(row,'cliente_nome'));setClientFields3(c,k=>get(row,k));
    if(type==='CLIENTE'){updated++;continue;}
    const loanId=get(row,'emprestimo_id');
    if(type==='EMPRESTIMO'){
      let k=getLoan3(c,loanId);
      const obj={id:loanId||uid('ct'),title:get(row,'titulo')||'Empréstimo',initialPrincipal:brNumber3(get(row,'valor_inicial')),baseDueDay:Math.max(1,Math.min(31,Number(get(row,'dia_vencimento'))||1)),billingType:get(row,'tipo_cobranca')||'percent',interestRate:brNumber3(get(row,'taxa_juros')),fixedAmount:brNumber3(get(row,'parcela_fixa')),startDate:get(row,'data_inicio')||'',active:get(row,'ativo')!=='0',legacyInstallmentCount:get(row,'parcelas_anteriores')===''?'':Number(get(row,'parcelas_anteriores')),legacyStatus:get(row,'status_anterior')||'',legacyReferenceMonth:get(row,'mes_referencia_anterior')||'',legacyRaw:get(row,'anotacao_anterior')||'',movements:k?.movements||[],payments:k?.payments||[],lateHistory:k?.lateHistory||0,createdAt:k?.createdAt||new Date().toISOString()};
      if(k){Object.assign(k,obj);updated++;}else{c.contracts.push(obj);created++;}continue;
    }
    if(type==='GARANTIA'){
      const id=get(row,'garantia_id')||get(row,'id')||uid('ga');let g=(c.guarantees||[]).find(x=>x.id===id);
      const obj={id,type:get(row,'tipo_garantia')||'Outro',description:get(row,'descricao_garantia')||'',estimatedValue:brNumber3(get(row,'valor_estimado')),status:get(row,'status_garantia')||'Em garantia',notes:get(row,'observacao_garantia')||'',createdAt:g?.createdAt||new Date().toISOString()};
      if(g){Object.assign(g,obj);updated++;}else{c.guarantees.push(obj);created++;}continue;
    }
    if(type==='CRM'){
      const id=get(row,'crm_id')||get(row,'id')||uid('in');let interaction=(c.interactions||[]).find(x=>x.id===id);
      const obj={id,type:get(row,'tipo_crm')||'Observação',date:get(row,'data_crm')||todayISO(),note:get(row,'observacao_crm')||''};
      if(interaction){Object.assign(interaction,obj);updated++;}else{c.interactions.push(obj);created++;}continue;
    }
    let k=getLoan3(c,loanId);if(!k)continue;
    if(type==='MOVIMENTO'){
      const id=get(row,'movimento_id')||get(row,'id')||uid('mv');let m=(k.movements||[]).find(x=>x.id===id);
      const obj={id,type:get(row,'tipo_movimento')||'increase',amount:brNumber3(get(row,'valor_movimento')),date:get(row,'data_movimento')||'',note:get(row,'observacao_movimento')||'',createdAt:m?.createdAt||new Date().toISOString()};
      if(m){Object.assign(m,obj);updated++;}else{k.movements.push(obj);created++;}
    }else if(type==='PAGAMENTO'){
      const id=get(row,'pagamento_id')||get(row,'id')||uid('py');let p=(k.payments||[]).find(x=>x.id===id);
      const obj={id,reference:get(row,'mes_referencia')||'',amount:brNumber3(get(row,'valor_pago')),paidAt:get(row,'data_pagamento')||'',note:get(row,'observacao_pagamento')||''};
      if(p){Object.assign(p,obj);updated++;}else{k.payments.push(obj);created++;}
    }
  }
  saveState();render();return {created,updated};
}

function parseLegacyLoan3(note,day){
  const text=String(note||'').trim();if(!/^\s*[\d.]+(?:,\d+)?\b/.test(text))return null;
  const amountMatch=text.match(/^\s*([\d.]+(?:,\d+)?)/);const amount=brNumber3(amountMatch?.[1]||'');if(!amount)return null;
  const rateMatch=text.match(/\ba\s+([\d.,]+)\s*%/i);const rate=rateMatch?brNumber3(rateMatch[1]):0;
  const fixedMatch=text.match(/\(([\d.]+(?:,\d+)?)\)/);const fixedAmount=fixedMatch?brNumber3(fixedMatch[1]):0;
  const dateMatch=text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);const countMatch=text.match(/\b(\d+)\s*x\b/i);const monthMatch=text.match(/m[eê]s\s*(\d{1,2})/i);
  return {amount,rate,fixedAmount,startDate:dateMatch?dateBRtoISO3(dateMatch[0]):'',installments:countMatch?Number(countMatch[1]):'',referenceMonth:monthMatch?String(Number(monthMatch[1])).padStart(2,'0'):'',day:Number(day)||1,raw:text};
}
function importLegacyCSV3(rows){
  let loans=0,reminders=0,updated=0;
  const dayRe=/^\s*DIA\s+(\d{1,2})\s*[•\-]\s*(.+?)\s*$/i;
  for(let i=0;i<rows.length;i++){
    const cells=rows[i].map(x=>String(x||'').trim());let header=null;
    for(const cell of cells){const m=cell.match(dayRe);if(m){header={day:Number(m[1]),name:m[2].trim()||'Sem nome'};break;}}
    if(!header)continue;
    let j=i+1,note='',status='',ref='';
    while(j<rows.length&&!rows[j].some(c=>dayRe.test(String(c||'').trim()))){
      const vals=rows[j].map(x=>String(x||'').trim());
      const statusIndex=vals.findIndex(v=>/^(pendente|pago|paga|negociado|negociada|cancelado|cancelada|aberto|atrasado)$/i.test(v));
      if(statusIndex>=0){status=vals[statusIndex];const after=vals.slice(statusIndex+1).find(v=>/^\d{1,2}$/.test(v));if(after!==undefined)ref=String(Number(after)).padStart(2,'0');}
      if(!note){
        const candidate=vals.find(v=>v&&!/^\d+$/.test(v)&&!/^status$/i.test(v)&&!/^m[eê]s de refer[eê]ncia$/i.test(v)&&!/^(pendente|pago|paga|negociado|negociada|cancelado|cancelada|aberto|atrasado)$/i.test(v));
        if(candidate)note=candidate;
      }
      j++;
    }
    const key=`${norm2(header.name)}|${header.day}|${norm2(note)}`;
    const loan=parseLegacyLoan3(note,header.day);
    if(loan&&norm2(header.name)!=='sem nome'){
      const c=getOrCreateClient3('',header.name);
      let k=(c.contracts||[]).find(x=>x.legacyKey===key);
      if(!k){
        k={id:uid('ct'),title:'Empréstimo importado',initialPrincipal:loan.amount,baseDueDay:loan.day,billingType:loan.rate?'percent':'fixed',interestRate:loan.rate,fixedAmount:loan.rate?0:loan.fixedAmount,startDate:loan.startDate,active:!/(cancelado|encerrado)/i.test(status),movements:[],payments:[],lateHistory:0,legacyInstallmentCount:loan.installments,legacyStatus:status||'Pendente',legacyReferenceMonth:ref||loan.referenceMonth||'',legacyRaw:note,legacyKey:key,createdAt:new Date().toISOString()};
        c.contracts.push(k);loans++;
      }else{
        k.legacyStatus=status||k.legacyStatus;k.legacyReferenceMonth=ref||k.legacyReferenceMonth;k.legacyRaw=note||k.legacyRaw;updated++;
      }
    }else if(/^LEMBRETE\s*:/i.test(note)&&norm2(header.name)!=='sem nome'){
      const c=getOrCreateClient3('',header.name);
      const crmKey=`legacy-reminder:${key}`;
      if(!(c.interactions||[]).some(x=>x.legacyKey===crmKey)){
        c.interactions.push({id:uid('in'),type:'Observação',date:todayISO(),note:`Importado do CSV: ${note}${status?` • Status: ${status}`:''}${ref?` • Mês ref.: ${ref}`:''}`,legacyKey:crmKey});
        reminders++;
      }
    }
    i=j-1;
  }
  saveState();render();return {loans,reminders,updated};
}
function importCSVFile3(text){
  const rows=parseCSV3(text);if(!rows.length)throw new Error('CSV vazio');
  const headers=rows[0].map(normHeader3);
  if(headers.includes('tipo_registro'))return {kind:'structured',...importStructuredCSV3(rows)};
  return {kind:'legacy',...importLegacyCSV3(rows)};
}
function restoreJSON3(text){
  const parsed=JSON.parse(text);const data=parsed?.data&&parsed?.format?parsed.data:parsed;
  if(!data||typeof data!=='object'||!Array.isArray(data.clients))throw new Error('Backup inválido');
  if(!confirm('Restaurar este backup substituirá os dados atuais deste aparelho. Continuar?'))return false;
  Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState(),data);saveState();render();return true;
}

const oldImportInput3=document.getElementById('importInput');
if(oldImportInput3){
  const newImportInput3=oldImportInput3.cloneNode(true);newImportInput3.accept='.json,.csv,application/json,text/csv';oldImportInput3.replaceWith(newImportInput3);
  newImportInput3.addEventListener('change',e=>{
    const f=e.target.files?.[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{
      try{
        if(f.name.toLowerCase().endsWith('.csv')||String(f.type).includes('csv')){
          const result=importCSVFile3(r.result);
          if(result.kind==='legacy')alert(`CSV importado. ${result.loans} empréstimo(s) criado(s), ${result.updated} atualizado(s) e ${result.reminders} lembrete(s) levado(s) para o CRM.`);
          else alert(`CSV completo importado. ${result.created} registro(s) criado(s) e ${result.updated} atualizado(s).`);
        }else if(restoreJSON3(r.result))alert('Backup restaurado com sucesso.');
      }catch(err){alert('Não foi possível importar o arquivo. Verifique se ele é um backup JSON ou um CSV válido do CrediGestor/controle anterior.');}
      e.target.value='';
    };r.readAsText(f);
  });
}

const originalRenderSettings3=renderSettings;
renderSettings=function(){
  originalRenderSettings3();
  const exportBtn=document.getElementById('exportBtn'),importBtn=document.getElementById('importBtn');
  if(exportBtn){exportBtn.textContent='Backup no aparelho';exportBtn.onclick=exportBackup3;}
  if(importBtn){importBtn.textContent='Importar JSON / CSV';importBtn.onclick=()=>document.getElementById('importInput')?.click();}
  const title=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Dados e backup');
  const card=title?.closest('.section-title')?.nextElementSibling;
  if(card&&!document.getElementById('driveBackupBtn3')){
    const note=card.querySelector('.note');
    if(note)note.textContent='O backup JSON guarda todos os dados do CrediGestor. O CSV completo inclui clientes, empréstimos, alterações de saldo, pagamentos, garantias e CRM.';
    card.insertAdjacentHTML('beforeend',`<div class="actions" style="margin-top:10px"><button id="driveBackupBtn3" class="primary-btn" type="button">Salvar no Google Drive</button><button id="exportCsvBtn3" class="soft-btn" type="button">Exportar CSV completo</button></div><div class="rule-note" style="margin-top:10px">No Android, “Salvar no Google Drive” abre o compartilhamento do sistema. Escolha <b>Drive</b> para guardar o arquivo na sua conta. Arquivos CSV do controle anterior podem ser importados diretamente, sem criar uma área separada no aplicativo.</div>`);
    document.getElementById('driveBackupBtn3').onclick=shareBackupDrive3;
    document.getElementById('exportCsvBtn3').onclick=exportCSV3;
  }
};
