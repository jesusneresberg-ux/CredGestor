# Automação de Builds — CrediGestor

A partir de agora, todas as atualizações do CrediGestor podem ser compiladas automaticamente, tanto localmente quanto via CI/CD no GitHub.

---

## Fluxo automatizado

### 1. Local (script único)

O script `scripts/build-and-release.sh` executa todo o pipeline em um comando:

```bash
# Com patch específico
./scripts/build-and-release.sh credigestor-vencimentos.patch

# Sem patch (apenas recompila o código atual)
./scripts/build-and-release.sh
```

Ele aplica o patch (se fornecido), instala dependências, sincroniza o Capacitor, compila o APK debug e salva o resultado em `releases/CrediGestor-YYYYMMDD-HHMMSS.apk`.

### 2. CI/CD (GitHub Actions)

O workflow `.github/workflows/build-apk.yml` dispara automaticamente em três situações:

- **Push** nas branches `main` ou `master` → compila e disponibiliza o APK como artifact
- **Pull Request** para essas branches → valida que o build passa
- **Manual** (`workflow_dispatch`) → permite disparar sob demanda pela aba Actions do GitHub

Quando uma tag `v*` é criada (ex: `v27.1`), o workflow também publica uma Release automática com o APK anexado.

### 3. Como usar no dia a dia

| Cenário | Comando / Ação |
|---|---|
| Atualização rápida local | `./scripts/build-and-release.sh` |
| Nova feature com patch | `./scripts/build-and-release.sh meu-patch.patch` |
| Build remoto após push | Automático pelo GitHub Actions |
| Release oficial | Criar tag `git tag v27.1 && git push --tags` |
| Instalar no dispositivo | `adb install releases/CrediGestor-*.apk` |

---

## Estrutura dos arquivos de automação

```
CredGestor/
├── .github/workflows/build-apk.yml   ← CI/CD pipeline
├── scripts/build-and-release.sh      ← Script local de build
├── releases/                         ← APKs gerados (gitignored)
└── AUTOMACAO.md                      ← Este documento
```

## Pré-requisitos locais

- Node.js 18+
- Java 17 (Zulu ou OpenJDK)
- Android SDK (via Android Studio ou cmdline-tools)
- Capacitor CLI (`npm install -g @capacitor/cli`)

No GitHub Actions, tudo isso é provisionado automaticamente pelos runners Ubuntu.