// Интеграция Typing Indicators с OpenClaw
// Обертка для автоматического показа прогресса операций

const { TypingIndicatorManager, ProgressiveOperation, ProgressTemplates } = require('./typing-indicators.js');

class OpenClawTypingIntegration {
    constructor(toolAPI) {
        // toolAPI - это доступ к инструментам OpenClaw (message, web_search, etc.)
        this.toolAPI = toolAPI;
        
        // Создаем wrapper для message API
        this.messageAPI = this.createMessageAPIWrapper();
        
        // Инициализируем менеджер индикаторов
        this.indicatorManager = new TypingIndicatorManager(this.messageAPI);
        
        this.defaultTarget = null; // Можно установить цель по умолчанию
    }

    // Создаем wrapper для message API OpenClaw
    createMessageAPIWrapper() {
        return async (params) => {
            try {
                // Используем message tool из OpenClaw
                const result = await this.toolAPI.message({
                    channel: 'telegram',
                    ...params
                });
                return result;
            } catch (error) {
                console.error('Message API error:', error);
                throw error;
            }
        };
    }

    // Установить цель по умолчанию для индикаторов
    setDefaultTarget(target) {
        this.defaultTarget = target;
    }

    // Создать прогрессивную операцию
    createOperation(operationId, target = null) {
        const finalTarget = target || this.defaultTarget;
        return new ProgressiveOperation(this.indicatorManager, operationId, finalTarget);
    }

    // Обертки для часто используемых операций

    // Поиск новостей с прогрессом
    async searchNewsWithProgress(searchParams, target = null) {
        const op = this.createOperation('news-search-' + Date.now(), target);
        
        try {
            await op.start(ProgressTemplates.NEWS_SEARCH.start);
            
            // Выполняем поиск
            await op.step(ProgressTemplates.NEWS_SEARCH.analyzing);
            const searchResults = await this.toolAPI.web_search(searchParams);
            
            await op.step(ProgressTemplates.NEWS_SEARCH.filtering);
            // Здесь можно добавить фильтрацию результатов
            
            await op.step(ProgressTemplates.NEWS_SEARCH.formatting);
            // Форматирование результатов
            
            await op.finish(`✅ Найдено ${searchResults.results?.length || 0} новостей`);
            
            return searchResults;
            
        } catch (error) {
            await op.error('❌ Ошибка поиска новостей');
            throw error;
        }
    }

    // Проверка подключения к Mac с прогрессом
    async checkMacConnectionWithProgress(target = null) {
        const op = this.createOperation('mac-check-' + Date.now(), target);
        
        try {
            await op.start(ProgressTemplates.MAC_CONNECTION.start);
            
            // Проверяем статус nodes
            await op.step(ProgressTemplates.MAC_CONNECTION.ping);
            const nodesStatus = await this.toolAPI.nodes({ action: 'status' });
            
            await op.step(ProgressTemplates.MAC_CONNECTION.node_check);
            
            const macNode = nodesStatus.nodes?.find(n => n.displayName === 'mac-files');
            const isConnected = macNode?.connected === true;
            
            if (isConnected) {
                await op.finish(ProgressTemplates.MAC_CONNECTION.ready);
                return { connected: true, node: macNode };
            } else {
                await op.finish(ProgressTemplates.MAC_CONNECTION.error);
                return { connected: false, node: macNode };
            }
            
        } catch (error) {
            await op.error(ProgressTemplates.MAC_CONNECTION.error);
            return { connected: false, error: error.message };
        }
    }

    // Генерация Multi-Armed Bandit отчета с прогрессом
    async generateBanditReportWithProgress(target = null) {
        const op = this.createOperation('bandit-report-' + Date.now(), target);
        
        try {
            await op.start(ProgressTemplates.BANDIT_OPERATION.start);
            
            // Загружаем менеджер источников
            await op.step(ProgressTemplates.BANDIT_OPERATION.loading);
            const NewsSourceManager = require('./news-source-manager.js');
            const manager = new NewsSourceManager();
            await manager.initialize();
            
            // Генерируем отчет
            await op.step(ProgressTemplates.BANDIT_OPERATION.selecting);
            const report = await manager.generateSystemReport();
            
            await op.step(ProgressTemplates.BANDIT_OPERATION.updating);
            // Сохраняем состояние
            await manager.saveState();
            
            await op.finish(`✅ Отчет готов (здоровье: ${report.health.score}/100)`);
            
            return report;
            
        } catch (error) {
            await op.error('❌ Ошибка генерации отчета');
            throw error;
        }
    }

