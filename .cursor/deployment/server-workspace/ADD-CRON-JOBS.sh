#!/bin/bash
# Скрипт для добавления cron задач в OpenClaw

echo "📅 Добавляю автоматические задачи в OpenClaw..."

# Утренний дайджест (08:30 Dubai time)
echo "🌅 Добавляю утренний дайджест..."
openclaw cron add --job '{
  "name": "Утренний умный дайджест",
  "schedule": { "kind": "cron", "expr": "30 8 * * *", "tz": "Asia/Dubai" },
  "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest(\"morning\")" },
  "sessionTarget": "main",
  "enabled": true
}'

# Дневной дайджест (13:00 Dubai time)  
echo "☀️ Добавляю дневной дайджест..."
openclaw cron add --job '{
  "name": "Дневной умный дайджест", 
  "schedule": { "kind": "cron", "expr": "0 13 * * *", "tz": "Asia/Dubai" },
  "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest(\"afternoon\")" },
  "sessionTarget": "main",
  "enabled": true
}'

# Вечерний дайджест (18:00 Dubai time)
echo "🌆 Добавляю вечерний дайджест..."
openclaw cron add --job '{
  "name": "Вечерний умный дайджест",
  "schedule": { "kind": "cron", "expr": "0 18 * * *", "tz": "Asia/Dubai" },  
  "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest(\"evening\")" },
  "sessionTarget": "main",
  "enabled": true
}'

# Утренний брифинг (06:00 Dubai time)
echo "🌅 Добавляю утренний брифинг..."
openclaw cron add --job '{
  "name": "Утренний брифинг",
  "schedule": { "kind": "cron", "expr": "0 6 * * *", "tz": "Asia/Dubai" },
  "payload": { "kind": "systemEvent", "text": "morning_action_plan()" },
  "sessionTarget": "main", 
  "enabled": true
}'

# Ежедневная рефлексия (20:30 Dubai time)
echo "🧠 Добавляю ежедневную рефлексию..."
openclaw cron add --job '{
  "name": "Ежедневная рефлексия",
  "schedule": { "kind": "cron", "expr": "30 20 * * *", "tz": "Asia/Dubai" },
  "payload": { "kind": "systemEvent", "text": "daily_reflection()" },
  "sessionTarget": "main",
  "enabled": true  
}'

# Еженедельная аналитика (воскресенье 20:30 Dubai time)
echo "📊 Добавляю еженедельную аналитику..."
openclaw cron add --job '{
  "name": "Еженедельная аналитика рефлексий",
  "schedule": { "kind": "cron", "expr": "30 20 * * 0", "tz": "Asia/Dubai" },
  "payload": { "kind": "systemEvent", "text": "weekly_reflection_analytics()" },
  "sessionTarget": "main",
  "enabled": true
}'

echo "✅ Все автоматические задачи добавлены!"
echo "📊 Проверить: openclaw cron list"