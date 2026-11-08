# Dashboard integrado ao aplicativo

Esta alteração adiciona um botão ▥ ao aplicativo autenticado em `firebase-hosting/` e uma página `painel/` sem carteira embutida. O APK existente abre o mesmo Firebase Hosting; publicar a pasta entrega o botão sem recompilar o APK.

O botão abre o painel na mesma origem e navegador. A aba do aplicativo envia somente nome, código, situação ativa, principal calculado pela função atual do aplicativo, cobrança mensal e dia de vencimento. Não envia CPF, telefone, endereço, credenciais nem o estado completo. A atualização acontece depois de uma gravação bem-sucedida e nos pedidos da aba do painel. As duas abas precisam permanecer abertas; o painel não é sincronização em segundo plano ou entre aparelhos. A carteira não é copiada para Firestore, Drive nem planilha.

O painel exige o mesmo UID principal já autorizado no aplicativo. A planilha Empréstimos Gerais é consultada diretamente pela API Google Sheets, por meio de autorização explícita do Google com o escopo `spreadsheets.readonly`. A credencial de acesso permanece apenas em memória nesta página e não é enviada ao aplicativo, ao servidor do dashboard ou ao GitHub. Acesso somente de leitura; não registra pagamentos, juros ou baixas.

Antes da primeira leitura, o proprietário clica em **Conectar planilha Google**. O projeto Google Cloud associado ao Firebase precisa ter a API Google Sheets habilitada e permitir o escopo de leitura no consentimento OAuth. A conta deve ter acesso à planilha. Erros de API, autorização e cabeçalhos alterados são apresentados sem substituir a última leitura válida. O painel relê a planilha a cada 60 segundos enquanto aberto e com autorização válida. A autorização é solicitada novamente quando expira. Nenhum gatilho é criado.

Leia a planilha usando cabeçalhos atuais: Clientes A:N e Lançamentos A:E, limites obtidos dos metadados (máximo 5.000 linhas por aba). Os registros são mantidos por fonte; as carteiras nunca são somadas. A comparação por nome normalizado não resolve automaticamente apelidos. Dação em pagamento não integra recebimentos monetários.

## Publicação e validação pendentes

Publicar `firebase-hosting/` pelo fluxo existente do GitHub Actions. Esta preparação não confirma publicação nem acesso real ao Google Sheets. Testar depois da publicação com a conta principal no aparelho onde a carteira está armazenada. Confirmar leitura inicial, novo lançamento no APK, atualização da conferência, expiração, recusa de autorização e fechamento da aba de origem.

O painel anterior no ChatGPT Sites continua sendo uma publicação separada. Ele não passa a ler o armazenamento do Firebase Hosting automaticamente; conectar a versão publicada após a implantação.

Validação local: `node tests/dashboard-integration.cjs` e `node --check` nos scripts alterados. Os testes usam somente dados fictícios; não verificam OAuth real, publicação, leituras do Google ou navegação no celular.
