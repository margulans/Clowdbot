# 🔄 Инструкции по восстановлению

## Быстрая диагностика

```bash
# 1. Проверить Tailscale
/Applications/Tailscale.app/Contents/MacOS/Tailscale status

# 2. Проверить Gateway на сервере
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw status"

# 3. Проверить Mac Node
openclaw node status
```

---

## Сценарии восстановления

### 🟡 Telegram недоступен — переключиться на WhatsApp (2 мин)

```bash
# 1. SSH на сервер
ssh openclaw@100.73.176.127

# 2. Подключить WhatsApp (нужен телефон рядом)
export PATH=/home/openclaw/.npm-global/bin:$PATH
openclaw channels login --channel whatsapp --verbose
# → В терминале появится QR-код
# → На телефоне: WhatsApp → Настройки → Связанные устройства → Привязать устройство → сканировать QR

# 3. Проверить что канал подключился
openclaw channels list
# → должен появиться whatsapp: configured

# 4. Написать себе в WhatsApp — бот ответит
```

> После восстановления Telegram — WhatsApp можно оставить как второй канал или отключить:
> `openclaw channels remove --channel whatsapp`

---

### 🔴 Gateway не отвечает

```bash
# SSH на сервер
ssh openclaw@100.73.176.127

# Проверить статус
export PATH=/home/openclaw/.npm-global/bin:$PATH
systemctl --user status openclaw-gateway

# Посмотреть логи
journalctl --user -u openclaw-gateway -n 50 --no-pager

# Перезапустить
systemctl --user restart openclaw-gateway
```

### 🔴 Mac Node отключён

```bash
# На Mac
openclaw node status

# Перезапустить
openclaw node restart

# Если не помогает — переустановить
openclaw node uninstall
openclaw node install --host 100.73.176.127 --port 18789 --display-name "mac-files"
```

### 🔴 Telegram не отвечает

1. Проверить Gateway (см. выше)
2. Проверить токен бота:

```bash
ssh openclaw@100.73.176.127 "cat ~/.openclaw/openclaw.json | grep botToken"
```

3. Проверить pairing:

```bash
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw pairing list telegram"
```

### 🔴 API ключ не работает

```bash
# На сервере — проверить env в systemd
ssh openclaw@100.73.176.127 "systemctl --user show openclaw-gateway | grep Environment"

# Обновить ключ
ssh openclaw@100.73.176.127 << 'EOF'
cat > ~/.config/systemd/user/openclaw-gateway.service << 'SERVICE'
[Unit]
Description=OpenClaw Gateway
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/home/openclaw/.npm-global/bin/openclaw gateway --port 18789 --bind lan
Restart=always
RestartSec=5s
Environment=ANTHROPIC_API_KEY=<НОВЫЙ_КЛЮЧ>
WorkingDirectory=/home/openclaw/.openclaw
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
systemctl --user restart openclaw-gateway
EOF
```

### 🔴 Tailscale отключён

**На Mac:**

1. Открыть приложение Tailscale
2. Войти в аккаунт если нужно

**На сервере:**

```bash
ssh root@46.224.221.0 "tailscale status"
# Если отключён:
ssh root@46.224.221.0 "tailscale up --ssh --hostname=openclaw-server"
```

### 🔴 Gateway завис: `announce queue drain failed` (бесконечный цикл)

**Симптомы:**

- Бот не отвечает на сообщения в Telegram
- В логах каждую секунду повторяется:
  ```
  announce queue drain failed for agent:main:telegram:direct:685668909: Error: gateway closed (1008): pairing required
  gateway connect failed: Error: pairing required
  ```
- RAM 500–700 MB, CPU ~4%
- Gateway активен (`systemctl status` = running), но Telegram не работает

**Причина:** В памяти gateway застряло сообщение в announce queue (queued message). После какого-то события (cron-задача, рестарт) процесс-клиент `openclaw` пытается доставить сообщение каждую секунду. Gateway требует `operator.write` scope (pairing) — получает отказ → бесконечный retry-цикл. Telegram-polling при этом работает, но gateway перегружен и не обрабатывает входящие.

**Диагностика:**

```bash
# Убедиться что именно этот сценарий
ssh openclaw@100.73.176.127 "journalctl --user -u openclaw-gateway --since '2 minutes ago' --no-pager | grep 'announce queue drain' | wc -l"
# Если > 100 за 2 минуты — это оно
```

