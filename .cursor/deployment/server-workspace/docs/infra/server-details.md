# Техническая инфраструктура

## Сервер (Hetzner)
- **IP:** 46.224.221.0
- **Tailscale:** `openclaw-server` (100.73.176.127)
- **Gateway Port:** 18789
- **Service:** `openclaw-gateway.service`

## Mac Node
- **Tailscale:** `margulansmacbookpro` (100.88.178.82)
- **Папки:** `~/Downloads`, `~/Desktop`, `~/Documents`, `~/Pictures`
- **LaunchAgent:** `ai.openclaw.node.plist`

## Скрипты на Mac
- `~/.openclaw/cleanup-scripts/start-cleanup.sh`
- `~/.openclaw/cleanup-scripts/confirm-cleanup.sh`
- `~/.openclaw/cleanup-scripts/rollback-cleanup.sh`
- `~/.openclaw/cleanup-scripts/cleanup-status.sh`
