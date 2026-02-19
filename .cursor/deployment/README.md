# OpenClaw Deployment — Личный AI-ассистент «Нейрон»

Документация по развёрнутой инфраструктуре персонального AI-бота.

## Содержание

- [Архитектура](#архитектура)
- [Компоненты](#компоненты)
- [Эндпойнты и доступы](#эндпойнты-и-доступы)
- [Возможности бота](#возможности-бота)
- [Workflows](./WORKFLOWS.md) — **детальные схемы автоматизаций**
- [Восстановление](#восстановление)
- [Безопасность](#безопасность)
- [Структура файлов](#структура-файлов)

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        ИНТЕРНЕТ                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  HETZNER VPS (46.224.221.0)                                     │
│  ├── OpenClaw Gateway (systemd)                                 │
│  ├── Telegram Bot (@neironassistant_bot)                        │
│  ├── Claude Sonnet 4.6 (Anthropic API)                          │
│  ├── Новостной агрегатор (cron + web search)                    │
│  ├── Система рейтинга (multi-armed bandit)                      │
│  ├── Долгосрочная память (bank + LanceDB + OpenAI embeddings)   │
│  └── Голосовая транскрипция (Groq Whisper)                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Tailscale VPN (encrypted)
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│  MAC (margulansmacbookpro)                                      │
│  ├── OpenClaw Node (LaunchAgent)                                │
│  ├── ~/Downloads, ~/Desktop, ~/Documents, ~/Pictures            │
│  └── Транзакционные бэкапы (cleanup-scripts)                    │
└─────────────────────────────────────────────────────────────────┘
```

## Компоненты

### 1. Hetzner VPS

- **IP:** `46.224.221.0`
- **Tailscale IP:** `100.73.176.127`
- **OS:** Ubuntu 24.04 LTS
- **План:** CPX22 (~5 евро/мес)
- **Пользователь:** `openclaw`

### 2. OpenClaw Gateway

- **Порт:** `18789`
- **Bind:** `loopback`
- **Auth:** token-based
- **Модель:** `anthropic/claude-sonnet-4-6`
- **Context pruning:** `cache-ttl`
- **Memory flush:** enabled
- **Session memory:** enabled

### 3. Telegram Bot

- **Username:** `@neironassistant_bot`
- **DM Policy:** `allowlist`
- **Approved User:** `685668909`
- **Реакции:** нативные Telegram emoji (🔥👍👎💩 → рейтинг источников)
- **Команды:** `/restart`, `/reset`, `/new`, `/compact`, `/digest`, `/git`

### 4. Mac Node

- **Name:** `mac-files`
- **Tailscale IP:** `100.88.178.82`
- **Service:** LaunchAgent (`ai.openclaw.node`)
- **Capabilities:** filesystem, shell
- **Доступные папки:** ~/Downloads, ~/Desktop, ~/Documents, ~/Pictures

### 5. Интеграции (API ключи)

- **Anthropic** — Claude Sonnet 4.6 (основная модель)
- **Brave Search** — веб-поиск для новостей
- **Groq** — Whisper Large V3 (транскрипция голосовых)
- **OpenAI** — text-embedding-3-small (семантический поиск по памяти)

---

## Эндпойнты и доступы

| Компонент     | Адрес                          | Доступ                    |
| ------------- | ------------------------------ | ------------------------- |
| Gateway WS    | `ws://100.73.176.127:18789`    | Tailscale only            |
| Control UI    | `http://100.73.176.127:18789/` | Tailscale only            |
| SSH Server    | `ssh openclaw@46.224.221.0`    | SSH key                   |
| SSH Tailscale | `ssh openclaw@100.73.176.127`  | SSH key                   |
| Telegram      | `@neironassistant_bot`         | Allowlist (ID: 685668909) |

---

## Возможности бота

### Новостной агрегатор

- **7 тем** по приоритету: ИИ, Вайбкодинг, Робототехника, eVTOL, Технологии, Бизнес, Инвестиции
- **3 дайджеста** в день: 08:00, 13:00, 18:00 (местное время)
- **10-15 новостей** за дайджест, 30% из новых каналов
- **Inline реакции**: Отлично (+10), Нравится (+5), Не нравится (-3), Мусор (-5)
- **Адаптивная система**: multi-armed bandit, dual-рейтинг источников
- **Команда `/digest`** — внеочередной дайджест по требованию

### Память

- **MEMORY.md** — долгосрочная кураторская память
- **Bank-структура** — world.md, experience.md, opinions.md, entities/
- **Session memory** — поиск по истории сессий
- **OpenAI embeddings** — семантический поиск (text-embedding-3-small)
- **LanceDB** — auto-recall/capture (плагин)
- **Memory flush** — автосохранение памяти перед компактификацией

### Голос

- **Groq Whisper** — транскрипция голосовых сообщений

### Файлы Mac

- **Транзакционные бэкапы** перед очисткой
- **Exec-approvals** — allowlist команд (ls, rm, mv, cp, find, du, cat, file...)
- **Подтверждение** — всегда спрашивает перед удалением

### Git Sync (`/git`)

- **Архитектура:** workspace бота = Git-репо через симлинк
  - `~/.openclaw/workspace` → `~/Clowdbot/.cursor/deployment/server-workspace`
- **Одна папка:** бот читает/пишет напрямую в Git-репо, без копирования
- **Команда:** `/git` — автоматический commit и push в GitHub
- **Workflow:**
  1. `git pull origin main` — получить последние изменения
  2. `git status` — проверить состояние
  3. `git add -A && git commit && git push` — коммит и push
- **Синхронизация:** Telegram ↔ GitHub ↔ Mac (Cursor)
- **Skill файл:** `~/.openclaw/skills/git-sync/SKILL.md`

```
┌──────────────────────────────────────────────┐
│  Hetzner VPS                                  │
│  ~/.openclaw/workspace (симлинк)              │
│       ↓                                       │
│  ~/Clowdbot/.cursor/deployment/server-workspace │
│       ↓                                       │
│  /git → git add + commit + push              │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
          ┌─────────────┐
          │   GitHub    │
          │  (облако)   │
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │ Mac/Cursor  │
          │  git pull   │
          └─────────────┘
```

---

## Восстановление

### Команды через Telegram

| Команда    | Действие                           |
| ---------- | ---------------------------------- |
| `/restart` | Перезапустить gateway              |
| `/reset`   | Очистить сессию (при переполнении) |
| `/new`     | Начать новую сессию                |
| `/compact` | Сжать контекст (набрать текстом)   |
| `/digest`  | Внеочередной дайджест новостей     |
| `/git`     | Commit и push изменений в GitHub   |

### Автоматическая защита

- **Systemd Restart=always** — перезапуск при падении
- **MemoryMax=2G** — ограничение памяти
- **Context pruning** — автоочистка старых tool results

### Через SSH (если Telegram не работает)

```bash
# Перезапуск Gateway
ssh openclaw@100.73.176.127 "systemctl --user restart openclaw-gateway"

# Очистка сессии + перезапуск
ssh openclaw@100.73.176.127 "rm -f ~/.openclaw/agents/main/sessions/sessions.json && systemctl --user restart openclaw-gateway"

# Проверить статус
ssh openclaw@100.73.176.127 "export PATH=/home/openclaw/.npm-global/bin:\$PATH && openclaw status"
```

---

## Безопасность

### Реализованные меры:

- UFW firewall (только SSH)
- Fail2ban (защита от brute-force)
- SSH key-only (пароли отключены)
- Non-root пользователь
- Tailscale VPN (шифрование)
- Gateway token auth
- Telegram allowlist (только ID 685668909)
- Транзакционные бэкапы
- Allowlist команд на Mac node

---

## Структура файлов

```
.cursor/deployment/
├── README.md                    # Этот файл
├── WORKFLOWS.md                 # Детальные схемы автоматизаций
├── RECOVERY.md                  # Инструкции по восстановлению
├── SECRETS.template.md          # Шаблон секретов
├── server-config.md             # Конфиг сервера
├── mac-config.md                # Конфиг Mac node
├── cleanup-scripts.md           # Документация скриптов очистки
├── mac-openclaw.json            # Конфиг OpenClaw на Mac (node)
├── mac-exec-approvals.json      # Exec-approvals на Mac
├── mac-cleanup-scripts/         # Скрипты очистки (bash)
│   ├── start-cleanup.sh
│   ├── confirm-cleanup.sh
│   ├── rollback-cleanup.sh
│   ├── cleanup-status.sh
│   └── auto-cleanup-old-backups.sh
└── server-workspace/            # Snapshot workspace с сервера
    ├── openclaw.json            # Конфиг Gateway (секреты заменены)
    ├── openclaw-gateway.service # Systemd unit
    ├── AGENTS.md                # Инструкции агента
    ├── MEMORY.md                # Долгосрочная память
    ├── USER.md                  # Профиль пользователя
    ├── IDENTITY.md              # Идентичность бота (Нейрон)
    ├── SOUL.md                  # Ценности и принципы
    ├── TOOLS.md                 # Заметки по инструментам
    ├── HEARTBEAT.md             # Задачи heartbeat
    ├── digest-format-final.md   # Формат дайджеста
    ├── feedback-learning-system.md # Система рейтинга
    ├── bank/                    # Bank-структура памяти
    ├── memory/                  # Дневные логи
    ├── data/                    # Данные рейтинга
    ├── skills/digest/SKILL.md   # Skill /digest
    ├── *.js                     # Код агрегатора и рейтинга
    └── *.md                     # Документация систем
```

---

---

## Skills (пользовательские команды)

### `/git` — Git Sync

Автоматический commit и push изменений в репозиторий Clowdbot.

**Расположение:** `~/.openclaw/skills/git-sync/SKILL.md` (на сервере)

**Содержимое:**

```yaml
---
name: git-sync
description: Коммит и пуш в Clowdbot
user-invocable: true
---

При /git:
1. cd ~/Clowdbot
2. git pull origin main
3. git status --short
4. git add -A
5. git commit -m "<тип>: <описание>"
6. git push origin main
```

**Использование:**

- После изменений кода через Telegram — отправить `/git`
- На Mac выполнить `git pull` чтобы получить изменения

---

_Последнее обновление: 2026-02-07_
