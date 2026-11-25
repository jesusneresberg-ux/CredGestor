#!/usr/bin/env bash
# CrediGestor — Script de automação de build e release
# Uso: ./scripts/build-and-release.sh [patch-file]
# Se nenhum patch for informado, usa credigestor-vencimentos.patch na raiz do projeto.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_FILE="${1:-$ROOT_DIR/credigestor-vencimentos.patch}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BRANCH="auto-build/$TIMESTAMP"

echo "=== CrediGestor Build Automation ==="
echo "Diretório do projeto: $ROOT_DIR"
echo "Patch: $PATCH_FILE"
echo ""

# 1. Aplicar patch (se existir e não estiver vazio)
if [[ -f "$PATCH_FILE" && -s "$PATCH_FILE" ]]; then
  echo "[1/5] Aplicando patch..."
  cd "$ROOT_DIR"
  if git apply --check "$PATCH_FILE" 2>/dev/null; then
    git apply "$PATCH_FILE"
    echo "      Patch aplicado com sucesso."
  else
    echo "      ⚠ Patch já foi aplicado ou tem conflitos. Continuando sem aplicar."
  fi
else
  echo "[1/5] Nenhum patch informado ou arquivo vazio. Pulando."
fi

# 2. Instalar dependências
echo "[2/5] Instalando dependências..."
cd "$ROOT_DIR"
npm ci --silent 2>/dev/null || npm install --silent

# 3. Sincronizar Capacitor
echo "[3/5] Sincronizando Capacitor..."
npx cap sync android

# 4. Build do APK
echo "[4/5] Compilando APK debug..."
cd "$ROOT_DIR/android"
chmod +x gradlew
./gradlew assembleDebug --quiet

APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "✗ Falha: APK não encontrado em $APK_PATH"
  exit 1
fi

# 5. Copiar APK para pasta de saída com timestamp
OUTPUT_DIR="$ROOT_DIR/releases"
mkdir -p "$OUTPUT_DIR"
RELEASE_APK="$OUTPUT_DIR/CrediGestor-$TIMESTAMP.apk"
cp "$APK_PATH" "$RELEASE_APK"

echo "[5/5] APK gerado com sucesso!"
echo ""
echo "📦 APK: $RELEASE_APK"
echo "📏 Tamanho: $(du -h "$RELEASE_APK" | cut -f1)"
echo ""
echo "Para instalar no dispositivo:"
echo "  adb install \"$RELEASE_APK\""
echo ""
echo "Para commitar e disparar o workflow CI:"
echo "  cd \"$ROOT_DIR\""
echo "  git add -A && git commit -m 'chore: atualização automática de vencimentos'"
echo "  git push origin main"