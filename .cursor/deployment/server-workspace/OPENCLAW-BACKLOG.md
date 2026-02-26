# OpenClaw — Backlog (Маргулан)

> Назначение: единый список задач/хвостов по OpenClaw, чтобы работа не растворялась в чате.
> Правило: каждая задача имеет статус и next action.

Обновлено: 2026-02-26 (UTC)

## P0 — Critical / Stability
- [ ] **Починить ingestion ответов Айганым → файлы памяти**
  - Статус: partial (созданы `memory/sandbox/` и `memory/2026-02-26.md`, отправлен тест «OK»)
  - Next: дождаться ответа Айганым → проверить, что запись появилась с тегом `[Айганым | 509646214 | ...]` в `memory/2026-02-26.md` или `memory/inbox/2026-02-26.md` и обновился `skills/marta/data/aiganym-dialogue-summary.md`.

- [ ] **Стабилизировать Чекист (b72fece5) таймауты/алерты**
  - Статус: timeout поднят до 600s; модель gpt-4o-mini; алерты дедупятся (1 раз/180 мин)
  - Next: по ближайшему run проверить `cron(runs)` → status ok/error + фактическая длительность.

- [ ] **Стабилизировать Чекист (ночь) 89db97f7**
  - Статус: timeout 600s; модель gpt-4o-mini; напоминание на проверку после 03:30 Алматы
  - Next: после scheduled run снять status/elapsed и факт алерт-доставки/`message_transport_failed`.

## P1 — Memory contour (Mem0/Qdrant) production-ready
- [ ] **Docker доступ для проверки Qdrant контейнера**
  - Статус: docker.sock permission denied (нужен sudo/group docker)
  - Next: выполнить на сервере: `sudo usermod -aG docker openclaw && sudo loginctl terminate-user openclaw` → затем `docker ps --filter name=neiron-qdrant --format '{{.Status}}'`.

- [ ] **72h soak monitoring (Mem0)**
  - Статус: probe job активен каждые 10 минут; stop-job через 72h; напоминание поставлено на 2026-03-01 16:30 Алматы
  - Next: на 72h итог — сводка errors15m + p95_latency_ms + вердикт OK/DEGRADED.

## P1 — Lobster migration (plan-only → decision-gate)
- [ ] **Дождаться decision-gates и собрать отчёты**
  - Contours: Mekhanik / Git-sync / Wendy / Marta
  - Next: в gate-времена прочитать post-check отчёты и выполнить cutover-runbook (порядок: Mekhanik → Git sync → Wendy → Marta) + baseline deltas.

- [ ] **Убрать ложные блокировки gate из-за legacy шумов**
  - Статус: добавлен scope incidents в gate reports (legacy не блокирует; unknown → needs_review)
  - Next: на gate проверить, что legacy cron_error не даёт STOP-LOSS для Lobster.

## P2 — Digest / Telegram transport
- [ ] **Разобрать «An unknown error occurred» для Вечернего дайджеста @newsneiron (582cc3f0)**
  - Статус: классифицируется как legacy warning
  - Next: извлечь точный Telegram/API/provider error из gateway logs и решить: permissions/limits/model/timeouts.

## P2 — Git churn / data policy
- [ ] **Внедрить 2-фазный план снижения конфликтов data/runtime файлов**
  - Phase 1: jsonl/log/state → runtime-only; в git только агрегаты/snapshots
  - Phase 2: single-writer для sent-digests/dual-rating

## P3 — Reminders / ops hygiene
- [ ] **Добавить напоминание «передать лекарства Асику»**
  - Статус: в cron есть только «Аводарт — воскресенье 09:00 Алматы»
  - Next: определить время/дни/текст и создать cron reminder.

## Совершенствование Нейрона
- [ ] **Установить новую версию** (только по явной команде Маргулана)
- [ ] **Максимально перевести все cron-задачи и роли на Lobster** (через plan-only → decision-gate → cutover)
- [ ] **Доработать память** (ingestion Айганым → memory/*, Mem0/Qdrant stability, soak-monitoring)
- [ ] **Оптимизировать модели** (выбрать наиболее стабильную и дешёвую модель по факту: latency/timeout/стоимость)
- [ ] **Доработать систему управления контекстом** (optimizer: убрать bloat, закрепить canonical refs)
