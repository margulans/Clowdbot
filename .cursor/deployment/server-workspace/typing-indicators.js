// Typing Indicators System для OpenClaw
// Показывает прогресс операций через typing + статус-эмодзи

class TypingIndicatorManager {
    constructor(messageAPI) {
        this.messageAPI = messageAPI;
        this.activeIndicators = new Map();
        this.statusMessages = new Map();
    }

    // Начать индикацию с typing + статус-сообщением
    async startOperation(operationId, initialStatus = '🔄 Начинаю работу...', target = null) {
        const session = {
            operationId: operationId,
            target: target,
            startTime: Date.now(),
            currentStatus: initialStatus,
            messageId: null,
            chatId: null
        };

        // Включаем typing indicator (если поддерживается)
        try {
            if (target) {
                await this.messageAPI({
                    action: 'sendChatAction',
                    target: target,
                    action: 'typing'
                });
            }
        } catch (error) {
            console.warn('Typing indicator не поддерживается:', error.message);
        }

        // Отправляем статус-сообщение
        if (target) {
            try {
                const result = await this.messageAPI({
                    action: 'send',
                    target: target,
                    message: initialStatus
                });

                if (result.ok) {
                    session.messageId = result.messageId;
                    session.chatId = result.chatId;
                }
            } catch (error) {
                console.warn('Не удалось отправить статус-сообщение:', error);
            }
        }

        this.activeIndicators.set(operationId, session);
        console.log(`🔄 Начата операция ${operationId}: ${initialStatus}`);
        
        return session;
    }

    // Обновить статус операции
    async updateStatus(operationId, newStatus, keepTyping = true) {
        const session = this.activeIndicators.get(operationId);
        if (!session) return;

        session.currentStatus = newStatus;

        // Продолжаем typing если нужно
        if (keepTyping && session.target) {
            try {
                await this.messageAPI({
                    action: 'sendChatAction',
                    target: session.target,
                    action: 'typing'
                });
            } catch (error) {
                // Игнорируем ошибки typing
            }
        }

        // Обновляем статус-сообщение
        if (session.messageId && session.target) {
            try {
                await this.messageAPI({
                    action: 'edit',
                    target: session.target,
                    messageId: session.messageId,
                    message: newStatus
                });
            } catch (error) {
                console.warn('Не удалось обновить статус:', error);
            }
        }

        console.log(`🔄 ${operationId}: ${newStatus}`);
    }

    // Завершить операцию
    async finishOperation(operationId, finalStatus = '✅ Готово', autoDelete = false, deleteAfterMs = 3000) {
        const session = this.activeIndicators.get(operationId);
        if (!session) return;

        const duration = Date.now() - session.startTime;
        const finalMessage = `${finalStatus} (${Math.round(duration / 1000)}с)`;

        // Останавливаем typing
        try {
            if (session.target) {
                await this.messageAPI({
                    action: 'sendChatAction',
                    target: session.target,
                    action: 'cancel'
                });
            }
        } catch (error) {
            // Игнорируем ошибки
        }

        // Финальное обновление статус-сообщения
        if (session.messageId && session.target) {
            try {
                await this.messageAPI({
                    action: 'edit',
                    target: session.target,
                    messageId: session.messageId,
                    message: finalMessage
                });

                // Автоудаление статус-сообщения если нужно
                if (autoDelete) {
                    setTimeout(async () => {
                        try {
                            await this.messageAPI({
                                action: 'delete',
                                target: session.target,
                                messageId: session.messageId
                            });
                        } catch (error) {
                            console.warn('Не удалось удалить статус-сообщение:', error);
                        }
                    }, deleteAfterMs);
                }
            } catch (error) {
                console.warn('Не удалось завершить статус:', error);
            }
        }

        console.log(`✅ ${operationId} завершена: ${finalMessage}`);
        this.activeIndicators.delete(operationId);
        
        return session;
    }

    // Операция с ошибкой
    async errorOperation(operationId, errorMessage = '❌ Ошибка') {
        await this.finishOperation(operationId, errorMessage);
    }

    // Получить активные операции
    getActiveOperations() {
        return Array.from(this.activeIndicators.entries()).map(([id, session]) => ({
            id: id,
            status: session.currentStatus,
            duration: Date.now() - session.startTime,
            target: session.target
        }));
    }

