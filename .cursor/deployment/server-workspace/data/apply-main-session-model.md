# Задача: основная сессия → gpt-5.2, fallback → claude-sonnet-4-6

Сейчас fallback главной сессии: `google/gemini-3-flash-preview`.
Нужно: fallback → `anthropic/claude-sonnet-4-6` (другой провайдер от основного GPT).

## Команда для выполнения

```bash
python3 << 'EOF'
import json
with open('/home/openclaw/.openclaw/openclaw.json', 'r') as f:
    c = json.load(f)
c['agents']['defaults']['model']['fallbacks'] = ['anthropic/claude-sonnet-4-6']
with open('/home/openclaw/.openclaw/openclaw.json', 'w') as f:
    json.dump(c, f, indent=2)
print('Done. New config:')
print('  primary:', c['agents']['defaults']['model']['primary'])
print('  fallbacks:', c['agents']['defaults']['model']['fallbacks'])
EOF

systemctl --user restart openclaw-gateway
```

## Проверка после выполнения

```bash
# Убедиться что конфиг применился
python3 -c "import json; c=json.load(open('/home/openclaw/.openclaw/openclaw.json')); print(c['agents']['defaults']['model'])"

# Gateway запущен
systemctl --user status openclaw-gateway | grep Active
```

## После выполнения

```bash
git add -A && git commit -m "ops: основная сессия gpt-5.2, fallback claude-sonnet-4-6" && git push
```

## Итоговая конфигурация

| Роль                    | Модель                          |
| ----------------------- | ------------------------------- |
| Primary (main session)  | `openai/gpt-5.2`                |
| Fallback (main session) | `anthropic/claude-sonnet-4-6`   |
| Isolated cron jobs      | `google/gemini-3-flash-preview` |
| Backup cron jobs        | `openai/gpt-4o-mini`            |

_Создан: 2026-02-23_
