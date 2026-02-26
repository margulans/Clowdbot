# Context Manifest (main + cron)

Обновлено: `2026-02-26T03:51:17Z`

## Always-loaded (main session)

- `AGENTS.md` (protected)
- `USER.md` (protected)
- `MEMORY.md` (protected)
- `HEARTBEAT.md` (protected)
- `SOUL.md` (protected)
- `TOOLS.md` (protected)
- `memory/YYYY-MM-DD.md` (today + yesterday)

## Protected Context Files (change-control)

Изменения в этих файлах допускаются только по явному разрешению Маргулана в чате: **"да, меняй"**.

## Cron jobs → referenced files (best-effort)

### Auto-commit: Git sync (ce006db5-350b-44be-baef-8b216ed687e4)
- `data/cron-jobs-snapshot.json`
- `data/cron-jobs.json`
- `data/incidents.json`

### Auto-push: Git sync (stage 2) (db2dc5f6-46c8-4b4e-8458-d0d7241d2e02)
- `data/incidents.json`

### BACKUP: Утренние мнения (Gemini) (10e6c5ea-652e-4776-b097-f72dbf6ef050)
- `data/sent-digests.json`

### Digest Weekly Improvement (12459c64-6d58-428a-a63a-aeaf44594656)
- `data/dual-rating-data.json`
- `data/sent-digests.json`

### Вечерние мнения (1ebe95ac-91c9-45e5-a758-a1ff5be367e4)
- `data/dual-rating-data.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### Вечерний дайджест @newsneiron (582cc3f0-9941-4e74-ae77-0afac52c6258)
- `data/dual-rating-data.json`
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### Дневной дайджест @newsneiron (a0ed4696-8c15-4ab2-b21d-e3e2e9a0b6b6)
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### Дневные мнения (ba31c42d-be5d-486e-9897-6fb4fa6ae2ed)
- `data/dual-rating-data.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### Ежедневная рефлексия (9d558661-b1bd-4636-afba-72ec30bb3190)
- `skills/wendy/WENDY.md`

### Утренние мнения (6d4944f0-7679-4c5f-b22d-49afc05158b2)
- `data/dual-rating-data.json`
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### Утренний дайджест @newsneiron (1c292387-c997-46f1-b8a1-e5fd40059713)
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### 👮‍♂️ Участковый (305e53a4-049c-4d2e-b248-0cdbea259d3f)
- `data/incidents.json`
- `skills/uchastkovy/SKILL.md`

### 👮‍♂️ Участковый (ночь) (bc20e704-af13-445d-af52-eaa3ac157d4b)
- `data/incidents.json`
- `skills/uchastkovy/SKILL.md`

### 💰 Экономист (сбор) (22efd91b-5dbf-4cfe-a623-9cbe6a5b56bd)
- `data/cost-summary.json`
- `data/economist-log.json`
- `data/token-usage.json`
- `scripts/economist_collect.py`

### 📈 Monitor daily summary (incidents only) (f4ac0949-f857-4ab5-b534-4e826d0bf1fb)
- `/home/openclaw/.openclaw/runtime/monitor-heartbeat.json`
- `data/incidents.json`
- `scripts/monitor_daily_aggregate.py`

### 📊 Экономист (отчёт) (b1314adb-6d55-416f-b268-061549952089)
- `skills/economist/SKILL.md`

### 📊 Экономия токенов мониторинга — отчёт (daily) (bb57b6eb-28a4-4d76-9788-8495c2ac335d)
- `/home/openclaw/.openclaw/agents/main/sessions/sessions.json`
- `data/model-pricing.json`

### 📋 Марта: Саммари от Айганым — вечерний отчёт (9e47cd1e-caac-4873-bf51-d70cc50974be)
- `memory/YYYY-MM-DD.md`
- `memory/inbox/YYYY-MM-DD.md`
- `memory/sandbox/YYYY-MM-DD.md`
- `skills/avicenna/data/profile.md`
- `skills/marta/data/aiganym-dialogue-summary.md`

### 🔧 Механик (bef4ddfa-1fd8-4c64-9495-79d851f4f5f0)
- `data/incidents.json`
- `skills/mekhanik/SKILL.md`

### 🔧 Механик (ночь) (0ece27a3-dfc0-47a4-bd3c-6fb6c8c9d403)
- `data/incidents.json`
- `skills/mekhanik/SKILL.md`

### 🕵️ Чекист (b72fece5-c8f7-4b9b-842a-208b7efcecc2)
- `data/incidents.json`
- `skills/chekist/SKILL.md`

### 🕵️ Чекист (ночь) (89db97f7-e05e-4e3b-990b-fefc1815e7d7)
- `data/incidents.json`
- `skills/chekist/SKILL.md`

