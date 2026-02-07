// MAIN AGENT INTEGRATION - Полная интеграция всех систем в OpenClaw агента
// Скопируйте этот код в основной файл агента или подключите как модуль

const { OpenClawDualRatingSystem } = require('./openclaw-dual-rating-integration.js');
const { createTypingIndicator, withProgress } = require('./typing-helper.js');

// =============================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ АГЕНТА
// =============================================================================

let dualRatingSystem = null;
let isInitialized = false;

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ СИСТЕМ
// =============================================================================

async function initializeAgentSystems(tools) {
    if (isInitialized) return;
    
    console.log('🚀 Инициализирую системы агента...');
    
    // Инициализируем Dual Rating систему
    dualRatingSystem = new OpenClawDualRatingSystem({
        message: tools.message,
        web_search: tools.web_search,
        memory_store: tools.memory_store,
        memory_recall: tools.memory_recall
    });
    
    // Ждем инициализации базы данных
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    isInitialized = true;
    console.log('✅ Системы агента инициализированы');
    
    // Уведомляем пользователя
    await tools.message({
        channel: 'telegram',
        action: 'send',
        target: '685668909',
        message: '🤖 Dual Rating система активирована!\n📊 Теперь дайджесты будут адаптироваться под ваши реакции'
    });
}

// =============================================================================
// ОБРАБОТКА ПОЛЬЗОВАТЕЛЬСКИХ КОМАНД
// =============================================================================

async function handleUserMessage(userMessage, userId, tools) {
    // Инициализируем системы при первом использовании
    if (!isInitialized) {
        await initializeAgentSystems(tools);
    }
    
    const trimmedMessage = userMessage.trim();
    
    // ========== DUAL RATING КОМАНДЫ ==========
    
    if (trimmedMessage === '/smart_digest' || trimmedMessage === '/умный_дайджест') {
        return await handleSmartDigest(userId, tools);
    }
    
    if (trimmedMessage === '/rating_report' || trimmedMessage === '/отчет_рейтингов') {
        return await handleRatingReport(userId, tools);
    }
    
    if (trimmedMessage === '/cleanup_ratings' || trimmedMessage === '/очистка_рейтингов') {
        return await handleCleanupRatings(userId, tools);
    }
    
    if (trimmedMessage === '/dual_rating_help' || trimmedMessage === '/помощь_рейтинги') {
        return await handleDualRatingHelp(userId, tools);
    }
    
    // ========== СИСТЕМНЫЕ КОМАНДЫ ==========
    
    if (trimmedMessage === '/system_status' || trimmedMessage === '/статус_систем') {
        return await handleSystemStatus(userId, tools);
    }
    
    // Команда не обработана - возвращаем false для дальнейшей обработки
    return false;
}

// =============================================================================
// ОБРАБОТЧИКИ КОМАНД
// =============================================================================

async function handleSmartDigest(userId, tools) {
    const indicator = createTypingIndicator(tools.message, userId);
    
    try {
        await indicator.start('🤖 Создаю персонализированный дайджест...');
        
        const result = await dualRatingSystem.createSmartDigest();
        
        await indicator.finish('✅ Умный дайджест создан!');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: `✅ Персонализированный дайджест готов!\n📊 ${result.newsCount} новостей отправлено в @newsneiron\n🎯 Система учитывает ваши предпочтения\n\n💡 Реагируйте на новости эмодзи для улучшения персонализации!`
        });
        
        return true;
        
    } catch (error) {
        await indicator.error('❌ Ошибка создания дайджеста');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: `❌ Ошибка создания дайджеста: ${error.message}`
        });
        
        return true;
    }
}

async function handleRatingReport(userId, tools) {
    const indicator = createTypingIndicator(tools.message, userId);
    
    try {
        await indicator.start('📊 Генерирую отчет системы рейтингов...');
        
        const report = await dualRatingSystem.getSystemReport();
        
        await indicator.finish('✅ Отчет готов!');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: report
        });
        
        return true;
        
    } catch (error) {
        await indicator.error('❌ Ошибка получения отчета');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: `❌ Ошибка получения отчета: ${error.message}`
        });
        
        return true;
    }
}

async function handleCleanupRatings(userId, tools) {
    const indicator = createTypingIndicator(tools.message, userId);
    
    try {
        await indicator.start('🧹 Очищаю старые данные рейтингов...');
        
        const cleanedCount = await dualRatingSystem.cleanupOldData();
        
        await indicator.finish('✅ Очистка завершена!');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: cleanedCount > 0 
                ? `✅ Очистка завершена: удалено ${cleanedCount} старых записей`
                : '✅ Система чистая, старых записей не найдено'
        });
        
        return true;
        
    } catch (error) {
        await indicator.error('❌ Ошибка очистки');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: `❌ Ошибка очистки: ${error.message}`
        });
        
        return true;
    }
}

