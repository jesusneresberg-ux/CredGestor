# 🚀 Instalação Rápida - CredGestor APK

Guia passo a passo para gerar e instalar o APK do CredGestor.

## ⚡ Instalação Express (10 minutos)

### 1️⃣ Pré-requisitos Mínimos

Instale apenas o essencial:

```bash
# Node.js (baixar de nodejs.org)
node --version  # Deve ser 16+

# JDK 17
java -version   # Deve ser 17+

# Android Command Line Tools
# Baixar de: https://developer.android.com/studio#command-tools
```

### 2️⃣ Setup do Projeto

```bash
# Clone ou baixe o repositório
cd CredGestor

# Instale dependências
npm install

# Adicione a plataforma Android
npx cap add android

# Sincronize arquivos
npx cap sync android
```

### 3️⃣ Copiar Arquivos Android

Copie os arquivos fornecidos para suas localizações:

```bash
# AndroidManifest.xml
cp AndroidManifest.xml android/app/src/main/AndroidManifest.xml

# MainActivity.java
cp MainActivity.java android/app/src/main/java/com/credigestor/app/MainActivity.java

# Build configs
cp android_build.gradle android/build.gradle
cp android_app_build.gradle android/app/build.gradle
```

### 4️⃣ Criar Keystore (primeira vez)

```bash
keytool -genkey -v \
  -keystore credigestor-keystore.jks \
  -alias credigestor \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Anote as senhas!
# Exemplo:
# - Senha do keystore: Credi@2026!
# - Senha da chave: Credi@Key2026!
```

### 5️⃣ Configurar Senhas

Edite `android/app/build.gradle` e substitua:

```gradle
storePassword "SUA_SENHA_KEYSTORE_AQUI"
keyPassword "SUA_SENHA_CHAVE_AQUI"
```

### 6️⃣ Gerar APK

```bash
# Build do APK release
cd android
./gradlew assembleRelease

# No Windows use:
gradlew.bat assembleRelease
```

O APK estará em: `android/app/build/outputs/apk/release/app-release.apk`

### 7️⃣ Instalar no Dispositivo

**Opção A - Via USB (ADB):**
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

**Opção B - Transferência Manual:**
1. Copie o APK para o celular
2. Abra o arquivo no celular
3. Autorize instalação de fontes desconhecidas
4. Instale

## 🎯 Checklist Rápido

- [ ] Node.js instalado (v16+)
- [ ] JDK instalado (v17+)
- [ ] Android SDK configurado
- [ ] `npm install` executado
- [ ] `npx cap add android` executado
- [ ] Arquivos Android copiados
- [ ] Keystore criado
- [ ] Senhas configuradas no build.gradle
- [ ] `./gradlew assembleRelease` executado com sucesso
- [ ] APK gerado em outputs/apk/release/
- [ ] APK instalado no dispositivo

## ⚙️ Configuração do Android SDK (se necessário)

### Opção 1: Android Studio (mais fácil)

1. Baixe Android Studio: https://developer.android.com/studio
2. Instale e abra
3. SDK Manager → Install:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34
   - Android SDK Command-line Tools

### Opção 2: Command Line Tools (mais leve)

1. Baixe: https://developer.android.com/studio#command-tools
2. Extraia para: `~/Android/Sdk/cmdline-tools/latest/`
3. Configure variáveis:

```bash
# Linux/Mac - adicione ao ~/.bashrc ou ~/.zshrc
export ANDROID_SDK_ROOT=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools

# Windows - Variáveis de Ambiente do Sistema
ANDROID_SDK_ROOT=C:\Users\SEU_USUARIO\Android\Sdk
Path=%Path%;%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin
```

4. Instale pacotes:
```bash
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

## 🐛 Troubleshooting Rápido

### "JAVA_HOME not set"
```bash
# Linux/Mac
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
# ou
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# Windows
set JAVA_HOME=C:\Program Files\Java\jdk-17
```

### "SDK location not found"

Crie arquivo `android/local.properties`:
```properties
sdk.dir=/Users/SEU_USUARIO/Android/Sdk
# Windows: sdk.dir=C:\\Users\\SEU_USUARIO\\Android\\Sdk
```

### "Build failed: signing config not found"

Verifique:
1. Arquivo `credigestor-keystore.jks` está na pasta `android/`
2. Senhas estão corretas no `android/app/build.gradle`
3. Caminho do keystore está correto: `storeFile file('../credigestor-keystore.jks')`

### "Permission denied: gradlew"

```bash
chmod +x android/gradlew
```

## 🔄 Builds Subsequentes

Depois da primeira vez, é muito mais rápido:

```bash
# 1. Atualize os arquivos web (se necessário)
# 2. Sincronize
npx cap sync android

# 3. Build
cd android && ./gradlew assembleRelease

# 4. Instale
adb install app/build/outputs/apk/release/app-release.apk
```

## 📱 Distribuição do APK

### Para Outros Dispositivos

1. **Upload na Web**: Faça upload do APK em um serviço (Google Drive, Dropbox)
2. **Compartilhe o Link**: Envie para outros usuários
3. **Instruções ao Usuário**:
   - Baixar o APK
   - Permitir instalação de fontes desconhecidas
   - Instalar

### WhatsApp/Telegram

1. Renomeie para algo mais amigável: `CredGestor-v2026.10.25.apk`
2. Envie diretamente pelo app
3. Destinatário abre e instala

### Play Store (Opcional - Mais Avançado)

Para distribuição profissional:

1. Crie conta Google Play Developer ($25 única vez)
2. Gere AAB em vez de APK:
   ```bash
   ./gradlew bundleRelease
   ```
3. Upload na Play Console
4. Configurar listagem e publicar

## 💡 Dicas Importantes

### Versionamento

Sempre que fizer novo APK, atualize em `android/app/build.gradle`:

```gradle
versionCode 27      // Incrementar (era 26)
versionName "2026.10.26"  // Nova versão
```

### Tamanho do APK

APK típico: 5-15 MB

Se estiver muito grande:
- Habilite `minifyEnabled true` no build.gradle
- Use `./gradlew bundleRelease` (AAB) em vez de APK

### Testes Antes de Distribuir

```bash
# Instale em modo debug primeiro
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk

# Teste todas as funcionalidades
# Só depois gere o release
```

## 🎉 Pronto!

Agora você tem:
- ✅ APK instalável pronto
- ✅ Histórico de pagamentos funcionando
- ✅ Extrato exportável
- ✅ App funcionando offline

**Tempo total**: ~10-15 minutos (primeira vez)
**Builds futuros**: ~2-3 minutos

---

## 📞 Ajuda Adicional

Se encontrar problemas, verifique:
1. README.md completo
2. Logs do build: `android/app/build/outputs/logs/`
3. Console do Android Studio
4. Execute: `npx cap doctor` para diagnóstico

**Boa sorte! 🚀**
