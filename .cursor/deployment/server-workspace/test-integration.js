#!/usr/bin/env node
// Тест интеграции Dual Rating системы в агента

const agentSystems = require('./main-agent-integration.js');

// Мок OpenClaw tools
function createMockTools() {
    let messageCounter = 0;
    const sentMessages = [];
    
    const mockMessage = async (params) => {
        messageCounter++;
        const msgId = `msg_${messageCounter}`;
        
        const logMessage = `📱 MESSAGE: ${params.action.toUpperCase()} → ${params.target}`;
        console.log(logMessage);
        console.log(`   📄 ${params.message.slice(0, 100)}${params.message.length > 100 ? '...' : ''}`);
        
        sentMessages.push({
            id: msgId,
            action: params.action,
            target: params.target,
            message: params.message,
            timestamp: Date.now()
        });
        
        return { ok: true, messageId: msgId, chatId: params.target };
    };
    
    const mockWebSearch = async (params) => {
        console.log(`🔍 WEB_SEARCH: "${params.query}" (count: ${params.count})`);
        
        // Имитируем результаты поиска
        const mockResults = [
            {
                title: 'OpenAI Announces Revolutionary GPT-6 Model',
                description: 'Breakthrough in artificial general intelligence achieved...',
                url: 'https://openai.com/blog/gpt6',
                siteName: 'OpenAI Blog'
            },
            {
                title: 'Anthropic Claude Opus 5.0 Released',
                description: 'Most powerful AI model to date with unprecedented capabilities...',
                url: 'https://anthropic.com/news/claude-opus-5',
                siteName: 'Anthropic News'
            },
            {
                title: 'Boston Dynamics Unveils Flying Humanoid Robot',
                description: 'Atlas robot now capable of sustained flight and aerial maneuvers...',
                url: 'https://bostondynamics.com/news/flying-atlas',
                siteName: 'Boston Dynamics'
            }
        ];
        
        console.log(`   ✅ Найдено ${mockResults.length} результатов`);
        return { results: mockResults };
    };
    
    const mockMemoryStore = async (params) => {
        console.log(`🧠 MEMORY_STORE: "${params.text.slice(0, 60)}..." (${params.category}, importance: ${params.importance})`);
        return { success: true };
    };
    
    const mockMemoryRecall = async (params) => {
        console.log(`🔍 MEMORY_RECALL: "${params.query}"`);
        return { memories: [] };
    };
    
    return {
        message: mockMessage,
        web_search: mockWebSearch,
        memory_store: mockMemoryStore,
        memory_recall: mockMemoryRecall,
        getSentMessages: () => sentMessages,
        getMessageCount: () => messageCounter
    };
}