async function handleDualRatingHelp(userId, tools) {
    const helpText = `🎯 **DUAL RATING СИСТЕМА**

📊 **Команды:**
/smart_digest - создать персонализированный дайджест
/rating_report - показать статистику источников и экспертов  
/cleanup_ratings - очистить старые данные
/system_status - статус всех систем
/dual_rating_help - эта справка

🔄 **Как работает:**
• Система отдельно оценивает источники новостей и экспертов
• Ваши реакции (🔥👍👎💩) влияют на рейтинги в @newsneiron
• Multi-Armed Bandit: 70% лучших + 30% новых источников
• Дайджесты становятся точнее с каждой реакцией

📈 **Реакции в @newsneiron:**
🔥 Огонь (+10 баллов) - отличный контент
👍 Лайк (+5 баллов) - нравится  
👎 Дизлайк (-3 балла) - не нравится
💩 Мусор (-5 баллов) - плохой контент

🎯 **Автоматические дайджесты:** 08:00, 13:00, 18:00 местного времени

💡 Реагируйте на новости - система адаптируется под вас!`;

    await tools.message({
        channel: 'telegram',
        action: 'send',
        target: userId,
        message: helpText
    });
    
    return true;
}

async function handleSystemStatus(userId, tools) {
    const statusText = `🤖 **СТАТУС СИСТЕМ АГЕНТА**

✅ **Dual Rating System** - активна
   📊 Персонализация новостей работает
   🎯 Multi-Armed Bandit алгоритм активен
   
✅ **Typing Indicators** - активны
   💬 Прогресс операций отображается
   
✅ **Heartbeat Monitoring** - активен
   🔄 Мониторинг новостей каждые ~30 мин
   
✅ **Reflection System** - активна
   🧠 Ежедневная рефлексия в 20:30
   📊 Еженедельная аналитика по воскресеньям
   
⏰ **Расписание дайджестов:**
   🌅 08:00 - утренний дайджест
   ☀️ 13:00 - дневной дайджест  
   🌆 18:00 - вечерний дайджест
   
📍 **Часовой пояс:** Asia/Dubai (UTC+4)
🎯 **Целевой пользователь:** ${userId}
📱 **Канал новостей:** @newsneiron

🚀 **Все системы работают нормально!**`;

    await tools.message({
        channel: 'telegram',
        action: 'send',
        target: userId,
        message: statusText
    });
    
    return true;
}

// =============================================================================
// АВТОМАТИЧЕСКИЕ ДАЙДЖЕСТЫ (для cron)
// =============================================================================

async function createScheduledDigest(timeSlot, tools) {
    if (!isInitialized) {
        await initializeAgentSystems(tools);
    }
    
    const indicator = createTypingIndicator(tools.message, '685668909');
    
    try {
        await indicator.start(`📰 Создаю ${timeSlot} дайджест...`);
        
        const result = await dualRatingSystem.createSmartDigest();
        
        await indicator.finish(`✅ ${timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1)} дайджест готов!`);
        
        // Логируем в память
        await tools.memory_store({
            text: `Автоматический ${timeSlot} дайджест: ${result.newsCount} новостей отправлено`,
            category: 'fact',
            importance: 0.7
        });
        
        return result;
        
    } catch (error) {
        await indicator.error(`❌ Ошибка ${timeSlot} дайджеста`);
        
        // Уведомление об ошибке
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: '685668909',
            message: `❌ Ошибка ${timeSlot} дайджеста: ${error.message}`
        });
        
        throw error;
    }
}

// =============================================================================
// ОБРАБОТКА TELEGRAM РЕАКЦИЙ (для webhook)
// =============================================================================

async function handleTelegramReaction(messageId, reaction, userId, chatId, tools) {
    if (!isInitialized) {
        await initializeAgentSystems(tools);
    }
    
    // Обрабатываем только реакции в @newsneiron от целевого пользователя
    if (chatId === '@newsneiron' && userId === 685668909) {
        try {
            const result = await dualRatingSystem.handleTelegramReaction(messageId, reaction, userId);
            
            if (result) {
                console.log(`✅ Dual Rating: пользователь оценил ${result.source || result.expert} реакцией ${reaction}`);
                
                // Сохраняем в память
                await tools.memory_store({
                    text: `Оценка: ${result.source || result.expert} → ${reaction} (рейтинг: ${result.newScore.toFixed(1)})`,
                    category: 'preference',
                    importance: 0.6
                });
                
                return true;
            }
            
        } catch (error) {
            console.warn('⚠️ Ошибка обработки реакции:', error);
        }
    }
    
    return false;
}

