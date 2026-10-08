# CrediGestor 26.1

As abas de cobranças e o cadastro de empréstimos já existiam na versão 26. Esta atualização corrige o funcionamento sem duplicar módulos.

- Atrasados considera os meses desde o primeiro vencimento do contrato, incluindo pagamentos parciais. Contratos sem data de início mantêm a janela legada de dois meses anteriores.
- Próximos vencimentos inclui contratos cujo primeiro vencimento esteja além da antiga janela de dois meses futuros.
- O nome principal do cliente em Empréstimos abre seu cadastro, inclusive na apresentação usada desde a v10.
- O selo Em dia considera todas as cobranças vencidas e de hoje. Empréstimos quitados também mostram o selo quando o cliente não possui outra pendência. Apenas encerrar um contrato não equivale a quitá-lo.
- O assistente de cobrança existente volta a aparecer nas abas, respeitando sua configuração.
- A chave de armazenamento continua sendo `credigestor_v1`.

## Verificação

O fluxo automatizado usa navegador Chromium em 390 × 844, fuso America/Sao_Paulo e dados fictícios. Verifica listas, pagamento parcial e integral, cadastro clicável, novo empréstimo e persistência após recarregar, quitação e atualização na virada do dia.

Para executar: instale `playwright@1.62.1`, execute `npx playwright install chromium --only-shell` e `node tests/requirements.cjs`. O GitHub Actions também executa essa verificação.

A validação não utiliza cadastros reais e não envia mensagens pelo WhatsApp. APK não faz parte desta atualização.
