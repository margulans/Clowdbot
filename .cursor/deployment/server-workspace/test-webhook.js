#!/usr/bin/env node
// Тест Telegram Webhook Handler для Dual Rating системы

const { TelegramWebhookHandler, handleTelegramWebhook, createWebhookMiddleware } = require('./telegram-webhook-handler.js');

// Мок OpenClaw tools
function createMockTools() {
    let messageCounter = 0;
    let memoryCounter = 0;
    
    const mockMessage = async (params) => {
        messageCounter++;
        const msgId = `msg_${messageCounter}`;
        console.log(`📱 MESSAGE: ${params.action} → ${params.target}: "${params.message.slice(0, 60)}..."`);
        return { ok: true, messageId: msgId, chatId: params.target };
    };
    
    const mockWebSearch = async (params) => {
        console.log(`🔍 WEB_SEARCH: "${params.query}"`);
        return { results: [] };
    };
    
    const mockMemoryStore = async (params) => {
        memoryCounter++;
        console.log(`🧠 MEMORY_STORE: "${params.text.slice(0, 50)}..." (${params.category})`);
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
        getStats: () => ({ messages: messageCounter, memories: memoryCounter })
    };
}

// Тестовые данные Telegram обновлений
const testUpdates = {
    validReaction: {
        update_id: 123,
        message_reaction: {
            chat: { id: -1003723471488, username: 'newsneiron', type: 'channel' },
            user: { id: 685668909, username: 'margulan_seissembai' },
            message_id: 999,
            date: Math.floor(Date.now() / 1000),
            new_reaction: [{ emoji: '🔥', type: 'emoji' }],
            old_reaction: []
        }
    },
    
    wrongUser: {
        update_id: 124,
        message_reaction: {
            chat: { id: -1003723471488, username: 'newsneiron', type: 'channel' },
            user: { id: 123456789, username: 'other_user' },
            message_id: 1000,
            date: Math.floor(Date.now() / 1000),
            new_reaction: [{ emoji: '👍', type: 'emoji' }],
            old_reaction: []
        }
    },
    
    wrongChat: {
        update_id: 125,
        message_reaction: {
            chat: { id: -123456789, username: 'other_channel', type: 'channel' },
            user: { id: 685668909, username: 'margulan_seissembai' },
            message_id: 1001,
            date: Math.floor(Date.now() / 1000),
            new_reaction: [{ emoji: '🔥', type: 'emoji' }],
            old_reaction: []
        }
    },
    
    invalidReaction: {
        update_id: 126,
        message_reaction: {
            chat: { id: -1003723471488, username: 'newsneiron', type: 'channel' },
            user: { id: 685668909, username: 'margulan_seissembai' },
            message_id: 1002,
            date: Math.floor(Date.now() / 1000),
            new_reaction: [{ emoji: '😀', type: 'emoji' }],
            old_reaction: []
        }
    },
    
    multipleReactions: {
        update_id: 127,
        message_reaction: {
            chat: { id: -1003723471488, username: 'newsneiron', type: 'channel' },
            user: { id: 685668909, username: 'margulan_seissembai' },
            message_id: 1003,
            date: Math.floor(Date.now() / 1000),
            new_reaction: [
                { emoji: '🔥', type: 'emoji' },
                { emoji: '👍', type: 'emoji' }
            ],
            old_reaction: []
        }
    },
    
    regularMessage: {
        update_id: 128,
        message: {
            message_id: 1004,
            chat: { id: -1003723471488, username: 'newsneiron', type: 'channel' },
            from: { id: 685668909, username: 'margulan_seissembai' },
            date: Math.floor(Date.now() / 1000),
            text: 'Тестовое сообщение'
        }
    },
    
    editedMessage: {
        update_id: 129,
        edited_message: {
            message_id: 1005,
            chat: { id: -1003723471488, username: 'newsneiron', type: 'channel' },
            from: { id: 685668909, username: 'margulan_seissembai' },
            date: Math.floor(Date.now() / 1000),
            edit_date: Math.floor(Date.now() / 1000) + 60,
            text: 'Отредактированное сообщение'
        }
    }
};

