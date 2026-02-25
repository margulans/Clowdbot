# RUNBOOK: Mem0 Memory Upgrade

Пошаговый деплой-гайд для VPS Hetzner (пользователь `openclaw`).  
Все команды выполняются через SSH: `ssh openclaw@46.224.221.0`

**Время выполнения:** ~30 мин  
**Риск:** низкий (OpenClaw не трогаем до Шага 7)

---

## Перед началом

```bash
# Сделай снапшот VPS в Hetzner Console (30 сек)
# URL: https://console.hetzner.cloud → Servers → neiron → Backups/Snapshots
```

---

## Шаг 1: Проверка системы

```bash
whoami          # должно быть: openclaw
df -h /         # убедись что > 5 GB свободно
free -h         # убедись что > 500 MB RAM
```

---

## Шаг 2: Установка Docker (если нет)

```bash
docker --version 2>/dev/null && echo "Docker OK — пропусти этот шаг" || {
  # Официальная установка Docker на Ubuntu
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker openclaw
  # ВАЖНО: выйди и зайди снова через SSH для применения группы
  exit
}
# После повторного входа:
docker --version        # должно быть Docker 24+
docker compose version  # должно быть Compose v2
```

---

## Шаг 3: Развёртывание Qdrant + Mem0

```bash
# Создай рабочую папку
mkdir -p ~/mem0-stack && cd ~/mem0-stack

# Скопируй файлы (после git pull в ~/Clowdbot)
cp ~/Clowdbot/.cursor/deployment/mem0-upgrade/docker-compose.yml .
cp ~/Clowdbot/.cursor/deployment/mem0-upgrade/.env.example .env

# Заполни .env — вставь реальный OPENAI_API_KEY
nano .env
# Замени: sk-REPLACE_WITH_REAL_KEY → реальный ключ

# Запусти Qdrant
docker compose up -d qdrant

# Проверь Qdrant (подождать ~10 сек)
sleep 10 && curl -sf http://localhost:6333/healthz | jq .
# Ожидаемый ответ: {"title":"qdrant - healthy","version":"..."}

# Запусти Mem0
docker compose up -d mem0

# Проверь Mem0 (подождать ~15 сек)
sleep 15 && curl -sf http://localhost:8000/health | jq .
# Ожидаемый ответ: {"status":"ok",...}

# Полный статус
docker compose ps
```

---

## Шаг 4: Развёртывание Sanitizer Proxy

```bash
# Создай папку для proxy
mkdir -p ~/.openclaw/sanitizer-proxy

# Скопируй файлы
cp ~/Clowdbot/.cursor/deployment/mem0-upgrade/sanitizer-proxy/proxy.py \
   ~/.openclaw/sanitizer-proxy/
cp ~/Clowdbot/.cursor/deployment/mem0-upgrade/sanitizer-proxy/requirements.txt \
   ~/.openclaw/sanitizer-proxy/

# Создай virtualenv и установи зависимости
python3 -m venv ~/.openclaw/sanitizer-proxy/venv
~/.openclaw/sanitizer-proxy/venv/bin/pip install -r \
   ~/.openclaw/sanitizer-proxy/requirements.txt

# Установи systemd unit
mkdir -p ~/.config/systemd/user
cp ~/Clowdbot/.cursor/deployment/mem0-upgrade/sanitizer-proxy/openclaw-sanitizer-proxy.service \
   ~/.config/systemd/user/

# Включи и запусти
systemctl --user daemon-reload
systemctl --user enable openclaw-sanitizer-proxy
systemctl --user start openclaw-sanitizer-proxy

# Проверь статус
systemctl --user status openclaw-sanitizer-proxy
curl -sf http://localhost:8888/health | jq .
# Ожидаемый ответ: {"status":"ok","upstream":"https://api.openai.com"}
```

---

## Шаг 5: Финальная проверка всех сервисов

