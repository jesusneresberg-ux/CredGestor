# CredGestor - Versão 2026.10.25

Sistema completo de Gestão de Crédito com histórico de pagamentos e geração de APK Android.

## 🆕 Novidades desta Versão

### Histórico de Pagamentos por Cliente
- ✅ Visualização completa do histórico de pagamentos
- ✅ Extrato detalhado com filtros por data, tipo e forma de pagamento
- ✅ Estatísticas automáticas (total pago, média, quantidade)
- ✅ Armazenamento persistente (Firebase + LocalStorage como backup)
- ✅ Exportação em CSV e PDF
- ✅ Impressão de extratos
- ✅ **NOVO: Excluir pagamentos do histórico**
- ✅ **NOVO: Enviar comprovante via WhatsApp**
- ✅ **NOVO: Copiar comprovante para área de transferência**
- ✅ Interface responsiva (mobile e desktop)
- ✅ Tema claro e escuro

### Geração de APK Android
- ✅ Configuração completa do Capacitor
- ✅ Suporte a Android 6+ (API 22+)
- ✅ Splash screen personalizada
- ✅ Ícones e recursos Android
- ✅ Build scripts prontos

## 📁 Estrutura de Arquivos

```
CredGestor/
├── index.html                      # HTML principal atualizado (v29)
├── payment-history.css             # Estilos do histórico (NOVO)
├── features-payment-history.js     # Lógica do histórico (NOVO)
├── package.json                    # Dependências Node.js (NOVO)
├── capacitor.config.json           # Configuração Capacitor (NOVO)
├── AndroidManifest.xml             # Manifest Android (NOVO)
├── MainActivity.java               # Activity principal (NOVO)
├── android_build.gradle            # Build config raiz (NOVO)
├── android_app_build.gradle        # Build config app (NOVO)
└── README.md                       # Este arquivo
```

## 🚀 Como Usar o Histórico de Pagamentos

### Integração Automática

O módulo de histórico se integra automaticamente ao sistema existente. Quando um pagamento é registrado, ele é automaticamente salvo no histórico.

### Visualizar Histórico de um Cliente

1. Na tela de clientes, clique no botão "Ver Histórico" do cliente desejado
2. O histórico será aberto em um modal com todas as informações
3. Use os filtros para refinar a busca:
   - **Por mês**: Selecione um mês específico
   - **Por tipo**: Total ou Parcial
   - **Por forma**: Dinheiro, PIX, Transferência, Cartão

### Ações Disponíveis para Cada Pagamento

#### 📤 Enviar Comprovante via WhatsApp
- Clique no botão verde "📤" ao lado do pagamento
- O comprovante será formatado automaticamente
- Abrirá o WhatsApp Web/App com a mensagem pronta
- Requisito: Cliente deve ter telefone cadastrado

#### 📋 Copiar Comprovante
- Clique no botão azul "📋" ao lado do pagamento
- Comprovante será copiado para área de transferência
- Cole onde quiser (SMS, e-mail, etc.)

#### 🗑️ Excluir Pagamento
- Clique no botão vermelho "🗑️" ao lado do pagamento
- Confirme a exclusão
- Pagamento será removido do histórico
- Ação não pode ser desfeita (soft delete no banco)

### Formato do Comprovante

O comprovante gerado contém:
- 🧾 Número do comprovante
- 📅 Data e hora do pagamento
- 👤 Nome do cliente
- 💰 Valor pago e saldo restante
- 💳 Forma de pagamento
- 📝 Observações (se houver)
- ✅ Confirmação de registro
   - **Por mês**: Selecione um mês específico
   - **Por tipo**: Total ou Parcial
   - **Por forma**: Dinheiro, PIX, Transferência, Cartão

### Exportar Extrato

- **CSV**: Clique em "Exportar CSV" para gerar planilha
- **PDF**: Clique em "Exportar PDF" para gerar documento imprimível
- **Imprimir**: Clique em "Imprimir" para impressão direta

### Estrutura dos Dados

Cada pagamento armazena:
- Data e hora do pagamento
- Valor pago
- Tipo (total ou parcial)
- Forma de pagamento
- Referência (mês/ano)
- Saldo após pagamento
- Observações
- Número do comprovante
- Usuário que registrou
- Telefone do cliente (para envio de comprovante)

