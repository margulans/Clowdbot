# apply-level4-crons.md — Уровень 4: новые cron jobs

> Отправить Нейрону через Telegram. Выполнять последовательно.

---

## Что добавляем

| Скилл          | Режим           | Расписание      | Описание                                   |
| -------------- | --------------- | --------------- | ------------------------------------------ |
| `analytics`    | weekly          | Вс 21:00 Алматы | Еженедельная аналитика паттернов рефлексий |
| `analytics`    | weekly (backup) | Вс 21:20 Алматы | Backup если основной пропустил             |
| `life-advisor` | weekly-insight  | Пт 18:00 Алматы | Пятничный инсайт из паттернов              |
| `life-advisor` | goal-check      | Вс 10:00 Алматы | Воскресная сверка целей                    |

---

## Команды для выполнения

### 1. Аналитик — основной (воскресенье 21:00 Алматы = 15:00 UTC)

```
cron(action=create, job={
  "name": "Аналитик — еженедельный отчёт",
  "schedule": { "kind": "cron", "expr": "0 15 * * 0", "tz": "UTC" },
  "payload": { "kind": "systemEvent", "text": "weekly_reflection_analytics()" },
  "model": "openai/gpt-5.2",
  "thinking": "low"
})
```

### 2. Аналитик — backup (воскресенье 21:20 Алматы = 15:20 UTC)

```
cron(action=create, job={
  "name": "BACKUP Аналитик — еженедельный отчёт",
  "schedule": { "kind": "cron", "expr": "20 15 * * 0", "tz": "UTC" },
  "payload": { "kind": "systemEvent", "text": "BACKUP: weekly_reflection_analytics()" },
  "model": "openai/gpt-4o-mini",
  "thinking": "low",
  "isolated": true
})
```

### 3. Венди — пятничный инсайт (пятница 18:00 Алматы = 12:00 UTC)

```
cron(action=create, job={
  "name": "Венди — пятничный инсайт",
  "schedule": { "kind": "cron", "expr": "0 12 * * 5", "tz": "UTC" },
  "payload": { "kind": "systemEvent", "text": "life_advisor(mode=weekly-insight)" },
  "model": "openai/gpt-5.2",
  "thinking": "low"
})
```

### 4. Венди — goal-check (воскресенье 10:00 Алматы = 04:00 UTC)

```
cron(action=create, job={
  "name": "Венди — goal-check",
  "schedule": { "kind": "cron", "expr": "0 4 * * 0", "tz": "UTC" },
  "payload": { "kind": "systemEvent", "text": "life_advisor(mode=goal-check)" },
  "model": "openai/gpt-5.2",
  "thinking": "low"
})
```

---

## После добавления

1. `cron(action=list)` → убедиться, что все 4 job появились
2. Обновить `data/cron-jobs-snapshot.json` (сохранить список)
3. `/git` — синхронизировать workspace

---

## ⚠️ Важно: наполнить USER.md перед запуском

Скиллы `analytics` и `life-advisor` читают `## Текущие цели` и `## Активные проекты` из `USER.md`.
Без реальных данных советы будут пустыми.

Отправь Нейрону:

> «Заполни USER.md — обнови раздел "Текущие цели" и "Активные проекты" по моим словам: [твои цели]»

---

## Расписание всех Level 4 событий (итог)

| Время (Алматы) | Событие                                            |
| -------------- | -------------------------------------------------- |
| Пн–Вс 06:00    | Утренний брифинг (цели + намерение из вчера)       |
| Пт 18:00       | Венди — пятничный инсайт                           |
| Вс 10:00       | Венди — goal-check                                 |
| Вс 20:30       | Вечерняя рефлексия (с метриками energy/mood/focus) |
| Вс 21:00       | Аналитик — еженедельный отчёт                      |
