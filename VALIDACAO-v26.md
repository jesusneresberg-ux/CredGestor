# Validação da versão 26.1

Data: 19/09/2026.

## Verificado

- 31 cenários automatizados locais, combinando Firestore emulado, projeção de recibos e falha de transporte injetada no adaptador de teste.
- A suíte executa as regras e o código de sincronização deste pacote, não uma reprodução deles.
- Bootstrap sem convite, aceitação atômica de convite e vínculo exato de perfil.
- Tentativa de elevar Consulta a Administrador, convite expirado/desativado, convite de outro e-mail e reutilização de convite.
- Isolamento entre organizações; acesso sem autenticação ou com e-mail não verificado.
- Permissões de Administrador, Gerente, Cobrador e Consulta; proteção do proprietário e do plano.
- Registro de parcela válida, rejeição de duplicação, recibo inválido/negativo, alteração e exclusão de recibo.
- Divergências entre recibo e carteira são sinalizadas; as duas versões são preservadas, sem incorporação silenciosa.
- Atualização entre duas sessões do mesmo usuário.
- Gravações simultâneas: uma confirmação e uma rejeição com rascunho preservado, sem sobrescrita silenciosa.
- Logout, troca de conta, cancelamento de conexão e desativação de acesso.
- Migração explícita com cópia prévia, bloqueio em destino ocupado, erro de espaço e preservação de localStorage.
- Limite de tamanho, rejeição de chaves perigosas e arquivo de rascunho anterior.
- Falha de transporte simulada mantém rascunho e não o reenvia automaticamente. Isso não substitui um teste de queda real de internet em produção.
- Todos os JavaScript do pacote passaram pela verificação de sintaxe.
- Inspeção de navegador com Firebase Authentication/Firestore emulados e identidade fictícia: acesso ao painel, navegação, formulário de cliente, gravação, Minha conta e campos PIX vazios numa organização nova. Sem configuração Firebase, a interface ficou bloqueada com orientação visível. Não foram usados clientes ou credenciais reais.

A auditoria orientou o fechamento de permissões, a separação dos dados e os testes negativos. Os resultados locais não são certificação de segurança nem garantia de ausência de falhas.

## Ainda depende do seu ambiente

- Configuração de projeto Firebase real, provedor Google, domínios autorizados e publicação das regras.
- Fluxo OAuth real com popup do Google, em desktop e celular.
- Disponibilização da prévia em uma URL separada da versão atual.
- Conferência do backup real, incluindo tamanho, imagens, campos e totais.
- Teste de ponta a ponta dos quatro perfis na prévia e aprovação do usuário.
- Verificação de custos, monitoramento, backups do serviço e revisão de segurança antes de produção.

## Reprodução técnica

A pasta de evidências entregue separadamente inclui verify.mjs, package.json, pnpm-lock.yaml, firebase.json e test-results.json.
Requer Node.js e Java compatível com o Firebase CLI utilizado.
Instale as dependências e inicie os emuladores Firestore/Auth no projeto fictício demo-credigestor-v261.
Execute node verify.mjs; a suíte lê firestore.rules, v26-core.js e cloud-store-v26.js do pacote.
Nunca aponte esta suíte para um projeto de produção: ela limpa somente o projeto de emulação antes dos testes.
O adaptador preview.cjs é apenas uma ferramenta local de teste com identidade fictícia e não pertence ao pacote para upload.
