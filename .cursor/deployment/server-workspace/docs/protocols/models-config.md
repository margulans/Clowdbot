# Конфигурация моделей и Tier-система

## Алиасы (Aliases)

- `gemini-flash`: `google/gemini-3-flash-preview`
- `llama-free`: `openrouter/meta-llama/llama-3.3-70b-instruct:free`
- `sonnet`: `anthropic/claude-sonnet-4-6`
- `gpt`: `openai/gpt-5.2` (default)

## Tier 1 — Автоматизация

- **Модель:** `gemini-flash` (`google/gemini-3-flash-preview`).
- **Задачи:** Все isolated cron jobs — дайджесты, мнения, брифинг, мониторинг (участковый, механик, чекист), рефлексия, git sync, экономист, саммари Айганым.
- **Thinking:** low.

## Tier 2 — Интерактив и Аналитика (Default)

- **Модель:** `gpt` (GPT-5.2). **Fallback:** `sonnet` (claude-sonnet-4-6).
- **Задачи:** Личные сообщения, рефлексия, еженедельные отчеты, поддержка памяти.
- **Thinking:** high (для рефлексии и отчетов), default для остального.

## Tier 3 — Глубокая работа (Heavyweight)

- **Модель:** `anthropic/claude-opus-4-6`.
- **Триггер:** Прямая просьба «используй опус» или `/model opus`.
- **Действие:** Вернуться на sonnet/gpt после завершения конкретной задачи.
