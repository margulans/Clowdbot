# 💬 Typing Indicators для OpenClaw

## 🎯 Описание

Система автоматических индикаторов прогресса для OpenClaw. Показывает пользователю статус долгих операций через **typing indicator + статус-эмодзи** в Telegram.

## ✨ Возможности

- ⌨️ **Typing indicator** - показывает что бот печатает
- 🔄 **Статус-сообщения** с эмодзи прогресса  
- 📝 **Динамические обновления** статуса в реальном времени
- ❌ **Обработка ошибок** с понятными сообщениями
- 🧹 **Автоочистка** завершенных индикаторов
- 🔄 **Параллельные операции** без конфликтов

## 🚀 Быстрый старт

### Простейший способ

```javascript
const { createTypingIndicator } = require('./typing-helper.js');

// В любой функции OpenClaw агента:
async function searchNews() {
    const indicator = createTypingIndicator(message, '685668909');
    
    await indicator.start('🔍 Ищу новости...');
    
    // Ваша работа здесь
    const results = await web_search({ query: 'AI news', count: 5 });
    
    await indicator.update('📊 Обрабатываю результаты...');
    
    // Еще работа
    const filtered = results.filter(r => r.relevance > 0.8);
    
    await indicator.finish(`✅ Найдено ${filtered.length} новостей`);
    
    return filtered;
}
```

### Автоматическая обертка

```javascript
const { withProgress } = require('./typing-helper.js');

const results = await withProgress(
    message, 
    '685668909', 
    'news-search',
    async (indicator) => {
        await indicator.update('🔍 Подключаюсь к источникам...');
        const rawNews = await fetchNews();
        
        await indicator.update('🤖 Применяю Multi-Armed Bandit...');
        const selected = await banditFilter(rawNews);
        
        return selected;
    },
    {
        startMessage: '🚀 Запускаю поиск...',
        successMessage: '✅ Поиск завершен!',
        autoDelete: true
    }
);
```

## 📁 Структура файлов

```
typing-indicators.js           # 🏗️ Основная система (класс TypingIndicatorManager)
typing-helper.js              # 🔧 Простые хелперы (createTypingIndicator, withProgress)  
openclaw-typing-integration.js # 🔗 Полная интеграция с OpenClaw API
test-typing-system.js         # 🧪 Тесты и примеры использования
```

## 🛠️ API

### createTypingIndicator(messageFunc, target)

Создает индикатор для отслеживания прогресса операции.

**Параметры:**
- `messageFunc` - функция `message` из OpenClaw tools
- `target` - куда отправлять (ID пользователя, канал)

**Методы:**
- `await start(text)` - начать показ прогресса
- `await update(text)` - обновить статус  
- `await finish(text, autoDelete=true)` - успешное завершение
- `await error(text)` - завершение с ошибкой

### withProgress(messageFunc, target, operationName, asyncFunction, options)

Автоматически оборачивает функцию индикаторами прогресса.

**Параметры:**
- `messageFunc` - функция message  
- `target` - получатель статусов
- `operationName` - название для логирования
- `asyncFunction` - функция для выполнения (получает indicator как параметр)
- `options` - настройки (startMessage, successMessage, errorMessage, autoDelete)

## 📋 Готовые шаблоны

```javascript
const { Templates } = require('./typing-helper.js');

// Поиск новостей
Templates.NEWS_SEARCH = {
    start: '🔍 Ищу новости...',
    analyzing: '🔄 Анализирую источники...',
    filtering: '📊 Применяю фильтры...',
    success: '✅ Новости найдены'
};

// Генерация дайджеста  
Templates.DIGEST_GENERATION = {
    start: '📰 Создаю дайджест...',
    sources: '🎯 Выбираю источники...',
    formatting: '✍️ Форматирую новости...',
    sending: '📤 Отправляю в канал...',
    success: '✅ Дайджест готов'
};

// Подключение к Mac
Templates.MAC_CONNECTION = {
    start: '🔄 Подключаюсь к Mac...',
    checking: '📡 Проверяю сеть...',
    connecting: '🤖 Запускаю node...',
    success: '✅ Mac подключен',
    error: '❌ Mac недоступен'
};
```

## 🔧 Интеграция с существующими функциями

### Heartbeat с прогрессом

```javascript
async function heartbeatCheck() {
    const indicator = createTypingIndicator(message, '685668909');
    
    await indicator.start('🔄 Проверяю новости...');
    
    await indicator.update('🔍 Сканирую источники...');
    const urgentNews = await findUrgentNews();
    
    if (urgentNews.length > 0) {
        await indicator.update('🚨 Отправляю срочные новости...');
        await sendUrgentDigest(urgentNews);
        await indicator.finish(`✅ Отправлено ${urgentNews.length} срочных новостей`);
    } else {
        await indicator.finish('✅ Новых срочных новостей нет', true, 2000);
    }
}
```

### Поиск новостей с Multi-Armed Bandit

