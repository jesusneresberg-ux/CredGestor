(function(){
'use strict';
Object.assign(THEMES,{
 petrol:{name:'Petróleo · escuro',accent:'#5eead4',accent2:'#38bdf8',dark:true,wallpaper:'linear-gradient(145deg,#123336,#07191c)'},
 vinho:{name:'Vinho · escuro',accent:'#f9a8d4',accent2:'#fda4af',dark:true,wallpaper:'linear-gradient(145deg,#3c1829,#180b12)'},
 oliva:{name:'Oliva · escuro',accent:'#bef264',accent2:'#86efac',dark:true,wallpaper:'linear-gradient(145deg,#253020,#10170d)'},
 espresso:{name:'Espresso · escuro',accent:'#fcd34d',accent2:'#fdba74',dark:true,wallpaper:'linear-gradient(145deg,#38281c,#18110c)'},
 gelo:{name:'Gelo',accent:'#0e7490',accent2:'#0369a1',wallpaper:'linear-gradient(145deg,#f8fafc,#e2e8f0)'},
 lavanda:{name:'Lavanda',accent:'#6d28d9',accent2:'#7c3aed',wallpaper:'linear-gradient(145deg,#f5f3ff,#e9d5ff)'},
 pessego:{name:'Pêssego',accent:'#9a3412',accent2:'#c2410c',wallpaper:'linear-gradient(145deg,#fff7ed,#fed7aa)'},
 jade:{name:'Jade',accent:'#115e59',accent2:'#047857',wallpaper:'linear-gradient(145deg,#f0fdfa,#ccfbf1)'}
});
function simulate(principal,rate,months,method){
 if(!['interest','price'].includes(method))throw Error('Escolha uma forma de pagamento válida.');
 if(!Number.isFinite(principal)||principal<=0||principal>100000000||!Number.isFinite(rate)||rate<0||rate>100||!Number.isInteger(months)||months<1||months>600)throw Error('Informe valor positivo, juros de 0 a 100% ao mês e prazo de 1 a 600 meses.');
 const round=n=>Math.round((n+Number.EPSILON)*100)/100,amount=round(principal),i=rate/100;let balance=amount;const rows=[];
 const payment=round(i===0?amount/months:amount*i/(1-Math.pow(1+i,-months)));
 for(let n=1;n<=months;n++){
  const interest=round(balance*i);let capital,installment;
  if(method==='interest'){capital=n===months?balance:0;installment=round(interest+capital)}
  else{installment=n===months?round(balance+interest):payment;capital=round(installment-interest)}
  balance=round(Math.max(0,balance-capital));rows.push({n,interest,capital,installment,balance});
 }
 return {principal:amount,rate,months,method,rows,total:round(rows.reduce((sum,row)=>sum+row.installment,0)),interest:round(rows.reduce((sum,row)=>sum+row.interest,0))};
}
window.simulateLoan=simulate;
function drawSimulator(html,bind){document.getElementById('view').innerHTML=html;if(bind)bind()}
function openSimulator(){
 let result=null;
 drawSimulator(`<h2>Simular empréstimo</h2><div class="field"><label>Cliente</label><select id="simClient"><option value="">Escolha o cliente (opcional)</option>${state.clients.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Valor emprestado (R$)</label><input id="simPrincipal" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="two"><div class="field"><label>Juros ao mês (%)</label><input id="simRate" type="number" min="0" max="100" step="0.01" value="10" inputmode="decimal"></div><div class="field"><label>Prazo em meses</label><input id="simMonths" type="number" min="1" max="600" value="3" inputmode="numeric"></div></div><div class="field"><label>Forma de pagamento</label><select id="simMethod"><option value="interest">Juros mensais + capital no final</option><option value="price">Parcelas fixas (tabela Price)</option></select></div><button id="simCalculate" type="button" class="primary-btn">Calcular simulação</button><div id="simResults" aria-live="polite"></div><div class="rule-note">Simulação sem taxas adicionais. O resultado não cria contrato nem altera o caixa.</div>`,()=>{
 const invalidate=()=>{result=null;document.getElementById('simResults').innerHTML=''};
 ['simPrincipal','simRate','simMonths','simMethod'].forEach(id=>document.getElementById(id).addEventListener('input',invalidate));
 document.getElementById('simCalculate').onclick=()=>{try{
 result=simulate(Number(document.getElementById('simPrincipal').value),Number(document.getElementById('simRate').value),Number(document.getElementById('simMonths').value),document.getElementById('simMethod').value);
 const first=result.rows[0],last=result.rows.at(-1);document.getElementById('simResults').innerHTML=`<section class="sim-result"><span>${result.method==='price'?'Parcela mensal':'Pagamento mensal de juros'}</span><strong>${brl(result.method==='interest'?first.interest:first.installment)}</strong><p>Último pagamento: <b>${brl(last.installment)}</b><br>Juros totais: <b>${brl(result.interest)}</b><br>Total a pagar: <b>${brl(result.total)}</b></p><details><summary>Ver pagamentos mês a mês</summary><table><thead><tr><th>Mês</th><th>Juros</th><th>Capital</th><th>Pagamento</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td>${r.n}</td><td>${brl(r.interest)}</td><td>${brl(r.capital)}</td><td>${brl(r.installment)}</td></tr>`).join('')}</tbody></table></details></section><div class="inline-actions"><button type="button" class="primary-btn" id="simSend">Preparar envio no WhatsApp</button><button type="button" class="soft-btn" id="simCopy">Copiar resumo</button></div><p class="muted">Confira o destinatário e confirme o envio no WhatsApp.</p>`;
 const summary=()=>{const c=state.clients.find(c=>c.id===document.getElementById('simClient').value);return `SIMULAÇÃO DE EMPRÉSTIMO\n${c?'Cliente: '+c.name+'\n':''}Valor: ${brl(result.principal)}\nJuros: ${result.rate}% ao mês\nPrazo: ${result.months} meses\nSistema: ${result.method==='price'?'Tabela Price':'Juros mensais e capital no final'}\n${result.method==='interest'?'Juros mensais':'Parcela mensal'}: ${brl(result.method==='interest'?result.rows[0].interest:result.rows[0].installment)}\nÚltimo pagamento: ${brl(result.rows.at(-1).installment)}\nJuros totais: ${brl(result.interest)}\nTotal a pagar: ${brl(result.total)}\nSimulação sem taxas adicionais; sujeita à confirmação. Não é contrato.`};
 document.getElementById('simSend').onclick=()=>{const c=state.clients.find(c=>c.id===document.getElementById('simClient').value);let phone=String(c?.phone||'').replace(/\D/g,'');if(phone.length===10||phone.length===11)phone='55'+phone;if(phone&&(!/^55\d{10,11}$/.test(phone))){alert('Confira o telefone do cliente antes de enviar.');return}window.open(phone?'https://wa.me/'+phone+'?text='+encodeURIComponent(summary()):'https://wa.me/?text='+encodeURIComponent(summary()),'_blank','noopener')};
 document.getElementById('simCopy').onclick=async()=>{try{await navigator.clipboard.writeText(summary());document.getElementById('simCopy').textContent='Resumo copiado'}catch{alert('Não foi possível copiar. Use a opção de WhatsApp.')}};
 }catch(e){result=null;document.getElementById('simResults').textContent=e.message}};
 });
}
function navigateSimulator(){closeModal();currentView='simulator';document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='simulator'));render()}
window.openLoanSimulator=navigateSimulator;
const tab=document.createElement('button');tab.type='button';tab.className='nav-btn';tab.dataset.view='simulator';tab.id='simulatorNavBtn';tab.innerHTML='<span>▤</span><small>Simulador</small>';tab.onclick=navigateSimulator;document.getElementById('settingsNavBtn').before(tab);
const renderBefore=render;render=function(){if(currentView==='simulator'){openSimulator();return}return renderBefore()};
const before=renderLoans2;renderLoans2=function(){const out=before();const row=[...document.querySelectorAll('#view .section-title')].find(e=>e.querySelector('h2')?.textContent==='Empréstimos');if(row&&!document.getElementById('simulatorLoansBtn')){const b=document.createElement('button');b.id='simulatorLoansBtn';b.type='button';b.className='small-btn';b.textContent='Simular empréstimo';b.onclick=navigateSimulator;row.appendChild(b)}return out};
})();
