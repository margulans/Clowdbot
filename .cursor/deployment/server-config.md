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

## Systemd сервис

Актуальный unit: `server-workspace/openclaw-gateway.service`

### Управление

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
| Remote         | `https://github.com/margulans/Neiron-AI-assistant`                                    |
| Branch         | `main`                                                                                |

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
