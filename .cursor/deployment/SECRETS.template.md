# 🔐 Секреты (ШАБЛОН)

> ⚠️ **ЭТОТ ФАЙЛ — ШАБЛОН!**  
> Скопируй его как `SECRETS.local.md` и заполни реальными значениями.
> Файл `SECRETS.local.md` добавлен в `.gitignore`.

## Токены и ключи

### Gateway Token
```
<сгенерируй: openssl rand -hex 32>
```

### Telegram Bot Token
```
<получи от @BotFather>
```

### Anthropic API Key
```
<получи на console.anthropic.com>
```

### Exec Approvals Token (Mac)
```
<автогенерируется при первом запуске node>
```

---

## Где хранятся секреты

| Секрет | Расположение |
|--------|--------------|
| Gateway Token | Сервер: `~/.openclaw/openclaw.json` → `gateway.auth.token` |
| Telegram Token | Сервер: `~/.openclaw/openclaw.json` → `channels.telegram.botToken` |
| Anthropic Key | Сервер: systemd env `ANTHROPIC_API_KEY` |
| Exec Token | Mac: `~/.openclaw/exec-approvals.json` → `socket.token` |

---

## Получение секретов с сервера

```bash
# Gateway token
ssh openclaw@100.73.176.127 "cat ~/.openclaw/openclaw.json | grep -A2 '\"auth\"'"

# Telegram token  
ssh openclaw@100.73.176.127 "cat ~/.openclaw/openclaw.json | grep botToken"

# Anthropic key (из systemd)
ssh openclaw@100.73.176.127 "systemctl --user show openclaw-gateway | grep ANTHROPIC"
```

---

## ID устройств

| Устройство | Device ID |
|------------|-----------|
| mac-files | `5da5ec985d8a963a04a6723fd325bf1dd5c563cde23f852f207df1fdc19cd723` |
| Local CLI | `8dcdc037aa7c54ab8d290916627dc8495b9a9cf7f4f2e20f8f91b5e506affd2c` |

## Telegram User ID

Approved: `685668909`
