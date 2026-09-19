# CrediGestor v26 Multiusuário

Este pacote foi criado sobre a cópia real da branch `multiusuario-v1`. A `main` não foi alterada.

## O que já está incluído

- Login com Google usando Firebase Authentication.
- Uma organização isolada para cada proprietário.
- Perfis Administrador, Gerente, Cobrador e Consulta.
- Sincronização em tempo real pelo Cloud Firestore.
- Convite de usuários por e-mail.
- Regras de segurança do Firestore por organização e perfil.
- Migração do `localStorage` sem apagar os dados atuais.
- Cópia de segurança local antes do primeiro envio à nuvem.
- Todos os recursos e arquivos da v25 preservados.

## Instalação simples

Faça uma etapa por vez e sempre confirme que a branch selecionada no GitHub é `multiusuario-v1`.

### 1. Enviar os arquivos ao GitHub

1. Abra o repositório `jesusneresberg-ux/CredGestor`.
2. Selecione a branch `multiusuario-v1`.
3. Use **Add file > Upload files**.
4. Envie todo o conteúdo desta pasta, mantendo os nomes dos arquivos.
5. Confirme que `index.html`, `app.js` e `sw.js` serão substituídos somente nessa branch.

Pare aqui antes de mexer no Firebase. Confirme no GitHub que o último envio aparece na branch `multiusuario-v1`.

### 2. Criar o projeto Firebase

1. Abra `https://console.firebase.google.com/`.
2. Crie um projeto chamado `CrediGestor`.
3. Dentro do projeto, adicione um aplicativo **Web**.
4. Copie a configuração exibida pelo Firebase.
5. No arquivo `firebase-config.js`, substitua somente os seis valores `COLE_AQUI`.

### 3. Ativar o login Google

1. No Firebase, abra **Authentication**.
2. Clique em **Começar**.
3. Em **Método de login**, ative **Google**.
4. Informe o e-mail de suporte e salve.

### 4. Criar o banco e publicar as regras

1. No Firebase, abra **Firestore Database**.
2. Clique em **Criar banco de dados** e escolha o modo de produção.
3. Abra a aba **Regras**.
4. Substitua o conteúdo pelo arquivo `firestore.rules` deste pacote.
5. Clique em **Publicar**.

### 5. Testar antes de usar os dados reais

Abra a versão da branch `multiusuario-v1`, entre com Google e confirme:

- o nome da organização aparece em **Minha conta**;
- seu perfil aparece como **Administrador**;
- os clientes atuais continuam visíveis;
- existe uma chave de backup iniciada por `credigestor_backup_before_v26_` no navegador;
- uma alteração feita em um aparelho aparece no outro após o login com a mesma conta.

Não faça merge para `main` antes desses testes.

## Perfis

- **Administrador:** acesso total, usuários e configurações.
- **Gerente:** clientes, empréstimos, pagamentos e operação; sem gestão de usuários.
- **Cobrador:** consulta a carteira e registra pagamentos.
- **Consulta:** somente visualização.

O primeiro usuário que entra cria a própria organização e recebe o perfil Administrador. Para adicionar outra pessoa, abra **Minha conta**, crie o convite com o e-mail exato da Conta Google e escolha o perfil.
