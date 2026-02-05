# 💻 Конфигурация Mac Node

## Параметры

| Параметр | Значение |
|----------|----------|
| Hostname | `nano-m4-macbook-pro` |
| Tailscale IP | `100.91.12.108` |
| Node Name | `mac-files` |
| Node ID | `5da5ec985d8a963a04a6723fd325bf1dd5c563cde23f852f207df1fdc19cd723` |
| Capabilities | `browser`, `system` |

## OpenClaw конфигурация

### Путь: `~/.openclaw/openclaw.json`

```json
{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "ws://100.73.176.127:18789",
      "token": "<GATEWAY_TOKEN>"
    }
  }
}
```

## Node Service (LaunchAgent)

### Путь: `~/Library/LaunchAgents/ai.openclaw.node.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.node</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/opt/homebrew/lib/node_modules/openclaw/dist/index.js</string>
        <string>node</string>
        <string>run</string>
        <string>--host</string>
        <string>100.73.176.127</string>
        <string>--port</string>
        <string>18789</string>
        <string>--display-name</string>
        <string>mac-files</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

### Управление

```bash
# Статус
openclaw node status

# Перезапуск
openclaw node restart

# Остановка
openclaw node stop

# Удаление
openclaw node uninstall

# Установка
openclaw node install --host 100.73.176.127 --port 18789 --display-name "mac-files"
```

## Exec Approvals (разрешённые команды)

### Путь: `~/.openclaw/exec-approvals.json`

```json
{
  "version": 1,
  "socket": {
    "path": "/Users/margulanseissembayev/.openclaw/exec-approvals.sock",
    "token": "<EXEC_APPROVALS_TOKEN>"
  },
  "defaults": {},
  "agents": {
    "*": {
      "allowlist": [
        {"pattern": "/Users/margulanseissembayev/.openclaw/cleanup-scripts/start-cleanup.sh"},
        {"pattern": "/Users/margulanseissembayev/.openclaw/cleanup-scripts/confirm-cleanup.sh"},
        {"pattern": "/Users/margulanseissembayev/.openclaw/cleanup-scripts/rollback-cleanup.sh"},
        {"pattern": "/Users/margulanseissembayev/.openclaw/cleanup-scripts/cleanup-status.sh"},
        {"pattern": "/bin/ls"},
        {"pattern": "/bin/rm"},
        {"pattern": "/usr/bin/du"},
        {"pattern": "/usr/bin/find"},
        {"pattern": "/bin/cat"},
        {"pattern": "/usr/bin/file"}
      ]
    }
  }
}
```

## Скрипты очистки

### Путь: `~/.openclaw/cleanup-scripts/`

| Скрипт | Назначение |
|--------|------------|
| `start-cleanup.sh` | Начать сессию (создать бэкап) |
| `confirm-cleanup.sh` | Завершить сессию (удалить бэкап) |
| `rollback-cleanup.sh` | Откатить изменения |
| `cleanup-status.sh` | Проверить статус сессии |
| `auto-cleanup-old-backups.sh` | Автоудаление старых бэкапов (cron) |

### Бэкапы: `~/.openclaw/cleanup-backups/`

## Cron задачи

```bash
# Автоочистка бэкапов старше 24 часов (каждый час)
0 * * * * /Users/margulanseissembayev/.openclaw/cleanup-scripts/auto-cleanup-old-backups.sh
```

Проверить crontab:
```bash
crontab -l
```

## SSH ключ для сервера

### Путь: `~/.ssh/id_ed25519`

Публичный ключ добавлен на сервер в `~/.ssh/authorized_keys` пользователя `openclaw`.

## Логи

```bash
# Логи node
tail -f ~/.openclaw/logs/node.log

# Или через launchd
log show --predicate 'subsystem == "ai.openclaw.node"' --last 1h
```

---

*Последнее обновление: 2026-02-05*
