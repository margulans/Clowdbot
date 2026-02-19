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

Актуальный конфиг: `server-workspace/openclaw.json` (секреты заменены плейсхолдерами).

### Ключевые настройки:

| Настройка              | Значение                            | Описание                                  |
| ---------------------- | ----------------------------------- | ----------------------------------------- |
| Модель                 | `anthropic/claude-sonnet-4-6`       | Основная AI модель                        |
| Context pruning        | `cache-ttl`                         | Автоочистка контекста                     |
| Memory flush           | `enabled`                           | Автосохранение памяти                     |
| Session memory         | `enabled`                           | Поиск по сессиям                          |
| Memory search          | OpenAI `text-embedding-3-small`     | Семантический поиск                       |
| LanceDB                | `enabled`                           | Auto-recall/capture                       |
| Brave Search           | `enabled`                           | Веб-поиск для новостей                    |
| Groq Whisper           | `whisper-large-v3`                  | Транскрипция голосовых                    |
| Inline buttons         | `none`                              | Отключены (оценка через нативные реакции) |
| Reaction notifications | `own`                               | Нативные emoji-реакции Telegram           |
| DM Policy              | `allowlist`                         | Только ID 685668909                       |
| Commands               | restart, text, native, nativeSkills | Telegram команды                          |
| Max concurrent         | 4 agents, 8 subagents               | Параллелизм                               |

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

## API ключи (в systemd env + openclaw.json)

| Ключ                 | Где хранится                   | Назначение                |
| -------------------- | ------------------------------ | ------------------------- |
| `ANTHROPIC_API_KEY`  | systemd env                    | Claude API                |
| `TELEGRAM_BOT_TOKEN` | openclaw.json                  | Telegram Bot API          |
| `GATEWAY_AUTH_TOKEN` | openclaw.json                  | WebSocket аутентификация  |
| `BRAVE_API_KEY`      | openclaw.json                  | Brave Search для новостей |
| `GROQ_API_KEY`       | env (не в systemd)             | Whisper транскрипция      |
| `OPENAI_API_KEY`     | openclaw.json + LanceDB config | Embeddings для памяти     |

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
| Remote         | `https://github.com/margulans/Clowdbot`                                               |
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

_Последнее обновление: 2026-02-07_
