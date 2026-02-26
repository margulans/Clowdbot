# Evaluation Plan — Mem0 Memory Quality

Как измерять и проверять качество памяти бота Нейрон.  
Задача Cursor (читай и обновляй здесь). Тесты запускает бот по cron или вручную.

---

## Метрики

| Метрика                | Что измеряет                                          | Цель     |
| ---------------------- | ----------------------------------------------------- | -------- |
| **Recall Rate**        | Доля фактов которые бот вспомнил без подсказки        | ≥ 80%    |
| **Precision**          | Доля вспомненных фактов которые реально верны         | ≥ 90%    |
| **Latency (p95)**      | Время autoRecall при старте сессии                    | < 800 мс |
| **False Recall**       | Бот «вспомнил» факт которого нет                      | = 0      |
| **Conflict Detection** | Бот корректно разрешил противоречие Mem0 vs canonical | = 100%   |
| **Capture Errors**     | Количество `openclaw-mem0: capture failed`            | = 0      |
| **Qdrant 400 Search**  | Ошибки `POST /points/search ... 400` из runtime       | = 0      |

---

## Тест-кейсы

### TC-01: Базовый recall предпочтений

**Сценарий:** /new → спросить «На чём я пишу бэкенды?»  
**Ожидаемое:** Бот отвечает «Python + FastAPI» без подсказки  
**Источник факта:** Mem0 auto-capture из прошлой сессии  
**Частота:** Еженедельно (входит в Weekly Review cron)  
**Провал:** Бот отвечает «не знаю» или называет другой язык

---

### TC-02: Конфликт Mem0 vs canonical

**Сценарий:** Намеренно сохрани в Mem0 факт «Маргулан предпочитает Go»,  
при этом в USER.md стоит «Python + FastAPI»  
**Ожидаемое:** Бот использует USER.md (Python + FastAPI), может упомянуть расхождение  
**Как проверить:** `openclaw mem0 add "Маргулан пишет на Go"` → /new → спросить  
**Частота:** Разово при первичной настройке, затем при обновлении USER.md  
**Провал:** Бот говорит «Go» (доверяет Mem0 больше чем canonical)

---

### TC-03: Не утекают секреты

**Сценарий:** В разговоре упомяни что-то похожее на токен (`sk-test-fake-key-12345`)  
**Ожидаемое:** Sanitizer Proxy логирует `SANITIZED`, в Mem0 хранится redacted версия  
**Как проверить:**

```bash
# Проверить лог прокси
journalctl --user -u openclaw-sanitizer-proxy -n 50 | grep SANITIZED

# Проверить что в Qdrant нет реального ключа
openclaw mem0 search "sk-" --topK 5
```

**Частота:** Ежемесячно  
**Провал:** В Qdrant хранится реальный токен/ключ

---

### TC-04: Производительность recall

**Сценарий:** Отправить сообщение в новой сессии, измерить время ответа  
**Ожидаемое:** Первый ответ (включая autoRecall) приходит за < 5 сек  
**Как проверить:**

```bash
# Засечь время через openclaw
time openclaw message send "привет" --channel telegram
```

**Частота:** Еженедельно (автоматически через Weekly Review cron)  
**Провал:** Ответ занимает > 10 сек (Qdrant или прокси тормозит)

---

### TC-05: Qdrant storage рост

**Сценарий:** Проверить что storage не растёт бесконтрольно  
**Ожидаемое:** < 500 MB после 3 месяцев использования  
**Как проверить:**

```bash
du -sh ~/mem0-stack/data/qdrant/
# Или через API
curl -s http://localhost:6333/collections/openclaw-mem0 | jq '.result.vectors_count'
```

**Частота:** Ежемесячно  
**Провал:** > 1 GB или неограниченный рост (нет TTL или дедупликации)

---

### TC-06: MMR разнообразие

**Сценарий:** `openclaw mem0 search "предпочтения Маргулана" --topK 8`  
**Ожидаемое:** Результаты охватывают разные темы (языки, инвестиции, работа), не только похожие формулировки одного факта  
**Частота:** При изменении настроек MMR  
**Провал:** Все 8 результатов — вариации одного и того же факта

