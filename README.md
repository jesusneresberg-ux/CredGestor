# CrediGestor Mobile — MVP 1

Primeira versão funcional do projeto de gestão de crédito, feita para smartphone.

## O que já está implementado
- Dashboard mobile com carteira ativa, recebido, a receber, atraso e inadimplência.
- Cadastro de clientes com níveis Bronze, Prata, Ouro e Diamante.
- Limite de crédito por cliente e cálculo do limite disponível.
- Contratos editáveis.
- Acréscimo de novo valor e amortização dentro do mesmo contrato, com histórico.
- Regra de vencimento por dia-base (1 a 31), preservando o dia original:
  - dia 31 em setembro => dia 30;
  - dia 31 em fevereiro => dia 28/29;
  - no mês seguinte volta ao dia 31 quando existir.
- Registro de pagamentos com mês de referência.
- Garantias: veículo, terreno, chácara, joia, eletrodoméstico, eletroportátil e outros.
- CRM com registros de ligação, WhatsApp, visita, acordo e renovação.
- Score interno simples de apoio à decisão, sem aprovação automática.
- Metas mensais.
- Temas visuais, troca de fonte e imagem de fundo personalizada.
- Opção de Google Agenda: gera evento de cobrança para o calendário.
- Notificações web quando o app é aberto e há vencimentos nos dias configurados.
- Backup e restauração em JSON.
- PWA básica para instalar na tela inicial do celular.

## Como testar
1. Para apenas ver a interface, abra `index.html` no navegador.
2. Para instalar como PWA e usar service worker/notificações de forma correta, publique a pasta em HTTPS
   (GitHub Pages, Netlify, Vercel, Render Static Site etc.) ou rode em um servidor local.
3. No Android/Chrome, abra o endereço publicado e use "Adicionar à tela inicial".

## Limitação proposital desta primeira entrega
Os dados ficam no navegador do aparelho. Para muitos clientes, múltiplos dispositivos e segurança real,
a próxima fase deve trocar o armazenamento local por banco de dados (por exemplo PostgreSQL/Supabase)
com autenticação, backups automáticos e regras de acesso.

A integração atual com Google Agenda abre um evento pronto para confirmação. Sincronização automática
bidirecional exige OAuth e Google Calendar API, recomendada para a fase 2.

## Próxima fase recomendada
- Login/PIN/biometria.
- Banco em nuvem e sincronização.
- Histórico financeiro e relatórios avançados.
- Filtros por dia de cobrança.
- Anexos/fotos/documentos de garantias.
- Exportação Excel/PDF.
- Notificações em segundo plano no Android.
- Integração Google Calendar via API.
- APK Android (Capacitor/Android Studio).
