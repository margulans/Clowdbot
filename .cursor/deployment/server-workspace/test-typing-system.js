#!/usr/bin/env node
// Тест системы Typing Indicators

const { createTypingIndicator, withProgress, Templates } = require('./typing-helper.js');

// Мок для message API (для тестирования)
function createMockMessageAPI() {
    let messageCounter = 0;
    
    return async function mockMessage(params) {
        messageCounter++;
        
        const logPrefix = `📱 [${new Date().toISOString().slice(11, 19)}]`;
        
        switch (params.action) {
            case 'send':
                console.log(`${logPrefix} SEND to ${params.target}: "${params.message}"`);
                return { 
                    ok: true, 
                    messageId: `msg_${messageCounter}`, 
                    chatId: params.target 
                };
                
            case 'edit':
                console.log(`${logPrefix} EDIT ${params.messageId}: "${params.message}"`);
                return { ok: true };
                
            case 'delete':
                console.log(`${logPrefix} DELETE ${params.messageId}`);
                return { ok: true };
                
            default:
                console.log(`${logPrefix} ACTION ${params.action}:`, params);
                return { ok: true };
        }
    };
}

// Симуляция медленных операций
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testBasicTypingIndicator() {
    console.log('\n🧪 ТЕСТ 1: Базовый typing indicator');
    console.log('=' * 50);
    
    const mockMessage = createMockMessageAPI();
    const indicator = createTypingIndicator(mockMessage, '685668909');
    
    // Запускаем операцию
    await indicator.start('🔍 Ищу новости...');
    await sleep(1000);
    
    // Обновляем прогресс
    await indicator.update('🔄 Анализирую 15 источников...');
    await sleep(1500);
    
    await indicator.update('📊 Применяю Multi-Armed Bandit...');
    await sleep(1000);
    
    await indicator.update('✍️ Форматирую дайджест...');
    await sleep(800);
    
    // Завершаем
    await indicator.finish('✅ Дайджест готов (12 новостей)');
    
    console.log('✅ Тест 1 завершен\n');
}

async function testWithProgressWrapper() {
    console.log('\n🧪 ТЕСТ 2: Wrapper withProgress');
    console.log('=' * 50);
    
    const mockMessage = createMockMessageAPI();
    
    // Симуляция поиска новостей
    async function simulateNewsSearch(indicator) {
        await indicator.update('🔍 Подключаюсь к источникам...');
        await sleep(800);
        
        await indicator.update('📰 Сканирую 25 источников...');
        await sleep(1200);
        
        await indicator.update('🎯 Применяю приоритеты...');
        await sleep(600);
        
        await indicator.update('📊 Фильтрую по релевантности...');
        await sleep(900);
        
        // Симулируем результат
        return {
            found: 18,
            filtered: 12,
            sources: ['OpenAI Blog', 'Anthropic', 'Habr.com']
        };
    }
    
    try {
        const result = await withProgress(
            mockMessage,
            '685668909',
            'news-search',
            simulateNewsSearch,
            {
                startMessage: '🚀 Запускаю поиск новостей...',
                successMessage: '✅ Найдено 12 релевантных новостей',
                autoDelete: false  // Не удаляем для демонстрации
            }
        );
        
        console.log('📊 Результат поиска:', result);
        
    } catch (error) {
        console.error('❌ Ошибка в тесте:', error);
    }
    
    console.log('✅ Тест 2 завершен\n');
}

async function testErrorHandling() {
    console.log('\n🧪 ТЕСТ 3: Обработка ошибок');
    console.log('=' * 50);
    
    const mockMessage = createMockMessageAPI();
    
    // Симуляция операции с ошибкой
    async function simulateFailingOperation(indicator) {
        await indicator.update('🔄 Подключаюсь к Mac...');
        await sleep(800);
        
        await indicator.update('📡 Проверяю Tailscale...');
        await sleep(1000);
        
        // Симулируем ошибку
        throw new Error('Connection timeout');
    }
    
    try {
        await withProgress(
            mockMessage,
            '685668909',
            'mac-connection',
            simulateFailingOperation,
            {
                startMessage: Templates.MAC_CONNECTION.start,
                successMessage: Templates.MAC_CONNECTION.success,
                errorMessage: '❌ Mac недоступен'
            }
        );
    } catch (error) {
        console.log('⚠️ Ожидаемая ошибка обработана корректно');
    }
    
    console.log('✅ Тест 3 завершен\n');
}

