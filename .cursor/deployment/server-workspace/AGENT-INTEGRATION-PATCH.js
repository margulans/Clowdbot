// ПАТЧ ДЛЯ ОСНОВНОГО АГЕНТА - добавить этот код в основной файл агента
// Скопируйте и вставьте эти секции в соответствующие места

// =============================================================================
// 1. В НАЧАЛО ФАЙЛА (после импортов)
// =============================================================================

const agentSystems = require('./main-agent-integration.js');
let systemsInitialized = false;

// =============================================================================
// 2. В ФУНКЦИЮ ОБРАБОТКИ ПОЛЬЗОВАТЕЛЬСКИХ СООБЩЕНИЙ
// =============================================================================

// В функции processUserMessage или аналогичной:
async function processUserMessage(userMessage, userId) {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Инициализируем системы при первом использовании  
    if (!systemsInitialized) {
        await agentSystems.initializeAgentSystems(tools);
        systemsInitialized = true;
    }
    
    // Проверяем команды систем
    const handled = await agentSystems.handleUserMessage(userMessage, userId, tools);
    if (handled) return;
    
    // ВАШ ОБЫЧНЫЙ КОД ОБРАБОТКИ СООБЩЕНИЙ...
    if (userMessage === '/help') {
        // ... остальные команды
    }
}

// =============================================================================
// 3. В ФУНКЦИЮ HEARTBEAT
// =============================================================================

// В функции heartbeat:
async function heartbeat() {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Задачи систем
    if (systemsInitialized) {
        await agentSystems.performHeartbeatTasks(tools);
    }
    
    // ВАШ ОБЫЧНЫЙ HEARTBEAT КОД...
    
    return 'HEARTBEAT_OK';
}

// =============================================================================
// 4. ОБРАБОТКА СИСТЕМНЫХ СОБЫТИЙ (для cron)
// =============================================================================

// Добавить или модифицировать функцию:
async function handleSystemEvent(eventText) {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Проверяем события систем
    const result = await agentSystems.handleSystemEvent(eventText, tools);
    if (result) return result;
    
    // ВАШ ОБЫЧНЫЙ КОД ОБРАБОТКИ СОБЫТИЙ...
}

// =============================================================================
// 5. WEBHOOK ДЛЯ TELEGRAM РЕАКЦИЙ (если используете webhook)
// =============================================================================

const { createWebhookMiddleware } = require('./telegram-webhook-handler.js');

// Для Express.js:
app.post('/webhook/telegram', createWebhookMiddleware({
    message, web_search, memory_store, memory_recall
}));

// Или если у вас уже есть webhook обработчик:
async function handleTelegramUpdate(update) {
    if (update.message_reaction) {
        const tools = { message, web_search, memory_store, memory_recall };
        await agentSystems.handleTelegramReaction(
            update.message_reaction.message_id.toString(),
            update.message_reaction.new_reaction?.[0]?.emoji,
            update.message_reaction.user.id,
            update.message_reaction.chat.username ? 
                `@${update.message_reaction.chat.username}` : 
                update.message_reaction.chat.id.toString(),
            tools
        );
    }
}

// =============================================================================
// ГОТОВО! Теперь доступные команды:
// /smart_digest - персонализированный дайджест
// /rating_report - статистика источников и экспертов
// /system_status - статус всех систем
// /cleanup_ratings - очистка старых данных
// /dual_rating_help - справка по системе
// =============================================================================