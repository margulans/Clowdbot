#!/bin/bash
# Подтверждение успешной сессии — удаляет бэкап
# Использование: ./confirm-cleanup.sh

set -e

BACKUP_DIR="$HOME/.openclaw/cleanup-backups"
SESSION_FILE="$BACKUP_DIR/.current_session"

if [ ! -f "$SESSION_FILE" ]; then
    echo "❌ Нет активной сессии очистки"
    exit 1
fi

SESSION_DIR=$(cat "$SESSION_FILE")

if [ ! -d "$SESSION_DIR" ]; then
    echo "❌ Папка сессии не найдена: $SESSION_DIR"
    rm -f "$SESSION_FILE"
    exit 1
fi

SIZE=$(du -sh "$SESSION_DIR" | cut -f1)

echo "🗑️  Удаляю бэкап: $SESSION_DIR ($SIZE)"
rm -rf "$SESSION_DIR"
rm -f "$SESSION_FILE"

echo "✅ Сессия очистки завершена успешно!"
echo "🧹 Бэкап удалён — изменения закреплены"