// Функция задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runWebhookTests() {
    console.log('🧪 ЗАПУСК ТЕСТОВ TELEGRAM WEBHOOK HANDLER');
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
    
    console.log('🔧 Инициализация webhook handler...');
    const handler = new TelegramWebhookHandler(tools);
    await sleep(1000);
    
    // Тест 1: Валидная реакция
    console.log('\n🧪 ТЕСТ 1: Валидная реакция от целевого пользователя');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.validReaction);
        
        if (result.processed && result.reactions && result.reactions.length > 0) {
            console.log('✅ Валидная реакция обработана корректно');
            console.log(`   🎯 Обработано реакций: ${result.reactions.length}`);
            testsPassed++;
        } else {
            console.error('❌ Валидная реакция не обработана');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 1:', error.message);
    }
    
    await sleep(500);
    
    // Тест 2: Реакция от неправильного пользователя
    console.log('\n🧪 ТЕСТ 2: Реакция от неправильного пользователя');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.wrongUser);
        
        if (!result.processed && result.reason === 'wrong_user') {
            console.log('✅ Реакция от неправильного пользователя корректно отфильтрована');
            testsPassed++;
        } else {
            console.error('❌ Реакция от неправильного пользователя некорректно обработана');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 2:', error.message);
    }
    
    await sleep(500);
    
    // Тест 3: Реакция в неправильном чате
    console.log('\n🧪 ТЕСТ 3: Реакция в неправильном чате');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.wrongChat);
        
        if (!result.processed && result.reason === 'wrong_chat') {
            console.log('✅ Реакция в неправильном чате корректно отфильтрована');
            testsPassed++;
        } else {
            console.error('❌ Реакция в неправильном чате некорректно обработана');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 3:', error.message);
    }
    
    await sleep(500);
    
    // Тест 4: Невалидная реакция (не для рейтинга)
    console.log('\n🧪 ТЕСТ 4: Невалидная реакция');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.invalidReaction);
        
        if (!result.processed && result.reason === 'no_new_reactions') {
            console.log('✅ Невалидная реакция корректно проигнорирована');
            testsPassed++;
        } else {
            console.error('❌ Невалидная реакция некорректно обработана');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 4:', error.message);
    }
    
    await sleep(500);
    
    // Тест 5: Несколько реакций одновременно
    console.log('\n🧪 ТЕСТ 5: Несколько реакций одновременно');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.multipleReactions);
        
        if (result.processed && result.reactions && result.reactions.length === 2) {
            console.log('✅ Несколько реакций обработаны корректно');
            console.log(`   🎯 Обработано реакций: ${result.reactions.length}`);
            testsPassed++;
        } else {
            console.error('❌ Несколько реакций обработаны некорректно');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 5:', error.message);
    }
    
    await sleep(500);
    
    // Тест 6: Обычное сообщение
    console.log('\n🧪 ТЕСТ 6: Обычное сообщение');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.regularMessage);
        
        if (!result.processed && result.reason === 'message_not_handled') {
            console.log('✅ Обычное сообщение корректно не обработано');
            testsPassed++;
        } else {
            console.error('❌ Обычное сообщение некорректно обработано');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 6:', error.message);
    }
    
    await sleep(500);
    
    // Тест 7: Отредактированное сообщение
    console.log('\n🧪 ТЕСТ 7: Отредактированное сообщение');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handler.handleWebhookUpdate(testUpdates.editedMessage);
        
        if (!result.processed && result.reason === 'edited_message_ignored') {
            console.log('✅ Отредактированное сообщение корректно проигнорировано');
            testsPassed++;
        } else {
            console.error('❌ Отредактированное сообщение некорректно обработано');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 7:', error.message);
    }
    
    await sleep(500);
    
    // Тест 8: Статистика обработчика
    console.log('\n🧪 ТЕСТ 8: Статистика обработчика');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const stats = handler.getStats();
        
        if (stats.targetUserId === 685668909 && 
            stats.targetChannel === '@newsneiron' &&
            stats.validReactions.length === 4) {
            console.log('✅ Статистика обработчика корректная');
            console.log('   📊 Статистика:', stats);
            testsPassed++;
        } else {
            console.error('❌ Статистика обработчика некорректная');
            console.log('   📊 Статистика:', stats);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 8:', error.message);
    }
    
    await sleep(500);
    
    // Тест 9: Прямая функция handleTelegramWebhook
    console.log('\n🧪 ТЕСТ 9: Прямая функция handleTelegramWebhook');
    console.log('-' * 50);
    testsTotal++;
    
    try {
        const result = await handleTelegramWebhook(testUpdates.validReaction, tools);
        
        if (result.processed) {
            console.log('✅ Прямая функция работает корректно');
            testsPassed++;
        } else {
            console.error('❌ Прямая функция не работает');
            console.log('   Результат:', result);
        }
    } catch (error) {
        console.error('❌ Ошибка теста 9:', error.message);
    }
    
    await sleep(500);
    
    // Результаты тестирования
    console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
    console.log('=' * 60);
    console.log(`✅ Пройдено тестов: ${testsPassed}/${testsTotal}`);
    console.log(`📊 Статистика mock tools:`, mockTools.getStats());
    
    if (testsPassed === testsTotal) {
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
        console.log('🔗 Telegram Webhook Handler готов к использованию');
        
        console.log('\n🎯 ФИЛЬТРАЦИЯ РАБОТАЕТ КОРРЕКТНО:');
        console.log('   ✅ Только пользователь 685668909');
        console.log('   ✅ Только канал @newsneiron');
        console.log('   ✅ Только валидные реакции: 🔥👍👎💩');
        console.log('   ✅ Игнорирует обычные сообщения');
        
    } else {
        console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ');
        console.log('🔍 Проверьте ошибки выше');
    }
    
    console.log('\n🚀 ГОТОВНОСТЬ К ИНТЕГРАЦИИ:');
    console.log(`   📱 Обработка реакций: ${testsPassed >= 5 ? '✅' : '❌'}`);
    console.log(`   🎯 Фильтрация: ${testsPassed >= 3 ? '✅' : '❌'}`);
    console.log(`   📊 Статистика: ${testsPassed >= 8 ? '✅' : '❌'}`);
    
    if (testsPassed === testsTotal) {
        console.log('\n📋 СЛЕДУЮЩИЕ ШАГИ:');
        console.log('1. Получить токен бота от @BotFather');
        console.log('2. Настроить HTTPS домен или ngrok для webhook');
        console.log('3. Добавить webhook эндпоинт в код агента');
        console.log('4. Настроить webhook через setupTelegramWebhook()');
        console.log('5. Протестировать реальные реакции в @newsneiron');
        
        console.log('\n💡 ПРИМЕР ИНТЕГРАЦИИ:');
        console.log('```javascript');
        console.log('const { createWebhookMiddleware } = require("./telegram-webhook-handler.js");');
        console.log('app.post("/webhook/telegram", createWebhookMiddleware(tools));');
        console.log('```');
    }
}

// Запуск тестов
if (require.main === module) {
    runWebhookTests().catch(console.error);
}

module.exports = {
    runWebhookTests,
    createMockTools,
    testUpdates
};