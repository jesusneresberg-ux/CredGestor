# CrediGestor v25 — Pacote de atualização manual

## O que esta atualização corrige

- Acréscimo / Novo valor liberado passa a refletir imediatamente no saldo persistido.
- Juros são recalculados a partir do saldo principal atualizado.
- Comprovantes deixam de usar apenas o valor inicial do empréstimo.
- O comprovante passa a mostrar:
  - valor original;
  - total de acréscimos / novo valor liberado;
  - amortizações / reduções;
  - saldo principal atualizado;
  - taxa de juros;
  - juros atuais;
  - capital + juros atuais.
- Mantém a regra de não exibir data de término do contrato.
- Atualiza o cache PWA para `credigestor-v25`.

## Arquivos do pacote

1. `features-v25.js` — NOVO arquivo.
2. `index.html` — SUBSTITUIR o arquivo existente.
3. `sw.js` — SUBSTITUIR o arquivo existente.

## Como instalar pelo celular no GitHub

1. Abra o repositório `jesusneresberg-ux/CredGestor`.
2. Entre em **Add file > Upload files**.
3. Envie os três arquivos deste pacote.
4. O GitHub identificará `index.html` e `sw.js` como substituições e `features-v25.js` como novo.
5. Confirme em **Commit changes** na branch `main`.
6. Aguarde o GitHub Pages publicar a alteração.
7. Abra o CrediGestor e atualize a página. Se estiver instalado como PWA, feche e abra novamente uma vez para o Service Worker v25 assumir o controle.

## Teste rápido recomendado

1. Abra um empréstimo com saldo conhecido.
2. Registre **Acréscimo/Novo valor liberado**, por exemplo R$ 500,00.
3. Volte ao contrato.
4. Confira se o saldo aumentou R$ 500,00 imediatamente.
5. Gere o comprovante.
6. Confirme se aparecem:
   - o acréscimo de R$ 500,00;
   - o novo saldo;
   - os juros calculados sobre esse novo saldo.

## Observação

Antes de enviar os arquivos, é recomendável baixar uma cópia do repositório ou manter o histórico do GitHub. Como o GitHub registra cada commit, a versão anterior também poderá ser restaurada pelo histórico.
