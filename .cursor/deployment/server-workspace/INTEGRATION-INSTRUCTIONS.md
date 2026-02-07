# 🔧 Инструкция по интеграции Dual Rating в OpenClaw агента

## 🚀 Шаги интеграции

### 1. Подключение основного модуля

```javascript
// В основном файле агента
const agentSystems = require('./main-agent-integration.js');
```

### 2. Обработка пользовательских сообщений

```javascript
// В функции обработки сообщений пользователя
async function processUserMessage(userMessage, userId) {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Проверяем команды Dual Rating системы
    const handled = await agentSystems.handleUserMessage(userMessage, userId, tools);
    if (handled) return; // Команда обработана
    
    // Ваша обычная обработка сообщений агента
    if (userMessage === '/help') {
        // ... обычные команды
    }
    // ... остальная логика
}
```

### 3. Обработка Telegram реакций (webhook)

```javascript
// В обработчике Telegram webhook
async function handleTelegramUpdate(update) {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Обработка реакций для Dual Rating
    if (update.message_reaction) {
        const { message_id, chat, user, new_reaction } = update.message_reaction;
        
        if (new_reaction && new_reaction.length > 0) {
            const chatId = chat.username ? `@${chat.username}` : chat.id;
            await agentSystems.handleTelegramReaction(
                message_id, 
                new_reaction[0].emoji, 
                user.id, 
                chatId,
                tools
            );
        }
    }
    
    // Обычная обработка других обновлений
    // ...
}
```

### 4. Интеграция в heartbeat

```javascript
// В heartbeat функции
async function heartbeatCheck() {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Dual Rating heartbeat задачи
    await agentSystems.performHeartbeatTasks(tools);
    
    // Ваши обычные heartbeat задачи
    // ...
    
    return 'HEARTBEAT_OK';
}
```

### 5. Обработка системных событий (cron)

```javascript
// В обработчике системных событий
async function handleSystemEvent(eventText) {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Проверяем события Dual Rating системы
    const result = await agentSystems.handleSystemEvent(eventText, tools);
    if (result) return result;
    
    // Ваша обычная обработка системных событий
    // ...
}
```

## ⏰ Добавление cron задач

### Через OpenClaw CLI:

```bash
# Добавить все задачи из файла
openclaw cron add --file cron-jobs-dual-rating.json

# Или по одной:
openclaw cron add --job '{
  "schedule": { "kind": "cron", "expr": "0 8 * * *", "tz": "Asia/Dubai" },
  "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest(\"morning\")" },
  "sessionTarget": "main"
}'
```

### Через cron API:

```javascript
// Добавить утренний дайджест
await cron({
  action: 'add',
  job: {
    name: 'Утренний умный дайджест',
    schedule: { kind: 'cron', expr: '0 8 * * *', tz: 'Asia/Dubai' },
    payload: { kind: 'systemEvent', text: "createScheduledSmartDigest('morning')" },
    sessionTarget: 'main',
    enabled: true
  }
});
```

## 🧪 Тестирование интеграции

### 1. Проверить команды:

```
/smart_digest - должен создать персонализированный дайджест
/rating_report - должен показать статистику
/system_status - должен показать статус всех систем
```

### 2. Проверить автоматические дайджесты:

```bash
# Запустить вручную
openclaw cron run --job-id <утренний-дайджест-id>
```

### 3. Проверить реакции:

1. Отправить новость в @newsneiron
2. Поставить реакцию 🔥 от пользователя 685668909  
3. Проверить в логах: `✅ Dual Rating: пользователь оценил...`

## 📊 Доступные команды после интеграции

| Команда | Русская версия | Описание |
|---------|---------------|----------|
| `/smart_digest` | `/умный_дайджест` | Создать персонализированный дайджест |
| `/rating_report` | `/отчет_рейтингов` | Статистика источников и экспертов |
| `/cleanup_ratings` | `/очистка_рейтингов` | Очистить старые данные |
| `/system_status` | `/статус_систем` | Статус всех систем агента |
| `/dual_rating_help` | `/помощь_рейтинги` | Справка по Dual Rating |

## 🔍 Отладка

### Логи для мониторинга:

```javascript
// Включить подробные логи
console.log('🔍 Dual Rating Debug Mode enabled');

// Проверить состояние системы
const report = await dualRatingSystem.getSystemReport();
console.log('📊 System Report:', report);
```

### Частые проблемы:

1. **Команды не работают** → проверить подключение `main-agent-integration.js`
2. **Реакции не обрабатываются** → проверить webhook и фильтр по chat/user ID
3. **Дайджесты не создаются** → проверить cron задачи и системные события
4. **Данные не сохраняются** → проверить права записи в папку `data/`

## ✅ Проверочный чек-лист

- [ ] Подключен `main-agent-integration.js`
- [ ] Добавлена обработка команд в `processUserMessage`
- [ ] Настроен webhook для реакций
- [ ] Интегрированы heartbeat задачи
- [ ] Добавлены cron задачи для дайджестов
- [ ] Протестированы команды `/smart_digest`, `/rating_report`
- [ ] Проверена обработка реакций в @newsneiron
- [ ] Проверен автоматический дайджест

**После выполнения всех шагов Dual Rating система будет полностью интегрирована!** 🎉