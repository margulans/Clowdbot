#!/bin/bash
# Откат сессии — восстанавливает файлы из бэкапа
# Использование: ./rollback-cleanup.sh

set -e

BACKUP_DIR="$HOME/.openclaw/cleanup-backups"
SESSION_FILE="$BACKUP_DIR/.current_session"

if [ ! -f "$SESSION_FILE" ]; then
    echo "❌ Нет активной сессии очистки для отката"
    exit 1
fi

SESSION_DIR=$(cat "$SESSION_FILE")

if [ ! -d "$SESSION_DIR" ]; then
    echo "❌ Папка сессии не найдена: $SESSION_DIR"
    rm -f "$SESSION_FILE"
    exit 1
fi

TARGET=$(cat "$SESSION_DIR/.target" 2>/dev/null || echo "all")

echo "🔄 Восстанавливаю файлы из бэкапа..."

case "$TARGET" in
    downloads)
        if [ -f "$SESSION_DIR/downloads.tar.gz" ]; then
            echo "📁 Восстанавливаю ~/Downloads..."
            rm -rf "$HOME/Downloads"
            tar -xzf "$SESSION_DIR/downloads.tar.gz" -C "$HOME"
        fi
        ;;
    desktop)
        if [ -f "$SESSION_DIR/desktop.tar.gz" ]; then
            echo "🖥️  Восстанавливаю ~/Desktop..."
            rm -rf "$HOME/Desktop"
            tar -xzf "$SESSION_DIR/desktop.tar.gz" -C "$HOME"
        fi
        ;;
    all)
        if [ -f "$SESSION_DIR/downloads.tar.gz" ]; then
            echo "📁 Восстанавливаю ~/Downloads..."
            rm -rf "$HOME/Downloads"
            tar -xzf "$SESSION_DIR/downloads.tar.gz" -C "$HOME"
        fi
        if [ -f "$SESSION_DIR/desktop.tar.gz" ]; then
            echo "🖥️  Восстанавливаю ~/Desktop..."
            rm -rf "$HOME/Desktop"
            tar -xzf "$SESSION_DIR/desktop.tar.gz" -C "$HOME"
        fi
        ;;
esac

SIZE=$(du -sh "$SESSION_DIR" | cut -f1)
echo ""
echo "✅ Файлы восстановлены!"
echo "📦 Бэкап сохранён: $SESSION_DIR ($SIZE)"
echo ""
echo "Чтобы удалить бэкап: confirm-cleanup.sh"
