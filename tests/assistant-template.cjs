const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('firebase-hosting/features-v22.js','utf8');
function setup(uid){
 const fields=new Map(),get=id=>{if(!fields.has(id))fields.set(id,{value:'',textContent:'',style:{}});return fields.get(id)};
 const state={settings:{pixType:'CPF',pixKey:'outra',pixName:'Outro',collectionAssistant22:{assistantDefault:'overdue',includePix:false,includeBreakdown:true,templates:{due_today:'Modelo antigo',overdue:'Atraso personalizado'}}},clients:[{id:'c',name:'WELLINGTON MENDES DA SILVA',phone:'',contracts:[{id:'k',principal:100,interestRate:0}]}]};
 const context={state,window:{CREDIGESTOR_WALLET_SESSION:{uid}},Date,console,currentView:'none',
  document:{createElement:()=>({}),head:{appendChild(){}},getElementById:get},
  chargeFor:()=>({amount:448.35,due:new Date(2026,10,13,12)}),
  openModal:()=>{},alert:()=>{throw Error('Não deve enviar mensagens')},
  brl:v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
 vm.createContext(context);vm.runInContext(source,context);return {context,state,get};
}
const owner=setup('r7XvaVZzBhglpaMAuMlBXuipBBt1');
owner.context.window.openCollectionAssistantV22('c','k','2026-11');
assert.equal(owner.state.settings.collectionAssistant22.assistantDefault,'auto');
owner.get('v22AsOf').value='2026-11-13';owner.get('v22AsOf').onchange();
const expected='Olá, WELLINGTON MENDES DA SILVA. Passando para lembrar que sua cobrança de R$\u00a0448,35, referente a 2026-11, vence hoje (13/11/2026).\n\n💳 *Pagamento via PIX*\nTipo: CNPJ\nChave: 48379018000172\nFavorecido: RJOTA COMÉRCIO';
assert.equal(owner.get('v22Message').value,expected);
assert.equal(owner.get('v22Preview').textContent,expected);
owner.get('v22AsOf').value='2026-11-12';owner.get('v22AsOf').onchange();
assert.equal(owner.get('v22Type').value,'upcoming');
assert.match(owner.get('v22Message').value,/vence em 13\/11\/2026/);
owner.get('v22AsOf').value='2026-11-13';owner.get('v22AsOf').onchange();
assert.equal(owner.get('v22Type').value,'due_today');
assert.equal(owner.get('v22Message').value,expected);
owner.get('v22AsOf').value='2026-11-14';owner.get('v22AsOf').onchange();
assert.equal(owner.get('v22Type').value,'overdue');
assert.match(owner.get('v22Message').value,/está vencida desde 13\/11\/2026/);
assert.doesNotMatch(owner.get('v22Message').value,/vence hoje/);
// Sem projeção da cobrança, usar o dia-base do contrato, não a data de início.
owner.context.chargeFor=()=>null;
Object.assign(owner.state.clients[0].contracts[0],{baseDueDay:13,startDate:'2026-10-02',installmentAmount:448.35});
owner.context.window.openCollectionAssistantV22('c','k','2026-11');
owner.get('v22AsOf').value='2026-11-14';owner.get('v22AsOf').onchange();
assert.match(owner.get('v22Message').value,/está vencida desde 13\/11\/2026/);
owner.state.settings.pixKey='editada';owner.context.window.openCollectionAssistantV22('c','k','2026-11');
assert.equal(owner.state.settings.pixKey,'editada','migração aplicada somente uma vez');
const other=setup('outra-conta');
assert.equal(other.state.settings.pixKey,'outra');
assert.equal(other.state.settings.pixName,'Outro');
assert.equal(other.state.settings.collectionAssistant22.templates.due_today,'Modelo antigo');
console.log('PASS: modelo exato, vencimento do contrato, antes/no dia/após vencimento e isolamento entre contas.');
