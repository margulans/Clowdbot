#!/bin/bash
# Статус текущей сессии очистки
# Использование: ./cleanup-status.sh

BACKUP_DIR="$HOME/.openclaw/cleanup-backups"
SESSION_FILE="$BACKUP_DIR/.current_session"

echo "📊 Статус системы очистки"
echo "========================="
echo ""

if [ -f "$SESSION_FILE" ]; then
    SESSION_DIR=$(cat "$SESSION_FILE")
    if [ -d "$SESSION_DIR" ]; then
        TARGET=$(cat "$SESSION_DIR/.target" 2>/dev/null || echo "unknown")
        SIZE=$(du -sh "$SESSION_DIR" | cut -f1)
        CREATED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$SESSION_DIR" 2>/dev/null || stat -c "%y" "$SESSION_DIR" 2>/dev/null | cut -d' ' -f1,2)
        
        echo "🔴 АКТИВНАЯ СЕССИЯ"
        echo "  Цель: $TARGET"
        echo "  Размер бэкапа: $SIZE"
        echo "  Создана: $CREATED"
        echo "  Путь: $SESSION_DIR"
        echo ""
        echo "Команды:"
        echo "  confirm-cleanup.sh  — завершить (удалить бэкап)"
        echo "  rollback-cleanup.sh — откатить изменения"
    else
        echo "⚠️  Сессия повреждена (папка не найдена)"
        rm -f "$SESSION_FILE"
    fi
else
    echo "🟢 Нет активной сессии"
    echo ""
    echo "Для начала очистки:"
    echo "  start-cleanup.sh downloads  — только загрузки"
    echo "  start-cleanup.sh desktop    — только рабочий стол"  
    echo "  start-cleanup.sh all        — всё"
fi

echo ""
echo "📁 Старые бэкапы:"
TOTAL=0
for dir in "$BACKUP_DIR"/session_*; do
    if [ -d "$dir" ]; then
        SIZE=$(du -sh "$dir" | cut -f1)
        NAME=$(basename "$dir")
        echo "  $NAME ($SIZE)"
        TOTAL=$((TOTAL + 1))
    fi
done

if [ $TOTAL -eq 0 ]; then
    echo "  (нет)"
fi