```bash
# Запусти healthcheck скрипт
cd ~/Clowdbot
bash .cursor/deployment/mem0-upgrade/healthchecks/check-mem0.sh
# Ожидаемый ответ: OK: Qdrant + Mem0 + SanitizerProxy

# Проверь порты (всё должно быть на 127.0.0.1)
ss -lntp | grep -E '6333|8000|8888'
# Ожидаемый вывод — ТОЛЬКО 127.0.0.1:*, НЕ 0.0.0.0:*
```

---

## Шаг 6: Конфигурация OpenClaw (через бота в Telegram)

Выполни ТЗ для бота из раздела "ТЗ для @neironassistant_bot" ниже.  
Это делается через Telegram, не через SSH.

---

## Шаг 7: Тестирование recall

После перезапуска gateway:

```
1. Напиши боту: «Я всегда пишу backend на Python и предпочитаю FastAPI»
2. Подожди ответа
3. Напиши: /new  (новая сессия)
4. Напиши: «На каком языке я пишу бэкенды?»
5. Бот должен вспомнить Python/FastAPI без повторения
```

Дополнительная проверка:

```
openclaw mem0 stats    # показывает количество memories
openclaw mem0 search "backend"  # семантический поиск
```

---

## Rollback (если что-то пошло не так)

```bash
# Остановить Mem0 + Qdrant
cd ~/mem0-stack && docker compose down

# Остановить Sanitizer Proxy
systemctl --user stop openclaw-sanitizer-proxy
systemctl --user disable openclaw-sanitizer-proxy

# Удалить плагин через бота: openclaw plugins remove openclaw-mem0
# Затем перезапустить: systemctl --user restart openclaw-gateway
```

OpenClaw вернётся к LanceDB (старый memory stack) автоматически.

---

## ТЗ для @neironassistant_bot

### ТЗ #1 — Установка плагина + конфигурация

```markdown
## ТЗ для @neironassistant_bot

**Задача:** Установить Mem0 плагин и сконфигурировать openclaw.json
**Тип:** openclaw.json + хотфикс

**Шаги:**

1. Проверь текущие плагины: openclaw plugins list
2. Установи плагин: openclaw plugins install @mem0/openclaw-mem0
3. Открой ~/.openclaw/openclaw.json
4. Найди или создай секцию "plugins" → "entries"
5. Добавь блок из ~/Clowdbot/.cursor/deployment/mem0-upgrade/openclaw-plugin-snippet.json
   (скопируй содержимое ключа "openclaw-mem0" как есть)
6. Создай папку: mkdir -p ~/.openclaw/mem0
7. Сохрани файл
8. Перезапусти: systemctl --user restart openclaw-gateway
9. Через 30 сек проверь: openclaw plugins list и openclaw mem0 stats

**Ожидаемый результат:** openclaw-mem0 в списке плагинов, команда openclaw mem0 stats работает
```

### ТЗ #2 — Еженедельный batch-review (воскресенье 10:00 UTC+6 = 04:00 UTC)

```markdown
## ТЗ для @neironassistant_bot

**Задача:** Добавить еженедельный cron job для review Mem0 памяти
**Тип:** cron

**Шаги:**

1. Добавь cron job с расписанием "0 4 \* \* 0" (воскресенье 04:00 UTC = 10:00 Алматы)
2. Название: "Memory Weekly Review"
3. Промпт:

Еженедельный обзор памяти Нейрона.

ЗАДАЧА:

1. Запусти: openclaw mem0 search "предпочтения" (topK=10)
2. Запусти: openclaw mem0 search "факты о Маргулане" (topK=10)
3. Сравни найденные факты с содержимым USER.md и MEMORY.md
4. Если Mem0 содержит подтверждённые факты, которых нет в USER.md — покажи их Маргулану
5. Спроси: "Добавить эти факты в USER.md как долгосрочную память?"
6. НЕ вноси изменения в USER.md автоматически — только после подтверждения
7. Запусти check-mem0.sh, сообщи статус

**Ожидаемый результат:** Еженедельный cron job добавлен, расписание 0 4 \* \* 0
```
