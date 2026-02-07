# Конфигурация Mac Node

## Mac как Node для OpenClaw Gateway

Mac подключается к серверному Gateway через Tailscale как удалённый node,
предоставляя доступ к файловой системе и shell.

## OpenClaw конфиг

### Путь: `~/.openclaw/openclaw.json`

```json
{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "ws://100.73.176.127:18789",
      "token": "<GATEWAY_AUTH_TOKEN>"
    }
  }
}
```

## LaunchAgent

### Путь: `~/Library/LaunchAgents/ai.openclaw.node.plist`

- **Label:** `ai.openclaw.node`
- **RunAtLoad:** true
- **KeepAlive:** true
- **Display Name:** `mac-files`
- **Host:** `100.73.176.127`
- **Port:** `18789`
- **Logs:** `~/.openclaw/logs/node.log`, `~/.openclaw/logs/node.err.log`

### Управление

```bash
# Перезапуск
launchctl unload ~/Library/LaunchAgents/ai.openclaw.node.plist
launchctl load ~/Library/LaunchAgents/ai.openclaw.node.plist

# Через OpenClaw CLI
openclaw node restart
```

## Exec-Approvals

### Путь: `~/.openclaw/exec-approvals.json`

Актуальный файл: `mac-exec-approvals.json` в этой директории.

### Разрешённые команды:

| Паттерн | Описание |
|---------|----------|
| `~/.openclaw/cleanup-scripts/*` | Скрипты очистки |
| `/bin/ls` | Просмотр файлов |
| `/bin/rm` | Удаление (с подтверждением) |
| `/bin/mv` | Перемещение файлов |
| `/bin/cp` | Копирование файлов |
| `/bin/mkdir` | Создание папок |
| `/bin/cat` | Чтение файлов |
| `/usr/bin/du` | Размер файлов |
| `/usr/bin/find` | Поиск файлов |
| `/usr/bin/file` | Тип файла |
| `/usr/bin/head` | Начало файла |
| `/usr/bin/tail` | Конец файла |
| `/usr/bin/wc` | Подсчёт строк |
| `/usr/bin/grep` | Поиск в файлах |
| `/usr/bin/sort` | Сортировка |
| `/usr/bin/open` | Открытие файлов |

## Скрипты очистки

### Путь: `~/.openclaw/cleanup-scripts/`

Актуальные скрипты: `mac-cleanup-scripts/` в этой директории.

| Скрипт | Описание |
|--------|----------|
| `start-cleanup.sh` | Создать бэкап перед очисткой |
| `confirm-cleanup.sh` | Удалить бэкап после успешной очистки |
| `rollback-cleanup.sh` | Откатить изменения из бэкапа |
| `cleanup-status.sh` | Проверить статус текущей сессии |
| `auto-cleanup-old-backups.sh` | Автоудаление бэкапов старше 24ч |

### Директории для бэкапов:
- `~/Downloads`
- `~/Desktop`
- `~/Documents`
- `~/Pictures`

## Git Sync Workflow

Mac работает с репозиторием Clowdbot локально, синхронизируясь через GitHub:

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  Сервер         │────▶│   GitHub    │◀────│    Mac      │
│  ~/Clowdbot     │     │  (облако)   │     │  ~/Clowdbot │
│  Telegram /git  │     │             │     │  Cursor     │
└─────────────────┘     └─────────────┘     └─────────────┘
```

### Workflow разработки:

| Действие | Где | Команда |
|----------|-----|---------|
| Изменить код | Telegram | "Измени функцию X..." |
| Закоммитить | Telegram | `/git` |
| Получить изменения | Mac | `git pull` |
| Изменить код | Cursor | редактирование |
| Закоммитить | Cursor/Terminal | `git commit && git push` |
| Получить изменения | Telegram | `/git` (делает pull первым) |

### Локальные skills на Mac:

| Skill | Путь | Статус |
|-------|------|--------|
| git-sync | `~/.openclaw/skills/git-sync/SKILL.md` | Не используется (Mac = node, не gateway) |

> **Примечание:** Skills на Mac не используются, так как Mac подключён как node к серверному gateway. Все skills выполняются на сервере.

---

*Последнее обновление: 2026-02-07*
