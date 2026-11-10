(function(){
  'use strict';
  const methods=[['PIX','PIX'],['Dinheiro','Dinheiro'],['Transferência','Transferência'],['Cartão','Cartão'],['Penhora','Pagamento com penhora'],['Outro','Outras formas de pagamento']];
  function fields(prefix,existing={},allowAmortization=false){
    return `<div class="field"><label for="${prefix}Method">Forma de pagamento</label><select id="${prefix}Method">${(allowAmortization?[...methods,['amortization-only','Apenas amortização']]:methods).map(([value,label])=>`<option value="${value}"${existing.method===value?' selected':''}>${label}</option>`).join('')}</select></div><div class="field" id="${prefix}PaymentDetailsField" hidden><label id="${prefix}PaymentDetailsLabel" for="${prefix}PaymentDetails">Descrição do pagamento</label><textarea id="${prefix}PaymentDetails" maxlength="2000">${esc(existing.paymentDetails||'')}</textarea><small id="${prefix}PaymentDetailsHelp"></small></div>`;
  }
  function bind(prefix,onAmortization){
    const method=document.getElementById(prefix+'Method'),input=document.getElementById(prefix+'PaymentDetails');
    const refresh=()=>{
      const inKind=method.value==='Penhora',other=method.value==='Outro';
      document.getElementById(prefix+'PaymentDetailsField').hidden=!(inKind||other);
      input.required=inKind||other;
      document.getElementById(prefix+'PaymentDetailsLabel').textContent=inKind?'Pagamento com penhora — descrição do bem':'Descreva a outra forma de pagamento';
      input.placeholder=inKind?'Ex.: chácara na zona rural, localização e dados do bem':'Ex.: cheque, permuta ou outro meio combinado';
      document.getElementById(prefix+'PaymentDetailsHelp').textContent=inKind?'Informe o bem recebido e use o valor acordado no campo de valor do pagamento. O registro será identificado como recebimento em bem.':'Informe como o pagamento foi realizado.';
    };
    method.addEventListener('change',()=>{if(method.value==='amortization-only'&&onAmortization){onAmortization();return;}refresh();});refresh();
  }
  function details(method,value=''){
    if(method==='amortization-only')throw Error('Confirme a operação na tela Apenas amortização.');
    const paymentDetails=String(value||'').trim();
    if((method==='Penhora'||method==='Outro')&&!paymentDetails)throw Error(method==='Penhora'?'Descreva o bem recebido no pagamento com penhora.':'Descreva a outra forma de pagamento.');
    if(paymentDetails.length>2000)throw Error('A descrição deve ter até 2000 caracteres.');
    return {paymentDetails:method==='Penhora'||method==='Outro'?paymentDetails:'',settlementInKind:method==='Penhora'};
  }
  function read(prefix){return details(document.getElementById(prefix+'Method').value,document.getElementById(prefix+'PaymentDetails').value)}
  function receipt(record){
    if(!record)return '';
    const method=methods.find(([value])=>value===record.method)?.[1]||record.method||'Não informada';
    return `💳 Forma de pagamento: ${method}\n`+(record.paymentDetails?`📝 ${record.settlementInKind?'Bem recebido':'Detalhes do pagamento'}: ${record.paymentDetails}\n`:'')+(record.settlementInKind?'🏡 Recebimento em bem\n':'');
  }
  window.PaymentMethods={fields,bind,read,details,receipt};
})();
