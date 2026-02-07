# 🔗 Настройка Telegram Webhook для Dual Rating системы

## 🎯 Что это дает

После настройки webhook, система автоматически будет:
- ✅ Отслеживать реакции в канале @newsneiron
- 🎯 Обновлять рейтинги источников и экспертов в реальном времени
- 📊 Адаптировать следующие дайджесты под ваши предпочтения
- 🧠 Сохранять статистику реакций в память агента

## 🚀 Быстрая настройка

### 1. Подключение к OpenClaw агенту

```javascript
// В основном файле агента
const { createWebhookMiddleware } = require('./telegram-webhook-handler.js');

// Настраиваем Express.js эндпоинт
app.post('/webhook/telegram', createWebhookMiddleware({
    message: message,
    web_search: web_search,
    memory_store: memory_store,
    memory_recall: memory_recall
}));
```

### 2. Настройка webhook в Telegram

```javascript
const { setupTelegramWebhook } = require('./telegram-webhook-handler.js');

// Один раз настроить webhook
await setupTelegramWebhook(
    'YOUR_BOT_TOKEN',
    'https://yourdomain.com/webhook/telegram'
);
```

### 3. Проверка настроек

```javascript
const { checkWebhookInfo } = require('./telegram-webhook-handler.js');

// Проверить текущие настройки
await checkWebhookInfo('YOUR_BOT_TOKEN');
```

## 📋 Подробная настройка

### Шаг 1: Получить токен бота

1. Найти бота @BotFather в Telegram
2. Отправить `/mybots`
3. Выбрать своего бота
4. `API Token` → скопировать токен

### Шаг 2: Настроить домен и SSL

Webhook требует HTTPS домен:

```bash
# Для production
https://yourdomain.com/webhook/telegram

# Для разработки можно использовать ngrok
npx ngrok http 3000
# Получите URL вида: https://abc123.ngrok.io
# Webhook URL: https://abc123.ngrok.io/webhook/telegram
```

### Шаг 3: Добавить в OpenClaw агента

```javascript
// В начале файла агента
const express = require('express');
const { createWebhookMiddleware } = require('./telegram-webhook-handler.js');

// Создать Express app если его нет
const app = express();
app.use(express.json());

// Добавить webhook эндпоинт
const tools = {
    message: message,
    web_search: web_search,
    memory_store: memory_store,
    memory_recall: memory_recall
};

app.post('/webhook/telegram', createWebhookMiddleware(tools));

// Запустить сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Webhook сервер запущен на порту ${PORT}`);
});
```

### Шаг 4: Настроить webhook

```javascript
// Скрипт настройки (запустить один раз)
const { setupTelegramWebhook, checkWebhookInfo } = require('./telegram-webhook-handler.js');

async function setupWebhook() {
    const BOT_TOKEN = 'YOUR_BOT_TOKEN';
    const WEBHOOK_URL = 'https://yourdomain.com/webhook/telegram';
    
    try {
        // Настроить webhook
        await setupTelegramWebhook(BOT_TOKEN, WEBHOOK_URL);
        
        // Проверить настройки
        await checkWebhookInfo(BOT_TOKEN);
        
        console.log('✅ Webhook настроен успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка настройки:', error);
    }
}

setupWebhook();
```

## 🔧 Альтернативные способы интеграции

### Вариант 1: Express.js middleware (рекомендуемый)

```javascript
const express = require('express');
const { createWebhookMiddleware } = require('./telegram-webhook-handler.js');

const app = express();
app.use(express.json());

app.post('/webhook/telegram', createWebhookMiddleware(tools));
app.listen(3000);
```

### Вариант 2: Прямая функция

```javascript
const { handleTelegramWebhook } = require('./telegram-webhook-handler.js');

// В вашем HTTP обработчике
async function handleWebhookRequest(req, res) {
    const update = req.body;
    const tools = { message, web_search, memory_store, memory_recall };
    
    const result = await handleTelegramWebhook(update, tools);
    
    res.json({ ok: true, result: result });
}
```

### Вариант 3: Интеграция в существующий webhook

```javascript
// Если у вас уже есть webhook обработчик
const { TelegramWebhookHandler } = require('./telegram-webhook-handler.js');

class YourExistingWebhookHandler {
    constructor() {
        this.dualRatingHandler = new TelegramWebhookHandler(tools);
    }
    
    async handleUpdate(update) {
        // Ваша существующая логика
        // ...
        
        // Добавить обработку реакций
        await this.dualRatingHandler.handleWebhookUpdate(update);
    }
}
```

## 🧪 Тестирование

### Проверка webhook

```bash
# Отправить тестовое обновление
curl -X POST https://yourdomain.com/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123,
    "message_reaction": {
      "chat": {"id": -1003723471488, "username": "newsneiron"},
      "user": {"id": 685668909},
      "message_id": 999,
      "new_reaction": [{"emoji": "🔥"}]
    }
  }'
```

### Ручное тестирование

1. Отправить новость в @newsneiron
2. Поставить реакцию 🔥 от пользователя 685668909
3. Проверить логи webhook обработчика
4. Проверить что рейтинг источника обновился

## 📊 Мониторинг

### Логи для отслеживания

```javascript
// Включить подробное логирование
console.log('🔍 Webhook Debug Mode enabled');

// Проверить статистику обработчика
const handler = new TelegramWebhookHandler(tools);
console.log('📊 Handler Stats:', handler.getStats());
```

### Что отслеживать

- ✅ Входящие webhook обновления
- 🎯 Обработанные реакции от целевого пользователя
- 📊 Обновления рейтингов источников/экспертов
- ❌ Ошибки обработки

## 🔒 Безопасность

### Рекомендации

```javascript
// Добавить проверку секретного токена (опционально)
app.post('/webhook/telegram', (req, res, next) => {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}, createWebhookMiddleware(tools));
```

### Настройка секретного токена

```javascript
await setupTelegramWebhook(BOT_TOKEN, WEBHOOK_URL, {
    secret_token: 'your-secret-string'
});
```

## 📱 Поддерживаемые реакции

| Эмодзи | Баллы | Статус источника/эксперта |
|--------|-------|---------------------------|
| 🔥 | +10 | Отличный контент |
| 👍 | +5 | Хороший контент |
| 👎 | -3 | Плохой контент |
| 💩 | -5 | Очень плохой контент |

## 🎯 Фильтрация

Система обрабатывает только:
- ✅ Реакции от пользователя ID: **685668909**
- ✅ Реакции в канале: **@newsneiron**
- ✅ Валидные реакции: **🔥👍👎💩**

Все остальные реакции игнорируются.

## 🔄 Результат работы

После настройки webhook:

1. 📱 **Реагируете** на новости в @newsneiron эмодзи
2. 🤖 **Webhook автоматически** обрабатывает реакцию  
3. 📊 **Рейтинг источника/эксперта** обновляется в реальном времени
4. 🎯 **Следующие дайджесты** учитывают ваши предпочтения
5. 🧠 **Система запоминает** ваши реакции для аналитики

---

## ✅ Чек-лист настройки

- [ ] Получен токен бота от @BotFather
- [ ] Настроен HTTPS домен или ngrok
- [ ] Добавлен webhook эндпоинт в код агента
- [ ] Настроен webhook через `setupTelegramWebhook()`
- [ ] Проверены настройки через `checkWebhookInfo()`
- [ ] Протестированы реакции в @newsneiron
- [ ] Проверены логи обработки
- [ ] Подтверждено обновление рейтингов

**После выполнения всех пунктов система Dual Rating будет работать автоматически!** 🚀