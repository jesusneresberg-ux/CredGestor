# Migração segura — CrediGestor 26.1

A migração nunca acontece automaticamente. A versão atual e o arquivo credigestor_v1 do navegador original devem ser preservados.

1. No CrediGestor atual, baixe um backup JSON completo e guarde uma cópia em outro local. Não envie esse backup ao GitHub.
2. Na prévia v26.1, entre com a conta do proprietário da organização de destino.
3. Abra Minha conta > Trazer a carteira antiga.
4. Se os dados antigos estiverem nesta mesma origem do navegador, use Baixar backup deste navegador. Se a prévia tiver outro endereço, selecione o JSON salvo no passo 1.
5. Confira a conta, a organização e a quantidade de clientes. Confirme que o backup está realmente salvo.
6. Só então escolha Migrar para esta organização.
7. Aguarde a confirmação na nuvem. Confira clientes, contratos, pagamentos, garantias, configurações e totais antes de autorizar qualquer troca da versão atual.

A migração é permitida somente ao proprietário e apenas em uma organização vazia, sem nenhuma alteração anterior. Se a carteira de destino já tiver mudanças, a operação é bloqueada; não tente limpar a nuvem para contornar o bloqueio.
O original local permanece intacto e uma cópia extra identificada por usuário/organização é criada antes da gravação. Falta de espaço no navegador aborta a migração.
O tamanho máximo aceito é 800 KB. Não reduza ou exclua dados apenas para caber: peça adaptação de armazenamento.
Um erro de conexão ou conflito não significa migração concluída. Use Minha conta para baixar o rascunho e conferir a versão confirmada na nuvem.
Importar um JSON pela rota antiga não substitui silenciosamente uma organização: a interface direciona para esta migração explícita. CSV não é uma fonte de migração direta da v26.1.

## Rascunhos e conflitos

Se outra sessão gravar primeiro, o seu rascunho é mantido separadamente. Baixe-o antes de fechar a aba.
Carregar versão da nuvem não envia o rascunho. Compare e reaplique apenas a mudança necessária.
O arquivo de recuperação contém um campo drafts; cada item identifica o usuário, a organização, a revisão e o estado não confirmado. Não é um backup final e não deve ser importado inteiro sobre a carteira.
Rascunhos antigos de conflito são arquivados separadamente antes de uma nova edição. Eles continuam disponíveis para download naquela aba/conta.

## Retorno à versão anterior

A main e o site atual devem continuar como estavam durante os testes. Nenhum passo deste pacote exige apagar o armazenamento do navegador ou alterar a main.
Se houver dados de uma v26 já gravados no Firestore, a v26.1 recusa o formato antigo. Faça backup e solicite uma migração assistida; não apague a base.