    // Отправка дайджеста с прогрессом
    async sendDigestWithProgress(digestData, channelTarget, target = null) {
        const op = this.createOperation('digest-send-' + Date.now(), target);
        
        try {
            await op.start('📰 Отправляю дайджест...');
            
            let sentCount = 0;
            const totalNews = digestData.length;
            
            for (const newsItem of digestData) {
                await op.step(`📝 Отправляю новость ${sentCount + 1}/${totalNews}...`);
                
                // Отправляем новость
                await this.toolAPI.message({
                    channel: 'telegram',
                    action: 'send',
                    target: channelTarget,
                    message: newsItem.text
                });
                
                sentCount++;
                
                // Небольшая пауза между сообщениями
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            await op.finish(`✅ Дайджест отправлен (${sentCount} новостей)`);
            
            return { success: true, sentCount };
            
        } catch (error) {
            await op.error('❌ Ошибка отправки дайджеста');
            throw error;
        }
    }

    // Очистка зависших операций
    cleanup() {
        this.indicatorManager.cleanupStaleOperations();
    }

    // Получить статистику активных операций
    getActiveOperations() {
        return this.indicatorManager.getActiveOperations();
    }
}

// Утилита для легкого создания typing indicators в любом месте кода OpenClaw
class QuickTypingIndicator {
    constructor(messageAPI, target) {
        this.messageAPI = messageAPI;
        this.target = target;
        this.currentOp = null;
    }

    async show(status = '🔄 Работаю...') {
        const operationId = 'quick-' + Date.now();
        const manager = new TypingIndicatorManager(this.messageAPI);
        
        this.currentOp = new ProgressiveOperation(manager, operationId, this.target);
        await this.currentOp.start(status);
        
        return this;
    }

    async update(status) {
        if (this.currentOp) {
            await this.currentOp.step(status);
        }
        return this;
    }

    async done(finalStatus = '✅ Готово', autoDelete = true) {
        if (this.currentOp) {
            await this.currentOp.finish(finalStatus, autoDelete, 2000);
            this.currentOp = null;
        }
        return this;
    }

    async error(errorMessage = '❌ Ошибка') {
        if (this.currentOp) {
            await this.currentOp.error(errorMessage);
            this.currentOp = null;
        }
        return this;
    }
}

// Экспорт
module.exports = {
    OpenClawTypingIntegration,
    QuickTypingIndicator,
    ProgressTemplates
};

// Пример использования в OpenClaw агенте
if (require.main === module) {
    console.log('💡 Пример интеграции с OpenClaw:');
    
    const exampleCode = `
// В коде OpenClaw агента:

// 1. Инициализация системы typing indicators
const typingIntegration = new OpenClawTypingIntegration({
    message: message,
    web_search: web_search,
    nodes: nodes
});

// Установка цели по умолчанию (ID пользователя)
typingIntegration.setDefaultTarget('685668909');

// 2. Использование в функциях:

// Поиск новостей с прогрессом
const searchResults = await typingIntegration.searchNewsWithProgress({
    query: 'AI news today',
    count: 5
});

// Проверка Mac с прогрессом
const macStatus = await typingIntegration.checkMacConnectionWithProgress();

// Быстрый индикатор для любой операции
const quickIndicator = new QuickTypingIndicator(messageAPI, '685668909');
await quickIndicator.show('🔍 Анализирую данные...');
// ... выполнение работы ...
await quickIndicator.update('📊 Почти готово...');
// ... финальная работа ...
await quickIndicator.done('✅ Анализ завершен');

// 3. Интеграция с существующими функциями:

async function generateDigestWithProgress() {
    const op = typingIntegration.createOperation('digest-generation');
    
    await op.start('🔍 Ищу новости...');
    const newsData = await searchNews();
    
    await op.step('🤖 Применяю Multi-Armed Bandit...');
    const selectedSources = await banditSelection(newsData);
    
    await op.step('📝 Форматирую дайджест...');
    const formattedDigest = await formatDigest(selectedSources);
    
    await op.step('📰 Отправляю в канал...');
    await sendToChannel(formattedDigest);
    
    await op.finish('✅ Дайджест готов!');
}
`;

    console.log(exampleCode);
}

// Функция для простой интеграции в существующий код OpenClaw
function createSimpleTypingWrapper(messageAPI, defaultTarget = null) {
    return {
        async withProgress(operationName, asyncFunction, initialStatus = '🔄 Работаю...') {
            const indicator = new QuickTypingIndicator(messageAPI, defaultTarget);
            
            try {
                await indicator.show(initialStatus);
                const result = await asyncFunction(indicator);
                await indicator.done('✅ Готово');
                return result;
            } catch (error) {
                await indicator.error('❌ Ошибка: ' + error.message);
                throw error;
            }
        }
    };
}

module.exports.createSimpleTypingWrapper = createSimpleTypingWrapper;