**Лечение (быстрое):**

```bash
# Рестарт сбрасывает announce queue из памяти
ssh openclaw@100.73.176.127 "systemctl --user restart openclaw-gateway"

# Проверить что цикл исчез (через 5 сек после рестарта — тишина)
ssh openclaw@100.73.176.127 "sleep 5 && journalctl --user -u openclaw-gateway --since '10 seconds ago' --no-pager | grep -c 'announce queue drain'"
```

**Правило:** announce queue живёт только в памяти — рестарт её очищает. Это безопасно: queued-сообщение было служебным (cron/алерт), не пользовательским диалогом.

---

### 🔴 Gateway зависает / постоянно перезапускается (cron cascade)

**Симптомы:**

- `health-monitor` перезапускает gateway каждые 2-5 минут
- В логах: `LLM request timed out`, `gateway timeout after 60000ms`, `cron failed`
- Memory peak 700MB+ перед рестартом
- После рестарта — то же самое через несколько минут

**Причина:** cron-задача (чаще всего Участковый `305e53a4`) использует модель с низким TPM-лимитом (Groq: 12K TPM). Её isolated-сессия накапливается до 200K+ токенов. Groq отвечает HTTP 413, OpenClaw делает retry → timeout → memory spike → рестарт.

**Диагностика:**

```bash
# Найти какая cron-задача падает
ssh openclaw@100.73.176.127 "journalctl --user -u openclaw-gateway -n 200 --no-pager | grep -E '(cron|timeout|413|TPM)'"

# Проверить историю запусков Участкового
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw cron runs --id 305e53a4-049c-4d2e-b248-0cdbea259d3f"
```

**Лечение:**

```bash
# 1. Сменить модель на gemini-3-flash-preview (она в allowlist gateway, 1M TPM)
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw cron edit 305e53a4-049c-4d2e-b248-0cdbea259d3f --model google/gemini-3-flash-preview"

# 2. Убедиться что другие groq-задачи не используют накапливающиеся сессии
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw cron list | grep -i groq"
```

**Правило:** Cron-задачи с `session: isolated` НАКАПЛИВАЮТ историю. Никогда не назначать groq для задач с isolated-сессией — только gemini (1M context) или openai.

---

### 🔴 Cron: `model not allowed` / `cron announce delivery failed`

**Симптомы:**

- `error: model not allowed: <модель>`
- `cron announce delivery failed` + `gateway closed (1008): pairing required`
- Задача падает за 3–27ms, не стартует

**Причина А (`model not allowed`):** После `openclaw doctor` или ручного редактирования `openclaw.json` список `agents.defaults.models` сбрасывается. Модели не в этом списке — запрещены. Разрешены: `google/gemini-3-flash-preview`, `openai/gpt-5.2`, `openai/gpt-4o`, `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4-6`, `anthropic/claude-opus-4-6`.

**Причина Б (`announce delivery failed`):** `delivery.mode: announce` открывает новое WS-соединение к gateway, которое требует pairing. Алерты лучше доставлять через `message()` tool внутри задачи.

**Диагностика:**

```bash
# Найти задачи с запрещёнными моделями
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw cron list --json" | python3 -c "
import json,sys; data=json.load(sys.stdin)
for j in data.get('jobs',data):
  m=j.get('payload',{}).get('model','')
  s=j.get('state',{}).get('lastStatus','?')
  if s=='error': print(j['id'][:8], j['name'][:30], '|', m, '|', s)
"

# Проверить allowlist моделей
ssh openclaw@100.73.176.127 "python3 -c \"import json; c=json.load(open('/home/openclaw/.openclaw/openclaw.json')); print(list(c['agents']['defaults']['models'].keys()))\""
```

**Лечение:**

```bash
# Сменить модель задачи
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw cron edit <JOB-ID> --model google/gemini-3-flash-preview"

# Отключить announce delivery (если cron announce delivery failed)
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw cron edit <JOB-ID> --no-deliver"

# Если нужно добавить модель в allowlist (например, gpt-4o-mini выпал):
ssh openclaw@100.73.176.127 "python3 << 'EOF'
import json
with open('/home/openclaw/.openclaw/openclaw.json', 'r') as f: c=json.load(f)
c['agents']['defaults']['models']['openai/gpt-4o-mini'] = {}
c['agents']['defaults']['models']['anthropic/claude-opus-4-6'] = {'params': {'context1m': True}}
with open('/home/openclaw/.openclaw/openclaw.json', 'w') as f: json.dump(c, f, indent=2)
print('Done')
EOF"
systemctl --user restart openclaw-gateway
```

