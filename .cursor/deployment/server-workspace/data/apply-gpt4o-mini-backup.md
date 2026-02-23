# Задача: переключить BACKUP jobs на openai/gpt-4o-mini

Все BACKUP isolated jobs сейчас используют `google/gemini-3-flash-preview` — это не настоящий бэкап,
так как при падении Google оба упадут. Нужно переключить бэкапы на `openai/gpt-4o-mini`.

## Команды для выполнения

```bash
# BACKUP: Git sync
openclaw cron edit b0c35166-4062-479c-a777-652657b2fa71 --model openai/gpt-4o-mini

# BACKUP: Утренний брифинг
openclaw cron edit 829eee9e-de87-4c35-82ed-a469ac67afc2 --model openai/gpt-4o-mini

# BACKUP: Утренний дайджест
openclaw cron edit c1c58593-accd-4cf7-a175-3603514b0275 --model openai/gpt-4o-mini

# BACKUP: Утренние мнения
openclaw cron edit 10e6c5ea-652e-4776-b097-f72dbf6ef050 --model openai/gpt-4o-mini

# BACKUP: Дневной дайджест
openclaw cron edit 62c89740-52fa-4364-b1ae-7c81110ef368 --model openai/gpt-4o-mini

# BACKUP: Дневные мнения
openclaw cron edit d81fedff-8d6f-4e32-a105-a56f8833feb7 --model openai/gpt-4o-mini

# BACKUP: Вечерний дайджест
openclaw cron edit e758d243-54e7-4d3b-b684-8115561831e6 --model openai/gpt-4o-mini

# BACKUP: Вечерние мнения
openclaw cron edit 8783bc2f-de99-4742-9229-09921260d546 --model openai/gpt-4o-mini
```

## После выполнения

```bash
openclaw cron list
# → обнови data/cron-jobs-snapshot.json
git add -A && git commit -m "ops: backup jobs переключены на openai/gpt-4o-mini" && git push
```

## Что НЕ меняем (cron edit)

- `76f581a1` BACKUP Рефлексия — sessionTarget: main, systemEvent (нет модели)
- `28b9d12a` BACKUP Chat Cleanup — sessionTarget: main, systemEvent (нет модели)

---

## Часть 2: Создать новые BACKUP jobs (cron add)

Три задачи пока без бэкапа — нужно создать.

```bash
# BACKUP: Экономист (сбор) — основной в 17:30
openclaw cron add \
  --name "🚨 BACKUP: Экономист (сбор)" \
  --cron "45 17 * * *" \
  --tz "Asia/Almaty" \
  --session isolated \
  --model "openai/gpt-4o-mini" \
  --thinking low \
  --wake now \
  --message "Бэкап 17:45: если economist daily-collect не запускался в 17:30 — выполнить: обновить economist-log.jsonl и cost-summary.json; молчать если нет аномалий; иначе HEARTBEAT_OK."

# BACKUP: Саммари от Айганым — основной в 19:30
openclaw cron add \
  --name "🚨 BACKUP: Саммари от Айганым" \
  --cron "45 19 * * *" \
  --tz "Asia/Almaty" \
  --session isolated \
  --model "openai/gpt-4o-mini" \
  --thinking low \
  --wake now \
  --message "Бэкап 19:45: если вечерний саммари от Айганым (509646214) не отправлялся сегодня — собрать и отправить Маргулану; иначе HEARTBEAT_OK."

# BACKUP: Экономист (отчёт) — основной в Вс 03:00
openclaw cron add \
  --name "🚨 BACKUP: Экономист (отчёт)" \
  --cron "20 3 * * 0" \
  --tz "Asia/Almaty" \
  --session isolated \
  --model "openai/gpt-4o-mini" \
  --thinking low \
  --wake now \
  --message "Бэкап Вс 03:20: если economist weekly-report не запускался этой ночью — выполнить недельный отчёт с рекомендациями → Маргулану."
```

## После выполнения всех команд

```bash
openclaw cron list
# → обнови data/cron-jobs-snapshot.json
git add -A && git commit -m "ops: добавлены BACKUP jobs для экономиста и саммари Айганым" && git push
```

_Обновлён: 2026-02-23_
