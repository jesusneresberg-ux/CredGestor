# Migração segura para a v26

## O que acontece no primeiro login

1. O CrediGestor lê os dados atuais da chave `credigestor_v1`.
2. Cria uma cópia separada no navegador com o nome `credigestor_backup_before_v26_<data>`.
3. Mantém a chave original `credigestor_v1` intacta.
4. Cria a organização do proprietário no Firestore.
5. Envia uma cópia dos dados para `organizations/{organizationId}/appData/main`.
6. Ativa a sincronização em tempo real.

Se já existirem dados na organização, a versão da nuvem é carregada sem executar uma nova migração automática.

## Recuperação

Em **Minha conta**, use **Baixar backup de segurança**. O arquivo JSON pode ser restaurado pela função de importação já existente no CrediGestor.

## Cuidados

- Não apague os dados do navegador antes de validar a nuvem.
- Não altere a `main` durante os testes.
- Teste primeiro com uma cópia dos dados e dois navegadores/aparelhos.
- Publique `firestore.rules` antes de convidar outros usuários.
- Use o e-mail exato da Conta Google ao criar um convite.