**Правило:** Эталонная модель для cron-задач — `google/gemini-3-flash-preview` (1M контекст, в allowlist всегда). Backup-задачи используют `openai/gpt-4o-mini` — убедись, что она в allowlist.

---

## 🟡 Восстановление из Snapshot (быстрый путь — 5-10 мин)

Используй если сервер умер насовсем, но snapshot существует.

```bash
# 1. Hetzner Console → Servers → Create Server
#    - Image: выбрать последний snapshot "auto-neiron-YYYY-MM-DD"
#    - Type: CPX22 (Falkenstein)
#    - SSH Key: твой ключ
#    - Запустить

# 2. Подключить к Tailscale (выполнить на новом сервере)
ssh root@<NEW_IP> "curl -fsSL https://tailscale.com/install.sh | sh && tailscale up --ssh --hostname=openclaw-server"

# 3. Проверить что Нейрон живой
ssh openclaw@100.73.176.127 "systemctl --user status openclaw-gateway"
# Если IP изменился — использовать новый IP пока Tailscale не подхватит

# 4. При необходимости — рестарт gateway
ssh openclaw@100.73.176.127 "systemctl --user restart openclaw-gateway"

# 5. Проверить бота — отправить /ping в Telegram
```

> **Что сохранится из snapshot:** все данные, конфиг, память, скиллы, cron jobs — потеря только за время с последнего snapshot (ночной снапшот в 03:00).

---

## Полная переустановка сервера

### 1. Создать новый VPS на Hetzner

- Ubuntu 24.04 LTS
- CPX22
- SSH ключ: `~/.ssh/id_ed25519.pub`

### 2. Базовая настройка

```bash
# SSH как root
ssh root@<NEW_IP>

# Обновления + безопасность
apt update && apt upgrade -y
apt install -y ufw fail2ban

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw enable
systemctl enable fail2ban --now

# Пользователь
adduser openclaw --gecos "OpenClaw User" --disabled-password
usermod -aG sudo openclaw
mkdir -p /home/openclaw/.ssh
cp ~/.ssh/authorized_keys /home/openclaw/.ssh/
chown -R openclaw:openclaw /home/openclaw/.ssh
chmod 700 /home/openclaw/.ssh
chmod 600 /home/openclaw/.ssh/authorized_keys

# Отключить root login
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 3. Tailscale

```bash
# Как openclaw
ssh openclaw@<NEW_IP>
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --hostname=openclaw-server
```

### 4. OpenClaw

```bash
curl -fsSL https://openclaw.bot/install.sh | OPENCLAW_INSTALL_METHOD=npm bash
export PATH="/home/openclaw/.npm-global/bin:$PATH"
echo 'export PATH="/home/openclaw/.npm-global/bin:$PATH"' >> ~/.bashrc
```

### 5. Конфигурация

```bash
mkdir -p ~/.openclaw ~/.config/systemd/user

# Основной конфиг
cat > ~/.openclaw/openclaw.json << 'EOF'
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6"
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "botToken": "<TELEGRAM_BOT_TOKEN>"
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
EOF

# Systemd сервис
cat > ~/.config/systemd/user/openclaw-gateway.service << 'EOF'
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
EOF

# Права
chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/openclaw.json

# Запуск
systemctl --user daemon-reload
systemctl --user enable openclaw-gateway
loginctl enable-linger openclaw
systemctl --user start openclaw-gateway
```

### 6. Одобрить devices

```bash
# Подождать пока Mac node и CLI попробуют подключиться
# Затем одобрить pending devices
mkdir -p ~/.openclaw/devices
# Скопировать paired.json из бэкапа или создать новый
```

---

## Переменные для замены

| Placeholder            | Описание                              |
| ---------------------- | ------------------------------------- |
| `<NEW_IP>`             | IP нового сервера                     |
| `<TELEGRAM_BOT_TOKEN>` | Токен от @BotFather                   |
| `<GATEWAY_TOKEN>`      | Сгенерировать: `openssl rand -hex 32` |
| `<ANTHROPIC_API_KEY>`  | Ключ из console.anthropic.com         |

---

_Последнее обновление: 2026-02-05_