### Exemplo de Comprovante Gerado

```
🧾 COMPROVANTE DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Dados do Pagamento
• Comprovante: PAY-1234567890-abc123
• Data: 25/10/2026
• Horário: 14:30:00

👤 Cliente
• Nome: João Silva

💰 Valores
• Tipo: Pagamento Parcial
• Valor Pago: R$ 500,00
• Referência: 10/2026
• Saldo Restante: R$ 1.500,00

💳 Forma de Pagamento
• PIX

━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pagamento registrado com sucesso

CredGestor - Sistema de Gestão de Crédito
Gerado em: 25/10/2026 14:30:00
```

## 📱 Como Gerar o APK Android

### Pré-requisitos

1. **Node.js** (versão 16 ou superior)
2. **JDK 17** ou superior
3. **Android Studio** (ou Android SDK via linha de comando)
4. **Capacitor CLI**

### Instalação Inicial

```bash
# 1. Instalar dependências
npm install

# 2. Adicionar plataforma Android
npx cap add android

# 3. Sincronizar arquivos
npx cap sync android
```

### Configurar Keystore para Assinatura

```bash
# Criar keystore (apenas primeira vez)
keytool -genkey -v -keystore credigestor-keystore.jks \
  -alias credigestor \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Anotar as senhas criadas!
```

### Editar Configurações de Build

No arquivo `android/app/build.gradle`, substitua:
- `YOUR_KEYSTORE_PASSWORD` pela senha do keystore
- `YOUR_KEY_PASSWORD` pela senha da chave

Ou defina variáveis de ambiente:
```bash
export KEYSTORE_PASSWORD="sua_senha_keystore"
export KEY_PASSWORD="sua_senha_chave"
```

### Gerar APK

```bash
# Método 1: Via script npm
npm run android:build

# Método 2: Manual
npx cap sync android
cd android
./gradlew assembleRelease

# APK gerado em:
# android/app/build/outputs/apk/release/app-release.apk
```

### Instalar APK no Dispositivo

```bash
# Via ADB
adb install android/app/build/outputs/apk/release/app-release.apk

# Ou copie o APK para o dispositivo e instale manualmente
```

## 🔧 Configurações Avançadas

### Alterar URL do Servidor

Edite `capacitor.config.json`:

```json
{
  "server": {
    "url": "https://SEU-DOMINIO.com/",
    "cleartext": true
  }
}
```

### Personalizar Ícones e Splash

1. Coloque seus assets em:
   - `resources/icon.png` (1024x1024)
   - `resources/splash.png` (2732x2732)

2. Gere os recursos:
```bash
npx @capacitor/assets generate
```

### Adicionar Plugins Capacitor

```bash
npm install @capacitor/NOME-DO-PLUGIN
npx cap sync android
```

## 📤 Upload para GitHub

### Arquivos Essenciais para Upload

1. **Arquivos Web** (atualização imediata):
   ```
   index.html
   payment-history.css
   features-payment-history.js
   ```

2. **Configuração do Projeto** (primeira vez):
   ```
   package.json
   capacitor.config.json
   ```

3. **Arquivos Android** (para build do APK):
   ```
   AndroidManifest.xml
   MainActivity.java
   android_build.gradle (renomear para android/build.gradle)
   android_app_build.gradle (renomear para android/app/build.gradle)
   ```

### Estrutura no GitHub

```
seu-repositorio/
├── index.html
├── styles.css
├── enhancements.css
├── payment-history.css          ← NOVO
├── app.js
├── features-payment-history.js  ← NOVO
├── package.json                 ← NOVO
├── capacitor.config.json        ← NOVO
└── android/
    ├── app/
    │   ├── src/main/
    │   │   ├── AndroidManifest.xml
    │   │   └── java/com/credigestor/app/
    │   │       └── MainActivity.java
    │   └── build.gradle
    └── build.gradle
```

## 🔄 Fluxo de Atualização

### Para Atualizar Apenas a Interface Web

1. Faça upload dos arquivos:
   - `index.html`
   - `payment-history.css`
   - `features-payment-history.js`

2. Publique no Firebase:
   ```bash
   firebase deploy --only hosting --project credigestor-testes
   ```

3. A atualização aparece imediatamente no APK (pois ele carrega a URL remota)

### Para Gerar Novo APK

