# 🖥️ Конфигурация сервера Hetzner

## Параметры VPS

| Параметр | Значение |
|----------|----------|
| Провайдер | Hetzner Cloud |
| План | CPX22 |
| vCPU | 4 |
| RAM | 8 GB |
| Диск | 160 GB NVMe |
| Цена | ~€5/мес |
| IP | `46.224.221.0` |
| Tailscale IP | `100.73.176.127` |
| Hostname | `openclaw-server` |
| OS | Ubuntu 24.04 LTS |

## Пользователи

| User | Права | Назначение |
|------|-------|------------|
| `root` | disabled SSH | Начальная настройка |
| `openclaw` | sudo, SSH key | Основной пользователь |

## Сетевая конфигурация

### UFW Firewall
```
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
18789 on tailscale0        ALLOW       Anywhere (Tailscale only)
```

### Tailscale
- **Hostname:** `openclaw-server`
- **IP:** `100.73.176.127`
- **SSH:** enabled (`--ssh`)

## OpenClaw конфигурация

### Путь: `~/.openclaw/openclaw.json`

```json
{
  "meta": {
    "lastTouchedVersion": "2026.2.2-3"
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-20250514"
      },
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "botToken": "<TELEGRAM_BOT_TOKEN>",
      "groupPolicy": "allowlist",
      "streamMode": "partial"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "<GATEWAY_TOKEN>"
    }
  }
}
```

## Systemd сервис

### Путь: `~/.config/systemd/user/openclaw-gateway.service`

```ini
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/home/openclaw/.npm-global/bin/openclaw gateway --port 18789 --bind lan
Restart=always
RestartSec=5s
Environment=ANTHROPIC_API_KEY=<ANTHROPIC_API_KEY>
WorkingDirectory=/home/openclaw/.openclaw
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

### Управление

```bash
# Статус
systemctl --user status openclaw-gateway

# Логи
journalctl --user -u openclaw-gateway -f

# Перезапуск
systemctl --user restart openclaw-gateway

# Остановка
systemctl --user stop openclaw-gateway

# Запуск
systemctl --user start openclaw-gateway
```

## Paired Devices

### Путь: `~/.openclaw/devices/paired.json`

```json
{
  "5da5ec985d8a963a04a6723fd325bf1dd5c563cde23f852f207df1fdc19cd723": {
    "deviceId": "5da5ec985d8a963a04a6723fd325bf1dd5c563cde23f852f207df1fdc19cd723",
    "publicKey": "JvuluI10CpNgTI7eQDhQqz0XBDmJiokMyzIgdA3dRAk",
    "displayName": "mac-files",
    "platform": "darwin",
    "role": "node",
    "roles": ["node"]
  },
  "8dcdc037aa7c54ab8d290916627dc8495b9a9cf7f4f2e20f8f91b5e506affd2c": {
    "deviceId": "8dcdc037aa7c54ab8d290916627dc8495b9a9cf7f4f2e20f8f91b5e506affd2c",
    "publicKey": "lds9z18rQoviOtT3GgYBfzZNdfU4ZDFASWcLdsSyIFA",
    "displayName": "Local CLI",
    "platform": "linux",
    "role": "operator",
    "roles": ["operator"],
    "scopes": ["operator.admin", "operator.approvals", "operator.pairing"]
  }
}
```

## Telegram Pairing

### Путь: `~/.openclaw/credentials/telegram-allowFrom.json`

Approved Telegram User ID: `685668909`

## Полезные команды

```bash
# Проверить статус всего
openclaw status

# Проверить каналы
openclaw channels status

# Проверить nodes
openclaw nodes status

# Проверить devices
openclaw devices list

# Логи в реальном времени
openclaw logs --follow
```

---

*Последнее обновление: 2026-02-05*
