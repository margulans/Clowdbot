# Конфигурация сервера Hetzner

## Параметры VPS

| Параметр     | Значение          |
| ------------ | ----------------- |
| Провайдер    | Hetzner Cloud     |
| План         | CPX22             |
| vCPU         | 4                 |
| RAM          | 8 GB              |
| Диск         | 160 GB NVMe       |
| Цена         | ~5 евро/мес       |
| IP           | `46.224.221.0`    |
| Tailscale IP | `100.73.176.127`  |
| Hostname     | `openclaw-server` |
| OS           | Ubuntu 24.04 LTS  |

## Пользователи

| User       | Права         | Назначение            |
| ---------- | ------------- | --------------------- |
| `root`     | disabled SSH  | Начальная настройка   |
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

**Источник правды — `server-workspace/openclaw.json`** (секреты заменены плейсхолдерами, реальные ключи в systemd drop-in файлах).

> Актуальные значения смотри напрямую в файле. Эта секция описывает архитектуру настроек — что делает каждый параметр.

### Архитектура настроек

| JSON-путь                                                 | Описание                                     |
| --------------------------------------------------------- | -------------------------------------------- |
| `agents.defaults.model.primary`                           | Основная AI модель                           |
| `agents.defaults.model.fallbacks[]`                       | Резервные модели (не авто-переключение)      |
| `agents.defaults.contextPruning.mode`                     | Стратегия очистки контекста                  |
| `agents.defaults.compaction.memoryFlush`                  | Автосохранение памяти в конце сессии         |
| `agents.defaults.memorySearch.experimental.sessionMemory` | Поиск по истории сессий                      |
| `agents.defaults.memorySearch.model`                      | Модель эмбеддингов для семантического поиска |
| `plugins.entries.memory-lancedb`                          | Векторная БД для auto-recall/capture         |
| `tools.web.search.provider`                               | Провайдер веб-поиска (основной)              |
| `tools.web.search.perplexity.model`                       | Модель Perplexity                            |
| `tools.web.search.apiKey`                                 | Ключ Brave (fallback уровень 1, legacy поле) |
| `tools.media.audio.models[0]`                             | Провайдер/модель транскрипции голосовых      |
| `channels.telegram.capabilities.inlineButtons`            | Inline-кнопки в Telegram                     |
| `channels.telegram.reactionNotifications`                 | Уведомления о реакциях                       |
| `channels.telegram.reactionLevel`                         | Роль реакции (ack = подтверждение получения) |
| `messages.ackReactionScope`                               | Область применения ack-реакции               |
| `messages.removeAckAfterReply`                            | Убирать ack-реакцию после ответа             |
| `channels.telegram.dmPolicy`                              | Политика личных сообщений                    |
| `channels.telegram.allowFrom[]`                           | Белый список Telegram ID                     |
| `commands.*`                                              | Включённые команды бота                      |
| `agents.defaults.maxConcurrent`                           | Макс. параллельных агентов                   |
| `agents.defaults.subagents.maxConcurrent`                 | Макс. параллельных субагентов                |

## Systemd сервисы

### openclaw-gateway.service (основной)

Актуальный unit: `server-workspace/openclaw-gateway.service`

```bash
# Статус
systemctl --user status openclaw-gateway

# Логи
journalctl --user -u openclaw-gateway -f

# Перезапуск
systemctl --user restart openclaw-gateway

# Остановка / Запуск
systemctl --user stop openclaw-gateway
systemctl --user start openclaw-gateway
```

---

### telegram-polling-watchdog.service + .timer

| Параметр   | Значение                                                           |
| ---------- | ------------------------------------------------------------------ |
| Состояние  | timer **enabled + active** (запускается каждые 2 мин)              |
| Назначение | Защита polling-режима — удаляет webhook если он вдруг установлен   |
| Скрипт     | `~/.openclaw/telegram-polling-watchdog.sh`                         |
| Расписание | `OnBootSec=60`, `OnUnitActiveSec=2min`                             |
| Unit-файл  | `~/.config/systemd/user/telegram-polling-watchdog.{service,timer}` |

**Зачем нужен:** если какой-либо инструмент или OpenClaw установит webhook — бот перестанет получать сообщения в polling-режиме. Watchdog каждые 2 минуты проверяет `getWebhookInfo` и при наличии webhook вызывает `deleteWebhook`.

```bash
# Статус
systemctl --user status telegram-polling-watchdog.timer

# Логи последних срабатываний
journalctl --user -u telegram-polling-watchdog.service --no-pager -n 20
```

---

### telegram-reaction-webhook.service

| Параметр   | Значение                                                          |
| ---------- | ----------------------------------------------------------------- |
| Состояние  | **disabled + inactive** (был активен 19–20 фев 2026, остановлен)  |
| Назначение | Node.js сервер — принимает `message_reaction` события от Telegram |
| Порт       | `8443` (HTTPS, self-signed cert)                                  |
| Скрипт     | `~/.openclaw/webhook-server/server.js`                            |
| Unit-файл  | `~/.config/systemd/user/telegram-reaction-webhook.service`        |

**Зачем нужен:** получает реакции (🔥👍👎💩) из канала @newsneiron, конвертирует в баллы рейтинга источников и инжектирует system event в OpenClaw gateway.

**Примечание:** сервис отключён — при работе в polling-режиме реакции обрабатываются напрямую через gateway без отдельного webhook-сервера.

```bash
# Запуск (если понадобится)
systemctl --user start telegram-reaction-webhook
systemctl --user enable telegram-reaction-webhook

# Статус
systemctl --user status telegram-reaction-webhook

# Логи
journalctl --user -u telegram-reaction-webhook --no-pager -n 30
```