    // Очистить зависшие операции (старше 5 минут)
    cleanupStaleOperations() {
        const staleThreshold = 5 * 60 * 1000; // 5 минут
        const now = Date.now();

        for (const [operationId, session] of this.activeIndicators) {
            if (now - session.startTime > staleThreshold) {
                console.warn(`⚠️ Очистка зависшей операции: ${operationId}`);
                this.activeIndicators.delete(operationId);
            }
        }
    }
}

// Wrapper для автоматического показа прогресса
class ProgressiveOperation {
    constructor(indicatorManager, operationId, target = null) {
        this.manager = indicatorManager;
        this.operationId = operationId;
        this.target = target;
        this.started = false;
    }

    async start(initialStatus = '🔄 Начинаю...') {
        if (!this.started) {
            await this.manager.startOperation(this.operationId, initialStatus, this.target);
            this.started = true;
        }
        return this;
    }

    async step(status, keepTyping = true) {
        if (this.started) {
            await this.manager.updateStatus(this.operationId, status, keepTyping);
        }
        return this;
    }

    async finish(finalStatus = '✅ Готово', autoDelete = false) {
        if (this.started) {
            await this.manager.finishOperation(this.operationId, finalStatus, autoDelete);
            this.started = false;
        }
        return this;
    }

    async error(errorMessage = '❌ Ошибка') {
        if (this.started) {
            await this.manager.errorOperation(this.operationId, errorMessage);
            this.started = false;
        }
        return this;
    }
}

// Предустановленные шаблоны прогресса
const ProgressTemplates = {
    // Поиск новостей
    NEWS_SEARCH: {
        start: '🔍 Ищу новости...',
        analyzing: '🔄 Анализирую источники...',
        filtering: '📊 Фильтрую по приоритетам...',
        formatting: '✍️ Форматирую дайджест...',
        finish: '✅ Дайджест готов'
    },

    // Подключение к Mac
    MAC_CONNECTION: {
        start: '🔄 Подключаюсь к Mac...',
        ping: '📡 Проверяю сеть Tailscale...',
        node_check: '🤖 Проверяю OpenClaw node...',
        ready: '✅ Mac подключен',
        error: '❌ Mac недоступен'
    },

    // Генерация отчета
    REPORT_GENERATION: {
        start: '📊 Генерирую отчет...',
        collecting: '🔍 Собираю данные...',
        analyzing: '📈 Анализирую метрики...',
        formatting: '📝 Форматирую результаты...',
        finish: '✅ Отчет готов'
    },

    // Multi-Armed Bandit
    BANDIT_OPERATION: {
        start: '🤖 Запускаю Multi-Armed Bandit...',
        loading: '📚 Загружаю состояние источников...',
        selecting: '🎯 Выбираю оптимальные источники...',
        updating: '💾 Сохраняю обновления...',
        finish: '✅ Источники выбраны'
    }
};

module.exports = {
    TypingIndicatorManager,
    ProgressiveOperation,
    ProgressTemplates
};

// Пример использования
if (require.main === module) {
    // Мок message API для тестирования
    const mockMessageAPI = async (params) => {
        console.log(`📱 Message API call:`, params);
        return { ok: true, messageId: Math.random().toString(), chatId: 'test' };
    };

    async function testTypingIndicators() {
        console.log('🧪 Тестирование Typing Indicators...');
        
        const manager = new TypingIndicatorManager(mockMessageAPI);
        
        // Тест 1: Базовая операция
        const op1 = new ProgressiveOperation(manager, 'test-search', 'test-chat');
        
        await op1.start('🔍 Ищу новости...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await op1.step('🔄 Анализирую 15 источников...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await op1.step('📊 Применяю Multi-Armed Bandit...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await op1.finish('✅ Найдено 12 новостей');
        
        // Тест 2: Операция с ошибкой
        const op2 = new ProgressiveOperation(manager, 'test-error', 'test-chat');
        
        await op2.start('🔄 Подключаюсь к Mac...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await op2.error('❌ Mac недоступен');
        
        console.log('✅ Тестирование завершено!');
        
        // Статистика
        console.log('📊 Активные операции:', manager.getActiveOperations());
    }
    
    testTypingIndicators().catch(console.error);
}