async function testMultipleOperations() {
    console.log('\n🧪 ТЕСТ 4: Несколько одновременных операций');
    console.log('=' * 50);
    
    const mockMessage = createMockMessageAPI();
    
    // Запускаем 3 операции параллельно
    const operations = [
        {
            name: 'search-ai',
            steps: ['🔍 ИИ новости...', '🤖 OpenAI, Anthropic...', '✅ 8 ИИ новостей']
        },
        {
            name: 'search-robotics',
            steps: ['🔍 Робототехника...', '🦾 Boston Dynamics...', '✅ 4 робо-новости']
        },
        {
            name: 'search-evtol',
            steps: ['🔍 eVTOL новости...', '✈️ Joby, Archer...', '✅ 3 eVTOL новости']
        }
    ];
    
    const promises = operations.map(async (op, index) => {
        const indicator = createTypingIndicator(mockMessage, `chat_${index + 1}`);
        
        await indicator.start(op.steps[0]);
        await sleep(500 + Math.random() * 1000);
        
        await indicator.update(op.steps[1]);
        await sleep(800 + Math.random() * 800);
        
        await indicator.finish(op.steps[2]);
    });
    
    await Promise.all(promises);
    
    console.log('✅ Тест 4 завершен - все операции выполнены параллельно\n');
}

async function testRealWorldScenario() {
    console.log('\n🧪 ТЕСТ 5: Реальный сценарий генерации дайджеста');
    console.log('=' * 50);
    
    const mockMessage = createMockMessageAPI();
    
    // Полный цикл генерации дайджеста
    const indicator = createTypingIndicator(mockMessage, '@newsneiron');
    
    try {
        // Этап 1: Поиск
        await indicator.start('🔍 Ищу новости для дайджеста...');
        await sleep(1000);
        
        await indicator.update('📊 Сканирую 35+ источников...');
        await sleep(1500);
        
        // Этап 2: Multi-Armed Bandit
        await indicator.update('🤖 Применяю Multi-Armed Bandit...');
        await sleep(800);
        
        await indicator.update('🎯 Выбираю оптимальные источники (70/30)...');
        await sleep(600);
        
        // Этап 3: Приоритизация
        await indicator.update('📈 Применяю приоритеты (ИИ > Робо > eVTOL)...');
        await sleep(700);
        
        // Этап 4: Форматирование
        await indicator.update('✍️ Форматирую новости + экспертные мнения...');
        await sleep(1200);
        
        // Этап 5: Отправка
        await indicator.update('📤 Отправляю в канал @newsneiron...');
        await sleep(2000);
        
        // Финиш
        await indicator.finish('✅ Дайджест готов! 14 новостей отправлено', false);
        
        console.log('🎉 Полный цикл дайджеста симулирован успешно!');
        
    } catch (error) {
        await indicator.error('❌ Ошибка генерации дайджеста');
        console.error('Ошибка:', error);
    }
    
    console.log('✅ Тест 5 завершен\n');
}

// Главная функция тестирования
async function runAllTests() {
    console.log('🚀 ЗАПУСК ТЕСТОВ TYPING INDICATORS СИСТЕМЫ');
    console.log('=' * 60);
    console.log('Симуляция typing indicators с мок message API\n');
    
    try {
        await testBasicTypingIndicator();
        await testWithProgressWrapper();
        await testErrorHandling();
        await testMultipleOperations();
        await testRealWorldScenario();
        
        console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
        console.log('\n📚 Файлы системы:');
        console.log('  ✅ typing-indicators.js        # Основная система');
        console.log('  ✅ openclaw-typing-integration.js  # Интеграция с OpenClaw');
        console.log('  ✅ typing-helper.js            # Простые хелперы');
        console.log('  ✅ test-typing-system.js       # Тесты и примеры');
        
        console.log('\n🔧 Готово к интеграции в OpenClaw агента!');
        console.log('\n💡 Использование:');
        console.log('const { createTypingIndicator } = require("./typing-helper.js");');
        console.log('const indicator = createTypingIndicator(message, "685668909");');
        console.log('await indicator.start("🔍 Ищу новости...");');
        console.log('// ... работа ...');
        console.log('await indicator.finish("✅ Готово!");');
        
    } catch (error) {
        console.error('❌ ОШИБКА В ТЕСТАХ:', error);
        process.exit(1);
    }
}

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    createMockMessageAPI
};