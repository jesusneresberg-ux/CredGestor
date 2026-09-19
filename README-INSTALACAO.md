# CrediGestor 26.1 — versão de teste multiusuário

Este pacote substitui a v26 anterior, que apresentou falhas na revisão. Não use o ZIP v26 antigo.
As regras e o código de sincronização da v26.1 passaram pelos testes locais descritos em VALIDACAO-v26.md. A configuração do Firebase real e a validação final com suas contas ainda estão pendentes.

## Primeiro passo: substituir os arquivos na branch de teste

1. Extraia CrediGestor-v26.1-Multiusuario.zip.
2. Abra a branch **multiusuario-v1** do repositório CredGestor.
3. Use Add file > Upload files. Envie o conteúdo da pasta extraída, não o ZIP nem uma pasta dentro da outra.
4. Confirme que o destino é multiusuario-v1. Grave a substituição nessa branch.
5. Não altere main, não faça merge e não mude a origem do GitHub Pages.

Se você já gravou a v26, não precisa apagar a branch: este novo envio substitui os arquivos correspondentes e adiciona v26-core.js.
O histórico do GitHub continua guardando a versão anterior. Nenhuma carteira deve ser enviada ao GitHub: não inclua backups, dados de clientes, chaves privadas ou arquivos de conta de serviço.

## Depois: Firebase (com acompanhamento, uma etapa por vez)

Use um projeto de testes separado do seu ambiente atual.
No projeto, será necessário cadastrar um app Web, habilitar o login Google no Authentication e criar um Cloud Firestore Standard.
Preencha somente CREDIGESTOR_FIREBASE_CONFIG em firebase-config.js com a configuração Web fornecida pelo console. Essa configuração identifica o app; nunca use uma chave privada de conta de serviço.
Publique no Firestore as regras deste pacote, firestore.rules. Não use modo de teste com acesso público.
A URL de teste precisa estar em Authorized domains do Authentication. A prévia deve usar um endereço separado do site atual, sem trocar a branch publicada pelo GitHub Pages.
A criação da prévia e o teste real de login ainda precisam ser feitos. Não basta abrir index.html como arquivo.

## Perfis

| Perfil | Permissões |
| --- | --- |
| Administrador | Carteira, configurações, convites e perfis de outros membros; não altera o proprietário |
| Gerente | Carteira, contratos e pagamentos; sem mudar configurações ou acesso da equipe |
| Cobrador | Leitura da organização e registro de parcelas em Minha conta; não altera contratos nem corrige/exclui recibos |
| Consulta | Leitura da organização; nenhuma escrita |

Todos os membros ativos leem a carteira completa de sua própria organização. Não há carteira individual por cobrador nesta versão.
No primeiro login sem convite, cria-se uma organização vazia. Um convite deve ser criado antes do primeiro login do convidado.
Uma conta pertence a uma organização. Convites duram seis dias, não enviam e-mail e só podem ser usados uma vez. Convites expirados precisam de intervenção do administrador do projeto nesta versão.
O Administrador pode promover outro membro depois que ele entrar. O proprietário não pode ser rebaixado/desativado pela interface.
Organizações novas começam sem chave PIX. Dados PIX existentes são mantidos quando você escolhe migrar sua própria carteira.

## Segurança e sincronização

O login antigo, a biometria local antiga e a sincronização automática do Google Drive ficam desativados na v26.1; os arquivos históricos permanecem no pacote.
O acesso utiliza Firebase Authentication. A decisão de permissão é aplicada pelo Firestore, não apenas pelos botões da tela.
A carteira original em localStorage não é carregada automaticamente, apagada ou substituída no modo de nuvem. Sair da conta limpa a carteira da memória e fecha o formulário.
Alterações administrativas usam uma revisão crescente. Se duas sessões alterarem a mesma revisão, uma delas precisa recarregar e reaplicar sua mudança. Não há mesclagem automática.
Rascunhos não confirmados ficam separados por usuário/organização no armazenamento da aba e podem ser baixados em Minha conta. Baixe antes de fechar a aba; não são backups permanentes.
Recebimentos do Cobrador usam registros imutáveis por cliente, contrato e referência mensal. Duplicações são bloqueadas.
Se houver dois registros diferentes para a mesma parcela, Minha conta permite baixar as duas versões para revisão do administrador. O total usa o registro principal até a revisão; o recibo original não é apagado. Casos não conciliáveis pela edição normal exigem revisão assistida.
Não há gravação offline garantida. Aguarde o indicador Conectado antes de considerar uma alteração confirmada.

## Limites da versão de teste

A carteira ainda é um documento por organização: limite da aplicação de 800 KB, até 2.000 clientes e até 5.000 recibos incorporados. Fotos podem atingir o limite rapidamente. Uma carteira maior exige adaptação antes de migrar.
O Administrador e o Gerente são perfis de confiança para editar o conteúdo da carteira. Ainda não há trilha completa de auditoria de suas edições, faturamento, assinatura ou cobrança automática.
O campo plan é apenas uma base estrutural. Isso não é um sistema de assinaturas pronto.
Antes de usar dados reais, valide com duas organizações e os quatro perfis, confira os valores do seu backup e mantenha a main intacta até aprovar os resultados.

Consulte MIGRACAO-v26.md antes de trazer seus dados.
