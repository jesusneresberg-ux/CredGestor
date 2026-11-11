# E-mail, senha e biometria

O acesso continua restrito ao UID proprietário atual. Não crie uma segunda conta: entre com Google, abra Minha conta, defina uma senha de pelo menos oito caracteres e passe a usar o mesmo e-mail. Ative E-mail/senha em Firebase Console → Authentication → Sign-in method. O botão Esqueci minha senha envia o fluxo oficial de recuperação.

A sessão persistida começa bloqueada. A senha permite entrar; a biometria libera uma sessão Firebase existente após ativação em Minha conta. Ao colocar o app em segundo plano, ele bloqueia novamente. Sair remove a ativação da biometria. O Android verifica a biometria; o JavaScript não recebe impressões digitais nem armazena a senha.

A versão antiga do APK continua oferecendo e-mail e senha, mas a biometria requer recompilar com o plugin CrediBiometric. O workflow Gerar APK com biometria prepara o projeto Android e gera um APK de validação. Esse APK usa assinatura de depuração: para atualizar a instalação atual preservando dados, gere a versão de produção com a mesma chave de assinatura já utilizada. Não desinstale a versão atual sem exportar o backup.

Validação: teste automatizado de login inclui sessão persistida bloqueada, senha, bloqueio em segundo plano e restrição da conta. Testar em aparelho real: ativação, biometria válida, cancelamento, ausência de biometria, retorno do segundo plano e recuperação de senha. Não foi possível executar Chromium neste ambiente por restrição de processos; os testes rodam no GitHub Actions. Compilação Android e aparelho real ainda precisam de validação.
