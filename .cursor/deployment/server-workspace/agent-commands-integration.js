// Интеграция Dual Rating команд в OpenClaw агента
// Скопируйте этот код в основной файл агента

const { OpenClawDualRatingSystem } = require('./openclaw-dual-rating-integration.js');

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ (добавить в начало агента)
// =============================================================================

let dualRatingSystem = null;

// Инициализируем систему при первом использовании
function initializeDualRating() {
    if (!dualRatingSystem) {
        dualRatingSystem = new OpenClawDualRatingSystem({
            message: message,
            web_search: web_search,
            memory_store: memory_store,
            memory_recall: memory_recall
        });
        console.log('✅ Dual Rating система инициализирована');
    }
    return dualRatingSystem;
}

// =============================================================================
// КОМАНДЫ ПОЛЬЗОВАТЕЛЯ (добавить в обработчик команд)
// =============================================================================

async function handleUserCommand(userMessage, userId) {
    // Команда создания умного дайджеста
    if (userMessage === '/smart_digest' || userMessage === '/умный_дайджест') {
        try {
            const system = initializeDualRating();
            
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: '🤖 Запускаю создание персонализированного дайджеста...'
            });
            
            const result = await system.createSmartDigest();
            
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: `✅ Умный дайджест создан!\n📊 ${result.newsCount} персонализированных новостей отправлено в @newsneiron\n🎯 Система учитывает ваши предпочтения`
            });
            
            return true; // Команда обработана
            
        } catch (error) {
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: `❌ Ошибка создания дайджеста: ${error.message}`
            });
            return true;
        }
    }
    
    // Команда отчета системы
    if (userMessage === '/rating_report' || userMessage === '/отчет_рейтингов') {
        try {
            const system = initializeDualRating();
            await system.sendSystemReportToUser();
            return true; // Команда обработана
            
        } catch (error) {
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: `❌ Ошибка получения отчета: ${error.message}`
            });
            return true;
        }
    }
    
    // Команда очистки старых данных
    if (userMessage === '/cleanup_ratings' || userMessage === '/очистка_рейтингов') {
        try {
            const system = initializeDualRating();
            
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: '🧹 Очищаю старые данные системы рейтингов...'
            });
            
            const cleanedCount = await system.cleanupOldData();
            
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: cleanedCount > 0 
                    ? `✅ Очистка завершена: удалено ${cleanedCount} старых записей`
                    : '✅ Система чистая, старых записей не найдено'
            });
            
            return true; // Команда обработана
            
        } catch (error) {
            await message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: `❌ Ошибка очистки: ${error.message}`
            });
            return true;
        }
    }
    
    // Команда помощи по системе рейтингов
    if (userMessage === '/dual_rating_help' || userMessage === '/помощь_рейтинги') {
        const helpText = `🎯 **DUAL RATING СИСТЕМА**

📊 **Команды:**
/smart_digest - создать персонализированный дайджест
/rating_report - показать статистику источников и экспертов
/cleanup_ratings - очистить старые данные
/dual_rating_help - эта справка

🔄 **Как работает:**
• Система отдельно оценивает источники новостей и экспертов
• Ваши реакции (🔥👍👎💩) влияют на рейтинги
• Multi-Armed Bandit: 70% лучших + 30% новых источников
• Дайджесты становятся точнее с каждой реакцией

📈 **Реакции:**
🔥 Огонь (+10 баллов) - отличный контент
👍 Лайк (+5 баллов) - нравится
👎 Дизлайк (-3 балла) - не нравится  
💩 Мусор (-5 баллов) - плохой контент

💡 Реагируйте на новости в @newsneiron - система адаптируется под вас!`;

        await message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: helpText
        });
        
        return true; // Команда обработана
    }
    
    return false; // Команда не обработана этой системой
}

// =============================================================================
// ИНТЕГРАЦИЯ В HEARTBEAT (добавить в HEARTBEAT.md или heartbeat функцию)
// =============================================================================

async function dualRatingHeartbeatTasks() {
    try {
        const system = initializeDualRating();
        
        // Раз в день - очистка старых данных
        const now = new Date();
        const hour = now.getUTCHours();
        
        if (hour === 6) { // 06:00 UTC = утром по многим часовым поясам
            console.log('🧹 Heartbeat: очистка старых данных Dual Rating');
            await system.cleanupOldData();
        }
        
        // Раз в неделю - отправка отчета
        if (now.getDay() === 0 && hour === 10) { // Воскресенье, 10:00 UTC
            console.log('📊 Heartbeat: еженедельный отчет Dual Rating');
            await system.sendSystemReportToUser();
        }
        
    } catch (error) {
        console.warn('⚠️ Ошибка в Dual Rating heartbeat задачах:', error);
    }
}

