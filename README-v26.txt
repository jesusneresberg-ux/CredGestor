CrediGestor v26 - arquivos de atualização

Arquivos:
- features-v17.js: restaura o módulo ausente que já era referenciado pelo index/PWA.
- features-v26.js: nova camada funcional.
- index.html: atualiza cache-busting para v26 e carrega features-v26.js.
- sw.js: muda o cache do PWA para credigestor-v26 e inclui features-v26.js.

Principais mudanças:
- Cobranças: Hoje / Atrasados / Próximos vencimentos.
- Saldo pendente considera pagamentos parciais.
- Cliente clicável na aba Empréstimos.
- Atalho + Novo empréstimo.
- Selo ✓ Em dia para cliente sem cobrança vencida ou vencendo hoje pendente.
- Atualização automática quando muda o dia.
