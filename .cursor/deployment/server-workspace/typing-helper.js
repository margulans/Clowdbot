// Простой хелпер для Typing Indicators в OpenClaw
// Для быстрого добавления прогресса к любой операции

/**
 * Создать typing indicator для операции
 * @param {Function} messageFunc - функция message из OpenClaw tools
 * @param {string} target - цель отправки (ID пользователя, канал)
 * @returns {Object} объект с методами для управления индикатором
 */
function createTypingIndicator(messageFunc, target) {
    let statusMessageId = null;
    let statusChatId = null;
    let isActive = false;
    
    return {
        // Начать показ прогресса
        async start(initialMessage = '🔄 Работаю...') {
            if (isActive) return;
            
            try {
                // Отправляем статус-сообщение
                const result = await messageFunc({
                    channel: 'telegram',
                    action: 'send',
                    target: target,
                    message: initialMessage
                });
                
                if (result.ok) {
                    statusMessageId = result.messageId;
                    statusChatId = result.chatId;
                    isActive = true;
                }
                
                console.log(`🔄 Typing indicator started: ${initialMessage}`);
            } catch (error) {
                console.warn('Failed to start typing indicator:', error);
            }
        },
        
        // Обновить статус
        async update(newMessage) {
            if (!isActive || !statusMessageId) return;
            
            try {
                await messageFunc({
                    channel: 'telegram',
                    action: 'edit',
                    target: target,
                    messageId: statusMessageId,
                    message: newMessage
                });
                
                console.log(`🔄 Typing indicator updated: ${newMessage}`);
            } catch (error) {
                console.warn('Failed to update typing indicator:', error);
            }
        },
        
        // Завершить с успехом
        async finish(finalMessage = '✅ Готово', autoDelete = true, deleteAfterMs = 3000) {
            if (!isActive || !statusMessageId) return;
            
            try {
                await messageFunc({
                    channel: 'telegram',
                    action: 'edit',
                    target: target,
                    messageId: statusMessageId,
                    message: finalMessage
                });
                
                // Автоудаление статус-сообщения
                if (autoDelete) {
                    setTimeout(async () => {
                        try {
                            await messageFunc({
                                channel: 'telegram',
                                action: 'delete',
                                target: target,
                                messageId: statusMessageId
                            });
                        } catch (error) {
                            console.warn('Failed to delete status message:', error);
                        }
                    }, deleteAfterMs);
                }
                
                console.log(`✅ Typing indicator finished: ${finalMessage}`);
            } catch (error) {
                console.warn('Failed to finish typing indicator:', error);
            }
            
            isActive = false;
            statusMessageId = null;
        },
        
        // Завершить с ошибкой
        async error(errorMessage = '❌ Ошибка') {
            await this.finish(errorMessage, false); // Не удаляем сообщения об ошибках
        },
        
        // Проверить активность
        isActive() {
            return isActive;
        }
    };
}

/**
 * Обернуть функцию автоматическим показом прогресса
 * @param {Function} messageFunc - функция message из OpenClaw tools
 * @param {string} target - цель отправки
 * @param {string} operationName - название операции для логирования
 * @param {Function} asyncOperation - асинхронная функция для выполнения
 * @param {Object} options - опции прогресса
 */
async function withProgress(messageFunc, target, operationName, asyncOperation, options = {}) {
    const {
        startMessage = '🔄 Работаю...',
        successMessage = '✅ Готово',
        errorMessage = '❌ Ошибка',
        autoDelete = true
    } = options;
    
    const indicator = createTypingIndicator(messageFunc, target);
    
    try {
        await indicator.start(startMessage);
        
        // Выполняем операцию, передавая индикатор для обновлений
        const result = await asyncOperation(indicator);
        
        await indicator.finish(successMessage, autoDelete);
        return result;
        
    } catch (error) {
        await indicator.error(`${errorMessage}: ${error.message}`);
        console.error(`Error in ${operationName}:`, error);
        throw error;
    }
}