---

### TC-07: Регрессия baseURL в mem0ai после обновления

**Сценарий:** После обновления `openclaw` или `@mem0/openclaw-mem0` проверить, что embedder ходит через sanitizer proxy  
**Ожидаемое:** В логах `openclaw-sanitizer-proxy` есть `POST /v1/embeddings 200`, а в gateway нет `capture failed`  
**Как проверить:**

```bash
# 1) Применить воспроизводимый hotfix (идемпотентный)
bash ~/Clowdbot/.cursor/deployment/mem0-upgrade/hotfixes/apply-mem0-embedder-baseurl-fix.sh

# 2) Перезапустить gateway
systemctl --user restart openclaw-gateway

# 3) Сгенерировать трафик памяти (любой короткий диалог с новым фактом)
# 4) Проверить прокси:
journalctl --user -u openclaw-sanitizer-proxy -n 50 --no-pager | rg "/v1/embeddings"

# 5) Проверить отсутствие capture failed:
journalctl --user -u openclaw-gateway -n 200 --no-pager | rg "capture failed"
```

**Частота:** После каждого обновления `openclaw`/`@mem0/openclaw-mem0`  
**Провал:** Нет `/v1/embeddings` в proxy логах или есть `capture failed`

---

### TC-08: Soak stability 72h

**Сценарий:** Наблюдать production-трафик 72 часа после апдейтов  
**Ожидаемое:** `capture_failed_count=0` и `qdrant_400_count=0` (без ручных тестов)  
**Как проверить:**

```bash
# Gateway: capture failed за окно наблюдения
journalctl --user -u openclaw-gateway --since "72 hours ago" --no-pager \
  | rg "openclaw-mem0: capture failed" | wc -l

# Qdrant: search 400 за окно наблюдения (runtime only)
docker logs neiron-qdrant --since 72h 2>&1 \
  | rg "POST /collections/openclaw-mem0/points/search HTTP/1.1\" 400" | wc -l
```

**Частота:** После каждого релиза memory-контура  
**Провал:** Любая ошибка > 0

---

## Расписание проверок

| Проверка            | Частота                       | Кто запускает               |
| ------------------- | ----------------------------- | --------------------------- |
| TC-01, TC-04, TC-06 | Еженедельно (вс 10:00 Алматы) | Weekly Review cron          |
| TC-02               | При изменении USER.md         | Вручную (Маргулан / Cursor) |
| TC-03               | Ежемесячно                    | Cron (`0 10 1 * *` UTC+6)   |
| TC-05               | Ежемесячно                    | Тот же monthly cron         |
| TC-07               | После каждого апдейта         | Вручную (оператор)          |
| TC-08               | После каждого апдейта         | Soak 72h (оператор)         |

---

## Регрессия после обновлений

При обновлении `openclaw` или `@mem0/openclaw-mem0`:

1. Запустить `check-mem0.sh` — убедиться что stack жив
2. Применить `apply-mem0-embedder-baseurl-fix.sh` (идемпотентно)
3. Выполнить TC-01 вручную (< 2 мин)
4. Выполнить TC-07 (proxy embeddings + capture without errors)
5. Запустить TC-08 (soak 72h) и зафиксировать результаты
6. Если что-то сломалось — откат через RUNBOOK.md § Rollback

---

## Критерии приёмки релиза памяти

Релиз memory-контура можно считать успешным только при всех условиях:

1. `check-mem0.sh` возвращает `OK`
2. TC-01 и TC-07 пройдены
3. За 72 часа (`TC-08`): `capture_failed_count=0`, `qdrant_400_count=0`
4. Нет деградации по метрике `Latency (p95)` относительно прошлого релиза

---

## Ссылки

- Healthcheck: `.cursor/deployment/mem0-upgrade/healthchecks/check-mem0.sh`
- Runbook: `.cursor/deployment/mem0-upgrade/RUNBOOK.md`
- Политика памяти: `.cursor/deployment/server-workspace/AGENTS.md` § Политика памяти
- Архитектура: `.ai/ARCHITECTURE.md` § Память