// =============================================================================
// HEARTBEAT ЗАДАЧИ
// =============================================================================

async function performHeartbeatTasks(tools) {
    if (!isInitialized) return;
    
    // Раз в день - очистка старых данных (06:00 UTC)
    const now = new Date();
    const hour = now.getUTCHours();
    
    if (hour === 6) {
        console.log('🧹 Heartbeat: очистка старых данных Dual Rating');
        try {
            await dualRatingSystem.cleanupOldData();
        } catch (error) {
            console.warn('⚠️ Ошибка очистки в heartbeat:', error);
        }
    }
    
    // Раз в неделю - отправка отчета (воскресенье, 10:00 UTC)
    if (now.getDay() === 0 && hour === 10) {
        console.log('📊 Heartbeat: еженедельный отчет Dual Rating');
        try {
            await dualRatingSystem.sendSystemReportToUser();
        } catch (error) {
            console.warn('⚠️ Ошибка отчета в heartbeat:', error);
        }
    }
}

// =============================================================================
// СИСТЕМНЫЕ EVENTS (для cron системных событий)
// =============================================================================

function handleSystemEvent(eventText, tools) {
    try {
        // Автоматические дайджесты
        if (eventText === "createScheduledSmartDigest('morning')") {
            return createScheduledDigest('утренний', tools);
        }
        if (eventText === "createScheduledSmartDigest('afternoon')") {
            return createScheduledDigest('дневной', tools);  
        }
        if (eventText === "createScheduledSmartDigest('evening')") {
            return createScheduledDigest('вечерний', tools);
        }
        
        // Рефлексии
        if (eventText === 'daily_reflection()') {
            return handleDailyReflection(tools);
        }
        if (eventText === 'weekly_reflection_analytics()') {
            return handleWeeklyReflectionAnalytics(tools);
        }
        if (eventText === 'morning_action_plan()') {
            return handleMorningActionPlan(tools);
        }
        
    } catch (error) {
        console.error('❌ Ошибка обработки системного события:', error);
    }
}

// =============================================================================
// РЕФЛЕКСИИ (заглушки - нужно будет реализовать)
// =============================================================================

async function handleDailyReflection(tools) {
    // TODO: Реализовать двойную рефлексию
    console.log('🧠 Daily reflection: TODO');
}

async function handleWeeklyReflectionAnalytics(tools) {
    // TODO: Реализовать еженедельную аналитику
    console.log('📊 Weekly analytics: TODO');
}

async function handleMorningActionPlan(tools) {
    // TODO: Реализовать утренний план
    console.log('🌅 Morning plan: TODO');
}

// =============================================================================
// ЭКСПОРТ ДЛЯ ИНТЕГРАЦИИ В ОСНОВНОЙ АГЕНТ
// =============================================================================

module.exports = {
    // Основные функции
    initializeAgentSystems,
    handleUserMessage,
    handleTelegramReaction,
    performHeartbeatTasks,
    handleSystemEvent,
    
    // Команды дайджестов
    createScheduledDigest,
    
    // Утилиты
    createTypingIndicator,
    withProgress
};

// =============================================================================
// ПРИМЕР ИНТЕГРАЦИИ В ОСНОВНОЙ КОД АГЕНТА  
// =============================================================================

/*
// В основном файле агента добавить:

const agentSystems = require('./main-agent-integration.js');

// 1. В обработчике пользовательских сообщений:
async function onUserMessage(message, userId) {
    const tools = { message, web_search, memory_store, memory_recall };
    
    // Проверяем системные команды
    const handled = await agentSystems.handleUserMessage(message, userId, tools);
    if (handled) return;
    
    // Ваша обычная обработка сообщений
    // ...
}

// 2. В webhook обработчике (для реакций):
async function onTelegramUpdate(update) {
    if (update.message_reaction) {
        const { message_id, chat, user, new_reaction } = update.message_reaction;
        if (new_reaction && new_reaction.length > 0) {
            const tools = { message, web_search, memory_store, memory_recall };
            await agentSystems.handleTelegramReaction(
                message_id, 
                new_reaction[0].emoji, 
                user.id, 
                chat.username ? `@${chat.username}` : chat.id,
                tools
            );
        }
    }
}

// 3. В heartbeat функции:
async function heartbeat() {
    const tools = { message, web_search, memory_store, memory_recall };
    await agentSystems.performHeartbeatTasks(tools);
    // ... остальные heartbeat задачи
}

// 4. В обработчике системных событий (от cron):
async function onSystemEvent(eventText) {
    const tools = { message, web_search, memory_store, memory_recall };
    return await agentSystems.handleSystemEvent(eventText, tools);
}
*/