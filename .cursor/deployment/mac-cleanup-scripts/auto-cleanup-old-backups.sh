#!/bin/bash
# Автоматическое удаление бэкапов старше 24 часов
# Запускается по cron каждый час

BACKUP_DIR="$HOME/.openclaw/cleanup-backups"
MAX_AGE_HOURS=24

# Текущее время в секундах
NOW=$(date +%s)

for dir in "$BACKUP_DIR"/session_*; do
    if [ -d "$dir" ]; then
        # Время создания папки
        CREATED=$(stat -f "%m" "$dir" 2>/dev/null || stat -c "%Y" "$dir" 2>/dev/null)
        AGE_HOURS=$(( (NOW - CREATED) / 3600 ))
        
        if [ $AGE_HOURS -ge $MAX_AGE_HOURS ]; then
            echo "🗑️  Удаляю старый бэкап ($AGE_HOURS ч.): $(basename "$dir")"
            rm -rf "$dir"
        fi
    fi
done

# Очистка .current_session если сессия протухла
SESSION_FILE="$BACKUP_DIR/.current_session"
if [ -f "$SESSION_FILE" ]; then
    SESSION_DIR=$(cat "$SESSION_FILE")
    if [ ! -d "$SESSION_DIR" ]; then
        rm -f "$SESSION_FILE"
    fi
fi
