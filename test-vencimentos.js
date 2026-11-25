// Script de validação da regra de vencimentos padronizada
// Testa se contratos iniciados em diferentes dias do mês aparecem corretamente na aba "Este mês"

(function(){
  'use strict';

  // Funções auxiliares copiadas do app.js para teste isolado
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

  function dueDateFor(year, monthIndex, baseDay){
    const last = new Date(year, monthIndex+1, 0).getDate();
    return new Date(year, monthIndex, Math.min(Number(baseDay)||1,last),12,0,0);
  }

  function contractStartDate(c){
    const m=String(c?.startDate||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0);
    return Number.isNaN(d.getTime())?null:d;
  }

  // NOVA REGRA: primeiro vencimento no dia-base do mês seguinte ao início
  function firstPaymentDate(c){
    const start=contractStartDate(c);
    if(!start)return null;
    return dueDateFor(start.getFullYear(),start.getMonth()+1,c.baseDueDay);
  }

  // REGRAS ANTIGA (para comparação): 30 dias fixos
  function firstPaymentDateAntiga(c){
    const start=contractStartDate(c);
    return start?addDays(start,30):null;
  }

  // Cenários de teste
  const cenarios = [
    { nome: 'Contrato iniciado em 01/11/2026, dia-base 10', startDate: '2026-11-01', baseDueDay: 10 },
    { nome: 'Contrato iniciado em 15/11/2026, dia-base 10', startDate: '2026-11-15', baseDueDay: 10 },
    { nome: 'Contrato iniciado em 25/11/2026, dia-base 10', startDate: '2026-11-25', baseDueDay: 10 },
    { nome: 'Contrato iniciado em 01/11/2026, dia-base 5', startDate: '2026-11-01', baseDueDay: 5 },
    { nome: 'Contrato iniciado em 20/11/2026, dia-base 5', startDate: '2026-11-20', baseDueDay: 5 },
    { nome: 'Contrato iniciado em 30/11/2026, dia-base 31', startDate: '2026-11-30', baseDueDay: 31 },
  ];

  console.log('=== VALIDAÇÃO DA REGRA DE VENCIMENTOS PADRONIZADA ===\n');
  console.log('Mês atual: Novembro/2026\n');

  let todosCorretos = true;

  cenarios.forEach((cenario, idx) => {
    const contrato = { startDate: cenario.startDate, baseDueDay: cenario.baseDueDay };

    const primeiraDataNova = firstPaymentDate(contrato);
    const primeiraDataAntiga = firstPaymentDateAntiga(contrato);

    const mesAtual = new Date().getMonth(); // 10 = novembro (0-indexed)
    const anoAtual = new Date().getFullYear();

    const apareceNesteMes_Nova = primeiraDataNova &&
      primeiraDataNova.getMonth() === mesAtual &&
      primeiraDataNova.getFullYear() === anoAtual;

    const apareceNesteMes_Antiga = primeiraDataAntiga &&
      primeiraDataAntiga.getMonth() === mesAtual &&
      primeiraDataAntiga.getFullYear() === anoAtual;

    console.log(`Cenário ${idx + 1}: ${cenario.nome}`);
    console.log(`  Regra ANTIGA (30 dias): ${primeiraDataAntiga ? primeiraDataAntiga.toLocaleDateString('pt-BR') : 'N/A'} - Aparece neste mês: ${apareceNesteMes_Antiga ? 'SIM ✓' : 'NÃO ✗'}`);
    console.log(`  Regra NOVA (dia-base mês seguinte): ${primeiraDataNova ? primeiraDataNova.toLocaleDateString('pt-BR') : 'N/A'} - Aparece neste mês: ${apareceNesteMes_Nova ? 'SIM ✓' : 'NÃO ✗'}`);

    // Verifica se a nova regra coloca o vencimento no mês seguinte ao início
    const start = contractStartDate(contrato);
    if (start && primeiraDataNova) {
      const mesInicio = start.getMonth();
      const mesPrimeiroVenc = primeiraDataNova.getMonth();
      const anoInicio = start.getFullYear();
      const anoPrimeiroVenc = primeiraDataNova.getFullYear();

      // O primeiro vencimento deve ser no mês seguinte ao início
      const mesEsperado = (mesInicio + 1) % 12;
      const anoEsperado = mesInicio === 11 ? anoInicio + 1 : anoInicio;

      const estaCorreto = mesPrimeiroVenc === mesEsperado && anoPrimeiroVenc === anoEsperado;
      console.log(`  Validação: Primeiro vencimento no mês seguinte ao início? ${estaCorreto ? 'CORRETO ✓' : 'INCORRETO ✗'}`);

      if (!estaCorreto) todosCorretos = false;
    }
    console.log('');
  });

  console.log('=== RESULTADO FINAL ===');
  console.log(todosCorretos ? '✓ Todos os cenários passaram na validação!' : '✗ Alguns cenários falharam na validação.');

  return todosCorretos;
})();