## API ключи

Ключи хранятся в drop-in файлах systemd — **не перезаписываются** при обновлении OpenClaw.
Путь: `~/.config/systemd/user/openclaw-gateway.service.d/*.conf`

### Systemd drop-in файлы

| Drop-in файл         | Переменная               | Назначение                         |
| -------------------- | ------------------------ | ---------------------------------- |
| `anthropic.conf`     | `ANTHROPIC_API_KEY`      | Claude API (fallback модель)       |
| `brave.conf`         | `BRAVE_API_KEY`          | Brave Search (fallback поиск)      |
| `gateway-token.conf` | `OPENCLAW_GATEWAY_TOKEN` | WebSocket аутентификация           |
| `gemini.conf`        | `GEMINI_API_KEY`         | Google Gemini (isolated cron jobs) |
| `groq.conf`          | `GROQ_API_KEY`           | Groq Whisper транскрипция          |
| `hetzner.conf`       | `HETZNER_API_TOKEN`      | Hetzner API (snapshot скрипт)      |
| `openai.conf`        | `OPENAI_API_KEY`         | OpenAI Embeddings (LanceDB)        |
| `openrouter.conf`    | `OPENROUTER_API_KEY`     | OpenRouter (free tier модели)      |
| `path.conf`          | `PATH`                   | Системный PATH для gateway         |
| `perplexity.conf`    | `PERPLEXITY_API_KEY`     | Perplexity Search (основной)       |

### В openclaw.json (плейсхолдеры)

| JSON-путь                                                | Переменная             |
| -------------------------------------------------------- | ---------------------- |
| `channels.telegram.botToken`                             | `<TELEGRAM_BOT_TOKEN>` |
| `gateway.auth.token`                                     | `<GATEWAY_AUTH_TOKEN>` |
| `tools.web.search.apiKey`                                | `<BRAVE_API_KEY>`      |
| `tools.web.search.perplexity.apiKey`                     | `<PERPLEXITY_API_KEY>` |
| `agents.defaults.memorySearch.remote.apiKey`             | `<OPENAI_API_KEY>`     |
| `plugins.entries.memory-lancedb.config.embedding.apiKey` | `<OPENAI_API_KEY>`     |

## Telegram Pairing

- **DM Policy:** `allowlist`
- **Allowed User ID:** `685668909`
- **Telegram Bot:** `@neironassistant_bot`

## Репозиторий Clowdbot + Workspace (симлинк)

Workspace бота = Git-репо через симлинк (одна папка, без копирования):

| Параметр       | Значение                                                                              |
| -------------- | ------------------------------------------------------------------------------------- |
| Git-репо       | `~/Clowdbot`                                                                          |
| Workspace бота | `~/.openclaw/workspace` → симлинк на `~/Clowdbot/.cursor/deployment/server-workspace` |
| Remote         | `git@github.com:margulans/Neiron-AI-assistant.git` (SSH)                              |
| Branch         | `main`                                                                                |
| SSH-ключ       | `~/.ssh/id_ed25519` (ed25519, аутентификация через GitHub)                            |

### Синхронизация

```bash
# Через Telegram (бот)
/git  # автоматически делает pull + add + commit + push

# Через SSH
cd ~/Clowdbot && git pull origin main
```

### Как это работает

- Бот читает/пишет файлы в `~/.openclaw/workspace/`
- Это симлинк → файлы физически в Git-репо
- `/git` коммитит все изменения бота + пушит в GitHub
- На Mac `git pull` стягивает всё обратно

## System Cron (crontab -l)

Задачи системного cron — **не в OpenClaw**, выполняются напрямую по расписанию от пользователя `openclaw`.

| Расписание  | Скрипт                          | Назначение                                       | Лог                         |
| ----------- | ------------------------------- | ------------------------------------------------ | --------------------------- |
| `0 3 * * *` | `~/scripts/hetzner-snapshot.sh` | Ночной snapshot Hetzner VPS (хранит последние 3) | `/tmp/hetzner-snapshot.log` |

### hetzner-snapshot.sh

| Параметр  | Значение                                                    |
| --------- | ----------------------------------------------------------- |
| Server ID | `119957063`                                                 |
| Label     | `auto-neiron`                                               |
| Хранится  | Последние 3 snapshot (старые удаляются автоматически)       |
| API-токен | ⚠️ Хардкодом в скрипте (`HETZNER_API_TOKEN=...`) — см. ниже |

> ⚠️ **Проблема безопасности:** `HETZNER_API_TOKEN` захардкожен прямо в скрипте.
> System cron не имеет доступа к user systemd окружению, поэтому нельзя использовать `hetzner.conf` drop-in напрямую.
> **Рекомендуется** перенести токен в `~/.hetzner_token` (chmod 600) и читать его в скрипте через `source ~/.hetzner_token`.

```bash
# Проверить последний запуск
cat /tmp/hetzner-snapshot.log | tail -20

# Запустить вручную (тест)
bash ~/scripts/hetzner-snapshot.sh

# Посмотреть/редактировать crontab
crontab -e

# Список текущих задач
crontab -l
```

## Skills (пользовательские команды)

| Skill    | Путь                                                                    | Команда   |
| -------- | ----------------------------------------------------------------------- | --------- |
| git-sync | `~/.openclaw/skills/git-sync/SKILL.md`                                  | `/git`    |
| digest   | `~/Clowdbot/.cursor/deployment/server-workspace/skills/digest/SKILL.md` | `/digest` |

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

# Очистить сессию
openclaw sessions clear --all
```

---

_Последнее обновление: 2026-02-24_
