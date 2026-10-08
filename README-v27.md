# CrediGestor 27 — pagamento parcial

Em Pagamentos, a opção **Pagamento parcial** registra adiantamentos para o mês escolhido, antes, no dia ou depois do vencimento. O valor é somado aos recebimentos anteriores da mesma referência, com cálculo em centavos.

O comprovante resumido de adiantamento informa cliente, empréstimo, referência, data, forma, valor recebido agora e total já pago no mês. **RESTANTE PARA QUITAR O MÊS** aparece em destaque. O aplicativo abre o WhatsApp com o texto pronto; o usuário confirma o envio no WhatsApp. Também há prévia e opção de copiar. Sem telefone cadastrado, o pagamento fica salvo e o comprovante pode ser copiado.

Cada recebimento mantém seu próprio registro, data e valor em `payments`. Os dados anteriores continuam na chave `credigestor_v1`. O histórico identifica os adiantamentos, e o backup JSON preserva seus valores e os saldos registrados na emissão. O pagamento parcial reduz a cobrança mensal, sem amortizar o capital. A cobrança permanece em aberto ou atrasada enquanto houver saldo.

Pagar Parcela sugere apenas o saldo restante; ao completar o mês, emite o comprovante definitivo. Se esse fluxo receber menos que o saldo, também emite um comprovante de adiantamento. O último pagamento pela opção parcial pode completar o mês: o comprovante mostra saldo zero e mês quitado.

Não são aceitos valores zero, negativos, acima do saldo do mês nem uma referência anterior ao primeiro vencimento. É possível escolher outra referência, sem modificar os saldos de outros meses. Os juros residuais da quitação de capital consideram os adiantamentos já registrados no mês atual.

## Verificação

Instale `playwright@1.62.1`, execute `npx playwright install chromium --only-shell`, depois `node tests/requirements.cjs` e `node tests/partial-payments.cjs`.

Os testes usam dados fictícios em sessão isolada e interceptam a abertura do WhatsApp para verificar o texto gerado. Nenhuma mensagem real é enviada. O GitHub Actions executa as duas suítes. A verificação cobre adiantamentos atrasados, no vencimento e antecipados, soma de recebimentos, centavos, persistência, separação por mês, comprovantes e compatibilidade com a versão anterior, incluindo reabertura offline.
