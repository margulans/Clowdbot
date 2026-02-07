#!/bin/bash
# Скрипт начала сессии очистки — создаёт транзакционный бэкап
# Использование: ./start-cleanup.sh [downloads|desktop|all]

set -e

BACKUP_DIR="$HOME/.openclaw/cleanup-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_DIR="$BACKUP_DIR/session_$TIMESTAMP"
SESSION_FILE="$BACKUP_DIR/.current_session"

# Проверка: нет ли активной сессии
if [ -f "$SESSION_FILE" ]; then
    CURRENT=$(cat "$SESSION_FILE")
    echo "⚠️  Уже есть активная сессия: $CURRENT"
    echo "Сначала заверши её: confirm-cleanup.sh или rollback-cleanup.sh"
    exit 1
fi

TARGET="${1:-all}"

mkdir -p "$SESSION_DIR"

echo "🔄 Создаю бэкап перед очисткой..."

case "$TARGET" in
    downloads)
        echo "📁 Бэкап ~/Downloads..."
        tar -czf "$SESSION_DIR/downloads.tar.gz" -C "$HOME" Downloads 2>/dev/null || true
        echo "downloads" > "$SESSION_DIR/.target"
        ;;
    desktop)
        echo "🖥️  Бэкап ~/Desktop..."
        tar -czf "$SESSION_DIR/desktop.tar.gz" -C "$HOME" Desktop 2>/dev/null || true
        echo "desktop" > "$SESSION_DIR/.target"
        ;;
    all)
        echo "📁 Бэкап ~/Downloads..."
        tar -czf "$SESSION_DIR/downloads.tar.gz" -C "$HOME" Downloads 2>/dev/null || true
        echo "🖥️  Бэкап ~/Desktop..."
        tar -czf "$SESSION_DIR/desktop.tar.gz" -C "$HOME" Desktop 2>/dev/null || true
        echo "all" > "$SESSION_DIR/.target"
        ;;
    *)
        echo "❌ Неизвестная цель: $TARGET"
        echo "Используй: downloads, desktop, all"
        rm -rf "$SESSION_DIR"
        exit 1
        ;;
esac

# Сохраняем путь к текущей сессии
echo "$SESSION_DIR" > "$SESSION_FILE"

# Размер бэкапа
SIZE=$(du -sh "$SESSION_DIR" | cut -f1)

echo ""
echo "✅ Сессия очистки начата!"
echo "📦 Бэкап: $SESSION_DIR ($SIZE)"
echo ""
echo "После завершения очистки:"
echo "  • Всё ОК → confirm-cleanup.sh (удалит бэкап)"
echo "  • Откатить → rollback-cleanup.sh (восстановит файлы)"
echo ""
echo "⏰ Автоудаление бэкапа через 24 часа"