```javascript
async function generateSmartDigest() {
    const indicator = createTypingIndicator(message, '685668909');
    
    try {
        await indicator.start('📰 Создаю умный дайджест...');
        
        await indicator.update('🔍 Сканирую 35+ источников...');
        const allNews = await fetchFromAllSources();
        
        await indicator.update('🤖 Применяю Multi-Armed Bandit...');
        const selectedSources = await banditAlgorithm.selectBest(allNews);
        
        await indicator.update('📊 Применяю приоритеты (ИИ > Робо > eVTOL)...');
        const prioritized = await applyTopicPriorities(selectedSources);
        
        await indicator.update('✍️ Форматирую новости + экспертные мнения...');
        const formatted = await formatWithExpertOpinions(prioritized);
        
        await indicator.update('📤 Отправляю в @newsneiron...');
        await sendToChannel(formatted);
        
        await indicator.finish(`✅ Дайджест готов! ${formatted.length} новостей отправлено`);
        
    } catch (error) {
        await indicator.error('❌ Ошибка создания дайджеста');
        throw error;
    }
}
```

### Проверка Mac подключения

```javascript
async function checkMacWithProgress() {
    return await withProgress(
        message,
        '685668909', 
        'mac-connection',
        async (indicator) => {
            await indicator.update('📡 Проверяю Tailscale...');
            const tailscaleStatus = await exec('tailscale status');
            
            await indicator.update('🤖 Проверяю OpenClaw node...');
            const nodeStatus = await nodes({ action: 'status' });
            
            const macNode = nodeStatus.nodes?.find(n => n.displayName === 'mac-files');
            
            if (macNode?.connected) {
                return { connected: true, ip: macNode.remoteIp };
            } else {
                throw new Error('Mac node не подключен');
            }
        },
        {
            startMessage: Templates.MAC_CONNECTION.start,
            successMessage: Templates.MAC_CONNECTION.success,
            errorMessage: Templates.MAC_CONNECTION.error
        }
    );
}
```

## 🧪 Тестирование

```bash
# Запуск полного набора тестов
node test-typing-system.js

# Результат:
# ✅ Тест 1: Базовый typing indicator 
# ✅ Тест 2: Wrapper withProgress
# ✅ Тест 3: Обработка ошибок
# ✅ Тест 4: Параллельные операции  
# ✅ Тест 5: Реальный сценарий дайджеста
```

## 📊 Пример вывода

```
📱 [10:47:03] SEND to 685668909: "🔍 Ищу новости..."
📱 [10:47:04] EDIT msg_1: "🔄 Анализирую 15 источников..."  
📱 [10:47:05] EDIT msg_1: "📊 Применяю Multi-Armed Bandit..."
📱 [10:47:06] EDIT msg_1: "✍️ Форматирую дайджест..."
📱 [10:47:07] EDIT msg_1: "✅ Дайджест готов (12 новостей)"
```

## ⚙️ Настройки

### Автоудаление статус-сообщений

```javascript
await indicator.finish('✅ Готово', true, 3000); // Удалить через 3 сек
await indicator.finish('✅ Готово', false);      // Оставить навсегда
```

### Цель по умолчанию

```javascript
// В начале сессии агента
const defaultTarget = '685668909'; // ID пользователя

// Создание индикаторов без указания target каждый раз
const indicator1 = createTypingIndicator(message, defaultTarget);
const indicator2 = createTypingIndicator(message, defaultTarget);
```

### Обработка нескольких операций

```javascript
// Операции выполняются параллельно, каждая со своим индикатором
const operations = [
    generateAINews(),
    generateRoboticsNews(), 
    generateEvtolNews()
];

await Promise.all(operations);
```

## 🔍 Отладка

### Логирование

Все действия индикаторов логируются в консоль:

```
🔄 Typing indicator started: 🔍 Ищу новости...
🔄 Typing indicator updated: 🔄 Анализирую источники...  
✅ Typing indicator finished: ✅ Готово (3.2с)
```

### Получение активных операций

```javascript
const activeOps = indicatorManager.getActiveOperations();
console.log('Активные операции:', activeOps);
```

### Очистка зависших операций

```javascript
// Автоматически очищает операции старше 5 минут
indicatorManager.cleanupStaleOperations();
```

## 🎯 Преимущества

- **UX улучшение** - пользователь всегда видит что происходит
- **Отсутствие зависаний** - ясно когда система работает  
- **Профессиональный вид** - как в настоящих мессенджерах
- **Простота использования** - 3 строки кода для базового использования
- **Гибкость** - от простых до сложных сценариев
- **Надежность** - обработка ошибок и автоочистка

## 🔮 Будущие улучшения

- **Прогресс-бары** для долгих операций с известным временем
- **Предиктивные статусы** на основе истории выполнения  
- **Групповые операции** с общим прогрессом
- **Интеграция с другими каналами** (Discord, Slack)
- **Статистика производительности** операций

---

**✅ Typing Indicators система готова к использованию!**

Никаких больше молчаливых пауз - каждая операция теперь показывает свой прогресс пользователю в реальном времени. 🎉