### 🚨 BACKUP: Аналитик — еженедельный отчёт (1560e572-8564-49c8-a0ba-90d7be9af64c)
- `skills/analytics/SKILL.md`

### 🚨 BACKUP: Вечерние мнения (Gemini) (8783bc2f-de99-4742-9229-09921260d546)
- `data/dual-rating-data.json`
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### 🚨 BACKUP: Вечерний дайджест (Gemini) (e758d243-54e7-4d3b-b684-8115561831e6)
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### 🚨 BACKUP: Дневной дайджест (Gemini) (62c89740-52fa-4364-b1ae-7c81110ef368)
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### 🚨 BACKUP: Дневные мнения (Gemini) (d81fedff-8d6f-4e32-a105-a56f8833feb7)
- `data/dual-rating-data.json`
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### 🚨 BACKUP: Ежедневная рефлексия (76f581a1-960c-4e35-bc9f-9ff0ccc56ae2)
- `skills/reflection/SKILL.md`

### 🚨 BACKUP: Ежемесячный аудит (Optimizer) (3138ebbd-e0f2-4937-a761-9b048c314925)
- `data/incidents.json`

### 🚨 BACKUP: Механик (a532ac04-61cf-419e-9eca-012b5595fd00)
- `data/incidents.json`

### 🚨 BACKUP: Механик (ночь) (585d2b84-e992-47a7-ba3c-acd268165874)
- `data/incidents.json`

### 🚨 BACKUP: Утренний дайджест (Gemini) (c1c58593-accd-4cf7-a175-3603514b0275)
- `data/sent-digests.json`
- `scripts/brave-search.mjs`
- `skills/digest/SKILL.md`

### 🚨 BACKUP: Чекист (734c608b-8b03-4653-b1fc-108edf6785d2)
- `data/incidents.json`

### 🚨 BACKUP: Чекист (ночь) (e529cf2b-6d25-4323-9c0d-63b68d8b0453)
- `data/incidents.json`

### 🚨 BACKUP: Экономист (отчёт) (ccd9f2e4-9ff2-4922-932c-8f160ba3a955)
- `skills/economist/SKILL.md`

### 🚨 BACKUP: Экономист (сбор) (7b05bba1-25f3-43e6-b866-02e783c77fa2)
- `skills/economist/SKILL.md`

### 🧹 Еженедельный куратор контекста (Optimizer) (a1de1ef4-e153-4415-8704-741f812ab75a)
- `docs/protocols/context-manifest.md`
- `docs/protocols/digest-operations.md`
- `docs/protocols/skills-index.md`
- `docs/user/values-and-principles.md`

## Skills → referenced files (best-effort)

### skills/analytics
- `data/reflections-YYYY-MM.json`

### skills/chat-cleanup
- `/home/openclaw/.openclaw/skills/chat-cleanup/scripts/delete_messages.sh`
- `data/chat-cleanup-state.json`
- `skills/chat-cleanup/scripts/delete_messages.sh`

### skills/chekist
- `/home/openclaw/.openclaw/runtime/monitor-heartbeat.json`
- `data/incidents.json`
- `data/scout-discoveries.json`

### skills/digest
- `data/dual-rating-data.json`
- `data/sent-digests.json`
- `scripts/brave-search.mjs`

### skills/economist
- `data/cost-summary.json`
- `data/cron-jobs-snapshot.json`
- `data/economist-log.json`
- `data/incidents.json`
- `data/infra-subscriptions.json`
- `data/infra-warnings-pending.json`
- `data/model-pricing.json`

### skills/git-sync
- `data/cron-jobs-snapshot.json`
- `data/cron-jobs.json`

### skills/marta
- `skills/marta/data/aiganym-dialogue-summary.md`

### skills/mekhanik
- `/home/openclaw/.openclaw/runtime/incidents-reset.json`
- `/home/openclaw/.openclaw/runtime/monitor-heartbeat.json`
- `data/incidents.json`
- `data/scout-discoveries.json`

### skills/scout
- `data/dual-rating-data.json`
- `data/scout-discoveries.json`
- `data/source-status-tracking.json`
- `scripts/brave-search.mjs`

### skills/smart-digest
- `data/dual-rating-data.json`
- `data/sent-digests.json`

### skills/tubescribe
- `skills/tubescribe/scripts/setup.py`
- `skills/tubescribe/scripts/tubescribe.py`

### skills/uchastkovy
- `/home/openclaw/.openclaw/runtime/monitor-heartbeat.json`
- `data/cron-jobs-snapshot.json`
- `data/cron-jobs.json`
- `data/incidents.json`
- `data/scout-discoveries.json`

### skills/wendy
- `data/incidents.json`
- `data/reflections-YYYY-MM.json`
- `data/reflections-stats.json`
- `skills/wendy/WENDY.md`
