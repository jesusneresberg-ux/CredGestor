# Versão aberta pelo APK CrediGestor

O APK Android 26.2.1 abre https://credigestor-testes.web.app/ no navegador. O site de GitHub Pages na raiz deste repositório é uma publicação separada.

Esta pasta preserva a versão individual existente no Firebase, incluindo acesso Google, armazenamento no navegador, renegociação, datas de contratos e aparência. A atualização de 08/10/2026 adiciona Pagamento parcial na central de pagamentos e um comprovante resumido com destaque para o restante para quitar o mês. Os pagamentos são acumulados por referência, sem sobrescrever adiantamentos anteriores. Falhas de gravação não geram comprovante.

Publicar a partir desta pasta com Firebase CLI: `firebase deploy --only hosting --project credigestor-testes --non-interactive`.

O teste `tests/firebase-partial-payments.cjs` usa clientes fictícios e simula somente o acesso autenticado para exercitar as telas; não confirma login Google real, envio de WhatsApp nem execução no celular. Não contém dados da carteira. Pode usar `BASE_URL=https://credigestor-testes.web.app/` para testar os arquivos publicados.

Não foi compilado um novo APK nesta atualização. O APK existente continua abrindo o mesmo endereço.

## Histórico de pagamentos — 30/10/2026

A ficha do cliente tem o botão “🧾 Histórico de pagamentos” (`features-payment-history.js`
e `payment-history.css`). Ele lê os pagamentos já gravados nos contratos, então
os dados sincronizados pelo Firebase aparecem sem migração. Permite filtrar por
mês, tipo e forma, exportar CSV, imprimir/salvar PDF, enviar o comprovante pelo
WhatsApp e excluir um pagamento (o saldo é recalculado). Publique esta pasta no
Firebase Hosting para a mudança chegar ao APK. Não é preciso gerar novo APK.