// Предустановленные шаблоны для разных типов операций
const Templates = {
    NEWS_SEARCH: {
        start: '🔍 Ищу новости...',
        analyzing: '🔄 Анализирую источники...',
        filtering: '📊 Применяю фильтры...',
        success: '✅ Новости найдены'
    },
    
    DIGEST_GENERATION: {
        start: '📰 Создаю дайджест...',
        sources: '🎯 Выбираю источники...',
        formatting: '✍️ Форматирую новости...',
        sending: '📤 Отправляю в канал...',
        success: '✅ Дайджест готов'
    },
    
    MAC_CONNECTION: {
        start: '🔄 Подключаюсь к Mac...',
        checking: '📡 Проверяю сеть...',
        connecting: '🤖 Запускаю node...',
        success: '✅ Mac подключен',
        error: '❌ Mac недоступен'
    },
    
    FILE_OPERATION: {
        start: '📁 Работаю с файлами...',
        reading: '📖 Читаю файлы...',
        processing: '⚙️ Обрабатываю данные...',
        writing: '💾 Сохраняю изменения...',
        success: '✅ Файлы обработаны'
    }
};

module.exports = {
    createTypingIndicator,
    withProgress,
    Templates
};

// Примеры использования
if (require.main === module) {
    console.log(`
💡 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ TYPING INDICATORS:

// 1. Простой способ - обертка функции
async function searchNewsWithProgress() {
    return await withProgress(message, '685668909', 'news-search', async (indicator) => {
        await indicator.update('🔍 Ищу ИИ новости...');
        const results = await web_search({ query: 'AI news', count: 5 });
        
        await indicator.update('📊 Фильтрую результаты...');
        const filtered = results.filter(r => r.relevance > 0.8);
        
        return filtered;
    }, {
        startMessage: '🔄 Начинаю поиск новостей...',
        successMessage: '✅ Новости найдены!',
        autoDelete: true
    });
}

// 2. Ручное управление индикатором
async function generateDigest() {
    const indicator = createTypingIndicator(message, '685668909');
    
    await indicator.start(Templates.DIGEST_GENERATION.start);
    
    try {
        await indicator.update(Templates.DIGEST_GENERATION.sources);
        const sources = await selectSources();
        
        await indicator.update(Templates.DIGEST_GENERATION.formatting);
        const formatted = await formatDigest(sources);
        
        await indicator.update(Templates.DIGEST_GENERATION.sending);
        await sendToChannel(formatted);
        
        await indicator.finish(Templates.DIGEST_GENERATION.success);
        
    } catch (error) {
        await indicator.error('❌ Ошибка создания дайджеста');
        throw error;
    }
}

// 3. Интеграция с существующими функциями OpenClaw
async function checkMacWithIndicator() {
    const indicator = createTypingIndicator(message, '685668909');
    
    await indicator.start(Templates.MAC_CONNECTION.start);
    
    await indicator.update(Templates.MAC_CONNECTION.checking);
    const status = await nodes({ action: 'status' });
    
    const macNode = status.nodes?.find(n => n.displayName === 'mac-files');
    
    if (macNode?.connected) {
        await indicator.finish(Templates.MAC_CONNECTION.success);
        return { connected: true };
    } else {
        await indicator.error(Templates.MAC_CONNECTION.error);
        return { connected: false };
    }
}

// 4. Использование в heartbeat функциях
async function heartbeatWithProgress() {
    const indicator = createTypingIndicator(message, '685668909');
    
    await indicator.start('🔄 Проверяю новости...');
    
    await indicator.update('🔍 Сканирую источники...');
    const urgent = await checkUrgentNews();
    
    if (urgent.length > 0) {
        await indicator.update('🚨 Найдены срочные новости...');
        await sendUrgentNews(urgent);
        await indicator.finish('✅ Срочные новости отправлены');
    } else {
        await indicator.finish('✅ Новых срочных новостей нет', true, 2000);
    }
}
`);
}