// =============================================================================
// ОБРАБОТКА TELEGRAM РЕАКЦИЙ (добавить в webhook или polling)
// =============================================================================

async function handleTelegramUpdate(update) {
    try {
        // Обработка реакций на сообщения
        if (update.message_reaction) {
            const { message_id, chat, user, new_reaction } = update.message_reaction;
            
            // Обрабатываем только реакции в канале @newsneiron от целевого пользователя
            if (chat.username === 'newsneiron' && user.id === 685668909) {
                if (new_reaction && new_reaction.length > 0) {
                    const reaction = new_reaction[0].emoji;
                    
                    const system = initializeDualRating();
                    const result = await system.handleTelegramReaction(message_id, reaction, user.id);
                    
                    if (result) {
                        console.log(`✅ Dual Rating: пользователь оценил ${result.source || result.expert} реакцией ${reaction}`);
                        
                        // Опционально: отправить подтверждение в личку
                        /*
                        await message({
                            channel: 'telegram',
                            action: 'send', 
                            target: user.id.toString(),
                            message: `✅ Оценка учтена: ${result.source || result.expert} → ${result.newScore.toFixed(1)}⭐`
                        });
                        */
                    }
                }
            }
        }
        
    } catch (error) {
        console.warn('⚠️ Ошибка обработки Telegram реакции:', error);
    }
}

// =============================================================================
// АВТОМАТИЧЕСКИЕ ДАЙДЖЕСТЫ (интеграция с cron)
// =============================================================================

async function createScheduledSmartDigest(timeSlot = 'morning') {
    try {
        const system = initializeDualRating();
        
        console.log(`📰 Создаю автоматический умный дайджест (${timeSlot})`);
        
        const result = await system.createSmartDigest();
        
        // Логируем результат
        await memory_store({
            text: `Автоматический умный дайджест (${timeSlot}): ${result.newsCount} новостей, категории: ${Object.entries(result.categories).map(([k,v]) => `${k}:${v}`).join(', ')}`,
            category: 'fact',
            importance: 0.7
        });
        
        console.log(`✅ Автоматический дайджест создан: ${result.newsCount} новостей`);
        
        return result;
        
    } catch (error) {
        console.error(`❌ Ошибка автоматического дайджеста (${timeSlot}):`, error);
        
        // Уведомление об ошибке
        await message({
            channel: 'telegram',
            action: 'send',
            target: '685668909',
            message: `❌ Ошибка автоматического дайджеста (${timeSlot}): ${error.message}`
        });
        
        throw error;
    }
}

// =============================================================================
// ПРИМЕР ПОЛНОЙ ИНТЕГРАЦИИ В ОСНОВНОЙ АГЕНТ
// =============================================================================

/*
// ОСНОВНОЙ КОД АГЕНТА С DUAL RATING ИНТЕГРАЦИЕЙ:

// 1. В начале файла (после импортов):
const { handleUserCommand, initializeDualRating, dualRatingHeartbeatTasks } = require('./agent-commands-integration.js');

// 2. В обработчике пользовательских сообщений:
async function processUserMessage(userMessage, userId) {
    // Сначала проверяем команды Dual Rating
    const handledByDualRating = await handleUserCommand(userMessage, userId);
    if (handledByDualRating) {
        return; // Команда обработана, выходим
    }
    
    // Далее обычная обработка сообщений агента
    if (userMessage === '/help') {
        // ... обычная справка агента
    }
    
    // ... остальные команды агента
}

// 3. В heartbeat функции:
async function heartbeatCheck() {
    // Обычные heartbeat задачи
    // ...
    
    // Добавляем задачи Dual Rating
    await dualRatingHeartbeatTasks();
    
    return 'HEARTBEAT_OK';
}

// 4. В webhook/polling обработчике:
async function handleWebhook(update) {
    // Обработка Dual Rating реакций
    await handleTelegramUpdate(update);
    
    // Обычная обработка webhook
    // ...
}

// 5. В cron задачах для автоматических дайджестов:
// Утренний дайджест: 08:00 местного времени
{
    "schedule": { "kind": "cron", "expr": "0 8 * * *", "tz": "Asia/Dubai" },
    "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest('morning')" }
}

// Дневной дайджест: 13:00 местного времени  
{
    "schedule": { "kind": "cron", "expr": "0 13 * * *", "tz": "Asia/Dubai" },
    "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest('afternoon')" }
}

// Вечерний дайджест: 18:00 местного времени
{
    "schedule": { "kind": "cron", "expr": "0 18 * * *", "tz": "Asia/Dubai" },
    "payload": { "kind": "systemEvent", "text": "createScheduledSmartDigest('evening')" }
}
*/

module.exports = {
    handleUserCommand,
    initializeDualRating,
    dualRatingHeartbeatTasks,
    handleTelegramUpdate,
    createScheduledSmartDigest
};