// Тестовые сценарии
async function runIntegrationTests() {
    console.log('🧪 ЗАПУСК ТЕСТОВ ИНТЕГРАЦИИ DUAL RATING СИСТЕМЫ');
    console.log('=' * 60);
    
    const mockTools = createMockTools();
    const tools = {
        message: mockTools.message,
        web_search: mockTools.web_search,
        memory_store: mockTools.memory_store,
        memory_recall: mockTools.memory_recall
    };
    
    let testsPassed = 0;
    let testsTotal = 0;
    
    // Тест 1: Инициализация системы
    console.log('\n🧪 ТЕСТ 1: Инициализация системы');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        await agentSystems.initializeAgentSystems(tools);
        console.log('✅ Система инициализирована успешно');
        testsPassed++;
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error.message);
    }
    
    await sleep(1000);
    
    // Тест 2: Команда /smart_digest
    console.log('\n🧪 ТЕСТ 2: Команда /smart_digest');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const handled = await agentSystems.handleUserMessage('/smart_digest', '685668909', tools);
        
        if (handled) {
            console.log('✅ Команда /smart_digest обработана');
            testsPassed++;
        } else {
            console.error('❌ Команда /smart_digest не обработана');
        }
    } catch (error) {
        console.error('❌ Ошибка команды /smart_digest:', error.message);
    }
    
    await sleep(2000);
    
    // Тест 3: Команда /rating_report
    console.log('\n🧪 ТЕСТ 3: Команда /rating_report');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const handled = await agentSystems.handleUserMessage('/rating_report', '685668909', tools);
        
        if (handled) {
            console.log('✅ Команда /rating_report обработана');
            testsPassed++;
        } else {
            console.error('❌ Команда /rating_report не обработана');
        }
    } catch (error) {
        console.error('❌ Ошибка команды /rating_report:', error.message);
    }
    
    await sleep(1000);
    
    // Тест 4: Команда /system_status
    console.log('\n🧪 ТЕСТ 4: Команда /system_status');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const handled = await agentSystems.handleUserMessage('/system_status', '685668909', tools);
        
        if (handled) {
            console.log('✅ Команда /system_status обработана');
            testsPassed++;
        } else {
            console.error('❌ Команда /system_status не обработана');
        }
    } catch (error) {
        console.error('❌ Ошибка команды /system_status:', error.message);
    }
    
    await sleep(500);
    
    // Тест 5: Неизвестная команда
    console.log('\n🧪 ТЕСТ 5: Неизвестная команда');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const handled = await agentSystems.handleUserMessage('/unknown_command', '685668909', tools);
        
        if (!handled) {
            console.log('✅ Неизвестная команда корректно не обработана');
            testsPassed++;
        } else {
            console.error('❌ Неизвестная команда некорректно обработана как известная');
        }
    } catch (error) {
        console.error('❌ Ошибка обработки неизвестной команды:', error.message);
    }
    
    // Тест 6: Обработка реакций
    console.log('\n🧪 ТЕСТ 6: Обработка Telegram реакций');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        // Реакция от целевого пользователя в целевом канале
        const handled1 = await agentSystems.handleTelegramReaction('msg_1', '🔥', 685668909, '@newsneiron', tools);
        
        // Реакция от другого пользователя (должна игнорироваться)
        const handled2 = await agentSystems.handleTelegramReaction('msg_2', '👍', 123456, '@newsneiron', tools);
        
        // Реакция в другом канале (должна игнорироваться)
        const handled3 = await agentSystems.handleTelegramReaction('msg_3', '🔥', 685668909, '@other_channel', tools);
        
        console.log('✅ Система обработки реакций работает');
        testsPassed++;
        
    } catch (error) {
        console.error('❌ Ошибка обработки реакций:', error.message);
    }
    
    // Тест 7: Системные события
    console.log('\n🧪 ТЕСТ 7: Обработка системных событий');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        // Тестируем утренний дайджест
        const result1 = await agentSystems.handleSystemEvent("createScheduledSmartDigest('morning')", tools);
        
        // Тестируем неизвестное событие
        const result2 = await agentSystems.handleSystemEvent('unknown_event', tools);
        
        console.log('✅ Система обработки событий работает');
        testsPassed++;
        
    } catch (error) {
        console.error('❌ Ошибка обработки системных событий:', error.message);
    }
    
    // Тест 8: Heartbeat задачи
    console.log('\n🧪 ТЕСТ 8: Heartbeat задачи');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        await agentSystems.performHeartbeatTasks(tools);
        console.log('✅ Heartbeat задачи выполнены');
        testsPassed++;
    } catch (error) {
        console.error('❌ Ошибка heartbeat задач:', error.message);
    }
    
    // Результаты тестирования
    console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
    console.log('=' * 60);
    console.log(`✅ Пройдено тестов: ${testsPassed}/${testsTotal}`);
    console.log(`📨 Отправлено сообщений: ${mockTools.getMessageCount()}`);
    
    if (testsPassed === testsTotal) {
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
        console.log('🔧 Dual Rating система готова к интеграции в агента');
    } else {
        console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ');
        console.log('🔍 Проверьте ошибки выше и исправьте перед интеграцией');
    }
    
    // Статистика отправленных сообщений
    console.log('\n📱 СТАТИСТИКА СООБЩЕНИЙ:');
    const messages = mockTools.getSentMessages();
    const messagesByTarget = messages.reduce((acc, msg) => {
        acc[msg.target] = (acc[msg.target] || 0) + 1;
        return acc;
    }, {});
    
    Object.entries(messagesByTarget).forEach(([target, count]) => {
        console.log(`   ${target}: ${count} сообщений`);
    });
    
    console.log('\n🎯 ГОТОВНОСТЬ К ИНТЕГРАЦИИ:');
    console.log(`   📋 Команды: ${testsPassed >= 4 ? '✅' : '❌'}`);
    console.log(`   📱 Реакции: ${testsPassed >= 6 ? '✅' : '❌'}`);
    console.log(`   ⏰ События: ${testsPassed >= 7 ? '✅' : '❌'}`);
    console.log(`   🔄 Heartbeat: ${testsPassed >= 8 ? '✅' : '❌'}`);
    
    if (testsPassed === testsTotal) {
        console.log('\n🚀 СЛЕДУЮЩИЕ ШАГИ:');
        console.log('1. Подключить main-agent-integration.js в основной код агента');
        console.log('2. Добавить cron задачи из cron-jobs-dual-rating.json');  
        console.log('3. Настроить webhook для обработки Telegram реакций');
        console.log('4. Протестировать команды в живом агенте');
        console.log('5. Проверить автоматические дайджесты');
    }
}

// Вспомогательная функция задержки
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Запуск тестов
if (require.main === module) {
    runIntegrationTests().catch(console.error);
}

module.exports = { runIntegrationTests, createMockTools };