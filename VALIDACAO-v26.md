# Validação do pacote v26

Fonte usada: branch `multiusuario-v1`, commit `a55b847`, baixada do repositório `jesusneresberg-ux/CredGestor` em 19/09/2026.

## Verificações concluídas

- O ZIP anteriormente citado em `/mnt/data` não existia e não foi reutilizado.
- Todos os arquivos da v25 presentes na branch foram copiados para o pacote v26.
- A `main` não foi alterada.
- Todos os arquivos JavaScript passaram pela verificação de sintaxe.
- Todas as referências locais de `index.html` existem.
- O aplicativo abriu em servidor local.
- O bloqueio de configuração pendente do Firebase apareceu corretamente.
- O modo local abriu sem apagar os dados do navegador.
- As telas Dashboard, Clientes e Minha conta foram abertas no teste.
- Todos os recursos locais, inclusive o service worker, responderam sem arquivo ausente.
- A referência antiga a `features-v17.js`, inexistente na branch original, foi removida de `index.html` e `sw.js`.

## Validação que depende do usuário

O login Google e a gravação real no Firestore somente podem ser testados depois de preencher `firebase-config.js`, ativar o provedor Google e publicar `firestore.rules` no projeto Firebase do usuário. Até isso ser feito, o pacote oferece o modo local seguro e não envia dados para nenhum projeto.
