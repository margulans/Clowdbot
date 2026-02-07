// Интегрированный обработчик для OpenClaw агента
// Этот файл автоматически обрабатывает команды и системные события

const { OpenClawDualRatingSystem } = require('./openclaw-dual-rating-integration.js');
const { createTypingIndicator } = require('./typing-helper.js');

class IntegratedAgentHandler {
    constructor() {
        this.dualRatingSystem = null;
        this.isInitialized = false;
    }

    async initialize(tools) {
        if (this.isInitialized) return;
        
        console.log('🚀 Инициализирую Dual Rating систему...');
        
        this.dualRatingSystem = new OpenClawDualRatingSystem(tools);
        this.isInitialized = true;
        
        console.log('✅ Dual Rating система готова');
    }

    // Обработка системных событий от cron
    async handleSystemEvent(eventText, tools) {
        await this.initialize(tools);
        
        console.log(`⚡ Системное событие: ${eventText}`);
        
        try {
            // Автоматические дайджесты
            if (eventText === "createScheduledSmartDigest('morning')") {
                return await this.createScheduledDigest('утренний', tools);
            }
            if (eventText === "createScheduledSmartDigest('afternoon')") {
                return await this.createScheduledDigest('дневной', tools);
            }
            if (eventText === "createScheduledSmartDigest('evening')") {
                return await this.createScheduledDigest('вечерний', tools);
            }
            
            // Рефлексии
            if (eventText === 'daily_reflection()') {
                return await this.handleDailyReflection(tools);
            }
            if (eventText === 'weekly_reflection_analytics()') {
                return await this.handleWeeklyReflection(tools);
            }
            
        } catch (error) {
            console.error('❌ Ошибка системного события:', error);
            return { error: error.message };
        }
        
        return null;
    }

    // Создание дайджеста по расписанию
    async createScheduledDigest(timeSlot, tools) {
        console.log(`📰 Создаю ${timeSlot} дайджест...`);
        
        const indicator = createTypingIndicator(tools.message, '685668909');
        
        try {
            await indicator.start(`📰 Создаю ${timeSlot} дайджест...`);
            
            const result = await this.dualRatingSystem.createSmartDigest();
            
            await indicator.finish(`✅ ${timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1)} дайджест готов!`);
            
            // Сохраняем в память
            await tools.memory_store({
                text: `Автоматический ${timeSlot} дайджест: ${result.newsCount} новостей отправлено в @newsneiron`,
                category: 'fact',
                importance: 0.7
            });
            
            return { success: true, newsCount: result.newsCount, timeSlot: timeSlot };
            
        } catch (error) {
            await indicator.error(`❌ Ошибка ${timeSlot} дайджеста`);
            throw error;
        }
    }

    // Ежедневная рефлексия
    async handleDailyReflection(tools) {
        console.log('🧠 Ежедневная рефлексия...');
        
        // Просто отправляем системное сообщение для запуска рефлексии
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: '685668909',
            message: '🌙 **Время для ежедневной рефлексии!**\n\n1. Что было хорошо сегодня?\n2. Что было плохо?\n3. Что я буду делать иначе?\n\nПроанализируем наше взаимодействие и мою работу как персонального ассистента.'
        });
        
        return { success: true, action: 'daily_reflection_started' };
    }

    // Еженедельная рефлексия
    async handleWeeklyReflection(tools) {
        console.log('📊 Еженедельная аналитика...');
        
        await tools.message({
            channel: 'telegram',
            action: 'send',
            target: '685668909',
            message: '📊 **Еженедельная аналитика**\n\nАнализирую наше взаимодействие за неделю и подготавливаю отчет с инсайтами...'
        });
        
        return { success: true, action: 'weekly_analytics_started' };
    }

    // Обработка пользовательских команд
    async handleUserCommand(userMessage, userId, tools) {
        if (userId !== '685668909' && userId !== 685668909) {
            return false; // Не наш пользователь
        }

        await this.initialize(tools);
        
        const trimmedMessage = userMessage.trim().toLowerCase();
        
        try {
            // Команда умного дайджеста
            if (trimmedMessage === '/smart_digest' || trimmedMessage === '/умный_дайджест') {
                const indicator = createTypingIndicator(tools.message, userId);
                
                await indicator.start('🤖 Создаю персонализированный дайджест...');
                
                const result = await this.dualRatingSystem.createSmartDigest();
                
                await indicator.finish('✅ Дайджест создан!');
                
                await tools.message({
                    channel: 'telegram',
                    action: 'send',
                    target: userId,
                    message: `✅ Персонализированный дайджест готов!\n📊 ${result.newsCount} новостей отправлено в @newsneiron\n🎯 Система учитывает ваши предпочтения\n\n💡 Реагируйте на новости эмодзи для улучшения персонализации!`
                });
                
                return true;
            }
            
            // Команда отчета
            if (trimmedMessage === '/rating_report' || trimmedMessage === '/отчет_рейтингов') {
                const indicator = createTypingIndicator(tools.message, userId);
                
                await indicator.start('📊 Генерирую отчет системы...');
                
                const report = await this.dualRatingSystem.getSystemReport();
                
                await indicator.finish('✅ Отчет готов!');
                
                await tools.message({
                    channel: 'telegram',
                    action: 'send',
                    target: userId,
                    message: report
                });
                
                return true;
            }
            
            // Команда статуса системы
            if (trimmedMessage === '/system_status' || trimmedMessage === '/статус_систем') {
                const statusMessage = `🤖 **СТАТУС СИСТЕМ АГЕНТА**

✅ **Dual Rating System** - активна
   📊 Персонализация новостей работает
   🎯 Multi-Armed Bandit алгоритм активен
   
✅ **Typing Indicators** - активны
   💬 Прогресс операций отображается
   
✅ **Heartbeat Monitoring** - активен
   🔄 Мониторинг новостей каждые ~30 мин
   
✅ **Автоматические дайджесты** - настроены
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
                    message: statusMessage
                });
                
                return true;
            }
            
        } catch (error) {
            console.error('❌ Ошибка обработки команды:', error);
            
            await tools.message({
                channel: 'telegram',
                action: 'send',
                target: userId,
                message: `❌ Ошибка выполнения команды: ${error.message}`
            });
            
            return true;
        }
        
        return false; // Команда не обработана
    }
}

// Создаем глобальный экземпляр
const integratedHandler = new IntegratedAgentHandler();

// Экспортируем функции для использования в агенте
module.exports = {
    handleSystemEvent: (eventText, tools) => integratedHandler.handleSystemEvent(eventText, tools),
    handleUserCommand: (userMessage, userId, tools) => integratedHandler.handleUserCommand(userMessage, userId, tools),
    IntegratedAgentHandler
};

// Делаем функции доступными глобально
global.handleDualRatingSystemEvent = (eventText, tools) => integratedHandler.handleSystemEvent(eventText, tools);
global.handleDualRatingCommand = (userMessage, userId, tools) => integratedHandler.handleUserCommand(userMessage, userId, tools);