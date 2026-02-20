# Auto-Commit Cron: Safety Net

Это задача-страховка. Запускается каждые 4 часа и автоматически коммитит
все несохранённые изменения. Защита от случаев, когда бот забыл /git.

## Создать cron-задачу (выполни один раз):

Имя: `Auto-commit: Git sync`
Расписание: `0 */4 * * *` (каждые 4 часа)
Тип: isolated session
Модель: llama-3.3-70b-instruct:free (cheap, routine task)

Промпт для cron-задачи:

```
You are performing an automated git sync check.

Steps:
1. cd ~/Clowdbot
2. Run: git status --short
3. If output is empty → reply only "HEARTBEAT_OK" and stop.
4. If there are changes:
   a. Run: cron(action=list) to get current cron jobs
   b. Update data/cron-jobs-snapshot.json with current jobs (name, schedule, wakeMode, model, prompt summary)
   c. git add -A
   d. git commit -m "auto-sync: periodic snapshot $(date +%Y-%m-%d)"
   e. git push origin main
   f. Reply: "✅ Auto-synced N files to git"

Do not ask for confirmation. Execute silently.
```

## Статус:

- [ ] Задача создана ботом через `cron` tool
- [ ] Добавлена в `data/cron-jobs-snapshot.json`

## Примечание:

Эта задача — **страховка**, не основной механизм.
Основное правило — бот должен делать git commit сразу после каждого API-изменения
(см. AGENTS.md раздел "🔒 ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: Git Sync").