1. Atualize `versionCode` em `android/app/build.gradle`
2. Execute `npm run android:build`
3. Distribua o novo APK

## 🧪 Testes

### Testar Histórico Localmente

```javascript
// No console do navegador
const payment = {
  clientId: 'CLI001',
  clientName: 'João Silva',
  loanId: 'EMP001',
  amount: 500.00,
  date: new Date().toISOString(),
  type: 'partial',
  reference: '10/2026',
  balance: 1500.00,
  method: 'pix',
  notes: 'Pagamento teste'
};

await PaymentHistory.savePayment(payment);
```

### Verificar Dados Salvos

```javascript
// Listar todos os pagamentos do cliente
const payments = await PaymentHistory.getClientPaymentHistory('CLI001');
console.log(payments);

// Ver estatísticas
const stats = PaymentHistory.calculateStats(payments);
console.log(stats);
```

## 📊 Armazenamento de Dados

### Prioridade de Armazenamento

1. **Firebase Firestore** (principal)
   - Coleção: `payments`
   - Sincronização em tempo real
   - Acessível de qualquer dispositivo

2. **LocalStorage** (backup automático)
   - Chave: `credigestor_payments`
   - Índice: `credigestor_payment_index`
   - Funciona offline

### Estrutura no Firebase

```
payments/
  ├── PAY-1730000001-abc123/
  │   ├── id: "PAY-1730000001-abc123"
  │   ├── clientId: "CLI001"
  │   ├── clientName: "João Silva"
  │   ├── amount: 500.00
  │   ├── date: "2026-10-25T10:30:00Z"
  │   ├── type: "partial"
  │   ├── method: "pix"
  │   └── ...
  └── PAY-1730000002-def456/
      └── ...
```

## 🛡️ Segurança

### Boas Práticas

1. **Keystore**: Nunca commit o keystore no GitHub
2. **Senhas**: Use variáveis de ambiente para senhas
3. **Firebase**: Configure regras de segurança no Firestore
4. **HTTPS**: Sempre use conexões seguras

### Regras Firestore Recomendadas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /payments/{paymentId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📝 Changelog

### Versão 2026.10.25 (Build 2026102501)

**Novas Funcionalidades:**
- Sistema completo de histórico de pagamentos por cliente
- Extrato detalhado com filtros avançados
- Exportação de extrato em CSV e PDF
- Estatísticas automáticas de pagamentos
- Armazenamento persistente (Firebase + LocalStorage)
- Configuração completa para geração de APK Android
- Interface responsiva com tema claro/escuro

**Melhorias Técnicas:**
- Cache busting atualizado (v=29)
- Integração automática com sistema de pagamentos existente
- Backup local automático
- Índices otimizados para consultas rápidas

**Arquivos Novos:**
- `features-payment-history.js` - Módulo de histórico
- `payment-history.css` - Estilos do histórico
- `package.json` - Configuração npm
- `capacitor.config.json` - Configuração Capacitor
- `AndroidManifest.xml` - Manifest Android
- `MainActivity.java` - Activity principal

## 🆘 Suporte e Troubleshooting

### APK não instala

- Verificar se o dispositivo permite instalação de fontes desconhecidas
- Confirmar que o APK está assinado corretamente
- Verificar compatibilidade de versão do Android (mínimo 6.0)

### Histórico não salva

- Verificar conexão com Firebase
- Checar console do navegador para erros
- Confirmar que LocalStorage está habilitado
- Verificar autenticação do usuário

### Build falha

- Verificar instalação do JDK 17
- Confirmar que Android SDK está configurado
- Executar `npx cap doctor` para diagnóstico
- Limpar build: `cd android && ./gradlew clean`

## 📞 Contato

- **Desenvolvedor**: Jesus Neresberg
- **Projeto**: CredGestor
- **Versão**: 2026.10.25
- **Build**: 2026102501

## 📜 Licença

MIT License - Sinta-se livre para usar e modificar conforme necessário.

---

**Próximos Passos Recomendados:**

1. ✅ Fazer upload dos arquivos no GitHub
2. ✅ Testar histórico de pagamentos localmente
3. ✅ Configurar e gerar primeiro APK
4. ✅ Instalar e testar em dispositivo Android
5. ✅ Configurar CI/CD para builds automáticos (opcional)
