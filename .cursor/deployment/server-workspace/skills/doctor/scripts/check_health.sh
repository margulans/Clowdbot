#!/bin/bash
# Базовая проверка здоровья зависимостей Нейрона

echo "--- 🛠 СИСТЕМНЫЕ ЗАВИСИМОСТИ ---"
for cmd in git python3 summarize yt-dlp pandoc ffmpeg jq; do
  if command -v $cmd &> /dev/null; then
    ver=$($cmd --version 2>&1 | head -n 1)
    echo "✅ $cmd: $ver"
  else
    echo "❌ $cmd: НЕ НАЙДЕН"
  fi
done

echo ""
echo "--- 🦞 OPENCLAW STATUS ---"
openclaw gateway status 2>&1 | grep -E "Active|since" || echo "❌ Gateway не активен"

echo ""
echo "--- 📦 GIT STATUS ---"
git status --short || echo "❌ Git error"
